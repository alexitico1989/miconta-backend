import { Router } from 'express';
import {
  createTransaccion,
  getTransacciones,
  getResumenMensual,
  deleteTransaccion,
  registrarNotaCompra,
  registrarNotaCreditoInterna,
  registrarNotaDebitoInterna
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

// POST /api/transacciones/nota-credito-interna - Registrar NC de venta (interno)
router.post('/nota-credito-interna', registrarNotaCreditoInterna);

// POST /api/transacciones/nota-debito-interna - Registrar ND de venta (interno)
router.post('/nota-debito-interna', registrarNotaDebitoInterna);

// DELETE /api/transacciones/:id - Eliminar transacción
router.delete('/:id', deleteTransaccion);

export default router;