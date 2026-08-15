# Known Issues — 阻塞与待决策事项

> 本文件从历史 round/review 报告中**提取的、仍可能有效**的工程信息。
> 每条标注**来源**与**验证日期**。代码此后可能已变更——动手前请重新核实。
> 已关闭（CLOSED/RESCINDED/FIXED）的事项不收录，只保留**开放**或**信息性**条目。

---

## 一、数据层阻塞（最关键，影响整个牛肉核心价值链）

### D1 — 牛肉数据源大面积失效，核心价值依赖 seed 快照

**来源**：`reviews/2026-07-19-known-issues.md` DATA-1 + DATA-4，2026-07-19 实时 DB 审计
**现状（截至 2026-07-19）**：

| 来源 | 写入表 | 当时行数 | 当时最新 | 根因 |
|---|---|---|---|---|
| `fred` → `beef_carcass_us` | CommodityPrice | 4213 | 2026-07-18 ✅ | 正常（公开 CSV，无需 key） |
| `cme_futures` → 牛肉期货 | CommodityPrice | — | — | 正常 |
| `mla_nlrs`（澳，冻结于 2026-04-30） | BeefCutPrice | 1440 | 2026-04-30 | `MLA_API_KEY=""` |
| `usda_ams` LM_XB405（美部位级） | BeefCutPrice | 0 | — | `USDA_MARS_API_KEY=""` |
| `cepea`（巴西） | CommodityPrice | 0 | — | Cloudflare bot challenge（`cf-mitigated: challenge`，HTTP 403），`fetch()` 无法通过 |
| `inac`（乌拉圭） | BeefCutPrice | 0 | — | 连接超时——host 不可达（IP/地域封锁或 URL 失效） |

**DATA-4 补充审计结论**：当时平台"2 个 healthy 源"（commodity_prices、world_bank）**都不产牛肉**——前者只写 3 个外汇对，后者只写 12 个非牛肉序列。即 19 源中 4 个直供牛肉源**全部不产数据**，平台牛肉价 + AI 预测实际跑在 seed 快照上。

**解决路径（需用户输入，非代码）**：
- **MLA + USDA-AMS**：用户提供 API key → 写入 `.env` → 两个 scraper 已端到端可用（仅 key 门控）。最高收益。
- **CEPEA**：需 headless 浏览器（Playwright）过 Cloudflare。脆弱、有 ToS 风险——除非优先级提升否则搁置。
- **INAC**：确认 URL 是否仍有效；若地域封锁，考虑代理或下线该源。

**桥接兜底（已上线）**：`beefPriceBridge.ts` 把 5 个 STRONG 映射的 CommodityPrice slug 复制到 BeefCutPrice，但只有 `aus_cube_roll_m9` 有上游行（180 行，最新 2026-04-29）。

**round-63 全量 scraper 审计（2026-08-02 live 实测，19 源逐项核实）**：每个 scraper 都"成功"返回 0 行（scraperManager 计 succeeded），但实际状态分 5 类：

| scraper | 分类 | 状态/动作 |
|---|---|---|
| `fred` | ✅ 正常 | 62004 行，最新 2026-08-01 |
| `exchange_rate_api` | ✅ 正常 | 120 行，最新 2026-08-01 |
| `worldBankPrices` | ✅ 正常（月度节奏） | 48 行，最新 2026-06-01（FRED 月度序列，7 月点 mid-Aug 发布，30d 窗口内 0 行是预期）|
| `fao_prices` | 🔧 **round-63 已修** | fetchWithRetry 重试所有失败（含 5xx/超时）致 272s stall。已改为：8s 超时、仅 transient(429/5xx≠521) 重试、网络错误不重试。**272s → 40s**（6.8×）。FAO origin 当前 down，恢复后自动产数 |
| `balticDry` | 🔧 **round-63 已修** | primary `api.balticexchange.com` 恒 404（付费 API）。删 dead path，改单源 FRED（需 `FRED_API_KEY`）|
| `shippingIndex` | 🚧 策略错误（需 headless） | SSE 改 SPA，所有路径 302→/home，HTML regex 无效。需 Playwright 或找 JSON API |
| `dceFutures` | 🚧 端点失效 + 反爬 | DCE/CZCE 静态 JSON 路径 404，DCE root 412 anti-bot。需真实端点 + 反爬处理 |
| `chinaWholesale` | 🌐 地域封锁（.gov.cn） | 需中国出口 |
| `chinaCustomsStats` | 🌐 地域封锁（.gov.cn） | 需中国出口/交互式 session |
| `secexData` | 🌐 403 封锁 | ComexStat API 拒绝当前 caller（巴西地域）|
| `abaresData` | 📄 策略错误 | ABARES 发 PDF/Excel 报告非 HTML，regex 无效。需报告文件解析器 |
| `cepeaData` | 🛡️ Cloudflare 挑战 | 需 headless 浏览器 |
| `inacData` | 🌐 host 不可达 | 连接超时（地域封锁或 URL 失效）|
| `cmeFutures` | 🛡️ Stooq 被墙 | Stooq 返 HTML 非 CSV（同 CEPEA/INAC 网络阻塞模式）|
| `usdaAms` | 🔑 缺 key | `USDA_MARS_API_KEY=""`（端到端可用，仅 key 门控）|
| `mlaNlrs` | 🔑 缺 key | `MLA_API_KEY=""`（端到端可用，仅 key 门控）|
| `usdaPsd` | 🔑/🌐 待核 | 需复核（USDA PSD，可能是 key 或网络）|
| `weatherData` | 🔑 缺 key | weather API key 门控 |
| `commodityPrices`/`manualImport` | (工具型) | 非 scraper，人工导入/聚合 |

**结论**：19 源中 2 个产数（fred/exchange_rate_api），1 个预期月度（world_bank），2 个 round-63 已修代码缺陷（fao stall + baltic dead URL），2 个仅 key 门控（MLA/USDA-AMS，最高 ROI），其余 11 个需网络/反爬/headless（非代码可修）。**fao/baltic 修复不直接产新数据**（FAO origin down + baltic 需 FRED key），但消除了 scraper batch 的 4.5min stall + 死代码路径。

