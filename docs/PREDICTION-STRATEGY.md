# 牛肉价格预测策略评估（2026-08-16，round-109）

> 只读评估，未改任何代码。所有数字均当日实测（psql 直查 + prediction_logs 统计），计数口径随查询附注。
> 产品约束：PRODUCT-SPEC（AI 预测 = 核心差异化）；AGENTS §七.2（只用预训练模型，不训练）。

> ## ⚠️ 2026-08-30 失效标注（round-135 规划期发现，动手前必读）
>
> 1. **本文核心实验序列 beef_carcass_us 当时实为比特币错标数据**：§一"beef_carcass_us（美牛胴体，USDA）4,241 点 2014-12→2026-08-15 新鲜 ✅"——round-126（2026-08-23）取证定案该序列是 FRED `CBBTCUSD`（Coinbase 比特币，USD/枚），**不是牛肉**；现已置换为 `PBEEFUSDM`（IMF 全球牛肉，月度，USC/lb，195 点，2010-05→2026-07，详见 KNOWN-ISSUES D4）。因此：
>    - §五的 **aud_usd r=+0.129 联动实测**、**sarimax 门禁回测（ARIMA 8.10% vs SARIMAX 8.34%）**——实验对象是比特币日线，**其"牛肉结论"全部作废**（门禁方法论本身仍有效，结论须在真实月度牛肉序列上重跑）。
>    - §一"唯一有深度且活跃的牛肉序列"从未存在过；真实牛肉数据面 = IMF 月度基准（195 点）+ CME 活牛/架子牛期货（上游日更代理）+ 冻结的部位表。
> 2. **rounds 128-132 后的重大状态变化**：月度序列已进预测循环（ADR-0001 Accepted：horizon 按月、验证窗按月、仅新实际点后重预测）；淘汰制 + split-conformal 区间已 live（§五 08-17 批次）；sarimax 维持 0 行（门禁暂缓结论的"数据理由"变了，但暂缓状态未变）。
> 3. 当前牛肉预测证据链真实状态（2026-08-30 psql 实测）：6 条健康月度序列的 56 条月度预测**全部被误标 `unverifiable`**（60→90d 窗口切换当日撞线所致，详见 IMPROVEMENT-PLAN v3.1.0 批 0）；月度行 horizon=10（=10 个月）导致首批牛肉验证证据要到 2027-05 才可能到期——**horizon 校准是证据链前置**。
> 4. **后续开发以 [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) v3.1.0（AI 预测核心专轮）为准**，本文保留作策略背景与门禁方法论存档。

---

## 一、现状事实（全部实测）

### 数据面（决定预测上限的第一约束）

| 序列 | 数据量 | 覆盖 | 新鲜度 | 状态 |
|---|---|---|---|---|
| **牛肉部位价（32 个 beef_cuts 商品）** | **30/32 零数据点** | — | — | ❌ 核心承诺序列空窗 |
| beef_carcass_us（美牛胴体，USDA） | 4,241 点 | 2014-12 → 2026-08-15 | **新鲜** | ✅ 唯一有深度且活跃的牛肉序列 |
| aus_cube_roll_m9 / aus_sirloin_m9 | 各 180 点 | 30 天 seed | 冻结 2026-04-29 | ⚠️ seed 快照 |
| beef_cut_prices 表（16 部位 × 5 工厂） | 2,401 行 | 2026-04-01 → 04-30 | **冻结 137 天** | ❌ 仅一个月历史 |
| 汇率（usd_cny 11,436 / aud 13,989 / brl 7,979） | 20-45 年 | → 2026-08-15 | 新鲜 | ✅ 深且活 |
| 原油/天然气 CME | 7-10k 点 | → 2026-08-11 | 4 天滞后 | ✅ 可用 |
| 饲料粮（玉米/大豆 CBOT 等，月频） | ~598 点 | 1992 → 2026-06 | 月度正常 | ✅ 匹配中期 horizon |
| weekly_kills / cold_storage / market_factors | 190 / 38 / 162 行 | — | — | ⚠️ 形同虚设 |

