-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "rut" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "trialHasta" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negocios" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombreNegocio" TEXT NOT NULL,
    "rutNegocio" TEXT,
    "tipo" TEXT NOT NULL,
    "giro" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "region" TEXT,
    "ventasMensualesAprox" TEXT,
    "regimenTributario" TEXT NOT NULL DEFAULT 'propyme',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negocios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "montoTotal" INTEGER NOT NULL,
    "montoNeto" INTEGER NOT NULL,
    "montoIva" INTEGER NOT NULL,
    "exento" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "proveedor" TEXT,
    "numDocumento" TEXT,
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "categoria" TEXT,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 5,
    "unidadMedida" TEXT NOT NULL DEFAULT 'unidad',
    "precioCompra" INTEGER,
    "precioVenta" INTEGER,
    "fotoUrl" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_stock" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "stockAnterior" INTEGER NOT NULL,
    "stockNuevo" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "frecuenciaVisita" INTEGER,
    "ultimaVisita" TIMESTAMP(3),
    "proximaVisita" TIMESTAMP(3),
    "diaVisita" TEXT,
    "categoria" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'sugerido',
    "items" JSONB NOT NULL,
    "montoTotal" INTEGER,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trabajadores" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3),
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "cargo" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "fechaSalida" TIMESTAMP(3),
    "sueldoBase" INTEGER NOT NULL,
    "afp" TEXT NOT NULL,
    "salud" TEXT NOT NULL,
    "isapre" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trabajadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidaciones" (
    "id" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "sueldoBase" INTEGER NOT NULL,
    "horasExtra" INTEGER NOT NULL DEFAULT 0,
    "bonos" INTEGER NOT NULL DEFAULT 0,
    "totalHaberes" INTEGER NOT NULL,
    "afp" INTEGER NOT NULL,
    "salud" INTEGER NOT NULL,
    "cesantia" INTEGER NOT NULL,
    "impuestoUnico" INTEGER NOT NULL DEFAULT 0,
    "otrosDescuentos" INTEGER NOT NULL DEFAULT 0,
    "totalDescuentos" INTEGER NOT NULL,
    "sueldoLiquido" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaraciones_f29" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "ventasAfectas" INTEGER NOT NULL,
    "ventasExentas" INTEGER NOT NULL DEFAULT 0,
    "ivaDebito" INTEGER NOT NULL,
    "comprasAfectas" INTEGER NOT NULL,
    "comprasExentas" INTEGER NOT NULL DEFAULT 0,
    "ivaCredito" INTEGER NOT NULL,
    "ivaDeterminado" INTEGER NOT NULL,
    "ppm" INTEGER NOT NULL,
    "totalAPagar" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaPresentacion" TIMESTAMP(3),
    "folio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaraciones_f29_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "declaraciones_f22" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ingresosTotal" INTEGER NOT NULL,
    "gastosDeducibles" INTEGER NOT NULL DEFAULT 0,
    "rentaLiquida" INTEGER NOT NULL,
    "impuestoDeterminado" INTEGER NOT NULL,
    "ppmPagado" INTEGER NOT NULL,
    "creditosImputables" INTEGER NOT NULL DEFAULT 0,
    "impuestoAPagar" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fechaPresentacion" TIMESTAMP(3),
    "folio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaraciones_f22_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'media',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "mpPreapprovalId" TEXT,
    "mpPaymentId" TEXT,
    "monto" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "metodoPago" TEXT,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_usuarioId_key" ON "negocios"("usuarioId");

-- CreateIndex
CREATE INDEX "transacciones_negocioId_fecha_idx" ON "transacciones"("negocioId", "fecha");

-- CreateIndex
CREATE INDEX "transacciones_tipo_idx" ON "transacciones"("tipo");

-- CreateIndex
CREATE INDEX "productos_negocioId_idx" ON "productos"("negocioId");

-- CreateIndex
CREATE INDEX "movimientos_stock_productoId_fecha_idx" ON "movimientos_stock"("productoId", "fecha");

-- CreateIndex
CREATE INDEX "proveedores_negocioId_idx" ON "proveedores"("negocioId");

-- CreateIndex
CREATE INDEX "pedidos_proveedorId_idx" ON "pedidos"("proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "trabajadores_rut_key" ON "trabajadores"("rut");

-- CreateIndex
CREATE INDEX "trabajadores_negocioId_idx" ON "trabajadores"("negocioId");

-- CreateIndex
CREATE INDEX "liquidaciones_trabajadorId_idx" ON "liquidaciones"("trabajadorId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidaciones_trabajadorId_mes_anio_key" ON "liquidaciones"("trabajadorId", "mes", "anio");

-- CreateIndex
CREATE INDEX "declaraciones_f29_negocioId_idx" ON "declaraciones_f29"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_f29_negocioId_mes_anio_key" ON "declaraciones_f29"("negocioId", "mes", "anio");

-- CreateIndex
CREATE INDEX "declaraciones_f22_negocioId_idx" ON "declaraciones_f22"("negocioId");

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_f22_negocioId_anio_key" ON "declaraciones_f22"("negocioId", "anio");

-- CreateIndex
CREATE INDEX "alertas_negocioId_leida_idx" ON "alertas"("negocioId", "leida");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_mpPreapprovalId_key" ON "pagos"("mpPreapprovalId");

-- CreateIndex
CREATE INDEX "pagos_usuarioId_idx" ON "pagos"("usuarioId");

-- AddForeignKey
ALTER TABLE "negocios" ADD CONSTRAINT "negocios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabajadores" ADD CONSTRAINT "trabajadores_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidaciones" ADD CONSTRAINT "liquidaciones_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "trabajadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_f29" ADD CONSTRAINT "declaraciones_f29_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_f22" ADD CONSTRAINT "declaraciones_f22_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
