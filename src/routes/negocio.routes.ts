import { Router } from 'express';
import { upsertNegocio, getNegocio } from '../controllers/negocio.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/negocio - Obtener negocio del usuario
router.get('/', getNegocio);

// POST /api/negocio - Crear/actualizar negocio
router.post('/', upsertNegocio);

export default router;