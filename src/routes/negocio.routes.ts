import { Router } from 'express';
import { createNegocio, getNegocio, updateNegocio } from '../controllers/negocio.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/negocio - Obtener negocio del usuario
router.get('/', getNegocio);

// POST /api/negocio - Crear negocio
router.post('/', createNegocio);

// PUT /api/negocio - Actualizar negocio
router.put('/', updateNegocio);

export default router;