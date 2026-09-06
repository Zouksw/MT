---
title: "改进方案 — 竞争分析落地执行计划"
en_title: "Improvement Plan — Executing the Competitive Analysis"
version: "3.8.0"
last_updated: "2026-09-06"
status: "active"
maintainer: "MT Team"
tags:
  - roadmap
  - execution-plan
target_audience: "Maintainer"
related_docs:
  - "Competitive Analysis": "COMPETITIVE-ANALYSIS-MOOKET.md"
  - "Product Spec": "PRODUCT-SPEC.md"
  - "Tech Debt": "TECH-DEBT.md"
  - "Research Landscape": "RESEARCH-BEEF-INFO-LANDSCAPE.md"
  - "Trade Data Research": "RESEARCH-BEEF-TRADE-DATA-SOURCES.md"
---

# 改进方案 — 按 [牧集对标分析](COMPETITIVE-ANALYSIS-MOOKET.md) 制定的执行计划

> ## 第十波 v3.8.0（2026-09-06 规划，round-156 起）— 代码质量轮：五轴实测 + 分批提升
>
> **指令来源**：用户"深度探查当前项目的代码质量，制定提升代码质量的方案"。全库取证 2026-09-06 live 实测（五轴：正确性/可读性/架构/安全/性能），本波不夹带任何功能改动。
>
> ### V10-一、质量基线（2026-09-06 实测，全部可复跑命令取证）
>
> | 维度 | backend | frontend | inference |
> |---|---|---|---|
> | tsc / ruff | **0 错** | **0 错** | ruff 全过（无类型检查器，维持现状） |
> | biome findings | 23（17W+6I，全低危：noNonNullAssertion 13 / useTemplate 4 / unusedImports 2 / uselessSwitchCase 2 / optionalChain 1 / unusedParam 1） | 12（noExplicitAny 8 等） | — |
> | biome-ignore（非测试代码） | 2 | **90**（noExplicitAny 41 / noArrayIndexKey 36 / a11y 5 / noImgElement 3 / useExhaustiveDependencies 3 / nonNull 2） | 0 |
> | 测试基线 | 1099+1 skip / 106 文件 | 360 / 42 套件 | 64 / 4 文件 |
> | test:source 文件比 | 117/107 = **1.09** | 63/178 = **0.35**（44 页仅 ~9 页区有直接测试） | 4/14（主径覆盖，库仅 3,037 行） |
> | 依赖漏洞（`pnpm audit --prod`，npmjs registry） | **7**（high 5：fast-uri×4 + js-yaml；moderate 2：qs） | **57**（high 26：next / sharp / js-cookie / nanoid / postcss / js-yaml / brace-expansion / browserslist / fast-uri / hono；moderate 27 + low 4） | pip-audit 未配置 |
> | 卫生 | TODO/FIXME **0**；console.log 1；空 catch 10（全在 `test/helpers/testContext.ts`，best-effort 清理属合理） | TODO 0；console.log 2；空 catch 0 | — |
> | 最大文件 | seed.ts **2,696** / mapeTracking.ts 1,538（+test 1,721）/ beef.ts 路由 851（TD-6） | performance/page **750** / alerts/rules 705 / data-sources 702 | inference_engine.py 381 |
>
> **取证附带发现**：① round-152 登记的"frontend `tsc --noEmit` 在 useTradingData.test.ts 有 2 个既有类型错"**已消失**（本次净树复测 0 错、退出码 0），过期登记随批 1 关闭；② `hono` 是 frontend 直接生产依赖（package.json）但**源内零引用**（唯一命中为测试文案 "honored" 子串），却携带 high+moderate advisory——直接删除候选；③ 3 处 `useExhaustiveDependencies` 抑制均附充分理由注释（deliberate run-on-X-change 触发模式），保留复核即可；④ 覆盖率工具已配置（backend `@vitest/coverage-v8` / frontend `jest --coverage`）但从未产出报告，无基线；⑤ pytest 20 条 warning 全为三方内部噪音（statsmodels 收敛/非平稳 + starlette testclient 弃用），不修。
>
> ### V10-二、批次总览
>
> | 批 | 内容 | 规模 | 门控 |
> |---|---|---|---|
> | **0（P0 安全）** | 依赖漏洞清零：backend 升 fast-uri / js-yaml / qs；frontend 升 next（patch 优先，D29）/ sharp / js-cookie / nanoid / postcss / js-yaml / qs + **删零引用 hono**；确实不能升的用 `pnpm.overrides` 钉安全版并在 package.json 注明理由 | M | 无 |
> | **1** | biome 34 条 findings 清零（全部机械修复）+ console.log 3 处清理 + 关闭 ① 的过期登记 | S | 无 |
> | **2** | biome-ignore 90 → <20：41 个 noExplicitAny 借 recharts-lazy 类型收口集中解决；36 个 noArrayIndexKey 改稳定 key（静态图表数据用 period/slug 字段）；useExhaustiveDependencies 3 处复核后保留 | M | 无 |
> | **3** | 复杂度热点拆解（**只移动不改逻辑**，每子批独立验证）：3a seed.ts 2,696 按 category 拆模块（commodities/baselines/news fixtures，主文件只编排）；3b beef.ts 851 拆 service 层（TD-6）；3c 前端 3 个 700+ 行页面拆子组件；mapeTracking.ts 1,538 视 3a 证据再定是否入 3d | M-L | 无 |
> | **4** | 覆盖基线首次可见（双端 `test:coverage` 出报告，**不设阈值门禁**）+ 2 个既有 flaky 根治（mapeTracking 月末敏感用固定日期注入；T3 并行负载型复核隔离方案） | S-M | 无 |
> | **5** | TECH-DEBT 活跃项收口：TD-5 三套 AuthRequest 类型收敛 / TD-8 axios→fetch 迁移（market-data.ts）/ TD-14 空库 `migrate deploy` 冷启动验证 / TD-17 脚本漂移清理；已清项（TD-1/4/7/9/10/11）状态对齐标 RESOLVED | M | 无 |
>
> ### V10-三、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 |
> |---|---|---|
> | **D28** | CI 是否加 coverage 阈值门禁 | 先可见不加门；攒两轮基线数据后再议阈值 |
> | **D29** | next 漏洞若需 minor 跳版（15.5.x → 15.6+）是否接受 | patch 优先；minor 单独批 + 44 页全冒烟后再合 |
> | **D30** | pip-audit 是否引入 inference | 建议缓——torch/statsmodels 供应链噪音大，ruff+pytest 已覆盖主风险面 |
>
> ### V10-四、不做清单（继承红线 + 本波新增）
>
> 不引新重构框架、不做全量重写、不夹带功能改动、覆盖率不设阈值门禁（D28 未过门）、不修三方库内部 warning（statsmodels/starlette）。批 3 拆解严守"只移动不改逻辑"，行为由既有 1099/360/64 基线守护。
>
> **执行顺序**：批 0（安全优先）→ 1 → 2 → 3（可拆子批穿插）→ 4 → 5。门禁沿用：tsc + biome + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。
>
> **执行状态（2026-09-06，round-156，批 0+1+2+4(基线) 落地）**：**批 0** `ec6a063`——`pnpm audit --prod`（npmjs registry）backend 7→**0**、frontend 57→**0**。根因：`shadcn` CLI（源内零 import）混在 frontend `dependencies`，把 @modelcontextprotocol/sdk→hono/express5/qs/ip-address/fast-uri 整条工具链拖进生产审计面 → 移 devDependencies；next ^15.5.25（15.5.x 线内 patch，D29 未启用）、js-cookie ^3.0.8；overrides 治理（更新 postcss/brace-expansion，移除 dev 侧 hono/ip-address 钉，新增 sharp/browserslist/@babel/core）；backend 新增 fast-uri/js-yaml/qs 三钉。**批 1** `562fb59`——biome 34→**0**（backend 23：生产 5 处手工精修 + 测试 18 条 unsafe 自动修 + 1 处手修；frontend 12→0：CommodityPriceChart 迁 `dynamicRecharts()` 消 6 处 any 并暴露/修复 Tooltip formatter 真实类型缺口 2 处）；useRetryableFetch 两处 dev-guarded console.log 归位 warn/info；KNOWN-ISSUES"tsc 2 错"过期登记关闭。**批 2** `eefe946`——biome-ignore **91→26**：7 个图表组件迁共享 `dynamicRecharts()`（工厂目录随扩 Scatter/Cell/ReferenceLine；暴露并修复 recharts formatter 类型缺口 3 处）、28 处索引 key 改稳定字段键；noExplicitAny 41→5、noArrayIndexKey 37→8（余项均带文档化理由；a11y 5/img 3/断言 2 为批 2 范围外遗留）。**批 4（基线部分，零代码）**——双端覆盖率首次落表：backend 70.82/62.39/76.35/72.26（语句/分支/函数/行）、frontend 39.68/69.72/50.43/39.68（前端低数主因 44 页仅 ~9 页有直接测试）；两个 flaky 项 round-153 已重新定性为并行负载型，无需代码修复。门禁（各批同口径）：tsc 双端 0、biome 双端 0 findings、backend 1099+1 / frontend 360 零回退、build 0、PM2 重启、live 全绿。**批 3b 已落地（`ab66660`，TD-6 主体）**：beef.ts 851→381——6 个胖 handler（~510 行）逐字平移至 `services/beefPriceQueries.ts`（路由只剩中间件链+薄委托，对齐 /by-country 既有模式）；qs 无类型声明改结构性 `BeefQuery`（零新依赖）；全量 1099+1 零回退 + 11 端点 live 200 + trend 契约/厂号 404 诚实规则逐位保持；/prices 与 /prices/latest 的过滤器构造差异（relation vs id-set）刻意不合并。**批 3c 改判缓做（2026-09-06 接缝扫描证据）**：三页面（performance 713 / alerts/rules 705 / data-sources 702）的自然接缝已被历史轮次吃掉（Modal/badge/card 子组件均已抽出），剩余主体是 15-23 个 hooks 的有状态编排——再拆即参数透传收益为负（过度工程化防线，见 CHANGELOG 同日 Q&A）；待页面功能迭代需要时随批重构。**批 3d 维持条件门**（mapeTracking 逻辑密集非数据块，3a 模式不适用）。**批 5 部分落地（2026-09-06）**：TD-14 冷启动终验通过（全新空库 `migrate deploy` 全量成功，RESOLVED）；TD-17 三子项复核全关闭（孤儿脚本 round-112 已删 + logrotate round-111 已同步 + mt.service round-114 已装，RESOLVED）；TD-5 结案（两变体为有意设计）；TD-1/4/7/8-axios/9/10/11 既有结案注记复核在案。**TD-8 剩余开放项**（裸 fetch → useRetryableFetch 收敛，~39 处）与 TD-6 剩余 timeseries.ts（10 处直连）为债务清单留尾，本波不强行清。

> ## 第九波 v3.7.0（2026-09-06，round-155）— 产品范围收敛轮：国产维度完全删除 + 外贸信息面丰富
>
> **指令来源**：用户"当前项目只负责牛肉外贸市场的预测"→"完全删除国产维度，丰富外贸维度的信息"。五批独立 commit 全门禁（tsc/biome/全量测试不回退/build/PM2 重启/live 验证）。
>
> **删除侧**（批 A `3e4f57f` / 批 B `e7c3761`）：/beef 国产筛选、dashboard 国产均价卡、trend 契约 `domesticTrendPct`（前后端+测试）全部移除；seed 与生产库删除 27 个 `_cn` 商品序列（国产牛肉部位/国内活牛谷物/11 条批发系列；180 价格行 + 4637 预测行，PredictionLog 无外键显式删，定向备份 `backups/round155-domestic/`）；`china_wholesale` 源退役（注册 19→18）；api-workflows 商品目录断言 ≥100→≥80（seed 目录 111→84）。**D16（国产数据路线）与 D22（新发地观察项）随维度删除永久关闭**——国产入口/筛选/数据通道不再存在，无路由可复用。
>
> **丰富侧**（批 C / 批 D `4fbc504`）：贸易流读侧深化——`TradeFlowEntry.history`（每国 24 期月度序列，数据本就在手只回最新 2 点）+ TradeFlowsCard HS 切换器（8 条 lane）/月度量柱+价线 ComposedChart/数量环比与月度金额列/阿根廷出口总额上下文行；`beef_90cl_us` 进公开 digest 白名单（节奏逻辑 interval-generic 零分支）+ dashboard hero 第二卡换"进口 90CL 周度基准"。D25（贸易流公开）维持鉴权内，~10 月按门复核。
>
> **顺手根治（live 发现）**：node-redis 4.7.1 变参 `del(k1,k2)` 只删第一个键——tradeFlows 测试清理的 spread 形式曾把 `hs=0202` 缓存键泄漏满 3600s TTL，向下一轮 run 直出陈旧形状；清理改逐键删（生产代码均为数组形式，实证不受影响）。
>
> **基线**：backend 1099+1 skip（0 净变化：扩展既有用例）；frontend 356→**360**（+4 TradeFlowsCard 组件测试）；inference 61 未动。

