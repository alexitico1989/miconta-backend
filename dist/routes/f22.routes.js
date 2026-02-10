"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const f22_controller_1 = require("../controllers/f22.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/f22 - Listar todas las declaraciones F22
router.get('/', f22_controller_1.listarF22);
// GET /api/f22/:anio/validar - Validar si puede generar F22
router.get('/:anio/validar', f22_controller_1.validarF22);
// GET /api/f22/:anio - Obtener/calcular F22 específico
router.get('/:anio', f22_controller_1.getF22);
// PUT /api/f22/:id/presentado - Marcar como presentado
router.put('/:id/presentado', f22_controller_1.marcarPresentadoF22);
exports.default = router;
