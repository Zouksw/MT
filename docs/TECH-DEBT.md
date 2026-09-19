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

**已解决（round-114，2026-08-21，commit c6cba18）**：迁移 `20260821110000_drop_organizations`（**双库应用**：mt_db + mt_test）删 organizations 表 + `datasets.organization_id` 列/FK/组合唯一键，补 `UNIQUE(datasets.slug)`（service 层 slug 查重本就是全局的）。datasetService 删 default-org upsert（少 1 次查询）；5 个测试 fixture 去除 org 行；前端删死字段 `Dataset.organizationId` 与 profile 恒为 0 的 "Orgs" 计数（后端从未查询 `ownedOrganizations`）。删除前实测：organizations 仅 2 行（种子 + 运行时 default）、datasets 仅 1 行。

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

**部分清理（2026-07-27 复核）**：`types/index.ts` 第三份重复已删（仅留 NOTE 注释）。剩 2 个**有意**变体在 `middleware/auth.ts`：`AuthRequest`（userId optional，未认证路由用）+ `AuthenticatedRequest`（userId required，`authenticate` 后保证）。两变体共存是设计意图，非重复。本条基本 STALE。**TD-5 结案（2026-09-06 复核）**：维持两变体设计（optional/required 语义即文档），不强行收敛。

### TD-6 — 3 个无 service 层的胖路由（待重构）
**审计**：2026-07-12，`reviews/2026-07-12-round-29.md` 后续
**当时证据**：ROADMAP C2 主线"胖路由抽 service"已完成 watchlist（17→0 处 `prisma.` 直连）。剩余 3 个按 `prisma.` 直连数排序：
- `beef.ts`（15）→ **已完成（2026-09-06，round-156 批3b）**：6 个胖 handler（/prices、/prices/latest、/prices/history、/spreads、/forecasts、/forecasts/:cutCode，~510 行）逐字平移至 `services/beefPriceQueries.ts`，路由 851→381 行只剩中间件链 + 薄委托（/by-country 既有的 aggregateBeefByCountry 模式）；全量 1099+1 零回退，11 端点 live 200，trend 契约/厂号 404 诚实规则逐位保持。剩余简单直查（factories/cuts/weekly-kill/cold-storage）为单 findMany 薄查询，不属"胖路由"。
- `portfolios.ts`（15）→ **随 D3 孤儿清除删除（round-144）**，条目消亡。
- `timeseries.ts`（10）→ **未动**（TD-6 剩余主体）。

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

**round-114 补充（2026-08-21）**：useModelDetail / useAccuracyData 两处**逐字相同**的私有 `apiFetch` 合并为单一 `lib/apiFetch.ts`（语义零变化）。剩余裸 `fetch()` 38 处（39 − 2 副本 + 1 新共享实现），其中约 9 处为 POST/PATCH mutation、多处刻意吞错——仍需逐站点评估，维持开放（低优先，不阻塞价值链）。

**round-118 补充（2026-08-22，mutation 侧全收敛）**：9 处 POST/PATCH 裸 fetch 全部迁入唯一客户端（useBeefImport multipart / login / register / data-sources refresh×2 / ai×2 visualize / apikeys GET+PATCH / WebVitals beacon，commit `2c6def7`）。为此扩展 ApiFetchError 携带 status + 解析后错误 body（三种后端错误形状的消息提取），authFetch 对 FormData 跳过默认 Content-Type。**剩余 ~29 处裸 fetch 全部为 GET 读取**（hook 内 SWR fetcher、useSWR 内联 fetcher、publicFetcher、刻意吞错的刷新点）——维持开放（低优先，不阻塞价值链）。

### TD-9 — 死 ui 组件 + shadcn 重复对
**审计**：2026-07-06，§5
**当时证据**：死 ui 组件（0 importer）：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx`、小写 `select.tsx`。shadcn 重复：`button.tsx`(1) vs `Button/`(41)、`card.tsx`(3) vs `Card/`(28)、`select.tsx`(0) vs `Select/`(15)。PascalCase 胜出，小写 shadcn 版是死重。

**复核（2026-07-27，修正先前误判）**：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx` 已删除（4/5 清理）。**小写 `select.tsx` 不是死文件**——它是 PascalCase `Select/index.tsx` 的底层实现（`Select/index.tsx:11` `import { SelectContent, SelectItem, ... } from "../select"`）。12 个页面经 `@/components/ui/Select` → `Select/index.tsx` → `select.tsx` 间接依赖它。删除会破坏整个 Select 组件。先前"0 importer"判断只查了 `@/components/ui/select` 直接导入，漏了相对路径 `../select` 的内部 re-export。**本条 RESCINDED，select.tsx 必须保留。**

**已解决（round-114，2026-08-21，commit 87cf1ec）**：`ui/button.tsx` + `ui/card.tsx` 双实现收敛——它们不是死文件（是 PascalCase 包装器的基座，同 select.tsx 教训），但**同时**被直接 import（Modal + 3 个 trading 组件），构成两套活实现。基座实现内联进 `Button/index.tsx` 与 `Card/index.tsx`（各留单一实现），4 个直接引用改走 PascalCase API（Modal 的 `render` 组合要求 children 放宽为可选），小写文件删除。Card 公开类型补上基座已有的 `size` prop。frontend tsc 0 错 + 297 tests + build ✓。

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

### TD-12b — 死字号/动画 token 与未命名"亮金"（2026-08-31 复核登记，未动 per §十.5）

**来源**：2026-08-07 DESIGN-SYSTEM-AUDIT §3.2/§6.1 + 2026-08-31 前端审查复核（round-151）。
**现状（2026-08-31 复核）**：
- `tailwind.config.ts` 自定义字号 token 中 `text-data-lg/data/data-sm/code` 全仓 **0 用**（默认 Tailwind 字号 text-sm/xs 以 10:1 成为事实标准）；动画 token 4 个中 3 个死（fade-in/slide-up/modal-in 0 用，活的是 skeleton-pulse）。
- **亮金 `#A8821C`**（primary #8B6914 的暗色提亮变体）在 **7 处**作为事实上的第二金使用：Hero.tsx 渐变 + hover ring、cards.css ×2、forms.css、layouts.css、ai-utils.ts——设计审计曾记"最后 1 处 hex 漂移"，实为**成体系的未命名 token**，非漂移。
- 审计 P2/P3 两项已在后续轮次完成：`next/font/google` 死字体加载已移除（layout.tsx 现仅 geist/font）；animate-spin 已 reduced-motion 感知（animations.css:252 降至 3s）。
**处置决策（遵循 §十.5）**：不改。死 token 删除与 `--color-bright-gold` token 化需与 TD-12 的 v4 `@theme` 迁移（产品级 palette 收敛）同批进行，独立零散改动会加深三源分裂。触发条件：下次动 tailwind.config.ts 或 tokens.css 时顺手处理。

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

**冷启动终验（2026-09-06，round-156 批5）**：全新空库 `mt_coldstart_156`（CREATE DATABASE 后零手工状态）→ `prisma migrate deploy` 全量应用成功（0_init 基线含 group_members CREATE + 后续迁移）、退出码 0，P3018 复现路径不复存在。**TD-14 RESOLVED（live 实证）。**
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

### 前端孤岛页（2 项）

| 符号/文件 | 位置 | 性质 |
|---|---|---|
| `app/apikeys/show/[id]/page.tsx` | ~~0 入站链接~~ | **非孤岛（round-112 修正，2026-08-20）**：`apikeys/page.tsx:239` 有 `href={/apikeys/show/${id}}`，列表→show→edit 是接线完整的管理流——2026-08-01 的"0 入站链接"记录已过期，勿删 |
| `app/apikeys/edit/[id]/page.tsx` | ~~0 入站链接~~ | 同上：show 页两处链接指向 edit |

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

**已移除（round-112，2026-08-20，commit 7ea8105）**：按用户"清除没必要存在的代码"的明确指示执行了"移除端点"分支——删除路由 + 自测 + API.md 行；live 实测 `/api/auth/csrf-token` 现返回 404，Bearer 认证路径不受影响。本条 CLOSED。

### round-106 全项目审查遗留项（2026-08-16，均已核实、待决策/后续批次）

round-106 四路并行审查（路由+中间件 / 服务层 / 前端 / 推理+测试质量）产出 ~75 项发现，Critical/High 与多数 Medium 已在批 1-10 修复（11 个 commit）。以下为**遗留未修**项，按处置类型分组：

**产品/设计决策类（等方向）：**
- **套餐限额从未执行**：`usageService.checkLimit/trackUsage` 零生产 caller（仅测试引用）——广告的 watchlists/AI 模型/signals 限额从不强制，`UsageRecord` 从不写入，`GET /billing/usage` 永远空数组。要么接入 watchlist/signal/predict 路由，要么停止广告限额（诚实优先）。
- **ForecastTrendChart 待真数据源**：~~dashboard 槽位已移除（组件保留）~~ **组件本体已删（f131707，-390 行三死文件批次之一；2026-08-30 复核）**。若未来做逐日预测计数端点需重建组件。
- **datasets 全员共享硬编码 org**：`datasetService.ts:106` `default-org-id` upsert——所有用户的 dataset 落进同一个 org（schema 明确 org 应 per-user）。需 per-user org 或 org 可选迁移。
- **/spreads 混币种统计**：beef.ts spreads 按 source+country 聚合 min/max/avg，但 currency 列存在多币种（BRL/USD 混算）。需按币种分组或先归一。
- **beef cheek → OFFAL 死别名**：beefCutNormalizer.ts:764 映射到不存在的 cutCode，行被静默丢弃。需 taxonomy 决策（加 CHEEK 码或删别名）。

