# MT Platform — Roadmap

**Last Updated**: 2026-07-06 | **Status**: Active

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

### 第 2 轮 — 数据与重定位启动 ✅ 完成(2026-06-29)
- **A**: **A2 商品级新鲜度** ✅ 新增 `/commodities/freshness` 端点 + 看板(coverage/stale 商品视图)
- **B**: **B2 Portfolio → 分析分组** ✅ 删交易语义(Position→GroupMember),M10 自然消失
- **C**: **C2 auth.ts 抽 authService** ✅ 857→~400 行,14 函数下沉 service,消除 refresh/createAuthSession 重复
- **质量门**: ✅ 集成测试 143/144 零 429(与第 1 轮一致,无回归)
- 详见 `reviews/2026-06-29-round-2.md`

### 第 3 轮 — 覆盖扩张与漏洞 ✅ 完成(2026-06-29)
- **A**: **诚实标记失效源** ✅ 诊断确认 8 个无 key 源外部端点全失效;scraperManager skip 改 error 记录(不再掩盖)
- **B**: **B3 AI 功能分层** ✅ 修 M7,VIEWER(免费)被拦截,EDITOR+(Pro)放行;aiAccess 接到 6 个 AI 端点
- **C**: **C2续 marketData 抽 service** ✅ marketData.ts 858→595 行,10 函数下沉 marketService.ts
- **质量门**: ✅ 189/190 通过零 429(测试数 144→190),build 成功
- 详见 `reviews/2026-06-29-round-3.md`

### 第 4 轮 — 收口 ✅ 完成(2026-06-29)
- **B**: **B4 死代码清理** ✅ Tier1(i18n 全套 + social.ts + 6 死组件 + DB DROP 3 表)+ Tier2(alert 8 死函数 + 连带测试),约 -1800 行
- **C**: **C2续 anomalies 抽 service** ✅ anomalies.ts 682→408 行,7 函数下沉 anomalyService
- **质量门**: ✅ 238/239 通过零 429(测试数 190→239),build 成功
- 详见 `reviews/2026-06-29-round-4.md`

### 第 5 轮 — datasets 重构 + bug 清零 ✅ 完成(2026-07-05)
- **C**: **C2续 datasets 抽 service** ✅ datasets.ts 648→374 行,7 函数下沉 datasetService(CSV/JSON import 整体下沉)
- **bug**: **FE-H6 credentials 嵌套** ✅ / **FE-M1 中文硬编码** ✅ / **FE-H1 loadSignal 竞态** ✅ 三个遗留前端 bug 清零
- **质量门**: ✅ 238/239 通过零 429(与第 4 轮一致,无回归),build 成功
- 详见 `reviews/2026-07-05-round-5.md`

### 第 6 轮 — models 重构 + L1 token ✅ 完成(2026-07-05)
- **C**: **C2续 models 抽 service** ✅ models.ts 629→511 行(退出胖路由),8 函数下沉 modelService;train/predict 留路由(inference+emit 耦合)
- **L1**: **#B8860B → primary token**(6 处,零风险)。其余图表 stroke 不动
- **质量门**: ✅ 238/239 通过零 429(无回归),build 成功
- 详见 `reviews/2026-07-05-round-6.md`

### 全面探索(2026-07-05)— ops-check + investigate
发现两个关键问题(详见 `reviews/2026-07-05-exploration.md`):
- ⚠️ **inference 服务(10810)DOWN** — venv 损坏(click.core/idna.core 缺失),AI 预测全静默失败。修复=重建 venv
- 📊 数据源实测修正:Round 3 判定的"端点全失效"实为"间歇可达但 0 产出"(success+warning),仅 fred/weather 因缺 key 是真 error

### 持续 (每轮附带)
- 清遗留 Bug 表
- 设计 token 化 (L1, 219 处,多数图表 stroke)
- a11y (L9)、CSP (L10)

---

## 后续轮次计划(基于全面探索,2026-07-05 重排)

经 ops-check + investigate 全面探索,优先级重排——**先恢复 AI 功能(inference)**,因它是平台核心且当前完全失效。

### 第 7 轮 — AI 功能恢复(P0,功能性) ✅ 完成(2026-07-05)
- **重建 inference venv** ✅ `rm -rf venv && python3 -m venv venv && pip install -r requirements.txt`(torch 2.12/chronos 2.3.1/sktime 1.0.1 等)
- **修复 checkAIAccess 回归** ✅ inference.ts 6 端点缺失 `authenticate`(B3 重构遗留),全部改为 `authenticate, checkAIAccess,` 链式 — 否则即便 ADMIN 也 403
- **接入 PM2** ✅ ecosystem.config.cjs 新增 `mt-inference`(2G mem limit / 10s kill / 30s listen / 15s min_uptime),pm2 save 已持久化
- **质量门**: ✅ inference /health 200 + /api/inference/status healthy + ADMIN predict 成功(crude_oil arima 真实预测)+ VIEWER 403 + 无 token 401;测试 433/434 通过(1 既有 live-DB 失败,与本次无关)

