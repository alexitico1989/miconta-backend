"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const trabajador_controller_1 = require("../controllers/trabajador.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/trabajadores - Listar trabajadores
router.get('/', trabajador_controller_1.getTrabajadores);
// GET /api/trabajadores/:id - Obtener trabajador por ID
router.get('/:id', trabajador_controller_1.getTrabajadorById);
// POST /api/trabajadores - Crear trabajador
router.post('/', trabajador_controller_1.createTrabajador);
// PUT /api/trabajadores/:id - Actualizar trabajador
router.put('/:id', trabajador_controller_1.updateTrabajador);
// PUT /api/trabajadores/:id/baja - Dar de baja trabajador
router.put('/:id/baja', trabajador_controller_1.darDeBajaTrabajador);
exports.default = router;
