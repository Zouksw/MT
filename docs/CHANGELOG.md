---
title: "MT Platform Changelog"
en_title: "MT Platform Changelog"
version: "1.0.0"
last_updated: "2026-07-27"
status: "active"
maintainer: "MT Team"
reviewers:
  - "Release Manager"
  - "Project Maintainer"
tags:
  - "changelog"
  - "release-notes"
  - "version-history"
target_audience: "Developers, Users, Contributors"
related_docs:
  - "Product Spec": "PRODUCT-SPEC.md"
  - "Deployment Guide": "deployment/DEPLOYMENT-CHECKLIST.md"
  - "API Reference": "API.md"
changes:
  - version: "1.0.0"
    date: "2026-03-10"
    author: "MT Team"
    changes: "Added YAML metadata header"
next_review: "2026-09-10"
approval:
  status: "approved"
  reviewed_by: "Release Manager"
  approved_date: "2026-03-10"
---

# Changelog

All notable changes to the MT Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: MT was previously known as "TradeMind AI / IoTDB Enhanced". Historical entries reference the old name. The platform was rebranded to MT (commodity market analytics) in 2026-05.

---

## [Unreleased]

### 2026-08-16 — round-109 预测策略评估（只读，落档 PREDICTION-STRATEGY.md）

实测数据面与模型面后给出最优方案。关键发现：32 个牛肉部位商品 30 个零数据点、beef_cut_prices 仅 30 天冻结快照（2026-04-30）；唯一深而活的牛肉序列是 beef_carcass_us（4,241 点 2014→今，verified MAPE 1.73）；verified 模型排名朴素基线最优（naive 3.45 < ES 3.53 < ARIMA 3.67 < HW 3.73 << STL 10.87）；Chronos 3 变体 ~4,340 条预测 0 条 verified；sarimax 0 条日志（外生管线从未接线，而 FX/饲料/原油数据在库且新鲜）。推荐方案：数据回填为 P0 前置 → 部位价短期用"胴体锚 + 汇率折算 + 部位升贴水"自上而下结构比例（不在 30 天噪声上外推）→ sarimax 外生接线（先在胴体序列回测增量）→ Chronos 重定位为过验证环的 ensemble 成员（naive 为淘汰门槛）→ rolling-origin 分层冠军选择 + split-conformal 校准区间 + 数据不足序列诚实降级。全部兼容预训练约束。

### 2026-08-16 — round-108 体积审计与压缩：/root 12G→9.7G，代码不臃肿、臃肿在制品层

全部源码不足 5M（44 页/20 路由/19 爬虫/31 模型），磁盘大头为依赖镜像/构建缓存/无界日志/工具残留。压缩明细：卸载 venv 内 triton 689M（GPU 编译器，`torch 2.12.1+cpu` 不加载，pytest 60 + 全链 chronos 预测验证）；清 `.next/cache` 412M（`next start` 不读）；清 `.npm` 626M（含 `npx prisma@7` 残留 253M——与项目 prisma 5 大版本漂移，勿用）；Playwright 双浏览器去重 521M→259M（e2e 脚本从硬编码 `_npx` 路径改为经 frontend `@playwright/test` 解析，消除 cron ≥80% 清 `_npx` 时脚本失效的隐患）；backend/logs 215M→10M 并给 winston 加 `maxsize 10M×3` 轮换（原无界且无日期命名，cron 30d 规则匹配不到）；coverage 19M、`git gc` 43M→13M。红线未动：pnpm store 3.6G、HF 权重 879M、backups（keep-7 有界）。三套测试基线不回退（backend 909 / frontend 297 / pytest 60），三服务 live 验证。详见 PROJECT-ASSESSMENT §八、AUTOMATION-STATUS §六½。

### 2026-08-16 — round-107b 前后端打通审计：44 页全扫描，6 处断裂修复（API 错误清零）

以真实浏览器逐页访问全部 44 条路由（新增 `scripts/e2e-page-audit.mjs`，登录态 + 逐页收集 API ≥400/网络失败），并经代理实测全部写路径（登录/登出/apikey/dataset/dataset-import/alert-rule/news 创建全通）。

**发现并修复的断裂（页面↔端点从未对接）：**
- `/timeseries/create` → `POST /api/timeseries` 端点不存在（提交必 404）：后端补建（owner 作用域 + slug 去重 + schema 校验）；成功后跳转从不存在的 show 页改为 edit 页。
- `/apikeys/show/[id]` → 资源名写错（`apikeys` vs `api-keys`）×4 处，且 `GET /:id`、`/:id/usage`、`/:id/regenerate` 端点从未存在：后端补 `GET /:id`（安全字段集，原始 key 永不回传）；keyPreview 改由 lastCharacters 构造；usage/regenerate/copy 等永败按钮移除（诚实降级，TECH-DEBT 记录未实现功能）。
- `/apikeys/edit/[id]` → 保存打在 `PATCH /api/api-keys/:id`（端点不存在）：后端补 PATCH（name/isActive）。
- `/alerts/show/[id]` → `GET /api/alerts/:id` 端点不存在（详情页必 404）：后端补建（owner 作用域，注册在 /stats、/rules 字面路由之后防吞并），返回裸对象匹配 useOne 解包。
- `/settings` + `/settings/profile` → 强制 `Authorization: Bearer null` 头（内存 token 刷新即失）绕过 cookie 回退恒 401、靠 localStorage 缓存兜底：移除强制头（authFetch 自带 token/cookie 双路）。
- `/datasets/show/[id]` → 调不存在的 `/:id/timeseries` 子路由（时序表恒空）+ `/datasets/edit|export` 死按钮：改用 GET /:id 已内嵌的 timeseries 数据；修复 path→slug、datapoints 计数字段名；移除死按钮。

