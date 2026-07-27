# 项目现状全景 v2 + 最终产品愿景 + 核心功能尽善尽美设计（loop 后修订版）

**日期**: 2026-07-26（长程 loop 完成后）
**性质**: v1（同日早些）的修订版。v1 写在 loop 之前（M2 架构断层还在），本版基于 loop 后的真实代码状态重写，并修正了一个 v1 未发现的更深断层。
**权威定位**: `docs/PRODUCT-SPEC.md` 为唯一产品真相（beef-only，类牧集网 × IoTDB AINode）。

---

## 与 v1 的关键差异（先读这个）

v1 之后发生了三件事，改变了核心论断：

1. **长程 loop 落地 6 个 commit**（§九 stub 清理 / 数据诚实框架前后端 / BeefCutPrice 双后端预测 / 手动导入 / Decimal 迁移）。后端架构断层**已修复**。
2. **但发现一个更深的断层**：前端**零消费**新的双后端端点 `/api/beef/forecasts/:cutCode`（全前端 grep 零命中）。`/beef` 页的 MarketForecastBoard 仍走旧的 `/api/signals/batch`（commodity slug 路径），与价格表行级 cutCode 数据**完全脱节**。部位详情页 `/beef/cuts/[cutCode]` 根本没有预测 UI。
3. **预测产出实测**：过去 7 天 15295 条预测，但都是 commodity 维度（FX/胴体聚合/谷物），不是牛肉部位。cut-keyed 预测仅 15 条（e2e 测试残留）。

**所以核心价值的真实状态是**：后端"能让 AI 跑在牛肉部位上"的能力已具备且验证过（注入新鲜数据→5 模型共识→direction:up/confidence:0.72 实测通过），但**前端还没接上**，用户实际看到的"预测"仍是 commodity 维度的（非牛肉）。这是 v2 要明确的最重要事实。

---

## 第一部分：项目开发现状全景（loop 后实测）

### 1.1 部署健康（2026-07-26 23:20 实测）

| 服务 | 端口 | 状态 | 说明 |
|---|---|---|---|
| backend (mt-backend) | 8000 | ✅ online | `/health` 200 |
| frontend (mt-frontend) | 3000 | ✅ online | HTTP 200 |
| inference (mt-inference) | 10810 | ✅ online | 本轮 loop 前已恢复（曾宕机 4 天）|
| postgres | 5432 | ✅ | beef_cut_prices.price 现为 numeric(18,4) |
| redis | 6379 | ✅ PONG | 预测缓存 45min TTL |

测试基线：backend vitest **563 pass / 1 skip**（v1 时 527，+36 新测试）| frontend jest **258 pass** | inference pytest **9 pass**。

### 1.2 数据层真相（DB ground-truth，loop 后未变）

```
BeefCutPrice（/beef UI 唯一读取的表）:
  总行数: 2401（loop 后 Decimal 迁移未改行数）
  覆盖: 16 cutCode × 5 工厂
  时间范围: 2026-04-01 → 2026-04-30（今天 2026-07-26，过期 87 天）
  按 source:
    mla_nlrs                      1440 rows  ← 合成随机种子，source 撒谎
    cepea_export                   960 rows  ← 合成随机种子，source 撒谎
    bridge:commodity:aus_cube_roll_m9  1 row  ← 唯一 bridge 输出

CommodityPrice（活跃表，预测引擎实际在跑的表）:
  总行数: 64888，最新 2026-07-25（昨天活跃）
  beef_carcass_us: 4220 点（美国胴体聚合，非部位）

prediction_logs（预测产出）:
  过去 7d: 15295 条预测生成
  verified: 493 条（avg MAPE 10-32%，exponential_smoothing 最优 10.47%）
  cut-keyed（双后端）: 仅 15 条（e2e 测试残留，非生产路径）
```

**数据源 × 真相**不变：0 个真实产出牛肉数据。"2 healthy" = commodity_prices(汇率) + world_bank(能源/金属/谷物)，都非牛肉。