### 第 8 轮 — C3 升级 + metrics 收尾 ✅ 完成(2026-07-05)
- **C3 Next.js 15.5.15→15.5.20** ✅(原定 15.5.18,改用最新 patch;**Next.js 8 个 high 漏洞全清零**)+ 修 `next.config.mjs` 残留 `withNextIntl` 包装(Round 5 删 i18n 遗留休眠 bug)
- **C2续 metrics 抽 service** ✅ metrics.ts 657→388 行,新建 metricsService.ts(~330 行,进程级单例 store + Redis web-vitals 层);附带修 web-vitals 摄入回归(路由层 authenticate 压过 router.use 公开例外,前端无 auth 上报全 401)
- 质量门:✅ Next.js high 归零 + 测试 433/434(与 Round 7 一致,无回归)

### 第 9 轮 — 持续项收尾(L1 token / L9 a11y / L10 CSP) ✅ 完成(2026-07-05)
- L1 ✅ 27 处 arbitrary color 清零 / L9 ✅ apikeys label 关联修复 / L10 🟡 生产移除 unsafe-eval(unsafe-inline 待 nonce)
- 见 `reviews/2026-07-05-round-9.md`

### 第 10 轮 — 前端测试修复 ✅ 完成(2026-07-05)
- 根因:`is-core-module/core.json` 被 pnpm prune 误删(第三次磁盘损坏),非 next/jest 配置问题
- 修复后前端测试 20 suites / 272 tests 全过

### 第 11 轮 — 运维根治磁盘损坏 + 全面探查 ✅ 完成(2026-07-05)
- **根因确认**:`cron-cleanup.sh` 每日 `pnpm store prune`(pnpm 8.15 误删包文件)
- **根治**:移除 prune + integrity guard(cron-healthcheck 每 5min 巡检历史受害文件)+ 修 js-yaml 潜伏损坏
- **探查结论**(详见 `reviews/2026-07-05-round-11.md`):数据源 4 key 已到位 / 测试覆盖是最大风险 / 漏洞 multer+vitest ROI 高

---

## 后续轮次计划(基于核心价值链审计,2026-07-05 重排)

**重排依据(关键修正)**:核心价值链审计(`reviews/2026-07-05-core-value-chain-audit.md`)发现**整条 AI 预测链是断的** —— 调度在跑但 0 条预测落库(forecasts/anomalies/prediction_logs-completed 全为 0)。billing 无支付功能(静态套餐),按用户决策降级不再投入。**先通水管(让核心链产出)再装修(测试/漏洞)。**

> ⚠️ 前几轮(7-11)的"AI 已恢复"判断需修正:Round 7 修的是 inference 服务可达 + 单条手工 curl 能预测,但**批量调度链路从未跑通**(ARIMA 维度 bug + 队列状态不回写 + 72 商品无数据)。

### 第 12 轮 — 打通预测链路断点(P0,核心价值)
> 平台当前产出 0 条预测。这是最高优先级,不做这步后面都是空中楼阁。
- **修 ARIMA 维度 bug**(inference 服务):`array is 0-dimensional, but 1 were indexed` —— 批量调度路径的 numpy 维度错误,手工 curl 不触发但调度触发
- **修 predictionQueue 状态不回写**:1066 条 prediction_logs 全卡 `pending`,worker 静默吞异常 —— 补 try/catch + completed/failed 回写
- **验证 forecasts 落库**:跑通后确认 forecasts 表从 0 增长
- 质量门:至少 1 个有数据商品(如 crude_oil_cme)8 模型全部 completed 落库 + forecasts 表有真实预测行

### 第 13 轮 — 数据覆盖扩张(预测的输入)
> 72/110 商品 0 价格点 = 预测无输入。这是预测失败的根因。
- **补全 argentina stub**(唯一真 stub,空解析)
- **修脆弱源 0 产出**:abares(正则失效)/fao_prices(条件插入逻辑)/inac —— 逐个排查产出 0 的原因
- **核查 72 空商品的归属**:哪些品类完全无源、哪些有源但解析空
- 质量门:有数据商品 38→60+,活跃源产出率提升

### 第 14 轮 — 信号/分析链路激活
> tradingSignals/backtest/correlationAnalysis 服务代码真实存在但依赖 forecasts 数据(当前 0)。
- **tradingSignals 激活**: forecasts 有数据后,验证 BUY/SELL/HOLD 信号真实计算
- **backtest 激活**: 回测引擎 runBacktest 真实运行验证
- **correlationAnalysis 激活**: 131 因子当前仅 1 type —— 补因子采集
- 质量门:signals 有真实输出 + 至少 1 个回测报告生成

### 第 15 轮 — 核心链路测试保护
> 链路跑通后再补测试,否则测试的是断的链。
- predictionQueue / predictionCache / inference 边界测试(核心产品)
- dataIngestion orchestration(index/helpers/beefCutNormalizer)测试
- tradingSignals / backtest 单元测试
- 质量门:核心价值链关键模块有测试,防回归

