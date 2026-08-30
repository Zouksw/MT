---
title: "改进方案 — 竞争分析落地执行计划"
en_title: "Improvement Plan — Executing the Competitive Analysis"
version: "3.1.0"
last_updated: "2026-08-30"
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

> ## 第三波 v3.1.0（2026-08-30，round-135 规划）— AI 预测牛肉价格·核心专轮
>
> **执行状态（2026-08-30 下午，批 0 + 批 1 前置 + 批 1 已落地，round-136）**：0b 未到期守卫 `a8a893f`（三清扫共享 `monthlyActionableMs` 定义 + restore 自愈子句，月度套件 6→9）· 0c horizon [1,3] `314d134`（`cadence.forecastHorizons` 政策缝 + 订阅 horizons 数组化 + **去重键加 horizon 维度**——旧 (commodity, model) 键会吞掉同训练态的第二个 horizon）· 0a/0d 一次性恢复 `0635c92`（实测 **42 行**误杀恢复 completed：6 序列 × 7 各恢复；7 条 NULL 遗留行标 stale；备份 `backups/round136/` 39M dump）· 批 1 前置（推理确定性）`760f825`（chronos 每请求 payload 派生 torch 种子，live 验证两次相同请求逐位一致；pytest 64→66）· **批 1 牛肉月度滚动回测已执行**（`docs/backtests/beef-monthly-2026-08.md`，36 origins × H=1/3 × 7 模型，两次 3-origin 对照 md5 一致；公开页 `/ai/track-record` 牛肉专段已上线 live 验证。**两问答案**：① chronos 淘汰结论在牛肉 H=1 不成立〔中位 1.61-2.08% vs naive 1.69% 同带〕、H=3 成立〔3.28-3.91% vs 2.71%〕→ 批 2 冷启动证据；② 可预测上限就在 naive 附近〔最优 arima 仅好 14%/3%〕，M6 教训形态一致；arima 为牛肉月度冷启动冠军；chronos 原生区间欠覆盖 58-78%）。**计划数字修正**：缺口 1 的"56 条"实测为 **49**（42 月度 + 7 NULL，审计后部分行状态已变）。D5 按建议执行（horizon [1,3] + 遗留行 stale，用户 round-136 "开始按照计划实施"授权）。测试基线 backend **1008 pass + 1 skip**（两连全绿；首跑 1 例 flake 见 CHANGELOG round-136 登记）、frontend **327**、inference **66**。
>
> **执行状态（2026-08-30 晚，批 2 已落地，round-137）**：2a `a4fac8b`（`resolveModelWeights` 第三参 seriesId + 激活阈值 `MIN_SERIES_VERIFIED_TO_ACTIVATE=20`（序列 verified 总行数）+ 权重机械提取 `computeWeightsFromAccuracies` 全局/序列逐字共享——序列本地淘汰使全局弱模型在其强序列复活投票权；单测 17→20 含计划验收用例）· 2b `9a9cf00`（`cadence.accuracyWindowDays`：daily 30d / monthly 180d 证据密度缩放；`generateForecast` 传 seriesId + 节奏窗；`getAllModelAccuracy` 64 键有界 60s per-series 缓存吸收 /signals/batch 扇出）。**live 验收（真实数据，beef 差异诚实降级）**：beef 0 verified 行 → 回退全局逐项一致，激活预计 **2026-11**（首批月度证据 2026-09/10 成熟后 180d 窗攒满 20 行）；验收场景由 live_cattle_cme（747 行/30d，chronos 三模型 14.8% 复活投票、arima 11.1% 最弱）与 aud_usd（7082 行，仅剩 naive+exponential_smoothing 50/50）坐实，PM2 日志实证 live 路由走新逻辑。批 1 回测仅作文档证据未硬编码。测试基线 backend **1011+1 首跑全绿**（+3 新单测，零回退）；frontend/inference 零改动未重跑。
>
> **执行状态（2026-08-30 晚，批 4 已落地，round-137 续）**：4a `715fa82`（读侧方向聚合——`directionVerdict` 纯函数 + `getModelDirectionStats`，`directionHitRate/Count` 流经两 API，零迁移；+10 测试）· 4b `af23766`（两页 Direction 列 + methodology 口径条目，naive 显式 "— (flat)"；frontend 327→330）· 4c `64cf0ad`（**三次实测纠偏**：公共步配对〔CME 周末跳空 actuals 短于步数〕、anchor 取 forecastStartAt 的 UTC 日界〔16:00/00:00 盖章混用会把 anchor 抓成 actual[0]，chronos 一度虚高 82-90%〕、无 forecastStartAt 行排除〔predictedAt 回退 anchor 落窗内，crude 遗留行实测 12.9%〕+ 混源无权威声明序列整组排除〔aud_usd 现状，登记为数据决策候选〕）。**live 终值**：chronos 68-70%（~2170 行）、holtwinters 33.8%（弱点分化）、arima 58.9%、naive "—"；beef 待 2026-09/10 首批成熟。backend **1021+1 全绿**、frontend **330**。
>
> **执行状态（2026-08-30 晚，批 5 已落地，round-138）**：`7ba03cc`（新页 `/beef/forecast`：下月共识卡〔calibrated 区间诚实推迟至 2026-09 证据成熟——回测已证原生区间欠覆盖 58-78%，不显未校准数字〕+ 回测证据面板 + 验证时间线〔2026-09/10、2026-11 到期预告〕+ 活牛/架子牛上游面板 + /beef 导航入口；dashboard hero 改挂牛肉月度共识，新 hook `useBeefMonthlyConsensus` 为页/卡唯一数据源——一致由构造保证）· `61a149d`（周度快照脚本 + 牛肉专段 + 首份产物 `docs/snapshots/track-record-2026-08-30.md`——v3.0.0 "track-record 周度快照物料" 原仅有规划，本轮补齐）。live：未登录 307→/login ✓；共识端点 flat/−0.28%/331.78→331.78/区间 327.31–332.54/57%/3-7。frontend **334**（+4）；backend 源零改动（1021+1 沿用）。
>
> **指令来源**：用户"结合当前项目最核心的功能，利用 AI 大模型预测牛肉价格的变化，制定后续的开发计划"。
> **依据**：引擎与生产库 2026-08-30 实测（见 V3-一）+ [PREDICTION-STRATEGY](PREDICTION-STRATEGY.md)（含本轮补写的失效标注——其 §五 实验序列实为比特币错标数据）+ [COMPETITIVE-ANALYSIS §八](COMPETITIVE-ANALYSIS-MOOKET.md)。
> **核心论断**：预测**机制**已经成熟（质量加权共识 + 劣于-naive 淘汰制 + split-conformal 区间 + cadence 感知验证环，全部 live），当前缺口是**证据、序列适配、产品面**三件事——牛肉预测此刻拿不出一条可展示的验证证据（被误杀 + horizon 过长）；模型质量权重是全局的而非按序列的；方向准确率（采购择时真正要的指标）没有度量。
> **约束不变**：只用预训练模型不训练（AGENTS §七.2）；统计拟合/推理时校准 ≠ 训练，全部手段兼容。
>
> ### V3-一、现状基线（2026-08-30 实测）
>
> | 维度 | 事实 | 证据 |
> |------|------|------|
> | 引擎产出 | 9 模型 alive；近 7d：naive 7582 / ES 7581 / HW 7581 / arima 7571 / chronos ×3 各 7299 行；**sarimax 0 行**（门禁暂缓维持） | psql GROUP BY model_id |
> | 共识机制 | `resolveModelWeights` **按模型全局加权**（无序列维度）+ 淘汰制 + conformal 区间（α=0.1）live | modelQuality.ts；PREDICTION-STRATEGY §五 |
> | 牛肉数据面 | IMF 月度基准 195 点（2010-05→2026-07，331.78 USC/lb）+ CME 活牛/架子牛日更（各 2287 行/7d）；**日更牛肉序列仍为 0** | psql；KNOWN-ISSUES D1/D4 |
> | **缺口 1（P0）** | **56 条月度预测全部被误标 `unverifiable`**（6 序列 × 7 模型 + 牛肉 08-23 遗留 7 条）：六序列最新点均 2026-07-01、**08-30 当天点龄满 60d**——旧 60d 窗口代码在 01:44/07:44 清扫中恰巧撞线冻结全部月度行；90d 修复 12:39 才部署（晚数小时）；restore 因"窗口感知"正确地不救窗口未开的行 → 暴露语义洞：**未到期 ≠ 不可验证** | psql 按状态计数；backend 日志 11:54 "Marked 15109 frozen" |
> | **缺口 2** | 月度预测 horizon=10（继承 daily 默认）→ 按 ADR-0001 ① horizon 单位=步长，即 **10 个月**，首批牛肉月度验证要到 **2027-05** 才可能到期——证据链被推迟近一年 | prediction_logs：interval='monthly' + horizon=10，forecast_start_at 2026-07-31 |
> | **缺口 3** | 牛肉序列上 7 条 08-23 遗留行（interval=NULL + horizon=6）：6b 月度语义之前生成，按 daily 语义永不可验证，污染牛肉历史 | psql |
> | 方法论坑 | PRED-STRATEGY §五 的 aud 联动/sarimax 回测跑在比特币数据上——牛肉外生变量结论须重做 | 该文档 08-30 失效标注 |
>
> ### V3-二、批次总览
>
> | 批 | 内容 | 价值 | 规模 | 依赖 |
> |----|------|------|------|------|
> | **0（P0）** | 月度验证生命周期修复三件套（误杀修复 + 未到期守卫 + horizon 校准） | 牛肉证据链解锁 | ~0.5 天 | 无 |
> | **1** | 牛肉月度滚动回测（rolling-origin，195 点全史） | 把"机制存在"变成"证据存在"；回答 chronos 在牛肉上该不该淘汰 | ~1 天 | 无 |
> | **2** | 冠军路由（per-series 模型质量权重） | 牛肉序列用自己的最优模型，不被 FX 池拖累 | ~1 天 | 批 1 可作冷启动证据 |
> | **3** | 领先指标实验（lagged exog：活牛期货/汇率 → 月度牛肉），门禁制 | 唯一可能超越单变量上限的路（sarimax 接线前置） | ~0.5-1 天 | 批 1 框架复用 |
> | **4** | 方向准确率指标（验证环 + 展示） | 采购择时的真指标；预测公信力第二支柱 | ~0.5 天 | 无 |
> | **5** | 牛肉预测中心页 + hero 接线 + 周度快照 | 核心功能的用户可见面 | ~1 天 | 批 1 证据面板 |
> | **6** | 免 key 牛肉/牲畜序列扩充（FRED 盘点） | 牛肉预测面 1 → 3-4 条 | ~0.5 天 | 无 |
> | 并行轨 | v3.0.0 竞争驱动批次（成本计算器/公开摘要/词汇五维）保留，见 V3-六 | 差异化与获客 | — | 与本波无依赖 |
>
> **顺序**：批 0 → 1 → 2 → 4 → 5 → 3 → 6（批 0 是一切的前提；批 3 依赖批 1 的回测框架且自身有门禁）。
>
> ### V3-三、批次详情
>
> **批 0 — 月度验证生命周期修复（P0，今日实测的三缺口）**
> - **0a 误杀修复**：一次性脚本（复用 `verify-monthly-lifecycle.ts` 受控验收模式）：`interval='monthly'` 且到期时刻（anchor+horizon 月+宽限）> now 的 `unverifiable` 行标回 `completed`；先 SELECT 计数核对（预期 42）再 UPDATE；操作前 `pg_dump` 相关表。验收：修复后 6 序列各 7 条 `completed`，下一 30min 周期无重复生成（new-point 守卫已验证工作）。
> - **0b 未到期守卫**：`markUnverifiablePredictions`/`markLaggingFrozenPredictions`/`expireWindowElapsedPredictions` 三清扫对月度行统一加前置判定——**到期时刻未过一律跳过**（冻结判定只对已到期行生效）。+回归测试：构造未到期月度行 + 冻结源 → 不被标。这是"未到期 ≠ 不可验证"语义的代码化。
> - **0c horizon 校准**：调度器对月度订阅改用 **horizons [1, 3]**（下月 + 下季度，产品可读；daily 默认 10 不变）→ 牛肉验证证据 **2026-09/11 起滚动成熟**，而非 2027-05。现有 horizon=10 行保留（长视界亦有价值，到期自然验证）。**决策确认见 D5**。
> - **0d 遗留行处置**：牛肉序列 7 条 NULL-interval 行（08-23、horizon=6）标 `stale`（错配时代产物，保留历史不删除——同 R2 污染行先例）。并入 D5 确认。
>
> **批 1 — 牛肉月度滚动回测（证据，不是等待）**
> **前置（规范 6，PREDICTION-STRATEGY §6.2）**：推理确定性——引擎 `predict_quantiles` 当前未固定采样种子（chronos 采样路径非确定性，round-135 读码发现），回测前先在 inference 引擎加 torch 种子固定（或提升采样数取中位），否则回测数字不可复现。
> `scripts/backtest-monthly-series.ts`：对 IMF 牛肉基准 195 点做 rolling-origin 回测——~36 个月度 origin × H=1/H=3 × 7 模型逐点推理（**纯推理零训练**），产出 per-model：MAPE 均值/中位、**方向命中率**、conformal 区间实际覆盖率。产物 `docs/backtests/beef-monthly-2026-08.md` + 数字进 `/ai/track-record` 牛肉专段。**这一步直接回答两个悬案**：① chronos 在长月度牛肉序列上是否真劣于 naive（当前淘汰结论来自 FX/CME 日更池，对牛肉不公也不准）；② 月度宏观序列的可预测上限在哪（若全员≈naive，诚实结论就是"统计基线即最优"，品牌叙事转向"可验证"——这本身就是答案，不是失败）。验收：回测可复跑（seed 固定后逐位一致）、与 `verify-monthly-lifecycle` 同源的取数口径、公开页出现牛肉专段。
>
> **批 2 — 冠军路由（序列 × 模型，补 modelQuality 的序列维度）**
> `resolveModelWeights` 现为全局 per-model。新增 per-series 滚动准确率（30d 窗，verified 行按序列分组，≥N 条才启用，不足回退全局权重——与等权兜底同模式）；共识生成单序列信号时优先用该序列自己的权重集/冠军模型集。批 1 回测结果作为牛肉序列的冷启动证据。验收：单测构造"模型 X 全局弱、序列 A 强"→ A 的共识用 X；live `/api/signals/forecast?commodity=beef_carcass_us` 与全局权重对照可观察差异。
>
> **批 3 — 领先指标实验（lagged exog，门禁制，双臂：sarimax + chronos-2 协变量）**
> 经济假设：CME 活牛期货**领先** IMF 现货牛肉基准（期货价格发现），汇率滞后项次之。**双臂设计（round-135 检索新增，PREDICTION-STRATEGY §7.1）**：臂 A = sarimax lagged-exog（统计路线，`experiments/` 既有参数化先例）；臂 B = **chronos-2 协变量零样本**（Amazon 2025-10 发布，120M encoder，原生支持 past/future covariates——同家族升级，接入成本低，CPU 可跑，且完全符合预训练约束）。两臂同一 rolling 门禁（与 PRED-STRATEGY §五 相同，**增量不显著就不上**——该纪律 08-17 已挡过一次错误接线）。臂 A 通过才接 sarimax（engine exog 接口已实现）；臂 B 通过则以候选模型身份走准入门禁（规范 1）。验收：实验报告入 docs/backtests/（含"两臂均未过门禁"的诚实结论分支）；未过门禁则登记结论关闭该方向。
>
> **批 4 — 方向准确率（采购择时的真指标）**
> 验证环（`verifyDuePredictions`）在记 MAPE 的同时记**方向命中**（预测涨跌方向 vs 实际，相对 anchor 点）——读侧聚合（不加列，避免迁移），`/ai/accuracy` 与 `/ai/track-record` 增"方向命中率"列。回测（批 1）同口径产出历史方向命中，页面冷启动即有数。PROJECT-VISION §3.3 遗留建议的落地。验收：新验证行带方向判定；两页出现该列且与回测口径一致。
>
> **批 5 — 牛肉预测中心（核心功能的用户可见面）**
> 新页 `/beef/forecast`（牛肉区导航）：**下月共识卡**（方向+幅度+calibrated 90% 区间+模型分歧度，horizon 单位"个月"已支持）+ **回测证据面板**（批 1）+ **验证时间线**（"首个滚动验证 2026-09 到期"诚实预告，非空壳）+ **上游面板**（活牛/架子牛期货日更）。dashboard hero"AI 预测"卡改挂牛肉月度共识（现挂 7d 泛商品口径）。并入 v3.0.0 批 4：周度快照脚本加牛肉专段。验收：未登录不可见（与行情页一致）但 track-record 牛肉段公开；hero 卡与 /beef/forecast 数字一致。
>
> **批 6 — 免 key 牛肉/牲畜序列扩充（预测上限的数据面）**
> 盘点 FRED 免 key 面（经 cmeFutures 已验证的 CSV 通道）：候选=零售牛肉价/牛肉进出口量/其他蛋白交叉序列（猪/鸡，替代效应）——接入 2-3 条月度序列。牛肉预测面从 1 条基准 → 家族 3-4 条（含已在线活牛/架子牛），批 2 的 per-series 路由立即有用武之地。验收：新序列进月度循环（复用 ADR-0001 全套语义）；freshness 板可见。
>
> ### V3-四、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | D5（新，批 0） | 月度 horizon 默认 [1,3]（替代 daily 默认 10）；7 条 NULL-interval 遗留行标 stale | 建议：照批 0c/0d 执行——证据链 9 月起成熟 vs 2027-05，差距是数量级的 | V3-一 缺口 2/3 |
> | D6（新） | 是否引入第二预训练 TSFM 家族（TimesFM/Moirai 零样本） | 建议：**暂不**——chronos 在现有池已劣于 naive，先用批 1 建立牛肉自身证据；若牛肉上全员≈naive，"大模型"叙事应让位"可验证"叙事（诚实优先）；引入须过批 1 同款回测门禁。**例外细化（round-135 检索，PRED-STRATEGY §7.1）**：chronos-2（2025-10）属现有家族升级而非新家族，且原生协变量能力正是批 3 所需——随批 3 臂 B 门禁评估，"一次一个挑战者"纪律不变 | V3-一；约束 §七.2；§7.1 |
> | D1-D4（承 v3.0.0） | PRODUCT-SPEC 增补 / 休眠表清理 / portfolios+predict-batch / predictionBeefCoverage24h 口径 | 见下文并行轨 D 表（不变） | round-134 |
>
> ### V3-五、不做清单（红线重申 + 本波新增）
>
> - **训练/微调任何模型**（AGENTS §七.2 红线；统计拟合与推理时校准不算训练）。
> - **未过回测门禁的模型接入**（含新 TSFM 家族；sarimax 维持 0 行是纪律执行正确，不是欠账）。
> - **为造 verified 数而放宽验证窗/冷却**（D2 round-17 先例：调参只能把 42→63，92.5% 无论怎么调都不可验证——数据没到就是没到）。
> - 并行轨与牧集相关的不做清单见 V3-六。
>
> ### V3-六、并行非核心轨（round-134 v3.0.0 批次，保留降级为并行）
>
> 以下与 AI 预测核心无依赖，作为第二优先轨保留：**批 A** 进口成本计算器 `/tools/landing-cost`（牧集结构性做不了的差异化工具：出口国汇率 × 关税/增值税/运费参数 → RMB/kg 到岸参考区间，输入数据全活；纯信息计算不碰红线，过期序列诚实降级）；**批 B** 公开中文行情摘要页 + 每周真数据周报（学牧集 SEO 长尾打法，用可溯源真数据，不打"分析师洞察"）；**批 C** 贸易词汇五维（BeefCutPrice metadata 增 feedingRegime/feedingDays/leanPct/breed/locationPort + CSV 模板扩展 + taxonomy 报盘俗名映射，数据解冻即接上）；**批 D** 工程卫生打包（登记决策项处置）。
>
> **并行轨决策项（承 round-134，不变）**：D1 = 批 A/B 是否写入 PRODUCT-SPEC（建议写入，纯增量不碰"明确不做"；批 C 作数据层能力登记）；D2 = 休眠表清理 SecurityAuditLog/ForecastingModel/Forecast（建议一次性迁移删除、数据先备份；TECH-DEBT round-132 登记）；D3 = portfolios 路由组 + `/api/inference/predict/batch` 孤儿（建议维持登记）；D4 = `predictionBeefCoverage24h` 月度眨眼口径（建议改为"beef 覆盖不限 24h + 最新预测时间戳"）。
>
> **并行轨不做清单（继承 round-134 §8.1 路由证据）**：IM 聊天、商家店铺/入驻体系、报盘/求购大厅、保理/金融/信用/单证面、B2B 多角色子账号——牧集交易面的运营重镇，全部"重运营 + 交易语义 + 红线冲突"，明确不做；国内现货报盘采价网络维持不做。

