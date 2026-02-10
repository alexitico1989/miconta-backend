"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const alerta_controller_1 = require("../controllers/alerta.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authenticateToken);
// GET /api/alertas - Listar alertas
router.get('/', alerta_controller_1.getAlertas);
// POST /api/alertas - Crear alerta manualmente
router.post('/', alerta_controller_1.createAlerta);
// PUT /api/alertas/:id/leida - Marcar como leída
router.put('/:id/leida', alerta_controller_1.marcarComoLeida);
// PUT /api/alertas/:id/resuelta - Marcar como resuelta
router.put('/:id/resuelta', alerta_controller_1.marcarComoResuelta);
// DELETE /api/alertas/:id - Eliminar alerta
router.delete('/:id', alerta_controller_1.deleteAlerta);
exports.default = router;
