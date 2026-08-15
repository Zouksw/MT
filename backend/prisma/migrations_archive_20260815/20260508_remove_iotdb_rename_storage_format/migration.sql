-- AlterEnum: Rename IOTDB_CACHE to TIMESERIES in StorageFormat
ALTER TYPE "StorageFormat" RENAME VALUE 'IOTDB_CACHE' TO 'TIMESERIES';

-- AlterTable: Make timeseriesPath optional in prediction_logs
ALTER TABLE "prediction_logs" ALTER COLUMN "timeseries_path" SET DEFAULT 'deprecated';
