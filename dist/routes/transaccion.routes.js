"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transaccion_controller_1 = require("../controllers/transaccion.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// POST /api/transacciones - Crear transacción
router.post('/', transaccion_controller_1.createTransaccion);
// GET /api/transacciones - Obtener transacciones (con filtros opcionales)
router.get('/', transaccion_controller_1.getTransacciones);
// GET /api/transacciones/resumen - Resumen mensual para F29
router.get('/resumen', transaccion_controller_1.getResumenMensual);
// DELETE /api/transacciones/:id - Eliminar transacción
router.delete('/:id', transaccion_controller_1.deleteTransaccion);
exports.default = router;
