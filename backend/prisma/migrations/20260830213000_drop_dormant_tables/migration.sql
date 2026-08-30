-- D2 (v3.2.0 batch 4): drop dormant scaffolding tables whose only code face
-- went with /api/security + modelService.ts (round-132 D6). Row counts at
-- drop time (backed up to backups/round140-d2/dormant-tables.sql):
--   forecasts 0, forecasting_models 0, security_audit_logs 49.

DROP TABLE "forecasts";
DROP TABLE "forecasting_models";
DROP TABLE "security_audit_logs";
DROP TYPE "ModelAlgorithm";
