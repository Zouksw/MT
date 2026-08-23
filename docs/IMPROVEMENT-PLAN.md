---
title: "改进方案 — 竞争分析落地执行计划"
en_title: "Improvement Plan — Executing the Competitive Analysis"
version: "1.0.0"
last_updated: "2026-08-23"
status: "active"
maintainer: "MT Team"
tags:
  - roadmap
  - execution-plan
target_audience: "Maintainer"
related_docs:
  - "Competitive Analysis": "COMPETITIVE-ANALYSIS-MOOKET.md"
  - "Product Spec": "PRODUCT-SPEC.md"
  - "Tech Debt": "TECH-DEBT.md"
---

# 改进方案 — 按 [牧集对标分析](COMPETITIVE-ANALYSIS-MOOKET.md) 制定的执行计划

> **2026-08-23**。目标：把对标分析的四条结论（数据解冻是唯一 P0 / 预测公信力是对外信任资产 / 定位"进口牛肉国际行情 × 可验证预测" / 不做牧集的重运营业务）翻译成可执行批次。所有文件锚点当日实测。
>
> **执行状态（2026-08-23 晚，全部 5 批已落地）**：批 1 `72f180e` · 批 3 `39a13cc`（范围扩大：执行中发现默认共识池为 chronos-only、淘汰线空转，除原定三处收口外扩池 3→7，详见 COMPETITIVE-ANALYSIS §三.3 三次修订）· 批 4 `283c685` · 批 2 `2f47d86`（执行中发现并修复测试→生产 Redis 缓存投毒通道，测试强制 db1）· 批 5 `e84033f`。测试基线 backend 999+1 → **1011+1**、frontend 314 → **317**，零回退。D1-D3 决策项保持登记未动。

## 一、规划期的两个关键复核发现（影响方案形态）

1. **共识引擎比分析初版以为的更强**：`modelQuality.ts` 已实现质量加权（30 天中位 MAPE，round-115）+ 劣于-naive 淘汰线（round-110，≥20 条验证且严格劣于 naive → 权重归零）。当前 30 天窗口实测（2026-08-23）：chronos 三变体（中位 0.79~0.82 vs naive 0.41）与 stl（5.73）**已被淘汰出共识投票**，共识实际由 4 个统计基线驱动。分析文档 §三.3 已修订。因此"共识按 MAPE 加权"**不是待办**，待办收窄为三处残留缺口（批 3）与营销口径倒挂（批 1c）。
2. **Hero 样本价是硬编码假数据**：`Hero.tsx:122-126`（Chuck Roll $389.50 等）与 `MiniSparkline` 假 `DATA_STREAM`，标注"Sample"。而全站唯一日更牛肉序列 `beef_carcass_us` 的真实数据就在库里——"活水证据"（分析 P0 第二项）就是把这组假数据换成这股真数据。

## 二、批次总览

| 批 | 内容 | 价值映射 | 规模 | 外部依赖 |
|----|------|---------|------|---------|
| 1 | 公开活水端点 + Hero 换真数据 + 口径对齐 | 分析 P0"活水证据" + 诚实 | ~0.5 天 | 无 |
| 2 | 公开预测档案页（带时间戳对错记录） | 分析 P1"信任资产" | ~1 天 | 无 |
| 3 | 共识残留缺口收口（range/均值/bestModel 感知权重） | 分析 P1 残留 | ~0.5 天 | 无 |
| 4 | ai/predict 页模型列表与预填修正 | TECH-DEBT §十四 已登记项 | ~0.25 天 | 无 |
| 5 | 数据导入节律 runbook | 分析 P0"CSV 回填"工程配套 | ~0.5 天 | 导入本身需用户提供数据 |
| D1-D3 | 决策项（watchlist UI / dashboard KPI 卡 / 运营动作） | 分析 P2 | — | 需用户点头 |

**建议执行顺序**：批 1 → 批 3 → 批 4 → 批 2 → 批 5（先小步诚实收益，再建信任资产；批 5 随时可做）。每批门禁：tsc + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。

