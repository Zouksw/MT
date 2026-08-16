# Tech Debt — 过度工程化与冗余清单

> 本文件从 `archive/2026-07-06-overengineering-audit.md`（全栈体检，2026-07-06）提取，
> 并补充 round 报告中的待重构项。**审计距今较久，代码可能已部分清理——动手前务必重新核实每条。**
> 每条标注**审计日期**与**当时证据**。重新核实后若已不存在，请标注"已清理（日期）"。

---

## 总体结论（审计当时）

> 项目整体规模合理（backend ~18.7k LOC / frontend ~30.3k LOC / inference ~366 LOC），
> 核心价值链（signals/prediction/inference/beef）实现扎实。
> 问题集中在"企业级脚手架超前于实际需求"：为单租户搭了多租户、为静态套餐搭了 Stripe 形状、
> 为单进程调度搭了 BullMQ 队列、为少量组件配了 Storybook 全套。

**审计当时可量化冗余**：后端 ~600+ LOC 死代码；前端 ~10 死文件 + 205 行死 MSW + 3 套并行 fetcher；schema 3 个死/伪模型；5 个业务功能有完整代码但 0 实际用途。

> ⚠️ 上述规模数字（18.7k/30.3k/32 模型/20 爬虫）是审计当时的统计；与本次（2026-07-27）实测（31 模型/19 爬虫）有出入，说明部分清理已发生。下面条目的具体文件/行号请按"待复核"对待。

---

## 一、后端

### TD-1 — BullMQ 队列：完整初始化，永不被喂活（YAGNI）
**审计**：2026-07-06，`archive/2026-07-06-overengineering-audit.md` §2.1
**当时证据**：
- `server.ts:133` 调 `initPredictionQueue()` 起 BullMQ Queue + Worker
- `predictionQueue.ts` 导出 4 个入队函数（`schedulePrediction`/`scheduleCorrelation`/`scheduleRecurringPredictions`/`cancelRecurringPredictions`），production caller = 0（`schedulePrediction` 的 2 个 grep 命中实为 `schedulePredictionsFromPostgreSQL` 同名前缀误匹配）
- Worker job body 调 `runAndCachePrediction`，与 `predictionCache.ts` 的 `setInterval` 调同一函数
**实际生产调度路径**：`server.ts:142` → `predictionCache.schedulePredictionsFromPostgreSQL()` → 进程内 `setInterval`（30min）。BullMQ 是并行存在的第二套调度，永不触发。
**当时规模**：237 LOC + 1 依赖（bullmq）
**回收**：删 `predictionQueue.ts` + `server.ts:133` 调用 + 考虑卸 `bullmq`。**前提**：确认无分布式预测计划。

**已清理（2026-07-27 复核）**：`predictionQueue.ts` 已不存在，`server.ts` 无 `initPredictionQueue()` 调用，`bullmq` 不在 backend/package.json 依赖中。本条 STALE。

### TD-2 — 多租户：为单租户产品搭的组织层
**审计**：2026-07-06，§2.2
**当时证据**：`schema.prisma` 定义 `organizations` + `organization_members`；`organization_members` 0 代码引用；`organizations` 仅 `datasetService.ts:105` 一处硬编码 `id: "default-org-id"`，无真正租户隔离；DB 实测 organizations 行数极少。
**回收**：删 `organization_members` 表；`organizations` 要么删要么把 `Dataset.organization_id` 改可选。

**复核（2026-07-27）**：`organization_members` 已删（schema 无此 model，0 引用）。`organizations` 仍存在（`schema.prisma:307`），仅 1 生产引用：`datasetService.ts:103` `prisma.organizations.upsert`（default org）。删除需 schema 迁移，单列轮次。

### TD-3 — API Key 系统：发得出、验不了
**审计**：2026-07-06，§2.3
**当时证据**：`apiKeys.ts:16` 生成 `iotd_` 前缀 key，`apiKeys.ts:123` 导出 `validateApiKey()`，但 `validateApiKey` caller = 0；`middleware/auth.ts:30` 只认 `Bearer ` JWT，无任何中间件读 API key header。路由能 create/list/revoke，但发出的 key 不能认证任何端点。
**注**：`archive/2026-07-06-round-17-19.md` P1-7 复核时认为 `validateApiKey` 是"未接入的 future infra"而非废弃——措辞较温和。性质判断视产品方向而定。