**验证**：44 页 API 错误清零（唯一残留 404 为拿 rule id 探测 alerts 端点的正确行为；真 alert id 实测零错误且字段渲染正确）；新增 12 项集成测试（含双用户越权断言）；backend 897→909、frontend 297 不变。测试数据已清理。遗留（usage 日志/rotate 端点/编辑导出 UI/前端零 WebSocket 消费）记录于 TECH-DEBT。

### 2026-08-16 — round-107 前端视觉精装 + 同源 API 架构修复（7 commits）

以 GitHub 顶级设计（shadcn/ui dashboard、Tremor、Vercel Geist、TradingView、Linear）为参照的视觉升级战役；开工实测发现浏览器端整条数据链路实际断裂，先修架构再精装。

**批 0（架构，前端浏览器会话全线断裂的三层叠加缺陷）**
- `API_BASE` 构建期被 `.env.local` 的 `http://localhost:8000` 内联进产物 → 跨源预检被生产 CORS 守卫 500；默认改同源 `""`（走 Next rewrites/nginx 代理），`NEXT_PUBLIC_API_URL` 仅用于真正的分域部署。
- `.env.production` 占位符 `https://api.your-domain.com`（已停放域名）被烙进 routes-manifest rewrites——经代理的每个 `/api/*` 都拿到停放页 HTML；rewrites 改用服务端 `API_PROXY_TARGET`（默认内部后端）。
- 后端 `authenticate` 中间件只认 Bearer 头——SPA 内存 token 刷新即失，cookie 会话形同虚设（round-104 设计未落地）；补 `auth_token` cookie 回退（与 /auth/verify 同优先级，SameSite=Strict 约束 CSRF 面）。
- CORS 委托模式加同源豁免：浏览器 POST 必带 Origin，经自身入口代理的同源请求此前被跨源白名单误杀（登录/web-vitals POST 500）。
- 验证：干净重构建后客户端 chunks 无旧值残留；浏览器 e2e /dashboard 零 API 错误；新增 Playwright 截图基建 `scripts/ui-screenshots.mjs`。

**批 1-5（视觉，"Refined Industrial" 精装化——方向不变，执行拉满）**
- 机加工卡片（Linear/Geist）：1px 顶部内高光 + 36px 垂直光泽 + 分层接触/环境阴影，token 层实现覆盖 shadcn Card + 旧 CSS 卡片 + Tailwind shadow 工具类。
- 金色环境光：页面顶部 1100px 固定径向金晕（0.10 alpha）——安静的品牌签名；暗色中性色加 0.004 暖色偏置统一于金色调。
- 终端数据排版（TradingView）：KPI/表格/趋势全部 tabular-nums；表头 mono 大写眉标；StatCard 图标芯片化（变体色 @10% 底）；`.eyebrow` 工具类。
- 暗色玻璃图表：网格 #3f3f46→#262626、玻璃 tooltip + 金色标签、`goldGradientStops` 面积渐变——六个消费 chart-config 的 Recharts 组件自动继承；修复 ForecastTrendChart 在暗色页渲染浅色网格/白底 tooltip。
- Hero 品牌时刻："Intelligence, Decoded" 暗色下金渐变（亮金→暗金；浅色保持 AA 安全平色）；bento 卡悬停金环。
- `--panel` 层：侧栏一阶高于页面背景，导航轨读作独立层；`.data-table` 行高 40→44px + tabular-nums。

测试基线：backend 894→897（+3 cookie 鉴权）、frontend 296→297（+1 分域覆盖）、pytest 60 不变；biome 10 预存警告不变。视觉验证：Playwright before/after 六页截图 + 视觉模型评审（hero 6.5→7.5、StatCard 6.5→7.5、环境光 4.5/5）。

### 2026-08-16 — round-106 全项目代码审查：~75 项发现，11 commit 修复（Critical/High/Medium 全清）

四路并行审查（20 路由+7 中间件 / 33 服务 / 前端 44 页 91 组件 7 hooks / 推理服务+测试质量）产出 ~75 项发现；每项亲验后按主题分 10 批修复，遗留低优先级项记录于 `TECH-DEBT.md`。

**真缺陷（功能坏/数据错）**
- 测试基建：裸跑 `pnpm test` 静默指向**生产库 mt_db**（两套件随生产数据漂移变红）；默认改 mt_test + 三处拒绝生产库护栏 + `scripts/bootstrap-test-db.sh`。
- 5 个前端页面因未解 `{success,data}` 信封完全坏掉（alerts 列表恒空、apikeys 一次性密钥渲染空白且不可恢复、profile 恒报加载失败）；alerts/rules 的列表/编辑/启停/删除从未接通（后端补 GET/PATCH/DELETE /api/alerts/rules，userId 作用域）。
- anomaly 检测在真实 uuid 上必崩（`BigInt(uuid)` 500）；多源对比图返回**最旧**数据；`/health/ready` 在 Redis/推理宕机时仍 200。
- IDOR 五路径：任意用户可全库 bulk-resolve 异常、删他人模型预测、按 id 读他人时序点、列表泄露他人 dataset。