## 三、批次详情

### 批 1 — 活水证据 + 诚实 Hero（前端为主 + 1 个公开端点）

**1a 后端**：`routes/marketData.ts` 新增 `GET /api/market/public/highlights`（**无 authenticate**）：仅返回白名单宏观序列（首期 `beef_carcass_us`）的 slug/名称/最新价/日期/日变动/近 30 点序列。复用 `getLatestPrice`（`marketData.ts:64` 现有 `:slug/latest` 的服务函数），`cacheRoute("market:public-highlights", 300)` + 全局 `globalRateLimiter`。公开宏观源数据无敏感性；**不得**含任何用户 dataset/timeseries 数据。

**1b 前端**：`Hero.tsx` — 删除硬编码 `priceItems`（122-126）与假 `DATA_STREAM`（10-13），改为消费 1a 端点：显示真实 US 胴体价 + 日期 + "Updated daily" 标识；端点失败时显示"数据源维护中"而非回退假数据。新 hook 参照 `useAccuracyData.ts` 模式 + 失败态测试。

**1c 口径对齐**：`site-stats.ts` 头注释现称 3 Chronos "in the user-facing consensus"——与引擎现实（已被淘汰线清出投票）倒挂。改为准确口径（"9-model engine, quality-weighted consensus, worse-than-naive eliminated"）；Hero 指标条（184-202）"AI Price Models 3" 同步换口径（如 "9-Model Forecast Engine"）。连带检查 `about`/`pricing` 引用。

**验收**：`curl` 无 cookie GET highlights 200 且含 2026-08 月内日期；landing 渲染真实价（grep 不到 389.50）；前端测试绿。

### 批 2 — 公开预测档案页（把 14.8 万条日志变成信任资产）

**2a 后端**：公开聚合端点（`signals.ts` 或 `marketData.ts` 下，无 authenticate + cacheRoute）：
- 每模型 30 天 MAPE 榜单（复用 `getAllModelAccuracy`，已有缓存）；
- 最近 N 条（如 50）**已验证**预测样本：序列名、predicted_at、到期日、预测值、实际值、误差——**白名单过滤**：仅宏观 commodity id 与 `cut:` 前缀序列，排除一切用户私有 timeseries（单元测试断言 where 子句，这是本批安全关键点）；
- 附 verification 方法论元数据（horizon、验证时点规则），供前端透明展示。

**2b 前端**：新公开页 `/ai/track-record`：滚动 MAPE 榜单（含"chronos 已被淘汰线移出投票"这类机制透明说明）+ 对错记录表 + 方法论。`middleware.ts:4` `PUBLIC_PATHS` 增补该路径；landing/pricing 各加一入口链接（"Our track record"）。

**验收**：未登录可访问页面与端点；响应经断言 0 私有 uuid；性能（cacheRoute 命中后 <50ms）。

### 批 3 — 共识残留缺口收口（`tradingSignals.ts` 三处小改）

淘汰线只作用于投票与加权中位数，三处未感知（当日读码确认）：
- **range**（285-287）：现为全部 available 模型的 min/max——被淘汰模型的极端预测仍拉宽共识区间。改为**仅权重 >0 的投票模型**参与 min/max（`individualForecasts` 保留全量展示）。
- **predictedChange**（309-310）：现为无权均值。改为质量加权均值。
- **bestModel**（313-320）：现按区间宽度置信度。改为权重最高的 available 模型。

**验收**：`tradingSignals.test.ts` 新增：构造 eliminated 模型极端价格 → range 不被拉伸、均值不偏移、bestModel=最高权重者；live 调 `/api/signals/forecast` 对照 individualForecasts。**风险**：range 变窄是语义变化（诚实方向），CHANGELOG 注明。

### 批 4 — ai/predict 页修正（TECH-DEBT §十四 登记项）

`predict/page.tsx:70-119` 硬编码 8 模型列表 → 从后端拉取（`/api/models` 或复用 signals 的 `getAllModels`）；`:55` `root.test2` 预填 → 默认 `beef_carcass_us`（公开且有日更数据）。测试同步。

