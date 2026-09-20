# Track record snapshot — 2026-09-20

> Generated 2026-09-20T23:30:04.252Z by backend/scripts/weekly-track-snapshot.ts (read-only).
> 与公开页 /ai/track-record 同源（30d 窗）；方向口径 = 末步涨跌符号 vs 窗前 anchor，flat 排除。
> 混源序列按权威源声明取数（v3.2.0 批2 起 18 slugs 已声明）；未声明混源组无明确 anchor，方向整组排除、MAPE 不受影响。

## Model leaderboard — 30d verified window

| model | median MAPE | direction hit | judged n | verified n |
|---|---|---|---|---|
| naive_forecaster | 1.71 | — | 0 | 10409 |
| exponential_smoothing | 1.74 | 63.2% | 10152 | 10417 |
| arima | 1.78 | 53.3% | 10360 | 10410 |
| chronos_base | 1.82 | 59.2% | 12518 | 13491 |
| chronos_tiny | 1.86 | 59.4% | 12521 | 13493 |
| chronos_mini | 1.87 | 59.2% | 12520 | 13492 |
| holtwinters | 2.07 | 49.6% | 10364 | 10414 |

## 牛肉专段 — beef_carcass_us（IMF PBEEFUSDM 月度基准）

- 最新月度数据点：2026-07-01 = 331.782609 USD/吨
- 下一个滚动验证到期：2026-08-31（最早的 anchor + horizon 月度行）
- 月度预测行分布（status × horizon）：
  - completed / H=1: 7
  - completed / H=3: 7
  - completed / H=10: 7
- 回测证据（冻结）：docs/backtests/beef-monthly-2026-08.md（md5 a138e701483cf490db47e943b3547c97）
- 校准证据（round-164 批0b）：docs/backtests/beef-monthly-consensus-calibration-2026-09.md（共识残差分位 → 共识卡校准 90% 区间）

### 牛肉家族 verified — 30d 窗

- beef_retail_us: 7 行，MAPE 0.16–0.55%，最新验证 2026-09-12
