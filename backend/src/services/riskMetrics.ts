/**
 * Risk Metrics — Pure functions for computing trading risk indicators.
 */

// ── Sharpe Ratio ────────────────────────────────────────────────────────────

export function sharpeRatio(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0;

  const excess = returns.map((r) => r - riskFreeRate);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((a, b) => a + (b - mean) ** 2, 0) / (excess.length - 1);
  const stdDev = Math.sqrt(variance);

  return stdDev === 0 ? 0 : mean / stdDev;
}

// ── Sortino Ratio ───────────────────────────────────────────────────────────

export function sortinoRatio(returns: number[], riskFreeRate = 0): number {
  if (returns.length < 2) return 0;

  const excess = returns.map((r) => r - riskFreeRate);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const downside = excess.filter((r) => r < 0);
  if (downside.length === 0) return mean > 0 ? Infinity : 0;

  const downsideVariance = downside.reduce((a, b) => a + b ** 2, 0) / downside.length;
  const downsideDev = Math.sqrt(downsideVariance);

  return downsideDev === 0 ? 0 : mean / downsideDev;
}

// ── Maximum Drawdown ────────────────────────────────────────────────────────

export function maxDrawdown(equityCurve: number[]): { maxDD: number; peakIndex: number; troughIndex: number } {
  if (equityCurve.length < 2) return { maxDD: 0, peakIndex: 0, troughIndex: 0 };

  let maxDD = 0;
  let peak = equityCurve[0];
  let peakIdx = 0;
  let resultPeakIdx = 0;
  let resultTroughIdx = 0;

  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      peakIdx = i;
    }

    const dd = (peak - equityCurve[i]) / peak;
    if (dd > maxDD) {
      maxDD = dd;
      resultPeakIdx = peakIdx;
      resultTroughIdx = i;
    }
  }

  return { maxDD: maxDD === 0 ? 0 : -maxDD, peakIndex: resultPeakIdx, troughIndex: resultTroughIdx };
}

// ── Value at Risk (VaR) ─────────────────────────────────────────────────────

export function valueAtRisk(returns: number[], confidence = 0.95): number {
  if (returns.length < 10) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);

  return sorted[idx];
}

// ── Calmar Ratio ─────────────────────────────────────────────────────────────

export function calmarRatio(annualizedReturn: number, maxDrawdownPct: number): number {
  if (maxDrawdownPct === 0) return annualizedReturn > 0 ? Infinity : 0;
  return annualizedReturn / Math.abs(maxDrawdownPct);
}

// ── Win Rate ─────────────────────────────────────────────────────────────────

export function winRate(trades: Array<{ realizedPnl: number | null }>): number {
  const closed = trades.filter((t) => t.realizedPnl != null);
  if (closed.length === 0) return 0;
  const wins = closed.filter((t) => (t.realizedPnl as number) > 0).length;
  return wins / closed.length;
}

// ── Profit Factor ────────────────────────────────────────────────────────────

export function profitFactor(trades: Array<{ realizedPnl: number | null }>): number {
  const closed = trades.filter((t) => t.realizedPnl != null);
  if (closed.length === 0) return 0;

  const grossProfit = closed
    .filter((t) => (t.realizedPnl as number) > 0)
    .reduce((sum, t) => sum + (t.realizedPnl as number), 0);

  const grossLoss = Math.abs(
    closed
      .filter((t) => (t.realizedPnl as number) < 0)
      .reduce((sum, t) => sum + (t.realizedPnl as number), 0),
  );

  return grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss;
}

// ── Compute all metrics ─────────────────────────────────────────────────────

export interface RiskReport {
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  var95: number;
  var99: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTrade: number;
  annualizedReturn: number;
}

export function computeRiskReport(
  dailyReturns: number[],
  trades: Array<{ realizedPnl: number | null }>,
): RiskReport {
  const equityCurve: number[] = [];
  let equity = 100000; // hypothetical starting capital
  for (const r of dailyReturns) {
    equity *= 1 + r;
    equityCurve.push(equity);
  }

  const dd = maxDrawdown(equityCurve);
  const totalDays = dailyReturns.length;
  const totalReturn = equityCurve.length > 0
    ? (equityCurve[equityCurve.length - 1] / 100000) - 1
    : 0;
  const annualizedReturn = totalDays > 0
    ? Math.pow(1 + totalReturn, 252 / totalDays) - 1
    : 0;

  return {
    sharpe: sharpeRatio(dailyReturns),
    sortino: sortinoRatio(dailyReturns),
    maxDrawdown: dd.maxDD,
    var95: valueAtRisk(dailyReturns, 0.95),
    var99: valueAtRisk(dailyReturns, 0.99),
    calmar: calmarRatio(annualizedReturn, dd.maxDD),
    winRate: winRate(trades),
    profitFactor: profitFactor(trades),
    totalTrades: trades.length,
    avgTrade: trades.length > 0
      ? trades.reduce((s, t) => s + (t.realizedPnl ?? 0), 0) / trades.length
      : 0,
    annualizedReturn,
  };
}
