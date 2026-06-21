# MT 项目开发者体验审查报告 (Round 4 — DevEx)

> **日期**: 2026-06-14
> **方法论**: devex-review skill(模拟新开发者走完上手流程)
> **状态**: 13 个 DX 问题已识别,核心 blocker 已修复

---

## 执行摘要

模拟新开发者按 README "快速开始" 走完整套流程,**原流程会在 4 个点卡死**,导致无法登录到应用。本轮修复了所有 blocker 和主要文档不一致。

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 上手流程能否跑通 | ❌ 4 处 blocker | ✅ 步骤完整 |
| `.env.example` 变量数 | 12(缺 22 个) | 18 显式 + 注释选项 |
| 登录凭据示例 | 错误(`admin@example.com`) | ✅ 正确 |
| AI 模型数 | README=7 vs 代码=8 | ✅ 8(补 Chronos) |
| IoTDB 残留 | 4 处 | ✅ 清理 |

---

## 🔴 原始 Blocker(均已修复)

### B1. `pnpm install` 在根目录不装任何 backend/frontend 依赖
**根因**: 无 `pnpm-workspace.yaml`,根 `package.json` 不声明子项目。新开发者按 README 跑 `pnpm install` 后,backend/frontend 的 `node_modules` 为空,下一步即崩溃。
**修复**: README 重写为分别 `cd backend && pnpm install` + `cd frontend && pnpm install`。

### B2. 无数据库创建步骤,`prisma migrate deploy` 在全新 Postgres 上失败
**根因**: README "前置条件" 列了 PostgreSQL 但没给创建 DB/user 的命令。`.env.example` 假设 `mt_user`/`mt_db` 已存在。
**修复**: README 增加创建 DB/user 的具体命令。

### B3. 无 seed 步骤,登录零用户
**根因**: README 完全没提 `prisma db seed`。种子数据创建了测试账号,但 README 的 curl 示例还用了错误的凭据(`admin@example.com` / `password`)。
**修复**: README 增加 seed 步骤;修正登录凭据为 `admin@trademind.com`;补充种子账号表。

### B4. JWT_SECRET/SESSION_SECRET 未文档化,启动即崩
**根因**: `config.ts` 在 secret <32 字符时抛错导致 backend 无法启动,但 README 未说明。
**修复**: `.env.example` 标注 REQUIRED + 生成命令(`openssl rand -base64 48`)。

---

## 🟠 原始 Major 问题(均已修复)

### M1. `package.json` 的 `restart:iotdb` 脚本是坏的
**根因**: `restart.sh` 只接受 `--backend|--frontend|--inference|--all`,不认 `--iotdb`。运行 `pnpm restart:iotdb` 直接 exit 1。
**修复**: 删除 `restart:iotdb` 脚本(IoTDB 已弃用)。

### M2. `pnpm stop` 清理 IoTDB 进程(已弃用的功能)
**根因**: `stop` 脚本里有 3 条 `pkill -f 'iotdb.*'`。
**修复**: 移除。

### M3. AI 模型数矛盾
README 全篇 "7 个 AI 模型",但代码 `VALID_MODELS` = 8 个(缺了 **Chronos**)。CLAUDE.md/ROADMAP 都写 8。
**修复**: README 全改 8,模型表补 Chronos 行。

### M4. `.env.example` 缺 22 个代码实际读取的变量
包括 `CORS_ORIGIN`、`INFERENCE_TIMEOUT`、`SMTP_*`、`SLACK_*`、`REDIS_ENABLED` 等。
**修复**: 全部补齐,并按功能分组注释说明。

---

## 🟡 已识别但本轮未修(记录待办)

| # | 问题 | 严重度 | 原因 |
|---|------|--------|------|
| - | `CONTRIBUTING.md` 严重过时(错路径/npm/ESLint/MIT license/IoTDB) | Major | 需完整重写,单独立项 |
| - | `docker compose up`(全栈)未文档化且因缺 `JWT_SECRET` 失败 | Major | compose 凭据与 .env.example 不匹配,需产品决策 |
| - | 多处测试数不一致(420/480/785/169) | Minor | 真实数随环境变,README 已用"~420" |
| - | `docs/developer/` 空目录 | Minor | 无内容 |
| - | inference service 完全未在 README 提及 | Major | 是独立 Python 服务,需单独 onboarding |

---

## 本轮清理的 IoTDB 残留

ROADMAP 明确 "platform has pivoted away from IoTDB",但仍有残留:

| 残留 | 处理 |
|------|------|
| `package.json` `restart:iotdb` 脚本 | ✅ 删除 |
| `package.json` `stop` 脚本 3 条 iotdb pkill | ✅ 删除 |
| `.iotdb_history-*` shell 历史文件 | ✅ 删除(未 git 跟踪) |
| `docs/ai-node-setup.md`(IoTDB AI Node 安装指南) | ✅ 移入 archive/ |
| `backend/prisma/migrations/20260508_remove_iotdb_*` | 保留(迁移历史) |
| `docs/blog/_posts/2025-03-28-introducing-iotdb-enhanced-v1.3.md` | 保留(已发布博客) |

---

## 净变化

5 文件: README.md(重写快速开始+模型表)、.env.example(补全)、package.json(去 IoTDB)、ai-node-setup.md(→ archive)、删除本地 .iotdb_history。
0 代码逻辑改动,0 新依赖。

*本报告基于 devex-review 方法论。所有 blocker 已通过逐行比对 README 与实际命令验证。*
