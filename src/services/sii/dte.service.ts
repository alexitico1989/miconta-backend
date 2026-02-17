// ============================================================
// dte.service.ts
// Orquestador principal del ciclo completo de un DTE
// Este es el servicio que llaman los controllers/routes
// ============================================================

import { PrismaClient } from '@prisma/client'
import { generarDte, DatosEmision } from './xml.service'
import { enviarDteAlSii, consultarEstadoEnvio } from './envio.service'
import { TIPOS_DTE, TipoDte } from './caf.service'

const prisma = new PrismaClient()

// ============================================================
// EMITIR DTE COMPLETO
// Genera → Firma → Guarda en BD → Envía al SII
// ============================================================

export async function emitirDte(datos: DatosEmision): Promise<{
  documentoId: string
  folio:       number
  trackId:     string
  xmlFirmado:  string
  montos: {
    neto:   number
    exento: number
    iva:    number
    total:  number
  }
}> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: datos.negocioId },
    select: { ambienteSii: true, rutNegocio: true },
  })
  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii

  // 1. Generar y firmar el DTE
  const dte = await generarDte(datos)

  // 2. Guardar en BD como "firmado"
  const documentoSii = await prisma.documentoSii.create({
    data: {
      negocioId:        datos.negocioId,
      tipoDocumento:    datos.tipoDocumento,
      folio:            dte.folio,
      fechaEmision:     datos.fechaEmision,
      ambiente,
      estado:           'firmado',
      receptorRut:      datos.receptorRut,
      receptorNombre:   datos.receptorNombre,
      receptorDireccion: datos.receptorDireccion,
      receptorComuna:   datos.receptorComuna,
      receptorGiro:     datos.receptorGiro,
      receptorEmail:    datos.receptorEmail,
      montoNeto:        dte.montoNeto,
      montoExento:      dte.montoExento,
      montoIva:         dte.montoIva,
      montoTotal:       dte.montoTotal,
      xmlDocumento:     dte.xmlFirmado,
      timbreElectronico: dte.timbreElectronico,
      referenciaFolio:  datos.referenciaFolio,
      referenciaTipo:   datos.referenciaTipo,
      referenciaRazon:  datos.referenciaRazon,
      codigoReferencia: datos.codigoReferencia,
    },
  })

  // 3. Enviar al SII
  const { trackId } = await enviarDteAlSii(
    datos.negocioId,
    documentoSii.id,
    dte.xmlFirmado
  )

  return {
    documentoId: documentoSii.id,
    folio:       dte.folio,
    trackId,
    xmlFirmado:  dte.xmlFirmado,
    montos: {
      neto:   dte.montoNeto,
      exento: dte.montoExento,
      iva:    dte.montoIva,
      total:  dte.montoTotal,
    },
  }
}

// ============================================================
// EMITIR BOLETA ELECTRÓNICA (tipo 39)
// Simplificado para el caso más común (venta al consumidor)
// ============================================================

export async function emitirBoleta(params: {
  negocioId:    string
  receptorRut?: string   // Opcional en boletas
  items: Array<{
    nombre:         string
    cantidad:       number
    precioUnitario: number
    exento?:        boolean
  }>
  metodoPago?: string
}): Promise<ReturnType<typeof emitirDte>> {
  return emitirDte({
    negocioId:     params.negocioId,
    tipoDocumento: TIPOS_DTE.BOLETA,
    fechaEmision:  new Date(),
    receptorRut:   params.receptorRut || '66666666-6', // RUT genérico para boletas sin receptor
    receptorNombre: 'CONSUMIDOR FINAL',
    items:         params.items.map((item, i) => ({
      numeroLinea:    i + 1,
      nombre:         item.nombre,
      cantidad:       item.cantidad,
      unidadMedida:   'UN',
      precioUnitario: item.precioUnitario,
      exento:         item.exento,
    })),
    metodoPago: params.metodoPago,
  })
}

// ============================================================
// EMITIR FACTURA ELECTRÓNICA (tipo 33)
// Requiere datos completos del receptor
// ============================================================

