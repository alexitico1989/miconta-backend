import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarMes, validarAnio } from '../utils/validators';

// DASHBOARD PRINCIPAL
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Fechas
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 7);

    // VENTAS HOY
    const inicioHoy = new Date(hoy.setHours(0, 0, 0, 0));
    const finHoy = new Date(hoy.setHours(23, 59, 59, 999));

    const ventasHoy = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'venta',
        fecha: {
          gte: inicioHoy,
          lte: finHoy
        }
      }
    });

    const totalVentasHoy = ventasHoy.reduce((sum, v) => sum + v.montoTotal, 0);

    // VENTAS SEMANA
    const ventasSemana = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'venta',
        fecha: {
          gte: inicioSemana,
          lte: finHoy
        }
      }
    });

    const totalVentasSemana = ventasSemana.reduce((sum, v) => sum + v.montoTotal, 0);

    // VENTAS MES
    const ventasMes = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'venta',
        fecha: {
          gte: inicioMes,
          lte: finMes
        }
      }
    });

    const totalVentasMes = ventasMes.reduce((sum, v) => sum + v.montoTotal, 0);

    // ============================================
    // COMPRAS (AGREGADO)
    // ============================================
    
    // COMPRAS HOY
    const comprasHoy = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'compra',
        fecha: {
          gte: inicioHoy,
          lte: finHoy
        }
      }
    });

    const totalComprasHoy = comprasHoy.reduce((sum, c) => sum + c.montoTotal, 0);

    // COMPRAS MES
    const comprasMes = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'compra',
        fecha: {
          gte: inicioMes,
          lte: finMes
        }
      }
    });

    const totalComprasMes = comprasMes.reduce((sum, c) => sum + c.montoTotal, 0);

    // PROYECCIÓN FIN DE MES
    const diasTranscurridos = hoy.getDate();
    const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const promedioVentaDiaria = diasTranscurridos > 0 ? totalVentasMes / diasTranscurridos : 0;
    const proyeccionFinMes = Math.round(promedioVentaDiaria * diasMes);

    // PRODUCTOS STOCK BAJO
    const productosStockBajo = await prisma.$queryRaw<any[]>`
      SELECT * FROM productos
      WHERE "negocioId" = ${negocio.id}
      AND activo = true
      AND "stockActual" <= "stockMinimo"
      ORDER BY "stockActual" ASC
      LIMIT 5
    `;

    // PRÓXIMAS VISITAS PROVEEDORES
    const fechaLimite = new Date(hoy);
    fechaLimite.setDate(fechaLimite.getDate() + 7);

    const proximasVisitas = await prisma.proveedor.findMany({
      where: {
        negocioId: negocio.id,
        activo: true,
        proximaVisita: {
          gte: hoy,
          lte: fechaLimite
        }
      },
      orderBy: {
        proximaVisita: 'asc'
      },
      take: 5
    });

    // ALERTAS NO LEÍDAS
    const alertasNoLeidas = await prisma.alerta.count({
      where: {
        negocioId: negocio.id,
        leida: false
      }
    });

    // F29 PENDIENTE (mes actual)
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    const f29Actual = await prisma.declaracionF29.findUnique({
      where: {
        negocioId_mes_anio: {
          negocioId: negocio.id,
          mes: mesActual,
          anio: anioActual
        }
      }
    });

    // TOP 5 PRODUCTOS MÁS VENDIDOS (mes actual)
    const transaccionesConProductos = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        tipo: 'venta',
        fecha: {
          gte: inicioMes,
          lte: finMes
        },
        descripcion: {
          not: null
        }
      },
      select: {
        descripcion: true,
        montoTotal: true
      }
    });

    // Agrupar por descripción (simplificado - en producción usar mejor lógica)
    const productosVendidos: { [key: string]: number } = {};
    transaccionesConProductos.forEach(t => {
      if (t.descripcion) {
        productosVendidos[t.descripcion] = (productosVendidos[t.descripcion] || 0) + 1;
      }
    });

    const topProductos = Object.entries(productosVendidos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));

    // RESPUESTA
    res.json({
      ventas: {
        hoy: {
          total: totalVentasHoy,
          cantidad: ventasHoy.length
        },
        semana: {
          total: totalVentasSemana,
          cantidad: ventasSemana.length
        },
        mes: {
          total: totalVentasMes,
          cantidad: ventasMes.length,
          proyeccionFinMes
        }
      },
      compras: {  // ← AGREGADO
        hoy: {
          total: totalComprasHoy,
          cantidad: comprasHoy.length
        },
        mes: {
          total: totalComprasMes,
          cantidad: comprasMes.length
        }
      },
      stock: {
        productosStockBajo: productosStockBajo.length,
        productos: productosStockBajo
      },
      proveedores: {
        proximasVisitas: proximasVisitas.length,
        visitas: proximasVisitas
      },
      alertas: {
        noLeidas: alertasNoLeidas
      },
      impuestos: {
        f29Actual: f29Actual ? {
          mes: f29Actual.mes,
          estado: f29Actual.estado,
          totalAPagar: f29Actual.totalAPagar
        } : null
      },
      topProductos,
      insights: {
        promedioVentaDiaria: Math.round(promedioVentaDiaria),
        mejorDia: ventasSemana.length > 0 ? 'Análisis en desarrollo' : null,
        tendencia: totalVentasMes > proyeccionFinMes * 0.8 ? 'Positiva' : 'Revisar'
      }
    });

  } catch (error) {
    console.error('Error en getDashboard:', error);
    res.status(500).json({
      error: 'Error al obtener dashboard',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// REPORTE MENSUAL
export const getReporteMensual = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const mes = req.params.mes as string;
    const anio = req.params.anio as string;

    const mesNum = parseInt(mes);
    const anioNum = parseInt(anio);

    // Validar mes y año
    const validacionMes = validarMes(mesNum);
    if (!validacionMes.valido) {
      return res.status(400).json({
        error: validacionMes.error
      });
    }

    const validacionAnio = validarAnio(anioNum);
    if (!validacionAnio.valido) {
      return res.status(400).json({
        error: validacionAnio.error
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

    // Fechas
    const fechaInicio = new Date(anioNum, mesNum - 1, 1);
    const fechaFin = new Date(anioNum, mesNum, 0, 23, 59, 59);

    // Obtener transacciones
    const transacciones = await prisma.transaccion.findMany({
      where: {
        negocioId: negocio.id,
        fecha: {
          gte: fechaInicio,
          lte: fechaFin
        }
      }
    });

    const ventas = transacciones.filter(t => t.tipo === 'venta');
    const compras = transacciones.filter(t => t.tipo === 'compra');

    const totalVentas = ventas.reduce((sum, v) => sum + v.montoTotal, 0);
    const totalCompras = compras.reduce((sum, c) => sum + c.montoTotal, 0);

    // Obtener F29
    const f29 = await prisma.declaracionF29.findUnique({
      where: {
        negocioId_mes_anio: {
          negocioId: negocio.id,
          mes: mesNum,
          anio: anioNum
        }
      }
    });

    const diasMes = new Date(anioNum, mesNum, 0).getDate();

    res.json({
      periodo: `${mes}/${anio}`,
      ventas: {
        total: totalVentas,
        cantidad: ventas.length,
        promedioDiario: Math.round(totalVentas / diasMes)
      },
      compras: {
        total: totalCompras,
        cantidad: compras.length
      },
      margen: {
        bruto: totalVentas - totalCompras,
        porcentaje: totalVentas > 0 ? Math.round(((totalVentas - totalCompras) / totalVentas) * 100) : 0
      },
      f29: f29 ? {
        estado: f29.estado,
        totalAPagar: f29.totalAPagar,
        presentado: f29.estado === 'presentado'
      } : null
    });

  } catch (error) {
    console.error('Error en getReporteMensual:', error);
    res.status(500).json({
      error: 'Error al obtener reporte mensual',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};