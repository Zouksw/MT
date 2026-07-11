# 全量可操作事项深度调研 — 每一项的真实状态 + 精确执行步骤

**Date:** 2026-07-12
**方法:** DB 行数实测 + FK 依赖图谱（pg_constraint）+ 代码 importer 计数 + migration 状态验证
**目的:** 对 overengineering-audit + 各 round 遗留的**每一项**，给出"能不能做、怎么做、风险多大"的精确裁定，而非笼统的"需 migration"。

> **执行延迟说明：** 本报告原本要落地 saved_queries 删除，但实测发现 `prisma/schema.prisma` 正被另一会话编辑（mtime 52s 前且 edit 被拒 3 次）。为避免覆盖对方改动，schema 文件编辑延迟，本报告提供**精确到行的执行清单**作为操作手册。

---

## 一、schema/model 类（3 项）—— 全部确认安全可删

### 判定依据（统一验证）
```
pg_constraint WHERE contype='f' AND confrelid IN (target tables) → 全部 0 行
= 没有任何表通过外键引用这些表 = DROP TABLE 不会破坏其他表的 FK 约束
```

| 表 | 行数 | FK-in（被引用）| FK-out（它引用）| 删除风险 |
|---|---|---|---|---|
| **saved_queries** | **0** | **0** | → users（onDelete Cascade）| 🟢 零风险（空表，无被引用）|
| **organization_members** | 3（见下）| **0** | → users, organizations | 🟢 低风险（0 被引用，3 行测试成员）|
| **organizations** | 2 | → datasets（CASCADE）| — | 🟡 中风险（被 datasets 引用，需先处理 datasets.organization_id）|
| **subscriptions** Stripe 列 | 表 0 行 | — | — | 🟢 零风险（列从未被写，全 NULL）|

### 1.1 🟢 saved_queries — 立即可删（推荐先做）

**证据：** 0 行数据、0 FK-in、0 代码引用（Round 22 已确认）。

**精确执行步骤：**
```prisma
// prisma/schema.prisma
// 1. 删 User 模型里的关系字段（约 line 33）：
//    saved_queries  saved_queries[]   ← 删此行
// 2. 删整个 model（约 line 341-358）：
//    model saved_queries { ... }      ← 删整块
```
```bash
cd backend && npx prisma migrate dev --name drop_saved_queries
# 生成的 SQL: DROP TABLE "saved_queries"; (CASCADE 自动，因 0 FK-in)
```
**回滚：** `git revert` migration + `prisma migrate resolve --rolled-back`。

### 1.2 🟢 organization_members — 可删（3 行是种子测试数据）

**证据：** 0 FK-in（删它不破任何约束）。3 行实测：
```
admin@trademind.com  → org-trademind  ADMIN   (种子)
user@trademind.com   → org-trademind  EDITOR  (种子)
demo@trademind.com   → org-trademind  VIEWER  (种子)
```
全是 seed 种子，非真实业务数据。代码 0 引用（Round 22 确认）。

**执行：** 同 1.1 模式——删 schema 里 `organization_members` model + User 关系字段，`migrate dev --name drop_organization_members`。

### 1.3 🟡 organizations + Dataset.organization_id — 需两步（中风险）

**卡点：** `datasets.organization_id` 是 **NOT NULL** 且 FK→organizations（CASCADE）。2 个 org：`org-trademind`（真实，1 个 dataset 挂它）、`default-org-id`（datasetService.ts 硬编码 fallback）。

**两步执行（顺序敏感）：**
1. **先**把 `Dataset.organization_id` 改可空（`organization_id String?`）+ migration
2. **再**删 `organizations` + `organization_members` model

**或者更保守：** 保留 organizations 表（它只有 2 行、几乎零成本），只删 organization_members（1.2）。**推荐保守路线**——organizations 删除的收益（2 行）不值得 NOT NULL→nullable 的 schema 风险。

### 1.4 🟢 Subscription 的 3 个 Stripe 列 — 可删（零风险）

