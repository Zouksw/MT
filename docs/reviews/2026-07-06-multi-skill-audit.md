# 多技能深度审计 — 运行态 / 核心价值链 / 架构债

**Date:** 2026-07-06
**Skills applied:** ops-check · inference-debug · investigate · review · design-review · careful
**本文状态:** 已通过 review skill 二次验证（见 §5.5），纠正了 5 处初版不精确结论。
**目的:** 在 ROADMAP 第 16 轮之后，用 6 个技能交叉验证项目的真实运行态与优化项，而非凭假设。本文是对话归档版，可与 `2026-07-05-core-value-chain-audit.md`（上一轮基线）对照阅读。

---

## 0. 一句话结论

> 服务全 UP、tsc 通过、inference 能预测，但**核心价值链仍未真正健康**：预测调度存在静默吞错（导致 prediction_logs 间歇停摆）、MAPE 反馈环断裂（1591 条预测仅 42 条可验证、均值 149%）、ROADMAP 自定义的"forecasts 表增长"成功指标与实际 Redis 缓存架构对不上。架构层面：72 个死导出、5 个外键缺索引、前端 `'use client'` 泛滥（79%）、数据层碎片化、裸 `setInterval` 调度。

---

## 1. 运行态实测（ops-check）

| 层 | 端口 | 状态 | 证据 |
|---|---|---|---|
| mt-backend | 8000 | ✅ online | `/health` 200（1.2ms），uptime 96min，1 次重启 |
| mt-frontend | 3000 | ✅ online | 根路径 200（13ms），uptime 103min |
| mt-inference | 10810 | ✅ online | `/health` 200；**28min 内 3 次重启**（待查） |
| postgres | 5432 | ✅ | listening |
| redis | 6379 | ✅ PONG | **版本 6.0.16 < 建议 6.2.0**（日志噪声源） |
| nginx | 80 | ❌ 未安装 | 拓扑写了 nginx，但主机无此进程（部署文档需更新） |

磁盘：23G/40G（62%）。无 EADDRINUSE / ECONNREFUSED。所有服务可达。

---

## 2. 核心价值链真相（investigate + DB 实测）

### 2.1 与上一轮基线的对照（进展确认）

上一轮（2026-07-05 core-value-chain-audit）记录 1066 条 prediction_logs 全 `pending`、0 completed。本轮实测：

| 指标 | 上轮(07-05) | 本轮(07-06) | 解读 |
|---|---|---|---|
| prediction_logs | 1066 全 pending | **1591 completed + 42 verified** | ✅ Round 12 的状态机修复确实生效，pending 已清零 |
| forecasts 表 | 0 | **0** | ⚠️ 见 2.3：这是架构错配，不是 bug |
| anomalies 表 | 0 | **0** | ⚠️ 异常检测从未自动产出 |
| 有价格商品 | 38/110 (35%) | **38/110 (34.5%)** | 数据覆盖本轮无进展 |
| 市场因子 | 1 type / 45 行 | **1 type（exchange_rate）/ 48 行** | 因子类型仍单一 |

### 2.2 🔴 新发现：prediction_logs 间歇停摆（静默吞错未根治）

`prediction_logs` 最后一次写入是 **03:48（约 8 小时前）**，期间调度日志显示 11:48 仍打 `Refreshing predictions for ... (5 models)`、Redis 缓存仍在更新（130 个 `prediction:*` key），但**没有新 prediction_logs 行**。

**根因（已定位到代码）：**

`backend/src/services/predictionCache.ts:138-151` —— `runAndCachePrediction` 里 `logPrediction()` 的调用被 `.catch(() => {})` 静默吞掉：

```ts
import("./mapeTracking")
  .then(({ logPrediction }) => {
    logPrediction({...}).catch(() => { /* non-blocking */ });
  })
  .catch(() => { /* non-blocking */ });
```

> 这与 ROADMAP 第 12 轮自述的"worker 静默吞异常"是**同一类 bug 在不同位置复发**。Round 12 修了 predictionQueue worker 的回写，但 predictionCache（另一条预测路径）的同款吞错仍在。后台 PM2 重启后 refreshTimer 重新跑，但 DB 写失败被吞，于是"调度在跑、缓存更新、日志没落库"。