---

> **——以下为 v2.0.0 历史正文（批 1-10 + 6a/6b/6c 已全部执行完毕，保留存档）——**

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

---
---

# 第二波（round-129 规划，2026-08-23；同日经对抗评审修订 v2）

> **输入**：round-128 对标复评（COMPETITIVE-ANALYSIS v1.1.0 §七）+ round-127 登记（TECH-DEBT §十四 两条）+ 本轮规划期新取证。规划方法加载 15 个 skill（13 个实质应用 + 2 个按自身前提判定不适用，另有 1 个名字未命中，使用记录见 §G），任务模板取 `planning-and-task-breakdown`，切片纪律取 `incremental-implementation`，测试要求取 `tdd`。
> **门禁（适用于 §B 每一批，无一例外）**：tsc + 全量测试（三套件计数不回退）+ `pnpm build`（PM2 跑 dist）+ PM2 重启 + live 验证 + 独立 commit。
> **目标一句话**：让"牛肉"回到核心价值链——预测循环以**可验证**的方式重新覆盖牛肉序列（批 6a-6c）+ 修用户可见缺陷（批 7）+ 公信力口径统一（批 8）+ 让数据断流可被看见（批 9）+ 解冻配套（批 10）。
>
> **对抗评审记录（2026-08-23，doubt-driven 终稿步骤）**：初稿经 fresh-context 评审（Explore 只读代理，68 次读操作核对 file:line），报 2 blocker + 6 major + 6 minor，全部归类为有效可行动并已并入下文——关键修正：批 6 初稿会让月度预测**永远无法验证**且以 30 分钟节律日产 ~336 条日志（重演 round-62/66/114 清理过的病理），已分解为 6a/6b/6c 并把"达到 `verified` 状态"设为硬验收；批 7 初稿换默认序列后页面**仍显示不出数据**（价格拉取无月度回退），已扩范围；批 9 实现位与稳态噪音已定案；D5 相关性不做的理由已纠错。
>
> **执行状态（2026-08-23 round-130，"开始执行计划"后）**：批 7 `e33956b`（扩范围版：默认序列 + getPriceHistory/batchLatestPrices 月度回退 + signals 200 降级；live 四项全过）· 批 8 `21661cd`（钉住测试 days=7/30/90 + methodology 双向口径；live 验证）· 批 6a `dd0eaeaa`（`cadence.ts` 策略模块 + freshness interval 感知；live：beef_carcass_us monthly/2026-07-01/非 stale）· 批 9 `583c376`（/health/ready beefSeries + predictionBeefCoverage24h + cron 状态转移降噪；双跑 live 验证）· 批 10 `40286a7`（verify-beef-import.ts 一键验证；生产双跑）。**执行注**：6a 的调度门控谓词按简化原则挪入 6b（与验证生命周期+开闸同批，避免死代码 flag——现有 predictionCache 测试已钉住订阅不变）。D5 ADR 已起草（`docs/adr/ADR-0001-...`，**Proposed 待用户确认**）。测试基线 backend 1004+1 → **1020+1**（98 文件）、frontend 322/35（批 7 含前端改动后全绿）、inference 64 不变；零回退。附带登记：watchlistService 本地 batchLatestPrices 副本仍 daily-only（TECH-DEBT §十四）。
>
> **执行状态（2026-08-24 round-131，D5 已确认 → 6b/6c 落地）**：批 6b-1 `43984cd`（prediction_logs 可空 interval 列，双库迁移，无回填；ADR-0001 → **Accepted**）· 批 6b-2（订阅月度谓词 ⑤：≤60d 且 ≥3 点；logPrediction + 30 分钟刷新**双重新实际点守卫** ④；data-fetcher 携带节奏落库 ③）· 批 6b-3（mapeTracking 四轮扫描节奏感知 ②：到期/实际值窗按步长、Pass A/B 按 (commodity, cadence) 分组 + 月度 60 天冻结窗、expire/restore SQL CASE 分流）· 批 6b-4（`scripts/verify-monthly-lifecycle.ts` 受控 live 验收 + 订阅开启）· 批 6c `397a86f`（CachedPrediction interval/horizonUnit **三写方同 commit**（INT-1）+ signals/inference/visualize 透传 + PriceForecastPanel"未来 N 个月/天"）。**强制检查点（6b 硬验收，2026-08-24 实测）**：① 回填月度行穿越全部清扫 → `verified` MAPE 0（脚本 + 集成测试双形式）；② 月度行 unverifiable 增速 0；③ 二次请求/重启重算/缓存过期均零日志增长；④ daily 语义存量测试全绿零变化；⑤ 订阅开启：15 daily + **13 monthly**（beef 首轮 7 模型 × 1 行，forecast_start_at 2026-07-31）；`predictionBeefCoverage24h` 0→**1**。执行中发现并自纠两处：Pass A 月度冻结补 60 天宽限（计划 6b 第 3 条原文，首版漏）、Pass B 分区标记早退 bug。测试基线 backend 1020+1 → **1034+1**（100 文件）、frontend 322 → **324**、inference 64 不变；零回退。

