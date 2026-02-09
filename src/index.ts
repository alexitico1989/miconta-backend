import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import prisma from './utils/prisma';

// Importar rutas
import authRoutes from './routes/auth.routes';

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
    version: '1.0.0',
    timestamp: new Date().toISOString()
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:3000`);
});