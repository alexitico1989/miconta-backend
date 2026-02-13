import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// LISTAR CLIENTES
export const getClientes = async (req: Request, res: Response) => {
  try {
    const negocioId = req.negocioId!; // Necesitamos agregar esto al middleware o obtenerlo de otra forma

    const clientes = await prisma.cliente.findMany({
      where: { 
        negocioId,
        activo: true 
      },
      orderBy: { nombre: 'asc' }
    });

    res.json({ clientes });

  } catch (error) {
    console.error('Error en getClientes:', error);
    res.status(500).json({
      error: 'Error al obtener clientes',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// BUSCAR CLIENTE POR RUT
export const getClienteByRut = async (req: Request, res: Response) => {
  try {
    const negocioId = req.negocioId!;
    const { rut } = req.params;

    const cliente = await prisma.cliente.findFirst({
      where: { 
        negocioId,
        rut,
        activo: true 
      }
    });

    if (!cliente) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    res.json({ cliente });

  } catch (error) {
    console.error('Error en getClienteByRut:', error);
    res.status(500).json({
      error: 'Error al buscar cliente',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// CREAR CLIENTE
export const createCliente = async (req: Request, res: Response) => {
  try {
    const negocioId = req.negocioId!;
    const {
      rut,
      nombre,
      direccion,
      comuna,
      region,
      giro,
      contactoNombre,
      telefono,
      email,
      notas
    } = req.body;

    // Validaciones
    if (!rut || !nombre) {
      return res.status(400).json({
        error: 'RUT y nombre son obligatorios'
      });
    }

    // Verificar si ya existe cliente con ese RUT en el negocio
    const existente = await prisma.cliente.findFirst({
      where: { 
        negocioId,
        rut 
      }
    });

    if (existente) {
      return res.status(400).json({
        error: 'Ya existe un cliente con ese RUT'
      });
    }

    const cliente = await prisma.cliente.create({
      data: {
        negocioId,
        rut,
        nombre,
        direccion,
        comuna,
        region,
        giro,
        contactoNombre,
        telefono,
        email,
        notas
      }
    });

    res.status(201).json({
      message: 'Cliente creado exitosamente',
      cliente
    });

  } catch (error) {
    console.error('Error en createCliente:', error);
    res.status(500).json({
      error: 'Error al crear cliente',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ACTUALIZAR CLIENTE
export const updateCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const negocioId = req.negocioId!;
    const {
      nombre,
      direccion,
      comuna,
      region,
      giro,
      contactoNombre,
      telefono,
      email,
      notas,
      activo
    } = req.body;

    // Verificar que el cliente pertenezca al negocio
    const clienteExistente = await prisma.cliente.findFirst({
      where: { 
        id,
        negocioId 
      }
    });

    if (!clienteExistente) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nombre,
        direccion,
        comuna,
        region,
        giro,
        contactoNombre,
        telefono,
        email,
        notas,
        activo
      }
    });

    res.json({
      message: 'Cliente actualizado exitosamente',
      cliente
    });

  } catch (error) {
    console.error('Error en updateCliente:', error);
    res.status(500).json({
      error: 'Error al actualizar cliente',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ELIMINAR CLIENTE (soft delete)
export const deleteCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const negocioId = req.negocioId!;

    // Verificar que el cliente pertenezca al negocio
    const clienteExistente = await prisma.cliente.findFirst({
      where: { 
        id,
        negocioId 
      }
    });

    if (!clienteExistente) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    // Soft delete - solo marcamos como inactivo
    await prisma.cliente.update({
      where: { id },
      data: { activo: false }
    });

    res.json({
      message: 'Cliente eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteCliente:', error);
    res.status(500).json({
      error: 'Error al eliminar cliente',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};