背景：D1 数据源网络封锁（KNOWN-ISSUES），用户 round-80 决策"暂不动数据"；CSV 导入路径已验证可用（round-62）。

### 模型面（9 模型 = 6 统计 + 3 Chronos）

- **verified 平均 MAPE（全商品混合口径，统计模型 05-19→07-26 队列）**：naive **3.45** < ES 3.53 < ARIMA 3.67 < HW 3.73 << STL 10.87。
  **朴素基线是该历史队列的已验证最优**——对含大量汇率/低频序列的池子，这是统计上完全正常的结果。
- **Chronos 验证情况（round-110 修正）**：初版本文档写"0 条 verified"是**笔者的查询错误**（GROUP BY 结果被 LIMIT 18 截断）——实际各变体已有 ~2,073 条 verified（07-26→08-04 队列），且 08-04 后验证中断的根因是**僵尸商品饿死验证环**的 bug（心跳价格行躲过冻结判定，2.7 万行占满 oldest-first 5000 行候选窗口），非模型问题。round-110 修复后首批解锁 1,536 条：chronos 新队列 avg MAPE **0.68-0.70**（usd_cny 0.35 / aud 0.47 / brl 0.40 / beef_carcass_us 1.43）。
- **sarimax：prediction_logs 0 条**——唯一支持外生变量的模型（engine/routers 均已实现 exog 接口），批量预测管线从未喂过外生数据。库里现成的深而新的 FX/饲料/原油没有进入任何预测。
- **统计基线 07-26 起停止生成**（chronos 上线切换，stl 已于 08-15 移除 B3）——"naive 门槛"比较缺新证据，基线需在新鲜商品上复产（见 §四）。
- 按商品分层的 verified MAPE：usd_cny 0.35-0.68 / eur 1.28 / beef_carcass_us 1.43-1.73 / brl 0.40-0.83 / aud 0.47-3.78 / natgas 5.30 / crude 12.70——**可预测性由序列本身决定**，算法间差异远小于序列间差异。

---

## 二、缺口清单（按价值链优先级）

| # | 缺口 | 级别 | 依据 |
|---|---|---|---|
| 1 | **牛肉部位价数据**：30/32 空窗、1 个月冻结快照 | P0 | 上表；没有数据一切模型无从谈起 |
| 2 | **外生变量管线**：FX/饲料/原油在库但未接预测 | P1 | sarimax 0 条日志 |
| 3 | **Chronos 验证中断**（08-04 后）+ **统计基线停产**（07-26 后）：验证证据链断档 | P1 | ~~4,340 条 0 verified~~（修正：僵尸饿死 bug，round-110 已修，见 §五）；基线复产待做 |
| 4 | **模型选择机制**：9 模型并列，无按 序列×horizon 冠军选择；STL(10.87) 仍参与共识投票 | P2 | prediction_logs + modelQuality.ts |
| 5 | **区间校准**：有 lower/upper 但无覆盖率保证（conformal 类） | P2 | inference_engine 输出结构 |
| 6 | **层次协调**：胴体(11年)↔部位(30天)、市场↔工厂 无自上而下传递 | P2 | 无对应实现 |
| 7 | **供需基本面**：进口量/海关/屠宰/库存维度数据量不可用 | P3 | weekly_kills 190 行 |
| 8 | **预测融入行情页**：spec 已指出预测藏在 /ai 子页 | P3 | PRODUCT-SPEC §三 |

---

## 三、最优方案（推荐）

**核心论点：预测能力上限由数据决定，模型只决定你离上限多近。** 当前数据结构（目标序列 30 天空窗、代理序列 11 年新鲜、外生序列深且新鲜）决定了最优解不是"换更强的模型"，而是**代理锚定 + 外生驱动 + 分层验证的 ensemble**。全部手段兼容 §七.2 预训练约束（统计拟合 ≠ 训练；conformal/层次协调均为推理时计算；Chronos 零样本）。

