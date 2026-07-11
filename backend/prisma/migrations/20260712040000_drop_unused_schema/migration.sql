-- DropForeignKey
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_commodity_id_fkey";

-- DropForeignKey
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_portfolio_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_members" DROP CONSTRAINT "organization_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_queries" DROP CONSTRAINT "saved_queries_user_id_fkey";

-- DropIndex
DROP INDEX "subscriptions_stripe_customer_id_idx";

-- AlterTable
ALTER TABLE "group_members" DROP CONSTRAINT "group_members_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "portfolio_id" SET DATA TYPE TEXT,
ALTER COLUMN "commodity_id" SET DATA TYPE TEXT,
ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id",
DROP COLUMN "stripe_price_id",
DROP COLUMN "stripe_sub_id";

-- DropTable
DROP TABLE "organization_members";

-- DropTable
DROP TABLE "saved_queries";

-- CreateIndex
CREATE INDEX "watchlist_items_commodity_id_idx" ON "watchlist_items"("commodity_id");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_commodity_id_fkey" FOREIGN KEY ("commodity_id") REFERENCES "commodities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
