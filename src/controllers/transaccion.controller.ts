// VERSIÓN 3.0 - CON PRODUCTOS + DTE AUTOMÁTICO
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarMonto } from '../utils/validators';
import { emitirBoleta, emitirFactura } from '../services/sii/dte.service';

// Crear transacción CON PRODUCTOS + DTE automático
export const createTransaccion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    console.log('=== REQUEST BODY ===');
    console.log(JSON.stringify(req.body, null, 2));

    const {
      tipo,
      tipoDocumento,  // 'boleta' | 'factura' — viene de la app
      fecha,
      exento,
      descripcion,
      proveedor,
      proveedorId,    // ID del proveedor para compras
      cliente,
      clienteId,      // ID del cliente para facturas
      numDocumento,
      metodoPago,
      productos
    } = req.body;

    if (!tipo || !fecha) {
      return res.status(400).json({ error: 'Tipo y fecha son requeridos' });
    }

    if (tipo !== 'venta' && tipo !== 'compra') {
      return res.status(400).json({ error: 'Tipo debe ser "venta" o "compra"' });
    }

    // Para facturas, el clienteId es obligatorio
    if (tipo === 'venta' && tipoDocumento === 'factura' && !clienteId) {
      return res.status(400).json({ error: 'Para emitir factura debes seleccionar un cliente' });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos un producto' });
    }

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    // Si es factura, obtener datos completos del cliente
    let clienteData: any = null;
    if (tipo === 'venta' && tipoDocumento === 'factura' && clienteId) {
      clienteData = await prisma.cliente.findFirst({
        where: { id: clienteId, negocioId: negocio.id }
      });
      if (!clienteData) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
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

      const producto = await prisma.producto.findFirst({
        where: { id: productoId, negocioId: negocio.id }
      });

      if (!producto) {
        return res.status(404).json({ error: `Producto ${productoId} no encontrado` });
      }

      if (tipo === 'venta' && producto.stockActual < cantidad) {
        return res.status(400).json({
          error: `Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockActual}, solicitado: ${cantidad}`
        });
      }

      let precio = precioUnitario;

      if (tipo === 'venta') {
        if (!producto.precioVenta) {
          return res.status(400).json({
            error: `El producto ${producto.nombre} no tiene precio de venta configurado`
          });
        }
        precio = producto.precioVenta;
      } else {
        if (!precioUnitario || precioUnitario <= 0) {
          return res.status(400).json({ error: 'Precio unitario es requerido para compras' });
        }
        const v = validarMonto(precioUnitario);
        if (!v.valido) return res.status(400).json({ error: v.error });
      }

      const subtotal = precio * cantidad;
      montoTotal += subtotal;

      productosValidados.push({ productoId, producto, cantidad, precioUnitario: precio, subtotal });
    }

    // Calcular IVA
    let montoNeto = montoTotal;
    let montoIva  = 0;

    if (!exento) {
      montoNeto = Math.round(montoTotal / 1.19);
      montoIva  = montoTotal - montoNeto;
    }

    // ─── TRANSACCIÓN DE BD ───────────────────────────────────────
    const transaccion = await prisma.$transaction(async (tx) => {

      // 1. Crear transacción — ahora guarda tipoDocumento y clienteId
      const nuevaTransaccion = await tx.transaccion.create({
        data: {
          negocioId:     negocio.id,
          tipo,
          tipoDocumento: tipoDocumento || 'boleta',
          fecha:         new Date(fecha),
          montoTotal,
          montoNeto,
          montoIva,
          exento:        exento || false,
          descripcion,
          proveedor,
          proveedorId:   proveedorId || null,
          cliente,
          clienteId:     clienteId || null,
          numDocumento,
          metodoPago,
        }
      });

      // 2. Crear detalles
      for (const item of productosValidados) {
        const montoItemIva = exento
          ? 0
          : Math.round(item.subtotal - (item.subtotal / 1.19));

        await tx.detalleTransaccion.create({
          data: {
            transaccionId:  nuevaTransaccion.id,
            productoId:     item.productoId,
            nombreItem:     item.producto.nombre,
            cantidad:       item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal:       item.subtotal,
            montoItem:      item.subtotal,
            montoIva:       montoItemIva,
          }
        });

        // 3. Actualizar stock
        const stockAnterior = item.producto.stockActual;
        const stockNuevo    = tipo === 'venta'
          ? stockAnterior - item.cantidad
          : stockAnterior + item.cantidad;

        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockActual: stockNuevo,
            ...(tipo === 'compra' && { precioCompra: item.precioUnitario })
          }
        });

        // 4. Movimiento de stock
        await tx.movimientoStock.create({
          data: {
            productoId:    item.productoId,
            tipo:          tipo === 'venta' ? 'salida' : 'entrada',
            cantidad:      item.cantidad,
            motivo:        tipo === 'venta' ? 'Venta' : 'Compra',
            stockAnterior,
            stockNuevo
          }
        });

        // 5. Alerta stock bajo
        if (tipo === 'venta' && stockNuevo <= item.producto.stockMinimo) {
          await tx.alerta.create({
            data: {
              negocioId: negocio.id,
              tipo:      'stock_bajo',
              titulo:    'Stock bajo',
              mensaje:   `${item.producto.nombre} tiene stock bajo (${stockNuevo} ${item.producto.unidadMedida})`,
              prioridad: 'alta',
              metadata: {
                productoId:  item.productoId,
                stockActual: stockNuevo,
                stockMinimo: item.producto.stockMinimo
              }
            }
          });
        }
      }

      return nuevaTransaccion;
    });

    // ─── DTE AUTOMÁTICO ──────────────────────────────────────────
    let dteResultado: any = null;
    let dteError: string | null = null;

    if (tipo === 'venta' && negocio.certificadoActivo) {
      try {
        const itemsDte = productosValidados.map(p => ({
          nombre:         p.producto.nombre,
          cantidad:       p.cantidad,
          precioUnitario: p.precioUnitario,
        }));

        if (tipoDocumento === 'factura' && clienteData) {
          dteResultado = await emitirFactura({
            negocioId:         negocio.id,
            receptorRut:       clienteData.rut,
            receptorNombre:    clienteData.nombre,
            receptorDireccion: clienteData.direccion,
            receptorComuna:    clienteData.comuna,
            receptorGiro:      clienteData.giro || 'Sin giro',
            receptorEmail:     clienteData.email,
            items:             itemsDte,
            metodoPago,
          });
        } else {
          dteResultado = await emitirBoleta({
            negocioId:   negocio.id,
            receptorRut: clienteData?.rut,
            items:       itemsDte,
            metodoPago,
          });
        }

        if (dteResultado?.documentoId) {
          await prisma.transaccion.update({
            where: { id: transaccion.id },
            data:  { documentoSiiId: dteResultado.documentoId }
          });
        }

      } catch (errorDte: any) {
        console.error('Error al emitir DTE (transacción guardada):', errorDte.message);
        dteError = errorDte.message;
      }
    }

    res.status(201).json({
      message: 'Transacción creada exitosamente',
      transaccion: {
        ...transaccion,
        productos: productosValidados.map(p => ({
          id:             p.productoId,
          nombre:         p.producto.nombre,
          cantidad:       p.cantidad,
          precioUnitario: p.precioUnitario,
          subtotal:       p.subtotal
        }))
      },
      dte: dteResultado
        ? {
            emitido:     true,
            folio:       dteResultado.folio,
            documentoId: dteResultado.documentoId,
            trackId:     dteResultado.trackId,
          }
        : tipo === 'venta' && !negocio.certificadoActivo
          ? { emitido: false, razon: 'Sin certificado digital' }
          : dteError
            ? { emitido: false, razon: dteError }
            : null
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

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const where: any = { negocioId: negocio.id };

    if (tipo) where.tipo = tipo as string;

    if (fechaInicio || fechaFin) {
      where.fecha = {};
      if (fechaInicio) where.fecha.gte = new Date(fechaInicio as string);
      if (fechaFin)    where.fecha.lte = new Date(fechaFin as string);
    }

    const take = limit  ? parseInt(limit as string)  : 50;
    const skip = offset ? parseInt(offset as string) : 0;

    const [transacciones, total] = await Promise.all([
      prisma.transaccion.findMany({
        where,
        include: {
          detalles:     { include: { producto: true } },
          documentoSii: true,
          cliente:      true,
          proveedorRel: true,
        },
        orderBy: { fecha: 'desc' },
        take,
        skip
      }),
      prisma.transaccion.count({ where })
    ]);

    const totalVentas  = transacciones.filter(t => t.tipo === 'venta').reduce((sum, t) => sum + t.montoTotal, 0);
    const totalCompras = transacciones.filter(t => t.tipo === 'compra').reduce((sum, t) => sum + t.montoTotal, 0);

    res.json({
      transacciones,
      paginacion: { total, limit: take, offset: skip, hasMore: skip + transacciones.length < total },
      resumen:    { totalVentas, totalCompras, balance: totalVentas - totalCompras }
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
    const id     = req.params.id as string;

    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        negocio:      true,
        detalles:     { include: { producto: true } },
        documentoSii: true,
        cliente:      true,
        proveedorRel: true,
      }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    if (transaccion.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta transacción' });
    }

    res.json({ transaccion });

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
      return res.status(400).json({ error: 'Mes y año son requeridos' });
    }

    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({ error: 'Negocio no encontrado' });
    }

    const mesNum  = parseInt(mes as string);
    const anioNum = parseInt(anio as string);

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

    const ventasAfectas  = ventas.filter(v => !v.exento).reduce((sum, v) => sum + v.montoNeto, 0);
    const ventasExentas  = ventas.filter(v => v.exento).reduce((sum, v) => sum + v.montoTotal, 0);
    const comprasAfectas = compras.filter(c => !c.exento).reduce((sum, c) => sum + c.montoNeto, 0);
    const comprasExentas = compras.filter(c => c.exento).reduce((sum, c) => sum + c.montoTotal, 0);
    const ivaDebito      = ventas.filter(v => !v.exento).reduce((sum, v) => sum + v.montoIva, 0);
    const ivaCredito     = compras.filter(c => !c.exento).reduce((sum, c) => sum + c.montoIva, 0);

    res.json({
      periodo:       `${mes}/${anio}`,
      transacciones: { total: transacciones.length, ventas: ventas.length, compras: compras.length },
      montos: {
        ventasAfectas, ventasExentas,
        comprasAfectas, comprasExentas,
        ivaDebito, ivaCredito,
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
    const id     = req.params.id as string;

    const transaccion = await prisma.transaccion.findUnique({
      where: { id },
      include: {
        negocio:  true,
        detalles: { include: { producto: true } }
      }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    if (transaccion.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta transacción' });
    }

    await prisma.$transaction(async (tx) => {
      for (const detalle of transaccion.detalles) {
        const stockAnterior = detalle.producto.stockActual;
        const stockNuevo    = transaccion.tipo === 'venta'
          ? stockAnterior + detalle.cantidad
          : stockAnterior - detalle.cantidad;

        await tx.producto.update({
          where: { id: detalle.productoId },
          data:  { stockActual: stockNuevo }
        });

        await tx.movimientoStock.create({
          data: {
            productoId: detalle.productoId,
            tipo:       'ajuste',
            cantidad:   detalle.cantidad,
            motivo:     `Eliminación de ${transaccion.tipo}`,
            stockAnterior,
            stockNuevo
          }
        });
      }

      await tx.transaccion.delete({ where: { id } });
    });

    res.json({ message: 'Transacción eliminada exitosamente' });

  } catch (error) {
    console.error('Error en deleteTransaccion:', error);
    res.status(500).json({
      error: 'Error al eliminar transacción',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// Registrar Nota de Crédito/Débito recibida de proveedor (COMPRAS)
export const registrarNotaCompra = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const transaccionId = req.params.id as string;
    const { tipo, monto, numDocumento, motivo, fecha } = req.body;

    // Validaciones
    if (!tipo || (tipo !== 'nota_credito' && tipo !== 'nota_debito')) {
      return res.status(400).json({ error: 'Tipo debe ser "nota_credito" o "nota_debito"' });
    }

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'Monto debe ser mayor a 0' });
    }

    if (!numDocumento || !numDocumento.trim()) {
      return res.status(400).json({ error: 'Número de documento es requerido' });
    }

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({ error: 'Motivo es requerido' });
    }

    // Verificar que la transacción existe y pertenece al usuario
    const transaccion = await prisma.transaccion.findUnique({
      where: { id: transaccionId },
      include: { negocio: true }
    });

    if (!transaccion) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    if (transaccion.negocio.usuarioId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta transacción' });
    }

    if (transaccion.tipo !== 'compra') {
      return res.status(400).json({ error: 'Solo puedes registrar NC/ND en compras' });
    }

    // Calcular IVA (asumiendo 19%)
    const tasaIva = 0.19;
    const montoNeto = Math.round(monto / (1 + tasaIva));
    const montoIva = monto - montoNeto;

    // Crear la nota contable (corrección)
    const notaContable = await prisma.notaContable.create({
      data: {
        tipo,
        transaccionId,  // Ahora permite múltiples notas por transacción
        monto,
        motivo: motivo.trim(),
        categoria: tipo === 'nota_credito' ? 'devolucion_compra' : 'recargo_compra',
        negocioId: transaccion.negocioId,
      }
    });

    // Crear una transacción de ajuste contable
    const tipoAjuste = tipo === 'nota_credito' ? 'ajuste_credito_compra' : 'ajuste_debito_compra';
    const montoAjustado = tipo === 'nota_credito' ? -monto : monto;
    const montoNetoAjustado = tipo === 'nota_credito' ? -montoNeto : montoNeto;
    const montoIvaAjustado = tipo === 'nota_credito' ? -montoIva : montoIva;

    const transaccionAjuste = await prisma.transaccion.create({
      data: {
        negocioId: transaccion.negocioId,
        tipo: tipoAjuste as any,
        fecha: fecha ? new Date(fecha) : new Date(),
        montoTotal: montoAjustado,
        montoNeto: montoNetoAjustado,
        montoIva: montoIvaAjustado,
        exento: false,
        descripcion: `${tipo === 'nota_credito' ? 'NC' : 'ND'} - ${motivo.trim()}`,
        numDocumento: numDocumento.trim(),
        proveedorId: transaccion.proveedorId,
        tipoDocumento: tipo === 'nota_credito' ? 'nota_credito' : 'nota_debito',
        esCorreccion: true,
        transaccionOriginalId: transaccionId,
      }
    });

    res.json({
      message: `${tipo === 'nota_credito' ? 'Nota de Crédito' : 'Nota de Débito'} registrada exitosamente`,
      notaContable,
      transaccionAjuste,
    });

  } catch (error) {
    console.error('Error en registrarNotaCompra:', error);
    res.status(500).json({
      error: 'Error al registrar la nota',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};