> ## 第八波 v3.6.0（2026-08-31 规划）— 数据通路波：贸易流量价通路打通 + 厂号维度拓宽
>
> **执行状态（2026-08-31，round-152，批 0+2+4 落地）**：用户指令"将可以自动操作的项目先完成"。前置 `20c79ae`（规划轮文档入库）。**批 0** `6afc196`——`comtrade_mirror` 源落地（月度镜像 BR/AU/NZ/US×8 HS + AR/UY 年度回退 + 中国年度 CIF 校准线 `import_cn_cif_*`，免 key 直连）；37 个月回填 161 查询→928 行（6 区域×8 HS×37 月度时点，2023-07→2026-07）；**live 验收逐位对齐**贸易报告（BR 2026-06 0202 = 158,364,760kg/$1,069.2M/$6,751/t；中国 2024 CIF 校准 7 行全中）；**noChange 修复**：Decimal(18,6) 精度预圆整——裸浮点永不等库内截断值致 boot run 111 行幽灵更新（live 发现 live 修），复跑 → unchanged/success 0/0；D23 执行：china_customs_stats 双处退役（ingestion_logs 历史全 warning 0/0 佐证零产出），源计数 19 注册（AGENTS 已同步）。**批 2** `30b3440`——序列定位证实**降级分支**：datos.gob.ar 无牛肉×目的国月度交叉（SSPM 75 有产品族无目的国、77 反之，缺口登记）；落 `ica_carnes`（SSPM 75.3 月度 CSV，1992 起、t-2 新鲜，直连免 key）type=`export_fob_carnes`/region=`AR→WORLD`，boot run 414 行 CSV→36 月窗口 34 行入库（2023-09→2026-06）。**批 4** `65b1157`——`GET /api/market/trade-flows`（鉴权内起步 D25；zod hs 枚举钉住源模块 HS_CODES 单一事实源；cacheRoute 3600s，键为 Router 相对路径 live 复核）+ /beef 页"对华贸易流"卡（分国别最新月量/价/环比 + CIF 校准并列表 + 口径注记强制 3 条随载荷；匿名访问卡片自省略，forecast 列同款降级）；**stale 语义 live 修复**：75 天墙钟阈值误标 t-2 正常节奏源（AU/US），改月差 >3 月（UY 年度 2024 仍诚实 stale）。测试基线 backend **1091+1 skip**（+10 comtrade +5 argentina +4 trade-flows 集成）、frontend **354**（352 基线上零回退）、inference 61 不变 = **1546**；两既有 flaky/回归登记（见下）。**剩余：批 1（用户门：单一窗口账号）未动；批 3（用户门：data.gov key）未动；批 5 观察项值守。round-152 新登记既有问题：frontend `tsc --noEmit` 在 `useTradingData.test.ts` 有 2 个既有类型错（净树复现，非本批引入，待修）；`mapeTracking.monthly.test.ts`"批0b restore"用例月末敏感 flaky（8-31 当天 3 跑 1 挂，隔离复跑即过）。承第七波批 0a/0b 门控不变。**
>
> **追加（2026-08-31，round-153，数据维护轮）**：用户指令"解决与数据有关的其他问题，维护项目数据相关的文档"。同主题三修——① `8fb2d92`：fredCsv 共享模块 Decimal(18,6) 6dp 舍入（world_bank 每轮 23-35 行幻影更新终结，live 实证 PPORKUSDM 14 位小数 vs 库内 6dp 截断）+ world_bank noChange 契约补齐（月中重扫 0/0 → success）；② `2ab1fa9`：fred 免 key fredgraph.csv 回退（15 宏观 MarketFactor 序列复活，首轮 live 修正 5 个休眠错误 series id，"Missing FRED_API_KEY" error 噪音归零，FRED_API_KEY 转可选）；③ T3 重新定性为并行负载型 flaky（挂点漂移实录 signals 30s 超时/隔离 1.5s）+ `PIPESTATUS` 门禁卫生登记。数据文档对齐：API.md 补 trade-flows 行（批 4 漏登）、PRODUCT-SPEC §七 数据层两行重写（2026-08-31 live 实测）、KNOWN-ISSUES D1 追加。基线 backend **1099+1 skip**（1092→1100，+8，零回退）。详见 CHANGELOG round-153。
>
> **指令来源**：用户"结合探究的报告，制定打通和拓宽数据通路的方案"。**输入**：[RESEARCH-BEEF-TRADE-DATA-SOURCES.md](RESEARCH-BEEF-TRADE-DATA-SOURCES.md) v1.0.0（2026-08-31，全部关键源本机 live 取证——下称"贸易报告"）。
>
> **波次论断**：V7-二.9 曾把海关源登记为"环境阻塞（stats.customs.gov.cn 不可达），不排期"——贸易报告用**出口国镜像策略**绕开了这个死结：**UN Comtrade 公共预览 API 免 key、本机直连可用**（巴西月度新鲜到 t-1、澳/新/美 t-2、中国年度分国别官方口径），无需中国出口、无需爬虫、无需 key。这意味着"对华贸易流量价"这层数据**从环境死锁变为零成本可执行**。本波两件事：**打通**（把断掉/零行的贸易统计通路接通——批 0/2）+ **拓宽**（新增厂号注册状态维度与 HS10 粒度——批 1/3），最后补最小读侧面让数据可见（批 4）。
>
> ### V8-一、基线与通路健康图谱（2026-08-31 生产库实测）
>
> | 层 | 现状 | 证据 |
> |---|---|---|
> | MarketFactor（贸易/宏观因子层） | **仅 exchange_rate_api 207 行（至 2026-08-30）**——除汇率外整层空置；china_customs_stats 历史贡献 **0 行**（虚构端点 + .gov.cn 封锁，KNOWN-ISSUES D1） | psql GROUP BY source |
> | 贸易流量价（分国别×HS×月度） | **0 行**——本波主战场 | 同上 |
> | Factory（厂号参照表） | 21 家（AU6/BR5/US4/AR3/UY2/CN1，seed 时代），**无注册状态/准入维度** | psql GROUP BY country |
> | beef_cut_prices | 2,401 行冻结 2026-04-30（不变，D1 用户侧钥匙未到） | psql |
> | 测试基线 | backend **1072+1** / frontend **352** / inference 61 = **1485**（V7 批 3 后口径） | V7 执行状态 |
> | 上游可达性 | Comtrade 免 key ✅；单一窗口厂号查询站 ✅（查询需实名会话）；datos.gob.ar/magyp ✅；api.fas.usda.gov 主机 ✅（需 key）；stats.customs.gov.cn ❌（直连+代理均不可达）；INAC ❌（全球下线） | 贸易报告 §三矩阵 |
>
> ### V8-二、通路诊断（打通 vs 拓宽）
>
> **打通（断路复活）**：① 对华贸易统计——源代码存在但端点虚构+主机封锁，零产出 → **Comtrade 镜像替代**（同语义换活源，MarketFactor 落库模型不变）；② 阿根廷月度——Comtrade 无其月度明细 → 国家开放数据门户（直连已验）；③ 乌拉圭——INAC 全球性下线，无免费路径，**维持登记等其恢复**（不排期）。
> **拓宽（新维度）**：① 厂号注册状态（有效/暂停）+ 产品类别 → Factory 表零迁移扩容，为搜索/watchlist 的"国家×厂号"维度提供数据地基（牧集 `/followProduct` 与必孚"新增准入"情报的对等公共数据版）；② HS10 粒度（美国线 cutoff/trimming 子目，FAS GATS）；③ 贸易流读侧面（MarketFactor 现仅 stats 一处 groupBy，无任何用户可见面）。
>
> ### V8-三、批次总览
>
> | 批 | 内容 | 价值 | 规模 | 门控 |
> |---|---|---|---|---|
> | **0（P0）** | `comtrade_mirror` 源（月度镜像 + 中国年度校准线）+ china_customs_stats 退役 | 贸易流量价从 0 行到多国覆盖；消除零行空跑 | M | 无（D23 随批确认） |
> | **1** | 厂号注册参照表（单一窗口导出 → Factory 表）+ /api/search 厂号维度 | "国家×厂号"搜索地基（牧集对等能力公共数据版） | S-M | **用户门**（单一窗口账号/导出件）+ D24 |
> | **2** | 阿根廷月度出口源 `argentina_exports`（datos.gob.ar 直连） | 补 AR 月度缺口（Comtrade 无其月度） | S | 无（首步序列定位带降级分支） |
> | **3** | USDA FAS GATS 源（HS10 细粒度，api.fas.usda.gov） | 美国线子目级纵深 | S | **用户门**（data.gov 免费 key） |
> | **4** | 贸易流读侧最小面（读端点 + 行情页"对华贸易流"卡） | 数据可见性闭环（批 0 数据的用户面） | S | 批 0 数据积累 ≥1 个月 + D25 |
> | **5（观察项）** | 中国官方口径复活 / Comtrade key 提额 / 商业提单库评估 | 条件触达，零开发等待 | — | 外部条件（见批 5 明细） |
>
> **顺序**：批 0 → 批 2（可与 0 穿插）→【用户门到】批 1 → 批 3 →【数据积累】批 4；批 5 纯观察。门禁沿用：tsc + biome + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。
>
> ### V8-四、批次明细
>
> **批 0 — Comtrade 镜像源 `comtrade_mirror`（M，P0）**
> - 新源 `sources/comtradeMirror.ts`（注册双处：`dataIngestion/index.ts` Tier 3 + `server.ts` DAILY_SOURCES——月度数据挂日循环，非发布日重扫同月=确认无变化，走 **`noChange:true` 契约**防 empty 误报，usda_import_beef 先例 round-149）。
> - **查询集**（贸易报告 §4.1 实测口径）：月度活 reporter {76 巴西, 36 澳, 554 新, 842 美}× cmdCode {0201, 0202, 020230, 020220, 020610, 020621, 020622, 020629}× flow=X× partner=156；**年度回退** {32 阿, 858 乌} 同 cmdCode（freq=A）；**中国校准线**：reporter=156 / freq=A / flow=M / 全伙伴（年度一次）。首跑回填 36 个月。
> - **实现要点（全部为实测坑，写进测试）**：① `motCode==0` 过滤——按运输方式拆行直接求和会得到 ~2× 量（实测 2026-06 巴西 316,730t 裸和 vs 158,365t 正确值）；② flowCode 必须 `X`/`M`（`1` 返 400）；③ 限速 ≥1.5s/req + 429 退避（公共预览 ~1 req/s，实测 429"Try again in 1 seconds"）；④ 落库 `upsertFactor`：type=`export_to_cn_{hs}`、region=`{ISO2}→CN`、unit=`USD/ton`（fobvalue ÷ netWgt/1000）、metadata 存 qtyKg/valueUsd/partner/period/classification=H6——type+region 已含国别×HS 去重语义，seriesKey 留默认（round-104 教训的反向适用）。
> - **china_customs_stats 退役（D23）**：注册与 DAILY_SOURCES 移除（inac 先例——零行空跑白付超时），源文件保留待中国出口条件复活（届时端点须重探——现行 `api/trade/query` 为虚构路径，从未核实过真实契约）；AGENTS/KNOWN-ISSUES 计数同步。
> - 测试预估 +10~14：解析器（mot 去重/坏行丢弃/单位换算/429 退避）+ noChange 分类 + 查询集契约（常量钉住防漂移）。验收 live：首跑写入 ≥4 国 × ≥3 HS × ≥24 个月；巴西 2026-06 行与贸易报告实测值对齐（158,365t / $6,751/t）；freshness 板 healthy。
>
> **批 1 — 厂号注册参照表（S-M，用户门）**
> - **用户动作**：免费注册单一窗口账号（实名）→ 从 `ciferquery.singlewindow.cn`（进口食品境外生产企业注册信息，本机 200 已验）按国别导出厂号清单（页面自带查询与导出；**脚本化登录抓取不做**——ToS 未验证，贸易报告 §七.2）。
> - 形态：ADMIN 端点 `POST /api/factories/registry-import`（CSV 上传，复用 beefImport 成熟模式：模板端点 + 白名单键 + 坏行跳行宁缺勿错）→ Factory 表 **零迁移**（accredited[] 存产品类别、active 存注册状态、metadata 存快照日期/所在地区注册编号/来源）。
> - 搜索面联动：/api/search 白名单加 Factory（code/name/country 维度，每源封顶 5 沿既有纪律）——D20（watchlist 部位×厂号订阅）的数据地基就此齐备，但 D20 本身维持排后（部位级数据面冻结未变）。
> - 验收：21 家既有厂之外的增量导入（如 BR SIF 全量）；重复 code 幂等更新（updatedAt 触发）；/api/search 可按厂号/国别命中。
>
> **批 2 — 阿根廷月度出口 `argentina_exports`（S）**
> - **首步=序列定位**（降级分支显式）：datos.gob.ar CKAN 检索牛肉专项月度出口序列——本轮命中出口总额级（SSPM Exportaciones FOB por rubro 月度 CSV 直链 `infra.datos.gob.ar`）与产量/价格面（magyp SIO Carnes），**牛肉×目的国月度序列未命中（待确认）**。命中→落 MarketFactor（type=`export_to_cn_ar` 对齐批 0 语义）；只命中总额级→落 `export_total_ar` 并登记缺口；SENASA 工厂/目的国级统计在 argentina.gob.ar（`viaProxy` 经 SCRAPER_PROXY_URL，既有基建）——批内可选子项。
> - noChange 契约同批 0；测试预估 +5~8。
>
> **批 3 — USDA FAS GATS（S，用户门）**
> - 用户申请 data.gov 免费 key → `FAS_API_KEY` 入 .env；新源 `usdaFasGats.ts` 走 `api.fas.usda.gov`（主机本机可达已验，GATS 双边 HS10 官方出口口径）。落 MarketFactor（type=`export_to_cn_us10_{hs10}`）；批内与 Comtrade HS6 美国线做聚合一致性互校（对不齐则登记口径差，不硬拼）。
> - 价值：美国线 0202.30.xxxx 级子目（cutoff/trimming 等）比 HS6 更细。
>
> **批 4 — 贸易流读侧最小面（S，时间软门：批 0 后 ≥1 个月数据积累）**
> - `GET /api/market/trade-flows`（鉴权内起步，D25 定公开节奏）：分国别月度量/价/环比 + **口径注记强制**（FOB 镜像 vs 中国年度 CIF 校准双口径并列，绝不合并——贸易报告 §七.4 实测两口径存在系统性差异）+ stale 旗标（月度滞后如实，同 digest 纪律）。
> - /beef 或 /market/digest 增"对华贸易流"卡（分国别最新月：量、均价、环比）；若入 digest 则走公开白名单纪律（0 私有数据 + 每数字可溯源）。
> - **不进预测循环**：MarketFactor 严格保持分析面——贸易均价序列是否晋升 CommodityPrice 月度序列入 ADR-0001 循环，单列 D27（默认不做：镜像数据存在滞后修订，预测环对修订敏感；先攒 6 个月修订行为证据）。
>
> **批 5 — 观察项（外部条件触发，零开发等待）**
> - **中国大陆出口/代理节点出现** → 复活 china_customs_stats（端点重探，官方平台为交互式会话）；或先建人工 CSV 导入通道（beefImport 模式 ADMIN 端点）承接月度导出。
> - **Comtrade 免费注册 key**（comtradeplus.un.org，免费，配额档位待确认）→ 提额写入 .env，批 0 源自动受益（限速参数化即可）。
> - **乌拉圭 INAC 恢复** → inac 源复活（注册双处还原，index.ts 注释已留指引）。
> - **商业提单库**（Volza $1,500 起 / 环球慧思 ¥4-5万 / 腾道 ¥5-10万，均【转述】）——D26 预算决策，默认不做；若启动先用试用验证"中国进口方向"实际覆盖（中国提单不公开，商业库为镜像/第三方申报数据）。
>
> ### V8-五、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | **D23（批 0 附带）** | china_customs_stats 退役（移除注册，源文件保留） | 建议：**移除**——虚构端点+主机封锁零产出，每 24h 白付一次超时换 success+0 行（inac 先例）；AGENTS 计数（19 源）随批同步 | KNOWN-ISSUES D1；贸易报告 §4.1 |
> | **D24（批 1）** | 厂号注册表获取方式：人工 CSV 导入 vs 脚本化会话抓取 | 建议：**人工 CSV 起步**（ToS 稳、零风险）；脚本化待 ToS 复核后再议 | 贸易报告 §七.2 |
> | **D25（批 4）** | 贸易流展示面公开节奏：鉴权内先行 vs 直接公开 | 建议：**鉴权内先行**，数据攒满 1-2 个月且口径注记完备后随 digest 白名单公开（每数字可溯源纪律不变） | 贸易报告 §七.4 |
> | **D26（批 5）** | 商业提单库（¥1-40 万/年级预算） | 建议：**默认不做**——提单/企业级层非 PRODUCT-SPEC 当前范围；若用户判断需要，先 Volza 试用验证覆盖 | 贸易报告 §4.6 |
> | **D27（批 4 附带）** | 贸易均价是否晋升预测序列（CommodityPrice 月度入 ADR-0001 循环） | 建议：**暂不**——镜像数据有滞后修订，预测环对修订敏感；攒 6 个月修订行为证据后重评 | V8-四 批 4 |
>
> ### V8-六、不做清单（继承 + 本波新增）
>
> 继承全部既有红线（交易/支付/训练模型/爬付费墙转售，V7-五）。本波新增显式：**单一窗口脚本化登录抓取**（ToS 未验证前只走人工导出）；**.gov.cn / Cloudflare 源的硬闯**（维持 D1 网络结论）；**乌拉圭死站等待**（全球性下线，登记不排期）；**贸易数据进预测循环**（D27 未过门前 MarketFactor 严格保持分析面）；**商业库数据再分发**（用户协议限制，只能内用）。
>
> ### V8-七、用户侧解阻清单（本波新增项）
>
> 承 V7 六项（两把 key / CSV 周导入 / 域名 / SMTP）不变，新增：⑥ **单一窗口实名账号**（免费注册，解锁批 1 厂号注册表导出）；⑦ **data.gov 免费 API key**（解锁批 3 FAS GATS）；⑧（可选）**Comtrade 免费注册 key**（提额增益——批 0 免 key 已可用）。

> ## 第七波 v3.5.0（2026-08-31，round-149 规划；**同日修订——用户方向澄清：主线=国外牛肉进口/国际贸易**）— 调研驱动·进口主线：国际免费层补强 + 独占位强化 + 进口数据解阻清单
>
> **执行状态（2026-08-31，round-150，批 1+2+3 全部落地）**：用户指令"按照计划开始"。**批 1** `e59a751`——取证推翻原载体：MLA NLRS 90CL 页数据面为 **Power BI Embedded**（`getembedinfo` 返回 accessToken + app.powerbi.com embedUrl，无浏览器不可取，cron 摄取不可行→按计划降级登记）；改落**官方免费等价源 USDA AMS NW_LS421「Import Beef Trade」周报**（`www.ams.usda.gov/mnreports/ams_2823.pdf`，免 key、可达主机；mymarketnews/marsapi 两 USDA 主机实测 000 主机级封锁）承载同一序列语义：`beef_90cl_us` / weekly / AU-NZ Cow Meat 90% East Coast 0-15d 区间中值（USD/cwt），**口径注记随行**（世行月度 2024-01 起新西兰 90CL c.i.f.，措辞/拼接差异永不合并）。实现：PDF→`pdftotext -layout` 管道（poppler-utils，setup.sh 登记）→状态机解析（跨页 section/可选西岸列/坏区间丢弃）→全有或全无写入（版式漂移=0 行+warning）；weekly cadence 全链路打通（getPriceHistory 回退链 daily→weekly→monthly、batchLatestPrices cadence 循环、/trading 选择器非 daily 系列诚实隐藏）；**noChange 新契约**：周报日更重扫的确认无变化周期分类 success/healthy（否则周度源 6/7 天被误报 empty）。预测订阅硬门（daily / monthly-and-not-daily）结构上排除 weekly——ADR-0001 语义零扩张。live：boot runAll 写入 90CL 2026-08-28 342-354（close 348）、手动刷新幂等 0/0 unchanged、面板 healthy/direct、`/commodities` weekly+348、daily 请求回退供周行、匿名 /trading 307 不变。**批 2** `0b7f391`——90CL 入 `/tools/landing-cost` 白名单第四源（周度窗口 12 点 + "周度点"文案 + 单点诚实降级；live 348 USD/cwt→7.6721 USD/kg→51.56 CNY/kg）；landing Features 新增公开 Landing Cost Calculator 卡 + AI 卡挂 track-record 链接；about 方法论卡补"战绩公开"机制陈述（只述自身机制不点名竞对，D18）；digest 双链接核实已在（round-146）。**批 3** `1a99695`——报价规格维度载体：CSV 导入五个可选列（feedingMethod/feedingDays/vendorLabel(VL)/breed/storage）白名单键→`BeefCutPrice.metadata`（零迁移，列本就存在未用）；坏 feedingDays 跳行（宁缺勿错）；cut 详情表 Spec 列有则渲染无则 "--"；模板/导入页文档同步；数据面复活前仅载体不承诺展示。测试基线 backend **1072+1**（+18：解析 10+分类器 1+spec 纯函数 5+导入集成 2）、frontend **352**（+3）、inference 61 = **1485**（1464→+21，零回退）；三服务 PM2 重启后健康。**剩余：批 0a（时间门 2026-09 中下旬）/ 批 0b（样本门）未到；D20/D22 维持；用户侧解阻清单（两把 key/CSV 导入/域名/SMTP）不变。**
>
> **输入**：[RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md) v1.0.0（round-148，17 家供给全景 + §九九条启示，经独立复审）。**修订缘由**：初版把新发地（国产批发价）设为批 1 主战场；用户澄清项目主线是进口/国际贸易（PRODUCT-SPEC 定位句"进口/国产"进口在前、/beef 聚焦进口行情、landing-cost 即进口到岸工具）后，批次按进口轴线重排，新发地降级为观察项。规划与修订所引事实全部只读实测（探针/SQL 取证见各条）。
>
> ### V7-一、基线与进口数据健康图谱（2026-08-31 05:49-06:10 只读实测）
>
> 三服务在线（宿主机 ~05:20 重启后 PM2 自愈）、测试基线 **1464**（backend 1054+1 / frontend 349 / inference 61）、树干净 @ `e5a3e90`。页面 44、路由 18/端点 126、爬虫 18、推理模型 9；批 0a/0b 门控未到；用户侧（域名/SMTP/4 把空 key/CSV 导入）不变。`/ai/track-record` 已在 PUBLIC_PATHS。
>
> **进口侧序列健康图谱**（生产库 max(date) 实测）：
>
> | 腿 | 状态 | 最新点 | 阻塞根因 |
> |---|---|---|---|
> | CME 活牛/架子牛（yahoo 路径）、BRL/USD 汇率、IMF 牛肉月度基准、FRED 序列 | **活** | 2026-08-28 ~ 2026-07-01（月度正常滞后） | — |
> | **mla_nlrs 部位级**（1,440 行） | **冻结** | 2026-04-30 | MLA_API_KEY 空串（services API 需账户）——用户侧 |
> | **cepea_export 部位级**（960 行） | **冻结** | 2026-04-30 | CEPEA Cloudflare 拦截 + ToS 风险已登记（KNOWN-ISSUES） |
> | **usda_ams 出口锚序列**（beef_australia 180 行） | **冻结** | 2026-04-29 | USDA_MARS_API_KEY 空串——用户侧（报告实证 MARS 路径本身无恙） |
> | china_customs_stats 海关进口统计 | **零行**（源代码完整：HS 0201/0202/0206 × 六供应国 → MarketFactor） | — | **站点不可达实测**（stats.customs.gov.cn 000/0.06s，.gov.cn egress 封锁家族） |
>
> **结论**：进口主线最大数据缺口不在开发侧——部位级进口价全面冻结的解阻塞钥匙是两把 API key（用户侧）+ CSV 周导入 runbook（自持路径，已有）；开发侧唯一无需用户输入即可新增的进口价格序列是 **MLA 90CL**（免费公开页，可达性 200 实测）。
>
> ### V7-二、报告 §九 启示 → 行动映射（9 条逐条处置，按进口主线校准）
>
> | # | 启示 | 处置（修订后） |
> |---|---|---|
> | 1 | 新发地免费部位级日更源 | **D22 观察项（降级）**——国产批发价非进口主线；可选未来角色=进口利润空间对侧参照（国内批发价 vs 到岸成本 = 进口价差），默认不做。取证已完成备查：接口 200、牛肉行 `prodPcat='牛肉类'`（catid 1189/pcatid 1206）实证、"花牛"苹果反例肉眼可见、元/斤 |
> | 2 | USDA 网页入口改版、MARS 路径无恙 | 无开发动作（根因空 key 属用户侧——见 V7-一 阻塞清单） |
> | 3 | MLA 90CL 周度指标（免费） | **批 1（主批）**——唯一无需用户输入的进口到岸基准增量 |
> | 4 | 报价维度对齐行业词汇 | **批 3**（进口盘口词汇：厂号/谷饲/VL/IMPS 映射） |
> | 5 | watchlist 部位×厂号×国家订阅 | **D20 维持排后**（进口贸易商心智匹配，但数据面（部位级冻结）未复活前价值有限） |
> | 6 | 卓创 ¥588-1998/年价格带 | 证据登记（paywall 延后不变） |
> | 7 | 两空位印证 + landing-cost 独占 | **批 2**——landing-cost 上升为本波获客重心（进口到岸决策工具） |
> | 8 | PRA 转售/爬墙红线 | V7-五 不做清单 |
> | 9 | 海关 HS 月度进口量价 | **环境阻塞登记（激活批不成立）**——源代码完整、生产库零行、站点不可达（000/0.06s 实测）；待 CN 侧运行器/代理等环境变化，不排期 |
>
> ### V7-三、批次详情（修订后）
>
> **批 0a/0b 承接（不变）**：验证窗 2026-09 中下旬 / 样本门，处置流程同 V6。
>
> **批 1 — MLA 90CL 周度进口到岸基准接入（主批）**
> - 取证已完成：主页面 `mla.com.au/prices-markets/overseas-markets/us-imported-beef/` 200 可达（SSR HTML 无价格值），**数据面为 iframe `app.nlrsreports.mla.com.au/prices-markets/ninety-cl/`**——实现首步为该 NLRS 应用的数据接口探查（HTML 壳内的 XHR/JSON 端点）。
> - 落点：CommodityPrice 新序列（slug `beef_90cl_us`、interval `weekly`、source `mla_90cl`）——与 PBEEFUSDM 月度构成"周度现势 + 月度长史"；**口径注记强制**（世行序列口径三次切换史：2024-01 起新西兰 90CL c.i.f.；两序列并排处 provenance 注记）。
> - **与 landing-cost 联动（可选子项）**：90CL 落地后纳入 `/tools/landing-cost` 白名单活价基准（现三源：IMF/CME/USD-CNY → 增第四源，周度到岸参照），强化进口决策工具的数据纵深。
> - 边界：仅数据+展示；**不开周度预测**（mapeTracking 节奏感知仅 daily/monthly，ADR-0001 horizon=步长语义不扩）。取证失败（NLRS 应用数据路径不可程序化获取）则整批降级为登记。
>
> **批 2 — 独占位强化（进口获客导向）**
> - track-record：公开性已核实（PUBLIC_PATHS），补叙事位与交叉入口（landing/about"敢公开对错"机制陈述；digest→track-record 链接核实补齐）。文案只陈述自身机制与事实，不点名竞品（D18）。
> - landing-cost：报告 §八.7 样本内独占的公开进口到岸计算器 → landing/digest 增工具入口与决策场景文案（"汇率×期货×关税→到岸成本"）；与批 1 的 90CL 联动子项可并入本批执行。
>
> **批 3 — 报价规格维度前瞻（进口盘口词汇对齐）**
> - 牧集五维（饲养方式/天数/VL/品种/仓位）+ 惠农三维 + 国际源词汇（IMPS/cut-out/chemical lean，报告 §6.2 映射表）入 **BeefCutPrice 既有 `metadata Json` 列（零迁移，已核 schema）**；CSV 导入支持可选规格字段写入 metadata；展示层有则渲染无则不显。量级证明后再评估升列。
> - 该批为部位级数据复活（key 到位/CSV 恢复）后的承接准备——当前冻结状态下仅做载体与导入支持，不做展示承诺。
>
> ### V7-四、决策项（不擅动，需用户点头）
>
> - **D18 文案尺度**：只陈述自身机制不点名竞品。建议直接采用。
> - **D20 watchlist 部位×厂号粒度**：维持排后（数据面冻结未复活前价值有限）。
> - **D22 新发地源（本波新增，取代初版批 1）**：默认不做（国产批发价非进口主线）；若做，定位=进口利润空间对侧参照（进口价差可视化：新发地国内批发价 vs landing-cost 到岸成本）。取证已全部完成（接口结构/过滤字段/单位/反例），随时可启动。
> - **海关源**：登记环境阻塞（不可达实测），无需决策——环境变化（CN 侧运行器/代理）自动重开。
> - 初版 D17（新发地落点）/D19（规格维度载体）随修订收敛：D17 并入 D22；D19 已定为 metadata 先行（批 3 内含）。
>
> ### V7-五、不做清单（继承 + 本波新增）
>
> 继承全部既有红线（PRODUCT-SPEC §九：不做支付/下单/交易撮合；只用预训练模型）。本波新增显式：**买 PRA 数据转售 / 爬任何付费墙**（报告 §7.4/§9.8——对华 CFR/港口盘口无法合规免费获得，"国际免费源+诚实标注"是唯一自持路径）；**周度预测节奏**（ADR-0001 语义不扩）；**竞品点名文案**；**五端分发**（web-only 维持）；**新发地默认不做**（D22，非进口主线）。
>
> ### V7-六、门控、用户侧与解阻清单（不变 + 显式化）
>
> 批 0a/0b 门控不变。**进口主线解阻清单**（本波显式化，钥匙均不在开发侧）：① `MLA_API_KEY`（解锁 mla_nlrs 部位级 1,440 行续流）② `USDA_MARS_API_KEY`（解锁 usda_ams 出口锚序列）③ CEPEA（Cloudflare+ToS，环境/合规双阻塞，维持登记）④ beef CSV 周导入（唯一自持部位级解锁路径，runbook：docs/guides/WEEKLY-DATA-IMPORT.md）⑤ 域名/SMTP/其余 key 不变。执行顺序：**批 1（NLRS 数据接口取证起步）→ 批 2 → 批 3**；每批门禁：tsc + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。

