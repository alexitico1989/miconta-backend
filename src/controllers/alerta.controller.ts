import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// OBTENER ALERTAS
export const getAlertas = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { leida, prioridad } = req.query;

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Construir filtros
    const where: any = {
      negocioId: negocio.id
    };

    if (leida !== undefined) {
      where.leida = leida === 'true';
    }

    if (prioridad) {
      where.prioridad = prioridad as string;
    }

    // Obtener alertas
    const alertas = await prisma.alerta.findMany({
      where,
      orderBy: [
        { prioridad: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Contar alertas no leídas
    const noLeidas = await prisma.alerta.count({
      where: {
        negocioId: negocio.id,
        leida: false
      }
    });

    res.json({
      alertas,
      total: alertas.length,
      noLeidas
    });

  } catch (error) {
    console.error('Error en getAlertas:', error);
    res.status(500).json({
      error: 'Error al obtener alertas'
    });
  }
};

// MARCAR ALERTA COMO LEÍDA
export const marcarComoLeida = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verificar alerta
    const alerta = await prisma.alerta.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!alerta) {
      return res.status(404).json({
        error: 'Alerta no encontrada'
      });
    }

    if (alerta.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Marcar como leída
    const alertaActualizada = await prisma.alerta.update({
      where: { id },
      data: {
        leida: true
      }
    });

    res.json({
      message: 'Alerta marcada como leída',
      alerta: alertaActualizada
    });

  } catch (error) {
    console.error('Error en marcarComoLeida:', error);
    res.status(500).json({
      error: 'Error al marcar alerta como leída'
    });
  }
};

// MARCAR ALERTA COMO RESUELTA
export const marcarComoResuelta = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verificar alerta
    const alerta = await prisma.alerta.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!alerta) {
      return res.status(404).json({
        error: 'Alerta no encontrada'
      });
    }

    if (alerta.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Marcar como resuelta
    const alertaActualizada = await prisma.alerta.update({
      where: { id },
      data: {
        resuelta: true,
        leida: true
      }
    });

    res.json({
      message: 'Alerta marcada como resuelta',
      alerta: alertaActualizada
    });

  } catch (error) {
    console.error('Error en marcarComoResuelta:', error);
    res.status(500).json({
      error: 'Error al marcar alerta como resuelta'
    });
  }
};

// ELIMINAR ALERTA
export const deleteAlerta = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verificar alerta
    const alerta = await prisma.alerta.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!alerta) {
      return res.status(404).json({
        error: 'Alerta no encontrada'
      });
    }

    if (alerta.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Eliminar
    await prisma.alerta.delete({
      where: { id }
    });

    res.json({
      message: 'Alerta eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteAlerta:', error);
    res.status(500).json({
      error: 'Error al eliminar alerta'
    });
  }
};

// CREAR ALERTA MANUALMENTE (para testing o admin)
export const createAlerta = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { tipo, titulo, mensaje, prioridad, metadata } = req.body;

    // Validar
    if (!tipo || !titulo || !mensaje) {
      return res.status(400).json({
        error: 'Tipo, título y mensaje son requeridos'
      });
    }

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Crear alerta
    const alerta = await prisma.alerta.create({
      data: {
        negocioId: negocio.id,
        tipo,
        titulo,
        mensaje,
        prioridad: prioridad || 'media',
        metadata: metadata || null
      }
    });

    res.status(201).json({
      message: 'Alerta creada exitosamente',
      alerta
    });

  } catch (error) {
    console.error('Error en createAlerta:', error);
    res.status(500).json({
      error: 'Error al crear alerta'
    });
  }
};