**round-80 复核（2026-08-08，状态变化）**：3 个 key 现已设置（`MLA_API_KEY`/`USDA_MARS_API_KEY`/`OPENWEATHER_API_KEY`），FRED 仍缺。但 live 测试源站可达性发现 **key 不是瓶颈——源站本身被网络封锁**：
- MLA API (`services.mla.com.au/api/oth/grid`)：**000 超时**（带 x-api-key）
- USDA (`marsapi.usda.gov`)：**000 超时**
- OpenWeather (`api.openweathermap.org`)：**000/301**
- 结论：D1 根因从"缺 key"升级为"**网络出口限制**"（与 registry.npmjs.org 同模式）。需代理/VPN/镜像才能连通，超出代码范围。beef_cut_prices 仍冻结 2026-04-30，87k 预测 unverifiable 均因此。用户 round-80 决策："暂不动数据，做工程债"。

**round-81（2026-08-09，CSV 手动导入路径已 live 验证）**：用户选"CSV 手动导入路径"。**整条流水线已端到端建好**（前端 `/beef/import` 页 + `POST /api/beef/import` ADMIN 端点 + `beefImport.ts` 服务 + 模板端点），补了 7 集成测试（commit ccf31be，backend 658|1→**665|1**）。live 验证端到端通：
- 导入 3 行（AU-847/BRISKET_NAVEL + BR-SIF2057/STRIPLOIN + AR-1920/KNUCKLE，今日日期）→ `imported: 3, errors: []` ✓
- `GET /api/beef/prices` → 3 行 freshness=**"live"**（0 天，非 bridge/seed）✓
- `GET /api/beef/forecasts/BRISKET_NAVEL` → `forecastable: true` + direction/confidence 返回 ✓（预测门通过，fresh 数据解锁 per-cut AI 预测）
- 验证后清理 demo 行（`DELETE WHERE source LIKE 'manual:%'`），DB 无污染。
- **结论**：CSV 导入是 D1 网络封锁下的可用数据注入路径。操作员可通过 `/beef/import` 页定期上传牛肉价格 CSV（模板：`GET /api/beef/import/template`），数据流→新鲜度→预测→MAPE 环全通。+7 测试守护此路径。

**2026-08-14 复核（深度探查 + live 修复）**：产数源 2→**3**：
| 源 | 行数 | 最新 | 说明 |
|---|---|---|---|
| fred | 62,078 | 2026-08-13 | ✅ 活——来自 cmeFutures 内**免 key** 的 FRED CSV 路径 |
| exchange_rate_api | 156 | 2026-08-13 | ✅ 活 |
| cme (Yahoo) | 12 合约 | **2026-08-12/13** | ✅ **本轮复活**（见 R2 round-100） |
- `fredData.ts`（需 key 的独立源）今晨仍报 `Missing FRED_API_KEY`（ingestion_logs 01:34 实证）——fred 的"活"与它无关。
- **stooq 根因澄清**：从未被墙——2026-05 删除 `/q/l/` 端点（404）并在 `/q/d/l/` 挂 JS PoW 挑战。round-63/80 对**此源**的"网络出口封锁"结论不成立（对 MLA/USDA 源站的封锁结论仍有效）。
- `beef_cut_prices` 仍冻结 2026-04-30（2,401 行）；MLA/USDA/weather key 仍未提供。

**2026-08-14 第二轮源探测（复用 mihomo 出口，全部 live 实测）**：
| 源/主机 | 直连 | 代理 | 结论 |
|---|---|---|---|
| `faostatservices.fao.org`（FAOSTAT 新主机） | 401 | 401 | **迁移实锤**：旧 `fenixservices` 主机死，新主机活、端点结构相同但强制 `Authorization: Bearer`（假 token 403）。`faoPrices.ts` 已切新 URL + key 门控（缺 `FAO_API_KEY` 早退）。**FAO 加入 A2 key 清单（第 5 把）** |
| `comexstat.mdic.gov.br`（SECEX） | 403 | 403（**经巴西专线节点**） | **Cloudflare 应用层 WAF**（bot 挑战页），非地域封锁——巴西 IP 一样拦。与 CEPEA 同类，plain fetch 无解；分类从"403 地域"改为"需 headless" |
| `apps.fas.usda.gov`（USDA-PSD） | 000 | 404 | 主机代理可达但 `psdonline/api` 路径不对；FAS 官方开放 API 在 `api.fas.usda.gov`（data.gov 免费 key）。**PSD 加入 A2 key 清单（第 6 把，可选）** |
| `www.inac.gub.uy` / `www.gub.uy/instituto-nacional-carnes` | 000 / 404 | 000 / 404 | INAC 站点下线/重构，全球性。维持"不可解"登记 |
| `www.mla.com.au` | **200** | 200 | **Cloudflare 403 已消失**（直连即可达，无需代理）；但 `statistics/api/` 是 SPA 壳，真实 grid 端点契约仍需 key 才能核实。A1 维持"调研完成、卡 key" |
| 订阅 51 节点地区分布 | — | — | 21 日本 / 10 美国 / 5 新加坡 / 2 香港 / 2 英国 / 荷兰法国巴西各 1-3 / **无中国大陆节点** → `.gov.cn` 族（chinaWholesale/chinaCustoms/dce/sse）维持"需中国出口"结论，除非订阅加大陆节点 |

---

### D2 — MAPE 验证环断裂（数据层后果）

**来源**：`archive/2026-07-06-round-17-19.md` P0-2，2026-07-06 取证
**现状**：747 条合格（≥7 天）completed 预测里，**691 条 `actuals_after=0`**（预测时刻之后无新 daily 价格）。根因同 D1——FRED 系列自身滞后/停发（`DCOILWTICO`/`DHHNGSP` 上游未发新数据），Stooq 备用路径被 Cloudflare 拦（`cmeFutures.ts:270` 代码注释自述）。
**性质**：非代码 bug，属数据覆盖主线。待 D1 数据流打通后自然缓解。
**已做决策（避免 quality theater）**：当时不建议放宽 `mapeTracking.ts` 的 7 天冷却 / `min(horizon,3)` 阈值——调参只能把可验证数从 42 提到 63（+21），691 条（92.5%）无论怎么调都不可验证。等数据流入后再复核阈值。