> ## 第六波 v3.4.0（2026-08-31，round-145 规划）— 功能设计缺陷收敛：诚实化 IA、预测粒度对齐、触达补全
>
> **执行状态（2026-08-31，批 1+2+3 全部落地，round-146）**：用户指令"按照规划和你自己的决策进行后续的开发"（D14/D15/D16 按各建议案放行）。**批 1** `b72bff9`——模型可信度 **7 入口→2**（删 /ai、/ai/models、/ai/backtest、/dashboard/models 四页，308→/ai/accuracy；后端 API 全保留；[modelId] 详情本就含 backtest 窗口；导航/面包屑/快捷入口重指向）+ **顶栏全局搜索兑现**（`GET /api/search` 鉴权三源白名单〔部位四语/商品/已发布资讯〕每源封顶 5，GlobalSearch 组件 300ms 防抖 + 分组下拉 + "暂不可用"与"无匹配"两种诚实降级）+ 国产筛选诚实禁用（无 CN 行时 disabled+title，空态文案保留为纵深防御）。**批 2** `e64222b`——`?factoryCode=` 钉住单厂预测（evaluateFactoryForCut 抽取，同门控：≥2 真实点+新鲜度；未知厂 404；工厂作用域理由；响应回显 factoryCode）+ region 查询维度（/prices 与 /prices/latest，与 country AND 组合）+ CutForecastSection 工厂选择器（auto=代表厂）。**批 3** `e06c2d2`——`GET /api/alerts/channels-status`（email/slack 可用性+可行动理由；rules 页警示横幅——静默降级可见化）+ 反馈通道（公开仓库 github.com/Zouksw/MT 匿名 200 实证；MarketingFooter Feedback 链接 + digest 页脚〔置于数据加载分支外——数据坏时才最需要反馈，且入 SSR HTML〕）。**审计修正两处**（诚实性同样适用于自己的分析）：V6-二.1 表述过重——/beef 渲染层本就有国产专属空态文案（round-145 只查了过滤逻辑未查渲染）；V6-二.6 "页面不展示 region" 不实——factories 卡片本就渲染 region（查询维度缺失属实）。测试基线 backend **1054+1**（101 文件，+13 全为新测）、frontend **345**（40 套件，+4）、inference 61 不变 = **1460**；页面 48→44、路由 17→18/端点 124→126。live：四路 308、匿名搜索 401、牛舌→TONGUE 中文匹配、region=NSW 全 AU-847、钉住 AU-847 如实拒绝冻结数据（latest 2026-04-30）、channels-status email=false+SMTP 理由、digest SSR 含反馈链接。**剩余：批 0a（时间门 2026-09 中下旬）/ 批 0b（样本门）；打磨项登记：/trading ?slug= 深链（商品搜索结果现落选择器）。**
>
> **执行状态（2026-08-31 深夜，round-147 收尾轮）**：用户指令"继续完成后续剩余的任务"。① round-143 遗留 watch item **track-snapshot cron 首跑提前闭环**——07:30 触发前以同一 wrapper 手动实跑全链（快照生成→限定 pathspec 提交 `a924898`，树干净），并以当日 healthcheck 04:35/cleanup 03:00 两任务实证 cron 守护进程健康、极简 PATH（cron 等价环境）下 `npx tsx` 可解析（`/usr/bin/npx` + backend 本地 `.bin/tsx`）；观察记录：快照文件名取 **UTC 日期**（`toISOString`），本地周一 07:30 CST = UTC 周日 23:30，文件名带周日日期——与文件内 Generated UTC 时间戳自洽、git 保留历史，不改（外科边界）。② **批 0a 前置检查**（只读 SQL）：最新牛肉月度点 **2026-07-01**（八月点未发布）；21 行月度预测全部锚定 2026-07-31，最早到期 H=1=2026-08-31（当日）但验证需八月实值（FRED 惯例 ~09 月中旬发布）→ **零 verified 属正确状态，无过期未验证行，生命周期无缺陷**，值守窗 2026-09 中下旬维持。③ **打磨项落地** `2adf1b3`——/trading `?slug=` 深链：`useTradingData(initialSlug)` 初始选中（压过首商品自动选择）+ 未知 slug 诚实回退默认商品（避免永久 "Loading..."）；页面 `useSearchParams`（Suspense 包裹，/trading 转 server-rendered-on-demand）+ 同路由 slug 变化同步效应（GlobalSearch 在 /trading 页内触发不重挂载；手动选择永不被覆写）；GlobalSearch 商品项与 Enter 首跳目标带 `?slug=`。门禁：tsc/biome/jest **40 套件 349**（345→+4）/build/PM2 重启/live（匿名 /trading 与 /trading?slug= 均 307 登录门不变、三服务健康、部署 chunk 含深链字面量；本环境无浏览器后端，行为由组件测试覆盖——如实记录）。**剩余不变：批 0a/0b 门控未到；用户侧待办（域名/SMTP/keys/CSV 导入）不变。**
>
> ### V6-一、基线（2026-08-31 只读实测）
>
> 三服务在线、测试基线 **1443**（backend 1041+1 / frontend 341 / inference 61）、树干净 @ `0065918`。页面 48、路由 17/端点 124；用户 **3（全 seed）**；牛肉价 2,401 行冻结于 2026-04-30（5 厂 16 部位，AU/BR）；6 国 21 注册厂（AR3/AU6/BR5/CN1/US4/UY2）但 **CN 价格行=0**；批 0a/0b 门控未到；域名/SMTP/4 把 API key 仍待用户输入。第五波（分发期）批 1-3 + round-144 补课全落地。
>
> ### V6-二、功能设计缺陷分析（全部 live/代码实证，2026-08-31）
>
> **A. 数据-承诺断层（最重，产品诚实性层面）**
> 1. **"国产牛肉"入口空转**：PRODUCT-SPEC §四 IA 承诺 进口/国产分视图；`/beef` 页 originFilter（domestic= factory.country==="CN"）在 CN 行=0 的现实下**永远返回空列表**——呈现一个不可能有结果的筛选，违反"诚实缺席"原则（对比：forecastable:false 带理由的先例）。国产数据唯一活通道是 CSV 手动导入（china 源地域封锁维持结论）。
> 2. **hero 能力与数据面断层**：digest 公开页只展示 5 宏观/期货/汇率序列（诚实降级），而产品的核心差异化（部位级 AI 预测）因 beef_cut_prices 冻结全部 forecastable:false——分发期拉来的用户看到的第一屏与 hero 能力无关。这是 D1 的产品面后果，非新问题，但**波 6 内所有公开面改动都必须在此约束下设计**（不造数据、不预支承诺）。
>
> **B. IA 冗余（导航债，非代码债）**
> 3. **"模型可信度"主题 7 入口**：`/ai`（纯导航枢纽,8 链接）、`/ai/accuracy`、`/ai/accuracy/[modelId]`、`/ai/models`（accuracy/coverage/trend）、`/ai/backtest`（"Compare model predictions against actual outcomes"）、`/dashboard/models`（"Model Comparison ... MAPE"）、`/ai/track-record`（公开）。同一主题六种切片、三处 MAPE 对比近似重复——用户面对 7 个入口无法建立"去哪看模型可信度"的心智。收敛方向：**track-record=公开承诺面（不动）+ accuracy=鉴权内唯一可信度页（吸收 [modelId] 详情）**，其余并入或重定向。
> 4. **顶栏全局搜索占位**：spec §四 承诺"顶栏: 搜索(商品/部位)"；`AppShell.tsx:163` 实现为标注 "PLANNED, not yet wired" 的徽章——一个长期挂在顶栏的未实现承诺。
>
> **C. 预测粒度不对称**
> 5. **代表性工厂预测**：`/api/beef/forecasts/:cutCode` 内部 `findForecastableFactoryForCut` 只选"数据最多最新"的**一家厂**做代表（响应带 factoryId 说明）；而 `/spreads`（厂间价差）与 cuts 详情页 by-factory 对比线已证明厂间价差是真实分析维度。价差按厂、预测不按厂——粒度不对称，用户无法回答"这家厂的_STRIPLOIN_会怎么走"。
> 6. **region 维度未暴露**：`Factory.region` 有真实数据（NSW/QLD/SA/Santa Fe/Córdoba…）但 API 无 region 查询参数、factories 页只按国家分组不展示 region——"场地"区分只到国家层（round-144 评估时已发现）。
>
> **D. 触达/运营断层**
> 7. **告警邮件通道死配置**：`notificationChannels.getEmailTransport` 无 SMTP 时返回 null（warn 每进程一次，round-142 已降噪），alert 规则的 email 渠道**静默降级为不发送**——用户设了规则、以为会收到邮件、实际只有站内通知，且 UI 无任何告知。
> 8. **SEO 基建空转**：sitemap/robots/OG 仍输出 localhost（`NEXT_PUBLIC_APP_URL` 占位守卫，round-142）——域名是前置（用户输入，承 V5-九）。
> 9. **无反馈通道**：3 个 seed 用户、about/landing/digest 无任何联系方式或反馈入口——产品在零用户信号下迭代，与分发期目标矛盾。
>
> ### V6-三、批次总览
>
> | 批 | 主题 | 内容 | 门控 |
> |---|---|---|---|
> | 批 1 | 诚实化 IA 收敛 | 国产筛选空态治理 + 模型页 7→2 收敛 + 顶栏搜索占位处置 + /ai 枢纽处置 | D14/D15 放行即做 |
> | 批 2 | 预测粒度对齐 | forecasts?factoryCode= 参数（默认代表厂兼容）+ cuts 详情 by-factory 组挂预测 + region 查询维度/展示 | 无门，批 1 后 |
> | 批 3 | 触达补全 | 告警渠道状态透明化（"仅站内"标注）+ 公开页反馈通道（mailto，不做表单后端） | 无门，可并行 |
> | 批 0a/0b | 承 V5 原文 | FRED 8 月点三查三面 / 校准共识区间 | 时间门 2026-09 中下旬 / 样本门 |
>
> ### V6-四、批次明细
>
> 1. **批 1（诚实化 IA 收敛，前端为主 + 路由重定向）**：① `/beef` originFilter 动态化——无 CN 行时国产筛选禁用并显示"暂无国产数据源（国产通道：管理员 CSV 导入）"空态说明（诚实缺席先例：forecastable:false+reason）；② 模型页收敛（依 D14 方案）：/ai/track-record 保持公开承诺面；/ai/accuracy 成唯一鉴权内可信度页（吸收 [modelId] 详情、models 页的 coverage/trend 独有价值、backtest 的时间窗对比价值），/ai/models、/ai/backtest、/dashboard/models 重定向并入，导航与 sitemap 同步；③ 顶栏搜索（依 D15）：实现最小跨搜（部位+商品+资讯，后端一个 /api/search 白名单端点）或撤除占位徽章；④ /ai 纯枢纽页并入侧栏后删除或降级。
> 2. **批 2（预测粒度对齐，后端为主）**：① `GET /api/beef/forecasts/:cutCode?factoryCode=`——指定厂则对该厂序列出预测（同样过 ≥2 真实点+新鲜度门，不过门 forecastable:false+reason），不指定维持代表厂行为（向后兼容，batch 端点同步评估）；② cuts 详情页 by-factory 分组线旁挂该厂预测入口；③ `/api/beef/prices?region=` 查询维度 + factories 页按 country 分组下展示 region（数据已在库）。
> 3. **批 3（触达补全，小批）**：① 告警设置/规则页渠道状态透明化——后端暴露 email 渠道可用性（SMTP 未配→"仅站内通知"标签，不静默）；② landing/digest/about 页脚加反馈 mailto（静态链接，不做表单/后端存储——无基数不做空壳）。
>
> ### V6-五、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | **D14（批 1）** | 模型可信度页收敛方案 | 建议：accuracy 吸收合并 + 其余 301 重定向（保 SEO 与旧链）；/ai 枢纽页删除（侧栏已导航） | V6-二.3 |
> | **D15（批 1）** | 顶栏全局搜索：实现 or 撤占位 | 建议：**实现最小版**（部位+商品+资讯三源、白名单端点、≤3 跳转结果）——分发期获客页与站内找数断层的最短补法；若用户判断无搜索需求则撤徽章 | V6-二.4；spec §四 |
> | **D16（批 1 附带）** | 国产数据路线：CSV 运营节奏 / 等源解冻 / 暂下架国产入口 | 建议：保留入口但空态诚实化（批 1 ①），运营节奏随用户安排 | V6-二.1 |
>
> ### V6-六、有机日历（承 V5-六，零开发）
>
> 2026-09 中 FRED 8 月点发布 → 批 0a 三查三面；digest 5 序列随 CME/汇率自动更新；模型页收敛后 sitemap 联动刷新；2026-10-31 H=3 首批到期。
>
> ### V6-七、本波明确不做
>
> 交易/支付/订单（§九 不变）；虚构分析师观点或周报文案（只做可溯源真数据）；邮件订阅/分发（无订阅者基数，空壳不做）；原生 App；对 .gov.cn/Cloudflare 源上反爬采集（维持网络出口与 ToS 结论）；国产数据不造合成行（等真实通道）。

