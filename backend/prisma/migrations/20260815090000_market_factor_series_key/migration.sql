-- Round-104 / audit C4: the [type, region, date] unique key collapsed all
-- series sharing that triple — 15 FRED "economic"/"US"(or "global") series
-- and USDA-PSD commodity×attribute rows per country overwrote each other on
-- every write. Add seriesKey to the key. Existing rows (prod: 159
-- exchange_rate rows only; economic/supply_demand never landed) default to
-- "" and stay unique under the widened key — no backfill needed.
ALTER TABLE "market_factors" ADD COLUMN "series_key" TEXT NOT NULL DEFAULT '';

DROP INDEX "market_factors_type_region_date_key";
CREATE UNIQUE INDEX "market_factors_type_region_date_series_key_key" ON "market_factors"("type", "region", "date", "series_key");