**已解决（round-69，2026-08-03，commit 6f6cf5a）**：`validateApiKey` 接入 `authenticate` 中间件——头约定 `x-api-key: iotd_xxx`（专用头，与 JWT 的 `Authorization: Bearer` 物理分离）。`auth.ts` 在函数开头加短路分支：有 `x-api-key` 头 → 调 `validateApiKey` → 命中填 `req.userId`/`req.user`（同 shape）+ `next()`；未命中 401。JWT 路径完全不动。key 安全侧（bcrypt 哈希存储、isActive 吊销、过期）已就绪，本 Round 未动。`validateApiKey` 从 0 caller → 被 `authenticate` 调用，`usageCount`/`lastUsedAt` 开始真实写入。live 实测：JWT 仍 200；x-api-key 认证 200 + usageCount=2 + lastUsedAt 写入；吊销/失效 key → 401。+3 测试（mutation-verified）。docs/API.md 加 `### API Key Authentication` 段，前端 apikeys 页加 `x-api-key` 头使用提示。**TD-3 RESOLVED。**

### TD-4 — cache.ts 死函数
**审计**：2026-07-06，§3.4
**当时证据**：`services/cache.ts`（244 LOC）15 导出中 8 个 0 caller（`initCache`/`closeCache`/`delPattern`/`flushCache`/`getCacheStats`/`invalidatePattern`/`mget`/`mset` + 泛型 `cache<T>()` 装饰器）。实际用的就 `get/set/del/exists/incr/expire/cacheKeys`，几乎全被 `predictionCache.ts` 消费。

**已清理（2026-07-27 复核）**：cache.ts 已精简到 3 导出（`get`/`set`/`cacheKeys`），文件头注释明确 admin ops 已移除。9 个死函数全部删除。本条 STALE。

### TD-5 — 三套 AuthRequest 类型
**审计**：2026-07-06，§3.3
**当时证据**：`middleware/auth.ts:5` `AuthRequest`（userId optional）、`middleware/auth.ts:16` `AuthenticatedRequest`（userId required）、`types/index.ts:67` 第三份（shape 又不同）。119 处引用，8 个路由用 optional 旧版被迫写 `if(!req.userId) throw` 防御样板。第三个定义是纯重复。

**部分清理（2026-07-27 复核）**：`types/index.ts` 第三份重复已删（仅留 NOTE 注释）。剩 2 个**有意**变体在 `middleware/auth.ts`：`AuthRequest`（userId optional，未认证路由用）+ `AuthenticatedRequest`（userId required，`authenticate` 后保证）。两变体共存是设计意图，非重复。本条基本 STALE。

### TD-6 — 3 个无 service 层的胖路由（待重构）
**审计**：2026-07-12，`reviews/2026-07-12-round-29.md` 后续
**当时证据**：ROADMAP C2 主线"胖路由抽 service"已完成 watchlist（17→0 处 `prisma.` 直连）。剩余 3 个按 `prisma.` 直连数排序：
- `beef.ts`（15）
- `portfolios.ts`（15）
- `timeseries.ts`（10）

### TD-7 — riskMetrics.ts 死文件
**审计**：2026-07-06，§3.2
**当时证据**：importer 计数 = 0。

**已清理（2026-07-27 复核）**：`riskMetrics.ts` 已不存在，全仓无 `riskMetrics` 引用。本条 STALE。

---

## 二、前端

### TD-8 — 3 套并行数据获取系统 + axios 单点依赖
**审计**：2026-07-06，§3.1；**2026-08-01 复核**
**当时证据**：`lib/api.ts`（SWR，14 文件）、`utils/auth.ts`（authFetch，16 文件）、`lib/market-data.ts`（**axios**，唯一用 axios 的文件，3 文件）、页面内联 `useCallback(fetch)`（~13）、`beefFetcher` **3 份字面复制**（`beef/page.tsx:13` / `beef/factories/page.tsx:10` / `beef/cuts/[cutCode]/page.tsx:11` 逐字节相同）。35 处裸 `fetch()` vs 14 处 SWR 抽象。

