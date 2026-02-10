import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarRut } from '../utils/rutValidator';
import { validarEmail, validarTelefono } from '../utils/validators';

// LISTAR TRABAJADORES
export const getTrabajadores = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { limit, offset } = req.query;

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Paginación
    const take = limit ? parseInt(limit as string) : 50;
    const skip = offset ? parseInt(offset as string) : 0;

    // Obtener trabajadores
    const [trabajadores, total] = await Promise.all([
      prisma.trabajador.findMany({
        where: {
          negocioId: negocio.id,
          activo: true
        },
        orderBy: {
          nombre: 'asc'
        },
        take,
        skip
      }),
      prisma.trabajador.count({
        where: {
          negocioId: negocio.id,
          activo: true
        }
      })
    ]);

    res.json({
      trabajadores,
      paginacion: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + trabajadores.length < total
      }
    });

  } catch (error) {
    console.error('Error en getTrabajadores:', error);
    res.status(500).json({
      error: 'Error al obtener trabajadores',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// CREAR TRABAJADOR
export const createTrabajador = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      rut,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      fechaNacimiento,
      telefono,
      email,
      direccion,
      comuna,
      cargo,
      fechaIngreso,
      sueldoBase,
      afp,
      salud,
      isapre
    } = req.body;

    // Validar campos requeridos
    if (!rut || !nombre || !apellidoPaterno || !apellidoMaterno || !fechaIngreso || !sueldoBase || !afp || !salud) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: rut, nombre, apellidos, fechaIngreso, sueldoBase, afp, salud'
      });
    }

    // Validar RUT
    if (!validarRut(rut)) {
      return res.status(400).json({
        error: 'RUT inválido'
      });
    }

    // Validar email si existe
    if (email) {
      const validacionEmail = validarEmail(email);
      if (!validacionEmail.valido) {
        return res.status(400).json({
          error: validacionEmail.error
        });
      }
    }

    // Validar teléfono si existe
    if (telefono) {
      const validacionTelefono = validarTelefono(telefono);
      if (!validacionTelefono.valido) {
        return res.status(400).json({
          error: validacionTelefono.error
        });
      }
    }

    // Validar sueldo base
    if (sueldoBase <= 0) {
      return res.status(400).json({
        error: 'El sueldo base debe ser mayor a 0'
      });
    }

    // Validar que el RUT no exista
    const rutExistente = await prisma.trabajador.findUnique({
      where: { rut }
    });

    if (rutExistente) {
      return res.status(400).json({
        error: 'El RUT ya está registrado'
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

    // Crear trabajador
    const trabajador = await prisma.trabajador.create({
      data: {
        negocioId: negocio.id,
        rut,
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        telefono,
        email,
        direccion,
        comuna,
        cargo,
        fechaIngreso: new Date(fechaIngreso),
        sueldoBase,
        afp,
        salud,
        isapre
      }
    });

    res.status(201).json({
      message: 'Trabajador creado exitosamente',
      trabajador
    });

  } catch (error) {
    console.error('Error en createTrabajador:', error);
    res.status(500).json({
      error: 'Error al crear trabajador',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ACTUALIZAR TRABAJADOR
export const updateTrabajador = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      fechaNacimiento,
      telefono,
      email,
      direccion,
      comuna,
      cargo,
      sueldoBase,
      afp,
      salud,
      isapre
    } = req.body;

    // Validar email si existe
    if (email) {
      const validacionEmail = validarEmail(email);
      if (!validacionEmail.valido) {
        return res.status(400).json({
          error: validacionEmail.error
        });
      }
    }

    // Validar teléfono si existe
    if (telefono) {
      const validacionTelefono = validarTelefono(telefono);
      if (!validacionTelefono.valido) {
        return res.status(400).json({
          error: validacionTelefono.error
        });
      }
    }

    // Validar sueldo base si se actualiza
    if (sueldoBase !== undefined && sueldoBase <= 0) {
      return res.status(400).json({
        error: 'El sueldo base debe ser mayor a 0'
      });
    }

    // Verificar trabajador
    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!trabajador) {
      return res.status(404).json({
        error: 'Trabajador no encontrado'
      });
    }

    if (trabajador.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Actualizar
    const trabajadorActualizado = await prisma.trabajador.update({
      where: { id },
      data: {
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
        telefono,
        email,
        direccion,
        comuna,
        cargo,
        sueldoBase,
        afp,
        salud,
        isapre
      }
    });

    res.json({
      message: 'Trabajador actualizado exitosamente',
      trabajador: trabajadorActualizado
    });

  } catch (error) {
    console.error('Error en updateTrabajador:', error);
    res.status(500).json({
      error: 'Error al actualizar trabajador',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// DAR DE BAJA TRABAJADOR
export const darDeBajaTrabajador = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { fechaSalida } = req.body;

    // Verificar trabajador
    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!trabajador) {
      return res.status(404).json({
        error: 'Trabajador no encontrado'
      });
    }

    if (trabajador.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Dar de baja
    const trabajadorActualizado = await prisma.trabajador.update({
      where: { id },
      data: {
        activo: false,
        fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date()
      }
    });

    res.json({
      message: 'Trabajador dado de baja exitosamente',
      trabajador: trabajadorActualizado
    });

  } catch (error) {
    console.error('Error en darDeBajaTrabajador:', error);
    res.status(500).json({
      error: 'Error al dar de baja trabajador',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// OBTENER TRABAJADOR POR ID
export const getTrabajadorById = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    // Obtener trabajador
    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: {
        negocio: true,
        liquidaciones: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 12 // Últimas 12 liquidaciones
        }
      }
    });

    if (!trabajador) {
      return res.status(404).json({
        error: 'Trabajador no encontrado'
      });
    }

    if (trabajador.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    res.json({ trabajador });

  } catch (error) {
    console.error('Error en getTrabajadorById:', error);
    res.status(500).json({
      error: 'Error al obtener trabajador',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};