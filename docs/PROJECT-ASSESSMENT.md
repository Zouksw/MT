# MT 项目整体规划与实现状态评估

> **评估日期**：2026-08-08（round-79）｜**2026-08-12 复核**（rounds 80-99：§〇 Executive Summary / §3.3 测试覆盖 / §3.4 循环依赖 已同步当前实现）｜**2026-08-21 复核**（rounds 100-115 → §九 完整性复核 + 技术路线评估）
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

---

## 八、体积审计（2026-08-16，round-108）

**结论：代码不臃肿，臃肿在制品层。** 全部源码（backend/src 1.8M + frontend/src 1.9M + inference 源码 ~0.2M + docs 0.5M）不足 5M，支撑 44 页/20 路由/19 爬虫/31 Prisma 模型，功能密度高。磁盘大头全部是依赖镜像、构建缓存、无界日志与工具残留，本轮已压缩（与 §AUTOMATION-STATUS 六½ 存储策略一致并深化到项目本体内部）。

**清理明细**（/root 单遍 du：12G→9.7G；df 已用 24G(63%)→22G(57%)）：

| 项 | 前→后 | 依据/验证 |
|---|---|---|
| venv triton（GPU 编译器） | 689M→0 | torch 为 `2.12.1+cpu`，requirements/代码零引用，CPU 路径不加载；pip check 无破损 + pytest 60 全过 + 全链 chronos 预测实测 |
| `frontend/.next/cache` | 412M→0 | 纯构建缓存，`next start` 不读；清理后前端 200（18ms） |
| `.npm`（cacache 349M + `npx prisma@7` 残留 253M） | 626M→7M | prisma@7 与项目 prisma 5 大版本漂移且无脚本引用；≥80% cron 阈值清理覆盖复发 |
| Playwright 双浏览器 | 521M→259M | 删 1234 版+npx 副本；e2e 脚本改经 frontend `@playwright/test`（1.58.2/1208）解析——顺带消除旧 `_npx` 硬编码路径在 cron ≥80% 清理日失效的隐患；截图 harness 实跑验证 |
| backend/logs（无界 winston） | 215M→10M | 截断保 5MB 尾 + File transport 加 `maxsize 10M × maxFiles 3`（原无日期命名，cron 30d 规则匹配不到）；backend 909 测试全过 + 重启后追加正常 |
| coverage ×2 / `.git` 松散对象 | 19M / 43M→13M | 可再生制品；`git gc` 打包 |

**保留不动（各有明确理由）**：pnpm store 3.6G（红线）、HF 权重 879M（3 Chronos 变体=产品 MODEL_IDS）、backups 184M（keep-7 有界策略）、venv 剩余 1.4G（torch CPU 716M+统计栈必需）、node_modules ×3（依赖手术需重装触 store，另列）、`.vscode-server`/`.zcode`/`.claude` 等 ~4.9G（用户/AI 工具链，非项目资产）。

**可选后续（用户决策）**：backups keep-7→keep-3（-104M）；vscode-server 旧 `code-*` 构建（~150M，重连自动重下）；依赖数量审计（knip 已配置但被 zod 兼容阻塞，见 AUTOMATION-STATUS §六½ 上方表格）。

---

## 九、2026-08-21 完整性复核 + 技术路线评估（round-115）

> 指令："评估当前项目的开发完整性，寻找有没有更加适合该项目的技术路线"。
> 方法：improve-codebase-architecture 全流程（2 个并行 Explore agent 勘察 + 交叉验证）+ 全部数字当日 live 实测（psql/测试套件/pm2/systemd/crontab）。**只读评估**，除文档修正外未改任何生产代码。

### 9.0 结论（TL;DR）

1. **工程完整性 ~90%（产品级），数据供给完整性 ~35%（牛肉核心）**——与 §〇 2026-08-08 结论一致且更精确：瓶颈仍是数据供给，不是工程能力。19 个爬虫的调度机器 100% 活着（每源 47-49 次运行/7d），但 7 天内只有 3 个源真正插入数据。
2. **技术路线无需迁移**：逐层判定（§9.5）后，所有"更换类"替代路线（K8s、合并 Next API、TimescaleDB、换预测基座、GPU）全部负 ROI 或违反约束。真正该做的是 6 个**深化候选**（§9.7，把浅模块变深），不是换路线。
3. **当日新发现 1 个用户可见错误信息**：/ai/accuracy 的 chronos 均值（46-59%）被 wheat_cme 的 20 条量纲错配行（MAPE≈9500%）污染——chronos 真实水平（各商品中位数 0.39-5.07）依然全面优于统计基线（§9.3）。