**复核（2026-08-01）**：
- **beefFetcher 复制已清理** ✅：单一定义 `lib/beef.ts:14`，5 文件 import（不再字面复制）。本子条 STALE。
- **仍存**：axios 单点依赖——`lib/market-data.ts:3` 是唯一用 axios 的文件（`package.json` 仍列 axios 依赖）。
- **仍存**：**46 处裸 `fetch()`**（跨 26 文件，如 `useTradingData.ts` 7 处、`settings/data-sources/page.tsx` 6 处）vs 10 SWR / 8 `useRetryableFetch`。标准已立（`useRetryableFetch`）但迁移未完。
- **`useRetryableFetch`** 是推荐的统一抽象（8 consumer：beef 页/hook + dashboard + MarketForecastBoard），是收敛方向。

**复核（2026-08-10，round-94 实测修正）**：
- **axios 子条 RESOLVED** ✅（见 round-68 补充），`package.json` 0 axios 引用。
- **裸 `fetch()` 实测 39 处**（非先前文档的 46；`grep -rn "await fetch(" frontend/src/ | grep -v __tests__`）。主要在：`useTradingData.ts`(6)、`dashboard/performance`(4)、`settings/data-sources`(3)。其中多数是对自研 API 的一次性 callback fetch（非 SWR 缓存读），迁移到 `swrFetcher`/`useRetryableFetch` 是重构而非机械替换——**列为低优先，不阻塞价值链**。
- **swrFetcher 已立**（round-91，`lib/swrFetcher.ts`）：统一 `lib/api.ts` + `lib/market-data.ts` 两个并行 SWR fetcher。后续收敛前端 39 处的方向是 swrFetcher，但需逐页评估（部分是 POST/mutation，不适合 SWR）。
- **注意区分**：backend 28 处 `await fetch()` 中 25 处是 19 个 scraper 的**合法外部 HTTP 出站**（worldBank/mla/fao/cme 等），不是 API client 一致性问题，不应迁移。

**round-68 补充（2026-08-03，axios 单点根治）**：`lib/market-data.ts` 的 fetcher 从 axios 迁到原生 fetch（对齐 `utils/auth.ts:authFetch` 范式：`credentials:"include"` + bearer header + non-2xx throw 保持 SWR 错词语义）。`package.json` 删 axios 依赖 + `pnpm-lock.yaml` 同步（-axios + 2 transitive）。commit 12aca10。LoginForm.test.tsx 的 vestigial `jest.mock("axios")` 一并删（axios 不再在 module graph）。**axios 子条 RESOLVED**——node_modules + lockfile 0 引用，frontend tsc clean + 278 tests 不变，live 渲染 HTTP 200。裸 `fetch()` 收敛到 `useRetryableFetch` 仍开（46 处，跨文件大改动，单列）。

### TD-9 — 死 ui 组件 + shadcn 重复对
**审计**：2026-07-06，§5
**当时证据**：死 ui 组件（0 importer）：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx`、小写 `select.tsx`。shadcn 重复：`button.tsx`(1) vs `Button/`(41)、`card.tsx`(3) vs `Card/`(28)、`select.tsx`(0) vs `Select/`(15)。PascalCase 胜出，小写 shadcn 版是死重。

**复核（2026-07-27，修正先前误判）**：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx` 已删除（4/5 清理）。**小写 `select.tsx` 不是死文件**——它是 PascalCase `Select/index.tsx` 的底层实现（`Select/index.tsx:11` `import { SelectContent, SelectItem, ... } from "../select"`）。12 个页面经 `@/components/ui/Select` → `Select/index.tsx` → `select.tsx` 间接依赖它。删除会破坏整个 Select 组件。先前"0 importer"判断只查了 `@/components/ui/select` 直接导入，漏了相对路径 `../select` 的内部 re-export。**本条 RESCINDED，select.tsx 必须保留。**

### TD-10 — MSW 全套白搭
**审计**：2026-07-06，§5；**2026-08-01 复核**
**当时证据**：`mocks/handlers.ts`（188 行）+ `server.ts`（17 行），`setupMsw()` 被 0 个测试 import。20 个测试里 9 个用 `jest.mock`。

**复核（2026-08-01）**：**已清理** ✅——`mocks/` 目录已删（`ls mocks/` 不存在），全仓 0 处 `setupMsw` 引用。本条 STALE。

### TD-11 — 双图标库
**审计**：2026-07-06，§5；**2026-08-01 复核**
**当时证据**：lucide（63 文件）vs phosphor（6 文件，仅 marketing 页）。phosphor 近乎 vestigial。

