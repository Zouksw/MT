# 项目现状全景 + 最终产品愿景 + 核心功能尽善尽美设计

**日期**: 2026-07-26
**性质**: 战略性文档 — 基于四层深度审计（backend / frontend / inference / data-layer）+ live ops 诊断 + DB ground-truth 查询
**权威定位**: 以 `docs/PRODUCT-SPEC.md` 为唯一产品真相来源（beef-only，类牧集网 × IoTDB AINode）

---

## 第一部分：项目开发现状全景（基于实测，非文档声明）

### 1.1 部署健康（live ops 诊断 2026-07-26 20:46）

| 服务 | 端口 | 状态 | 说明 |
|---|---|---|---|
| backend (mt-backend) | 8000 | ✅ online | `/health` 200，uptime 19m，117MB |
| frontend (mt-frontend) | 3000 | ✅ online | HTTP 200，96MB |
| **inference (mt-inference)** | **10810** | **❌ DOWN** | **connection refused。2026-07-22 被 SIGHUP 停止后从未重启** |
| postgres | 5432 | ✅ listening | |
| redis | 6379 | ✅ PONG | |

**关键 ops 漂移**：inference 服务停了 4 天。后果：
- 所有实时 AI 预测调用（`/api/inference/predict`、`/api/signals/:slug` 共识）在生产环境 **500 失败**
- 3 个后端集成测试失败（它们调用真实 inference 服务）——**不是代码 bug，是环境 artifact**
- Redis 缓存（45min TTL）在缓存命中时仍能返回旧预测，但缓存 miss 即失败

**测试基线**（当前实测）：backend vitest **524 pass / 1 pending / 3 fail**（fail 全是 inference-down 导致）| frontend jest **258 pass** | inference pytest **9 pass**

### 1.2 数据层残酷真相（DB ground-truth 查询）

```
BeefCutPrice（/beef UI 唯一读取的表）:
  总行数: 2401
  覆盖部位: 16 个 cutCode
  覆盖工厂: 5 个
  时间范围: 2026-04-01 → 2026-04-30  （今天 2026-07-26，过期 87 天）
  按 source:
    mla_nlrs                      1440 rows  ← 合成随机种子，source 字段撒谎
    cepea_export                   960 rows  ← 合成随机种子，source 字段撒谎
    bridge:commodity:aus_cube_roll_m9  1 row  ← 唯一的 bridge 输出，仍源自种子

CommodityPrice（活跃表）:
  总行数: 64888
  最新: 2026-07-25（昨天，活跃）
  beef_carcass_us: 4220 点（这是美国胴体均价聚合，不是部位价）

prediction_logs:
  verified:   478    （真实 MAPE 验证过）
  completed: 104399  （已生成预测，待验证）
```

**18 个数据源 × 真相**（实测，非声明）：

| # | 源 | 写入表 | 需 key | 真实产出牛肉? | 实际状态 |
|---|---|---|---|---|---|
| 1 | commodity_prices | MarketFactor+CommodityPrice | 无 | ❌ 仅 3 个汇率对 | healthy（非牛肉）|
| 2 | cme_futures | CommodityPrice | 无 | ❌ 胴体聚合+活牛期货 | healthy（adjacent）|
| 3 | dce_futures | CommodityPrice | 无 | ❌ | empty（endpoint 死）|
| 4 | fred | MarketFactor | FRED_API_KEY | ❌ | skipped_no_key |
| 5 | fao_prices | CommodityPrice | 无 | ❌ 肉类指数 | empty |
| 6 | cepea | CommodityPrice | 无 | ❌ 结构上只写活牛 | empty（Cloudflare 403）|
| 7 | inac | **BeefCutPrice** | 无 | ⚠️ 若可达则可 | empty（网络阻断）|
| 8 | mla_nlrs | **BeefCutPrice** | **MLA_API_KEY** | ⚠️ 若 keyed 则可 | **skipped_no_key** |
| 9 | secex | MarketFactor | 无 | ❌ | empty |
| 10 | abares | MarketFactor | 无 | ❌ | empty（regex 过期）|
| 11 | usda_ams | CommodityPrice+**BeefCutPrice** | **USDA_MARS_API_KEY** | ⚠️ 若 keyed 则可（600+ 部位）| **skipped_no_key** |
| 12 | usda_psd | MarketFactor | 无 | ❌ | empty（API 404）|
| 13 | china_wholesale | CommodityPrice | 无 | ❌ | empty（地理阻断）|
| 14 | china_customs_stats | MarketFactor | 无 | ❌ | empty |
| 15 | baltic_dry | CommodityPrice | (FRED fallback) | ❌ | empty |
| 16 | shipping_index | MarketFactor | 无 | ❌ | empty |
| 17 | world_bank | CommodityPrice | 无 | ❌ 能源/金属/谷物 | **healthy（非牛肉）**|
| 18 | weather | MarketFactor | OPENWEATHER_API_KEY | ❌ | skipped_no_key |