**死代码类（2026-08-30 round-133 全量复核：六项全部已在历史轮次清理，登记文本滞后——本轮逐项 grep 实证后关闭）：**
- ~~`modelService.createModelRecord` 零 caller~~ → **整个 modelService 已随 D6 删除（round-132 d9c4e10）**。
- ~~`cache.ts` null-cache 读路径~~ → **已删**（cache.ts:30 留有决策注释：无人写 `null:` 键，miss 即 miss，不付 EXISTS 往返）。
- ~~`tokenBlacklist` 的 getBlacklistStats/clearBlacklist/checkTokenBlacklist~~ → **已删**；现存 `blacklistToken`/`isTokenBlacklisted` 两函数 authService 在用（+3 测试文件）。
- ~~`middleware/auth.ts` 1% 采样 session-count 查询被丢弃~~ → **已删**（auth.ts 现无任何 count/采样残留，grep 实证）。
- ~~`marketData.ts _importSchema`；`ui/select.tsx`；button/card 双实现~~ → **均已清**（_importSchema grep 零命中；select.tsx 系误报、TD-9 已 RESCINDED；button/card 双实现 round-114 87cf1ec 收敛）。
- `alertNotifications.lastDirections` 内存 Map（重启即失 + 无界增长）**仍开**（行为缺陷非死代码，文件 alertNotifications.ts:29 现存）；`topCuts` 排序无次级 orderBy **仍开**，文件已迁 `beefQueries.ts:96`（round-117 合并）；bridge 代理行混入国家均值未标注**仍开**。

**低优先级正确性/加固（后续批次可做）——2026-08-31 round-142 批 3 复核批注：本组 8 项存活项已全部收口（commit `465570f`）：/api/docs 加 authenticate、authRateLimiter 拆分（login 保留 10/15min，refresh/change-password 30/15min）、lastDirections bounded(512)、SMTP warn 每进程一次、monthRange 月初 clamp（Jan 31 跳月 +3 回归钉）、verifyTokenSession count 化、topCuts cutCode 决胜平价、importDataset rowsCount 真实计数。仍开（缓办，数据冻结期 latent 或属产品决策）：/spreads 混币种分组、beef cheek → OFFAL 死别名（D13）、metrics GET 提权、inference `@app.on_event` → lifespan 迁移（零行为变化，可选项维持登记）、前端剩余 biome 警告（judgment-call 规则）。→ **2026-08-31 round-144 复核更新**：前四项全部落地——/spreads 币种进分组键（`b6a2882`，+币种分组测试）；D13 闭（规范 BEEF_CHEEK/Offal 条目 + 别名重指 + 两库 taxonomy upsert + 死别名结构守护测试）；lifespan 迁移完成（`7e87a98`）；metrics 提权**定案不提**（见下方条目）。仍开仅剩：前端 biome 警告、normalizer.ts:114 时区、renameWatchlist P2002、socket 房间名。**
- ~~`datasetService` 0 数据点导入返回 success 且 rowsCount 被覆盖（非累加）。~~（**已修 round-142 批 3**：rowsCount 改为导入后真实 datapoint count。）
- ~~`notificationChannels` 每次调用打 "SMTP not configured" 警告（应打一次）。~~（**已修 round-142 批 3**：每进程只打一次。）
- ~~`helpers.monthRange` 31 日 setMonth 跳月（现两 caller 均传月初，latent）~~（**已修 round-142 批 3**：月初 UTC clamp + 3 回归钉）；`normalizer.ts:114` 回退路径本地时区构 Date（其余 UTC）——仍开（latent，低风险）。
- ~~`authService.verifyTokenSession` findMany 全量 session（应 count）~~（**已修 round-142 批 3**：session.count + 正路径钉）；`renameWatchlist` 撞唯一名 P2002 → 500——仍开（复核 watchlistService:278 未见显式处理，低频路径）。
- metrics GET 仅 authenticate（~~/api/security/audit 是 ADMIN 门~~ 该组端点已删 round-132，此对照失效）——~~是否提权待定~~ **定案 round-144：维持 authenticate 不提权**。依据（2026-08-31 实测核查）：载荷为纯聚合运维指标（进程内存/CPU/uptime、端点级延迟分位、请求计数），无用户级数据、无凭据、无密钥；唯一消费者是 `/dashboard/performance` 页，面向全体登录用户开放是有意设计；提权则必须引入前端 role-gate（全库零先例）或让普通用户页面 403——净复杂度负收益。留档关闭，若日后 metrics 载荷引入用户级数据则重开；socket `join-timeseries` 房间名未校验且不计入 20 房上限；~~`/api/docs` Swagger 无鉴权暴露全端点面~~（已加 authenticate，round-142 批 3）。
- ~~`authRateLimiter`（10/15min/IP）被 login+refresh+change-password 共用——NAT 环境误锁。~~（**已修 round-142 批 3**：拆 authActionRateLimiter 30/15min 承接 refresh/change-password，login 保留原限。）
- inference: ~~`@app.on_event` 已弃用（应 lifespan）~~（**已迁移 round-144 `7e87a98`**：asynccontextmanager lifespan，启动序不变〔torch 线程预算→串行 Chronos 预加载〕，pytest 61 绿〔warning 22→20，弃用告警对消失〕，live /ready chronos 3/3 经 lifespan 预加载）；负价格未拒（边界设计决策）；~~批量 gc.collect() 每项一次~~（批量端点已随 round-140 D3 删除，条目失效）。
- 前端剩余 biome 警告 10 条（noExplicitAny 等 judgment-call 规则，均存量）。

### round-107 前后端打通审计遗留项（2026-08-16，已核实）

round-107 用真实浏览器逐页扫描全部 44 条路由（`scripts/e2e-page-audit.mjs`），发现并修复 6 处前后端断裂（4 个缺失端点 + 2 个前端调用缺陷，详见 CHANGELOG）。遗留：

**功能从未实现、页面已诚实降级（要做需产品决策）：**
- API key **逐次使用日志**：`/apikeys/show` 页曾调 `GET /api/api-keys/:id/usage`（端点从未存在）——现页面诚实显示空态；后端仅在 key 行上有 `usageCount/lastUsedAt` 计数器。要做需新增 ApiUsageLog 表 + validateApiKey 写入。
- API key **regenerate/rotate**：原按钮调 `POST /:id/regenerate`（不存在）已移除。要做需实现 rotate 端点（旧 key 撤销 + 新 key 一次性返回）。
- **dataset 编辑/导出 UI**：`PATCH /api/datasets/:id` 后端存在但无编辑页；导出端点+页面皆无。原 show 页两个死按钮已移除。
- **timeseries/show/[id] 页面不存在**：创建成功后现跳转 `/timeseries/edit/:id`（列表→编辑可达）。

**小项：**
- `/alerts/show` 页 Name 字段显示 "Unnamed Alert"（Alert 模型无 name；metadata.title 可用未映射）。
- **前端零 WebSocket 消费**：后端 Socket.IO 服务（app.ts io + join-timeseries 房间）无任何前端调用（`socket.io-client` 零引用）——实时推送能力存在但从未接通。`.env.production` 的 `NEXT_PUBLIC_WS_URL=wss://api.your-domain.com` 亦为占位符（NEXT_PUBLIC_API_URL 同款教训：占位符会进产物）。

---

## 六、round-111 设置层冗余审计（2026-08-20，全部只读核实）

> 本轮目标"探索项目设置、分析实现冗余"（与 round-108 的磁盘体积评估互补）。代码层冗余在上文各条已覆盖且大半 STALE/RESOLVED；本轮聚焦**设置/部署/工具链层**，全部条目 2026-08-20 实测（命令附于各条）。

### 总体结论

代码层不臃肿（路由挂载 20 前缀无重复、inference 298 行函数式实现干净、modelRegistry 单一事实来源）。**当前最大的冗余在设置层：4 套并行部署描述只有 1 套在用且互相漂移；根 package.json 有 5 处工具链残留；脚本层 2 处冗余 + 1 处"脚手架存在但未接线"。** 影响是维护误导与认知负担（新人/AI 会按 compose/helm 理解架构），不是运行时开销。

### TD-15 — 部署描述四套并存，实际只有 PM2+SSH 一套在用

**实测（2026-08-20）**：
- **实际运行拓扑**：PM2 三进程（`pm2 jlist`：mt-backend/frontend/inference）+ **宿主机 systemd 的 PostgreSQL/Redis**（`systemctl is-active postgresql redis-server` = active；`docker ps -a` **零容器**；监听 127.0.0.1:5432/6379 为本机进程）。CI 部署 = `appleboy/ssh-action` SSH 上服务器跑 `scripts/deploy.sh`（PM2 路径）——`ci.yml` 与 `deploy.sh` 中 `helm|kubectl|docker` 引用数 = **0**。
- **闲置且漂移**：
  - `docker-compose.yml`：compose 建的 DB 用户是 `mt`，实际 `.env` 是 `mt_user`——该栈从未是本机运行时；镜像版本 `postgres:15-alpine`/`redis:7-alpine` 与宿主机实际（**PG 14.23 / Redis 6.0.16**，`psql --version`/`redis-server --version`）不符。
  - `deploy/helm/`（11 文件：deployment/hpa/ingress/networkpolicy/backup-cronjob/secrets/configmap）：无任何流水线引用。
  - `deploy/docker/` 2 个 Dockerfile：仅被 compose build 引用。
  - `nginx/nginx.conf`：仅被 compose 的 nginx 服务挂载；宿主机 80 端口无 nginx。
- **文档误导已存在**：AGENTS.md §四 技术栈行曾写"PostgreSQL 15、Redis 7（docker-compose.yml）"（本轮已修正为宿主机实际版本）。
**处置建议（产品决策，未动）**：三选一——(a) 接受单机 PM2 为产品现实，归档 compose/helm/nginx 到 `deploy/attic/` 或删除；(b) 保留 helm 作为未来 k8s 规划但加"未启用"README 标注；(c) 真正容器化。现状（漂移共存）是最差选项。

**已处置（round-114，2026-08-21，commit 662adfb）**：按 (a) 归档——`docker-compose.yml`/`deploy/helm`/`deploy/docker`/`nginx/` git mv 至 `deploy/attic/` + README 记录实际拓扑、漂移证据与恢复方法。可逆（git mv 回原位）；未预断 (c) 容器化决策。活文档指针同步更新（AGENTS §四/§五、AUTOMATION-STATUS §八、SKILLS、DEPLOYMENT-CHECKLIST 备份清单）；CI/deploy.sh 引用复核为 0。

### TD-16 — 根 package.json / 工具链残留（5 项）