> ## 第五波 v3.3.0（2026-08-30，round-141 规划）— 分发期：公开面、SEO 基建、卫生收尾
>
> **执行状态（2026-08-31 凌晨，批 1+2+3 全部落地，round-142）**：用户指令"根据计划开始执行"（D10/D11/D12 按各建议案放行）。**批 1** `3988648`——公开端点 `GET /api/market/public/digest`（固定白名单 5 序列：IMF 牛肉基准 / CME 活牛·架子牛 / USD/CNY / BRL；节奏感知涨跌——daily 较上期+近 7 天、**monthly 仅环比不造周窗**；stale 旗标 + seriesId 溯源 + 逐条诚实降级；白名单相等性测试=隐私契约）+ 公开页 `/market/digest`（中文序列卡片 + 互链 landing-cost / track-record + "无分析师观点"声明）+ **SEO 基建**（app/sitemap.ts 仅 6 条可索引公开路由、robots.ts 负面清单、6 页逐页 metadata layout、root metadataBase）——执行中发现并根治两处占位符进产物：`.env.production` 的 `NEXT_PUBLIC_APP_URL` 仍为 `your-domain.com`（round-107 同款陷阱，site-url.ts 守卫视同未设置，**真实域名仍待用户配置后重建生效**）、root layout 硬编码 `og:url mt.ai` 改单一来源。**批 2** `8e94a9a`——seed `beef_carcass_us` 身份对齐生产（§十七 兑现）：COMMODITIES 元数据（name/nameCn/USC/lb/fred+PBEEFUSDM）+ 月度合成分支（6 个月起点、source fred，替代 180 日行）+ baseline 260→330；mt_test --force 重建后**与生产逐字段一致**；tools.test beforeAll unit hack 移除。**批 3** `465570f`——round-106 存活项 8 项收口：/api/docs 加 authenticate（D12）、authRateLimiter 拆分（login 10/15min 保留，refresh/change-password 30/15min——NAT 场景不再被登录尝试锁死）、lastDirections 显式 bounded(512)+重启语义注释、SMTP warn 每进程一次、monthRange 月初 clamp（Jan 31 曾整月跳过 2 月，+3 回归钉）、verifyTokenSession count 化（+顺修 mock 队列串位）、topCuts cutCode 决胜平价、importDataset rowsCount 改真实计数；**Python lifespan 可选项本轮缓办**（零行为变化，维持登记）。测试基线 backend **1036+1**（99 文件，+5 全为新测）、frontend **341**（39 套件，+3）、inference 61 不变；**首跑 flake 复现一次**（批 1 首跑 ×3，已登记冷缓存机制；后续四次全量全绿）。live：digest 匿名 200（beef 331.78 环比 -2.87% 与 FRED 一致、活牛 211.73 周变 -5.08% 与 landing-cost 手验一致；usd_cny/brl 如实 stale）、digest 页匿名 200（zh title/desc/canonical/OG 全落）、sitemap/robots 无占位符、/api/docs 匿名 401、/dashboard 仍 307。AGENTS/API.md 同步（页面 47→48、端点 123→124、补记 highlights 遗漏行）。**剩余：批 0a（时间门 2026-09 中下旬）/ 批 0b（样本门）**。**后续补课（2026-08-31 round-144，用户指令"解决当前项目存在的问题"）**：本波缓办四项全部处置——批 A `b6a2882`（/spreads 币种分组 + D13 BEEF_CHEEK + vitest 排除项 + 陈旧注释；backend 1041+1）、批 B `7e87a98`（lifespan 迁移）；metrics 提权定案不提（详见 TECH-DEBT round-106 组批注）。
>
> **指令来源**：用户"分析项目后续的开发方向，规划方案"。
> **性质**：v3.1.0 七批 + v3.2.0 四批（round-135~140）已把**预测机制侧**的未决工程项清空（质量加权共识、per-series 冠军路由、方向准确率、conformal 区间、节奏感知验证环、9 模型注册表、18 slugs 权威源声明全部 live）；证据轨进入有机成熟期（首批 beef verified 等 FRED 8 月点，值守窗 2026-09 中下旬）。**当前最大缺口已从"机制"移到"分发"**：0 真实用户、公开面仅 8 路由、SEO 基建缺位。本波三件事：**① 公开中文行情摘要面 + SEO 基建**（v3.0.0 批 B 升格——竞品深探 §8.5-4 判定的"真数据自动摘要"应法，零人力、只真数据）；**② 测试保真**（seed 身份漂移 TECH-DEBT §十七 兑现——mt_test 与生产对牛肉基准序列的元数据/节奏漂移已迫使测试写 beforeAll hack）；**③ 低优先正确性/加固收尾**（round-106 清单存活项打包，本轮逐项 live 复核在位）。证据轨批 0a/0b 承接 V4，门控不变。
> **约束不变**：只用预训练模型不训练（§七.2）；不做支付/下单/交易（§九）；诚实优先——不为 SEO 写人力研报式内容、不虚构"分析师洞察"、公开面只白名单真数据。
>
> ### V5-一、现状基线（2026-08-30 深夜实测，round-141 取证）
>
> | 维度 | 事实 | 证据 |
> |------|------|------|
> | 测试基线 | backend **1029 pass + 1 skip**（99 文件）、frontend **338**、inference **61**（round-140 同日基线；D2/D3 删功能的 −13/−5 已文档注明为随组删非回退） | round-140 门禁记录 |
> | 服务 | PM2 三进程在线、三探活 200；git 树干净 @ `7766230` | 本轮 `pm2 jlist` + curl 实测（23:45） |
> | 牛肉验证窗 | monthly completed：H=1×7 / H=3×7 / H=10×7（另 7 条 NULL-interval stale）；**H=1 到期 2026-08-31 00:00、verified=0**——实际值等 FRED 8 月月度点（~9 月中发布）属正常等待，非故障；首批 verified 预计 **2026-09 中下旬** | 本轮 psql（beef_carcass_us × interval/horizon/status 分组 + MIN 到期） |
> | 公开面 | PUBLIC_PATHS **8 路由**（/ /landing /login /register /about /pricing /ai/track-record /tools/landing-cost）；**app 无 sitemap.ts/robots.ts，全 app 仅 2 处 metadata 导出**——SEO 基建缺位 | 本轮 `middleware.ts:4` + app 目录 grep |
> | 用户 | **3 个 seed 用户、0 真实注册**（round-119 清完 1796 测试残留后回归三人组）；分发是当前最大缺口 | 本轮 psql `count(users)` |
> | 生产数据 | beef_cut_prices **2401 行冻结 2026-04-30（4 个月）**；宏观活水正常（IMF 牛肉月度 331.78 @2026-07-01、CME 活牛/架子牛日更、FX 族）；prediction_logs 197,922 行 / verified 35,064 | 本轮 psql + highlights 端点 |
> | 方向准确率 | chronos 三变体 **62.0-63.2%**（18 slugs 声明后覆盖扩至 2682 判定行、诚实回落）、holtwinters 33.8%（分化弱点）、naive flat "—" | round-139 批 2 live 验收（2026-08-30） |
>
> ### V5-二、方向分析（五轨研判）
>
> 1. **机制轨——已收官**：v3.1.0 + v3.2.0 十一波次后，预测机制侧无未决工程项；领先指标方向经双臂门禁诚实关闭（重评 2028-11）；sarimax 维持 0 行是纪律正确。**本波不造新机制**——任何"再调一调模型"的冲动都撞 §十.4 守护基线与 D6 门禁纪律。
> 2. **证据轨——有机成熟，零开发**：批 0a 值守窗（2026-09 中下旬）→ 批 0b 校准区间（样本门：首批 live verified）→ H=3（2026-10-31）→ per-series 权重激活评估（~2026-11，MIN_SERIES_VERIFIED_TO_ACTIVATE=20）→ 快照 cron 每周一 07:30 自动留档。工程侧只欠批 0b 一项且被样本门正确拦住。
> 3. **分发轨——当前最大缺口，本波主战场**：信任资产（track-record/accuracy/预测中心）与获客工具（landing-cost）已建成，但**没有面向搜索引擎的公开内容面**。竞品深探 §8.5-4 的判定：牧集 = 人力研报 + 长尾 SEO；MT 的诚实应法 = **真数据自动摘要 + 公开预测对错档案**——后者已建，前者即批 1（v3.0.0 批 B 两次升格未排期，本波排期）。
> 4. **数据轨——等待用户输入，工程侧就绪**：beef_cut_prices CSV 周更 runbook + `/beef/import` 端到端就绪（冻结已 4 个月）；4 个空 API key；批 C 贸易词汇五维数据解冻即接（维持登记）。本波不动数据轨（无新工程动作可做）。
> 5. **债务轨——残尾打包**：十轮清偿（round-112~140）后剩三类——(a) round-106 低优先正确性/加固清单存活项（本轮 live 抽查确认在位：swagger 无鉴权、authRateLimiter 三路由共用、lastDirections 内存 Map、SMTP warn 每调用、monthRange setMonth、verifyTokenSession findMany 等）；(b) seed 身份漂移（§十七，直接影响 mt_test/CI 保真度）；(c) 结构性登记项（TD-6 胖路由、TD-8 剩 ~29 GET 裸 fetch、TD-12 tailwind 三源、R3 ghost 行——维持不排期）。本波只清 (a)(b)。
>
> **结论**：第五波 = **分发期**。主战场公开面 + SEO（批 1），辅以测试保真（批 2）与正确性收尾（批 3），证据轨按门值守（批 0a/0b 承接）。
>
> ### V5-三、批次总览
>
> | 批 | 内容 | 价值 | 规模 | 门控 |
> |----|------|------|------|------|
> | **1（P0）** | 公开中文行情摘要页 + 公开 digest 端点 + SEO 基建（批 B 二次升格） | 零人力获客面——真数据吃长尾流量 | M | D10 点头 |
> | **2** | seed 身份对齐（beef_carcass_us → IMF 月度口径，§十七 兑现） | mt_test/CI 保真——消除测试 beforeAll hack | S | D11 点头 |
> | **3** | 正确性/加固收尾包（round-106 存活项） | 残尾债务清偿 | S-M | 逐项可独立验收 |
> | **0a（承 V4）** | 验证窗值守（首批牛肉 verified 落地核查） | 证据链兑现或缺陷早暴露 | XS | 时间（2026-09 中下旬） |
> | **0b（承 V4）** | 校准共识区间（回测残差为主 + live 交叉核对） | 共识卡"校准 90% 区间" | S-M | 首批 live verified（批 0a 后） |
>
> **顺序**：批 1 → 批 2 → 批 3（后两批可换序/穿插）；批 0a/0b 到门即做。门禁沿用：tsc + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。
>
> ### V5-四、批次详情
>
> **批 1 — 公开中文行情摘要面 + SEO 基建（M，v3.0.0 批 B 升格；前置 D10）**
> 竞品打法分化的直接落地（COMPETITIVE-ANALYSIS §8.5-4）：牧集靠人力研报吃长尾，MT 用**真数据自动摘要**吃长尾——每个数字可溯源到库内序列，零人力、不虚构"分析师洞察"。
> - **1a SEO 基建**：`app/sitemap.ts`（真实路由枚举、公开面优先，登录后页面不入图）+ `app/robots.ts`（允许公开路径、拦 /api 与私有页）+ 公开页中文 metadata（title/description，逐页不复制粘贴）。现状：无 sitemap/robots、全 app 仅 2 处 metadata 导出（V5-一 公开面行）。
> - **1b 公开端点**：`GET /api/market/public/digest`——白名单活序列的中文摘要载荷（IMF 牛肉基准 MoM、CME 活牛/架子牛 WoW、USD/CNY、BRL/USD：现价 + 变动 + 日期 + 新鲜度旗标 + 近 30 点）。**不复用 highlights 端点**（其形状已被 Hero 等钉住），新端点独立 cacheRoute 300 + 全局限流 + 无任何用户私有数据（白名单纪律同 highlights/track-record）。
> - **1c 公开页 `/market/digest`（中文）**：今日牛肉国际行情——序列卡片（现价/涨跌/日期/stale 旗标）+ "本周变化" 段（WoW/MoM 聚合，即"周报"的页面自聚合形态——**不做邮件分发**，无订阅者基数）+ 互链（/tools/landing-cost 进口成本、/ai/track-record 预测对错档案）；middleware PUBLIC_PATHS +1。
> - 验收：未登录可见且 curl 200；每个展示数字可对应库内序列（手工核对一组）；序列断流显示"数据源维护中"不硬编码兜价；sitemap/robots live 可取且不含私有路由；digest 端点 0 私有字段（单测断言 where/白名单）。
>
> **批 2 — seed 身份对齐（S，§十七 兑现；前置 D11）**
> `prisma/seed.ts:1865` 的 beef_carcass_us 仍是 round-126 之前的身份（"US Beef Carcass Price (FRED)" / USD/cwt / `base:260, volatility:8` 日度合成 180 行），而生产自 round-126 起该序列实为 **IMF 全球牛肉月度基准（PBEEFUSDM，USC/lb，月度）**。影响：mt_test / CI 全新种子库与生产漂移，landing-cost 路由测试被迫 beforeAll 临时改 unit + 未来日期 fixture 压制合成行。
> 内容：seed COMMODITIES 元数据对齐生产（名称/单位/seriesId/interval=monthly）+ 合成价改月度节律（点距 30 天、值域贴 331.78 附近 USC/lb 量级，或最小化合成行数）+ 复核依赖该 slug 的既有断言（tools/highlights/freshness 测试）+ 移除 landing-cost 测试的 beforeAll hack。
> 验收：`bootstrap-test-db.sh --force` 后 mt_test 该序列 metadata == 生产口径（psql 对照）；landing-cost 测试无临时改写；backend 全量绿（数不回退）。
>
> **批 3 — 正确性/加固收尾包（S-M，round-106 清单存活项；本轮 2026-08-30 逐项 live 复核在位）**
> 按价值排序的小项打包，每项独立可验收（行为测试或 live 验证），一轮多 commit：
> 1. `/api/docs` Swagger 无鉴权（`app.ts:215`）→ 加 authenticate（等级见 D12）——公开暴露全端点面是当前最大残余暴露。
> 2. `authRateLimiter`（10/15min/IP）被 login+refresh+change-password 三路由共用（`auth.ts:217/345/514`）→ NAT 环境误锁；拆分或提额。
> 3. `alertNotifications.ts:29` lastDirections 内存 Map（重启即失 + 无界增长）→ 方向戳持久化到 Alert 行 metadata（或显式 bounded + 注释）。
> 4. `notificationChannels.ts:61` "SMTP not configured" 每次调用打 warn → 只打一次。
> 5. `helpers.ts:319` monthRange 31 日 setMonth 跳月（两 caller 现传月初，latent）→ clamp 到月初。
> 6. `authService` verifyTokenSession findMany 全量 session → count。
> 7. 小项：topCuts 次级 orderBy（并列价 nondeterministic）、datasetService 0 行导入 rowsCount 覆盖非累加、biome 存量 10 条 judgment-call 警告逐条定夺。
> 8. 可选（Python 侧）：~~inference `@app.on_event` 已弃用 → lifespan 迁移~~（**已执行 round-144 `7e87a98`**，批 3 缓办项于"解决当前项目存在的问题"轮补上：lifespan 化 + pytest 61 绿 + live chronos 3/3 预加载）。
> ~~明确缓办（数据冻结期 latent，维持登记）：/spreads 混币种分组、beef cheek → OFFAL 死别名（taxonomy 决策 D13）、metrics GET 提权。~~（**round-144 三项全部处置**：/spreads 币种进分组键 `b6a2882`；D13 闭（规范 BEEF_CHEEK + 两库 taxonomy + 守护测试）；metrics 定案维持 authenticate（聚合运维指标无用户级数据、唯一消费者是全体登录用户的 performance 页、提权需引入零先例的前端 role-gate——负收益，留档 TECH-DEBT）。）
>
> **批 0a / 批 0b（承 V4-三 原文，门控不变）**
> 批 0a：2026-09 中下旬值守窗——① SQL 三查（status=verified 行数 / MAPE 分布 / 方向判定进入）；② 三面核查（/ai/accuracy、/ai/track-record、/beef/forecast 出现牛肉数字）；③ 未验证则读 verifyDuePredictions 日志定位（发布滞后登记等待=诚实；生命周期缺陷修复=单批 commit）；④ 快照 cron 自动留档。批 0b：校准源用 **v3.1.0 批 1 牛肉月度滚动回测残差**（36 origins × 7 模型 × H=1/3，样本充分）为主 + live verified 交叉核对（首批 7 行起），不达标维持"模型分歧区间"现标注、不显示任何未校准"90%"字样。
>
> ### V5-五、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | **D10（新，批 1）** | 公开摘要页排期与范围 | 建议：**做**——页 + 端点 + SEO 基建一次成；"周报"以页面自聚合"本周变化"段起步，邮件分发不做（无订阅者基数，避免空壳） | V5-二 分发轨；§8.5-4；v3.0.0 批 B 两次升格未排期 |
> | **D11（新，批 2）** | seed 身份对齐（改 seed 影响 mt_test/CI 全新种子库） | 建议：**做**——测试保真度问题，生产零影响（seed 不触生产库，users>0 安全门在） | TECH-DEBT §十七 |
> | **D12（新，批 3）** | /api/docs 鉴权等级 | 建议：`authenticate`（登录即可）——swagger 是开发/集成面，ADMIN 过重；备选直接摘除路由（若判定无人用） | round-106 登记 + 本轮复核在位 |
> | D13（缓，批 3 附带） | beef cheek → OFFAL 死别名 taxonomy（加 CHEEK 码或删别名） | ~~建议：数据解冻前维持登记~~ **已执行 round-144**：加规范 BEEF_CHEEK（Offal primal，四语元数据）+ 别名重指 + mt_db/mt_test taxonomy 幂等 upsert + 死别名结构守护测试（ALIASES 全量值必须解析到规范码） | round-106 登记；round-144 `b6a2882` |
> | 承 V4 | D8/D9 已执行完毕（18 slugs 声明 / 快照 cron 自动提交）；D1-D4 已于 round-139 续3 + round-140 全部处置 | — | V4-四 |
>
> ### V5-六、有机观察项（零开发，日历驱动）
>
> - **2026-08-31 00:00**：牛肉月度 H=1 首批 7 行到期（verified=0 属正常等待——实际值等 FRED 8 月点，非故障）。
> - **每周一 07:30**：track-record 快照 cron 自动留档（批 1 之后每份 verified 进档）。
> - **2026-09 中**：FRED 月度 8 月点发布（M+1 惯例）→ 30min 刷新的新点守卫触发新月度预测轮。
> - **2026-09 中下旬**：首批 beef verified 落地 → 批 0a 值守窗（SQL 三查 + 三面核查）。
> - **2026-10-31**：H=3 首批到期（季度视界证据）。
> - **2026-10/11**：三条新蛋白序列（beef_retail_us / pork_world / poultry_world）首批验证成熟。
> - **~2026-11**：per-series 权重激活评估点（beef 月均 +7×2 verified 行，180d 窗攒满 20 行；届时对照后端日志确认激活）。
> - **2028-11**：活牛 × IMF 重叠 ≥ ~40 个月，领先指标主假设重评。
>
> ### V5-七、已登记不排期（研究门 / 外部阻塞 / 结构性）
>
> - **relational conformal**（联合区间）：研究门——待批 0b 单变量校准落地后评估必要性。
> - **change-point 区间加宽**：待批 0b 评估覆盖表现后决定。
> - **LLM event-flag 实验**（market_news → 事件标志外生变量）：**外部阻塞——无 LLM API key**；用户提供后按门禁制单列实验。
> - sarimax 维持暂缓（连续两次门禁阴性）；chronos-2 测过未采（维持）。
> - TD-6 胖路由（beef.ts ~790 行 / mapeTracking ~1027 行，反向问题未碰）；TD-8 剩 ~29 处 GET 裸 fetch（低优先，逐站点评估）；TD-12 tailwind 三源并存（等 v4 迁移产品决策）；R3 ghost 行（sundial/timer_xl ~332 行）保留不删（D7 定案）。
> - 批 C 贸易词汇五维：数据解冻（KNOWN-ISSUES D1）即接上，设计登记未落地。
>
> ### V5-八、不做清单（红线重申 + 本波新增）
>
> - 继承 v3.1.0 V3-五 + v3.2.0 V4-七 全部（训练/微调、未过门禁接入、放宽验证窗造 verified 数、未校准区间标"90%"）。
> - **新增（分发纪律）**：不为 SEO 写人力研报式内容、不虚构"分析师洞察"——公开摘要面只做**真数据自动摘要**，每个数字可溯源；公开端点只白名单宏观/牛肉序列，0 用户私有数据（沿 highlights/track-record 纪律）；不因获客目标做邮件订阅/推送（无订阅者基数，不造空壳）。
>
> ### V5-九、用户侧外部输入（非工程，不变 + 一项新增）
>
> 4 个空 API key（MLA / USDA_MARS / OPENWEATHER / FAO——beef_cut_prices 冻结 2026-04-30 已 4 个月，CSV 周更 runbook 就绪 `docs/guides/WEEKLY-DATA-IMPORT.md`）；种子用户 3→10 访谈；CI 部署 secrets（DEPLOY_*，见 AUTOMATION-STATUS §一）；（可选）LLM API key——若希望开启 event-flag 方向。**（批 1 新增）真实站点域名**：`.env.production` 的 `NEXT_PUBLIC_APP_URL` 仍为 `your-domain.com` 占位符——批 1 的 site-url 守卫已使占位符视同未设置（sitemap/robots/OG 暂以 localhost 出产物，不误导爬虫）；用户提供真实域名写入该变量并重建后，全部绝对 SEO URL 自动切真。