**结论：18 个源，0 个真实产出牛肉数据。** "2 healthy" 是 commodity_prices(汇率)+world_bank(非牛肉)，都是 macro。

### 1.3 技术栈各层完成度（实测，分维度）

#### Backend（Express + TS + Prisma + PostgreSQL + Redis）— **架构完成度高，数据层空**

| 模块 | 状态 | 说明 |
|---|---|---|
| server 启动 + cron 分层 | ✅ complete | 4 级调度（hourly/6h/daily/MAPE），诚实状态分类 |
| 路由（21 个文件）| ✅ complete | market/beef/signals/inference/alerts/auth 全通；billing/models-train 是 stub |
| 数据采集架构 | ✅ 管道完成 | skip/empty/error 三态分类业界最佳实践 |
| **数据源活性** | ❌ **18 源 0 产牛肉** | 见 1.2 |
| 预测管道（5 模型共识）| ✅ complete | 中位数共识、pluralism 方向、Redis 45min 缓存、闭环 MAPE |
| **预测-牛肉耦合** | ❌ **架构断层** | 见第三部分核心设计 |
| beefPriceBridge | ⚠️ stopgap | 仅 5 slug，实际只输出 1 行，且把胴体聚合冒充部位价 |
| Prisma schema | ✅ 但有精度隐患 | BeefCutPrice.price 是 Float（非 Decimal）— 金额精度损失 |
| 74 部位 taxonomy + 4 语言 normalizer | ✅ complete | O(1) 查表 + alias + 模糊匹配 |
| Auth（JWT+refresh+lockout+rate limit+CSRF）| ✅ 生产级 | |

#### Frontend（Next.js 15 + React 19 + Tailwind v4）— **IA 基本到位，残留诚实缺口**

| 模块 | 状态 | 说明 |
|---|---|---|
| App Router（54 页）| ✅ 结构完整 | 路由分组清晰 |
| 导航 IA（6 区 16 项）| ✅ beef 聚焦 | 但 /trading/portfolio + /watchlist 路由 stub 仍在 |
| 数据获取（useRetryableFetch）| ⚠️ 三套并存 | 标准已立，迁移未完（Refine legacy + raw SWR + retryable）|
| **landing 数字诚实** | ❌ **残留矛盾** | SocialProof.tsx 硬编码 85+/8/16+，pricing 页 6 处 85+，layout.tsx "55+ commodities"——上一轮漏改 |
| beef 页（prices/cuts/factories）| ✅ complete | 真实 endpoint，预测已织入（MarketForecastBoard）|
| AI 页（predict/accuracy/anomalies）| ✅ 接通 | 但 anomalies 页 credentials 放错位置（放 headers 里）|
| dashboard | ✅ 目标 IA | 已从覆盖率 KPI 改为牛肉均价+AI预测 |
| 图表资产（ProfessionalChart 582行 + PredictionChart 526行 + AnomalyChart 553行）| ✅ 强 | 2.9k LOC 可视化 |
| 设计系统（tokens + primitives + honest states）| ✅ 成熟 | EmptyState/ErrorDisplay/LoadingState 一等公民 |
| 测试 | ⚠️ 偏薄 | hook/lib 强；页面/图表薄（54 页仅 2 页有单测）|

#### Inference（FastAPI + statsmodels + chronos）— **6 模型可用，chronos 假活，服务当前宕机**

