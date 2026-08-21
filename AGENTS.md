# AGENTS.md

> 本文件是 AI 代理（含 ZCode / Claude / Codex 等）在本仓库工作的**首要入口**。
> 所有事实均经只读命令核实（2026-07-27）。改动数字类陈述前请重新核实。

---

## 一、项目是什么

**MT —— 牛肉贸易价格数据采集 / 行情展示 / 多维分析 / AI 预测平台。**

- 为中国牛肉产业链上下游提供进口/国产牛肉价格数据、行情展示、多维分析，并以 AI 模型预测未来价格走势。
- **不是交易平台**：不做下单、账户余额、订单执行、实际支付。
- **对标**：类[牧集网](https://web.mooket.com/)的数据/展示/分析 × 类 IoTDB AINode 的预训练模型预测。
- 产品方向唯一事实来源：[`docs/PRODUCT-SPEC.md`](docs/PRODUCT-SPEC.md)

---

## 二、核心价值链（一切开发围绕这条链）

```
19 个数据源爬虫 → PostgreSQL（CommodityPrice / BeefCutPrice）
                          ↓
        inference-service（6 统计模型 + 3 Chronos 变体，共 9 个 model id）
                          ↓
              prediction_logs（落库，含 MAPE 自动验证）
                          ↓
       tradingSignals（BUY/SELL/HOLD 共识）+ 相关性分析 + 回测
                          ↓
                   前端行情 / 预测 / 分析页
```

---

## 三、规模事实（2026-07-27 实测，计数方式附后）

| 项 | 数 | 计数方式 |
|---|---|---|
| 数据源爬虫 | **19** | `backend/src/services/dataIngestion/sources/*.ts`（排除 index/test） |
| Prisma 模型 | **30** | `grep -c '^model ' backend/prisma/schema.prisma`（2026-08-21 复核；round-114 删 organizations 后为 30） |
| 后端路由 | **20** | `backend/src/routes/*.ts`（排除 `*.test.ts`） |
| 前端页面 | **44** | `frontend/src/app/**/page.tsx` |
| 推理模型 id | **9** | `inference_engine.py` 的 `MODEL_IDS`（6 统计 + 3 Chronos 变体） |

**推理模型清单**（来源 `inference-service/services/statistical_models.py` + `inference_engine.py`）：
- 统计（6）：`arima`（ARIMA(2,1,1)）、`sarimax`（带外生变量）、`holtwinters`（三次指数平滑）、`exponential_smoothing`（二次）、`naive_forecaster`（朴素基线）、`stl_forecaster`（STL 分解 + 阻尼外推）
- Chronos 预训练基座（3）：`chronos_tiny` / `chronos_mini` / `chronos_base` → `amazon/chronos-t5-{tiny,mini,base}`

> 注：`inference-service/main.py` 启动时预加载 Chronos pipeline；权重经 `HF_ENDPOINT=https://hf-mirror.com` 镜像下载并缓存于 `/root/.cache/huggingface`（见 `ecosystem.config.cjs` inference 段注释）。

---

## 四、技术栈（版本取自各 package.json / requirements.txt）

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15.5.20、React 19.1、Tailwind CSS 4.2、Jest 29.7、TypeScript 5.8 |
| 后端 | Express 4.19、TypeScript 5.4、Prisma 5.x（@prisma/client 5.22）、Vitest 2 |
| 数据库 / 缓存 | PostgreSQL 14.23、Redis 6.0.16（**宿主机 systemd 服务**，2026-08-20 实测；compose 的 PG15/Redis7 容器栈从未运行，已归档至 `deploy/attic/`，见 TECH-DEBT TD-15） |
| 推理服务 | Python 3.10、FastAPI、uvicorn、statsmodels、sktime、chronos-forecasting、torch（CPU build）、pydantic 2；lint 用 ruff |
| 进程管理 | PM2（`ecosystem.config.cjs`） |
| 代码风格 | biome（TS/JS，根 `biome.json`）、ruff（Python） |

---

## 五、目录约定

```
backend/            Express + TS + Prisma
  src/routes/       API 路由（20 个）
  src/services/     业务服务（含 dataIngestion/sources/ 19 爬虫）
  src/middleware/   认证、限流、安全、日志
  prisma/           schema.prisma（30 模型）+ migrations
frontend/           Next.js 15 App Router（44 页）
  src/app/          页面
  src/components/   组件库
  src/hooks/        SWR 数据钩子
inference-service/  Python FastAPI 推理服务
  services/         statistical_models / inference_engine
  routers/          predict / models / health
  venv/             本地虚拟环境（git 忽略）
scripts/            运维脚本（restart / backup / healthcheck / cron-*）
deploy/attic/       归档的部署描述（compose/helm/docker/nginx，未启用，见 TECH-DEBT TD-15）
docs/               文档（见下方导航）
.github/workflows/  CI（ci.yml：lint/typecheck/test/build/deploy/rollback）
```

> **注意**：本项目不是 pnpm workspace，需分别在 `backend/` 和 `frontend/` 安装依赖（见 README 快速开始）。

---

## 六、开发命令

```bash
# 启停（根目录 package.json 脚本，自动清僵尸进程 + 等端口释放）
pnpm restart              # 全部（后端 + 前端）
pnpm restart:backend      # 仅后端
pnpm restart:frontend     # 仅前端
pnpm stop                 # 停所有，不重启

# 测试（在各子项目内）
cd backend && pnpm test              # Vitest
cd frontend && pnpm test             # Jest
cd inference-service && pytest -q    # pytest（需先 source venv/bin/activate）

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit --project tsconfig.json

# Lint
npx @biomejs/biome lint src/   # 在 backend 或 frontend 内
cd inference-service && ruff check .

# 数据库
cd backend && npx prisma migrate deploy   # 应用迁移
cd backend && npx prisma db seed          # 种子数据
```

### 端口

| 服务 | 端口 |
|------|------|
| 前端 | 3000 |
| 后端 API | 8000 |
| 前端 devtools | 5001 |
| 推理服务 | 10810 |

---

## 七、不可越线（产品约束，沿用既有指令）

1. **不做支付/下单**：交易撮合、订单执行、账户余额、实际支付一律不实现。Billing 仅作静态套餐展示。
2. **只用预训练模型，不训练**：参考 IoTDB AINode 模式。不针对单次请求训练；推理调用已训练好的模型（统计模型 + Chronos 预训练基座）。
3. **运维根治磁盘损坏**：历史上 pnpm 8.15.0 `store prune` 曾反复导致 store 损坏（ENOENT index）。改动任何 pnpm / cron / store 相关配置前，确认不重新引入该模式。
4. 开发重点是 **AI 预测 + 数据 + 分析** 这条核心价值链。

---

## 八、文档导航

| 文档 | 内容 |
|------|------|
| [`docs/PRODUCT-SPEC.md`](docs/PRODUCT-SPEC.md) | **产品方向唯一事实来源** |
| [`docs/PROJECT-VISION.md`](docs/PROJECT-VISION.md) | 项目状态全景 + 产品愿景 |
| [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md) | 开放阻塞与待决策（数据源失效、MAPE 验证环、Chronos 接入等），每条标注来源与验证日期 |
| [`docs/TECH-DEBT.md`](docs/TECH-DEBT.md) | 过度工程化与冗余清单（BullMQ 死队列、多租户脚手架、死模型等），每条标注审计日期，动手前需复核 |
| [`docs/AUTOMATION-STATUS.md`](docs/AUTOMATION-STATUS.md) | CI/CD、cron、护栏等自动化基础设施状态 |
| [`docs/SECURITY.md`](docs/SECURITY.md) | 安全策略 |
| [`docs/API.md`](docs/API.md) | REST API 参考 |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI/UX 设计规范 |
| [`docs/DESIGN-SYSTEM-AUDIT.md`](docs/DESIGN-SYSTEM-AUDIT.md) | 前端设计系统深度审计（token 漂移、a11y、组件深度，2026-08-07） |
| [`docs/PROJECT-ASSESSMENT.md`](docs/PROJECT-ASSESSMENT.md) | 项目整体评估（运维/价值链/架构/规划对齐，2026-08-08） |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | 版本历史 |
| [`docs/INDEX.md`](docs/INDEX.md) | 文档总索引 |
| [`docs/deployment/DEPLOYMENT-CHECKLIST.md`](docs/deployment/DEPLOYMENT-CHECKLIST.md) | 生产部署清单 |
| [`docs/guides/CONTRIBUTING.md`](docs/guides/CONTRIBUTING.md) | 贡献指南 |
| [`docs/guides/SECRETS-MANAGEMENT.md`](docs/guides/SECRETS-MANAGEMENT.md) | 凭据管理 |
| [`CLAUDE.md`](CLAUDE.md) | 编码准则 + Dev Server 管理 + Health Stack（AI 代理工作规范） |

---

## 九、编写文档的严谨性要求

- **数字必须实测**：不沿用历史 README / round 报告里已被发现矛盾的数字（例：旧文档写"18 数据源 / 36 模型 / 5 统计模型"，实测为 19 / 31 / 6）。
- **测试数不写死**：各文档历史测试数互相矛盾（431/433/573/307/277/21…），只写"运行 `pnpm test` 获取当前数"。
- **未验证的不写成定论**：标注"待确认 / 待复核"，附证据来源（文件:行 或 命令）与日期。

---

## 十、开发工作准则（AI 代理硬约束）

> 与 [`CLAUDE.md`](CLAUDE.md) "Skill 使用" 段同步，两份入口文件一致。

1. **自觉使用 skill**：接到任何非平凡任务前，先扫描会话 system-reminder 列出的可用 skill，**主动**匹配并调用；不等用户点名。只调用列表里的 skill，不凭记忆臆造 skill 名。没匹配到的正常完成任务，不为用而用。一次任务可跨阶段调用多个 skill。**技术栈→skill 映射详见 [`docs/SKILLS.md`](docs/SKILLS.md)**（按后端/前端/推理/运维分类，含触发场景、已验证组合模式、明确不适用清单）。
2. **先核实再下结论**：动手前用只读命令核实现状（grep / 实跑测试 / live curl），不沿用历史文档/报告里可能过期的陈述——本仓库已多次发现文档与实测矛盾。
3. **诚实优先**：不造空壳功能、不写虚构数据。`docs/PRODUCT-SPEC.md §九` 明确"明确不做"清单（交易/支付/非牛肉商品进主 IA/UGC/原生 App/Paywall）。
4. **守护测试基线**：每批改动后 tsc + 对应测试 + live 验证 + 独立 commit；任何批次后测试数不得回退。
5. **外科手术式改动**：只动该动的，不顺手"改进"相邻代码；不删非己所造的死代码（先标记记录）。
