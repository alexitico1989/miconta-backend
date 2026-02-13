import { Router } from 'express';
import {
  getClientes,
  getClienteByRut,
  createCliente,
  updateCliente,
  deleteCliente
} from '../controllers/cliente.controller';
import { authenticateToken, requireNegocio } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación y negocio
router.use(authenticateToken);
router.use(requireNegocio);

// GET /api/clientes - Listar todos
router.get('/', getClientes);

// GET /api/clientes/rut/:rut - Buscar por RUT
router.get('/rut/:rut', getClienteByRut);

// POST /api/clientes - Crear cliente
router.post('/', createCliente);

// PUT /api/clientes/:id - Actualizar cliente
router.put('/:id', updateCliente);

// DELETE /api/clientes/:id - Eliminar cliente (soft delete)
router.delete('/:id', deleteCliente);

export default router;