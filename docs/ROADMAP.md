# MT Platform — Roadmap

**Last Updated**: 2026-06-29 | **Status**: Active

> 大宗商品市场**信息与分析**平台(非交易平台)。本文档是后续开发的单一事实来源,
> 替代 2026-06-06 旧版。所有数字均为 2026-06-29 实测,非估算。

---

## 当前基线 (2026-06-29 实测)

| 维度 | 数值 | 说明 |
|------|------|------|
| 商品数据覆盖率 | **34.5%** (38/110) | 生存红线:需提升至 60%+ |
| 数据源数量 | 20 个 | abares/argentina/baltic/cepea/chinaCustoms/chinaWholesale/cme/dce/fao/fred/inac/manualImport/mlaNlrs/secex/shipping/usdaAms/usdaPsd/weather/worldBank/commodityPrices |
| 依赖漏洞 | **51 个** (后端 16 / 前端 35) | 含 Next.js SSRF/XSS/缓存投毒、Multer DoS、qs 原型污染 |
| 胖路由 (>600 行) | **6 个** | auth 857 / marketData 792 / anomalies 682 / metrics 657 / datasets 648 / models 629 |
| 测试套件 | 后端 30 + 前端 22 | 集成测试打 HTTP 8000 端口,与生产 Redis 限流冲突 → 429 假失败 |
| AI 模型 | 8 个 (5 统计 + 3 深度学习) | inference-service (Python, 端口 10810) |
| API 延迟 | <25ms (12 端点均值) | 种子数据量,健康 |
| 前端 First Load | 325KB (非图表) / 392KB (图表) | 已优化 recharts 分包 |
| 数据库索引 | 106 个 | 含 Round 3 新增的 prediction_logs 复合索引 |

---

## 三条并行主线

经产品决策,**三条主线并行推进**,每轮各推进一步,避免任何单一线路长期阻塞。

```
主线 A — 数据覆盖           主线 B — 产品重定位          主线 C — 技术债 / 上线就绪
─────────────────          ──────────────────          ─────────────────────────
34.5% → 60%+               Simulation → 回测工具        胖路由抽服务层
激活/修复数据源              Portfolio → 分析分组         进程内测试重构
新鲜度监控                  Billing → AI 分层            依赖漏洞清零
                          清理死功能                   前端数据层统一
```

---

## 主线 A:数据覆盖冲刺 (Existential)

**目标**: 34.5% → 60%+ 商品覆盖率。没有数据,平台没有价值。

> ⚠️ **A 线暂缓**(2026-06-29):数据源审计发现 4 个 API key(FRED/OPENWEATHER/MLA/USDA_MARS)
> **实际为空**(与旧 ROADMAP 描述相反),这是 6 个源停摆的根因。20 个源里仅 3 个真产数据。
> 待 key 到位后单独成轮激活。详见 `reviews/2026-06-29-round-1.md`。

### A1. 数据源健康审计与激活 — **审计已完成,激活待 key**
- ✅ 审计完成:20 个源中仅 3 个健康(commodity_prices/cme_futures/world_bank),17 个静默归零
- 6 个源停摆根因 = 4 个 API key 缺失(fred/mla_nlrs/usda_ams/weather/cepea/inac)
- 8 个源是抓取逻辑失效(dce_futures/fao_prices/usda_psd/baltic_dry 等),无需 key 也零产出
- **阻塞**: 等 FRED/OPENWEATHER/MLA/USDA_MARS 4 个 key;key 到位后填入 `.env` + `.env.production` + pm2 restart
- **验证标准**: 重启后 ingestionLog 里 6 个源 status=success 且 inserted/updated > 0

### A2. 数据新鲜度监控
- 新增看板/告警:每个商品"最后更新时间",超过阈值(如 7 天)标红
- 复用 Round 2 已修复的 `marketData` freshness 逻辑 (`elapsedMs > MS_PER_DAY`)
- **验证标准**: 后台能看到全部 110 商品的最新数据时间分布

### A3. 缺口商品定向补采
- 对照 commodity 全表 (110 个),找出 72 个无价格商品的归属数据源
- 对无现成源的商品,评估:接入新源 / 标记为"暂无数据" / 从目录移除