## §A 观察结果 → 计划映射（全部当日实测取证）

| # | 观察结果 | 证据 | 处置 |
|---|---------|------|------|
| 1 | **背景预测循环与牛肉零交集**：24h 覆盖 17 商品全为汇率/CME；`beef_carcass_us` 0 条预测（月度序列被 7 天新鲜度门控排除） | round-128 附录 SQL；TECH-DEBT §十四 round-127 登记项 | **批 6a-6c**（前置 D5；订阅在 6b 验收前不开启） |
| 2 | /trading 牛肉模式默认 `beef_cutout_us`（0 行数据）且 signals 空序列 500 | TECH-DEBT §十四 F3（round-127） | **批 7** |
| 3 | **MAPE 口径分裂（本轮新发现）**：原始 SQL（含 `stale` 行）chronos_mini 30d avg=55.43，仅 `verified`=7.05（与公开档案页 7.05 精确吻合）；16 条 stale 行 avg≈9676% 污染原始口径；COMPETITIVE-ANALYSIS v1.1.0 §三.3 复评注误用了原始口径，与 PRODUCT-SPEC §七"30d 6-9%"自相矛盾 | 本轮 SQL：`SELECT status,count(*),avg(mape) … GROUP BY status`；`curl /api/signals/models/accuracy/public` | **批 8** + 本轮已即时修正文档 |
| 4 | 死模型残留（sundial/timer_xl 332 行）**已被结构性隔离**：`computeAllModelAccuracy` 按现行注册表枚举（mapeTracking.ts:952-958），详情路由有 R3 守卫（signals.ts round-75）；days=30/90 实测均不出现 | 本轮读码 + live 双窗口实测 | **批 8** 测试钉住；数据清理 → **D7** |
| 5 | 数据断流不可观测：beef_cut_prices 冻结 115 天、预测覆盖 17/0，均靠手写 SQL 才发现；cron-healthcheck 只看进程健康 | round-127/128 取证过程本身 | **批 9** |
| 6 | CSV 回填 runbook 已有（第一波批 5），但回填后验证靠人工拼 SQL | docs/guides/WEEKLY-DATA-IMPORT.md | **批 10** |
| 7 | 孤儿端点组（/api/models 8 / /api/security 3 / /api/analytics 2）+ portfolios 组 0 消费 | TECH-DEBT §十四（round-123 登记） | **D6**（deprecation 决策框架） |
| 8 | 用户侧外部输入未变：4 个空 API key、beef_cut_prices CSV、种子用户 | KNOWN-ISSUES D1 | §C 清单（非工程） |

