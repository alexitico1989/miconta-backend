/*
  Warnings:

  - The `ventasMensualesAprox` column on the `negocios` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "negocios" DROP COLUMN "ventasMensualesAprox",
ADD COLUMN     "ventasMensualesAprox" INTEGER;