### A4. 接入层集成测试
- 为每个数据源写"产出正确记录"的集成测试(旧 ROADMAP P3 遗留)
- **验证标准**: 每源至少 1 个测试,验证 upsert 后 commodity/prices 表有预期行

---

## 主线 B:产品重定位 (Alignment)

**目标**: 让所有功能符合"信息平台,非交易平台"定位 (CLAUDE.md)。

### B1. Simulation → 预测回测工具 — **优先**
- 移除 BUY/SELL 模拟下单交互
- 改为"AI 预测 vs 实际价格"准确率图表 (复用 prediction_logs 表 + Round 3 新索引)
- **验证标准**: /simulation 页面不再出现下单动作,展示预测命中率/MAPE 走势
- **注意**: 这会改变现有交互,需保留历史模拟数据迁移路径

### B2. Portfolio → 分析分组
- 投资组合改为"商品观察分组",支持相关品种叠加对比
- 复用 watchlist 基础设施
- **依赖**: 修 M10 (portfolios 平仓用 stale unrealizedPnl,见下方遗留表)

### B3. Billing → AI 功能分层
- Stripe 计费改为 AI 功能分层:免费层限制信号/模型数,Pro 解锁全部
- **依赖**: 修 M7/M8 (VIEWER 可调 AI 端点、aiAccess 角色分层,见下方遗留表)

### B4. 清理死功能
- 旧 ROADMAP 标注:清理 alert 系统的死导出/未用函数
- 评估 L3/L4 (i18n 是摆设、死组件) — 上一轮已删 4 个死组件,剩余评估

---

## 主线 C:技术债 / 上线就绪 (Maintainability)

**目标**: 让代码库可维护、可上线、可测。

### C1. 进程内测试重构 — **第 1 轮优先**
- **根因**: 集成测试打 HTTP 8000 端口,与生产后端共享 Redis → 限流/authLockout 触发 429 假失败
- **方案**: 改用 `supertest` 内存 app 实例 (不占端口、不依赖 Redis 全局状态),
  测试专用 Redis DB 或 mock
- **已做缓解** (本轮): rateLimiter 在 test/staging 以外环境跳过限流
- **验证标准**: `pnpm test` 单命令跑完全量,0 个 429 假失败

### C2. 胖路由抽服务层
- 6 个 >600 行路由逐个拆:路由只做 HTTP 边界 + 委托,业务逻辑下沉 service
- **最大架构债**: 18/21 路由共 208 处直连 Prisma,服务层形同虚设
- **顺序**: auth (857) → marketData (792) → anomalies (682) → 其余
- **验证标准**: 每个抽完后,路由行数 <300,路由文件 0 处 `prisma.` 调用

### C3. 依赖漏洞清零
- **后端 16 个**: Multer DoS (high) 等;评估 Express 4 → 5 清掉 qs 链
- **前端 35 个**: Next.js SSRF/XSS/缓存投毒 (high);升级 Next.js 主版本
- **验证标准**: `pnpm audit` 各端 0 high、0 critical
- **注意**: 升级主版本有破坏性变更风险,需配套测试(C1 完成后更安全)

### C4. 前端数据层统一
- **现状**: SWR (`lib/api.ts`, 13 页) 与原生 fetch (`authFetch` + 手动 state, 14 页) 并行
- 统一为 SWR,消除重复的 loading/error 实现
- **验证标准**: 0 处 `authFetch` 直接调用页面级数据获取

### C5. 设计 token 化
- 376 处硬编码 hex 颜色 → design token
- 合并 DESIGN.md (上轮已归档根目录版本,docs/ 为准)

---

## 遗留 Bug 清单 (跨主线,随轮次清)

