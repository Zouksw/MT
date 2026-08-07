# 自动化基础设施状态

> 最后更新：2026-08-01（round-25 ~ round-29；round-40/53/57 修订过期数据）
> 这份文档是给未来维护者的地图，避免重复审计。每个护栏标注它守护什么、为什么存在。
> §九 数字严谨要求：下列计数为"截至 2026-08-01 live 实测"，运行对应命令获取当前值。

## 一、CI/CD（GitHub Actions）

**配置文件**：`.github/workflows/ci.yml`

**触发**：push 到 main/develop（忽略 md/docs）、PR 到 main/develop、手动 workflow_dispatch。

**Job 链路**（7 个，按依赖顺序）：

| Job | 作用 | 失败阻断部署？ |
|---|---|---|
| `security-scan` | pnpm audit（high+）+ Snyk | 软失败（continue-on-error） |
| `lint-and-typecheck` | backend/frontend 各跑 biome lint + tsc --noEmit | ✅ 硬阻断 |
| `test-backend` | PostgreSQL + Redis 服务容器 → prisma migrate → vitest | ✅ 硬阻断 |
| `test-frontend` | jest + next build | ✅ 硬阻断 |
| `test-inference` | setup-python 3.10 → ruff check → pytest | ✅ 硬阻断（round-25 新增） |
| `build` | 仅 main push；构建 backend dist + frontend .next，上传 artifact | 依赖前 5 个 job |
| `deploy` | 仅 main push；SSH 到生产 → git pull → build → prisma migrate → pm2 reload | 依赖 build |
| `rollback` | deploy 失败时自动 git revert + 重建 | failure() 触发 |

**Coverage**：backend 跑 `test:coverage` 并上传 Codecov（continue-on-error=true，软失败）。frontend coverage 未在 CI 跑（jest.config.js 配了 70% 阈值但 CI 不强制）。

## 二、定时任务（系统 crontab）

`crontab -l` 共 5 条：

| 频率 | 脚本 | 作用 |
|---|---|---|
| `0 2 * * *` | `backup-db.sh --compress` | 每日 2AM 数据库备份 |
| `*/2 * * * *` | `watchdog-nextserver.sh` | 每 2 分钟杀重复 next-server（防 OOM） |
| `*/5 * * * *` | `cron-healthcheck.sh` | 每 5 分钟探测 backend/frontend/inference + 自动重启 + **数据新鲜度探针**（round-49：读 /health/ready 的 dataLayer，anyDataFlowing=false 或 verification debt 高时记入 healthcheck.log，不重启） |
| `0 3 * * *` | `cron-cleanup.sh` | 每日 3AM 磁盘清理（tmp/core/playwright/旧日志） |
| `0 4 * * 0` | `cron-db-maintenance.sh` | 每周日 4AM VACUUM ANALYZE + session 清理 |

**round-28 变更**：cron-healthcheck.sh 新增 inference(10810) 探测。现在 3 个服务都受 cron 自动重启保护。

**敏感操作禁令**：`cron-cleanup.sh` 明确禁止 `pnpm store prune`（曾 3 次导致文件损坏，Round 5/7/10）。

## 三、应用内定时器（setInterval，backend server.ts）

无 cron 库，全部原生 setInterval：

| 频率 | 任务 | 入口 |
|---|---|---|
| 启动后 5s | `schedulePredictionsFromPostgreSQL` + `scheduleBeefCutPredictions` | server.ts:147 |
| 30 min | 订阅制预测刷新（遍历所有 commodity + cut 订阅，跑 inference） | predictionCache.ts:197 |
| 启动后 15s + **6h** | `verifyDuePredictions`（MAPE 验证，扫描到期预测；round-46 从 24h 提频、批次 2000→5000） | server.ts |
| 启动后 20s（一次性） | `invalidatePollutedPredictions`（round-46：作废 brl_usd/corn_cme/natural_gas_cme 的 pre-fix 污染预测，标 stale） | server.ts |
| 启动后 30s + **10 min** | `evaluateAlertRules`（用户告警规则评估；round-44 修 bug：原 10h→10min） | server.ts |
| 启动即跑 | `scraperManager.runAll()`（全部 19 个采集器） | server.ts:109 |
| 1h | commodity_prices, china_wholesale | server.ts |
| 6h | cme_futures, dce_futures, fred, fao, baltic_dry, shipping_index, weather | server.ts |
| 24h | world_bank, usda_psd, mla_nlrs, cepea, inac, abares, china_customs_stats, secex, usda_ams | server.ts |

**写后缓存失效（round-45）**：`upsertPrice`（helpers.ts）在真实写入（非 samePrice no-op）后 fire-and-forget 调 `invalidateCommodityCache(commodityId)`，SCAN-by-prefix 失效该 commodity 所有 model/horizon 的 cached prediction。对称 round-30 的 cut-series 失效。

**采集器状态**：MLA + USDA-AMS 因 `MLA_API_KEY`/`USDA_MARS_API_KEY` 缺省处于 dormant（scraperManager 跳过不报错）。其他源可配 key 的（FRED、OPENWEATHER）同理。

