# Track record snapshot — 2026-08-30

> Generated 2026-08-30T23:30:03.875Z by backend/scripts/weekly-track-snapshot.ts (read-only).
> 与公开页 /ai/track-record 同源（30d 窗）；方向口径 = 末步涨跌符号 vs 窗前 anchor，flat 排除。
> 混源序列按权威源声明取数（v3.2.0 批2 起 18 slugs 已声明）；未声明混源组无明确 anchor，方向整组排除、MAPE 不受影响。

## Model leaderboard — 30d verified window

| model | median MAPE | direction hit | judged n | verified n |
|---|---|---|---|---|
| holtwinters | 0.31 | 42.8% | 159 | 2822 |
| naive_forecaster | 0.35 | — | 0 | 2822 |
| exponential_smoothing | 0.35 | 69.2% | 159 | 2822 |
| arima | 0.38 | 67.7% | 158 | 2821 |
| chronos_mini | 1.4 | 64.2% | 3102 | 7142 |
| chronos_tiny | 1.41 | 63.5% | 3102 | 7143 |
| chronos_base | 1.41 | 63.6% | 3099 | 7140 |

## 牛肉专段 — beef_carcass_us（IMF PBEEFUSDM 月度基准）

- 最新月度数据点：2026-07-01 = 331.782609 USD/吨
- 下一个滚动验证到期：2026-08-31（最早的 anchor + horizon 月度行）
- 月度预测行分布（status × horizon）：
  - completed / H=1: 7
  - completed / H=3: 7
  - completed / H=10: 7
- 回测证据（冻结）：docs/backtests/beef-monthly-2026-08.md（md5 a138e701483cf490db47e943b3547c97）