### 9.1 当日实测基线

| 项 | 实测（2026-08-21） |
|---|---|
| 服务 | backend/frontend/inference 三者 HTTP 200；PM2 3 进程 online；`mt.service` enabled+active（restarts 计数 76/26/329 为多轮部署累积，uptime 稳定） |
| 测试 | backend Vitest **919 passed + 1 skipped**（86 文件）/ frontend Jest **297**（30 套件）/ inference pytest **60** —— 全绿 |
| 规模 | 19 源文件（**18 注册**，inac 2026-08-15 停用）/ **30 Prisma 模型**（round-114 删 organizations，AGENTS.md 已同步 31→30）/ 20 路由 / **44 页**（agent 报 43 系漏数，两次 find 仲裁为 44）/ 9 推理模型 id |
| 主机 | 8 vCPU / 14G RAM（available 9.8G）/ 磁盘 57% / uptime 24d；inference RSS 2294MB（PM2 cap 4096M，08-15 曾于 3769M 被 OOM 击杀后加 MALLOC_ARENA_MAX=2 + 每请求 gc + Semaphore(3)） |
| 运维面 | crontab 5 条实跑（backup/watchdog/healthcheck/cleanup/db-maintenance）；备份实测 7 份滚动（26-30MB/份，KEEP_COUNT=7）；logrotate 在位 |

### 9.2 数据供给真实图（价值链瓶颈精确定位）

**调度机器 100% 活，产出集中 3 个源**（ingestion_logs 近 7d）：

| 层 | 实测 |
|---|---|
| 调度 | 进程内 scheduler（server.ts backgroundJobs 声明表），每源 47-49 次运行/7d，scraperFetch 统一 adapter 18/18 覆盖，失败分类三方共用 |
| 产出源（7d 有插入） | world_bank **4,973 行**（→market_factors）/ cme_futures 97 / commodity_prices 42 |
| 零产出但"成功" | usda_ams、abares、cepea、secex 等：success + inserted=0（源站封锁，D1 持续；usda_ams 最新价 2026-04-29） |
| 间歇错误 | fred 19 error + 47 success（数据仍到 08-20）；weather 19 error |
| 商品价新鲜度 | fred 67,088 行→08-20；cme 94→08-20；exchange_rate_api 177→08-20；world_bank 48→06-01（月度）；usda_ams 2,776→04-29 |

**牛肉核心序列**：

| 序列 | 状态 |
|---|---|
| beef_carcass_us | ✅ **活**——4,246 行，fred 日更至 08-20（主预测/验证对象） |
| live_cattle_cme / feeder_cattle_cme | ✅ 活（cme 经本地代理 127.0.0.1:7890）→08-19 |
| beef_cut_prices（部位级） | ❌ 冻结 2026-04-30（2,401 行，近 30 天 **0 行**）；beefPriceBridge 设计在但同样 0 产出——上游 MLA/USDA 部位源封锁，桥无水可引（§八前 agent 表述"桥维持 /beef 活着"与实测不符，已修正） |
| market_news | ❌ **生产 0 行**（spec §七 称 5 条 seed——资讯模块页面/API 在，内容为空，M3 未启动） |
| 遗留脚手架空转 | datasets=1 行、forecasting_models=0 行——Dataset/Timeseries/Datapoint/ForecastingModel/Forecast 整簇在生产无人使用（round-114 已删 organizations，此簇是下一层同类候选，按 §十.5 仅记录） |

### 9.3 验证环健康 + "chronos MAPE 暴涨"真相

