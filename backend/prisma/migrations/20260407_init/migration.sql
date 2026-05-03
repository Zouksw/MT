-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "StorageFormat" AS ENUM ('IOTDB_CACHE', 'INFLUXDB', 'OPENML', 'CSV');

-- CreateEnum
CREATE TYPE "ModelAlgorithm" AS ENUM ('ARIMA', 'PROPHET', 'LSTM', 'TRANSFORMER', 'ENSEMBLE');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DetectionMethod" AS ENUM ('STATISTICAL', 'ML_AUTOENCODER', 'RULE_BASED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ANOMALY', 'FORECAST_READY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "is_mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "preferences" JSONB,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER DEFAULT 0,
    "locked_until" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "storage_format" "StorageFormat" NOT NULL,
    "file_path" TEXT,
    "size_bytes" BIGINT,
    "rows_count" INTEGER,
    "metadata" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_imported" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeseries" (
    "id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color_hex" TEXT,
    "unit" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_anomaly_detection_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "timeseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datapoints" (
    "id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value_json" JSONB NOT NULL,
    "quality_score" DECIMAL(3,2),
    "is_outlier" BOOLEAN NOT NULL DEFAULT false,
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datapoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasting_models" (
    "id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "trained_by_id" TEXT,
    "algorithm" "ModelAlgorithm" NOT NULL,
    "hyperparameters" JSONB NOT NULL,
    "training_metrics" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trained_at" TIMESTAMP(3),
    "deployed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasting_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "predicted_value" DECIMAL(15,6) NOT NULL,
    "lower_bound" DECIMAL(15,6),
    "upper_bound" DECIMAL(15,6),
    "confidence" DECIMAL(3,2) NOT NULL,
    "anomaly_probability" DECIMAL(3,2),
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "datapoint_id" BIGINT,
    "severity" "AnomalySeverity" NOT NULL,
    "detection_method" "DetectionMethod" NOT NULL,
    "score" DECIMAL(5,2),
    "context" JSONB,
    "is_investigated" BOOLEAN NOT NULL DEFAULT false,
    "resolution_notes" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "alert_rule_id" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timeseries_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ANOMALY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "channels" JSONB NOT NULL,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 5,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_characters" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL,
    "user_agent" TEXT,
    "url" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "settings" JSONB,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_queries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query_params" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "saved_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE INDEX "datasets_owner_id_idx" ON "datasets"("owner_id");

-- CreateIndex
CREATE INDEX "datasets_created_at_idx" ON "datasets"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "datasets_organization_id_slug_key" ON "datasets"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "timeseries_created_at_idx" ON "timeseries"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "timeseries_dataset_id_slug_key" ON "timeseries"("dataset_id", "slug");

-- CreateIndex
CREATE INDEX "datapoints_timeseries_id_timestamp_idx" ON "datapoints"("timeseries_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "datapoints_timeseries_id_is_anomaly_idx" ON "datapoints"("timeseries_id", "is_anomaly");

-- CreateIndex
CREATE INDEX "datapoints_timestamp_idx" ON "datapoints"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "datapoints_timeseries_id_is_outlier_idx" ON "datapoints"("timeseries_id", "is_outlier");

-- CreateIndex
CREATE INDEX "forecasting_models_timeseries_id_idx" ON "forecasting_models"("timeseries_id");

-- CreateIndex
CREATE INDEX "forecasting_models_trained_by_id_idx" ON "forecasting_models"("trained_by_id");

-- CreateIndex
CREATE INDEX "forecasting_models_is_active_idx" ON "forecasting_models"("is_active");

-- CreateIndex
CREATE INDEX "forecasting_models_trained_at_idx" ON "forecasting_models"("trained_at" DESC);

-- CreateIndex
CREATE INDEX "forecasting_models_created_at_idx" ON "forecasting_models"("created_at" DESC);

-- CreateIndex
CREATE INDEX "forecasts_model_id_idx" ON "forecasts"("model_id");

-- CreateIndex
CREATE INDEX "forecasts_timeseries_id_timestamp_idx" ON "forecasts"("timeseries_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "anomalies_timeseries_id_idx" ON "anomalies"("timeseries_id");

-- CreateIndex
CREATE INDEX "anomalies_timeseries_id_severity_idx" ON "anomalies"("timeseries_id", "severity");

-- CreateIndex
CREATE INDEX "anomalies_timeseries_id_is_resolved_idx" ON "anomalies"("timeseries_id", "is_resolved");

-- CreateIndex
CREATE INDEX "anomalies_created_at_idx" ON "anomalies"("created_at" DESC);

-- CreateIndex
CREATE INDEX "alerts_user_id_idx" ON "alerts"("user_id");

-- CreateIndex
CREATE INDEX "alerts_timeseries_id_idx" ON "alerts"("timeseries_id");

-- CreateIndex
CREATE INDEX "alerts_alert_rule_id_idx" ON "alerts"("alert_rule_id");

-- CreateIndex
CREATE INDEX "alerts_user_id_is_read_idx" ON "alerts"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "alerts_user_id_created_at_idx" ON "alerts"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "alert_rules_user_id_idx" ON "alert_rules"("user_id");

-- CreateIndex
CREATE INDEX "alert_rules_timeseries_id_idx" ON "alert_rules"("timeseries_id");

-- CreateIndex
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules"("enabled");

-- CreateIndex
CREATE INDEX "alert_rules_user_id_enabled_idx" ON "alert_rules"("user_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_is_active_idx" ON "sessions"("is_active");

-- CreateIndex
CREATE INDEX "sessions_user_id_created_at_idx" ON "sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_user_id_idx" ON "security_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_audit_logs_event_timestamp_idx" ON "security_audit_logs"("event", "timestamp");

-- CreateIndex
CREATE INDEX "security_audit_logs_severity_timestamp_idx" ON "security_audit_logs"("severity", "timestamp");

-- CreateIndex
CREATE INDEX "security_audit_logs_timestamp_idx" ON "security_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_created_at_idx" ON "organizations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "saved_queries_organization_id_idx" ON "saved_queries"("organization_id");

-- CreateIndex
CREATE INDEX "saved_queries_user_id_created_at_idx" ON "saved_queries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "saved_queries_user_id_idx" ON "saved_queries"("user_id");

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeseries" ADD CONSTRAINT "timeseries_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datapoints" ADD CONSTRAINT "datapoints_timeseries_id_fkey" FOREIGN KEY ("timeseries_id") REFERENCES "timeseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasting_models" ADD CONSTRAINT "forecasting_models_timeseries_id_fkey" FOREIGN KEY ("timeseries_id") REFERENCES "timeseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasting_models" ADD CONSTRAINT "forecasting_models_trained_by_id_fkey" FOREIGN KEY ("trained_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "forecasting_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_timeseries_id_fkey" FOREIGN KEY ("timeseries_id") REFERENCES "timeseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_timeseries_id_fkey" FOREIGN KEY ("timeseries_id") REFERENCES "timeseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_timeseries_id_fkey" FOREIGN KEY ("timeseries_id") REFERENCES "timeseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