> ## 第四波 v3.2.0（2026-08-30，round-139 规划）— 证据成熟期：值守、解锁、第二产品落点
>
> **指令来源**：用户"维护项目状态，规划后续的开发计划"。
> **性质**：v3.1.0 七批（0/1/2/3/4/5/6）已全部落地——预测**机制**侧已无未决工程项（领先指标方向已经双臂门禁诚实关闭）。本波不造新机制，而是三件事：**① 让有机证据节律自动化**（快照 cron 接线、验证窗值守）；**② 解锁被数据形态锁住的既有能力**（多源 provenance 声明 → 方向统计覆盖 FX 族）；**③ 产品面第二落点**（进口成本计算器，v3.0.0 批 A 升格）。全部批次带明确门控（时间门 / 用户决策门 / 样本量门），杜绝"为做而做"。
> **约束不变**：只用预训练模型不训练（§七.2）；不做支付/下单/交易（§九）；诚实优先——样本不足不显示、未校准不冒充。
>
> **执行状态（2026-08-30 晚，批 1 + 批 3 已落地，批 2① 取证完毕，round-139 续）**：批 1 `ee36c41`（crontab 5→6 条：`cron-track-snapshot.sh` 周一 07:30 驱动只读导出器 + **路径限定自动提交**〔D9 推荐案：pathspec 只提交 docs/snapshots 快照、index.lock 存在跳过〕；实跑自动提交 `1cee1c1` 且新脚本自身未被卷入——守卫生效）· 批 3 `b209de2`（**进口成本计算器**：公开 `GET /api/tools/landing-cost` + 公开页 `/tools/landing-cost` + forecast 互链；活输入仅白名单基准价〔IMF USC/lb 月度 + CME 活牛/架子牛 USD/cwt 日更〕与 USD/CNY 且全部带日期/新鲜度旗标，**税率运费为用户假设、平台不内置各国税率**；公式 关税×CIF基数 → 增值税×(基数+关税) → 损耗完税后乘算；区间=同公式跑近窗最低↔最高；backend +15 / frontend +4 测试；live 匿名双面 200、活牛 211.73 USD/cwt → 带参 ¥45.96/kg 逐项手验、400 门实测）。**批 2① D8 取证**：真混源组实测 **17 个**（FX 日度族 aud_usd〔fred 13945 vs api 68，同量纲〕/usd_cny + 10 个月度孪生〔fred vs world_bank 同一 FRED 序列〕+ crude_oil_cme〔fred 10231 vs cme 2〕+ live_cattle_cme〔**唯一真权衡组**：usda_ams 128 行冻结 2026-04-29 vs cme 2026-05-18 起日更，现状混读=3.5 月断档拼接〕）；排除代价 live 实证 **每 chronos 变体 410 行方向判定被守卫排除**。声明清单待 D8 点头（建议已入 V4-四）。测试基线 backend **1037+1**（100 文件）、frontend **338**（38 套件）、inference **66**，零回退。
>
> **执行状态（2026-08-30 深夜，批 2 已落地，round-139 续2）**：D8 由用户目标指令"完成后续的开发任务"放行、按 V4-四 建案执行（live_cattle_cme → cme 新鲜度优先）。声明 `authoritativeSources.ts` 3→**18 条**（11 个月度孪生〔执行时实测为 11 非 10，多出 natural_gas_us〕+ aud_usd/usd_cny/crude_oil_cme → fred + live_cattle_cme → cme）；两源行数/量纲对比表留档 KNOWN-ISSUES R2。**执行中发现并同批根治 scale-guard 误杀**：守卫中位基线不分源 → fred→brl_usd 正确 ~5.1 写入被 api 0.19 行主导的中位拒绝、权威序列冻结 08-14；改按写入源自身基线后 live 实证回填 5 个交易日（7930→7935 行）。**live 验收**：chronos 方向判定 2268→2682（+414=排除行数恰等）、统计模型 +12、`[DIRECTION] excluded` 日志归零、aud_usd 样本现身公开 track-record、landing-cost USD/CNY 切 fred（08-21，stale 旗标如实）；**对 D8 原表述修正**：FX 时效代价实测为 H.10 周发布节律（约 1 周，非"−1 天"），缺 actuals 走重试不丢覆盖。配套：seed 已声明 slug 源标签 + 清除 round-114 遗留 `prisma.organizations` 死引用（mt_test --force 重播撞出）+ methodology 口径两处同步（publicTrackRecord / 周快照）。backend **1042+1**（+5），frontend/inference 零改动。
>
> **执行状态（2026-08-30 深夜，批 4 部分落地——D1+D4 执行、D2/D3 维持登记，round-139 续3）**：用户目标指令"完成后续的开发任务"同源放行；按各决策项建议案执行其中非破坏性两项。**D1** PRODUCT-SPEC 增补：§七 能力表 +3 行（进口到岸成本测算 ✅ 已上线、多源数据治理 ✅ 18 slugs 声明、批 C 贸易词汇五维 ◐ 设计登记未落地）+ M3 清单补记（计算器上线 ✅、批 B 周报候选方向未排期）。**D4** `predictionBeefCoverage24h`→`predictionBeefCoverage90d`（窗口 24h→90d：月度一轮 + 60d 验证冻结）+ 新增 `predictionBeefLatestAt`（末轮日志时间戳）；health 路由类型/赋值、cron-healthcheck 暴露行、回归钉（30 天前 beef 日志必计入）同改；live 验收 /health/ready = coverage90d 3 + latestAt 2026-08-30T06:09。**D2/D3 维持登记**（TECH-DEBT round-132 条目：休眠表删除属数据治理决定需用户明示；portfolios/predict-batch 维持登记为 D6 建议不动）——破坏性删除项不随通用目标放行，待用户逐项点头。backend **1042+1**（dataHealth 套件 9→10，换 1 加 1 净 0）。
>
> **执行状态（2026-08-30 深夜，批 4 收官——D2+D3 由用户"继续剩余事项"指令逐项放行，round-140）**：**D2** `03fd1c7` 休眠表处置——定向备份 `backups/round140-d2/dormant-tables.sql`（生产行数 forecasts/forecasting_models 0、security_audit_logs 49）→ 迁移 DROP 三表 + ModelAlgorithm 枚举（生产/mt_test 双应用、live 复核空表）；seed 整段摘除（模型/预测点播种、安全审计夹具、MODEL_DEFS、汇总行）+ `getUserProfile` 去 models 计数。**D3** 删 `/api/portfolios` 路由组（7 端点 + 13 测试）**连同 Portfolio/GroupMember 两表**（0 行 0 前端消费，迁移 20260830220000，同备份文件）；删 `/api/inference/predict/batch` 与推理服务 `POST /predict/batch` 两端及 batch 测试（backend 1042+1→**1029+1**〔−13 随组删，非覆盖回退，round-132 同例〕、pytest 66→**61**〔−5 随端点删〕；Python 有限值守卫保留——单预测同依赖）；live 验收 404×3（backend 两处 + Python）+ /predict 200 + 三服务在线。schema 模型 30→**25**、路由 18→**17**（AGENTS/API.md 同步；API.md 补记批 3 遗漏的 /api/tools 节）。门禁：tsc×2 / biome×2 / ruff / 双 build / 三服务重启；**首跑 flake 复现并定位**——--force 重建 mt_test 后 Redis 预测缓存全空，首个全量并行跑中两个最重推理测试（beef forecasts / wheat_cme signals）冷启动超 30s，隔离与复跑均绿（round-136 已登记同类）。**v3.2.0 至此仅剩批 0a/0b 两项时间门/样本门承接项，已纳入第五波 v3.3.0（V5-四）继续值守。**
>
> ### V4-一、现状基线（2026-08-30 实测，round-139 取证）
>
> | 维度 | 事实 | 证据 |
> |------|------|------|
> | 测试基线 | backend **1022 pass + 1 skip**（98 文件）、frontend **334**（37 套件）、inference **66** —— 三套全量复跑零回退 | 本轮 `pnpm test` / `pytest -q` 实跑 |
> | 服务 | PM2 三进程在线；backend /health、inference /health、frontend / 全 200；git 树干净 @ `eba0402` | `pm2 list` + curl 实测（round-139） |
> | 牛肉验证窗 | interval=monthly completed：H=1×7 / H=3×7 / H=10×7（另 7 条 NULL-interval stale）；**下一验证到期 2026-08-31 00:00**（forecast_start 2026-07-31 + H=1 月）；实际值等 2026-08 月度点（FRED 惯例 M+1 月中发布）→ 首批 verified 预计 **2026-09 中下旬** | psql GROUP BY + `MIN(forecast_start_at + make_interval(months=>horizon))` |
> | 方向准确率 | live 30d 窗：chronos 三变体 68.7–70.4%（各 ~2170 判定行）、holtwinters 33.8%（分化弱点）、naive 恒 flat "—"；beef 0 行待 9 月 | `/api/signals/models/accuracy`（round-137 终值） |
> | 多源 provenance | **15 个 slug 被 ≥2 源写入，仅 3 个已声明**（brl_usd→fred、corn_cme→usda_ams、natural_gas_cme→fred）；12 个未声明中 aud_usd（fred@00:00 + exchange_rate_api@16:00 同日双写）被方向守卫整组排除 | psql `HAVING COUNT(DISTINCT source)>1`；`authoritativeSources.ts` |
> | 快照自动化 | `backend/scripts/weekly-track-snapshot.ts` 已建成（首产物 2026-08-30 入库），**crontab 5 条中无它** —— 未自动化 | `crontab -l` |
> | 领先指标 | 方向已关闭：臂 A/臂 B 双 FAIL + 主假设数据不可行（重评 2028-11）；sarimax 维持 0 行（纪律正确） | `docs/backtests/beef-leading-indicator-2026-08.md` |
>
> ### V4-二、批次总览
>
> | 批 | 内容 | 价值 | 规模 | 门控 |
> |----|------|------|------|------|
> | **1（P0）** | 周度快照 cron 接线 + 提交策略（D9） | 证据节律自动化——9 月起每份 verified 自动留档 | XS | 无 |
> | **2（P0）** | 多源 provenance 声明补全（D8）→ 方向统计解锁 | 方向指标覆盖 FX 族；训练/验证取数一致 | S | D8 用户点头 |
> | **3** | 进口成本计算器 `/tools/landing-cost`（v3.0.0 批 A 升格） | 牧集结构性做不了的差异化工具（获客面） | M | 无 |
> | **0a** | 验证窗值守（首批牛肉 verified 落地核查） | 证据链兑现或缺陷早暴露 | XS | 时间（2026-09 中下旬） |
> | **0b** | 校准共识区间（批 5 诚实推迟项兑现） | 共识卡"模型分歧区间"→"校准 90% 区间" | S-M | 首批 live verified 落地（批 0a 后） |
> | **4** | 工程卫生决策项处置（D1-D4 承接） | 债务清偿 + 口径收口 | S-M | 用户逐项点头 |
>
> **顺序**：批 1 → 批 2（D8 定案即做）→ 批 3 →【时间门】批 0a → 批 0b →【决策门】批 4（任意时点插入）。门禁沿用：tsc + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。
>
> ### V4-三、批次详情
>
> **批 1 — 周度快照自动化（XS）**
> cron 增一条（建议 `30 7 * * 1` 周一 07:30）：`cd /root/backend && npx tsx scripts/weekly-track-snapshot.ts`。**提交策略（D9）**：建议脚本产出后自动 `git -C /root add docs/snapshots/track-record-*.md && git commit`（仅该路径、固定 message；index.lock 存在时跳过留待下周）——保持"树干净"运维不变量，避免快照堆积未提交；备选仅写盘、由维护轮收编。验收：crontab +1 条并实跑一轮产出产物 + 自动 commit；AUTOMATION-STATUS §二 同步；脚本只读 DB、只写 snapshots 目录（既有契约不变）。
>
> **批 2 — 多源 provenance 声明补全（S，D8 前置）**
> 现状：未声明多源 slug 的（同 interval）混源组被方向守卫整组排除（aud_usd 为 FX 代表——fred 与 exchange_rate_api 同日双写、价差 ≈ 日波动，anchor 无法判定）。内容：① 执行时先按 (slug × interval) 分组 SQL 核实**真混源**清单（fred+world_bank 多为日度/月度不同 interval 天然分道，不需声明）；② 对真混源逐个声明权威源（aud_usd 建议 → fred：官方 30 年长序列、方向正确、与 brl_usd 先例一致；代价是 currentPrice 时效降约 1 天——D8 一并确认）；③ `authoritativeSources` 契约测试 + track-record methodology provenance 条目同步。验收：声明后 `getModelDirectionStats` 的 ambiguousRows 相应下降、/ai/accuracy 出现 aud_usd 方向数字；每个声明的两源行数/量纲对比表留档（防声明引入量纲错）。**注意**：声明即改变该序列训练/MAPE actuals 取数源——brl_usd 先例（round-41）证明利大于弊，但每个新声明都要单独过量纲核查。
>
> **批 3 — 进口成本计算器（M，v3.0.0 批 A 升格）**
> `/tools/landing-cost`：出口国（AU/BR/AR/US/UY…）× 库内活序列（活牛/胴体现货基准 + FX 汇率）× 可编辑参数（关税/增值税/运费/损耗/港杂）→ **RMB/kg 到岸参考区间**。纯信息计算不碰 §九红线；输入全部可溯源到库内序列，序列 stale 时诚实降级（显示"数据源维护中"，不硬编码兜价）。建议公开 + 全局限流（与 highlights 同款白名单纪律——只读白名单序列，不含用户私有数据）。验收：对活牛现价实算一组数字与手算一致；断流降级态有测试；未登录可用（若定公开）。规模：新页 + 1 只读计算端点（逻辑后端化以便测试）+ hook + 测试。
>
> **批 0a — 验证窗值守（XS，时间门 2026-09 中下旬）**
> 2026-08-31 H=1 到期、8 月月度点 ~9 月中发布后的值守清单：① SQL 三查（status=verified 行数 / MAPE 分布 / 方向判定进入）；② 三面核查（/ai/accuracy、/ai/track-record、/beef/forecast 出现牛肉数字）；③ 若到期未验证——读 verifyDuePredictions 日志定位：发布滞后则登记等待（诚实），生命周期缺陷则修复（单批 commit）；④ 批 1 之后快照自动留档。验收：要么首批 verified 可见，要么缺陷修复后可见；阴阳结论均记 CHANGELOG。
>
> **批 0b — 校准共识区间（S-M，样本门：首批 live verified 落地）**
> 批 5 诚实推迟项的兑现路径：校准源用**批 1 回测残差**（36 origins × 7 模型 × H=1/3，样本充分）为主，**live verified 行做交叉核对**（首批 7 行起，偏差大则回退显示并登记）；卡片注明校准依据与样本量。change-point 区间加宽等改进在此之后评估（见 V4-六）。验收：/beef/forecast 共识卡显示"校准 90% 区间（回测校准 + live 交叉核对 N 行）"；样本门与回退态有测试；不达标不显示（维持"模型分歧区间"现标注）。
>
> **批 4 — 工程卫生决策项处置（S-M，用户逐项点头）**
> D1：PRODUCT-SPEC 增补（批 3 落地则顺带写入 landing-cost；批 B/C 数据层能力登记）。D2：休眠表（SecurityAuditLog/ForecastingModel/Forecast）一次性迁移删除 + 先备份。D3：portfolios 路由组 + `/api/inference/predict/batch` 孤儿（维持登记或删除）。D4：`predictionBeefCoverage24h` 口径修正（"beef 覆盖不限 24h + 最新预测时间戳"）。全部为 v3.0.0 以来登记未决项，逐项确认后一次打包轮执行。
>
> ### V4-四、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | **D8（新，批 2）** | 真混源 slug 的权威源声明清单（17 组，round-139 续 SQL 实测：FX 日度 aud_usd/usd_cny〔fred 30 年史 1.1-1.4 万行 vs api 68 行，同量纲〕、10 个月度孪生〔fred 415-432 行 vs world_bank 4 行，同一 FRED 序列——声明 fred 零风险〕、crude_oil_cme〔fred 10231 vs cme 2〕、live_cattle_cme〔唯一真权衡：usda_ams 128 行冻结 2026-04-29 @177-199 vs cme 2026-05-18 起日更 @211-247，现状混读=3.5 月断档拼接〕） | 建议：月度孪生 + FX + crude_oil_cme → **fred**（10+2+1 组，官方长序列、其中孪生本就是同一序列）；live_cattle_cme → **cme**（新鲜度优先，日更累积中；usda_ams 冻结 4 个月）。代价：FX currentPrice 时效约 −1 天。声明即解锁方向统计（现每 chronos 变体 410 行被排除） | V4-一 多源行；round-137 批 4c 登记；round-139 续 取证 |
> | **D9（新，批 1）** | 周度快照提交策略 | 建议：脚本自动 commit（仅 docs/snapshots/track-record-*.md 路径，index.lock 冲突跳过）——保树干净不变量；备选仅写盘 | V4-一 快照行 |
> | D1-D4（承 v3.0.0/v3.1.0） | PRODUCT-SPEC 增补 / 休眠表清理 / portfolios+predict-batch / predictionBeefCoverage24h 口径 | 见批 4 | round-134 |
>
> ### V4-五、有机观察项（零开发，日历驱动）
>
> - **2026-08-31**：牛肉月度 H=1 首批 7 行到期（实际值未发布属正常等待，非故障）。
> - **2026-09 中**：FRED 月度 8 月点发布（M+1 惯例）→ 30min 刷新的新点守卫触发新月度预测轮。
> - **2026-09 中下旬**：首批 beef verified 落地 → MAPE + 方向命中自动进 /ai/accuracy 榜单与快照（批 0a 值守）。
> - **2026-10-31**：H=3 首批到期（季度视界证据）。
> - **~2026-11**：per-series 权重激活评估点（beef 月均 +7×2 verified 行，180d 窗攒满 20 行约在 11 月；届时对照后端日志确认激活）。
> - **2026-10/11**：三条新蛋白序列（beef_retail_us / pork_world / poultry_world）首批验证成熟。
> - **2028-11**：活牛 × IMF 重叠 ≥ ~40 个月，领先指标主假设重评（批 3 登记）。
>
> ### V4-六、已登记不排期（研究门 / 外部阻塞）
>
> - **relational conformal**（联合区间）：研究门——待批 0b 单变量校准落地后评估必要性。
> - **change-point 区间加宽**：待批 0b 评估其覆盖表现后决定。
> - **LLM event-flag 实验**（market_news → 事件标志外生变量）：**外部阻塞——无 LLM API key**；用户提供后按门禁制单列实验（与批 3 领先指标同款纪律）。
> - sarimax 维持暂缓（连续两次门禁阴性）；chronos-2 测过未采（维持）。
>
> ### V4-七、不做清单（红线重申 + 本波新增）
>
> - 继承 v3.1.0 V3-五 全部（训练/微调、未过门禁接入、放宽验证窗造 verified 数）。
> - **新增**：不为凑校准样本放宽任何验证参数（批 0b 只用已自然成熟的证据 + 回测残差）；校准落地前不显示任何"90%"字样的未校准区间；无权威声明的混源序列不进方向聚合（维持批 4 守卫，直到 D8 声明）。
>
> ### V4-八、用户侧外部输入（非工程，不变 + 一项可选新增）
>
> 4 个空 API key（MLA / USDA_MARS / OPENWEATHER / FAO——beef_cut_prices 冻结 2026-04-30 已 4 个月，CSV 周更 runbook 就绪 `docs/guides/WEEKLY-DATA-IMPORT.md`）；种子用户 3→10 访谈；CI 部署 secrets（DEPLOY_*，见 AUTOMATION-STATUS §一）；**（可选新增）LLM API key**——若希望开启 V4-六 的 event-flag 方向。