| 模块 | 状态 | 说明 |
|---|---|---|
| 6 统计模型（arima/sarimax/holtwinters/exp_smoothing/naive/stl）| ✅ 端到端 | 都产出 point+CI，短数据降级为 naive |
| chronos | ❌ configured-but-blocked | import 成功→/models 列出，但 from_pretrained 卡死（huggingface.co 阻断）|
| /predict + /predict/batch | ✅ | batch 隔离单项失败 |
| /models | ⚠️ 过度声明 | 列出 chronos 但实际不可用 |
| **服务进程** | ❌ **DOWN** | 见 1.1，需重启 |

### 1.4 三类真实残留（违背 PRODUCT-SPEC，可立即修，不依赖外部 key）

1. **landing 诚实残留**（上一轮漏改）：`SocialProof.tsx` 硬编码 85+/8/16+ 与 SITE_STATS(74/5/21) 直接矛盾；`pricing/page.tsx` 6 处 85+；`layout.tsx` "55+ commodities"
2. **§九 路由 stub**：`/trading/portfolio` `/trading/watchlist` 目录+组件仍在（只是不在 nav）
3. **inference /models 诚实**：列出 chronos 但不可用

---

## 第二部分：明确最终产品方向与具体形态

### 2.1 产品北极星（一句话）

> **为中国牛肉产业链提供「部位级」牛肉价格数据采集、行情展示、多维分析，并以多模型 AI 集成预测未来价格走势的专业信息平台。**

**对标**: 牧集网（数据+资讯深度）× IoTDB AINode（预训练模型预测智能）
**唯一差异化**: 牧集网无 AI 预测；AINode 无行业数据。本平台 = **牧集的数据深度 × AINode 的预测智能**
**明确不做**（PRODUCT-SPEC §九）：交易撮合、非牛肉商品进主 IA、UGC、原生 App、付费墙

### 2.2 最终产品的具体效果（用户视角，逐页）

#### 行情层（对标牧集网首页）
- **价格总览页 `/dashboard`**：进口/国产均价 + AI 7日预测（方向+幅度+置信度+模型数）+ 热门部位价格表（部位|产地|今日价|涨跌|7日预测）+ 最新资讯流
- **牛肉行情 `/beef`**：部位级价格表、按 primal 分组、周屠宰、冷库、价格分布。**每个价格旁带预测摘要**
- **部位详情 `/beef/cuts/[cutCode]`**：90 天历史 + 多源对比 + **该部位的 AI 预测详情+置信区间图**
- **工厂目录 `/beef/factories`**：按国家分组，产能+准入市场

#### AI 预测层（核心差异化）
- **每个价格都带预测**：不是藏在子页面，而是织入每一行行情。点击展开 → 多模型详情 + 置信区间
- **模型准确率 `/ai/accuracy`**：真实 MAPE 表（已闭环验证 478 条），趋势图、模型对比
- **价格预测 `/ai/predict`**：自由时序预测表单
- **异常检测 `/ai/anomalies`**：Z-score/ML/STRAY

#### 分析层
- **价格走势 `/trading`**：Bloomberg 级 K 线 + 预测叠加（核心资产）
- **产地对比 `/dashboard/analysis/origin`**：多国产地价对比
- **相关性 `/dashboard/analysis`**：Pearson 相关性矩阵

#### 数据/系统层
- **数据源看板 `/settings/data-sources`**：**诚实**显示每个源的 direct/adjacent/macro 分类 + 健康状态 + "Beef sources healthy: 0/4"
- **数据集/时间序列**：用户自上传
- **告警/设置**：异常告警、价格阈值告警

### 2.3 里程碑现状对照（PRODUCT-SPEC §八）

| 里程碑 | 文档声明 | 实测真相 | 真实缺口 |
|---|---|---|---|
| **M1 可信的牛肉行情平台** | "完成" | 90% 完成 | landing 诚实残留、§九 stub、inference 宕机 |
| **M2 AI 预测融入主流程** | "完成" | **架构断层** | 预测跑在 CommodityPrice（非牛肉），未跑在 BeefCutPrice（牛肉）|
| **M3 完整资讯+分析平台** | 未启动 | 资讯 CRUD 在，feed 未接 | 需 RSS/API 接入 |

**最关键的颠覆性发现**：M2 被标记"完成"是**不实的**。预测管道本身优秀，但它预测的是 `beef_carcass_us`（美国胴体聚合）和 FX，**不是部位级牛肉价格**。"/beef 页带预测"目前是把胴体聚合预测冒充部位预测，或根本无预测。这是核心价值的虚构。

