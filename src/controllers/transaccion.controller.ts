import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarMonto } from '../utils/validators';

// Crear transacción CON PRODUCTOS
export const createTransaccion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      tipo,
      fecha,
      exento,
      descripcion,
      proveedor,
      cliente,
      numDocumento,
      fotoUrl,
      metodoPago,
      productos // Array de { productoId, cantidad, precioUnitario }
    } = req.body;

    // Validar campos requeridos
    if (!tipo || !fecha) {
      return res.status(400).json({
        error: 'Tipo y fecha son requeridos'
      });
    }

    if (tipo !== 'venta' && tipo !== 'compra') {
      return res.status(400).json({
        error: 'Tipo debe ser "venta" o "compra"'
      });
    }

    // Validar que tenga productos
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        error: 'Debe incluir al menos un producto'
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

    // Validar productos y calcular totales
    let montoTotal = 0;
    const productosValidados: any[] = [];

    for (const item of productos) {
      const { productoId, cantidad, precioUnitario } = item;

      if (!productoId || !cantidad || cantidad <= 0) {
        return res.status(400).json({
          error: 'Cada producto debe tener productoId y cantidad válida'
        });
      }

      // Verificar que el producto existe y pertenece al negocio
      const producto = await prisma.producto.findFirst({
        where: {
          id: productoId,
          negocioId: negocio.id
        }
      });

      if (!producto) {
        return res.status(404).json({
          error: `Producto ${productoId} no encontrado`
        });
      }

      // Para VENTAS: verificar stock suficiente
      if (tipo === 'venta') {
        if (producto.stockActual < cantidad) {
          return res.status(400).json({
            error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockActual}, solicitado: ${cantidad}`
          });
        }
      }

      // Para VENTAS: usar precio de venta del producto
      // Para COMPRAS: usar precio enviado (puede ser diferente)
      let precio = precioUnitario;
      if (tipo === 'venta') {
        if (!producto.precioVenta) {
          return res.status(400).json({
            error: `El producto ${producto.nombre} no tiene precio de venta configurado`
          });
        }
        precio = producto.precioVenta;
      } else {
        // Validar precio de compra
        if (!precioUnitario || precioUnitario <= 0) {
          return res.status(400).json({
            error: 'Precio unitario es requerido para compras'
          });
        }
        const validacionPrecio = validarMonto(precioUnitario);
        if (!validacionPrecio.valido) {
          return res.status(400).json({
            error: validacionPrecio.error
          });
        }
      }

      const subtotal = precio * cantidad;
      montoTotal += subtotal;

      productosValidados.push({
        productoId,
        producto,
        cantidad,
        precioUnitario: precio,
        subtotal
      });
    }

    // Calcular IVA (si no es exento)
    let montoNeto = montoTotal;
    let montoIva = 0;

    if (!exento) {
      montoNeto = Math.round(montoTotal / 1.19);
      montoIva = montoTotal - montoNeto;
    }

    // Crear transacción con detalles en una transacción de BD
    const transaccion = await prisma.$transaction(async (tx) => {
      // 1. Crear transacción
      const nuevaTransaccion = await tx.transaccion.create({
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
          cliente,
          numDocumento,
          fotoUrl,
          metodoPago
        }
      });

      // 2. Crear detalles de transacción
      for (const item of productosValidados) {
        await tx.detalleTransaccion.create({
          data: {
            transaccionId: nuevaTransaccion.id,
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal
          }
        });

        // 3. Actualizar stock
        const stockAnterior = item.producto.stockActual;
        let stockNuevo = stockAnterior;

        if (tipo === 'venta') {
          stockNuevo = stockAnterior - item.cantidad;
        } else if (tipo === 'compra') {
          stockNuevo = stockAnterior + item.cantidad;
        }

        await tx.producto.update({
          where: { id: item.productoId },
          data: { 
            stockActual: stockNuevo,
            // Actualizar precio de compra si es compra
            ...(tipo === 'compra' && { precioCompra: item.precioUnitario })
          }
        });

        // 4. Registrar movimiento de stock
        await tx.movimientoStock.create({
          data: {
            productoId: item.productoId,
            tipo: tipo === 'venta' ? 'salida' : 'entrada',
            cantidad: item.cantidad,
            motivo: tipo === 'venta' ? 'Venta' : 'Compra',
            stockAnterior,
            stockNuevo
          }
        });

        // 5. Crear alerta si stock bajo (solo para ventas)
        if (tipo === 'venta' && stockNuevo <= item.producto.stockMinimo) {
          await tx.alerta.create({
            data: {
              negocioId: negocio.id,
              tipo: 'stock_bajo',
              titulo: 'Stock bajo',
              mensaje: `${item.producto.nombre} tiene stock bajo (${stockNuevo} ${item.producto.unidadMedida})`,
              prioridad: 'alta',
              metadata: {
                productoId: item.productoId,
                stockActual: stockNuevo,
                stockMinimo: item.producto.stockMinimo
              }
            }
          });
        }
      }

      return nuevaTransaccion;
    });

    res.status(201).json({
      message: 'Transacción creada exitosamente',
      transaccion: {
        ...transaccion,
        productos: productosValidados.map(p => ({
          id: p.productoId,
          nombre: p.producto.nombre,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
          subtotal: p.subtotal
        }))
      }
    });

  } catch (error) {
    console.error('Error en createTransaccion:', error);
    res.status(500).json({
      error: 'Error al crear transacción',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// Listar transacciones
export const getTransacciones = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { tipo, fechaInicio, fechaFin, limit, offset } = req.query;

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

    // Paginación
    const take = limit ? parseInt(limit as string) : 50; // Default 50
    const skip = offset ? parseInt(offset as string) : 0;

    // Obtener transacciones con detalles
    const [transacciones, total] = await Promise.all([
      prisma.transaccion.findMany({
        where,
        include: {
          detalles: {
            include: {
              producto: true
            }
          }
        },
        orderBy: {
          fecha: 'desc'
        },
        take,
        skip
      }),
      prisma.transaccion.count({ where })
    ]);

    // Calcular totales
    const totalVentas = transacciones
      .filter(t => t.tipo === 'venta')
      .reduce((sum, t) => sum + t.montoTotal, 0);

    const totalCompras = transacciones
      .filter(t => t.tipo === 'compra')
      .reduce((sum, t) => sum + t.montoTotal, 0);

    res.json({
      transacciones,
      paginacion: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + transacciones.length < total
      },
      resumen: {
        totalVentas,
        totalCompras,
        balance: totalVentas - totalCompras
      }
    });

  } catch (error) {
    console.error('Error en getTransacciones:', error);
    res.status(500).json({
      error: 'Error al obtener transacciones',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// Obtener detalle de una transacción
export const getTransaccionById = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    // Verificar que la transacción pertenezca al usuario
    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        negocio: true,
        detalles: {
          include: {
            producto: true
          }
        }
      }
    });

    if (!transaccion) {
      return res.status(404).json({
        error: 'Transacción no encontrada'
      });
    }

    if (transaccion.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso para ver esta transacción'
      });
    }

    res.json({
      transaccion
    });

  } catch (error) {
    console.error('Error en getTransaccionById:', error);
    res.status(500).json({
      error: 'Error al obtener transacción',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
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
      error: 'Error al obtener resumen mensual',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
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
        negocio: true,
        detalles: {
          include: {
            producto: true
          }
        }
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

    // Eliminar en transacción de BD (revertir stock)
    await prisma.$transaction(async (tx) => {
      // Revertir stock
      for (const detalle of transaccion.detalles) {
        const stockAnterior = detalle.producto.stockActual;
        let stockNuevo = stockAnterior;

        if (transaccion.tipo === 'venta') {
          // Revertir venta = sumar stock
          stockNuevo = stockAnterior + detalle.cantidad;
        } else if (transaccion.tipo === 'compra') {
          // Revertir compra = restar stock
          stockNuevo = stockAnterior - detalle.cantidad;
        }

        await tx.producto.update({
          where: { id: detalle.productoId },
          data: { stockActual: stockNuevo }
        });

        // Registrar movimiento
        await tx.movimientoStock.create({
          data: {
            productoId: detalle.productoId,
            tipo: 'ajuste',
            cantidad: detalle.cantidad,
            motivo: `Eliminación de ${transaccion.tipo}`,
            stockAnterior,
            stockNuevo
          }
        });
      }

      // Eliminar transacción (cascade elimina detalles)
      await tx.transaccion.delete({
        where: { id }
      });
    });

    res.json({
      message: 'Transacción eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en deleteTransaccion:', error);
    res.status(500).json({
      error: 'Error al eliminar transacción',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};