> ## 第三波 v3.1.0（2026-08-30，round-135 规划）— AI 预测牛肉价格·核心专轮
>
> **执行状态（2026-08-30 下午，批 0 + 批 1 前置 + 批 1 已落地，round-136）**：0b 未到期守卫 `a8a893f`（三清扫共享 `monthlyActionableMs` 定义 + restore 自愈子句，月度套件 6→9）· 0c horizon [1,3] `314d134`（`cadence.forecastHorizons` 政策缝 + 订阅 horizons 数组化 + **去重键加 horizon 维度**——旧 (commodity, model) 键会吞掉同训练态的第二个 horizon）· 0a/0d 一次性恢复 `0635c92`（实测 **42 行**误杀恢复 completed：6 序列 × 7 各恢复；7 条 NULL 遗留行标 stale；备份 `backups/round136/` 39M dump）· 批 1 前置（推理确定性）`760f825`（chronos 每请求 payload 派生 torch 种子，live 验证两次相同请求逐位一致；pytest 64→66）· **批 1 牛肉月度滚动回测已执行**（`docs/backtests/beef-monthly-2026-08.md`，36 origins × H=1/3 × 7 模型，两次 3-origin 对照 md5 一致；公开页 `/ai/track-record` 牛肉专段已上线 live 验证。**两问答案**：① chronos 淘汰结论在牛肉 H=1 不成立〔中位 1.61-2.08% vs naive 1.69% 同带〕、H=3 成立〔3.28-3.91% vs 2.71%〕→ 批 2 冷启动证据；② 可预测上限就在 naive 附近〔最优 arima 仅好 14%/3%〕，M6 教训形态一致；arima 为牛肉月度冷启动冠军；chronos 原生区间欠覆盖 58-78%）。**计划数字修正**：缺口 1 的"56 条"实测为 **49**（42 月度 + 7 NULL，审计后部分行状态已变）。D5 按建议执行（horizon [1,3] + 遗留行 stale，用户 round-136 "开始按照计划实施"授权）。测试基线 backend **1008 pass + 1 skip**（两连全绿；首跑 1 例 flake 见 CHANGELOG round-136 登记）、frontend **327**、inference **66**。
>
> **执行状态（2026-08-30 晚，批 2 已落地，round-137）**：2a `a4fac8b`（`resolveModelWeights` 第三参 seriesId + 激活阈值 `MIN_SERIES_VERIFIED_TO_ACTIVATE=20`（序列 verified 总行数）+ 权重机械提取 `computeWeightsFromAccuracies` 全局/序列逐字共享——序列本地淘汰使全局弱模型在其强序列复活投票权；单测 17→20 含计划验收用例）· 2b `9a9cf00`（`cadence.accuracyWindowDays`：daily 30d / monthly 180d 证据密度缩放；`generateForecast` 传 seriesId + 节奏窗；`getAllModelAccuracy` 64 键有界 60s per-series 缓存吸收 /signals/batch 扇出）。**live 验收（真实数据，beef 差异诚实降级）**：beef 0 verified 行 → 回退全局逐项一致，激活预计 **2026-11**（首批月度证据 2026-09/10 成熟后 180d 窗攒满 20 行）；验收场景由 live_cattle_cme（747 行/30d，chronos 三模型 14.8% 复活投票、arima 11.1% 最弱）与 aud_usd（7082 行，仅剩 naive+exponential_smoothing 50/50）坐实，PM2 日志实证 live 路由走新逻辑。批 1 回测仅作文档证据未硬编码。测试基线 backend **1011+1 首跑全绿**（+3 新单测，零回退）；frontend/inference 零改动未重跑。
>
> **执行状态（2026-08-30 晚，批 4 已落地，round-137 续）**：4a `715fa82`（读侧方向聚合——`directionVerdict` 纯函数 + `getModelDirectionStats`，`directionHitRate/Count` 流经两 API，零迁移；+10 测试）· 4b `af23766`（两页 Direction 列 + methodology 口径条目，naive 显式 "— (flat)"；frontend 327→330）· 4c `64cf0ad`（**三次实测纠偏**：公共步配对〔CME 周末跳空 actuals 短于步数〕、anchor 取 forecastStartAt 的 UTC 日界〔16:00/00:00 盖章混用会把 anchor 抓成 actual[0]，chronos 一度虚高 82-90%〕、无 forecastStartAt 行排除〔predictedAt 回退 anchor 落窗内，crude 遗留行实测 12.9%〕+ 混源无权威声明序列整组排除〔aud_usd 现状，登记为数据决策候选〕）。**live 终值**：chronos 68-70%（~2170 行）、holtwinters 33.8%（弱点分化）、arima 58.9%、naive "—"；beef 待 2026-09/10 首批成熟。backend **1021+1 全绿**、frontend **330**。
>
> **执行状态（2026-08-30 晚，批 5 已落地，round-138）**：`7ba03cc`（新页 `/beef/forecast`：下月共识卡〔calibrated 区间诚实推迟至 2026-09 证据成熟——回测已证原生区间欠覆盖 58-78%，不显未校准数字〕+ 回测证据面板 + 验证时间线〔2026-09/10、2026-11 到期预告〕+ 活牛/架子牛上游面板 + /beef 导航入口；dashboard hero 改挂牛肉月度共识，新 hook `useBeefMonthlyConsensus` 为页/卡唯一数据源——一致由构造保证）· `61a149d`（周度快照脚本 + 牛肉专段 + 首份产物 `docs/snapshots/track-record-2026-08-30.md`——v3.0.0 "track-record 周度快照物料" 原仅有规划，本轮补齐）。live：未登录 307→/login ✓；共识端点 flat/−0.28%/331.78→331.78/区间 327.31–332.54/57%/3-7。frontend **334**（+4）；backend 源零改动（1021+1 沿用）。
>
> **执行状态（2026-08-30 晚，批 3 已落地，round-138 续）**：`b778429` 双臂门禁实验执行完毕，**两臂均未过门禁——领先指标方向诚实关闭**。臂 A sarimax lagged-exog 四组 FAIL（rel 0.963–1.005）；臂 B chronos-2 协变量四组 FAIL（rel 0.955–1.317，brl H=3 劣化 +32%）；主假设（活牛期货）数据不可行（10 个月重叠，重评 2028-11）。sarimax 维持暂缓、chronos-2 测过未采（D6 例外条款履行）。报告 `docs/backtests/beef-leading-indicator-2026-08.md`。至此 v3.1.0 **执行顺序内的六批（0/1/2/4/5/3）全部落地，仅剩批 6（FRED 免 key 序列扩充）未执行**。测试基线：backend **1021+1**、frontend **334**、inference **66**，零回退。
>
> **执行状态（2026-08-30 晚，批 6 已落地，round-138 终）**：`51b8853` 三条免 key FRED 月度序列接入 `FRED_MONTHLY`（beef_retail_us 零售牛肉 $/lb + pork_world/poultry_world 替代蛋白指数；**先实测探针后接线**——6 候选 3 存活，均到 2026-07）+ 一次性 10 年回填（各 ~124 点）+ 契约测试（含指数量纲例外）。boot 订阅实证 **9 条月度序列**（6+3）进 ADR-0001 循环。**v3.1.0 七批全部执行完毕**（0/1/2/3/4/5/6）。测试基线：backend **1022+1**、frontend **334**、inference **66**，零回退。AGENTS.md 页面计数 45→46。
>
> **指令来源**：用户"结合当前项目最核心的功能，利用 AI 大模型预测牛肉价格的变化，制定后续的开发计划"。
> **依据**：引擎与生产库 2026-08-30 实测（见 V3-一）+ [PREDICTION-STRATEGY](PREDICTION-STRATEGY.md)（含本轮补写的失效标注——其 §五 实验序列实为比特币错标数据）+ [COMPETITIVE-ANALYSIS §八](COMPETITIVE-ANALYSIS-MOOKET.md)。
> **核心论断**：预测**机制**已经成熟（质量加权共识 + 劣于-naive 淘汰制 + split-conformal 区间 + cadence 感知验证环，全部 live），当前缺口是**证据、序列适配、产品面**三件事——牛肉预测此刻拿不出一条可展示的验证证据（被误杀 + horizon 过长）；模型质量权重是全局的而非按序列的；方向准确率（采购择时真正要的指标）没有度量。
> **约束不变**：只用预训练模型不训练（AGENTS §七.2）；统计拟合/推理时校准 ≠ 训练，全部手段兼容。
>
> ### V3-一、现状基线（2026-08-30 实测）
>
> | 维度 | 事实 | 证据 |
> |------|------|------|
> | 引擎产出 | 9 模型 alive；近 7d：naive 7582 / ES 7581 / HW 7581 / arima 7571 / chronos ×3 各 7299 行；**sarimax 0 行**（门禁暂缓维持） | psql GROUP BY model_id |
> | 共识机制 | `resolveModelWeights` **按模型全局加权**（无序列维度）+ 淘汰制 + conformal 区间（α=0.1）live | modelQuality.ts；PREDICTION-STRATEGY §五 |
> | 牛肉数据面 | IMF 月度基准 195 点（2010-05→2026-07，331.78 USC/lb）+ CME 活牛/架子牛日更（各 2287 行/7d）；**日更牛肉序列仍为 0** | psql；KNOWN-ISSUES D1/D4 |
> | **缺口 1（P0）** | **56 条月度预测全部被误标 `unverifiable`**（6 序列 × 7 模型 + 牛肉 08-23 遗留 7 条）：六序列最新点均 2026-07-01、**08-30 当天点龄满 60d**——旧 60d 窗口代码在 01:44/07:44 清扫中恰巧撞线冻结全部月度行；90d 修复 12:39 才部署（晚数小时）；restore 因"窗口感知"正确地不救窗口未开的行 → 暴露语义洞：**未到期 ≠ 不可验证** | psql 按状态计数；backend 日志 11:54 "Marked 15109 frozen" |
> | **缺口 2** | 月度预测 horizon=10（继承 daily 默认）→ 按 ADR-0001 ① horizon 单位=步长，即 **10 个月**，首批牛肉月度验证要到 **2027-05** 才可能到期——证据链被推迟近一年 | prediction_logs：interval='monthly' + horizon=10，forecast_start_at 2026-07-31 |
> | **缺口 3** | 牛肉序列上 7 条 08-23 遗留行（interval=NULL + horizon=6）：6b 月度语义之前生成，按 daily 语义永不可验证，污染牛肉历史 | psql |
> | 方法论坑 | PRED-STRATEGY §五 的 aud 联动/sarimax 回测跑在比特币数据上——牛肉外生变量结论须重做 | 该文档 08-30 失效标注 |
>
> ### V3-二、批次总览
>
> | 批 | 内容 | 价值 | 规模 | 依赖 |
> |----|------|------|------|------|
> | **0（P0）** | 月度验证生命周期修复三件套（误杀修复 + 未到期守卫 + horizon 校准） | 牛肉证据链解锁 | ~0.5 天 | 无 |
> | **1** | 牛肉月度滚动回测（rolling-origin，195 点全史） | 把"机制存在"变成"证据存在"；回答 chronos 在牛肉上该不该淘汰 | ~1 天 | 无 |
> | **2** | 冠军路由（per-series 模型质量权重） | 牛肉序列用自己的最优模型，不被 FX 池拖累 | ~1 天 | 批 1 可作冷启动证据 |
> | **3** | 领先指标实验（lagged exog：活牛期货/汇率 → 月度牛肉），门禁制 | 唯一可能超越单变量上限的路（sarimax 接线前置） | ~0.5-1 天 | 批 1 框架复用 |
> | **4** | 方向准确率指标（验证环 + 展示） | 采购择时的真指标；预测公信力第二支柱 | ~0.5 天 | 无 |
> | **5** | 牛肉预测中心页 + hero 接线 + 周度快照 | 核心功能的用户可见面 | ~1 天 | 批 1 证据面板 |
> | **6** | 免 key 牛肉/牲畜序列扩充（FRED 盘点） | 牛肉预测面 1 → 3-4 条 | ~0.5 天 | 无 |
> | 并行轨 | v3.0.0 竞争驱动批次（成本计算器/公开摘要/词汇五维）保留，见 V3-六 | 差异化与获客 | — | 与本波无依赖 |
>
> **顺序**：批 0 → 1 → 2 → 4 → 5 → 3 → 6（批 0 是一切的前提；批 3 依赖批 1 的回测框架且自身有门禁）。
>
> ### V3-三、批次详情
>
> **批 0 — 月度验证生命周期修复（P0，今日实测的三缺口）**
> - **0a 误杀修复**：一次性脚本（复用 `verify-monthly-lifecycle.ts` 受控验收模式）：`interval='monthly'` 且到期时刻（anchor+horizon 月+宽限）> now 的 `unverifiable` 行标回 `completed`；先 SELECT 计数核对（预期 42）再 UPDATE；操作前 `pg_dump` 相关表。验收：修复后 6 序列各 7 条 `completed`，下一 30min 周期无重复生成（new-point 守卫已验证工作）。
> - **0b 未到期守卫**：`markUnverifiablePredictions`/`markLaggingFrozenPredictions`/`expireWindowElapsedPredictions` 三清扫对月度行统一加前置判定——**到期时刻未过一律跳过**（冻结判定只对已到期行生效）。+回归测试：构造未到期月度行 + 冻结源 → 不被标。这是"未到期 ≠ 不可验证"语义的代码化。
> - **0c horizon 校准**：调度器对月度订阅改用 **horizons [1, 3]**（下月 + 下季度，产品可读；daily 默认 10 不变）→ 牛肉验证证据 **2026-09/11 起滚动成熟**，而非 2027-05。现有 horizon=10 行保留（长视界亦有价值，到期自然验证）。**决策确认见 D5**。
> - **0d 遗留行处置**：牛肉序列 7 条 NULL-interval 行（08-23、horizon=6）标 `stale`（错配时代产物，保留历史不删除——同 R2 污染行先例）。并入 D5 确认。
>
> **批 1 — 牛肉月度滚动回测（证据，不是等待）**
> **前置（规范 6，PREDICTION-STRATEGY §6.2）**：推理确定性——引擎 `predict_quantiles` 当前未固定采样种子（chronos 采样路径非确定性，round-135 读码发现），回测前先在 inference 引擎加 torch 种子固定（或提升采样数取中位），否则回测数字不可复现。
> `scripts/backtest-monthly-series.ts`：对 IMF 牛肉基准 195 点做 rolling-origin 回测——~36 个月度 origin × H=1/H=3 × 7 模型逐点推理（**纯推理零训练**），产出 per-model：MAPE 均值/中位、**方向命中率**、conformal 区间实际覆盖率。产物 `docs/backtests/beef-monthly-2026-08.md` + 数字进 `/ai/track-record` 牛肉专段。**这一步直接回答两个悬案**：① chronos 在长月度牛肉序列上是否真劣于 naive（当前淘汰结论来自 FX/CME 日更池，对牛肉不公也不准）；② 月度宏观序列的可预测上限在哪（若全员≈naive，诚实结论就是"统计基线即最优"，品牌叙事转向"可验证"——这本身就是答案，不是失败）。验收：回测可复跑（seed 固定后逐位一致）、与 `verify-monthly-lifecycle` 同源的取数口径、公开页出现牛肉专段。
>
> **批 2 — 冠军路由（序列 × 模型，补 modelQuality 的序列维度）**
> `resolveModelWeights` 现为全局 per-model。新增 per-series 滚动准确率（30d 窗，verified 行按序列分组，≥N 条才启用，不足回退全局权重——与等权兜底同模式）；共识生成单序列信号时优先用该序列自己的权重集/冠军模型集。批 1 回测结果作为牛肉序列的冷启动证据。验收：单测构造"模型 X 全局弱、序列 A 强"→ A 的共识用 X；live `/api/signals/forecast?commodity=beef_carcass_us` 与全局权重对照可观察差异。
>
> **批 3 — 领先指标实验（lagged exog，门禁制，双臂：sarimax + chronos-2 协变量）**
> 经济假设：CME 活牛期货**领先** IMF 现货牛肉基准（期货价格发现），汇率滞后项次之。**双臂设计（round-135 检索新增，PREDICTION-STRATEGY §7.1）**：臂 A = sarimax lagged-exog（统计路线，`experiments/` 既有参数化先例）；臂 B = **chronos-2 协变量零样本**（Amazon 2025-10 发布，120M encoder，原生支持 past/future covariates——同家族升级，接入成本低，CPU 可跑，且完全符合预训练约束）。两臂同一 rolling 门禁（与 PRED-STRATEGY §五 相同，**增量不显著就不上**——该纪律 08-17 已挡过一次错误接线）。臂 A 通过才接 sarimax（engine exog 接口已实现）；臂 B 通过则以候选模型身份走准入门禁（规范 1）。验收：实验报告入 docs/backtests/（含"两臂均未过门禁"的诚实结论分支）；未过门禁则登记结论关闭该方向。
>
> **批 4 — 方向准确率（采购择时的真指标）**
> 验证环（`verifyDuePredictions`）在记 MAPE 的同时记**方向命中**（预测涨跌方向 vs 实际，相对 anchor 点）——读侧聚合（不加列，避免迁移），`/ai/accuracy` 与 `/ai/track-record` 增"方向命中率"列。回测（批 1）同口径产出历史方向命中，页面冷启动即有数。PROJECT-VISION §3.3 遗留建议的落地。验收：新验证行带方向判定；两页出现该列且与回测口径一致。
>
> **批 5 — 牛肉预测中心（核心功能的用户可见面）**
> 新页 `/beef/forecast`（牛肉区导航）：**下月共识卡**（方向+幅度+calibrated 90% 区间+模型分歧度，horizon 单位"个月"已支持）+ **回测证据面板**（批 1）+ **验证时间线**（"首个滚动验证 2026-09 到期"诚实预告，非空壳）+ **上游面板**（活牛/架子牛期货日更）。dashboard hero"AI 预测"卡改挂牛肉月度共识（现挂 7d 泛商品口径）。并入 v3.0.0 批 4：周度快照脚本加牛肉专段。验收：未登录不可见（与行情页一致）但 track-record 牛肉段公开；hero 卡与 /beef/forecast 数字一致。
>
> **批 6 — 免 key 牛肉/牲畜序列扩充（预测上限的数据面）**
> 盘点 FRED 免 key 面（经 cmeFutures 已验证的 CSV 通道）：候选=零售牛肉价/牛肉进出口量/其他蛋白交叉序列（猪/鸡，替代效应）——接入 2-3 条月度序列。牛肉预测面从 1 条基准 → 家族 3-4 条（含已在线活牛/架子牛），批 2 的 per-series 路由立即有用武之地。验收：新序列进月度循环（复用 ADR-0001 全套语义）；freshness 板可见。
>
> ### V3-四、决策项（不擅动，需用户点头）
>
> | # | 事项 | 建议 | 来源 |
> |---|------|------|------|
> | D5（新，批 0） | 月度 horizon 默认 [1,3]（替代 daily 默认 10）；7 条 NULL-interval 遗留行标 stale | 建议：照批 0c/0d 执行——证据链 9 月起成熟 vs 2027-05，差距是数量级的 | V3-一 缺口 2/3 |
> | D6（新） | 是否引入第二预训练 TSFM 家族（TimesFM/Moirai 零样本） | 建议：**暂不**——chronos 在现有池已劣于 naive，先用批 1 建立牛肉自身证据；若牛肉上全员≈naive，"大模型"叙事应让位"可验证"叙事（诚实优先）；引入须过批 1 同款回测门禁。**例外细化（round-135 检索，PRED-STRATEGY §7.1）**：chronos-2（2025-10）属现有家族升级而非新家族，且原生协变量能力正是批 3 所需——随批 3 臂 B 门禁评估，"一次一个挑战者"纪律不变 | V3-一；约束 §七.2；§7.1 |
> | D1-D4（承 v3.0.0） | PRODUCT-SPEC 增补 / 休眠表清理 / portfolios+predict-batch / predictionBeefCoverage24h 口径 | 见下文并行轨 D 表（不变） | round-134 |
>
> ### V3-五、不做清单（红线重申 + 本波新增）
>
> - **训练/微调任何模型**（AGENTS §七.2 红线；统计拟合与推理时校准不算训练）。
> - **未过回测门禁的模型接入**（含新 TSFM 家族；sarimax 维持 0 行是纪律执行正确，不是欠账）。
> - **为造 verified 数而放宽验证窗/冷却**（D2 round-17 先例：调参只能把 42→63，92.5% 无论怎么调都不可验证——数据没到就是没到）。
> - 并行轨与牧集相关的不做清单见 V3-六。
>
> ### V3-六、并行非核心轨（round-134 v3.0.0 批次，保留降级为并行）
>
> 以下与 AI 预测核心无依赖，作为第二优先轨保留：**批 A** 进口成本计算器 `/tools/landing-cost`（牧集结构性做不了的差异化工具：出口国汇率 × 关税/增值税/运费参数 → RMB/kg 到岸参考区间，输入数据全活；纯信息计算不碰红线，过期序列诚实降级）；**批 B** 公开中文行情摘要页 + 每周真数据周报（学牧集 SEO 长尾打法，用可溯源真数据，不打"分析师洞察"）；**批 C** 贸易词汇五维（BeefCutPrice metadata 增 feedingRegime/feedingDays/leanPct/breed/locationPort + CSV 模板扩展 + taxonomy 报盘俗名映射，数据解冻即接上）；**批 D** 工程卫生打包（登记决策项处置）。
>
> **并行轨决策项（承 round-134，不变）**：D1 = 批 A/B 是否写入 PRODUCT-SPEC（建议写入，纯增量不碰"明确不做"；批 C 作数据层能力登记）；D2 = 休眠表清理 SecurityAuditLog/ForecastingModel/Forecast（建议一次性迁移删除、数据先备份；TECH-DEBT round-132 登记）；D3 = portfolios 路由组 + `/api/inference/predict/batch` 孤儿（建议维持登记）；D4 = `predictionBeefCoverage24h` 月度眨眼口径（建议改为"beef 覆盖不限 24h + 最新预测时间戳"）。
>
> **并行轨不做清单（继承 round-134 §8.1 路由证据）**：IM 聊天、商家店铺/入驻体系、报盘/求购大厅、保理/金融/信用/单证面、B2B 多角色子账号——牧集交易面的运营重镇，全部"重运营 + 交易语义 + 红线冲突"，明确不做；国内现货报盘采价网络维持不做。