## 四、PM2（生产进程管理）

**配置**：`ecosystem.config.cjs`，3 个 fork 模式进程：

| 进程 | 端口 | 重启策略 |
|---|---|---|
| mt-backend | 8000 | max_restarts:10, restart_delay:3s, min_uptime:10s |
| mt-frontend | 3000 | 同上 |
| mt-inference | 10810 | max_restarts:10, restart_delay:5s, min_uptime:15s, kill_timeout:10s |

**无 cron_restart**（定时重启未使用）。保活靠 PM2 autorestart + cron-healthcheck 双保险。

**inference 特殊配置**：`env_production` 设 `HF_ENDPOINT=https://hf-mirror.com`（huggingface.co 被墙，用镜像）。chronos 启动时预加载（main.py startup hook），冷加载 ~90s（3 个变体各 ~30s）。

## 五、测试体系

| 项目 | 框架 | 配置 | 测试文件数 | 测试数（截至 2026-08-07 实测） |
|---|---|---|---|---|
| backend | vitest 3（round-53 从 2 升级） | vitest.config.ts | 57 | **645 pass / 1 skip** |
| frontend | jest 29 + Testing Library | jest.config.js | 24 | **278 pass** |
| inference | pytest 8 | conftest.py | 3 | **47 pass** |
| frontend E2E | Playwright | playwright.config.ts | 10 specs | chromium only |

> 三者合计 **970 全绿**（645 + 278 + 47，截至 2026-08-07 实测）。测试数随时间变化，运行 `cd backend && pnpm test`、`cd frontend && pnpm test`、`cd inference-service && pytest -q` 获取当前数。

**集成测试（fail-loud）**：backend `src/__tests__/integration/` + `src/routes/__tests__/` + `src/services/__tests__/`（真 DB 子集）用真实 PostgreSQL（mt_db）+ in-process Express（supertest）。**DB 不可达时显式失败**（`requireDb(label)` 在 beforeAll throw，或 `createTestContext` 后 `if (!ctx.available) throw`），不再静默 skip 报绿——2026-08-01 round-60 测试系统重构统一（之前 150+ case 用 `if (!dbAvailable) return;` 静默跳过，无 DB 时假绿掩盖故障）。CI 已配 postgres+redis（ci.yml:126-160），真 CI 跑真测试，只有真 DB 故障才红。

**测试系统重构（round-60，2026-08-01）**——目标"先进测试系统：只保留真正有意义的测试"。三准则贯穿：每个留存的测试 ① 真测生产代码 ② 真行为断言 ③ 失败显式报红。
- **同义反复根治**：`alertRules.test.ts` 17 case 改测**真** `isConditionMet`（export 出来；mutation 验证能捕生产漂移，原测本地副本 = 永绿）；`injection-auth.test.ts` 删 SQLi/XSS 同义反复块（测测试内手写对象/Prisma 保证，非本仓代码；backend 无 sanitizer 可 redirect），保留 7 真 authz 测试。
- **silent-skip → fail-loud**：16 文件（8 routes + 6 createTestContext + 2 integration）全显式失败。新增 `testApp.ts:requireDb(label)` helper（包装 isDbAvailable，false 时 throw actionable error）。
- **结构冗余合并**：`ai.test.ts` 并入 `signals.test.ts`（独有 3 case 迁移，重叠 4 删）；`user.test.ts` 删 billing 块（被 billing.test.ts 完全覆盖）；前端 `__mocks__/recharts.tsx` + `html2canvas.tsx` 抽公共 manual mock（去 ~70 行重复 factory，case 不变）。

**测试系统重构续（round-61，2026-08-02）**——审计后剩余 3 个低价值文件按 round-60 三准则收尾：
- **LoginForm（5 render-only → 4 behavior）**：原 5 case 全断言静态标签/placeholder 存在（"Email"/"Password"/"Sign In"），即使 `validate()` 被掏空也永绿。改为 4 case 测真 `validate()` 契约——空表单提交显示可见错误（`Input.tsx` 的 `<p class=text-error>`）且**阻断 fetch**；retype 后错误清空；初次渲染无错误。mutation 验证：把 `validate()` 改成恒通过，4 case 中 2 个红（证非同义反复）。
- **ContentCard（12 → 11）**：删 "loading prop 渲染子节点" case——`loading` 在 interface 声明但组件从不解构（9 props 用 6），零 caller 传（grep 全 src），测一个被忽略的 prop = 无意义假信心测试。条件 class 测试保留（accent 切 border-t-2、title 渲染 dot）。
- **concurrent-operations（22 → 22，契约精确化）**：宽接受断言换成真函数契约（源码核实自 `tokenBlacklist.ts`/`authLockout.ts`）：`isTokenBlacklisted("")`/`"not-a-jwt"`/random → pin false（原 `typeof === "boolean"`，即使全部误返 true = fail-closed 锁所有用户也绿）；`removeFromBlacklist`/`blacklistToken` → pin true；`checkAccountLockout(新 id)` → `{isLocked:false, remainingAttempts:5}`；mixed concurrent API 改 per-endpoint allowed-set + label（原 `200≤status≤500` 接受任何 HTTP 状态，含 `/auth/me` 无 token 返 200 = auth bypass）；concurrent login（未注册邮箱）限 `{401,429}`（原含 200 = 登录成功不存在用户的 auth bypass）。

