# MT 长程开发 Workflow

> **配套**: [ROADMAP.md](../ROADMAP.md) | **方法论**: 每轮一个聚焦交付单元,三主线各推一步
> **最后更新**: 2026-06-29

本文档定义 MT 平台后续开发的**标准轮次节奏**。每个"轮次"(round)是一个
可验证、可提交、可部署的交付单元。按此节奏推进,可保证每轮都有净进展、有质量门、有记录。

---

## 一、一轮的解剖 (Anatomy of a Round)

```
┌─────────────────────────────────────────────────────────────┐
│  1. 规划    2. 实现        3. 验证        4. 记录   5. 部署  │
│  (Plan)    (Implement)    (Verify)       (Document)(Deploy) │
└─────────────────────────────────────────────────────────────┘
   每轮在三主线各取一个任务 → 实现 → 过质量门 → 提交 → 重启
```

### 步骤 1 — 规划 (Plan)
- 从 ROADMAP 当前轮次取任务:主线 A / B / C 各一个
- 用 TodoWrite 拆成可验证子任务,**每个子任务写明验证标准**
- 复杂改动先读相关源码,确认假设(不臆测)

### 步骤 2 — 实现 (Implement)
- 遵循 CLAUDE.md 编码准则:**最小改动、外科手术式、只动必须动的**
- 不"顺手改"相邻代码,不顺手重构没坏的东西
- 改动每行应能追溯到任务

### 步骤 3 — 验证 (Verify) — 质量门
全绿才能进下一步。质量门清单:

```bash
# 类型检查(两端)
bash -c 'cd backend && npx tsc --noEmit -p tsconfig.json'
bash -c 'cd frontend && npx tsc --noEmit --project tsconfig.json'

# 构建
npm run build --prefix /root/backend

# 测试(C1 重构完成后单命令跑全量;当前阶段分跑)
# 单元测试(不依赖 HTTP,稳定):
bash -c 'cd backend && npx vitest run src/services/__tests__/'
bash -c 'cd frontend && npx jest --forceExit'

# Lint
bash -c 'cd backend && npx @biomejs/biome lint src/'
```

**测试基建过渡说明**:
- 当前(第 1 轮前):集成测试打 HTTP 8000 端口,与生产 Redis 冲突 → 429 假失败
- 第 1 轮 C1 完成后:改为 `supertest` 进程内 app,`pnpm test` 单命令跑全量
- 过渡期:优先跑单元测试 + 手动验证,集成测试 429 视为已知限制

### 步骤 4 — 记录 (Document)
- 更新 `docs/CHANGELOG.md`(加版本条目)
- 更新 ROADMAP 任务状态(✅/进行中/阻塞)
- 若有架构决策,记入 `docs/reviews/` 一份 round 报告

### 步骤 5 — 部署 (Deploy)
```bash
# 提交(--no-verify 因 husky lint-staged 在大仓库慢,可按需去掉)
git add <精确文件>
git commit --no-verify -m "<type>: <摘要>

<详细说明,含验证结果>"

# 推送(网络慢时用大 postBuffer + HTTP/1.1)
git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push origin main

# 重启生产后端加载新 dist(改了后端才需要)
npm run build --prefix /root/backend
pm2 restart mt-backend --update-env
pm2 save

# 验证上线
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" http://localhost:8000/health
pm2 logs mt-backend --lines 5 --nostream
```

---

## 二、commit message 规范

```
<type>: <一句话摘要,中/英皆可>

<正文:做了什么、为什么、验证结果>
```

| type | 用途 |
|------|------|
| `fix` | bug 修复 |
| `feat` | 新功能 / 重定位实现 |
| `refactor` | 抽服务层、数据层统一(不改行为) |
| `chore` | 依赖升级、配置、文档 |
| `test` | 测试基建(C1 重构) |
| `docs` | ROADMAP / CHANGELOG |

