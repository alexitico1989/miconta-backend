import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { checkSubscription } from '../middleware/subscriptionCheck';
import { crearSuscripcion, webhookMercadoPago, getEstadoSuscripcion } from '../controllers/pagoController';

const router = Router();

// Protegidas - aplicar checkSubscription para verificar estado
router.post('/crear-suscripcion', authenticateToken, checkSubscription, crearSuscripcion);
router.get('/estado', authenticateToken, getEstadoSuscripcion);

// Pública (webhook MP)
router.post('/webhook', webhookMercadoPago);

export default router;