**复核（2026-08-01）**：**已清理** ✅——phosphor = 0 文件（`grep -rl "@phosphor"` 全空），lucide 增至 72 文件。单图标库。本条 STALE。

### TD-12 — 双 Tailwind 配置（v3+v4）
**审计**：2026-07-06，§6
**当时证据**：两份 palette 已漂移，维护双倍。
**现状（2026-08-03 复核）**：架构是 **Tailwind v4 + `@config` 桥接 v3 `tailwind.config.ts`**——`src/styles/globals.css:8` `@config "../../tailwind.config.ts"` 让 v4 引擎加载 v3 风格的 JS config，同时 `@theme inline` 块定义 v4 原生 token，`tokens.css` 是注释里声称的 hex "single source of truth"。三处并存（tailwind.config.ts + @theme inline + tokens.css）。
**已修一例漂移（round-70，2026-08-03）**：`tailwind.config.ts` 的 `info.DEFAULT=#B8860B`（3.2:1，**WCAG AA fail**）与 `tokens.css --color-info=#8B6914`（5.1:1，AA pass）漂移——文件头注释自称 "Kept in sync"，但 info 块漏更新。修正 `info.DEFAULT→#8B6914` + `info.dark→#6B4F04`（对齐 tokens.css）。frontend 278 不变。

**后续核查修正（同轮，live built-CSS 实测）**：上述 fix 把 config hex 对齐了 tokens.css，**但 live 验证发现这对渲染无影响**——`text-info` 实际解析为 `var(--info)`，而 `--info` 由 `globals.css:118 --info: oklch(0.57 0.17 250)`（**蓝色**，hue 250）定义，**不是** tokens.css 的金色 `#8B6914`。即 `@theme inline` 块的 `--color-info: var(--info)` 把 config 与 tokens.css **两者都覆盖了**。真实渲染：alerts 图标 / sessions 计数 / profile 显示 = **蓝色**（info=blue 是语义惯例，可能是有意）。结论：`tailwind.config.ts` 的 colors 段 + `tokens.css` 的颜色段对 `text-*` utility **基本是死配置**（被 `@theme inline` oklch 全覆盖），TD-12 fix a65e37e 仅消除 config 内部自相矛盾（注释 vs 值），不改变视觉。诚实记录：本 fix 无功能/视觉收益，是文档级一致性。

**遗留（架构，未动）**：三源并存（tailwind.config.ts colors 段[死] + @theme inline oklch[活] + tokens.css[死]）+ tailwind.config.ts 非颜色段（fontSize/animation/keyframes/boxShadow[活，utility 类如 text-h1/animate-fade-in 仍用]）。彻底解决需：(1) 决定哪套 palette 是 source of truth（oklch 蓝色系 vs hex 金色系——**视觉/产品决策，非工程**）；(2) 迁活配置到 v4 `@theme`，删 `@config` + tailwind.config.ts + tokens.css 死颜色段。前置：产品决策选 palette。**不在 AI 自主范围**。

**palette 决策已定（round-76，2026-08-07，基于 frontend-design + design-review 技能判定）**：用户授权"利用 skills 进行前端设计的色调判定"。两技能方法论一致指向**金为权威**：(a) frontend-design "the brief's own words always win"——`DESIGN.md §58` 明文 "Primary — DarkGoldenrod Gold"、`§88` `info = #B8860B (same as primary)`、`§215` "Gold = AI intelligence. Every gold element signals AI content"；oklch hue 250 蓝 info 是 D4 合并引入的、与 brief 相悖的偏离。(b) design-review "tailwind.config.ts is source of truth for consistency"——`tailwind.config.ts` 的 `info=#8B6914` 金是基准，oklch 蓝 info 是 drift。(c) WCAG 实测：`#8B6914` 金作文本 5.09:1、作按钮填充白字 5.09:1 均 ✓ AA；蓝色 `#3366FC` 虽也过 AA 但无产品语义，accessibility 不构成留蓝理由。

