-- Round-104 / MAPE verification loop: record the forecast's own timeline
-- start so verification can align actuals to it instead of to predictedAt
-- (log time). When a source lags behind the log time, the old anchor
-- paired actual day-1 with the wrong forecast step, systematically
-- inflating MAPE. Nullable — legacy rows fall back to predictedAt.
ALTER TABLE "prediction_logs" ADD COLUMN "forecast_start_at" TIMESTAMP(3);
