---
title: "牧集（Mooket）对标分析"
en_title: "Competitive Analysis: MT vs Mooket"
version: "1.2.0"
last_updated: "2026-08-30"
status: "active"
maintainer: "MT Team"
tags:
  - competitive-analysis
  - product-strategy
target_audience: "Maintainer, Product decisions"
related_docs:
  - "Product Spec": "PRODUCT-SPEC.md"
  - "Prediction Strategy": "PREDICTION-STRATEGY.md"
  - "Known Issues": "KNOWN-ISSUES.md"
---

# 牧集（Mooket）对标分析 — 真正差距、价值未兑现的根因、优势落实路径

> **2026-08-23**。回答四个问题：①与牧集的真正差距是什么；②为什么 MT 尚未实现真正的价值；③ MT 真实的优势是什么；④如何把设想的优势落实。
> 取证方式：MT 侧 = 生产库 `mt_db` psql 实测 + 代码事实（命令见附录）；牧集侧 = 公开页面与应用商店详情（付费内页无法未登录验证，局限声明见附录）。本文所有数字附取证日期。
>
> **v1.1.0（2026-08-23 晚，第二轮复评）**：同日 rounds 124-127 落地后对全文复核。三处实质性修订：① **撤回一项优势声明**——初版 §四.2 所称"beef_carcass_us 美国胴体价、日更、全站唯一日更牛肉序列"实为 CBBTCUSD 比特币错标（round-126 发现并修复，详见 §四.2 修订注）；② 新增 §七"第二轮复评结论"——含比初版更严重的新发现：**背景预测循环当前与牛肉零交集**（17 个在预测商品全是汇率/CME）；③ 初版全部表面数字按当前实测刷新（45 页 / 18 源 / 1390 测试），牧集版本证据更新（App Store V2.26.5，2026-06-10）。
>
> **v1.2.0（2026-08-30，round-134 深度探查）**：新增 §八——牧集 web SPA 公共 JS 构建产物的**全量路由图**（~50 条）、bundle 技术栈、首页报盘真实样例（行业数据词汇）、工商/融资/招聘事实；§七.1 的"预测循环与牛肉零交集"缺口已在 rounds 128-132 闭合（ADR-0001 Accepted，月度序列进循环，live `+ 6 monthly series`），见该节修订注。落地方案见 [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) v3.0.0。

---

## 一、牧集是什么（2026-08-23 公开面实测）