### 3.1 短期（1-4 周）部位价：代理锚定，不直接外推
- 以 **beef_carcass_us（11 年）为跨市场锚** + 汇率（BRL/AUD→CNY）：先用现有 correlationAnalysis 实测"部位价 ↔ 胴体价/汇率"联动强度；
- 联动成立的部位用**自上而下结构比例**（top-down）：胴体价预测 × 汇率折算 × 部位升贴水系数（30 天数据足够估一个比例，不足以外推一个序列）；
- 统计基线（naive/ES，已验证最优）为默认产出。

### 3.2 中期（1-3 月）：激活 sarimax 外生管线（数据已就位，缺的只是接线）
- 外生特征：汇率（BRL/AUD/CNY，日频）+ 玉米/大豆 CBOT（月频，饲料成本，天然匹配中期）+ 原油（运输成本）；
- 关键工程点：滞后对齐（月频宏观对日频目标）与缺失处理；先在 beef_carcass_us 上回测 sarimax vs ARIMA 增量（`experiments/sarimax_vs_arima.py` 已有雏形），增量不显著就不上。

### 3.3 Chronos 重定位：ensemble 成员 + 长序列专家，且必须过验证关
- 纳入 MAPE 验证环与统计模型同台竞技（当前是唯一没被验证的模型家族）；
- 优势场景是**长序列零样本模式识别**：给 beef_carcass_us（11 年）用，不给 30 天噪声序列用；
- 连续 N 个验证窗口劣于 naive 即降权至 0（淘汰制）——**naive 是必须打败的门槛**。

### 3.4 验证驱动选择：rolling-origin 回测作为模型准入
- 按 商品 × horizon 分层滚动回测选冠军（M4 竞赛实践）；现有 modelQuality 加权（1/max(mape,2%)）从"加权制"升级为"加权 + 淘汰制"；
- tradingSignals 共识只聚合通过准入的模型。

### 3.5 概率输出与诚实降级
- **split-conformal 区间**：推理时在校准残差上取分位数，给出覆盖率保证的区间（无需训练）；交易决策要的是区间不是点值；
- **数据不足序列明确降级**：<90 天历史的序列显示"数据积累中"，不产出假预测（与平台诚实优先准则一致，先例：apikeys usage 诚实降级 round-107b）。

### 3.6 P0 前置：数据回填运营（不做这个，以上全部是空转）
- 唯一已验证通路：`/beef/import` CSV 导入（模板 + 7 测试守护）——需要的是**运营动作**（回填至少 1-2 年历史报价）而非代码；
- 恢复 1-2 个活源（巴西/澳洲工厂报价或 USDA boxed beef 系列）+ 国产价源；
- weekly_kills/cold_storage 若无法恢复采集，从目录降级隐藏，不做空表展示。

---

## 四、实施排序建议

1. **数据回填**（P0，运营 + CSV 导入）：无此则其余全停。
2. ~~**Chronos 纳入验证环**~~（✅ round-110：根因是僵尸商品饿死验证环而非模型被排除——新增 expireWindowElapsedPredictions 清扫 + restore 窗口感知重写；首批解锁 1,536 条 chronos verified，MAPE 见 §一）。
3. **sarimax 外生接线**（在 beef_carcass_us 上先回测增量）。
4. **correlationAnalysis 实测 胴体/汇率↔部位价 联动**（决定 3.1 是否成立）。
5. conformal 区间 + 淘汰制准入 + **统计基线在新鲜商品复产**（naive 门槛需要新证据：统计模型 07-26 停产后，verified 池冻结，无法与 chronos 新队列同台比较）。
6. 预测卡片融入 /beef 行情页（spec §三 已定方向）。

---

## 五、round-110 执行记录（2026-08-17）

