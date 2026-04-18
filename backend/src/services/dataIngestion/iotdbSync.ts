/**
 * IoTDB Commodity Sync
 *
 * Syncs commodity prices from PostgreSQL to IoTDB so the AI Node
 * can read them for predictions.
 *
 * Path pattern: root.commodity.{category}.{slug}
 * Example: root.commodity.beef_cuts.brisket_cn
 */

import { prisma, logger } from '@/lib';
import { iotdbClient } from '@/services/iotdb';
import type { IoTDBInsertRecord } from '@/services/iotdb/query-builder';

const COMMODITY_PATH_PREFIX = 'root.commodity';

function commodityPath(category: string, slug: string): string {
  return `${COMMODITY_PATH_PREFIX}.${category}.${slug}`;
}

/**
 * Sync all commodity prices to IoTDB
 * Creates timeseries if they don't exist, then inserts latest price data
 */
export async function syncCommoditiesToIoTDB(): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;

  // Check if IoTDB is available
  let iotdbAvailable: boolean;
  try {
    iotdbAvailable = await iotdbClient.healthCheck();
  } catch {
    iotdbAvailable = false;
  }

  if (!iotdbAvailable) {
    logger.warn('[IoTDB Sync] IoTDB not available, skipping commodity sync');
    return { synced: 0, skipped: 0 };
  }

  const commodities = await prisma.commodity.findMany({
    where: { isActive: true },
    include: {
      prices: {
        where: { interval: 'daily' },
        orderBy: { date: 'desc' },
        take: 100,
        select: { date: true, close: true },
      },
    },
  });

  for (const commodity of commodities) {
    if (commodity.prices.length === 0) {
      skipped++;
      continue;
    }

    const path = commodityPath(commodity.category, commodity.slug);

    try {
      // Ensure timeseries exists
      try {
        await iotdbClient.createTimeseries({
          path: `${path}.close`,
          dataType: 'DOUBLE',
          encoding: 'GORILLA',
        });
      } catch {
        // May already exist — that's fine
      }

      // Insert price data (IoTDB needs chronological order)
      const sorted = [...commodity.prices].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      const records: IoTDBInsertRecord[] = sorted.map((p) => ({
        device: path,
        measurements: ['close'],
        values: [Number(p.close)],
        timestamp: p.date.getTime(),
      }));

      await iotdbClient.insertRecords(records);

      synced++;
    } catch (err) {
      logger.warn(`[IoTDB Sync] Failed to sync ${commodity.slug}: ${err}`);
      skipped++;
    }
  }

  logger.info(`[IoTDB Sync] Synced ${synced} commodities, skipped ${skipped}`);
  return { synced, skipped };
}

/**
 * Get the IoTDB timeseries path for a commodity slug
 */
export async function getCommodityTimeseriesPath(slug: string): Promise<string | null> {
  const commodity = await prisma.commodity.findUnique({
    where: { slug },
    select: { category: true },
  });

  if (!commodity) return null;
  return commodityPath(commodity.category, slug);
}

/**
 * Schedule recurring predictions for all active commodities
 * Only works if IoTDB + AI Node + Redis are all available
 */
export async function scheduleAllCommodityPredictions(): Promise<number> {
  const { scheduleRecurringPredictions } = await import('@/services/predictionQueue');

  let scheduled = 0;

  const commodities = await prisma.commodity.findMany({
    where: { isActive: true, category: { not: 'forex' } },
  });

  for (const commodity of commodities) {
    const tsPath = `${commodityPath(commodity.category, commodity.slug)}.close`;
    try {
      await scheduleRecurringPredictions(commodity.id, tsPath, 10);
      scheduled++;
    } catch (err) {
      logger.warn(`[Predictions] Failed to schedule for ${commodity.slug}: ${err}`);
    }
  }

  logger.info(`[Predictions] Scheduled recurring predictions for ${scheduled}/${commodities.length} commodities`);
  return scheduled;
}