---

> **——以下为 v2.0.0 历史正文（批 1-10 + 6a/6b/6c 已全部执行完毕，保留存档）——**

> **2026-08-23**。目标：把对标分析的四条结论（数据解冻是唯一 P0 / 预测公信力是对外信任资产 / 定位"进口牛肉国际行情 × 可验证预测" / 不做牧集的重运营业务）翻译成可执行批次。所有文件锚点当日实测。
>
> **执行状态（2026-08-23 晚，全部 5 批已落地）**：批 1 `72f180e` · 批 3 `39a13cc`（范围扩大：执行中发现默认共识池为 chronos-only、淘汰线空转，除原定三处收口外扩池 3→7，详见 COMPETITIVE-ANALYSIS §三.3 三次修订）· 批 4 `283c685` · 批 2 `2f47d86`（执行中发现并修复测试→生产 Redis 缓存投毒通道，测试强制 db1）· 批 5 `e84033f`。测试基线 backend 999+1 → **1011+1**、frontend 314 → **317**，零回退。D1-D3 决策项保持登记未动。

## 一、规划期的两个关键复核发现（影响方案形态）

1. **共识引擎比分析初版以为的更强**：`modelQuality.ts` 已实现质量加权（30 天中位 MAPE，round-115）+ 劣于-naive 淘汰线（round-110，≥20 条验证且严格劣于 naive → 权重归零）。当前 30 天窗口实测（2026-08-23）：chronos 三变体（中位 0.79~0.82 vs naive 0.41）与 stl（5.73）**已被淘汰出共识投票**，共识实际由 4 个统计基线驱动。分析文档 §三.3 已修订。因此"共识按 MAPE 加权"**不是待办**，待办收窄为三处残留缺口（批 3）与营销口径倒挂（批 1c）。
2. **Hero 样本价是硬编码假数据**：`Hero.tsx:122-126`（Chuck Roll $389.50 等）与 `MiniSparkline` 假 `DATA_STREAM`，标注"Sample"。而全站唯一日更牛肉序列 `beef_carcass_us` 的真实数据就在库里——"活水证据"（分析 P0 第二项）就是把这组假数据换成这股真数据。

## 二、批次总览

| 批 | 内容 | 价值映射 | 规模 | 外部依赖 |
|----|------|---------|------|---------|
| 1 | 公开活水端点 + Hero 换真数据 + 口径对齐 | 分析 P0"活水证据" + 诚实 | ~0.5 天 | 无 |
| 2 | 公开预测档案页（带时间戳对错记录） | 分析 P1"信任资产" | ~1 天 | 无 |
| 3 | 共识残留缺口收口（range/均值/bestModel 感知权重） | 分析 P1 残留 | ~0.5 天 | 无 |
| 4 | ai/predict 页模型列表与预填修正 | TECH-DEBT §十四 已登记项 | ~0.25 天 | 无 |
| 5 | 数据导入节律 runbook | 分析 P0"CSV 回填"工程配套 | ~0.5 天 | 导入本身需用户提供数据 |
| D1-D3 | 决策项（watchlist UI / dashboard KPI 卡 / 运营动作） | 分析 P2 | — | 需用户点头 |

**建议执行顺序**：批 1 → 批 3 → 批 4 → 批 2 → 批 5（先小步诚实收益，再建信任资产；批 5 随时可做）。每批门禁：tsc + 全量测试（数不回退）+ build + PM2 重启 + live 验证 + 独立 commit。

## 三、批次详情

### 批 1 — 活水证据 + 诚实 Hero（前端为主 + 1 个公开端点）

**1a 后端**：`routes/marketData.ts` 新增 `GET /api/market/public/highlights`（**无 authenticate**）：仅返回白名单宏观序列（首期 `beef_carcass_us`）的 slug/名称/最新价/日期/日变动/近 30 点序列。复用 `getLatestPrice`（`marketData.ts:64` 现有 `:slug/latest` 的服务函数），`cacheRoute("market:public-highlights", 300)` + 全局 `globalRateLimiter`。公开宏观源数据无敏感性；**不得**含任何用户 dataset/timeseries 数据。

**1b 前端**：`Hero.tsx` — 删除硬编码 `priceItems`（122-126）与假 `DATA_STREAM`（10-13），改为消费 1a 端点：显示真实 US 胴体价 + 日期 + "Updated daily" 标识；端点失败时显示"数据源维护中"而非回退假数据。新 hook 参照 `useAccuracyData.ts` 模式 + 失败态测试。

**1c 口径对齐**：`site-stats.ts` 头注释现称 3 Chronos "in the user-facing consensus"——与引擎现实（已被淘汰线清出投票）倒挂。改为准确口径（"9-model engine, quality-weighted consensus, worse-than-naive eliminated"）；Hero 指标条（184-202）"AI Price Models 3" 同步换口径（如 "9-Model Forecast Engine"）。连带检查 `about`/`pricing` 引用。

**验收**：`curl` 无 cookie GET highlights 200 且含 2026-08 月内日期；landing 渲染真实价（grep 不到 389.50）；前端测试绿。

### 批 2 — 公开预测档案页（把 14.8 万条日志变成信任资产）

**2a 后端**：公开聚合端点（`signals.ts` 或 `marketData.ts` 下，无 authenticate + cacheRoute）：
- 每模型 30 天 MAPE 榜单（复用 `getAllModelAccuracy`，已有缓存）；
- 最近 N 条（如 50）**已验证**预测样本：序列名、predicted_at、到期日、预测值、实际值、误差——**白名单过滤**：仅宏观 commodity id 与 `cut:` 前缀序列，排除一切用户私有 timeseries（单元测试断言 where 子句，这是本批安全关键点）；
- 附 verification 方法论元数据（horizon、验证时点规则），供前端透明展示。

**2b 前端**：新公开页 `/ai/track-record`：滚动 MAPE 榜单（含"chronos 已被淘汰线移出投票"这类机制透明说明）+ 对错记录表 + 方法论。`middleware.ts:4` `PUBLIC_PATHS` 增补该路径；landing/pricing 各加一入口链接（"Our track record"）。

**验收**：未登录可访问页面与端点；响应经断言 0 私有 uuid；性能（cacheRoute 命中后 <50ms）。

### 批 3 — 共识残留缺口收口（`tradingSignals.ts` 三处小改）

淘汰线只作用于投票与加权中位数，三处未感知（当日读码确认）：
- **range**（285-287）：现为全部 available 模型的 min/max——被淘汰模型的极端预测仍拉宽共识区间。改为**仅权重 >0 的投票模型**参与 min/max（`individualForecasts` 保留全量展示）。
- **predictedChange**（309-310）：现为无权均值。改为质量加权均值。
- **bestModel**（313-320）：现按区间宽度置信度。改为权重最高的 available 模型。

**验收**：`tradingSignals.test.ts` 新增：构造 eliminated 模型极端价格 → range 不被拉伸、均值不偏移、bestModel=最高权重者；live 调 `/api/signals/forecast` 对照 individualForecasts。**风险**：range 变窄是语义变化（诚实方向），CHANGELOG 注明。

### 批 4 — ai/predict 页修正（TECH-DEBT §十四 登记项）

`predict/page.tsx:70-119` 硬编码 8 模型列表 → 从后端拉取（`/api/models` 或复用 signals 的 `getAllModels`）；`:55` `root.test2` 预填 → 默认 `beef_carcass_us`（公开且有日更数据）。测试同步。

### 批 5 — 数据导入节律 runbook（用户动作的工程配套）

新建 `docs/guides/WEEKLY-DATA-IMPORT.md`：上游清单（MLA NLRS / CEPEA 导出页路径与字段映射）→ CSV 模板（`GET /api/beef/import/template`，`beef.ts:693`）→ `/beef/import` 操作步骤 → 验证 SQL（行数/日期域/工厂覆盖/重复检测）→ 失败处置与回滚。目标：第三方可照做，把"每月想起来补一次"变成 30 分钟周节律。可选增强（并入 D2 决策）：dashboard 顶部 beef_cut_prices 陈旧警示条（数据源 freshness 板已有后端，仅前端露出）。

## 四、决策项（方案建议做，但不擅动）

> **执行状态（2026-08-23 晚，round-126 用户指令"继续完成剩余的开发任务"后处置）**：
> - **D1 已执行 `dd91b88`**：`/watchlists` 最小页（清单 + optgroup 选品器加部位 + 现价/涨跌/真实日期 + 移除）+ `useWatchlists` hooks（SWR 读 + 3 mutation，+5 测试），消费既有 7 端点零后端改动；选品器有价优先、无价标注（暂无价格）。有意不做：重命名/删清单 UI、`/api/portfolios` 组（仍 API-only）。
> - **D2 已执行 `c16ff34`**：进口均价冻结卡 → 全球牛肉价卡（同 highlights 源 + sparkline + MoM）。国产卡保留（无日更国产源）。可选增强"陈旧警示条"未做（简化原则：freshness 板已有，不重复露出）。注：该卡数据源经 round-126 D4 纠错后为 **IMF 全球牛肉月度基准（PBEEFUSDM）**而非"US 胴体日更"——原 beef_carcass_us 实为 Coinbase 比特币序列，详见 KNOWN-ISSUES D4。
> - **D3 保持非代码项**：种子用户访谈/档案周更/CSV 获取是运营与外部输入，无工程动作；4 个空 API key 仍是唯一外部依赖（KNOWN-ISSUES D1）。
> - 另：**KNOWN-ISSUES D4 在本轮定案并修复 `02fe33a`**（CBBTCUSD=比特币 → 置换 PBEEFUSDM + 清洗 11.6 年错标数据 + 回填 195 月度点），本文件批 1/批 4 描述中的 "US 胴体价（日更）" 表述按此修正理解。

- **D1 watchlist 最小 UI**：后端 8 端点 + `lib/watchlist.ts` hooks 全部就绪、零消费者（2026-08-23 复核）。建议做最小页（列表 + 加部位 + 现价），作为 P2 种子用户留存钩子；批 1 的 highlights 端点可复用为其报价源。~~（已执行 round-126，见顶部状态块）~~
- **D2 dashboard KPI 第三卡**：现"进口均价/国产均价"两卡长期显示 04-30 冻结值 + "—"趋势（`dashboard/page.tsx:238-265`）。建议其中一卡换成 "US 胴体价（日更）"，与批 1 同源。~~（已执行 round-126，见顶部状态块；D4 纠错后为 IMF 全球月度基准）~~
- **D3 运营动作（非代码）**：3→10 种子用户访谈；准确率档案周更发布；CSV 数据文件获取。**4 个空 API key 与数据文件是全部工程努力之外的唯一外部输入**（KNOWN-ISSUES D1）。（维持非代码定位）

## 五、不做清单（继承分析结论，红线不变）

B2B 撮合 / 国内现货采价网络 / 冷链硬件 SaaS / 支付/下单/交易（PRODUCT-SPEC §九）/ 负缓存（§十三 已决）。

## 六、与既有登记的关系

- 批 4 = TECH-DEBT §十四 "ai/predict 硬编码 8 模型 + root.test2 预填"的处置。
- 批 1c = §十四 "value narrative caution" 的处置。
- D1 = §十四 "watchlist UI" 决策项的具体化。
- 批 3 完成后，§十四 该条尾注"已解决"。

---
---

# 第二波（round-129 规划，2026-08-23；同日经对抗评审修订 v2）

> **输入**：round-128 对标复评（COMPETITIVE-ANALYSIS v1.1.0 §七）+ round-127 登记（TECH-DEBT §十四 两条）+ 本轮规划期新取证。规划方法加载 15 个 skill（13 个实质应用 + 2 个按自身前提判定不适用，另有 1 个名字未命中，使用记录见 §G），任务模板取 `planning-and-task-breakdown`，切片纪律取 `incremental-implementation`，测试要求取 `tdd`。
> **门禁（适用于 §B 每一批，无一例外）**：tsc + 全量测试（三套件计数不回退）+ `pnpm build`（PM2 跑 dist）+ PM2 重启 + live 验证 + 独立 commit。
> **目标一句话**：让"牛肉"回到核心价值链——预测循环以**可验证**的方式重新覆盖牛肉序列（批 6a-6c）+ 修用户可见缺陷（批 7）+ 公信力口径统一（批 8）+ 让数据断流可被看见（批 9）+ 解冻配套（批 10）。
>
> **对抗评审记录（2026-08-23，doubt-driven 终稿步骤）**：初稿经 fresh-context 评审（Explore 只读代理，68 次读操作核对 file:line），报 2 blocker + 6 major + 6 minor，全部归类为有效可行动并已并入下文——关键修正：批 6 初稿会让月度预测**永远无法验证**且以 30 分钟节律日产 ~336 条日志（重演 round-62/66/114 清理过的病理），已分解为 6a/6b/6c 并把"达到 `verified` 状态"设为硬验收；批 7 初稿换默认序列后页面**仍显示不出数据**（价格拉取无月度回退），已扩范围；批 9 实现位与稳态噪音已定案；D5 相关性不做的理由已纠错。
>
> **执行状态（2026-08-23 round-130，"开始执行计划"后）**：批 7 `e33956b`（扩范围版：默认序列 + getPriceHistory/batchLatestPrices 月度回退 + signals 200 降级；live 四项全过）· 批 8 `21661cd`（钉住测试 days=7/30/90 + methodology 双向口径；live 验证）· 批 6a `dd0eaeaa`（`cadence.ts` 策略模块 + freshness interval 感知；live：beef_carcass_us monthly/2026-07-01/非 stale）· 批 9 `583c376`（/health/ready beefSeries + predictionBeefCoverage24h + cron 状态转移降噪；双跑 live 验证）· 批 10 `40286a7`（verify-beef-import.ts 一键验证；生产双跑）。**执行注**：6a 的调度门控谓词按简化原则挪入 6b（与验证生命周期+开闸同批，避免死代码 flag——现有 predictionCache 测试已钉住订阅不变）。D5 ADR 已起草（`docs/adr/ADR-0001-...`，**Proposed 待用户确认**）。测试基线 backend 1004+1 → **1020+1**（98 文件）、frontend 322/35（批 7 含前端改动后全绿）、inference 64 不变；零回退。附带登记：watchlistService 本地 batchLatestPrices 副本仍 daily-only（TECH-DEBT §十四）。
>
> **执行状态（2026-08-24 round-131，D5 已确认 → 6b/6c 落地）**：批 6b-1 `43984cd`（prediction_logs 可空 interval 列，双库迁移，无回填；ADR-0001 → **Accepted**）· 批 6b-2（订阅月度谓词 ⑤：≤60d 且 ≥3 点；logPrediction + 30 分钟刷新**双重新实际点守卫** ④；data-fetcher 携带节奏落库 ③）· 批 6b-3（mapeTracking 四轮扫描节奏感知 ②：到期/实际值窗按步长、Pass A/B 按 (commodity, cadence) 分组 + 月度 60 天冻结窗、expire/restore SQL CASE 分流）· 批 6b-4（`scripts/verify-monthly-lifecycle.ts` 受控 live 验收 + 订阅开启）· 批 6c `397a86f`（CachedPrediction interval/horizonUnit **三写方同 commit**（INT-1）+ signals/inference/visualize 透传 + PriceForecastPanel"未来 N 个月/天"）。**强制检查点（6b 硬验收，2026-08-24 实测）**：① 回填月度行穿越全部清扫 → `verified` MAPE 0（脚本 + 集成测试双形式）；② 月度行 unverifiable 增速 0；③ 二次请求/重启重算/缓存过期均零日志增长；④ daily 语义存量测试全绿零变化；⑤ 订阅开启：15 daily + **13 monthly**（beef 首轮 7 模型 × 1 行，forecast_start_at 2026-07-31）；`predictionBeefCoverage24h` 0→**1**。执行中发现并自纠两处：Pass A 月度冻结补 60 天宽限（计划 6b 第 3 条原文，首版漏）、Pass B 分区标记早退 bug。测试基线 backend 1020+1 → **1034+1**（100 文件）、frontend 322 → **324**、inference 64 不变；零回退。

## §A 观察结果 → 计划映射（全部当日实测取证）