> 注：此处的源分类取自 2026-07-19 DATA-4 审计（当时移除 `argentina` 后计 18）。当前 `backend/src/services/dataIngestion/sources/` 实测 **19** 个文件；逐源可用性详见 [KNOWN-ISSUES.md](KNOWN-ISSUES.md) D1（动手前需 live 复核，状态随时间变化）。

### 1.3 技术栈各层完成度（loop 后修订）

#### Backend — **架构断层已修复，但前后端未贯通**

| 模块 | v1 状态 | v2 状态（loop 后）| 变化 |
|---|---|---|---|
| server 启动 + cron 分层 | ✅ complete | ✅ complete | 无变化 |
| 数据采集架构 + 诚实分类 | ✅ 管道完成 | ✅ complete | 无变化 |
| **数据诚实框架** | ❌ 无 | ✅ **complete（新）**| freshness 3-tier + 页级 summary，live 验证 80 行全 snapshot |
| **BeefCutPrice 双后端预测** | ❌ **架构断层** | ✅ **complete（新）**| 虚拟 key `cut:{factoryId}:{cutCode}` 复用共识管道，诚实门控拦截过期数据 |
| **手动导入路径** | ❌ 无 | ✅ **complete（新）**| `/api/beef/import` CSV 上传，无 key 真实数据路径 |
| **BeefCutPrice.price 精度** | ⚠️ Float（金额隐患）| ✅ **Decimal(18,4)** | 迁移完成，4 位小数精度保留 |
| 预测管道（5 模型共识 + MAPE）| ✅ complete | ✅ complete | 无变化 |
| 74 部位 taxonomy + normalizer | ✅ complete | ✅ complete | 无变化 |
| Auth（JWT+refresh+lockout+rate limit）| ✅ 生产级 | ✅ 生产级 | 无变化 |

**后端核心价值链已闭合**：beefCutPrice（牛肉部位）→ getBeefCutSeries（时序提取）→ predictionCache（识别 cut: 前缀路由）→ 5 模型共识 → MAPE 验证。诚实门控三道：freshness 年龄判定 + 预测入口新鲜度门控 + bridge 行排除训练集。

#### Frontend — **IA 到位，但预测未接新后端（v2 发现的断层）**

| 模块 | v2 状态 | 说明 |
|---|---|---|
| App Router（54 页）+ 导航 IA（6 区）| ✅ beef 聚焦 | §九 stub 已删（loop 批次 1）|
| **数据诚实框架前端** | ✅ complete（新）| BeefFreshnessBadge（live🟢/proxy🟡/snapshot🔴）+ SnapshotBanner |
| **freshness 列接入价格表** | ✅ complete（新）| /beef Latest Cut Prices 表新增 Freshness 列 |
| **MarketForecastBoard 接入新双后端** | ❌ **未接入** | **仍走旧 `/api/signals/batch`（commodity slug），与新 cut 后端脱节** |
| **部位详情页预测** | ❌ **无预测 UI** | `/beef/cuts/[cutCode]` 只有历史价，无预测 |
| beef 价格/工厂/部位页 | ✅ complete | 真实 endpoint |
| AI 页（predict/accuracy/anomalies）| ✅ 接通 | 但跑在 commodity 维度 |
| 图表资产（ProfessionalChart 582行等）| ✅ 强 | 2.9k LOC |
| 设计系统 + honest states | ✅ 成熟 | EmptyState/ErrorDisplay/LoadingState |
| 测试 | ⚠️ 偏薄 | hook/lib 强，页面/图表薄 |
| useRetryableFetch 统一 | ⚠️ 三套并存 | 标准已立，迁移未完 |

#### Inference — **6 模型可用，chronos 已诚实标注**