**实测（2026-08-20）**：
- `pnpm.overrides."minimatch@<3.1.4": ">=3.1.4"`：根 `pnpm-lock.yaml` 中 **0 个 minimatch**（根只装 biome/husky/lint-staged/tsx/supertest/pm2-logrotate）→ **no-op 残留**（pnpm store 损伤时期防御的遗留；round-54 移除的是另一处配错 override）。
- 根 devDeps `supertest` + `@types/supertest`：根目录无测试、scripts/ 无引用（backend 自带同款）→ 可卸。
- `onlyBuiltDependencies` 含 `msw`：frontend/backend package.json 均已无 msw（TD-10 已清）→ stale 条目。
- `knip.json`：配置完整（backend/frontend 两 workspace），但 knip **未安装**（node_modules/.bin 无）、CI 0 引用 → 死工具配置；且其 `workspaces` 结构与本仓库"非 pnpm workspace"（AGENTS §五）矛盾，即使装了也需重写。
- `pm2-logrotate`（唯一 root dependency）：`~/.pm2/modules` 有安装痕迹但 `pm2 list` 无此进程（inactive）；PM2 日志轮转实际由 `/etc/logrotate.d/trademind` 承担 → 双轮转机制一套闲置。
**处置**：除 override/msw/supertest 可直接清（无副作用）外，knip 与 pm2-logrotate 需先决策"要不要这个能力"。均未动。
**已处置（round-114，2026-08-21）**：pm2-logrotate 模块卸载（`pm2 uninstall`）+ 根依赖删除（package.json + lockfile -892 行，7cb9a9c）——轮转唯一机制为系统 `/etc/logrotate.d/trademind`。knip.json 已在 round-112 删除；override/msw/supertest 亦已清。**TD-16 全部关闭。**

### TD-17 — 脚本层：1 孤儿 + 1 漂移副本 + 1 未接线

**实测（2026-08-20）**：
- `scripts/pm2-start.sh`：**0 外部 caller**（package.json 脚本、AGENTS、docs、CI、deploy.sh 均指 `restart.sh`）——功能是 restart.sh 子集（无端口清理/僵尸清理）→ 孤儿脚本。
- `scripts/logrotate.conf` vs `/etc/logrotate.d/trademind`：**内容已漂移**（repo 副本 `rotate 14` + postrotate `pm2 reloadLogs`；线上 `rotate 7` + `maxsize 50M` + `copytruncate`、无 postrotate）——repo 副本 stale，误导下次" reinstall"。
- `scripts/mt.service`（systemd 单元，PM2 resurrect 开机复活）：**未安装**（`systemctl is-enabled mt` → No such file）→ 重启后 PM2 不会自动复活，脚手架存在但未接线（ops 缺口，非冗余）。**已安装启用（round-114，2026-08-21，7cb9a9c）**：`/etc/systemd/system/mt.service` enabled；redis.service 别名实测解析到 redis-server.service（单元无需改）；`pm2 save` 后 `systemctl start` 复活验证零扰动（同 PID/重启计数）。
- 非冗余确认：health-check.sh（CI verify）/ cron-healthcheck.sh（5min 自愈）/ watchdog-nextserver.sh（2min 杀重复 next-server）职责互斥；backup/restore/db-migrate/bootstrap-test-db/setup 为合法运维对。

**终态（2026-09-06，round-156 批5 复核）**：三子项全部关闭——① `pm2-start.sh` 已删除（round-112 `1ae11b8` setup-layer cleanup，本轮实测文件不存在、全仓零引用）；② logrotate repo 副本已与线上 `/etc/logrotate.d/trademind` 同步（round-111/112，本轮 diff 逐行一致复核）；③ mt.service 已安装启用（round-114，登记内已注）。**TD-17 RESOLVED。**

### TD-18 — 代码层新鲜抽查（对既有条目的 2026-08-20 复核）

- **`ui/button.tsx` vs `Button/`、`ui/card.tsx` vs `Card/` 双实现仍在且双活**：小写版 4 importer（Modal + 3 个 trading 组件）vs Pascal 版 45 importer——真实重复，收敛属设计系统迁移（round-106 已记，未变）。**round-114 已收敛**（见 TD-9 补充，commit 87cf1ec）。
- **`_importSchema`（`routes/marketData.ts:54`）死定义仍在**（round-106 已记；原审计写的 `services/marketData.ts` 路径已失效，实际在 routes/）。
- **backend Socket.IO LIVE 但前端 0 消费**：`socket.io@4.8.3` 在 backend deps，frontend 无 `socket.io-client`（round-107 已记，未变）。
- **`backend/.env.production`（mtime 2026-05-09）0 个 loader 消费**：PM2 路径 `dotenv/config` 只读 `.env`，Dockerfile 不 COPY env，compose 内联注入 → 死配置文件（含密钥占位符，建议按 SECRETS-MANAGEMENT 流程清除）。frontend 的 `.env.local` 与 `.env.production` 键 0 重叠（互补，非冲突；`.env.production` 为 Next 原生加载，LIVE）。
- **裸 `fetch()` 39 处**（`grep -rn "await fetch(" frontend/src | grep -v __tests__`）——与 08-10 记录一致（TD-8 开放项）。
- **路由挂载无重复**：`app.use` 20 个 API 前缀各 1 次；`/health` 双 use 是 limiter+router 链式（非重复）。
- **无漂移确认**：modelRegistry.ts 注释与实现一致（stl 移除决策 08-15 记录在案）；sarimax 已实现未接线是 round-110 门禁决策（非冗余）；prediction_logs 中 sundial/timer_xl 幽灵行仅由 `routes/signals.ts:108` 注释性防御处理（数据幽灵，非代码）。

---

## 七、round-112 清理执行记录（2026-08-20，用户授权"清除没必要存在的代码"）

> 用户明确指示代码质量低、鸡肋功能与不必要代码应清除——本节记录按既有审计证据执行的删除（每项删除前重新 0-caller 核实）。四个提交：`1ae11b8`（设置层）、`8223df2`（backend 死代码）、`7ea8105`（Socket.IO + 死端点）、`4cca71e`（配额脚手架 + flaky 修复）。`git diff 1ae11b8^..4cca71e` = **31 文件，-1,210 / +182（净 -1,028 行）**。测试 924 → 909（-15 全部为被删代码/端点的自测，属 TECH-DEBT 既定豁免），每批 tsc + 全量绿 + build + pm2 restart + live 验证。

**已清除**：
1. 设置层：根 pkg minimatch no-op override / root supertest / msw onlyBuiltDependencies 条目 / knip.json / scripts/pm2-start.sh（0 caller）/ scripts/logrotate.conf 同步线上版 / backend/.env.production（未跟踪占位模板）。
2. backend 死代码：`modelService.createModelRecord`、`tokenBlacklist` 的 removeFromBlacklist/getBlacklistStats/clearBlacklist/checkTokenBlacklist（保留 LIVE 的 blacklistToken/isTokenBlacklisted；round-104 TTL 回归套件保留、cleanup 改直连 redis 键）、auth.ts 1% 采样 session-count 丢弃查询、`_importSchema`（实际在 routes/marketData.ts:54）、cache.ts null-sentinel 读路径（每次 miss 白付一次 EXISTS）。
3. Socket.IO 整体（零消费者）：app.ts io 装配（连接认证 + 房间授权 ~90 行）、signals/anomalies/models 三处 emit、alertNotifications io 参数（DB 持久化 + email/Slack 保留）、notificationChannels 的 "websocket" 通道类型、socket.io 依赖本身。round-107"前端零 WebSocket 消费"遗留项由此 CLOSED。
4. 死端点：`GET /api/auth/csrf-token`（安全剧场，round-105 标记）、`GET /api/billing/usage`（usageRecords 从未写入、前端 0 调用；/plans //subscription 保留供 billing UI）。
5. 配额脚手架：`usageService.checkLimit/trackUsage`（0 生产 caller，广告限额从未强制——PRODUCT-SPEC §九 无 paywall；PLAN_LIMITS/getUserPlan 保留为信息性限额）。round-106"套餐限额从未执行"遗留项由此 CLOSED。
6. 质量修复（顺手，同批门禁）：dataHealth freshSourceCount 测试改自包含（原依赖跨运行 DB 残留，干净树上就红）；intervalCalibration 覆盖率测试加 mulberry32 种子（Math.random 版在 0.88 边界闪断 0.879）。

**核实后未删（有证据保留）**：apikeys show/edit 页（列表→show→edit 接线完整，round-107 孤岛记录过期）；`unsubscribeCommodity`/`getSubscribedCommodities`（订阅 API 配对面）；watchlist/portfolios/datasets/timeseries 等整功能域（页面可达且工作，属产品面非死代码——下线需产品决策）。

**仍开放（产品/运维决策，未动）**：~~TD-15 部署描述四套并存~~（round-114 已归档）；~~TD-2 organizations 单租户脚手架~~（round-114 已删）；~~pm2-logrotate 装而未跑~~（round-114 已卸）；~~ui/button+card 双实现~~（round-114 已收敛）；裸 fetch 38 处收敛（TD-8，round-114 已合并 2 处逐字重复 apiFetch，其余需逐站点评估）；~~mt.service 未安装~~（round-114 已启用）。

---

## 八、round-113 多技能交叉审查（2026-08-20/21，7 技能 + 对抗性子代理）

> 目标"利用尽可能多的 skills 审查前几个 goal 发现的事项"。使用技能：code-review-and-quality、careful、security-and-hardening、doubt-driven-development（含全新上下文对抗性审查子代理）、deprecation-and-migration、javascript-testing-patterns、ops-check（+ zoom-out 收束）。交叉模型复核：非交互环境按 doubt-driven 规程声明跳过。

### 审查对象与结论

| 对象 | 技能 | 结论 |
|---|---|---|
| round-112 四个删除提交（31 文件 -1,210/+182） | code-review 五轴 + careful | **通过**。cache/auth/alertNotifications 三处 diff 语义等价性逐一验证；发现 6 处未用 import（3 处 round-112 残留 + 3 处先前存在，commit 64be16e 清理，inacScraper 墓碑保留） |
| round-112 安全面（CSRF 移除/auth 热路径/tokenBlacklist 裁剪/Socket.IO 摘除） | security STRIDE | **无暴露**：logout 要求 Bearer 头（跨站不可伪造）→ CSRF 端点移除无缺口；diff 无泄密行；Socket.IO 摘除缩小攻击面 |
| 已删端点（csrf-token、billing/usage） | deprecation 清单 | **迁移完整**：前端/swagger/测试/API.md 全部 0 残留；cookieParser 存在理由注释更新 |
| round-112/113 测试改造（4 项） | testing-patterns | **通过**（AAA/自清理/确定性）；conformal 覆盖率测试已种子化（0.879 闪断根治，3x 稳定） |
| 部署/任务健康 | ops-check + observability | **全绿**：三服务 200、Redis PONG、BASELINE/CONFORMAL/auto-verify 照常、错误日志无新增 |
| round-110 统计工件（intervalCalibration / modelQuality 淘汰 / mapeTracking expire-restore） | doubt-driven 对抗审查（17 项发现） | RECONCILE 见下表：**5 项修复（3bb737d）、1 项生产实证的真 bug、若干延后并记录** |