export async function emitirFactura(params: {
  negocioId:        string
  receptorRut:      string
  receptorNombre:   string
  receptorDireccion: string
  receptorComuna:   string
  receptorGiro:     string
  receptorEmail?:   string
  items: Array<{
    nombre:         string
    cantidad:       number
    unidadMedida?:  string
    precioUnitario: number
    descripcion?:   string
    descuentoPct?:  number
  }>
  metodoPago?:      'efectivo' | 'transferencia' | 'tarjeta' | 'credito'
  fechaVencimiento?: Date
}): Promise<ReturnType<typeof emitirDte>> {
  return emitirDte({
    negocioId:        params.negocioId,
    tipoDocumento:    TIPOS_DTE.FACTURA,
    fechaEmision:     new Date(),
    receptorRut:      params.receptorRut,
    receptorNombre:   params.receptorNombre,
    receptorDireccion: params.receptorDireccion,
    receptorComuna:   params.receptorComuna,
    receptorGiro:     params.receptorGiro,
    receptorEmail:    params.receptorEmail,
    items:            params.items.map((item, i) => ({
      numeroLinea:    i + 1,
      nombre:         item.nombre,
      descripcion:    item.descripcion,
      cantidad:       item.cantidad,
      unidadMedida:   item.unidadMedida || 'UN',
      precioUnitario: item.precioUnitario,
      descuentoPct:   item.descuentoPct,
    })),
    metodoPago:       params.metodoPago,
    fechaVencimiento: params.fechaVencimiento,
  })
}

// ============================================================
// EMITIR NOTA DE CRÉDITO (tipo 61)
// Para anular o corregir una factura/boleta
// ============================================================

export async function emitirNotaCredito(params: {
  negocioId:           string
  documentoOriginalId: string
  motivo:              string
  codigoReferencia:    '1' | '2' | '3' // 1:Anula, 2:Corrige texto, 3:Corrige monto
  items: Array<{
    nombre:         string
    cantidad:       number
    precioUnitario: number
  }>
}): Promise<ReturnType<typeof emitirDte>> {
  // Obtener datos del documento original
  const docOriginal = await prisma.documentoSii.findUnique({
    where: { id: params.documentoOriginalId },
  })
  if (!docOriginal) throw new Error('Documento original no encontrado')

  return emitirDte({
    negocioId:        params.negocioId,
    tipoDocumento:    TIPOS_DTE.NOTA_CREDITO,
    fechaEmision:     new Date(),
    receptorRut:      docOriginal.receptorRut,
    receptorNombre:   docOriginal.receptorNombre,
    receptorDireccion: docOriginal.receptorDireccion || undefined,
    receptorComuna:   docOriginal.receptorComuna || undefined,
    receptorGiro:     docOriginal.receptorGiro || undefined,
    items:            params.items.map((item, i) => ({
      numeroLinea:    i + 1,
      nombre:         item.nombre,
      cantidad:       item.cantidad,
      unidadMedida:   'UN',
      precioUnitario: item.precioUnitario,
    })),
    referenciaFolio:  docOriginal.folio,
    referenciaTipo:   docOriginal.tipoDocumento,
    referenciaRazon:  params.motivo,
    codigoReferencia: params.codigoReferencia,
  })
}

// ============================================================
// OBTENER HISTORIAL DE DTEs DE UN NEGOCIO
// ============================================================

export async function obtenerHistorialDtes(
  negocioId: string,
  filtros?: {
    tipo?:   TipoDte
    estado?: string
    desde?:  Date
    hasta?:  Date
    pagina?: number
    por_pagina?: number
  }
) {
  const pagina    = filtros?.pagina || 1
  const porPagina = filtros?.por_pagina || 20

  const where: any = { negocioId }
  if (filtros?.tipo)   where.tipoDocumento = filtros.tipo
  if (filtros?.estado) where.estado = filtros.estado
  if (filtros?.desde || filtros?.hasta) {
    where.fechaEmision = {}
    if (filtros.desde) where.fechaEmision.gte = filtros.desde
    if (filtros.hasta) where.fechaEmision.lte = filtros.hasta
  }

  const [total, documentos] = await Promise.all([
    prisma.documentoSii.count({ where }),
    prisma.documentoSii.findMany({
      where,
      orderBy: { fechaEmision: 'desc' },
      skip:    (pagina - 1) * porPagina,
      take:    porPagina,
      select: {
        id:             true,
        tipoDocumento:  true,
        folio:          true,
        fechaEmision:   true,
        estado:         true,
        receptorRut:    true,
        receptorNombre: true,
        montoTotal:     true,
        trackId:        true,
        pdfUrl:         true,
        acuseRecibo:    true,
      },
    }),
  ])

  return {
    documentos,
    total,
    paginas: Math.ceil(total / porPagina),
    pagina,
  }
}