import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarMes, validarAnio } from '../utils/validators';

// OBTENER/CALCULAR F29
export const getF29 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const mes = req.params.mes as string;
    const anio = req.params.anio as string;

    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);

    const validacionMes = validarMes(mesNum);
    if (!validacionMes.valido) {
      return res.status(400).json({ error: validacionMes.error });
    }

    const validacionAnio = validarAnio(anioNum);
    if (!validacionAnio.valido) {
      return res.status(400).json({ error: validacionAnio.error });
    }

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Buscar si ya existe declaración
    let declaracion = await prisma.declaracionF29.findUnique({
      where: {
        negocioId_mes_anio: {
          negocioId: negocio.id,
          mes: mesNum,
          anio: anioNum
        }
      }
    });

    // Si no existe, calcularla desde las transacciones
    if (!declaracion) {
      const fechaInicio = new Date(anioNum, mesNum - 1, 1);
      const fechaFin    = new Date(anioNum, mesNum, 0, 23, 59, 59);

      const transacciones = await prisma.transaccion.findMany({
        where: {
          negocioId: negocio.id,
          fecha: { gte: fechaInicio, lte: fechaFin }
        }
      });

      const ventas  = transacciones.filter(t => t.tipo === 'venta');
      const compras = transacciones.filter(t => t.tipo === 'compra');

      // Ventas
      const ventasAfectas = ventas
        .filter(v => !v.exento)
        .reduce((sum, v) => sum + v.montoNeto, 0);  // montoNeto = sin IVA

      const ventasExentas = ventas
        .filter(v => v.exento)
        .reduce((sum, v) => sum + v.montoTotal, 0);

      const totalVentas = ventasAfectas + ventasExentas;

      const ivaDebito = ventas
        .filter(v => !v.exento)
        .reduce((sum, v) => sum + v.montoIva, 0);

      // Compras
      const comprasAfectas = compras
        .filter(c => !c.exento)
        .reduce((sum, c) => sum + c.montoNeto, 0);

      const comprasExentas = compras
        .filter(c => c.exento)
        .reduce((sum, c) => sum + c.montoTotal, 0);

      const totalCompras = comprasAfectas + comprasExentas;

      const ivaCredito = compras
        .filter(c => !c.exento)
        .reduce((sum, c) => sum + c.montoIva, 0);

      // IVA determinado
      const ivaDeterminado = ivaDebito - ivaCredito;

      // PPM PROPYME: 0.25% de ventas netas (ppmTasa = 25 = 0.25%)
      const ppmBase  = ventasAfectas + ventasExentas  // base = total ventas
      const ppmTasa  = 25                              // 0.25% en décimas
      const ppmMonto = Math.round(ppmBase * 0.0025)

      const totalAPagar = Math.max(0, ivaDeterminado) + ppmMonto;

      declaracion = await prisma.declaracionF29.create({
        data: {
          negocioId: negocio.id,
          mes:       mesNum,
          anio:      anioNum,
          // Ventas
          ventasAfectas,
          ventasExentas,
          ventasExportacion: 0,
          totalVentas,
          // IVA débito
          ivaDebito,
          notasCreditoVentas: 0,
          ivaNotasCredito:    0,
          // Compras
          comprasAfectas,
          comprasExentas,
          comprasSupermercado: 0,
          totalCompras,
          // IVA crédito
          ivaCredito,
          notasCreditoCompras: 0,
          ivaNotasCreditoComp: 0,
          notasDebitoCompras:  0,
          ivaNotasDebitoComp:  0,
          // Cálculos
          ivaDeterminado,
          retencionIvaTerceros: 0,
          // PPM
          ppmBase,
          ppmTasa,
          ppmMonto,
          // Total
          totalAPagar,
          estado: 'borrador'
        }
      });
    }

    res.json({
      declaracion,
      resumen: {
        ventas: {
          afectas: declaracion.ventasAfectas,
          exentas: declaracion.ventasExentas,
          total:   declaracion.totalVentas
        },
        compras: {
          afectas: declaracion.comprasAfectas,
          exentas: declaracion.comprasExentas,
          total:   declaracion.totalCompras
        },
        iva: {
          debito:      declaracion.ivaDebito,
          credito:     declaracion.ivaCredito,
          determinado: declaracion.ivaDeterminado,
          resultado:   declaracion.ivaDeterminado > 0 ? 'A pagar' : 'A favor'
        },
        ppm:        declaracion.ppmMonto,
        totalAPagar: declaracion.totalAPagar
      }
    });

  } catch (error) {
    console.error('Error en getF29:', error);
    res.status(500).json({
      error: 'Error al obtener F29',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// LISTAR F29 (historial)
export const listarF29 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { anio } = req.query;

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const where: any = { negocioId: negocio.id };

    if (anio) {
      const anioNum = parseInt(anio as string);
      const validacionAnio = validarAnio(anioNum);
      if (!validacionAnio.valido) {
        return res.status(400).json({ error: validacionAnio.error });
      }
      where.anio = anioNum;
    }

    const declaraciones = await prisma.declaracionF29.findMany({
      where,
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }]
    });

    res.json({
      declaraciones,
      total: declaraciones.length
    });

  } catch (error) {
    console.error('Error en listarF29:', error);
    res.status(500).json({
      error: 'Error al listar F29',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// MARCAR F29 COMO PRESENTADO
export const marcarPresentado = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;
    const { folio } = req.body;

    const declaracion = await prisma.declaracionF29.findUnique({
      where: { id },
      include: { negocio: true }
    });

    if (!declaracion) {
      return res.status(404).json({ error: 'Declaración no encontrada' });
    }

    if (declaracion.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const declaracionActualizada = await prisma.declaracionF29.update({
      where: { id },
      data: {
        estado:            'presentada',
        fechaPresentacion: new Date(),
        folio:             folio || null
      }
    });

    res.json({
      message: 'F29 marcado como presentado',
      declaracion: declaracionActualizada
    });

  } catch (error) {
    console.error('Error en marcarPresentado:', error);
    res.status(500).json({
      error: 'Error al marcar F29 como presentado',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// ACTUALIZAR F29 MANUALMENTE
export const updateF29 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;
    const {
      ventasAfectas,
      ventasExentas,
      comprasAfectas,
      comprasExentas
    } = req.body;

    const declaracion = await prisma.declaracionF29.findUnique({
      where: { id },
      include: { negocio: true }
    });

    if (!declaracion) {
      return res.status(404).json({ error: 'Declaración no encontrada' });
    }

    if (declaracion.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    if (declaracion.estado === 'presentada') {
      return res.status(400).json({
        error: 'No se puede modificar una declaración ya presentada'
      });
    }

    // Recalcular
    const totalVentas  = ventasAfectas + ventasExentas;
    const totalCompras = comprasAfectas + comprasExentas;
    const ivaDebito    = Math.round(ventasAfectas * 0.19);
    const ivaCredito   = Math.round(comprasAfectas * 0.19);
    const ivaDeterminado = ivaDebito - ivaCredito;

    const ppmBase  = totalVentas;
    const ppmTasa  = 25;
    const ppmMonto = Math.round(ppmBase * 0.0025);

    const totalAPagar = Math.max(0, ivaDeterminado) + ppmMonto;

    const declaracionActualizada = await prisma.declaracionF29.update({
      where: { id },
      data: {
        ventasAfectas,
        ventasExentas,
        totalVentas,
        comprasAfectas,
        comprasExentas,
        totalCompras,
        ivaDebito,
        ivaCredito,
        ivaDeterminado,
        ppmBase,
        ppmTasa,
        ppmMonto,
        totalAPagar
      }
    });

    res.json({
      message: 'F29 actualizado exitosamente',
      declaracion: declaracionActualizada
    });

  } catch (error) {
    console.error('Error en updateF29:', error);
    res.status(500).json({
      error: 'Error al actualizar F29',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};