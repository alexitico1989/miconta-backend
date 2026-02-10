import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Crear transacción
export const createTransaccion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      tipo,
      fecha,
      montoTotal,
      exento,
      descripcion,
      proveedor,
      numDocumento,
      fotoUrl
    } = req.body;

    // Validar campos requeridos
    if (!tipo || !fecha || !montoTotal) {
      return res.status(400).json({
        error: 'Tipo, fecha y montoTotal son requeridos'
      });
    }

    if (tipo !== 'venta' && tipo !== 'compra') {
      return res.status(400).json({
        error: 'Tipo debe ser "venta" o "compra"'
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

    // Calcular IVA (si no es exento)
    let montoNeto = montoTotal;
    let montoIva = 0;

    if (!exento) {
      montoNeto = Math.round(montoTotal / 1.19);
      montoIva = montoTotal - montoNeto;
    }

    // Crear transacción
    const transaccion = await prisma.transaccion.create({
      data: {
        negocioId: negocio.id,
        tipo,
        fecha: new Date(fecha),
        montoTotal,
        montoNeto,
        montoIva,
        exento: exento || false,
        descripcion,
        proveedor,
        numDocumento,
        fotoUrl
      }
    });

    res.status(201).json({
      message: 'Transacción creada exitosamente',
      transaccion
    });

  } catch (error) {
    console.error('Error en createTransaccion:', error);
    res.status(500).json({
      error: 'Error al crear transacción'
    });
  }
};

// Listar transacciones
export const getTransacciones = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { tipo, fechaInicio, fechaFin, limit } = req.query;

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

    if (tipo) {
      where.tipo = tipo as string;
    }

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio as string);
      if (fechaFin) where.fecha.lte = new Date(fechaFin as string);
    }

    // Obtener transacciones
    const transacciones = await prisma.transaccion.findMany({
      where,
      orderBy: {
        fecha: 'desc'
      },
      take: limit ? parseInt(limit as string) : undefined
    });

    // Calcular totales
    const totalVentas = transacciones
      .filter(t => t.tipo === 'venta')
      .reduce((sum, t) => sum + t.montoTotal, 0);

    const totalCompras = transacciones
      .filter(t => t.tipo === 'compra')
      .reduce((sum, t) => sum + t.montoTotal, 0);

    res.json({
      transacciones,
      total: transacciones.length,
      resumen: {
        totalVentas,
        totalCompras,
        balance: totalVentas - totalCompras
      }
    });

  } catch (error) {
    console.error('Error en getTransacciones:', error);
    res.status(500).json({
      error: 'Error al obtener transacciones'
    });
  }
};

// Obtener resumen mensual para F29
export const getResumenMensual = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { mes, anio } = req.query;

    if (!mes || !anio) {
      return res.status(400).json({
        error: 'Mes y año son requeridos'
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

    const mesNum = parseInt(mes as string);
    const anioNum = parseInt(anio as string);

    // Calcular fechas del mes
    const fechaInicio = new Date(anioNum, mesNum - 1, 1);
    const fechaFin = new Date(anioNum, mesNum, 0, 23, 59, 59);

    // Obtener transacciones del mes
    const transacciones = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        fecha: {
          gte: fechaInicio,
          lte: fechaFin
        }
      }
    });

    // Calcular totales para F29
    const ventas = transacciones.filter(t => t.tipo === 'venta');
    const compras = transacciones.filter(t => t.tipo === 'compra');

    const ventasAfectas = ventas.filter(v => !v.exento).reduce((sum, v) => sum + v.montoTotal, 0);
    const ventasExentas = ventas.filter(v => v.exento).reduce((sum, v) => sum + v.montoTotal, 0);
    const comprasAfectas = compras.filter(c => !c.exento).reduce((sum, c) => sum + c.montoTotal, 0);
    const comprasExentas = compras.filter(c => c.exento).reduce((sum, c) => sum + c.montoTotal, 0);

    const ivaDebito = ventas.filter(v => !v.exento).reduce((sum, v) => sum + v.montoIva, 0);
    const ivaCredito = compras.filter(c => !c.exento).reduce((sum, c) => sum + c.montoIva, 0);

    res.json({
      periodo: `${mes}/${anio}`,
      transacciones: {
        total: transacciones.length,
        ventas: ventas.length,
        compras: compras.length
      },
      montos: {
        ventasAfectas,
        ventasExentas,
        comprasAfectas,
        comprasExentas,
        ivaDebito,
        ivaCredito,
        ivaDeterminado: ivaDebito - ivaCredito
      }
    });

  } catch (error) {
    console.error('Error en getResumenMensual:', error);
    res.status(500).json({
      error: 'Error al obtener resumen mensual'
    });
  }
};

// Eliminar transacción
export const deleteTransaccion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    // Verificar que la transacción pertenezca al usuario
    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!transaccion) {
      return res.status(404).json({
        error: 'Transacción no encontrada'
      });
    }

    if (transaccion.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso para eliminar esta transacción'
      });
    }

    // Eliminar
    await prisma.transaccion.delete({
      where: { id }
    });

    res.json({
      message: 'Transacción eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteTransaccion:', error);
    res.status(500).json({
      error: 'Error al eliminar transacción'
    });
  }
};