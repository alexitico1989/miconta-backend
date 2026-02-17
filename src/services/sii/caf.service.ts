// ============================================================
// caf.service.ts
// Gestión del CAF (Código de Autorización de Folios)
// El SII entrega el CAF por tipo de documento
// Sin CAF válido no se puede emitir ningún DTE
// ============================================================

import forge from 'node-forge'
import crypto from 'crypto'
import { parseStringPromise } from 'xml2js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MASTER_KEY = process.env.CERT_MASTER_KEY!

// ============================================================
// TIPOS DE DOCUMENTO SII
// ============================================================

export const TIPOS_DTE = {
  FACTURA:           '33',
  FACTURA_EXENTA:    '34',
  BOLETA:            '39',
  BOLETA_EXENTA:     '41',
  GUIA_DESPACHO:     '52',
  NOTA_DEBITO:       '56',
  NOTA_CREDITO:      '61',
} as const

export type TipoDte = typeof TIPOS_DTE[keyof typeof TIPOS_DTE]

// ============================================================
// ENCRIPTACIÓN (igual que en certificado.service.ts)
// ============================================================

function encriptar(texto: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(MASTER_KEY, 'miconta-salt', 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(texto, 'utf8')),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return {
    encrypted: encrypted.toString('base64'),
    iv:        iv.toString('base64'),
    tag:       tag.toString('base64'),
  }
}

function desencriptar(encrypted: string, iv: string, tag: string): string {
  const key = crypto.scryptSync(MASTER_KEY, 'miconta-salt', 32)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  const result = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ])

  return result.toString('utf8')
}

// ============================================================
// PARSEAR XML DEL CAF
// El SII entrega el CAF como un XML firmado
// ============================================================

interface CafParseado {
  tipoDocumento: string
  folioDesde:    number
  folioHasta:    number
  fechaVencimiento?: Date
  xmlCompleto:   string
  privateKey:    string  // Llave privada del CAF en PEM
  publicKey:     string  // Llave pública del CAF
  idAfirmar:     string  // ID del elemento a firmar en el DTE
}

export function parsearXmlCaf(xmlCaf: string): CafParseado {
  // Parsear el XML del CAF sincrónicamente con regex básico
  // (el CAF es simple, no necesita parser completo)
  const tipoMatch = xmlCaf.match(/<TD>(\d+)<\/TD>/)
  const desdeMatch = xmlCaf.match(/<RNG>.*?<D>(\d+)<\/D>/s)
  const hastaMatch = xmlCaf.match(/<RNG>.*?<H>(\d+)<\/H>/s)
  const fechaMatch = xmlCaf.match(/<FA>([^<]+)<\/FA>/)
  const privateKeyMatch = xmlCaf.match(/<RSASK>([^<]+)<\/RSASK>/)
  const publicKeyMatch = xmlCaf.match(/<RSAPK>[\s\S]*?<\/RSAPK>/)

  if (!tipoMatch || !desdeMatch || !hastaMatch) {
    throw new Error('XML del CAF inválido o incompleto')
  }

  if (!privateKeyMatch) {
    throw new Error('CAF no contiene llave privada (RSASK)')
  }

  const tipoDocumento = tipoMatch[1]
  const folioDesde = parseInt(desdeMatch[1])
  const folioHasta = parseInt(hastaMatch[1])

  // La fecha de vencimiento del CAF (opcional, no todos tienen)
  let fechaVencimiento: Date | undefined
  if (fechaMatch) {
    fechaVencimiento = new Date(fechaMatch[1])
  }

  // La llave privada viene en formato específico del SII
  // Se convierte a PEM estándar para uso con forge/crypto
  const privateKeyRaw = privateKeyMatch[1].trim()

  return {
    tipoDocumento,
    folioDesde,
    folioHasta,
    fechaVencimiento,
    xmlCompleto:  xmlCaf,
    privateKey:   privateKeyRaw,
    publicKey:    publicKeyMatch?.[0] || '',
    idAfirmar:    `T${tipoDocumento}F${folioDesde}`,
  }
}

// ============================================================
// CARGAR CAF DESDE ARCHIVO XML (lo sube el usuario o se obtiene del SII)
// ============================================================

export async function cargarCaf(
  negocioId: string,
  xmlCaf: string,
  ambiente: 'certificacion' | 'produccion' = 'certificacion'
): Promise<void> {
  const caf = parsearXmlCaf(xmlCaf)

  // Verificar que no existe ya un CAF activo para este rango
  const existente = await prisma.cafFolio.findFirst({
    where: {
      negocioId,
      tipoDocumento: caf.tipoDocumento,
      activo:        true,
      ambiente,
      folioDesde:    { lte: caf.folioHasta },
      folioHasta:    { gte: caf.folioDesde },
    },
  })

  if (existente) {
    // Desactivar el anterior
    await prisma.cafFolio.update({
      where: { id: existente.id },
      data:  { activo: false },
    })
  }

  // Encriptar la llave privada del CAF
  const pkEnc = encriptar(caf.privateKey)

  // Guardar en BD
  await prisma.cafFolio.create({
    data: {
      negocioId,
      tipoDocumento:    caf.tipoDocumento,
      folioDesde:       caf.folioDesde,
      folioHasta:       caf.folioHasta,
      folioActual:      caf.folioDesde,  // Empieza desde el primer folio
      xmlCaf:           xmlCaf,          // XML completo del CAF
      privateKey:       pkEnc.encrypted,
      privateKeyIv:     pkEnc.iv,
      privateKeyTag:    pkEnc.tag,
      activo:           true,
      fechaVencimiento: caf.fechaVencimiento,
      foliosUsados:     0,
      foliosDisponibles: caf.folioHasta - caf.folioDesde + 1,
      ambiente,
    },
  })

  // Crear alerta si quedan pocos folios
  const total = caf.folioHasta - caf.folioDesde + 1
  if (total < 50) {
    await prisma.alerta.create({
      data: {
        negocioId,
        tipo:      'folios_agotando',
        titulo:    `Pocos folios disponibles — Tipo ${caf.tipoDocumento}`,
        mensaje:   `Solo ${total} folios disponibles. Solicita un nuevo CAF pronto.`,
        prioridad: total < 20 ? 'alta' : 'media',
      },
    })
  }
}