## §B 批次详情（批 6a-6c、7-10）

> 批 6 初稿按对抗评审 B1/B2 分解：月度序列**分三片落地，订阅在 6b 验收通过前不开启**——否则预测进得去、验证永远不成立，且 30 分钟刷新节律会对月度序列日产 ~336 条日志（7 模型 × 48 周期），重演 round-62/66/114 清理过的"永久 unverifiable 行污染"病理（predictionCache.ts:450-468 有完整历史注记）。

### 批 6a — 新鲜度/门控 interval 感知（不订阅，只修判定）

**内容**：
1. `getCommodityFreshness`（marketService.ts:240-244，现只查 daily 行）：groupBy 谓词按 interval 分组返回，月度序列产出真实 `lastUpdated`（今天显示为 stale 是因为查询本身看不到月度行）；
2. 调度门控谓词（predictionCache.ts:483-491/544-551，interval 硬编码在 WHERE 内）：月度订阅判定 = **最新点 ≤60 天 且 全序列 ≥3 点**——不用"窗口内 ≥2 点"镜像（月度点距 ~30 天，45 天窗多数时间只含 1 点，会导致每月约 2 周的订阅抖动，评审 M4）；阈值 60 天取 2× 发布节奏（PBEEFUSDM 于 M+1 月中发布，正常点距上限 ~45 天，60 天在其上，评审 m6）；
3. 集中为 `stalenessWindow(interval)` 小 seam（见 §D，但见评审 M3：seam 只覆盖阈值策略，约占改动量 10%，其余为显式枚举的编辑点，不做夸大声明）。