---

## 第三部分：核心功能尽善尽美设计

### 3.1 核心功能 #1：部位级 AI 预测（最大架构缺口 — 必须颠覆性修复）

#### 当前架构断层（实测）
```
预测引擎 (tradingSignals.generateForecast)
  └─ 取 commodityId → 查 CommodityPrice → 推断
       └─ CommodityPrice 活跃但非牛肉（FX/胴体聚合/谷物）

牛肉部位价 (BeefCutPrice)
  └─ /beef UI 读取，但无预测引擎附着
       └─ 2401 行冻结种子，source 撒谎

bridge: 把 CommodityPrice(胴体聚合) → BeefCutPrice(部位)  ← 语义错误！胴体聚合 ≠ 部位价
```

**问题本质**：牛肉部位活在 `BeefCutPrice(factoryId, cutCode, date)`，预测活在 `CommodityPrice(commodityId, date)`。两个平行世界，永远不交。bridge 把聚合冒充部位，是数据语义错误。

#### 尽善尽美的设计：双后端预测引擎

**原则**：保留 CommodityPrice 后端（它对 macro 商品真实有效），**新增 BeefCutPrice 后端**，让预测引擎能直接预测一个 `(factoryId, cutCode)` 时序。共识/MAPE 逻辑完全复用。

**实现（最小且正确）**：

1. **新增时序提取函数** `services/beefCutSeries.ts`：
   ```ts
   // 把 BeefCutPrice[factoryId, cutCode, *] 提取为 {values, timestamps}
   // 与 data-fetcher.ts 的 getCommodityPriceValues 平行
   export async function getBeefCutSeries(factoryId, cutCode, limit=200)
   ```
   维度对齐：`BeefCutPrice` 按 (factoryId, cutCode) 过滤、按 date 升序、取 price 列。

2. **扩展 generateForecast**：当前签名 `{commodityId, horizon, currentPrice}`。新增并行入口 `{factoryId, cutCode, horizon}` —— 内部用 `getBeefCutSeries` 取数，其余 5 模型共识逻辑原样复用（已 Promise.allSettled 容错）。

3. **扩展缓存键**：`prediction:cut:{factoryId}:{cutCode}:{modelId}:{horizon}`（与现有 `prediction:{commodityId}:...` 并列，互不污染）。

4. **扩展 PredictionLog**：新增可空字段 `factoryId`, `cutCode`（与 commodityId 互斥）。MAPE 验证时按维度取真实值。

5. **/beef MarketForecastBoard 改用 cut 后端**：不再依赖 bridge 冒充。当 BeefCutPrice 有真实数据时预测真实；无数据时诚实显示"该部位暂无足够历史数据用于预测"。

**为什么这是最佳设计**：
- **诚实**：不再用胴体聚合冒充部位预测
- **复用**：共识/MAPE/Redis 逻辑零改动
- **渐进**：当 usda_ams 拿到 key，BeefCutPrice 有真实数据，预测自动生效
- **双轨**：macro 商品（FX/胴体）走旧路径，牛肉部位走新路径，各得其所

#### 配套：bridge 的诚实化
当前 bridge 把胴体聚合 → 部位价是语义错误。**颠覆性建议**：
- bridge 的 `source` 已是 `bridge:commodity:<slug>`（好，可区分）
- 但应在 `/beef` 显示层明确标注 "proxy/bridged" 徽章，不与真实 scraper 数据混淆
- 当 BeefCutPrice 预测后端上线，bridge 行自动从预测训练集排除（用 source 过滤 `source NOT LIKE 'bridge:%'`），避免用代理数据训练预测

### 3.2 核心功能 #2：数据诚实框架（无真实数据时的尽善尽美）

用户明确："如果没办法引入真实数据是可以容忍的，但是要将其他所有功能实现好"。这要求一套**首尾一致的数据诚实框架**，让平台在无真实数据时依然可信、可用、不虚假。

#### 三层数据新鲜度契约（全局）

每个价格/数据点必须携带可机器判读的新鲜度标签，前端统一渲染：