**证据：** `subscriptions` 表 **0 行**；`stripe_customer_id`/`stripe_price_id`/`stripe_sub_id` 3 列 `count(*) FILTER (IS NOT NULL)` 全 0。代码无 Stripe 引用（Round 22 确认）。

**执行：** schema 里删这 3 个字段 + `migrate dev --name drop_stripe_columns`。SQL: `ALTER TABLE "subscriptions" DROP COLUMN ...`。

---

## 二、决策类（4 项）—— 给出推荐 + 成本

### 2.1 validateApiKey — 🟡 保留 + 后续接中间件（不删）

**真相：** 不是死代码，是**未接线的 future infra**。前端 `/apikeys` 页真实存在（`apikeys/page.tsx`，管理 key 的 create/list/revoke UI 完整）。问题只是：发出去的 key 不能用于认证任何端点（无中间件读 `iotd_` header）。

**推荐：保留。** 删了等于删一个完整 UI + service。正确做法是后续补一个 `apiKeyAuth` 中间件（读 `Authorization: ApiKey iotd_xxx` header → `validateApiKey`）。**成本：~1 个中间件文件 + 挂到需要程序化访问的路由。** 不在本轮做（是新功能非清理）。

### 2.2 Storybook — 🟠 卸载配置（推荐）

**真相：** 9 个 `@storybook/*` devDep + 完整 `.storybook/` 配置，但只有 **5 个 stories / 88 个组件 = 5.7%** 覆盖。工具链全套就位却几乎不用。

**推荐：卸载。** 收益：9 devDep + 配置文件 + 构建时间。成本：若将来要重新启用，重新 `storybook init`。
```bash
cd frontend && pnpm remove @storybook/*（9 个）&& rm -rf .storybook/
# 同步删 package.json 的 storybook/build-storybook scripts
```
**不推荐的替代：** "补齐 83 个 stories" 成本远大于收益。

### 2.3 phosphor 图标 — 🟠 迁移到 lucide（推荐，成本低）

**真相：** phosphor 仅 6 文件用，lucide 63 文件用。phosphor 实测只导入了 **12 个 distinct 图标**：
```
ArrowLeft ArrowRight ArrowUp Brain CheckCircle Gauge
GithubLogo House Lightning List TrendUp X
```
lucide 全有同名/近名等价（`ArrowLeft`/`ArrowRight`/`ArrowUp`/`X`/`House`→`Home`/`List`/`Brain`/`Gauge`/`CheckCircle`→`CheckCircle2`/`TrendingUp`/`Lightning`→`Zap`/`GithubLogo`→`Github`）。

**推荐：迁移 6 文件后卸 phosphor。** 成本：6 文件改 import + 替换 ~12 图标名。收益：1 依赖 + 包体积。
```bash
# 6 文件：about/page, landing/page, not-found, auth-page/index, landing/GettingStarted, landing/Hero
# 把 from "@phosphor-icons/react" → from "lucide-react"，按映射换名
pnpm remove @phosphor-icons/react
```

### 2.4 axios — 🔴 不动（深度耦合，迁移成本高）

**真相：** `lib/auth.ts`（200 行）深度依赖 axios：自定义 instance + **请求拦截器**（注 Bearer token）+ **响应拦截器**（401 清 token + 错误处理）。这不是"fetch 替换 axios"的一行改动——拦截器逻辑要重写成 fetch wrapper。

**推荐：保留。** 收益（1 依赖）不值得改 200 行认证核心 + 引入回归风险。若将来统一数据层（Round 20 §3.1 的 3 套 fetcher 合并），届时一并处理。

---

## 三、inference.ts 信封统一 — 🟠 跨栈协调（精确变更清单）

**真相：** 11 个路由用裸 `res.json({...})`，3 个前端 caller 直读顶层字段。**信封化会破前端**——除非同步改 caller。Round 21 已确认这点。

**精确变更清单（必须同 commit）：**

