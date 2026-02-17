/*
  Warnings:

  - You are about to drop the column `creditosImputables` on the `declaraciones_f22` table. All the data in the column will be lost.
  - You are about to drop the column `gastosDeducibles` on the `declaraciones_f22` table. All the data in the column will be lost.
  - You are about to drop the column `ingresosTotal` on the `declaraciones_f22` table. All the data in the column will be lost.
  - You are about to drop the column `ppmPagado` on the `declaraciones_f22` table. All the data in the column will be lost.
  - You are about to drop the column `rentaLiquida` on the `declaraciones_f22` table. All the data in the column will be lost.
  - You are about to drop the column `ppm` on the `declaraciones_f29` table. All the data in the column will be lost.
  - You are about to drop the column `cesantia` on the `liquidaciones` table. All the data in the column will be lost.
  - You are about to drop the column `horasExtra` on the `liquidaciones` table. All the data in the column will be lost.
  - You are about to drop the column `salud` on the `liquidaciones` table. All the data in the column will be lost.
  - You are about to drop the column `contacto` on the `proveedores` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `trabajadores` table. All the data in the column will be lost.
  - You are about to drop the column `telefono` on the `trabajadores` table. All the data in the column will be lost.
  - You are about to drop the column `fotoUrl` on the `transacciones` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[rutNegocio]` on the table `negocios` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[negocioId,rut]` on the table `proveedores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[documentoSiiId]` on the table `transacciones` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[correccionId]` on the table `transacciones` will be added. If there are existing duplicate values, this will fail.
  - Made the column `direccion` on table `clientes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `comuna` on table `clientes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `region` on table `clientes` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `gastosAnuales` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoResultado` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ppmAcumuladoAnual` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentaDeterminada` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rentaPresunta` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resultado` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCreditos` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ventasAnuales` to the `declaraciones_f22` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ppmBase` to the `declaraciones_f29` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ppmMonto` to the `declaraciones_f29` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalCompras` to the `declaraciones_f29` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalVentas` to the `declaraciones_f29` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoItem` to the `detalles_transaccion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoIva` to the `detalles_transaccion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombreItem` to the `detalles_transaccion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `costoEmpleador` to the `liquidaciones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seguroCesantia` to the `liquidaciones` table without a default value. This is not possible if the table is not empty.
  - Made the column `rutNegocio` on table `negocios` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rut` on table `proveedores` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `estadoCivil` to the `trabajadores` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sexo` to the `trabajadores` table without a default value. This is not possible if the table is not empty.
  - Made the column `fechaNacimiento` on table `trabajadores` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "alertas_negocioId_leida_idx";

-- DropIndex
DROP INDEX "declaraciones_f22_negocioId_idx";

-- DropIndex
DROP INDEX "declaraciones_f29_negocioId_idx";

-- DropIndex
DROP INDEX "liquidaciones_trabajadorId_idx";

-- DropIndex
DROP INDEX "pagos_usuarioId_idx";

-- DropIndex
DROP INDEX "pedidos_proveedorId_idx";

-- DropIndex
DROP INDEX "trabajadores_negocioId_idx";

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "razonSocial" TEXT,
ALTER COLUMN "direccion" SET NOT NULL,
ALTER COLUMN "comuna" SET NOT NULL,
ALTER COLUMN "region" SET NOT NULL;

-- AlterTable
ALTER TABLE "declaraciones_f22" DROP COLUMN "creditosImputables",
DROP COLUMN "gastosDeducibles",
DROP COLUMN "ingresosTotal",
DROP COLUMN "ppmPagado",
DROP COLUMN "rentaLiquida",
ADD COLUMN     "gastosAnuales" INTEGER NOT NULL,
ADD COLUMN     "montoResultado" INTEGER NOT NULL,
ADD COLUMN     "otrosCreditos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "ppmAcumuladoAnual" INTEGER NOT NULL,
ADD COLUMN     "rentaDeterminada" INTEGER NOT NULL,
ADD COLUMN     "rentaEfectiva" INTEGER,
ADD COLUMN     "rentaPresunta" INTEGER NOT NULL,
ADD COLUMN     "resultado" TEXT NOT NULL,
ADD COLUMN     "retencionesTrabajadores" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasaImpuesto" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN     "totalCreditos" INTEGER NOT NULL,
ADD COLUMN     "ventasAnuales" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "declaraciones_f29" DROP COLUMN "ppm",
ADD COLUMN     "comprasSupermercado" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ivaNotasCredito" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ivaNotasCreditoComp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ivaNotasDebitoComp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notasCreditoCompras" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notasCreditoVentas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notasDebitoCompras" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "ppmBase" INTEGER NOT NULL,
ADD COLUMN     "ppmMonto" INTEGER NOT NULL,
ADD COLUMN     "ppmTasa" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "retencionIvaTerceros" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCompras" INTEGER NOT NULL,
ADD COLUMN     "totalVentas" INTEGER NOT NULL,
ADD COLUMN     "ventasExportacion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "detalles_transaccion" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "descuentoMonto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "montoExento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "montoItem" INTEGER NOT NULL,
ADD COLUMN     "montoIva" INTEGER NOT NULL,
ADD COLUMN     "nombreItem" TEXT NOT NULL,
ADD COLUMN     "numeroLinea" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "recargoMonto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tasaIva" INTEGER NOT NULL DEFAULT 19,
ADD COLUMN     "unidadMedida" TEXT NOT NULL DEFAULT 'UN';

-- AlterTable
ALTER TABLE "liquidaciones" DROP COLUMN "cesantia",
DROP COLUMN "horasExtra",
DROP COLUMN "salud",
ADD COLUMN     "aguinaldo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "apv" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "asignacionFamiliar" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costoEmpleador" INTEGER NOT NULL,
ADD COLUMN     "diasTrabajados" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'borrador',
ADD COLUMN     "gratificacion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "horasExtraCantidad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "horasExtraMonto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "prestamos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "previredUrl" TEXT,
ADD COLUMN     "saludFonasa" INTEGER,
ADD COLUMN     "saludIsapre" INTEGER,
ADD COLUMN     "seguroCesantia" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "movimientos_stock" ADD COLUMN     "costoUnitario" INTEGER,
ADD COLUMN     "documentoFolio" INTEGER,
ADD COLUMN     "documentoTipo" TEXT;

-- AlterTable
ALTER TABLE "negocios" ADD COLUMN     "ambienteSii" TEXT NOT NULL DEFAULT 'certificacion',
ADD COLUMN     "certificadoActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certificadoP12" BYTEA,
ADD COLUMN     "certificadoP12Iv" TEXT,
ADD COLUMN     "certificadoP12Tag" TEXT,
ADD COLUMN     "certificadoPassword" TEXT,
ADD COLUMN     "certificadoPasswordIv" TEXT,
ADD COLUMN     "certificadoPasswordTag" TEXT,
ADD COLUMN     "certificadoSubject" TEXT,
ADD COLUMN     "certificadoVencimiento" TIMESTAMP(3),
ADD COLUMN     "codigoSii" TEXT,
ADD COLUMN     "emailSii" TEXT,
ADD COLUMN     "estadoCertificacionSii" TEXT NOT NULL DEFAULT 'no_iniciado',
ADD COLUMN     "fechaInicioActividades" TIMESTAMP(3),
ADD COLUMN     "folioBoletaActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "folioFacturaActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "folioGuiaActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "folioNotaCreditoActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "folioNotaDebitoActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "telefonoSii" TEXT,
ALTER COLUMN "rutNegocio" SET NOT NULL;

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "afectoIva" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codigoBarra" TEXT,
ADD COLUMN     "codigoSii" TEXT,
ADD COLUMN     "tipoItem" TEXT NOT NULL DEFAULT 'producto',
ALTER COLUMN "unidadMedida" SET DEFAULT 'UN';

-- AlterTable
ALTER TABLE "proveedores" DROP COLUMN "contacto",
ADD COLUMN     "comuna" TEXT,
ADD COLUMN     "contactoNombre" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "giro" TEXT,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "region" TEXT,
ALTER COLUMN "rut" SET NOT NULL;

-- AlterTable
ALTER TABLE "trabajadores" DROP COLUMN "email",
DROP COLUMN "telefono",
ADD COLUMN     "apvMonto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "apvTasa" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "asignacionFamiliar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cotizacionAdicional" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estadoCivil" TEXT NOT NULL,
ADD COLUMN     "gratificacion" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jornada" TEXT NOT NULL DEFAULT 'completa',
ADD COLUMN     "numeroCargas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "seguroCesantia" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sexo" TEXT NOT NULL,
ADD COLUMN     "tipoContrato" TEXT NOT NULL DEFAULT 'indefinido',
ALTER COLUMN "fechaNacimiento" SET NOT NULL;

-- AlterTable
ALTER TABLE "transacciones" DROP COLUMN "fotoUrl",
ADD COLUMN     "correccionId" TEXT,
ADD COLUMN     "documentoSiiId" TEXT,
ADD COLUMN     "esCorreccion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "montoExento" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noSujeto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "proveedorId" TEXT,
ADD COLUMN     "tasaIva" INTEGER NOT NULL DEFAULT 19,
ADD COLUMN     "transaccionOriginalId" TEXT,
ALTER COLUMN "fecha" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "configuraciones_sii" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "codigoActividad" TEXT,
    "actividadDescripcion" TEXT,
    "resolucionNumero" TEXT,
    "resolucionFecha" TIMESTAMP(3),
    "emailDte" TEXT,
    "logoUrl" TEXT,
    "colorPrimario" TEXT,
    "piePagina" TEXT,
    "envioAutomatico" BOOLEAN NOT NULL DEFAULT true,
    "emailCopiaEmisor" BOOLEAN NOT NULL DEFAULT true,
    "alertaFoliosMinimo" INTEGER NOT NULL DEFAULT 50,
    "repLegalRut" TEXT,
    "repLegalNombre" TEXT,
    "repLegalEmail" TEXT,
    "repLegalCargo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_sii_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caf_folios" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "folioDesde" INTEGER NOT NULL,
    "folioHasta" INTEGER NOT NULL,
    "folioActual" INTEGER NOT NULL,
    "xmlCaf" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "privateKeyIv" TEXT NOT NULL,
    "privateKeyTag" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaVencimiento" TIMESTAMP(3),
    "foliosUsados" INTEGER NOT NULL DEFAULT 0,
    "foliosDisponibles" INTEGER NOT NULL,
    "ambiente" TEXT NOT NULL DEFAULT 'certificacion',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caf_folios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_sii" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ambiente" TEXT NOT NULL DEFAULT 'certificacion',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "trackId" TEXT,
    "respuestaSii" TEXT,
    "estadoSii" TEXT,
    "glosaEstado" TEXT,
    "receptorRut" TEXT NOT NULL,
    "receptorNombre" TEXT NOT NULL,
    "receptorDireccion" TEXT,
    "receptorComuna" TEXT,
    "receptorGiro" TEXT,
    "receptorEmail" TEXT,
    "montoNeto" INTEGER NOT NULL,
    "montoExento" INTEGER NOT NULL DEFAULT 0,
    "montoIva" INTEGER NOT NULL,
    "montoTotal" INTEGER NOT NULL,
    "tasaIva" INTEGER NOT NULL DEFAULT 19,
    "xmlDocumento" TEXT,
    "xmlEnvio" TEXT,
    "pdfUrl" TEXT,
    "timbreElectronico" TEXT,
    "referenciaFolio" INTEGER,
    "referenciaTipo" TEXT,
    "referenciaRazon" TEXT,
    "codigoReferencia" TEXT,
    "emailEnviado" BOOLEAN NOT NULL DEFAULT false,
    "fechaEmailEnvio" TIMESTAMP(3),
    "acuseRecibo" TEXT,
    "fechaAcuse" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_sii_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_dte" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "documentoSiiId" TEXT,
    "operacion" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "codigoRespuesta" TEXT,
    "mensajeError" TEXT,
    "requestResumen" TEXT,
    "responseResumen" TEXT,
    "duracionMs" INTEGER,
    "ambiente" TEXT NOT NULL DEFAULT 'certificacion',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_dte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "libros_cv" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "totalDocumentos" INTEGER NOT NULL DEFAULT 0,
    "totalNeto" INTEGER NOT NULL DEFAULT 0,
    "totalIva" INTEGER NOT NULL DEFAULT 0,
    "totalExento" INTEGER NOT NULL DEFAULT 0,
    "totalMonto" INTEGER NOT NULL DEFAULT 0,
    "xmlLibro" TEXT,
    "trackId" TEXT,
    "respuesta" TEXT,
    "fechaGeneracion" TIMESTAMP(3),
    "fechaEnvio" TIMESTAMP(3),
    "fechaAceptacion" TIMESTAMP(3),
    "ambiente" TEXT NOT NULL DEFAULT 'certificacion',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libros_cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_contables" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "transaccionId" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "codigoReferenciaSii" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "documentoSiiId" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "negocioId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_sii_negocioId_key" ON "configuraciones_sii"("negocioId");

-- CreateIndex
CREATE INDEX "caf_folios_negocioId_tipoDocumento_activo_idx" ON "caf_folios"("negocioId", "tipoDocumento", "activo");

-- CreateIndex
CREATE INDEX "caf_folios_negocioId_ambiente_idx" ON "caf_folios"("negocioId", "ambiente");

-- CreateIndex
CREATE INDEX "documentos_sii_negocioId_estado_idx" ON "documentos_sii"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "documentos_sii_negocioId_ambiente_idx" ON "documentos_sii"("negocioId", "ambiente");

-- CreateIndex
CREATE INDEX "documentos_sii_fechaEmision_idx" ON "documentos_sii"("fechaEmision");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_sii_negocioId_tipoDocumento_folio_ambiente_key" ON "documentos_sii"("negocioId", "tipoDocumento", "folio", "ambiente");

-- CreateIndex
CREATE INDEX "logs_dte_negocioId_operacion_idx" ON "logs_dte"("negocioId", "operacion");

-- CreateIndex
CREATE INDEX "logs_dte_negocioId_createdAt_idx" ON "logs_dte"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "logs_dte_documentoSiiId_idx" ON "logs_dte"("documentoSiiId");

-- CreateIndex
CREATE INDEX "libros_cv_negocioId_estado_idx" ON "libros_cv"("negocioId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "libros_cv_negocioId_tipo_mes_anio_ambiente_key" ON "libros_cv"("negocioId", "tipo", "mes", "anio", "ambiente");

-- CreateIndex
CREATE UNIQUE INDEX "notas_contables_transaccionId_key" ON "notas_contables"("transaccionId");

-- CreateIndex
CREATE INDEX "notas_contables_negocioId_estado_idx" ON "notas_contables"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "alertas_negocioId_leida_prioridad_idx" ON "alertas"("negocioId", "leida", "prioridad");

-- CreateIndex
CREATE INDEX "declaraciones_f22_negocioId_estado_idx" ON "declaraciones_f22"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "declaraciones_f29_negocioId_estado_idx" ON "declaraciones_f29"("negocioId", "estado");

-- CreateIndex
CREATE INDEX "liquidaciones_trabajadorId_anio_mes_idx" ON "liquidaciones"("trabajadorId", "anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "negocios_rutNegocio_key" ON "negocios"("rutNegocio");

-- CreateIndex
CREATE INDEX "pagos_usuarioId_estado_idx" ON "pagos"("usuarioId", "estado");

-- CreateIndex
CREATE INDEX "pedidos_proveedorId_estado_idx" ON "pedidos"("proveedorId", "estado");

-- CreateIndex
CREATE INDEX "productos_codigoBarra_idx" ON "productos"("codigoBarra");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_negocioId_rut_key" ON "proveedores"("negocioId", "rut");

-- CreateIndex
CREATE INDEX "trabajadores_negocioId_activo_idx" ON "trabajadores"("negocioId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_documentoSiiId_key" ON "transacciones"("documentoSiiId");

-- CreateIndex
CREATE UNIQUE INDEX "transacciones_correccionId_key" ON "transacciones"("correccionId");

-- CreateIndex
CREATE INDEX "transacciones_proveedorId_idx" ON "transacciones"("proveedorId");

-- AddForeignKey
ALTER TABLE "configuraciones_sii" ADD CONSTRAINT "configuraciones_sii_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caf_folios" ADD CONSTRAINT "caf_folios_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_sii" ADD CONSTRAINT "documentos_sii_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_dte" ADD CONSTRAINT "logs_dte_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_dte" ADD CONSTRAINT "logs_dte_documentoSiiId_fkey" FOREIGN KEY ("documentoSiiId") REFERENCES "documentos_sii"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "libros_cv" ADD CONSTRAINT "libros_cv_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_documentoSiiId_fkey" FOREIGN KEY ("documentoSiiId") REFERENCES "documentos_sii"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_correccionId_fkey" FOREIGN KEY ("correccionId") REFERENCES "notas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_contables" ADD CONSTRAINT "notas_contables_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