**round-62 部分根治（2026-08-02 live 实测）**：本条原指"数据层后果"，round-62 修了**两个放大该后果的代码缺陷**（非数据源本身）：
1. **止血（P1，commit c0c4944）**：`schedulePredictionsFromPostgreSQL`（`predictionCache.ts`）无 recency gate，15 个 frozen 商品（最新价 2026-04-29 / 2026-06-01，2-3 个月无新数据）每 30 分钟仍生成新 chronos 预测——这些预测永不可验证，是"持续出血"。加 `STALE_WINDOW_DAYS=7` recency gate（对齐 `scheduleBeefCutPredictions`），frozen 商品不再被订阅。live 实测：订阅数从 15+ 降至 4（aud_usd/brl_usd/usd_cny/beef_carcass_us）。
2. **排空（P2，commit 013fa1b）**：新增 `markUnverifiablePredictions()`（`mapeTracking.ts`）—— 检测"due completed 预测 + commodity 无 post-prediction 价格"= 永不可验证，标 `unverifiable` 状态（第 4 个状态值，free TEXT 无需 migration；区别于 `stale`=污染源）。`verifyDuePredictions` 只读 `completed` → 标过的行自动退出循环。server.ts 启动一次性钩子（25s）。live 实测：backlog 107,393 → 14,888；unverifiable 0 → 76,954；`verificationRatio` **0.006 → 0.522**（87×，分母排除 unverifiable）；`hasVerificationDebt` **true → false**。verify loop 日志从 `Verified 0 of 5000 (5000 no actuals)` 变 `Verified 5000 of 5000 (0 no actuals)`。
- **D1 数据源失效本身未修**（仍需 MLA/USDA key 等）——本轮只让 frozen 数据的后果不再放大/掩盖真实验证进度。frozen 商品数据流入后，新预测按正常路径验证（旧 unverifiable 行保持 unverifiable，是诚实历史记录）。

**round-66 补充（2026-08-03 live 实测）**：round-62 P2 的 `markUnverifiablePredictions` 残留盲区——只扫 `predictedAt <= now-10d`（due 截断），P1 gate 上线后仍在生成的"近期（10 天内）但源已死"预测全部漏网（~12k 条 pre-gate straggler 永久占用 completed 队列，每 6h 被 verifyDuePredictons 空转扫描）。commit 8f9153b 加 Pass B（`markLaggingFrozenPredictions`）：扫 `predictedAt > cutoff`，`latest price <= predictedAt` 且 `< now-7d`（recency 守卫防误伤活源 lag）→ 标 unverifiable。live：backlog 14,888 → 3,162（-79%），unverifiable 76,954 → 89,173，ratio 0.522 → 0.837（分母排除 unverifiable）。verify loop 日志从扫 ~15k 行变 `Verified 0 of 40 due`。

**round-71 补充（2026-08-03 live 实测）**：round-66 的 `markUnverifiablePredictions` 是**点时检查 + 不可逆**——标记时若源已死则永久 unverifiable，verifyDuePredictions 只读 `completed` 不回收。但当源**后来复活**（如 beef_carcass_us 经历 FRED 数据滞后，标记时 latest price >7d 旧，FRED 随后补发 08-01/08-02 daily 行），那些预测**现在窗口内有 actuals** 却仍困在 unverifiable。live 实测：beef_carcass_us（唯一有 fresh actuals 的商品）07-27→08-02 的 738 条 chronos 预测全被误标 unverifiable，accuracy 页 chronos 永远 0 verified。commit ad2cd4b 加 `restoreVerifiablePredictions()`（markLaggingFrozen 的对称逆操作）：扫 unverifiable 行，若商品 latest price 现已 > 最早被困预测的 predictedAt（源复活、有 post-prediction actuals）→ 标回 `completed`。幂等。接 server.ts 启动钩子（markUnverifiable 之后跑）。+3 测试（mutation-verified）。live：beef_carcass_us unverifiable 738→0，completed 48→262/variant（786 条恢复，跨 3 chronos）。这些行重入 verify 队列，下个 verify 周期产首批 beef chronos verified MAPE。

---

### D3 — 数据层静默失效已被暴露（2026-07-31 live 实测，round-48~50）

**来源**：2026-07-31 live DB 审计（round-48 dataHealth service 引入后首次量化）
**现状（截至 2026-07-31 实测）**：
- 18 注册 scraper 中**仅 2 个**近 3 天写了真实价格行（`exchange_rate_api` 18 行、`fred` 8 行）。其余 16 个 dormant（缺 key / Cloudflare block / 网络不可达 / empty）。
- `beef_cut_prices` **近 14 天 0 行**（MLA/USDA-AMS 缺 key，bridge 仅补 1 个 cut）。
- 预测生成 ~2300/天 vs 验证 ~636/天峰值 → backlog 持续增长：**102k completed vs 1036 verified（verificationRatio 0.01）**。大部分 completed 因 commodity 无新 actuals 永不可验证。
- `/health/ready` 之前对此**完全不可见**（只报 infra green）。
**性质**：与 D1 同源（数据源失效），但本条聚焦**可观测性缺口**——数据停滞之前被 infra-green 掩盖。
**已解决（round-48~50，可观测性层）**：dataHealth service → `/health/ready.checks.dataLayer` + `/sources/freshness.summary.dataHealth` + cron-healthcheck 数据探针，三层暴露。**数据层本身未修**（仍需用户提供 MLA/USDA key 等，见 D1）——本条只让停滞可见、可追踪。
**后续（数据层修复，需用户输入）**：见 D1 解决路径。数据流入后 verificationRatio 自然回升，`hasVerificationDebt` 会自动转 false。

**round-62 补充（2026-08-02 live 实测）**：`dataHealth` 新增第 4 桶 `predictionUnverifiable`（frozen-source 预测，区别于 `predictionStale`=污染源）。`verificationRatio` 分母**排除 unverifiable**（它们永不可验证，不算"债"）。live 实测：`predictionBacklog` 107,393 → 14,888；`predictionUnverifiable` 0 → 76,954；`verificationRatio` 0.006 → 0.522；`hasVerificationDebt` true → false。operator 现可在 `/health/ready.checks.dataLayer.predictionUnverifiable` + DataHealthCard 看到 frozen-source 死积压规模。

---

## 二、推理服务

### R1 — Chronos 接入后端共识 + 网络可用性

