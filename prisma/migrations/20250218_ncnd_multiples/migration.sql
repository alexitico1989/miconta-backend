-- Eliminar constraint unique de transaccionId
ALTER TABLE "notas_contables" DROP CONSTRAINT IF EXISTS "notas_contables_transaccionId_key";

-- Agregar índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS "notas_contables_transaccionId_idx" ON "notas_contables"("transaccionId");

-- Eliminar constraint unique de correccionId
ALTER TABLE "transacciones" DROP CONSTRAINT IF EXISTS "transacciones_correccionId_key";

-- Eliminar columna correccionId
ALTER TABLE "transacciones" DROP COLUMN IF EXISTS "correccionId";