### 第 16 轮 — 收尾(漏洞/前端/billing 静态化)
- 依赖漏洞清零(multer patch / vitest major)
- billing 正式降级为静态展示(移除冗余路由逻辑,保留套餐配置)
- 前端关键页面测试 + CSP nonce 化(可选)

### 降级:billing(静态套餐,不再投入开发资源)

---

## 第 17-19 轮 — 多技能审计后的优化实施 ✅ 完成(2026-07-06)

> 基于 [`reviews/2026-07-06-multi-skill-audit.md`](reviews/2026-07-06-multi-skill-audit.md)（6 技能交叉验证 + review 二次纠正）。执行细节见 [`reviews/2026-07-06-round-17-19.md`](reviews/2026-07-06-round-17-19.md)。

**Round 17 — P0-5 前端 build 失败 ✅**
- 根因：`forecasts/create/page.tsx` 残留深度学习模型的死渲染分支（`requiresWeights` + 不可达 string-input）→ TS 编译失败 → `next build` exit 1
- 修复：删死分支（+18/-39 行），`next build` exit 0，272 前端测试无回归

**Round 18 — P0-1 predictionCache 静默吞错 ✅**
- 根因：`predictionCache.ts:137/141` 两处 `.catch(()=>{})` 吞掉 `logPrediction` 失败 → prediction_logs 间歇停摆（与 Round 12 自述的"worker 静默吞异常"同类复发，不同路径）
- 修复：两处空 catch → `logger.error`（保持非阻塞）+ 回归测试（gen-tests 双向验证：无修复 FAIL / 有修复 PASS）

**Round 18 — P0-2 数据采集停摆根因（定位，非代码修复）✅**
- 取证：747 合格预测里 **691 条 actuals_after=0**；18 源里 16 个 inserted=0；"246K updated"是 `upsertPrice` 不比值导致的虚胖计数
- 真根因：**FRED 系列 lag**（DCOILWTICO/DHHNGSP 停在 6/29，上游未发新数据）+ Stooq 被 Cloudflare 拦 + 16 源解析失效
- **结论：非单点代码 bug，属主线 A（第 13 轮），归数据源排期**

**Round 19 — P0-3/4 MAPE 调参：判定不修（Iron Law）✅**
- 取证：调参最多 42→63（+21），但 **691（92.5%）无论调参都不可验证**（actuals=0）
- 根因在数据（P0-2），不在参数。**暂不修，等数据流入后再复核 7 天冷却**

**Round 19 — P1-8 加索引 ✅**
- 修正初版"5 个外键缺索引"误报 → **实际只 1 个真缺**（其余被 unique 复合左前缀覆盖）
- 修复：`WatchlistItem.commodityId` 加 `@@index`（待 `prisma migrate`）

**质量门：** ✅ 前后端 tsc 0 错误 / ✅ 前端 next build exit 0 / ✅ 后端 464 测试（1 预存在 live-DB 失败，无关）/ ✅ 前端 272 测试 / ✅ prisma validate

**关键修正：** 第 12 轮"forecasts 表增长"成功指标与实际架构不符——预测存 Redis 缓存（`prediction:*` TTL 45min），forecasts 仅训练路径写。**正确度量是 prediction_logs 增量**（见下方指标表）。

---

## 指标目标 (完成定义)

| 指标 | 起点 | 当前(Round 19 后) | 目标 |
|------|------|------|------|
| **prediction_logs 落库** | 1066 全 pending | **1591 completed + 42 verified** ✅(Round 12 状态机修复 + Round 18 吞错修复)| **每 30min 稳定增长**(待 Round 18 吞错修复生效后复测) |
| ~~forecasts 表~~ | ~~0~~ | ~~0~~ | **指标废弃**(架构错配:预测存 Redis 缓存,forecasts 仅训练路径写;改用 prediction_logs) |
| **MAPE 可验证率** | — | **42/747 (5.6%)** ⚠️ | **>50%** (依赖主线 A 数据流入:691/747 actuals_after=0) |
| **MAPE 均值(质量)** | — | **149%** ⚠️(比朴素法差 1.5 倍) | **<30%** |
| **有数据商品** | 34.5% | **35%(38/110)** | **≥60%** |
| **市场因子类型** | 131(声称)| **1 type / 48 行** | **多类型覆盖** |
| 商品数据覆盖率 | 34.5% | 35% | **≥60%** |
| 依赖漏洞 (high+critical) | 51 | **43** | **0** |
| 胖路由 (>600 行) | 6 | **0** ✅ | **0** |
| 路由直连 Prisma | 208 处 | **~60** | **<30** |
| 测试 429 假失败 | 存在 | **0** ✅ | **0** |
| 前端测试可运行 | ❌ | **✅**(272/272) | ✅ |
| **前端 next build** | ❌(Round 17 前 exit 1) | **✅ exit 0**(Round 17) | ✅ |
| inference 服务可达 | ❌ DOWN | **✅ UP**(Round 7) | ✅ |
| 磁盘损坏复发 | 3 次 | **✅ 根治**(Round 11) | 0 次 |
| L1 token 化 | 27 处 | **0** ✅ | **0** |

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
