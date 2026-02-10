"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marcarComoPagada = exports.generarArchivoPrevired = exports.getLiquidaciones = exports.generarLiquidacion = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Porcentajes 2026 (actualizar según normativa)
const PORCENTAJES = {
    AFP: 0.1, // 10%
    SALUD: 0.07, // 7%
    CESANTIA_TRABAJADOR: 0.006, // 0.6%
    CESANTIA_EMPLEADOR: 0.024, // 2.4%
    SIS: 0.0077 // 0.77% (aproximado)
};
const UF_2026 = 37800; // Actualizar según valor real
const UTM_2026 = 65000; // Actualizar según valor real
// Tabla impuesto único 2026 (simplificada)
const TABLA_IMPUESTO_UNICO = [
    { desde: 0, hasta: 13.5 * UTM_2026, tasa: 0, rebaja: 0 },
    { desde: 13.5 * UTM_2026, hasta: 30 * UTM_2026, tasa: 0.04, rebaja: 0.04 * 13.5 * UTM_2026 },
    { desde: 30 * UTM_2026, hasta: 50 * UTM_2026, tasa: 0.08, rebaja: 0.08 * 30 * UTM_2026 - (0.04 * 13.5 * UTM_2026) },
    { desde: 50 * UTM_2026, hasta: 70 * UTM_2026, tasa: 0.135, rebaja: 0.135 * 50 * UTM_2026 - (0.08 * 30 * UTM_2026 - (0.04 * 13.5 * UTM_2026)) },
    { desde: 70 * UTM_2026, hasta: 90 * UTM_2026, tasa: 0.23, rebaja: 0.23 * 70 * UTM_2026 },
    { desde: 90 * UTM_2026, hasta: 120 * UTM_2026, tasa: 0.304, rebaja: 0.304 * 90 * UTM_2026 },
    { desde: 120 * UTM_2026, hasta: Infinity, tasa: 0.35, rebaja: 0.35 * 120 * UTM_2026 }
];
// CALCULAR IMPUESTO ÚNICO
function calcularImpuestoUnico(baseImponible) {
    for (const tramo of TABLA_IMPUESTO_UNICO) {
        if (baseImponible >= tramo.desde && baseImponible < tramo.hasta) {
            return Math.round(baseImponible * tramo.tasa - tramo.rebaja);
        }
    }
    return 0;
}
// GENERAR LIQUIDACIÓN
const generarLiquidacion = async (req, res) => {
    try {
        const userId = req.userId;
        const { trabajadorId, mes, anio, horasExtra, bonos, otrosDescuentos } = req.body;
        // Validar
        if (!trabajadorId || !mes || !anio) {
            return res.status(400).json({
                error: 'Faltan campos requeridos: trabajadorId, mes, anio'
            });
        }
        // Verificar trabajador
        const trabajador = await prisma_1.default.trabajador.findUnique({
            where: { id: trabajadorId },
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
        // Verificar que no exista liquidación para ese periodo
        const liquidacionExistente = await prisma_1.default.liquidacion.findUnique({
            where: {
                trabajadorId_mes_anio: {
                    trabajadorId,
                    mes,
                    anio
                }
            }
        });
        if (liquidacionExistente) {
            return res.status(400).json({
                error: 'Ya existe una liquidación para este periodo'
            });
        }
        // CALCULAR HABERES
        const sueldoBase = trabajador.sueldoBase;
        const horasExtraValor = horasExtra || 0;
        const bonosValor = bonos || 0;
        const totalHaberes = sueldoBase + horasExtraValor + bonosValor;
        // CALCULAR DESCUENTOS LEGALES
        const afp = Math.round(totalHaberes * PORCENTAJES.AFP);
        const salud = Math.round(totalHaberes * PORCENTAJES.SALUD);
        const cesantia = Math.round(totalHaberes * PORCENTAJES.CESANTIA_TRABAJADOR);
        // Base imponible para impuesto único
        const baseImponible = totalHaberes - afp - salud - cesantia;
        const impuestoUnico = calcularImpuestoUnico(baseImponible);
        const totalDescuentos = afp + salud + cesantia + impuestoUnico + (otrosDescuentos || 0);
        // SUELDO LÍQUIDO
        const sueldoLiquido = totalHaberes - totalDescuentos;
        // Crear liquidación
        const liquidacion = await prisma_1.default.liquidacion.create({
            data: {
                trabajadorId,
                mes,
                anio,
                sueldoBase,
                horasExtra: horasExtraValor,
                bonos: bonosValor,
                totalHaberes,
                afp,
                salud,
                cesantia,
                impuestoUnico,
                otrosDescuentos: otrosDescuentos || 0,
                totalDescuentos,
                sueldoLiquido
            }
        });
        res.status(201).json({
            message: 'Liquidación generada exitosamente',
            liquidacion
        });
    }
    catch (error) {
        console.error('Error en generarLiquidacion:', error);
        res.status(500).json({
            error: 'Error al generar liquidación'
        });
    }
};
exports.generarLiquidacion = generarLiquidacion;
// OBTENER LIQUIDACIONES
const getLiquidaciones = async (req, res) => {
    try {
        const userId = req.userId;
        const { mes, anio, trabajadorId } = req.query;
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
            trabajador: {
                negocioId: negocio.id
            }
        };
        if (mes)
            where.mes = parseInt(mes);
        if (anio)
            where.anio = parseInt(anio);
        if (trabajadorId)
            where.trabajadorId = trabajadorId;
        // Obtener liquidaciones
        const liquidaciones = await prisma_1.default.liquidacion.findMany({
            where,
            include: {
                trabajador: true
            },
            orderBy: [
                { anio: 'desc' },
                { mes: 'desc' }
            ]
        });
        res.json({
            liquidaciones,
            total: liquidaciones.length
        });
    }
    catch (error) {
        console.error('Error en getLiquidaciones:', error);
        res.status(500).json({
            error: 'Error al obtener liquidaciones'
        });
    }
};
exports.getLiquidaciones = getLiquidaciones;
// GENERAR ARCHIVO PREVIRED TXT
const generarArchivoPrevired = async (req, res) => {
    try {
        const userId = req.userId;
        const { mes, anio } = req.body;
        // Validar
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
        // Obtener liquidaciones del periodo
        const liquidaciones = await prisma_1.default.liquidacion.findMany({
            where: {
                mes,
                anio,
                trabajador: {
                    negocioId: negocio.id,
                    activo: true
                }
            },
            include: {
                trabajador: true
            }
        });
        if (liquidaciones.length === 0) {
            return res.status(404).json({
                error: 'No hay liquidaciones para este periodo'
            });
        }
        // GENERAR ARCHIVO TXT PREVIRED
        // Formato simplificado (actualizar según especificación oficial)
        let contenidoTxt = '';
        // Línea 1: Encabezado
        contenidoTxt += `1|${negocio.rutNegocio || ''}|${mes}|${anio}|\n`;
        // Líneas 2+: Trabajadores
        liquidaciones.forEach((liq, index) => {
            const linea = [
                '2', // Tipo línea
                liq.trabajador.rut,
                liq.trabajador.nombre,
                liq.trabajador.apellidoPaterno,
                liq.trabajador.apellidoMaterno,
                liq.totalHaberes,
                liq.afp,
                liq.salud,
                liq.cesantia,
                liq.impuestoUnico
            ].join('|');
            contenidoTxt += linea + '\n';
        });
        // Última línea: Totales
        const totalHaberes = liquidaciones.reduce((sum, l) => sum + l.totalHaberes, 0);
        const totalAFP = liquidaciones.reduce((sum, l) => sum + l.afp, 0);
        const totalSalud = liquidaciones.reduce((sum, l) => sum + l.salud, 0);
        contenidoTxt += `3|${liquidaciones.length}|${totalHaberes}|${totalAFP}|${totalSalud}|\n`;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="previred_${mes}_${anio}.txt"`);
        res.send(contenidoTxt);
    }
    catch (error) {
        console.error('Error en generarArchivoPrevired:', error);
        res.status(500).json({
            error: 'Error al generar archivo Previred'
        });
    }
};
exports.generarArchivoPrevired = generarArchivoPrevired;
// MARCAR LIQUIDACIÓN COMO PAGADA
const marcarComoPagada = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const { fechaPago } = req.body;
        // Verificar liquidación
        const liquidacion = await prisma_1.default.liquidacion.findUnique({
            where: { id },
            include: {
                trabajador: {
                    include: {
                        negocio: true
                    }
                }
            }
        });
        if (!liquidacion) {
            return res.status(404).json({
                error: 'Liquidación no encontrada'
            });
        }
        if (liquidacion.trabajador.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Marcar como pagada
        const liquidacionActualizada = await prisma_1.default.liquidacion.update({
            where: { id },
            data: {
                pagado: true,
                fechaPago: fechaPago ? new Date(fechaPago) : new Date()
            }
        });
        res.json({
            message: 'Liquidación marcada como pagada',
            liquidacion: liquidacionActualizada
        });
    }
    catch (error) {
        console.error('Error en marcarComoPagada:', error);
        res.status(500).json({
            error: 'Error al marcar liquidación como pagada'
        });
    }
};
exports.marcarComoPagada = marcarComoPagada;
