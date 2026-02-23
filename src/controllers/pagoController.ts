import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export const getEstadoSuscripcion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        pagos: {
          where: { estado: 'aprobado' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Calcular días de trial restantes
    let diasTrialRestantes = 0;
    if (usuario.plan === 'trial' && usuario.trialHasta) {
      const diff = new Date(usuario.trialHasta).getTime() - new Date().getTime();
      diasTrialRestantes = Math.ceil(diff / (1000 * 3600 * 24));
    }

    res.json({
      plan: usuario.plan,
      estado: usuario.estado,
      diasTrialRestantes: Math.max(0, diasTrialRestantes),
      trialExpirado: diasTrialRestantes <= 0 && usuario.plan === 'trial',
      suscripcionActiva: usuario.plan === 'pro' && usuario.estado === 'activo',
    });

  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado' });
  }
};

// Placeholders para que no dé error (los completamos después)
export const crearSuscripcion = async (req: Request, res: Response) => {
  res.json({ message: 'Endpoint reservado para paso 2' });
};

export const webhookMercadoPago = async (req: Request, res: Response) => {
  res.status(200).send('OK');
};