**诚实性（8 项）**：模型状态伪造 available→unknown、errorRate 实为慢请求占比→真错误率（记录状态码）、支撑/阻力位无模型时捏造 ±5%→null、演示数据图表/假 sessions 页/死 alert 条件类型/加权中位数偶数偏置/完美 MAPE 误判缺数据。

**性能（5 条热路径）**：watchlist 全表拉取→子查询 rn≤2、freshness 1.9 万行拉内存→SQL groupBy、Redis KEYS×2→SCAN、beef forecasts 无界并行→top20+4 池、refresh-all 循环写→createMany。

**输入校验**：NaN window/负分页/Invalid Date/重复参数 → 500 一律收敛为 400/404/clamp；historyPoints 无上限（500 万行 OOM 向量）；推理服务未排序时间戳→422。

**测试质量**：空转跳过（种子缺失静默绿）改响亮失败；冒烟断言（<500 即过）钉精确契约；TTL 竞态消除。

测试基线：backend 983→894（+1 skip），frontend 296，pytest 58→62。生产迁移：`anomalies.datapoint_id` bigint→text（空表，零风险）。

### 2026-07-27 — 项目整理：AI 全自动开发规范化 + 冗余清理 + 安全

把仓库整理成规范、完整的「AI 全自动开发」项目。**纯文档/配置整理，零业务代码变更。**

**AI 代理文档**
- 新增 `AGENTS.md`（项目根，AI 代理首要入口）：项目定位、核心价值链、规模事实（每项附计数方式）、技术栈、目录约定、命令、不可越线约束、文档导航。
- 重写 `CLAUDE.md`：删除整段失效的 gstack 安装说明与 30+ 不存在的 skill 路由表（实测 gstack 未安装），保留 Coding Guidelines / Dev Server / Health Stack，新增"事实严谨"准则并指向 `AGENTS.md`。

**冗余清理（删 + 提取精华）**
- 删除外挂 git 仓库：`docs/references/awesome-design-md/`（2.0M，含完整 .git）、`archive/`（2.6M，含 taste-skill 完整 .git）。
- 删除 47 份 round/review 流水账报告（`docs/archive/` 29 + `docs/reviews/` 18），先提取精华为 `docs/KNOWN-ISSUES.md`（开放阻塞，每条标来源 + 验证日期）与 `docs/TECH-DEBT.md`（过度工程化清单，每条标审计日期 + 待复核）。
- 合并冲突版本：`PROJECT-STATE-AND-VISION-2026-07-26-v2.md` → `docs/PROJECT-VISION.md`，删除被取代的 v1。
- 删除过时文档：自标 DEPRECATED 的 `ROADMAP.md`、`FRONTEND-IMPROVEMENT-PLAN.md`、`FULLSTACK-PROGRESS-2026-07-27.md`、`CHRONOS-ENSEMBLE-MIGRATION-2026-07-27.md`、基于废弃 ROADMAP 流程的 `developer/DEVELOPMENT-WORKFLOW.md`、7 个第三方 `references/*-design.md`。
- 重写 `docs/INDEX.md`（无死链）；修复 `PRODUCT-SPEC.md` / `CHANGELOG.md` frontmatter 死链。

**README 事实纠错**（数字全部改实测值，附计数方式见 `AGENTS.md` §三）
- 数据源 18 → **19**、Prisma 模型 36 → **31**、前端页面 41 → **44**、后端路由 22 → **20**、统计模型 5 → **6**（补 SARIMAX 行 + Chronos 变体说明）。
- 测试数改为"运行 `pnpm test` 获取当前数"（历史各文档数字互相矛盾，不写死）。
- 数据源表按实际 19 个文件重列（删除不存在的 "USDA FAS"，补 Secex / Shipping Index）。

**安全 + 误提交系统文件清理**
- `git rm --cached`（本地文件保留）：`.gnupg/`（**含 GPG 私钥**，安全重点）、`.rpmdb/`、`.pki/`、`.pip/`、`.profile`、`.wget-hsts`、`snap/`。
- 补 `.gitignore`：`.gnupg/`、`.rpmdb/`、`.pki/`、`.pip/`、`.profile`、`snap/`；清理指向已删内容的死规则。
- `nginx/nginx.conf` 基于事实保留：`docker-compose.yml` 把它挂载为 nginx 容器配置（非废弃文件）。

**验证**：4 个规模数字 + 9 个 model id 经只读命令复现 ✅；导航文件无死链 ✅；零业务代码变更 ✅。全部变更（57 条）在工作区/暂存区，未 commit。

### 2026-07-19 — Project unification refactor (R1-R4)

Four-batch refactor to unify project state: kill redundant tests, fix every
broken route, merge duplicate modules, consolidate docs. Each batch was an
independent commit with full tsc + test + live verification.

**R1 — Test slimming + dead code** (`6c674fc`)
- Deleted 5 tautological/over-mocked test files (EmptyState/PageHeader tests,
  datasets page test that mocked PageHeader then asserted the mock, dashboard
  page test that mocked every child, backend system.test triple-200). Kept all
  CORE security/business-logic tests. Tests 840 → 796.
