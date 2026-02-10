"use strict";
// Validaciones generales
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarMonto = validarMonto;
exports.validarStock = validarStock;
exports.validarPorcentaje = validarPorcentaje;
exports.validarEmail = validarEmail;
exports.validarTelefono = validarTelefono;
exports.validarMes = validarMes;
exports.validarAnio = validarAnio;
// Validar que un monto sea positivo y razonable
function validarMonto(monto) {
    if (typeof monto !== 'number' || isNaN(monto)) {
        return { valido: false, error: 'El monto debe ser un número válido' };
    }
    if (monto < 0) {
        return { valido: false, error: 'El monto no puede ser negativo' };
    }
    if (monto === 0) {
        return { valido: false, error: 'El monto debe ser mayor a 0' };
    }
    // Límite razonable: 1 billón de pesos (para evitar errores de tipeo)
    if (monto > 1000000000000) {
        return { valido: false, error: 'El monto excede el límite permitido' };
    }
    return { valido: true };
}
// Validar stock
function validarStock(stock) {
    if (typeof stock !== 'number' || isNaN(stock)) {
        return { valido: false, error: 'El stock debe ser un número válido' };
    }
    if (stock < 0) {
        return { valido: false, error: 'El stock no puede ser negativo' };
    }
    // Límite razonable para stock
    if (stock > 1000000) {
        return { valido: false, error: 'El stock excede el límite permitido' };
    }
    return { valido: true };
}
// Validar porcentaje (0-100)
function validarPorcentaje(porcentaje) {
    if (typeof porcentaje !== 'number' || isNaN(porcentaje)) {
        return { valido: false, error: 'El porcentaje debe ser un número válido' };
    }
    if (porcentaje < 0 || porcentaje > 100) {
        return { valido: false, error: 'El porcentaje debe estar entre 0 y 100' };
    }
    return { valido: true };
}
// Validar email
function validarEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valido: false, error: 'Email inválido' };
    }
    return { valido: true };
}
// Validar teléfono chileno (9 dígitos, empieza con 9)
function validarTelefono(telefono) {
    const telefonoLimpio = telefono.replace(/\s/g, '').replace(/\+56/g, '');
    if (!/^9\d{8}$/.test(telefonoLimpio)) {
        return { valido: false, error: 'Teléfono inválido (debe ser 9 dígitos comenzando con 9)' };
    }
    return { valido: true };
}
// Validar mes (1-12)
function validarMes(mes) {
    if (typeof mes !== 'number' || isNaN(mes)) {
        return { valido: false, error: 'El mes debe ser un número válido' };
    }
    if (mes < 1 || mes > 12) {
        return { valido: false, error: 'El mes debe estar entre 1 y 12' };
    }
    return { valido: true };
}
// Validar año
function validarAnio(anio) {
    if (typeof anio !== 'number' || isNaN(anio)) {
        return { valido: false, error: 'El año debe ser un número válido' };
    }
    const anioActual = new Date().getFullYear();
    if (anio < 2020 || anio > anioActual + 1) {
        return { valido: false, error: `El año debe estar entre 2020 y ${anioActual + 1}` };
    }
    return { valido: true };
}
