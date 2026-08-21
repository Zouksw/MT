# MT — Skill 使用规划（技术栈映射）

> **本文档是 AI 代理在本项目选择 skill 的权威参考。**
> 与 [`CLAUDE.md`](../CLAUDE.md) §Skill 使用 + [`AGENTS.md`](../AGENTS.md) §十 同步。
> 分类基于 2026-08-08 实测的技术栈与 skill 列表；skill 集合会变，**始终以会话 system-reminder 列出的可用列表为准**（§十.2 不凭记忆臆造）。

---

## 使用原则（硬约束，源自 AGENTS.md §十）

1. **主动匹配**：接到非平凡任务，先扫可用 skill 列表，主动判断匹配——不等点名。
2. **只调用列表里的 skill**：绝不凭训练记忆猜 skill 名（集合会变，记忆过时）。
3. **没匹配也别硬套**：找不到匹配的正常完成任务，不为用而用。
4. **跨阶段组合**：复杂任务可分阶段调多个 skill（如先 `planning-and-task-breakdown` 再 `test-driven-development`）。

---

## 一、按技术栈选 skill（核心映射）

### 后端（Express 4 + TypeScript 5.4 + Prisma 5 + PostgreSQL + Redis）

| 触发场景 | skill | 为什么 |
|---|---|---|
| 改任何 route / service（含 prisma 调用） | **nodejs-backend-patterns** | 20 路由 + 59 服务的直接匹配 |
| 加/改 Prisma model 或 migration | **scaffold-prisma** + **postgresql-table-design** | 31 model + prediction_logs/MAPE 是价值链核心 |
| 慢查询 / 索引 / N+1 | **sql-optimization-patterns** | commodity_prices 65k+ 行喂 44 页 |
| 加新 API 端点 / 改 docs/API.md | **api-and-interface-design** + **scaffold-api** | swagger-jsdoc 已配 |
| TS 类型问题（zod↔prisma↔react 交互） | **typescript-advanced-types** | 两端 TS 5.4/5.8 |
| 后端测试（Vitest） | **javascript-testing-patterns** | §十.4 守护基线 |

### 前端（Next.js 15 App Router + React 19 + Tailwind v4 + base-ui/shadcn）

| 触发场景 | skill | 为什么 |
|---|---|---|
| 建/改 UI 页面或组件 | **frontend-ui-engineering** | 44 页 + 27 ui 原语，WCAG/响应式硬要求 |
| 设计系统 / 色板 / 主题决策 | **frontend-design** + **design-review** | DESIGN.md 是 brief，globals.css @theme + tokens |
| Tailwind 主题 / 暗色模式 | **theme-factory** | oklch @theme + .dark 切换 |
| 新组件脚手架 | **scaffold-component** | shadcn/base-ui 模式 |
| React 19 / Next 15 / Tailwind 4 惯用法 | **modern-javascript-patterns** | 新框架版本，非回归编辑必备 |
| 前端测试（Jest） | **javascript-testing-patterns** | §十.4 守护基线 |
| E2E / 浏览器测试 | **browser-testing-with-devtools** | Playwright 已配 |

### 推理服务（Python 3.10 + FastAPI + statsmodels/sktime/chronos + torch CPU）

| 触发场景 | skill | 为什么 |
|---|---|---|
| 改模型 / 推理逻辑 / chronos 加载 | **inference-debug** | 9 模型（6 stat + 3 chronos），HF 镜像预加载 |
| Python 代码质量 / lint | **python-code-style** | pyproject.toml 配 ruff（E/W/F/I/UP），CI 强制 |
| 推理测试（pytest） | **python-testing-patterns** | §十.4 守护 47→48 基线 |
| Python 类型（pydantic 2 请求/响应模型） | **python-type-safety** | 改 predict schema 时 |
| Python 错误处理 / 恢复 | **python-error-handling** + **python-resilience** | 模型加载/HF 下载/torch 失败恢复 |
| torch-CPU 内存 / 延迟 | **python-resource-management** + **python-performance-optimization** | 9 模型预加载，559M 常驻 |
| 推理服务异步端点设计 | **async-python-patterns** | FastAPI async（但推理是同步 CPU-bound） |

### 运维 / 部署（PM2 + 宿主机 systemd + GitHub Actions）

| 触发场景 | skill | 为什么 |
|---|---|---|
| 服务健康检查 / "为什么挂了" | **ops-check** | 3 fork 进程，health endpoint 真相 |
| CI 流水线 / ci.yml | **ci-cd-and-automation** | 8 job（lint/typecheck/test/build/deploy/rollback） |
| 部署 / 发布 | **shipping-and-launch** | DEPLOYMENT-CHECKLIST.md |
| K8s/Helm | **helm-chart-scaffolding** + **k8s-manifest-generator** | 仅当未来真上 k8s——`deploy/attic/helm` 已归档未启用（TD-15），PM2 是唯一现实路径 |
| 安全加固 | **security-and-hardening** | helmet/rate-limit/JWT + SECURITY.md |

---

## 二、跨栈通用 skill（工作流与方法论）

### 工作纪律（每次任务）

