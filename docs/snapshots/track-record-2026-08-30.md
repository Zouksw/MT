# Track record snapshot — 2026-08-30

> Generated 2026-08-30T11:50:05.952Z by backend/scripts/weekly-track-snapshot.ts (read-only).
> 与公开页 /ai/track-record 同源（30d 窗）；方向口径 = 末步涨跌符号 vs 窗前 anchor，flat 排除。

## Model leaderboard — 30d verified window

| model | median MAPE | direction hit | judged n | verified n |
|---|---|---|---|---|
| holtwinters | 0.31 | 33.8% | 74 | 2749 |
| naive_forecaster | 0.35 | — | 0 | 2749 |
| arima | 0.35 | 58.9% | 73 | 2748 |
| exponential_smoothing | 0.35 | 68.9% | 74 | 2749 |
| chronos_mini | 1.28 | 70.0% | 2240 | 6544 |
| chronos_base | 1.29 | 68.5% | 2239 | 6544 |
| chronos_tiny | 1.32 | 70.1% | 2240 | 6545 |

## 牛肉专段 — beef_carcass_us（IMF PBEEFUSDM 月度基准）

- 最新月度数据点：2026-07-01 = 331.782609 USD/吨
- 下一个滚动验证到期：2026-08-31（最早的 anchor + horizon 月度行）
- 月度预测行分布（status × horizon）：
  - completed / H=1: 7
  - completed / H=3: 7
  - completed / H=10: 7
- 回测证据（冻结）：docs/backtests/beef-monthly-2026-08.md（md5 a138e701483cf490db47e943b3547c97）