| 模块 | v2 状态 |
|---|---|
| 6 统计模型（arima/sarimax/holtwinters/exp/naive/stl）| ✅ 端到端，avg MAPE 10-32% |
| chronos | ⚠️ configured-but-blocked，**现 `available:false` + blocked_reason**（loop 前）|
| /predict + /predict/batch | ✅ |
| 服务进程 | ✅ online（本 loop 前已恢复）|

### 1.4 loop 后新增的真实残留（v1 没有的）

| # | 残留 | 严重度 | 说明 |
|---|---|---|---|
| **R1** | **前端未消费 `/api/beef/forecasts/:cutCode`** | 🔴 **高** | 后端能力已具备，但前端 MarketForecastBoard 仍走旧 commodity slug 路径，与新 cut 后端脱节。slug 与 cutCode 是两套不互通标识符 |
| **R2** | **部位详情页无预测** | 🟡 中 | `/beef/cuts/[cutCode]` 是新端点的天然落点（cutCode 已在 scope），但无预测 UI |
| **R3** | cut-keyed 预测无后台调度 | 🟡 中 | `schedulePredictionsFromPostgreSQL` 只订阅 commodity，未订阅 cut series。cut 预测目前是 on-demand（API 调用时才算），无 30min 后台刷新 |
| **R4** | landing SocialProof 已修（loop 前）| ✅ 已闭合 | — |
| **R5** | §九 stub 已删（loop 批次 1）| ✅ 已闭合 | — |

**R1 是当前最关键的断层**：核心差异化（部位级 AI 预测）在后端已真实可用，但用户在前端看到的仍是 commodity 维度预测。这是"后端 100%、前端 0%"的最后一公里。

---

## 第二部分：最终产品方向与具体形态（不变，重申）

### 2.1 北极星（不变）

> **为中国牛肉产业链提供「部位级」牛肉价格数据采集、行情展示、多维分析，并以多模型 AI 集成预测的专业信息平台。**
> 对标 牧集网（数据深度）× IoTDB AINode（预测智能）。**唯一差异化：每个牛肉部位价格旁带 AI 预测。**

### 2.2 最终产品效果（用户视角，标注当前真实可达性）

#### 行情层
- **价格总览页 `/dashboard`**：进口/国产均价 + AI 7日预测 + 热门部位表 + 资讯流 → AI 预测当前走 commodity slug（R1 影响此处）
- **牛肉行情 `/beef`**：部位级价格表（**已带 freshness 徽章 + snapshot banner** ✅）+ MarketForecastBoard（**仍 commodity 维度** ⚠️）
- **部位详情 `/beef/cuts/[cutCode]`**：90 天历史 + **无预测**（R2）
- **工厂目录 `/beef/factories`**：✅

#### AI 预测层（核心差异化）
- **每个价格都带预测**：后端 `/api/beef/forecasts/:cutCode` 已就绪，但**前端未接入**（R1）
- **模型准确率 `/ai/accuracy`**：✅ 真实 MAPE（exponential_smoothing 10.47% 最优）
- **价格预测 `/ai/predict`**：✅ 自由时序表单
- **异常检测 `/ai/anomalies`**：✅

#### 分析/数据/系统层
- 价格走势 `/trading`（K线+预测叠加）✅ | 产地对比 ✅ | 相关性 ✅
- 数据源看板（**诚实显示 0/4 beef healthy**）✅ | 数据集/时间序列 ✅ | 告警/设置 ✅

### 2.3 里程碑现状对照（loop 后修订）

| 里程碑 | v1 实测 | v2 实测（loop 后）|
|---|---|---|
| **M1 可信牛肉行情平台** | 90% | ✅ **完成**（landing 诚实、§九 清理、freshness 框架、Decimal 全闭合）|
| **M2 AI 预测融入主流程** | 架构断层 | **后端完成，前端未接入**（R1）|
| **M3 完整资讯+分析平台** | 未启动 | 未启动 |

---

## 第三部分：核心功能尽善尽美设计（loop 后重新推敲）

### 3.1 核心功能 #1：部位级 AI 预测（最后一公里 — R1）

