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
**审计**：2026-07-06，§3.1
**当时证据**：`lib/api.ts`（SWR，14 文件）、`utils/auth.ts`（authFetch，16 文件）、`lib/market-data.ts`（**axios**，唯一用 axios 的文件，3 文件）、页面内联 `useCallback(fetch)`（~13）、`beefFetcher` **3 份字面复制**（`beef/page.tsx:13` / `beef/factories/page.tsx:10` / `beef/cuts/[cutCode]/page.tsx:11` 逐字节相同）。35 处裸 `fetch()` vs 14 处 SWR 抽象。

### TD-9 — 死 ui 组件 + shadcn 重复对
**审计**：2026-07-06，§5
**当时证据**：死 ui 组件（0 importer）：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx`、小写 `select.tsx`。shadcn 重复：`button.tsx`(1) vs `Button/`(41)、`card.tsx`(3) vs `Card/`(28)、`select.tsx`(0) vs `Select/`(15)。PascalCase 胜出，小写 shadcn 版是死重。

**复核（2026-07-27，修正先前误判）**：`MobileStatsCard.tsx`、`separator.tsx`、`switch.tsx`、`tooltip.tsx` 已删除（4/5 清理）。**小写 `select.tsx` 不是死文件**——它是 PascalCase `Select/index.tsx` 的底层实现（`Select/index.tsx:11` `import { SelectContent, SelectItem, ... } from "../select"`）。12 个页面经 `@/components/ui/Select` → `Select/index.tsx` → `select.tsx` 间接依赖它。删除会破坏整个 Select 组件。先前"0 importer"判断只查了 `@/components/ui/select` 直接导入，漏了相对路径 `../select` 的内部 re-export。**本条 RESCINDED，select.tsx 必须保留。**

### TD-10 — MSW 全套白搭
**审计**：2026-07-06，§5
**当时证据**：`mocks/handlers.ts`（188 行）+ `server.ts`（17 行），`setupMsw()` 被 0 个测试 import。20 个测试里 9 个用 `jest.mock`。

### TD-11 — 双图标库
**审计**：2026-07-06，§5
**当时证据**：lucide（63 文件）vs phosphor（6 文件，仅 marketing 页）。phosphor 近乎 vestigial。

### TD-12 — 双 Tailwind 配置（v3+v4）
**审计**：2026-07-06，§6
**当时证据**：两份 palette 已漂移，维护双倍。

---

## 三、Schema

### TD-13 — 死/伪模型
**审计**：2026-07-06，§4（按 `prisma.<model>` 查询点数）
**当时证据**：
- `organization_members`、`saved_queries`：**0 代码引用**（死模型）
- `organizations`（硬编码 default-org）、`coldStorage`、`weeklyKill`、`usageRecord`：仅 1 点（边缘）

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

---

## 如何使用本文件

- 每条都是**审计当时的快照**，非当前事实。动手前用 grep / knip 重新核实 0-caller 状态。
- 核实后清理一条，在条目末尾标 `**已清理（YYYY-MM-DD）**：…`，保留历史。
- 新增 tech debt：附证据来源 + 审计日期。
- ROI 排序（审计当时建议）：**高** = TD-1/7/8/9/11（删了零功能损失）；**中** = TD-2/3/6/10（需决策）；**低** = TD-5/4/12（一致性收益）。