| 触发场景 | skill | 为什么 |
|---|---|---|
| 任何非平凡任务 | **careful** | §十.5 外科手术约束（只动该动的，不删非己所造） |
| 分批实现 + 每批 commit + 验证 | **incremental-implementation** | §十.4 批次独立 commit + tsc/test/live |
| 改完 review diff | **code-review-and-quality** | §十.4 守护测试基线不回退 |
| git 操作 / 分支 / 版本 | **git-workflow-and-versioning** | §十.4 独立 commit，CI 门控 |

### 诊断与调查

| 触发场景 | skill | 为什么 |
|---|---|---|
| bug 排查 / "为什么坏了" | **debugging-and-error-recovery** | 跨栈（Express/FastAPI/Prisma/爬虫） |
| 数据源失效 / KNOWN-ISSUES 项 | **investigate** + **triage** | 19 爬虫，D1 数据源模式 |
| 通用诊断（兜底） | **diagnose** | 与上面重叠时选更具体的 |

### 架构与重构

| 触发场景 | skill | 为什么 |
|---|---|---|
| 架构评估 / 模块深度 | **improve-codebase-architecture** | PROJECT-ASSESSMENT.md 方法论（deep/shallow + 删除测试） |
| 全栈地图 / "给我个全景" | **zoom-out** | 价值链 5 阶段映射 |
| 清理过度工程 / 死代码（先标记） | **code-simplification** + **deprecation-and-migration** | TECH-DEBT.md，§十.5 先记录不删 |

### 规划与文档

| 触发场景 | skill | 为什么 |
|---|---|---|
| 多批非平凡工作规划 | **planning-and-task-breakdown** | 价值链多阶段任务 |
| 新功能 / spec 对齐 | **spec-driven-development** | PRODUCT-SPEC.md 是唯一事实源 |
| 核实现状再下结论 | **doubt-driven-development** + **source-driven-development** | §十.2 文档与实测矛盾已多次发现 |
| spec vs 实现交叉验证 | **grill-with-docs** | PROJECT-ASSESSMENT.md 用的方法 |
| 文档 / ADR | **documentation-and-adrs** | 丰富 docs/ 树 + AGENTS.md/CLAUDE.md |
| 性能（跨栈） | **performance-optimization** | 前端 bundle + PG 查询 + torch-CPU |

---

## 三、明确不适用的 skill（T3，勿调用）

> **本项目的 AI 价值是预训练时序模型（chronos/statsmodels），不是 LLM/RAG。** 以下 skill 与技术栈无关，调用即浪费。

| skill 族 | 不适用原因 |
|---|---|
| **langchain-architecture / rag-implementation / embedding-strategies / similarity-search-patterns / hybrid-search-implementation / vector-index-tuning** | 无 LLM/RAG/向量层（grep 全空）；产品是时序预测，非检索 |
| **llm-evaluation / prompt-engineering-patterns** | 无 LLM；评估是 MAPE（数值预测），非语言模型 |
| **python-background-jobs** | 无 Celery/RQ；FastAPI 同步推理，BullMQ 是死队列技术债 |
| **python-packaging / uv-package-manager** | 推理服务从源码跑（uvicorn main:app + venv），不打包；pyproject.toml 仅 ruff |
| **python-configuration** | 配置面已冻结（pyproject 仅 ruff） |
| **canvas-design** | 图表用 recharts/lightweight-charts（SVG），非 canvas 绘图 |
| **docx / pdf / pptx** | 无文档生成功能；内部报告用 .md |
| **gitops-workflow** | 部署是 PM2/systemd + GitHub Actions（SSH→deploy.sh），非 ArgoCD/Flux；compose/helm 已归档（TD-15） |
| **web-artifacts-builder / webapp-testing / web-gui-tester** | 与 frontend-ui-engineering/scaffold-component/Playwright 冗余 |

---

## 四、已验证的 skill 组合模式（本仓库实战记录）

| 任务类型 | 组合 | 实战 commit |
|---|---|---|
| 前端设计审计 | frontend-design + design-review + frontend-ui-engineering | round-77 a11y 修复（65aa2cf） |
| 项目整体评估 | ops-check + zoom-out + improve-codebase-architecture + grill-with-docs | round-79 PROJECT-ASSESSMENT.md（d4e55c2） |
| 调色板决策 | frontend-design + design-review（brief 优先 + token drift 扫描） | round-76 TD-12 收敛（cd3bde8） |
| bug 根因调查 | debugging-and-error-recovery + investigate | round-79 stl MAPE 调查（ab71cf0） |
| 循环依赖修复 | improve-codebase-architecture + incremental-implementation | round-79 modelRegistry 抽取（bd780db） |

---

## 五、skill 使用元约束

- **diagnosing-skills / diagnosing-commands / diagnosing-hooks / diagnosing-mcp / diagnosing-plugins / zcode-configuration-guide**：仅在 zcode CLI 环境本身出问题时调用（meta，低频）。
- **using-agent-skills**：§十.1 的方法论元 skill，新代理首次接触本项目时可加载。
- **skill-creator**：仅在建项目特定 skill 时调用（如"beef-cut 价格标准化"领域 skill）。
- **to-issues / to-prd / idea-refine / interview-me**：产品管理类，非日常工程，偶尔用。
- **tdd 与 test-driven-development 近重复**：任选其一（§十.4 守护基线时）。
- **review 与 code-review-and-quality 近重复**：选后者（更具体）。