#### 当前真实状态
```
后端: /api/beef/forecasts/:cutCode ✅ (cut series → 5模型共识 → 诚实门控)
前端: ❌ 零消费该端点
  ├─ MarketForecastBoard 走旧 /api/signals/batch (commodity slug)
  ├─ /beef 价格表 无预测列
  └─ /beef/cuts/[cutCode] 无预测 UI
脱节: slug (commodity) vs cutCode (beef cut) 是两套不互通标识符
```

#### 尽善尽美的设计：三层接入

**层 1 — 部位详情页预测区（最小、最自然）**
`/beef/cuts/[cutCode]` 已有 cutCode 在 scope，是 `/api/beef/forecasts/:cutCode` 的天然落点。新增一个预测区组件：
- 当 `forecastable:true`：显示共识方向（↑/↓/平）+ 变化幅度 + 置信度 + 模型数 + 预测价格区间 + 多模型明细可展开
- 当 `forecastable:false`：诚实显示原因（"数据过期，需激活数据源" 或 "数据不足"），不伪造

**层 2 — 价格表行级预测摘要（融入行情）**
/beef Latest Cut Prices 表新增"7日预测"列：每行显示该 cutCode 的预测方向箭头 + 变化%。这是 PRODUCT-SPEC §5.3"每个商品旁直接显示预测摘要"的落地。实现：批量调用 `/api/beef/forecasts/:cutCode`（或新增一个 `/api/beef/forecasts/batch?cutCodes=...` 批量端点避免 N+1）。

**层 3 — MarketForecastBoard 切换到 cut 维度（最彻底）**
当前 MarketForecastBoard 用 commodity slug 列表（`/market/commodities` filter `category=beef_cuts`）。切换为用 BeefCutTaxonomy 的 cutCode 列表（`/api/beef/cuts`）+ 调 `/api/beef/forecasts/:cutCode`。这是消除 slug/cutCode 双标识符脱节的根本解。

**推荐顺序**：层 1（最小验证）→ 层 2（融入主流程）→ 层 3（彻底统一）。每层独立可交付。

#### 配套：cut 预测后台调度（R3）
新增 `scheduleBeefCutPredictions()`：订阅有 ≥2 新鲜非 bridge 点的 (factoryId, cutCode) 对，30min 后台刷新预测。与现有 `schedulePredictionsFromPostgreSQL` 并列。当真实数据流入（USDA key 或手动导入），cut 预测自动后台预热，API 调用即缓存命中。

### 3.2 核心功能 #2：数据诚实框架（loop 已落地，推敲加固点）

三态契约（live🟢/proxy🟡/snapshot🔴）已上线。加固点：

1. **行级 freshness 已完成**（价格表 Freshness 列 + SnapshotBanner）✅
2. **预测诚实门控已完成**（过期数据 → forecastable:false）✅
3. **待加固 — 全局数据健康指示器**：dashboard 顶部应有一个全局"数据健康"徽章（聚合所有 beef 源的 healthy/stale 状态），让用户一眼看到"平台当前是 live 还是 demo 模式"。当前 `/settings/data-sources` 有这个信息，但主流程（dashboard/beef）没有提炼。
4. **待加固 — freshness 时间趋势**：当数据从 snapshot→live 切换时（用户激活了 USDA key），应有一个可见的"数据已激活"提示，让用户感知到平台状态变化。

### 3.3 核心功能 #3：预测共识与 MAPE 闭环（实测数据驱动的加固）

实测 MAPE 数据（493 verified）：
- exponential_smoothing: **10.47%**（最优）
- naive_forecaster: 11.91%
- arima: 12.10%
- holtwinters: 14.22%
- stl_forecaster: 32.41%（最差，异常）

尽善尽美的加固（基于实测而非理论）：