| ID | 严重度 | 缺陷 | 归属主线 | 状态 |
|----|--------|------|----------|------|
| M7 | 🟡 | manualImport 逐行 findUnique+update 无事务/无 upsert,慢且 race | C2 | 待修 |
| M10 | 🟡 | portfolios 平仓用 stale unrealizedPnl 作 realizedPnl | B2 | 待修 |
| M8 | 🟡 | 警报验证缺失 | B4 | 待修 |
| FE-H1 | 🟠 | trading/page loadSignal 无 race guard,快切商品显示错误信号 | C2/B1 | 待修 |
| FE-H6 | 🟠 | ai/predict credentials:"include" 错误嵌套在 headers 里,静默禁用 cookie auth | C4 | 待修 |
| FE-M1 | 🟡 | 主交易控件硬编码中文("K线"/"折线"/"日/周/月")在英文 UI | B1 | 待修 |

> 已修复(本轮 + 前两轮):C1/C2/C3/C4(Critical)、H1/H2/H3/H4/H5/H6/H7、M3/M6、FE-C1/C3/C4 等。

---

## 分轮次执行计划

每轮遵循统一节奏(详见 `docs/developer/DEVELOPMENT-WORKFLOW.md`)。每轮在三主线各推一步。

### 第 1 轮 — 地基 (基础先行) ✅ 完成(2026-06-29)
- **A**: 数据源健康审计完成 → **暂缓**(4 个 key 实际为空,待 key 到位)
- **B**: **B1 Simulation 重定位** ✅ 删除伪交易系统(3 表 0 行安全删除),`/ai/backtest` 成为唯一回测入口
- **C**: **C1 进程内测试重构** ✅ 抽 `createApp()` 工厂,集成测试 143/144 通过、**零 429 假失败**
- **质量门**: ✅ tsc 0 错误 / build 成功 / 集成测试无 429
- 详见 `reviews/2026-06-29-round-1.md`

### 第 2 轮 — 数据与重定位启动
- **A**: A2 新鲜度监控看板
- **B**: B1 Simulation → 回测工具实现
- **C**: C2 auth.ts (857行) 抽服务层 (示范样板)
- **质量门**: + 进程内测试覆盖新代码

### 第 3 轮 — 覆盖扩张与漏洞
- **A**: A3 缺口商品定向补采
- **B**: B2 Portfolio → 分析分组
- **C**: C3 前端 Next.js 升级 (依赖 C1 测试保护)
- **质量门**: + audit high/critical 归零

### 第 4 轮 — 收口
- **A**: A4 数据源集成测试
- **B**: B3 Billing → AI 分层 + B4 死功能清理
- **C**: C2 剩余胖路由 + C4 前端数据层统一
- **质量门**: 覆盖率 ≥60%、胖路由清零、数据层统一

### 持续 (每轮附带)
- 清遗留 Bug 表
- 设计 token 化 (L1, 376 处)
- a11y (L9)、CSP (L10)

---

## 指标目标 (完成定义)

| 指标 | 起点 | 当前 | 目标 |
|------|------|------|------|
| 商品数据覆盖率 | 34.5% | 34.5%(A 线暂缓) | **≥60%** |
| 依赖漏洞 (high+critical) | 51 | 51 | **0** |
| 胖路由 (>600 行) | 6 | 5(community 已删) | **0** |
| 路由直连 Prisma | 208 处 | ~200 | **<30** (仅简单 CRUD) |
| 测试 429 假失败 | 存在 | **0** ✅(C1 进程内测试) | **0** |
| 前端数据获取模式 | 2 套 | 2 套 | **1 套 (SWR)** |
| Simulation 定位 | 模拟交易(伪) | **回测工具** ✅(B1 已删伪交易) | 回测工具 |

---

## NOT Planned (明确不做)

沿用旧版决策:
- ~~GraphQL~~ — REST 足够
- ~~Kubernetes~~ — systemd/PM2 适配当前规模
- ~~ClickHouse~~ — PostgreSQL 够用
- ~~多区域部署~~ — 单区域适配
- ~~SDK 生成~~ — 用户基数未到

---

## Links

- **GitHub**: https://github.com/Zouksw/MT
- **开发 Workflow**: [developer/DEVELOPMENT-WORKFLOW.md](developer/DEVELOPMENT-WORKFLOW.md)
- **CHANGELOG**: [CHANGELOG.md](CHANGELOG.md)
- **Design System**: [DESIGN.md](DESIGN.md)
- **审查档案**: [reviews/](reviews/) (2026-06-14 全量审查 + bugfix + benchmark)
