// ============================================================
// routes/libroCV.routes.ts
// Gestión del Libro de Compras y Ventas mensual
// ============================================================

import { Router, Request, Response } from 'express'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'
import {
  generarLibroCV,
  enviarLibroCV,
  generarYEnviarLibroCV,
  getEstadoLibrosCV,
} from '../services/sii/libroCV.service'

const router = Router()

// -------------------------------------------------------
// POST /api/libro-cv/generar
// Genera el XML del libro (sin enviarlo)
// Body: { tipo: 'compra' | 'venta', mes: number, anio: number }
// -------------------------------------------------------
router.post('/generar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { tipo, mes, anio } = req.body

    if (!tipo || !mes || !anio) {
      return res.status(400).json({ error: 'tipo, mes y anio son requeridos' })
    }

    if (tipo !== 'compra' && tipo !== 'venta') {
      return res.status(400).json({ error: 'tipo debe ser "compra" o "venta"' })
    }

    if (mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'mes debe estar entre 1 y 12' })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const resultado = await generarLibroCV(negocio.id, tipo, mes, anio)

    res.json({
      message: 'Libro generado exitosamente',
      libroId: resultado.libroId,
      resumen: resultado.resumen,
    })

  } catch (error: any) {
    if (error.message?.includes('No hay documentos')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al generar libro CV:', error)
    res.status(500).json({ error: 'Error al generar libro de compra/venta' })
  }
})

// -------------------------------------------------------
// POST /api/libro-cv/enviar/:libroId
// Envía un libro ya generado al SII
// -------------------------------------------------------
router.post('/enviar/:libroId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId   = req.userId!
    const libroId  = req.params.libroId

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    // Verificar que el libro pertenece al negocio
    const libro = await prisma.libroCV.findFirst({
      where: { id: libroId, negocioId: negocio.id }
    })
    if (!libro) {
      return res.status(404).json({ error: 'Libro no encontrado' })
    }

    const { trackId } = await enviarLibroCV(negocio.id, libroId)

    res.json({
      message: 'Libro enviado al SII exitosamente',
      trackId,
    })

  } catch (error: any) {
    if (error.message?.includes('no tiene XML')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al enviar libro CV:', error)
    res.status(500).json({ error: 'Error al enviar libro al SII' })
  }
})

// -------------------------------------------------------
// POST /api/libro-cv/generar-y-enviar
// Genera y envía en un solo paso (opción rápida)
// Body: { tipo: 'compra' | 'venta', mes: number, anio: number }
// -------------------------------------------------------
router.post('/generar-y-enviar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { tipo, mes, anio } = req.body

    if (!tipo || !mes || !anio) {
      return res.status(400).json({ error: 'tipo, mes y anio son requeridos' })
    }

    if (tipo !== 'compra' && tipo !== 'venta') {
      return res.status(400).json({ error: 'tipo debe ser "compra" o "venta"' })
    }

    if (mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'mes debe estar entre 1 y 12' })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    if (!negocio.certificadoActivo) {
      return res.status(400).json({
        error: 'Debes tener un certificado digital activo para enviar libros al SII'
      })
    }

    const { trackId, resumen } = await generarYEnviarLibroCV(negocio.id, tipo, mes, anio)

    res.json({
      message: 'Libro generado y enviado al SII exitosamente',
      trackId,
      resumen,
    })

  } catch (error: any) {
    if (error.message?.includes('No hay documentos')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al generar y enviar libro CV:', error)
    res.status(500).json({ error: 'Error al generar y enviar libro' })
  }
})

// -------------------------------------------------------
// GET /api/libro-cv/historial
// Lista los libros CV del negocio
// Query params: anio (opcional)
// -------------------------------------------------------
router.get('/historial', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { anio } = req.query

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const libros = await getEstadoLibrosCV(
      negocio.id,
      anio ? parseInt(anio as string) : undefined
    )

    res.json({
      libros,
      total: libros.length,
    })

  } catch (error) {
    console.error('Error al obtener historial de libros CV:', error)
    res.status(500).json({ error: 'Error al obtener historial de libros' })
  }
})

// -------------------------------------------------------
// GET /api/libro-cv/:libroId
// Obtiene el detalle de un libro específico
// -------------------------------------------------------
router.get('/:libroId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.userId!
    const libroId = req.params.libroId

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const libro = await prisma.libroCV.findFirst({
      where: { id: libroId, negocioId: negocio.id }
    })

    if (!libro) {
      return res.status(404).json({ error: 'Libro no encontrado' })
    }

    // No retornar el XML completo (puede ser muy grande)
    const { xmlLibro, ...libroSinXml } = libro

    res.json({
      libro: libroSinXml,
      tieneXml: !!xmlLibro,
    })

  } catch (error) {
    console.error('Error al obtener libro CV:', error)
    res.status(500).json({ error: 'Error al obtener libro' })
  }
})

// -------------------------------------------------------
// GET /api/libro-cv/:libroId/xml
// Descarga el XML del libro
// -------------------------------------------------------
router.get('/:libroId/xml', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.userId!
    const libroId = req.params.libroId

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const libro = await prisma.libroCV.findFirst({
      where:  { id: libroId, negocioId: negocio.id },
      select: { xmlLibro: true, tipo: true, mes: true, anio: true }
    })

    if (!libro || !libro.xmlLibro) {
      return res.status(404).json({ error: 'XML no disponible' })
    }

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="LibroCV_${libro.tipo}_${libro.anio}_${libro.mes}.xml"`
    )
    res.send(libro.xmlLibro)

  } catch (error) {
    console.error('Error al descargar XML del libro:', error)
    res.status(500).json({ error: 'Error al descargar XML' })
  }
})

// -------------------------------------------------------
// DELETE /api/libro-cv/:libroId
// Elimina un libro (solo si está en estado "generado" o "pendiente")
// -------------------------------------------------------
router.delete('/:libroId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = req.userId!
    const libroId = req.params.libroId

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const libro = await prisma.libroCV.findFirst({
      where: { id: libroId, negocioId: negocio.id }
    })

    if (!libro) {
      return res.status(404).json({ error: 'Libro no encontrado' })
    }

    if (libro.estado === 'enviado' || libro.estado === 'aceptado') {
      return res.status(400).json({
        error: 'No se puede eliminar un libro que ya fue enviado o aceptado por el SII'
      })
    }

    await prisma.libroCV.delete({ where: { id: libroId } })

    res.json({ message: 'Libro eliminado exitosamente' })

  } catch (error) {
    console.error('Error al eliminar libro CV:', error)
    res.status(500).json({ error: 'Error al eliminar libro' })
  }
})

export default router