**已修（round-76，2026-08-07）**：`globals.css` `--info` oklch hue 250→84（与 `--primary` 同源），`:root` + `.dark` 各 1 行。消除 `info` token 的蓝/金分裂——此前 `tailwind.config.ts`/`tokens.css` 说金、`@theme inline` oklch 说蓝，同一 `text-info` class 在不同入口渲染成不同色。live built-CSS 实测：`--info` 现为 `oklch(57% .17 84)` / dark `oklch(70% .16 84)`，无 hue 250 残留。frontend 278 不变。

**遗留（已知技术债，低优先，未动 per §十.5）**：success/warning/destructive 三色在两源（oklch vs hex）间有轻微色相偏（oklch 偏柔、hex 更饱和，ΔE 小、无功能影响）：success `oklch(0.62 0.17 145)→#558BBC` vs hex `#16A34A`；warning `oklch(0.73 0.17 70)→#E89500` vs `#D97706`；destructive `oklch(0.577 0.245 27.325)→#E52000` vs `#DC2626`。架构层三源并存（`@config` 桥接 + `@theme inline` + tokens.css）仍未彻底收敛，留待后续产品级 v4 迁移。

---

## 三、Schema

### TD-13 — 死/伪模型
**审计**：2026-07-06，§4；**2026-08-01 复核**
**当时证据**：
- `organization_members`、`saved_queries`：**0 代码引用**（死模型）
- `organizations`（硬编码 default-org）、`coldStorage`、`weeklyKill`、`usageRecord`：仅 1 点（边缘）

**复核（2026-08-01，live grep `prisma.<model>` 全 backend/src 排除测试）**：
- `organization_members`、`saved_queries`：**schema 已无此 model**（`grep -in 'saved_queries\|savedquery' schema.prisma` 全空）→ 本子条 STALE，已删。
- `organizations`（1 ref，`datasetService.ts:103` 硬编码 default-org）、`coldStorage`（1 ref，`routes/beef.ts:472`）、`weeklyKill`（1 ref，`routes/beef.ts:444`）、`usageRecord`（1 ref，`usageService.ts:74`）：**仍 EDGE 但 LIVE**——各有一个真实查询，非死模型。删除需 schema 迁移，单列轮次。
- **结论**：当前 31 个 model 全部有 ≥1 生产引用，**无死模型**。本条整体 STALE（除 organizations 的单租户脚手架语义）。

### TD-14 — 迁移历史与 schema 漂移：空库不可 migrate deploy 冷启动
**发现**：2026-08-15（round-102，CI run 31859533931 Backend Tests 实证）
**证据**：
- `group_members`（schema.prisma 仍是活模型 `GroupMember`，line 539，被 User/Group 关联）**先于迁移基线存在**：`grep -l group_members migrations/*/migration.sql` 仅命中 `20260712040000_drop_unused_schema`（drop/alter 它），**无任何迁移 CREATE 它**。
- 全新库 replay：`prisma migrate deploy` → `20260712040000` → `ERROR 42P01: relation "group_members" does not exist`（P3018）。
- 生产库不炸只因该表在生产是 pre-baseline 手工/早期状态存在。

**已解决（2026-08-15 round-103，基线 squash）**：
1. 前置验证：`prisma migrate diff --from-url <prod> --to-schema-datamodel` = **No difference**（生产与 schema 零漂移，squash 安全前提）。
2. 旧 8 个迁移整体移入 `prisma/migrations_archive_20260815/`（保留历史）；`prisma migrate diff --from-empty --to-schema-datamodel --script` 生成单一 `migrations/0_init/migration.sql`（930 行 / 31 表，**含 group_members 的 CREATE**）。
3. 生产簿记：`_prisma_migrations` 备份（`pg_dump -t`）后清表 → `migrate resolve --applied 0_init` → `migrate deploy` no-op + status up-to-date。顺带清掉了簿记表里 3 组历史失败重试的重复行。
4. **全新库重放证明**：scratch 库 `migrate deploy` → "All migrations have been successfully applied"；replay 后 `migrate diff` 对 schema = **No difference**。原 42P01 不复存在。
5. CI 的 test-backend 从 `db push` 改回 `migrate deploy`（真实迁移路径重新受 CI 保护）。
- 此后新增迁移只需对「生产现状 + 0_init 基线」兼容（两者现已一致）。

---

## 三½、零生产 caller 的死代码（2026-08-01 全量审计；2026-08-01 重核并修正多处事实错误）

