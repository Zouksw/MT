-- AlterTable: add missing columns to datasets (not covered by second migration)
-- Note: commodity_type, currency, exchange, timezone, unit were added by 20260408 migration.
-- This catches any remaining column differences.

-- CreateIndex: additional indexes on existing tables
CREATE INDEX "datasets_last_accessed_at_idx" ON "datasets"("last_accessed_at" DESC);

CREATE INDEX "api_keys_last_used_at_idx" ON "api_keys"("last_used_at");

-- CreateTable
CREATE TABLE "prediction_logs" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "timeseries_path" TEXT NOT NULL,
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
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "portfolio_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'LONG',
    "quantity" DECIMAL(18,6) NOT NULL,
    "avg_entry_price" DECIMAL(18,6) NOT NULL,
    "current_price" DECIMAL(18,6),
    "unrealized_pnl" DECIMAL(18,6),
    "realized_pnl" DECIMAL(18,6),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initial_balance" DECIMAL(18,2) NOT NULL,
    "current_balance" DECIMAL(18,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "simulation_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_orders" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "price" DECIMAL(18,6),
    "stop_price" DECIMAL(18,6),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filled_price" DECIMAL(18,6),
    "filled_quantity" DECIMAL(18,6),
    "commission" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filled_at" TIMESTAMP(3),

    CONSTRAINT "simulation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_trades" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "commodity_id" TEXT NOT NULL,
    "order_id" TEXT,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "entry_price" DECIMAL(18,6) NOT NULL,
    "exit_price" DECIMAL(18,6),
    "realized_pnl" DECIMAL(18,6),
    "commission" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "simulation_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_signals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "commodity_slug" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "reasoning" TEXT,
    "current_price" DECIMAL(18,6),
    "target_price" DECIMAL(18,6),
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_comments" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_likes" (
    "id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_sub_id" TEXT,
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
    "price" DOUBLE PRECISION NOT NULL,
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

-- CreateIndex: prediction_logs
CREATE INDEX "prediction_logs_model_id_idx" ON "prediction_logs"("model_id");

CREATE INDEX "prediction_logs_commodity_id_idx" ON "prediction_logs"("commodity_id");

CREATE INDEX "prediction_logs_predicted_at_idx" ON "prediction_logs"("predicted_at");

-- CreateIndex: commodities
CREATE UNIQUE INDEX "commodities_slug_key" ON "commodities"("slug");

CREATE INDEX "commodities_category_idx" ON "commodities"("category");

CREATE INDEX "commodities_origin_country_idx" ON "commodities"("origin_country");

CREATE INDEX "commodities_is_active_idx" ON "commodities"("is_active");

-- CreateIndex: commodity_prices
CREATE INDEX "commodity_prices_commodity_id_interval_date_idx" ON "commodity_prices"("commodity_id", "interval", "date" DESC);

CREATE INDEX "commodity_prices_commodity_id_date_idx" ON "commodity_prices"("commodity_id", "date" DESC);

CREATE UNIQUE INDEX "commodity_prices_commodity_id_interval_date_source_key" ON "commodity_prices"("commodity_id", "interval", "date", "source");

-- CreateIndex: market_factors
CREATE INDEX "market_factors_type_date_idx" ON "market_factors"("type", "date" DESC);

CREATE INDEX "market_factors_type_region_date_idx" ON "market_factors"("type", "region", "date" DESC);

CREATE UNIQUE INDEX "market_factors_type_region_date_key" ON "market_factors"("type", "region", "date");

-- CreateIndex: watchlists
CREATE INDEX "watchlists_user_id_idx" ON "watchlists"("user_id");

CREATE UNIQUE INDEX "watchlists_user_id_name_key" ON "watchlists"("user_id", "name");

-- CreateIndex: watchlist_items
CREATE INDEX "watchlist_items_watchlist_id_idx" ON "watchlist_items"("watchlist_id");

CREATE UNIQUE INDEX "watchlist_items_watchlist_id_commodity_id_key" ON "watchlist_items"("watchlist_id", "commodity_id");

-- CreateIndex: portfolios
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

CREATE UNIQUE INDEX "portfolios_user_id_name_key" ON "portfolios"("user_id", "name");

-- CreateIndex: positions
CREATE INDEX "positions_portfolio_id_idx" ON "positions"("portfolio_id");

CREATE INDEX "positions_commodity_id_idx" ON "positions"("commodity_id");

CREATE INDEX "positions_closed_at_idx" ON "positions"("closed_at");

-- CreateIndex: simulation_accounts
CREATE INDEX "simulation_accounts_user_id_idx" ON "simulation_accounts"("user_id");

-- CreateIndex: simulation_orders
CREATE INDEX "simulation_orders_account_id_idx" ON "simulation_orders"("account_id");

CREATE INDEX "simulation_orders_status_idx" ON "simulation_orders"("status");

-- CreateIndex: simulation_trades
CREATE INDEX "simulation_trades_account_id_idx" ON "simulation_trades"("account_id");

CREATE INDEX "simulation_trades_opened_at_idx" ON "simulation_trades"("opened_at");

-- CreateIndex: shared_signals
CREATE INDEX "shared_signals_user_id_idx" ON "shared_signals"("user_id");

CREATE INDEX "shared_signals_created_at_idx" ON "shared_signals"("created_at" DESC);

CREATE INDEX "shared_signals_commodity_slug_idx" ON "shared_signals"("commodity_slug");

-- CreateIndex: signal_comments
CREATE INDEX "signal_comments_signal_id_idx" ON "signal_comments"("signal_id");

CREATE INDEX "signal_comments_user_id_idx" ON "signal_comments"("user_id");

-- CreateIndex: signal_likes
CREATE INDEX "signal_likes_signal_id_idx" ON "signal_likes"("signal_id");

CREATE UNIQUE INDEX "signal_likes_signal_id_user_id_key" ON "signal_likes"("signal_id", "user_id");

-- CreateIndex: subscriptions
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");

CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex: usage_records
CREATE INDEX "usage_records_subscription_id_idx" ON "usage_records"("subscription_id");

CREATE UNIQUE INDEX "usage_records_subscription_id_feature_period_start_key" ON "usage_records"("subscription_id", "feature", "period_start");

-- CreateIndex: factories
CREATE UNIQUE INDEX "factories_code_key" ON "factories"("code");

CREATE INDEX "factories_country_idx" ON "factories"("country");

CREATE INDEX "factories_active_idx" ON "factories"("active");

-- CreateIndex: beef_cut_taxonomy
CREATE UNIQUE INDEX "beef_cut_taxonomy_cutCode_key" ON "beef_cut_taxonomy"("cutCode");

CREATE INDEX "beef_cut_taxonomy_primal_idx" ON "beef_cut_taxonomy"("primal");

-- CreateIndex: beef_cut_prices
CREATE INDEX "beef_cut_prices_cutCode_date_idx" ON "beef_cut_prices"("cutCode", "date");

CREATE INDEX "beef_cut_prices_factoryId_date_idx" ON "beef_cut_prices"("factoryId", "date");

CREATE INDEX "beef_cut_prices_date_idx" ON "beef_cut_prices"("date");

CREATE UNIQUE INDEX "beef_cut_prices_factoryId_cutCode_date_source_key" ON "beef_cut_prices"("factoryId", "cutCode", "date", "source");

-- CreateIndex: weekly_kills
CREATE INDEX "weekly_kills_weekEnding_idx" ON "weekly_kills"("weekEnding");

CREATE UNIQUE INDEX "weekly_kills_country_region_weekEnding_source_key" ON "weekly_kills"("country", "region", "weekEnding", "source");

-- CreateIndex: cold_storage
CREATE UNIQUE INDEX "cold_storage_country_category_date_source_key" ON "cold_storage"("country", "category", "date", "source");

-- CreateIndex: ingestion_logs
CREATE INDEX "ingestion_logs_source_created_at_idx" ON "ingestion_logs"("source", "created_at");

CREATE INDEX "ingestion_logs_status_created_at_idx" ON "ingestion_logs"("status", "created_at");

-- AddForeignKey: new tables referencing existing tables
ALTER TABLE "commodity_prices" ADD CONSTRAINT "commodity_prices_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlist_id_fkey" FOREIGN KEY ("watchlist_id") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "positions" ADD CONSTRAINT "positions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "positions" ADD CONSTRAINT "positions_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "simulation_accounts" ADD CONSTRAINT "simulation_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "simulation_orders" ADD CONSTRAINT "simulation_orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "simulation_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "simulation_orders" ADD CONSTRAINT "simulation_orders_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "simulation_trades" ADD CONSTRAINT "simulation_trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "simulation_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "simulation_trades" ADD CONSTRAINT "simulation_trades_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shared_signals" ADD CONSTRAINT "shared_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signal_comments" ADD CONSTRAINT "signal_comments_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "shared_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signal_comments" ADD CONSTRAINT "signal_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signal_likes" ADD CONSTRAINT "signal_likes_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "shared_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "signal_likes" ADD CONSTRAINT "signal_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beef_cut_prices" ADD CONSTRAINT "beef_cut_prices_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
