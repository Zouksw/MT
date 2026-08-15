-- BeefCutPrice.price: Float → Decimal(18,4)
-- A money field on Float accumulates rounding error and breaks deterministic
-- equality. Decimal(18,4) gives sub-$0.0001 precision — ample for USD/kg beef.
-- PostgreSQL real→numeric conversion is lossless and preserves existing values.
ALTER TABLE "beef_cut_prices" ALTER COLUMN "price" TYPE DECIMAL(18,4) USING "price"::numeric(18,4);
