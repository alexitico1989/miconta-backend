"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTransaccion = exports.getResumenMensual = exports.getTransacciones = exports.createTransaccion = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// CREAR TRANSACCIÓN (Venta o Compra)
const createTransaccion = async (req, res) => {
    try {
        const userId = req.userId;
        const { tipo, fecha, montoTotal, exento, descripcion } = req.body;
        // Validar campos
        if (!tipo || !fecha || !montoTotal) {
            return res.status(400).json({
                error: 'Tipo, fecha y monto son requeridos'
            });
        }
        if (tipo !== 'venta' && tipo !== 'compra') {
            return res.status(400).json({
                error: 'Tipo debe ser "venta" o "compra"'
            });
        }
        // Obtener negocio del usuario
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Debes crear tu negocio primero'
            });
        }
        // Calcular IVA
        const isExento = exento || false;
        let montoNeto;
        let montoIva;
        if (isExento) {
            montoNeto = montoTotal;
            montoIva = 0;
        }
        else {
            montoNeto = Math.round(montoTotal / 1.19);
            montoIva = montoTotal - montoNeto;
        }
        // Crear transacción
        const transaccion = await prisma_1.default.transaccion.create({
            data: {
                negocioId: negocio.id,
                tipo,
                fecha: new Date(fecha),
                montoTotal,
                montoNeto,
                montoIva,
                exento: isExento,
                descripcion
            }
        });
        res.status(201).json({
            message: `${tipo === 'venta' ? 'Venta' : 'Compra'} registrada exitosamente`,
            transaccion
        });
    }
    catch (error) {
        console.error('Error en createTransaccion:', error);
        res.status(500).json({
            error: 'Error al crear transacción'
        });
    }
};
exports.createTransaccion = createTransaccion;
// OBTENER TRANSACCIONES
const getTransacciones = async (req, res) => {
    try {
        const userId = req.userId;
        const { tipo, mes, anio } = req.query;
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Construir filtros
        const where = {
            negocioId: negocio.id
        };
        if (tipo && (tipo === 'venta' || tipo === 'compra')) {
            where.tipo = tipo;
        }
        if (mes && anio) {
            const mesNum = parseInt(mes);
            const anioNum = parseInt(anio);
            const fechaInicio = new Date(anioNum, mesNum - 1, 1);
            const fechaFin = new Date(anioNum, mesNum, 0, 23, 59, 59);
            where.fecha = {
                gte: fechaInicio,
                lte: fechaFin
            };
        }
        // Obtener transacciones
        const transacciones = await prisma_1.default.transaccion.findMany({
            where,
            orderBy: {
                fecha: 'desc'
            }
        });
        res.json({
            transacciones,
            total: transacciones.length
        });
    }
    catch (error) {
        console.error('Error en getTransacciones:', error);
        res.status(500).json({
            error: 'Error al obtener transacciones'
        });
    }
};
exports.getTransacciones = getTransacciones;
// RESUMEN MENSUAL (para F29)
const getResumenMensual = async (req, res) => {
    try {
        const userId = req.userId;
        const { mes, anio } = req.query;
        if (!mes || !anio) {
            return res.status(400).json({
                error: 'Mes y año son requeridos'
            });
        }
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        const mesNum = parseInt(mes);
        const anioNum = parseInt(anio);
        const fechaInicio = new Date(anioNum, mesNum - 1, 1);
        const fechaFin = new Date(anioNum, mesNum, 0, 23, 59, 59);
        // Obtener ventas y compras del mes
        const transacciones = await prisma_1.default.transaccion.findMany({
            where: {
                negocioId: negocio.id,
                fecha: {
                    gte: fechaInicio,
                    lte: fechaFin
                }
            }
        });
        // Calcular totales
        const ventas = transacciones.filter(t => t.tipo === 'venta');
        const compras = transacciones.filter(t => t.tipo === 'compra');
        const totalVentas = ventas.reduce((sum, v) => sum + v.montoTotal, 0);
        const totalCompras = compras.reduce((sum, c) => sum + c.montoTotal, 0);
        const ivaVentas = ventas.reduce((sum, v) => sum + v.montoIva, 0);
        const ivaCompras = compras.reduce((sum, c) => sum + c.montoIva, 0);
        const ivaPagar = ivaVentas - ivaCompras;
        res.json({
            periodo: `${mes}/${anio}`,
            ventas: {
                cantidad: ventas.length,
                totalBruto: totalVentas,
                totalNeto: ventas.reduce((sum, v) => sum + v.montoNeto, 0),
                iva: ivaVentas
            },
            compras: {
                cantidad: compras.length,
                totalBruto: totalCompras,
                totalNeto: compras.reduce((sum, c) => sum + c.montoNeto, 0),
                iva: ivaCompras
            },
            resumen: {
                ivaPagar: ivaPagar > 0 ? ivaPagar : 0,
                aFavor: ivaPagar < 0 ? Math.abs(ivaPagar) : 0
            }
        });
    }
    catch (error) {
        console.error('Error en getResumenMensual:', error);
        res.status(500).json({
            error: 'Error al obtener resumen'
        });
    }
};
exports.getResumenMensual = getResumenMensual;
// ELIMINAR TRANSACCIÓN
const deleteTransaccion = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        // Verificar que la transacción pertenezca al usuario
        const transaccion = await prisma_1.default.transaccion.findUnique({
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
        await prisma_1.default.transaccion.delete({
            where: { id }
        });
        res.json({
            message: 'Transacción eliminada exitosamente'
        });
    }
    catch (error) {
        console.error('Error en deleteTransaccion:', error);
        res.status(500).json({
            error: 'Error al eliminar transacción'
        });
    }
};
exports.deleteTransaccion = deleteTransaccion;
