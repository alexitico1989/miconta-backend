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
const producto_routes_1 = __importDefault(require("./routes/producto.routes"));
const proveedor_routes_1 = __importDefault(require("./routes/proveedor.routes"));
const trabajador_routes_1 = __importDefault(require("./routes/trabajador.routes"));
const liquidacion_routes_1 = __importDefault(require("./routes/liquidacion.routes"));
const f29_routes_1 = __importDefault(require("./routes/f29.routes"));
const f22_routes_1 = __importDefault(require("./routes/f22.routes"));
const alerta_routes_1 = __importDefault(require("./routes/alerta.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
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
app.use('/api/productos', producto_routes_1.default);
app.use('/api/proveedores', proveedor_routes_1.default);
app.use('/api/trabajadores', trabajador_routes_1.default);
app.use('/api/liquidaciones', liquidacion_routes_1.default);
app.use('/api/f29', f29_routes_1.default);
app.use('/api/f22', f22_routes_1.default);
app.use('/api/alertas', alerta_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
