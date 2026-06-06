# CLAUDE.md

## Product: MT

大宗商品市场信息与分析平台. **不是交易平台.**

核心功能: 商品价格展示 + 多因素分析(天气/汇率/关税/运费) + AI自动预测(8模型信号引擎).
不涉及: 下单交易, 账户余额, 订单执行, 实际支付.

已有但需重新定位的功能:
- Simulation(模拟交易) → 预测回测工具(验证AI预测准确率)
- Portfolio(投资组合) → 分析分组(跟踪相关品种)
- Billing(Stripe计费) → AI功能分层(更多信号/模型/历史数据)

---

## Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

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

## 4. Goal-Driven Execution

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

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /gstack
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health

## Health Stack

- typecheck: bash -c 'cd backend && npx tsc --noEmit' && bash -c 'cd frontend && npx tsc --noEmit --project tsconfig.json'
- lint: bash -c 'cd backend && npx @biomejs/biome lint src/' && bash -c 'cd frontend && npx @biomejs/biome lint src/'
- test: bash -c 'cd backend && npx vitest run' && bash -c 'cd frontend && npx jest --forceExit'
- deadcode: bash -c 'cd backend && npx ts-prune 2>&1 | grep -v "used in module" | grep -v "__tests__" | grep -v "test-helpers"'
- security: bash -c 'cd backend && pnpm audit' && bash -c 'cd frontend && pnpm audit'
- bundle: bash -c 'cd frontend && ANALYZE=true npx next build'

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.