**附加风险点：** `predictionCache.ts:208` 的 `refreshTimer.unref()` 让定时器不阻止进程退出，在事件循环空闲时易被回收。

### 2.3 🔴 "forecasts 表增长"是误导性成功指标

ROADMAP 指标目标写"预测成功落库：每 30min 增长"，并把 forecasts 表作为度量。**实测：预测结果存 Redis 缓存（`prediction:{commodityId}:{modelId}:{horizon}`，TTL 45min），forecasts 表仅由 `modelService.ts:119` 的训练路径 `createMany` 写入。** 普通预测调度永远写不进 forecasts。这个成功指标与架构对不上，需要改为以 prediction_logs 增量为度量。

### 2.4 🔴 MAPE 反馈环断裂 — 根因已精确定位（review skill 验证）

> 经 review skill 二次验证，**纠正了初版报告的"数据稀疏"猜测，根因更深**。

`mapeTracking.ts:117` 的 `verifyDuePredictions` 硬编码 `predictedAt <= now - 7 days`（7 天冷却期）。1591 条 completed 的年龄分布实测：

| 区间 | 数量 | 可验证性 |
|---|---|---|
| 太新（< 7 天）| 844 | 被 7 天冷却排除 |
| 合资格（≥ 7 天）| **747** | 应进入验证 |

但这 747 条里，再查"预测时刻之后是否有 actuals"：

| actuals_after（predicted_at 之后的每日价格数）| 预测数 |
|---|---|
| **0 条** | **691** ← 真正卡点 |
| 1–2 条 | 35 |
| ≥ 3 条（可验证）| 21 |

**根因（精确版）：** 747 条合资格预测里 **691 条（92.5%）的预测时刻之后完全没有新的 daily 价格数据**。也就是说——**这些商品的价格采集在预测时刻之后就停了**，actuals 永远到不了。预测永远无法对比实际值。

抽样证据（5 月 19 日的预测，至今 actuals_after 全为 0）：
```
commodity 29532929... predicted 2026-05-19 → actuals_after = 0
commodity bc480a74... predicted 2026-05-19 → actuals_after = 0
commodity 095346d8... predicted 2026-05-19 → actuals_after = 0
... (连续 8 条全 0)
```

这与 §2.2 的 ingestion 实测呼应：18 个源里 16 个 `inserted=0`，价格数据基本不再增长 → 旧预测永远等不到 actuals。

**质量结论：** 42 条 verified 的 **MAPE 均值 149%（min 0%, max 352%）**——统计模型在稀疏数据上比朴素法（用上一个值）还差 1.5 倍。平台宣称的"6 模型并行预测 + 准确率信号"目前**既几乎不可验证（747 合格中仅 42 通过）又质量极差**。

> 附带发现（review 修正）：ARIMA 的 500 维度 bug **已在 `statistical_models.py:34-38` 修复**（<4 点优雅降级为 naive），最后一条 500 是 2026-07-05 23:11（历史），最近 191 条 /predict 全 200。ROADMAP 第 12 轮的 ARIMA 修复确已生效。

---

## 3. 架构债与代码质量（review + design-review）

### 3.1 后端

| 项 | 证据 | 严重度 |
|---|---|---|
| **72 个未使用导出** | ts-prune；最重 `cache.ts`(8)、`inference/index.ts`(7)、`alerts.ts`(6)；`apiKeys.ts:123 validateApiKey` 疑似死认证路径 | 🟠 |
| **5 个外键缺索引** | `Dataset.organization_id`、`Timeseries.datasetId`、`organization_members.organization_id`、`WatchlistItem.commodityId`、`Subscription.userId` | 🟠 |
| 裸 `setInterval` 调度 | `server.ts:152,164,179,184` + `predictionCache.ts:142`；项目已装 BullMQ 但 cron 路径没用 | 🟠 |
| 复杂度热点 | `beefCutNormalizer.ts`(852 行)、`auth.ts`(628)、`marketData.ts`(595) | 🟡 |
| 测试门槛 50% | `vitest.config.ts` branches/functions/lines/statements 全 50% | 🟡 |
| ✅ 零 TODO/`console.log`/硬编码 secret | 全 src 扫描 | — |
| ✅ tsc --noEmit 通过 | exit 0 | — |
| ✅ 17/17 业务路由有 authenticate | 全量核查 | — |

