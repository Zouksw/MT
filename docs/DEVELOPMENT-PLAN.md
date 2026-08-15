# MT 开发计划（2026-08-14）

> 范围：网络层已修（IPv4 优先 + mihomo proxy-providers），回归产品本身的四条开发线。
> 方法论：planning-and-task-breakdown + incremental-implementation。
> 硬约束（AGENTS.md §十）：外科手术式、守护测试基线、先核实再下结论、诚实不造壳。
> 每轨结束：`tsc --noEmit` + `pnpm test`（backend/frontend/inference）+ live curl 验证 + **独立 commit**；任何批次后测试数不得回退。

---

## 〇、当前真实位置（2026-08-14 实测，round-100 后）

| 维度 | 状态 | 证据 |
|---|---|---|
| 运维 | ✅ 全绿 | 3 服务 online，health 200；**inference 30 分钟击杀循环已修**（KNOWN-ISSUES R4，3584M） |
| 网络 | ✅ | gai.conf IPv4 优先 + mihomo（51 节点 proxy-providers）；**Yahoo 经 `SCRAPER_PROXY_URL` 接入** |
| 推理 chronos | ✅ 验证 | tiny 1.62 / mini 1.65 / base 1.75 avg MAPE，22.6k verified |
| **cme 期货** | ✅ **复活（round-100）** | Stooq 死因=端点删除+PoW（非被墙）；换 Yahoo Finance，12 合约 08-12/13 bar 全写入，量纲实证正确 |
| **beef_cut_prices** | ❌ **冻结 2026-04-30** | #1 产品缺口（仍卡 A2 key） |
| 数据流 | ⚠️ **3/19 源活**（fred/exchange_rate/cme）+ key 缺失 4 个 + 其余网络/反爬 | ingestion_logs 今日 error 实证 |
| 工程 | 797+296+53 测试、0 TODO | disciplined；**vite overrides 地雷已排**（KNOWN-ISSUES T2） |

**核心判断**：网络已不是借口。beef 数据不流是 key+URL 问题（A 轨），非网络。cme 复活后预测订阅商品 5→17，价值链覆盖面实质扩大。

### round-100 战果（2026-08-14，本轮已完成）

1. **N1 inference 内存击杀**（R4）：`max_memory_restart` 2G→3584M（PM2 不认小数 `'3.5G'`——被 WARN 静默拒绝的坑）。burst 内存峰值待 14:26 周期复验。
2. **cme 源复活**（R2 round-100）：Stooq 根因反转（端点删除+PoW，非被墙）→ Yahoo Finance v8 chart API + `SCRAPER_PROXY_URL`（undici ProxyAgent，仅 Yahoo fetcher，其余 fetch 直连）。**顺带修掉潜伏 100× livestock 单位 bug**（LE/GF/HE cents/lb ≡ USD/cwt 数值相等，round-56 的 0.01 是错的）。live：12 合约全写入，活牛 226.2 USD/cwt、玉米 4.755 USD/bu 等全对。
3. **vite overrides 地雷排除**（T2）：`pnpm.overrides` 的 vite ^5.4.21 与 lockfile 6.4.3 漂移，任何 install 都会炸 vitest 4 → override 改 ^6.4.3。
4. **前端 5 孤儿路由 + /contact 幽灵路径**：alerts→Rules、apikeys 行→View、settings hub→Billing、beef→Factories 入站链接补齐；middleware PUBLIC_PATHS 去掉不存在的 /contact。
5. 测试：两套重叠 cmeFutures 套件合并（17 用例）；backend 797|1（基线 795 +2）、frontend 296、inference 53。

---

## Track A — 数据层收尾（#1 缺口：beef_cut 冻结）

> 依赖关系：A1/A2 独立可做；A3 依赖 A2（key）与 A1（MLA URL）。

### A0 · 复验网络修复后的数据流（grounding）— **2026-08-14 round-100 完成**
- **结论修正**：此前"cme 已复产"判断**错误**（DB 证明 Stooq 路径 5-19 后零写入）——根因是 Stooq 端点删除 + PoW 反爬，非网络。round-100 换 Yahoo 源后**真正复产**（12 合约 live 验证）。现产数源 3 个：fred / exchange_rate_api / cme(Yahoo)。完整 19 源状态表见 KNOWN-ISSUES D1 round-63 表 + 2026-08-14 复核。