| 层 | 判据 | 前端徽章 | 含义 |
|---|---|---|---|
| **live** | `date >= today - 3 days` 且 `source NOT LIKE 'seed%' AND NOT LIKE 'bridge:%'` | 🟢 Live | 真实采集 |
| **proxy** | `source LIKE 'bridge:%'` | 🟡 Proxy | 桥接代理（如胴体聚合→部位），明确标注 |
| **snapshot** | seed 数据或 `date < today - 7 days` | 🔴 Snapshot (date) | 快照，显示日期 |

**实现**：
- 后端 `/api/beef/prices` 响应每行加 `freshness: "live"|"proxy"|"snapshot"` + `dataDate`
- 前端 `<FreshnessBadge freshness dataDate />` 组件（已存在 FreshnessBadge，扩展三态）
- 全页顶部：若**所有**部位都是 snapshot，显示全局 Alert "当前展示为演示快照数据（截至 YYYY-MM-DD），接入真实数据源后自动切换为实时行情"

#### 这套框架的威力
- **无 key 时**：平台是"演示模式"，但每个数字都标注来源和日期，不撒谎。用户/投资人能看到完整产品形态 + 清晰的"差一步接入真实数据"
- **有 key 时**：自动切换 live，徽章变绿，零代码改动
- **混合时**：USDA 通了就 USDA 的行变 live，MLA 没通就 MLA 的行显示 snapshot —— 诚实到行级

### 3.3 核心功能 #3：预测共识与 MAPE 闭环（已是优势，加固为护城河）

现有实现已强（5 模型 parallel + median 共识 + plurality 方向 + Redis 45min + 日级 MAPE 验证 478 条）。尽善尽美的加固点：

1. **权重学习**：当前共识是等权中位数。引入基于历史 MAPE 的加权（MAPE 低的模型权重高）。`getAllModelAccuracy` 已有 per-model MAPE，可直接用 `weight = 1/mape` 归一化。
2. **方向准确率**：除 MAPE（值准确率）外，新增方向准确率（预测涨跌方向是否正确）—— 对交易决策更有意义。PredictionLog 已存 predictedValues，验证时对比实际涨跌方向。
3. **置信度校准**：当前 `confidence = 0.7×agreement + 0.3×magnitude`。应对照历史 MAPE 校准——"置信度 80% 的预测，历史上有 80% 的确落在区间内"。这是预测平台的专业性标志。
4. **数据充分性门控**：预测前检查时序长度（当前仅 ≥2 点）。应分层：<30 点 → "弱信号（数据不足）"；30-90 → "常规"；>90 → "强信号"。在 UI 明确传达。

### 3.4 核心功能 #4：资讯模块（M3，但设计先行）

PRODUCT-SPEC 要求"资讯>市场动态"。当前 `market_news` CRUD 在但无 feed。尽善尽美设计：
- **冷启动**：admin 手动录入（CRUD 已有）+ 关联商品/部位标签
- **中期**：RSS 接入（牛肉行业媒体：Bovine Vet、Beef Magazine、中国牛肉网）
- **每条资讯关联商品/部位**：在行情行旁显示"相关资讯 N 条"
- **诚实**：无资讯时不显示空模块，显示"资讯即将上线"

---

## 第四部分：颠覆性建议（用户授权可完全颠覆）

### 4.1 颠覆 #1：承认 M2 未完成，重定义里程碑

当前文档标记 M2"完成"是不实的。**建议**：
- M2 重定义为"AI 预测**真实**融入牛肉部位行情"（含 3.1 双后端 + 数据诚实框架）
- M1 收尾的真实定义：landing 诚实 + §9 stub 清理 + inference 恢复 + 数据诚实框架上线
- 新增 **M1.5（数据激活准备）**：让平台在"零真实数据"状态下完全可信可演示，且任何一刻拿到 key 都能一键激活

### 4.2 颠覆 #2：BeefCutPrice.price 改 Decimal（金额精度）

当前 `Float` 是金额字段的精度隐患（浮点累积误差）。**建议**：迁移为 `Decimal(18,4)` 与 CommodityPrice 一致。这是一个 schema migration，但金额字段用 Float 是设计缺陷，值得修。

### 4.3 颠覆 #3：去掉 bridge 的"冒充"，改为明确的双轨

