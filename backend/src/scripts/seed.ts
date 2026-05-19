/**
 * Database seed script.
 *
 * NOTE: Fake/simulated data generation has been removed.
 * Real data comes from data ingestion scrapers (see services/dataIngestion/).
 * This script is a no-op placeholder to satisfy Prisma seed configuration.
 */

import { logger } from "@/lib/logger";

async function main() {
	logger.info("Seed: no-op (real data comes from ingestion scrapers)");
}

main().catch((e) => {
	logger.error("Seed error:", e);
	process.exit(1);
});