**MAPE E2E 守护**：`services/__tests__/mapeTracking.test.ts` 覆盖 cut-series 预测的完整验证链路（PredictionLog → BeefCutPrice actuals → verifyDuePredictions → verified + MAPE）。守护 round-22 的正确性修复。

**核心价值链修复（round-62，2026-08-02）**——修了两个放大"数据层失效后果"的代码缺陷（非数据源本身，仍需用户供 MLA/USDA key 等）。直接保护 AI 预测 → MAPE 验证 → 准确率展示这条主链：
- **P1 止血（commit c0c4944）**：`schedulePredictionsFromPostgreSQL`（`predictionCache.ts`）加 `STALE_WINDOW_DAYS=7` recency gate。15 个 frozen 商品（最新价 2-3 个月前）此前每 30 分钟仍生成新 chronos 预测（永不可验证）。加 gate 后 frozen 商品不再被订阅——live 实测订阅数 15+ → 4。+3 测试（mutation-verified）。
- **P2 排空（commit 013fa1b）**：新增 `markUnverifiablePredictions()`（`mapeTracking.ts`）+ 第 4 状态 `unverifiable`（区别于 `stale`=污染源）。server.ts 启动钩子。dataHealth 加第 4 桶 `predictionUnverifiable`，`verificationRatio` 分母排除 unverifiable。live 实测：`predictionBacklog` 107,393 → 14,888；`verificationRatio` **0.006 → 0.522**；`hasVerificationDebt` **true → false**；verify loop 日志从 `Verified 0 of 5000 (5000 no actuals)` 变 `Verified 5000 of 5000 (0 no actuals)`。+6 测试。
- **预期终态**：08-06 后 chronos 首批到期预测进 due 批次时，verify loop 不再被 92k 死积压挤占窗口。frozen 商品数据源恢复后，新预测按正常路径验证。

**Scraper 健康（round-63，2026-08-02）**——19 源逐项 live 审计（详见 KNOWN-ISSUES D1 round-63 表）。修了 2 个代码缺陷：
- **faoPrices stall（commit 4bae943）**：`fetchWithRetry` 重试所有失败（含 5xx/网络超时）致 fao scraper 单次跑 **272s**，stall 整个 scraper batch ~4.5min。改为 8s 超时 + 仅 transient(429/5xx≠521) 重试 + 网络错误不重试。live：**272s → 40s**（6.8×）。+7 测试（mutation-verified）。
- **balticDry dead URL（commit 0a7598e）**：primary `api.balticexchange.com` 恒 404（付费 API）。删 dead path，改单源 FRED（需 `FRED_API_KEY`）。
- **结论**：fao/baltic 修复**不直接产新数据**（FAO origin down + baltic 需 FRED key），但消除 batch stall + 死代码。19 源中 2 个产数（fred/exchange_rate_api）、1 个预期月度（world_bank）、2 个仅 key 门控（MLA/USDA-AMS，最高 ROI）、其余需网络/反爬/headless。

**Health 字段回归修复（round-64，2026-08-02）**——round-62 加第 4 桶 `predictionUnverifiable` 时，`/health/ready` route 的 dataLayer 转发块意外漏掉 `predictionStale`（service 仍算但 route 丢弃），~11,659 条污染源 stale 行对 operator 不可见。根因：route 层无 dataLayer 字段集测试，漏字段静默 ship green。
- **commit 33ecbbd**：`health.ts` 重新加 `predictionStale`（type + forward 块）；`dataHealth.test.ts` 补 stale 字段断言（service 守护）；新增 `health.test.ts`（route 守护，断言 4 桶全转发，mutation-verified）。live：`/health/ready` dataLayer 现 8 字段全可见（backlog 14894 / verified 16290 / **stale 11659** / unverifiable 76954 / ratio 0.5224）。backend 640|1 → 642|1。

