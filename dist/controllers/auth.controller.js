"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
// REGISTRAR USUARIO
const register = async (req, res) => {
    try {
        const { email, password, nombre, telefono } = req.body;
        // Validar campos requeridos
        if (!email || !password || !nombre) {
            return res.status(400).json({
                error: 'Email, password y nombre son requeridos'
            });
        }
        // Verificar si el usuario ya existe
        const existingUser = await prisma_1.default.usuario.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({
                error: 'El email ya está registrado'
            });
        }
        // Encriptar password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Crear usuario
        const usuario = await prisma_1.default.usuario.create({
            data: {
                email,
                password: hashedPassword,
                nombre,
                telefono: telefono || null,
                plan: 'trial',
                trialHasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
            }
        });
        // Generar JWT
        const token = jsonwebtoken_1.default.sign({ userId: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Responder (sin enviar el password)
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                plan: usuario.plan,
                trialHasta: usuario.trialHasta
            }
        });
    }
    catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({
            error: 'Error al registrar usuario'
        });
    }
};
exports.register = register;
// LOGIN USUARIO
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validar campos
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email y password son requeridos'
            });
        }
        // Buscar usuario
        const usuario = await prisma_1.default.usuario.findUnique({
            where: { email }
        });
        if (!usuario) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }
        // Verificar password
        const passwordValid = await bcryptjs_1.default.compare(password, usuario.password);
        if (!passwordValid) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }
        // Generar JWT
        const token = jsonwebtoken_1.default.sign({ userId: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        // Responder
        res.json({
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                plan: usuario.plan,
                trialHasta: usuario.trialHasta
            }
        });
    }
    catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            error: 'Error al iniciar sesión'
        });
    }
};
exports.login = login;
