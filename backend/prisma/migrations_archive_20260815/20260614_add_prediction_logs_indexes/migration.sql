-- Composite indexes for the hot backtest/MAPE/signals query pattern.
-- signals.ts, backtesting.ts, and mapeTracking.ts filter modelId+status and
-- sort by verifiedAt (up to 6 queries per backtest request); the
-- commodityId+predictedAt index serves the backtest/MAPE count() range filter.

CREATE INDEX "prediction_logs_model_id_status_verified_at_idx"
    ON "prediction_logs" ("model_id", "status", "verified_at" DESC);

CREATE INDEX "prediction_logs_commodity_id_predicted_at_idx"
    ON "prediction_logs" ("commodity_id", "predicted_at");
