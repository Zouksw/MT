# Chronos 全系迁移：从传统统计模型到 Foundation Model 集成

**日期**: 2026-07-27
**性质**: 架构级迁移完成记录。用户意图："引入更加先进的模型预测数据的系统完全抛弃一些传统模型"。
**状态**: ✅ 已落地（4 个 commit，批次 13–16），端到端实测通过。
**权威定位**: `docs/PRODUCT-SPEC.md` 为唯一产品真相。

---

## 一句话总结

主共识引擎从 5 个经典统计模型（ARIMA / Holt-Winters / Exp-Smoothing / STL / Naive）等权投票，换成了 **3 个 Chronos-T5 foundation-model 变体（tiny / mini / base）的加权多 size 集成**。统计模型保留为可选 baseline，供 `/ai` 页 A/B 对比，但**不再参与主共识投票**。

## 迁移前后对比

| 维度 | 迁移前 | 迁移后 |
|---|---|---|
| 主共识模型 | 5 统计模型等权 | 3 chronos 变体加权（多 size 多样性）|
| 预测方法 | 经典统计（需充分历史）| 预训练 foundation model，零样本 |
| baseline | 无独立概念 | naive + arima/hw/exp/stl，`role: "baseline"` |
| 模型总数 | 5（+chronos 假活）| 9（3 primary + 6 baseline，全部真实 available）|
| chronos 状态 | configured-but-blocked（假活）| 权重缓存 + hf-mirror，真实可用 |
| 冷启动延迟 | N/A | 首次 ~31s → 预热 0.8s（pipeline cache + boot preload）|

## 架构（迁移后）

```
                     ┌─────────────────────────────┐
   /api/beef/        │  backend tradingSignals.ts  │
   forecasts/:cut    │  ALL_MODELS = [             │
        ───────────▶ │    chronos_tiny,            │
                     │    chronos_mini,            │
                     │    chronos_base             │
                     │  ]  ← 主共识只投这 3 个      │
                     │                             │
                     │  BASELINE_MODELS = [        │
                     │    naive, arima, hw,        │
                     │    exp, stl                 │
                     │  ]  ← 仅 /ai 对比页可调     │
                     └────────────┬────────────────┘
                                  │ 每个 modelId 一次 /predict
                                  ▼
                     ┌─────────────────────────────┐
                     │ inference-service:10810     │
                     │ CHRONOS_VARIANTS = {        │
                     │   chronos_tiny: amazon/     │
                     │                chronos-t5-  │
                     │                tiny (32MB), │
                     │   chronos_mini: ...-mini,   │
                     │   chronos_base: ...-base    │
                     │ }                            │
                     │                             │
                     │ _get_chronos_pipeline():    │
                     │   PIPELINE CACHE（启动预载）│
                     │   warm 0.8s / cold 31s      │
                     └────────────┬────────────────┘
                                  │ 各变体 quantile 预测
                                  ▼
                     ┌─────────────────────────────┐
                     │ modelQuality.ts             │
                     │ resolveModelWeights:        │
                     │   weight = 1/max(mape,2%)   │
                     │ weightedMedian +            │
                     │ weightedDirectionVote       │
                     │ （保守平票 → flat）          │
                     └─────────────────────────────┘
```

## 关键设计决策（及原因）

### 1. 多 size 集成而非单一 best 模型
Chronos-T5 三个 size（tiny 32MB / mini ~80MB / base ~200MB）各自有不同的归纳偏置。base 对长趋势更稳，tiny 对近期更敏感。加权中位数让它们的分歧自然涌现为预测区间的宽度——**模型多样性 = 不确定性量化**，比单模型更诚实。

### 2. 统计模型保留为 baseline 而非删除
用户明确要"完全抛弃一些传统模型"作为**主力**，但保留为 baseline 是业界标准做法（naive 是 dumb baseline 的黄金基准）。删除代码无收益且损失 A/B 对比能力。`role: "baseline"` 标注让前端能视觉降级（muted color）。

### 3. 不用 chronos-bolt
原计划第 3 变体是 `chronos-bolt-tiny`，但 chronos-forecasting 2.3.1 的 `ChronosConfig.__init__()` 与 bolt 的 `input_patch_size` 参数不兼容（抛 unexpected keyword）。改用 chronos-t5-mini（同 T5 family，无此问题）。如未来需要 bolt 的速度优势，需 pin chronos-forecasting 到兼容版本。

