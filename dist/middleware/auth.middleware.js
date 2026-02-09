"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            return res.status(401).json({
                error: 'Token no proporcionado'
            });
        }
        // Verificar token
        jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    error: 'Token inválido o expirado'
                });
            }
            // Agregar userId al request
            const payload = decoded;
            req.userId = payload.userId;
            req.userEmail = payload.email;
            next();
        });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Error al verificar token'
        });
    }
};
exports.authenticateToken = authenticateToken;