> 原审计 2026-08-01 经多轮清理后已过期。本次（commit 7947790 同批）逐项 live grep 重核，发现 5 处事实错误并修正：
> - `invalidateAllSession`（少了个 s）实为 `invalidateAllSessions`，且被 `authService.ts:288` `changePassword` 调用 → **LIVE**，从死代码表移除。
> - `requireOwnedDataset` 原判"无 caller"错：它在同文件被 `updateDataset`/`deleteDataset`/`importDatasetData`（140/151/168）调用，三者均经 `routes/datasets.ts` live → **LIVE**（内部 helper），从死代码表移除。
> - `MS_PER_SECOND` 原判"无 caller"错：`MS_PER_MINUTE = 60 * MS_PER_SECOND`（constants.ts:4）消费它，且 constants.test.ts 直测 → **LIVE**（衍生常量），从死代码表移除。
> - `getAlertRule`、`requireCommodity` import、`extractToken` 已分别在 commit f197800 / 7947790 删除 → 表项清掉。
> 教训：诊断 agent / 历史报告的结论须 live 重核，否则会把 live 代码误删（`invalidateAllSessions` 险些中招）。

### 后端零外部 caller 的函数（2026-08-01 重核，6 项）

| 符号 | 位置 | 性质 | 处置 |
|---|---|---|---|
| ~~`validateApiKey`~~ | `services/apiKeys.ts:129` | ~~TD-3 已知，能发 key 但不验~~ | **LIVE（round-69 接入 authenticate，TD-3 RESOLVED）**|
| `trackUsage` / `checkLimit` | `services/usageService.ts:46,59` | paywall 脚手架，从未调用 | **保留**（PRODUCT-SPEC §九 不做付费墙，但留作 future quota 候选；删须产品决策）|
| `unsubscribeCommodity` / `getSubscribedCommodities` | `services/predictionCache.ts:222,234` | `subscribeCommodity` 活，这俩 0 caller | **保留**（订阅生命周期配对——`subscribe`/`unsubscribe` 是完整 API surface，管理面可能用；非 orphan）|
| `removeFromBlacklist` / `getBlacklistStats` / `clearBlacklist` / `checkTokenBlacklist` | `services/tokenBlacklist.ts:113,130,154,206` | 仅 `blacklistToken`+`isTokenBlacklisted` 活 | **保留**（黑名单管理面 = revoke/audit/clear 是合法安全 surface；`checkTokenBlacklist` 是 `isTokenBlacklisted` 的 throw 版封装，留作中间件备选）|
| **`cacheKeys` 5/6 成员** | `lib/cache.ts:67`（`query`/`timeseriesData`/`userSession`/`rateLimit`/`timeseriesList`）| 仅 `cacheKeys.prediction` 有 4 caller（predictionCache×2 + inference×2），其余 5 个 0 caller | 待决策（已预留 cache namespace，但当前 0 用；删 5 成员风险低，可下一轮）|

### 前端孤岛页（2 项，未变）

| 符号/文件 | 位置 | 性质 |
|---|---|---|
| `app/apikeys/show/[id]/page.tsx` | 0 入站链接 | 孤岛页（直接 URL 可达）|
| `app/apikeys/edit/[id]/page.tsx` | 0 入站链接 | 孤岛页 |

### 处置原则（遵循 §五 code-simplification + AGENTS §十.5）
- **leaf-level 死代码**（仅被自己的自测引用，无管理面/API surface 意图）→ 可删函数+其自测（删测试不算回退：测的是不存在的代码）。
- **API surface 配对**（subscribe/unsubscribe、blacklist add/remove/stats）→ 非孤立，属"管理面未来要用"的 surface，**不删**（AGENTS §十.5 外科手术原则——不顺手删非己所造、可能有产品意图的代码）。
- **孤岛页**（apikeys show/edit）→ 产品决策（是否保留直接 URL 访问），先标记不删。
- **TD-3 `validateApiKey`** / **paywall `trackUsage`/`checkLimit`** → 保留加注释，删须产品决策（PRODUCT-SPEC §九 约束相关）。
- 守护"测试数不得回退"硬约束：删死代码自测时，对应生产代码也已删，覆盖率分母同步缩小，不构成回退。

