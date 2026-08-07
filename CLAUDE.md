# CLAUDE.md

> **AI 代理工作主入口**：[`AGENTS.md`](AGENTS.md)（项目定位、价值链、规模事实、命令、约束、文档导航）。
> 本文件聚焦**编码准则 + Dev Server 管理 + 质量门**。

## Product: MT

大宗商品市场信息与分析平台. **不是交易平台.**

核心功能: 牛肉价格展示 + 多因素分析(天气/汇率/关税/运费) + AI自动预测(统计模型 + Chronos 预训练基座).
不涉及: 下单交易, 账户余额, 订单执行, 实际支付.

已有但需重新定位的功能:
- Simulation(模拟交易) → 预测回测工具(验证AI预测准确率)
- Portfolio(投资组合) → 分析分组(跟踪相关品种)
- Billing(Stripe计费) → AI功能分层(更多信号/模型/历史数据)，仅静态展示

详见 [PRODUCT-SPEC.md](docs/PRODUCT-SPEC.md) 与 [AGENTS.md](AGENTS.md)。

---

## Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### 5. 事实严谨（写文档/报告时）

- 写入文档的数字必须先用只读命令核实，不沿用历史 README / round 报告里已被发现矛盾的数字。
- 未验证的不写成定论，标注"待确认/待复核"，附证据来源（文件:行 或 命令）与日期。
- 测试数等易变数字不写死，只写"运行 `pnpm test` 获取当前数"。

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Dev Server Management

### Ports
- Backend: **8000** (`cd backend && pnpm dev`)
- Frontend: **3000** (`cd frontend && pnpm dev`)
- Devtools: **5001** (Refine devtools, auto-started by frontend)
- Inference Service: **10810** (`cd inference-service && source venv/bin/activate && uvicorn main:app`)

### Restart
Always use the project restart script. It kills all zombie processes (by command pattern + port) before starting fresh.

> ⚠️ **Dev vs prod supervisor — pick one, don't mix.**
> `scripts/restart.sh` (below) launches processes in **dev** mode (`pnpm dev` for
> the frontend). `ecosystem.config.cjs` manages the same names (`mt-backend` /
> `mt-frontend` / `mt-inference`) in **prod** mode via PM2 (`pnpm start`).
> The script now refuses to start a process PM2 already manages — running both
> corrupts the frontend build: `pnpm dev` overwrites `.next/routes-manifest.json`
> (drops the `dataRoutes` key), and when PM2 then restarts `pnpm start`, Next.js
> crashes in a loop with `routesManifest.dataRoutes is not iterable`. To take a
> process over with the dev script, `pm2 delete <name>` first.
> - Dev (HMR, this script): `pnpm restart` / `pnpm restart:frontend`
> - Prod (PM2): `cd frontend && pnpm build && pm2 restart mt-frontend`

```bash
# Full restart (backend + frontend)
pnpm restart

# Restart only one
pnpm restart:backend
pnpm restart:frontend

# Stop all without restarting
pnpm stop
```

The script (`scripts/restart.sh`) does:
1. Kill by command pattern: `tsx watch`, `next-server`, `next dev`, `refine dev`, `postcss.js`
2. Kill by port: 8000, 3000, 5001, 10810
3. Retry with wait until all ports are confirmed free
4. Start backend, wait for port 8000 to respond
5. Start frontend, wait for port 3000 to respond
6. Print summary with PIDs and log paths

Logs go to `.logs/backend.log`, `.logs/frontend.log`.

### Manual startup (if script unavailable)
```bash
# Must cd into the correct directory first — root pnpm dev runs the wrong script
cd /root/backend && pnpm dev &
cd /root/frontend && pnpm dev &
```

---

## Health Stack

质量门命令（提交前全绿）：

- typecheck: `bash -c 'cd backend && npx tsc --noEmit' && bash -c 'cd frontend && npx tsc --noEmit --project tsconfig.json'`
- lint: `bash -c 'cd backend && npx @biomejs/biome lint src/' && bash -c 'cd frontend && npx @biomejs/biome lint src/'`
- test: `bash -c 'cd backend && npx vitest run' && bash -c 'cd frontend && npx jest --forceExit'`
- inference: `cd inference-service && ruff check . && pytest -q`（需先 `source venv/bin/activate`）
- deadcode: `bash -c 'cd backend && npx ts-prune 2>&1 | grep -v "used in module" | grep -v "__tests__" | grep -v "test-helpers"'`（knip 配置见根 `knip.json`）
- security: `bash -c 'cd backend && pnpm audit' && bash -c 'cd frontend && pnpm audit'`
- bundle: `bash -c 'cd frontend && ANALYZE=true npx next build'`

> 测试总数随时间变化且各历史文档记录互相矛盾，不在此写死具体数字；运行上述命令获取当前值。

---

## Skill 使用（开发约束）

> **这是项目硬约束：接到任何非平凡任务前，先自觉扫描可用 skill 列表并主动匹配调用。**

**约束（写入项目开发约束，所有 AI 代理必须遵守）**：
1. **主动而非被动**：接到任务后，先看会话 system-reminder 里列出的可用 skill，**主动**判断是否匹配，匹配就调用——不等用户点名 skill。
2. **不凭记忆臆造**：只调用 system-reminder 列表里的 skill 名，绝不凭训练记忆猜 skill 名（skill 集合会变，记忆会过时）。
3. **没匹配也别硬套**：找不到匹配的 skill 时正常完成任务，不要为"用 skill 而 skill"。
4. **一次任务可用多个 skill**：复杂任务可在不同阶段调用不同 skill（如先 planning-and-task-breakdown 规划，再 test-driven-development 实现）。

**常见任务→skill 映射**：详见 [`docs/SKILLS.md`](docs/SKILLS.md)（权威参考，按技术栈 + 触发场景分类，含已验证组合模式与明确不适用清单）。以下为高频速查：

- 工作纪律（每次任务）→ **careful** + **incremental-implementation** + **code-review-and-quality**
- 规划 / 任务拆解 → **planning-and-task-breakdown**
- bug 排查 / "为什么坏了" → **debugging-and-error-recovery** / **investigate**
- 测试 → **javascript-testing-patterns**（TS 两端）/ **python-testing-patterns**（推理）
- 架构 / 重构 → **improve-codebase-architecture** / **zoom-out**
- 后端（Express+Prisma+PG）→ **nodejs-backend-patterns** / **scaffold-prisma** / **sql-optimization-patterns**
- 前端（Next+React+Tailwind）→ **frontend-ui-engineering** / **frontend-design** / **design-review**
- 推理（FastAPI+chronos）→ **inference-debug** / **python-code-style**
- 运维 → **ops-check** / **ci-cd-and-automation**
- spec / 文档对齐 → **spec-driven-development** / **grill-with-docs**

> **不适用清单**：LLM/RAG/向量/embedding 系 skill（langchain/rag/embedding/vector 等）—— 本项目 AI 价值是预训练时序模型（chronos/statsmodels），非语言模型。完整清单见 SKILLS.md §三。

> 入口文件 [`AGENTS.md`](AGENTS.md) §十"开发工作准则"同步此约束。