1. **stl_forecaster 异常排查**：32.41% MAPE 远高于其他模型（naive 基线都才 11.91%）。STL 不应比 naive 差 3 倍——可能是季节性周期配置错误（当前 `periods=7` 但牛肉价格可能无周季节性）或 trend extrapolation 发散。**应排查或下线**。
2. **加权共识**（v1 建议，现已有实测数据支撑）：当前等权中位数。改用 `weight = 1/mape` 归一化（exponential_smoothing 权重最高，stl 最低甚至剔除）。`getAllModelAccuracy` 已有 per-model MAPE，直接可用。
3. **方向准确率**：除值准确率（MAPE）外，新增方向准确率（预测涨跌方向是否正确）。对"该不该进货"的决策更有意义。
4. **数据充分性门控分层**：<30 点 → "弱信号"；30-90 → "常规"；>90 → "强信号"。

### 3.4 核心功能 #4：资讯模块（M3，设计先行，不变）

PRODUCT-SPEC 要求"资讯>市场动态"。market_news CRUD 在但无 feed。冷启动：admin 手动录入 + 关联商品/部位标签。中期 RSS。

---

## 第四部分：颠覆性建议（用户授权，loop 后修订）

### 4.1 🔴 最高优先：闭合前端最后一公里（R1）
后端已 100%，前端 0%。这不是"新功能"，是"让已建好的核心能力被用户看到"。**这是当前投入产出比最高的工作**——后端能力已验证，前端接入是纯 wiring。

### 4.2 stl_forecaster 排查或下线
实测 32.41% MAPE 异常。要么修配置，要么从 ALL_MODELS 移除（它拉低共识质量）。

### 4.3 cut 预测后台调度（R3）
新增 `scheduleBeefCutPredictions()`，让 cut 预测有 30min 后台预热，而非纯 on-demand。

### 4.4 统一数据获取层（消灭三套并存）
useRetryableFetch / raw SWR / Refine legacy 三套。一次性迁移完（useMarketForecasts 例外已文档化）。

### 4.5 不颠覆（保留的优势）
ProfessionalChart（K线）| 74 部位 4 语言 taxonomy | 5 模型共识+MAPE 闭环 | PM2 fork+诚实 cron | shadcn+honest states 设计系统 | Decimal 精度（loop 已修）| 数据诚实框架（loop 已建）。

---

## 第五部分：真实数据注入地图（loop 后，三条路径全通）

用户核心要求："明确究竟要在哪里引入真实的数据，具体怎么做"。loop 后**三条路径现已全部可用**：

### 🥇 路径 1：USDA_MARS_API_KEY（最高产出）
- **位置**：`backend/.env` 加 `USDA_MARS_API_KEY=<key>`
- **怎么做**：代码已完整（`usdaAms.ts:123-194` LM_XB405，600+ 部位，normalize+USD/kg 转换）
- **激活**：`cd backend && pnpm build && pm2 restart mt-backend`
- **产出**：美国 4 工厂 × 数百部位 × 每日。单 key 产出 > 其他所有源总和
- **后续自动**：数据流入 → freshness 变 live → SnapshotBanner 消失 → cut 预测门控通过 → 预测自动生效
- **获取**：https://marsapi.ams.usda.gov/（免费，美国政府开放数据）

### 🥈 路径 2：手动 CSV 导入（loop 已实现 ✅，无 key 即可用）
- **位置**：`POST /api/beef/import`（admin，已实现）
- **怎么做**：上传 CSV（factoryCode, cutCode, price, date[, currency, unit, grade]）
- **验证**：loop 中实测——上传 2 行 → source=manual:admin → freshness=live → STRIPLOIN 预测解锁（direction:up/confidence:0.86/5 模型）
- **适用**：拿不到 API key 但有线下真实数据（采购记录、行业报价）。这是牧集网早期部分做法
- **诚实**：source=`manual:<uploader>`，可追溯

### 🥉 路径 3：MLA_API_KEY（第二产出）
- **位置**：`backend/.env` 加 `MLA_API_KEY=<key>`
- **代码**：已完整（`mlaNlrs.ts`，6 个 AU 工厂）
- **获取**：https://services.mla.com.au/（可能需付费）

