"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const liquidacion_controller_1 = require("../controllers/liquidacion.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/liquidaciones - Listar liquidaciones
router.get('/', liquidacion_controller_1.getLiquidaciones);
// POST /api/liquidaciones - Generar liquidación
router.post('/', liquidacion_controller_1.generarLiquidacion);
// POST /api/liquidaciones/previred - Generar archivo Previred TXT
router.post('/previred', liquidacion_controller_1.generarArchivoPrevired);
// PUT /api/liquidaciones/:id/pagada - Marcar como pagada
router.put('/:id/pagada', liquidacion_controller_1.marcarComoPagada);
exports.default = router;
