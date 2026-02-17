// ============================================================
// auth.service.ts
// Autenticación con el SII usando certificado digital
// El SII usa un sistema de semilla + firma para generar tokens
// ============================================================

import axios from 'axios'
import forge from 'node-forge'
import { parseStringPromise } from 'xml2js'
import { cargarCertificado } from './certificado.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// URLs del SII según ambiente
const SII_URLS = {
  certificacion: {
    semilla: 'https://maullin.sii.cl/DTEWS/CrSeed.jws',
    token:   'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws',
    envio:   'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload',
    estado:  'https://maullin.sii.cl/DTEWS/QueryEstDteFromDTE.jws',
  },
  produccion: {
    semilla: 'https://palena.sii.cl/DTEWS/CrSeed.jws',
    token:   'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws',
    envio:   'https://palena.sii.cl/cgi_dte/UPL/DTEUpload',
    estado:  'https://palena.sii.cl/DTEWS/QueryEstDteFromDTE.jws',
  },
}

// Cache de tokens en memoria (evita pedir uno nuevo en cada operación)
// El token del SII dura ~60 segundos
interface TokenCache {
  token: string
  expira: Date
}
const tokenCache = new Map<string, TokenCache>()

// ============================================================
// OBTENER URLS SEGÚN AMBIENTE DEL NEGOCIO
// ============================================================

export async function getUrlsSii(negocioId: string) {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { ambienteSii: true },
  })
  const ambiente = (negocio?.ambienteSii || 'certificacion') as keyof typeof SII_URLS
  return SII_URLS[ambiente]
}

// ============================================================
// PASO 1: OBTENER SEMILLA DEL SII
// El SII entrega una semilla temporal que debes firmar
// ============================================================

async function obtenerSemilla(ambiente: 'certificacion' | 'produccion'): Promise<string> {
  const url = SII_URLS[ambiente].semilla

  try {
    const response = await axios.get(url, { timeout: 10000 })
    const parsed = await parseStringPromise(response.data)

    // La semilla viene en SOAP: SII:RESP_HDR > SII:SEMILLA
    const semilla =
      parsed?.['S:Envelope']?.['S:Body']?.[0]
        ?.['ns2:getSeedResponse']?.[0]
        ?.['return']?.[0]
        ?.['SII:RESP_BODY']?.[0]
        ?.['SII:SEMILLA']?.[0]

    if (!semilla) {
      throw new Error('No se pudo obtener la semilla del SII')
    }

    return semilla
  } catch (error: any) {
    throw new Error(`Error al obtener semilla SII: ${error.message}`)
  }
}

// ============================================================
// PASO 2: FIRMAR LA SEMILLA CON EL CERTIFICADO
// ============================================================

function firmarSemilla(
  semilla: string,
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate
): string {
  // Construir el XML de la semilla a firmar
  const xmlSemilla = `<getToken>
  <item>
    <Semilla>${semilla}</Semilla>
  </item>
</getToken>`

  // Calcular digest SHA1 del XML
  const md = forge.md.sha1.create()
  md.update(xmlSemilla, 'utf8')
  const digest = forge.util.encode64(md.digest().bytes())

  // Firmar el digest con la llave privada
  const signature = forge.util.encode64(
    (privateKey as any).sign(forge.md.sha1.create().update(xmlSemilla, 'utf8'))
  )

  // Obtener el certificado en base64
  const certPem = forge.pki.certificateToPem(certificate)
  const certBase64 = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '')

  // Construir XML firmado según estándar SII
  const xmlFirmado = `<getToken>
  <item>
    <Semilla>${semilla}</Semilla>
  </item>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="">
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${digest}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signature}</SignatureValue>
    <KeyInfo>
      <KeyValue>
        <X509Data>
          <X509Certificate>${certBase64}</X509Certificate>
        </X509Data>
      </KeyValue>
    </KeyInfo>
  </Signature>
</getToken>`

  return xmlFirmado
}

// ============================================================
// PASO 3: OBTENER TOKEN DEL SII
// ============================================================

async function obtenerTokenDesdeSemilla(
  xmlFirmado: string,
  ambiente: 'certificacion' | 'produccion'
): Promise<string> {
  const url = SII_URLS[ambiente].token

  try {
    const response = await axios.post(url, xmlFirmado, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000,
    })

    const parsed = await parseStringPromise(response.data)

    const token =
      parsed?.['S:Envelope']?.['S:Body']?.[0]
        ?.['ns2:getTokenResponse']?.[0]
        ?.['return']?.[0]
        ?.['SII:RESP_BODY']?.[0]
        ?.['SII:TOKEN']?.[0]

    if (!token) {
      // Intentar leer el error del SII
      const estado =
        parsed?.['S:Envelope']?.['S:Body']?.[0]
          ?.['ns2:getTokenResponse']?.[0]
          ?.['return']?.[0]
          ?.['SII:RESP_HDR']?.[0]
          ?.['SII:ESTADO']?.[0]

      throw new Error(`SII rechazó el token. Estado: ${estado || 'desconocido'}`)
    }

    return token
  } catch (error: any) {
    throw new Error(`Error al obtener token SII: ${error.message}`)
  }
}

// ============================================================
// FUNCIÓN PRINCIPAL: OBTENER TOKEN (con cache)
// ============================================================

export async function obtenerToken(negocioId: string): Promise<string> {
  // Revisar cache primero
  const cached = tokenCache.get(negocioId)
  if (cached && cached.expira > new Date()) {
    return cached.token
  }

  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { ambienteSii: true },
  })

  const ambiente = (negocio?.ambienteSii || 'certificacion') as 'certificacion' | 'produccion'

  // Cargar certificado desde BD (desencripta en memoria)
  const { privateKey, certificate } = await cargarCertificado(negocioId)

  // Flujo de autenticación SII
  const semilla = await obtenerSemilla(ambiente)
  const xmlFirmado = firmarSemilla(semilla, privateKey, certificate)
  const token = await obtenerTokenDesdeSemilla(xmlFirmado, ambiente)

  // Guardar en cache por 50 segundos (el SII lo vence en ~60s)
  tokenCache.set(negocioId, {
    token,
    expira: new Date(Date.now() + 50 * 1000),
  })

  // Registrar en log
  await prisma.logDte.create({
    data: {
      negocioId,
      operacion:      'autenticacion_sii',
      exitoso:        true,
      ambiente,
      responseResumen: 'Token obtenido correctamente',
    },
  })

  return token
}

// ============================================================
// LIMPIAR CACHE (útil para testing o cuando hay errores)
// ============================================================

export function limpiarTokenCache(negocioId?: string): void {
  if (negocioId) {
    tokenCache.delete(negocioId)
  } else {
    tokenCache.clear()
  }
}