### 对抗审查 RECONCILE 表（发现 → 处置）

**已修复（commit 3bb737d，+5 测试，914 全绿，生产实证）**：
- A1-1（High）conformal 池无测试工件过滤 → 与 mapeTracking 同一 EXCLUDE_TEST_ARTIFACTS（已导出共享）。**修复前确曾发生同类事故**（mapeTracking.ts 注释记录的 TESTCUT/chronos_tiny 泄漏）。
- A1-3（Medium）证据门槛按残差数而非行数 → 改按行数。**生产反向实证**：修复后校准模型 10→8——幽灵模型 sundial/timer_xl（10 行×~10 步≈100 残差）此前一直骗过门槛、**一直在接收校准区间**。
- A1-2（High·边界）q≥1 会产生负下界 → 拒绝（实测 live q90 最大 0.29，属污染防御）。
- A1-5（Medium·潜伏）60s 缓存不按 days 分键 → 按 days 分键。
- A2-1（Low）偶数池"中位数"取上中位 → 真中位数。

**核实后判定为噪音/已正确（审查者亦确认）**：分位数 off-by-one（n≥30 正确）、naive 自豁免/双方≥20 门槛/严格劣于/全淘汰回退/除零、$executeRaw 参数转型、set-based 清扫、crash-safety。

**延后（记录理由，后续批次）**：
- **A3-1/2/3/4（验证环 expire/restore/verifier 语义不一致族）**：① restore 是一次性任务（无 intervalMs，每次重启才跑）而 expire 每 6h——中途回填要等重启才被回收；② restore/expire 数 actuals 不按 authoritative-source 过滤而 verifier 按——组合可造出永久 completed 僵尸（本轮修的饿死模式的变体）；③ expire 窗口有上界而 verifier 取数无上界——迟复源会被 expire 排干但 verifier 本可验证（方向上哪个更诚实是设计决策：verifier 无上界取数本身可疑）。**四项互相纠缠，piecemeal 修会引入乒乓/僵尸循环，列为一个整体重设计项**。今日风险低：backlog 已排空、26k verified 池健康、restore 只在重启时跑一次。
  → **已由 round-114 整体重设计关闭（commit 7443ba0，详见 §九）**：共享 `windowHasActualsBarSql()` 谓词（expire=NOT EXISTS / restore=EXISTS，authoritative-source 对齐 verifier）、restore 转 6h 常驻 + per-ROW 决策、verifier 取数加窗口上界。
- **A1-4（Medium）findMany 全量拉取 60d verified 行进 Node**：round-104 已谴责的反模式重现；当前 26k 行×每 30min 一次实测可承受（无索引支撑是次要问题）。根治需 SQL 侧 percentile_cont 重写聚合，单列批次。
  → **已由 round-114 关闭（commit dbeadb5）**：单条 $queryRaw 完成残差提取/行数门槛/顺序统计量，Node 仅剩 q∈(0,1) 闸门；生产实证 8 模型（26,666 行）不变。
- **A1-6/A1-7/A2-2/A2-3/INT-1（Low/latent）**：无 stampede 守卫、不可达的 clamp、重复 modelId 求和、池化口径、Redis 双写者 shape/TTL 不一致——均为潜伏项，随上述重设计一并评估。
  → **round-114 处置**：A1-6 已加 single-flight 守卫；INT-1 已统一（共享 TTL 常量 + 完整 shape）；A1-7 复核为**可达**（行计入门槛但残差全无效的退化场景）→ 保留为防御；A2-2 复核**无双重计数**（SQL 聚合单桶）；A2-3 池化口径维持文档化设计限制。
- **A3-5（Low）horizon≤0 无 DB 约束**：现无写入方可达；若做验证环重设计则加 CHECK 约束。
  → **已加（round-114 迁移，双库应用，0 违规行）**。
- **A3-6（Low）raw SQL 未声明 UTC 假设**：PG 会话时区恰为 UTC 才正确；重设计时显式 `AT TIME ZONE 'utc'`。
  → **已显式化（round-114：expire/restore 的 NOW() 全部改 `(now() AT TIME ZONE 'utc')`）**。

### round-113 提交清单

`64be16e`（未用 import 清理）、`3bb737d`（conformal 加固 + 5 修复 + 5 测试）+ 本文档提交。backend 909 → 914 全绿（+5 全为新测试，无删减）。

---

## 九、round-114 待办清空轮（2026-08-21，"完成能独立完成的所有待办项"）

> 用户指令：完成前几轮记录在案、无需用户决策即可独立完成的全部待办项。6 个提交（`7cb9a9c`→`87cf1ec`），51 文件，+883/−1492（净 −609）。每批独立门禁（tsc + 全量测试 + build + restart + live 验证）。

### 完成清单（含生产实证）

| 批 | 内容 | 提交 | 实证 |
|---|---|---|---|
| ops | mt.service 安装启用（重启自愈）；pm2-logrotate 卸载 + 根依赖删 | 7cb9a9c | systemctl enabled；resurrect 零扰动（同 PID/计数）；3 服务 online |
| backend | TD-2 organizations 移除（迁移双库） | c6cba18 | organizations 表不存在；datasets 401 正常鉴权 |
| backend | A1-4 conformal 聚合整体 SQL 化 + A1-6 single-flight + INT-1 双写者统一 | dbeadb5 | tsx 直跑生产库：8 模型（26,666 行）、q 0.027–0.299，与 JS 版模型集一致 |
| backend | A3-1~4 验证环整体重设计 + A3-5 CHECK + A3-6 UTC + mape 溢出修复 | 7443ba0 | 部署日志：restore 复活 204/501（per-row 修正过度复活）；卡死行 5b9a4d7e 终于 verified（mape 9537.59，原 Decimal(5,2) 溢出死循环） |
| repo | TD-15 部署描述归档 deploy/attic/ | 662adfb | CI/deploy.sh 引用复核 0；活文档指针更新 |
| frontend | button/card 双实现收敛（内联基座）+ apiFetch 去重 | 87cf1ec | tsc 0 错、297 tests、build ✓、live 200 |

### 过程中发现并修复的额外真 bug

1. **mape Decimal(5,2) 溢出死循环**（生产日志 10:11 实证）：MAPE≥1000 的行每 6h 验证失败重试。迁移改 Decimal(8,2) + 写入 clamp 99,999.99，卡死行已 verified。
2. **后端跑 dist 而非源码**（ecosystem `dist/server.js`）：前几批 restart 未带 build，旧代码仍在运行——本轮补 build 后全部上线。教训已写入本节（backend 批次门禁必须含 `pnpm build`）。
3. **测试库与生产库分离**：vitest 连 mt_test（test-setup.ts 强制拒绝 mt_db），迁移必须双库应用——本轮两份迁移均已双库执行。

### 明确不做/仍开放（不可独立完成）

- **P0 beef_cut_prices 数据回填**：需用户提供 CSV（运营事项，/beef/import 已就绪）。
- **lagged-exog 实验**：产品/研究决策。
- **TD-8 剩余 38 处裸 fetch**：含 9 处 mutation 与刻意吞错站点，需逐站点评估（round-94 结论维持）。
- **mt.service 文档行 `Documentation=` 占位 URL**：脚手架原样，非功能项。

---

## 十、round-115 候选执行轮（2026-08-21，"推送，然后完成候选项"）

指令链：round-115 评估（PROJECT-ASSESSMENT §九）产出 6 个深化候选 → 用户指令执行全部候选 + 推送（73 提交先行上远端）。6/6 完成，各批 tsc + 全量测试 + build + PM2 重启 + live 验证 + 独立提交：

| # | 候选 | 提交 | 生产实证 |
|---|---|---|---|
| 6 | 诚实性快修包：4 组死链 404 清除、假 "WebSocket server ready" 日志删除、INFERENCE_TIMEOUT 接线（原为死配置）、REDIS_ENABLED/SCRAPE_INTERVAL_MINUTES 删除（含各自 2 个死旋钮自测） | `c0bb2b6` | — |
| 1 | 模型注册单一事实源：/models(model_ids) 派生 backend 验证清单，SEED 兜底冷启动，hourly sync + drift/curatedMissing 告警；VALID_MODELS 手工副本（7 vs 9 已漂移）删除 | `6a9172f` | 启动 +35s 日志 `🔁 Model registry synced: 9 ids, no drift` |
| 2 | upsertPrice 量纲护栏（>20× 近 30 点中位数拒绝，<5 点豁免）+ getModelAccuracy 单条 $queryRaw 均值+中位数双算（last7d/30d 改中位数）+ modelQuality 权重/淘汰线改 robust 统计 + 前端 4 入口归一 headlineMape | `78a3beb` | wheat 修复后 chronos 均值 1.36-1.49 / 中位 0.82-0.86（原 46-59） |
| 3 | 主动告警：dataDigest 每日纯函数决策（数据断流或 24h 摄取错误才发信；常态休眠不扰）+ sendOpsEmail 复用 SMTP + OPS_ALERT_EMAIL 未配置则 no-op | `38090bf` | +60s 日志 `[data-digest] OPS_ALERT_EMAIL not set — ops digest disabled (no-op)` |
| 4 | 部署单一入口：deploy.sh 补 prisma generate + **migrate deploy**（原缺失，round-114 教训）成为唯一实现，CI 内联副本删除改调它；AUTOMATION-STATUS 3 处漂移修正（7→8 jobs、§八部署描述、§五测试数） | `c8e9ad9` | bash -n + YAML parse（全量执行留给下次真实部署触发） |
| 5 | fetch 三层归一：apiFetch 重写为唯一客户端（path 契约 + authFetch 核心：Bearer/cookie/401 清理），swrFetcher/beefFetcher 变薄委托；8 处机械 GET 站点迁移；刻意保留清单见提交说明 | `bac0afd` | tsc/build 过 + 重启后全页 200/307-login 无 5xx |

