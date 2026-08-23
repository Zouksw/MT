-- ADR-0001 ③: prediction_logs gains a nullable `interval` column carrying
-- the cadence of the predicted series ("daily" | "monthly"). NULL = legacy
-- daily-era rows — deliberately NOT backfilled (140k rows; NULL=daily is
-- semantically identical to what those rows are). The verification
-- lifecycle (mapeTracking.ts) branches on it: monthly horizons mature in
-- months, monthly actuals windows read monthly price points.

ALTER TABLE "prediction_logs" ADD COLUMN "interval" TEXT;