### 后端（inference.ts）—— 3 个被消费的路由
| 路由 | 当前裸 shape | 改为 |
|---|---|---|
| `POST /predict` | `{timestamps,values,lowerBound,upperBound,algorithm,cached}` | `success(res, {...})` |
| `POST /predict/visualize` | `{prediction, history}` | `success(res, {...})` |
| `POST /anomalies/visualize` | `{anomalies, statistics}` | `success(res, {...})` |

### 前端（3 caller）—— 改读 `data.data.xxx`
| 文件 | 当前读 | 改为 |
|---|---|---|
| `ai/predict/page.tsx:150` | `setResult(data)` + `data.prediction?.values` | `setResult(data.data)` + `data.data.prediction?.values` |
| `ai/anomalies/page.tsx:114` | `setResult(data)` + `data.statistics.total` | `setResult(data.data)` + `data.data.statistics.total` |
| `forecasts/create/page.tsx:155` | `result.values` | `result.data.values` |

**错误格式已修（Round 23）：** 3 caller 现读 `error.error?.message`，与全局一致。

**推荐：单独成轮做**（一次 commit 同时改 backend+frontend，配 build 验证）。不在本会话盲推（需两端同步验证，且另一会话在动相关文件）。

---

## 四、隐藏的安全子项（本调研新发现）

### 4.1 🟡 Dataset.organization_id CASCADE 陷阱
`datasets_organization_id_fkey` 的 `confdeltype = 'c'`（CASCADE）。意味着**删一个 organization 会级联删除其下所有 datasets**。当前 `default-org-id` 挂 1 个 dataset——若有人执行 `DELETE FROM organizations WHERE id='default-org-id'`，会误删 dataset。建议：FK 改 `ON DELETE RESTRICT`（防止误删）或 `SET NULL`（需先改 nullable）。

### 4.2 🟢 migration 健康度
`_prisma_migrations` 有 1 个 `finished_at IS NULL`（`20260503_catchup`，标记 `f`）——历史失败 migration 残留，不影响运行（已有同名 `t` 补上），但 `prisma migrate status` 会报 warning。可 `prisma migrate resolve --applied 20260503_catchup` 清理（低优先）。

---

## 五、执行优先级（按 ROI × 安全）

| 优先级 | 项 | 操作 | 前置 |
|---|---|---|---|
| **P1 立即** | saved_queries 删 | schema 删 model + migrate dev | 等另一会话放开 schema.prisma |
| **P1 立即** | Subscription Stripe 列删 | schema 删 3 字段 + migrate | 同上 |
| **P2 短期** | organization_members 删 | schema 删 model + migrate | 同上 |
| **P2 短期** | Storybook 卸载 | pnpm remove 9 dep + rm .storybook | 无 |
| **P2 短期** | phosphor→lucide 迁移 | 6 文件换 import + 卸 dep | 无 |
| **P3 中期** | inference 信封统一 | backend 3 路由 + frontend 3 caller 同改 | 单独成轮 |
| **P4 评估** | organizations 删 + Dataset.org_id nullable | 两步 migration | 产品确认是否要租户 |
| **不做** | validateApiKey 删 | —— | 保留，未来补中间件 |
| **不做** | axios 移除 | —— | 耦合太深，收益低 |

---

## 六、本会话执行情况

**调研完成：** 全部 7+ 项逐一深挖到 DB 行数 + FK 图谱 + 代码引用 + 成本估算。

**执行延迟：** saved_queries 的 schema 编辑因另一会话正写 `schema.prisma`（mtime 52s 前，3 次 edit 被拒）而推迟。本报告的"精确执行步骤"可直接作为操作手册——等另一会话提交后，按 P1→P2 顺序执行即可，每步都有可复现的命令与回滚方法。

**关键结论修正：**
- "需 migration" ≠ "不能做" —— 实测这 3 个 schema 表都 **0 FK-in**，migrate dev 能安全生成 DROP。风险主要来自"和另一会话抢同一文件"，不是 migration 本身。
- organizations 删除是唯一真正需要两步的（NOT NULL→nullable→drop），其余都是单步。
- validateApiKey 不是死代码是未接线功能——删它是产品决策不是清理。