### 3.2 前端

| 项 | 证据 | 严重度 |
|---|---|---|
| **TS 编译错误（实测 build 失败）** | `next build` 实跑：`✓ Compiled successfully` 后 **"Failed to compile"** 在 `forecasts/create/page.tsx:303`（`requiresWeights` 联合类型不存在）+ `:362`（`unknown` 赋值 `string`）；**前端生产 build 当前是断的** | 🔴 |
| **'use client' 泛滥** | 122/154 tsx（79%）；48/52 页面是 client 组件，RSC/SEO 收益尽失 | 🟠 |
| 数据层碎片化 | 46 处裸 `fetch()`；`API_BASE` 在 15 文件重复（`dashboard/performance` 用 `/api` 后缀不一致）；33 处内联 `Bearer` 构造 | 🟠 |
| 死配置 | `next.config.mjs:9` `transpilePackages:["@refinedev/antd"]`；`optimizePackageImports` 含 antd/refine/lodash（均未安装）；`package.json` overrides 同样有死 lodash | 🟡 |
| 硬编码颜色 | 161 处 hex（最重 `MultiSourceChart` 28 处） | 🟡 |
| Tailwind v4 用 v3 JS 配置 | `tokens.css` 与 `tailwind.config.ts` 双源且漂移（`2xl` radius、缺 `gray-950`） | 🟡 |
| 复杂度热点 | `dashboard/performance`(749)、`alerts/rules`(680)、`apikeys/show`(592) god-component | 🟡 |
| `knip` 已装未配置 | 无 `knip.json`，死代码扫描跑不了 | 🟢 |
| ✅ 70% 覆盖门槛 | jest.config | — |
| ✅ a11y 基本良好 | `<img>` 全有 alt；onClick 无裸 div | — |

### 3.3 inference-service

| 项 | 证据 |
|---|---|
| ✅ venv 健康，core deps OK | torch/statsmodels/sktime/chronos 全部 import 成功 |
| ✅ /models 返回 5 统计模型 | arima/holtwinters/exponential_smoothing/naive/stl |
| ✅ /predict schema 正确 | 需 `values`+`timestamps`（不是 commodity_id） |
| ⚠️ venv 2.2G 占盘 | torch CPU-only 已优化，但仍是大头 |
| ⚠️ 28min 内 3 次重启 | `inference-error.log` 126KB **全是正常 INFO 预测日志**（无 traceback/OOM），3 次重启原因待查（可能 PM2 kill_timeout/内存阈值，当前 537MB） |
| ✅ ARIMA 500 bug 已修 | `statistical_models.py:34-38` <4 点优雅降级 naive；最近 191 条 /predict 全 200，500 仅历史（07-05 23:11） |

---

## 4. 安全与供应链

| 项 | 证据 | 严重度 |
|---|---|---|
| 后端依赖漏洞 | **3 high**（multer DoS / nodemailer / ws）+ 6 moderate | 🟠 |
| 前端依赖漏洞 | **6 high**（js-cookie / form-data / ws / fast-uri×2 / hono）+ 10 moderate | 🟠 |
| ✅ 无泄露 secret | backend/frontend src 全扫，仅 test fixture 命中 | — |
| ✅ .env 已 gitignore | 覆盖 .env/.local/.production | — |
| ✅ lucide-react@1.8.0 非 supply-chain 风险 | 实测 npm registry 1.x 系真实存在（最新 1.23.0）；3886 个真实图标，arrow-right.js 存在 | — |

> 注：初轮 Explore agent 误报 lucide-react 1.x 为供应链风险，已 web 核实纠正。

---

## 5. 运维 / 日志

| 项 | 证据 | 建议 |
|---|---|---|
| 日志噪声 | `.logs/` 19M；`backend-out.log-20260706` 16M 含 **34,246 条 `refresh` 日志**；`backend-error.log` 全是 Redis 版本警告 | 降 `predictionCache` 日志到 debug；抑制重复 Redis 警告 |
| logrotate 已配 | `/etc/logrotate.d/trademind` daily rotate 14 | 频次够，但噪声本身要降 |
| 磁盘损坏 | Round 11 已根治（移除 pnpm prune + integrity guard） | 本轮无复发 |

