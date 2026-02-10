"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNegocio = exports.getNegocio = exports.createNegocio = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const rutValidator_1 = require("../utils/rutValidator");
// CREAR NEGOCIO
const createNegocio = async (req, res) => {
    try {
        const userId = req.userId;
        const { nombreNegocio, rutNegocio, tipo, direccion, comuna, telefono, ventasMensualesAprox, regimenTributario } = req.body;
        // Validar campos requeridos
        if (!nombreNegocio) {
            return res.status(400).json({
                error: 'Nombre del negocio es requerido'
            });
        }
        // Validar RUT del negocio si existe
        if (rutNegocio && !(0, rutValidator_1.validarRut)(rutNegocio)) {
            return res.status(400).json({
                error: 'RUT del negocio inválido'
            });
        }
        // Validar ventas mensuales
        if (ventasMensualesAprox !== undefined && ventasMensualesAprox < 0) {
            return res.status(400).json({
                error: 'Ventas mensuales no puede ser negativo'
            });
        }
        // Verificar que el usuario no tenga ya un negocio
        const negocioExistente = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (negocioExistente) {
            return res.status(400).json({
                error: 'Ya tienes un negocio registrado'
            });
        }
        // Crear negocio
        const negocio = await prisma_1.default.negocio.create({
            data: {
                usuarioId: userId,
                nombreNegocio,
                rutNegocio,
                tipo: tipo || 'otro',
                direccion,
                comuna,
                ventasMensualesAprox,
                regimenTributario: regimenTributario || 'pro_pyme'
            }
        });
        res.status(201).json({
            message: 'Negocio creado exitosamente',
            negocio
        });
    }
    catch (error) {
        console.error('Error en createNegocio:', error);
        res.status(500).json({
            error: 'Error al crear negocio',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.createNegocio = createNegocio;
// OBTENER NEGOCIO
const getNegocio = async (req, res) => {
    try {
        const userId = req.userId;
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        res.json({ negocio });
    }
    catch (error) {
        console.error('Error en getNegocio:', error);
        res.status(500).json({
            error: 'Error al obtener negocio',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.getNegocio = getNegocio;
// ACTUALIZAR NEGOCIO
const updateNegocio = async (req, res) => {
    try {
        const userId = req.userId;
        const { nombreNegocio, rutNegocio, tipo, direccion, comuna, telefono, ventasMensualesAprox, regimenTributario } = req.body;
        // Validar RUT del negocio si se actualiza
        if (rutNegocio && !(0, rutValidator_1.validarRut)(rutNegocio)) {
            return res.status(400).json({
                error: 'RUT del negocio inválido'
            });
        }
        // Validar ventas mensuales
        if (ventasMensualesAprox !== undefined && ventasMensualesAprox < 0) {
            return res.status(400).json({
                error: 'Ventas mensuales no puede ser negativo'
            });
        }
        // Verificar que el negocio exista
        const negocioExistente = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocioExistente) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Actualizar negocio
        const negocio = await prisma_1.default.negocio.update({
            where: { usuarioId: userId },
            data: {
                nombreNegocio,
                rutNegocio,
                tipo,
                direccion,
                comuna,
                ventasMensualesAprox,
                regimenTributario
            }
        });
        res.json({
            message: 'Negocio actualizado exitosamente',
            negocio
        });
    }
    catch (error) {
        console.error('Error en updateNegocio:', error);
        res.status(500).json({
            error: 'Error al actualizar negocio',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.updateNegocio = updateNegocio;