**来源**：`reviews/2026-07-19-known-issues.md` DATA-4 末段，2026-07-20 live 测试
**现状（截至 2026-07-20）**：
- inference-service `/models` 当时返回 6（5 统计 + chronos），但后端 `tradingSignals.ts:25` `ALL_MODELS` 只列 5（无 chronos）→ `signals/batch` 共识只跑 5 模型。
- 直连 `/predict` model_id=chronos 当时返回 HTTP 500：`Can't load the configuration of 'amazon/chronos-t5-tiny'`，根因 huggingface.co 不可达（`[Errno 101] Network is unreachable`）。

**已解决（2026-07-27 live 验证）**：`HF_ENDPOINT=https://hf-mirror.com` 镜像方案生效，权重预下载到 `/root/.cache/huggingface`。`curl localhost:10810/ready` 返回：
```json
{"ready":true,"chronos_usable_variants":{"chronos_tiny":true,"chronos_mini":true,"chronos_base":true},"chronos_pipelines_loaded":["amazon/chronos-t5-base","amazon/chronos-t5-mini","amazon/chronos-t5-tiny"],"ready_variants":["chronos_tiny","chronos_mini","chronos_base"]}
```
即 3/3 Chronos 变体全可用、pipeline 已加载。`/health/ready` 的 `inferenceDetail.ready=true`。**不再适用"chronos 可能不可用"结论。**
> 注：chronos 是否已加入后端 `ALL_MODELS` 共识（`tradingSignals.ts`）是另一个问题——若共识仍只跑统计模型，那是产品决策（chronos 调用慢/成本），非"不可用"。改动前重新核实 `ALL_MODELS` 当前内容。

**共识决策已落地（2026-07-27 commit 8992154，2026-08-01 live 复核）**：主共识已**切到 chronos-only**——`tradingSignals.ts:29` `ALL_MODELS = ["chronos_tiny","chronos_mini","chronos_base"]`（不再是 line 65 描述的"只跑 5 统计模型"）。6 个统计模型保留为 `BASELINE_MODELS`（`tradingSignals.ts:34`），仅供 `/ai predict` 按需调用 + `/ai/accuracy` 对比页展示。
- **对预测产出的影响（by design，非 bug）**：`schedulePredictionsFromPostgreSQL`（后台调度）经 `getAllModels()` 只订阅 chronos → `prediction_logs` 里 stat 模型最后记录 `2026-07-26`（commit 切换前夜），之后再不生成新记录；chronos 持续生成（最新 `2026-08-01`）。MAPE 验证环只为 chronos 产新 verified 记录（chronos horizon 10d 到期后）。
- **过渡期准确率展示（2026-08-01 round-58 已诚实化）**：`/ai/accuracy` 对比页之前会把 chronos 的 1-sample MAPE 与 stat 的冻结历史 MAPE 并列，误导"chronos 更差"。现加 sample-size gate（`MIN_VERIFIED_SAMPLE=5`，under-sampled 显示 "Insufficient data"）+ Last Verified 新鲜度列 + Primary/Baseline 角色徽章 + AccuracyTransitionBanner。后端 `getAllModelAccuracy` 暴露 `verifiedCount`/`lastVerifiedAt`/`isPrimary` 元数据供前端 gating。
- **stl_forecaster MAPE 异常仍开**：`/ai/accuracy` 显示 stl 20.56%（live 2026-08-01 实测，133 verified），仍远高于 naive 2.22%。但这是 **pre-fix 冻结数据**——`statistical_models.py:192-213` 的 damped-trend 修复（commit 1532b04，合成数据 8.5%）已在代码里，因 stat 不再进后台调度，该修复**无新生产记录可证**。是否从 baseline 移除 stl 是独立产品决策（单列轮次）。

---

### R2 — brl_usd / corn_cme / natural_gas_cme 单位冲突（核心价值链潜伏 bug）

**来源**：`docs/reviews/2026-07-12-round-28.md` R28-3（commit 447b655 删除了该 round 文件，bug 未重新登记；本条 2026-07-27 重新核实并登记）
**现状（截至 2026-07-27 live 核实）**：同一 commodity 由两个源写入、单位/量纲/方向冲突，混在同一张表：

| Commodity | 源 A（行数） | 源 B | 冲突 | 偏差 |
|---|---|---|---|---|
| `brl_usd`（汇率） | `exchange_rate_api`（`commodityPrices.ts:40-44`，写 `1/data.rates.BRL` ≈0.19，**方向反了**：1 BRL = 0.19 USD） | `fred` `DEXBZUS`（`cmeFutures.ts:156-161`，≈5.0，方向正确：1 USD = 5 BRL） | 方向相反 | **~32×** |
| `corn_cme`（USD/bu） | `cme`（473 行） | `usda_ams`（cents vs dollars） | 单位混用 | **~115×** |
| `natural_gas_cme`（USD/MMBtu） | `fred` | `cme`（含历史 spike） | 量纲混 | **~29×** |

**对核心价值链的影响**：训练/预测跑在混合脏数据上；`mapeTracking.ts:143` 的 `verifyDuePredictions` 取 actuals **无 source 过滤** → 抓到另一源的值 → brl_usd 预测 MAPE ~96%（虚高，非真实误差）。
**根因性质**：per-commodity 的数据治理问题，非单点代码 bug。需"规范单一权威源" + 验证层按 source 过滤。

**已解决（2026-07-27，round-41 + round-46，live 验证）**：
- round-41 引入 `authoritativeSources.ts`（brl_usd→fred / corn_cme→cme / natural_gas_cme→fred）+ `authoritativeSourceWhere()` Prisma where 片段。`data-fetcher.ts`（训练）、`mapeTracking.ts`（actuals）、`inference.ts` 3 处直读、`marketService`、`correlationAnalysis` 全部按权威源过滤。
- round-46 作废 pre-fix 污染预测（`invalidatePollutedPredictions`，标 `status='stale'`，覆盖 completed + verified 行），验证环提频 24h→6h、批次 2000→5000。
- live 实测：fresh brl_usd `chronos_tiny` 预测返回 **≈5.08–5.10**（fred 量级，修复前会训练在 0.2 上）。3 commodity 污染预测全部 stale（brl_usd 3944 / corn_cme 3855 / natural_gas_cme 3860），verified 清零——`/ai/accuracy` 不再有 ~96% 噪声。post-fix 预测需等 horizon(10d) 到期后才有新真实 MAPE。
- 数据层（两个源仍写同 slug）未动——靠读侧权威源过滤根治，避免 schema 迁移风险。

