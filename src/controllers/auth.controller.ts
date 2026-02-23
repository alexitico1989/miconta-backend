import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { validarEmail } from '../utils/validators';

const JWT_SECRET = process.env.JWT_SECRET || 'miconta-secret-2026';

// REGISTRO
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, nombre, telefono } = req.body;

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
        telefono: telefono || null,
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
        telefono: usuario.telefono,
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
        telefono: true,
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

// ACTUALIZAR PERFIL
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { nombre, email, telefono } = req.body;

    // Validar que al menos haya un campo para actualizar
    if (!nombre && !email && !telefono) {
      return res.status(400).json({
        error: 'No hay datos para actualizar'
      });
    }

    // Validar email si se proporciona
    if (email) {
      const validacionEmail = validarEmail(email);
      if (!validacionEmail.valido) {
        return res.status(400).json({
          error: validacionEmail.error
        });
      }

      // Verificar que el nuevo email no esté en uso por otro usuario
      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email }
      });

      if (usuarioExistente && usuarioExistente.id !== userId) {
        return res.status(400).json({
          error: 'El email ya está registrado por otro usuario'
        });
      }
    }

    // Construir objeto de actualización
    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (email !== undefined) updateData.email = email;
    if (telefono !== undefined) updateData.telefono = telefono;

    // Actualizar usuario
    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        nombre: true,
        telefono: true,
        plan: true,
        trialHasta: true,
        estado: true,
        createdAt: true
      }
    });

    res.json({
      message: 'Perfil actualizado exitosamente',
      usuario
    });

  } catch (error) {
    console.error('Error en updateProfile:', error);
    res.status(500).json({
      error: 'Error al actualizar perfil',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ELIMINAR CUENTA
// DELETE /api/auth/delete-account
// Elimina permanentemente la cuenta del usuario y todos sus datos
// ============================================================

export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Verificar que el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { negocio: true },
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const negocioId = usuario.negocio?.id;

    // Si tiene negocio, eliminar TODOS los datos relacionados
    if (negocioId) {
      // Eliminar en orden para respetar foreign keys
      
      // 1. Detalles de transacciones (hijos de transacciones)
      await prisma.detalleTransaccion.deleteMany({
        where: { transaccion: { negocioId } },
      });
      
      // 2. Transacciones
      await prisma.transaccion.deleteMany({
        where: { negocioId },
      });

      // 3. Documentos SII (logs primero por FK)
      await prisma.logDte.deleteMany({
        where: { negocioId },
      });
      
      await prisma.documentoSii.deleteMany({
        where: { negocioId },
      });

      // 4. Libro CV
      await prisma.libroCV.deleteMany({
        where: { negocioId },
      });

      // 5. CAF Folios
      await prisma.cafFolio.deleteMany({
        where: { negocioId },
      });

      // 6. Trabajadores (liquidaciones primero por FK)
      await prisma.liquidacion.deleteMany({
        where: { trabajador: { negocioId } },
      });
      
      await prisma.trabajador.deleteMany({
        where: { negocioId },
      });

      // 7. F29
      await prisma.declaracionF29.deleteMany({
        where: { negocioId },
      });

      // 8. F22
      await prisma.declaracionF22.deleteMany({
        where: { negocioId },
      });

      // 9. Productos (movimientos primero por FK)
      await prisma.movimientoStock.deleteMany({
        where: { producto: { negocioId } },
      });
      
      await prisma.producto.deleteMany({
        where: { negocioId },
      });

      // 10. Clientes
      await prisma.cliente.deleteMany({
        where: { negocioId },
      });

      // 11. Proveedores (pedidos primero por FK)
      await prisma.pedido.deleteMany({
        where: { proveedor: { negocioId } },
      });
      
      await prisma.proveedor.deleteMany({
        where: { negocioId },
      });

      // 12. Alertas
      await prisma.alerta.deleteMany({
        where: { negocioId },
      });

      // 13. Notas contables
      await prisma.notaContable.deleteMany({
        where: { negocioId },
      });

      // 14. Configuración SII
      await prisma.configuracionSii.deleteMany({
        where: { negocioId },
      });

      // 15. Negocio
      await prisma.negocio.delete({
        where: { id: negocioId },
      });
    }

    // Finalmente, eliminar el usuario
    await prisma.usuario.delete({
      where: { id: userId },
    });

    res.json({
      message: 'Cuenta eliminada exitosamente',
      deletedUserId: userId,
    });
  } catch (error: any) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({
      error: 'Error al eliminar la cuenta',
      detalle: error.message,
    });
  }
};