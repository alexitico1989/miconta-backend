"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("./utils/prisma"));
// Importar rutas
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const negocio_routes_1 = __importDefault(require("./routes/negocio.routes"));
const transaccion_routes_1 = __importDefault(require("./routes/transaccion.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
// Headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'MiConta API funcionando ✅',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            negocio: '/api/negocio',
            transacciones: '/api/transacciones'
        }
    });
});
// Ruta test DB
app.get('/test-db', async (req, res) => {
    try {
        const count = await prisma_1.default.usuario.count();
        res.json({
            message: 'Conexión a base de datos exitosa ✅',
            usuarios: count,
            database: 'Railway PostgreSQL'
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Error conectando a base de datos ❌',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// RUTAS API
app.use('/api/auth', auth_routes_1.default);
app.use('/api/negocio', negocio_routes_1.default);
app.use('/api/transacciones', transaccion_routes_1.default);
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
