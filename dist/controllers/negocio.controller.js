"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNegocio = exports.upsertNegocio = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// CREAR/ACTUALIZAR NEGOCIO
const upsertNegocio = async (req, res) => {
    try {
        const userId = req.userId;
        const { nombreNegocio, rutNegocio, tipo, direccion, comuna, region, ventasMensualesAprox } = req.body;
        // Validar campos requeridos
        if (!nombreNegocio || !tipo) {
            return res.status(400).json({
                error: 'Nombre de negocio y tipo son requeridos'
            });
        }
        // Crear o actualizar negocio
        const negocio = await prisma_1.default.negocio.upsert({
            where: { usuarioId: userId },
            update: {
                nombreNegocio,
                rutNegocio,
                tipo,
                direccion,
                comuna,
                region,
                ventasMensualesAprox
            },
            create: {
                usuarioId: userId,
                nombreNegocio,
                rutNegocio,
                tipo,
                direccion,
                comuna,
                region,
                ventasMensualesAprox
            }
        });
        res.json({
            message: 'Negocio guardado exitosamente',
            negocio
        });
    }
    catch (error) {
        console.error('Error en upsertNegocio:', error);
        res.status(500).json({
            error: 'Error al guardar negocio'
        });
    }
};
exports.upsertNegocio = upsertNegocio;
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
            error: 'Error al obtener negocio'
        });
    }
};
exports.getNegocio = getNegocio;
