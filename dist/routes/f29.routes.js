"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const f29_controller_1 = require("../controllers/f29.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/f29 - Listar todas las declaraciones F29
router.get('/', f29_controller_1.listarF29);
// GET /api/f29/:mes/:anio - Obtener/calcular F29 específico
router.get('/:mes/:anio', f29_controller_1.getF29);
// PUT /api/f29/:id - Actualizar F29 manualmente
router.put('/:id', f29_controller_1.updateF29);
// PUT /api/f29/:id/presentado - Marcar como presentado
router.put('/:id/presentado', f29_controller_1.marcarPresentado);
exports.default = router;
