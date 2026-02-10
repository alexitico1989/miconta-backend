import { Router } from 'express';
import {
  getDashboard,
  getReporteMensual
} from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/dashboard - Dashboard principal
router.get('/', getDashboard);

// GET /api/dashboard/reporte/:mes/:anio - Reporte mensual
router.get('/reporte/:mes/:anio', getReporteMensual);

export default router;