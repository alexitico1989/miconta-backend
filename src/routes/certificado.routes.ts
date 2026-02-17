// ============================================================
// routes/certificado.routes.ts
// Gestión del certificado digital .p12 del contribuyente
// ============================================================

import { Router, Request, Response } from 'express'
import multer from 'multer'
import { authenticateToken as authMiddleware } from '../middleware/auth.middleware'
import prisma from '../utils/prisma'
import {
  guardarCertificado,
  verificarEstadoCertificado,
  eliminarCertificado,
} from '../services/sii/certificado.service'

const router = Router()

// Multer en memoria — el .p12 nunca toca el disco del servidor
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 1 * 1024 * 1024 }, // 1 MB máximo
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/x-pkcs12' ||
        file.originalname.endsWith('.p12') ||
        file.originalname.endsWith('.pfx')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan archivos .p12 o .pfx'))
    }
  }
})

// -------------------------------------------------------
// POST /api/certificado/subir
// Sube y guarda el certificado digital del negocio
// Body: multipart/form-data — campo "certificado" + "password"
// -------------------------------------------------------
router.post(
  '/subir',
  authMiddleware,
  upload.single('certificado'),
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId!

      if (!req.file) {
        return res.status(400).json({ error: 'Debes subir un archivo .p12' })
      }

      const { password } = req.body
      if (!password) {
        return res.status(400).json({ error: 'La contraseña del certificado es requerida' })
      }

      const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
      if (!negocio) {
        return res.status(404).json({ error: 'Negocio no encontrado' })
      }

      const info = await guardarCertificado(negocio.id, req.file.buffer, password)

      res.json({
        message: 'Certificado guardado exitosamente',
        certificado: {
          subject:      info.subject,
          rut:          info.rut,
          validDesde:   info.validDesde,
          validHasta:   info.validHasta,
          emisor:       info.emisor,
          valido:       info.valido,
        }
      })

    } catch (error: any) {
      // Errores esperados (contraseña incorrecta, cert vencido, etc.)
      if (error.message?.includes('contraseña') ||
          error.message?.includes('vencido') ||
          error.message?.includes('leer el certificado')) {
        return res.status(400).json({ error: error.message })
      }
      console.error('Error al subir certificado:', error)
      res.status(500).json({ error: 'Error al procesar el certificado' })
    }
  }
)

// -------------------------------------------------------
// GET /api/certificado/estado
// Retorna el estado del certificado SIN desencriptar
// -------------------------------------------------------
router.get('/estado', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    const estado = await verificarEstadoCertificado(negocio.id)

    res.json({ certificado: estado })

  } catch (error) {
    console.error('Error al verificar certificado:', error)
    res.status(500).json({ error: 'Error al verificar certificado' })
  }
})

// -------------------------------------------------------
// DELETE /api/certificado
// Elimina el certificado del negocio
// -------------------------------------------------------
router.delete('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } })
    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' })
    }

    await eliminarCertificado(negocio.id)

    res.json({ message: 'Certificado eliminado exitosamente' })

  } catch (error) {
    console.error('Error al eliminar certificado:', error)
    res.status(500).json({ error: 'Error al eliminar certificado' })
  }
})

export default router