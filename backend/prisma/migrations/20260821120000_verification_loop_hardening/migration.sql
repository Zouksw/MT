-- Verification-loop hardening (round-114, A3-5 + live mape overflow).

-- A3-5: horizon <= 0 corrupts every window computation (anchor + horizon).
-- No writer emits it today (0 rows in mt_db and mt_test at 2026-08-21);
-- the CHECK makes the invariant structural.
ALTER TABLE "prediction_logs"
  ADD CONSTRAINT "prediction_logs_horizon_positive" CHECK ("horizon" > 0);

-- Live incident 2026-08-21: a row whose MAPE computed to ≥1000 re-failed
-- every 6h verify sweep with numeric field overflow (Decimal(5,2) ceiling
-- 999.99). Widen to Decimal(8,2); verifyPrediction additionally clamps at
-- 99,999.99 so the cliff can't just move.
ALTER TABLE "prediction_logs" ALTER COLUMN "mape" TYPE DECIMAL(8,2);
