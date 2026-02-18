import { Router } from 'express';
import {
  createTransaccion,
  getTransacciones,
  getResumenMensual,
  deleteTransaccion,
  registrarNotaCompra
} from '../controllers/transaccion.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// POST /api/transacciones - Crear transacción
router.post('/', createTransaccion);

// GET /api/transacciones - Obtener transacciones (con filtros opcionales)
router.get('/', getTransacciones);

// GET /api/transacciones/resumen - Resumen mensual para F29
router.get('/resumen', getResumenMensual);

// POST /api/transacciones/:id/nota-compra - Registrar NC/ND de compra
router.post('/:id/nota-compra', registrarNotaCompra);

// DELETE /api/transacciones/:id - Eliminar transacción
router.delete('/:id', deleteTransaccion);

export default router;