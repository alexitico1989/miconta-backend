import { Router } from 'express';
import {
  getF29,
  listarF29,
  marcarPresentado,
  updateF29
} from '../controllers/f29.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/f29 - Listar todas las declaraciones F29
router.get('/', listarF29);

// GET /api/f29/:mes/:anio - Obtener/calcular F29 específico
router.get('/:mes/:anio', getF29);

// PUT /api/f29/:id - Actualizar F29 manualmente
router.put('/:id', updateF29);

// PUT /api/f29/:id/presentado - Marcar como presentado
router.put('/:id/presentado', marcarPresentado);

export default router;