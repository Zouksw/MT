# Round 27 — 多技能深度探查 + 后续开发计划

**日期**: 2026-07-12
**使用的 skills**: ops-check, review, investigate, 4× Explore agents, inference-debug
**方法**: 只读探查(无代码改动)。4 个 Explore agent 并行扫后端架构/前端数据层/数据管线/测试盲区;review skill 审 PR #1;ops-check 查实时状态;实查 DB 产出数据。

---

## 一、当前基线实测 (2026-07-12)

| 维度 | 数值 | 趋势 vs ROADMAP (06-29) |
|------|------|------------------------|
| 商品数据覆盖率 | **40/110 = 36.4%** | ⬆ +1.9pp (34.5→36.4),离 60% 红线仍远 |
| prediction_logs | **36,810 completed / 90 verified** | ⬆ 调度链已通(Round 12 修通) |
| forecasts 表 | (查询中,MAPE 轮已激活验证) | ✅ 预测链产出 |
| 依赖漏洞 | 后端 **16** (1 crit/5 high) · 前端 **18** (6 high) | 高危未清零 |
| PM2 进程 | mt-backend/frontend/inference **全 online** | ✅ |
| 端口 | 8000/3000/10810/5432/6379 全监听 | ✅ |
| 健康端点 | backend `/health` 200 · inference `/health` 200 · frontend 200 | ✅ |

**关键判断**: 平台"水管"已通(预测在产),但**覆盖率几乎没动**(34.5→36.4)。瓶颈不是代码,是数据源。

---

## 二、四路 Explore 扫描结论 (file:line 证据)

### 2.1 后端架构债

| 优先级 | 发现 | 证据 |
|--------|------|------|
| 🔴 高 | 4 个路由无 service 层,共 **57 处直连 prisma** | watchlist(17) / beef(15) / portfolios(15) / timeseries(10) — `services/` 无对应文件 |
| 🟡 中 | inference.ts **envelope 不一致**: 7 处裸 `res.json` vs 4 处 `success()` | routes/inference.ts: 56,197,315,411,421,435,451 |
| 🟢 低 | datasets.ts 1 处裸 res.json | routes/datasets.ts:99 |
| ✅ 无 | predictionQueue/BullMQ 引用 — **全清零** | 删除彻底,无残留 |
| ✅ 无 | TODO/FIXME/HACK 注释 — **0 处** | 整个 src/ 无 |

### 2.2 前端数据层债 (ROADMAP C4 主线)

| 优先级 | 发现 | 证据 |
|--------|------|------|
| 🔴 高 | **header 每 30s 手动 setInterval 轮询** (非 SWR) | components/header/index.tsx:40 — 最高 ROI SWR 迁移 |
| 🔴 高 | **3 个 `API_BASE` 定义并存** (lib/api.ts:7 / lib/beef.ts:12 / lib/ai-utils.ts:33) | + 多页 `const API_BASE=""` 空操作 |
| 🟡 中 | 14 页用原生 `useEffect+fetch` 而非 SWR | dashboard/performance(4 fetch+30s poll) / settings/data-sources / ai/backtest / useTradingData.ts:249 |
| 🟡 中 | `as React.ComponentType<any>` 共 ~30 处 | AnomalyChart/PredictionChart(各 10) / performance(8) — 单一 typed 包装器可消除 |
| ✅ 无 | phosphor 残留 / recharts 未动态导入 — **全清** | |

### 2.3 数据管线债 (最关键 — 决定覆盖率能否破 60%)

| 优先级 | 发现 | 证据 |
|--------|------|------|
| 🔴 高 | **4 个源因 key 缺失而休眠** | FRED_API_KEY(完全不存在) / OPENWEATHER(空) / MLA(空) / USDA_MARS(空) |
| 🔴 高 | `argentina` 是**永久 no-op 占位** | argentinaData.ts:18-25 — 直接 return {0,0},贡献 0% |
| 🔴 高 | `upsertFactor` 有**同 upsertPrice 一样的 count 膨胀 bug** | helpers.ts:122-155 — 无 same-value 短路,影响所有 factor 源 |
| 🟡 中 | `fredData.ts:135` 硬编码 `slice(0,12)` + `observation_start=2024-01-01` | 回填被截断,无法取历史 |
| 🟡 中 | `chinaWholesale` 只取第 1 页(pageSize:50)无翻页循环 | chinaWholesale.ts:131 — 静默截断 |
| 🟡 中 | `runSourcesAndLog` 把**抛错误标为 warning**(非 error) | server.ts:36,55-58 — 新鲜度看板少计失败 |
| 🟡 中 | `runAll` 用 allSettled 但**丢弃 rejected 源** | scraperManager.ts:47-51 — 手动 refresh-all 看不到失败源 |
| 🟠 注意 | 多源**伪造 OHLC** (close±0.1~0.5% 当 high/low) | cmeFutures/commodityPrices/dce/chinaWholesale/balticDry/fao/usdaAms — 存为真实数据 |

