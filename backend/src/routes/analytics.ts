import { Router } from 'express';
import { authenticate, type AuthRequest } from '@/middleware/auth';
import { asyncHandler, NotFoundError } from '@/middleware/errorHandler';
import { success } from '@/lib/response';
import { prisma } from '@/lib';
import { computeRiskReport } from '@/services/riskMetrics';

const router = Router();

// GET /api/analytics/risk/:accountId — Risk metrics for simulation account
router.get(
  '/risk/:accountId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const account = await prisma.simulationAccount.findUnique({
      where: { id: req.params.accountId },
    });

    if (!account || account.userId !== req.userId) {
      throw new NotFoundError('Simulation account');
    }

    const trades = await prisma.simulationTrade.findMany({
      where: { accountId: req.params.accountId },
      orderBy: { openedAt: 'asc' },
    });

    // Convert Prisma Decimal to plain numbers
    const plainTrades = trades.map((t) => ({
      realizedPnl: t.realizedPnl ? Number(t.realizedPnl) : null,
    }));

    // Generate daily returns from trade PnL
    const dailyPnl = new Map<string, number>();
    for (const trade of trades) {
      if (trade.closedAt && trade.realizedPnl) {
        const day = trade.closedAt.toISOString().slice(0, 10);
        dailyPnl.set(day, (dailyPnl.get(day) || 0) + Number(trade.realizedPnl));
      }
    }

    const dailyReturns = Array.from(dailyPnl.values()).map(
      (pnl) => pnl / Number(account.initialBalance),
    );

    const report = computeRiskReport(dailyReturns, plainTrades);

    success(res, { risk: report });
  }),
);

// GET /api/analytics/seasonality/:commoditySlug — Seasonality analysis
router.get(
  '/seasonality/:commoditySlug',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const commodity = await prisma.commodity.findUnique({
      where: { slug: req.params.commoditySlug },
    });
    if (!commodity) {
      throw new NotFoundError('Commodity');
    }

    // Use SQL aggregation instead of loading all rows into memory
    const FIVE_YEARS_AGO = new Date();
    FIVE_YEARS_AGO.setFullYear(FIVE_YEARS_AGO.getFullYear() - 5);

    const monthlyAgg = await prisma.$queryRaw<
      Array<{ month: number; avg_price: number; min_price: number; max_price: number; sample_count: number }>
    >`
      SELECT EXTRACT(MONTH FROM date)::int AS month,
             AVG(close)::float AS avg_price,
             MIN(close)::float AS min_price,
             MAX(close)::float AS max_price,
             COUNT(*)::int AS sample_count
      FROM commodity_prices
      WHERE commodity_id = ${commodity.id}::uuid
        AND interval = 'daily'
        AND date >= ${FIVE_YEARS_AGO}
      GROUP BY EXTRACT(MONTH FROM date)
      ORDER BY month
    `;

    const seasonality = monthlyAgg.map((row) => ({
      month: row.month,
      avgPrice: row.avg_price,
      minPrice: row.min_price,
      maxPrice: row.max_price,
      sampleCount: row.sample_count,
    }));

    seasonality.sort((a, b) => a.month - b.month);

    success(res, { commodity, seasonality });
  }),
);

// GET /api/analytics/correlation — Price correlation matrix
router.get(
  '/correlation',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const slugs = req.query.slugs as string;
    if (!slugs) {
      return success(res, { correlations: [] });
    }

    const slugList = slugs.split(',').slice(0, 10);
    const commodities = await prisma.commodity.findMany({
      where: { slug: { in: slugList } },
      include: {
        prices: {
          where: { interval: 'daily' },
          orderBy: { date: 'desc' },
          take: 90,
          select: { date: true, close: true },
        },
      },
    });

    // Compute returns for each commodity, keyed by date for proper alignment
    const returnsMap = new Map<string, Map<string, number>>();
    for (const c of commodities) {
      const dailyReturns = new Map<string, number>();
      const sorted = [...c.prices].sort((a, b) => a.date.getTime() - b.date.getTime());
      for (let i = 1; i < sorted.length; i++) {
        const prev = Number(sorted[i - 1].close);
        const curr = Number(sorted[i].close);
        if (prev > 0) {
          const dateKey = sorted[i].date.toISOString().slice(0, 10);
          dailyReturns.set(dateKey, (curr - prev) / prev);
        }
      }
      returnsMap.set(c.slug, dailyReturns);
    }

    // Correlation matrix — align by common dates
    const correlations: Array<{ a: string; b: string; corr: number }> = [];
    for (let i = 0; i < commodities.length; i++) {
      for (let j = i; j < commodities.length; j++) {
        const a = commodities[i].slug;
        const b = commodities[j].slug;
        const rA = returnsMap.get(a) || new Map();
        const rB = returnsMap.get(b) || new Map();

        const alignedA: number[] = [];
        const alignedB: number[] = [];
        for (const [dateKey, ret] of rA) {
          const otherRet = rB.get(dateKey);
          if (otherRet !== undefined) {
            alignedA.push(ret);
            alignedB.push(otherRet);
          }
        }

        if (alignedA.length < 5) {
          correlations.push({ a, b, corr: 0 });
          continue;
        }

        const corr = pearsonCorrelation(alignedA, alignedB);
        correlations.push({ a, b, corr });
      }
    }

    success(res, { correlations });
  }),
);

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

export { router as analyticsRouter };
