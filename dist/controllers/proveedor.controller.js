"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarPedidoSugerido = exports.getProximasVisitas = exports.deleteProveedor = exports.registrarVisita = exports.updateProveedor = exports.createProveedor = exports.getProveedores = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const rutValidator_1 = require("../utils/rutValidator");
const validators_1 = require("../utils/validators");
// LISTAR PROVEEDORES
const getProveedores = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit, offset } = req.query;
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Paginación
        const take = limit ? parseInt(limit) : 50;
        const skip = offset ? parseInt(offset) : 0;
        // Obtener proveedores
        const [proveedores, total] = await Promise.all([
            prisma_1.default.proveedor.findMany({
                where: {
                    negocioId: negocio.id,
                    activo: true
                },
                orderBy: {
                    nombre: 'asc'
                },
                take,
                skip
            }),
            prisma_1.default.proveedor.count({
                where: {
                    negocioId: negocio.id,
                    activo: true
                }
            })
        ]);
        res.json({
            proveedores,
            paginacion: {
                total,
                limit: take,
                offset: skip,
                hasMore: skip + proveedores.length < total
            }
        });
    }
    catch (error) {
        console.error('Error en getProveedores:', error);
        res.status(500).json({
            error: 'Error al obtener proveedores',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.getProveedores = getProveedores;
// CREAR PROVEEDOR
const createProveedor = async (req, res) => {
    try {
        const userId = req.userId;
        const { nombre, rut, contacto, telefono, email, frecuenciaVisita, diaVisita, categoria, notas } = req.body;
        // Validar
        if (!nombre) {
            return res.status(400).json({
                error: 'Nombre es requerido'
            });
        }
        // Validar RUT si existe
        if (rut && !(0, rutValidator_1.validarRut)(rut)) {
            return res.status(400).json({
                error: 'RUT inválido'
            });
        }
        // Validar email si existe
        if (email) {
            const validacionEmail = (0, validators_1.validarEmail)(email);
            if (!validacionEmail.valido) {
                return res.status(400).json({
                    error: validacionEmail.error
                });
            }
        }
        // Validar teléfono si existe
        if (telefono) {
            const validacionTelefono = (0, validators_1.validarTelefono)(telefono);
            if (!validacionTelefono.valido) {
                return res.status(400).json({
                    error: validacionTelefono.error
                });
            }
        }
        // Validar frecuencia de visita
        if (frecuenciaVisita !== undefined && frecuenciaVisita < 1) {
            return res.status(400).json({
                error: 'La frecuencia de visita debe ser mayor a 0 días'
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
        // Calcular próxima visita si hay frecuencia
        let proximaVisita = null;
        if (frecuenciaVisita) {
            proximaVisita = new Date();
            proximaVisita.setDate(proximaVisita.getDate() + frecuenciaVisita);
        }
        // Crear proveedor
        const proveedor = await prisma_1.default.proveedor.create({
            data: {
                negocioId: negocio.id,
                nombre,
                rut,
                contacto,
                telefono,
                email,
                frecuenciaVisita,
                proximaVisita,
                diaVisita,
                categoria,
                notas
            }
        });
        res.status(201).json({
            message: 'Proveedor creado exitosamente',
            proveedor
        });
    }
    catch (error) {
        console.error('Error en createProveedor:', error);
        res.status(500).json({
            error: 'Error al crear proveedor',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.createProveedor = createProveedor;
// ACTUALIZAR PROVEEDOR
const updateProveedor = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const { nombre, rut, contacto, telefono, email, frecuenciaVisita, diaVisita, categoria, notas } = req.body;
        // Validar RUT si existe
        if (rut && !(0, rutValidator_1.validarRut)(rut)) {
            return res.status(400).json({
                error: 'RUT inválido'
            });
        }
        // Validar email si existe
        if (email) {
            const validacionEmail = (0, validators_1.validarEmail)(email);
            if (!validacionEmail.valido) {
                return res.status(400).json({
                    error: validacionEmail.error
                });
            }
        }
        // Validar teléfono si existe
        if (telefono) {
            const validacionTelefono = (0, validators_1.validarTelefono)(telefono);
            if (!validacionTelefono.valido) {
                return res.status(400).json({
                    error: validacionTelefono.error
                });
            }
        }
        // Validar frecuencia de visita
        if (frecuenciaVisita !== undefined && frecuenciaVisita < 1) {
            return res.status(400).json({
                error: 'La frecuencia de visita debe ser mayor a 0 días'
            });
        }
        // Verificar proveedor
        const proveedor = await prisma_1.default.proveedor.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!proveedor) {
            return res.status(404).json({
                error: 'Proveedor no encontrado'
            });
        }
        if (proveedor.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Actualizar
        const proveedorActualizado = await prisma_1.default.proveedor.update({
            where: { id },
            data: {
                nombre,
                rut,
                contacto,
                telefono,
                email,
                frecuenciaVisita,
                diaVisita,
                categoria,
                notas
            }
        });
        res.json({
            message: 'Proveedor actualizado exitosamente',
            proveedor: proveedorActualizado
        });
    }
    catch (error) {
        console.error('Error en updateProveedor:', error);
        res.status(500).json({
            error: 'Error al actualizar proveedor',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.updateProveedor = updateProveedor;
// REGISTRAR VISITA
const registrarVisita = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar proveedor
        const proveedor = await prisma_1.default.proveedor.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!proveedor) {
            return res.status(404).json({
                error: 'Proveedor no encontrado'
            });
        }
        if (proveedor.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Calcular próxima visita
        const hoy = new Date();
        let proximaVisita = null;
        if (proveedor.frecuenciaVisita) {
            proximaVisita = new Date(hoy);
            proximaVisita.setDate(proximaVisita.getDate() + proveedor.frecuenciaVisita);
        }
        // Actualizar
        const proveedorActualizado = await prisma_1.default.proveedor.update({
            where: { id },
            data: {
                ultimaVisita: hoy,
                proximaVisita
            }
        });
        res.json({
            message: 'Visita registrada exitosamente',
            proveedor: proveedorActualizado
        });
    }
    catch (error) {
        console.error('Error en registrarVisita:', error);
        res.status(500).json({
            error: 'Error al registrar visita',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.registrarVisita = registrarVisita;
// ELIMINAR PROVEEDOR (soft delete)
const deleteProveedor = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar proveedor
        const proveedor = await prisma_1.default.proveedor.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!proveedor) {
            return res.status(404).json({
                error: 'Proveedor no encontrado'
            });
        }
        if (proveedor.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Soft delete
        await prisma_1.default.proveedor.update({
            where: { id },
            data: {
                activo: false
            }
        });
        res.json({
            message: 'Proveedor eliminado exitosamente'
        });
    }
    catch (error) {
        console.error('Error en deleteProveedor:', error);
        res.status(500).json({
            error: 'Error al eliminar proveedor',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.deleteProveedor = deleteProveedor;
// OBTENER PRÓXIMAS VISITAS
const getProximasVisitas = async (req, res) => {
    try {
        const userId = req.userId;
        const dias = req.query.dias;
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Calcular fecha límite
        const hoy = new Date();
        const diasAdelante = dias ? parseInt(dias) : 7;
        const fechaLimite = new Date(hoy);
        fechaLimite.setDate(fechaLimite.getDate() + diasAdelante);
        // Obtener proveedores con visitas próximas
        const proveedores = await prisma_1.default.proveedor.findMany({
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
            }
        });
        res.json({
            proveedores,
            total: proveedores.length,
            desde: hoy,
            hasta: fechaLimite
        });
    }
    catch (error) {
        console.error('Error en getProximasVisitas:', error);
        res.status(500).json({
            error: 'Error al obtener próximas visitas',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.getProximasVisitas = getProximasVisitas;
// GENERAR PEDIDO SUGERIDO
const generarPedidoSugerido = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar proveedor
        const proveedor = await prisma_1.default.proveedor.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!proveedor) {
            return res.status(404).json({
                error: 'Proveedor no encontrado'
            });
        }
        if (proveedor.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Obtener productos de esta categoría con stock bajo
        const productos = await prisma_1.default.producto.findMany({
            where: {
                negocioId: proveedor.negocioId,
                activo: true,
                categoria: proveedor.categoria || undefined,
                stockActual: {
                    lte: prisma_1.default.producto.fields.stockMinimo
                }
            }
        });
        // Generar items sugeridos
        const items = productos.map(producto => ({
            productoId: producto.id,
            productoNombre: producto.nombre,
            stockActual: producto.stockActual,
            stockMinimo: producto.stockMinimo,
            cantidadSugerida: Math.max(producto.stockMinimo - producto.stockActual, producto.stockMinimo * 2 // Pedir al menos el doble del mínimo
            )
        }));
        // Crear pedido sugerido
        const pedido = await prisma_1.default.pedido.create({
            data: {
                proveedorId: id,
                items: items,
                estado: 'sugerido'
            }
        });
        res.json({
            message: 'Pedido sugerido generado',
            pedido,
            items
        });
    }
    catch (error) {
        console.error('Error en generarPedidoSugerido:', error);
        res.status(500).json({
            error: 'Error al generar pedido',
            detalle: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};
exports.generarPedidoSugerido = generarPedidoSugerido;
