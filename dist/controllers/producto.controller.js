"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductosStockBajo = exports.deleteProducto = exports.updateStock = exports.updateProducto = exports.createProducto = exports.getProductos = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// LISTAR PRODUCTOS
const getProductos = async (req, res) => {
    try {
        const userId = req.userId;
        // Obtener negocio del usuario
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Obtener productos
        const productos = await prisma_1.default.producto.findMany({
            where: {
                negocioId: negocio.id,
                activo: true
            },
            orderBy: {
                nombre: 'asc'
            }
        });
        res.json({
            productos,
            total: productos.length
        });
    }
    catch (error) {
        console.error('Error en getProductos:', error);
        res.status(500).json({
            error: 'Error al obtener productos'
        });
    }
};
exports.getProductos = getProductos;
// CREAR PRODUCTO
const createProducto = async (req, res) => {
    try {
        const userId = req.userId;
        const { nombre, codigo, categoria, stockActual, stockMinimo, unidadMedida, precioCompra, precioVenta, fotoUrl, notas } = req.body;
        // Validar campos requeridos
        if (!nombre) {
            return res.status(400).json({
                error: 'Nombre es requerido'
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
        // Crear producto
        const producto = await prisma_1.default.producto.create({
            data: {
                negocioId: negocio.id,
                nombre,
                codigo,
                categoria,
                stockActual: stockActual || 0,
                stockMinimo: stockMinimo || 5,
                unidadMedida: unidadMedida || 'unidad',
                precioCompra,
                precioVenta,
                fotoUrl,
                notas
            }
        });
        // Crear movimiento inicial si hay stock
        if (stockActual && stockActual > 0) {
            await prisma_1.default.movimientoStock.create({
                data: {
                    productoId: producto.id,
                    tipo: 'entrada',
                    cantidad: stockActual,
                    motivo: 'Inventario inicial',
                    stockAnterior: 0,
                    stockNuevo: stockActual
                }
            });
        }
        res.status(201).json({
            message: 'Producto creado exitosamente',
            producto
        });
    }
    catch (error) {
        console.error('Error en createProducto:', error);
        res.status(500).json({
            error: 'Error al crear producto'
        });
    }
};
exports.createProducto = createProducto;
// ACTUALIZAR PRODUCTO
const updateProducto = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const { nombre, codigo, categoria, stockMinimo, unidadMedida, precioCompra, precioVenta, fotoUrl, notas } = req.body;
        // Verificar que el producto pertenezca al usuario
        const producto = await prisma_1.default.producto.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        if (producto.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso para editar este producto'
            });
        }
        // Actualizar
        const productoActualizado = await prisma_1.default.producto.update({
            where: { id },
            data: {
                nombre,
                codigo,
                categoria,
                stockMinimo,
                unidadMedida,
                precioCompra,
                precioVenta,
                fotoUrl,
                notas
            }
        });
        res.json({
            message: 'Producto actualizado exitosamente',
            producto: productoActualizado
        });
    }
    catch (error) {
        console.error('Error en updateProducto:', error);
        res.status(500).json({
            error: 'Error al actualizar producto'
        });
    }
};
exports.updateProducto = updateProducto;
// ACTUALIZAR STOCK
const updateStock = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const cantidad = parseInt(req.body.cantidad);
        const tipo = req.body.tipo;
        const motivo = req.body.motivo;
        // Validar
        if (!cantidad || !tipo) {
            return res.status(400).json({
                error: 'Cantidad y tipo son requeridos'
            });
        }
        if (tipo !== 'entrada' && tipo !== 'salida' && tipo !== 'ajuste') {
            return res.status(400).json({
                error: 'Tipo debe ser: entrada, salida o ajuste'
            });
        }
        // Verificar producto
        const producto = await prisma_1.default.producto.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        if (producto.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Calcular nuevo stock
        let stockNuevo = producto.stockActual;
        if (tipo === 'entrada') {
            stockNuevo += cantidad;
        }
        else if (tipo === 'salida') {
            stockNuevo -= cantidad;
        }
        else if (tipo === 'ajuste') {
            stockNuevo = cantidad; // Ajuste absoluto
        }
        // Validar que no quede negativo
        if (stockNuevo < 0) {
            return res.status(400).json({
                error: 'Stock no puede ser negativo'
            });
        }
        // Actualizar producto
        const productoActualizado = await prisma_1.default.producto.update({
            where: { id },
            data: {
                stockActual: stockNuevo
            }
        });
        // Registrar movimiento
        await prisma_1.default.movimientoStock.create({
            data: {
                productoId: id,
                tipo,
                cantidad,
                motivo: motivo || tipo,
                stockAnterior: producto.stockActual,
                stockNuevo
            }
        });
        // Crear alerta si está bajo stock mínimo
        if (stockNuevo <= producto.stockMinimo) {
            await prisma_1.default.alerta.create({
                data: {
                    negocioId: producto.negocioId,
                    tipo: 'stock_bajo',
                    titulo: 'Stock bajo',
                    mensaje: `${producto.nombre} tiene stock bajo (${stockNuevo} ${producto.unidadMedida})`,
                    prioridad: 'alta',
                    metadata: {
                        productoId: id,
                        stockActual: stockNuevo,
                        stockMinimo: producto.stockMinimo
                    }
                }
            });
        }
        res.json({
            message: 'Stock actualizado exitosamente',
            producto: productoActualizado
        });
    }
    catch (error) {
        console.error('Error en updateStock:', error);
        res.status(500).json({
            error: 'Error al actualizar stock'
        });
    }
};
exports.updateStock = updateStock;
// ELIMINAR PRODUCTO (soft delete)
const deleteProducto = async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        // Verificar producto
        const producto = await prisma_1.default.producto.findUnique({
            where: { id },
            include: {
                negocio: true
            }
        });
        if (!producto) {
            return res.status(404).json({
                error: 'Producto no encontrado'
            });
        }
        if (producto.negocio.usuarioId !== userId) {
            return res.status(403).json({
                error: 'No tienes permiso'
            });
        }
        // Soft delete
        await prisma_1.default.producto.update({
            where: { id },
            data: {
                activo: false
            }
        });
        res.json({
            message: 'Producto eliminado exitosamente'
        });
    }
    catch (error) {
        console.error('Error en deleteProducto:', error);
        res.status(500).json({
            error: 'Error al eliminar producto'
        });
    }
};
exports.deleteProducto = deleteProducto;
// OBTENER PRODUCTOS CON STOCK BAJO
const getProductosStockBajo = async (req, res) => {
    try {
        const userId = req.userId;
        // Obtener negocio
        const negocio = await prisma_1.default.negocio.findUnique({
            where: { usuarioId: userId }
        });
        if (!negocio) {
            return res.status(404).json({
                error: 'Negocio no encontrado'
            });
        }
        // Obtener productos con stock bajo
        const productos = await prisma_1.default.producto.findMany({
            where: {
                negocioId: negocio.id,
                activo: true,
                stockActual: {
                    lte: prisma_1.default.producto.fields.stockMinimo
                }
            },
            orderBy: {
                stockActual: 'asc'
            }
        });
        res.json({
            productos,
            total: productos.length
        });
    }
    catch (error) {
        console.error('Error en getProductosStockBajo:', error);
        res.status(500).json({
            error: 'Error al obtener productos'
        });
    }
};
exports.getProductosStockBajo = getProductosStockBajo;
