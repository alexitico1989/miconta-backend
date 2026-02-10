import { Router } from 'express';
import {
  generarLiquidacion,
  getLiquidaciones,
  generarArchivoPrevired,
  marcarComoPagada
} from '../controllers/liquidacion.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/liquidaciones - Listar liquidaciones
router.get('/', getLiquidaciones);

// POST /api/liquidaciones - Generar liquidación
router.post('/', generarLiquidacion);

// POST /api/liquidaciones/previred - Generar archivo Previred TXT
router.post('/previred', generarArchivoPrevired);

// PUT /api/liquidaciones/:id/pagada - Marcar como pagada
router.put('/:id/pagada', marcarComoPagada);

export default router;