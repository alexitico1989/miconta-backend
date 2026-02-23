import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

export const checkSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar si está suspendido
    if (usuario.estado === 'suspendido') {
      return res.status(403).json({ 
        error: 'Cuenta suspendida',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Tu suscripción ha expirado. Renueva para continuar.'
      });
    }

    // Verificar trial expirado
    if (usuario.plan === 'trial' && usuario.trialHasta && usuario.trialHasta < new Date()) {
      // Auto-suspender si expiró trial
      await prisma.usuario.update({
        where: { id: userId },
        data: { estado: 'suspendido' }
      });
      
      return res.status(403).json({
        error: 'Trial expirado',
        code: 'TRIAL_EXPIRED',
        message: 'Tu periodo de prueba ha terminado. Contrata Premium para continuar.'
      });
    }

    // Agregar info al request para usar en controllers
    (req as any).userPlan = usuario.plan;
    (req as any).userStatus = usuario.estado;
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error verificando suscripción' });
  }
};