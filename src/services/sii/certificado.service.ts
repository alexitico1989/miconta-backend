// ============================================================
// certificado.service.ts
// Gestión segura del certificado digital .p12 del contribuyente
// Encriptación AES-256-GCM — la master key SOLO en .env
// ============================================================

import crypto from 'crypto'
import forge from 'node-forge'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// La master key viene de variables de entorno SIEMPRE
// Nunca hardcoded, nunca en BD
const MASTER_KEY = process.env.CERT_MASTER_KEY!
if (!MASTER_KEY || MASTER_KEY.length < 32) {
  throw new Error('CERT_MASTER_KEY no definida o muy corta (mínimo 32 chars)')
}

// ============================================================
// TIPOS
// ============================================================

export interface CertificadoInfo {
  subject: string        // CN del certificado (nombre del titular)
  rut: string           // RUT extraído del certificado
  validDesde: Date
  validHasta: Date
  emisor: string
  valido: boolean
}

export interface CertificadoCargado {
  privateKey: forge.pki.PrivateKey
  certificate: forge.pki.Certificate
  info: CertificadoInfo
}

// ============================================================
// ENCRIPTACIÓN AES-256-GCM
// ============================================================

function encriptar(data: Buffer | string): {
  encrypted: Buffer
  iv: string
  tag: string
} {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(MASTER_KEY, 'miconta-salt', 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const input = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

function desencriptar(
  encrypted: Buffer,
  iv: string,
  tag: string
): Buffer {
  const key = crypto.scryptSync(MASTER_KEY, 'miconta-salt', 32)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

// ============================================================
// PARSEAR Y VALIDAR EL .p12
// ============================================================

export function parsearCertificado(
  p12Buffer: Buffer,
  password: string
): CertificadoCargado {
  try {
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'))
    const p12Asn1 = forge.asn1.fromDer(p12Der)
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

    // Extraer certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags[forge.pki.oids.certBag]?.[0]
    if (!certBag?.cert) {
      throw new Error('No se encontró certificado en el archivo .p12')
    }
    const certificate = certBag.cert

    // Extraer llave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
    if (!keyBag?.key) {
      throw new Error('No se encontró llave privada en el archivo .p12')
    }
    const privateKey = keyBag.key as forge.pki.PrivateKey

    // Extraer información del certificado
    const subject = certificate.subject.getField('CN')?.value || ''
    const validDesde = certificate.validity.notBefore
    const validHasta = certificate.validity.notAfter
    const emisor = certificate.issuer.getField('CN')?.value || ''

    // Extraer RUT del CN (formato típico SII: "RUT-12345678-9")
    const rutMatch = subject.match(/(\d{1,8}-[\dkK])/i)
    const rut = rutMatch ? rutMatch[1].toUpperCase() : ''

    const ahora = new Date()
    const valido = ahora >= validDesde && ahora <= validHasta

    return {
      privateKey,
      certificate,
      info: {
        subject,
        rut,
        validDesde,
        validHasta,
        emisor,
        valido,
      },
    }
  } catch (error: any) {
    if (error.message?.includes('Invalid password')) {
      throw new Error('Contraseña del certificado incorrecta')
    }
    throw new Error(`Error al leer el certificado: ${error.message}`)
  }
}

// ============================================================
// GUARDAR CERTIFICADO EN BD (encriptado)
// ============================================================

export async function guardarCertificado(
  negocioId: string,
  p12Buffer: Buffer,
  password: string
): Promise<CertificadoInfo> {
  // 1. Validar que el .p12 es correcto antes de guardar
  const { info } = parsearCertificado(p12Buffer, password)

  if (!info.valido) {
    throw new Error(
      `El certificado está vencido (venció el ${info.validHasta.toLocaleDateString('es-CL')})`
    )
  }

  // 2. Encriptar el .p12
  const p12Enc = encriptar(p12Buffer)

  // 3. Encriptar la contraseña
  const passEnc = encriptar(password)

  // 4. Guardar en BD
  await prisma.negocio.update({
    where: { id: negocioId },
    data: {
      certificadoP12:         p12Enc.encrypted,
      certificadoP12Iv:       p12Enc.iv,
      certificadoP12Tag:      p12Enc.tag,
      certificadoPassword:    passEnc.encrypted.toString('base64'),
      certificadoPasswordIv:  passEnc.iv,
      certificadoPasswordTag: passEnc.tag,
      certificadoVencimiento: info.validHasta,
      certificadoActivo:      true,
      certificadoSubject:     info.subject,
    },
  })

  return info
}

// ============================================================
// CARGAR CERTIFICADO DESDE BD (para firmar documentos)
// ⚠️  Usar SOLO en memoria durante el proceso de firma
// ⚠️  Nunca loguear ni serializar el resultado
// ============================================================

export async function cargarCertificado(
  negocioId: string
): Promise<CertificadoCargado> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: {
      certificadoP12:         true,
      certificadoP12Iv:       true,
      certificadoP12Tag:      true,
      certificadoPassword:    true,
      certificadoPasswordIv:  true,
      certificadoPasswordTag: true,
      certificadoActivo:      true,
      certificadoVencimiento: true,
    },
  })

  if (!negocio) throw new Error('Negocio no encontrado')
  if (!negocio.certificadoActivo) throw new Error('El negocio no tiene certificado activo')
  if (
    !negocio.certificadoP12 ||
    !negocio.certificadoP12Iv ||
    !negocio.certificadoP12Tag
  ) {
    throw new Error('Certificado no encontrado en la base de datos')
  }

  // Verificar vencimiento
  if (negocio.certificadoVencimiento && negocio.certificadoVencimiento < new Date()) {
    throw new Error(
      `Certificado vencido el ${negocio.certificadoVencimiento.toLocaleDateString('es-CL')}`
    )
  }

  // Desencriptar contraseña
  const passwordBuffer = desencriptar(
    Buffer.from(negocio.certificadoPassword!, 'base64'),
    negocio.certificadoPasswordIv!,
    negocio.certificadoPasswordTag!
  )
  const password = passwordBuffer.toString('utf8')

  // Desencriptar .p12
  const p12Buffer = desencriptar(
    negocio.certificadoP12,
    negocio.certificadoP12Iv,
    negocio.certificadoP12Tag
  )

  // Parsear y retornar (solo en memoria)
  return parsearCertificado(p12Buffer, password)
}

