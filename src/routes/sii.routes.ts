// ============================================================
// routes/sii.routes.ts
// Configuración SII, estado certificación, ambiente
// ============================================================

import { Router, Request, Response } from 'express'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'

const router = Router()

// -------------------------------------------------------
// GET /api/sii/estado
// Estado general del negocio en el SII
// -------------------------------------------------------
router.get('/estado', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({
      where:   { usuarioId: userId },
      include: { configuracionSii: true }
    })

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    // Contar CAF activos
    const cafActivos = await prisma.cafFolio.count({
      where: { negocioId: negocio.id, activo: true }
    })

    // Contar DTEs del mes actual
    const ahora       = new Date()
    const inicioMes   = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const dtesDelMes  = await prisma.documentoSii.count({
      where: {
        negocioId:   negocio.id,
        fechaEmision: { gte: inicioMes }
      }
    })

    res.json({
      negocio: {
        nombre:    negocio.nombreNegocio,
        rut:       negocio.rutNegocio,
        ambiente:  negocio.ambienteSii,
        estadoCertificacion: negocio.estadoCertificacionSii,
      },
      certificado: {
        activo:     negocio.certificadoActivo,
        vencimiento: negocio.certificadoVencimiento,
        subject:    negocio.certificadoSubject,
      },
      folios: {
        boletaActual:      negocio.folioBoletaActual,
        facturaActual:     negocio.folioFacturaActual,
        notaCreditoActual: negocio.folioNotaCreditoActual,
        cafActivos,
      },
      actividad: {
        dtesEmitidosEsteMes: dtesDelMes,
      },
      configuracion: negocio.configuracionSii
        ? {
            resolucionNumero: negocio.configuracionSii.resolucionNumero,
            resolucionFecha:  negocio.configuracionSii.resolucionFecha,
            emailDte:         negocio.configuracionSii.emailDte,
            envioAutomatico:  negocio.configuracionSii.envioAutomatico,
          }
        : null,
    })

  } catch (error) {
    console.error('Error al obtener estado SII:', error)
    res.status(500).json({ error: 'Error al obtener estado SII' })
  }
})

// -------------------------------------------------------
// PUT /api/sii/configuracion
// Actualiza la configuración SII del negocio
// -------------------------------------------------------
router.put('/configuracion', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const {
      resolucionNumero,
      resolucionFecha,
      emailDte,
      codigoActividad,
      actividadDescripcion,
      logoUrl,
      colorPrimario,
      piePagina,
      envioAutomatico,
      emailCopiaEmisor,
      alertaFoliosMinimo,
      repLegalRut,
      repLegalNombre,
      repLegalEmail,
      repLegalCargo,
    } = req.body

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const configuracion = await prisma.configuracionSii.upsert({
      where:  { negocioId: negocio.id },
      create: {
        negocioId: negocio.id,
        resolucionNumero,
        resolucionFecha:     resolucionFecha ? new Date(resolucionFecha) : undefined,
        emailDte,
        codigoActividad,
        actividadDescripcion,
        logoUrl,
        colorPrimario,
        piePagina,
        envioAutomatico:     envioAutomatico ?? true,
        emailCopiaEmisor:    emailCopiaEmisor ?? true,
        alertaFoliosMinimo:  alertaFoliosMinimo ?? 50,
        repLegalRut,
        repLegalNombre,
        repLegalEmail,
        repLegalCargo,
      },
      update: {
        resolucionNumero,
        resolucionFecha:     resolucionFecha ? new Date(resolucionFecha) : undefined,
        emailDte,
        codigoActividad,
        actividadDescripcion,
        logoUrl,
        colorPrimario,
        piePagina,
        envioAutomatico,
        emailCopiaEmisor,
        alertaFoliosMinimo,
        repLegalRut,
        repLegalNombre,
        repLegalEmail,
        repLegalCargo,
      }
    })

    res.json({ message: 'Configuración actualizada exitosamente', configuracion })

  } catch (error) {
    console.error('Error al actualizar configuración SII:', error)
    res.status(500).json({ error: 'Error al actualizar configuración' })
  }
})

// -------------------------------------------------------
// POST /api/sii/cambiar-ambiente
// Cambia entre certificacion y produccion
// SOLO se puede cambiar a produccion cuando el SII lo autoriza
// -------------------------------------------------------
router.post('/cambiar-ambiente', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { ambiente } = req.body

    if (!['certificacion', 'produccion'].includes(ambiente)) {
      return res.status(400).json({
        error: 'Ambiente debe ser "certificacion" o "produccion"'
      })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    // Para pasar a produccion, el SII debe haber aprobado la certificación
    if (ambiente === 'produccion' && negocio.estadoCertificacionSii !== 'aprobado') {
      return res.status(400).json({
        error: 'Solo puedes cambiar a producción cuando el SII apruebe tu certificación',
        estadoActual: negocio.estadoCertificacionSii
      })
    }

    await prisma.negocio.update({
      where: { id: negocio.id },
      data:  { ambienteSii: ambiente }
    })

    res.json({
      message:  `Ambiente cambiado a ${ambiente}`,
      ambiente,
    })

  } catch (error) {
    console.error('Error al cambiar ambiente:', error)
    res.status(500).json({ error: 'Error al cambiar ambiente' })
  }
})

// -------------------------------------------------------
// PUT /api/sii/estado-certificacion
// Actualiza el estado del proceso de certificación SII
// (normalmente lo actualiza el equipo de MiConta manualmente)
// -------------------------------------------------------
router.put('/estado-certificacion', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!
    const { estado } = req.body

    const estadosValidos = [
      'no_iniciado', 'postulado', 'en_certificacion', 'set_prueba',
      'simulacion', 'muestras_impresion', 'intercambio', 'aprobado'
    ]

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Válidos: ${estadosValidos.join(', ')}`
      })
    }

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    await prisma.negocio.update({
      where: { id: negocio.id },
      data:  { estadoCertificacionSii: estado }
    })

    res.json({
      message: 'Estado de certificación actualizado',
      estado,
    })

  } catch (error) {
    console.error('Error al actualizar estado certificación:', error)
    res.status(500).json({ error: 'Error al actualizar estado' })
  }
})

export default router