**生产数据操作（随候选 2，已记入提交说明，2AM 备份可回滚）**：wheat_cme 2026-05 两条 ¢/bu 行除以 100 归一（6.645/6.633，与 8 月 $/bu 序列 6.68-6.92 无缝衔接，metadata 记 unitNormalized）；52 条污染 verified 行转 stale（沿用 round-41 invalidatePolluted 语义）。取证结论：**cme 源 5 月按 ¢/bu 写、8-13 起改按 $/bu 写**——同源中途换量纲，护栏已防复发。

**评估修正（诚实记录）**：round-115 评估 §9.6 第 5 条 "Badge/Tag 双实现" 系 agent 误报——Tag 是状态胶囊（23 使用方）、Badge 是通知计数角标（1 使用方），语义不同，**不做收敛**；agent 报前端 43 页系漏数（实测 44）。

**测试基线**：backend 919→931 pass +1 skip（新增 14：registry 同步 6 + 量纲护栏 3 + 中位数回归 1 + digest 4；删除 2：REDIS_ENABLED 死旋钮自测）、frontend 297 恒定、inference 60 未动。AGENTS.md Prisma 模型数 31→30 已修（round-114 删 organizations 后漂移）。

**仍开放（不可独立完成/产品决策）**：P0 beef_cut_prices 回填（等用户 CSV）；lagged-exog 实验；TD-8 刻意保留站点（login/register POST 等逐站点语义）；资讯 RSS 接入（M3）。

---

## 十一、round-117 代码组织深化轮（2026-08-21，"认可"架构评审后执行）

**背景**：用户问"大幅降低文件数量是否有利"。improve-codebase-architecture 评审（HTML 报告 `/tmp/architecture-review-20260821-filecount.html`）结论：文件数是错误目标（397 文件中 47% 是框架约定/测试并行/爬虫隔离的结构产物，可动池 <5%），正确目标是**深模块/locality**。用户认可后按 Top recommendation 顺序执行 4 批，每批 tsc+全量测试+build+PM2 重启+live 验证+独立提交：

| # | 改动 | commit | 验证 |
|---|---|---|---|
| 1 | 删 3 个实测死文件：ForecastTrendChart（round-106 起仅存于注释）、backfillFred（package.json/ecosystem/CI/scripts 零引用）、frontend types/index.ts 死 barrel（0 处 `from "@/types"`）——−390 行 | `f131707` | 双端 tsc/jest/vitest/build 全绿；重启后 /health 200 |
| 2 | zod schemas 4→1：schemas/{common,datasets,models,anomalies}.ts 合并为单文件 schemas.ts（131 行，导出不变，注释保留 round-106 horizon cap 说明）；测试移 src/__tests__/schemas.test.ts；9 个消费文件 import 改写 | `8b8ff00` | 931+1 skip；重启后 /api/beef/by-country（公开 schema 消费链）200 |
| 3 | alerts 三件套合一：alert-types(92)+alert-rules(339) 并入 services/alerts.ts(677)，消除半 barrel（原 alerts.ts 头部 re-export 行）；server.ts/测试 import 改写 | `792d1c1` | 931+1 skip；重启后 /api/alerts 401（模块链加载）+ 日志无错 |
| 4 | beef services 6→2：写入侧 beefIngest.ts(import+bridge, 395 行)、读取侧 beefQueries.ts(aggregation+cutSeries+trends+freshness, 409 行)；消费方 routes/beef、server.ts、tradingSignals、predictionCache、mapeTracking + 5 测试改写，重复 import 语句合并 | `25eb6a4` | 931+1 skip；/api/beef/by-country 200、/api/market/commodities 401（链路活） |

**量化结果**：前后端 TS/TSX 文件 397→385（backend 202→192、frontend 195→193，−3.0%）；整轮 37 文件 +1161/−1696（净 −535 行，主要来自 3 个死文件）。**测试基线零回退**：backend 931 pass+1 skip、frontend 297 恒定（batch 1 验证后无前端改动）、inference 60 未动。

**明确不做（评审否决清单，防后续重提）**：合并 19 爬虫（失去单源故障隔离）；合并 118 个测试文件（vitest/jest 按文件并行，文件数=并行度）；合并 20 路由（AI 代理上下文加载单元劣化）；page.tsx 无法合并（App Router 约定）。beef.ts(790)/mapeTracking(1027) 等 ≥600 行大文件是反向问题，本轮未碰。

**未做（观感收益为主，评审列为 Worth exploring 不单开轮次）**：~10 个单函数微文件（auth-types、animations、ErrorBoundaryWrapper、usageService 等）归并；seam 类薄委托（lib/beef.ts 19 处引用、swr-fetcher）刻意保留。

---

## 十二、round-118 规划执行轮（2026-08-22，探查→规划→落地）

**背景**：全项目探查 + 状态分析 + 后续开发规划（同日早些时候）。Phase 0 四项决策按规划建议默认值执行（数据策略 CSV+代理并行、datasets/timeseries 簇冻结不新增功能、自动部署暂缓、M3 范围=RSS 接入+品牌诚实化）。可工程化批次共 5 个，每批 tsc + 全量测试 + build + PM2 重启 + live 验证 + 独立提交：

| # | 改动 | commit | 验证 |
|---|---|---|---|
| 1 | TD-8 mutation 收敛：9 处 POST/PATCH 裸 fetch 迁入唯一客户端；ApiFetchError 扩展（status + 错误 body + 三种错误形状消息提取）；authFetch FormData 跳过默认 Content-Type | `2c6def7` | jest 30→31 套件 / 297→304；tsc/build 清洁；live /login /register /apikeys 200 |
| 2 | M3 RSS 资讯接入：services/newsRssIngest.ts + news-rss-ingest 调度作业（6h）；fast-xml-parser 5.11（唯一新依赖） | `0d758d0` | vitest +8（939+1 skip）；live 首跑 +15 篇、重启复跑 +0（sourceUrl 去重幂等实证） |
| 3 | 核心 hook 测试：useTradingData（3 场景：装配/beef 模式/信号错误）+ useBeefCutForecasts（2 场景） | `e978192` | jest +5（33 套件 309） |
| 4 | Tier1 爬虫源级测试：commodityPrices / fredData / dceFutures 各 4 场景（源级覆盖 3/19→6/19） | `887a906` | vitest +12（92 文件 951+1 skip） |
| 5 | 品牌诚实化：site-stats dataSources 7→19（实测口径）；about Chronos 主力口径修正；3 个死按钮清除（Contact Us / Contact Sales / View Documentation） | `afe2a55` | build 清洁 + live 渲染断言（Contact Us 0 匹配、19+ 上页、Create Free Account 在） |

**Phase 1（数据供给）实测结论（证据全文入 KNOWN-ISSUES D1）**：网络经 mihomo 出口实际可用（beefcentral/fred/mla/federalregister 200），与 D1 历史根因"网络出口封锁"已部分脱节；但 `.env` 中 MLA/USDA_MARS/OPENWEATHER 三把 key 为空串、FRED_API_KEY 缺失——**源复活卡在 key 获取（用户动作），代码侧端到端就绪**。无 key 国际源连接层通（USDA-PSD 404 / Comexstat 403 / CEPEA 301 均为应用层响应），空转归因于解析/数据语义；ABARES 源站不可达（直连+代理均 000）。逐源深挖 ROI 低且属运营决策，本轮仅记录证据。

**测试基线**：backend 92 文件 **951 pass + 1 skip**、frontend 33 套件 **309 pass**、inference 4 文件 **60 pass**——合计 **1320 全绿**（round-117 基线 1288），零回退。

**仍开放（不可独立完成/待用户动作）**：P0 beef_cut_prices 历史回填（等 CSV 数据）；MLA/USDA-MARS/FRED/OPENWEATHER key 获取（fred 缺整行，其余空串）；lagged-exog 实验；TD-8 剩余 ~29 处 GET 裸 fetch（低优先）；社交证明的完整形态（等用户基数）。

---

## 十三、round-119 缺陷深挖 + 修复轮（2026-08-22）

**背景**：用户指令「继续深入探查项目的缺陷」→ 全仓四路只读审查（后端正确性 / 安全 IDOR / 前端 / 推理+调度，子代理各带已知清单跳过既登记项）+ 运行时日志扫描 + 生产库完整性审计。在既有台账（KNOWN-ISSUES D1-D3/R1-R4、TD 全部条目、round-106/107 遗留清单）之外确认 **~40 项新缺陷（9 高/14 中/17 低）**；高严重度逐一直接取证复核，推理侧 2 项 TestClient 端到端复现。随后用户指令「开始修复」，按安全→稳定性→数据→加固 4 批执行，每批 tsc + 全量测试 + build + PM2 重启 + live 验证 + 独立提交：

| 批 | 内容 | commit | 验证 |
|---|---|---|---|
| 1 安全 | anomalies 域 4 函数属主化（list/get/stats/detect 曾零用户过滤——跨用户枚举私有异常与 context 数值、对他人序列写异常+翻检测开关+借 Alert 回读数值）；models 域 list/get/forecasts trainer-or-ADMIN（曾泄漏全员 trainer 邮箱）+ predict 写入属主（与 setModelActive 同规）；/detect 加 aiRateLimiter | `3890eb1` | +11 测试（跨用户 404/列表过滤/ADMIN bypass/无写入守护）；live 401 门不变 |
| 2 稳定性 | predictionCache 4 处 getRedisClient 容错（契约是 throw 非 null，`if (!client)` 是死代码；缓存写与 logPrediction 隔离——Redis 宕机曾丢已算预测+停写 MAPE 行）；getPriceHistory desc+take+reverse（曾返回最旧 N 行）；errorHandler 按 status 分类 ApiFetchError（4xx 曾重试 3 次）；useTradingData 切换清理 deps | `6274464` | +9 测试（含 Asia/Shanghai TZ 钉死场景）；live 双端 200 |
| 3 数据 | cmeFutures Yahoo bar `setUTCHours`（曾本地时区截断→session D 存成 D-1，周日 bar/周五缺失）+ OHLC 占位 guard；生产修正 100 行 +8h + 3 行 cotton OHLC（备份 `backups/round119/`） | `d109af4` | boot runAll 0 inserted/10 updated 按正确键命中；SQL 复核 0 周末 bar、0 OHLC 违例 |
| 4 加固 | 推理输出有限性 guard（NaN 区间 null 穿透 + batch 整批 500 + 置信度=1.0）+ LinAlgError→503；winston 三参日志序列化；boot ingestion 分类器；订阅调度 6h 重跑；RSS slug hash8 兜底；beefIngest 回滚计数；前端 9 项 | `a6d810c` | inference 60→64；三服务 online；/ready 200 |

