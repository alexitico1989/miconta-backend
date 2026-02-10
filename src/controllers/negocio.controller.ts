import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarRut } from '../utils/rutValidator';

// CREAR NEGOCIO
export const createNegocio = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      nombreNegocio,
      rutNegocio,
      tipo,
      direccion,
      comuna,
      telefono,
      ventasMensualesAprox,
      regimenTributario
    } = req.body;

    // Validar campos requeridos
    if (!nombreNegocio) {
      return res.status(400).json({
        error: 'Nombre del negocio es requerido'
      });
    }

    // Validar RUT del negocio si existe
    if (rutNegocio && !validarRut(rutNegocio)) {
      return res.status(400).json({
        error: 'RUT del negocio inválido'
      });
    }

    // Validar ventas mensuales
    if (ventasMensualesAprox !== undefined && ventasMensualesAprox < 0) {
      return res.status(400).json({
        error: 'Ventas mensuales no puede ser negativo'
      });
    }

    // Verificar que el usuario no tenga ya un negocio
    const negocioExistente = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (negocioExistente) {
      return res.status(400).json({
        error: 'Ya tienes un negocio registrado'
      });
    }

    // Crear negocio
    const negocio = await prisma.negocio.create({
      data: {
        usuarioId: userId,
        nombreNegocio,
        rutNegocio,
        tipo: tipo || 'otro',
        direccion,
        comuna,
        ventasMensualesAprox,
        regimenTributario: regimenTributario || 'pro_pyme'
      }
    });

    res.status(201).json({
      message: 'Negocio creado exitosamente',
      negocio
    });

  } catch (error) {
    console.error('Error en createNegocio:', error);
    res.status(500).json({
      error: 'Error al crear negocio',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
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
      error: 'Error al obtener negocio',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ACTUALIZAR NEGOCIO
export const updateNegocio = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      nombreNegocio,
      rutNegocio,
      tipo,
      direccion,
      comuna,
      telefono,
      ventasMensualesAprox,
      regimenTributario
    } = req.body;

    // Validar RUT del negocio si se actualiza
    if (rutNegocio && !validarRut(rutNegocio)) {
      return res.status(400).json({
        error: 'RUT del negocio inválido'
      });
    }

    // Validar ventas mensuales
    if (ventasMensualesAprox !== undefined && ventasMensualesAprox < 0) {
      return res.status(400).json({
        error: 'Ventas mensuales no puede ser negativo'
      });
    }

    // Verificar que el negocio exista
    const negocioExistente = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocioExistente) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Actualizar negocio
    const negocio = await prisma.negocio.update({
      where: { usuarioId: userId },
      data: {
        nombreNegocio,
        rutNegocio,
        tipo,
        direccion,
        comuna,
        ventasMensualesAprox,
        regimenTributario
      }
    });

    res.json({
      message: 'Negocio actualizado exitosamente',
      negocio
    });

  } catch (error) {
    console.error('Error en updateNegocio:', error);
    res.status(500).json({
      error: 'Error al actualizar negocio',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};