**round-68 补充（2026-08-03，dead-export 清理）**——对 lib/types 做 dead-export 全量重审（Explore agent + 逐项独立 grep 复核，§十.2）。删 ~40 个 0-外部-caller 的导出（leaf-level，非 API surface），共 **-631 行**：
- **backend**（5 文件 -94）：`types/index.ts` 删 5 死 interface（TimeRangeQuery/ParsedImportData/ModelTrainingResult/SecurityAuditLog/FilterParams，0 refs；SecurityAuditLog 仅是 routes/security.ts:30 的散文注释）；`response.ts` 删 SuccessResponse/ErrorResponse（0 refs）+ PaginationMeta 改本地（仅 paginated() 参数用）；config.ts/database.ts/jwt.ts 删 3 个 `export default`（代码全用 `@/lib` barrel 的具名 import，0 default importer）；jwt.ts TokenPayload 改本地（仅文件内用）。
- **frontend**（9 文件 -537）：`types/api.ts` 重写，仅留 6 个 LIVE 类型（Dataset/TimeSeries/Alert/Forecast/AlertSeverity/AIModel），删 ~24 死导出（app 代码自声明本地 interface 而非 import 共享版）；`types/accuracy.ts` 删 AccuracyResponse（BacktestWindow 保留——BacktestResponse 引用它）；`responsive-utils.ts` 删 5 死 hook（useBreakpoint/useIsTablet/useIsDesktop/useResponsiveValue/useWindowSize，0 caller）+ 孤儿 helper；`motion.ts` 删 7 死（保留 SPRING_DEFAULTS/STAGGER_CHILD/FADE_UP）；`chart-config.ts` 删 9 死导出 + default（保留 7 LIVE style）；`site-stats.ts` 删 AI_MODEL_LABELS（与 LIVE 的 MODEL_NAME_MAP 重复）；`errorHandler.ts` 删 withErrorHandling 函数 + ApiError 改本地；`sanitizer.ts`/`tokenManager.ts` 删 `export type {…}`（singleton 实例 LIVE）。
- **保留（signature-live 或 API surface，§十.5）**：MS_PER_SECOND（自测 pin 推导基线）；trackUsage/checkLimit/blacklist-admin/unsubscribeCommodity（已记录的 future-infra/管理面）；ForecastRequest/CorrelationResult/CorrelationMatrix（live 函数的签名类型）。（注：`validateApiKey` 原 future-infra，round-69 已接入 `authenticate`，现 LIVE，TD-3 RESOLVED。）
- **验证**：backend tsc clean + 639|1（不变）；frontend tsc clean + 278（不变）。无测试引用被删符号。
- **遗留**：TD-8 axios 单点依赖仍存（需 market-data.ts 迁移到 fetch）；cacheKeys/TD-1/4/7/9/10/11 早已 STALE（前几轮已清，文档待标 RESOLVED）。

---

## 四、基础设施 vs 实际功能比例失调（审计当时）

| 基础设施 | 实际使用 | 失调度 |
|---|---|---|
| BullMQ 队列 + Worker | 永不入队 | 完全闲置 |
| 多租户（org + members） | 单 default org，0 member 查询 | 完全闲置 |
| Stripe billing 字段 | 0 Stripe 代码 | 形状闲置 |
| API key 认证 | 发得出验不了 | 半闲置 |
| Storybook（10 devDeps） | 5 故事 / 92 组件 | 工具链闲置 |
| MSW（205 行） | 0 测试用 | 完全闲置 |
| axios 依赖 | 1 文件用 | 单点依赖 |

---

## 五、dev 工具链漏洞（round-53 核实，2026-07-31；2026-08-01 重核）

`pnpm audit` backend 当前 **4 vuln（0 critical / 1 high / 3 moderate）**——round-53 从 13（1 critical/7 high）降下来。剩余 1 high（vite）是 **dev-only / transitive，不可达生产**；3 moderate（esbuild / vite path-traversal / launch-editor）同样 dev-only。逐项：