- Deleted 2 dead-code modules with verified zero importers (useOnlineStatus,
  useRetryableFetch/index.ts barrel).

**R2 — Broken route cleanup** (`07c8534`)
- Removed `/forecasts` (3 pages) — called `GET /api/forecasts` which doesn't
  exist; duplicate of `/ai/predict` per PRODUCT-SPEC. Repointed RecentActivity
  + not-found links to `/ai/predict`.
- Removed `/forgot-password` + `/update-password` + their forms — both POSTed
  to non-existent `/auth/forgot-password` / `/auth/reset-password`. LoginForm
  "Forgot password?" → honest "Planned" disabled span.
- Removed orphan `/anomalies` (nav uses `/ai/anomalies`).
- Kept Forecast Prisma model + forecasts table (live: models.ts writes to it).

**R3 — Duplicate/consistency merge** (`bde0d8e`)
- Unified useDashboardStats fetcher pattern (was: raw useSWR + useRetryableFetch
  mix; now all useRetryableFetch). Tests rewritten to URL-key indexing.
- Merged dialog.tsx (10 granular exports, 0 external consumers) into Modal.tsx.
- Extracted shared ErrorPageContent; error.tsx + global-error.tsx now thin wrappers.
- Moved useTradingData.ts app/trading/ → hooks/ (was violating convention).
- Distinct icons for the 4 AI nav items (was 3× TrendingUp).
- Audit correction: `/ai/models` + `/ai/backtest` NOT duplicates (each hits a
  real backend), kept. ErrorBoundaryWrapper NOT redundant (server/client boundary
  boilerplate), kept.

**R4 — Docs** (this commit)
- Deprecated stale ROADMAP.md (pre-repositioning 2026-07-06 numbers; superseded
  by PRODUCT-SPEC). Added deprecation banner.
- Updated INDEX.md to point at PRODUCT-SPEC as single source of truth.
- Updated known-issues doc with R1-R4 status + audit-correction log.

### Removed - Docker Dependency Removal

- **Deleted Docker files** - Removed all Docker configuration
  - `docker-compose.yml` - Replaced by native services (PostgreSQL, Redis) + PM2
  - `backend/Dockerfile` - Backend runs via PM2 directly
  - `frontend/Dockerfile` - Frontend runs via PM2 directly
  - `.docker/` directory - Docker buildx cache no longer needed
- **Updated CI/CD Pipeline** - Replaced Docker-based steps
  - Replaced Docker service containers with native PostgreSQL/Redis installation
  - Replaced Docker image build/push with native build + artifact upload
  - Replaced Docker pull deployment with PM2-based SSH deployment
- **Updated Health Check Script** - Replaced Docker container check with PM2 service check
- **Updated Backup Script** - Replaced `docker-compose.yml` backup with `ecosystem.config.cjs`

> **Why**: Server environment cannot access Docker registries. All services (PostgreSQL, Redis, backend, frontend) run natively via systemd + PM2.

---

## [1.3.0] - 2026-03-21

### Added - Phase 3.1: Observability & Monitoring

#### Prometheus Metrics
- **Metrics Endpoint** - `/metrics` endpoint for Prometheus scraping
  - Available in both production and development modes
  - Exposes system and application metrics
- **HTTP Metrics** - Request tracking with labels
  - Request counter (by method, route, status)
  - Response time histogram (by method, route)
  - Active requests gauge
- **Database Metrics** - PostgreSQL query tracking via Prisma middleware
  - Query counter (by operation, model)
  - Query duration histogram
  - 10% sampling to minimize performance impact
- **Cache Metrics** - Redis cache performance
  - Cache hit counter (by provider)
  - Cache miss counter (by provider)
- **IoTDB Metrics** - Time-series database operations
  - Query counter (by type: select, insert, error)
  - Query duration histogram
  - Data point counter (by series)
- **AI Metrics** - AI model operations
  - Prediction counter (by algorithm, type)
  - Prediction duration histogram
  - Anomaly detection counter
- **Alert Metrics** - Alert system monitoring
  - Alert triggered counter (by severity, type)
  - Alert resolved counter
- **Session Metrics** - Active user sessions
  - 1% sampling for efficiency
  - 15-minute active window tracking

#### Grafana Dashboards
- **Overview Dashboard** - Complete monitoring dashboard
  - Request rate and error rate panels
  - Response time distribution (P50, P95, P99)
  - Active user sessions gauge
  - Database query performance
  - Cache hit/miss ratio
  - IoTDB query metrics
  - AI prediction metrics
  - Alert status overview
- **Automatic Provisioning** - Zero-setup Grafana deployment
  - Datasource provisioning (Prometheus)
  - Dashboard provisioning (auto-import)
  - Configuration in `grafana/provisioning/`

#### AlertManager
- **Email Notifications** - Alert routing via email
  - SMTP configuration support
  - Alert grouping and deduplication
  - Configurable notification templates
- **Alert Rules** - Pre-configured Prometheus alert rules
  - High error rate alerts (>5% for 5 minutes)
  - Slow API response alerts (>1s for 5 minutes)
  - Database connection loss alerts
  - IoTDB connection failure alerts
  - AI model failure alerts
  - High memory usage alerts (>80% for 10 minutes)

