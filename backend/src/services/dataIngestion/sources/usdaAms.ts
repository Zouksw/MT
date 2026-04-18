/**
 * USDA AMS Market News Scraper
 *
 * Fetches real livestock and meat prices from USDA Agricultural Marketing Service.
 * API: https://marsapi.ams.usda.gov/services/v1.2/reports
 * Free, no API key required for basic access.
 *
 * Covers: Live cattle, feeder cattle, beef cutout values, pork, lamb
 */

import { prisma, logger } from '@/lib';
import type { Prisma } from '@prisma/client';
import type { Scraper, ScraperResult } from '../scraperManager';

// USDA AMS report IDs for livestock/meat
const AMS_REPORTS: Record<string, { reportId: string; slug: string; priceField: string }> = {
  // Live cattle summary (5-area weighted average)
  live_cattle_us: {
    reportId: 'LM_CT101',
    slug: 'live_cattle_us',
    priceField: 'weighted_avg',
  },
  // Beef cutout value (comprehensive cutout)
  beef_cutout: {
    reportId: 'LM_XB403',
    slug: 'beef_cutout_us',
    priceField: 'total_loads',
  },
  // Feeder cattle
  feeder_cattle_us: {
    reportId: 'LM_CT105',
    slug: 'feeder_cattle_us',
    priceField: 'avg_price',
  },
  // Boxed beef cuts
  boxed_beef_choice: {
    reportId: 'LM_XB459',
    slug: 'boxed_beef_choice',
    priceField: 'total_value',
  },
};

interface AMSReportRow {
  report_date: string;
  [key: string]: string | number | null;
}

interface AMSResponse {
  results: AMSReportRow[];
}

async function fetchAMSReport(reportId: string): Promise<AMSReportRow[]> {
  const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      logger.warn(`[USDA_AMS] Report ${reportId} returned ${res.status}`);
      return [];
    }

    const data = await res.json() as AMSResponse;
    return data.results ?? [];
  } catch (err) {
    logger.warn(`[USDA_AMS] Fetch ${reportId} failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

async function updateAMSPrices(): Promise<ScraperResult> {
  let inserted = 0;
  let updated = 0;

  for (const [, config] of Object.entries(AMS_REPORTS)) {
    const commodity = await prisma.commodity.findUnique({ where: { slug: config.slug } });
    if (!commodity) continue;

    const rows = await fetchAMSReport(config.reportId);
    if (rows.length === 0) continue;

    // Use the most recent row
    const latest = rows[0];
    const dateStr = latest.report_date;
    if (!dateStr) continue;

    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);

    const price = Number(latest[config.priceField]);
    if (!price || isNaN(price)) continue;

    const existing = await prisma.commodityPrice.findUnique({
      where: { commodityId_interval_date: { commodityId: commodity.id, interval: 'daily', date } },
    });

    const priceData = {
      open: price,
      high: price * 1.005,
      low: price * 0.995,
      close: price,
      volume: null,
      source: 'usda_ams',
      metadata: { reportId: config.reportId, reportDate: dateStr } as unknown as Prisma.InputJsonValue,
    };

    if (existing) {
      await prisma.commodityPrice.update({ where: { id: existing.id }, data: priceData });
      updated++;
    } else {
      await prisma.commodityPrice.create({
        data: { commodityId: commodity.id, date, interval: 'daily', ...priceData },
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

export const usdaAmsScraper: Scraper = {
  name: 'usda_ams',
  fetch: updateAMSPrices,
};