| 包 | 路径 | 为什么留着 |
|---|---|---|
| `vite@5.4.21`（high） | `@vitest/coverage-v8@3 → vitest@3 → vite@5`（GHSA-fx2h server.fs.deny bypass，patched >=6.4.3） | vitest 3 peer-locked 到 vite 5。修复需 vitest 4（拉 vite 6+），但 **vitest 4 的 rolldown 依赖需 Node 20.12+**（`util.styleText`），本机 Node 18.20.8 不兼容（实测 Startup Error）。**前置条件：升级 Node 到 20+**，之后 vitest 3→4 即可清除此 high。 |
| `esbuild`（moderate） | dev 工具链 transitive | dev-only，不可达生产。随 vite 升级清除。 |
| `vite`（moderate，path traversal） | 同上 vite 路径 | dev-only。同 vite high 一并清除。 |
| `launch-editor`（moderate） | dev 工具链 transitive | dev-only，Windows UNC path NTLMv2 泄露，Linux 生产不可达。 |
| ~~`brace-expansion`~~ | ~~high~~ | **pnpm audit 误报，不计入真实漏洞**：audit 报 `<=5.0.7` 笼统覆盖 2.x，但实际安装的是 `@2.1.4`（glob@10→minimatch@9）和 `@5.0.9`（glob@11→minimatch@10），**两者均含 fix**（CVE-2025-5889 在 1.1.12 修复，2.x 携带 patched code）。round-54 已移除配错的全局 `minimatch:^3.1.4`/`brace-expansion:^1.1.13` override（它曾强制 glob@10/11 降到 minimatch@3 → 拉 vulnerable @1.1.18）。现无 `@1.x` 安装。剩余 audit 报警是 pnpm 版本范围检查器粒度问题。 |

> frontend `pnpm audit` 单独报 51 vuln（2 low / 29 moderate / 20 high），绝大多数是 Next.js 15 dev 链（postcss/js-yaml/estree 等）transitive，非生产可达。生产部署不装 devDependencies（见 `deploy/docker/Dockerfile.frontend` 多阶段构建），故不影响运行时。完整清单运行 `cd frontend && pnpm audit` 获取。

**round-53/54 已做**：vitest 2→3（消除 critical + 2 high）、tsx 4.21→4.23、vite override ^5.4.21（修复 vitest 3 拉到 ESM-only vite 7 的 ERR_REQUIRE_ESM）、marketNews orphan 测试隔离修复、**移除全局 minimatch/brace-expansion override**（round-54，让 glob@10/11 拿到正确的 minimatch@9/10）。
**后续（需环境前置）**：Node 20 升级 → vitest 4 → 清除 vite high（唯一真实剩余 high）。

**已解决（round-90，2026-08-10）**：zoom-out 审计发现 Node 已是 **v20.20.2**（非 18.20.8），vitest 4 前置条件满足。
- vitest 3.2.7 → **4.1.10**，@vitest/coverage-v8 3.2.7 → **4.1.10**，vite 5.4.21 → **6.4.3**（加为直接 devDep）。
- GHSA-fx2h（vite server.fs.deny bypass，high）：affected <6.4.3，现 patched ✓。lockfile 0 处 vite@5（7 处 vite@6）。
- esbuild / vite path-traversal moderate 随 vite 6 升级一并清除。
- backend 706|1 全绿（63 test files），production build 不受影响（vite 是 dev-only）。
- 剩余 launch-editor（moderate，Windows UNC path，Linux 生产不可达）不阻塞。

---

## 如何使用本文件

- 每条都是**审计当时的快照**，非当前事实。动手前用 grep / knip 重新核实 0-caller 状态。
- 核实后清理一条，在条目末尾标 `**已清理（YYYY-MM-DD）**：…`，保留历史。
- 新增 tech debt：附证据来源 + 审计日期。
- ROI 排序（审计当时建议）：**高** = TD-1/7/8/9/11（删了零功能损失）；**中** = TD-2/3/6/10（需决策）；**低** = TD-5/4/12（一致性收益）。

### CSRF 死端点（round-105 审计标记，2026-08-16）

`GET /api/auth/csrf-token`（auth.ts:611）发放 double-submit token（随机 hex + httpOnly cookie），但**全后端无任何 `x-csrf-token` 验证点**，前端也从未调用（frontend/src 零引用）。属安全剧场：端点存在暗示有 CSRF 防护，实际防护来自别处——状态变更路由走 Authorization Bearer 头（自定义头无法被跨站设置，天然免疫 CSRF），cookie 会话只用于只读端点（/verify、/auth/me）+ logout。已在端点 doc 注释中如实标注。处置二选一（未决）：为 logout 等 cookie 可达的变更端点接真实验证，或移除端点（遵循 AGENTS §十.5：非己所造死代码先标记，不径直删）。