#### Systemd Services (Docker-Free Deployment)
- **Service Units** - Complete systemd service configuration
  - `iotdb-postgres.service` - PostgreSQL database
  - `iotdb-redis.service` - Redis cache
  - `iotdb-backend.service` - Backend API (PM2)
  - `iotdb-frontend.service` - Frontend (PM2)
  - `prometheus.service` - Metrics collection
  - `alertmanager.service` - Alert routing
- **Management Scripts** - Easy service management
  - `scripts/systemd/start-all-services.sh` - Start all services in order
  - `scripts/systemd/stop-all-services.sh` - Stop in reverse order
  - `scripts/systemd/check-services.sh` - Status monitoring
- **Automatic Features**
  - Auto-start on boot
  - Auto-restart on failure
  - Centralized logging (journald)
  - Service dependency management
- **Log Rotation** - Automated log management
  - Daily rotation with 14-day retention
  - Compression enabled
  - PM2 reload on rotation
- **Backup Integration** - Cron-based automated backups
  - Daily PostgreSQL backups (2 AM)
  - Weekly full backups
  - Hourly Redis saves
  - Daily Redis backups

#### Documentation
- **Observability Design** - `docs/observability-design.md`
  - Complete system architecture
  - Component designs
  - Implementation phases (3.1-3.4)
  - 1044 lines of detailed planning
- **Systemd Services Guide** - `docs/systemd-services.md`
  - Service configuration reference
  - Management scripts documentation
  - Log management setup
  - Backup integration guide
  - Migration guide from Docker
- **Monitoring Deployment** - `docs/monitoring-deployment-no-docker.md`
  - Binary installation guide
  - Systemd service setup
  - Configuration management
  - Troubleshooting section

### Changed
- **server.ts** - Enable metrics endpoint in development mode
- **database.ts** - Add Prisma middleware for query metrics
- **auth.ts** - Add active session tracking (1% sampling)
- **cache.ts** - Add cache hit/miss metrics (10% sampling)
- **iotdb/client.ts** - Add query and datapoint metrics
- **routes/iotdb.ts** - Add AI prediction metrics
- **services/alert-rules.ts** - Add alert triggered metrics
- **services/alerts.ts** - Add alert resolved metrics

### Performance
- **Sampling Strategy** - 10% sampling for most metrics to minimize performance impact
- **Active Sessions** - 1% sampling for session counting
- **Prisma Middleware** - Efficient query instrumentation

---

## [1.2.0] - 2026-03-04

### Added - Phase 3: AI 功能启用与安全隔离

#### AI 功能
- **AI 预测分析** - 时序数据预测，支持多种算法
  - ARIMA (AutoRegressive Integrated Moving Average)
  - LSTM (timer_xl - Long Short-Term Memory)
  - Transformer (sundial)
  - Holt-Winters 三次指数平滑
  - 指数平滑 (exponential_smoothing)
  - 朴素预测 (naive_forecaster)
  - STL 分解预测 (stl_forecaster)
- **异常检测** - 智能时序数据异常识别
  - 支持多种检测方法 (isolation_forest, sr, pca)
  - 可配置阈值参数
- **批量预测** - 多时间序列批量预测接口
- **模型管理** - 模型列表、详情查看、训练接口
  - 列出可用模型及其参数
  - 查看模型详细信息
  - 模型训练接口

#### 安全隔离 (进程隔离替代 Docker)
- **进程隔离执行** - 使用 Linux 原生功能实现隔离
  - `prlimit` - 资源限制（内存、CPU、文件描述符、进程数）
  - `su ai-executor` - 低权限用户执行
  - 临时脚本文件（自动清理、只读权限）
- **AI 专用用户** - 创建 `ai-executor` 用户运行 AI 脚本
  - UID: 998
  - 无法访问其他用户文件
  - 无 shell 登录权限
- **资源限制**
  - 内存限制: 512M
  - CPU 时间限制: 60 秒
  - 文件描述符限制: 1024
  - 进程数限制: 64
  - 执行超时: 120 秒
- **环境隔离**
  - 清理敏感环境变量（DATABASE_URL、POSTGRES_PASSWORD 等）
  - 临时脚本目录: `/tmp/ai-scripts`
  - AI Node 虚拟环境: `/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/venv`

#### 多层安全防护
- **特性开关** - `AI_FEATURES_DISABLED` 环境变量控制
  - 默认值: `false` (已启用)
  - 可快速禁用所有 AI 功能
- **角色权限检查** - 仅管理员可访问
  - 中间件: `checkAIAccess`
  - 非 ADMIN 角色返回 403 Forbidden
- **IP 白名单** - 可选的 IP 访问限制
  - 环境变量: `AI_ACCESS_WHITELIST`
  - 支持多个 IP（逗号分隔）
  - 支持 CIDR 格式
- **审计日志** - 所有 AI 操作记录
  - 用户、时间戳、操作类型、参数
  - 存储位置: 后端日志
- **速率限制** - AI API 调用速率限制
  - 默认: 10 次/分钟
  - 基于 Redis 存储

#### 脚本优化整理
- **脚本精简** - 从 14 个减少到 11 个核心脚本
  - 删除冗余脚本: `status.sh`、`scripts/check-services.sh`、`frontend/start-dev.sh`
  - 保留核心脚本: 3 个根目录 + 8 个 scripts 目录
