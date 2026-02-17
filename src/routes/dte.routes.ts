// ============================================================
// routes/dte.routes.ts
// Emisión de Documentos Tributarios Electrónicos
// ============================================================

import { Router, Request, Response } from 'express'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'
import {
  emitirBoleta,
  emitirFactura,
  emitirNotaCredito,
  obtenerHistorialDtes,
} from '../services/sii/dte.service'
import { consultarEstadoEnvio, verificarEstadosPendientes } from '../services/sii/envio.service'

const router = Router()

// -------------------------------------------------------
// POST /api/dte/boleta
// Emite una boleta electrónica (tipo 39)
// Body: { receptorRut?, items[], metodoPago? }
// -------------------------------------------------------
router.post('/boleta', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { receptorRut, items, metodoPago } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debes incluir al menos un item' })
    }

    for (const item of items) {
      if (!item.nombre || !item.cantidad || !item.precioUnitario) {
        return res.status(400).json({
          error: 'Cada item debe tener nombre, cantidad y precioUnitario'
        })
      }
      if (item.cantidad <= 0 || item.precioUnitario <= 0) {
        return res.status(400).json({
          error: 'Cantidad y precio deben ser mayores a 0'
        })
      }
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    if (!negocio.certificadoActivo) {
      return res.status(400).json({
        error: 'Debes subir tu certificado digital antes de emitir documentos'
      })
    }

    const resultado = await emitirBoleta({
      negocioId: negocio.id,
      receptorRut,
      items,
      metodoPago,
    })

    res.status(201).json({
      message: 'Boleta emitida exitosamente',
      folio:       resultado.folio,
      documentoId: resultado.documentoId,
      trackId:     resultado.trackId,
      montos:      resultado.montos,
    })

  } catch (error: any) {
    const erroresEsperados = [
      'certificado', 'CAF', 'folio', 'vencido', 'agotado', 'no tiene precio'
    ]
    if (erroresEsperados.some(e => error.message?.includes(e))) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al emitir boleta:', error)
    res.status(500).json({ error: 'Error al emitir la boleta' })
  }
})

// -------------------------------------------------------
// POST /api/dte/factura
// Emite una factura electrónica (tipo 33)
// Body: datos completos del receptor + items[]
// -------------------------------------------------------
router.post('/factura', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const {
      receptorRut,
      receptorNombre,
      receptorDireccion,
      receptorComuna,
      receptorGiro,
      receptorEmail,
      items,
      metodoPago,
      fechaVencimiento,
    } = req.body

    // Validar campos obligatorios para factura
    if (!receptorRut || !receptorNombre || !receptorDireccion || !receptorComuna || !receptorGiro) {
      return res.status(400).json({
        error: 'Para facturas son obligatorios: receptorRut, receptorNombre, receptorDireccion, receptorComuna, receptorGiro'
      })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debes incluir al menos un item' })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    if (!negocio.certificadoActivo) {
      return res.status(400).json({
        error: 'Debes subir tu certificado digital antes de emitir documentos'
      })
    }

    const resultado = await emitirFactura({
      negocioId: negocio.id,
      receptorRut,
      receptorNombre,
      receptorDireccion,
      receptorComuna,
      receptorGiro,
      receptorEmail,
      items,
      metodoPago,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : undefined,
    })

    res.status(201).json({
      message:     'Factura emitida exitosamente',
      folio:       resultado.folio,
      documentoId: resultado.documentoId,
      trackId:     resultado.trackId,
      montos:      resultado.montos,
    })

  } catch (error: any) {
    const erroresEsperados = ['certificado', 'CAF', 'folio', 'vencido', 'agotado']
    if (erroresEsperados.some(e => error.message?.includes(e))) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al emitir factura:', error)
    res.status(500).json({ error: 'Error al emitir la factura' })
  }
})

// -------------------------------------------------------
// POST /api/dte/nota-credito
// Emite una nota de crédito (tipo 61) para anular/corregir
// Body: { documentoOriginalId, motivo, codigoReferencia, items[] }
// -------------------------------------------------------
router.post('/nota-credito', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { documentoOriginalId, motivo, codigoReferencia, items } = req.body

    if (!documentoOriginalId || !motivo || !codigoReferencia || !items?.length) {
      return res.status(400).json({
        error: 'Faltan campos: documentoOriginalId, motivo, codigoReferencia, items'
      })
    }

    if (!['1', '2', '3'].includes(codigoReferencia)) {
      return res.status(400).json({
        error: 'codigoReferencia debe ser: 1 (Anula), 2 (Corrige texto), 3 (Corrige monto)'
      })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    // Verificar que el documento original pertenece al negocio
    const docOriginal = await prisma.documentoSii.findFirst({
      where: { id: documentoOriginalId, negocioId: negocio.id }
    })
    if (!docOriginal) {
      return res.status(404).json({ error: 'Documento original no encontrado' })
    }

    const resultado = await emitirNotaCredito({
      negocioId:           negocio.id,
      documentoOriginalId,
      motivo,
      codigoReferencia:    codigoReferencia as '1' | '2' | '3',
      items,
    })

    res.status(201).json({
      message:     'Nota de crédito emitida exitosamente',
      folio:       resultado.folio,
      documentoId: resultado.documentoId,
      trackId:     resultado.trackId,
      montos:      resultado.montos,
    })

  } catch (error: any) {
    const erroresEsperados = ['certificado', 'CAF', 'folio', 'vencido', 'agotado']
    if (erroresEsperados.some(e => error.message?.includes(e))) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al emitir nota de crédito:', error)
    res.status(500).json({ error: 'Error al emitir la nota de crédito' })
  }
})

