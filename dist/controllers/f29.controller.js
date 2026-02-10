"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateF29 = exports.marcarPresentado = exports.listarF29 = exports.getF29 = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// OBTENER/CALCULAR F29
const getF29 = async (req, res) => {
    try {
        const userId = req.userId;
        const { mes, anio } = req.params;
        // Validar
        const mesNum = parseInt(mes);
        const anioNum = parseInt(anio);
        if (mesNum < 1 || mesNum > 12) {
            return res.status(400).json({
                error: 'Mes inválido'
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
        // Buscar si ya existe declaración
        let declaracion = await prisma_1.default.declaracionF29.findUnique({
            where: {
                negocioId_mes_anio: {
                    negocioId: negocio.id,
                    mes: mesNum,
                    anio: anioNum
                }
            }
        });
        // Si no existe, calcularla
        if (!declaracion) {
            // Obtener transacciones del mes
            const fechaInicio = new Date(anioNum, mesNum - 1, 1);
            const fechaFin = new Date(anioNum, mesNum, 0, 23, 59, 59);
            const transacciones = await prisma_1.default.transaccion.findMany({
                where: {
                    negocioId: negocio.id,
                    fecha: {
                        gte: fechaInicio,
                        lte: fechaFin
                    }
                }
            });
            // Separar ventas y compras
            const ventas = transacciones.filter(t => t.tipo === 'venta');
            const compras = transacciones.filter(t => t.tipo === 'compra');
            // Calcular totales
            const ventasAfectas = ventas
                .filter(v => !v.exento)
                .reduce((sum, v) => sum + v.montoTotal, 0);
            const ventasExentas = ventas
                .filter(v => v.exento)
                .reduce((sum, v) => sum + v.montoTotal, 0);
            const ivaDebito = ventas
                .filter(v => !v.exento)
                .reduce((sum, v) => sum + v.montoIva, 0);
            const comprasAfectas = compras
                .filter(c => !c.exento)
                .reduce((sum, c) => sum + c.montoTotal, 0);
            const comprasExentas = compras
                .filter(c => c.exento)
                .reduce((sum, c) => sum + c.montoTotal, 0);
            const ivaCredito = compras
                .filter(c => !c.exento)
                .reduce((sum, c) => sum + c.montoIva, 0);
            // IVA determinado (débito - crédito)
            const ivaDeterminado = ivaDebito - ivaCredito;
            // PPM (0.25% de ventas netas)
            const ventasNetas = ventas.reduce((sum, v) => sum + v.montoNeto, 0);
            const ppm = Math.round(ventasNetas * 0.0025);
            // Total a pagar
            const totalAPagar = Math.max(0, ivaDeterminado) + ppm;
            // Crear declaración
            declaracion = await prisma_1.default.declaracionF29.create({
                data: {
                    negocioId: negocio.id,
                    mes: mesNum,
                    anio: anioNum,
                    ventasAfectas,
                    ventasExentas,
                    ivaDebito,
                    comprasAfectas,
                    comprasExentas,
                    ivaCredito,
                    ivaDeterminado,
                    ppm,
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
                    total: declaracion.ventasAfectas + declaracion.ventasExentas
                },
                compras: {
                    afectas: declaracion.comprasAfectas,
                    exentas: declaracion.comprasExentas,
                    total: declaracion.comprasAfectas + declaracion.comprasExentas
                },
                iva: {
                    debito: declaracion.ivaDebito,
                    credito: declaracion.ivaCredito,
                    determinado: declaracion.ivaDeterminado,
                    resultado: declaracion.ivaDeterminado > 0 ? 'A pagar' : 'A favor'
                },
                ppm: declaracion.ppm,
                totalAPagar: declaracion.totalAPagar
            }
        });
    }
    catch (error) {
        console.error('Error en getF29:', error);
        res.status(500).json({
            error: 'Error al obtener F29'
        });
    }
};
exports.getF29 = getF29;
// LISTAR F29 (historial)
const listarF29 = async (req, res) => {
    try {
        const userId = req.userId;
        const { anio } = req.query;
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Construir filtro
        const where = {
            negocioId: negocio.id
        };
        if (anio) {
            where.anio = parseInt(anio);
        }
        // Obtener declaraciones
        const declaraciones = await prisma_1.default.declaracionF29.findMany({
            where,
            orderBy: [
                { anio: 'desc' },
                { mes: 'desc' }
            ]
        });
        res.json({
            declaraciones,
            total: declaraciones.length
        });
    }
    catch (error) {
        console.error('Error en listarF29:', error);
        res.status(500).json({
            error: 'Error al listar F29'
        });
    }
};
exports.listarF29 = listarF29;
// MARCAR F29 COMO PRESENTADO
const marcarPresentado = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { folio } = req.body;
        // Verificar declaración
        const declaracion = await prisma_1.default.declaracionF29.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!declaracion) {
            return res.status(404).json({
                error: 'Declaración no encontrada'
            });
        }
        if (declaracion.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Actualizar estado
        const declaracionActualizada = await prisma_1.default.declaracionF29.update({
            where: { id },
            data: {
                estado: 'presentado',
                fechaPresentacion: new Date(),
                folio: folio || null
            }
        });
        res.json({
            message: 'F29 marcado como presentado',
            declaracion: declaracionActualizada
        });
    }
    catch (error) {
        console.error('Error en marcarPresentado:', error);
        res.status(500).json({
            error: 'Error al marcar F29 como presentado'
        });
    }
};
exports.marcarPresentado = marcarPresentado;
// ACTUALIZAR F29 MANUALMENTE
const updateF29 = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { ventasAfectas, ventasExentas, comprasAfectas, comprasExentas } = req.body;
        // Verificar declaración
        const declaracion = await prisma_1.default.declaracionF29.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!declaracion) {
            return res.status(404).json({
                error: 'Declaración no encontrada'
            });
        }
        if (declaracion.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        if (declaracion.estado === 'presentado') {
            return res.status(400).json({
                error: 'No se puede modificar una declaración ya presentada'
            });
        }
        // Recalcular con los nuevos valores
        const ivaDebito = Math.round(ventasAfectas / 1.19 * 0.19);
        const ivaCredito = Math.round(comprasAfectas / 1.19 * 0.19);
        const ivaDeterminado = ivaDebito - ivaCredito;
        const ventasNetas = Math.round(ventasAfectas / 1.19);
        const ppm = Math.round(ventasNetas * 0.0025);
        const totalAPagar = Math.max(0, ivaDeterminado) + ppm;
        // Actualizar
        const declaracionActualizada = await prisma_1.default.declaracionF29.update({
            where: { id },
            data: {
                ventasAfectas,
                ventasExentas,
                comprasAfectas,
                comprasExentas,
                ivaDebito,
                ivaCredito,
                ivaDeterminado,
                ppm,
                totalAPagar
            }
        });
        res.json({
            message: 'F29 actualizado exitosamente',
            declaracion: declaracionActualizada
        });
    }
    catch (error) {
        console.error('Error en updateF29:', error);
        res.status(500).json({
            error: 'Error al actualizar F29'
        });
    }
};
exports.updateF29 = updateF29;