- **新增脚本**: `check.sh` - 快速状态检查
  - 替代 `status.sh` 功能
  - 彩色输出，简洁快速
- **脚本增强**:
  - `start.sh` - 超时保护、路径检测、服务降级
  - `stop.sh` - 目录检查、优雅关闭

#### 文档新增
- **RUNNING_MODES.md** - 运行模式完整指南
  - 开发模式 - 热重载、TypeScript 直接执行
  - 生产模式 - 集群模式、多核并行
  - 预发布模式 - 上线前验证
  - 性能对比表、切换指南、故障排查
- **SCRIPTS_GUIDE.md** - 脚本完整使用指南
  - 核心脚本详解
  - 维护脚本使用
  - PM2 命令参考
  - AI 功能测试
- **SCRIPTS_INDEX.md** - 脚本快速索引
  - 11 个脚本分类汇总
  - 使用场景说明
  - 依赖关系图
  - 快速参考表

### Changed
- **版本升级** - 1.1.0 → 1.2.0
- **AI 功能状态** - 从"默认禁用"改为"安全隔离启用"
- **脚本引用** - `./status.sh` → `./check.sh`
- **README.md** - 添加 Phase 3 内容和新文档链接
- **运行模式** - 支持通过 `APP_MODE` 环境变量切换

### Security Improvements
- **进程隔离** - 使用 `prlimit` + `su` 替代 Docker 实现隔离
- **权限控制** - AI 功能仅限管理员访问
- **资源保护** - 防止 AI 脚本耗尽系统资源
- **审计追踪** - 所有 AI 操作记录日志

### Modified Files
#### Backend
- `backend/src/services/iotdb/ai-isolated.ts` - **新建** 隔离 AI 服务
- `backend/src/middleware/aiAccess.ts` - **新建** AI 权限中间件
- `backend/src/routes/iotdb.ts` - 添加 AI 路由和认证中间件
- `backend/src/routes/models.ts` - 添加 AI 权限检查
- `backend/.env` - AI 配置环境变量

#### Scripts
- `start.sh` - 超时保护、路径检测、服务降级
- `stop.sh` - 目录检查、优雅关闭
- `check.sh` - **新建** 快速状态检查

#### Documentation
- `README.md` - 版本升级、Phase 3 内容、新文档链接
- `docs/RUNNING_MODES.md` - **新建** 运行模式详解
- `docs/SCRIPTS_GUIDE.md` - **新建** 脚本使用指南
- `docs/SCRIPTS_INDEX.md` - **新建** 脚本索引
- `CHANGELOG.md` - 添加本版本变更记录

### Deleted Files
- `status.sh` - 功能重复（已被 check.sh 替代）
- `scripts/check-services.sh` - 功能重复
- `frontend/start-dev.sh` - 已整合到 start.sh

### Upgrade Guide from 1.1.0 to 1.2.0

#### 1. 创建 AI 执行用户
```bash
# 创建专用低权限用户
sudo useradd -r -s /bin/false -d /var/lib/ai-executor ai-executor

# 创建临时脚本目录
sudo mkdir -p /tmp/ai-scripts
sudo chown $USER:$USER /tmp/ai-scripts
sudo chmod 700 /tmp/ai-scripts
```

#### 2. 安装必要工具
```bash
# 检查 prlimit 是否可用
which prlimit || sudo apt-get install util-linux
```

#### 3. 更新环境变量
编辑 `backend/.env`:
```bash
# 启用 AI 功能
AI_FEATURES_DISABLED=false
IOTDB_AI_ENABLED=true

# AI Node 配置
AI_NODE_HOME=/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
AI_NODE_HOST=127.0.0.1
AI_NODE_PORT=10810

# 资源限制
AI_MAX_MEMORY=512M
AI_MAX_CPU_TIME=60
AI_TIMEOUT=120

# 可选：IP 白名单
# AI_ACCESS_WHITELIST=127.0.0.1,10.0.0.0/8
```

#### 4. 更新脚本
```bash
# 删除旧脚本
rm -f status.sh scripts/check-services.sh frontend/start-dev.sh

# 使用新脚本
./check.sh  # 替代 ./status.sh
```

#### 5. 重启服务
```bash
./stop.sh
./start.sh
```

#### 6. 验证 AI 功能
```bash
# 检查 AI Node 是否运行
nc -z localhost 10810 && echo "AI Node OK"

# 测试预测 API（需要管理员权限）
curl -X POST http://localhost:8000/api/iotdb/ai/predict \
  -H "Content-Type: application/json" \
  -d '{"timeseries": "root.test1", "horizon": 5, "algorithm": "arima"}'
```

---

## [1.1.0] - 2026-03-04

### Added - Phase 1 (Infrastructure)
- **Testing Framework**
  - Jest test suite with 169 tests across 9 test suites
  - Test coverage reporting with Istanbul/nyc
  - Supertest for API endpoint testing
  - Faker.js for test data generation

- **Error Tracking**
  - Sentry integration for error tracking
  - Performance monitoring with profiling
  - Sensitive data filtering (passwords, tokens, cookies)
  - API request performance tracking

- **Automated Backups**
  - PostgreSQL database backup with verification
  - Configuration file backup
  - IoTDB metadata backup
  - S3 upload support with AWS CLI
  - Telegram notification support
  - Automatic cleanup based on retention policy

