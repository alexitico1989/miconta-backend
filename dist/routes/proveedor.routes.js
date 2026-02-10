"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const proveedor_controller_1 = require("../controllers/proveedor.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/proveedores - Listar proveedores
router.get('/', proveedor_controller_1.getProveedores);
// GET /api/proveedores/proximas-visitas - Próximas visitas
router.get('/proximas-visitas', proveedor_controller_1.getProximasVisitas);
// POST /api/proveedores - Crear proveedor
router.post('/', proveedor_controller_1.createProveedor);
// PUT /api/proveedores/:id - Actualizar proveedor
router.put('/:id', proveedor_controller_1.updateProveedor);
// POST /api/proveedores/:id/registrar-visita - Registrar visita
router.post('/:id/registrar-visita', proveedor_controller_1.registrarVisita);
// POST /api/proveedores/:id/pedido-sugerido - Generar pedido sugerido
router.post('/:id/pedido-sugerido', proveedor_controller_1.generarPedidoSugerido);
// DELETE /api/proveedores/:id - Eliminar proveedor (soft delete)
router.delete('/:id', proveedor_controller_1.deleteProveedor);
exports.default = router;
