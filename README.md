# MiConta Backend API

Backend para la aplicación móvil MiConta - Sistema de contabilidad simplificada para microempresas chilenas.

## 🚀 Stack Tecnológico

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Base de datos**: PostgreSQL (Railway)
- **ORM**: Prisma
- **Autenticación**: JWT + bcrypt
- **Hosting**: Railway

## 📦 Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/alexitico1989/miconta-backend.git
cd miconta-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor desarrollo
npm run dev
```

## 🔐 Variables de Entorno

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="tu_secret_seguro"
PORT=3000
```

## 📡 Endpoints API

### Autenticación

#### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123",
  "nombre": "Juan Pérez",
  "telefono": "+56912345678"
}

Response 201:
{
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": "uuid",
    "email": "usuario@example.com",
    "nombre": "Juan Pérez",
    "plan": "trial",
    "trialHasta": "2026-03-11T..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "password123"
}

Response 200:
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "usuario": {
    "id": "uuid",
    "email": "usuario@example.com",
    "nombre": "Juan Pérez",
    "plan": "trial",
    "trialHasta": "2026-03-11T..."
  }
}
```

### Negocio

**Todas las rutas requieren header:**
```
Authorization: Bearer {token}
```

#### Crear/Actualizar Negocio
```http
POST /api/negocio
Authorization: Bearer {token}
Content-Type: application/json

{
  "nombreNegocio": "Almacén Don Luis",
  "rutNegocio": "12345678-9",
  "tipo": "almacen",
  "direccion": "Av. Principal 123",
  "comuna": "Valparaíso",
  "region": "Valparaíso",
  "ventasMensualesAprox": "5000000"
}

Response 200:
{
  "message": "Negocio guardado exitosamente",
  "negocio": { ... }
}
```

#### Obtener Negocio
```http
GET /api/negocio
Authorization: Bearer {token}

Response 200:
{
  "negocio": { ... }
}
```

### Transacciones

#### Crear Transacción (Venta/Compra)
```http
POST /api/transacciones
Authorization: Bearer {token}
Content-Type: application/json

{
  "tipo": "venta",
  "fecha": "2026-02-09",
  "montoTotal": 11900,
  "exento": false,
  "descripcion": "Venta productos varios"
}

Response 201:
{
  "message": "Venta registrada exitosamente",
  "transaccion": {
    "id": "uuid",
    "tipo": "venta",
    "fecha": "2026-02-09T00:00:00.000Z",
    "montoTotal": 11900,
    "montoNeto": 10000,
    "montoIva": 1900,
    "exento": false,
    "descripcion": "Venta productos varios"
  }
}
```

#### Obtener Transacciones
```http
GET /api/transacciones?tipo=venta&mes=2&anio=2026
Authorization: Bearer {token}

Response 200:
{
  "transacciones": [ ... ],
  "total": 15
}
```

#### Resumen Mensual (para F29)
```http
GET /api/transacciones/resumen?mes=2&anio=2026
Authorization: Bearer {token}

Response 200:
{
  "periodo": "2/2026",
  "ventas": {
    "cantidad": 45,
    "totalBruto": 5355000,
    "totalNeto": 4500000,
    "iva": 855000
  },
  "compras": {
    "cantidad": 12,
    "totalBruto": 2380000,
    "totalNeto": 2000000,
    "iva": 380000
  },
  "resumen": {
    "ivaPagar": 475000,
    "aFavor": 0
  }
}
```

#### Eliminar Transacción
```http
DELETE /api/transacciones/{id}
Authorization: Bearer {token}

Response 200:
{
  "message": "Transacción eliminada exitosamente"
}
```

## 🗃️ Modelos de Base de Datos

### Usuario
- id, email, password, nombre, telefono, rut
- plan, trialHasta, estado
- createdAt, updatedAt

### Negocio
- id, usuarioId
- nombreNegocio, rutNegocio, tipo
- direccion, comuna, region
- ventasMensualesAprox
- createdAt, updatedAt

### Transaccion
- id, negocioId
- tipo (venta/compra)
- fecha
- montoTotal, montoNeto, montoIva
- exento, descripcion
- createdAt, updatedAt

## 🚢 Deploy en Railway

```bash
# Build automático al hacer push
git add .
git commit -m "Update backend"
git push origin main
```

## 📝 Próximos Pasos

- [ ] App móvil React Native
- [ ] Generación PDF F29
- [ ] OCR para boletas
- [ ] Chatbot IA tributario
- [ ] Sistema de pagos (suscripciones)

---

**Desarrollado por AMIA SOLUTIONS SPA**