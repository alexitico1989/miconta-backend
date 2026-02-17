// ============================================================
// routes/pdf.routes.ts
// Generación y descarga de PDFs de DTEs
// ============================================================

import { Router, Request, Response } from 'express'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'
import { generarYGuardarPdf } from '../services/sii/pdf.service'

const router = Router()

// -------------------------------------------------------
// GET /api/pdf/dte/:documentoId
// Genera y descarga el PDF de un DTE
// -------------------------------------------------------
router.get('/dte/:documentoId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId      = req.userId!
    const documentoId = req.params.documentoId

    // Verificar que el documento pertenece al negocio del usuario
    const documento = await prisma.documentoSii.findUnique({
      where:   { id: documentoId },
      include: { negocio: true },
    })

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    if (documento.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este documento' })
    }

    // Generar el PDF
    const pdfBuffer = await generarYGuardarPdf(documentoId)

    // Headers para descarga
    const tipoLabel = {
      '33': 'Factura',
      '34': 'Factura_Exenta',
      '39': 'Boleta',
      '41': 'Boleta_Exenta',
      '61': 'Nota_Credito',
      '56': 'Nota_Debito',
    }[documento.tipoDocumento] || `DTE_${documento.tipoDocumento}`

    const filename = `${tipoLabel}_${documento.folio}_${documento.negocio.nombreNegocio.replace(/\s+/g, '_')}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    res.send(pdfBuffer)

  } catch (error: any) {
    console.error('Error al generar PDF:', error)
    res.status(500).json({
      error: 'Error al generar PDF del documento',
      detalle: error.message,
    })
  }
})

// -------------------------------------------------------
// GET /api/pdf/dte/:documentoId/preview
// Previsualización del PDF en el navegador (no descarga)
// -------------------------------------------------------
router.get('/dte/:documentoId/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId      = req.userId!
    const documentoId = req.params.documentoId

    const documento = await prisma.documentoSii.findUnique({
      where:   { id: documentoId },
      include: { negocio: true },
    })

    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' })
    }

    if (documento.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para acceder a este documento' })
    }

    const pdfBuffer = await generarYGuardarPdf(documentoId)

    // Para previsualización, usar inline en vez de attachment
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Content-Length', pdfBuffer.length)

    res.send(pdfBuffer)

  } catch (error: any) {
    console.error('Error al generar PDF preview:', error)
    res.status(500).json({
      error: 'Error al generar preview del PDF',
      detalle: error.message,
    })
  }
})

export default router