**验收**：freshness 板显示 beef_carcass_us 真实 lastUpdated（2026-07-01）与非 stale；daily 序列行为零变化（测试钉住）；**订阅清单不变**（beef_carcass_us 仍未订阅，测试断言）。规模 S。

### 批 6b — 月度验证生命周期（最难的一片，订阅开启的总闸）

**问题（评审 B1 全清单）**：验证生命周期 daily 中心化至少 6 处——到期判定 `horizon * 86400000`（mapeTracking.ts:652-653）、实际值窗 `anchorDay + (horizon+1) 天`（:680）、markUnverifiable Pass A/B 的 daily `findFirst`（:325-329/:408-415，月度序列会因"查无 daily 行"被立即判冻结）、expire/restore 的 `make_interval(days=>horizon)` + daily 实际值 SQL（:487-492/:523/:526/:557-565）。只改取数过滤，月度预测**永远无法验证且会被清扫为 unverifiable**。

**内容**：
1. `prediction_logs` 无 interval 列——每行 cadence 来源定为**写入时联查 commodities.interval 落库**（新增可空列 `interval`，迁移一次；旧行回填 daily 为默认？**不回填**，旧行按现状语义处理，避免重写 14 万行——新列 NULL=daily 时代旧行，语义兼容）；
2. 到期/实际值窗口按 cadence：月度行 horizon N = N 个月（`make_interval(months=>horizon)`），实际值取月度点；
3. 三处清扫（Pass A/B、expire、restore）对月度行使用月度冻结判定（最新点 >60 天才冻结，而非"无 daily 行即冻结"）；
4. **月度刷新节律（评审 B2）**：月度序列仅在**新实际点落库后**重新预测（logPrediction 前置守卫：该序列最新 actual 日期 > 上次记录预测时的 actual 日期），否则跳过——一个新月度点最多产出 7 模型 × 1 轮预测，而非每天 336 条。

