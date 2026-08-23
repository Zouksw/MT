# ADR-0001：月度序列的预测语义（cadence-aware prediction semantics）

- **状态**：**Accepted（2026-08-23 用户确认 D5，当日开工批 6b）**。
- **背景**：round-126 起 `beef_carcass_us` = IMF PBEEFUSDM（月度，195 点，全站唯一在更牛肉序列）；round-128 复评发现背景预测循环与牛肉零交集（17 个在预测商品全是汇率/CME）。验证生命周期（到期判定、实际值窗、三处清扫）与调度门控全部 daily 中心化（TECH-DEBT §十四 round-127 登记 + round-129 对抗评审 B1/B2 全清单）。

## Context（为什么必须先定语义）

同一批改动若只修"取数过滤"而不定语义，月度预测会：永远无法验证（到期窗按天算）、被清扫误标 unverifiable、并以 30 分钟节律日产 ~336 条重复日志——重演 round-62/66/114 清理过的病理。以下五点是不可分的语义包。

## Decision（建议方案，五点一体）

1. **horizon 单位 = 步长**：月度序列 horizon N = N 个月（引擎已按最后两点间距外推时间戳，`predict.py:113-123`，天然支持；无需引擎改动）。
2. **验证到期与实际值窗按步长**：`make_interval(months => horizon)`；实际值取月度点，到期 = N 个新月度点落地后。
3. **`prediction_logs` 增可空 `interval` 列**：写入时落库（NULL = daily 时代旧行，**不回填** 14 万行）；验证生命周期按行内 cadence 分流。
4. **月度刷新节律 = 仅新实际点后重预测**：无新月度点则跳过（logPrediction 前置守卫对比最新 actual 日期）；一月最多 7 模型 × 1 轮。
5. **订阅谓词（cadence 感知）**：daily = 现行（7 天窗内 ≥2 点）；monthly = 最新点 ≤60 天 且 全序列 ≥3 点（60 天取自 `cadence.ts` 策略模块，2× 发布节奏，防月内订阅抖动）。

## 显式不做（Non-Goals）

- **correlationAnalysis / analytics 的月度支持**：阻碍是 daily-only 读取与跨节奏对齐无解（非点数不足——195 点对 Pearson 充足）；等日更牛肉数据解锁后随数据解决。
- **旧行 interval 回填**：14 万行重写不值得；NULL=daily 语义兼容。

## Consequences

- 正面：月度牛肉序列进入预测循环且**可验证**（硬验收 = 首条月度预测到达 `verified`）；预测日志增速受控（每新月度点 ~7 行）。
- 代价/风险：`prediction_logs` 加列（一次迁移）；mapeTracking 原生 SQL 需按 cadence 分流（该文件是全仓最高风险区，批 6b 单独成批 + 强制人工检查点）；前端 horizon 标注需区分天/月（批 6c）。
- 回滚：批 6b 独立 commit；订阅门控回退 = 撤销该 commit，旧行为恢复（interval 列留存无害）。

## 关联

- IMPROVEMENT-PLAN.md 第二波 §B 批 6a/6b/6c、§C D5；TECH-DEBT §十四 round-127 登记；COMPETITIVE-ANALYSIS v1.1.1 §七。
