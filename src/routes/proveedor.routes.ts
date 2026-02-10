import { Router } from 'express';
import {
  getProveedores,
  createProveedor,
  updateProveedor,
  registrarVisita,
  deleteProveedor,
  getProximasVisitas,
  generarPedidoSugerido
} from '../controllers/proveedor.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/proveedores - Listar proveedores
router.get('/', getProveedores);

// GET /api/proveedores/proximas-visitas - Próximas visitas
router.get('/proximas-visitas', getProximasVisitas);

// POST /api/proveedores - Crear proveedor
router.post('/', createProveedor);

// PUT /api/proveedores/:id - Actualizar proveedor
router.put('/:id', updateProveedor);

// POST /api/proveedores/:id/registrar-visita - Registrar visita
router.post('/:id/registrar-visita', registrarVisita);

// POST /api/proveedores/:id/pedido-sugerido - Generar pedido sugerido
router.post('/:id/pedido-sugerido', generarPedidoSugerido);

// DELETE /api/proveedores/:id - Eliminar proveedor (soft delete)
router.delete('/:id', deleteProveedor);

export default router;