### 2.4 测试覆盖盲区

| 优先级 | 发现 | 证据 |
|--------|------|------|
| 🔴 高 | `security.ts`(11.6KB,安全头/IP 白名单/审计)**零测试** | 高爆炸半径 |
| 🔴 高 | `authService.ts`(10KB,登录/注册/JWT 核心)**无 service 级测试** | 仅路由级 auth.test.ts,DB 断开即静默跳过 |
| 🟡 中 | predictionCache 后台调度**无 setInterval→setEx 测试** | 预测缓存写入路径未被验证 |
| 🟡 中 | `/api/inference/predict` **无 HTTP 级 prediction_log 落库断言** | MAPE 写入契约端到端未测 |
| 🟡 中 | 覆盖率门槛**仅 50%**(branches/functions/lines/statements) | vitest.config.ts:14-19 — 太低,大模块 0% 仍过 |
| 🟠 注意 | **11 个测试文件** `if(!dbAvailable)return;` 静默跳过 | 本地无 Postgres 时 0 断言假绿(CI 有 DB 所以跑) |
| 🟢 低 | tradingSignals `supportLevel/resistanceLevel`/confidence 0.7-0.3 混合公式未断言 | tradingSignals.test.ts 缺这些分支 |

---

## 三、PR #1 Review (review skill)

```
PR REVIEW — fix/inference-slug-uuid-and-round-25-cleanup → main
═══════════════════════════════════════
Scope: CLEAN (Round 25 清理 + Round 26 slug/UUID 修复,符合 PR 描述)
Plan:  无独立 plan 文件 (按轮次执行)

CRITICAL findings: 无

INFORMATIONAL findings:
  1. [inference.ts] envelope 不一致 — 7 处裸 res.json 未统一(已知,本轮范围外,P3 跟进)
  2. [helpers.ts:122-155] upsertFactor count 膨胀 — 同 upsertPrice 同类 bug(数据管线债)
  3. [server.ts:36] runSourcesAndLog 误标失败为 warning — 新鲜度看板不准

Verdict: SHIP (无 CRITICAL;Round 26 slug/UUID 修复经双向回归测试验证)
```

**注意**: PR diff 含 16 commits(含 2 个并行会话 commit: MAPE 解堵 + beef FRED 回填)。合并前需确认 main 已推进到 round-24(否则 PR 会带入 round-12~24 的全部历史)。

---

## 四、后续开发计划 (按 ROI 与依赖排序)

> 原则: **先扩覆盖率(平台价值)→ 再堵数据质量 → 然后清架构债 → 最后安全/漏洞**。每轮仍在 A/B/C 三主线各推一步。

### 第 27 轮 — 数据源激活 (主线 A,ROI 最高) 🎯

**为什么先做**: 覆盖率 36.4% 是存在性威胁,而 4 个源休眠**纯粹因缺 key**,是最低成本的最大覆盖增量。

| 子项 | 动作 | 验证 |
|------|------|------|
| A-key | 填 FRED/OPENWEATHER/MLA/USDA_MARS 4 个 key 到 `.env` + `.env.production` | 重启后 ingestionLog 4 源 status=success 且 inserted>0 |
| A-argentina | `argentinaData.ts` 要么实现要么从注册表移除(非永久占位) | 不再有 {0,0} 静默源 |
| A-paginate | 修 `chinaWholesale` 翻页 + `fredData` slice 限制 | 单次抓取行数提升 |

**质量门**: 覆盖率 36.4% → **45%+**

### 第 28 轮 — 数据质量 (主线 A 续 + 调度修复)

| 子项 | 动作 | file:line |
|------|------|-----------|
| A-upsertFactor | 复用 upsertPrice 的 same-value 短路 | helpers.ts:122-155 |
| A-serverLog | 抛错标 error 非 warning + runAll 不丢 rejected | server.ts:36 / scraperManager.ts:47-51 |
| B-verify | 验证 brl_usd 96% MAPE(疑似单位错) | mapeTracking 输出 |

