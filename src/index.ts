import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import prisma from './utils/prisma';

// Importar rutas
import authRoutes from './routes/auth.routes';
import negocioRoutes from './routes/negocio.routes';
import transaccionRoutes from './routes/transaccion.routes';
import productoRoutes from './routes/producto.routes';
import proveedorRoutes from './routes/proveedor.routes';
import trabajadorRoutes from './routes/trabajador.routes';
import liquidacionRoutes from './routes/liquidacion.routes';
import f29Routes from './routes/f29.routes';
import f22Routes from './routes/f22.routes';
import alertaRoutes from './routes/alerta.routes';
import dashboardRoutes from './routes/dashboard.routes';

dotenv.config();

const app: Express = express(); 
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Headers CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Ruta de prueba
app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'MiConta API funcionando ✅',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      negocio: '/api/negocio',
      transacciones: '/api/transacciones',
      productos: '/api/productos',
      proveedores: '/api/proveedores',
      trabajadores: '/api/trabajadores',
      liquidaciones: '/api/liquidaciones',
      f29: '/api/f29',
      f22: '/api/f22',
      alertas: '/api/alertas',
      dashboard: '/api/dashboard'
    }
  });
});

// Ruta test DB
app.get('/test-db', async (req: Request, res: Response) => {
  try {
    const count = await prisma.usuario.count();
    res.json({
      message: 'Conexión a base de datos exitosa ✅',
      usuarios: count,
      database: 'Railway PostgreSQL'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error conectando a base de datos ❌',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// RUTAS API
app.use('/api/auth', authRoutes);
app.use('/api/negocio', negocioRoutes);
app.use('/api/transacciones', transaccionRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/trabajadores', trabajadorRoutes);
app.use('/api/liquidaciones', liquidacionRoutes);
app.use('/api/f29', f29Routes);
app.use('/api/f22', f22Routes);
app.use('/api/alertas', alertaRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});