- prediction_logs 141,425 行：verified 26,738 / unverifiable 86,809 / completed 16,219 / stale 11,659。近 7d 验证活跃：chronos 每变体 1,353-1,357 条 verified；**统计模型 0 条**（d00221b 基线批 4 模型 ×16 商品 241-242 条/周 completed，窗口未到期属正常；stl_forecaster 信噪比门控下 07-26 起停产）。
- **表面异常**：chronos avg_mape 46.59-59.05（§二 2026-08-08 曾为 1.77-1.93）。
- **真相（逐商品下钻）**：verified 池从牛肉扩展到 CME/FX 全谱后，wheat_cme 贡献 20 条 MAPE≈9,874 的行（20×9874/3430≈58，与总均值 59.05 算术吻合）。根因：**wheat_cme 全表仅 6 行且混两种量纲**（close 6.77 与 667.60 并存，$/bu 与 ¢/bu），预测在错配序列上训练与配对。剔除后 chronos 各商品中位数：usd_cny 0.39 / aud_usd 0.40 / beef_carcass_us **1.54** / brl_usd 0.96 / eur_usd 1.18 / 原油 3.13 / 天然气 5.07——**预训练基座优于统计基线（3.45-3.73）的结论保持成立**，且原油上 chronos(5.05) 对 arima(13.72) 优势最大。
- 连带影响：arima 本周也有 14 条 wheat_cme 新预测在路上，将同样污染统计模型聚合 → 聚合口径修复（中位数/按商品分组）+ 入口量纲护栏（§9.7 候选 2）双管齐下。

### 9.4 完整性评分卡

| 层 | 完整度 | 关键证据 |
|---|---|---|
| 采集工程（调度/adapter/失败处理） | **95%** | 18 源注册全跑、scraperFetch 全覆盖、empty-after-run 信号、0 TODO；缺主动告警（失败只落库） |
| 数据供给（牛肉核心） | **~35%** | 主序列活（fred/cme 3-4 源产新）；部位级冻结 04-30、资讯 0 条、15 源 0 产出 |
| 推理服务 | **90%** | 9 模型全真实、conformal SQL 化、/ready 诊断；注册清单 4 处重复已漂移（7 vs 9）、/predict/batch 无调用方 |
| 验证环 | **95%** | round-114 三方窗口语义一致；近 7d chronos 1,357/变体持续 verified |
| 信号/分析 | **90%** | 共识/回测/相关性实时计算（无独立表），真实数据驱动 |
| 前端 | **85%** | 44 页 0 mock、6 区 IA、预测融入行情行；4 组死链 404、fetch 三层并存、Badge 双实现 |
| 质量工程 | **80%** | 1,276 测试全绿、20/20 路由有测试、coverage 门槛 45%（branches 46.94%）；爬虫源级测试仅 3/19、通知外发链路 0 测试 |
| 运维 | **90%** | mt.service/备份/logrotate/watchdog 全实测有效；告警被动、部署三轨并行 |
| 文档 | **85%** | AGENTS.md 当日已修（31→30）；AUTOMATION-STATUS 3 处漂移（§9.6）；PRODUCT-SPEC M3 开放 |

### 9.5 技术路线判定（逐层）

| 层 | 现状 | 判定 | 替代路线及拒绝理由 |
|---|---|---|---|
| 拓扑 | 单机 4 进程（PM2）+ 宿主 systemd PG14/Redis6 | **KEEP** | K8s/容器化已归档 deploy/attic（TD-15）；solo+AI 维护下 systemd+PM2 复杂度/收益比最优；14G/8C 余量充足 |
| 后端 | Express 4 + Prisma 5（20 路由） | **KEEP** | 合并进 Next API routes = 丢弃 920 测试套件与 8 中间件生态，负 ROI；已知债（beef/portfolios/timeseries 厚路由）按 TD-6 低 ROI 挂账 |
| 推理 | Python FastAPI 独立进程 | **KEEP** | torch/statsmodels 生态不可替代；预训练-only 约束下 chronos 实证最优（§9.3） |
| 预测基座 | chronos-t5 ×3 + 6 统计 | **KEEP（可选实验）** | TimesFM/Moirai 换基座属产品实验非架构修复；lagged-exog 实验仍挂产品决策 |
| 统计栈 | statsmodels + sktime | **KEEP** | statsforecast 迁移无收益（统计模型仅 242 条/周，非瓶颈）；sktime 仅 1 处 NaiveForecaster，未来可减 |
| 数据库 | PostgreSQL 14 单库 | **KEEP** | TimescaleDB/ClickHouse 距离门槛差 3-4 个数量级（整库备份 30MB） |
| 缓存 | Redis（宿主 systemd） | **KEEP** | 真实依赖 6 处，其中 tokenBlacklist/authLockout 是 **fail-closed 安全契约**——换进程内 LRU 丢失跨重启安全语义，不可轻动 |
| 前端 | Next.js 15 App Router + SWR | **KEEP** | 收敛继续（fetch 三层→apiFetch、Badge/Tag）；无框架级问题 |
| 进程/部署 | PM2 + mt.service + 5 crontab + CI 8 job | **KEEP + 收敛** | 唯一实质缺口是部署三轨并行（CI 内联 / deploy.sh 无人调 / 手工三连）——候选 4 |
| 杂项清理 | — | **清理** | pg 依赖 0 import、uuid→crypto.randomUUID、双 winston logger、INFERENCE_URL 三处硬编码、INFERENCE_TIMEOUT/REDIS_ENABLED/SCRAPE_INTERVAL_MINUTES 三个死配置 |