---

## 5.5 review skill 二次验证（对初版结论的纠正与精化）

> 初版报告出后，用 review skill 的 CRITICAL 框架（SQL/数据安全、并发、LLM 信任边界、枚举完备）对每条 P0/P1 结论逐条回查源码，纠正了 3 处不精确：

| 初版结论 | review 后修正 | 证据 |
|---|---|---|
| MAPE 断裂根因="数据稀疏凑不齐 actuals" | ❌ 不精确。真根因=**预测时刻之后根本没有新价格流入**（691/747 条 actuals_after=0）；价格采集基本停摆 | DB 实测：5/19 的预测至今无后续 daily 价 |
| 前端 TS 错误="可能静默通过 build" | ⚠️ 低估。实跑 `next build`：`✓ Compiled` 后 `Failed to compile`，**生产 build 当前是断的** | `next build` exit 1 |
| ARIMA 500 维度 bug="仍可能在批量路径触发" | ✅ 已修复。`statistical_models.py:34-38` <4 点优雅降级 naive；最近 191 条 /predict 全 200 | 日志 |
| `logPrediction` 吞错在 "predictionCache.ts:146" | 行号应为 **137/141** 两处 `.catch(()=>{})`（146 是外层 runAndCache 的 catch，已记 error） | 读源码确认 |
| inference 3 次重启="需查 OOM" | error.log 无 traceback/OOM，全正常 INFO；重启非崩溃，疑 PM2 配置（kill_timeout/内存阈值），优先级降为 P2 | 日志取证 |

**最深的纠偏**：初版把 MAPE 断裂归到"验证函数阈值太严"，但 review 发现**即使把阈值放宽到 0，691 条预测也永远拿不到 actuals**——因为价格数据在预测时刻后就不再增长。所以真正的 P0 是"激活数据采集"（让价格持续流入），而不是"调验证参数"。这把 §6 优先级表里 P0-2 和 P0-3 的主次关系颠倒了。

---

### 🔴 P0 — 核心价值与正确性

1. **修 `predictionCache.ts:137-143` 静默吞错** → 让 `.catch` 记 `logger.error` + 重试；验证 prediction_logs 每 30min 增长（**注意行号修正：是 137/141 两处 `.catch(()=>{})`，非初版的 146**）
2. **激活数据采集让价格持续增长**（MAPE 验证的真根因）→ §2.4 实测 747 合格预测里 691 条 actuals_after=0；18 源里 16 个 inserted=0。**没有新价格流入，验证环永远断**。**Round 18 已精确定位**：① FRED 系列滞后（DCOILWTICO/DHHNGSP 停在 6/29，上游未发新数据）；② Stooq 被 Cloudflare 拦（Gold/Wheat/Coffee 等 CME 期货无新数据）；③ 16 源空产出（解析失效，ROADMAP 第 13 轮已计划）；④ `upsertPrice` 计数虚胖（值未变也记 updated:1，次要）。**这不是单点代码修复，属 ROADMAP 主线 A，需数据源排期**
3. **修 MAPE 验证环**（`mapeTracking.ts:117`）→ 数据流入后，复核 7 天冷却期是否合理；放宽"需 horizon 个 actuals"为"≥3 即可验证"
4. **预测质量度量**（全局）→ 加 MAPE 看板，对 MAPE > 50% 模型降权/停用；当前 149% 均值不可接受
5. **修前端 build 失败**（`forecasts/create/page.tsx:303,362`）→ **实测 `next build` 已断**（非仅 TS 警告）；`requiresWeights` 联合类型 + `unknown` 赋值，修复前无法出生产包
6. **修正 ROADMAP 成功指标** → "forecasts 表增长"改为"prediction_logs 增长"

### 🟠 P1 — 架构债

7. 删 72 个死导出（先 `cache.ts`/`inference/index.ts`/`alerts.ts`；核查 `validateApiKey`）
8. 加 5 个外键索引（`@@index`）
9. cron 路径接入 BullMQ（漂移补偿/重试/优雅关闭）
10. 统一前端数据层（单 `API_BASE`+`authHeaders()`，删 6 重复 fetcher）
11. 列表/详情页 RSC 化（最大性能收益）
12. 升级 multer→2.x / ws / js-cookie / form-data

