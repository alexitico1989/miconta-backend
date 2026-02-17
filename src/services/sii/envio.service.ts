// ============================================================
// envio.service.ts
// Envío de DTEs al SII y consulta de estado
// Maneja el ciclo completo: envío → trackId → estado final
// ============================================================

import axios from 'axios'
import forge from 'node-forge'
import FormData from 'form-data'
import { parseStringPromise } from 'xml2js'
import { obtenerToken, getUrlsSii } from './auth.service'
import { cargarCertificado } from './certificado.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================
// CONSTRUIR EL EnvioDTE (wrapper del DTE para enviar al SII)
// El SII no recibe el DTE directamente — necesita un EnvioDTE
// que puede contener 1 o más DTEs firmado por el emisor
// ============================================================

function construirEnvioDte(
  xmlDte: string,
  emisorRut: string,
  rutEnvia: string,   // RUT del representante o usuario que envía
  certificate: forge.pki.Certificate,
  privateKey: forge.pki.PrivateKey
): string {
  const ahora = new Date().toISOString().replace('T', 'T').substring(0, 19)
  const fecha = ahora.substring(0, 10)

  // Extraer el contenido del DTE (sin la declaración XML)
  const contenidoDte = xmlDte.replace(/<\?xml[^>]*\?>/, '').trim()

  // SetDTE: el contenedor de documentos
  const setDte = `<SetDTE ID="SetDoc">
  <Caratula version="1.0">
    <RutEmisor>${emisorRut}</RutEmisor>
    <RutEnvia>${rutEnvia}</RutEnvia>
    <RutReceptor>60803000-K</RutReceptor>
    <FchResol>${fecha}</FchResol>
    <NroResol>0</NroResol>
    <TmstFirmaEnv>${ahora}</TmstFirmaEnv>
    <SubTotDTE>
      <TpoDTE>39</TpoDTE>
      <NroDTE>1</NroDTE>
    </SubTotDTE>
  </Caratula>
  ${contenidoDte}
</SetDTE>`

  // Firmar el SetDTE
  const md = forge.md.sha1.create()
  md.update(setDte, 'utf8')
  const digestValue = forge.util.encode64(md.digest().bytes())

  const signedInfo = `<SignedInfo>` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#SetDoc">` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const mdSign = forge.md.sha1.create()
  mdSign.update(signedInfo, 'utf8')
  const signatureValue = forge.util.encode64((privateKey as any).sign(mdSign))

  const certBase64 = forge.pki.certificateToPem(certificate)
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '')

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE version="1.0" xmlns="http://www.sii.cl/SiiDte">
  ${setDte}
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfo}
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</EnvioDTE>`
}

// ============================================================
// ENVIAR DTE AL SII
// ============================================================

export async function enviarDteAlSii(
  negocioId:     string,
  documentoSiiId: string,
  xmlDte:        string
): Promise<{ trackId: string; estado: string }> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { rutNegocio: true, ambienteSii: true },
  })
  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii as 'certificacion' | 'produccion'
  const urls     = await getUrlsSii(negocioId)

  // Obtener token de autenticación
  const token = await obtenerToken(negocioId)

  // Cargar certificado para construir el EnvioDTE
  const { privateKey, certificate } = await cargarCertificado(negocioId)

  // Construir el EnvioDTE
  const xmlEnvio = construirEnvioDte(
    xmlDte,
    negocio.rutNegocio,
    negocio.rutNegocio, // El mismo emisor envía
    certificate,
    privateKey
  )

  // Actualizar xmlEnvio en BD
  await prisma.documentoSii.update({
    where: { id: documentoSiiId },
    data:  { xmlEnvio, estado: 'firmado' },
  })

  // Armar el multipart/form-data para el SII
  const [rutSinDv, dv] = negocio.rutNegocio.split('-')
  const form = new FormData()
  form.append('rutSender',    rutSinDv)
  form.append('dvSender',     dv)
  form.append('rutCompany',   rutSinDv)
  form.append('dvCompany',    dv)
  form.append('archivo',      Buffer.from(xmlEnvio, 'utf8'), {
    filename:    'envio_dte.xml',
    contentType: 'text/xml',
  })

  const inicio = Date.now()
  let exitoso  = false
  let trackId  = ''
  let estadoRespuesta = ''
  let errorMsg = ''

  try {
    const response = await axios.post(urls.envio, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `TOKEN=${token}`,
      },
      timeout: 30000,
    })

    const parsed = await parseStringPromise(response.data)

    // Parsear respuesta del SII
    trackId         = parsed?.RECEPCIONDTE?.TRACKID?.[0] || ''
    estadoRespuesta = parsed?.RECEPCIONDTE?.STATUS?.[0] || ''

    if (estadoRespuesta === '0' && trackId) {
      exitoso = true
      // Actualizar documento con trackId
      await prisma.documentoSii.update({
        where: { id: documentoSiiId },
        data:  {
          trackId,
          estado:    'enviado_sii',
          estadoSii: estadoRespuesta,
        },
      })
    } else {
      errorMsg = `SII rechazó el envío. Status: ${estadoRespuesta}`
      await prisma.documentoSii.update({
        where: { id: documentoSiiId },
        data:  {
          estado:      'rechazado_sii',
          estadoSii:   estadoRespuesta,
          glosaEstado: errorMsg,
        },
      })
      throw new Error(errorMsg)
    }
  } catch (error: any) {
    errorMsg = error.message
    throw error
  } finally {
    // Siempre registrar en log
    await prisma.logDte.create({
      data: {
        negocioId,
        documentoSiiId,
        operacion:       'envio_dte',
        exitoso,
        codigoRespuesta: estadoRespuesta,
        mensajeError:    errorMsg || null,
        duracionMs:      Date.now() - inicio,
        ambiente,
        requestResumen:  `EnvioDTE tipo ${xmlDte.match(/<TipoDTE>(\d+)<\/TipoDTE>/)?.[1]} folio ${xmlDte.match(/<Folio>(\d+)<\/Folio>/)?.[1]}`,
        responseResumen: trackId ? `TrackId: ${trackId}` : estadoRespuesta,
      },
    })
  }

  return { trackId, estado: estadoRespuesta }
}

// ============================================================
// CONSULTAR ESTADO DE UN ENVÍO EN EL SII
// Se consulta con el trackId obtenido al enviar
// ============================================================

export async function consultarEstadoEnvio(
  negocioId:      string,
  documentoSiiId: string,
  trackId:        string
): Promise<{ estado: string; glosa: string; aceptado: boolean }> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { rutNegocio: true, ambienteSii: true },
  })
  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii as 'certificacion' | 'produccion'
  const urls     = await getUrlsSii(negocioId)
  const token    = await obtenerToken(negocioId)

  const [rut] = negocio.rutNegocio.split('-')
  const url = `${urls.estado}?RutEmpresa=${rut}&TrackId=${trackId}&Estado=ALL`

  const inicio = Date.now()
  let estado   = ''
  let glosa    = ''
  let aceptado = false

  try {
    const response = await axios.get(url, {
      headers: { Cookie: `TOKEN=${token}` },
      timeout: 15000,
    })

    const parsed = await parseStringPromise(response.data)
    estado  = parsed?.RESULTADO_ENVIO?.ESTADO?.[0] || ''
    glosa   = parsed?.RESULTADO_ENVIO?.GLOSA?.[0]  || ''
    aceptado = estado === 'EPR' || estado === 'ERM' // EPR: Enviado y procesado, ERM: En proceso

    // Actualizar estado en BD
    if (aceptado) {
      await prisma.documentoSii.update({
        where: { id: documentoSiiId },
        data: {
          estado:      'aceptado_sii',
          estadoSii:   estado,
          glosaEstado: glosa,
        },
      })
    } else if (estado === 'RCT' || estado === 'RFR') {
      // RCT: Rechazado, RFR: Rechazado con firma
      await prisma.documentoSii.update({
        where: { id: documentoSiiId },
        data: {
          estado:      'rechazado_sii',
          estadoSii:   estado,
          glosaEstado: glosa,
        },
      })
    }
  } finally {
    await prisma.logDte.create({
      data: {
        negocioId,
        documentoSiiId,
        operacion:       'consulta_estado',
        exitoso:         !!estado,
        codigoRespuesta: estado,
        duracionMs:      Date.now() - inicio,
        ambiente,
        responseResumen: `Estado: ${estado} - ${glosa}`,
      },
    })
  }

  return { estado, glosa, aceptado }
}

// ============================================================
// VERIFICAR Y ACTUALIZAR ESTADOS PENDIENTES
// Cron job: revisar DTEs enviados que aún no tienen estado final
// ============================================================

export async function verificarEstadosPendientes(negocioId: string): Promise<void> {
  const pendientes = await prisma.documentoSii.findMany({
    where: {
      negocioId,
      estado:  'enviado_sii',
      trackId: { not: null },
    },
    take: 20, // Máximo 20 por vez
  })

  for (const doc of pendientes) {
    try {
      await consultarEstadoEnvio(negocioId, doc.id, doc.trackId!)
      // Esperar un poco entre consultas para no saturar el SII
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      // Continuar con el siguiente aunque uno falle
      console.error(`Error consultando estado DTE ${doc.id}:`, error)
    }
  }
}