**测试代码精简（round-65，2026-08-02）**——用户要求大幅减少测试代码量。live 审计确认所有"非核心"测试文件都测 LIVE 生产代码（路由已 mount、组件已渲染进导航），删文件 = 活代码失覆盖（违反诚实优先），故**不删文件**，只做文件内精简。
- **commit b73b2c6（backend，-187 行 / -10 用例）**：mapeTracking 提取 `seedConflictRow`/`cleanupConflictRows` helper（5 个冲突预测测试手写重复 scaffolding，mutation-verified）；errorHandler 7 个 Error-Class describe→1 个 `it.each`（断言全保留）；api-workflows 删 4 段非核心 workflow（Watchlist/Billing/APIKeys/Portfolio，均有更深 route 测试覆盖，唯一有价值的 `/api/analytics/correlation` 断言移入 Signals 段保留）；concurrent-ops 5 个 Empty/Null 边缘用例→2 个 `it.each`。backend 642|1 → 632|1。
- **commit 3e4383d（frontend，-364 行 / -9 用例）**：useDashboardStats 提取 `makeFetchResult`/`mockByKey` 工厂（13 个测试内联 9 字段返回对象）；AnomalyChart/PredictionChart 提取 `renderChart(overrides)` helper（重复 JSX 8-10×）+ 各删 1 纯 testid smoke；StatCard 3 趋势变体→`it.each`；ErrorBoundary 合并 Try-Again+Reload 两按钮测试 + 删隐含覆盖的 "not render children"；ContentCard accent true/false→`it.each`；alerts page 删 4 纯静态文本 smoke（header/filter/refresh/mark-all-read，保留 4 行为测试）；market-news 删 1 纯按钮 smoke。frontend 287 → 278。
- **§十.4 豁免说明**：本轮用户明确授权删**纯 smoke/渲染存在性用例**（只断言静态文本/className/testid 存在、不测行为）致测试数下降 19（backend -10、frontend -9）。属计划内、非回归——所有删除的用例要么是浅层重复（已有更深 route/service 测试覆盖的 happy-path envelope），要么是表驱动合并（断言全保留），要么是纯静态存在性断言（数据加载行为测试已隐式覆盖）。核心价值链行为/回归用例**零删除**。行为覆盖无净损失。

**markUnverifiable 残留盲区修复（round-66，2026-08-03）**——round-62 P2 的 `markUnverifiablePredictions` 只扫 `predictedAt <= now-10d`（due 截断），但 round-62 P1 gate 上线后仍在生成的"近期（10 天内）但源已死"的预测**全部漏网**——它们永远到不了 due 截断，却永远等不到 actual，永久占用 completed 队列。
- **commit 8f9153b**：`mapeTracking.ts` 加 Pass B（`markLaggingFrozenPredictions` 辅助函数）——扫 `predictedAt > cutoff`，当 `latest daily price <= predictedAt` 且 `latest price < now-STALE_WINDOW_DAYS(7)` 时标记 `unverifiable`。7d recency 守卫区分"确已死的源"和"周末/1-2 天 lag"（避免误伤活源）。Pass A（Steps 1-3，due 扫描）逻辑不变、与 Pass B 互斥（`<= cutoff` vs `> cutoff`）。
- **+2 测试**（mutation-verified：把 `&&` 改 `||` 让 recency 守卫失效，负向测试红）：正向（lagging-frozen → unverifiable）+ 负向（6d lag 活源 → 保持 completed）。backend 632|1 → 634|1。tsc clean。幂等。
- **live 实测**：`predictionBacklog` **15,377 → 3,162**（-79%），`predictionUnverifiable` **76,954 → 89,173**（+12,219），`verificationRatio` **0.837**（未稀释——分母正确排除 unverifiable），`hasVerificationDebt` false。verifyDuePredictons 日志从扫 ~15k 行变 `Verified 0 of 40 due`（仅剩 beyond-cutoff 边缘 40 行）。

**R2 读侧权威源过滤补全（round-67，2026-08-03）**——审计发现 round-41 只修了 4 个读侧（training/actuals/correlation/inference-history），遗漏 6 个用户可见的"latest price / 聚合"读取点。`GET /api/signals/brl_usd` live 实测 currentPrice 返回 exchange_rate_api 反向值 0.197（应 fred 5.0），predictedChange 2460 无意义。逐项根治（每批独立 commit + mutation-verified）：
- **B1（c24dff2）**：`signals.ts:345`（单预测）+ `:279`（批量，新 `batchLatestPriceWhere`/`dedupeLatestByCommodity` 共享 helper）+ `alert-rules.ts:147`（告警）。+2 测试（cache-aware：清 `signals:commodity` Redis key 避免假绿，mutation 把过滤去掉+清缓存→红）。
- **B2（b77d540）**：`marketService.ts:listCommodities` relation include 改批量查询（relation include 无法加 source 过滤）。+1 测试（mutation-verified）。
- **B3（9cf4e6c）**：`watchlistService.ts` 两处 raw SQL 加 `partitionBySource` 拆 conflict vs 普通查询；`authoritativeSources.ts` 导出 `getConflictSlugs`。+2 测试（mutation-verified）。
- **B4**：`analytics.ts:39` 季节性聚合 raw SQL 加 `AND source = ${authoritativeSource}`（`Prisma.sql`/`Prisma.empty` 条件片段）。无测试文件（端点此前 0 覆盖），live 验证 12 月 avg 全 5.1–5.5。
- **live 实测**：signals brl_usd currentPrice **0.197→5.0592**；market commodities latestPrice **0.197→5.0592**；seasonality 12 月 avg 全 **5.1–5.5**。backend 634|1 → **639|1**（+5 回归测试）。tsc clean。