// ============================================================
// VERIFICAR ESTADO DEL CERTIFICADO (sin desencriptar)
// Para mostrar en la UI
// ============================================================

export async function verificarEstadoCertificado(negocioId: string): Promise<{
  tiene: boolean
  activo: boolean
  vencimiento: Date | null
  subject: string | null
  diasRestantes: number | null
}> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: {
      certificadoActivo:      true,
      certificadoVencimiento: true,
      certificadoSubject:     true,
    },
  })

  if (!negocio || !negocio.certificadoActivo) {
    return { tiene: false, activo: false, vencimiento: null, subject: null, diasRestantes: null }
  }

  const diasRestantes = negocio.certificadoVencimiento
    ? Math.floor(
        (negocio.certificadoVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  return {
    tiene:          true,
    activo:         negocio.certificadoActivo,
    vencimiento:    negocio.certificadoVencimiento,
    subject:        negocio.certificadoSubject,
    diasRestantes,
  }
}

// ============================================================
// ELIMINAR CERTIFICADO (cuando el usuario lo solicita)
// ============================================================

export async function eliminarCertificado(negocioId: string): Promise<void> {
  await prisma.negocio.update({
    where: { id: negocioId },
    data: {
      certificadoP12:         null,
      certificadoP12Iv:       null,
      certificadoP12Tag:      null,
      certificadoPassword:    null,
      certificadoPasswordIv:  null,
      certificadoPasswordTag: null,
      certificadoVencimiento: null,
      certificadoActivo:      false,
      certificadoSubject:     null,
    },
  })
}