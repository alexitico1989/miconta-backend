"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const negocio_controller_1 = require("../controllers/negocio.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/negocio - Obtener negocio del usuario
router.get('/', negocio_controller_1.getNegocio);
// POST /api/negocio - Crear/actualizar negocio
router.post('/', negocio_controller_1.upsertNegocio);
exports.default = router;
