# MT 项目整体规划与实现状态评估

> **评估日期**：2026-08-08（round-79）｜**2026-08-12 复核**（rounds 80-99：§〇 Executive Summary / §3.3 测试覆盖 / §3.4 循环依赖 已同步当前实现）
> **方法论**：ops-check + zoom-out + improve-codebase-architecture + grill-with-docs 四技能交叉验证，3 Explore agent 并行全量扫描，所有数字 live 实测
> **评估范围**：运维健康 / 价值链实现 / 架构深度 / 规划对齐 / 文档一致性

---

## 〇、Executive Summary

**MT 是一个实现度极高的项目——不是原型，是接近产品级的状态。** 四技能独立评估一致结论：

| 维度 | 评级 | 关键证据 |
|---|---|---|
| 运维健康 | ✅ **全绿** | 3 服务 online，3 health endpoint 200，全依赖（PG/Redis）可达 |
| 价值链完整度 | ✅ **端到端通** | 19 爬虫全真实逻辑 + 9 模型全真实算法 + MAPE 环活 + 前端 0 mock |
| 架构质量 | ⚠️ **良但有债** | 多数服务深（deep），7/20 路由过胖（TD-6，低 ROI）；循环依赖已解（round-79 抽 modelRegistry.ts） |
| 规划对齐 | ✅ **已对齐** | round-82 核实 spec §六/§七/§八 已同步实现（见 §4.4），原"spec 过期"已撤 |
| 文档一致性 | ✅ **AGENTS.md 准、其余基本对齐** | 5 个 headline 数全准；AUTOMATION-STATUS 头注 round-80 已修；TECH-DEBT/KNOWN-ISSUES 历史项有意保留为索引 |

**核心判断**：这个项目的**工程实现领先于它的文档**。代码扎实（无 stub、无 mock、无 AI-slop），但文档（尤其 PRODUCT-SPEC）落后于实现，造成"看起来比实际差"的错觉。

---

## 一、运维健康（ops-check 方法论）

```
OPS STATUS — 2026-08-08
═══════════════════════════════════════
Mode: PM2（3 fork 进程）
frontend:  [UP :3000]    restarts: 6    HTTP 200
backend:   [UP :8000]    restarts: 4    /health: 200
inference: [UP :10810]   restarts: 6    /health: 200
postgres:  [UP :5432]    pid 1232
redis:     [UP :6379]    pid 964
nginx:     (host，未检测，PM2 模式直连)

Findings: 全绿，无需动作
═══════════════════════════════════════
```

restarts 计数（4-6）是本会话多轮重启的正常累积，非 crash-loop（uptime 稳定、memory 正常 134M/92M/559M）。

---

## 二、价值链实现（zoom-out 方法论 — 全链映射）

### 2.1 数据采集层：19 爬虫，全真实

| 项 | 实测 |
|---|---|
| 爬虫总数 | **19**（与 AGENTS.md 一致） |
| 有真实 fetch 逻辑 | **19/19**（0 stub，0 TODO/FIXME） |
| 需 API key | 5 个（FRED×2、MLA、USDA_MARS、OPENWEATHER）——全 graceful skip |
| CSV 导入 | `manualImport.ts`（`parseExcel` 是刻意 stub，需 xlsx 包） |

### 2.2 数据库状态（live query）

| 表 | 总行数 | 近 14 天 | 最新日期 | 状态 |
|---|---|---|---|---|
| `commodity_prices` | 65,023 | **152** | 2026-08-07 16:00 | ✅ 活（今日有写入） |
| `beef_cut_prices` | 2,401 | **0** | **2026-04-30** | ❌ 冻结 3 个月 |
| `prediction_logs` | 122,952 | — | — | ⚠️ 87k unverifiable |

**prediction_logs 状态分布**：
- verified: 17,594（14.3%）
- unverifiable: 87,137（70.9%）—— 冻结源数据导致
- stale: 11,659（9.5%）
- completed: 6,562（5.3%）

### 2.3 推理层：9 模型全真实算法

