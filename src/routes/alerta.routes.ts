import { Router } from 'express';
import {
  getAlertas,
  marcarComoLeida,
  marcarComoResuelta,
  deleteAlerta,
  createAlerta
} from '../controllers/alerta.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/alertas - Listar alertas
router.get('/', getAlertas);

// POST /api/alertas - Crear alerta manualmente
router.post('/', createAlerta);

// PUT /api/alertas/:id/leida - Marcar como leída
router.put('/:id/leida', marcarComoLeida);

// PUT /api/alertas/:id/resuelta - Marcar como resuelta
router.put('/:id/resuelta', marcarComoResuelta);

// DELETE /api/alertas/:id - Eliminar alerta
router.delete('/:id', deleteAlerta);

export default router;