- **验证环饿死 bug 修复**（commit 54ada15）：心跳僵尸商品（live_cattle_cme 等 5 个，3 个月仅 3 行散点价）躲过 `latestPrice<=predictedAt` 冻结判定，2.7 万永久跳过行占满 6h 验证批次的 oldest-first 5000 行窗口 → 08-04 后 chronos 在真新鲜商品上的预测全部滞留 completed。新增窗口过期清扫（anchor+horizon+7d 宽限 + actuals 守卫）+ restore 窗口感知化。live 首跑：清扫 26,691 行，随后一批 verified 1,536/2,262。
- **chronos 实证到位**：新队列（4 个新鲜商品）avg MAPE chronos_mini 0.68 / base 0.70 / tiny 0.70——**显著优于历史统计混合队列**（naive 3.45，但那是含 crude 12.70 的混合口径，不可直接比）。同台可比需统计基线复产（待办 5）。
- 测试：backend 909→911（+2 新测试，2 个旧 restore 测试改为窗口语义），全绿；三服务 live 200。

### 第 3、4 项实验结果（同日，experiments/sarimax_vs_arima.py 参数化后实跑）

- **联动实测（§3.1 前置）**：日收益率相关（3 年/10 年双窗口）——beef_carcass_us ↔ **aud_usd r=+0.129（10y，n=2487，t≈6.4）唯一稳健**；usd_cny 3y +0.04 / 10y -0.064 符号翻转不可用；brl_usd 0.016、原油/天然气 ≈-0.06 均无信号。结论：胴体↔澳元联动真实但弱（r²≈1.7%），"胴体锚"传导只能以胴体自身趋势为主、汇率作辅助。
- **sarimax 门禁回测（§3.2）**：rolling-origin 60 起（500 天窗、H=10、同窗同horizon成对比较）——beef_carcass_us × aud_usd(fred)：ARIMA mean MAPE **8.10%** vs SARIMAX **8.34%**（SARIMAX 胜率 46.7%）；对照配对 crude × natgas 同样零提升（4.28% vs 4.28%）。**按门禁"增量不显著就不上"→ sarimax 外生接线暂缓**。根因分析：库内外生变量与胴体仅同期弱相关，future_exog 只能前向填充——同期变量天然无法转化为预测优势；要有增量需先找到**领先**指标（lagged exog，如 aud 领先胴体 N 天），列为后续实验方向而非接线方向。
- 实验脚本已参数化（`python experiments/sarimax_vs_arima.py [target] [exog] [target_src] [exog_src]`），source 过滤支持（aud_usd 的 55 行 exchange_rate_api 脏数据已隔离）。
- **统计基线复产（§四第 5 项部分，commit d00221b）**：新增每日基线批次 `generateBaselinePredictions`（4 基线模型 × 新鲜商品，同 ≥2/7d 门禁，绕过 subscribeCommodity 的 commodityId 键覆盖问题），行经 logPrediction 进入验证环 ~10 天后成熟为同代 verified 证据。live 首批 64 条全部落地。注：新鲜商品集含 ~12 个心跳僵尸商品（沿既有平台门禁行为），其行有界（每日 16×4）且会被 round-110 过期清扫在窗口到期后排空。**待 ~10 天后：accuracy 页将首次出现 chronos vs naive 同代对比。** 持续性已核实（2026-08-20）：08-18 / 08-19 / 08-20 每日批次照跑（16-19 商品 × 4 模型）；已知行为——每次后端重启会在 firstRunDelay 2min 后重触发本批次（08-17 多出 2 轮、08-20 06:11 CST 重启后 1 轮），同日重复行数值相同，对 MAPE/校准无偏，仅增行数，暂不处理（同代成熟窗口因此以 ~08-27 计）。

### 淘汰制准入 + conformal 区间校准（08-17 深夜批次，commit 3c74878；08-20 复核）

