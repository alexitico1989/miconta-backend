import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// CREAR/ACTUALIZAR NEGOCIO
export const upsertNegocio = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      nombreNegocio,
      rutNegocio,
      tipo,
      direccion,
      comuna,
      region,
      ventasMensualesAprox
    } = req.body;

    // Validar campos requeridos
    if (!nombreNegocio || !tipo) {
      return res.status(400).json({
        error: 'Nombre de negocio y tipo son requeridos'
      });
    }

    // Crear o actualizar negocio
    const negocio = await prisma.negocio.upsert({
      where: { usuarioId: userId },
      update: {
        nombreNegocio,
        rutNegocio,
        tipo,
        direccion,
        comuna,
        region,
        ventasMensualesAprox
      },
      create: {
        usuarioId: userId,
        nombreNegocio,
        rutNegocio,
        tipo,
        direccion,
        comuna,
        region,
        ventasMensualesAprox
      }
    });

    res.json({
      message: 'Negocio guardado exitosamente',
      negocio
    });

  } catch (error) {
    console.error('Error en upsertNegocio:', error);
    res.status(500).json({
      error: 'Error al guardar negocio'
    });
  }
};

// OBTENER NEGOCIO
export const getNegocio = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    res.json({ negocio });

  } catch (error) {
    console.error('Error en getNegocio:', error);
    res.status(500).json({
      error: 'Error al obtener negocio'
    });
  }
};