**验收（硬门槛）**：
- [ ] 手工构造月度预测（或等待新月度点）：`beef_carcass_us` 至少 1 条到达 `status='verified'` 且 mape 非空
- [ ] 月度行的 unverifiable 增速为 0（清扫不再误伤）
- [ ] 新实际点触发重预测、无新点时日志零增长（SQL 断言 24h 行数）
- [ ] daily 全链路行为零变化（存量 14 万行的清扫/验证回归测试全绿）
- [ ] **订阅开启**（本批验收通过后才 flip 门控让 beef_carcass_us 进循环）

规模 L（评审 m1：mapeTracking 是全仓最高风险文件——原生 SQL + 状态生命周期，必须单独成批、单独 commit、live 专项检查点）。**依赖**：6a + D5 定案。

### 批 6c — cadence 元数据 + 前端单位标注

**问题（评审 M2/m1）**：`PriceForecastPanel` 硬编码"未来 {horizon} 天"（PriceForecastPanel.tsx:118）；月度序列 horizon 10 将被展示为"10 天"实为"10 个月"。`CachedPrediction` 形状有**三个写入方**共享（predictionCache.ts:26-29/208-217、inference.ts:205-209/288-292，round-114 INT-1 形状漂移 bug 的原址）。
**内容**：`CachedPrediction` 增 `interval`/`horizonUnit` 字段——**三个写入方同一 commit 内同步改**（INT-1 教训），signals/inference 响应透传；前端 `PriceForecastPanel` 按 horizonUnit 显示"未来 N 个月/天"；推理服务侧评审已证实输出时间戳按最后两点间距外推（predict.py:113-123），月度输入天然产出月度间距，后端无需换算。
**验收**：/trading 与 /ai/predict 对月度序列显示"个月"；daily 显示不变；三写入方形状一致性测试。规模 S-M。**依赖**：6b（订阅开启后才有月度信号流到前端）。

### 批 7 — /trading 牛肉模式真正可用（F3；评审 M1 扩范围）