- **naive 门槛淘汰（§四第 5 项后半）**：`resolveModelWeights`（modelQuality.ts）新增淘汰判定——`MIN_VERIFIED_TO_ELIMINATE=20` 同时约束模型与 naive 双方的 verified 行数，模型 30d avgMAPE 严格劣于 naive → 权重 0（出局方向票与加权中位数）。实现语义核对：`getModelAccuracy` 按 **verifiedAt≥30d** 聚合。live 实证（2026-08-20，tsx 直跑生产库、含基线的投票集）：`[WEIGHTS] Eliminated: arima, holtwinters, exponential_smoothing`——30d 窗口 arima 3.70 / holtwinters 3.75 / exp_smoothing 3.55 均劣于 naive 3.47（各 ~3,247 verified，多为验证环修复后的补验存量）；权重落位 chronos×3=0.2796 / naive=0.1612 / 其余 0。**默认共识投票集是 ALL_MODELS（仅 chronos×3）且全部优于 naive，故默认信号路径不出现淘汰日志——线上 0 条 `[WEIGHTS] Eliminated` 是正确行为**，门槛在基线进入投票（`?models=`）或后续把基线纳入共识时生效。08-17 复产的同代基线行 ~08-27 成熟后，淘汰判定自动切换到同代证据复核。
- **split-conformal 区间校准（§四第 5 项剩余）**：新服务 `intervalCalibration.ts`——per-model 从 verified prediction_logs（60d 回看、≥30 行）取归一化残差 r=|a−p|/|a|，取 ⌈(n+1)(1−α)⌉ 阶序统计量 q（α=0.1，名义 90% 覆盖），区间 ŷ·(1±q)；60s 内存缓存。两点如实标注的近似：时序可交换性只是近似；残差跨商品池化。接入两处：`runAndCachePrediction`（订阅刷新/基线批次落库前校准，try/catch 降级原生区间）与 `routes/inference.ts` 的 `calibrateBounds`（按需 /predict 与 /predict/batch——predictFromCache 绕过 runAndCachePrediction，必须独立挂钩）。测试含 held-out 实证覆盖率 ≈90%。live：`[CONFORMAL] Calibrated intervals for 10 models (26293 verified predictions, α=0.1, 60d lookback)` 每 30min 刷新稳定出现（残差池 24,319→26,293，验证环修复后持续补给）；按需 /predict chronos_mini 区间均匀 ŷ·(1±0.027)。附带观察：基线批次中 arima 对单商品 422（LU decomposition，inference 服务数值失败）被 per-model try/catch 隔离，批次继续——失败隔离按设计工作。
- 测试：+5 淘汰判定（mock getAllModelAccuracy）+5 conformal（含覆盖率实证），backend 914→924 全绿；三服务 live 200。

### §四第 6 项核实（08-20，无需开发）

/beef 行情页预测卡片**已在此前实现**：`CutForecastCell` / `MarketForecastBoard` → `useBeefCutForecasts` → `GET /api/beef/forecasts?horizon=7`（beef.ts 路由 + beefCutSeries 新鲜度门禁 + generateBeefCutForecast）。端点当前诚实返回 0 行——根因是 beef_cut_prices 自 2026-04-30 冻结，等待 P0 数据回填（运营依赖，/beef/import CSV）后自然出数，非代码缺口。

### round-110 收尾（2026-08-20）

方案 §四 执行完毕：第 2 项（验证环饿死修复）✅、第 3/4 项（联动实测 + sarimax 门禁，接线按门禁暂缓）✅、第 5 项（基线复产 + 淘汰制 + conformal 区间）✅、第 6 项（核实为已实现，等数据）✅。遗留移交：P0 牛肉切块数据回填（运营依赖）、lagged-exog 领先指标实验（后续）、僵尸商品密度门禁（可选加固，KNOWN-ISSUES D2 已记）。

---

## 六、大模型使用规范与最优预测方案（2026-08-30，round-135，回应用户"怎样才是最准确的牛肉价格预测"）

> 结论先行：**"最准确"不来自更强的单一模型，而来自"组合预测 + 证据门禁"体系**。本仓库架构已是该形态的 90%（质量加权共识 + 劣于-naive 淘汰 + conformal 区间已 live）；本节把缺口补成可执行的七条规范，全部兼容 §七.2 预训练约束。落地载体 = [IMPROVEMENT-PLAN v3.1.0](IMPROVEMENT-PLAN.md) 批 0-2/4。

