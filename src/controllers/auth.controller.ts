import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { validarEmail } from '../utils/validators';

const JWT_SECRET = process.env.JWT_SECRET || 'miconta-secret-2026';

// REGISTRO
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, nombre } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y password son requeridos'
      });
    }

    // Validar email
    const validacionEmail = validarEmail(email);
    if (!validacionEmail.valido) {
      return res.status(400).json({
        error: validacionEmail.error
      });
    }

    // Validar password (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si el email ya existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email }
    });

    if (usuarioExistente) {
      return res.status(400).json({
        error: 'El email ya está registrado'
      });
    }

    // Encriptar password
    const passwordHash = await bcrypt.hash(password, 10);

    // Calcular fecha de fin de trial (30 días)
    const trialHasta = new Date();
    trialHasta.setDate(trialHasta.getDate() + 30);

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        email,
        password: passwordHash,
        nombre,
        plan: 'trial',
        trialHasta,
        estado: 'activo'
      }
    });

    // Generar token
    const token = jwt.sign(
      { userId: usuario.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        plan: usuario.plan,
        trialHasta: usuario.trialHasta
      }
    });

  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({
      error: 'Error al registrar usuario',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y password son requeridos'
      });
    }

    // Buscar usuario
    const usuario = await prisma.usuario.findUnique({
      where: { email }
    });

    if (!usuario) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Verificar password
    const passwordValido = await bcrypt.compare(password, usuario.password);

    if (!passwordValido) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Verificar estado de cuenta
    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        error: 'Cuenta inactiva. Contacta a soporte.'
      });
    }

    // Verificar si el trial expiró
    if (usuario.plan === 'trial' && usuario.trialHasta && usuario.trialHasta < new Date()) {
      return res.status(403).json({
        error: 'Trial expirado. Por favor actualiza tu plan.',
        trialExpirado: true
      });
    }

    // Generar token
    const token = jwt.sign(
      { userId: usuario.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        plan: usuario.plan,
        trialHasta: usuario.trialHasta
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      error: 'Error al iniciar sesión',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// OBTENER PERFIL
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        plan: true,
        trialHasta: true,
        estado: true,
        createdAt: true
      }
    });

    if (!usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    res.json({ usuario });

  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({
      error: 'Error al obtener perfil',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};