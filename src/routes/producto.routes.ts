import { Router } from 'express';
import {
  getProductos,
  createProducto,
  updateProducto,
  updateStock,
  deleteProducto,
  getProductosStockBajo
} from '../controllers/producto.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// GET /api/productos - Listar productos
router.get('/', getProductos);

// GET /api/productos/stock-bajo - Productos con stock bajo
router.get('/stock-bajo', getProductosStockBajo);

// POST /api/productos - Crear producto
router.post('/', createProducto);

// PUT /api/productos/:id - Actualizar producto
router.put('/:id', updateProducto);

// PUT /api/productos/:id/stock - Actualizar stock
router.put('/:id/stock', updateStock);

// DELETE /api/productos/:id - Eliminar producto (soft delete)
router.delete('/:id', deleteProducto);

export default router;