### 零真实数据时的尽善尽美（用户容忍场景，loop 已实现框架）
若所有 key 都拿不到：
1. **全局 SnapshotBanner** 明示"演示快照模式（截至 2026-04-30）"✅
2. 每行价格 freshness=snapshot + dataDate ✅
3. **beef_carcass_us（CommodityPrice 活跃）上的预测真实可演示**——macro 层真实预测，可展示 AI 能力
4. **手动导入路径开放**（路径 2），用户可自行喂真实数据 ✅
5. cut 预测诚实返回 forecastable:false + 原因，绝不伪造 ✅

### 激活检查清单（拿到 key 或上传 CSV 后）
```bash
# A. API key 路径
grep -E '^(USDA_MARS_API_KEY|MLA_API_KEY)=' backend/.env  # 确认 presence
cd backend && pnpm build && pm2 restart mt-backend
curl -X POST http://localhost:8000/api/market/sources/refresh-all -H "Authorization: Bearer <admin>"
# 5min 后查 DB: 新 source 行数 + latest date 应为今天

# B. 手动导入路径
curl -X POST http://localhost:8000/api/beef/import -H "Authorization: Bearer <admin>" -F "file=@prices.csv"

# C. 验证（两路径通用）
curl http://localhost:8000/api/beef/prices/latest -H "Authorization: Bearer <admin>"
# → freshness.liveCount > 0, allStale: false
curl http://localhost:8000/api/beef/forecasts/BRISKET_NAVEL -H "Authorization: Bearer <admin>"
# → forecastable: true, forecast.direction/confidence 有值
```

---

## 第六部分：推荐的后续工作排期（loop 后修订）

### 🔴 最高优先：闭合前端最后一公里（R1，投入产出比最高）

| # | 任务 | 价值 | 依赖 |
|---|---|---|---|
| **F1** | 部位详情页预测区（层 1） | 最小验证新后端 | 无 |
| **F2** | 价格表行级预测摘要（层 2） | 融入主流程 | 可选批量端点 |
| **F3** | MarketForecastBoard 切 cut 维度（层 3） | 消除 slug/cutCode 脱节 | F1/F2 验证后 |

### 🟡 中优先：质量与完整性

| # | 任务 | 价值 |
|---|---|---|
| **Q1** | stl_forecaster 排查（32% MAPE 异常）| 共识质量 |
| **Q2** | 加权共识（基于实测 MAPE）| 护城河加固 |
| **Q3** | cut 预测后台调度（R3）| 性能 |
| **Q4** | 全局数据健康指示器（dashboard）| UX |

### 🟢 低优先：技术债

| # | 任务 | 价值 |
|---|---|---|
| **T1** | 统一数据获取层（消灭三套）| 可维护性 |
| **T2** | 前端页面/图表测试补强 | 质量 |
| **T3** | 资讯 RSS 接入（M3）| 产品完整度 |

### 数据激活（依赖外部输入）

| 路径 | 阻塞于 | 状态 |
|---|---|---|
| USDA_MARS_API_KEY | 用户提供 key | 代码就绪 ✅ |
| 手动 CSV 导入 | 无 | **已实现可用 ✅** |
| MLA_API_KEY | 用户提供 key | 代码就绪 ✅ |

---

## 结论：一句话总结（loop 后修订）

**后端核心价值链（部位级牛肉 AI 预测 + 数据诚实框架 + 手动导入路径 + Decimal 精度）已全部闭合并验证；唯一的断层是前端尚未消费新的双后端预测端点（R1）——这是"后端 100%、前端 0%"的最后一公里，也是当前投入产出比最高的工作。数据层的三条真实数据注入路径（USDA key / 手动 CSV 导入 / MLA key）现已全部可用，其中手动导入已端到端验证可激活预测。下一步就是把前端接上新后端（F1→F2→F3），让用户真正看到"每个牛肉部位旁带 AI 预测"这个核心差异化。**
