/*
  Warnings:

  - You are about to drop the column `cliente` on the `transacciones` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transacciones" DROP COLUMN "cliente",
ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "tipoDocumento" TEXT NOT NULL DEFAULT 'boleta';

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "comuna" TEXT,
    "region" TEXT,
    "giro" TEXT,
    "contactoNombre" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_negocioId_idx" ON "clientes"("negocioId");

-- CreateIndex
CREATE INDEX "clientes_rut_idx" ON "clientes"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_negocioId_rut_key" ON "clientes"("negocioId", "rut");

-- CreateIndex
CREATE INDEX "transacciones_clienteId_idx" ON "transacciones"("clienteId");

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "negocios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