**round-56 补充（2026-07-31，cmeFutures 单位 bug 根治）**：发现 corn_cme 冲突的根因不只是"两个源"，而是 cme 爬虫**从未做 cents→USD 转换**——Stooq 返回 CME 谷物/牲畜/软商品期货的 cents 报价（corn 473 cents/bu），但声明的 unit 是 USD/bu，爬虫直接存了 473 → 与 USDA 的 4.5 差 100×。
- 修复：`cmeFutures.ts` FUTURES 表加 `priceFactor`（grains/livestock/softs/soybean-oil = 0.01，energy/metals/soybean-meal = 1），写入时 `close * priceFactor`。导出 FUTURES 表 + 15 测试守护契约。
- authoritative override 调整：corn_cme `cme → usda_ams`。因 Stooq 当前被墙（返回 HTML 非 CSV，cme 无新行），cme 只有 2 条 pre-fix 错误行（473），usda_ams 有 128 条正确 USD/bu 行。待 Stooq 恢复后 cme 会写转换后的 USD 值，届时可切回 cme。
- **遗留（数据源可达性，非代码）**：Stooq 被墙是 cme_futures 持续 empty 的根因（同 CEPEA/INAC 的网络阻塞模式）。需替代数据源或代理。

**round-58 补充（2026-08-01，post-fix 预测误标 stale 根治）**：调查发现 3 个 conflict commodity 的 **post-fix chronos 预测被错误标 `status='stale'`**（brl_usd 208 / corn_cme 144 / natural_gas_cme 179 = **531 条**），而所有非 conflict commodity 的 post-fix 预测正常为 `completed`。`verifyDuePredictions` 只读 `completed` → 这 531 条**永远不进验证环** → brl_usd/corn_cme/natural_gas_cme 的准确率永不为 chronos 产新 verified 记录。
- **根因**：`invalidatePollutedPredictions` 是代码里唯一写 `stale` 的地方，live 实测（直接调函数）返回 0——**它不是凶手**。这 531 条是历史某次运行（boundary 未钉死前 / 时间戳 mis-resolved）误标后遗留。一旦 stale，无代码路径回收。
- **修复**：新增 `restorePostFixConflictPredictions(fixedAt)`——`invalidatePollutedPredictions` 的对称逆操作，仅对 `predictedAt >= fixedAt` 的 conflict-commodity stale 行标回 `completed`（pre-fix 行保持 stale，因确为污染数据不可恢复）。幂等。接入 `server.ts` 启动一次性调用（在 pollution invalidation 之后）。
- **live 实测**：恢复后 531 条全部回 `completed`（brl_usd 624 / corn_cme 432 / natural_gas_cme 537 post-fix 全 completed，0 stale）。重启后再跑 restore 返回 0（幂等）。这些预测现 re-enter 验证队列，horizon(10d) 到期后会产出 brl_usd 等的真实 chronos MAPE。
- **顺带根治 flaky 测试**：`invalidatePollutedPredictions — returns 0` 之前用 far-FUTURE cutoff（2099），在 real DB 上 `lt:2099` 匹配全部行 → 期望 0 实得 1710 → flaky。改为 epoch(1970) cutoff（`lt:1970` 真正匹配 0 行），是真正的 no-op 路径。

**round-59 成熟度核查（2026-08-01 live 实测，非 bug 确认）**：用户要"验证 brl_usd chronos MAPE 成熟产出"。实查后**确认是时间阻塞，非代码 bug**——不要按 bug 处理：
- **chronos 预测健康生成**：3 conflict commodity × 3 chronos 变体自 2026-07-27 12:29 起持续产（brl_usd 239 / corn_cme 166 / natural_gas_cme 209 completed，最新 `predicted_at` 已到 `2026-08-01 13:35`）。
- **0 条 verified 是因为还没到期**：`verifyDuePredictions` 的成熟判定 = `predictedAt + horizon(10d) ≤ now`。最早 chronos 预测（07-27 12:29）+ 10d = **08-06 12:29** 才首次到期。今天 08-01 < 08-06 → **chronos 预测尚未进 due 批次**。
- **日志 "Verified 0 of 5000 (5000 no actuals)" 不是 verify 坏了**：那 5000 due 行是**旧 stat 模型 backlog**（5 个 frozen commodity 的 4 月数据：wheat_cn/crude_oil_wti/crude_oil_brent/copper_lme/gold_lbma，各自 ~4000 条，latest price 全停在 `2026-04-29`）。它们永不可验证（3 个月无 actuals），但它们是最旧的 due 行，ASC 排序 + take 5000 每 run 都先抓它们。verify loop 本身健康（6h cadence 正常 fire：13:35/19:35/21:41/21:42）。
- **DB 佐证 verify 历史正常**：6 stat 模型各 verified 203 条（07-07 ~ 07-27 11:54，round-41 切换前）；chronos_tiny 仅 1 verified（07-31，边缘到期）；chronos_mini/base 0。切换后 stat 停止后台生成（by design），chronos 待 08-06 后才开始批量到期。
- **预期**：08-06 后 chronos 首批到期预测进 due 批次，但 conflict commodity（brl_usd/corn_cme/natural_gas_cme）即便到期也需权威源（fred/usda_ams）有窗口内 actuals：fred 最新 07-24/07-27（5-8d lag，FRED 日汇率延迟），usda_ams 最新 04-29（月度数据，3mo lag）。**corn_cme 大概率仍 0 verified**（usda_ams 3 个月无新数据）；brl_usd/natural_gas_cme 视 fred 是否补数。
- **动作**：不代码改动。08-06 后复查 `[MAPE] Verified N` 日志 + `prediction_logs WHERE model_id LIKE 'chronos%' AND verified_at IS NOT NULL`。若届时仍 0，再查 actuals 源 lag（运营/数据源问题，非 verify 代码）。

