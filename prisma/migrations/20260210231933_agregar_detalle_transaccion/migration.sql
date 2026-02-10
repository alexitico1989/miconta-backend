-- AlterTable
ALTER TABLE "transacciones" ADD COLUMN     "cliente" TEXT,
ADD COLUMN     "metodoPago" TEXT;

-- CreateTable
CREATE TABLE "detalles_transaccion" (
    "id" TEXT NOT NULL,
    "transaccionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detalles_transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detalles_transaccion_transaccionId_idx" ON "detalles_transaccion"("transaccionId");

-- CreateIndex
CREATE INDEX "detalles_transaccion_productoId_idx" ON "detalles_transaccion"("productoId");

-- AddForeignKey
ALTER TABLE "detalles_transaccion" ADD CONSTRAINT "detalles_transaccion_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "transacciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_transaccion" ADD CONSTRAINT "detalles_transaccion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