**测试基线**：backend 951+1→**974+1**（94 文件，含决策执行批 +3）、frontend 309→**314**（33 套件）、inference 60→**64**——合计 **1352 全绿**，零回退。

**误报复核记录（防重蹈）**：探查轮报「beef_cut_prices 960 组重复/1440 多余行」——修复前预检发现按 (cutCode,date,source) 分组漏了 **factoryId 维度**：三行分属 AU-847/239/1260 三个工厂的合法同价报价（seed 生成器同组同价），按 (cut,date,source,factory) 分组重复数为 **0**、无价格冲突组。**撤销该项，未删任何行**。教训：去重判断必须先穷举行的全部业务维度。

**仍开放（round-119 已登记未修，按处置类型）**：
- ~~**产品决策**：注册默认 `role:"EDITOR"`~~ **已处置（round-119 决策执行，commit `1073acc`，2026-08-22）**：注册默认改 **VIEWER**（EDITOR 的资讯发布权不再随注册发放，编辑角色由管理员指派）；AI 分层闸改 **env 门控 `AI_TIER_ENFORCED`（默认关）**——PRODUCT-SPEC §九 明确付费墙/AI 分层"留待用户基数到"，且当前无任何升级通道，默认强制会把每个新注册者锁死在核心价值链外；闸结构保留、真实付费层落地时一个环境变量即可武装。同批清理生产库 **1796 个集成测试残留用户**（concurrent-N@example.com / idor-*.x.com，0 真实注册者）+ 1798 sessions + 1 残留 dataset（备份 `backups/round119/test_residue_*`），用户表回归 seed 三人组。live 实证：注册→VIEWER、AI 端点对 VIEWER 200、POST /api/news 403。+3 测试（974+1 skip）。
- ~~**设计权衡（单列轮次）**~~ **已处置（round-119 权衡批，commit `739d375`，2026-08-22，用户授权按"最合逻辑+尽量简化"决断）**：runAndCachePrediction 增加 **in-flight 去重**（按缓存键共享一次计算 + 一次 logPrediction——并发 miss 曾双写 prediction_logs 污染 MAPE 分母；键与 Redis 缓存一致故忽略 confidenceLevel，与既有缓存语义相同）；推理客户端**超时不再重试**（AbortError 直接 503——超时=服务已接连接但饱和，重试双倍等待+加倍负载；ECONNREFUSED 类快速失败保留单次廉价重试）。**负缓存明确不做**：需引入失败标记缓存族 + 读路径形状映射，复杂度大于收益（去重+免重试已限界，失败不记忆、下一调用方即重试）。同批对齐 **billing/pricing 文案**与开放阶段现实（"Free=3 AI models / Pro=All 7 / Paid tiers unlock AI" 均为失实口径 → 明示"当前对所有注册用户开放"，过期计数 7 修为 9）。
- ~~**低优先加固**~~ **已处置（同 commit `739d375`）**：datasets import valueColumns 上限 50（超出 400，防列数扇出）；alerts rules 的 timeseriesId 验归属/存在（非属主与不存在同 404，沿 round-119 属主化惯例）；`GET /api/market/sources` 剥离 scraper 原始错误串（cacheRoute 全用户共享缓存下按角色分支不可行；status 枚举已是故障信号，细节走 PM2 日志；前端 data-sources 板对应渲染块同删）；useDashboardStats 去掉 `/api/alerts?limit=5` 双请求（与 limit=100 同一首页数据，切片即可，每次 dashboard 少一次网络请求）；beefIngest `MM/DD/YYYY` 斜杠日期显式 UTC 解析（原按服务器本地时区，TZ=+08 退一天；越界分量如 02/31 拒绝而非滚动成合法日期）。验证：backend 974+1 → **990+1 skip**（96 文件）、frontend 314、inference 64；live 三项（plans 文案 / sources 0 error 字段 / ghost 规则 404）+ 三服务 200。

---

## 十四、round-120 完整度审查轮（2026-08-23）

**背景**：用户指令「重新审查项目的完整度」。与缺陷挖掘轮不同，本轮核对**承诺 vs 实现**——4 只读子代理（PRODUCT-SPEC 符合度矩阵 / 前端 44 页逐页 / 后端 143 端点全查 / 数据-推理管线五段）+ 运行时与生产库取证。总体判定：**骨架完整、数据贫血**——价值链五段代码无断点、44 页 0 死链、spec 51 条承诺 ≈90% 达成；但核心数据（beef_cut_prices）100% 冻结于 2026-04-30（16/74 cut 有过数据、0 新鲜），真实用户 0（3 seed 用户、0 datasets/timeseries/rules）。

**已处置（round-120 快修批，commit `398ad98`）**：
- **timeseries 编辑断链**：`/timeseries/edit/[id]` 一直提交 `PATCH /api/timeseries/:id` 而该路由从未存在——每次编辑保存必 404（API.md 还写着它，三方漂移）。补齐路由（属主或 ADMIN、同 404 惯例；datasetId 迁移仅限本人 dataset；slug 改名查重），+9 集成测试。
- **`/beef/cuts` 死路由**：spec IA 点名的 URL 404（只有 `[cutCode]` 详情页）。加 redirect → `/beef`（primal 分组看板所在地），不复制页面。
- 营销导航三处：Footer `/#features`/`/#faq` 锚点永远落空（`/` 是会丢 hash 的客户端重定向）→ `/landing#features`/`#faq`；MarketingNav "Sign In" 直指 `/login`（不再借 middleware 弹回）。
- **watchlist 虚假卖点移除**：pricing 页与后端 billing PLANS 的 "5/50 watchlist items" 删除——watchlist 后端+SWR lib 完整但**零页面消费**，不卖无入口的功能。
- 顺带修时间炸弹 flaky：marketService.freshness 测试依赖 mt_test 里的种子 ingestion_logs，2026-08-23 恰好老化出 7 天窗口隔夜翻红——改为测试自播种窗口内 fixture。

**文档对齐（同轮）**：API.md 1.3.0 → **2.0.0 全量重写**（旧版 9 个幽灵端点 + 5 处方法/路径错误 + ~95 个未记载；新版按 app.ts 实挂载 20 router/144 端点，标注 API-only 组）；PRODUCT-SPEC §七 修订两处失真（socket.io "✅已具备"→ 已于 round-112 移除；资讯 RSS "未接入"→ round-118 已接入）+ IA 表 /beef/cuts 注明重定向。

