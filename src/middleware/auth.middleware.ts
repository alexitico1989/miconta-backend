import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extender el tipo Request para incluir userId y negocioId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      negocioId?: string; // ← NUEVO
    }
  }
}

interface JwtPayload {
  userId: string;
  email: string;
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtener token del header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Token no proporcionado'
      });
    }

    // Verificar token
    jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          error: 'Token inválido o expirado'
        });
      }

      // Agregar userId al request
      const payload = decoded as JwtPayload;
      req.userId = payload.userId;
      req.userEmail = payload.email;

      next();
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error al verificar token'
    });
  }
};

// NUEVO MIDDLEWARE: Obtener negocio del usuario
export const requireNegocio = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Usuario no autenticado'
      });
    }

    // Importar prisma dinámicamente para evitar dependencia circular
    const { default: prisma } = await import('../utils/prisma');

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'No se encontró un negocio asociado a este usuario'
      });
    }

    req.negocioId = negocio.id;
    next();

  } catch (error) {
    console.error('Error en requireNegocio:', error);
    return res.status(500).json({
      error: 'Error al obtener información del negocio'
    });
  }
};