**路线级结论**：没有需要迁移的层。数据供给是唯一的"路线级"缺口，且不是技术栈问题——源站封锁只能靠既定绕行（CSV 手动导入已验证可用、RSS 待接入）解决。

### 9.6 新发现缺陷与文档漂移（本轮全部只记录，未修）

**缺陷**（按影响排序）：
1. **wheat_cme 量纲混装**（6 行 6.77/667.60 并存）→ 污染 20 条 chronos 验证行 + /ai/accuracy 聚合展示；arima 14 条在途。
2. **前端 4 组死链 404**：`/timeseries/show/[id]`（3 处 push，无 show 目录）、`/datasets/edit/[id]`、`/terms`、`/privacy`（auth-page 引用）。
3. **假日志行**：server.ts:339 打印 "📡 WebSocket server ready"，但 socket.io round-112 已整体摘除。
4. **market_news 生产 0 行** vs spec 记载 5 条 seed（消失时间与原因未查，如实记录）。
5. Badge/Tag 双实现（Tag 10+ 使用方 / Badge 2 个）——Button/Card 之后下一个收敛点。

**文档漂移**（AUTOMATION-STATUS，3 处）：§八 称部署走 deploy.sh，实际 CI 是内联命令（ci.yml:384-414）且 deploy.sh 从未被调用；§一 称 7 个 CI job，实际 8（含 rollback）；§五 inference 测试数过期（实为 4 文件 / pytest 60）。另：agent 报前端 43 页系误数（实测 44）；"bridge 维持 /beef 活着"表述过期（近 30 天 0 产出）。

### 9.7 深化候选（详见 HTML 报告）

报告：`/tmp/architecture-review-20260821.html`（Tailwind+Mermaid，含每个候选的前后对比图）。

| # | 候选 | 强度 |
|---|---|---|
| 1 | **模型注册单一事实源**——inference `/models` 升级为唯一源，backend 启动拉取派生 VALID_MODELS + drift 告警（当前 7 vs 9 漂移即证据） | Strong（Top） |
| 2 | **数据入口量纲护栏 + 聚合诚实化**——upsertPrice 加序列尺度不变量（vs 近 30 点中位数 >20x 拒绝）；accuracy 聚合改中位数/按商品分组 | Strong |
| 3 | 主动告警——cron-healthcheck 复用 SMTP 发 data-dormant/ingestion-error 日摘要（nodemailer 已在依赖） | Worth exploring |
| 4 | 部署单一入口——deploy.sh 吸收 CI 内联逻辑，CI 与人工共调，结构性消灭"忘了 build" | Worth exploring |
| 5 | 前端 fetch 三层归一——apiFetch 吸收 swrFetcher cookie 能力，裸 fetch 逐页迁移（TD-8 主力） | Worth exploring |
| 6 | 诚实性快修包——死链 4 组、假日志行、3 个死配置、Badge 收敛（每项 ≤30 分钟） | Strong |

### 9.8 技能应用记录

improve-codebase-architecture（Explore×2 并行勘察 → HTML 报告）；ops-check 手法内化于 §9.1（pm2/systemd/crontab/curl 全实测）；数字纪律全程执行（每条数字附来源命令，两个 agent 的 3 处误报已仲裁修正）。
