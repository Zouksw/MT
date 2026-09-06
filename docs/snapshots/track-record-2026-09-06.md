# Track record snapshot — 2026-09-06

> Generated 2026-09-06T23:30:03.519Z by backend/scripts/weekly-track-snapshot.ts (read-only).
> 与公开页 /ai/track-record 同源（30d 窗）；方向口径 = 末步涨跌符号 vs 窗前 anchor，flat 排除。
> 混源序列按权威源声明取数（v3.2.0 批2 起 18 slugs 已声明）；未声明混源组无明确 anchor，方向整组排除、MAPE 不受影响。

## Model leaderboard — 30d verified window

| model | median MAPE | direction hit | judged n | verified n |
|---|---|---|---|---|
| chronos_tiny | 2.15 | 62.9% | 7933 | 11545 |
| chronos_mini | 2.21 | 61.8% | 7933 | 11544 |
| chronos_base | 2.31 | 61.9% | 7931 | 11543 |
| naive_forecaster | 2.59 | — | 0 | 3769 |
| exponential_smoothing | 2.59 | 52.4% | 3719 | 3769 |
| arima | 2.96 | 59.7% | 3707 | 3757 |
| holtwinters | 6.03 | 49.9% | 3719 | 3769 |

## 牛肉专段 — beef_carcass_us（IMF PBEEFUSDM 月度基准）

- 最新月度数据点：2026-07-01 = 331.782609 USD/吨
- 下一个滚动验证到期：2026-08-31（最早的 anchor + horizon 月度行）
- 月度预测行分布（status × horizon）：
  - completed / H=1: 7
  - completed / H=3: 7
  - completed / H=10: 7
- 回测证据（冻结）：docs/backtests/beef-monthly-2026-08.md（md5 a138e701483cf490db47e943b3547c97）
