-- TD-2: drop single-tenant organization scaffolding.
-- organizations had 2 rows (seed + runtime default), datasets referenced 1;
-- no tenant isolation ever existed (datasetService hardcoded "default-org-id").

DROP INDEX IF EXISTS "datasets_organization_id_slug_key";
ALTER TABLE "datasets" DROP CONSTRAINT "datasets_organization_id_fkey";
ALTER TABLE "datasets" DROP COLUMN "organization_id";
DROP TABLE "organizations";
CREATE UNIQUE INDEX "datasets_slug_key" ON "datasets"("slug");
