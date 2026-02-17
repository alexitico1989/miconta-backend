// ============================================================
// routes/caf.routes.ts
// Gestión del CAF por tipo de documento
// ============================================================

import { Router, Request, Response } from 'express'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'
import {
  cargarCaf,
  consultarEstadoFolios,
} from '../services/sii/caf.service'

const router = Router()

// -------------------------------------------------------
// POST /api/caf/cargar
// Carga un XML de CAF obtenido desde el SII
// Body: { xmlCaf: string, ambiente?: 'certificacion' | 'produccion' }
// -------------------------------------------------------
router.post('/cargar', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { xmlCaf, ambiente } = req.body

    if (!xmlCaf) {
      return res.status(400).json({ error: 'El XML del CAF es requerido' })
    }

    if (typeof xmlCaf !== 'string' || !xmlCaf.includes('<AUTORIZACION>')) {
      return res.status(400).json({ error: 'El XML del CAF no tiene el formato correcto' })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    await cargarCaf(
      negocio.id,
      xmlCaf,
      ambiente || negocio.ambienteSii as 'certificacion' | 'produccion'
    )

    // Retornar estado actualizado de folios
    const estadoFolios = await consultarEstadoFolios(negocio.id)

    res.json({
      message:      'CAF cargado exitosamente',
      estadoFolios,
    })

  } catch (error: any) {
    if (error.message?.includes('inválido') || error.message?.includes('RSASK')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('Error al cargar CAF:', error)
    res.status(500).json({ error: 'Error al cargar el CAF' })
  }
})

// -------------------------------------------------------
// GET /api/caf/estado
// Retorna el estado de todos los CAF activos del negocio
// -------------------------------------------------------
router.get('/estado', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const estadoFolios = await consultarEstadoFolios(negocio.id)

    res.json({
      ambiente:     negocio.ambienteSii,
      estadoFolios,
    })

  } catch (error) {
    console.error('Error al consultar estado CAF:', error)
    res.status(500).json({ error: 'Error al consultar estado de folios' })
  }
})

// -------------------------------------------------------
// GET /api/caf/historial
// Lista todos los CAF del negocio (activos e inactivos)
// -------------------------------------------------------
router.get('/historial', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const cafList = await prisma.cafFolio.findMany({
      where:   { negocioId: negocio.id },
      orderBy: [{ tipoDocumento: 'asc' }, { createdAt: 'desc' }],
      select: {
        id:               true,
        tipoDocumento:    true,
        folioDesde:       true,
        folioHasta:       true,
        folioActual:      true,
        foliosUsados:     true,
        foliosDisponibles: true,
        activo:           true,
        fechaVencimiento: true,
        ambiente:         true,
        createdAt:        true,
        // xmlCaf y privateKey NO se retornan por seguridad
      }
    })

    res.json({ cafList, total: cafList.length })

  } catch (error) {
    console.error('Error al listar CAF:', error)
    res.status(500).json({ error: 'Error al listar CAF' })
  }
})

export default router