/**
 * Commodity Correlation Analysis
 *
 * Computes Pearson correlation between commodity price series.
 * Uses 30-day rolling window with UTC timezone alignment.
 *
 * API:
 *   GET /api/signals/correlation?commodityIds=id1,id2&window=30
 *   GET /api/signals/correlation/matrix — full pairwise correlation matrix
 */

import { prisma } from '@/lib';
import { logger } from '@/lib';

export interface CorrelationResult {
  commodityA: string;
  commodityB: string;
  correlation: number;       // -1 to 1
  pValue: number | null;
  sampleSize: number;
  windowDays: number;
  asOfDate: string;
}

export interface CorrelationMatrix {
  commodities: string[];
  matrix: number[][];        // NxN, diagonal = 1
  windowDays: number;
  asOfDate: string;
}

/**
 * Get price time series from PostgreSQL for a commodity
 */
async function getPriceSeries(
  commodityId: string,
  windowDays: number
): Promise<Array<{ date: string; value: number }>> {
  const since = new Date(Date.now() - windowDays * 86400000);

  // Get timeseries for this dataset
  const timeseries = await prisma.timeseries.findFirst({
    where: {
      dataset: { slug: commodityId },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!timeseries) return [];

  // Get price datapoints within window
  const datapoints = await prisma.datapoint.findMany({
    where: {
      timeseriesId: timeseries.id,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      valueJson: true,
    },
  });

  return datapoints
    .map((dp) => {
      const vj = dp.valueJson as Record<string, any>;
      // Try different price field names
      const value =
        vj?.buy ?? vj?.futures ?? vj?.futures_usd_ton ?? vj?.spot_cny_kg ?? vj?.value;
      if (typeof value !== 'number') return null;
      return {
        date: dp.timestamp.toISOString().split('T')[0],
        value,
      };
    })
    .filter((d): d is { date: string; value: number } => d !== null);
}

/**
 * Compute Pearson correlation between two price series
 */
function pearsonCorrelation(
  seriesA: Array<{ date: string; value: number }>,
  seriesB: Array<{ date: string; value: number }>
): { correlation: number; sampleSize: number } {
  // Align by date (inner join)
  const mapB = new Map(seriesB.map((s) => [s.date, s.value]));

  const pairs: Array<[number, number]> = [];
  for (const a of seriesA) {
    const bVal = mapB.get(a.date);
    if (bVal !== undefined) {
      pairs.push([a.value, bVal]);
    }
  }

  const n = pairs.length;
  if (n < 3) return { correlation: 0, sampleSize: n };

  // Compute Pearson r
  const sumA = pairs.reduce((s, [a]) => s + a, 0);
  const sumB = pairs.reduce((s, [, b]) => s + b, 0);
  const meanA = sumA / n;
  const meanB = sumB / n;

  let covAB = 0;
  let varA = 0;
  let varB = 0;

  for (const [a, b] of pairs) {
    const da = a - meanA;
    const db = b - meanB;
    covAB += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return { correlation: 0, sampleSize: n };

  const r = covAB / denom;
  // Clamp to [-1, 1] (floating point safety)
  return {
    correlation: Math.max(-1, Math.min(1, Math.round(r * 10000) / 10000)),
    sampleSize: n,
  };
}

/**
 * Compute correlation between two commodities
 */
export async function computeCorrelation(
  commodityA: string,
  commodityB: string,
  windowDays: number = 30
): Promise<CorrelationResult> {
  const [seriesA, seriesB] = await Promise.all([
    getPriceSeries(commodityA, windowDays),
    getPriceSeries(commodityB, windowDays),
  ]);

  const result = pearsonCorrelation(seriesA, seriesB);

  return {
    commodityA,
    commodityB,
    correlation: result.correlation,
    pValue: null, // Would need jstat or similar for exact p-value
    sampleSize: result.sampleSize,
    windowDays,
    asOfDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Compute full correlation matrix for all commodities
 */
export async function computeCorrelationMatrix(
  commodityIds: string[],
  windowDays: number = 30
): Promise<CorrelationMatrix> {
  // Load all series in parallel
  const seriesMap = new Map<string, Array<{ date: string; value: number }>>();
  await Promise.all(
    commodityIds.map(async (id) => {
      const series = await getPriceSeries(id, windowDays);
      seriesMap.set(id, series);
    })
  );

  const n = commodityIds.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  // Compute pairwise correlations
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-correlation = 1
    for (let j = i + 1; j < n; j++) {
      const result = pearsonCorrelation(
        seriesMap.get(commodityIds[i]) || [],
        seriesMap.get(commodityIds[j]) || []
      );
      matrix[i][j] = result.correlation;
      matrix[j][i] = result.correlation; // Symmetric
    }
  }

  return {
    commodities: commodityIds,
    matrix,
    windowDays,
    asOfDate: new Date().toISOString().split('T')[0],
  };
}

/**
 * Get list of available commodities (datasets with commodityType)
 */
export async function getAvailableCommodities(): Promise<
  Array<{ id: string; name: string; slug: string; type: string | null }>
> {
  const datasets = await prisma.dataset.findMany({
    where: { commodityType: { not: null } },
    select: { id: true, name: true, slug: true, commodityType: true },
    orderBy: { name: 'asc' },
  });

  return datasets.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    type: d.commodityType,
  }));
}