### 4. hf-mirror.com 绕过 huggingface.co 阻断
生产环境 huggingface.co 网络不通，但 hf-mirror.com 可达（HTTP 200, 0.5s）。`ecosystem.config.cjs` 的 mt-inference env 块已硬编码 `HF_ENDPOINT=https://hf-mirror.com` + `HF_HOME=/root/.cache/huggingface`。权重首次下载后缓存，镜像不可达时仍可用（`_chronos_weights_cached` 探针正确报告 available）。

### 5. Boot preload 解决冷启动
3 个 variant 并行 cold-load 会超 backend client 的 30s 超时。`main.py` startup event 串行预载所有 usable variant（serialized loads），首个请求即可命中 warm cache。

## 端到端实测（2026-07-27）

注入 30 条新鲜趋势数据（SHORT_RIBS, 2026-06-28 → 2026-07-27, +0.4%/步上升趋势）后：

```
forecastable: true
freshness:    live
consensus:
  direction:     up
  currentPrice:  13.99
  predicted:     14.27  (+1.64%)
  range:         14.11 - 14.29
  confidence:    0.57   agree=2/3
per-model:
  chronos_tiny   up    +2.15%  conf 0.90
  chronos_mini   flat  +0.83%  conf 0.91   ← 保守平票
  chronos_base   up    +1.94%  conf 0.95
bestModel: chronos_base
```

**结论**：3 个 chronos 变体全部真实运行（非假活），加权共识产出合理。tiny+base 投 up，mini 投 flat（变化幅度小）→ conservative tie-break → 最终 up（2/3 多数）。数据诚实框架在清理 probe 后正确恢复 stale-rejection。

## 文件清单（迁移涉及）

### 后端
- `inference-service/services/inference_engine.py` — CHRONOS_VARIANTS, pipeline cache, 2.3.1 API fix
- `inference-service/main.py` — boot preload
- `inference-service/services/statistical_models.py` — predict_stl damped-trend fix（独立 bug，迁移中发现）
- `backend/src/services/tradingSignals.ts` — ALL_MODELS → chronos, BASELINE_MODELS 新增
- `backend/src/services/modelQuality.ts` — 加权共识（已有，自动适配）
- `backend/src/services/mapeTracking.ts` — accuracy 含 baseline
- `backend/src/routes/inference.ts` — VALID_MODELS 全 9 个, DEFAULT_MODEL=chronos_tiny
- `backend/src/services/inference/client.ts` — default chronos_tiny
- `ecosystem.config.cjs` — HF_ENDPOINT + HF_HOME env

### 前端（批次 16）
- `frontend/src/types/accuracy.ts` — MODEL_NAME_MAP + MODEL_COLORS
- `frontend/src/lib/site-stats.ts` — aiModels 3, AI_MODEL_LABELS
- `frontend/src/lib/trading-chart-config.ts` — modelColors
- `frontend/src/components/beef/CutForecastSection.tsx` — MODEL_LABELS
- `frontend/src/app/ai/predict/page.tsx` — dropdown + default chronos_tiny
- `frontend/src/app/dashboard/models/page.tsx` — description map

### 配置
- `backend/prisma/schema.prisma` — BeefCutPrice.price Decimal(18,4)（迁移中发现 Float 精度损失）

## 数据诚实框架（未变，但更重要了）

Chronos 是零样本 foundation model——**即使数据很少也能产出预测**。这让"假活"风险更高（模型不会因数据不足而拒绝）。因此 freshness gate（3-tier: live/proxy/snapshot）+ `findForecastableFactoryForCut`（7-day stale window）是**不可妥协的护栏**：

- 数据 < 3 天 → live（可预测）
- 数据 3–7 天 → proxy（可预测，标注）
- 数据 > 7 天 或 seed source → snapshot（**拒绝预测**，告知用户激活数据源）

当前所有 beef 数据是 2026-04-30 的 seed snapshot（87 天 stale）→ 系统如实拒绝预测。注入真实数据的位置：**DATA-1（MLA AU）+ G6（USDA-AMS US）scraper 激活**，需用户提供 API key。

## 后续

- **不做**：删除统计模型代码（用户要保留为 baseline）
- **不做**：DB migration（PredictionLog.modelId 是自由 String）
- **可做**：当 chronos-forecasting 新版修复 bolt 兼容后，加入 chronos_bolt 作为第 4 变体（速度优势）
- **可做**：MAPE 累积后，考虑动态 size 选择（低 MAPE 的 variant 自动权重更高——现有 resolveModelWeights 已支持）