### 6.1 为什么"换更强的模型"不是答案（三条硬证据）

1. **本仓库自己的实测**：chronos 三变体在汇率/期货池上 verified 中位 MAPE 0.51-0.52% vs naive 0.33%、均值 7-10% vs 3.75%——全面劣于朴素基线，已被淘汰线清出投票（round-121/122 取证）。这与公开基准的形态一致：时序基础模型（TSFM）在高频、多域数据上强，**在低频宏观/金融序列上经常打不过 naive/ETS**。
2. **学术前沿的两个关键结论**：(a) NeurIPS 2024《Are Language Models Actually Useful for Time Series Forecasting?》——把 LLM 骨干移除后性能不降反升，通用语言模型架构对时序数值预测无实质增益；(b) 预测组合之谜（forecast combination puzzle，M 竞赛数十年结论）——简单组合（中位数/等权）稳定优于精巧的最优权重。TSFM 的正确定位是**委员会里多一个意见**，不是换主席。
3. **信息论约束**：唯一真实牛肉序列 = 195 个月度点（IMF 基准）+ 45-53 天发布滞后。任何模型都无法从 195 个点里读出不存在的信号；月度大宗基准的近随机游走特性决定了可预测上限就在"略好于朴素"附近。**能突破上限的是新信息（领先指标、更高频相关序列、部位级数据），不是新模型**——这正是数据解冻（P0）与领先指标实验（批 3）的价值所在。

### 6.2 七条使用规范

| # | 规范 | 现状 | 落地 |
|---|------|------|------|
| 1 | **准入：滚动回测 + naive 门槛**——任何模型（含未来 TSFM）进共识前须在目标序列过 rolling-origin 回测且打赢 naive（均值/中位/方向三口径） | 淘汰线已有（退出侧），缺准入侧（进入侧） | 批 1 |
| 2 | **组合：统计基线为锚，TSFM 为成员**——主力 = naive + 阻尼 ETS + ARIMA；TSFM 只作委员会成员参与加权中位数；证据 <50 条/序列时退等权（组合之谜） | 已是此形态（4 基线 + 3 chronos，质量加权） | 已达成 |
| 3 | **路由：按序列选冠军**——全局权重会把"chronos 在 FX 上弱"错误外推到牛肉（月度商品序列可能恰是 TSFM 相对擅长的形态） | `resolveModelWeights` 仅全局 per-model | 批 2 |
| 4 | **概率：卖区间不卖点值**——采购要的是"下月 90% 概率在 X-Y"；每月做**覆盖率审计**（实际落入比例 ≈ 名义 90%，漂移即重校准） | conformal live（α=0.1） | 批 4 增审计 |
| 5 | **决策指标：方向准确率一等公民**——对"该不该进货"，方向命中比点值 MAPE 相关 | 零实现 | 批 4 |
| 6 | **推理工程：确定性与可复现**——实测引擎 `predict_quantiles` **未固定采样种子**（chronos 采样路径每次调用有微差）；回测与公开档案要求固定 torch seed（或提升采样数取中位）；回测脚本可重跑出同样数字 | 缺口（本轮读码发现） | 批 1 前置 |
| 7 | **诚实：淘汰记录公开**——track-record 展示"chronos 因劣于 naive 被移出投票"是行业里最稀缺的信任资产（牧集与多数闭源供应商都没有） | track-record 已公开 | 批 5 强化 |

### 6.3 前沿模型取舍表