| # | 观察结果 | 证据 | 处置 |
|---|---------|------|------|
| 1 | **背景预测循环与牛肉零交集**：24h 覆盖 17 商品全为汇率/CME；`beef_carcass_us` 0 条预测（月度序列被 7 天新鲜度门控排除） | round-128 附录 SQL；TECH-DEBT §十四 round-127 登记项 | **批 6a-6c**（前置 D5；订阅在 6b 验收前不开启） |
| 2 | /trading 牛肉模式默认 `beef_cutout_us`（0 行数据）且 signals 空序列 500 | TECH-DEBT §十四 F3（round-127） | **批 7** |
| 3 | **MAPE 口径分裂（本轮新发现）**：原始 SQL（含 `stale` 行）chronos_mini 30d avg=55.43，仅 `verified`=7.05（与公开档案页 7.05 精确吻合）；16 条 stale 行 avg≈9676% 污染原始口径；COMPETITIVE-ANALYSIS v1.1.0 §三.3 复评注误用了原始口径，与 PRODUCT-SPEC §七"30d 6-9%"自相矛盾 | 本轮 SQL：`SELECT status,count(*),avg(mape) … GROUP BY status`；`curl /api/signals/models/accuracy/public` | **批 8** + 本轮已即时修正文档 |
| 4 | 死模型残留（sundial/timer_xl 332 行）**已被结构性隔离**：`computeAllModelAccuracy` 按现行注册表枚举（mapeTracking.ts:952-958），详情路由有 R3 守卫（signals.ts round-75）；days=30/90 实测均不出现 | 本轮读码 + live 双窗口实测 | **批 8** 测试钉住；数据清理 → **D7** |
| 5 | 数据断流不可观测：beef_cut_prices 冻结 115 天、预测覆盖 17/0，均靠手写 SQL 才发现；cron-healthcheck 只看进程健康 | round-127/128 取证过程本身 | **批 9** |
| 6 | CSV 回填 runbook 已有（第一波批 5），但回填后验证靠人工拼 SQL | docs/guides/WEEKLY-DATA-IMPORT.md | **批 10** |
| 7 | 孤儿端点组（/api/models 8 / /api/security 3 / /api/analytics 2）+ portfolios 组 0 消费 | TECH-DEBT §十四（round-123 登记） | **D6**（deprecation 决策框架） |
| 8 | 用户侧外部输入未变：4 个空 API key、beef_cut_prices CSV、种子用户 | KNOWN-ISSUES D1 | §C 清单（非工程） |

## §B 批次详情（批 6a-6c、7-10）

> 批 6 初稿按对抗评审 B1/B2 分解：月度序列**分三片落地，订阅在 6b 验收通过前不开启**——否则预测进得去、验证永远不成立，且 30 分钟刷新节律会对月度序列日产 ~336 条日志（7 模型 × 48 周期），重演 round-62/66/114 清理过的"永久 unverifiable 行污染"病理（predictionCache.ts:450-468 有完整历史注记）。

### 批 6a — 新鲜度/门控 interval 感知（不订阅，只修判定）

**内容**：
1. `getCommodityFreshness`（marketService.ts:240-244，现只查 daily 行）：groupBy 谓词按 interval 分组返回，月度序列产出真实 `lastUpdated`（今天显示为 stale 是因为查询本身看不到月度行）；
2. 调度门控谓词（predictionCache.ts:483-491/544-551，interval 硬编码在 WHERE 内）：月度订阅判定 = **最新点 ≤60 天 且 全序列 ≥3 点**——不用"窗口内 ≥2 点"镜像（月度点距 ~30 天，45 天窗多数时间只含 1 点，会导致每月约 2 周的订阅抖动，评审 M4）；阈值 60 天取 2× 发布节奏（PBEEFUSDM 于 M+1 月中发布，正常点距上限 ~45 天，60 天在其上，评审 m6）；
3. 集中为 `stalenessWindow(interval)` 小 seam（见 §D，但见评审 M3：seam 只覆盖阈值策略，约占改动量 10%，其余为显式枚举的编辑点，不做夸大声明）。

**验收**：freshness 板显示 beef_carcass_us 真实 lastUpdated（2026-07-01）与非 stale；daily 序列行为零变化（测试钉住）；**订阅清单不变**（beef_carcass_us 仍未订阅，测试断言）。规模 S。

### 批 6b — 月度验证生命周期（最难的一片，订阅开启的总闸）

**问题（评审 B1 全清单）**：验证生命周期 daily 中心化至少 6 处——到期判定 `horizon * 86400000`（mapeTracking.ts:652-653）、实际值窗 `anchorDay + (horizon+1) 天`（:680）、markUnverifiable Pass A/B 的 daily `findFirst`（:325-329/:408-415，月度序列会因"查无 daily 行"被立即判冻结）、expire/restore 的 `make_interval(days=>horizon)` + daily 实际值 SQL（:487-492/:523/:526/:557-565）。只改取数过滤，月度预测**永远无法验证且会被清扫为 unverifiable**。

**内容**：
1. `prediction_logs` 无 interval 列——每行 cadence 来源定为**写入时联查 commodities.interval 落库**（新增可空列 `interval`，迁移一次；旧行回填 daily 为默认？**不回填**，旧行按现状语义处理，避免重写 14 万行——新列 NULL=daily 时代旧行，语义兼容）；
2. 到期/实际值窗口按 cadence：月度行 horizon N = N 个月（`make_interval(months=>horizon)`），实际值取月度点；
3. 三处清扫（Pass A/B、expire、restore）对月度行使用月度冻结判定（最新点 >60 天才冻结，而非"无 daily 行即冻结"）；
4. **月度刷新节律（评审 B2）**：月度序列仅在**新实际点落库后**重新预测（logPrediction 前置守卫：该序列最新 actual 日期 > 上次记录预测时的 actual 日期），否则跳过——一个新月度点最多产出 7 模型 × 1 轮预测，而非每天 336 条。

**验收（硬门槛）**：
- [ ] 手工构造月度预测（或等待新月度点）：`beef_carcass_us` 至少 1 条到达 `status='verified'` 且 mape 非空
- [ ] 月度行的 unverifiable 增速为 0（清扫不再误伤）
- [ ] 新实际点触发重预测、无新点时日志零增长（SQL 断言 24h 行数）
- [ ] daily 全链路行为零变化（存量 14 万行的清扫/验证回归测试全绿）
- [ ] **订阅开启**（本批验收通过后才 flip 门控让 beef_carcass_us 进循环）

规模 L（评审 m1：mapeTracking 是全仓最高风险文件——原生 SQL + 状态生命周期，必须单独成批、单独 commit、live 专项检查点）。**依赖**：6a + D5 定案。

### 批 6c — cadence 元数据 + 前端单位标注

**问题（评审 M2/m1）**：`PriceForecastPanel` 硬编码"未来 {horizon} 天"（PriceForecastPanel.tsx:118）；月度序列 horizon 10 将被展示为"10 天"实为"10 个月"。`CachedPrediction` 形状有**三个写入方**共享（predictionCache.ts:26-29/208-217、inference.ts:205-209/288-292，round-114 INT-1 形状漂移 bug 的原址）。
**内容**：`CachedPrediction` 增 `interval`/`horizonUnit` 字段——**三个写入方同一 commit 内同步改**（INT-1 教训），signals/inference 响应透传；前端 `PriceForecastPanel` 按 horizonUnit 显示"未来 N 个月/天"；推理服务侧评审已证实输出时间戳按最后两点间距外推（predict.py:113-123），月度输入天然产出月度间距，后端无需换算。
**验收**：/trading 与 /ai/predict 对月度序列显示"个月"；daily 显示不变；三写入方形状一致性测试。规模 S-M。**依赖**：6b（订阅开启后才有月度信号流到前端）。

### 批 7 — /trading 牛肉模式真正可用（F3；评审 M1 扩范围）

**问题**：初稿只换默认序列，但 `useTradingData` 固定 `interval=daily` 拉价格（useTradingData.ts:23/97）→ `getPriceHistory` 无月度回退（marketService.ts:105-129）→ `loadSignal` 对空数组早退（useTradingData.ts:204）——**换默认后页面仍无图无信号**；且牛肉模式隐藏了 TimeframeSelector（trading/page.tsx:122），用户无法自救。signals 路由空序列 500（signals.ts:415-429 → tradingSignals.ts:141-143 → errorHandler 默认 500）。
**内容**：
1. 牛肉模式默认 `beef_cutout_us`→`beef_carcass_us`；
2. `getPriceHistory` 按**序列真实 interval** 取数（commodity.interval 优先于请求默认），牛肉模式恢复 TimeframeSelector 或按序列隐藏 daily 选项；
3. signals 路由空序列返回 2xx 降级载荷（`insufficientData: true`），不再未捕获 500。
**验收**：live /trading 牛肉模式出**价格图 + 信号面板**（不只是页面 200）；0 行序列 curl signals 得 2xx 降级；回归测试钉住三者。规模 M（3 文件）。**依赖**：无（可与 6a 并行）。

### 批 8 — 公信力口径统一 + 榜单钉住（含本轮已做文档修正的收尾）

**内容**：
1. 钉住测试（评审 m5：定位为 tripwire 而非主体工作——聚合按注册表枚举，测试防的是未来回归）：任何 `days≤90` 公开榜单 modelId 集合 == 引擎注册表集合；
2. `getPublicTrackRecord` methodology 补**精确**排除规则：MAPE 分子仅 `verified` 行；`predictionCount` 分母**含** stale/unverifiable 行（mapeTracking.ts:853-861）——一句话必须两者都说清，笼统写"排除 stale"对 predictionCount 是错的；
3. 三文档统一 verified-only 口径（COMPETITIVE-ANALYSIS §三.3、PRODUCT-SPEC §七、本计划），全周期长尾与当前 30d verified 双口径并列。

**验收**：新测试绿；三文档 grep 无裸原始口径残留；公开页 methodology 含双向说明。**依赖**：无。**规模**：S。

### 批 9 — 数据新鲜度可观测性（评审 M5/M6 定案）

**实现位（M5 定案）**：**后端侧**——扩展现有 health 端点（或新增 ops 只读小端点，`authenticate` 管理员保护）返回两项检查结果，`scripts/cron-healthcheck.sh` curl 它并 grep——阈值 import 共享的 `stalenessWindow`，避免 bash 里第六处硬编码；shell 无 DB 直连问题消失。本批含 build + PM2 门禁。
**降噪（M6 定案）**：事件只在**状态转移**时记（cron 脚本持久化小状态文件对比上次结果），外加每日一次心跳摘要——beef_cut_prices 已冻结 115 天是**已知稳态**，每 5 分钟刷屏会把真告警淹死；`prediction_coverage`（24h 背景预测覆盖的牛肉序列数）同规则。
**验收**：人为调低阈值触发 fresh→stale 转移，日志出现一次且下一轮不重复；状态回正后恢复；心跳摘要可 grep。**依赖**：无（6a 落地后 threshold 共享才成立——若 6a 未先行，批 9 可自带常量并注明后续接驳）。**规模**：S-M。

### 批 10 — CSV 回填验证一键化

**内容**：`backend/scripts/verify-beef-import.ts`（评审 m2：遵循 backend/scripts/ + tsx 既有惯例，如 import-beef.ts；根 scripts/ 无 TS runner）。WEEKLY-DATA-IMPORT.md §五已有日期域与重复检测查询；**行数增量与工厂覆盖查询是新增**（初稿"打包自文档"表述不准），一并实现并回写 runbook 引用。
**验收**：对当前库 dry-run 输出与手写 SQL 一致。**依赖**：无。**规模**：XS-S。

**建议执行顺序**：批 7（用户可见修复）→ 批 8（口径收口）→ 6a → **D5 定案 → 6b**（订阅开启 + 专项检查点：live 验证牛肉序列进链路且首条 verified）→ 6c → 批 9 → 批 10。检查点节奏：每批独立 commit + 全量门禁；6b 后为强制人工检查点。

## §C 决策项（不擅动，需用户点头）

- **D5 月度序列预测语义（批 6a-6c 总纲，批 6b 前置）——已定案**：[`docs/adr/ADR-0001-monthly-series-prediction-semantics.md`](adr/ADR-0001-monthly-series-prediction-semantics.md) **Accepted（2026-08-24 用户确认）**，批 6b/6c 已按此执行完毕（见上方 round-131 执行状态）。五点语义包：① horizon 单位 = 步长（月度序列 1 步 = 1 个月）；② 验证到期与实际值窗按步长（`make_interval(months=>horizon)`）；③ `prediction_logs` 增可空 `interval` 列（NULL=daily 时代旧行，不回填）；④ 月度刷新节律 = 仅新实际点后重预测；⑤ 订阅谓词 monthly = 最新点 ≤60 天 且 ≥3 点。correlationAnalysis/analytics 显式不做月度（理由经评审 m4 纠错：daily-only 读取与跨节奏对齐，非点数不足）。
- **D6 孤儿端点处置——已定案（2026-08-30 round-132 执行，"继续完成剩余的任务"指令）**：五问重评（全量核实见 TECH-DEBT §十四 round-132 记录）：`/api/security` 3 端点**删除**（audit 前端从未发送）；`/api/models` 8 端点**删除**（重评结论：公开档案页用的是 `/api/signals/models/accuracy/public` 而非本组，"互补"假设未成立；`modelService` 唯一消费者即本组路由，连带删除；`ForecastingModel`/`Forecast` schema 与数据保留为休眠表）；`/api/analytics` 2 端点**删除**（correlation 为 live signals 版之外的第三套重复实现、seasonality 0 消费且 PRODUCT-SPEC 无规划）；portfolios 组**维持登记**（0 页面消费，暂缓）。测试 1036+1→1002+1（-34 全部为随组删除的测试，零失败），live 404×3 + 替代面 200。
- **D7 死模型残留数据（sundial/timer_xl 共 332 行）——已定案（2026-08-30 round-132）：保留**。已结构性隔离（注册表枚举 + R3 守卫 + 批 8 钉住），数据不删（预测历史完整性）；未来如用户明示删除属数据治理决定再单列轮次。

**用户侧外部输入（非工程，不变）**：4 个空 API key（MLA/USDA_MARS/OPENWEATHER + FRED 免 key 已用）；beef_cut_prices CSV 周更（runbook 就绪）；3→10 种子用户访谈与档案周更。

## §D 架构注记（zoom-out 模块地图 + 深化机会）

月度语义涉及的模块地图（调用方 → 被调方）：

```
scheduler ──→ predictionCache ──→ inference/data-fetcher（已有 monthly 回退）
    │              │──→ mapeTracking ──→ prediction_logs（actuals 取数 daily-only ←批 6.2）
    │              └──→ tradingSignals ──→ modelQuality（30d 窗口径 ←批 8 关注）
    └──→ getCommodityFreshness（daily-only ←批 6.1）
correlationAnalysis / analytics（daily-only ←显式不做，D5）
routes/inference.ts（fetchHistoryWithFallback，round-127 已修）
```

**深化机会（improve-codebase-architecture 词汇；经评审 M3 校准）**：interval 判定散在 ≥5 处（freshness、调度门控、mapeTracking actuals、correlation、analytics）——**浅接口碎片**。批 6a 引入 `stalenessWindow(interval)`：接口只有"interval→窗口/单位"，实现集中阈值规则。**删除测试通过**（删掉它，阈值知识散回 5 个调用点）。**诚实边界**：该 seam 只覆盖阈值策略，约占批 6 全部改动量的 ~10%——其余是显式枚举的编辑点（freshness 查询谓词、调度 WHERE、验证生命周期 6 处、`CachedPrediction` 三写入方、响应形状），不存在"一个小函数解决全部"的捷径。一次只做这一个 seam，不为假想的第三种 interval（weekly?）预留扩展。

## §E 安全注记（security-and-hardening 速评）

公开面新增代码仅批 6.3（响应字段追加，无新端点）。存量公开端点面（highlights / accuracy/public）已有：正白名单 fail-closed（samples）、cacheRoute、全局限流、无敏感字段。批 8.1 的钉住测试同时是信息完整性防线（榜单不可被历史死模型污染）。无新增外部输入面、无新依赖、无密钥接触——STRIDE 无新增项。

## §F 可观测性注记（observability-and-instrumentation）

On-call 三问（批 9 遥测必须能回答）：①核心序列多少天没更新了？②背景预测覆盖了几个牛肉序列？③（批 6 后）月度序列上次验证是什么时候？信号选型：结构化日志事件（`series_stale` / `prediction_coverage`）而非新指标系统——单机 PM2 部署，日志即遥测；阈值有据（7/45 天=数据源自然节奏的 1 个周期以上）；每次事件自带 runbook 指针（指向 WEEKLY-DATA-IMPORT.md 或批 6 说明）。

## §G skill 使用记录（本轮规划，2026-08-23）

| 阶段 | skill | 应用 |
|------|-------|------|
| 战略 | zoom-out | §D 模块地图（月度语义影响面） |
| 战略 | source-driven-development | §A 全部主张附实测命令/live 证据；无凭记忆的框架断言 |
| 战略 | doubt-driven-development | 规划期自我质疑 3 次（死模型暴露？→live 双窗口实测否定；MAPE 口径分裂？→实测证实并修正；horizon 污染？→入批 6c 风险）；**终稿经 fresh-context 对抗评审**（Explore 只读代理 68 次读操作核对 file:line）报 2 blocker + 6 major + 6 minor，全部归类有效可行动并已并入计划（批 6 分解、批 7 扩范围、批 9 定案、D5 纠错）；非交互上下文 → cross-model 跳过（规则要求显式宣布） |
| 结构 | planning-and-task-breakdown | §B 批次模板（验收/验证/依赖/规模/检查点） |
| 工程 | improve-codebase-architecture | §D stalenessWindow seam（删除测试通过）；D5 以 ADR 记录 |
| 工程 | deprecation-and-migration | D6 五问框架 + advisory 优先 |
| 工程 | incremental-implementation | 批次切片纪律（≤5 文件/批、每批独立 commit、绿灯后才进下一批） |
| 质量 | tdd | 各批"验收=行为测试钉公共接口"（如 days≤90 榜单集合测试） |
| 质量 | security-and-hardening | §E 速评 |
| 质量 | observability-and-instrumentation | §F 三问 + 信号选型 |
| 质量 | shipping-and-launch | 门禁继承 + 批 6 专项检查点 + 回滚=git revert 单批 commit |
| 对齐 | spec-driven-development | 计划含 Objective/Commands/测试策略/边界（Always=门禁，Never=§九红线）结构化要素 |
| 基线 | ops-check | PM2 模式确认 + 三服务 HTTP 探活（backend /health=200、landing 200、inference 200，2026-08-23） |
| — | to-prd / triage | **不适用**：依赖 issue tracker 与 label 词表，本仓库计划落 docs（无 tracker）；已按其自身前提判定并记录 |
| — | documentation-and-adr | 名字未命中（不在可用列表）；ADR 格式惯例改从 improve-codebase-architecture 引用文件取 |

## §H 第二波不做清单（继承 + 新增显式项）

继承第一波全部（B2B 撮合 / 国内采价网络 / 冷链 SaaS / 支付下单 / 负缓存）。新增显式：**correlationAnalysis 与 analytics 的月度序列支持**（D5 记录为不做：阻碍是 daily-only 读取与跨节奏对齐，非点数不足——等日更牛肉数据解锁）；死模型数据删除（D7 建议保留）；`prediction_logs` 旧行 interval 回填（14 万行重写不值得，NULL=daily 语义兼容）。
