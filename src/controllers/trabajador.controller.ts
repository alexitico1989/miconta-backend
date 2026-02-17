import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarRut } from '../utils/rutValidator';

// LISTAR TRABAJADORES
export const getTrabajadores = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { limit, offset } = req.query;

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } });
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    const take = limit  ? parseInt(limit as string)  : 50;
    const skip = offset ? parseInt(offset as string) : 0;

    const [trabajadores, total] = await Promise.all([
      prisma.trabajador.findMany({
        where:   { negocioId: negocio.id, activo: true },
        orderBy: { nombre: 'asc' },
        take,
        skip
      }),
      prisma.trabajador.count({ where: { negocioId: negocio.id, activo: true } })
    ]);

    res.json({
      trabajadores,
      paginacion: { total, limit: take, offset: skip, hasMore: skip + trabajadores.length < total }
    });

  } catch (error) {
    console.error('Error en getTrabajadores:', error);
    res.status(500).json({ error: 'Error al obtener trabajadores', detalle: error instanceof Error ? error.message : 'Error desconocido' });
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
      sexo,
      fechaNacimiento,
      estadoCivil,
      direccion,
      comuna,
      cargo,
      fechaIngreso,
      tipoContrato,
      jornada,
      sueldoBase,
      afp,
      salud,
      isapre
    } = req.body;

    // Campos obligatorios del schema
    if (!rut || !nombre || !apellidoPaterno || !apellidoMaterno || !sexo ||
        !fechaNacimiento || !estadoCivil || !fechaIngreso || !sueldoBase || !afp || !salud) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: rut, nombre, apellidos, sexo, fechaNacimiento, estadoCivil, fechaIngreso, sueldoBase, afp, salud'
      });
    }

    if (!validarRut(rut)) return res.status(400).json({ error: 'RUT inválido' });
    if (sueldoBase <= 0)   return res.status(400).json({ error: 'El sueldo base debe ser mayor a 0' });

    const rutExistente = await prisma.trabajador.findUnique({ where: { rut } });
    if (rutExistente) return res.status(400).json({ error: 'El RUT ya está registrado' });

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } });
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    const trabajador = await prisma.trabajador.create({
      data: {
        negocioId:       negocio.id,
        rut,
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        sexo,
        fechaNacimiento: new Date(fechaNacimiento),
        estadoCivil,
        direccion,
        comuna,
        cargo,
        fechaIngreso:    new Date(fechaIngreso),
        tipoContrato:    tipoContrato || 'indefinido',
        jornada:         jornada || 'completa',
        sueldoBase,
        afp,
        salud,
        isapre
      }
    });

    res.status(201).json({ message: 'Trabajador creado exitosamente', trabajador });

  } catch (error) {
    console.error('Error en createTrabajador:', error);
    res.status(500).json({ error: 'Error al crear trabajador', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// ACTUALIZAR TRABAJADOR
export const updateTrabajador = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      direccion,
      comuna,
      cargo,
      sueldoBase,
      afp,
      salud,
      isapre
    } = req.body;

    if (sueldoBase !== undefined && sueldoBase <= 0)
      return res.status(400).json({ error: 'El sueldo base debe ser mayor a 0' });

    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: { negocio: true }
    });

    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
    if (trabajador.negocio.usuarioId !== userId) return res.status(403).json({ error: 'No tienes permiso' });

    const trabajadorActualizado = await prisma.trabajador.update({
      where: { id },
      data: {
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        direccion,
        comuna,
        cargo,
        sueldoBase,
        afp,
        salud,
        isapre
      }
    });

    res.json({ message: 'Trabajador actualizado exitosamente', trabajador: trabajadorActualizado });

  } catch (error) {
    console.error('Error en updateTrabajador:', error);
    res.status(500).json({ error: 'Error al actualizar trabajador', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// DAR DE BAJA TRABAJADOR
export const darDeBajaTrabajador = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;
    const { fechaSalida } = req.body;

    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: { negocio: true }
    });

    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
    if (trabajador.negocio.usuarioId !== userId) return res.status(403).json({ error: 'No tienes permiso' });

    const trabajadorActualizado = await prisma.trabajador.update({
      where: { id },
      data: {
        activo:      false,
        fechaSalida: fechaSalida ? new Date(fechaSalida) : new Date()
      }
    });

    res.json({ message: 'Trabajador dado de baja exitosamente', trabajador: trabajadorActualizado });

  } catch (error) {
    console.error('Error en darDeBajaTrabajador:', error);
    res.status(500).json({ error: 'Error al dar de baja trabajador', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// OBTENER TRABAJADOR POR ID
export const getTrabajadorById = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;

    const trabajador = await prisma.trabajador.findUnique({
      where: { id },
      include: {
        negocio: true,
        liquidaciones: { orderBy: { createdAt: 'desc' }, take: 12 }
      }
    });

    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
    if (trabajador.negocio.usuarioId !== userId) return res.status(403).json({ error: 'No tienes permiso' });

    res.json({ trabajador });

  } catch (error) {
    console.error('Error en getTrabajadorById:', error);
    res.status(500).json({ error: 'Error al obtener trabajador', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};