| 方案 | 定位 | 建议 |
|------|------|------|
| Chronos ×3 | 已接，委员会成员 | 维持；在牛肉月度序列上的去留**等批 1 回测证据**（当前淘汰结论来自 FX/CME 日更池，对牛肉不公也不准） |
| TimesFM / Moirai 等新 TSFM | 更新的基座（部分支持协变量/多频） | **不急**（= IMPROVEMENT-PLAN D6"暂不"）：先跑批 1 建立牛肉基准；若 TSFM 全员≈naive，引入第二个家族无意义；若 chronos 在牛肉显示潜力，按同一门禁引入挑战者（一次一个） |
| 通用 LLM 直接预测数值 | 已被研究否定（6.1.2a） | 不做 |
| LLM 读资讯产"情绪/事件标记"叠加油价 | 探索性（market_news 90 条在库） | 只做登记实验，**不进共识**；对外前须过回测门禁 |
| 微调/训练任何模型 | 195 点必过拟合 + 违反仓库红线（§七.2） | 禁止 |

### 6.4 一句话回答

问题不是"哪个大模型最准"，而是"怎么让 9 个模型在 195 点月度序列上各自发挥上限、并用公开证据证明"。方案 = v3.1.0 批 0（修复误杀 + horizon 校准，一切前提）→ 批 1（回测 + 种子固定）→ 批 4（方向准确率 + 覆盖率审计）。模型层面唯一可能的增量在批 3（领先指标）与数据解冻——**上限由数据决定，模型只决定你离上限多近**（本文 §三核心论点，经 round-126 数据错标事件与 chronos 实测双重验证后依然成立）。

---

## 七、最新科研成果借鉴清单（2026-08-30 检索，round-135）

> 检索方式：公开 web 检索（六路：TSFM 基准 / Chronos-2 / conformal 时序 / M6 竞赛 / LLM 时序之争 / TimesFM·Moirai 最新）。**各条目的基准声明（如"当前最优 TSFM"）系来源方口径，未经本仓独立复核**；对 MT 的借鉴价值按本仓数据形态（195 点月度 + 相关日更家族 + CPU 部署 + 预训练约束）逐条评估。

### 7.1 时序基础模型（TSFM）2025-26 演进：更小、带协变量、原生概率化

| 成果 | 要点 | 对 MT 的借鉴 |
|------|------|-------------|
| **Chronos-2**（Amazon，2025-10-20） | 120M encoder-only；**零样本支持单变量/多变量/协变量预测**；来源称 GIFT-Eval/fev-bench 当前最优 TSFM（2025-12 口径） | **本节最有操作价值**：批 3（领先指标）从此有第二条免训练路径——不只在 sarimax 上试 lagged exog，还可直接用 chronos-2 的协变量输入（活牛/汇率作 past+future covariates）。同家族（chronos-forecasting 包/HF 权重），接入成本低；120M 参数与本仓 CPU 部署匹配。仍须过批 1 同款回测门禁 |
| **TimesFM 2.5**（Google，2025-09） | 200M（较 2.0 的 500M 缩小），16k 上下文；2025-10 增多变量/协变量 | "less is more"趋势佐证；作为挑战者备选（D6 维持暂不） |
| **Moirai 2.0**（Salesforce，2025-11，标题即 "When Less Is More"） | 36M 序列语料，decoder-only，**原生分位数预测** | 概率化叙事（规范 4）与引擎 `predict_quantiles` 路径同构；备选 |
| Time-MoE（ICLR 2025 Spotlight）/ TS-RAG（NeurIPS 2025）/ Reverso（2026） | 2.4B 稀疏 MoE / 检索增强零样本 / 极小高效零样本模型 | 登记观察；与本仓 195 点场景不匹配（MoE 太大、RAG 需语料库） |

**趋势结论**：头部 TSFM 全部转向"更小模型 + 协变量支持 + 原生分位数"——与 §6.2 规范 4（卖区间）和批 3（领先指标）方向一致；**协变量零样本能力把"外生变量路线"从统计模型专属变成了 TSFM 也能做**，且全部符合预训练约束。

### 7.2 LLM 用于时序：争论已收敛，位置在"事件知识"而非"数值预测"