### A1 · MLA 死链修复（代码任务）— 调研结论 2026-08-14
- **做什么**：`mlaNlrs.ts:14` `MLA_API_BASE = ...services.mla.com.au/api` 已全球无解析（MLA 迁至 Cloudflare 后的 `www.mla.com.au`）。调研 MLA National Livestock Reporting Service 现行数据端点（是否换域名/需新 key/已停公开 API），更新 URL + 对应解析逻辑 + 测试。
- **验收**：`mlaNlrs` 爬虫对新端点返回真实结构（非 0 行占位）；`mlaNlrs.test.ts` 守护；若需新 key 则登记到 A2。
- **文件**：`backend/src/services/dataIngestion/sources/mlaNlrs.ts`、`mlaNlrs.test.ts`
- **风险**：MLA 可能已停公开 API → 需替代源或登记为"不可解"。
- **规模**：M
- **调研结论（2026-08-14 实测）**：MLA 现行 API = `www.mla.com.au/prices-markets/statistics/api/`（旧 `services.mla.com.au/api` 已废）。解锁需**三件事且互为前提**：
  1. 换 URL（我能做）—— 但 `www.mla.com.au` 直连 **403 Cloudflare**，仅经 clash 代理 **200**。
  2. MLA key（你提供，现 UNSET）—— 无法在无 key 下验证①。
  3. backend 经代理路由（HTTPS_PROXY + NO_PROXY + 重启）—— prod 改动。
  - 结论：A1 非干净自主赢点；**与 A2 同卡在你的 key**。`statistics.mla.com.au`（404 at root，在线）可能是真 API 主机，待 key 到位后核实端点结构。

### A2 · API key 持久化（**待你给凭据**，清单已扩到 6 把）
- **做什么**：把 key 写进 `backend/.env` **并** `ecosystem.config.cjs` 的 `env_production`（根治 8-11 重启丢失 key 的根因）。清单（2026-08-15 第二轮源探测后）：
  1. `USDA_MARS_API_KEY`（beef_cut_prices 解冻唯一钥匙，最高优先；主机在线就差 key）
  2. `MLA_API_KEY`（直连 200 已通，A1 调研完成；真 API 契约需 key 核实）
  3. `FRED_API_KEY`（fredData.ts/balticDry 走 api.stlouisfed.org）
  4. `OPENWEATHER_API_KEY`（weather）
  5. `FAO_API_KEY`（**新**：FAOSTAT 迁移到 faostatservices.fao.org 后强制 Bearer；faoPrices.ts 已切新 URL+key 门控，key 到即产数）
  6. `FAO_API_KEY` 之外可选：FAS data.gov key（usdaPsd 官方 API api.fas.usda.gov）
- **验收**：重启 backend 后 `/proc/<pid>/environ` 含全部 key；对应源跑批 error→success。
- **依赖**：你提供 key 值（我不能凭空造凭据）。
- **规模**：S

### A3 · 验证 beef 数据回流
- **做什么**：触发 usda_ams/mla 跑批，确认 `beef_cut_prices` 出现 ≥8-14 新行；`GET /api/beef/forecasts/{cut}` 返回 `forecastable:true`；MAPE 环开始产 beef verified。
- **验收**：DB 新行 + per-cut 预测门通过 + accuracy 页 beef 维度有样本。
- **依赖**：A1 + A2。
- **规模**：S

### A4 · 残余源决策（低优先，可选）
- `.gov.cn`（china_wholesale/shipping/dce）：海外代理未必能到，评估下线或保留。`inac`（gub.uy）站点疑似全球下线，确认后下线。`fao` 源站 521 自身挂，等恢复。

---

## Track B — AI 预测强化

### B1 · chronos 收敛决策（独立，快）— 决策 2026-08-14：**保留 3 变体加权集成**
- **做什么**：实测 `chronos_tiny`(MAPE 1.63%, 最快最省) ≥ mini(1.66) ≥ base(1.77)。决策主共识是否收敛到 tiny（省算力/更稳）或保留 3 变体取众数（抗单点）。改 `tradingSignals.ts:29` `ALL_MODELS` + 守护测试。
- **验收**：决策记录写入本文件；`getAllModels()` 单测同步；`/ai/accuracy` 角色徽章一致。
- **文件**：`tradingSignals.ts`、`tradingSignals.test.ts`
- **规模**：S（决策 + 1 常量）
- **默认**：若你不表态，按数据选 tiny 为主、保留 mini/base 作 baseline。
- **决策结论（2026-08-14，核实 `modelRegistry.ts:19` + `tradingSignals.ts` 头注）**：**不改代码，保留现状**。`ALL_MODELS` = 3 Chronos T5 size 是**为容量多样性设计的加权集成**（`resolveModelWeights` 按 MAPE 动态加权、`weightedMedian`/`weightedDirectionVote` 聚合、`Promise.allSettled` 抗单模型失败）——集成中位数比任何单点更抗离群值。收敛到 tiny-only 会移除容量多样性 + 动态加权，而集成非计算瓶颈（inference 稳定 560M）。当前实测三档 1.63/1.66/1.77% 都极优且接近 → 集成是正确选择。**B1 以"验证现状正确 + 本决策记录"收尾，无代码改动。**

### B2 · accuracy 页 beef 维度透明化（依赖 A3）
- **做什么**：`getAllModelAccuracy`（`mapeTracking.ts:853`）暴露 beef-specific MAPE 元数据；前端 accuracy 页加"全部商品 / 仅牛肉"切换 + under-sampled gating。
- **验收**：beef 切换显示真实 beef MAPE（样本不足时 "Insufficient data"）。
- **依赖**：A3（beef verified 产出后才有数据）。
- **规模**：M