**死代码清理 + axios 移除（round-68，2026-08-03）**——TECH-DEBT 死代码全量重审（Explore agent + 逐项独立 grep 复核）。
- **commit 824e10f（-631 行）**：删 ~40 个 leaf-level 0-caller 导出（backend `types/index.ts` 5 死 interface、`response.ts` 2 死类型 + 3 个死 default export + TokenPayload 改本地；frontend `types/api.ts` 重写仅留 6 LIVE 类型、`responsive-utils.ts` 删 5 死 hook、`motion.ts` 删 7 死、`chart-config.ts` 删 9 死+default 等）。signature-live 类型 + 已记录 API surface（blacklist-admin/unsubscribeCommodity）保留。backend 639|1 / frontend 278 不变。
- **commit 12aca10（TD-8 RESOLVED）**：`market-data.ts` fetcher 从 axios 迁原生 fetch（对齐 `authFetch` 范式），删 axios 依赖 + lockfile（-axios + 2 transitive，node_modules 0 引用）。frontend tsc clean + 278 不变 + live 渲染 200。

**API key 验证接入（round-69，2026-08-03，TD-3 RESOLVED）**——`validateApiKey`（已完整实现含用量追踪，但 0 caller）接入 `authenticate` 中间件：头约定 `x-api-key: iotd_xxx`（专用头，与 JWT `Authorization: Bearer` 物理分离）。`auth.ts` 加短路分支：有 `x-api-key` → 调 `validateApiKey` → 命中填 `req.user` + `next()`；未命中 401。JWT 路径不动。live：JWT 仍 200；x-api-key 认证 200 + usageCount=2 + lastUsedAt 写入；吊销/失效 → 401。backend 639|1 → **642|1**（+3 测试，mutation-verified）。docs/API.md 加 API Key 段，前端页加头使用提示。

**前端 crash-loop 修复（round-70，2026-08-03）**——核心价值链终端（前端）一度 hard down：mt-frontend PM2 crash-loop 527 次，`:3000` 返 HTTP 000。根因：`scripts/restart.sh`（dev 模式 `pnpm dev`）与 `ecosystem.config.cjs`（PM2 prod 模式 `pnpm start`）共用 `.next/`——`next dev` 覆盖 `.next/routes-manifest.json`（dev 版无 `dataRoutes` key），PM2 重启 `next start` 时迭代 undefined → `TypeError: routesManifest.dataRoutes is not iterable`。**`distDir` 不能修**（实测：只隔离 chunk 输出，dev 仍写根 manifest，误信会撞坏 prod）。真修：`restart.sh` 加 PM2 guard——若目标进程名在 `pm2 jlist` 则拒绝启动 dev（exit 1 + 指引 `pm2 restart` 或先 `pm2 delete`），强制二选一。恢复：清 `.next/`+`.next-dev/` → `pnpm build`（11-key manifest）→ `pm2 restart mt-frontend` → HTTP 200，价值链页（beef/dashboard/ai/analysis/trading）全渲染，restarts 稳定。无源码/测试改动；frontend 278 不变。CLAUDE.md + docs/KNOWN-ISSUES.md B2 记录此坑与 distDir 死胡同。

**MAPE 写路径防御性加固 + Tailwind 漂移核查（round-70 续，2026-08-03）**：
- **commit 536dc96（predictionCache）**：`runAndCachePrediction` 的 `logPrediction` 从 fire-and-forget（`import(...).then(m => m.logPrediction(...).catch(...))`）改为 `await` + try/catch。原形式结构脆弱——外层 `.then` 返回 undefined（不返回 logPrediction promise），外层 `.catch` 只捕获 import 错误，logPrediction 若不 settle 则无迹可查。新形式保留"DB 写失败不破坏 cached prediction"契约（try/catch 吞并 + log），但写入确定性化、失败可观测。3 个 runAndCache 测试契约不变通过；backend 642|1 不变。诚实记录：live 核查时 prediction_logs 正在正常产（最新行 2 分钟前），故为预防性加固，非修 active bug。
- **commit a65e37e + d45e893（Tailwind info 漂移）**：核查 TD-12 双配置时发现 `tailwind.config.ts info.DEFAULT=#B8860B`（3.2:1，AA fail）与 `tokens.css --color-info=#8B6914`（AA pass）漂移，修 config hex 对齐。**后续 live 修正**：built CSS 实测 `text-info` 解析为 `var(--info)=oklch(0.57 0.17 250)`（蓝色），`@theme inline` 覆盖 config 与 tokens.css 两者——fix 无视觉收益，仅消除 config 内部矛盾（注释 vs 值）。TD-12 记录三源并存架构（config 颜色段[死] + @theme inline oklch[活] + tokens.css[死]）需产品决策选 palette 后才能根治。