**round-72 复核（2026-08-07 live 实测，round-59 预测兑现）**：round-59 预测"08-06 后 chronos 首批到期"已**兑现**——价值链 MAPE 验证环进入实测期，非代码改动，仅记录：
- chronos 三变体各 **267 条 verified**（`first_verified=2026-08-05`、`last_verified=2026-08-07`），`avg_mape` **chronos_base 0.735 / chronos_mini 0.789 / chronos_tiny 0.756**（%）—— 三个变体一致性高，均显著优于历史 stat 基线 naive(2.22%)/stl(20.56%) 量级。
- conflict commodity（brl_usd/corn_cme/natural_gas_cme）chronos 各 **50 条 verified**（round-58 `restorePostFixConflictPredictions` 回收的 post-fix 行已 re-enter 验证环并产出真实 MAPE）—— corn_cme 在 round-59 预期"大概率仍 0 verified（usda_ams 3mo lag）"实际已**有 verified**，说明权威源在窗口内有 actuals。
- `/ai/accuracy` 过渡期 banner（`AccuracyTransitionBanner`，`MIN_VERIFIED_SAMPLE=5`）已自动隐藏（3 变体 verifiedCount=267 ≫ 5，`needsBanner=false`）。
- **结论**：R1 chronos 接入 + MAPE 验证环**端到端通**。后续关注点转为数据源新鲜度（D1 阻塞）而非验证环代码。

**round-67 补充（2026-08-03，读侧权威源过滤补全）**：审计发现 round-41 只修了 4 个读侧（training/actuals/correlation/inference-history），**遗漏了 6 个用户可见的"latest price / 聚合"读取点**，对 3 个 conflict commodity 返回错误源的值。`GET /api/signals/brl_usd` live 实测 currentPrice 返回 exchange_rate_api 反向值 0.197（应是 fred 5.0）→ predictedChange 2460（无意义）。逐项根治：
- **commit c24dff2（B1）**：`signals.ts:345`（单预测 currentPrice）+ `signals.ts:279`（批量 currentPrice，新 `batchLatestPriceWhere`+`dedupeLatestByCommodity` 共享 helper）+ `alert-rules.ts:147`（告警价，预取 commodityId→slug）。+2 signals 测试（mutation-verified，cache-aware 清 Redis 避免假绿）。
- **commit b77d540（B2）**：`marketService.ts:listCommodities` 的 relation include 改批量查询（relation include 无法加 source 过滤）。+1 测试（mutation-verified）。
- **commit 9cf4e6c（B3）**：`watchlistService.ts` 两处 raw SQL（`batchLatestPrices`/`batchRecentPricePairs`）加 `partitionBySource` 拆 conflict vs 普通查询。+2 测试（mutation-verified）。
- **analytics.ts:39**（季节性聚合）：raw SQL 加 `AND source = ${authoritativeSource}`（`Prisma.sql`/`Prisma.empty` 条件片段）。
- **live 实测（2026-08-03）**：`/api/signals/brl_usd` currentPrice 0.197→**5.0592**、predictedChange 2460→0.24；`/api/market/commodities` brl_usd latestPrice 0.197→**5.0592**；`/api/analytics/seasonality/brl_usd` 12 月 avg 全在 **5.1–5.5**（fred 量级，不再混 ~0.2）。backend 634|1→**639|1**（+5 回归测试）。
- **结论**：R2 读侧**全补全**——signals/market/watchlist/alerts/analytics 现对所有 conflict commodity 读权威源。数据层（两源仍写同 slug）未动（靠读侧过滤根治，避免 schema 迁移）。

**round-100（2026-08-14，cme 源复活 + livestock 单位修正，live 验证）**：
- **stooq 根因反转**：`/q/l/` 端点已删（404）、`/q/d/l/` 挂 JS PoW 反爬（plain fetch 不可过，换代理出口 IP 同样被挑战）——**非网络封锁**。替换上游为 **Yahoo Finance v8 chart API**（keyless JSON，同原生报价单位）；Yahoo edge 对本机直连 IP-blocked（bare fetch ETIMEDOUT、curl 经 mihomo 200，2026-08-14 实测）→ Yahoo fetcher 加 `SCRAPER_PROXY_URL` 显式 undici ProxyAgent（`ecosystem.config.cjs` env_production 指向 mihomo `127.0.0.1:7890`；其余 fetch 保持直连、不受影响）。
- **livestock priceFactor 修正（潜伏 100× bug）**：LE/GF/HE 报价 cents/lb、声明单位 USD/cwt——数值恰好相等（226 cents/lb = $226/cwt），round-56 给的 0.01 是错的（会写 $2.2/cwt）；因 stooq 一直死着**从未暴露**。现移除（默认 1）。grains/softs 的 0.01 不变。
- **live 验证**：重启后单轮 12 合约全写入：live_cattle **226.2** / feeder **342.8** / hogs **95.5** USD/cwt；corn **4.755** / soybeans **11.89** / wheat **6.77** USD/bu；meal **316.2** USD/ton；oil **0.685** / coffee **3.33** / sugar **0.168** / cotton **0.824** USD/lb；gold **4376** USD/oz——全部与 2026-08 行情量纲吻合。
- **corn_cme 权威源维持 usda_ams**：cme 新历史自 08-14 起每日 1 bar 尚短；`authoritativeSources.ts` 注释已同步，cme 积累足够 post-fix 行后回切。
- **测试**：round-56 与 round-100(D3) 两套重叠套件合并至 `sources/__tests__/cmeFutures.test.ts`（17 用例：cents/livestock/native-USD 三组 + corn 量纲 + Yahoo ticker 格式 + slug 唯一）。

---

### R3 — 历史幽灵模型 timer_xl / sundial 残留预测行（低优先级，数据完整性）

**来源**：2026-08-07 round-72 live 审计（`prediction_logs` 全 model_id 扫描）
**现状（截至 2026-08-07 live 核实）**：`prediction_logs` 里有 **2 个模型 id** 在**当前推理引擎完全不存在**：
- `timer_xl`：167 行（verified 10 / unverifiable 146 / stale 11），`predicted_at` 区间 2026-05-19 ~ 2026-07-05
- `sundial`：165 行（verified 10 / unverifiable 144 / stale 11），`predicted_at` 区间 2026-05-19 ~ 2026-07-05