**仍开放（按处置类型登记）**：
- **产品决策（建 UI or 收敛）**：~~watchlist 前端页面（后端 7 端点 + lib/watchlist.ts hooks 现成，唯一缺口是页面/入口——真实用户出现前建它无消费对象，暂缓）~~（**已建 round-126 `dd91b88`（D1）**：`/watchlists` 最小页 + `useWatchlists` hooks 消费既有端点；`lib/watchlist.ts` 系 round-124 删除的死文件，未原样复活而是按现约定重建）；顶栏搜索（现为 "Planned" 徽章，接线需后端搜索端点）；顶栏用户菜单（登出仅在 dashboard 页内）。
- **孤儿端点收敛候选（~~65 个无前端消费，不删只登记——"不删非己所造"惯例~~）**：~~整组无消费 `/api/models`(8) / `/api/security`(3，audit 上报端点前端从未发送) / `/api/analytics`(2)~~（**已删除 round-132（D6 处置，2026-08-30，"继续完成剩余的任务"指令）**：五问重评后三组同批移除——`/api/models` 8 端点连带 `modelService.ts`（其唯一消费者即该路由；timeseries.ts 的引用仅注释）与 schemas 三条 ML 校验；`/api/analytics` 2 端点（correlation 是 `/api/signals/correlation` 之外的第三套实现——分析页 live 消费的是 signals 版，seasonality 0 消费且 PRODUCT-SPEC 无规划）；`/api/security` 3 端点（audit 上报前端从未发送）。schema 与数据保留（休眠表见下条）。live 404×3 + `/api/signals/correlation/matrix` 200 验证；测试 1036+1→1002+1（-34 = 随组删除的 29 条文件内测试 + 5 条散落引用，零失败）；API.md 20 router/142 端点 → 17/131，AGENTS.md 同步）；~~watchlists~~/~~portfolios~~ 写路径（**watchlists 已有页面消费（round-126 D1）**；~~portfolios 组仍 0 页面消费，维持登记——D6 建议不动~~ **已删除 round-140 D3（"继续剩余事项"指令）：路由组 7 端点 + 测试 + Portfolio/GroupMember 两表一并收（0 行数据、0 前端消费，备份同 D2；live 404 验证）**）；~~`/api/inference/predict/batch` 与推理服务 `POST /predict/batch`（批量能力两端闲置，维持登记）~~（**已删除 round-140 D3 同批：两端 + 各自 batch 测试（backend 随组 -13、pytest 66→61）；Python 端有限值守卫及其测试保留（单预测同样依赖）**）；~~`/api/market/import`+`/preview`（无消费且无路由测试，双重孤立——若要保留需补测试，否则收敛候选）~~（**已删除 round-124 `d21de3a` 后续提交**：用户瘦身指令下按登记处置，连带 manualImport 服务与其 7 测试同批移除，live 404 验证；数据回填走 `/api/beef/import` 不受影响）。
- ~~**round-132 登记——D6 删除后休眠表（schema 清理延后，单列轮次）**~~（**已解决 round-140 D2（2026-08-30，"继续剩余事项"指令放行数据治理决定）：先定向备份 `backups/round140-d2/dormant-tables.sql`（生产实测行数 forecasts 0 / forecasting_models 0 / security_audit_logs 49——预测脚手架表从未离开过 seed 环境）后，迁移 20260830213000 一次性 DROP 三表 + 孤儿枚举 ModelAlgorithm，生产与 mt_test 均应用、live `pg_tables` 复核为空；seed 相应段（模型/预测点播种、25 行安全审计夹具、MODEL_DEFS、汇总行）整体摘除；`getUserProfile` 去掉 models 计数（无消费方）。**原登记：`SecurityAuditLog`（49 行历史数据，删组前唯一代码读写方即已删的 `/api/security` 路由）、`ForecastingModel` + `Forecast`（多租户模型脚手架表，唯一代码面即已删的 `modelService.ts`）——数据保留不删、schema 迁移删除属数据治理决定需用户点头后再动。**
- **round-132 定案——IMPROVEMENT-PLAN D7 关闭（保留数据，2026-08-30）**：prediction_logs 中 sundial/timer_xl 幽灵行（~332 行）**保留不删**。结构性隔离此前已验证并钉住：`computeAllModelAccuracy` 按现行注册表枚举（mapeTracking.ts）+ signals 详情路由 R3 守卫 + 批 8 测试钉住（days=30/90 实测均不出现）。删除属数据治理决定，如未来用户明示删除再单列轮次执行（连带休眠表同批评估）。
- ~~**round-132 登记——`predictionBeefCoverage24h` 对月度节律结构性眨眼（0/1 指标）**~~（**已解决 round-139 批4-D4，2026-08-30**：口径改为 `predictionBeefCoverage90d`〔覆盖窗 24h→90d，月度一轮 + 60d 验证冻结窗〕+ 新增 `predictionBeefLatestAt`〔末轮日志时间戳，运维直接看到"上次是何时"而非 0/1〕；同改 health 路由类型与 cron-healthcheck 暴露行；回归钉 = 30 天前的 beef 日志必须计入〔旧口径下该场景读 0〕；live 验收 /health/ready 返回 coverage90d=3 + latestAt）。原登记：该健康检查计数"beef_cuts 类目商品 24h 内有 prediction_logs 行"——由于 cut 序列用合成 `cut:` 键不入 commodities 表，实际唯一能推动它的是 `beef_carcass_us`（月度）。月度序列一月只落一轮日志（ADR-0001 ④），故该指标在两次发布之间的 ~29 天里诚实但误导地读 0（2026-08-30 实测：末轮日志 08-24 → 0；预测缓存本身持续保温）。
- **UI 细节缩水（spec §5 承诺 vs 实现）**：dashboard 热门部位表缺"涨跌"列（数据冻结期会全显 "—"，等数据新鲜后再补更有意义）；cut 详情展开缺置信区间可视化（现为文本 Range）；~~`/ai/predict` 模型下拉硬编码 8 项且预填测试路径 `root.test2`~~（**已解决 `283c685`，round-122 批 4**：下拉改调 `/api/inference/models`（引擎单一事实来源，不可达时诚实禁用）；预填 `root.test2`→`beef_carcass_us`——旧默认匹配不到任何 commodity，表单提交必 400）。
- ~~**空壳页**：`/settings/sessions`（诚实占位，需 GET/DELETE /api/auth/sessions 后端）；`/settings/notifications`（localStorage-only，需邮件系统支撑——与 SMTP 空配置同命运）~~（**已删除 round-124 `b53b20a`**：用户瘦身指令下按登记处置——页面承诺的功能后端不存在且无规划，留着只会教用户点到空页；settings 集线卡/快捷入口/e2e 同步移除；需要时按 git 历史重建）。
- ~~**价值叙事注意（非工程项）**~~（**已处置 `72f180e`+`39a13cc`，round-122 批 1/3**：营销口径全面改为"9 模型引擎、质量加权共识、劣于 naive 淘汰"（Hero/FAQ/Features/about/pricing/QuickActions/site-stats）；引擎侧扩池 3→7 使淘汰线真正咬合——执行中发现更多一层事实：原池为 chronos-only，三模型全触发淘汰线后落入等权兜底，淘汰机制空转，详见 COMPETITIVE-ANALYSIS §三.3 三次修订。此条从"叙事谨慎"升级为"叙事与引擎一致"）。
- **round-127 深度审计发现（2026-08-23，方向符合性 debug）——月度序列未进预测链（决策项）**：round-126 后全站唯一真实牛肉序列 `beef_carcass_us` 为月度（PBEEFUSDM），但后台预测环整条按 daily 假设硬编码：`predictionCache.ts:483/544` 订阅门控"7 天内 ≥2 条 daily 价格"（月度序列永远不满足→静默退出订阅，订阅数 18→17 已实测）；`mapeTracking.ts:326/409/739` 验证取 actuals 仅查 daily；`correlationAnalysis.ts:59`、`analytics.ts:91` 相关性仅 daily；`marketService.getCommodityFreshness`（:242）新鲜度板仅 daily。**方向张力**：核心价值链"数据→推理→信号"断在唯一真实牛肉序列上。按需路径（/ai/predict、visualize、anomalies）round-127 已加 monthly 回退修复；后台订阅/验证/相关性需先决策月度语义（horizon 步长=月？验证窗口？MAPE 口径），不擅动。on-demand 修复：`data-fetcher.ts` 回退 + `inference.ts` 三处 `fetchHistoryWithFallback`。
  > **进展（2026-08-23 round-130，第二波执行）**：语义已定稿为 ADR-0001（**Proposed，待用户确认**，`docs/adr/ADR-0001-monthly-series-prediction-semantics.md`）；批 6a 已落地 `dd0eaeaa`（`cadence.ts` 阈值策略模块 + freshness 板 interval 感知——`beef_carcass_us` 现显示 monthly/2026-07-01/非 stale）；连带修复：价格历史月度回退 + 共享 `batchLatestPrices` 月度回退（批 7 `e33956b`）。
  > **~~剩余 = 批 6b/6c~~（已解决 round-131，2026-08-24：`43984cd` + 批 6b-2/6b-3 + 批 6b-4 + `397a86f`）**：ADR-0001 用户确认 → Accepted；订阅门控月度谓词落地（live：15 daily + **13 monthly** 序列订阅，beef 首轮 7 模型 × 1 行、forecast_start_at 2026-07-31）；验证生命周期四轮扫描全部节奏感知（到期/实际值窗按步长、Pass A/B 按 (commodity,cadence) 分组 + 月度 60 天冻结窗、expire/restore SQL CASE 分流）；刷新节律 = 新实际点守卫（二次请求/重启重算/缓存过期均零日志增长）；cadence 元数据端到端（CachedPrediction 三写方同 commit + signals/inference/visualize 透传 + 前端"未来 N 个月"）；受控 live 验收：回填月度行穿越全部清扫 → **verified MAPE 0**（`scripts/verify-monthly-lifecycle.ts` 可复跑），`predictionBeefCoverage24h` 0→1。**遗留（显式不做/另登记）**：`correlationAnalysis.ts:59` 相关性仍 daily-only——ADR-0001 Non-Goals（跨节奏对齐无解，等日更牛肉数据解锁；原同列的 `analytics.ts:91` 已随 round-132 D6 删除该路由组而消失）；`watchlistService.ts:134` 本地副本见下条登记（round-132 已解决）。
- **round-127 深度审计发现——/trading 牛肉模式默认空序列（小缺陷）**：`useTradingData.ts:85` beef 模式自动选中 `beef_cutout_us` 作为 AI 信号上下文——该商品 **0 条价格行**（2026-08-23 实测），`GET /api/signals/beef_cutout_us` 返回 **500**（`getCommodityPriceValues` 0 点 throw 未被路由捕获）；前端有诚实降级（"AI signal unavailable"）但服务端 5xx 不当。正确默认应为 `beef_carcass_us`（195 点真实牛肉基准）+ signals 路由对空序列优雅返回空信号而非 500。既有问题（round-126 前即如此），登记待处置。~~（**已解决 round-130 `e33956b`（批 7）**：默认换 `beef_carcass_us`；价格拉取月度回退使信号面板真正出图（对抗评审发现仅换默认仍空白）；signals 空序列 200 + `insufficientData`；live 四项验证）~~
- **~~round-130 登记——`watchlistService.ts` 本地 `batchLatestPrices` 副本仍 daily-only~~（已解决 round-132 `15b2af9`）**：共享版（`inference/authoritativeSources.ts`）批 7 已加月度回退 + interval 字段，但 watchlistService 在 `:134` 留有独立本地副本（daily-only DISTINCT ON），`listWatchlists`/`getWatchlistQuotes` 经它取最新价——月度序列（`beef_carcass_us` 等 world_bank 组）在自选清单页仍显示"（暂无价格）"。~~处置建议：删本地副本改用共享 helper（行为对齐，~15 行）。非本轮批 7 范围（外科手术边界），登记待下批。~~（**round-132 执行**：本地副本删除改用共享 helper（`listWatchlists` 传 `{id,slug}` 对）；`batchRecentPricePairs` 同样补月度回退（rn≤2 monthly——quotes 的 change 对月度序列即环比）；+2 集成测试（list/quotes 各一，自建 fixture）；live 验收 `beef_carcass_us` quotes 331.78/环比 -2.87%/2026-07-01、list latestPrice 同步出值，探针条目即验即删。）
  > 注：原登记只点名 `:134` 副本，但同一症状的另一半在 `batchRecentPricePairs`（quotes 路径同样 daily-only、页面取价优先走 quotes 端点 `q?.price ?? item.latestPrice`）——只修 list 会让收起态出价、展开态仍"暂无价格"，故两处同批收敛。

**验证**：backend 990+1 → **999+1 skip**（96 文件，+9）、frontend 314、inference 64；live：PATCH owner 200 / 他人 404 / 坏 slug 400 / 未认证 401，/beef/cuts 路由命中（307 经 auth middleware 非 404），pricing+plans 0 处 watchlist 文案，探测数据已清理。

---

## 十五、瘦身轮（round-124，2026-08-23，用户指令："体量不过于臃肿，核心功能最重要"）

方法：双 Explore 全量零引用扫描（前端 111 文件 / 后端全量）+ 依赖审计 + §十四 登记项按用户瘦身指令处置。**结论：代码库已相当紧**——后端零死模块（20 路由全挂载、inac 为登记的休眠源）、前端仅 1 个死文件；臃肿主要在登记过的非核心面。三批处置（每批 tsc+全量测试+build+PM2+live+独立提交）：

| 批 | 提交 | 内容 |
|----|------|------|
| A | `d21de3a` | 前端唯一死文件 `lib/watchlist.ts`（101 行，0 消费者含测试）；后端 5 个零调用导出（batchLatestPriceWhere/dedupeLatestByCommodity/lastNDays/formatDateYMD/getCutMapping）+ 孤儿注释；过期 e2e（整删 trading-subpages.spec 5 条不存在路由 + 3 条死 goto）；未用依赖 cross-fetch/is-core-module/js-yaml |
| B | `8e7248b` | §十四 登记的双重孤立 `POST /api/market/import`+`/preview`（无消费+无测试）删除，连带 manualImport 服务与其 7 测试；**数据回填正路 `/api/beef/import` 不受影响**；API.md 144→142；live 404 验证 |
| C | `b53b20a` | §十四 登记的空壳页 `/settings/sessions`+`/settings/notifications` 删除（功能后端不存在且无规划），settings 集线/快捷入口/e2e 同步 |