**MAPE 验证环孤儿行回收（round-71，2026-08-05）**：发现 `markUnverifiablePredictions`（point-in-time + 不可逆）会把"瞬时数据滞后"的 commodity 永久标 `unverifiable`——beef_carcass_us 有 738 条 stranded unverifiable，但该 commodity 实际有窗口内 actuals（07-28 的 5 条 due 行有 5 条 actuals）。新增对称逆操作 `restoreVerifiablePredictions()`（`mapeTracking.ts`）：扫 `status='unverifiable'` 非 cut 行，按 commodity 取 `MIN(predictedAt)`，若该 commodity 最新 daily 价 > 最早预测时间则视为"源已恢复"，把这些行标回 `completed` re-enter 验证环。接入 `server.ts` 启动 hook（在 markUnverifiable 之后跑）。+3 测试（正例恢复 / 负例仍冻结保持 unverifiable / 幂等），mutation-verified。live 实测：beef_carcass_us 738→0 unverifiable，completed/variant 48→262。backend 642|1→**645|1**。KNOWN-ISSUES D2 记录。

**价值链健康核查 + 死配置清理（round-72，2026-08-07）**——TD-3 计划（round-69）经核实已完整落地（commits 6f6cf5a+e6d82ce+a525939：`authenticate` 加 `x-api-key` 短路分支、+3 测试、docs/API.md、前端提示），未重复实施。本轮实测价值链全链端到端通：
- **chronos MAPE 成熟（round-59 预测兑现）**：3 变体各 **267 verified**（08-05 首验 → 08-07 持续），avg_mape base 0.735 / mini 0.789 / tiny 0.756（%）；conflict commodity 各 50 verified（round-58 回收生效）。`AccuracyTransitionBanner` 自动隐藏（267 ≫ MIN_VERIFIED_SAMPLE=5）。价值链 MAPE 环进入实测期。
- **commit d5e9ec4（inference config 死参数清理）**：`config.py` 删 5 个 `lstm_*`/`transformer_*` 参数（label "Timer-XL/Sundial model params"），grep 证实 0 reader（只 host/port/log_level 被读）。ruff clean / pytest 47 / pm2 restart / live `/models` 返 9 正确 id（无 timer_xl/sundial）。
- **ghost 模型审计（KNOWN-ISSUES R3）**：`prediction_logs` 残留 `timer_xl`(167)/`sundial`(165) 孤儿行（2026-05/07 era，引擎已无此模型）。无实际污染（模型清单代码常量驱动 + 测试守护 + getAllModelAccuracy 只遍历 live 模型）；唯一暴露面是鉴权 wildcard `/models/:modelId/accuracy`，前端不可达。按 §十.5 仅文档记录，不删 DB 行 / 不加投机 guard。
- backend **645|1** / frontend 278 / inference 47 全绿，无回归。

**Node 18 → 20 LTS 升级（round-73，2026-08-07）**——本地运行时与 CI 对齐（CI 早是 Node 20，`ci.yml:25 NODE_VERSION: '20'`，本地此前落后在 Node 18 已 EOL）。无源码改动（升级是系统/运维操作）：
- **路径**：NodeSource apt，`/etc/apt/sources.list.d/nodesource.sources` 已指向 `node_20.x`，`apt-get install -y nodejs` 直接升 `18.20.8-1nodesource1` → `20.20.2-1nodesource1`（仓库早配好但未拉取）。
- **兼容性预核**（Explore agent 全量）：唯一 engines 约束 `frontend "node": ">=18.20.8"`（floor-only，20 满足）；Next 15.5 官方支持 Node 20；无 `.nvmrc`/`.node-version` pin；grep `url.parse(`/`punycode`/`util._extend`/`Buffer(`/`crypto.createCipher` 全 **0** deprecated-API 命中；`@types/node ^20` 已在用。
- **全局包保留**（dpkg 核实归属后验证）：npm 10.8.2 / **pnpm 8.15.0 不变**（§七.3 store 未动）/ **pm2 6.0.14 不变** / bun 1.3.11 / codex 0.121.0 / pm2-logrotate 3.0.0 全存活；仅 corepack 0.32.0→0.34.6（随 Node 20 deb 自带，shim 性质无影响）。所有 `npm i -g` 装的包（不在 nodejs deb 内）apt 升级均保留。
- **PM2 重建**：`pm2 update` 在 Node 20 下重生 God Daemon（`ecosystem.config.cjs` 不硬编码 interpreter，`node`/`pnpm` 走 PATH，升系统 node 后必须 update 否则 daemon/版本不匹配）。3 服务全 `pm2 update` 后 online。
- **dist 重编**：`backend pnpm build`（tsc+tsc-alias）在 Node 20 下 0 错误重编 dist/，`pm2 restart mt-backend` 加载新 dist。
- **验证（全绿无回归）**：backend **645|1** / frontend **278** / inference 47（inference 是 Python，node 版本无关）；3 服务日志 grep deprecation/punycode/url.parse **0**（Node 20 才暴露 18 下隐藏的 deprecation，实测无）；价值链抽样 `/api/signals/models/accuracy` 200（chronos 三变体 verifiedCount=370、avgMape 1.77–1.92%、lastVerified 当日）；`prediction_logs` 最新 predicted_at 在升级后继续产（13:32）。
- **回滚锚点**（已记录）：`apt-get install nodejs=18.20.8-1nodesource1`；或 sources 切回 `node_18.x` 重装。
- **遗留（独立决策，非本次）**：local pnpm 8.15.0 / lockfile v6.0 vs CI pnpm 9（`ci.yml` `pnpm/action-setup@v4 version: 9`）/ lockfile v9 不一致，无 `packageManager` field 收敛。升 pnpm 会触发 §七.3 store 重写风险，单列轮次。已记入 KNOWN-ISSUES。