### 批 5 — 数据导入节律 runbook（用户动作的工程配套）

新建 `docs/guides/WEEKLY-DATA-IMPORT.md`：上游清单（MLA NLRS / CEPEA 导出页路径与字段映射）→ CSV 模板（`GET /api/beef/import/template`，`beef.ts:693`）→ `/beef/import` 操作步骤 → 验证 SQL（行数/日期域/工厂覆盖/重复检测）→ 失败处置与回滚。目标：第三方可照做，把"每月想起来补一次"变成 30 分钟周节律。可选增强（并入 D2 决策）：dashboard 顶部 beef_cut_prices 陈旧警示条（数据源 freshness 板已有后端，仅前端露出）。

## 四、决策项（方案建议做，但不擅动）

> **执行状态（2026-08-23 晚，round-126 用户指令"继续完成剩余的开发任务"后处置）**：
> - **D1 已执行 `dd91b88`**：`/watchlists` 最小页（清单 + optgroup 选品器加部位 + 现价/涨跌/真实日期 + 移除）+ `useWatchlists` hooks（SWR 读 + 3 mutation，+5 测试），消费既有 7 端点零后端改动；选品器有价优先、无价标注（暂无价格）。有意不做：重命名/删清单 UI、`/api/portfolios` 组（仍 API-only）。
> - **D2 已执行 `c16ff34`**：进口均价冻结卡 → 全球牛肉价卡（同 highlights 源 + sparkline + MoM）。国产卡保留（无日更国产源）。可选增强"陈旧警示条"未做（简化原则：freshness 板已有，不重复露出）。注：该卡数据源经 round-126 D4 纠错后为 **IMF 全球牛肉月度基准（PBEEFUSDM）**而非"US 胴体日更"——原 beef_carcass_us 实为 Coinbase 比特币序列，详见 KNOWN-ISSUES D4。
> - **D3 保持非代码项**：种子用户访谈/档案周更/CSV 获取是运营与外部输入，无工程动作；4 个空 API key 仍是唯一外部依赖（KNOWN-ISSUES D1）。
> - 另：**KNOWN-ISSUES D4 在本轮定案并修复 `02fe33a`**（CBBTCUSD=比特币 → 置换 PBEEFUSDM + 清洗 11.6 年错标数据 + 回填 195 月度点），本文件批 1/批 4 描述中的 "US 胴体价（日更）" 表述按此修正理解。

- **D1 watchlist 最小 UI**：后端 8 端点 + `lib/watchlist.ts` hooks 全部就绪、零消费者（2026-08-23 复核）。建议做最小页（列表 + 加部位 + 现价），作为 P2 种子用户留存钩子；批 1 的 highlights 端点可复用为其报价源。~~（已执行 round-126，见顶部状态块）~~
- **D2 dashboard KPI 第三卡**：现"进口均价/国产均价"两卡长期显示 04-30 冻结值 + "—"趋势（`dashboard/page.tsx:238-265`）。建议其中一卡换成 "US 胴体价（日更）"，与批 1 同源。~~（已执行 round-126，见顶部状态块；D4 纠错后为 IMF 全球月度基准）~~
- **D3 运营动作（非代码）**：3→10 种子用户访谈；准确率档案周更发布；CSV 数据文件获取。**4 个空 API key 与数据文件是全部工程努力之外的唯一外部输入**（KNOWN-ISSUES D1）。（维持非代码定位）

## 五、不做清单（继承分析结论，红线不变）

B2B 撮合 / 国内现货采价网络 / 冷链硬件 SaaS / 支付/下单/交易（PRODUCT-SPEC §九）/ 负缓存（§十三 已决）。

## 六、与既有登记的关系

- 批 4 = TECH-DEBT §十四 "ai/predict 硬编码 8 模型 + root.test2 预填"的处置。
- 批 1c = §十四 "value narrative caution" 的处置。
- D1 = §十四 "watchlist UI" 决策项的具体化。
- 批 3 完成后，§十四 该条尾注"已解决"。