### B3 · stl_forecaster 去留（独立产品决策，可选）
- 历史 10.88% MAPE，代码已修（damped-trend gate）但 stat 不再进后台调度、无新证据。决策是否从 `BASELINE_MODELS` 移除。

---

## Track C — 前端 / 架构债（外科式）

### C1 · API base 集中（TD-8）
- **做什么**：消除 ~15 处内联 `NEXT_PUBLIC_API_URL`，统一走 `lib/config.ts:15` `API_BASE`。修正后缀不一致（有的加 `/api` 有的不加）。
- **文件**：`useTradingData.ts`(5 处)、`useBeefImport.ts:33`、`useDashboardStats.ts:9-11`、`lib/market-data.ts:8`、`app/apikeys/edit/[id]/page.tsx`、`app/dashboard/models/page.tsx:65`、`app/beef/import/page.tsx:52`、`app/dashboard/performance/page.tsx:119`、`components/WebVitals.tsx:30`。
- **验收**：`grep -rn NEXT_PUBLIC_API_URL frontend/src` 仅命中 `lib/config.ts`；前后端联调无 404；frontend 测试不回退。
- **规模**：M

### C2 · Tailwind 三色源收敛（TD-12）
- **做什么**：现三套色源并存（`tailwind.config.ts` hex[死]、`globals.css @theme inline` oklch[活]、`tokens.css` hex[死]）。定一套产品色板，消除 `StatCard.tsx:127` 硬编码 `info:#2563EB`、`#8B6914` 散落 37 处。
- **验收**：单一色源；`text-*`/`bg-*` 全走语义 token；design-review 无 hue drift。
- **依赖**：产品色板决策（可我提方案你定）。
- **规模**：M

### C3 · a11y 补强（DESIGN-SYSTEM-AUDIT）— 复核 2026-08-14：**h1 主项已关闭，审计过期**
- **做什么**：30/38 页无 `<h1>`、标题层级跳级、1 个无 label 输入、1 处纯颜色状态。
- **验收**：关键页有 h1；axe/lighthouse a11y 分提升。
- **规模**：M
- **复核结论（2026-08-14 实测）**：DESIGN-SYSTEM-AUDIT 的"30/38 页无 h1"**已过期**。现状：`PageHeader.tsx:52` 渲染 `<h1>`，被 31 文件使用；login/register 经 `auth-page/index.tsx`（h1=1）获得 h1；root `page.tsx` 合法 `return null`（重定向页）。**44/44 页 h1 覆盖恰当**，无需批量补 h1。残留 2 项（1 无 label 输入 / 1 纯颜色状态）待 axe 扫描复核（审计同源，可能亦过期）。**C3 主项以"验证已关闭"收尾。**

---

## Track D — 测试加固（伴随每轨 + 独立）

### D-per · 每轨改动配回归测试（硬约束）
### D1 · `datasets` 路由测试（现仅 `data.test.ts` 部分覆盖）
### D2 · `docs` 路由（纯 Swagger 静态，评估是否值得测，否则文档说明跳过原因）
### D3 · scraper 测试覆盖（仅 3/19：fao/worldBank/cme → 补 usda/mla/cepea 等关键源）

---

## 执行顺序与依赖

```
A0 (grounding) → A1 (MLA) ─┐
                            ├→ A3 (验证回流) → B2 (beef accuracy)
A2 (key, 待你) ─────────────┘
B1 (chronos, 独立) ──────────────────────────────────────→ 可并行
C1/C2/C3 (前端, 独立) ──────────────────────────────────→ 可并行
D-per 伴随每一批；D1/D2/D3 穿插
```

**建议串行主线**：A0 → A1 → (A2 待你) → B1 → C1 → C2 → C3 → D1/D3 → B2(待 A3)。
**可并行**：B1、C1/C2/C3、D 不互相阻塞。

## 需要你的输入

1. **API keys**（FRED/USDA/OPENWEATHER/MLA）—— A2/A3 卡这。最优先 USDA（网络已在线）。
2. **chronos 收敛偏好**（B1）—— 默认按数据选 tiny。
3. **产品色板**（C2）—— 我可提方案你定。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| MLA 已停公开 API | A1 不可解 | 登记为"数据源下线"，CSV 导入兜底（round-81 已验证） |
| 改色板误伤现有 UI | C2 视觉回归 | 语义 token 逐替换 + design-review 校验 |
| API base 重构引 404 | C1 联调断 | grep 验证 + 集成测试 + 分批 commit |
| key 仍不给 | A2/A3 停摆 | 其余轨（B1/C/D）不受影响，持续推进 |
| cme 复活后 burst 变大（15→~51 请求/30min） | inference 内存逼近 3584M | R4 遗留观察：若 WORKER 再击杀则限并发或上调（14:26 周期起跟踪） |
| mihomo 宕机 | 仅 cme 期货断流（scraper 静默 0 行，不 crash） | systemd Restart=on-failure；cron-healthcheck 不监控 mihomo（已登记 AUTOMATION-STATUS 待办） |