**质量门**: ingestionLog 错误计数准确 + 无 count 膨胀

### 第 29 轮 — 架构债: 胖路由 service 抽取 (主线 C)

**顺序** (按 prisma 直连数): watchlist(17) → beef(15) → portfolios(15) → timeseries(10)

| 子项 | 目标 | 验证 |
|------|------|------|
| C-watchlist | 抽 watchlistService.ts,路由 0 处 prisma | 路由 <200 行 |
| C-beef | 抽 beefService.ts | (同上) |

**质量门**: 路由文件 0 处 `prisma.` + 测试不回归

### 第 30 轮 — 前端数据层统一 (主线 C4)

| 子项 | 动作 | file:line |
|------|------|-----------|
| C4-header | header 轮询 → `useSWR(refreshInterval:30000)` | header/index.tsx:40 |
| C4-apiBase | 合并 3 个 API_BASE 到 lib/api.ts 单一导出 | lib/api.ts:7 / beef.ts:12 / ai-utils.ts:33 |
| C4-performance | dashboard/performance 4 fetch → SWR | dashboard/performance/page.tsx:119-157 |

**质量门**: 0 处 `const API_BASE=""` 空操作 + header 无手动 setInterval

### 第 31 轮 — envelope 统一 + 测试补强 (主线 C)

| 子项 | 动作 | file:line |
|------|------|-----------|
| C-envelope | inference.ts 7 处裸 res.json → success() | inference.ts: 56,197,315,411,421,435,451 |
| T-security | security.ts 补测试(IP 白名单/审计) | routes/security.ts |
| T-authService | authService.ts 补 service 级测试 | services/authService.ts |
| T-cache | predictionCache setInterval→setEx 测试 (vi.useFakeTimers) | predictionCache.ts:187 |

**质量门**: inference.ts 0 处裸 res.json + 覆盖率门槛 50→65%

### 第 32 轮 — 依赖漏洞清零 (主线 C3)

| 子项 | 动作 |
|------|------|
| C3-backend | 评估 Express 4→5(清 qs 链) + Multer DoS patch |
| C3-frontend | Next.js patch + 剩余 high |

**质量门**: `pnpm audit` 各端 0 critical、0 high
**依赖**: C1(进程内测试)已完成,升级有测试网兜底

---

## 五、优先级矩阵 (决策视图)

```
        高 ROI
          ▲
          │
   27轮   │   29轮
  数据源   │  胖路由
  (覆盖)   │  (可维护)
          │
 ─────────┼─────────►  紧迫度
          │
   28轮   │   30/31轮
  数据质量 │  前端/测试
  (准确)   │  (稳健)
          │
          │   32轮
          │   漏洞
          │  (安全)
          ▼
        低 ROI
```

---

## 六、明确"不做"清单 (避免过度工程)

- ❌ validateApiKey 中间件 — 保留,未来用
- ❌ axios 迁移 — 与 fetch 耦合太深,ROI 低
- ❌ organizations 表复活 — 已删,无需求
- ❌ Storybook 重装 — 已验证 0 用例
- ❌ 重写数据源 OHLC 伪造 — 现阶段数据量优先于精度,记录在案

---

## 七、风险与阻塞

1. **FRED key 是最大阻塞** — 4 个休眠源里 FRED 影响最大(多源 baltic/cme 依赖其数据)。需用户/运维提供。
2. **PR #1 合并需推进 main** — origin/main 停在 round-14,PR 含 16 commits。建议先把 main 推到 round-24,或接受大 PR。
3. **MAPE 验证率低** — 36,810 completed 仅 90 verified(0.24%)。Round 28 的 brl_usd 96% 异常需先排查单位问题。

---

## 八、文件索引 (本轮新发现的可操作项证据)

- 数据源 key 缺失: `backend/src/services/dataIngestion/sources/{fredData,weatherData,mlaNlrs,usdaAms}.ts`
- upsertFactor bug: `backend/src/services/dataIngestion/helpers.ts:122-155`
- 调度日志误标: `backend/src/server.ts:36,55-58`
- 胖路由: `backend/src/routes/{watchlist,beef,portfolios,timeseries}.ts`
- envelope 不一致: `backend/src/routes/inference.ts` (7 处)
- 前端 header 轮询: `frontend/src/components/header/index.tsx:40`
- API_BASE 三重定义: `frontend/src/lib/{api,beef,ai-utils}.ts`
- 测试盲区: `backend/src/routes/security.ts` / `backend/src/services/authService.ts`