**测试口径说明**：backend 1011+1 → **1004+1**（97 文件）——减少的 7 条全部是被删服务 manualImport 自带的测试（删除功能的测试随功能走，非覆盖回退）；frontend **317** 不变；e2e 规格 10→9。合计 **1385 全绿**。

**明确不动（有登记依据或属核心/决策项）**：watchlists/portfolios 后端（D1 决策项，仅删了前端死 hooks，端点保留）；`/api/models`(8)/`/api/security`(3)/`/api/analytics`(2)（产品决策）；`/api/inference/predict/batch`（推理服务侧联动，单列）；inacData.ts（D1 源复活候选，登记休眠）；beefCutNormalizer 的 detectFieldMapping（normalizer 模块活体、有测试）；EDGE Prisma 模型 coldStorage/weeklyKill/usageRecord（牛肉产业链数据，1 引用 LIVE，删除需迁移单列轮次）。

## 十六、冗余清理 + 状态维护轮（round-133，2026-08-30，用户指令："清理当前项目的冗余项，维护项目状态"）

方法：全仓只读审计（backend/frontend 文件级零引用扫描 + 双端依赖逐包 grep + inference requirements 对照真实导入名 + root 工具链），登记项逐条新鲜复核，可删项分三批独立门禁执行。

**审计结论（代码库文件级已经很紧）**：backend src 102 文件零死文件（唯一命中 test-setup.ts 系 vitest setupFiles 误报）；frontend 零引用扫描仅 1 个真死项（其余 9 个命中均为目录导入/框架约定文件误报——middleware.ts、ui/*/index.tsx 经 `@/components/ui/X` 目录导入存活，Skeleton 经 LoadingState 相对导入存活）；依赖面 backend 仅 `pg`、frontend 全部在用（tw-animate-css 与 shadcn/tailwind.css 均被 globals.css 导入）、inference 无可删（sklearn/pandas 系 sktime/statsmodels 硬传递依赖的显式钉版，chronos 为函数内懒加载导入）。

| 批 | 提交 | 内容 |
|----|------|------|
| 1 | `015766f` | backend 删未用依赖 `pg`（全仓 0 引用，raw SQL 全走 Prisma 引擎） |
| 2 | `b3ae606` | frontend 删空壳路由 `src/app/api/web-vitals/route.ts`（37 行 TODO-stub 只 console.log；真实数据汇是后端 `/api/metrics/web-vitals`，前端零调用方；连带 `src/app/api/` 目录清空） |
| 3 | `786b094` | **修复顺带发现的真断裂**：`scripts/user-management.sh` 两处 `require('bcrypt')` 全仓无此包（backend 只有 bcryptjs）——create-admin/change-password 两条密码路径从未能跑通；对齐 bcryptjs（与 authService 同 hash(pw,12)）+ 删 root 残留 `@types/bcrypt`（给从未安装的包的类型） |

**live 验证**：批2 路由删除后 `/api/web-vitals` 直连与经 Next rewrite 均 404、真实 beacon `/api/metrics/web-vitals` 200、首页 200；批3 `list-users` 只读路径实跑通、bcryptjs hash($2a$/12 轮)/compare 与 authService 同参验证；批1 /health+login 200。**测试**：backend **1004+1**（97 文件）、frontend **324**（35 套）均与 round-132 基线逐位一致，零回退。

**顺带登记**：PM2 管理的生产前端不可用 `pnpm restart:frontend`（restart.sh 会拒绝并提示先 `pm2 delete`）——正确路径是 `cd frontend && pnpm build && pm2 restart mt-frontend`（本轮实际操作序）。

**round-106 "死代码类" 登记六项全数关闭**（详见上文该节 2026-08-30 复核批注）——实际清理发生在 round-112~132 各轮，登记文本一直未同步，本轮补记。

## 十七、round-139 顺带登记（2026-08-30，批 3 执行中发现；**已解决 round-142 批 2，2026-08-31**）

**seed.ts 的 beef_carcass_us 身份停留在 round-126 之前**：~~`prisma/seed.ts:2031` 仍是 "US Beef Carcass Price (FRED)" / `unit: "USD/cwt"` + 合成日度价生成（`base: 260, volatility: 8`，180 天日更 seed 行）~~ **已对齐生产（commit `8e94a9a`，v3.3.0 批 2 / D11）**：COMMODITIES 元数据改为 Global Beef Price (IMM via FRED)/全球牛肉价格（IMF 月度）/USC/lb + metadata fred+PBEEFUSDM；合成价改 6 个月度月起点（source fred，替代 180 日行）；baseline 260→330。验收：mt_test --force 重建后与生产逐字段一致；tools.test 的 beforeAll unit hack 与 afterAll 恢复整体移除；backend 全量首跑即绿（1031+1，零回退）。原登记内容保留如下——
~~`prisma/seed.ts:2031` 仍是 "US Beef Carcass Price (FRED)" / `unit: "USD/cwt"` + 合成日度价生成（`base: 260, volatility: 8`，180 天日更 seed 行）~~——影响（历史）：mt_test / CI 全新种子库中该序列的元数据与节奏均与生产漂移（landing-cost 路由测试需在 beforeAll 临时把 unit 改为 USC/lb 并用未来日期 fixture 压制合成行）。

## 十八、round-166 代码质量整治轮（2026-09-19，用户指令："完整整理全项目的代码，提升代码质量，拒绝屎山代码"）

方法：先量化审计基线（biome/tsc/pytest 三端 + TECH-DEBT 全量复核 + TODO/any/抑制标记/console 扫描 + 超大文件盘点），再分批执行，每批 tsc + 全量测试 + live 验证 + 独立 commit。

**审计结论（代码库整体健康，债集中在盲区而非散乱）**：backend src / frontend src biome 近乎全绿；TODO/FIXME/HACK 全仓 **0**；抑制标记 33 处**全部带理由注释**（纪律性使用非气味）；src 侧显式 `any` backend 0 / frontend 4 真实；console 使用规范（错误路径 + 有理由启动日志）；ruff 干净。**系统性盲区一个：`backend/scripts/` 不在 tsconfig include——5 个月无人发现 import-beef.ts 全面腐烂即其代价。**

| 批 | 提交 | 内容 |
|----|------|------|
| 1+2 | `ee9dee8` | 删腐烂 `scripts/import-beef.ts`（引用 round-114 已删的 organizations/organization_members/organization_id_slug + Dataset 已删的 currency/unit 列 + 不存在的 StorageFormat 枚举值——纳入类型检查即暴露 8 个 TS 错误；源 /root/beef.xlsx 已不存在；目标 datasets/timeseries 簇 round-118 冻结；现行回填路径 /api/beef/import → beef_cut_prices；全仓 0 运行时引用）。**系统性修复**：tsconfig include 增 `scripts/**/*`，scripts/ 自此受 pnpm type-check 与 CI 同一门禁（其余 5 脚本纳入后 0 错） |
| 3 | `c78606b` | biome 后端清零：backtest-monthly-series 排序比较器 `median()!` → `?? Infinity`（**顺带修真缺陷**：空 median 行原产生 NaN 比较致顺序不确定）+ useTemplate；indecComex.parse.test `jan!.`×2 → guard-narrow 抛错 |
| 4 | `f839d10` | useTradingData `useState<any>` → `TradingSignal` 镜像类型（权威=后端 PriceForecast；原 biome-ignore 所称 "third-party library type" 不实）。**类型收紧即时暴露 2 处真实契约错位并修复**：ProfessionalChart support/resistance prop 接不住后端 round-106 起的诚实 null（渲染守卫本就 `!= null`，放宽零运行时变化）；individualForecasts 项补 currentPrice（后端必发、面板类型要求） |

**基线**：backend **1169+1 skip**（114 文件）/ frontend **365**（42 套件）/ inference **64** 全绿零回退；biome backend 21→**0** 诊断、frontend 恒 0；双端 tsc 0；build + PM2 + live（/、/login 200，/trading /beef 鉴权门正常，/health 200）。

**登记不执行（后续轮次候选）**：
- **mapeTracking.ts 1538 行**（round-106 时 1027，验证环四轮扫描扩展所致）：round-117"反对按文件数拆分"决策仍有效；如拆须按内聚（expire/restore/verify/conformal 各环）单列设计轮，收益=可读性、风险=验证环行为回归，非本轮范围。
- **3 个 700 行级页面 monolith**（dashboard/performance 713 / alerts/rules 705 / settings/data-sources 702）：可读可测可工作，拆分属观感收益，无用户可见价值，不动。
- **dist 陈旧产物**：~~`tsc` 不清理输出目录，`dist/scripts/` 残留已删脚本的 .js（backfillFred.js/seed.js/import-beef.js 墓碑）。可在 build 前加 clean 步骤根治，但改变构建行为（部署面），单列决策。~~ **已根治（round-170 批0，2026-09-19）**：根因比"不清理"严重——round-166 扩 tsconfig include（+config/+scripts）后 tsc 公共根变为项目根，产物布局静默错位到 `dist/src/…`，而 PM2 固定跑 `dist/server.js`（旧布局）——**round-166 之后至 round-170 之间的 backend 改动从未真正部署过**（round-168 的两行归属是手工回迁入库，非采集器行为；其余改动恰好行为中性未暴露）。修复：tsconfig 显式 `rootDir: "./src"` 回归原 emit 布局 + `rm -rf dist` 全量重建；scripts/config 盲区改由 `tsconfig.scripts.json`（noEmit）+ `type-check` 双门禁覆盖，round-166 的初衷（类型门禁覆盖 scripts）不回退。clean 步骤未加（rootDir 固定后错位不再可能，墓碑随全量重建消失）。
- TD-8 前端 ~29 处 GET 裸 fetch 维持开放（既有登记，低优先）。
- swrFetcher `Promise<any>` 与 Table.tsx render `value: any` **有意保留**：前者带文档化理由（20 处 useSWR<T> 泛型推断点），后者是表格 render 契约。
