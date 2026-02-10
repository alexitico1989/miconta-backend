"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlerta = exports.deleteAlerta = exports.marcarComoResuelta = exports.marcarComoLeida = exports.getAlertas = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// OBTENER ALERTAS
const getAlertas = async (req, res) => {
    try {
        const userId = req.userId;
        const { leida, prioridad, limit, offset } = req.query;
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
        if (leida !== undefined) {
            where.leida = leida === 'true';
        }
        if (prioridad) {
            where.prioridad = prioridad;
        }
        // Paginación
        const take = limit ? parseInt(limit) : 50;
        const skip = offset ? parseInt(offset) : 0;
        // Obtener alertas
        const [alertas, total] = await Promise.all([
            prisma_1.default.alerta.findMany({
                where,
                orderBy: [
                    { prioridad: 'desc' },
                    { createdAt: 'desc' }
                ],
                take,
                skip
            }),
            prisma_1.default.alerta.count({ where })
        ]);
        // Contar alertas no leídas
        const noLeidas = await prisma_1.default.alerta.count({
            where: {
                negocioId: negocio.id,
                leida: false
            }
        });
        res.json({
            alertas,
            paginacion: {
                total,
                limit: take,
                offset: skip,
                hasMore: skip + alertas.length < total
            },
            noLeidas
        });
    }
    catch (error) {
        console.error('Error en getAlertas:', error);
        res.status(500).json({
            error: 'Error al obtener alertas',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.getAlertas = getAlertas;
// MARCAR ALERTA COMO LEÍDA
const marcarComoLeida = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar alerta
        const alerta = await prisma_1.default.alerta.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!alerta) {
            return res.status(404).json({
                error: 'Alerta no encontrada'
            });
        }
        if (alerta.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Marcar como leída
        const alertaActualizada = await prisma_1.default.alerta.update({
            where: { id },
            data: {
                leida: true
            }
        });
        res.json({
            message: 'Alerta marcada como leída',
            alerta: alertaActualizada
        });
    }
    catch (error) {
        console.error('Error en marcarComoLeida:', error);
        res.status(500).json({
            error: 'Error al marcar alerta como leída',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.marcarComoLeida = marcarComoLeida;
// MARCAR ALERTA COMO RESUELTA
const marcarComoResuelta = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar alerta
        const alerta = await prisma_1.default.alerta.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!alerta) {
            return res.status(404).json({
                error: 'Alerta no encontrada'
            });
        }
        if (alerta.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Marcar como resuelta
        const alertaActualizada = await prisma_1.default.alerta.update({
            where: { id },
            data: {
                resuelta: true,
                leida: true
            }
        });
        res.json({
            message: 'Alerta marcada como resuelta',
            alerta: alertaActualizada
        });
    }
    catch (error) {
        console.error('Error en marcarComoResuelta:', error);
        res.status(500).json({
            error: 'Error al marcar alerta como resuelta',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.marcarComoResuelta = marcarComoResuelta;
// ELIMINAR ALERTA
const deleteAlerta = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar alerta
        const alerta = await prisma_1.default.alerta.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!alerta) {
            return res.status(404).json({
                error: 'Alerta no encontrada'
            });
        }
        if (alerta.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Eliminar
        await prisma_1.default.alerta.delete({
            where: { id }
        });
        res.json({
            message: 'Alerta eliminada exitosamente'
        });
    }
    catch (error) {
        console.error('Error en deleteAlerta:', error);
        res.status(500).json({
            error: 'Error al eliminar alerta',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.deleteAlerta = deleteAlerta;
// CREAR ALERTA MANUALMENTE (para testing o admin)
const createAlerta = async (req, res) => {
    try {
        const userId = req.userId;
        const { tipo, titulo, mensaje, prioridad, metadata } = req.body;
        // Validar
        if (!tipo || !titulo || !mensaje) {
            return res.status(400).json({
                error: 'Tipo, título y mensaje son requeridos'
            });
        }
        // Validar prioridad
        const prioridadesValidas = ['baja', 'media', 'alta', 'urgente'];
        if (prioridad && !prioridadesValidas.includes(prioridad)) {
            return res.status(400).json({
                error: 'Prioridad debe ser: baja, media, alta o urgente'
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
        // Crear alerta
        const alerta = await prisma_1.default.alerta.create({
            data: {
                negocioId: negocio.id,
                tipo,
                titulo,
                mensaje,
                prioridad: prioridad || 'media',
                metadata: metadata || null
            }
        });
        res.status(201).json({
            message: 'Alerta creada exitosamente',
            alerta
        });
    }
    catch (error) {
        console.error('Error en createAlerta:', error);
        res.status(500).json({
            error: 'Error al crear alerta',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.createAlerta = createAlerta;
