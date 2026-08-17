# 牛肉价格预测策略评估（2026-08-16，round-109）

> 只读评估，未改任何代码。所有数字均当日实测（psql 直查 + prediction_logs 统计），计数口径随查询附注。
> 产品约束：PRODUCT-SPEC（AI 预测 = 核心差异化）；AGENTS §七.2（只用预训练模型，不训练）。

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
- **统计基线复产（§四第 5 项部分，commit d00221b）**：新增每日基线批次 `generateBaselinePredictions`（4 基线模型 × 新鲜商品，同 ≥2/7d 门禁，绕过 subscribeCommodity 的 commodityId 键覆盖问题），行经 logPrediction 进入验证环 ~10 天后成熟为同代 verified 证据。live 首批 64 条全部落地。注：新鲜商品集含 ~12 个心跳僵尸商品（沿既有平台门禁行为），其行有界（每日 16×4）且会被 round-110 过期清扫在窗口到期后排空。**待 ~10 天后：accuracy 页将首次出现 chronos vs naive 同代对比。**