**问题**：初稿只换默认序列，但 `useTradingData` 固定 `interval=daily` 拉价格（useTradingData.ts:23/97）→ `getPriceHistory` 无月度回退（marketService.ts:105-129）→ `loadSignal` 对空数组早退（useTradingData.ts:204）——**换默认后页面仍无图无信号**；且牛肉模式隐藏了 TimeframeSelector（trading/page.tsx:122），用户无法自救。signals 路由空序列 500（signals.ts:415-429 → tradingSignals.ts:141-143 → errorHandler 默认 500）。
**内容**：
1. 牛肉模式默认 `beef_cutout_us`→`beef_carcass_us`；
2. `getPriceHistory` 按**序列真实 interval** 取数（commodity.interval 优先于请求默认），牛肉模式恢复 TimeframeSelector 或按序列隐藏 daily 选项；
3. signals 路由空序列返回 2xx 降级载荷（`insufficientData: true`），不再未捕获 500。
**验收**：live /trading 牛肉模式出**价格图 + 信号面板**（不只是页面 200）；0 行序列 curl signals 得 2xx 降级；回归测试钉住三者。规模 M（3 文件）。**依赖**：无（可与 6a 并行）。

### 批 8 — 公信力口径统一 + 榜单钉住（含本轮已做文档修正的收尾）

**内容**：
1. 钉住测试（评审 m5：定位为 tripwire 而非主体工作——聚合按注册表枚举，测试防的是未来回归）：任何 `days≤90` 公开榜单 modelId 集合 == 引擎注册表集合；
2. `getPublicTrackRecord` methodology 补**精确**排除规则：MAPE 分子仅 `verified` 行；`predictionCount` 分母**含** stale/unverifiable 行（mapeTracking.ts:853-861）——一句话必须两者都说清，笼统写"排除 stale"对 predictionCount 是错的；
3. 三文档统一 verified-only 口径（COMPETITIVE-ANALYSIS §三.3、PRODUCT-SPEC §七、本计划），全周期长尾与当前 30d verified 双口径并列。

**验收**：新测试绿；三文档 grep 无裸原始口径残留；公开页 methodology 含双向说明。**依赖**：无。**规模**：S。

### 批 9 — 数据新鲜度可观测性（评审 M5/M6 定案）

**实现位（M5 定案）**：**后端侧**——扩展现有 health 端点（或新增 ops 只读小端点，`authenticate` 管理员保护）返回两项检查结果，`scripts/cron-healthcheck.sh` curl 它并 grep——阈值 import 共享的 `stalenessWindow`，避免 bash 里第六处硬编码；shell 无 DB 直连问题消失。本批含 build + PM2 门禁。
**降噪（M6 定案）**：事件只在**状态转移**时记（cron 脚本持久化小状态文件对比上次结果），外加每日一次心跳摘要——beef_cut_prices 已冻结 115 天是**已知稳态**，每 5 分钟刷屏会把真告警淹死；`prediction_coverage`（24h 背景预测覆盖的牛肉序列数）同规则。
**验收**：人为调低阈值触发 fresh→stale 转移，日志出现一次且下一轮不重复；状态回正后恢复；心跳摘要可 grep。**依赖**：无（6a 落地后 threshold 共享才成立——若 6a 未先行，批 9 可自带常量并注明后续接驳）。**规模**：S-M。

### 批 10 — CSV 回填验证一键化

**内容**：`backend/scripts/verify-beef-import.ts`（评审 m2：遵循 backend/scripts/ + tsx 既有惯例，如 import-beef.ts；根 scripts/ 无 TS runner）。WEEKLY-DATA-IMPORT.md §五已有日期域与重复检测查询；**行数增量与工厂覆盖查询是新增**（初稿"打包自文档"表述不准），一并实现并回写 runbook 引用。
**验收**：对当前库 dry-run 输出与手写 SQL 一致。**依赖**：无。**规模**：XS-S。

**建议执行顺序**：批 7（用户可见修复）→ 批 8（口径收口）→ 6a → **D5 定案 → 6b**（订阅开启 + 专项检查点：live 验证牛肉序列进链路且首条 verified）→ 6c → 批 9 → 批 10。检查点节奏：每批独立 commit + 全量门禁；6b 后为强制人工检查点。

## §C 决策项（不擅动，需用户点头）

- **D5 月度序列预测语义（批 6a-6c 总纲，批 6b 前置）——已定案**：[`docs/adr/ADR-0001-monthly-series-prediction-semantics.md`](adr/ADR-0001-monthly-series-prediction-semantics.md) **Accepted（2026-08-24 用户确认）**，批 6b/6c 已按此执行完毕（见上方 round-131 执行状态）。五点语义包：① horizon 单位 = 步长（月度序列 1 步 = 1 个月）；② 验证到期与实际值窗按步长（`make_interval(months=>horizon)`）；③ `prediction_logs` 增可空 `interval` 列（NULL=daily 时代旧行，不回填）；④ 月度刷新节律 = 仅新实际点后重预测；⑤ 订阅谓词 monthly = 最新点 ≤60 天 且 ≥3 点。correlationAnalysis/analytics 显式不做月度（理由经评审 m4 纠错：daily-only 读取与跨节奏对齐，非点数不足）。
- **D6 孤儿端点处置——已定案（2026-08-30 round-132 执行，"继续完成剩余的任务"指令）**：五问重评（全量核实见 TECH-DEBT §十四 round-132 记录）：`/api/security` 3 端点**删除**（audit 前端从未发送）；`/api/models` 8 端点**删除**（重评结论：公开档案页用的是 `/api/signals/models/accuracy/public` 而非本组，"互补"假设未成立；`modelService` 唯一消费者即本组路由，连带删除；`ForecastingModel`/`Forecast` schema 与数据保留为休眠表）；`/api/analytics` 2 端点**删除**（correlation 为 live signals 版之外的第三套重复实现、seasonality 0 消费且 PRODUCT-SPEC 无规划）；portfolios 组**维持登记**（0 页面消费，暂缓）。测试 1036+1→1002+1（-34 全部为随组删除的测试，零失败），live 404×3 + 替代面 200。
- **D7 死模型残留数据（sundial/timer_xl 共 332 行）——已定案（2026-08-30 round-132）：保留**。已结构性隔离（注册表枚举 + R3 守卫 + 批 8 钉住），数据不删（预测历史完整性）；未来如用户明示删除属数据治理决定再单列轮次。

