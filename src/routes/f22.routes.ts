import { Router } from 'express';
import {
  getF22,
  listarF22,
  marcarPresentadoF22,
  validarF22
} from '../controllers/f22.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/f22 - Listar todas las declaraciones F22
router.get('/', listarF22);

// GET /api/f22/:anio/validar - Validar si puede generar F22
router.get('/:anio/validar', validarF22);

// GET /api/f22/:anio - Obtener/calcular F22 específico
router.get('/:anio', getF22);

// PUT /api/f22/:id/presentado - Marcar como presentado
router.put('/:id/presentado', marcarPresentadoF22);

export default router;