| 模块 | 内容 | 证据 |
|------|------|------|
| 情报 | 冻品行情 + 资讯 + 专业分析，**付费订阅**（"一站式冻品行情&研报订阅"） | [mujidigital.com/product](https://mujidigital.com/product) |
| 市场 | 报盘/求购 **B2B 撮合**，核心闭环（宣传语"买卖冻品上牧集"） | [应用宝详情](https://sj.qq.com/appdetail/com.mallee.mjzd) |
| 发现/肉圈 | 行业社交与资源互联 | 同上 |
| SK 系统 | 进口贸易商**冻品资产风险管理** | mujidigital.com/product |
| 冷链 SaaS | 实时视频监控 / 温度监控 / 出库预警 / 追溯 | mujidigital.com/product |

- 运营事实：App 2022 年上线（id1624403418），**App Store 当前 V2.26.5（2026-06-10 更新，2026-08-23 晚复核）**——初版引应用宝 V2.23.3/2025-12-07 系渠道镜像滞后，实际迭代更活跃（持续 4 年）；开发方牧集网络科技（上海）有限公司；宣传"百万用户"；[App Store 4.8/5（43 评分）](https://apps.apple.com/cn/app/%E7%89%A7%E9%9B%86/id1624403418)。web 端定位"进口冻品行情 冻品冻肉批发交易平台"（web.mooket.com 标题，2026-08-23 晚复核一致）。
- **未见**价格预测类产品公开卖点；其"算法"指供需匹配/推荐（仅公开面结论，待复核）。

**结构性事实**：牧集最有价值的行情数据是其市场业务（撮合）的**副产品**——真实报盘/求购活动本身产生报价，运营团队再加工成行情与研报。数据资产与用户资产互为飞轮，分发靠 App + 三年运营积累。

---

## 二、表面对比 vs 真正差距

表面对看 MT 不落下风（工程面反超）：~~44 页 / 144 端点 / 1377 测试~~（**2026-08-23 晚实测：45 页 / 144 端点 / 1390 测试**，端点口径 `router.(get|post|put|patch|delete)` 计 144 不变） vs 牧集封闭 SaaS；MT 独有 AI 预测 + MAPE 自动验证 + 相关性/回测分析。CI 全绿。**真正差距在数据资产与分发资产，按根因深度排序：**

1. **数据新鲜度（表层、但致命）**：`beef_cut_prices` 全库 **2401 行 / 16 部位 / 5 工厂 / 仅 2026-04 一个月**，冻结至今 **115 天**（来源 mla_nlrs 1440 + cepea_export 960 + bridge 1；2026-08-23 晚复核数字不变）。价格数据平台的核心商品数据停更，下游图表/预测/相关性/告警全部继承冻结。牧集行情日更。
   > **复评补充（2026-08-23 晚）**：比初版认知更糟一层——**全站当前没有任何日更牛肉序列**。唯一在更的牛肉价 `beef_carcass_us` 是月度（IMF，最新 2026-07）；MLA 部位日更组（aus_cube_roll_m9 / aus_sirloin_m9 / beef_australia）冻结于 04-29；日更且新鲜的只有汇率组与 CME 期货组（含活牛/架子牛——牛肉链**上游**代理）。
2. **数据获取模式（结构性错配）**：牧集报价来自交易网络副产品 + 运营采价；**中国港口/批发市场的部位现货价不存在可爬的公开源**——最有价值的数据在场外。MT 的 19 个爬虫全部指向公开源（USDA/MLA/CEPEA/FRED…），对核心商品无解，这不是爬虫工程能修复的。
3. **分发与用户**：MT 生产库 **3 个用户**（2026-08-23 实测）、无 App、无公众号；牧集 App + 百万用户叙事。
4. **获客闭环**：牧集的交易撮合**第一天就有用**（用户为交易而来，数据是排气）；MT 的效用（预测可信度）需要长而干净的历史才成立——冷启动鸡生蛋未解，且 PRODUCT-SPEC §九禁交易 → **不能复制该飞轮，必须另找**。
5. **内容运营**：牧集有分析师研报（人力编辑）；MT `market_news` 21 条（2 个 RSS 08-22 起接入）。

---

## 三、为什么价值未兑现（根因链）

1. **价值链倒置建设**：自底向上建好了全链路（~~19 源~~ **18 源**（round-124 删 manualImport 源文件后实测） → 30 模型 → 9 模型推理 → 信号 → ~~44 页~~ **45 页**（round-126 增 /watchlists）），但价值是自顶向下来自数据的。2026-04 核心数据断流（KNOWN-ISSUES D1：网络封锁 + 4 个空 key）后，下游所有能力都在冻结的一个月种子数据上空转——**电厂建好了，燃料断了**。
2. **获取模式错配被当前提成立**（§二.2）：把"公开源可覆盖"当作前提，而该前提对核心商品不成立。CSV 手动导入（round-81 验证）是绕行路径，但至今未建立导入节律。
3. **AI 叙事与实测倒挂**：营销主打 3 Chronos 共识，但生产库预测的验证集实测（~~148,245 条~~ **142,770 条**，2026-08-23 晚复测；差值 = round-126 清除的 6165 条错标预测）：

   | 模型 | 已验证数 | 平均 MAPE | 中位 MAPE |
   |------|---------|-----------|-----------|
   | naive_forecaster | 2866 | 4.81% | 0.35% |
   | exponential_smoothing | 2866 | 4.86% | 0.35% |
   | arima | 2866 | 5.15% | 0.35% |
   | holtwinters | 2866 | 5.17% | 0.31% |
   | chronos_mini | 3198 | 55.43% | 0.51% |
   | chronos_tiny | 3199 | 64.66% | 0.52% |
   | chronos_base | 3203 | 71.88% | 0.52% |

   （另有 `sundial`/`timer_xl` 各 16 条已验证残留——引擎已移除的死模型，落库区间 2026-05-19→07-05，共 332 条原始记录；**对外档案页若上线需按现行 MODEL_IDS 过滤**，否则榜单会出现"平均 20%/41% 的模型"误导读者。）

   双口径合起来的准确结论：**典型序列上 chronos 不差（中位 <1%），但它有无界灾难长尾**（均值被劣化序列拉高 10 倍以上，naive 的最坏情况有界）。风险视角下均值才是对的度量——采购决策毁于爆仓日而非中位数日。（中位数普遍 <1% 同时提示验证集多为易预测序列——评估口径本身待复核，另见 KNOWN-ISSUES MAPE 验证环。）
   > **复评注（2026-08-23 晚）**：上表已验证数较初版（3357/3899~3904）下降约 500/模型、均值上移——因清除 CBBTCUSD 错标预测时连带删去了其已验证 MAPE 记录。**该序列（比特币连续日更数据）此前一直在"美化"各模型 MAPE 统计**；剔除后统计更真实地反映冻结数据环境。30 天窗口现行实测：统计基线 avg 0.74~0.82 / 中位 0.46~0.47（每模型仅 **20** 条新验证——验证吞吐已随数据冻结坍缩），chronos avg 55~72 / 中位 0.51~0.52 仍劣于 naive、仍被清出投票（初版修订结论不变）。
   >
   > **口径修正（2026-08-23 晚二轮，v1.1.1，round-129 规划期发现）**：上一段与本节初版表格用的是 **raw 口径**（`mape IS NOT NULL` 全行平均）——其中混入了已标记 `stale` 的失效行：chronos_mini 30 天窗 16 条 stale 行 **avg≈9676%**，把 chronos 的 raw 均值从 7.05 抬到 55.43（`SELECT status,count(*),avg(mape)…GROUP BY status` 实测：verified 3182 条 avg 7.05 / stale 16 条 avg 9676.07）。**可引用的口径是 verified-only**（公开档案页即此口径，`computeAllModelAccuracy` 按注册表枚举 + verified 分子，live days=30/90 双窗口实测与下表精确吻合）：
   >
   > | 模型（verified-only 全周期） | 已验证数 | 平均 MAPE | 中位 MAPE |
   > |------|---------|-----------|-----------|
   > | naive_forecaster | 2796 | 3.75% | 0.33% |
   > | exponential_smoothing | 2796 | 3.84% | 0.34% |
   > | holtwinters | 2796 | 4.00% | 0.31% |
   > | arima | 2796 | 4.01% | 0.35% |
   > | chronos_mini | 3182 | 7.05% | 0.51% |
   > | chronos_tiny | 3183 | 7.09% | 0.52% |
   > | chronos_base | 3183 | 10.28% | 0.52% |
   > | stl_forecaster | 2796 | 12.48% | 7.61% |
   >
   > 修正后的结论仍成立但量级更新：chronos verified 均值 **7~10%**（非 raw 的 55~72%），约为 naive（3.75%）的 2 倍；中位 0.51~0.52 vs naive 0.33——**仍全面劣于 naive、仍被淘汰线清出投票，机制结论不变**。另注：verified 计数 == 近 90 天计数，说明 MAPE 自动验证机制本身是 round-110+ 的近期设施，尚无跨季度验证史。公开页 `predictionCount` 分母含 stale/unverifiable 行（mapeTracking.ts:853-861），与分子口径不同——IMPROVEMENT-PLAN 第二波批 8 将在 methodology 元数据中写明双向口径。

   > **修订（2026-08-23，制定改进方案时复核）**：上表为全周期口径；引擎实际使用的 **30 天窗口**下 chronos 均值为 6.2~8.8%（全周期均值含早期未清洗的单位错配离群，如 wheat_cme MAPE≈9500），中位结论不变（chronos 0.79~0.82 > naive 0.41）。**更正一处本文初版失实**：初版称"共识集成未按序列路由/加权，整体继承该尾部风险"——实际 `modelQuality.ts` 早已实现质量加权（30 天中位 MAPE，round-115）+ 劣于-naive 淘汰线（round-110，≥20 条验证且严格劣于 naive 者权重归零）。
   >
   > **三次修订（2026-08-23 晚，执行轮读码再核）**：上一修订称"chronos 三变体已被淘汰出共识投票，共识实际由 4 个统计基线驱动"**也不成立**——默认共识池 `ALL_MODELS` 当时仅含 3 个 chronos（modelRegistry.ts），三模型全部触发淘汰线后权重和为 0，落入 `resolveModelWeights` 的**等权兜底**（"documented edge" 即生产默认）。即：淘汰机制在当时的真实默认共识上**空转**，生产共识 = 3 chronos 等权。残留缺口与营销倒挂已于 round-122 批 3 修复（池扩为 3 chronos + 4 统计基线，`39a13cc`），淘汰线自此真正咬合——live 实测 30 天中位：统计基线 0.40~0.52 承担投票权重，chronos 0.79~0.82 被清出。
4. **预测公信力无处积累**：`verified_at`/`mape` 机制存在（每模型 3.3k~3.9k 条已验证），但仅登录后可见。预测产品的唯一信任货币是**带时间戳的公开对错档案**——MT 有 14.8 万条数据，没有对外展示面。
5. **无人使用 → 无反馈 → 无迭代方向**：3 个用户（含开发账号），价值假设从未被真实用户检验过。

---

## 四、MT 的真实优势（可防御的）

1. **可验证的预测机制本身**：9 模型 + 自动 MAPE 验证 + accuracy 对比页——牧集公开面无预测产品。且引擎已把实测结论制度化（质量加权 + 劣于-naive 淘汰，见 §三.3 修订），卖点应从"大模型"换成"**可验证**"并让营销口径与引擎现实对齐。
2. **国际源头结构化管道**：18 源集成覆盖 USDA / MLA / CEPEA / INAC / SECEX / FRED / CME / 世界银行。牧集情报以国内港口/批发价为主——**国际源数据是 MT 的差异化面，不是短板**。
   > **撤回并重写（2026-08-23 晚，round-126 数据完整性修复后）**：初版此处曾称"`beef_carcass_us`（US 胴体价）每日更新（2026-08-22 实测，全站唯一日更牛肉序列）"——**该声明作废**。事实链：FRED 系列 CBBTCUSD 是 Coinbase 比特币价（USD/BTC），被错标为牛肉胴体价入库 4248 行（2014-12→2026-08）并衍生 6165 条错标预测；round-126 已清除并回填 **PBEEFUSDM（IMF 全球牛肉价，月度，美分/磅，195 点，最新 2026-07=331.78）**。即"日更国际牛肉基准"**从未存在过**（详见 KNOWN-ISSUES D4 已解条目）。
   > 修正后的真实牛肉数据面：**日更牛肉序列 0 条**；国际基准月更（IMF）；牛肉链上游有 CME 活牛/架子牛期货日更（2026-08-21 实测）；MLA 部位日更组冻结待解封。此优势主张相应**降级但完全为真**：管道结构（18 源、FRED CSV 共享抓取、月度序列端到端支持）是真实能力，其上目前只挂着月度牛肉基准 + 日更上游期货。
3. **全栈自持 + 可私有部署 + 中立性**：牧集是封闭 SaaS **且同时运营市场（平台即交易对手，有利益冲突）**。"只做数据与预测、不做撮合"的中立性 + 私有部署能力，是对牧集结构性不适配客群（合规敏感的大贸易商）的楔子。
4. **分析深度**：相关性分析 / 回测 / 多模型共识 / 置信区间 / 异常检测 / 告警——超越报价展示的量化工具链。
5. **工程效率与诚实文化**：单人 + AI 代理维护全平台（CI、1377 测试）；MAPE 自动验证 + round-119/120 主动撤回虚假营销——在黑盒数据供应商市场里，"敢公开对错"本身是品牌资产。

**共同点与本质差异**：MT 的优势全是**能力型**（管道/预测/自持），牧集的优势全是**资产型**（数据网络/用户/品牌）。能力只有指向一个可服务的利基并持续兑现时才变成价值。

---

## 五、如何落实（P0→P3 + 不做清单）

**P0 — 解冻数据（唯一 P0，其他一切的前提）**
- `beef_cut_prices` CSV 回填 2026-05→08，并建立**每周人工导入节律**（round-81 已验证路径；用户动作，代码侧就绪）。
- ~~把 `beef_carcass_us` 日更序列做成首页"活水证据"（国际现货基准每日在更）~~（**前提已崩塌（2026-08-23 晚）**：该"日更序列"实为比特币错标，见 §四.2 撤回。现状重写：dashboard 首卡已展示 IMF 月度牛肉基准（round-126 D2）、Hero 频度标注按数据推导为 "Monthly series"（round-127）；"每日在更"叙事只能用于汇率 + CME 组——其中**活牛/架子牛期货是与牛肉最相关的日更活水**，且背景预测循环在持续产出（24h 覆盖 17 商品，2026-08-23 实测）。）

**P1 — 把已有数据变成信任资产（预测公信力）**
- 公开**带时间戳的预测档案页**：每次预测留档、实际值到期回填、滚动 MAPE 榜单（`prediction_logs` 数据现成）。复评补充（2026-08-23 晚）：① 榜单须过滤死模型残留（sundial/timer_xl，见 §三.3）；② 验证吞吐已坍缩（30 天窗口每模型仅 20 条新验证）——**档案页的滚动更新本身依赖数据解冻**，P0 仍是其前提。
- 共识权重与淘汰已实现（round-110/115，§三.3 修订）；剩余工作是**残留缺口收口**（区间/无权均值/bestModel 感知权重）与营销口径对齐，见 [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) 批 1/批 3。
- ~~修正 `ai/predict` 硬编码模型列表~~（**已解决 `283c685`**，round-122 批 4：下拉改调 `/api/inference/models`，预填改 `beef_carcass_us`）。

**P2 — 定位与最小分发**
- 定位一句话：**进口牛肉国际行情 × 可验证 AI 预测**。明确不与牧集拼国内现货报价（拼不过也不该拼）。
- 3→10 真实种子用户（进口贸易商的采购择时场景）；~~watchlist UI 入口建设（§十四 已登记）作为留存钩子~~（**已建 `dd91b88`**，round-126 D1：`/watchlists` 页 + hooks；生产库已有 4 清单 / 3 条目在用——2026-08-23 晚实测，微弱但真实的留存信号）。
- 准确率档案对外周更（行业社群/公众号）——预测产品的零成本分发。

**P3 — 商业楔子（后置）**
- 可私有部署 Enterprise（PRODUCT-SPEC §九 paywall 延后决策不变）。

**不做清单**：B2B 撮合（重运营 + 合规 + 与 §九冲突）；国内现货采价网络（重人力）；冷链硬件 SaaS；支付/下单（红线）。

---

## 六、证据附录

**MT 侧（2026-08-23，生产库 mt_db）**

```sql
-- 用户数
SELECT count(*) FROM users;                                    -- 3
-- 核心商品数据冻结
SELECT count(*), count(DISTINCT "cutCode"), count(DISTINCT "factoryId"),
       min(date)::date, max(date)::date FROM beef_cut_prices;   -- 2401 / 16 / 5 / 2026-04-01 / 2026-04-30
SELECT source, count(*), max(date)::date FROM beef_cut_prices GROUP BY 1;
-- 预测验证与 MAPE（均值+中位双口径）
SELECT model_id, count(mape), round(avg(mape)::numeric,2),
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY mape))::numeric,2)
FROM prediction_logs WHERE mape IS NOT NULL GROUP BY 1 ORDER BY 3;
SELECT count(*) FROM prediction_logs;                           -- 148245
-- 活水数据源
SELECT source, count(*), max(date)::date FROM commodity_prices GROUP BY 1;
-- fred 67090 至 2026-08-22；exchange_rate_api 183 至 08-22；cme 100 至 08-21；
-- world_bank 48 至 06-01；usda_ams 2776 冻结 04-29
-- 全站唯一日更牛肉序列
SELECT slug FROM commodities WHERE id='9c8201bc-5ff8-401e-aa9c-d89e36cfa811';  -- beef_carcass_us
-- 资讯
SELECT count(*) FROM market_news;                               -- 21
```

营销数字口径：`frontend/src/lib/site-stats.ts`（19 集成中 3 个产数、74 部位分类、21 工厂）。（2026-08-23 晚复核实测：`aiModels: 9` / `beefCuts: 74` / `factories: 21` / `dataSources: 19` / `sourceCountries: 5` 不变；19 的现行算式 = 18 源文件（17 注册 + inac 休眠）+ `/api/beef/import` CSV 通道，round-124 删除独立 manualImport 源文件后头注已同步修正。）

**MT 侧第二轮复测（2026-08-23 晚，生产库 mt_db）**

```sql
-- 用户与留存钩子（watchlist 为 round-126 D1 后首次有数）
SELECT count(*) FROM users;                                    -- 3（不变）
SELECT count(*) FROM watchlists;                               -- 4
SELECT count(*) FROM watchlist_items;                          -- 3
-- 核心商品数据：冻结未解
SELECT count(*), max(date)::date FROM beef_cut_prices;         -- 2401 / 2026-04-30（不变）
-- 预测总量：142770（初版 148245 − 清除 6165 条错标 + 新增）
SELECT count(*) FROM prediction_logs;                          -- 142770
SELECT count(*) FROM prediction_logs WHERE predicted_at > now() - interval '7 days';  -- 17200（循环健康）
-- 背景预测覆盖：全部为汇率/CME 日更组，牛肉 0 条（月度门控排除，round-127 登记项）
SELECT count(DISTINCT commodity_id) FROM prediction_logs
 WHERE predicted_at > now() - interval '24 hours';             -- 17（aud_usd/usd_cny/brl_usd + CME 组）
SELECT count(*) FROM prediction_logs pl JOIN commodities c ON c.id=pl.commodity_id
 WHERE c.slug='beef_carcass_us';                               -- 0（6165 条错标已清，月度序列不在循环）
-- 牛肉数据面
-- beef_carcass_us | monthly | USC/lb | 195 pts | max 2026-07-01（IMF PBEEFUSDM）
-- live_cattle_cme / feeder_cattle_cme | daily | USD/cwt | max 2026-08-21（上游日更代理）
-- aus_cube_roll_m9 / aus_sirloin_m9 / beef_australia | daily | max 2026-04-29（冻结）
SELECT count(*), max(date)::date FROM commodity_prices WHERE source='fred';  -- 63037 / 2026-08-18（67090−4248+195）
-- MAPE 全周期与 30 天窗口见 §三.3 复评注；死模型残留
SELECT model_id, count(*) FROM prediction_logs
 WHERE model_id IN ('sundial','timer_xl') GROUP BY 1;          -- 165 / 167（2026-05-19→07-05，引擎已移除）
-- 资讯
SELECT count(*) FROM market_news;                              -- 22（RSS 持续接入中）
```

**牧集侧（公开面，2026-08-23）**

- [web.mooket.com](https://web.mooket.com/) — 标题"进口冻品行情 冻品冻肉批发交易平台"（Vue SPA，仅 SEO meta 可读）
- [应用宝详情页](https://sj.qq.com/appdetail/com.mallee.mjzd) — 开发方、版本 V2.23.3（2025-12-07）、四模块描述、"百万用户"
- [牧集科技产品页](https://mujidigital.com/product) — 4 大模块 8 大核心价值、行情&研报订阅、SK 系统、冷链四功能
- [App Store](https://apps.apple.com/cn/app/%E7%89%A7%E9%9B%86/id1624403418) — 4.8/5，43 评分；**当前版本 V2.26.5，2026-06-10 更新**（2026-08-23 晚复核；应用宝 V2.23.3/2025-12-07 系渠道镜像滞后）

**局限声明**：牧集订阅价格、数据覆盖明细、有无预测能力均在付费墙内，未登录无法验证；"百万用户"为其自我宣传未经第三方核实。本文对牧集的全部结论仅基于公开面。

---

## 七、第二轮复评结论（2026-08-23 晚，v1.1.0）

> 同日 rounds 124-127 落地后的复评。初版（v1.0.0）的四问框架不变，本节只记**变化**与**修正后的结论**。

### 差距：一项加深，四项不变

1. **【加深】预测循环与牛肉零交集**——比初版认知更严重的价值错位。初版以为有一条例行预测的日更牛肉序列；复评实测：背景预测 24h 覆盖 17 个商品**全部是汇率/CME**，`beef_carcass_us` **0 条预测**（6165 条错标清除后，月度序列被调度器 7 天新鲜度门控排除，round-127 已登记决策项）。"AI 牛肉预测平台"的自动化产出当前没有一条落在牛肉价格上——下游前端/信号/相关性继承同样的空洞。**这是 P0（数据解冻）+ 月度序列管线决策项的共同缺口，比 v1.0.0 描述的"冻结"更根本。**
   > **已闭合（2026-08-30 补记，rounds 128-132）**：round-129/131 批 6a/6b/6c 落地月度序列语义（ADR-0001 Accepted：horizon 按月、验证窗按月、仅新实际点后重预测、cadence 感知订阅），round-132 修复双节奏泄漏与 60→90d 窗口。live 实测：调度器 `Subscribed 15 daily + 6 monthly`（含 beef_carcass_us），`predictionBeefCoverage24h` 0→1，月度预测 MAPE 验证环端到端通过（`verify-monthly-lifecycle.ts` 硬验收）。本条不再是开放缺口；月度节律导致的指标"眨眼"另行登记（TECH-DEBT round-132）。
2. 数据新鲜度：核心部位 2401 行冻结 115 天不变；全站日更牛肉序列从"以为有"变为"确认为无"（§四.2 撤回）。
3. 结构性错配（场外现货不可爬）、分发（3 用户 vs App+运营）、获客闭环（红线禁交易、飞轮不可复制）、内容运营（22 条 vs 分析师研报）——四项与初版相同。牧集 App Store V2.26.5（2026-06-10）证明其迭代仍在继续。

### 优势：一项撤回降级，其余增强

1. **【撤回降级】国际源头管道**：从"含日更牛肉基准的 19 集成"降级为"月度 IMF 全球牛肉基准 + 日更 CME 活牛期货（上游代理）+ 18 源结构"。降级后的主张每一条都有 SQL 实测支撑——**对诚实品牌而言，缩窄但为真的优势优于宏大但掺假的叙事**。
2. **【增强】可验证预测 + 数据治理透明**：30 天口径统计基线 avg 0.74~0.82 真实承担投票权重（round-122 池修复后机制真正咬合）；round-126 主动清除 6165 条错标预测并全链路修正展示——"敢删自己的数据"与"敢公开对错"同属信任资产。
3. **【增强】留存钩子已落地且有微弱真实使用**：watchlist 页 round-126 上线，生产库已有 4 清单 / 3 条目。
4. 不变：中立性/私有部署楔子（牧集"平台即交易对手"的结构性冲突不变）；分析深度工具链；单人+AI 维护全栈的工程效率（45 页 / 144 端点 / 1390 测试，三服务在线）。

### 净结论

差距的本质（资产型 vs 能力型）与落实路径（P0 解冻 → P1 公信力 → P2 分发）复评后**不变且更清晰**；变化在两处：① 初版的一项能力型优势（日更牛肉序列）被证明是数据错标假象，复评后 MT 的全部优势主张均有可复现实测支撑；② 新识别的最高优先工程缺口是**让预测循环重新覆盖牛肉**（月度序列门控语义 + 部位数据解冻双管齐下），它同时是 P0 与 P1 的交点（**2026-08-30 补记：已闭合，见 §七.1 修订注**）。

---

## 八、深度探查：web SPA 路由图与实现证据（2026-08-30，round-134）

> 取证方法：本环境无可用浏览器后端（`agent.browsers.list()` 为空，SPA 无法真渲染），故改用**公共静态构建产物取证**——`curl` 拉取 web.mooket.com 的 HTML 壳与公共 JS bundle（`/assets/index-*.js` 1.6MB），从中提取全量前端路由表与依赖技术栈；辅以搜索引擎缓存的首页渲染内容、工商信息（天眼查/投资界）、BOSS 直聘在招数、App Store 结构化数据。**全部为公开资产，未触碰任何需登录/付费的接口**；付费墙内结论仍不可验证（局限同初版）。

### 8.1 Web 端全量路由图（SPA bundle 提取，~50 条，按业务分组）

| 业务面 | 路由 | 解读 |
|--------|------|------|
| **交易撮合（~20 条，web 端的主体）** | `/trading`、`/offer/list`（报盘大厅）、`/offer/details`、`/myOffer/{add,edit,detail,success}`、`/myPurchase`（我的求购）、`/mySale/{add,edit,detail}`、`/noGroupOffer`、`/noGroupPurchase`、`/buyer/{list,details}`、`/merchant/details`（商家主页）、`/bussiness/{settleIn,bussinessBaseEdit,bussinessHomeEdit}`（入驻+店铺资料/门面编辑）、`/myBussiness` | 报盘/求购双向市场 + 商家店铺体系 + 入驻流程，闭环完整 |
| **行情（仅 2 条）** | `/marketTrends/index`、`/marketTrends/details` | 行情在 web 端只是**引流面**，非主体 |
| **关注（watchlist 对应物）** | `/followProduct`、`/followProduct/{add,edit}` | 牧集有"关注产品"功能——MT 的 `/watchlists`（round-126）存在直接对等物，**方向被竞品验证** |
| **资讯/研报** | `/information/index`、`/information/hot/list`、`/information/report/{list,search}`、`/information/details/:id`、`/information/search` | 研报是独立子模块（带检索）——对应其"付费研报订阅"定位；bundle 含 wangEditor 富文本（人工撰写发布） |
| **IM 沟通** | `/chat/index`（bundle 含 TencentCloudChat SDK） | 交易沟通是核心基建 |
| **SK/金融风控面** | `/factorData/index`（保理数据）、`/financialInformation`、`/creditInformation`、`/documentInformation`（单证） | mujidigital.com 所述 SK 系统（冻品资产风险管理）的 web 面：供应链金融基建 |
| **B2B 多角色** | `/personnelManagement`、`/roleConfiguration`、`/user/details`、`/workLayout`、`/platformLayout` | 企业客户子账号与权限体系 |
| **通用** | `/login`、`/register`、`/userCenter(/edit)`、`/privacy`、`/mujiprivacy`、`/userAgreement`、`/home` | — |

**结构性结论（路由数量比）**：交易面 ~20 : 行情面 2——牧集 web 端本质是**市场优先**，行情是内容引流。这与 §一 的"数据是交易副产品"判断在实现层得到直接证实。

### 8.2 技术栈与获客证据（bundle + meta）

- **栈**：Vue 3 + Vite（`vue-*.js`/`index-*.js` 命名指纹）、TencentCloudChat（IM）、wangEditor（富文本内容发布）、腾讯云 COS（对象存储——单证/报告/图片）、alicdn iconfont。无 SSR/prerender 迹象（robots.txt、sitemap.xml 均回退 SPA 壳，未公开站点地图）。
- **SEO 策略**：meta description/keywords 堆砌**长尾疑问词**（"为什么进口牛肉比国产便宜"、"中国进口牛肉的8个国家"、"俄罗斯进口牛肉价格"……）——获客含自然搜索路线，吃进口牛肉常识性长尾查询。MT 目前公开面（landing + /ai/track-record）无中文长尾内容策略。

### 8.3 报盘数据词汇（首页真实样例，搜索引擎缓存提取）

> 眼肉盖（**谷饲，100D+ 安格斯75VL**）阿根廷 **3270 厂** —— 特价 **59元/千克**，**25吨**；牛霖（草饲**97VL**）巴西 **SIF2924** —— 58元/千克，27吨；西冷肋条（草饲75VL）巴西 SIF2583 —— 上海市特价

一条中国牛肉贸易的报价 = **部位名 × 饲养方式（谷饲/草饲）× 饲养天数（100D+）× 品种（安格斯）× 瘦肉率（VL）× 厂号（3270/SIF…）× 计价（RMB/kg）× 吨数 × 仓位（上海市）**。这是行业数据的真实 schema——MT 的 `BeefCutPrice`（factoryId + cutCode + price + currency + unit）覆盖了部位/工厂/价格，**缺饲养方式、天数、瘦肉率、品种、仓位五维**。这是本轮深探最有操作价值的发现：数据词汇对齐是 MT 数据模型的下一步（落地方案见 IMPROVEMENT-PLAN v3.0.0 批 1）。

### 8.4 公司与运营事实（工商/招聘/App Store，2026-08-30 检索）

- 牧集网络科技（上海）有限公司：**2021-10-14 成立，注册资本 1000 万，法人李晨唯**；**天使轮 2024-02-07（金额未披露，投资界口径）**；对外投资 2 家；商标 16 条。关联企业上海牧集科技（集团）有限公司（2023-06 成立，肉类蛋白流通冷链生态）。
- BOSS 直聘在招 **2 个岗位**（小团队体量，与天使轮阶段一致）；App Store **4.8/43 评分**（2026-08-30 结构化数据复核，与 08-23 一致；版本 V2.26.5/2026-06-10 为 08-23 口径）。
- **校准**："百万用户"系自我宣传（初版已声明未经核实）；43 条 App Store 评分 + 2 在招岗位 + 天使轮，共同指向其实际体量为**早期 B2B SaaS 公司**（真身是 SK 系统 + 冷链 SaaS 的企业服务，toC App 是获客门面）。MT 与之竞争的平面（数据/分析/预测）上，对方并非不可追赶的巨头——差距在**国内现货数据网络与运营人力**，这恰是 MT 明确不拼的面。

### 8.5 深探后的五条战略含义

1. **"不拼撮合"从定位选择升级为实现层证据**：交易面是牧集 web 的 ~20 条路由主体、IM/店铺/入驻/金融全套基建；MT 复制这套需运营+合规+人力，且与 §九 红线冲突——维持不做，专注其薄弱面（行情深度 × 预测）。
2. **watchlist 方向被竞品验证**：`/followProduct` 存在 add/edit 完整功能；MT round-126 的 `/watchlists` 是对等能力，继续作为留存钩子运营。
3. **数据词汇缺口是最可操作的差距**：饲养/VL/品种/仓位五维是行业报价的"普通话"（§8.3）；MT 的国际源数据（USDA/MLA）天然携带部分维度（grading/lean），导入与展示对齐后，"国际行情"才真正可被国内贸易商阅读。
4. **内容面打法分化**：牧集 = 人力研报（wangEditor）+ 长尾 SEO；MT 的诚实应法 = **真数据自动摘要 + 公开预测对错档案**（已有 track-record 基建），补一张中文公开行情面吃长尾流量（零人力、真数据、可验证）。
5. **牧集体量现实消解"巨头威慑"**：天使轮/2 岗/43 评分——其在数据/分析/预测平面的投入有限（行情仅 2 条路由）；MT 在自己选定的平面上（国际源管道 + 9 模型可验证预测 + 131 端点全栈）**工程能力并不落后**，落后的是数据资产与分发（§二 结论不变，但量级感校准）。