| 模型 | 实现 | verified | avgMape |
|---|---|---|---|
| arima | statsmodels ARIMA(2,1,1) | 3,282 | 3.67 |
| sarimax | statsmodels SARIMAX + 外生变量 | — | — |
| holtwinters | ExponentialSmoothing(add/add/7) | 3,282 | 3.73 |
| exponential_smoothing | 简单指数平滑 | 3,282 | 3.53 |
| naive_forecaster | sktime NaiveForecaster(last) | 3,282 | 3.45 |
| stl_forecaster | STL + 阻尼外推 | 3,282 | **10.88** ⚠️ |
| chronos_tiny | amazon/chronos-t5-tiny | 388 | 1.78 |
| chronos_mini | amazon/chronos-t5-mini | 388 | 1.93 |
| chronos_base | amazon/chronos-t5-base | 388 | **1.77** 🏆 |

**关键发现**：
- **Chronos（预训练基座）显著优于统计基线**：1.77-1.93% vs 3.45-3.73% MAPE —— 验证了"IoTDB AINode 预训练模型"产品方向的正确性
- **stl_forecaster 异常**（10.88 MAPE，3x 于同类）—— ✅ round-79 已修（signal-to-noise gate；历史 3287 行 pre-fix 不可追溯，新预测自稀释，见 §六 #2）
- **ghost 模型 timer_xl/sundial**（167/165 行）—— round-75 已加 route 守卫，仅 0.13% 残留

### 2.4 MAPE 验证环：实现且活跃

- `logPrediction`（predictionCache.ts:163）→ 写 prediction_logs
- `verifyPrediction`（mapeTracking.ts:55）→ 计算 MAPE + 更新 verified
- **自动验证环**：server.ts:194-211，启动 15s 后首跑 + 每 6h 周期
- 附加维护作业：invalidatePolluted + restorePostFixConflict（20s）、markUnverifiable + restoreVerifiable（25s）

### 2.5 前端价值链页：0 mock

全 7 个价值链页（dashboard/ai-predict/ai-accuracy/ai-models/trading/beef/analysis）用真实 fetch，0 处 mock/placeholder 数据。141 个 mock-marker 命中里：76 是 test 文件的 jest.mock、54 是表单 placeholder= 属性、其余是注释。

---

## 三、架构深度（improve-codebase-architecture 方法论）

### 3.1 服务层：多数深（deep），少数浅（shallow）

| 服务 | 行 | 深度 | 删除测试 |
|---|---|---|---|
| beefCutNormalizer.ts | 852 | **DEEP** | 770 行静态映射表集中在 1 函数后 |
| mapeTracking.ts | 791 | **DEEP** | 9 export 形成紧簇操作 prediction_logs 生命周期 |
| tradingSignals.ts | 452 | **DEEP** | generateForecast ~200 行集成数学，路由 1 调用 |
| authService.ts | 353 | **DEEP** | BCrypt + refresh 轮换 + 审计日志策略封装 |
| apiKeys.ts | 325 | **DEEP** | 哈希 + 校验 + Zod schema |
| metricsService.ts | 384 | **DEEP** | 百分位/分布数学，路由会内联 |
| **marketService.ts** | 384 | **SHALLOW** | 9 个薄 Prisma 包装，删除=SQL 移到路由 |
| **watchlistService.ts** | 376 | **SHALLOW** | 7 个一行 Prisma 调用 |

### 3.2 路由层：7/20 过胖（>5 inline prisma）

| 路由 | prisma 调用 | 服务抽取？ |
|---|---|---|
| beef.ts | **23** | 部分（round-75 抽了 by-country） |
| portfolios.ts | **15** | **无**（无 portfolioService） |
| timeseries.ts | **10** | **无**（0 服务导入） |
| marketData.ts | **8** | 无 |
| signals.ts | 7 | 是（8 服务） |
| security.ts | 6 | — |
| inference.ts | 6 | — |

### 3.3 测试覆盖