### 🟡 P2 — 可维护性

13. 降日志噪声 + 抑制 Redis 警告
14. 测试门槛 50%→70%（先给 P0 项加回归测试）
15. 删 next.config 死配置（antd/refine/lodash）
16. Tailwind v4 `@theme` 统一或退回 v3
17. 拆 god-component（`beefCutNormalizer` / `dashboard/performance` / `alerts/rules`）
18. 查 mt-inference 3 次重启根因（PM2 配置，非崩溃）

### 🟢 P3

19. 161 处硬编码颜色 token 化
20. 前端加 `knip.json`
21. 删空目录 `src/components/data/`、单图标库（lucide 与 phosphor 二选一）

---

## 7. 值得肯定

- 后端零 TODO/`console.log`/硬编码 secret；17/17 路由有 authenticate；tsc 通过
- Prisma 80 个 @@index / 14 @@unique（索引覆盖整体健康）
- next.config 代码分割策略有意识（recharts/d3 独立 chunk）
- 安全 overrides 已 pin 修补版本（handlebars/ws/path-to-regexp）
- a11y 基本良好（`<img>` 全 alt、onClick 无裸 div）
- Round 11 磁盘损坏已根治，本轮无复发

---

## 8. 推荐下一轮

> 遵循 ROADMAP"先通水管"原则，但 review 后**重排**——真正的水管是"价格数据流入"，不是"验证参数"：

1. **P0-5** 前端 build 失败（`forecasts/create/page.tsx`）→ **最先修，否则无法出生产包**
2. **P0-1** predictionCache 静默吞错（137/141 两处 `.catch`）→ 让 prediction_logs 增长可观测
3. **P0-2** 激活数据采集（让价格持续流入）→ **MAPE 验证环的真上游根因**；这是 ROADMAP 主线 A 本来就在做的事，但需确认 ingestion 真的在写新价
4. **P0-3/4** MAPE 验证环 + 质量度量 → 数据流入后才有效
5. **P1-7/8** 删死导出 + 加 FK 索引（低风险地基）
6. 再回 C3 依赖升级

---

## 附：取证命令清单（可复现）

```bash
# 值链状态
psql "$DATABASE_URL" -c "SELECT status, count(*) FROM prediction_logs GROUP BY status;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM forecasts; SELECT count(*) FROM anomalies;"
redis-cli --scan --pattern 'prediction:*' | wc -l

# MAPE 断裂根因取证（review skill 新增）
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE predicted_at <= now() - interval '7 days') AS eligible, count(*) FILTER (WHERE predicted_at > now() - interval '7 days') AS too_recent FROM prediction_logs WHERE status='completed';"
# actuals_after 分布（预测时刻之后有无新价格）
psql "$DATABASE_URL" -c "SELECT count(*) FILTER (WHERE cnt=0), count(*) FILTER (WHERE cnt>=3) FROM (SELECT pl.id, count(cp.*) cnt FROM prediction_logs pl LEFT JOIN commodity_prices cp ON cp.commodity_id=pl.commodity_id AND cp.interval='daily' AND cp.date > pl.predicted_at::date WHERE pl.status='completed' AND pl.predicted_at <= now()-interval '7 days' GROUP BY pl.id) t;"

# 静默吞错定位（行号 137/141）
grep -n "catch(() => {})" backend/src/services/predictionCache.ts

# 数据采集是否真在写新价（inserted 应 > 0）
psql "$DATABASE_URL" -c "SELECT source, sum(inserted) FROM ingestion_logs WHERE created_at > now() - interval '7 days' GROUP BY source ORDER BY 2 DESC NULLS LAST;"

# 前端 build 是否真断（非仅 tsc 警告）
cd frontend && npx next build 2>&1 | tail -15

# ARIMA 500 bug 是否已修（最近 /predict 全 200 即已修）
tail -200 /root/.logs/inference-out.log | grep -oE '"POST /predict HTTP/1.1" [0-9]+' | sort | uniq -c

# 安全/死代码
cd backend && npx ts-prune | grep -v "used in module" | grep -v __tests__
cd backend && pnpm audit --prod
```