**根因**：上一代 Timer-XL / Sundial 在线训练路径已作为 anti-pattern 移除（见 `inference_engine.py` docstring："the previous Timer-XL/Sundial online-training path was removed as an anti-pattern"）。当前引擎 `_all_models` 只含 6 stat + 3 chronos = 9 个 id（`MODEL_IDS`），live `/models` 实测确认无 timer_xl/sundial。这两模型的 332 条行是移除前生成的**孤儿数据**，引擎永不再产生。
**配置残留（同轮已清，commit d5e9ec4）**：`inference-service/config.py` 曾带 5 个 `lstm_*`/`transformer_*` 参数（label "Timer-XL / Sundial model params"），grep 证实 0 reader（只 `host/port/log_level` 被读），已删。
**对核心价值链的影响**：**无实际污染**——
- 活跃模型清单由代码常量驱动（`getAllModels()`=3 chronos + `BASELINE_MODELS`=5 stat），不读 DB 的 `distinct model_id`，故 UI/共识/`/ai/accuracy` 对比页**不会**列或聚合 timer_xl/sundial。`tradingSignals.test.ts:68-69` 有守护测试断言两者被排除。
- `getAllModelAccuracy` 只遍历 `getAllModels()+BASELINE_MODELS`（live 9 个），ghost 模型不进对比。
- **唯一暴露面**：`GET /api/signals/models/:modelId/accuracy`（wildcard）+ `/predictions` + `/backtest`——直填 `timer_xl` 会返回该模型的真实 MAPE（timer_xl avg 0.728 / sundial avg 6.81）"像"活模型。但需鉴权 + 手填 URL，前端从不传 ghost id（模型列表来自 server），**实际不可达**。
**处置决策（round-72，遵循 §十.5 外科手术）**：不删 DB 行（非己所造的数据，先记录）；不加 wildcard guard（前端不可达，会"顺手改进相邻代码"违反 §十.5）。仅**文档记录**为本条。若日后 wildcard 可达性提升（如前端加自由文本 model 选择器）或需要干净的 MAPE 数据集，再评估：选项 A 路由层 404 unknown model id；选项 B `DELETE FROM prediction_logs WHERE model_id IN ('timer_xl','sundial')`（332 行，不可逆，需备份确认）。

---

### R4 — inference 每 30 分钟被 PM2 内存上限击杀（2026-08-14 发现并修复）

**来源**：2026-08-14 深度探查（PM2 守护日志四点证据链：backend-out "Refreshing predictions ×5" → inference-out 每逢 :03/:33 恰 15 个 POST /predict → pm2.log `[PM2][WORKER] exceeds --max-memory-restart (2.17~2.64G vs 2G)` → ecosystem `max_memory_restart: '2G'`）
**事实**：backend 每 30 分钟刷一轮预测（5 commodity × 3 chronos = 15 请求），burst 期 torch CPU 推理缓冲把 RSS 推到 2.2–2.6GB，超 2G 上限 → PM2 WORKER 每 30 分钟 SIGINT 击杀，重启计数 320、当周 218 次。**非泄漏**（空闲 RSS ~560MB，3 pipeline 常驻），是工作集天花板 + glibc arena 不归还。用户可见症状被 round-99 的 /ready 修复掩盖（重启 7s 完成、请求全 200），故长期未被发现。
**修复（2026-08-14）**：上限 2G→**`3584M`**。踩坑：PM2 尺寸正则**不认小数**，`'3.5G'` 被 WARN 拒绝且重启不生效——必须用整数 M。主机 14G 内存/11G available。
**二次事件（2026-08-15 05:25）**：cme 复活后预测订阅商品 5→17（burst 15→~51 请求），如 R4 预警——RSS 在 burst 峰值冲到 **3769MB**（超 3584M 上限 11MB），15 小时内首次也是唯一一次击杀。缓解三件套（同日上线）：①上限 **4096M**；②`MALLOC_ARENA_MAX=2`（ecosystem env，治 glibc 多线程 arena 碎片——torch 多线程下默认 8×cores 个 arena 各自滞留内存）；③`routers/predict.py` 每请求 `gc.collect()`（torch/statsmodels 包装器的引用环 refcount 不回收）。重启后 live 验证：/ready 200、chronos 真实预测通路 OK、RSS 基线 603MB。**观察项**：若 RSS 仍持续爬升，下一步限并发或深入 torch 内存剖析。

---

## 三、潜伏 bug（重构副产物，已修，留作记录）

### B1 — watchlist quotes 路由 text=uuid 类型转换 bug

**来源**：`reviews/2026-07-12-round-29.md`，2026-07-12
**事实**：原 `routes/watchlist.ts` 的 quotes 路由用 `::uuid[]` 类型转换，但 `commodity_prices.commodity_id` 是 **text 列**（`information_schema` 实查确认）。list 路由用 `::text[]`（正确），quotes 用 `::uuid[]`（错误）→ `/api/watchlists/:id/quotes` 报 500 `operator does not exist: text = uuid`。
**状态**：已修——`batchRecentPricePairs` 改 `::text[]`，并有回归测试（把 `::text[]` 改回 `::uuid[]` → 测试 FAIL）。**保留记录以防类似 raw-SQL 类型转换复发。**

### B2 — 前端 dev/prod supervisor 冲突致 crash loop（round-70，2026-08-03）

**来源**：2026-08-03 live 实测（mt-frontend PM2 crash-loop 527 次，`/` 返 000）
**事实**：`scripts/restart.sh` 启动 frontend 于 **dev** 模式（`pnpm dev` = `next dev --turbopack`），但 `ecosystem.config.cjs` 用 PM2 管理同名 `mt-frontend` 于 **prod** 模式（`pnpm start` = `next start`）。两者共用同一 `.next/` 目录。`next dev` 会**覆盖** `.next/routes-manifest.json`——dev 版仅 6 key（无 `dataRoutes`/`dynamicRoutes`/`staticRoutes`/`rsc`/`pages404`），prod `next build` 版 11 key。当 dev run 后 PM2 重启 prod `next start`，后者迭代 `routesManifest.dataRoutes` 得 `undefined` → 崩溃循环：
```
[TypeError: routesManifest.dataRoutes is not iterable]
```
- **`distDir` 不能修此问题**：实测 `distDir: '.next-dev'` 只隔离编译 chunk 输出，dev 仍会写 `.next/routes-manifest.json`（两文件 byte-identical，`diff` 确认）。误信 distDir 隔离会撞坏 prod（已实测）。
- **真修**：`scripts/restart.sh` 加 PM2 guard——`pm2_managed()` 检查目标进程名是否在 `pm2 jlist`，若 PM2 已管则拒绝启动 dev（exit 1 + 提示用 `pm2 restart` 或先 `pm2 delete`）。强制"二选一"管理模式，防 dev/prod 共用 `.next/`。
- **CLAUDE.md §Dev Server Management** 加 ⚠️ 段同步说明。
**状态**：已修（round-70）。frontend crash-loop 已停（527 restarts → 稳定），`.next/` 重 build（11-key manifest），PM2 guard 上线。**保留记录以防重蹈 distDir 误判。**