- **路由集成测试**：**20/20 路由均有测试文件**（round-89/95/96 补齐此前无测试的 10 个路由；datasets 由 `data.test.ts` 覆盖；`docs.ts` 为纯 Swagger 静态服务，无业务逻辑）
- **服务测试**：25 文件（多数无路由测试的服务有服务测试，如 anomalyService）
- **测试基线**（2026-08-12 实测）：backend 783 passed|1 skipped / frontend 296 / inference 53 = **1132 全绿**

### 3.4 依赖健康

- **循环依赖**：~~`predictionCache.ts` ↔ `tradingSignals.ts`~~ ✅ round-79 已解（抽 `modelRegistry.ts` 叶模块，见 §六 #4）
- **0 BullMQ 残留**（TD-1 已 STALE，代码确无 bullmq/ioredis）
- **4 个 0-importer 死导出**：getCutMapping、parseExcel、lastNDays、trackUsage（后者 TECH-DEBT 标注保留为未来配额候选）

### 3.5 错误处理

- **主流模式**（17 路由）：`asyncHandler` + 集中错误处理器 ✅
- **异常**：metrics.ts 用本地 try/catch + error() helper（4 处）
- **静默吞噬**：0 处真业务路径（health.ts:155 是刻意 health-probe，状态后用）

---

## 四、规划对齐（grill-with-docs 方法论 — spec vs 实现）

### 4.1 PRODUCT-SPEC 过期点

| spec 说 | 代码实际 | 差距类型 |
|---|---|---|
| "资讯服务 ❌ 无资讯模块"（§5.4, line 150） | MarketNews model + route + service + 5 页（2026-07-19 建） | **spec 落后**（spec 2026-07-12，代码 5 天后建） |
| "5 统计模型"（line 29/42） | **6**（缺 sarimax） | spec 内部矛盾（line 188 自己说 6） |
| "❌ 无 WebSocket"（line 191） | SWR 轮询 30s/15s/60s（已实现，非 WS） | spec 标 ❌ 但轮询已开 |

### 4.2 spec "不做"清单验证（全合规 ✅）

| 不做项 | 代码确认 |
|---|---|
| 交易撮合 | ✅ 无 escrow/matchmaking/cart/wallet |
| 非牛肉进主 IA | ✅ 无 crude_oil/gold 在导航 |
| UGC/社区 | ✅ 无 Comment/Post/Like model |
| 原生 App | ✅ 无 ios/android 目录 |
| 付费墙 | ✅ billing 仅静态展示，无 stripe/charge |

### 4.3 代码有但 spec 未文档化（top 5）

1. **apiKeys 系统**（route + service + middleware + 3 页）—— spec 0 提及
2. **auth 系统**（register/login/sessions）—— spec 0 提及
3. **backtest 页**（/ai/backtest）—— spec 0 提及
4. **docs/metrics/models/security 路由**—— 运维面，spec 0 提及
5. **dashboard/performance + dashboard/models 子页**—— spec 只映射 /dashboard 总览

### 4.4 spec 规划但未实现（2026-08-09 复核：全部已完成，原清单过时）

> 以下 5 条在初版评估时（2026-08-08）标记为"未实现"，但 round-82 深入核实发现**全部已实现**。spec §六任务表、§七数据层对照、§八路线图已同步更新。

1. ~~**AI 预测融入行情行**~~ → ✅ 已实现（`beef/page.tsx` 7d Forecast 列 + `CutForecastCell` + `MarketForecastBoard`，预测从 /ai 子页融入行情主视图）
2. ~~**行情总览页重构**~~ → ✅ 已实现（`dashboard/page.tsx:179-225` 三卡 hero：进口均价/国产均价/AI 预测，覆盖率已降级为后端字段非 hero）
3. ~~**WebSocket 实时**~~ → ✅ 已实现（`app.ts` SocketIOServer + `anomalies.ts` emit + `alertNotifications.ts` WS 通道，非仅轮询）
4. ~~**IA 重组**~~ → ✅ 已实现（`AppShell.tsx:38-83` 6 区 NAV_SECTIONS；仅资讯/分析顺序与 spec 略有出入，属产品微调）
5. ~~**portfolio/trading 降级**~~ → ✅ 已降级（`/trading` = "Market Intelligence"，`/portfolio` 目录已移除，无交易撮合语义）