- **Log Rotation**
  - Application log rotation (14-day retention)
  - PM2 log rotation (7-day retention)
  - Nginx log rotation (30-day retention)
  - Docker log rotation (7-day retention)
  - Automatic compression with delaycompress

### Added - Phase 2 (Performance & Automation)
- **Database Optimization**
  - Automated VACUUM ANALYZE
  - Automatic index creation and verification
  - Query performance analysis
  - Automatic cleanup of expired data (90-day retention)
  - Optimization report generation

- **Redis Connection Pool**
  - Connection pooling with automatic reconnection
  - Health checks with ping
  - Connection statistics and monitoring
  - Graceful shutdown handling
  - Error handling and retry strategy

- **API Response Caching**
  - Redis-backed HTTP response caching
  - Configurable TTL (60s default, 300s long, 10s short)
  - Smart cache key generation (path, query, headers, user)
  - Cache statistics (hit rate tracking)
  - Cache invalidation by pattern

- **CI/CD Pipeline**
  - GitHub Actions workflow for automated testing
  - Security vulnerability scanning (npm audit, Snyk)
  - ESLint and TypeScript type checking
  - Docker image building and pushing
  - Automated deployment on main branch
  - Automatic rollback on deployment failure
  - Slack/Sentry notification integration

- **Zero-Downtime Deployment**
  - Blue-green deployment pattern
  - Health checks before traffic switch
  - Nginx upstream configuration update
  - Automatic rollback on failure
  - Deployment rollback script

- **Performance Monitoring**
  - Request/response time tracking (P50, P95, P99)
  - CPU, memory, disk usage monitoring
  - Custom metrics collection
  - Alert thresholds (CPU >80%, Memory >80%, Disk >80%)
  - Telegram/Sentry alert integration
  - Express middleware for automatic tracking

### Security Improvements
- **SQL Injection Prevention**
  - Input validation for all IoTDB paths and parameters
  - Dangerous pattern detection
  - Whitelist-based validation for device names, measurements, data types
  - Production credential check for IoTDB (disallows root/root)

- **Token Storage Security**
  - Removed localStorage token usage
  - HttpOnly cookie-only token storage
  - Updated all frontend pages to use authFetch utility

- **CSRF Protection**
  - Backend already has complete CSRF implementation
  - Removed localStorage fallback from csrf.ts
  - Double-submit cookie pattern with Redis

- **AI Service Security**
  - AI features disabled by default
  - Environment variable `AI_FEATURES_DISABLED=true`
  - Graceful 503 response when accessing disabled endpoints

### Changed
- Updated multer from 2.0.2 to 2.1.0 (security fix)
- Created ErrorBoundary component for React error handling
- Added new error class: ServiceUnavailableError
- All 169 tests passing

### Fixed
- Fixed test suite failures by creating authLockout service module
- Fixed TypeScript type errors in new modules
- Fixed import paths for new utility modules

---

## [1.0.0] - 2026-03-03

### Added
- Initial release of MT Platform
- Apache IoTDB 2.0.5 integration
- AI-powered time series prediction and anomaly detection
- RESTful API with Swagger documentation
- Next.js 14 frontend with Ant Design
- PostgreSQL + Redis data storage
- JWT authentication with HttpOnly cookies
- Rate limiting with Redis
- CSRF protection
- API key management
- Alert system with multi-channel notifications
- User management and authorization
- Docker containerization
- Nginx reverse proxy configuration
- PM2 process management
- Comprehensive documentation

### Security Features
- HttpOnly cookies for JWT tokens
- CSRF token validation
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- Input validation with Zod
- SQL injection prevention (basic)

---

## [Unreleased]

### Removed - Documentation & Code Cleanup (2026-03-21)

#### Security Improvements
- **Deleted security-critical file** - `.secrets.tmp` contained plaintext secrets
  - Removed JWT secrets, database credentials, and passwords from disk
  - Eliminated security vulnerability from temporary plaintext file

#### Documentation Cleanup
- **Removed phase completion reports** (6 files, ~32KB)
  - `.phase1-completed.md`, `.phase1.5-completed.md`, `.phase1-final-summary.md`
  - `.phase1-security-summary.md`, `.phase2-completed.md`, `.final-completion-summary.md`
  - Superseded by current documentation and CHANGELOG.md
- **Cleaned archive documentation** (10 files, ~128KB)
  - Removed historical review documents from `docs/archive/reviews/`
  - Old testing reports, code quality reviews, and evaluations
  - Information now reflected in current codebase and documentation

#### Backup Cleanup
- **Removed old backup files** (6 files, ~20KB)
  - `backend/.env.backup-20260321-004458` - superseded by GPG encryption
  - 5 old `.claude.json.backup.*` files from previous configurations
  - Current backup system is sufficient

#### Results
- **Total files removed**: 17+ files
- **Space recovered**: ~180KB
- **Security improved**: Removed plaintext secrets exposure
- **Documentation clarified**: Eliminated duplicate and obsolete files
- **Project structure cleaner**: Only current, relevant documentation remains

### Added - Project Structure Cleanup (2026-03-21)

#### Developer Experience
- **ESLint Configuration** - Code quality linting for backend and frontend
  - TypeScript-aware linting rules
  - Auto-fix capabilities with `npm run lint:fix`
  - Custom rules for project standards