**pnpm 8.15.0 → 9.15.9 升级 + lockfile v6→v9 迁移（round-74，2026-08-07，T1 RESOLVED）**——本地 pnpm 对齐 CI（CI 早是 `pnpm/action-setup@v4 version: 9`，本地落后在 8.15.0 / lockfile v6.0）。无源码改动（仅工具链 + 配置 + lockfile）：
- **网络阻塞 + 镜像决策**：corepack 需 fetch pnpm 9 但 **`registry.npmjs.org` 被封**（HTTP 000 超时，与 D1 数据源同模式）。`corepack enable` 曾误把 `/usr/bin/pnpm` 换成 corepack shim（需 fetch，失败致 pnpm 不可用）—— **已干净回滚**（重建 `/usr/bin/pnpm → pnpm 8.15.0` symlink，全服务恢复）。经用户授权（选项"永久切镜像"），`.npmrc` `registry` 从 `registry.npmjs.org` → **`registry.npmmirror.com`**（阿里巴巴中国镜像，0.23s 可达）。corepack 不读 `.npmrc`，用 `COREPACK_NPM_REGISTRY=https://registry.npmmirror.com corepack prepare pnpm@9 --activate` fetch **pnpm 9.15.9** 成功（镜像 latest 9.x = 9.15.9）。
- **packageManager pin + build-scripts gating**：root `package.json` 加 `"packageManager": "pnpm@9.15.9"`（corepack 收敛本地）+ `pnpm.onlyBuiltDependencies`（pnpm 9 默认**不**跑依赖 build 脚本，须显式批准）。Explore agent 全量扫描 `.pnpm`，批准 6 个必需包：`esbuild`/`prisma`/`@prisma/client`/`@prisma/engines`/`sharp`/`msw`。**故意不批准 `@scarf/scarf`**（swagger-ui-dist 传递依赖，postinstall 上报 Scarf.sh 遥测）—— 按隐私/外发默认阻断，Swagger UI 无它正常工作，可逆。`@scarf/scarf` 未列入 onlyBuiltDependencies = 其 build 脚本被 pnpm 9 跳过 = 遥测不触发。
- **lockfile 迁移**：pnpm 9.15.9 读 v6 lockfile 时**自动升级格式**到 v9.0（无需重解析，package.json 未变）；3 处 `pnpm-lock.yaml`（root/backend/frontend）全 `v6.0 → v9.0`。`pnpm install --frozen-lockfile` 自洽校验通过（exit 0）。
- **§七.3 安全**：**全程不跑 `pnpm store prune`**（历史 store 损坏根因）；pnpm 9 沿用 store v3（无 store 迁移）；store 3.6G 保留不动。bcrypt 风险不适用（后端用 `bcryptjs` 纯 JS，非 native `bcrypt`，Explore 确认）。
- **build 脚本产物核实**：prisma 引擎在（`libquery_engine-debian-openssl-3.0.x.so.node` + schema-engine）、esbuild 二进制在（0.21.5 + 0.28.1 linux-x64）、sharp 的 libvips 原生二进制在（linux-x64 + linuxmusl-x64）、`npx prisma generate` 成功生成 client 到 `.pnpm/@prisma+client@...`。
- **重编 + 验证（全绿无回归）**：`pnpm build`（backend tsc+tsc-alias）/ `pnpm build`（frontend next build）在 pnpm 9 下 0 错误重编；3 服务 `pm2 restart` 全 online。backend **645|1** / frontend **278** / inference **47**（Python 无关，确认未受影响）；价值链抽样 chronos 三变体 **382 verified**（avgMape 1.77–1.93%，lastVerified 当日）。
- **CI 对齐**：`ci.yml` `pnpm/action-setup@v4 version: 9` 已与本地 9.15.9 一致；`packageManager` pin 让未来 corepack-enabled CI 自动收敛到 9.15.9（当前 CI 用 action-setup 独立装，未强制 corepack，最小改动不动 CI）。
- **回滚**：`git checkout pnpm-lock.yaml backend/pnpm-lock.yaml frontend/pnpm-lock.yaml .npmrc package.json` + `corepack disable` + 重建 `/usr/bin/pnpm → /usr/lib/node_modules/pnpm/bin/pnpm.cjs`（8.15.0 全局保留未删）。
- **副作用（接受）**：未来所有包 install 元数据经 npmmirror.com（用户已授权"永久切镜像"）。

