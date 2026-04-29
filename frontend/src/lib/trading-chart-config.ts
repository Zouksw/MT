/**
 * Trading Chart Color Configuration
 *
 * Amber-themed colors for trading dashboard charts.
 * Global app uses gold (#B8860B) — trading dashboard uses amber (#F59E0B).
 */

export const TRADING_COLORS = {
  // Primary amber palette
  primary: '#F59E0B',
  primaryLight: '#FEF3C7',
  primaryDark: '#D97706',

  // Signal colors
  buy: '#10B981',
  buyBg: '#ECFDF5',
  sell: '#EF4444',
  sellBg: '#FEF2F2',
  hold: '#64748B',
  holdBg: '#F8FAFC',

  // Chart colors
  forecastLine: '#F59E0B',
  historicalLine: '#94A3B8',
  confidenceBand: 'rgba(245, 158, 11, 0.15)',
  confidenceBorder: 'rgba(245, 158, 11, 0.3)',
  supportLine: '#10B981',
  resistanceLine: '#EF4444',
  anomalyDot: '#EF4444',

  // Model-specific chart colors (for multi-model overlay)
  modelColors: {
    arima: '#F59E0B',
    holtwinters: '#B8860B',
    exponential_smoothing: '#8B5CF6',
    naive_forecaster: '#64748B',
    stl_forecaster: '#EC4899',
    timer_xl: '#14B8A6',
    sundial: '#F97316',
  } as Record<string, string>,

  // Forecast zone annotation
  forecastZone: {
    fill: 'rgba(245, 158, 11, 0.05)',
    stroke: 'rgba(245, 158, 11, 0.2)',
  },
} as const;
