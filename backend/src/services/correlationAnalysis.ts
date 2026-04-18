/**
 * Commodity Correlation Analysis
 *
 * Computes Pearson correlation between commodity price series.
 * Uses rolling window with UTC timezone alignment.
 *
 * API:
 *   GET /api/signals/correlation?commodityIds=id1,id2&window=30
 *   GET /api/signals/correlation/matrix — full pairwise correlation matrix
 */

import { prisma, logger } from '@/lib';

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

const MAX_MATRIX_SIZE = 20;

/**
 * Get price time series from CommodityPrice for a commodity slug
 */
async function getPriceSeries(
  commoditySlug: string,
  windowDays: number
): Promise<Array<{ date: string; value: number }>> {
  const since = new Date(Date.now() - windowDays * 86400000);

  const commodity = await prisma.commodity.findUnique({
    where: { slug: commoditySlug },
    select: { id: true },
  });

  if (!commodity) return [];

  const prices = await prisma.commodityPrice.findMany({
    where: {
      commodityId: commodity.id,
      interval: 'daily',
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
    select: { date: true, close: true },
  });

  return prices
    .filter((p) => p.close !== null)
    .map((p) => ({
      date: p.date.toISOString().split('T')[0],
      value: Number(p.close),
    }));
}

/**
 * Compute Pearson correlation between two price series
 */
function pearsonCorrelation(
  seriesA: Array<{ date: string; value: number }>,
  seriesB: Array<{ date: string; value: number }>
): { correlation: number; sampleSize: number } {
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
    pValue: null,
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
  if (commodityIds.length > MAX_MATRIX_SIZE) {
    logger.warn(`[Correlation] Matrix limited to ${MAX_MATRIX_SIZE} commodities, got ${commodityIds.length}`);
    commodityIds = commodityIds.slice(0, MAX_MATRIX_SIZE);
  }

  const seriesMap = new Map<string, Array<{ date: string; value: number }>>();
  await Promise.all(
    commodityIds.map(async (id) => {
      const series = await getPriceSeries(id, windowDays);
      seriesMap.set(id, series);
    })
  );

  const n = commodityIds.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const result = pearsonCorrelation(
        seriesMap.get(commodityIds[i]) || [],
        seriesMap.get(commodityIds[j]) || []
      );
      matrix[i][j] = result.correlation;
      matrix[j][i] = result.correlation;
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
 * Get list of available commodities for correlation analysis
 */
export async function getAvailableCommodities(): Promise<
  Array<{ id: string; name: string; slug: string; type: string | null }>
> {
  const commodities = await prisma.commodity.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, category: true },
    orderBy: { name: 'asc' },
  });

  return commodities.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    type: c.category,
  }));
}