## 五½、数据层可观测性（round-48~50）

**问题**：`/health/ready` 之前只报 infra（database/redis/inference）全 green，但数据层可能静默失效——18 注册 scraper 仅 2 个在写、103k 预测不可验证、beef_cut_prices 近 14 天 0 行。operator 看到 all-green 实则数据停滞。

**dataHealth service**（`backend/src/services/dataHealth.ts`）：
- 按 source 分组查 `commodity_prices` + `beef_cut_prices` 近 N 天行数 + latestDate（UNION ALL + max() 单次 SQL 往返）。
- 合并 `scraperManager.getHealth()` 的 scraper 报告状态；dormant scraper（0 行）也出现（不掩盖）；非 scraper 写入源（manual import / bridge）标 `not_a_scraper`。
- 预测验证 backlog：completed/verified/stale 计数 + verificationRatio + hasVerificationDebt（<0.05 阈值）。

**三层暴露链路**（让数据停滞可见，而非假装 all-green）：

| 层 | 端点/脚本 | 字段 | 影响 HTTP 状态？ |
|---|---|---|---|
| API | `GET /health/ready` | `checks.dataLayer`（anyDataFlowing/freshSourceCount/registeredSourceCount/predictionBacklog/verified/verificationRatio/hasVerificationDebt） | ❌ 不影响（infra SLA 不变，data 停滞是运营问题，best-effort try/catch） |
| API | `GET /api/market/sources/freshness` | `summary.dataHealth`（同上 + predictionStale） | ❌ |
| 运维 | `cron-healthcheck.sh`（每 5min） | 读 /health/ready 的 dataLayer → anyDataFlowing=false 记 `DATA-STALE`，debt 高记 `DATA-OK but verification debt high`，不重启 | — |

**live 实测差距**（正是要暴露的）：`summary.healthy: 18`（scraper 都跑了）vs `dataHealth.freshSourceCount: 2`（只 2 个真写数据），`verificationRatio: 0.01`。

## 六、代码质量工具

| 工具 | 作用域 | 配置 | CI 强制？ |
|---|---|---|---|
| biome | backend/frontend TS | biome.json（tab, 100 列, noUnusedVariables:error） | ✅ lint job |
| ruff | inference Python | pyproject.toml（py310, 100 列, E/W/F/I/UP） | ✅ test-inference job（round-25） |
| husky + lint-staged | 根级 pre-commit | .husky/pre-commit → biome check --write | 本地 commit 时 |
| knip | backend/frontend | knip.json（已配置，待 zod 兼容后启用） | 未启用 |

## 七、已知限制与待办

1. **本地 coverage 已修复（2026-08-01 实测）**：历史曾因 test-exclude/minimatch 版本冲突 + Next 15 babel-plugin-istanbul 不兼容导致崩溃。round-33（backend 嵌套 override `test-exclude>minimatch`）+ round-36（frontend `coverageProvider:'v8'` + 移除 glob override）已修复。当前实测：**backend 48.92% / frontend 21.46%**，均过各自阈值（backend 45% / frontend 18%）。不盲目 `pnpm install --force`（历史教训：触发 node_modules 损坏）。
2. **knip 本地无法运行**：knip 依赖 zod@4 ESM，本地 zod 解析失败。配置已就位（knip.json + 脚本），CI/未来版本兼容后即可用。
3. **`invalidateCommodityCache` 已接入（round-45）**：原"零调用"的 commodity 缓存失效函数已在 `upsertPrice` 写后 fire-and-forget 接入（SCAN-by-prefix，对称 round-30 的 cut-series）。`unsubscribeCommodity` 仍仅测试用（订阅生命周期内部用，非死代码）。详见 `docs/TECH-DEBT.md`（部分条目已过期，动手前重新核实）。
4. **PAT 凭据管理**：origin remote 仍含 HTTPS + token store（~/.git-credentials）。SSH key 方案已部分配置（~/.ssh/config 走 443），但公钥未加到 GitHub 账户。待用户完成 SSH 接入后可彻底移除 token。
5. **数据采集器 dormant**：MLA + USDA-AMS 需 `MLA_API_KEY`/`USDA_MARS_API_KEY`。无 key 替代方案：admin CSV 上传（`/beef/import`）已就绪。
6. **健康端点路径**：实际为 `/health` 与 `/health/ready`（非 `/api/health`）。`curl localhost:8000/health/ready` 返回 `{database, redis, inference, inferenceDetail:{alive,ready,readyVariants}}`。Chronos 当前 3/3 变体全 ready（详见 `docs/KNOWN-ISSUES.md` R1 已解决记录）。

## 八、部署产物（备选方案）

当前生产用 PM2 直跑。另有完整备选：
- `docker-compose.yml`（5 服务：postgres/redis/backend/frontend/nginx）
- `deploy/docker/Dockerfile.{backend,frontend}`（两阶段构建）
- `deploy/helm/`（k8s：Deployment + HPA + CronJob backup + Ingress + NetworkPolicy）
