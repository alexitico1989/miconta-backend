"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const producto_controller_1 = require("../controllers/producto.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/productos - Listar productos
router.get('/', producto_controller_1.getProductos);
// GET /api/productos/stock-bajo - Productos con stock bajo
router.get('/stock-bajo', producto_controller_1.getProductosStockBajo);
// POST /api/productos - Crear producto
router.post('/', producto_controller_1.createProducto);
// PUT /api/productos/:id - Actualizar producto
router.put('/:id', producto_controller_1.updateProducto);
// PUT /api/productos/:id/stock - Actualizar stock
router.put('/:id/stock', producto_controller_1.updateStock);
// DELETE /api/productos/:id - Eliminar producto (soft delete)
router.delete('/:id', producto_controller_1.deleteProducto);
exports.default = router;
