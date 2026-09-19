-- Round-170 批1a: GACC foreign meat-establishment registry snapshot table
-- (source: foodmate jwqyp mirror of 海关总署 进口食品境外生产企业注册,
--  weekly scan of the 6 source countries × 肉类). Species-agnostic by
-- upstream shape — see the FactoryRegistryEntry model doc in schema.prisma.

-- CreateTable
CREATE TABLE "factory_registry_entries" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "approvalNo" TEXT NOT NULL,
    "factoryCode" TEXT,
    "name" TEXT,
    "activities" TEXT,
    "address" TEXT,
    "sourceUrl" TEXT,
    "entryType" TEXT,
    "registryId" INTEGER,
    "status" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "factory_registry_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factory_registry_entries_country_approvalNo_key" ON "factory_registry_entries"("country", "approvalNo");

CREATE INDEX "factory_registry_entries_factoryCode_idx" ON "factory_registry_entries"("factoryCode");
