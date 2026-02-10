"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/dashboard - Dashboard principal
router.get('/', dashboard_controller_1.getDashboard);
// GET /api/dashboard/reporte/:mes/:anio - Reporte mensual
router.get('/reporte/:mes/:anio', dashboard_controller_1.getReporteMensual);
exports.default = router;