---

## 五、文档一致性

### 5.1 AGENTS.md（唯一完全准确的入口）

| 声明 | 实测 | 匹配 |
|---|---|---|
| 19 爬虫 | 19 | ✅ |
| 31 prisma 模型 | 31 | ✅ |
| 20 路由 | 20 | ✅ |
| 44 页面 | 44 | ✅ |
| 9 推理模型 | 9 | ✅ |

### 5.2 其他文档漂移（2026-08-09 复核）

- ~~**AUTOMATION-STATUS 头注**~~ → ✅ round-80 已修（头注现对齐正文最新轮次）
- **KNOWN-ISSUES 头注**：写"只保留开放事项"，但 9 条里 6 条标"已解决/已修"—— 保留为历史记录（有意为之，记录潜伏 bug 防复发）
- **TECH-DEBT**：13 条，10 标 STALE 但仍列（TD-1 BullMQ / TD-4 cache.ts / TD-7 riskMetrics 等代码已删）—— 保留为历史索引

---

## 六、综合判定与优先级

### 强项（勿动）
1. **价值链端到端通**：数据→推理→验证→信号→前端，0 断点（除 beef_cut_prices 冻结）
2. **9 模型全真实**：0 stub，chronos 显著优于基线（1.77% vs 3.45%）
3. **运维全绿**：3 服务稳定，health endpoint 真
4. **AGENTS.md 精准**：唯一可信的入口文档

### 真实缺口（按 ROI × 可行性，2026-08-09 复核）

| # | 缺口 | 类型 | ROI | 依赖 | 建议动作 |
|---|---|---|---|---|---|
| 1 | **D1 数据源网络封锁** | 数据 | 极高 | 用户基础设施 | 3 key 已 set（MLA/USDA/OW），根因是源站网络封锁非缺 key。CSV 手动导入路径已验证可用（round-81）作为绕行 |
| ~~2~~ | ~~stl_forecaster 10.88 MAPE~~ | ~~质量~~ | — | — | ✅ round-79 已修（signal-to-noise gate）；历史 3287 行 pre-fix 不可追溯，新预测自稀释 |
| ~~3~~ | ~~spec 过期~~ | ~~文档~~ | — | — | ✅ round-82 已对齐（§六/§七/§八 + 本节 §4.4 同步更新） |
| ~~4~~ | ~~predictionCache↔tradingSignals 循环~~ | ~~架构~~ | — | — | ✅ round-79 已修（抽 modelRegistry.ts 叶模块） |
| 5 | **portfolios/timeseries 无服务层** | 架构 | 低 | 无 | TD-6（thin CRUD，删除测试判低 ROI，§十.5 不动） |
| 6 | **beef_cut_prices 数据冻结** | 数据 | 高 | D1 先解 | verify loop 健康活跃（round-82 核实日志：每 6h verify 100-170 条）；数据回流后自动恢复 |

### 不建议做的（§十.5 / 低 ROI）
- 不删 shallow 服务（marketService/watchlistService——§十.5 不删非己所造）
- 不重构 ProfessionalChart 等大组件（图表长配置是框架特性）
- 不删 R3 幽灵模型残留行（round-72 决策：非己所造数据先记录，实际不可达）

---

## 七、技能应用记录

| 技能 | 应用 |
|---|---|
| ops-check | PM2/Docker 模式检测 + health endpoint + 端口监听 + 依赖可达 |
| zoom-out | 价值链 5 阶段映射（爬虫→DB→推理→验证→前端），用领域词汇 |
| improve-codebase-architecture | 模块深度判定（deep/shallow + 删除测试），循环依赖检测 |
| grill-with-docs | spec vs 实现交叉验证，"不做"清单核实，文档一致性核对 |

---

**本评估为只读研究，未改任何代码。结论：项目实现度极高，主要瓶颈是数据源激活（D1）而非工程能力。**