// ============================================================
// OBTENER SIGUIENTE FOLIO DISPONIBLE
// ============================================================

export async function obtenerSiguienteFolio(
  negocioId: string,
  tipoDocumento: TipoDte,
  ambiente: 'certificacion' | 'produccion' = 'certificacion'
): Promise<{
  folio:       number
  cafId:       string
  privateKey:  string  // Llave privada desencriptada (solo en memoria)
  xmlCaf:      string
}> {
  const caf = await prisma.cafFolio.findFirst({
    where: {
      negocioId,
      tipoDocumento,
      activo: true,
      ambiente,
    },
    orderBy: { folioDesde: 'asc' },
  })

  if (!caf) {
    throw new Error(
      `No hay CAF activo para tipo de documento ${tipoDocumento}. ` +
      `Debes cargar el CAF desde el SII primero.`
    )
  }

  if (caf.folioActual > caf.folioHasta) {
    // Este CAF está agotado
    await prisma.cafFolio.update({
      where: { id: caf.id },
      data:  { activo: false },
    })
    throw new Error(
      `CAF agotado para tipo ${tipoDocumento}. ` +
      `Solicita un nuevo CAF al SII.`
    )
  }

  const folio = caf.folioActual
  const foliosDisponibles = caf.folioHasta - folio

  // Actualizar el folio actual
  await prisma.cafFolio.update({
    where: { id: caf.id },
    data: {
      folioActual:       folio + 1,
      foliosUsados:      { increment: 1 },
      foliosDisponibles: foliosDisponibles,
    },
  })

  // Alerta si quedan pocos folios
  if (foliosDisponibles <= 50 && foliosDisponibles > 0) {
    await prisma.alerta.upsert({
      where: {
        // upsert para no crear múltiples alertas del mismo tipo
        id: `${negocioId}-folios-${tipoDocumento}`,
      },
      update: {
        mensaje:  `Quedan ${foliosDisponibles} folios para tipo ${tipoDocumento}.`,
        leida:    false,
        resuelta: false,
      },
      create: {
        id:        `${negocioId}-folios-${tipoDocumento}`,
        negocioId,
        tipo:      'folios_agotando',
        titulo:    `Pocos folios — Tipo ${tipoDocumento}`,
        mensaje:   `Quedan ${foliosDisponibles} folios disponibles.`,
        prioridad: foliosDisponibles <= 20 ? 'urgente' : 'alta',
      },
    })
  }

  // Desencriptar llave privada del CAF (solo en memoria)
  const privateKeyPem = desencriptar(caf.privateKey, caf.privateKeyIv, caf.privateKeyTag)

  return {
    folio,
    cafId:      caf.id,
    privateKey: privateKeyPem,
    xmlCaf:     caf.xmlCaf,
  }
}

// ============================================================
// CONSULTAR ESTADO DE FOLIOS (para la UI)
// ============================================================

export async function consultarEstadoFolios(negocioId: string): Promise<
  Array<{
    tipoDocumento:     string
    nombreTipo:        string
    folioDesde:        number
    folioHasta:        number
    folioActual:       number
    foliosDisponibles: number
    foliosUsados:      number
    porcentajeUsado:   number
    fechaVencimiento:  Date | null
    activo:            boolean
  }>
> {
  const nombres: Record<string, string> = {
    '33': 'Factura Electrónica',
    '34': 'Factura No Afecta',
    '39': 'Boleta Electrónica',
    '41': 'Boleta No Afecta',
    '52': 'Guía de Despacho',
    '56': 'Nota de Débito',
    '61': 'Nota de Crédito',
  }

  const cafList = await prisma.cafFolio.findMany({
    where:   { negocioId, activo: true },
    orderBy: { tipoDocumento: 'asc' },
  })

  return cafList.map(caf => {
    const total = caf.folioHasta - caf.folioDesde + 1
    return {
      tipoDocumento:     caf.tipoDocumento,
      nombreTipo:        nombres[caf.tipoDocumento] || `Tipo ${caf.tipoDocumento}`,
      folioDesde:        caf.folioDesde,
      folioHasta:        caf.folioHasta,
      folioActual:       caf.folioActual,
      foliosDisponibles: caf.foliosDisponibles,
      foliosUsados:      caf.foliosUsados,
      porcentajeUsado:   Math.round((caf.foliosUsados / total) * 100),
      fechaVencimiento:  caf.fechaVencimiento,
      activo:            caf.activo,
    }
  })
}