import { Router } from 'express';
import { register, login, updateProfile, getProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { deleteAccount } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/perfil - Obtener perfil (protegido)
router.get('/perfil', authenticateToken, getProfile);

// PUT /api/auth/perfil - Actualizar perfil (protegido)
router.put('/perfil', authenticateToken, updateProfile);

router.delete('/delete-account', authenticateToken, deleteAccount);

export default router;