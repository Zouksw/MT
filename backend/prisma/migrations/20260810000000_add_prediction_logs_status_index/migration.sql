-- Status-leading index for prediction_logs.
-- dataHealth runs 4 status-only count() calls per /health/ready check (one
-- per status bucket), and the verify/mark timers in mapeTracking.ts filter
-- status + predictedAt. The existing [modelId, status, verifiedAt] index is
-- left-anchored on modelId, so these queries could not use it and fell back
-- to full scans of 100k+ rows. This index leads with status so both the
-- single-column status counts and the status+predictedAt range filters are
-- served by an index-only scan.

CREATE INDEX IF NOT EXISTS "prediction_logs_status_predicted_at_idx"
    ON "prediction_logs" ("status", "predicted_at");
