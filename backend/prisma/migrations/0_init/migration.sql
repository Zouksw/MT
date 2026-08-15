-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "StorageFormat" AS ENUM ('TIMESERIES', 'INFLUXDB', 'OPENML', 'CSV');

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

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('PRICE_MOVE', 'SUPPLY', 'TRADE_POLICY', 'MARKET_INSIGHT', 'COMPANY');

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
    "commodity_type" TEXT,
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
CREATE TABLE "prediction_logs" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "timeseries_path" TEXT NOT NULL DEFAULT 'deprecated',
    "horizon" INTEGER NOT NULL,
    "predicted_values" JSONB NOT NULL,
    "actual_values" JSONB,
    "lower_bounds" JSONB,
    "upper_bounds" JSONB,
    "confidence" DECIMAL(3,2),
    "mape" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "predicted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "prediction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_cn" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "grade" TEXT,
    "origin_country" TEXT,
    "factory_code" TEXT,
    "unit" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "commodities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodity_prices" (
    "id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "interval" TEXT NOT NULL,
    "open" DECIMAL(18,6),
    "high" DECIMAL(18,6),
    "low" DECIMAL(18,6),
    "close" DECIMAL(18,6) NOT NULL,
    "volume" DECIMAL(18,4),
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodity_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_factors" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "region" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "watchlist_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "notes" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "current_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "capacity" INTEGER,
    "accredited" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beef_cut_taxonomy" (
    "id" TEXT NOT NULL,
    "cutCode" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameZh" TEXT,
    "nameEs" TEXT,
    "namePt" TEXT,
    "primal" TEXT,
    "subprimal" TEXT,
    "impsCode" TEXT,
    "hsCode" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beef_cut_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beef_cut_prices" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "cutCode" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unit" TEXT NOT NULL DEFAULT 'USD/kg',
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "volume" DOUBLE PRECISION,
    "grade" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beef_cut_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_kills" (
    "id" TEXT NOT NULL,
    "factoryId" TEXT,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "headCount" INTEGER NOT NULL,
    "avgWeight" DOUBLE PRECISION,
    "weekEnding" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_kills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cold_storage" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "totalLbs" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cold_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "commodity_slug" TEXT,
    "related_slugs" JSONB,
    "cover_image_url" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'published',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "market_news_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "datasets_last_accessed_at_idx" ON "datasets"("last_accessed_at" DESC);

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
CREATE INDEX "api_keys_last_used_at_idx" ON "api_keys"("last_used_at");

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
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_created_at_idx" ON "organizations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "prediction_logs_model_id_idx" ON "prediction_logs"("model_id");

-- CreateIndex
CREATE INDEX "prediction_logs_commodity_id_idx" ON "prediction_logs"("commodity_id");

-- CreateIndex
CREATE INDEX "prediction_logs_predicted_at_idx" ON "prediction_logs"("predicted_at");

-- CreateIndex
CREATE INDEX "prediction_logs_model_id_status_verified_at_idx" ON "prediction_logs"("model_id", "status", "verified_at" DESC);

-- CreateIndex
CREATE INDEX "prediction_logs_commodity_id_predicted_at_idx" ON "prediction_logs"("commodity_id", "predicted_at");

-- CreateIndex
CREATE INDEX "prediction_logs_status_predicted_at_idx" ON "prediction_logs"("status", "predicted_at");

-- CreateIndex
CREATE UNIQUE INDEX "commodities_slug_key" ON "commodities"("slug");

-- CreateIndex
CREATE INDEX "commodities_category_idx" ON "commodities"("category");

-- CreateIndex
CREATE INDEX "commodities_origin_country_idx" ON "commodities"("origin_country");

-- CreateIndex
CREATE INDEX "commodities_is_active_idx" ON "commodities"("is_active");

-- CreateIndex
CREATE INDEX "commodity_prices_commodity_id_interval_date_idx" ON "commodity_prices"("commodity_id", "interval", "date" DESC);

-- CreateIndex
CREATE INDEX "commodity_prices_commodity_id_date_idx" ON "commodity_prices"("commodity_id", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "commodity_prices_commodity_id_interval_date_source_key" ON "commodity_prices"("commodity_id", "interval", "date", "source");

-- CreateIndex
CREATE INDEX "market_factors_type_date_idx" ON "market_factors"("type", "date" DESC);

-- CreateIndex
CREATE INDEX "market_factors_type_region_date_idx" ON "market_factors"("type", "region", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "market_factors_type_region_date_key" ON "market_factors"("type", "region", "date");

-- CreateIndex
CREATE INDEX "watchlists_user_id_idx" ON "watchlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "watchlists_user_id_name_key" ON "watchlists"("user_id", "name");

-- CreateIndex
CREATE INDEX "watchlist_items_watchlist_id_idx" ON "watchlist_items"("watchlist_id");

-- CreateIndex
CREATE INDEX "watchlist_items_commodity_id_idx" ON "watchlist_items"("commodity_id");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_watchlist_id_commodity_id_key" ON "watchlist_items"("watchlist_id", "commodity_id");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_user_id_name_key" ON "portfolios"("user_id", "name");

-- CreateIndex
CREATE INDEX "group_members_portfolio_id_idx" ON "group_members"("portfolio_id");

-- CreateIndex
CREATE INDEX "group_members_commodity_id_idx" ON "group_members"("commodity_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_portfolio_id_commodity_id_key" ON "group_members"("portfolio_id", "commodity_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "usage_records_subscription_id_idx" ON "usage_records"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_subscription_id_feature_period_start_key" ON "usage_records"("subscription_id", "feature", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "factories_code_key" ON "factories"("code");

-- CreateIndex
CREATE INDEX "factories_country_idx" ON "factories"("country");

-- CreateIndex
CREATE INDEX "factories_active_idx" ON "factories"("active");

-- CreateIndex
CREATE UNIQUE INDEX "beef_cut_taxonomy_cutCode_key" ON "beef_cut_taxonomy"("cutCode");

-- CreateIndex
CREATE INDEX "beef_cut_taxonomy_primal_idx" ON "beef_cut_taxonomy"("primal");

-- CreateIndex
CREATE INDEX "beef_cut_prices_cutCode_date_idx" ON "beef_cut_prices"("cutCode", "date");

-- CreateIndex
CREATE INDEX "beef_cut_prices_factoryId_date_idx" ON "beef_cut_prices"("factoryId", "date");

-- CreateIndex
CREATE INDEX "beef_cut_prices_date_idx" ON "beef_cut_prices"("date");

-- CreateIndex
CREATE UNIQUE INDEX "beef_cut_prices_factoryId_cutCode_date_source_key" ON "beef_cut_prices"("factoryId", "cutCode", "date", "source");

-- CreateIndex
CREATE INDEX "weekly_kills_weekEnding_idx" ON "weekly_kills"("weekEnding");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_kills_country_region_weekEnding_source_key" ON "weekly_kills"("country", "region", "weekEnding", "source");

-- CreateIndex
CREATE UNIQUE INDEX "cold_storage_country_category_date_source_key" ON "cold_storage"("country", "category", "date", "source");

-- CreateIndex
CREATE INDEX "ingestion_logs_source_created_at_idx" ON "ingestion_logs"("source", "created_at");

-- CreateIndex
CREATE INDEX "ingestion_logs_status_created_at_idx" ON "ingestion_logs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "market_news_slug_key" ON "market_news"("slug");

-- CreateIndex
CREATE INDEX "market_news_status_published_at_idx" ON "market_news"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "market_news_category_published_at_idx" ON "market_news"("category", "published_at" DESC);

-- CreateIndex
CREATE INDEX "market_news_commodity_slug_idx" ON "market_news"("commodity_slug");

-- CreateIndex
CREATE INDEX "market_news_author_id_idx" ON "market_news"("author_id");

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
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commodity_prices" ADD CONSTRAINT "commodity_prices_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beef_cut_prices" ADD CONSTRAINT "beef_cut_prices_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_news" ADD CONSTRAINT "market_news_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