- **Prettier Configuration** - Consistent code formatting
  - Shared configuration for backend and frontend
  - 100 character line width
  - Single quotes, trailing commas
  - Format scripts: `npm run format`
- **Pre-commit Hooks** - Automated code quality checks
  - Husky + lint-staged integration
  - Runs ESLint and Prettier on staged files
  - Blocks commits with failing checks
- **Comprehensive Documentation** - Developer onboarding resources
  - CONTRIBUTING.md - Contribution guidelines and workflow
  - docs/DEVELOPER_GUIDE.md - Comprehensive developer guide
  - Architecture overview and project structure
  - Common tasks and debugging guides

#### Project Organization
- **Centralized Configuration** - `/config/` directory for all config templates
  - `backend.env.example` - Backend environment template
  - `frontend.env.example` - Frontend environment template
  - `.env.production.template` - Production environment template
  - Symlinks for backward compatibility
- **Cleaned Directory Structure** - Removed duplicate and obsolete files
  - Removed duplicate `/root/` project directory
  - Cleaned up 4+ Claude worktrees (~10MB storage recovered)
  - Removed 9 unused dependencies across projects

#### Dependency Management
- **Removed Unused Dependencies**
  - Backend: multer, qrcode, node-fetch, sqlstring
  - Frontend: dompurify, html2canvas
  - Root: swagger-jsdoc, swagger-ui-express, bcrypt, jsonwebtoken
- **Resolved Duplicate Dependencies**
  - Removed jsonwebtoken from root (kept in backend)
  - Removed bcrypt from root (using bcryptjs in backend)
- **Security Fixes**
  - Fixed minimatch vulnerability (GHSA-23c5-xmqv-rm74)
  - Applied pnpm override for minimatch >=3.1.4

#### Code Quality Scripts
```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Run tests
npm test
```

### Changed - Breaking Changes (2026-03-19)

#### Configuration Changes
- **Default port changed from 8002 to 8000**
  - Backend API now runs on port 8000 by default (was 8002)
  - Update your `PORT` environment variable if you relied on the old default
  - Nginx reverse proxy configuration updated to use port 8000
  - This aligns with common API port conventions

#### CI/CD Consolidation
- **GitHub workflows consolidated** from 3 files to 1
  - Merged `deploy.yml`, `security.yml`, and `test.yml` into `ci.yml`
  - All functionality preserved with improved organization
  - Automated testing, security scanning, and deployment in one pipeline

#### Documentation Cleanup
- Removed redundant `docs/SECURITY_SETUP.md` - content now in `docs/SECURITY.md`
- Removed archive documentation that was superseded by current docs

### Added - Test Coverage Improvements (2026-03-13)
- **Core Infrastructure Tests**
  - Error Handler Utilities - 100% coverage (36 tests)
  - JWT Library - 93.33% coverage (56 tests)
  - Response Utilities - 100% coverage (58 tests)
  - Logging Middleware - 100% coverage (64 tests)
  - Security Middleware - 97.46% coverage (74 tests)
  - Cache Middleware - 83.52% coverage (56 tests)
  - AI Access Middleware - 82.75% coverage (21 tests)

- **Test Statistics**
  - Total Tests: 575 (from 527, +48 tests)
  - Overall Coverage: 34.46% (from 31.26%, +3.20%)
  - Middleware Coverage: 61.2% (from 46.52%, +14.68%)
  - Project Score: 8.8/10 (from 8.7/10)

### Changed
- Updated documentation with latest test statistics
- README.md test badge updated to 575 tests
- Moved detailed test reports to archive:
  - `docs/archive/reviews/COMPREHENSIVE_TESTING_REPORT.md`
  - `docs/archive/reviews/TEST_IMPROVEMENTS.md`

### Planned - Phase 4 (Future)
- Advanced analytics dashboard
- Distributed tracing with OpenTelemetry
- Advanced caching strategies (cache warming, stale-while-revalidate)
- Kubernetes deployment manifests
- Horizontal Pod Autoscaler configuration
- Multi-region deployment support
- Advanced security features (2FA, SSO)
- Real-time WebSocket updates
- Data export and reporting
- Custom alert rules engine
- API rate limiting per user
- Request queue management
- Database query optimization
- ElasticSearch integration for log aggregation
- Grafana dashboards
- Prometheus metrics endpoint

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

1. **Update dependencies**:
   ```bash
   cd backend && pnpm install
   cd frontend && pnpm install
   ```

2. **Add new environment variables** (optional):
   ```bash
   # AI Features (disabled by default)
   AI_FEATURES_DISABLED=true

   # Sentry (optional)
   SENTRY_DSN=your-dsn
   SENTRY_ENVIRONMENT=production
   ```

3. **Update IoTDB credentials** (required):
   - Change default `root/root` credentials in production
   - The server will now refuse to start with default credentials in production mode

4. **Run database optimization**:
   ```bash
   ./scripts/optimize-database.sh
   ```

5. **Set up automated backups**:
   ```bash
   crontab -e
   # Add: 0 2 * * * /root/scripts/auto-backup.sh
   ```

6. **Enable monitoring** (optional):
   ```bash
   ./scripts/monitoring.sh --daemon
   ```

---

[1.2.0]: https://github.com/Zouksw/MT/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Zouksw/MT/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Zouksw/MT/releases/tag/v1.0.0