// -------------------------------------------------------
// GET /api/dte/historial
// Lista los DTEs emitidos con filtros opcionales
// Query: tipo, estado, desde, hasta, pagina, por_pagina
// -------------------------------------------------------
router.get('/historial', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { tipo, estado, desde, hasta, pagina, por_pagina } = req.query

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const resultado = await obtenerHistorialDtes(negocio.id, {
      tipo:       tipo as any,
      estado:     estado as string,
      desde:      desde ? new Date(desde as string) : undefined,
      hasta:      hasta ? new Date(hasta as string) : undefined,
      pagina:     pagina ? parseInt(pagina as string) : 1,
      por_pagina: por_pagina ? parseInt(por_pagina as string) : 20,
    })

    res.json(resultado)

  } catch (error) {
    console.error('Error al obtener historial DTE:', error)
    res.status(500).json({ error: 'Error al obtener historial' })
  }
})

// -------------------------------------------------------
// GET /api/dte/:id
// Obtiene el detalle de un DTE específico
// -------------------------------------------------------
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const documento = await prisma.documentoSii.findFirst({
      where: { id, negocioId: negocio.id },
      include: {
        logsDte: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            operacion:       true,
            exitoso:         true,
            codigoRespuesta: true,
            mensajeError:    true,
            duracionMs:      true,
            createdAt:       true,
          }
        }
      }
    })

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    // No retornar el XML completo por defecto (puede ser grande)
    const { xmlDocumento, xmlEnvio, ...documentoSinXml } = documento

    res.json({
      documento: documentoSinXml,
      tieneXml:  !!xmlDocumento,
      tienePdf:  !!documento.pdfUrl,
    })

  } catch (error) {
    console.error('Error al obtener DTE:', error)
    res.status(500).json({ error: 'Error al obtener documento' })
  }
})

// -------------------------------------------------------
// GET /api/dte/:id/xml
// Descarga el XML del DTE
// -------------------------------------------------------
router.get('/:id/xml', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const documento = await prisma.documentoSii.findFirst({
      where:  { id, negocioId: negocio.id },
      select: { xmlDocumento: true, tipoDocumento: true, folio: true }
    })

    if (!documento || !documento.xmlDocumento) {
      return res.status(404).json({ error: 'XML no disponible' })
    }

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="DTE_${documento.tipoDocumento}_${documento.folio}.xml"`
    )
    res.send(documento.xmlDocumento)

  } catch (error) {
    console.error('Error al descargar XML:', error)
    res.status(500).json({ error: 'Error al descargar XML' })
  }
})

// -------------------------------------------------------
// POST /api/dte/:id/consultar-estado
// Consulta el estado de un DTE en el SII usando su trackId
// -------------------------------------------------------
router.post('/:id/consultar-estado', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const documento = await prisma.documentoSii.findFirst({
      where:  { id, negocioId: negocio.id },
      select: { trackId: true, estado: true }
    })

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    if (!documento.trackId) {
      return res.status(400).json({ error: 'El documento aún no tiene trackId (no fue enviado al SII)' })
    }

    const resultado = await consultarEstadoEnvio(negocio.id, id, documento.trackId)

    res.json({
      trackId:  documento.trackId,
      estado:   resultado.estado,
      glosa:    resultado.glosa,
      aceptado: resultado.aceptado,
    })

  } catch (error) {
    console.error('Error al consultar estado DTE:', error)
    res.status(500).json({ error: 'Error al consultar estado en SII' })
  }
})

// -------------------------------------------------------
// POST /api/dte/verificar-pendientes
// Verifica el estado de todos los DTEs enviados pendientes
// (normalmente lo llama un cron job, pero también está disponible manualmente)
// -------------------------------------------------------
router.post('/verificar-pendientes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    await verificarEstadosPendientes(negocio.id)

    res.json({ message: 'Verificación completada' })

  } catch (error) {
    console.error('Error al verificar pendientes:', error)
    res.status(500).json({ error: 'Error al verificar pendientes' })
  }
})

export default router