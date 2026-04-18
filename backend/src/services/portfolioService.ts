import { prisma, logger } from '@/lib';

interface PnLSummary {
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalPnl: number;
  positionCount: number;
  longCount: number;
  shortCount: number;
  positions: Array<{
    id: string;
    commodity: { slug: string; name: string; unit: string };
    side: string;
    quantity: number;
    avgEntryPrice: number;
    currentPrice: number | null;
    unrealizedPnl: number | null;
    realizedPnl: number | null;
  }>;
}

export async function computePortfolioPnL(portfolioId: string): Promise<PnLSummary> {
  const positions = await prisma.position.findMany({
    where: { portfolioId, closedAt: null },
    include: {
      commodity: { select: { slug: true, name: true, unit: true } },
    },
  });

  let totalUnrealizedPnl = 0;
  let totalRealizedPnl = 0;
  let longCount = 0;
  let shortCount = 0;

  const positionDetails = positions.map((p) => {
    const qty = Number(p.quantity);
    const entry = Number(p.avgEntryPrice);
    const current = p.currentPrice ? Number(p.currentPrice) : null;
    const unrealized = current != null ? (current - entry) * qty * (p.side === 'LONG' ? 1 : -1) : null;
    const realized = p.realizedPnl ? Number(p.realizedPnl) : 0;

    if (unrealized != null) totalUnrealizedPnl += unrealized;
    totalRealizedPnl += realized;
    if (p.side === 'LONG') longCount++;
    else shortCount++;

    return {
      id: p.id,
      commodity: p.commodity,
      side: p.side,
      quantity: qty,
      avgEntryPrice: entry,
      currentPrice: current,
      unrealizedPnl: unrealized,
      realizedPnl: realized,
    };
  });

  return {
    totalUnrealizedPnl,
    totalRealizedPnl,
    totalPnl: totalUnrealizedPnl + totalRealizedPnl,
    positionCount: positions.length,
    longCount,
    shortCount,
    positions: positionDetails,
  };
}

export async function updatePositionPrices(commodityId: string): Promise<void> {
  const latestPrice = await prisma.commodityPrice.findFirst({
    where: { commodityId, interval: 'daily' },
    orderBy: { date: 'desc' },
    select: { close: true },
  });

  if (!latestPrice) return;

  const price = Number(latestPrice.close);

  // Batch update all open positions for this commodity in one query
  const result = await prisma.$executeRaw`
    UPDATE positions
    SET current_price = ${price},
        unrealized_pnl = (${price} - avg_entry_price) * quantity * CASE WHEN side = 'LONG' THEN 1 ELSE -1 END
    WHERE commodity_id = ${commodityId}::uuid
      AND closed_at IS NULL
  `;

  if (result > 0) {
    logger.info(`[PortfolioService] Updated ${result} positions for commodity ${commodityId}`);
  }
}