---

## 四、产品范围（PRODUCT-SPEC 约束，非 bug）

**来源**：`reviews/2026-07-19-known-issues.md` Out of scope，PRODUCT-SPEC §九
**明确不做**：交易撮合 / 订单执行 / 支付；主 IA 中的非牛肉商品（原油/黄金等留在数据层）；UGC/社区；原生 App（仅响应式 Web）；Paywall/计费（暂为静态展示）。

---

## 五、工具链一致性（pre-existing，待独立决策）

### T1 — 本地 pnpm 8 vs CI pnpm 9 版本不一致（非阻塞，待收敛决策）

**来源**：2026-08-07 round-73 Node 升级期间 Explore agent 发现（与 Node 版本无关的独立项）
**现状（截至 2026-08-07 live 核实）**：
- **本地/生产**：`pnpm 8.15.0`（global `npm i -g` 装在 `/usr/lib/node_modules/pnpm`），三个 `pnpm-lock.yaml`（root/backend/frontend）均为 **`lockfileVersion: '6.0'`**（pnpm 8 格式）。
- **CI**（`.github/workflows/ci.yml:41-43` 等 5 处）：`pnpm/action-setup@v4` with **`version: 9`**（pnpm 9 用 lockfile v9.0）。即 CI 每次跑会用 pnpm 9 读 v6.0 lockfile——pnpm 9 能读 v6（向后兼容），但若 CI 触发 lockfile 更新会升到 v9.0，与本地 v6.0 漂移。
- **无 `packageManager` field**：三个 `package.json` 均无 `"packageManager": "pnpm@x.y.z"` pin，corepack 不会自动统一版本。
**风险**：lockfile 格式漂移（CI 偶尔改 v9 → 本地 pnpm 8 读 v9 需升级）；安装结果理论一致（同一 lockfile + 同一 registry），但工具版本不一致是"在我机器上能跑"隐患。
**为何未在本轮处理**：升级 pnpm 8→9 会**重写 lockfile**（v6→v9）+ 触发 store 重新链接，**直接踩 §七.3**（pnpm 8.15.0 `store prune` 曾反复致 store 损坏 ENOENT index）。需独立轮次：评估 corepack pin（`packageManager` field）+ 干净环境验证 lockfile 迁移 + 确认不重新引入 store 损坏模式。当前不阻塞任何功能（pnpm 9 读 v6 lockfile 正常，CI 全绿）。
**动作（待决策）**：① 加 `"packageManager": "pnpm@8.15.0"` 到 root package.json 收敛（CI 也降到 8，最小变更）；或 ② 升级本地到 pnpm 9 + lockfile 迁移（更大变更，需 §七.3 复核）。两者择一，单列轮次。

**已解决（round-74，2026-08-07，选项 B）**：用户选"升级本地到 pnpm 9 + lockfile 迁移"。
- **网络阻塞**：corepack 需 fetch pnpm 9 但 `registry.npmjs.org` 被封（HTTP 000，D1 同模式）。经用户授权"永久切镜像"，`.npmrc` `registry` → `registry.npmmirror.com`（阿里巴巴镜像，0.23s 可达）。`COREPACK_NPM_REGISTRY=https://registry.npmmirror.com corepack prepare pnpm@9 --activate` fetch **pnpm 9.15.9** 成功（corepack 不读 `.npmrc`，须 env var；首次 fetch 后缓存，后续 invoke 无需 env）。
- **配置**：root `package.json` 加 `"packageManager": "pnpm@9.15.9"` + `pnpm.onlyBuiltDependencies`（pnpm 9 build-script gating）= `[esbuild, prisma, @prisma/client, @prisma/engines, sharp, msw]`。**故意排除 `@scarf/scarf`**（遥测，默认阻断）。
- **lockfile 迁移**：pnpm 9.15.9 读 v6 lockfile 时自动升级格式到 **v9.0**（3 处全迁移，root/backend/frontend）；`--frozen-lockfile` 自洽通过。
- **§七.3 安全**：**全程未跑 `store prune`**；pnpm 9 沿用 store v3（无 store 迁移）；store 3.6G 保留；bcrypt 风险不适用（后端用 bcryptjs 纯 JS）。
- **验证（全绿）**：build 脚本产物核实（prisma 引擎/esbuild/sharp libvips 原生二进制全在）；`pnpm build`（backend+frontend）0 错误；3 服务全 online；backend **645|1** / frontend **278** / inference **47**（无回归）；价值链 chronos 382 verified（live）。
- **副作用（接受）**：未来包 install 元数据经 npmmirror.com（用户授权）。**T1 RESOLVED**。详情见 AUTOMATION-STATUS round-74。

### T2 — backend pnpm overrides 与 lockfile 漂移的 vite 地雷（2026-08-14 排除）

**来源**：2026-08-14 `pnpm add undici` 时触发
**事实**：`pnpm.overrides` 的 `"vite": "^5.4.21"`（vitest2+vite5 时代安全钉）从未随 vitest 4 + vite 6 升级同步，而 lockfile 已是 vite 6.4.3——**任何** `pnpm add/install` 都会把 vite 重解为 5.4.21 并炸掉 vitest 4（`ERR_PACKAGE_PATH_NOT_EXPORTED`）。属于"改了 package.json 不 install"埋下的延迟炸弹。
**修复**：override 改 `"^6.4.3"`（≥6.4.3 覆盖原 CVE 意图），vite 恢复 6.4.3、vitest 4.1.10 全绿。
**教训**：改 overrides 必须当场 install + 跑测试。顺带实证 AGENTS.md 的"Vitest 2"陈述已过期（实为 4.1.10）。

---

## 如何更新本文件

- 解决某条 issue 时：在条目末尾加 `**已解决（日期）**：…`，不要直接删除（保留历史可防重复审计）。
- 新增 issue：必须附**证据来源**（文件:行 或 命令输出）和**验证日期**；未 live 验证的标"待确认"。
- 数字类陈述：标注"截至 YYYY-MM-DD 实测"，因为数据层会变。
