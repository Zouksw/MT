-- AlterEnum
BEGIN;
CREATE TYPE "ModelAlgorithm_new" AS ENUM ('ARIMA', 'HOLTWINTERS', 'EXPONENTIAL_SMOOTHING', 'NAIVE_FORECASTER', 'STL_FORECASTER', 'TIMER_XL', 'SUNDIAL');
ALTER TABLE "forecasting_models" ALTER COLUMN "algorithm" TYPE "ModelAlgorithm_new" USING ("algorithm"::text::"ModelAlgorithm_new");
ALTER TYPE "ModelAlgorithm" RENAME TO "ModelAlgorithm_old";
ALTER TYPE "ModelAlgorithm_new" RENAME TO "ModelAlgorithm";
DROP TYPE "public"."ModelAlgorithm_old";
COMMIT;

-- AlterTable
ALTER TABLE "datasets" ADD COLUMN     "commodity_type" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "exchange" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'USD/bbl';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "datasets_commodity_type_idx" ON "datasets"("commodity_type");