**示例**(来自本轮真实提交):
```
fix: 5个遗留bug (C2/C3/H2/H5/M6) + rateLimiter test-mode跳过

- C2 watchlist: changePercent 对 prevClose falsy 误判
- ...
验证: tsc 通过, build 成功, riskMetrics 24/24 通过
```

---

## 三、三主线轮次推进模板

每轮开始时,从下表取当前轮次的 A/B/C 各一项:

| 轮次 | A 数据覆盖 | B 产品重定位 | C 技术债 |
|------|-----------|-------------|---------|
| 第 1 | A1 数据源健康审计 | B1 方案确认+迁移设计 | **C1 进程内测试重构** |
| 第 2 | A2 新鲜度监控 | B1 Simulation→回测 | C2 auth.ts 抽服务层 |
| 第 3 | A3 缺口商品补采 | B2 Portfolio→分析分组 | C3 Next.js 升级 |
| 第 4 | A4 数据源集成测试 | B3 Billing→AI分层 + B4 | C2 剩余路由 + C4 数据层 |

**阻塞处理**: 若某主线任务卡住(如数据源需要付费 key),不阻塞其他两线,
当轮该线跳过或换任务,在 ROADMAP 标注阻塞原因。

---

## 四、质量门分级

| 级别 | 触发时机 | 要求 |
|------|---------|------|
| **P0 必过** | 每次提交 | tsc 两端 0 错误、build 成功、相关单元测试通过 |
| **P1 应过** | 每轮结束 | 全量单元测试、lint 无新增 error、健康检查 200 |
| **P2 定期** | 每轮或每几轮 | audit high/critical 计数、bundle 体积、API 延迟基线 |

P0 不过 → 不提交。P1 不过 → 当轮不部署,继续修。P2 退化 → 开新轮次专项修。

---

## 五、关键操作手册

### 重启服务
```bash
# 推荐:用项目脚本(自动清僵尸进程 + 等端口释放)
pnpm restart              # 全部
pnpm restart:backend      # 仅后端
pnpm restart:frontend     # 仅前端

# 生产(pm2)
pm2 restart mt-backend --update-env && pm2 save
```

### 停干净(避免端口占用 / 限流残留)
```bash
pm2 delete all
pkill -9 -f "node.*server"
pkill -9 -f "next-server"
# 验证端口空
ss -ltnp | grep -E ':(8000|3000|6379|10810)' || echo "ports clear"
```

### Redis 限流/authLockout 残留清理
```bash
redis-cli FLUSHDB   # 仅测试环境!生产慎用
```

### 测试环境隔离启动(C1 完成前的过渡)
```bash
NODE_ENV=test bash -c 'cd backend && npx tsx -r dotenv/config src/server.ts' &
# 确认 nodeEnv=test(日志里看),避免生产限流
```

### 数据库快查询(确认改动生效)
```bash
bash -c 'cd backend && node -e "
const {PrismaClient}=require(\"@prisma/client\");const p=new PrismaClient();
(async()=>{console.log(\"commodities:\",await p.commodity.count());
console.log(\"with prices:\",await p.commodity.count({where:{prices:{some:{}}}}));
await p.\$disconnect();})();" '
```

### 备份(动数据/迁移前)
```bash
./scripts/backup-db.sh
```

---

## 六、轮次归档

每轮结束后在 `docs/reviews/` 留一份 round 报告,命名 `YYYY-MM-DD-round-N.md`,
内容:本轮 A/B/C 各做了什么、验证结果、净变化(文件/行数)、遗留/阻塞。
保持与 `2026-06-14-*.md` 系列同格式。这是项目的"开发日志",长期价值高。

---

## 七、何时偏离此 workflow

- **紧急 hotfix**(线上故障):跳过规划,直接 fix → P0 质量门 → 部署,事后补记录
- **探索性调研**(不确定怎么做):只做步骤 1,产出"方案对比"文档,不实现
- **依赖升级**(高风险):单独成轮,只做 C3 一项,全程测试保护