- 奠基否定：Tan et al.《Are Language Models Actually Useful for Time Series Forecasting?》（NeurIPS 2024）——LLM 骨干移除后性能不降反升。
- 反方细化：《Understanding Why LLMs Can Be Effective for TSF》（arXiv 2410.12326）——语言知识**在事件/外生知识起作用的场景**有帮助（如 EventCast 混合需求预测）。
- 最新：**《Rethinking the Role of LLMs in Time Series Forecasting》（arXiv 2602.14744，2026-02）**——大规模再评估，继续隔离 LLM 组件净贡献。
- **对 MT 的借鉴**：数值预测不用 LLM（维持 §6.3 不做）；但"LLM 读 market_news 出事件标记"恰好落在反方细化划出的**唯一有效区**（事件知识 → 协变量）——维持"登记实验、不进共识、过回测门禁才对外"的定位（§6.3），现有研究支撑这个克制的位置。ICML 2025 的 in-context fine-tuning 属梯度适应（训练邻近）且评审已质疑其"零样本"口径——**审查后排除**（违反 §七.2 精神）。

### 7.3 概率预测与 conformal：MT 现行实现的升级路径已有研究蓝本

| 成果 | 要点 | 对 MT 的借鉴 |
|------|------|-------------|
| 综述《A Gentle Introduction to Conformal Time Series Forecasting》（arXiv 2511.13608） | 统一非可交换场景的 conformal 时序方法 | 校准层知识底座；现行 split-conformal 的"时序可交换性只是近似"标注（round-110）在文献中是公认主题 |
| **Relational Conformal Prediction for Correlated Time Series**（ICML 2025） | **用相关序列互相校准区间**（图关系） | **现行 intervalCalibration 的"残差跨商品池化"近似的研究级修法**：牛肉×活牛×汇率是天然相关族——批 6 家族序列扩充后，把牛肉的区间校准从全局池化升级为家族内校准（登记为批 6 后续） |
| CPTC：Conformal with Change Points（NeurIPS 2025） | 变结构点检测 + conformal 融合 | 牛肉周期存在 regime 切换（如 2020-22 牛周期）；登记为远期加固——最简借用：残差 CUSUM 触发时临时加宽区间 |
| Neural Conformal Control（AAAI 2025） | 非平稳环境自适应校准 | 登记观察 |

### 7.4 金融类序列可预测性：M6 竞赛的量化教训

M6（Makridakis et al.，官方论文见 IJF 2024）：12 期×4 周、$300K 奖金、约 163 队参赛——**最终仅 1 队在预测上跑赢 naive 基准**，决策侧也以被动投资为强基准；随附研究《Avoiding overconfidence》指出过度自信普遍。**对 MT**：这是"方向命中率 + 校准区间 + 公开对错档案"叙事（§6.2 规范 4/5/7）最硬的外部引用——金融邻近序列上承诺点值精度是行业级过度自信；MT 的淘汰制（劣于 naive 出局）正是 M6 教训的制度化。

### 7.5 借鉴落点汇总

| 落点 | 内容 | 状态 |
|------|------|------|
| 批 3 改造（IMPROVEMENT-PLAN） | 领先指标实验改双臂：sarimax lagged-exog **+ chronos-2 协变量零样本**，同一滚动门禁 | 本轮已写入计划 |
| D6 细化 | "暂不引入第二 TSFM 家族"维持；**例外细化**：chronos-2 属现有家族升级且提供批 3 所需能力，随批 3 门禁评估（一次一个挑战者的纪律不变） | 本轮已写入计划 |
| 批 6 后续登记 | 家族序列扩充后：conformal 校准从全局池化升级为**关系型/家族内校准**（ICML 2025 蓝本） | 登记 |
| 远期登记 | 残差 CUSUM 变结构点检测 → 区间临时加宽（CPTC 简化借用） | 登记 |
| 叙事弹药 | M6 教训 + LLM 时序之争收敛结论，用于 about/track-record 方法论页 | 随批 5 |
| 审查后排除 | LLM 数值预测（NeurIPS 2024 + 2026 再评估）；in-context fine-tuning（训练邻近 + 零样本口径存疑）；Time-MoE/TS-RAG（与 195 点场景不匹配） | 关闭 |