**用户侧外部输入（非工程，不变）**：4 个空 API key（MLA/USDA_MARS/OPENWEATHER + FRED 免 key 已用）；beef_cut_prices CSV 周更（runbook 就绪）；3→10 种子用户访谈与档案周更。

## §D 架构注记（zoom-out 模块地图 + 深化机会）

月度语义涉及的模块地图（调用方 → 被调方）：

```
scheduler ──→ predictionCache ──→ inference/data-fetcher（已有 monthly 回退）
    │              │──→ mapeTracking ──→ prediction_logs（actuals 取数 daily-only ←批 6.2）
    │              └──→ tradingSignals ──→ modelQuality（30d 窗口径 ←批 8 关注）
    └──→ getCommodityFreshness（daily-only ←批 6.1）
correlationAnalysis / analytics（daily-only ←显式不做，D5）
routes/inference.ts（fetchHistoryWithFallback，round-127 已修）
```

**深化机会（improve-codebase-architecture 词汇；经评审 M3 校准）**：interval 判定散在 ≥5 处（freshness、调度门控、mapeTracking actuals、correlation、analytics）——**浅接口碎片**。批 6a 引入 `stalenessWindow(interval)`：接口只有"interval→窗口/单位"，实现集中阈值规则。**删除测试通过**（删掉它，阈值知识散回 5 个调用点）。**诚实边界**：该 seam 只覆盖阈值策略，约占批 6 全部改动量的 ~10%——其余是显式枚举的编辑点（freshness 查询谓词、调度 WHERE、验证生命周期 6 处、`CachedPrediction` 三写入方、响应形状），不存在"一个小函数解决全部"的捷径。一次只做这一个 seam，不为假想的第三种 interval（weekly?）预留扩展。

## §E 安全注记（security-and-hardening 速评）

公开面新增代码仅批 6.3（响应字段追加，无新端点）。存量公开端点面（highlights / accuracy/public）已有：正白名单 fail-closed（samples）、cacheRoute、全局限流、无敏感字段。批 8.1 的钉住测试同时是信息完整性防线（榜单不可被历史死模型污染）。无新增外部输入面、无新依赖、无密钥接触——STRIDE 无新增项。

## §F 可观测性注记（observability-and-instrumentation）

On-call 三问（批 9 遥测必须能回答）：①核心序列多少天没更新了？②背景预测覆盖了几个牛肉序列？③（批 6 后）月度序列上次验证是什么时候？信号选型：结构化日志事件（`series_stale` / `prediction_coverage`）而非新指标系统——单机 PM2 部署，日志即遥测；阈值有据（7/45 天=数据源自然节奏的 1 个周期以上）；每次事件自带 runbook 指针（指向 WEEKLY-DATA-IMPORT.md 或批 6 说明）。

## §G skill 使用记录（本轮规划，2026-08-23）

| 阶段 | skill | 应用 |
|------|-------|------|
| 战略 | zoom-out | §D 模块地图（月度语义影响面） |
| 战略 | source-driven-development | §A 全部主张附实测命令/live 证据；无凭记忆的框架断言 |
| 战略 | doubt-driven-development | 规划期自我质疑 3 次（死模型暴露？→live 双窗口实测否定；MAPE 口径分裂？→实测证实并修正；horizon 污染？→入批 6c 风险）；**终稿经 fresh-context 对抗评审**（Explore 只读代理 68 次读操作核对 file:line）报 2 blocker + 6 major + 6 minor，全部归类有效可行动并已并入计划（批 6 分解、批 7 扩范围、批 9 定案、D5 纠错）；非交互上下文 → cross-model 跳过（规则要求显式宣布） |
| 结构 | planning-and-task-breakdown | §B 批次模板（验收/验证/依赖/规模/检查点） |
| 工程 | improve-codebase-architecture | §D stalenessWindow seam（删除测试通过）；D5 以 ADR 记录 |
| 工程 | deprecation-and-migration | D6 五问框架 + advisory 优先 |
| 工程 | incremental-implementation | 批次切片纪律（≤5 文件/批、每批独立 commit、绿灯后才进下一批） |
| 质量 | tdd | 各批"验收=行为测试钉公共接口"（如 days≤90 榜单集合测试） |
| 质量 | security-and-hardening | §E 速评 |
| 质量 | observability-and-instrumentation | §F 三问 + 信号选型 |
| 质量 | shipping-and-launch | 门禁继承 + 批 6 专项检查点 + 回滚=git revert 单批 commit |
| 对齐 | spec-driven-development | 计划含 Objective/Commands/测试策略/边界（Always=门禁，Never=§九红线）结构化要素 |
| 基线 | ops-check | PM2 模式确认 + 三服务 HTTP 探活（backend /health=200、landing 200、inference 200，2026-08-23） |
| — | to-prd / triage | **不适用**：依赖 issue tracker 与 label 词表，本仓库计划落 docs（无 tracker）；已按其自身前提判定并记录 |
| — | documentation-and-adr | 名字未命中（不在可用列表）；ADR 格式惯例改从 improve-codebase-architecture 引用文件取 |

## §H 第二波不做清单（继承 + 新增显式项）

继承第一波全部（B2B 撮合 / 国内采价网络 / 冷链 SaaS / 支付下单 / 负缓存）。新增显式：**correlationAnalysis 与 analytics 的月度序列支持**（D5 记录为不做：阻碍是 daily-only 读取与跨节奏对齐，非点数不足——等日更牛肉数据解锁）；死模型数据删除（D7 建议保留）；`prediction_logs` 旧行 interval 回填（14 万行重写不值得，NULL=daily 语义兼容）。