bridge 当前把胴体聚合冒充部位价。**建议**：bridge 保留但 (a) 明确 proxy 标注，(b) 从预测训练集排除。当 3.1 双后端上线，bridge 退化为纯粹的"展示兜底"，不污染预测。

### 4.4 颠覆 #4：chronos 从 /models 移除或标注 blocked

`/models` 列出 chronos 但不可用（huggingface.co 阻断）。**建议**：`list_models()` 增加 `available: bool` 字段，chronos 标 `available: false` + `blockedReason: "model weights unreachable (huggingface.co)"`。诚实优于假活。

### 4.5 颠覆 #5：统一数据获取层（消灭三套并存）

前端 useRetryableFetch / raw SWR / Refine legacy 三套并存。**建议**：一次性迁移完，`useMarketForecasts` 的 3 个例外（array key/POST body/no-retry-on-auth）已文档化，可保留；其余 raw SWR + Refine 全迁。这是技术债，不紧急但值得排期。

### 4.6 不颠覆（保留的优势）
- **ProfessionalChart（K线+预测叠加）**：核心资产，保留
- **74 部位 4 语言 taxonomy + normalizer**：业界少有，保留
- **5 模型共识 + MAPE 闭环**：差异化护城河，加固不重写
- **PM2 fork + 诚实 cron 分层**：运维清晰，保留
- **shadcn-style + honest states 设计系统**：成熟，保留

---

## 第五部分：真实数据注入地图（精确到"哪里、怎么做"）

用户核心要求："明确究竟要在哪里引入真实的数据，具体怎么做"。以下按**投入产出比**排序。

### 🥇 注入点 1：USDA_MARS_API_KEY（usda_ams）— 最高产出

- **位置**：`backend/.env` 加 `USDA_MARS_API_KEY=<key>`
- **怎么做**：代码**已完整**（`usdaAms.ts:123-194` fetchCutLevelPrices）。LM_XB405 报告 600+ 部位，经 `normalizeBeefCut` 归一，USD/cwt→USD/kg 转换，upsert 到 BeefCutPrice（source=`usda_ams_xb405`）
- **激活**：`cd backend && pnpm build && pm2 restart mt-backend`
- **产出**：美国工厂（4 个 US-JBS-GREELEY 等）× 数百部位 × 每日。**单一 key 产出 > 其他所有源总和**
- **获取 key**：https://marsapi.ams.usda.gov/ 注册（免费，美国政府开放数据）

### 🥈 注入点 2：MLA_API_KEY（mla_nlrs）— 第二产出

- **位置**：`backend/.env` 加 `MLA_API_KEY=<key>`
- **怎么做**：代码已完整（`mlaNlrs.ts:31-63`）。AU OTH grid + 出口部位价，6 个 AU 工厂
- **激活**：同上 build + restart
- **产出**：澳大利亚工厂 × 主要部位（brisket/cube roll/topside 等）
- **获取 key**：https://services.mla.com.au/ （MLA 商业服务，可能需付费）

### 🥉 注入点 3：inac（乌拉圭）— 需网络修复

- **位置**：代码已完整（`inacData.ts` HTML 解析），但 `inac.gub.uy` 从本服务器网络阻断
- **怎么做**：需 (a) 代理/VPN 出口，或 (b) headless 浏览器（Playwright）绕过。HTML 解析脆弱，长期不稳
- **产出**：乌拉圭 2 工厂 × INAC 部位。产出较小
- **优先级**：低于 1/2，可延后

### 注入点 4：cepea（巴西）— 需重写

- **现状**：Cloudflare 403 + 结构上只写活牛（boi_gordo_br），不写部位
- **怎么做**：(a) Playwright 破 Cloudflare（ToS 风险），(b) 重写为产出 BeefCutPrice（需 CEPEA 有部位级数据，可能没有）
- **优先级**：低。CEPEA 主要是活牛指数，不是部位级

### 注入点 5：手动 CSV 导入（无 key 时的真实数据路径）— 立即可用

- **位置**：`POST /api/market/import`（admin，已实现，写 CommodityPrice）
- **怎么做**：扩展为支持 BeefCutPrice 导入（新增 `/api/beef/import`）。admin 每周上传真实采购价 CSV
- **适用场景**：拿不到 API key 但有线下真实数据（如自己的采购记录、行业朋友报价）
- **产出**：取决于上传频率和覆盖。这是牧集网早期的部分做法
- **诚实**：source=`manual:<uploader>`，freshness=live

