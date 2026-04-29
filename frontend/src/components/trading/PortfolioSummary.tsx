"use client";

import { Tag } from "@/components/ui/Tag";
import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePortfolios, usePortfolioPerformance } from "@/lib/watchlist";

export default function PortfolioSummary() {
  const { portfolios, loading } = usePortfolios();

  if (loading) {
    return (
      <div className="rounded-lg bg-card border p-5 animate-pulse">
        <div className="h-6 bg-muted rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (portfolios.length === 0) {
    return (
      <div className="rounded-lg bg-card border p-8 text-center">
        <p className="text-muted-foreground">No analysis groups yet. Create a group to track related commodities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {portfolios.map((p) => (
        <GroupCard key={p.id} portfolio={p} />
      ))}
    </div>
  );
}

function PriceChangeIndicator({ value }: { value: number | null }) {
  if (value === null) return <span className="text-sm text-muted-foreground">--</span>;
  if (value > 0) return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
      <TrendingUp className="size-3.5" /> +{value.toFixed(2)}
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600 dark:text-red-400">
      <TrendingDown className="size-3.5" /> {value.toFixed(2)}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
      <Minus className="size-3.5" /> 0.00
    </span>
  );
}

function GroupCard({ portfolio }: { portfolio: { id: string; name: string; description: string | null; isDefault: boolean; positionCount: number } }) {
  const { performance, loading } = usePortfolioPerformance(portfolio.id);

  return (
    <div className="rounded-lg bg-card border">
      <div className="px-5 py-3 border-b flex items-center gap-2">
        <Scale className="size-4 text-primary" />
        <span className="font-semibold">{portfolio.name}</span>
        {portfolio.isDefault && <Tag color="primary">Default</Tag>}
        {portfolio.description && (
          <span className="text-xs text-muted-foreground ml-2">{portfolio.description}</span>
        )}
      </div>
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : performance ? (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Avg. Price Change</span>
                <PriceChangeIndicator value={performance.totalPnl} />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Pending Change</span>
                <PriceChangeIndicator value={performance.totalUnrealizedPnl} />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Tracked</span>
                <span className="text-lg font-semibold">{performance.positionCount}</span>
                <span className="text-xs text-muted-foreground block">commodities</span>
              </div>
            </div>
            {performance.positions.length > 0 && (
              <div className="divide-y divide-border">
                {performance.positions.map((pos) => {
                  const changePercent = pos.avgEntryPrice > 0 && pos.currentPrice !== null
                    ? ((pos.currentPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100
                    : null;
                  return (
                    <div key={pos.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{pos.commodity.name}</span>
                        <span className="text-xs text-muted-foreground">{pos.commodity.unit}</span>
                      </div>
                      <div className="text-right">
                        {pos.currentPrice !== null && (
                          <div className="text-sm font-mono">{pos.currentPrice.toFixed(2)}</div>
                        )}
                        {changePercent !== null && (
                          <div className={`text-xs font-mono ${changePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No tracked commodities</p>
        )}
      </div>
    </div>
  );
}
