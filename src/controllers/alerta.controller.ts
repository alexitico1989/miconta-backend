import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// OBTENER ALERTAS
export const getAlertas = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { leida, prioridad, limit, offset } = req.query;

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

    // Paginación
    const take = limit ? parseInt(limit as string) : 50;
    const skip = offset ? parseInt(offset as string) : 0;

    // Obtener alertas
    const [alertas, total] = await Promise.all([
      prisma.alerta.findMany({
        where,
        orderBy: [
          { prioridad: 'desc' },
          { createdAt: 'desc' }
        ],
        take,
        skip
      }),
      prisma.alerta.count({ where })
    ]);

    // Contar alertas no leídas
    const noLeidas = await prisma.alerta.count({
      where: {
        negocioId: negocio.id,
        leida: false
      }
    });

    res.json({
      alertas,
      paginacion: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + alertas.length < total
      },
      noLeidas
    });

  } catch (error) {
    console.error('Error en getAlertas:', error);
    res.status(500).json({
      error: 'Error al obtener alertas',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// MARCAR ALERTA COMO LEÍDA
export const marcarComoLeida = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

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
      error: 'Error al marcar alerta como leída',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// MARCAR ALERTA COMO RESUELTA
export const marcarComoResuelta = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

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
      error: 'Error al marcar alerta como resuelta',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ELIMINAR ALERTA
export const deleteAlerta = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

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
      error: 'Error al eliminar alerta',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
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

    // Validar prioridad
    const prioridadesValidas = ['baja', 'media', 'alta', 'urgente'];
    if (prioridad && !prioridadesValidas.includes(prioridad)) {
      return res.status(400).json({
        error: 'Prioridad debe ser: baja, media, alta o urgente'
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
      error: 'Error al crear alerta',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};