### 注入点 6：FRED_API_KEY + OPENWEATHER_API_KEY（非牛肉，但补全 macro）

- **位置**：`backend/.env`
- **产出**：CPI/PPI/利率（FRED）+ 8 站点天气（OpenWeather）。支撑市场因素分析，不直接产牛肉
- **优先级**：中。让 macro 层完整，有助于相关性分析

### 零真实数据时的尽善尽美（用户容忍场景）

若**所有** key 都拿不到，平台的正确姿态（第三部分 3.2 框架）：
1. 全局"演示快照模式"banner（明确标注日期）
2. 每行价格 freshness=snapshot + dataDate
3. 预测功能在 beef_carcass_us（CommodityPrice 活跃）上**真实可演示**——这是 macro 层的真实预测，可用于展示 AI 能力
4. 手动导入路径开放，用户可自行喂入真实数据
5. **绝不**用 bridge 冒充部位预测

### 激活检查清单（拿到 key 后的标准操作）

```bash
# 1. 配置 .env（不打印值）
grep -E '^(USDA_MARS_API_KEY|MLA_API_KEY)=' backend/.env  # 确认 presence

# 2. 构建 + 重启
cd backend && pnpm build && pm2 restart mt-backend

# 3. 手动触发抓取验证（admin）
curl -X POST http://localhost:8000/api/market/sources/refresh-all -H "Authorization: Bearer <admin token>"

# 4. DB 验证产出（5min 后）
# 查 BeefCutPrice 新 source 行数 + latest date 应为今天

# 5. 前端验证
# /beef 页对应部位 freshness 变 live，徽章变绿
# /settings/data-sources "Beef sources healthy" 从 0/4 上升
```

---

## 第六部分：推荐的后续工作排期（基于上述分析）

### 立即可做（不依赖外部 key，本轮可交付）

| # | 任务 | 价值 | 风险 |
|---|---|---|---|
| A | **重启 inference 服务** | 恢复核心 AI 功能 | 低（pm2 restart）|
| B | **landing 诚实残留清理**（SocialProof/pricing/layout）| 修 M1 漏网 | 零（纯文本）|
| C | **数据诚实框架**（freshness 三态 + FreshnessBadge + 全局 banner）| 无数据时可演示 | 低（后端加字段+前端徽章）|
| D | **chronos /models 诚实化**（available:false）| 修假活 | 零 |
| E | **§九 stub 清理**（删 /trading/portfolio+watchlist）| 合规 | 低（确认无引用后删）|

### 核心架构（M2 真正完成）

| # | 任务 | 价值 | 风险 |
|---|---|---|---|
| F | **BeefCutPrice 预测后端**（3.1 双后端）| 让 AI 预测真正跑在牛肉部位 | 中（新代码，需测试）|
| G | **BeefCutPrice.price Float→Decimal 迁移** | 金额精度 | 中（migration）|
| H | **预测权重学习 + 方向准确率**（3.3）| 护城河加固 | 中 |

### 数据激活（依赖 key）

| # | 任务 | 阻塞于 |
|---|---|---|
| I | 激活 usda_ams | USDA_MARS_API_KEY |
| J | 激活 mla_nlrs | MLA_API_KEY |
| K | /api/beef/import 手动导入路径 | 无（立即实现）|

### M3（资讯+分析完整）

| # | 任务 | 阻塞于 |
|---|---|---|
| L | 资讯 RSS 接入 | 设计先行 |
| M | 产地对比/相关性页强化 | 数据 |

---

## 结论：一句话总结

**这个平台的地基（预测引擎、taxonomy、可视化、诚实工程）是真实且优秀的；但它的核心价值主张（部位级牛肉 AI 预测）目前是虚构的——预测跑在非牛肉数据上，牛肉数据是冻结的合成种子。下一步的最高优先级是：(1) 重启 inference 恢复 AI，(2) 上线数据诚实框架让平台在无真实数据时也可信，(3) 实现 BeefCutPrice 预测后端让 AI 真正附着在牛肉部位上，(4) 在 USDA_MARS_API_KEY 这一个注入点上集中精力——它是投入产出比最高的真实数据来源。**
