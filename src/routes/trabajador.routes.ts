import { Router } from 'express';
import {
  getTrabajadores,
  createTrabajador,
  updateTrabajador,
  darDeBajaTrabajador,
  getTrabajadorById
} from '../controllers/trabajador.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/trabajadores - Listar trabajadores
router.get('/', getTrabajadores);

// GET /api/trabajadores/:id - Obtener trabajador por ID
router.get('/:id', getTrabajadorById);

// POST /api/trabajadores - Crear trabajador
router.post('/', createTrabajador);

// PUT /api/trabajadores/:id - Actualizar trabajador
router.put('/:id', updateTrabajador);

// PUT /api/trabajadores/:id/baja - Dar de baja trabajador
router.put('/:id/baja', darDeBajaTrabajador);

export default router;