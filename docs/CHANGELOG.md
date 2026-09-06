---
title: "MT Platform Changelog"
en_title: "MT Platform Changelog"
version: "1.0.0"
last_updated: "2026-09-06"
status: "active"
maintainer: "MT Team"
reviewers:
  - "Release Manager"
  - "Project Maintainer"
tags:
  - "changelog"
  - "release-notes"
  - "version-history"
target_audience: "Developers, Users, Contributors"
related_docs:
  - "Product Spec": "PRODUCT-SPEC.md"
  - "Deployment Guide": "deployment/DEPLOYMENT-CHECKLIST.md"
  - "API Reference": "API.md"
changes:
  - version: "1.0.0"
    date: "2026-03-10"
    author: "MT Team"
    changes: "Added YAML metadata header"
next_review: "2026-09-10"
approval:
  status: "approved"
  reviewed_by: "Release Manager"
  approved_date: "2026-03-10"
---

# Changelog

All notable changes to the MT Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: MT was previously known as "TradeMind AI / IoTDB Enhanced". Historical entries reference the old name. The platform was rebranded to MT (commodity market analytics) in 2026-05.

---

## [Unreleased]

### 2026-09-07 — round-161：开发轮 — 按探索方案落地（comext_eu 欧盟月度镜像 + 双币贸易流读侧 + Drewry WCI 运价基准 + 肉交所勘察）

用户指令"根据新的探索方案，进行后续的开发"。输入 = round-160 TradeSources v2.0.0 路线增补（P1a/P2 运价/P1b 勘察）。三批独立 commit、全门禁（tsc/biome/全量/构建/PM2/live）。

- **批 1 `05191e4` — comext_eu 欧盟月度贸易流镜像（P1a，最大增量）**：Eurostat Comext `DS-045409` 免 key（旧 `/sale/` 路径已死）；IE/NL/FR/PL × 8 HS × FOB-**EUR** 独立 type（`export_eu_to_cn_*`），与 USD 镜像同表并列**绝不合并**。契约陷阱全部实测钉死并由测试守护：indicators 多值静默坍缩为 0（须单值逐查）、product 多值 413、`sinceTimePeriod/untilTimePeriod` 区间使**回填请求量恒定**（64 查询/轮）、JSON-stat 扁平索引=时间索引（其余维度单值）、QUANTITY_IN_100KG×100=kg、缺月=无流量非零值。**读侧泛化**：TradeFlowPoint 字段 `unitPriceUsdPerT/valueUsdM`→`unitPricePerT/valueM`+每行 `currency`，前端卡按行渲染 $/t vs €/t + ·EUR 口径标，第 4 条口径注记随载荷。live：boot 64 查询→IE 3 行；37 月回填 125 解析/122 入库（**15 序列**：IE 0202/020230 各 33 个月，FR/NL/PL 集中于杂碎与偶发牛肉线，2023-08→2026-06）；`GET /trade-flows?hs=0202` → IE €2,560.6/t（环比 −55.1% 与回填数据自洽）+ FR 年内线；生产缓存旧形状键清除后复验。+6 解析测试、路由测试加 EUR 播种例、前端卡 4/4（含 EUR 断言）。
- **批 2 `797baa9` — drewry_wci 周度运价基准（P2 运价因子）**：Drewry 免费页纯文本抽取（首个 `\$N per 40ft` = 综合指数、评估周四标题定日期；reformat → 0 行+warning 不猜值）→ CommodityPrice 周度序列 `ocean_freight_wci`（USD/40ft）+ noChange。**口径设计**：按柜计价**不做 per-kg 换算**（装载吨数是用户假设，换算即造数）——landing-cost 响应新增 `freightBenchmark` 参照（值/日期/天数/stale）+ 工具页"海运参照（Drewry WCI）"溯源卡 + 注记。live：boot `$4,465/40ft（2026-09-03）` 1 行入库；`/api/tools/landing-cost` 返回 freightBenchmark+注记，中档 ¥68.03/kg 计算不受影响。+4 解析测试；landingCost 9/9、工具页 4/4 零回退。
- **批 3（勘察，不携代码）— 肉交所 ToS/robots 取证**：robots.txt 为 DESTOON B2B 默认模板（禁 `/api/`、`/member/`、`/*search*`，**允许 `/sell/` 公开列表页**）；公开 about 页无反爬条款（注册协议在登录墙后未核验）；条目页字段统一（品名/价格 元每公斤/数量公斤/现货状态/产地/仓库位置），厂号在"最新成交"条目。**结论：采集面合规可试（低频日 1 次+仅公开列表页），实现待独立轮次**（BeefCutPrice 词汇映射与厂号→factoryCode 解析设计先行）。
- **注册与文档**：注册源 **20→22**（Tier 3 comext_eu / Tier 4 drewry_wci；AGENTS §二/§三 同步 24 文件/22 注册，实测复核）；PRODUCT-SPEC §七 贸易流量层行更新（欧盟 EUR 通道 + WCI 参照）；DATA-SOURCES-EVALUATION round-161 执行记录；IMPROVEMENT-PLAN Wave-8 链追加。基线：backend **1118+1 skip**（1112→1119，+6，零回退）、frontend 相关套件零回退（全量 tsc 因并发会话 WIP 文件报错，非本批文件）。

### 2026-09-07 — round-160：调研轮 — 贸易信息平台深挖（TradeSources v1.0.0→v2.0.0：国内现货免费面 + Comext 欧盟月度镜像 + 厂号/运价/基线/提单六板块）

用户指令"更加深入探索可能获取到牛肉贸易信息的网站平台"。docs-only 调研轮（round-148/151 同例），三路并发子代理（国内现货/替代统计镜像/厂号+运价+B/L）+ 本机亲手复核承重项（Comext 真值/OECD 直链/肉交所/Mysteel/foodmate/WCI）。时间背景：round-157/158/159 已落地评估文档与 inac/ibge_sidra 源，本轮补的是此前未排查的六块空白。

- **Eurostat Comext `DS-045409` 免 key 打通（最大增量）**：欧盟输华批准国（IE/NL/FR/PL）**月度 CN8 级**对华量价；旧 `/sale/` 路径已死，现行 `comext/dissemination/statistics/1.0/data/` 端点；维度契约实测钉死（flow=2 出口、indicators 枚举、sinceTimePeriod 区间、多值 `+` 触发 413 须逐产品查）；本机复核 IE→CN 0202 2024-06 = **€645,967**（与代理逐位一致）；数据集 08-14 更新含 2026-06（T+6 周，快于 Comtrade 欧盟月度报送）；复用需署名、禁全量下载。
- **国内现货层首批免费可编程源**：**肉交所**（进口/国产部位挂价 + **带厂号件套成交价**——牛霖411厂 57,878 元/吨级，日更 SSR HTML，本机 200/95KB 价格标记 122 处实证）；**Mysteel 牛羊业**（热鲜批发市场价/进口牛副/冷冻分割品日更 SSR，桌面版域名才含表格）；foodmate 输华注册企业查询（GACC 镜像免登录）。牧集级"人工行情日报"仍无公开源（公众号/App 墙确证：冻师傅/冻品攻略/优顶特研究院/冻品e港）；"现货层无公开源"口径收窄为"无日报级，挂价流免费层存在"。
- **排查性结论（省后人的路）**：俄罗斯月度官方路径全灭（ФТС 明细 2022-03 停更 + 双通道 000；Agroexport 新闻稿级；НСПГ 评论级）→ RU 通道唯一解仍是中方口径/商业库；ITC Trade Map 条款禁抓取+禁再分发（仅人工核查）；WITS 仅年度排除；SCFI 图片渲染+CSRF 壳不采；ImportYeti 仅美国方向且 CF 403；uktradeinfo/StatCan 免 key 可商用但量小（P3）。
- **其他新面**：OECD-FAO Outlook 免 key 直链 CSV（30.5MB 实拉，年度供需+10 年预测基线）；厂号名录扩展（MPI 输华清单含 Valid until 但 Incapsula 拦 curl、MGAP 输华 PDF 带日期、MAPA SIGSIF 502、RMED 有 China 准入筛选 XHR 待逆向）；运价指数免费三源（Drewry WCI 文本值 **$4,465/40ft** 实证 + FBX 日更综合值；SCFI 不采）。
- **文档四件**：TradeSources **v2.0.0**（TL;DR 7-12 增补、round-160 主机矩阵、§八—§十三 六新板块、路线增补 P1a/P1b/P2/P3+不做清单、附录 v2 命令块）；DATA-SOURCES-EVALUATION §六 round-160 增补（新 P1×3/P2×4/不做×5 + 现货层口径修正）；INDEX 条目升 v2.0.0；本 CHANGELOG。零代码改动、无测试门禁（docs-only）；工作树其余改动属并发会话未动。

### 2026-09-07 — round-159 — inac 源复活（乌拉圭通道恢复）：inac.uy DIAE 新契约，novillo_gordo_uy 月度价 91 行入库，注册源 19→20

- **勘察定案**：旧域 inac.gub.uy SSL 死亡（08-15 退役根因），门户迁 www.inac.uy（Liferay）；统计区入口为 **DIAE Interactiva** 应用，后端 `POST/GET /inac/DIAEUtils`——`cmdaction=datosiniciales` 返回最新年月（maxAno=2026/maxMes=7），`?cmdaction=precios&format=CSV&ano=Y&categoria=1&tipoprecio=1` 返回"育肥牛（Novillos gordos）活重月度价"CSV（Y 与 Y-1 双年列 + 同比）。
- **解析防线（live 取证出的真坑）**：Jasper CSV 导出**表头与数据行列位错位**——年份标签在 col3/col7、当前年数值却在 col4（上一年 col7 对齐）；按表头索引解析会**静默丢弃全部当前年数据**。解析器改用数值列发现 + 左新右旧 + 列同一性（单值行按列位归属年份，不错配），%单元格先排除（parseFloat 会把 "29,47%" 读成数），仅当恰有两个数值列才解析（drift guard 单列拒写）；乌拉圭拼写 Setiembre/Septiembre 双收、十进制逗号、junk 首行与 Fuente 页脚均有测试钉住（5 个解析测试）。
- **落库**：CommodityPrice `novillo_gordo_uy`（livestock，USD/kg，月度，平烛形态同 fred 月度惯例）；查询梯 ano=maxAno 步长 2（每 CSV 含两年，4 请求覆盖 8 年）+ noChange 契约（DAILY 节奏）。**live**：boot 首灌 **91 行（2019-01→2026-07）**，2026-07=3.25 USD/kg 与 API 一致；手动复跑 noChange:true。旧 BeefCutPrice 部位 FOB 语义（exportaciones.html 表）随旧域消亡，或经 DIAE expo 应用另行复活（P2 未排期）——头注如实记录语义变更。
- **注册**：inac 双处复活（index.ts Tier2 + server.ts DAILY），墓碑注释改复活注记；注册源 19→**20**（AGENTS §二/§三 已同步）。
- **门禁**：tsc 0 / biome 0 / 全量 **1112+1 skip 零回退**（+5 inac 解析）/ build 0 / PM2 重启 / live 验证如上。
- 备注：novillo_gordo_uy 未加入 digest 公开白名单（白名单是隐私契约，扩容另行决策）；faena（周屠宰）/expo（出口）两个 DIAE 应用为 P2 候选。

### 2026-09-07 — round-158 — 数据供给批：SIDRA 官方源上线（18→19 注册）+ FX H.10 周批误报修复 + 90CL 断供定性收窄

- **批 B（`ibge_sidra` 新源，政府官方免 key）**：IBGE SIDRA t/1092 巴西季度牛屠宰（Pesquisa Trimestral do Abate 国家总量）——变量 284 屠宰头数 + 285 胴体总重双序列，落 MarketFactor（`slaughter_bovines`/BR，seriesKey `animais_abatidos`/`peso_carcacas`；分析面，不入预测环）。`v/allxp` 单拉 + 客户端过滤（多变量斜杠语法 `v/284/285` 实测挂起）；YYYYQQ 季度码 → 季初日期（202601→01-01，防月表 YYYYMM 别名的正则钉死）；noChange 契约（DAILY 节奏重扫 8 季度）+ 5 个解析测试（schema 漂移 → 0 行拒写）。**live**：boot runAll 首灌 16 行（2024-Q2→2026-Q1），2026-Q1 头数 10,289,201 与 API 逐位一致；手动再触发 noChange:true 契约验证。weekly_kills 表刻意不动（周度美式表 ≠ 季度国家总量，硬塞破坏语义）。
- **批 C（FX 新鲜度误报修复）**：实测定性——H.10 三元组（usd_cny/brl_usd/eur_usd）fred 行为**逐营业日点位**但上游**周一批次发布**，健康周期最新点龄 9-10 天，撞 7 天日度窗每周五至日误报 stale（09-06 实况即此）。修复：`cadence.ts` 增 `PUBLICATION_WINDOW_DAYS` 覆盖表 + `stalenessWindowDaysForSeries(interval, slug)`（三元组 14 天 = 一个发布节奏 + 滑裕，同月度 90d 的"一个节奏容忍"口径），**仅新鲜度面传 slug**——预测/调度门保持原窗不受数据延迟怪癖放松。+5 测试（含 9 天非 stale / 15 天仍 stale 端到端集成）。live 铁证：`eur_usd` 10 天龄 daily 点 → stale:false。
- **批 A（90CL 断供收窄）**：替代源定位 = My Market News 报告 2823（`mymarketnews.ams.usda.gov`，filerepo PDF 按期次编号需页面发现），但主机直连+代理双 000（round-149 首测 + 本日复测；代理可到 www.ams 母域，封锁为主机级）、DataMart 复测仍 500——**代码就绪卡出口**。期间 digest `beef_90cl_us` 按周度 21 天窗自然降级（~09-18 转 stale，诚实陈旧）；scraper 非 PDF 警告语改为明确陈述迁移事实与去处。
- **门禁**：tsc 0 / biome 0 / 全量 **1107+1 skip 零回退**（+8：SIDRA 解析 5 + cadence/新鲜度 3）/ build 0 / PM2 重启 / live：19 源 boot runAll 全 succeeded、SIDRA 16 行入库、eur_usd 误报场景修正、90CL 新警告语上线。
- 登记：AGENTS 源计数 22 文件/19 注册；KNOWN-ISSUES D1 round-158 块（含 boot runAll 不写 ingestion_logs 的既有行为留尾）；DATA-SOURCES-EVALUATION §8.1/§8.4 落地状态。

### 2026-09-06 — round-157 增补 — 政府官方 API 扩容实测：牧集/必孚数据流的官方构建可行性（纯文档）

- **DATA-SOURCES-EVALUATION.md v1.0.0 → v1.1.0（§八增补）**：回答"能否尽量引入更多在线接口/用政府官方数据构建牧集/必孚级数据流"。**新验证 4 个可用官方接口**（全部本机实测）：USDA NASS QuickStats（401 契约活，免费 key——月度屠宰/**冻肉库存 Cold Storage**/Cattle on Feed）、USDA FAS 网关（GATS HS10 官方双边出口 + PSD 供需，免费 key）、**巴西 IBGE SIDRA 季度屠宰 API（免 key，参数校验应答=活）**、巴西 MAPA 工厂名录宿主（根域 200，SIF 入口待勘察）。
- **核心可行性结论**：必孚型"统计+名录"面**基本可由政府数据构建**（Comtrade 镜像在库 + 上述接口 + 税率/成本工具面组合推导）；牧集型"现货日报 + 港口库存"**确认无任何政府数据源**（必孚库存为自采商业数据；唯一官方近似=NASS 美国冻肉库存，须口径标注）。构建后官方口径节奏矩阵：日度 CME+FX / 周度 90CL+MLA / 月度 Comtrade+AR FOB+NASS+GATS / 季度 SIDRA+PSD / 年度中国上报校准。
- **环境限制新证据**：`api.usda.gov`（MARS）与 `api.data.abs.gov.au`（澳 ABS）**直连+代理双通道 000**（与 ABARES 同族）——eWAPS 修复路径 B（MARS key）在本机多一层出口封锁，**路径 C（LMR DataMart，今日 500 待复核）成为环境内最可行路径**；`ewaps/search.ams.usda.gov` TLS 拒绝（代理可到 www.ams 母域，封锁为主机级）。
- 优先级更新：P0 key 清单收敛为 data.gov 一把 key（NASS+FAS 两家四组序列）+ MLA key；P1 新增 SIDRA（零依赖可写代码）与 MAPA SIF 入口勘察；P2 新增 StatsNZ 复核、CEPII BACI 年度回填。

### 2026-09-06 — round-157 — 数据源评估（对标牧集规模/密度）：eWAPS 断供回归发现 + INAC 复活 + 逐层取数决策（纯文档轮）

- **新增 [DATA-SOURCES-EVALUATION.md](DATA-SOURCES-EVALUATION.md)**：回答"要实现牧集量级的数据规模/密度，牛肉外贸信息从哪里获取"。核心结论：牧集密度=三层叠加（现货日更层**无公开源**=运营人工录入或商业采购决策；统计月更层 Comtrade 镜像已承接；工具参照层静态+名单页），MT 数据层 09-06 全量实测基线（18 在册源仅 5 产数；commodity_prices 66,560 行中 95% 为 fred 宏观；beef_cut_prices 2,401 行冻结 2026-04-30；weekly_kills/cold_storage 无在册写入者）。
- **发现线上回归（本轮最高价值）**：USDA AMS mnreports 报告族（ams_2823.pdf/nw_ls421.txt）已迁 eWAPS 平台——`usda_import_beef` 09-06 连续 warning 0/0，digest `beef_90cl_us` 卡（round-155 批 D dashboard 第二卡）停在 2026-08-28 单点。修复三选一已登记 KNOWN-ISSUES D1（eWAPS 端点勘察 / MARS key / DataMart 待复核）。
- **其余今日实测**：INAC 域名复活（www.inac.uy 200，旧域 SSL 死，统计入口待勘察→乌拉圭通道低成本复活路径）；IPCVA 2026-04 改版无价格区（降 P2）；customs.gov.cn 412 / ComexStat 403 / stooq 404 封锁复现（08-31 报告矩阵结论不变）。
- 登记同步：KNOWN-ISSUES D1 增 round-157 更新块、INDEX 增条目。**零代码改动**（评估轮），全部证据为本机 curl/psql 实测可复现（文档附录含命令）。

### 2026-09-06 — round-156 批 3c 改判 + 批 5（TECH-DEBT 收口部分）— 接缝证据驱动 + 三条 TD 终态

- **批 3c 改判缓做（证据：三页面接缝扫描）**：performance/alerts-rules/data-sources 三页的自然接缝（Modal、badge、card 等子组件）已被历史轮次抽出，剩余 713/705/702 行主体是 15-23 个 hooks 的有状态编排——继续拆分等于给状态机加参数透传层，收益为负（过度工程化防线：拆分是重新分箱，不该造没人住的新房间）。待任一页面功能迭代时随批重构。
- **TD-14 RESOLVED（冷启动终验）**：全新空库 `mt_coldstart_156` 上 `prisma migrate deploy` 全量应用成功、退出码 0——round-103 基线 squash 后的冷启动路径首次以空库实证，P3018 不复存在。
- **TD-17 RESOLVED（三子项复核全关闭）**：孤儿 `pm2-start.sh` 实为 round-112 `1ae11b8` 已删（本轮实测不存在+零引用）；logrotate repo 副本与线上 diff 逐行一致（round-111 已同步）；mt.service round-114 已装（登记内已注）。
- **TD-5 结案**：`AuthRequest`/`AuthenticatedRequest` 两变体是有意设计（optional/required 语义即文档），不强行收敛。
- 留尾（不强行清）：TD-8 裸 fetch 收敛（~39 处，跨文件大改单列）、TD-6 剩余 timeseries.ts（10 处 prisma 直连）。

### 2026-09-06 — round-156 批 3b — beef.ts 胖路由拆 service 层（TD-6 主体）：851 → 381 行

- 6 个胖 handler（合计 ~510 行业务逻辑）逐字平移至新 `services/beefPriceQueries.ts`（534 行）：`queryBeefPrices`（过滤器构造 + 分页 + freshness 映射）、`latestBeefPrices`（最新日快照 + imported 趋势）、`beefPriceHistory`（多厂号对比 + 日期窗）、`computeBeefSpreads`（价差聚合数学）、`batchBeefForecasts`（group-by 选优 + 4-worker 预测池）、`beefCutForecast`（taxonomy 校验 + 厂号钉定 + 诚实不可测态）。路由层只剩中间件链 + 薄委托——与文件内 `/by-country → aggregateBeefByCountry` 既有模式对齐；服务抛 NotFoundError/BadRequestError 沿 apiKeys/alerts 等六服务既有惯例。**逐字平移零逻辑改写**：/prices 与 /prices/latest 的过滤器构造差异（relation vs id-set 两种形状）刻意不合并，语义统一另行决策。
- **类型坑（live 修）**：qs 包无类型声明，`ParsedQs` 直接导入报 TS7016——改用结构性类型 `BeefQuery = Record<string, unknown>`（ParsedQs 带索引签名结构兼容，函数内 `typeof x === "string"` 守卫对 unknown 同样收窄），零新依赖。
- **门禁**：tsc 0 / biome 0 / 全量 **1099+1 skip 零回退** / PM2 重启后 **11 个 beef 端点 live 全 200**（含鉴权 + AI 门的 /forecasts 重路径）/ 契约逐位复核：/prices/latest 响应五键与 trend 三键不变、未知厂号 404 诚实规则保持、/beef 页 307 鉴权重定向正常。TECH-DEBT TD-6 同步：beef.ts 关闭、portfolios.ts 条目随 round-144 删除消亡、timeseries.ts（10 处直连）为剩余主体。

### 2026-09-06 — round-156 批 3a — seed.ts 热点拆解：2,696 → 1,174 行（数据模块化，逻辑零改动）

- **拆分**：`prisma/seed.ts` 内联大块全部抽为 `prisma/seed/` 下 5 个纯数据/工具模块——`commodityData.ts`（968 行：COMMODITIES 目录 821 + PRICE_BASELINES 107 + DECLARED_SOURCES + MULTI_SOURCE_SLUGS）、`datasets.ts`（300：DATASETS + 接口 + DETECTION_METHODS）、`beefData.ts`（188：FACTORIES）、`random.ts`（47：rand/randInt/pick/sineWave/withSpike/slugify）、`users.ts`（34：USERS）；主文件只留编排 main()。块内代码逐行平移（in-main 块去一层缩进），零逻辑改写。
- **门禁（seed 无运行时面，验证链完整）**：① standalone `tsc --strict` 对照 git HEAD：错误 **8=8 完全一致**（均为拆分前即存在的潜伏类型瑕疵——prisma/ 历来不在 tsc/tsconfig 范围、tsx 不查类型；3a 零新增）；② `bootstrap-test-db.sh --force` 用新模块端到端重建 mt_test **成功**；③ 数据平价：commodities **84**（目录逐一致）/ commodity_prices 16,531 / factories 20 / users 3 / market_factors 90；④ 全量 backend **1099+1 skip（106 文件）** 零回退。
- **修复的 3 处迁移 import 缺口**（live 发现即修）：seed.ts 补 `TimeseriesDef`、datasets.ts 补 `StorageFormat`、users.ts 补 `UserRole` 类型导入。

### 2026-09-06 — round-156 批 2 + 批 4（覆盖基线部分）— biome-ignore 91→26 + 覆盖率基线首次落表

- **批 2 `eefe946`（biome-ignore 91→26）**：① **7 个图表组件迁共享 `dynamicRecharts()`**（AnomalyChart/PredictionChart/BacktestDetailChart/AlertDistributionChart/ModelPerformanceBarChart/AccuracyTrendChart/performance 页 + 批 1 的 CommodityPriceChart），消灭全部本地 `dynamic() + as ComponentType<any>` 样板；工厂目录随扩 Scatter/Cell/ReferenceLine（BarChart 原已在内——早前 grep 误判漏看，live 撞重复后修正）。迁移暴露并修复旧 any cast 掩盖的 **recharts formatter 真实类型缺口 3 处**（CommodityPriceChart ×2 批 1、AlertDistributionChart ×1），AccuracyTrendChart 迁移中误吞 `WindowSize` 类型定义 live 发现即还。② **28 处索引 key 改稳定字段键**：营销静态数组用本体字段（feature 文本/stat.label/faq.question/step.title/modelId/商品名对），数据行用业务复合键（seriesLabel-modelId、date-factory、source-type 保留）；随清理未用 index 参数 ×14。③ 终态库存 26：noExplicitAny 41→**5**（beef/swr 文档化契约、Table 泛型 API、useTradingData ×2 API 形状缺口）、noArrayIndexKey 37→**8**（DB 回滚行号重复/用户可编辑列表可重复/装饰占位等，均带理由注释）；a11y 5/img 3/依赖抑制 3/断言 2 为批 2 范围外遗留。门禁：tsc 0、biome 0、jest 360 零回退、build 0、PM2 前端重启、pricing/about/performance live 200/307 正常。
- **批 4（覆盖基线部分，零代码改动）**：双端 `test:coverage` 首次产出报告——**backend 语句 70.82% / 分支 62.39% / 函数 76.35% / 行 72.26%；frontend 语句 39.68% / 分支 69.72% / 函数 50.43% / 行 39.68%**（前端低数主因 44 页仅 ~9 页有直接测试，与批 3 拆解/批 4 补测排期呼应；D28 维持"可见不加门"）。两个 flaky 项无需动代码——round-153 已重新定性为并行负载型（KNOWN-ISSUES 在案），非日期/确定性缺陷。coverage/ 产物已 gitignore 不入库。

### 2026-09-06 — round-156 批 1 — biome 34 条清零 + 日志级别归位 + 过期登记关闭

- **backend（23→0）**：生产源码 5 处手工精修——cadence.ts 两处 `case "daily":` 冗余落空分支删除（行为等价，default 同值）、server.ts unhandledRejection 未用参 `_promise`、beefIngest.ts 判空改可选链、dataHealth.ts `daysSince(d)!` 断言改内联计算（诚实窄化）、dataIngestion/index.ts 删 inacScraper 休眠导入（墓碑注释保留）；测试文件 18 条经 `--write --unsafe` + 1 处手修（watchlistService.test:262 可选链后断言改 `toBeDefined` 守卫——unsafe 自动修在此造出更高严重级错误，live 发现 live 改）。
- **frontend（12→0）**：CommodityPriceChart 迁移至共享 `dynamicRecharts()`（消灭 5 条 `as ComponentType<any>` + 1 条既有压制，顺带去重本地 dynamic 样板；迁移暴露旧 any cast 掩盖的 Tooltip formatter 真实类型缺口 2 处，按 recharts 官方签名改宽）；CutForecastSection `forecast!` 改守卫窄化；ImportResultTable 复合 key 加理由压制（DB 批回滚致行号重复，索引保唯一——文档化合理用例）；useDashboardStats.test 4 处 `(key: any)→(key: unknown)` 并删随之失效的 3 条旧压制；beef.ts/swr-fetcher.ts 两处文档化故意 `any` 契约加理由压制（重定型归批 2）；forecast 页测删未用 React 导入。
- **日志归位**：useRetryableFetch 两处 dev-guarded `console.log` 按语义改 `console.warn`（重试错误路）/`console.info`（成功恢复），与邻居 console.error 惯例一致；backend 命中项为字符串内示例命令（非调用，不动）。
- **过期登记关闭**：KNOWN-ISSUES 所载"frontend tsc 2 个既有类型错"（round-152 登记）实测已消失（净树 0 错退出码 0，后续轮次顺带修复未定位归属 commit），登记划线关闭。
- **门禁**：biome 双端 0 findings（34→0）；tsc 双端 0 错；backend **1099+1 skip**（106 文件）/ frontend **360** 零回退；build exit 0（41/41 静态页）；PM2 重启 live 全绿（front 200 / health ok / inference 200 / market-news 307 鉴权重定向正常）。

### 2026-09-06 — round-156（进行中）：代码质量轮批 0 — 生产依赖漏洞清零（backend 7→0 / frontend 57→0）

第十波 v3.8.0 首批（方案入库 `8af627c`）。`pnpm audit --prod`（npmjs registry）双端归零。

- **根因发现**：`shadcn` CLI（源内零 import）混在 frontend `dependencies`，把 `@modelcontextprotocol/sdk` → hono / @hono/node-server / express 5 / body-parser / qs / express-rate-limit→ip-address / ajv→fast-uri 整条工具链拖进**生产**审计面 → 移入 devDependencies（工具保留，风险面剔除）。
- **frontend 升级**：next ^15.5.20→^15.5.25（SSRF×2 / 内部信息泄露 / 图像 DoS 四公告，15.5.x 线内 patch，D29 未启用；其 sharp 范围已含 ^0.35.4）、js-cookie ^3.0.1→^3.0.8（原型劫持 high）。**overrides 治理**：过期钉更新（postcss ^8.5.10→^8.5.23、brace-expansion ^1.1.13→^1.1.18）、dev 侧专属钉移除（hono ^4.12.16 / ip-address ^10.1.1，随 shadcn 移 dev 后退出生产面）、新增 sharp ^0.35.4 / browserslist ^4.28.7 / @babel/core ^7.29.6。
- **backend overrides 新增**：fast-uri ^3.1.6（swagger 链 ajv，6 公告）、js-yaml@<4.3.1→^4.3.1（omap 二次复杂度 high）、qs ^6.16.0（express→body-parser 链，2 公告）。
- **门禁**：audit 双端 0；tsc 双端 0 错；biome 34 条与基线持平（批 1 范围）；backend **1099+1 skip** / frontend **360** 零回退（零用例改动）；next build exit 0；PM2 重启（backend+frontend，inference 未动）。live：front 200、/health ok、digest 6 序列、/market/digest 200、login ok、`trade-flows?hs=020230` 经 qs 6.16 查询串解析 6 国 + 24 期 history + arFobTotal 全绿；sharp 0.35.4 就位但源内零 `next/image` 使用（休眠 optional，无行为面）。

### 2026-09-06 — round-155：产品范围收敛轮 — 国产维度完全删除 + 外贸信息面丰富（五批全门禁）

用户指令"当前项目只负责牛肉外贸市场的预测"→"完全删除国产维度，丰富外贸维度的信息"。

- **批 A `3e4f57f`（删国产 UI 与聚合契约，前后端同批）**：/beef 页 origin 筛选（all/imported/domestic 三态按钮、disabled 诚实禁用、domestic 空态）整体移除；`useDashboardStats` 删 `domesticAvg/domesticTrendPct`（保留 imported 字段）；dashboard 删"国产均价"hero 卡与 DOMESTIC_ICON；后端 `beefQueries.originSplitAvg→importedAverage`（单桶均值，无 country 行不计入的行为钉住不变）、`BeefTrendSummary` 删 `domesticTrendPct`、/prices/latest 契约同步；analysis/origin 页 CN 标签删除。测试：beefTrends 7 用例重写（CN fixture 随组删）、useDashboardStats 2 用例改 imported 口径。live：trend 键只剩 importedTrendPct/latestDate/previousDate。
- **批 B `e7c3761`（数据层删除 + 源退役 + 生产库操作）**：seed 删 27 个 `_cn` 商品（10 国产部位 + 国内活牛/谷物族 + 11 条 `*_wholesale_cn`）及其 PRICE_BASELINES/wheat_cn 多源 fixture/`originCountry!=='CN'` 死条件/MOFCOM 国产新闻 fixture；`china_wholesale` 双处注册移除（文件保留，墓碑注释写明非国产维度回归不重挂）；api-workflows 目录断言 ≥100→≥80（seed 111→84）。**生产库**：定向备份 `backups/round155-domestic/`（27 商品 + 180 价格 + 4637 预测 CSV）→ 事务删除（PredictionLog 无外键显式删；价格/关注走 FK Cascade；123 条 `cut:` 虚拟键"孤儿"为历史 cut 预测行，与本次删除无关）；mt_test `--force` 重建。live：search 搜"国产"零命中、commodities 0 个 `_cn`（86 total）、sources 面板无 china_wholesale。首跑 4 挂为 --force 后冷缓存已知 flaky（T3b 口径复跑全绿 106 文件）。
- **批 C `2eeb4cd`（贸易流读侧深化）**：`getTradeFlows` 增 `TradeFlowEntry.history`（每国最近 24 期、oldest-first——take 400 本就在手只回最新 2 点）与 `arFobTotal`（export_fob_carnes 最新月全目的地出口额上下文）；TradeFlowsCard 重写：HS 切换器（8 条 pinned lane：0201/0202/020220/020230/020610/020621/020622/020629 中文标签）、月度量柱 + FOB 价线 ComposedChart（国家 pill，年度 lane 不进图）、数量环比/月度金额（百万 USD）两列、阿根廷上下文行；recharts-lazy 增 ComposedChart 导出。**live 发现并根治测试隔离 bug**：node-redis 4.7.1 变参 `del(k1,k2)` 实测只删第一个键——本套件 spread 清理一直泄漏 `hs=0202` 缓存键满 3600s TTL，向下一轮直出陈旧响应形状（本轮新 history 断言首次暴露）；beforeAll/afterAll 改逐键删（生产 `del` 调用点均为数组形式，实证不受影响）。缓存键由默认 keyGenerator 含 query string 天然分 hs——live 三码（0202/020230/020629）各 200 无串键。+4 前端组件测试（HS 切换/图表渲染/年度无图降级/401 整卡省略）+ 后端集成扩展（history 顺序/arFobTotal）。
- **批 D `4fbc504`（外贸可见面）**：`PUBLIC_DIGEST_SLUGS` +1 `beef_90cl_us`（白名单相等性契约测试同步；digest 节奏逻辑 interval-generic——weekly 走"本周=上一周度点"+cadence.ts 21d 窗口，零新分支）；dashboard hero 第二卡由已删的国产均价卡换为**"进口 90CL 周度基准"**（USDA NW_LS421，USD/cwt，与 /market/digest 同源一致；trend=上一周度点环比，库中单点时诚实 null）。D25（贸易流公开）维持鉴权内不动。live：digest 6 序列、90CL ok（348 USD/cwt @08-28 weekly stale=false）、digest 页 200。
- **文档对齐（批 E）**：PRODUCT-SPEC §一定位句去"国产"+round-155 修订注记、§四 IA 图/映射表删国产行、§5.1 hero 图与注记（三卡=全球牛肉价/进口90CL/AI）、§七 爬虫 19→18 注册、§九增补"国产维度不回归"；IMPROVEMENT-PLAN v3.7.0 第九波块（D16/D22 随维度关闭）；KNOWN-ISSUES D1 追加 2026-09-06 更新；AGENTS.md §三 18 注册+头注日期+定位句（收编上会话遗留的路由 18/页数 44 修正与 SKILLS.md 登记）。
- **基线**：backend **1099+1 skip**（0 净变化）、frontend **360**（356→+4）、inference 61 未动；三服务 PM2 重启后在线。剩余用户侧解阻清单不变（MLA/USDA key、CSV 周导入、域名、SMTP）；批 0a 值守窗（FRED 8 月点，源头确认尚未发布）继续。

### 2026-08-31 — round-153：数据维护轮 — ingestion 三修 + 数据文档对齐（world_bank 幻影更新 / fred 免 key 复活 / T3 重新定性）

用户目标"解决与数据有关的其他问题，维护项目数据相关的文档"。两代码批（独立 commit、全门禁、live 验证）+ 文档对齐批。

- **批 A `8fb2d92` — fredCsv 6dp 舍入 + world_bank noChange 契约**：`commodity_prices` OHLC 列为 Decimal(18,6)，FRED CSV 原始值带 14 位小数（live 实证 PPORKUSDM 89.61709686727274 vs 存储 89.617097），samePrice 永不成立 → **world_bank 每次 boot/定时运行幻影重写 23-35 行**（该幻影更新同时掩盖了 noChange 契约缺失）。修复：共享模块 `fredCsv.ts` 解析边界统一 6dp 舍入（同源覆盖 cme 日度通道同类隐患）+ 返回 `seen` 计数；worldBankPrices 据此对"月中重扫 0/0 有数据在手"返回 `noChange:true` → 分类 success。live：boot run `world_bank success 0/0 (unchanged)`（此前 success 0/23-35）。+6 测试（fredCsv 舍入×3 + noChange 契约×3）。
- **批 B `2ab1fa9` — fred 免 key fredgraph.csv 回退**：原源每周期硬跳过（"Missing FRED_API_KEY" error ~30 行/36h）。现无 key 走公开 CSV 下载（与 fredCsv.ts 同端点）、有 key 升级 JSON API；写入环统一 12 观测截断 + 6dp 舍入 + `fetchPath` 溯源（api|csv）+ noChange + HTML 错误页守卫。**首轮 live 暴露 5 个休眠期不可见的错误 series id 并修正**（PALLFNFINDEX→PALLFNFINDEXM、PCOPPUSD→PCOPPUSDM、PWHEAMTUSD→PWHEAMTUSDM、PCOTTIND→PCOTTINDUSDM、PSUGAUSA→PSUGAISAUSDM，均 live 探针核实）；BALTIC_DRY 非 FRED 序列移除（BDI 归 baltic_dry 源）。live：**market_factors 15 序列×12 观测**（dailies 至 08-25/28、monthlies 至 07-01），error 噪音归零，FRED_API_KEY 转可选。+2 测试。
- **T3 重新定性（KNOWN-ISSUES）**：backend 全量偶发 1 挂**非"月末日期敏感"而是并行负载型**——08-31 19:01 挂点漂移到 signals.test.ts（30s 超时，隔离 1.5s 全过；同日另两次全量全绿；restore SQL 锚定月首无日溢出路径）。顺带登记门禁卫生：`vitest run | tail` 的管道 exit 0 会掩盖失败（本次实录），门禁命令须带 `PIPESTATUS`。投机性 timeout 上调不采纳（会掩盖共识链路真实性能回归）。
- **数据文档对齐**：API.md 补 `GET /api/market/trade-flows` 行（round-152 批 4 此前漏登）；PRODUCT-SPEC §七 数据层两行重写——牛肉价格行（免 key 活水已开/冻结面收窄至部位级，全部 2026-08-31 live 实测）+ 新增对华贸易流量层行；KNOWN-ISSUES D1 追加 round-153 更新。基线：backend **1099+1 skip**（1092→1100，+8，零回退；挂点漂移证据见 T3）；frontend/inference 未动。
- **未动**：T3a（useTradingData.test.ts 两 tsc 错——该文件正被并发会话修改，不擅动）；批 1/3 用户门（单一窗口账号/data.gov key）不变。

### 2026-08-31 — round-154：方案维护轮 — PREDICTION-STRATEGY §八现行大模型预测方案入册（round-151/153 认知收敛）

用户目标"针对这一轮对于模型预测的认知，维护项目使用大模型进行预测的方案"。docs-only（零代码改动，无测试门禁可跑；本节数字均引自已入库证据文档 RESEARCH-LLM-NUMERIC-FORECASTING v1.0.0 与 backtests/beef-model-settings-2026-08.md）。

- **PREDICTION-STRATEGY.md 新增 §八（现行方案维护）**，四部分：① §6.2 七条规范现状核对——v3.1.0 批 0-7 全部执行完（round-138 收官）后，规范 1/3/5/6 已 live（准入协议两次实际应用 / per-series 路由 / 方向准确率双榜 / payload 种子 760f825），规范 2 证据升级（等权均值组合 +5.3%、8 格无负），规范 4 月度覆盖率审计仍登记未做，规范 7 track-record + 周快照 live；② §8.2 定案设置——ARIMA(2,1,1) 点值锚（不换阶，跨序列证据）+ 无季节 Holt-Winters（已入生产，含历史 verified 口径不可比警示）+ Chronos 三变体留池交序列本地路由（p90 随容量单调恶化 220→357→531）+ 等权均值组合对照线，附否决清单（12 月季节全家 / chronos 上下文截断 / RF / ARIMA 换阶，标注"勿重试"）；③ §8.3 前沿取舍表更新——chronos-2 已按门禁测关（round-138 臂 B）、TimesFM 3.0/Moirai-MoE 许可排除（2028-11 重评候选集收窄）、Bolt 2.3.1 仍无修复维持不可用、微调三重依据（红线+官方门槛+重开条件）、RF 实测否决并关闭 R8 树模型备注；④ §8.4 登记增量——R2 组合对照线（第 10 个受验证 model id，载体留批次）/ R1 MASE 技能分 / 2026-09 FRED 值守窗 / ~2026-11 beef 路由激活 / 2028-11 领先指标重评 / R5 基差分解。
- **顶部失效标注块后补维护指针**：§六"落地"列与 §七 7.1/7.5 批 3/批 4 相关行已过期，现行方案以 §八为准（§六/§七 保留作规范原文与借鉴存档）。INDEX.md 行描述同步更新。
- 注：AGENTS.md 导航表中本文档日期（2026-08-16）本轮未刷新——该文件有并行会话未提交改动，避免混入提交，留待下次触碰 AGENTS.md 的轮次顺带更新。

### 2026-08-31 — round-153：实验轮 — 牛肉价格预测模型设置实验 + holtwinters 月度去季节落地

用户目标"根据调研报告，尝试不同的模型设置，寻找最适合牛肉价格预测的方案"。输入 = round-151 调研报告 R2/R8，实验协议与 round-136 批 1 完全一致（rolling-origin + MAPE/方向口径，新增 MASE 中位与相对 naive 技能列）。

- **实验矩阵（32 配置 × 4 序列 × 2H）**：`inference-service/experiments/model_settings_beef.py`（psql 导出序列 JSON → 本地 statsmodels/sktime/sklearn 变体 + 经 10810 服务的 Chronos 上下文变体 + 组合 10 种）。主证 `beef_carcass_us`（195 点/36 origins）+ 三条月度验证序列（retail/pork/poultry，126-127 点/24 origins）防单序列过拟合。首轮发现实验脚本 ETS 包装 bug（seasonal_periods 未传 statsmodels），修复后全量重跑；统计侧两次重跑逐位一致，chronos 侧仅 2/864 行因与生产刷新并发 RNG 交错有微差（引擎已声明的边界）。
- **最适合方案（结论）**：牛肉月度 = ARIMA(2,1,1)（跨 8 格最佳单模型 +4.0%，**不换阶**——(0,1,1)/(1,1,0) 仅 carcass 局部优、跨序列全负）+ 无季节 Holt-Winters（平均技能 +7.0%/平均秩并列第一，牛肉 3/4 格优、方向 4/4 优，carcass H=3 方向命中 85.3%）+ Chronos 三变体留池交 per-series 路由（carcass H=3 全负 -15.5~-63.6% 但 retail H=1 +20.9%/poultry H=1 +32.6% 为全场最优）；**等权均值组合 = 全场最稳单一配置**（comb_prod7_mean 平均 +5.3%、8 格无负）——组合预测之谜在本仓数据复现，R2 证据落袋（第 10 个受验证 model id 的工程载体留批次）。**拒绝清单**：12 月季节全家（hw_p12/snaive12/theta-sp12 全崩）、chronos 上下文截断（不稳健）、RF 树模型（-45.5%，兼红线）。
- **生产改动 `predict_holtwinters` 节奏感知**：timestamps 中位步长 ≥28 天（月度）→ 不加季节项；日度/缺省 timestamps 行为逐位不变（向后兼容）。引擎 predict() 将 timestamps 传入 holtwinters 分支。测试 61→**64**（+3：月度=无季节拟合逐位一致/日度保持 p7/缺省保持日度语义），ruff 全绿，PM2 重启后 live 双口径验证：真实牛肉月度序列经服务输出与 trend-only 参考逐位一致（≠p7 参考）、日度对照仍 = p7；/ready 3 pipeline 零失败。注：月度 holtwinters 的历史 verified（旧 p7 口径）与新预测不可直接比，30d 质量窗将滚动到新口径。
- 报告：`docs/backtests/beef-model-settings-2026-08.md`（完整表 + 跨序列矩阵 + 拒绝清单 + 局限）。方向命中样本 22-36/格（±~12pp 置信区间），只作方向性证据。

### 2026-08-31 — round-152：执行轮 — 第八波 v3.6.0 批 0+2+4 全落地（Comtrade 镜像贸易流通路 + 阿根廷月度降级分支 + 贸易流读侧面）

用户指令"是否存在可以自动打通的数据通路，将可以自动操作的项目先完成"。三批独立 commit 全门禁（tsc/biome/全量测试/构建/PM2 重启/live 验证）。批 1（单一窗口账号）/批 3（data.gov key）有用户门未动，批 5 观察项值守。**轮次注记**：三笔代码 commit 消息中的 "round-151" 为并发会话撞号（调研轮 1da44f3 同号在先），本执行轮定名 round-152，以 SHA 区分为准。

- **批 0 `6afc196` — comtrade_mirror 源（P0 主批，免 key 零外部依赖）**：UN Comtrade 公共预览 API 出口国镜像——月度活 reporter {BR/AU/NZ/US}×8 牛肉 HS（0201/0202/020230/020220/0206 族）×flow=X×partner=156 + {AR/UY} 年度回退 + 中国年度 CIF 校准线（`import_cn_cif_*` 独立 type，与 FOB 镜像绝不合并）。全部实测坑写入实现与测试：motCode==0 过滤（运输方式拆行裸和≈2×）、flowCode 必须 X/M、period 单值限制（cmdCode/partnerCode 逗号批量替代）、~1 req/s 限速（2s 间隔+瞬态重试）。37 个月回填 161 查询→928 行（6 区域×8 HS×37 月度时点，2023-07→2026-07）；live 验收与贸易报告**逐位对齐**（BR 2026-06 0202 = 158,364,760kg/$1,069.2M/$6,751/t；中国 2024 CIF 校准 7 行全中：AR 3723/AU 6462/BR 4621/NZ 4410/US 9308/UY 3318/全球 4600）。**noChange 精度修复（live 发现 live 修）**：MarketFactor.value 为 Decimal(18,6)，裸浮点单价永不等库内截断值 → boot run 出现 111 行幽灵更新击穿 sameFactor no-op；解析器预圆整 6 位小数后复跑 → unchanged/success 0/0（freshness 板 healthy）。**D23 执行**：china_customs_stats 双处退役（虚构端点+主机封锁零产出，ingestion_logs 历史全 warning 0/0 佐证；文件保留待官方平台复活），源注册数 19（AGENTS 已同步 21 文件/19 注册）。+10 测试（mot 陷阱/单价实测值/双口径航道/年月日期/坏行丢弃/URL+查询集契约钉住）。
- **批 2 `30b3440` — argentina_exports 源（计划降级分支兑现）**：序列定位证实 datos.gob.ar **无牛肉×目的国月度交叉**（SSPM 75 产品族无目的国、77 目的国无产品——缺口登记，INDEC NCM 附录/SENASA 留观察）。落 `ica_carnes`（SSPM 75.3 月度 CSV 直链，1992 起、t-2 新鲜、免 key）：type=`export_fob_carnes`/region=`AR→WORLD`/USD M（刻意不用 export_to_cn_* 语义——无目的国无数量即无单价）。schema 漂移全有或全无（缺列 0 行→warning）、Decimal(18,6) 同款预圆整、noChange 契约。live：boot run 414 行 CSV→36 月窗口 34 行入库（2023-09→2026-06）。+5 测试。
- **批 4 `65b1157` — 贸易流读侧最小面（D25 鉴权内起步）**：`GET /api/market/trade-flows`（authenticate；zod hs 枚举钉住源模块 HS_CODES 单一事实源；cacheRoute 3600s）——分国别最新月量/价/环比 + 年度回退线区分（freq A 无环比）+ 中国年度 CIF 校准**并列表** + 口径注记 3 条强制随载荷。**stale 语义 live 修复**：初版 75 天墙钟阈值把 t-2 正常节奏源（AU/US）误标 stale，改月差>3 月（UY 年度 2024 仍诚实 stale）。/beef 页新增"对华贸易流"卡（TradeFlowsCard：分国别表 + CIF 校准子表 + 注记页脚；匿名访问卡片自省略——forecast 列同款降级；Array.isArray 防御让页面测试的异形 mock 载荷安全跳过）。+4 集成测试（mt_test 自播自清 + Redis 缓存键清理——键为 Router 相对路径 `/trade-flows`，live 复核）。live：BR 2026-07 $6,398/t 82,714t MoM −5.2%、NZ $5,556/t +5.7%，与研究报告一致。
- **基线与登记**：backend **1091+1 skip**（+19）、frontend **354**（基线 352 上零回退）、inference 61 不变 = **1546**。KNOWN-ISSUES：D1 补 2026-08-31 更新（贸易流量价层脱离 D1——免 key 已通，china_customs_stats 退役实证）；新登记 T3 两处**既有**门禁噪音（frontend `useTradingData.test.ts` 2 个 tsc 类型错，净树复现非本批引入；`mapeTracking.monthly.test.ts` 月末敏感 flaky，8-31 当天 3 跑 1 挂隔离即过）。AGENTS 源计数同步（21 文件/19 注册）。三服务 PM2 重启后在线。

### 2026-08-31 — round-151：调研轮 — 数值预测与大模型实践调研报告（RESEARCH-LLM-NUMERIC-FORECASTING v1.0.0）

用户目标"重新获取当前服务器的状态，重点关注预测数值变化的模型使用的方案，调研量化金融和肉类贸易等相关实践，学习其他相关项目是如何使用大模型来实现数值预测的"。docs-only 调研轮（round-148 同例），三路外部调研走三个并发子代理（量化金融 / 肉类农产品 / 开源 TSFM 工程），关键承重声明经独立批评代理复审（初稿 5 处硬伤修正后定稿）。

- **服务器/预测链路现状复查（全部实测）**：三服务健康（/ready 3 pipeline 零失败）；prediction_logs 201,456 行四状态分布、10 个 model_id 精度双口径（中位/p90）——**新读数：chronos p90 随容量单调恶化 220→357→531（更大模型=更重尾部），统计基线 p90 仅 16-18**；`sundial`/`timer_xl` 为已移除的在线训练反模式残留（verified 各 10 条，2026-07 停更）；牛肉月度 28 行（7 模型 × H∈{1,3,6,10}）锚定 2026-07-31，**H=1 对账日=当日（2026-08-31），等 FRED 八月实值**，H=6 的 7 行为 D5 政策性 stale（round-136 遗留行处置）；代码级方案梳理（种子/信号量/pipeline 缓存/质量加权投票/加权中位数/per-series 路由/验证生命周期）+ 补录 round-136 批 1 牛肉月度滚动回测结论（chronos 淘汰结论 H=1 不成立/H=3 成立、arima 冷启动冠军、原生区间欠覆盖 58-78%）。
- **量化金融业界实践**：组合预测之谜（M4 最佳可复现方法=简单平均）、回测卫生（DSR/PBO）、LLM 落地位置=文本→特征（Lopez-Lira & Tang + alpha 衰减/记忆污染两告诫；IndexGPT 仅商标）；**Tan et al. 引用纠偏**（"打不过统计基线"非原文、官方代码仓 BennyTMT）；"语言模型骨干 vs 数值 token 化（Chronos）"两范式区分经原文复核成立。
- **肉类/农产品实践**：USDA WASDE=模型+判断共识制（其区间覆盖率曾被评 48%/35%）；Expana 公开批判"95% 准确率"（naive 不变预测 1 个月即 95.7%——准确率口径=100%−偏差）；基差分解范式（BeefBasis 68% 区间口径、no-change 基差最难打败）；arXiv:2601.06371（TSFM 零样本胜 USDA ERS 月度基准，无牛肉=MT 场景即增量）；ABARES=公开预测评估的政府先例。
- **TSFM 工程全景**：12 模型表含**许可商用性核查**（TimesFM 3.0 权重 non-commercial、Moirai-MoE CC-BY-NC → 商用排除；Chronos 家族全 Apache-2.0）；AutoGluon 官方微调门槛（>100 序列 & 中位长度>3×h——MT 不达标，与"只用预训练"红线互证）；GreedyEnsemble（Caruana 贪心）机制；**chronos-forecasting 2.3.1=最新版且无 Bolt 修复记录**、chronos-2 已被 2.1.0+ 原生支持且权重已在本地缓存（round-138 臂 B 已测未采的事实校正入册）。
- **启示 R1-R8（只登记增量）**：R1 验证环补相对 naive 技能分（MASE，未登记）；R2 "组合预测"作为第 10 个受验证 model id 对照线（载体级增量）；R3 挑战者路径校正（批 3 已关闭/重评 2028-11 + 许可排除确权）；R4 微调门槛证据落袋（重开条件=序列聚合>100 条）；R5 基差分解建模候选（挂 90CL 周度数据积累）；R6 LLM 文本实验两告诫；R7 叙事弹药三件（ABARES/Expana/arXiv 2601.06371）；R8 GreedyEnsemble+特征表版本化借镜（低优先）。**总判断：无"必须改道"信号，无"被错过的机会"，增量全部在外围面。**
- **顺手修正**：AGENTS.md `exponential_smoothing`"二次"→"简单/一次"（与 `trend=None` 实现不符，/models 自述同口径）。

### 2026-08-31 — round-150：执行轮 — 第七波 v3.5.0 批 1+2+3 全落地（进口周度基准 + 独占位强化 + 规格维度载体）

用户指令"按照计划开始"。三个独立 commit，每批全门禁（tsc/biome/全量测试/构建/PM2 重启/live 验证）。

- **批 1 `e59a751` — 进口周度到岸基准（计划主批，载体经取证置换）**：批 1 首步取证即推翻原计划载体——MLA 90CL 页的数据面是 **Power BI Embedded**（壳体 `getembedinfo` 端点返回 accessToken + app.powerbi.com embedUrl；导出按钮被 `export_functionality:false` 禁用；无浏览器 + JS SDK `visual.exportData()` 拿不到数据，cron 摄取不可行）→ 按计划降级条款登记。替代载体为**同市场的官方原始上游**：USDA AMS **NW_LS421「Import Beef Trade」周报**（`www.ams.usda.gov/mnreports/ams_2823.pdf`，免 key、稳定 URL、固定版式；TXT 路径 2020 年已死，现行载体即 PDF）。新源 `usda_import_beef`：PDF → `pdftotext -layout` 管道（宿主 poppler-utils，setup.sh 已登记依赖）→ 状态机解析（跨页 section、可选西岸列、坏区间丢弃；真实 2026-08-28 文本为 fixture 的 10 个解析测试）→ **全有或全无写入**（版式漂移=0 行 + warning，绝不写错形数据）→ `CommodityPrice` 新序列 **`beef_90cl_us`**（weekly / USD/cwt / AU-NZ Cow Meat 90% East Coast 0-15d 区间中值）。**口径注记**写死在 commodity metadata（世行月度 2024-01 起新西兰 90CL c.i.f.，与本序列 F.O.B/T.I.S. 措辞不同且历史不可拼接）。weekly cadence 全链路：`getPriceHistory` 回退链 daily→weekly→monthly、`batchLatestPrices` cadence 循环（周链接通前商品列表 interval 显示 daily 且无最新价——live 发现并修复）、/trading timeframe 选择器对非 daily 系列诚实隐藏（+3 前端测试）。**noChange 新契约**（ScraperResult 可选字段）：周报挂日更周期的确认无变化重扫（upsertPrice samePrice 0/0）分类为 success/healthy 而非 empty/silent-failure——否则周度源 6/7 天被误报"疑似静默失败"。预测订阅硬门（daily / monthly-and-not-daily）结构上排除 weekly，ADR-0001 horizon=步长语义零扩张（计划边界兑现）。live：boot runAll 写入 90CL 2026-08-28 342-354（close 348）、手动刷新幂等（0/0 unchanged）、sources 面板 healthy/direct、`/commodities` interval=weekly+latestPrice 348、daily 请求回退返回周行、匿名 /trading 307 登录门不变。
- **批 2 `0b7f391` — 独占位强化（进口获客导向）**：`/tools/landing-cost` 白名单第四源 `beef_90cl_us`（"美国进口 90CL 周度到岸基准（USDA NW_LS421）"，周度窗口 12 点 + 周度点文案 + 单点诚实降级注记；live：348 USD/cwt → 7.6721 USD/kg → 51.56 CNY/kg）。landing Features 新增公开计算器卡（FX × 基准 × 关税 → 到岸 RMB/kg 决策场景文案）+ AI 预测卡挂公开 track-record 链接；about 方法论卡补"战绩公开——对错都发"机制陈述并链接 /ai/track-record。文案只陈述自身机制与事实，不点名竞品（D18 兑现）。digest→track-record / digest→landing-cost 双入口核实已在（round-146 批 3），无需重复。
- **批 3 `1a99695` — 报价规格维度载体（进口盘口词汇对齐，零迁移）**：CSV 导入五个**可选**规格列 `feedingMethod / feedingDays / vendorLabel(VL) / breed / storage`（白名单约束键、值保持运营者原文）→ `BeefCutPrice.metadata`（该 Json 列一直存在未用）；`extractSpecDims` 纯函数（5 单测：全规格/部分规格/空单元格丢弃/坏 feedingDays 报错/未知列忽略）+ 导入集成测试（mt_test，2 例：全/部分规格行落库验证、坏 feedingDays 跳行）；模板端点与导入页文档列清单同步；cut 详情价格表新增 **Spec 列**（有则渲染、无则 "—"）——部位级数据复活（key/CSV）前的载体准备，不做展示承诺（计划边界兑现）。
- **网络封锁图谱细化（KNOWN-ISSUES 登记）**：同域不同主机可达性分层实锤——`mymarketnews.ams.usda.gov` 与 `marsapi.marketnews.usda.gov` **000 主机级封锁**，而 `www.ams.usda.gov` 与 `mpr.datamart.ams.usda.gov` 200 可达（后者 API 需登录，未采）；批 1 的载体选择正建立在这张图谱上。`lm_xb403.txt` 编号已改挂每日箱装牛肉 cutout 报告（ams_2453.pdf 2026-08-28 现势实测）。
- **基线**：backend **1072+1**（101→102 文件，+18）、frontend **352**（40 套件，+3）、inference **61** 不变 = **1485**（1464→+21，零回退）。爬虫 18→**19**（AGENTS.md 已复核更新）。三服务 PM2 重启后在线，healthcheck 绿。
- **剩余**：批 0a（时间门 2026-09 中下旬）/ 批 0b（样本门）未到；D20（watchlist 粒度）/D22（新发地，默认不做）维持；用户侧进口解阻清单不变（MLA/USDA key、CSV 周导入、域名/SMTP）。

### 2026-08-31 — round-149：规划轮 — 参照调研报告制定第七波 v3.5.0（国内数据破局 + 国际免费层补强 + 独占位强化）

用户指令"参照调研报告的内容，制定后续的开发方向"。docs-only 规划轮（round-145/141 同例），输入 = round-148 调研报告 §九九条启示，全部规划前事实经只读复核。- **IMPROVEMENT-PLAN.md 新增第七波 v3.5.0**（版本 3.4.0→3.5.0，报告入 related_docs）：启示 9 条逐条处置——3 条转批次（新发地源接入 / MLA 90CL / 独占位强化）、2 条转决策项（规格维度 D19、watchlist 粒度 D20）、1 条登记候选（海关 HS D21）、1 条证据登记（卓创价格带，paywall 延后不变）、2 条无动作/不做确认（USDA 入口改版排除错误假设；PRA 转售红线）。
- **批 1（主战场）新发地国内部位级源**：国内价格维度 0→1 的唯一免费破局点。解析侧过滤 `prodPcat==='牛肉类'`（服务端参数不生效、"花牛"苹果反例钉测试）、品名→cutCode 走既有 normalizer（覆盖度已核实，补 牛上脑/牛百叶/牛柳 等别名）、落点=Factory 市场实体 XFD（D17，AU-NAT-MLA 先例、metadata.kind=wholesale_market）、元/斤→CNY/kg、beef 页国产筛选自动解除 + **口径诚实标注（国产批发价 ≠ 进口港口价）**、CN 部位预测随新鲜度门自动解锁。首步连通性探针（海外 egress 风险，chinaWholesale geo-block 先例）；ToS 未验证 → 限速 + KNOWN-ISSUES 登记。
- **批 2 MLA 90CL 周度**：走免费公开页**不依赖空 MLA_API_KEY**（与 mlaNlrs services API 两路径独立，已核实）；CommodityPrice 新序列 beef_90cl_us（weekly）；世行口径三次切换史强制 provenance 注记；**不开周度预测**（ADR-0001 节奏语义不扩）。首步页面取证。
- **批 3 独占位强化**：报告 §7.3 样本内无人公开对错档案 → track-record 叙事位与交叉入口（公开性已核实 PUBLIC_PATHS）；landing-cost 样本内独占 → 获客入口与场景文案。文案只陈述自身机制不点名竞品（D18）。
- **批 4 规格维度前瞻（D19 建议 metadata 先行零迁移）**：牧集五维+惠农三维入 BeefCutPrice 既有 metadata Json 列；国际源词汇映射表入 docs；量级证明后再评估升列。
- **决策项 D17-D21、不做清单新增五项**（PRA 转售/爬墙、周度预测、全量回溯滥用、竞品点名、五端分发）；批 0a/0b 与用户侧待办全部承接不变。执行顺序：批 1（探针先行）→ 2 → 3 → 4，每批全门禁。
- **基线**：无代码改动；backend 1054+1 / frontend 349 / inference 61 不变。
- **同日修订（用户方向澄清：主线=国外牛肉进口/国际贸易）**：初版把新发地设为批 1 主战场，与 PRODUCT-SPEC"进口在前"的定位错配 → 批次按进口轴线重排——**批 1=MLA 90CL**（唯一无需用户输入的进口到岸基准增量；主页面 200 实测 + 数据面定位 NLRS iframe `app.nlrsreports.mla.com.au/prices-markets/ninety-cl/`，实现首步为其数据接口探查；可选取证子项=纳入 landing-cost 白名单第四活价源）；批 2=独占位强化（landing-cost 上升为获客重心）；批 3=规格维度 metadata（进口盘口词汇）；**新发地降级为 D22 观察项**（取证已全部完成备查：接口 200、牛肉行 `prodPcat='牛肉类'` catid 1189/pcatid 1206 实证、"花牛"苹果反例可见；可选未来角色=进口利润空间对侧参照）；**海关源激活批不成立**（chinaCustomsStats.ts 代码完整 HS 0201/0202/0206×六国、生产库零行、stats.customs.gov.cn 000/0.06s 不可达实测——.gov.cn egress 封锁，登记环境阻塞）。新增**进口数据解阻清单**显式化：活的进口腿全是商品级（CME/汇率/IMF 月度），**部位级进口价全面冻结于 2026-04-30**（mla_nlrs 1440 行←空 key、cepea_export 960 行←Cloudflare+ToS、usda_ams 180 行←空 key）——解阻塞钥匙在用户侧（两把 key + CSV 周导入 runbook），不在开发侧。执行顺序修订为：批 1（NLRS 取证起步）→ 2 → 3。

### 2026-08-31 — round-148：调研轮 — 牧集及同类牛肉行情信息网站深度调研报告（RESEARCH-BEEF-INFO-LANDSCAPE v1.0.0）

用户指令：对牧集网等同类牛肉交易信息收集网站深度探查，形成完备调研报告，初版后 review 确保理解正确、角度广、深度深。纯文档轮（无代码改动，测试基线不受影响）。

- **报告**（`docs/RESEARCH-BEEF-INFO-LANDSCAPE.md`，~370 行）：五层供给框架（撮合平台/行情服务商/政府统计/交易所/媒体聚合）下覆盖国内外 17 家——牧集 2026-08-31 现场复核（50 路由、付费墙常量级证据：研报浏览墙 15 本地计数 + 报盘/求购发布配额；**新发现五端分发**：桌面客户端 v1.2.0 直链/H5 端/gateway.mujidigital.com）、**必孚 BTC 深探**（CA 未覆盖的同构玩家：~40 路由含 ArticleFree/Article 显式分流与猪肉副线、会员线下合同制 PDF 取证、美区 iOS 2023 停更 vs 官网 APK 1.8.26）、优顶特/飞熊领鲜/冻品在线/冻品e港/死站群、1688/惠农网挂牌 schema、卓创（**App IAP ¥588-1998/年**，唯一可公开取证的国内个人级价目）/Mysteel 全链条/布瑞克、**新发地（国内唯一免费部位级日更源，公开接口实测 48,668 条）**、USDA/MLA/CEPEA/世行/FRED/Expana/Beef Central 国际全景；横向矩阵（含"对 MT"列）、报价 schema 词汇表、商业模式五型 + 付费墙双假设（加工深度×专业粒度稀缺性）、数据合规框架、用户画像、对 MT 九条启示。
- **Review 闭环**：初版 v0.1.0 后由独立复审代理批判性审读（其自行重做 20 余项 curl 取证），修复 4 处事实错误（优顶特行引证失实→按新华网/21财经/深圳贸促委原文重写并注明"10 年 vs 11 年"口径分歧、世行序列**口径三次切换史**（2024-01 起新西兰 90CL c.i.f.；1995-2021-08 为 85% FOB——长序列拼接不可比）、FRED 195 观测非 196、新发地**服务端类目过滤参数不生效**须解析侧过滤）+ 17 处断言降级（全称否定→公开面样本限定等）+ 增补广度章节（格局演化时间线/数据合规/用户画像/术语表）。报告中全部断言按【实测】/【代理】/【转述】三级标注。
- **顺手修正**：PRODUCT-SPEC §七 D1 括注"3 个 key 已 set 但源站网络封锁"已过期（`.env` 实查 MLA/USDA_MARS/OPENWEATHER 均空值、FRED 行缺失，与 KNOWN-ISSUES D1 现行口径对齐）。
- **对 MT 最可操作的三条新情报**：① 新发地接口可评估对接（注意解析侧过滤 + ToS 未验证需限速）；② MLA 90CL 周度指标（与世行现行 90CL 口径一致）可扩展现有 mlaNlrs 源；③ `/market/digest` 与 track-record 两个空位 + `/tools/landing-cost`（样本内无同类公开计算器）经 17 家交叉印证。
- **round-147 "意外观察"揭晓**：其所见来源不明的 `docs/RESEARCH-BEEF-INFO-LANDSCAPE.md`（208 行草稿，mtime 04:38）即本调研轮初稿（与本 CHANGELOG 条目同会话），本轮以 v1.0.0 定稿提交。
- **基线**：无代码改动；backend 1054+1 / frontend 349 / inference 61 不变。

### 2026-08-31 — round-147：收尾轮 — track-snapshot watch 闭环 + 批 0a 前置检查 + /trading ?slug= 深链打磨

用户指令"继续完成后续剩余的任务"。三件事 + 文档同步，两个代码 commit（其一为快照 cron 自动提交）。

- **track-snapshot cron 首跑提前闭环（round-143 遗留 watch item）**：07:30 触发前以同一 wrapper 手动实跑全链——快照生成→限定 pathspec 提交 `a924898`（树干净）；当日 healthcheck（04:35 每五分钟）与 cleanup（03:00）两任务实证 cron 守护进程健康；极简 PATH（cron 等价环境 `env -i`）下 `npx tsx` 可解析。观察记录：快照文件名取 UTC 日期（本地周一 07:30 CST = UTC 周日 23:30），与文件内 UTC 时间戳自洽、git 保留历史，不改。
- **批 0a 前置检查（只读 SQL，判别"发布滞后 vs 生命周期缺陷"）**：最新牛肉月度点 2026-07-01（八月点未发布）；21 行月度预测全部锚定 2026-07-31，最早到期 H=1=2026-08-31（当日）但验证需八月实值（FRED ~09 月中旬发布）→ 零 verified 属正确状态、无过期未验证行，**生命周期无缺陷**，值守窗 2026-09 中下旬维持。
- **`2adf1b3` /trading `?slug=` 深链（round-146 登记打磨项落地）**：`useTradingData(initialSlug)` 初始选中压过首商品自动选择，未知 slug 诚实回退默认商品（避免永久 "Loading..."）；页面 `useSearchParams`（Suspense 包裹，/trading 转 server-rendered-on-demand）+ 同路由 slug 变化同步效应（GlobalSearch 在 /trading 页内触发不重挂载；手动选择永不被覆写）；GlobalSearch 商品项与 Enter 首跳带 `?slug=`（共享 commodityHref）。门禁全过：tsc/biome/jest **40 套件 349**（+4）/build/PM2 重启/live（匿名 /trading 与 /trading?slug= 均 307 登录门不变、三服务健康、部署 chunk 含深链字面量）；本环境无浏览器后端，登录态行为由组件测试覆盖——如实记录。
- **意外观察（待用户决策，未处理）**：工作区出现未跟踪文件 `docs/RESEARCH-BEEF-INFO-LANDSCAPE.md`（208 行牧集竞品调研草稿，mtime 2026-08-31 04:38 本会话进行中，非本会话命令所写，来源不明）——未并入任何 commit。
- **基线**：backend **1054+1**（05:23 窗口过期后复跑全绿）/ frontend **349** / inference 61 = **1464**；页面 44、路由 18/端点 126 不变（本轮无新增）。
- **新诊断的测试环境约束（登记 AUTOMATION-STATUS）**：验证基线时发现连续快速全量跑 + 会话内手动生产登录会耗尽 `authRateLimiter`（10 次/15 分钟/IP，成功请求计数），`correlationAnalysis.test.ts`（唯一打 live :8000 登录的套件）beforeAll 429——5 连跑 2 败、窗口过期后全绿，非代码回归。

### 2026-08-31 — round-146：第六波 v3.4.0 执行 — 批 1（诚实化 IA 收敛）+ 批 2（预测粒度对齐）+ 批 3（触达补全）

用户指令"按照规划和你自己的决策进行后续的开发"（round-145 规划的第六波；D14/D15/D16 按建议案放行）。三个独立 commit，每批全门禁。

- **批 1 `b72bff9`（诚实化 IA，净 -535 行）**：① **D14 模型页 7→2**——删 /ai（纯枢纽）、/ai/models、/ai/backtest、/dashboard/models 四页（-1,026 行），next.config 308 永久重定向→/ai/accuracy；后端 signals/backtest API 全保留；[modelId] 详情页本就含 backtest 窗口对比；导航项/面包屑/快捷入口全部重指向。② **D15 顶栏搜索兑现**（原 "PLANNED" 占位徽章）——`GET /api/search?q=`（鉴权；三源白名单：beefCutTaxonomy 四语 contains / commodities slug·name·nameCn / market_news 已发布 title·summary；每源 take 5；空 q 返回空集不 4xx）+ GlobalSearch 组件（300ms 防抖、分组下拉〔部位/商品/资讯〕、Enter 跳首条、"搜索暂不可用"与"无匹配"两态诚实降级、点击外关闭）；商品命中落 /trading 选择器（?slug= 深链登记为打磨项）。③ **D16 国产筛选诚实禁用**——无 CN 行时 domestic 按钮 disabled+title 提示（空态文案保留纵深防御）。
- **批 2 `e64222b`（预测粒度对齐）**：`GET /api/beef/forecasts/:cutCode?factoryCode=`——钉住单厂序列出预测（tradingSignals 抽取 evaluateFactoryForCut，与代表厂同一道 ≥2 真实点+新鲜度门；未知厂 404；理由按工厂作用域；响应回显 factoryCode），闭合"价差按厂、预测不按厂"的不对称；region 查询维度（/prices?region=、/prices/latest?region=，大小写不敏感精确匹配、与 country AND）；CutForecastSection 工厂选择器（auto=代表厂，选项来自已有价格行零额外请求）。
- **批 3 `e06c2d2`（触达补全）**：`GET /api/alerts/channels-status`（email/slack 每渠道可用性+可行动理由；rules 页在 email 不可用时显示警示横幅——"设了规则等邮件、实际只有站内"的静默降级从此可见）；反馈通道（仓库公开性匿名 200 实证后，MarketingFooter 增 Feedback 链接覆盖 landing/about/pricing，digest 页脚增反馈链接且置于数据分支外——数据坏时最需要反馈、并进 SSR HTML）。
- **审计修正（对 round-145 自身分析）**：V6-二.1 表述过重（/beef 渲染层本就有国产空态文案）；V6-二.6 "页面不展示 region" 不实（factories 卡片本就渲染）。修正记录于 V6 执行状态块。
- **门禁与基线**：tsc×2 每批 / biome 触达文件 0 新告警（存量 forecast! 断言留置）/ backend **1054+1**（101 文件，+13：search 6 + 钉住×2+404+region×2 + channels-status×2）/ frontend **345**（40 套件，+4 GlobalSearch）/ inference 61；双 build 每批、PM2 重启×3 轮、live 全验（四路 308、匿名搜索 401、牛舌→TONGUE、beef 5/5/5 封顶、region=NSW 全 AU-847、钉住 AU-847 如实拒绝冻结数据、channels-status、digest SSR 反馈链接、三服务 200）。**页面 48→44、路由 17→18、端点 124→126**（AGENTS/API.md/AUTOMATION-STATUS 同步）。
- **批 0a/0b 未到期**：值守窗 2026-09 中下旬不变；用户侧待办不变（域名/SMTP/keys）。

### 2026-08-31 — round-145：第六波 v3.4.0 规划 — 功能设计缺陷分析 + 收敛批次设计（docs-only）

用户指令"分析当前项目在功能设计上存在的缺陷，规划后续的开发计划"。只读取证（PRODUCT-SPEC 对照实测：页面 48 清点、生产库 factory/cut/CN 行 SQL、AppShell/告警链路/预测路由代码读）后成文 IMPROVEMENT-PLAN **V6**（版本 3.3.0→3.4.0）。

- **缺陷清单（9 项，全部带 live/代码证据）**：A 数据-承诺断层——"国产牛肉"筛选在 CN 价格行=0（6 国 21 厂、CN 仅注册无数据）下永远空结果（违反诚实缺席）；hero 能力（部位级预测）因 beef 数据冻结与公开首屏（5 宏观序列 digest）断层。B IA 冗余——"模型可信度"主题 **7 个入口**（/ai 枢纽、accuracy(+[modelId])、models、backtest、dashboard/models、track-record）三处 MAPE 近似重复；顶栏全局搜索是 "PLANNED" 占位徽章（spec §四 承诺未兑现）。C 预测粒度不对称——forecasts 内部只取代表性工厂单厂预测（findForecastableFactoryForCut），与 /spreads 按厂价差、cuts 详情 by-factory 对比线不对称；Factory.region 有数据但无查询维度、页面不展示。D 触达断层——告警 email 渠道无 SMTP 静默死配置（UI 无告知，用户以为有邮件）；SEO 基建空转待域名；3 用户零反馈通道。
- **批次设计**：批 1 诚实化 IA 收敛（国产空态 + 模型页 7→2 + 搜索占位处置）；批 2 预测粒度对齐（?factoryCode= 预测 + region 维度）；批 3 触达补全（渠道状态透明化 + mailto 反馈）；批 0a/0b 承 V5 门控不变。
- **决策项**：D14 模型页收敛方案（建议 accuracy 吸收 + 301）、D15 全局搜索实现 vs 撤占位（建议实现最小三源跨搜）、D16 国产数据路线（建议入口保留 + 空态诚实化）。
- 零代码改动；测试基线 1443 不变；待用户"按计划执行"放行 D14/D15/D16。

### 2026-08-31 — round-144：问题解决轮 — 登记残留四项收口（/spreads 币种 + D13 + lifespan + metrics 定案）

用户指令"解决当前项目存在的问题"。先盘点（KNOWN-ISSUES/TECH-DEBT/V5 缓办清单 × 只读核实）后分类执行：用户输入阻塞（4 空 key/域名/CSV 导入）与时间门（批 0a/0b）不动，已有定案项（R3 保留等）不重开，登记可解决项全部落地。

- **批 A `b6a2882`（后端正确性）**：① `/api/beef/spreads` 币种进分组键——原按 (cutCode, source, country) 聚 min/max/avg，USD/kg 与 BRL/kg 同桶是数字噪音（注释还错写按 date 分组）；现键含 `[currency]`，+1 集成测试（同源双币种必须分桶）。② **D13 闭**：beef cheek 别名从非规范 OFFAL 重指规范 `BEEF_CHEEK`（Offal primal、四语元数据、HS 0206.10 与同区一致），mt_db+mt_test taxonomy 幂等 upsert（两库各 INSERT 0 1），**死别名结构守护测试**（ALIASES 全量值必须解析到 CUT_MAPPINGS 规范码 + 规范码自反归一，杜绝下一处 OFFAL）——此前 cheek 行会被静默写成 taxonomy 不认识的 cutCode，下游永远不可见。③ vitest coverage 排除项陈旧路径修正（`src/test-helpers.ts`〔不存在〕→ `src/test/helpers/**`〔round-117 后真实位置〕）。④ beef.ts 陈旧注释（beefImport.ts→beefIngest.ts）。backend **1041+1**（100 文件，+5 全新，零回退）。
- **批 B `7e87a98`（inference lifespan）**：`@app.on_event("startup")`（FastAPI 已弃用）→ `asynccontextmanager` lifespan；助手函数上移、启动序不变（torch 线程预算 → 串行 Chronos 预加载）。ruff 全过、pytest 61 绿（**warning 22→20**，弃用告警对消失）、重启后 live `/ready` chronos **3/3 经 lifespan 预加载**（若 lifespan 未触发则不可能 3 pipeline loaded）。
- **metrics GET 提权——定案不提（决策关闭）**：载荷实测为纯聚合运维指标（内存/CPU/uptime/延迟分位/请求计数），无用户级数据；唯一消费者 `/dashboard/performance` 面向全体登录用户是有意设计；提权需引入全库零先例的前端 role-gate 或让普通用户页 403——负收益。载荷若日后引入用户级数据则重开（TECH-DEBT 留档）。
- **顺带修正**：AUTOMATION-STATUS §五"集成测试用真实 PostgreSQL（mt_db）"失实表述（testApp helper 显式拒绝 mt_db、默认 mt_test）；API.md /spreads 行补币种分组说明。
- **门禁**：tsc（backend）×每批、biome 触达文件 0 警告、backend 全量 **1041+1**、inference 全量 **61**（批 B 门禁实测）、frontend 本轮零改动未触（最近全量 341 绿于 round-143 评估轮实测在案）、backend build、PM2 重启×2（backend+inference）、live（/cuts 含 BEEF_CHEEK〔牛颊肉〕、/spreads 匿名 401 + 带权 33 桶全带 `[币种]`、/health×3、/ready chronos 3/3）。基线 **1443**（1041+1 + 341 + 61）。

### 2026-08-31 — round-143：状态维护轮 — ops 全量扫描 + healthcheck 哨兵误报根治

用户指令"维护当前项目状态"。只读诊断扫描（ops-check）+ 一处监控修复。

- **扫描结论（全部实测 2026-08-31 00:50 前后）**：git 树干净 @ `c6dae5b`（round-142 五连提交核实落盘）；PM2 三服务在线、mt-backend `unstable restarts: 0`（9 分钟前重启为上轮门禁动作，错误日志干净）；健康端点 3×200（backend 2ms / inference 2ms / frontend 18ms）；PG 5432 + Redis PONG；磁盘 61%（15G 空闲）、内存可用 10G；系统 cron 六项齐备（backup/watchdog/healthcheck/cleanup/db-maintenance/track-snapshot）；数据新鲜度 5 白名单序列全部符合节奏——beef 2026-07-01（FRED 月度，8 月点 ~9 月中发布属正常）、CME live/feeder 2026-08-28（周五收盘、周一盘中）、usd_cny/brl_usd 日更至 08-30；无 nginx（直出端口架构，符合现状）。
- **修复 `cron-healthcheck.sh` js-yaml 哨兵误报**：顶层路径 `/root/frontend/node_modules/js-yaml/package.json` 在 pnpm isolated layout 下本就不该存在（顶层只暴露直接依赖，js-yaml 是传递依赖、无 hoist 配置）——该路径自 ≥08-25（日志保留最早日）每天 288 次全量误报 "possible store corruption"。**依赖树实测完好**：js-yaml@3.14.2/4.1.1 双版本都在 `.pnpm/`、istanbul-lib-instrument/cosmiconfig 正常解析、frontend 341 测试绿。改为 `.pnpm/js-yaml@*/...` 深层路径（与 is-core-module 哨兵同模式）+ 注释写明布局约束。验证：`bash -n` 通过、glob 命中双版本、手工全量跑零告警、**00:55 cron 实跑告警消失**（00:50 为最后一次误报）。
- **Watch 项**：① track-snapshot cron 08-30 19:49 装入 crontab，**今日 07:30 首次定时触发**（安装时已手工端到端验证 `ee36c41`，快照曾以 `1cee1c1` 自动提交）；② 批 0a 值守窗 2026-09 中下旬不变（FRED 8 月点发布后跑 SQL 三查 + 三面核查）。

### 2026-08-31 — round-142：第五波 v3.3.0 执行 — 批 1（公开中文行情摘要 + SEO 基建）+ 批 2（seed 身份对齐）+ 批 3（正确性收尾包）

用户指令"根据计划开始执行"（round-141 规划的第五波；D10/D11/D12 按计划建议案放行）。三个独立 commit，每批全门禁。

- **批 1 `3988648`（公开面，v3.0.0 批 B 二次升格）**：`GET /api/market/public/digest` 公开端点（固定白名单 5 序列，节奏感知涨跌〔daily 较上期+近 7 天 / monthly 仅环比——不造周窗〕、stale 旗标、seriesId 溯源、逐条降级）+ 公开页 `/market/digest`（中文、序列卡片、landing-cost/track-record 互链、"无分析师观点"声明、断流诚实降级）+ middleware PUBLIC_PATHS 9 路由。**SEO 基建**：sitemap.ts（仅 6 条可索引公开路由）/ robots.ts（负面清单）/ 6 页逐页中文·英文匹配的 metadata layout / root metadataBase。**执行中发现两处占位符进产物并根治**：`.env.production` `NEXT_PUBLIC_APP_URL=your-domain.com`（site-url.ts 守卫视同未设置——**真实域名待用户配置后重建才进 sitemap**，round-107 同款陷阱）；root layout 硬编码 `og:url mt.ai` 收敛到单一来源。backend +2 测试（白名单相等性=隐私契约）frontend +3（hook）。
- **批 2 `8e94a9a`（seed 身份对齐，TECH-DEBT §十七 兑现）**：seed `beef_carcass_us` 从 pre-round-126 身份（US Beef Carcass/USD/cwt/180 日合成行）对齐生产（Global Beef Price (IMF via FRED)/全球牛肉价格（IMF 月度）/USC/lb/metadata fred+PBEEFUSDM/6 个月度合成点）；mt_test --force 重建后与生产逐字段一致；tools.test 的 beforeAll unit hack 与 afterAll 恢复整体移除。零测试数变化，全量首跑即绿。
- **批 3 `465570f`（round-106 存活项 8 项收口）**：① /api/docs 加 authenticate（D12：spec 是全端点地图，对匿名爬虫是侦察价值）；② authRateLimiter 拆分——login 保留 10/15min，refresh/change-password 走新 authActionRateLimiter 30/15min（NAT 办公室不再被并池锁死）；③ lastDirections 内存 Map 显式 bounded(512)+FIFO+重启语义注释（重启只可能漏报一次、不可能误报）；④ SMTP 未配置 warn 每进程一次；⑤ monthRange 月初 UTC clamp（Jan 31 +setMonth 曾整月跳过 2 月；+3 回归钉）；⑥ verifyTokenSession session.count 化（不再全量拉 session 行；顺修 authService.test mock 队列串位 +1 正路径钉）；⑦ topCuts 平价 cutCode 决胜；⑧ importDatasetData rowsCount 改为导入后真实 datapoint 计数（re-import skipDuplicates / 0 行导入不再清零计数器）。**Python lifespan 可选项缓办**（零行为变化，维持登记）。
- **门禁与基线**：tsc×2 / biome 触达文件全清 / backend **1036+1**（99 文件，+5）/ frontend **341**（39 套件，+3）/ inference 61 不变；双 build ×3 轮、PM2 重启 ×3、live 全验（digest 匿名 200 且数字与 FRED/landing-cost 手验一致、digest 页 zh title/canonical/OG 落地、sitemap/robots 无占位符、/api/docs 匿名 401、/dashboard 仍 307 登录门、login 401 非 429）。**首跑 flake 复现一次**（批 1 首跑 ×3——已登记的 mt_test --force 后冷 Redis 预测缓存机制；其后四次全量全绿）。
- **文档**：AGENTS.md 页面 47→48；API.md 端点 123→124 + 补记 highlights 遗漏行 + /api/docs 鉴权标注；IMPROVEMENT-PLAN V5 执行状态块；TECH-DEBT §十七 转已解决 + round-106 存活项批注。
- **批 0a/0b 未到期**：值守窗 2026-09 中下旬（FRED 8 月月度点 ~9 月中发布）；2026-08-31 00:00 H=1 到期穿越预检通过（7 行仍 completed、等实际值属正常）。

### 2026-08-30 — round-141：第五波 v3.3.0 规划 — 方向分析 + 分发期批次设计（docs-only）

用户指令"分析项目后续的开发方向，规划方案"。产出 IMPROVEMENT-PLAN **v3.3.0 第五波**（分发期），无代码改动、零测试影响。

- **方向分析（V5-二 五轨研判）**：机制轨已收官（v3.1.0+v3.2.0 十一波次后预测侧无未决工程项）；证据轨有机成熟零开发（首批 beef verified 等 FRED 8 月点，值守窗 2026-09 中下旬）；**分发轨是当前最大缺口**（0 真实用户、公开面仅 8 路由、无 sitemap/robots、全 app 仅 2 处 metadata——本轮实测）；数据轨等用户输入（beef_cut_prices 冻结已 4 个月）；债务轨仅剩残尾（round-106 存活项 + seed 身份漂移）。
- **批次设计**：批 1（P0）公开中文行情摘要页 `/market/digest` + 公开 digest 端点 + SEO 基建（v3.0.0 批 B 二次升格，竞品深探 §8.5-4"真数据自动摘要"应法，D10 门）；批 2 seed 身份对齐（TECH-DEBT §十七 兑现，D11 门）；批 3 正确性/加固收尾包（swagger 无鉴权 / authRateLimiter 三路由共用 / lastDirections 内存 Map / SMTP warn / monthRange setMonth / verifyTokenSession findMany 等，本轮逐项 live 复核在位）；批 0a/0b 承 V4 时间门/样本门不变。
- **新增决策项**：D10 摘要页排期与范围、D11 seed 对齐、D12 /api/docs 鉴权等级、D13 cheek taxonomy（缓）。
- **不做清单新增（分发纪律）**：不为 SEO 写人力研报式内容/不虚构"分析师洞察"；公开端点只白名单真数据；不做邮件订阅（无基数不造空壳）。
- **基线取证（2026-08-30 23:45 live）**：H=1 到期 2026-08-31 00:00、verified=0（等实际值属正常）；users 3 / beef_cut_prices 2401 行 @2026-04-30 / prediction_logs 197,922（verified 35,064）；三服务在线、crontab 6 条、公开 highlights/landing-cost 200。PROJECT-VISION 08-30 状态指针同步（基线数字更新至 round-140 门禁记录 + 指向 v3.3.0）。

### 2026-08-30 — round-140：批 4 收官 — D2（休眠表五模型处置）+ D3（portfolios 组 + predict/batch 两端删除）+ cbOT 孤儿清理

用户指令"继续剩余事项"——对上轮列出的 D2/D3 决策请求逐项放行（round-132"继续完成剩余的任务"同款先例）。批 0a/0b 仍受时间/样本门（8 月月度点 ~9 月中发布）。

- **D2 休眠表处置（`03fd1c7`）**：先定向备份 `backups/round140-d2/dormant-tables.sql`（生产实测：forecasts 0 / forecasting_models 0 / security_audit_logs 49——预测脚手架从未离开 seed 环境）→ 迁移 `20260830213000` DROP 三表 + 孤儿枚举 `ModelAlgorithm`，生产与 mt_test 双应用、`pg_tables` live 复核为空。schema 摘 SecurityAuditLog/ForecastingModel/Forecast 三模型 + User/Timeseries 四处反向关系；seed 整段摘除（模型/预测点播种、25 行安全审计夹具、MODEL_DEFS、汇总行——org 死引用教训：整段清非只清崩溃点）；`getUserProfile` 去 models 计数（无消费方）+ /api/auth/me openapi 同步。
- **D3 孤儿两面删除（本条与 D2 各一独立 commit）**：① `/api/portfolios` 路由组 7 端点 + 13 测试 + app 挂载，**连同 Portfolio/GroupMember 两表**（迁移 `20260830220000`；0 行数据、0 前端消费（useWatchlists 仅注释提及，已同步）；GroupMember 的"correlation overlay"注释所引 `/api/analytics/correlation` 早在 round-132 已删——两表与路由组互为唯一消费方，留表即立刻再造 D2 类休眠债，故同批收口）；② `/api/inference/predict/batch` 与推理服务 `POST /predict/batch` 两端及各自 batch 测试（backend −13 随组删、pytest −5 随端点删；Python 有限值守卫**保留**——单预测同依赖，其测试留）。live：404×3（backend 两处 + Python）+ /predict 200 + 三服务在线。**schema 模型 30→25、路由 18→17**；API.md 17 routers/123 endpoints 复测 + 补记批 3 遗漏的 /api/tools 节。
- **cbOT 孤儿清理（数据操作，无代码）**：生产库删 `corn_cbOT`/`soybeans_cbOT` 两错误大小写 commodity 及各 4 行 world_bank 月度行（round-105 配置修正前的历史 typo 遗留；0 预测/0 关注引用，正确大小写 twin 的 fred 415 行 + usda_ams 180 行完好；现行小写配置不会重建）。
- **门禁**：backend **1029+1**（99 文件，−13 恰为随组删除的 portfolios 测试，非覆盖回退——round-132 -34 同例）、frontend **338**（注释级改动复跑全绿）、inference **61**（−5 随端点删）；tsc×2 / biome×2 / ruff / 双 build / 三服务重启全过。**首跑 flake 复现并定位**：--force 重建 mt_test 后 Redis 预测缓存全空，首个全量并行跑中两个最重推理测试（beef forecasts / wheat_cme signals）冷启动超 30s，隔离与复跑均绿（round-136 已登记同类）。
- **文档**：TECH-DEBT 两条登记转已解决；IMPROVEMENT-PLAN 批 4 执行状态收官块；AGENTS.md 模型 30→25 / 路由 18→17。

### 2026-08-30 — round-139（续3）：v3.2.0 批 4 部分落地 — D1（PRODUCT-SPEC 增补）+ D4（健康指标口径修正）执行，D2/D3 维持登记

用户目标指令"完成后续的开发任务"；批 4 决策项按各自建议案执行非破坏性两项，破坏性删除项（D2 休眠表 / D3 孤儿路由组）不随通用目标放行、维持登记待逐项点头。

- **D1 — PRODUCT-SPEC 增补（纯增量，不碰"明确不做"）**：§七 数据层能力表 +3 行——进口到岸成本测算 ✅（2026-08-30 批3 上线的 `/tools/landing-cost`，平台不内置税率）、多源数据治理 ✅（18 slugs 权威源声明 + 按源量纲守卫 + 方向 provenance 守卫）、批 C 贸易词汇五维 ◐（设计登记未落地，数据解冻即接）；M3 清单补记计算器上线 + 批 B 周报候选方向（未排期，待用户确认优先级）。
- **D4 — `predictionBeefCoverage24h` → `predictionBeefCoverage90d` + `predictionBeefLatestAt`**：原 24h 窗口对月度节律结构性眨眼（两次发布间 ~29 天诚实读 0，TECH-DEBT round-132 登记）；新口径覆盖窗 90d（月度一轮 + 60d 验证冻结窗）+ 末轮日志时间戳（运维直接看到"上次是何时"而非 0/1）。改动面：`dataHealth.ts`（类型+合并 count/max 查询）、`health.ts` 路由、`cron-healthcheck.sh` 暴露行、回归钉（30 天前 beef 日志必计入——旧口径该场景读 0）。**live 验收**：/health/ready 返回 `predictionBeefCoverage90d: 3` + `predictionBeefLatestAt: 2026-08-30T06:09`。
- **D2/D3 维持登记**（不执行）：休眠表 SecurityAuditLog/ForecastingModel/Forecast 删除属数据治理决定（TECH-DEBT：预测/审计历史完整性原则，需用户明示）；portfolios 路由组 + `/api/inference/predict/batch` 维持登记（round-132 D6 建议不动）。
- **门禁**：backend **1042+1** 全绿零回退（dataHealth 9→10：换 1 弱断言 + 1 语义回归钉）；tsc / biome（唯一警告为既有代码）/ build / PM2 重启 / health 200。

### 2026-08-30 — round-139（续2）：v3.2.0 批 2（D8 多源权威源声明）落地 — 方向统计解锁 + scale-guard 误杀根治

用户目标指令"完成后续的开发任务"放行 D8（按 V4-四建案执行，live_cattle_cme → cme 新鲜度优先）。执行时实测混源组为 **17 组 = 已声明 3 + 未声明 14**（月度孪生实测 **11 组**非取证时的 10——多出 natural_gas_us；两源行数/量纲对比表留档 KNOWN-ISSUES R2）。

- **声明 `authoritativeSources.ts` 3→18 条**：11 个月度孪生（fred vs world_bank 同一 FRED 序列，wb 4 行值域 ⊂ fred 值域，零风险）+ FX 日度 aud_usd/usd_cny（fred 30 年史 vs api 68 行，同量纲）+ crude_oil_cme（fred 10231 vs cme 2）→ **fred**；live_cattle_cme（usda_ams 128 行冻结 2026-04-29 vs cme 08-14 起日更）→ **cme**。声明即训练/MAPE actuals/latest price/相关性全链一致取数。
- **执行中发现并根治 scale-guard 误杀（live 事故）**：守卫 20× 中位基线不分源 → brl_usd 近窗被 exchange_rate_api 反向 0.19 行主导 → **fred 的正确 ~5.1 写入被连环拒绝、权威序列冻结在 2026-08-14**（PM2 日志实证 08-03..08-21 rejected）。修复：基线改按**写入源自身**近 30 点——同源变纲（wheat_cme 形态）仍拦、异源量纲分歧归声明机制管；+1 回归钉（以被拒的 5.1469 实值入测）。live 实证解冻：fred brl_usd 7930→**7935 行**、最新 08-14→**08-21**（恰好回填被拒 5 个交易日）。
- **live 验收（重启清缓存后）**：chronos 三变体方向判定 **2268→2682（+414 = 排除行数恰等）**、hit 69.8/70.0/68.6%→62.0/63.2/62.5%（覆盖扩大诚实回落）；统计模型 73/74→85/86（+12 恰等）；`[DIRECTION] excluded` 日志零新增；aud_usd verified 样本现身公开 track-record；landing-cost USD/CNY 切 fred（08-21，stale 旗标如实）。
- **对 D8 原表述的实测修正**：FX 时效代价非"约 −1 天"——FRED DEX* 走 **H.10 周发布节律**（约 1 周滞后，数据止于上周五）；缺 actuals 时验证走 `skippedNoActuals` 重试（延迟不丢覆盖）。
- **配套**：seed.ts 已声明 slug 合成行带权威源标签（读侧过滤后仍可见；mt_test 经 `bootstrap-test-db.sh --force` 重建实测）+ **顺带清除 round-114 拆多租户遗留的 `prisma.organizations` 死引用两处**（首次重播 seed 即撞出 `deleteMany/create` undefined）；tools 路由测试 FX 夹具改 fred 标签 + 未来日期限定清理；publicTrackRecord 与周快照 methodology 口径同步"混源按声明取数"。
- **门禁**：backend **1042+1**（100 文件，+5：4 契约钉 + 1 守卫回归钉）全绿零回退；tsc / biome（无新增告警）/ build / PM2 重启 / health 200；frontend/inference 零改动未重跑（338/66 不变）。
- **另登记不动**：world_bank 爬虫曾以错误大小写 slug 另建 `corn_cbOT`/`soybeans_cbOT` 孤儿 commodity（单源非混源、无预测）——清理归独立卫生轮。

### 2026-08-30 — round-139（续）：v3.2.0 批 1（快照 cron 自动化）+ 批 3（进口成本计算器）落地

用户指令"开始"（执行 v3.2.0 执行顺序：批 1 → 批 2〔D8 门〕→ 批 3）。批 2 的声明本身待 D8 点头，本轮已完成其取证（见下）。

- **批 1 周度快照自动化（`ee36c41`，crontab 5→6 条）**：`scripts/cron-track-snapshot.sh` 每周一 07:30 驱动既有只读导出器 + **路径限定自动提交**（D9 推荐案落地：`git commit -- docs/snapshots/` pathspec 只提交快照文件、不卷入无关暂存；index.lock 存在则跳过留下周）。**实跑端到端验证**：重生成快照自动提交为 `1cee1c1`，而新脚本自身保持未暂存——路径守卫生效。
- **批 2① D8 取证（live SQL，声明待用户点头）**：真混源组实测 **17 个**（slug×interval 口径，此前 slug 级查询被 head 截断漏了 usd_cny/sugar/wheat 等）：FX 日度族 aud_usd（fred 13945 行 30 年史 vs exchange_rate_api 68 行，同量纲 0.69-0.72）、usd_cny（fred 11392 vs api 68）；**10 个月度孪生**（fred 415-432 行 vs world_bank 4 行，同一 FRED 序列）；crude_oil_cme（fred 10231 vs cme 2）；**live_cattle_cme 是唯一真权衡组**（usda_ams 128 行冻结于 2026-04-29 @177-199 vs cme 自 2026-05-18 日更 @211-247——现状混读 = 3.5 个月断档拼接）。快照脚本运行日志同场实证排除代价：**每个 chronos 变体 410 行方向判定正被混源守卫排除**——D8 声明即可解锁。建议清单已入 IMPROVEMENT-PLAN v3.2.0 V4-四。
- **批 3 进口成本计算器（`b209de2`，v3.0.0 批 A 升格）**：公开端点 `GET /api/tools/landing-cost`（zod 校验 400 门 + 全局限流，白名单序列纪律同 highlights）+ 公开页 `/tools/landing-cost`（middleware PUBLIC_PATHS + /beef/forecast 互链）。**诚实设计**：活输入仅白名单基准价（IMF 牛肉 USC/lb 月度 / CME 活牛/架子牛 USD/cwt 日更，USC/lb 与 USD/cwt 恰同走 ÷100→USD/lb→USD/kg，未知量纲拒绝换算）+ USD/CNY，全部带日期与新鲜度旗标；**关税/增值税/运费/损耗为用户假设参数——平台不内置各国税率（不造虚构数据）**；公式关税乘 CIF 类基数、增值税按（基数+关税）中国进口口径、损耗完税后乘算；区间 = 同公式跑近窗（日更 30 点 / 月度 3 点）最低↔最高，非拍脑袋 ±%。降级诚实：无数据 insufficient_data+原因、无汇率只显示美元口径。+15 后端测试（9 纯函数 + 6 路由，fixture 用未来日期压制 seed 合成行保证 CI 确定性）+4 前端页测。**live**：匿名双面 200；活牛 211.73 USD/cwt → 4.6677 USD/kg → 带参（12% 关税/9% 增值税/0.75 运杂/3% 损耗）→ **¥45.96/kg**，逐项手验一致；非法序列/越界参数 400。
- **顺带登记（TECH-DEBT §十七）**：seed.ts 的 beef_carcass_us 身份仍是 round-126 之前的"US 胴体/USD/cwt+合成日更"，与生产的 IMF 月度基准漂移——批 3 路由测试以临时 unit 修正 + 未来日期 fixture 规避，seed 修正属独立卫生轮。
- **门禁**：backend **1037+1**（100 文件，+15）、frontend **338**（38 套件，+4）全绿零回退；tsc×2 / biome×2 干净；双 build + PM2 重启；AGENTS.md 路由 17→**18**、页面 46→**47**（实测复核）。

### 2026-08-30 — round-139：状态维护轮 — 三套基线复跑全绿 + IMPROVEMENT-PLAN v3.2.0 第四波规划

用户指令"维护项目状态，规划后续的开发计划"。**零代码改动轮（docs-only，无需重启）**；三套测试全量复跑作为状态确认：backend **1022+1**（98 文件）、frontend **334**（37 套件）、inference **66**，零回退；PM2 三服务在线（/health 200×3），git 树干净 @ `eba0402`。

- **规划取证（live）**：① 牛肉月度预测 H=1 首批 7 行**下一验证到期 2026-08-31 00:00**（forecast_start 2026-07-31 + 1 月；实际值等 FRED 8 月点 ~9 月中发布 → 首批 verified 预计 2026-09 中下旬）；② **15 个 slug 被多源写入、权威声明仅 3 个**（brl_usd/corn_cme/natural_gas_cme）——aud_usd 等 12 个未声明者的同 interval 混源组被方向守卫整组排除，登记为 v3.2.0 批 2 + 决策项 D8；③ `weekly-track-snapshot.ts` 已建成但 **crontab 无条目**（既有 5 条任务）——批 1 接线 + 提交策略 D9。
- **IMPROVEMENT-PLAN v3.2.0（第四波）**：证据成熟期三主线——**值守**（批 0a 2026-09 验证窗核查、批 1 快照 cron 自动化）、**解锁**（批 2 多源 provenance 声明 → 方向统计覆盖 FX 族）、**第二产品落点**（批 3 进口成本计算器 `/tools/landing-cost`，v3.0.0 批 A 升格）；另有批 0b 校准共识区间（样本门：首批 live verified 后，批 1 回测残差为主 + live 交叉核对）与批 4 决策项处置（D1-D4 承接）。全部批次带门控（时间/决策/样本量）；有机观察项单列（2026-08-31 到期 → 9 月中下旬首批 verified → 2026-10-31 H=3 → ~2026-11 per-series 激活评估 → 2028-11 活牛重评）。
- **文档维护**：PROJECT-VISION 增 2026-08-30 状态指针（第二/三波全落地 + 基线刷新 + 里程碑预告）；AUTOMATION-STATUS 头注与测试基线刷新（1390→1422 全绿）+ 周度快照脚本登记（待接线）。

### 2026-08-30 — round-138（终）：批 6（免 key 牛肉/蛋白序列扩充）落地 — v3.1.0 全部七批执行完毕

- **选型实测先行（`51b8853`）**：6 个候选 FRED 序列经**免 key CSV 端点实测探针**（fredgraph.csv），3 个存活且数据新鲜（月度到 2026-07）：**APU0000703112**（美国零售牛肉 ground chuck $/lb）、**PPORKUSDM**（世界银行猪肉指数）、**PPOULTUSDM**（世界银行禽类指数）；PCHICKUSDM/BEEFEXPDM/BEEFIMPDM 不存在（404 页）。牛肉预测面：月度侧 1 条基准 → 2 条牛肉 + 2 条替代蛋白交叉（猪/鸡），日更侧活牛/架子牛在线——批 2 per-series 路由即刻各有用武之地。
- **接入零新文件**：三条进 `worldBankPrices.FRED_MONTHLY`（新 `proteins` 类目）——复用 round-105 共享免 key CSV 通道（`fetchFredCsvSeries`）与既有 upsert 语义，数据源计数 18 不变。单位契约测试扩展：允许唯一非币种量纲 `index (2010=100)`（显式标注指数基，保持"禁裸数字"本意）。**一次性 10 年回填**（同通道幂等 upsert，各 ~124 月度点 2016-01 起）——常规刷新只取 3 个月窗，预测面需要历史。
- **验收（live）**：重启后 boot 订阅日志实证 **9 条月度序列**（原 6 + 新 3）进入 ADR-0001 月度循环（horizons [1,3]、new-point-gated）；预测行与 freshness 板见下方门禁段。**门禁**：backend 全量 **1022+1 全绿**（+1 契约测试；一次 98 文件全挂为运行环境瞬态，单套件与复跑全绿）；tsc 干净；build + PM2 重启。
- **v3.1.0 收官**：七批（0/1/2/3/4/5/6）全部执行完毕——月度验证生命周期修复、牛肉月度回测、per-series 冠军路由、方向准确率、牛肉预测中心页、领先指标双臂门禁（诚实关闭）、序列扩充。测试基线：backend **1022+1**、frontend **334**、inference **66**，全程零回退。AGENTS.md 前端页面计数 45→**46**（2026-08-30 实测复核）。

### 2026-08-30 — round-138（续）：批 3（领先指标实验·双臂门禁）执行 — 两臂均未过门禁，方向诚实关闭

按计划"增量不显著就不上"纪律执行双臂实验，**结论分支走的是"两臂均未过门禁"的诚实路径**：

- **主假设（活牛期货领先 IMF 现货）数据不可行，未测**：live_cattle_cme 全史仅 141 日度点（2025-11 起 ≈ 10 个月），撑不起 36 个月度 rolling origins——登记为数据不可行（非门禁失败），重评 2028-11 后（重叠 ≥ ~40 个月）。
- **次假设（汇率滞后）双臂同门禁**（36 origins 配对、PASS 需中位 MAPE 相对改善 ≥10% 且胜率 >50%、滞后 L≥2 保证 exog 在 origin 时已发布、**零前向填充**——上次门禁失败的正因）：筛查先验已弱（BRL/AUD 全部滞后 |r| ≤ 0.17，n=194，最佳 L=5）。**臂 A（sarimax lagged-exog，`lagged_exog_gate.py`）四组全 FAIL**（rel 0.963–1.005，胜率 44–53%；arima 基线 1.46% 与批 1 回测逐位一致，交叉验证）。**臂 B（chronos-2 协变量零样本，`chronos2_covariate_gate.py`，族内配对隔离协变量增量）四组全 FAIL**（rel 0.955–1.317，brl H=3 劣化 +32%——弱信号协变量在长视界引入噪声；chronos-2 单变量 1.48% 仍在 chronos 带、未超 arima 冠军）。
- **登记**：领先指标方向关闭；sarimax exog 接线维持暂缓（连续两次门禁阴性，本次是零填充的更强检验）；chronos-2 测过未采（D6 例外条款履行完毕，权重已缓存复测零下载）。报告 `docs/backtests/beef-leading-indicator-2026-08.md`（含完整筛查表/门禁表/复现命令）。
- **门禁**：ruff 干净；两臂复跑数字逐位一致（臂 B SEED 确定性验证）；pytest **66** 全绿；零服务代码改动（纯实验脚本），无需重启。

### 2026-08-30 — round-138 执行轮：IMPROVEMENT-PLAN v3.1.0 批 5（牛肉预测中心）落地

用户指令"/goal 继续完成规划的任务"。核心预测链（批 0 月度循环 → 批 1 回测 → 批 2 per-series 路由 → 批 4 方向准确率）的用户可见汇合面：

- **新页 `/beef/forecast`（`7ba03cc`，牛肉行情区导航入口）**：① **下月共识卡**——IMF PBEEFUSDM 月度基准 H=1 个月的质量加权共识（方向/幅度/模型分歧区间/置信度/模型一致度，horizon 单位"个月"）；**校准 90% 区间诚实推迟**——beef 零验证行时接 conformal 只会输出未校准数字（回测实测 chronos 原生区间欠覆盖 58-78%），卡片明示"待首批滚动验证（2026-09 起）成熟后接入"。② **回测证据面板**（复用批 1 公开组件 BeefBacktestSection，与 track-record 同源）。③ **验证时间线**——诚实预告 2026-09/10 首个 H=1 验证、2026-11 H=3 到期 + 序列自身权重激活门槛，附"可预测上限就在 naive 附近"的回测结论。④ **上游面板**——活牛/架子牛期货日更收盘（批 3 领先指标实验的候选，/api/market/commodities/:slug/latest）。+4 页面测试（共识数字/诚实空态/时间线/证据面板与上游）。
- **dashboard hero 改挂牛肉月度共识（同 commit）**："AI 7日预测"（首个可预测 cut 的 7 日口径）→ **"AI 牛肉月度预测"**；新共享 hook `useBeefMonthlyConsensus` 是页与卡的**唯一数据源**（同一端点 `/api/signals/beef_carcass_us?horizon=1`、同一服务端缓存）——**数字一致由构造保证**。cut 预测仍供 hotCuts 表。hook 测试补 mock（新 hook 的真实 fetch 会搅动渲染，暴露了 /alerts 去重断言的双触发——mock 后归位，334 全绿）。
- **周度快照脚本（`61a149d`，并入 v3.0.0 "track-record 周度快照物料"——该件原只有规划无实现，本轮补齐）**：`backend/scripts/weekly-track-snapshot.ts` 只读导出 `docs/snapshots/track-record-<date>.md`（日期文件名=追加式历史）——30d 榜单（MAPE+方向命中）+ 牛肉专段（月度行 status×horizon 分布、下一验证到期 2026-08-31〔anchor+horizon 精确口径〕、冻结回测指针含 md5）。首份产物已入库并实跑验证；脚本运行日志顺带实证了批 4 来源守卫在工作（`[DIRECTION] ... excluded — undeclared multi-source provenance`）。
- **live 验证**：未登录 `/beef/forecast` → **307 → /login?redirect=…**（与行情页一致，middleware 公开路径不含它；track-record 牛肉段仍公开）；共识端点实测 `flat / −0.28% / 331.78→331.78 / 区间 327.31–332.54 / 57% / 3/7 / H=1 month`。**门禁**：frontend **334**（330→+4）全绿、tsc 干净、build + PM2 重启；backend 仅新增只读脚本（tsc 干净 + 实跑验证），源零改动未重跑（基线 1021+1 沿用）。

### 2026-08-30 — round-137（续）：批 4（方向准确率）落地 — 读侧推导 + 三次实测纠偏

用户指令"继续"。计划条文"验证环在记 MAPE 的同时记方向命中——读侧聚合（不加列）"落地为**纯读侧推导**：`prediction_logs` 无需迁移，方向判定在读时从已存值 + anchor 收盘重建，与批 1 回测同口径（末步涨跌符号相对 anchor 点；flat 排除不计 miss）。

- **4a 读侧聚合（`715fa82`）**：`mapeTracking` 新增 `directionVerdict`（纯函数：sign(pred) vs sign(actual) 相对 anchor，flat/非有限值返回 null）+ `getModelDirectionStats`（SQL 只取配对值不搬数组）；`directionHitRate/directionCount` 流经 `getModelAccuracy → getAllModelAccuracy → /api/signals/models/accuracy`（登录）与 `/api/signals/models/accuracy/public`（公开榜单）。+10 测试（5 纯函数 + 5 真库 mt_test，fixture 前缀刻意不含 "test" 以穿过聚合自身的排除守卫）。
- **4b 两页增列（`af23766`）**：`/ai/accuracy` 模型对比表 Direction 列（DirectionCell——与 MapeBadge 同款 MIN_VERIFIED_SAMPLE=5 诚实门禁，naive 显式 "— (flat)"）；公开页 `/ai/track-record` 榜单增列 + methodology 增 `direction` 条目写明口径。前端 327→**330**。
- **4c 三次实测纠偏（`64cf0ad`，首部署数字暴露三个数据形态现实）**：① **公共步配对**——CME 周末跳空使 actuals（6-9 点）短于 horizon 步数（10），原"长度不等即丢弃"误杀几乎全部日更行；改在**最后一个公共已验证步**配对（与验证环 MAPE 的 overlap 口径一致）。② **anchor 日界**——forecastStartAt 常为 16:00 盖章而收盘价 00:00 盖章，"严格早于时间戳"会抓到首步当日自己的收盘（= actual[0]，chronos 被抬高到 82-90%）；anchor 边界改为 forecastStartAt 的 **UTC 日历日零点**（两种盖章约定下都正确取到"首步前一日收盘"= 真训练末点）。③ **无 forecastStartAt 行排除**——predictedAt 回退使 anchor 落进实际窗口内部（crude 遗留行实测 12.9%，低于掷硬币）；这些行 MAPE 保留、方向不可判。另：`interval=''`（空串遗留）归一为 daily；**来源不明守卫**——anchor 窗内混多源且无权威声明的序列（aud_usd 现状：fred@00:00 与 exchange_rate_api@16:00 同表交错，同日价差 ≈ 日波动）整组排除方向（MAPE 不受影响，登记为数据决策候选）；naive 按定义恒 flat（live 实测 aud_usd 上 0/730 行 pred=anchor——值级 flat 判定在多源/回填下不可复现，模型级强制与回测结论一致）。
- **live 终值（公开 API，30d 窗）**：chronos_tiny/mini/base **70.4%/70.0%/68.7%**（各 ~2170 判定行）、exponential_smoothing 68.9%、arima 58.9%（73 行——统计模型在 CME 序列 30d 内 verified 行本就少，数据量而非过滤）、holtwinters **33.8%**（74 行，低于掷硬币的差异化弱点）、naive "—"。方向技能分化真实可见。beef 月度 0 行（首批 2026-09/10 成熟后自动进入判定）。
- **门禁**：backend 全量 **1021 pass + 1 skip 全绿**（1019+1 基线 + 2 来源守卫测试；中间一轮全量 1 例瞬态失败、终轮全绿）；frontend **330**；tsc × 2 干净；双服务 build + PM2 重启；live：公开/auth 两 API 均带 direction 字段实测 200，track-record 页 200。

### 2026-08-30 — round-137 执行轮：IMPROVEMENT-PLAN v3.1.0 批 2（冠军路由：序列 × 模型）落地

用户指令"继续后续的开发"。批 1 回测结论（arima 牛肉月度冷启动冠军、全局 chronos 淘汰对牛肉过严）进入机制化：共识权重从全局 per-model 升级为**按序列路由**——序列自己的验证证据足够时，权重表与淘汰判定都换成该序列自己的。

- **2a 路由核心（`a4fac8b`）**：`resolveModelWeights(modelIds, days, seriesId?)` 第三参。激活阈值 `MIN_SERIES_VERIFIED_TO_ACTIVATE = 20`（窗口内该序列 verified 总行数，防薄证据噪声——月度序列每月仅成熟 ~9 行）；激活后整套权重机械（中位 MAPE、未知模型中性默认、naive 淘汰线、1/max(mape,2%) 归一）**逐字复用**于序列本地统计表——提取纯函数 `computeWeightsFromAccuracies` 全局/序列两路共享，语义零漂移。序列本地淘汰意味着：全局被淘汰的模型在其强序列**重新获得投票权**（全局淘汰是池结论不是序列结论），反之亦然。证据不足静默回退全局（与等权兜底同模式），debug 级日志记回退、info 级记激活。单测 17→20，含计划验收用例"模型 X 全局弱、序列 A 强 → A 的共识用 X"+ 序列本地淘汰 + 薄证据回退（断言两次取数调用序列）。
- **2b 接线（`9a9cf00`）**：`cadence.accuracyWindowDays`——证据窗按节奏缩放（daily 30d / weekly 90d / monthly 180d；月度序列 30d 窗内最多 ~9 行永远够不到激活线，180d ≈ 6 个成熟月 ~50 行稳态）；`generateForecast` 传 `req.commodityId` + 节奏窗；`getAllModelAccuracy` 增 **64 键有界 60s per-series 缓存**——`/signals/batch` 50 序列 × 9 模型 × 2 查询的扇出正是全局单键缓存当年要防的形态，溢出全清（最坏一个 TTL 窗一次突发）。
- **live 验收（真实生产数据演示计划场景，beef 差异诚实降级）**：计划验收写"`/api/signals/forecast?commodity=beef_carcass_us` 与全局权重对照可观察差异"——beef 当前 **0 verified 行**（首批成熟 2026-09/10），诚实结果是**回退可观察**：beef 权重表与全局逐项一致（chronos 三兄弟全局淘汰、4 统计模型各 25%），激活预计 **~2026-11**（180d 窗内 ≥20 行：H1 九/十月各 7 + H3 十一月 7）。而验收场景本身在其他序列上由真实数据坐实：全局池淘汰 chronos 全家，但 **live_cattle_cme**（747 verified 行/30d）启用自身权重表——chronos 三模型各 14.8% 投票权复活、arima 反而最弱 11.1%；**aud_usd**（7082 行）只剩 naive+exponential_smoothing 各 50%。PM2 日志实证 live 路由调用走新逻辑（14:45:51 beef 全局淘汰线 / 14:45:54 `per-series routing active: live_cattle uuid`）。批 1 回测仅作冷启动**文档证据**，未硬编码进权重——权重严格由 verified 行驱动，不造先验。
- **门禁**：tsc 干净；backend 全量 **1011 pass + 1 skip 首跑全绿**（基线 1008+1，+3 为批 2 新单测，零回退）；build + PM2 重启 + `/health` 200；`/api/signals/beef_carcass_us`、`/api/signals/live_cattle_cme` 铸 token 实测 200 且 7/7 模型可用。frontend/inference 本轮零改动未重跑（基线沿用 round-136 的 327/66）。

### 2026-08-30 — round-136 执行轮：IMPROVEMENT-PLAN v3.1.0 批 0（P0 月度验证生命周期修复）全部落地

用户指令"/goal 开始按照计划实施"。批 0 四件套按 0b→0c→0a→0d 顺序执行（守卫先行，数据修复在守卫保护下进行），三个独立 commit + 一次 build/PM2 重启/live 验证：

- **0b 未到期守卫（`a8a893f`）**："未到期 ≠ 不可验证"语义代码化——`monthlyActionableMs`（anchor + horizon 日历月 + 90d 宽限）成为 Pass A/Pass B/expire/restore 四处共享的唯一定义（互为补集，不可能乒乓）：Pass A/B 的月度标记改走 `markActionableMonthlyRows`（逐行日历判定；旧实现是组级 matured 后批量 updateMany，会把未到期兄弟行一并标掉——08-30 事故的第二个放大面）；`restoreVerifiablePredictions` 增自愈子句（未到期 unverifiable 月度行无条件回收）。月度套件 6→9（事故形态/逐行兄弟判定/自愈+僵尸不误回收；deadA/deadB fixture 改为 actionable 行保持原意图）。
- **0c horizon 校准（`314d134`，D5 按建议执行）**：`cadence.forecastHorizons`——daily 维持 [10] 天，月度改 **[1, 3] 个月**（下月+下季度；旧继承 daily 默认 10 = 十个月，首批牛肉验证要等 2027-05，改后 2026-09/11 起滚动成熟）。订阅 `horizons: number[]` 数组化，刷新按 (model × horizon) 组合；**执行中发现并修复一个计划外缺陷**：`monthlyNewPointState` 去重键原为 (commodity, model)，多 horizon 下第二个 horizon 会被去重守卫吞掉——键扩为 (commodity, model, horizon)，且整周期守卫改为逐组合守卫（顺带消除部分失败跳过洞）。既有 horizon=10 行保留自然验证。
- **0a/0d 一次性恢复（`0635c92`，生产库执行 13:34 本地 CST 即 05:34 UTC）**：实测 **42 行**误杀月度行（6 序列 × 7：aluminum_lme / beef_carcass_us / iron_ore_cfr / natural_gas_us / rice_thai / rubber_tsr20，anchor 2026-07-31 horizon 10）全部恢复 `completed`；7 条 beef NULL-interval 遗留行（08-23、horizon 6、daily 语义下永不可验证）标 `stale` 保留历史。脚本幂等 + 形态核对（预期数不符即中止）；备份 `backups/round136/prediction_logs-before-batch0a-*.dump`（39M）。**计划数字修正**：round-135 规划写的"56 条"实测 49（42+7，审计与执行间部分行状态已变），KNOWN-ISSUES 无需新增条目（闭环记录在 IMPROVEMENT-PLAN V3 执行状态）。
- **门禁**：backend 全量 **1008 pass + 1 skip 两连全绿**（首跑 1 例 flake：`mapeTracking.test.ts` "leaves a verifiable prediction as completed"——并行测试文件共享测试库时全局 sweep 竞争 fixture 行，机制为既有暴露面〔全局 sweep + 无套件级隔离〕，本轮月度套件新增 sweep 调用略微加宽窗口；隔离运行与后续两轮全量均绿，登记不重构）；tsc 干净；build + PM2 重启 + `/health` 200；重启日志确认 6 月度序列按新代码订阅（horizons [1,3]），首个刷新 tick 后 84 行 horizon-1/3 月度预测落库（6 序列 × 7 模型 × 2 horizon），42 恢复行全部保持 completed。**收口复核（14:13 本地，psql + 日志）**：刷新日志实证 6 月度序列均为 "7 models × 2 horizons"（14:09:20-50）；月度行 horizon 1/3/10 各 42、anchor 均 2026-07-31、全 completed，零重冻结；本条初稿写于 tick 之前，复核时点见此注。
- **批 1 前置（推理确定性）一并落地（`760f825`）**：chronos `predict_quantiles` 采样路径每请求以 payload（repo_id+values+horizon+quantiles）派生 sha256 → 31 位 torch 种子，在信号量内、采样前播种——相同请求逐位复现（live 验证：两次相同 chronos_tiny 请求输出完全一致），不同请求流去相关；统计模型本就确定。可复现契约 = 串行调用方（回测脚本即串行 rolling-origin），live 并行刷新保吞吐不保证逐位。pytest **64→66**（种子稳定性/敏感性 + 播种先于采样），ruff 干净。PREDICTION-STRATEGY §6.2 规范 6 兑现，批 1 回测可复跑性就绪。
- **批 1 牛肉月度滚动回测落地（同日执行）**：`backend/scripts/backtest-monthly-series.ts`（195 点全史、36 expanding-window origins × H=1/3 × 7 共识模型、纯推理零训练零落库、与生产同源取数、串行调用保逐位复现——两次 3-origin 对照 md5 一致）→ 报告 `docs/backtests/beef-monthly-2026-08.md`。**两悬案的答案**：① chronos 在牛肉月度 H=1 上**不劣于** naive（中位 1.61-2.08% vs naive 1.69%，FX/CME 池的淘汰结论不复现），H=3 上**成立**（3.28-3.91% vs 2.71%，劣 21-44%）——全局淘汰对牛肉过严，批 2 per-series 路由拿到冷启动证据（arima 两 horizon 中位皆优 1.46%/2.64%，覆盖率 91.7%/94.1% 贴名义值）；② 7 模型全带挤在 naive ±15% 内（最优仅好 14%/3%）——月度宏观序列可预测上限就在 naive 附近，与 M6 竞赛教训形态一致，"可验证 + 方向 + 区间"叙事获得本仓自己的数据支撑。另：chronos 原生区间欠覆盖 58-78%（统计模型 90-94%）= conformal 校准层必要性 + relational conformal 升级的动机数据；方向命中 H=1 有边际（chronos_base 69.4%/mini 63.9%/arima 61.1% vs 掷硬币 50%）、H=3 无信息（38-59%）——批 4 价值判断被证实。公开页 `/ai/track-record` 增**牛肉专段**（静态带日期证据面板，7 模型全展示不挑行，naive 方向标"— (flat)"，API 失败时依然可见；frontend 327 全绿、build + live 验证标题与表格在 SSR HTML 中）。

### 2026-08-30 — round-135 规划轮：AI 预测牛肉价格核心专轮（IMPROVEMENT-PLAN v3.1.0）

**补充二（同日晚，回应用户"时序预测最新科研成果"问询）**：PREDICTION-STRATEGY 新增 §七（最新科研成果借鉴清单，六路检索）——**Chronos-2**（2025-10，120M，原生协变量/多变量零样本）使批 3 领先指标实验改**双臂**（sarimax lagged-exog + chronos-2 协变量，同一滚动门禁）；TimesFM 2.5（200M，less-is-more）/ Moirai 2.0（原生分位数）备选登记；LLM 时序之争收敛至"事件知识有效、数值预测无效"（NeurIPS 2024 → arXiv 2410.12326 → 2026-02 再评估）支撑"LLM 读资讯出事件标记"维持登记不进共识；conformal 三篇 2025 顶会（关系型校准 ICML'25 = 现行"残差跨商品池化"近似的研究级修法、变结构点 CPTC NeurIPS'25、综述 2511.13608）落点登记；**M6 竞赛教训**（约 163 队仅 1 队跑赢 naive）作为"方向+区间+公开对错"叙事的最硬外部引用。D6 补例外细化（chronos-2 属家族升级，随批 3 臂 B 评估）。来源声明已注明（基准口径系来源方，未经本仓独立复核）。**Timer-XL 专项评估（同日，回应用户"清华的 timexl 有用吗"）**：不建议现在接入——本仓上一代以在线训练路径接入过并被作为反模式移除，残留 16 条 verified 平均 MAPE 41.4%（08-07 文档口径 0.728 系 10 条小样本，KNOWN-ISSUES R3 已复测修订）；长上下文优势对 195 点月度序列无用武之地、无原生协变量；若未来引入只准 zero-shot 过批 1 门禁。已入 §7.1 取舍表。

**补充（同日，回应用户"大模型使用规范/最准确预测方案"咨询）**：新增 PREDICTION-STRATEGY §六（大模型使用规范与最优方案）——结论："最准确"来自**组合预测 + 证据门禁**而非更强单一模型（三条硬证据：本仓 chronos 实测劣于 naive 与公开基准形态一致 / NeurIPS 2024 LLM 时序无增益 + 预测组合之谜 / 195 点月度序列的信息论上限），七条规范（准入门禁、组合锚定、按序列路由、概率输出+覆盖率审计、方向准确率、**推理确定性——读码发现 `predict_quantiles` 未固定采样种子**、淘汰公开），前沿模型取舍表（TimesFM/Moirai 不急=维持 D6"暂不"；LLM 直接预测数值不做；LLM 情绪标记只登记不进共识；微调禁止）。批 1 增"种子固定"前置条款。

用户指令"结合当前项目最核心的功能，利用 AI 大模型预测牛肉价格的变化，制定后续的开发计划"。规划轮（无代码改动），规划期实测发现三项核心功能缺陷并全部入计划：

- **规划期发现（全部 2026-08-30 psql/日志实测）**：① **56 条月度预测全被误标 `unverifiable`**——六条健康月度序列最新点均为 07-01、当天点龄满 60d，旧 60d 窗口代码在 01:44/07:44 清扫中撞线冻结，90d 修复 12:39 才部署（晚数小时）；restore 因窗口感知正确不救窗口未开的行，暴露"未到期 ≠ 不可验证"语义洞。② 月度预测 horizon=10（继承 daily 默认）= **10 个月**，首批牛肉验证证据要等 2027-05。③ 牛肉序列 7 条 NULL-interval 遗留行（08-23、6b 之前生成）。**另**：PREDICTION-STRATEGY（08-16）核心实验序列 beef_carcass_us 当时实为比特币错标——其 aud 联动 r=0.129、sarimax 门禁回测（8.10% vs 8.34%）的"牛肉结论"全部作废，本轮补写失效标注（门禁方法论仍有效）。
- **IMPROVEMENT-PLAN v3.0.0 → v3.1.0（AI 预测核心专轮）**：批 0（P0）月度验证生命周期修复三件套（误杀修复 + 三清扫未到期守卫 + 月度 horizon 校准 [1,3]→证据链 2026-09 起成熟）；批 1 牛肉月度滚动回测（195 点 rolling-origin × 7 模型，纯推理零训练——同时回答"chronos 在牛肉上该不该被淘汰"）；批 2 冠军路由（modelQuality 增 per-series 维度，牛肉不被 FX 池拖累）；批 3 领先指标实验（活牛期货 lagged exog → sarimax 接线，门禁制）；批 4 方向准确率指标（采购择时真指标）；批 5 牛肉预测中心页 + hero 接线；批 6 免 key 牛肉/牲畜序列扩充（FRED 盘点）。round-134 的竞争驱动批次（成本计算器/公开摘要/词汇五维）降为并行轨。决策项 D5（horizon 校准）/D6（第二 TSFM 家族建议暂不——先建牛肉自身证据，若全员≈naive 则"大模型"叙事让位"可验证"叙事）。
- 现状基线同步入档：9 模型 alive（近 7d naive 7582/ES 7581/HW 7581/arima 7571/chronos ×3 各 7299 行）、sarimax 0 行（门禁纪律维持）、`resolveModelWeights` 确认为全局 per-model（无序列维度）、方向准确率零实现。

### 2026-08-30 — round-134 规划轮：牧集深探（SPA 路由图）+ 后续开发方向 v3.0.0

用户指令"分析规划项目后续的开发方向，更加深入探查牧集网的实现"。规划轮（无代码改动），两份产出：

- **COMPETITIVE-ANALYSIS v1.1.1 → v1.2.0**：新增 §八 深度探查——本环境无浏览器后端，改从 web.mooket.com **公共 JS 构建产物提取全量路由图（~50 条）**：交易面 ~20 条（报盘/求购/店铺/入驻/保理金融/多角色）vs **行情面仅 2 条**（"数据是交易副产品"获实现层证实）；`followProduct` 存在（MT watchlist 方向被竞品验证）；bundle 含 TencentCloudChat/wangEditor/COS（IM+人力研报基建）；SEO meta 长尾疑问词堆砌。搜索缓存提取**首页真实报盘样例**（眼肉盖 谷饲100D+ 安格斯75VL 阿根廷3270厂 59元/kg 25吨）——行业数据 schema 五维（饲养/天数/VL/品种/仓位）为 MT BeefCutPrice 未覆盖的可操作缺口。工商：2021-10 成立/1000 万/**天使轮 2024-02**/在招 2 岗（"百万用户"系宣传，实际为早期 B2B SaaS 体量）。§七.1"预测循环与牛肉零交集"补记已闭合（rounds 128-132）。
- **IMPROVEMENT-PLAN v2.0.0 → v3.0.0**（第三波开发方向）：三条战略主线 + 5 批次——批 1 **进口成本计算器** `/tools/landing-cost`（输入已全部在库且日更：汇率组 08-29/CME 活牛 08-28/IMF 基准 07 月度——2026-08-30 psql 实测；牧集结构性做不了）；批 2 公开中文行情摘要页 + 每周真数据周报（学牧集 SEO 打法、不打人力研报）；批 3 贸易词汇五维（metadata JSON 先行 + CSV 模板扩展 + taxonomy 俗名映射）；批 4 track-record 周度快照物料；批 5 工程卫生打包。决策项 D1-D4（PRODUCT-SPEC 增补/休眠表清理/portfolios 与 predict-batch/指标眨眼）；不做清单按路由证据扩充（IM/店铺/保理/多角色）。v2 正文标记存档（全部批次已执行）。
- INDEX.md 两行导航同步。取证局限：付费墙内未验证（未登录、未触碰需鉴权接口）；SPA 无法真渲染（无浏览器后端），路由图来自公开静态资产。

### 2026-08-30 — round-133 冗余清理 + 状态维护轮

用户指令"清理当前项目的冗余项，维护项目状态"。全仓只读审计（文件级零引用 + 双端依赖逐包 + inference 对照真实导入名）后分三批执行，每批独立门禁。**审计结论：代码库文件级已经很紧**——backend 102 文件零死文件，frontend 仅 1 个真死项，依赖面仅 1 个可删包。

- **批 1 `015766f`（backend 依赖）**：删 `pg`——全仓 0 引用（raw SQL 全走 Prisma 引擎），lockfile -111 行。tsc + backend **1004+1**（97 文件，与 round-132 基线逐位一致）+ build + PM2 重启 + live /health、login 均 200。
- **批 2 `b3ae606`（frontend 空壳）**：删 `src/app/api/web-vitals/route.ts`——37 行 TODO-stub（只 console.log + "In production you would send this to your analytics service"注释）；真实数据汇是后端 `/api/metrics/web-vitals`（WebVitals.tsx beacon，经 Next rewrite 代理），该前端路由 0 调用方且是 `src/app/api/` 唯一文件（目录连带清空）。jest **324**（35 套）不变 + build（产物路由表已无该项）+ `pm2 restart mt-frontend` + live：旧路径直连/经 rewrite 均 404、真实 beacon 200、首页 200。
- **批 3 `786b094`（运维断裂修复）**：审计顺带发现 `scripts/user-management.sh` 两处 `require('bcrypt')` **从未能解析**（全仓只有 bcryptjs；从 backend cwd 实测 MODULE_NOT_FOUND）——create-admin / change-password 两条密码路径一直是坏的。对齐 `bcryptjs`（与 authService 同 `hash(pw, 12)`，$2a$ 前缀实测）+ 删 root 残留 `@types/bcrypt`（给从未安装的包的类型）。`list-users` 只读路径实跑验证。
- **状态维护（TECH-DEBT）**：round-106 登记的"死代码类"六项经逐条 grep 复核**全数已在历史轮次清理**（modelService→round-132、cache null 路径/tokenBlacklist 三函数/auth 采样查询/_importSchema→各轮、ForecastTrendChart→f131707）——登记文本滞后本轮补记关闭；`topCuts` 登记地址同步至合并后的 `beefQueries.ts`；metrics 提权项中 `/api/security/audit` 对照失效标注；新增 §十六 本轮记录。
- **排除的误报（防后续重扫再踩）**：前端零引用扫描 9/10 命中为目录导入（`ui/*/index.tsx` 经 `@/components/ui/X` 存活）或框架约定文件（middleware.ts、LoadingState→Skeleton 相对导入）；inference 的 sklearn/pandas 系 sktime/statsmodels 硬传递依赖的显式钉版、chronos 系函数内懒加载导入——均不可删。

### 2026-08-30 — round-132 收尾轮：watchlist 月度价格、D6 孤儿端点三组删除、D7 定案

用户指令"继续完成剩余的任务"。收尾第二波遗留的三项（TECH-DEBT 登记 watchlist 修复 + D6/D7 决策项），每批独立门禁：

- **批 A `15b2af9`（watchlist 月度价格，round-130 登记项）**：`watchlistService` 删本地 daily-only `batchLatestPrices` 副本，`listWatchlists` 改用共享 helper（月度回退 + interval 字段）；`batchRecentPricePairs` 同步补月度回退（rn≤2 monthly——quotes 的 change 对月度序列即环比；页面取价优先 quotes 端点，只修 list 会让收起态出价、展开态仍"暂无价格"）。+2 集成测试（自建 fixture，随测随清）。live：`beef_carcass_us` quotes 331.78 / 环比 -2.87% / 2026-07-01，list latestPrice 同步出值。
- **`c3170fc`（测试基建）**：`mapeTracking.monthly.test.ts` 健康月度 fixture 由日历锚（`monthStart(-1)`=07-01，随真实时间于 08-30 越过 60 天宽限而腐烂）改为壁钟相对日期（40d/30d），并补齐宽限分支（点龄 40d）与"实际值仍在到货"分支（点比预测新）双形态。
- **批 B（D6 处置，三组孤儿端点删除）**：五问全量重评后——`/api/security`(3，audit 前端从未发送)、`/api/models`(8，"与公开档案页互补"假设未成立——档案页用 `/api/signals/models/accuracy/public`；连带删除唯一消费者 `modelService.ts` 与 schemas 三条 ML 校验)、`/api/analytics`(2，correlation 为 live signals 版之外的第三套实现、seasonality 0 消费且 PRODUCT-SPEC 无规划)整组移除（路由 + 测试 + app.ts 挂载）；portfolios 维持登记；schema 与数据保留（`SecurityAuditLog` 49 行、`ForecastingModel`/`Forecast` 休眠表登记）。live 404×3、`/api/signals/correlation/matrix` 200；后端路由 20→17（AGENTS.md/API.md 同步，142→131 端点）。
- **批 C（D7 定案）**：sundial/timer_xl 残留 ~332 行**保留**（结构性隔离已钉住；删除属数据治理，未来用户明示再动）。
- **批 D（观察步骤抓获的两个月度链缺陷，live 验收）**：首 30 分钟 tick 观察发现 13 条月度订阅中 7 条从未产月度行 → 根因 1 **双节奏漏洞**：LME/world_bank 组带 180 条陈旧 daily 行（daily 循环按 7d 新鲜度拒收、fetcher 却读到 daily 行→日志 stamp 'daily'→月度新点守卫永远找不到月度行→hasNewPoint 恒真→30 分钟重算冻结输入，6 天 ~1.9k 冗余行/序列）。修复：订阅谓词加 `none: daily`（有效节奏=fetcher 实读节奏）+ 调度器自愈驱逐不再合规的月度订阅。根因 2 **60d 窗口误判**：实测首发滞后 44–53 天（点日期 M-01 发布于 M+1 中下旬），健康最新点龄跨周期 45→~76 天，60d 窗在每周期后半段误杀全部健康月度序列（live：beef 08-30 达 60.2 天被拒，`+ 0 monthly`）；`cadence.ts` 月度窗 60→**90**（滞后 45 + 节奏 31 + 滑期余量），五处（调度谓词/Pass A 宽限/Pass B 窗/expire 宽限/freshness 板）经同一常量同步生效，ADR-0001 ⑤ 修订记录附实测依据。live 终态：调度日志 `+ 6 monthly series`（恰为 6 条纯月度），13 条全部零新增行。另登记 `predictionBeefCoverage24h` 月度眨眼（诚实但误导的 0/1，TECH-DEBT round-132）。
- 测试：backend 1034+1 → **1036+1**（批 A +2）→ 批 B 删组后 1002+1 → 批 D 后 **1004+1**（97 文件；-34 随组删除 + 双节奏/驱逐 2 + 单测 mock 补 commodityPrice）；frontend/inference 未动。门内自纠 2 处：新测试首轮 `toBe(110)` 撞上 raw SQL Decimal（既有约定 `Number()` 包裹）；healthy-monthly 测试 fixture 日历锚随真实时间腐烂（改壁钟相对日期 + 补宽限/到货双形态）。

### 2026-08-24 — round-131 批 6b/6c 落地：月度序列进预测链闭环（D5 已确认，ADR-0001 Accepted）

用户确认 D5。ADR-0001 转 Accepted，按计划执行第二波最重的批 6b（4 个子提交）与批 6c，每批独立门禁：

- **批 6b-1 `43984cd`（迁移）**：`prediction_logs` 增可空 `interval` 列（TEXT，无回填——14 万旧行 NULL=daily 语义兼容，ADR-0001 ③）；mt_db/mt_test 双库应用；ADR 状态 Proposed→**Accepted**。
- **批 6b-2（订阅 + 守卫 + 落库）**：调度器月度谓词（最新点 ≤60d——取自 `cadence.ts`，2× 发布节奏——且全序列 ≥3 点，ADR ⑤）；`logPrediction` 月度去重守卫 + 30 分钟刷新周期级跳过（"仅新实际点后重预测"，ADR ④——否则月度序列以 30 分钟节律日产 ~336 条同训练集重复行）；data-fetcher 返回携带实际服务节奏，写库时 stamp。cut 序列不 stamp（导入节奏，非 CommodityPrice cadence）。
- **批 6b-3（验证生命周期节奏感知，全仓最高风险文件单独成批，ADR ②）**：`verifyDuePredictions` 月度到期 = 锚点 + horizon 个日历月、实际值窗按月取月度点；`markUnverifiable` Pass A/B 按 (commodity, cadence) 分组、冻结探测读行自身节奏、月度冻结需源 >60 天死（发布滞后宽限）；expire/restore 原生 SQL `CASE COALESCE(interval,'daily')` 分流（月度窗按月 + 60 天回填宽限）；共享 `windowHasActualsBarSql` 保持三清扫互为补集。daily 路径字节级不变（旧行为由存量测试全绿钉住）。**执行自纠 2 处**：Pass A 首版漏月度 60 天宽限（计划 6b 第 3 条原文，集成测试抓获）、Pass B 分区标记早退 bug。
- **批 6b-4（live 硬验收 + 订阅开启）**：`scripts/verify-monthly-lifecycle.ts` 受控验收——beef 回填行（窗口含真实 2026-05..07 PBEEFUSDM 收盘）按 server 同序穿越全部清扫 → **`verified`、MAPE 0、配对正确** → 探针删除零残留（可复跑）。live：`[PREDICT] Subscribed 15 daily + 13 monthly`（不止牛肉，全部健康月度序列进循环）；首轮按需触发 7 模型 × 1 行（forecast_start_at 2026-07-31）；二次请求/重启重算/缓存过期均**零日志增长**；unverifiable 增速 0；`predictionBeefCoverage24h` 0→**1**（round-128"背景预测与牛肉零交集"缺口闭合）。
- **批 6c `397a86f`（cadence 元数据端到端，ADR ①）**：`CachedPrediction` 增 `interval`/`horizonUnit`，**三写方同 commit** stamp（predictionCache 后台写方 + /predict + /predict/batch，INT-1 形状漂移教训）；`PriceForecast`（signals）与 /predict/visualize 载荷透传 `horizonUnit`；`cadence.ts horizonUnitOf` 单一推导；前端 `PriceForecastPanel`"未来 {horizon} 天"→单位感知"未来 N 个月/天"（默认 day，daily 显示与旧信号安全退化）。live：beef 信号载荷 `horizonUnit=month`。
- 测试：backend 1020+1 → **1034+1**（98→100 文件，+14：月度谓词/守卫 6 + 生命周期集成 6 + INT-1 形状钉住 2）、frontend 322 → **324**（月度/默认标签 2）、inference 64 不变；零回退。文档：IMPROVEMENT-PLAN round-131 执行状态 + D5 定案、TECH-DEBT round-127 月度链条目收口（遗留 correlation/analytics 为 ADR 显式不做）。

### 2026-08-23 — round-130 第二波执行：批 7/8/6a/9/10 落地（5 提交，D5 ADR 待确认）

用户指令"开始执行计划"。按 IMPROVEMENT-PLAN 第二波顺序执行全部无决策依赖批次，每批独立门禁（tsc + 全量测试 + build + PM2 + live + commit）：

- **批 7 `e33956b`（F3 修复，扩范围）**：/trading 牛肉模式默认 `beef_cutout_us`(0 行)→`beef_carcass_us`；对抗评审发现的深层问题一并修——价格历史与共享 `batchLatestPrices` 加月度回退（月度序列此前在列表/自选显示"无价格"，latestPrice=null）；signals 空序列 200 + `insufficientData` 降级（原 500）；前端诚实处理 + 月度序列隐藏无意义周期选择器。live 四项全过。
- **批 8 `21661cd`（口径收口）**：公开档案页 methodology 写明 verified-only 分子 + predictionCount 分母含失效行的双向口径（消解 7% vs raw 55% 的口径歧义）；榜单注册表钉住测试（days=7/30/90，死模型结构性不可出现）。
- **批 6a `dd0aeaa`（cadence 感知第一步）**：新建 `services/cadence.ts`（stalenessWindowDays：7d daily/60d monthly 单一策略 seam）；freshness 板 interval 感知——`beef_carcass_us` 从"null/stale"变为"monthly/2026-07-01/非 stale"。调度门控按简化原则挪 6b。
- **批 9 `583c376`（可观测性）**：/health/ready dataLayer 增 `beefSeries`（cut 板 115d stale + 基准 53d 非 stale）与 `predictionBeefCoverage24h`（诚实命名：含手动路径，实测批 7 的 live 调用使其 0→1）；cron 状态转移 + 日心跳降噪（双跑验证：首跑记录、次跑静默、字段改名重触发）。
- **批 10 `40286a7`（解冻配套）**：`backend/scripts/verify-beef-import.ts` 一键验证（打包 runbook §五 + 新增行数增量基线与 14 天覆盖）；生产双跑：基线 2401、冻结 115 天如实 WARN。
- **D5 ADR 起草**：`docs/adr/ADR-0001-monthly-series-prediction-semantics.md`（仓库首个 ADR，**Proposed 待用户确认**——批 6b/6c 的前置门）。
- 登记：watchlistService 本地 batchLatestPrices 副本仍 daily-only（TECH-DEBT §十四）；round-127 两条登记项更新（月度链进展注记 + F3 已解决）。
- 测试基线：backend 1004+1 → **1020+1**（97→98 文件，+16）、frontend 322/35、inference 64 不变；零回退。服务全程在线。

### 2026-08-23 — round-129 第二波开发计划（14 skill 规划法 + 对抗评审修订）

用户指令"利用尽可能更多的skills，根据之前的观察结果规划后续的开发任务"。以 rounds 121-128 观察结果为输入（对标复评 §七、TECH-DEBT §十四 登记、MAPE 口径分裂等），调用 14 个 skill 分四批完成规划（战略/工程决策/质量发布/规格对齐；to-prd、triage 按"需 issue tracker"前提判不适用，1 个 skill 名未命中诚实记录），产出 IMPROVEMENT-PLAN.md **v2.0.0 第二波**：

- **批 6a-6c 月度序列进预测链**（核心）：初稿经 fresh-context 对抗评审（Explore 代理 68 次读核对 file:line，报 2 blocker + 6 major + 6 minor 全部有效采纳）后分解——6a 门控 interval 感知（月度谓词=最新点≤60天 且 ≥3 点，防订阅抖动）、6b 验证生命周期（到期/实际值窗/三处清扫按 cadence；月度仅在新月度点后重预测，防日产 336 条日志污染；**硬验收=首条月度预测到达 verified**，订阅开启以此为止回闸）、6c cadence 元数据（CachedPrediction 三写入方同步改，防 INT-1 重演；前端"未来 N 个月"标注）。
- 批 7 扩范围：仅换 /trading 默认序列不够——价格拉取无月度回退页面仍空（评审 M1），批含 getPriceHistory 按序列 interval 取数 + signals 空序列 2xx 降级。
- 批 8 口径统一 / 批 9 新鲜度可观测（后端端点实现位 + 状态转移降噪）/ 批 10 CSV 验证一键化（backend/scripts + tsx 惯例）。
- 决策项 D5（月度预测语义 ADR，含 correlation 不做的纠错理由：daily-only 读取与跨节奏对齐，非点数不足）/ D6（孤儿端点五问处置）/ D7（死模型数据保留）。
- **规划期即时修正**：COMPETITIVE-ANALYSIS v1.1.1——发现并修正自家 v1.1.0 复评注的 MAPE raw 口径污染（chronos_mini 30d 16 条 stale 行 avg≈9676% 把 raw 均值抬到 55.43，verified-only 实为 7.05，与公开档案页精确吻合；全模型 verified-only 表入档），PRODUCT-SPEC §七 同步再修（46-59% raw → 7-10% verified，"全面劣于 naive 约 2 倍"结论不变）。

### 2026-08-23 — round-128 对标牧集第二轮复评（COMPETITIVE-ANALYSIS v1.1.0）

用户指令"再次评估当前项目与牧集网之间的差距和相比之下拥有的优势"。对 v1.0.0（同日 round-121 制定）全文复核，两侧重新实测：

- **撤回一项优势声明**：初版 §四.2"beef_carcass_us 日更、全站唯一日更牛肉序列"实为 CBBTCUSD 比特币错标（round-126 已修复），该优势从未存在；降级重写为"月度 IMF 全球牛肉基准 + 日更 CME 活牛/架子牛期货（上游代理）"。
- **新发现（比初版更严重的价值错位）**：背景预测 24h 覆盖 17 商品全为汇率/CME，`beef_carcass_us` 0 条预测（月度门控排除，round-127 登记项）——自动预测循环当前与牛肉零交集；MAPE 验证吞吐坍缩（30 天窗口每模型仅 20 条新验证）；死模型 sundial/timer_xl 残留 332 条须在档案页过滤。
- **MAPE 表刷新并解释漂移**：verified 计数较初版降 ~500/模型、均值上移——系清除错标预测连带其验证记录，即"错标数据此前在美化 MAPE 统计"；30 天口径统计基线 avg 0.74~0.82 承担投票、chronos 仍被淘汰（结论不变）。
- 表面数字刷新：45 页 / 18 源 / 1390 测试 / 144 端点（不变）；watchlist 已建且有 4 清单/3 条目在用；牧集 App Store 实测 V2.26.5（2026-06-10，应用宝镜像滞后）。新增 §七"第二轮复评结论"（差距一项加深四项不变；优势一项撤回降级其余增强）。
- 附带修正 `site-stats.ts` 头注集成算式（19 = 18 源文件含 inac 休眠 + /api/beef/import CSV 通道；导出数字不变），前端 tsc 0 错 + 322/35 套件全绿。

### 2026-08-23 — round-127 方向符合性深度审计（debug 轮，2 提交：修复+登记）

用户指令"对项目进行深入的debug，寻找与项目规划方向不符的地方"。以 PRODUCT-SPEC/核心价值链/不可越线为准绳全面比对，产出发现清单并处置：

**审计确认合规（无需动作）**：交易/支付零残留（billing 静态、无 checkout、前端无下单语义）；`.fit()` 为统计模型推理固有机制（约束明确允许统计模型，非"训练"违规）；预测管线健康（~323 条/小时在写——过程中一次"停摆"警报系 psql 会话时区比较假象，已澄清撤销）；三服务健康。

**发现并已修复（round-126 换月度序列引入的回归，本轮 own 并修）**：
- `/ai/predict` 默认表单 500：`data-fetcher.getCommodityPriceValues` 与 `inference.ts` 三处历史查询硬编码 `interval:"daily"`，月度牛肉基准取 0 点。修复：daily 空则回退 monthly（`fetchHistoryWithFallback` helper + data-fetcher 回退），live 复测 success=True/50 历史点/10 步预测。
- landing Hero "Daily series" 硬标签错标月度序列：改为按序列点间距中位数推导（≥20 天 → Monthly）。
- Hero "unit 核验中"过时注释 + predict 页 "only daily-updating" 过时注释更正（D4 已定案）。

**发现并登记（TECH-DEBT §十四 新增两条，不擅动）**：
- 月度序列未进后台预测链（决策项）：调度订阅门控/MAPE actuals/相关性/新鲜度板全部 daily-only，唯一真实牛肉序列被静默移出核心价值链；on-demand 已修，后台需先决策月度语义（horizon 步长/验证窗口）。
- `/trading` 牛肉模式默认选 `beef_cutout_us`（0 价格行）且 signals 对空序列 500 而非优雅空信号（前端有诚实降级）；正确默认应为 beef_carcass_us。

**产品真相同步（PRODUCT-SPEC 修订注记 3 处）**：§5.1 三卡 mockup、§六 表格行（round-126 第一卡已换全球牛肉价）；§七 MAPE "1.7%/3.6%" 陈旧声明按 round-121 取证修订。

**测试**：backend 1004+1（97 文件）、frontend 322（35 套件）、inference 64——**1390 全绿**零回退；build×2 + PM2×2 + live 复测全过。

### 2026-08-23 — round-126 剩余开发任务轮（D1/D2 执行 + D4 意外定案修复，4 提交）

用户指令"继续完成剩余的开发任务"= 对 IMPROVEMENT-PLAN 决策项 D1-D3 放行。执行中发现并修复一起**数据诚实性事故**。

- **D2**（`c16ff34`）：dashboard KPI 冻结卡（进口均价，04-30 种子值 + "—"趋势）换为真实牛肉基准卡（同批 1 highlights 源：值+单位+日期入标题+观测间涨跌%+30 点 sparkline）；国产卡保留。
- **D1**（`dd91b88`）：`/watchlists` 最小页 + `useWatchlists` hooks（+5 测试 317→**322**）——清单切换、optgroup 选品器（有价优先、无价标注）、现价/涨跌/真实数据日期、移除；导航"行情"段加入；消费既有 7 端点零后端改动；live 全流程（创建/加项/quotes）验证后清理验证数据。
- **D4 定案+修复**（`02fe33a`，本轮最大发现）：访问 FRED 原页证实 **CBBTCUSD = Coinbase 比特币/美元日线**（最新 77,117.73 与库内逐位一致）——种子把 "CB-BTC-USD" 误读为牛肉胴体，**11.6 年 BTC 日线（4248 行）以"US Beef Carcass (USD/cwt)"名义入库**并曾展示于 Hero/dashboard，6165 条预测随之失效。修复：序列置换 `PBEEFUSDM`（IMF 全球牛肉月度，USC/lb）+ 月度 62 天窗口 + highlights 端点 monthly 回退与取整 + DB 清洗（改名/删 BTC 行/删错标预测）+ 1990 起回填 **195 个月度点**（最新 331.78 与 FRED 官方一致，MoM -2.87%）+ cme 爬虫手动刷新 31s 无错。dashboard 卡与 Hero 改挂"全球牛肉价（IMF 月度）"。真·USDA 胴体日频仍需 USDA key（KNOWN-ISSUES D1/D4 遗留注记）。
- **D3 维持非代码**：种子用户访谈/档案周更/CSV 获取为运营与外部输入，无工程动作。

**测试**：backend 1004+1（97 文件）不变、frontend 317→**322**（35 套件）、inference 64——合计 **1390 全绿**。文档：KNOWN-ISSUES D4 重写为已解决、IMPROVEMENT-PLAN 决策项状态块、TECH-DEBT §十四 watchlist 两条划除、AGENTS/README 页面数 44→45。

### 2026-08-23 — round-125 状态统一轮（docs-only，0 代码改动）

round-121~124 四轮连改后全仓状态对齐实测：git 树净于 `aa20da5`、dist/.next 均新于源码、三服务 PM2 在线且 `/health/ready` 为 ready（DB/Redis/inference 全 true）；三套测试**实跑**复核 backend **1004+1**（97 文件）/ frontend **317**（34 套件）/ inference **64** = **1385 全绿**，与 AUTOMATION-STATUS 声称一致；live 抽查 public-highlights / public-track-record / /ai/track-record 均 200、已删 `/api/market/import` 404。

- **AGENTS.md**：数据源爬虫 **19→18**（round-124 删 manualImport 所致，附复核说明），§三 复核日期 2026-08-23，§九 示例改为"数字随轮次演进"。
- **README.md**：5 处"19 数据源"陈述改 18；数据源表删 Manual Import 行（18 行与 18 文件一一对应）；规模数字注记更新为 2026-08-23 实测。
- **PROJECT-VISION.md**：新增 2026-08-23 状态指针（round-121~124 摘要 + 当前基线 + 事实入口），历史正文不重写。
- 核对无漂移：API.md（142 端点行，import 已划除）、AUTOMATION-STATUS（1385 口径含删测试说明）、TECH-DEBT §十四/§十五、INDEX、PRODUCT-SPEC、KNOWN-ISSUES；AUTOMATION-STATUS 内"19 源"均为带日期历史审计记录，保留。

### 2026-08-23 — round-124 瘦身轮（用户指令"体量不过于臃肿，核心功能最重要"，3 提交）

双路全量零引用扫描（前端 111 文件/后端全量）+ 依赖审计 + §十四 登记项按指令处置（TECH-DEBT §十五 记录）。结论：代码库已相当紧（后端 0 死模块），臃肿在登记过的非核心面。三批：

- **批 A**（`d21de3a`）：删前端唯一死文件 `lib/watchlist.ts`（101 行 0 消费者）；后端 5 个零调用导出 + 孤儿注释；过期 e2e（trading-subpages.spec 整删——5 条 goto 指向不存在路由，另 3 条死 goto）；未用依赖 cross-fetch/is-core-module/js-yaml。
- **批 B**（`8e7248b`）：删 §十四 登记的双重孤立 `POST /api/market/import`+`/preview`（无前端消费+无路由测试）连同 manualImport 服务及其 7 测试；数据回填正路 `/api/beef/import` 不受影响；API.md 144→**142** 端点；live 404 验证。
- **批 C**（`b53b20a`）：删 §十四 登记的空壳页 `/settings/sessions`+`/settings/notifications`（承诺的功能后端不存在且无规划），settings 集线卡/快捷入口/e2e 同步。

**测试口径**：backend 1011+1 → **1004+1**（97 文件；-7 为被删服务自带测试，随功能走非覆盖回退）、frontend **317**、inference 64——合计 **1385 全绿**。核心价值链（数据→推理→信号→前端）零触碰；watchlists 端点/D1 决策项/inac 休眠源/EDGE Prisma 模型全部保留并登记不动理由。

### 2026-08-23 — round-123 改进方案执行轮（5 批全落地，5 提交，测试 999+1→1011+1 / 314→317）

「执行」[IMPROVEMENT-PLAN](IMPROVEMENT-PLAN.md) 全部工程批，每批 tsc+全量测试+build+PM2+live+独立提交：

- **批 1 活水证据 + 诚实 landing**（`72f180e`）：新公开端点 `GET /api/market/public/highlights`（白名单宏观序列，无鉴权 + cacheRoute 300s）；Hero 弃用捏造样本价（Chuck Roll $389.50 等硬编码 + 假动画 sparkline + 假 "AI Consensus 78%" 信号条）换真实日更 `beef_carcass_us`（无 "$" 前缀 + 源序列号 CBBTCUSD 透明标注——**单位语义存疑新登记 KNOWN-ISSUES D4**：现实中该 FRED 序列是月度 ¢/lb 指数，库内标 daily USD/cwt，绝对值展示降权为次要）；Features/GettingStarted 装饰图全部改真实分类学事实（beef_cut_taxonomy 实测 IMPS 码）与真实源名，清除已废除的 Buy 信号语义；`aiModels` 3→9 + 六处"Chronos 组成共识"声明结构改写为质量加权口径（FAQ/Features/about/pricing/QuickActions/site-stats）。
- **批 3 共识对齐现实**（`39a13cc`）：执行中发现**淘汰线空转**——默认池 `ALL_MODELS` 仅 3 chronos，三模型全部劣于 naive 触发淘汰线后权重和 0 → 等权兜底，即"documented edge 就是生产默认"（COMPETITIVE-ANALYSIS §三.3 三次修订）。扩池 3→7（+4 统计基线；stl 按 B3、sarimax 无实证排除）使质量机制真正咬合（live 30 天中位：统计 0.40~0.52 投票、chronos 0.79~0.82 出局）；三处残留收口：共识 range 只由权重>0 模型构成、predictedChange 加权均值、bestModel 按验证权重（置信度仅决平）；mapeTracking 池/基线重叠去重；isPrimary 语义改为池成员（accuracy 页 pretrained-vs-statistical 分组解耦为 id 前缀）。
- **批 4 predict 页**（`283c685`）：模型下拉改调 `/api/inference/models`（单一事实来源，不可达时诚实禁用而非静态复制）；预填 `root.test2`→`beef_carcass_us`（旧默认匹配不到任何 commodity，提交必 400）。
- **批 2 公开预测档案**（`2f47d86`）：`GET /api/signals/models/accuracy/public`（无鉴权）30 天榜单 + 最近 50 条已验证预测（predicted vs actual vs MAPE），**正向白名单**（宏观 commodity + cut: 键，私有序列 id fail-closed，6 测试钉死含种子私有 id 排除断言）；公开页 `/ai/track-record`（PUBLIC_PATHS）+ Footer 入口 + 方法论展示——14.8 万条预测日志首次成为对外信任资产。**执行中发现并修复测试→生产 Redis 缓存投毒**：supertest 走 cacheRoute 会把 mt_test 响应写进共享 db0 的生产键（live 端点曾短暂返回测试 fixture 行）；测试现在强制 `redis://localhost:6379/1`，生产被污染键已清。
- **批 5 周导入 runbook**（`e84033f`）：[WEEKLY-DATA-IMPORT](guides/WEEKLY-DATA-IMPORT.md)——第三方可照做的 30 分钟周节律（源/模板/步骤/验证 SQL/故障表/回滚/退出条件），D1 冻结期核心数据解冻的唯一路径。

**测试基线**：backend 999+1 → **1011+1 skip**（98 文件）、frontend 314 → **317**（34 套件）、inference 64 未动——合计 **1392 全绿**，零回退。D1-D3 决策项（watchlist UI / dashboard KPI 卡 / 运营动作）保持登记未动。

### 2026-08-23 — round-122 改进方案制定（对标分析 → 执行计划，纯文档 + 一处事实修正）

「按照探索的结果制定改进的方案」：规划前复核共识引擎现状，发现并**修正 round-121 分析文档一处失实**——初版称"共识未按 MAPE 加权、继承 chronos 尾部风险"，实测 `modelQuality.ts` 早已实现质量加权（round-115 中位口径）+ 劣于-naive 淘汰线（round-110）；当前 30 天窗口 chronos 三变体（中位 0.79~0.82 vs naive 0.41）与 stl 已被淘汰出共识投票，共识实际由 4 统计基线驱动；残留缺口收窄为 range min/max、无权 predictedChange 均值、bestModel 三处不感知权重 + 营销口径倒挂（Hero 仍以"3 Chronos 共识"领衔）。全周期 chronos 均值 46~59% 系早期未清洗窗口所致（30 天窗口实为 6.2~8.8%），修订记录已附原文。产出 [`docs/IMPROVEMENT-PLAN.md`](IMPROVEMENT-PLAN.md)：5 个工程批（1 公开活水端点+Hero 假数据换真 beef_carcass_us+口径对齐 / 2 公开预测档案页（含私有序列白名单安全断言）/ 3 共识残留缺口收口 / 4 ai/predict 硬编码修正 / 5 周导入 runbook）+ 3 决策项（watchlist UI、dashboard KPI 卡、运营动作），每批附文件:行锚点、验收口径与门禁；发现 Hero 样本价为硬编码假数据（Hero.tsx:122-126）而真实日更数据在库——批 1 即"活水证据"。

### 2026-08-23 — round-121 牧集对标分析（差距/根因/优势/落实路径，纯文档）

「比较当前项目与牧集网之间的真正差距」：牧集公开面实测（App/产品页/应用商店，付费墙内不可验）+ MT 生产库 psql 取证（3 用户；beef_cut_prices 2401 行/16 部位/5 工厂/仅 2026-04 一月冻结 115 天；prediction_logs 148,245 条，MAPE 均值+中位双口径）。产出 [`docs/COMPETITIVE-ANALYSIS-MOOKET.md`](COMPETITIVE-ANALYSIS-MOOKET.md) 并注册 INDEX。核心结论：真正差距在**数据资产与分发**（不在功能/工程——MT 反超）；价值未兑现根因链 = 价值链倒置建设 + 数据获取模式错配（国内现货价无公开源可爬）+ AI 叙事与实测倒挂（chronos 中位 0.8% 不差但均值 46-59% 灾难长尾，被营销领衔的恰是尾部风险最大的）+ 预测公信力无对外展示面 + 3 用户零反馈。可防御优势：可验证预测机制、国际源头管道（beef_carcass_us 全站唯一日更牛肉序列）、中立性+可私有部署。落实路径 P0=CSV 回填节律（唯一 P0）→ P1 公开带时间戳预测档案 + 共识按实测加权 → P2 定位"进口牛肉国际行情×可验证预测"+种子用户 → P3 私有部署楔子；不做撮合/采价网络/冷链。

### 2026-08-23 — round-120 完整度审查 + 快修批（骨架完整、数据贫血；快修 8 文件 + 文档 3 份）

「重新审查项目的完整度」：4 只读子代理（spec 符合度 51 条 / 前端 44 页 / 后端 143 端点 / 数据-推理管线五段）+ 运行时与生产库取证。总体判定：**骨架完整（价值链五段代码无断点、44 页 0 死链、spec ≈90% 达成、零 TODO 残留）、数据贫血（beef_cut_prices 100% 冻结于 04-30、真实用户 0）**。处置：

- **快修批**（`398ad98`）：补 `PATCH /api/timeseries/:id`（前端编辑页自始提交该路由但它从未存在——保存必 404，+9 测试）；`/beef/cuts` 死路由加 redirect → `/beef`；Footer 锚点 `/#features`→`/landing#features`（`/` 是丢 hash 的客户端重定向）；"Sign In" 直指 `/login`；移除 pricing/PLANS 的 "5/50 watchlist items" 虚假卖点（watchlist 无 UI 入口）；修 freshness 测试时间炸弹（种子数据出 7 天窗口隔夜翻红，改自播种）。
- **文档对齐**：API.md 1.3.0→**2.0.0 全量重写**（旧版 9 幽灵端点/5 错/~95 缺 → 新版 20 router 144 端点实口径，含 API-only 标注）；PRODUCT-SPEC §七 修订 socket.io 失真（round-112 已移除）与 RSS 状态（round-118 已接入），IA 表注明 /beef/cuts 重定向；TECH-DEBT 新增 §十四（65 孤儿端点收敛候选、watchlist/search/用户菜单决策项、UI 细节缩水清单、空壳页、naive 优于 chronos 的价值叙事注意）。
- **测试基线**：backend 990+1 → **999+1 skip**（96 文件）、frontend **314**（33 套件）、inference **64**——合计 **1377 全绿**，零回退。

### 2026-08-22 — round-119 缺陷深挖 + 修复轮（探查 ~40 项新缺陷，修复 4 批）

全仓四路审查（后端正确性 / 安全 IDOR / 前端 / 推理服务，4 只读子代理）+ 运行时日志 + 生产库审计，在既有台账外确认约 40 项新缺陷（9 高 / 14 中 / 17 低），全部高严重度经直接取证复核（推理侧 2 项由子代理 TestClient 复现）。按 4 批修复（每批 tsc + 全量测试 + build + PM2 重启 + live 验证 + 独立提交，明细见 TECH-DEBT §十三）：

- **安全批**（`3890eb1`）：anomalies/models 域读+写路径属主化（跨用户枚举私有异常记录与 context 数值、泄漏 trainer 邮箱、向他人模型写 Forecast——round-106 漏网端点）；/api/anomalies/detect 加 aiRateLimiter（单次可扫 10 万行）。
- **稳定性批**（`6274464`）：predictionCache 四处 Redis 故障容错（getRedisClient 失败是 throw 而非 null，旧 `if (!client)` 判空为死代码——Redis 宕机/30s cooldown 曾致 signals 路由 500、共识全模型 unavailable、prediction_logs 停写）；getPriceHistory 改 desc+take+reverse（旧 asc+take 返回最旧 N 行，前端图表画 2020 年价格）；前端 errorHandler 按 ApiFetchError.status 分类（4xx 曾被当 NETWORK_ERROR 重试 3 次）；useTradingData 商品切换清理 effect deps=[] 修复（round-106 修复从未生效）。
- **数据批**（`d109af4`）：CME Yahoo 日线曾整体回溯一天（+08 服务器本地 `setHours` 把 session D 存成 D-1 16:00Z——周日有 bar/周五缺失）→ `setUTCHours` + OHLC 占位值 guard（cotton 曾落库 open=0.0、close>high）；生产数据同事务修正（100 行日期 +8h、3 行 OHLC，备份 `backups/round119/cme_rows_pre_fix.csv`），boot runAll 复核 0 周末 bar / 0 OHLC 违例。**beef_cut_prices「960 组三重重复行」复核为误报撤销**——按 (cut,date,source) 分组漏了 factoryId 维度，实为 AU-847/239/1260 多工厂合法同价报价，未删任何行。
- **加固批**（`a6d810c`，20 文件）：推理服务输出侧有限性 guard（ARIMA 非收敛 NaN 区间曾以 null 穿透 200 → Redis/prediction_logs/信号置信度=1.0；`/predict/batch` 曾因单项 NaN 整批 500）+ LinAlgError 不再误报 422；日志三参调用序列化修复（SLOW_REQUEST 行曾是 `{"0":"R","1":"e"...}` 字符索引对象）；boot ingestion 日志走 classifyIngestionStatus；预测订阅调度 6h 重跑（原仅启动一次，运行中复活的源不进后台刷新/MAPE 环）；RSS slug 冲突确定性 hash8 兜底（周期性重复标题曾永久无法摄取）；beefIngest 事务回滚计数器重置；前端 9 项（401 登录提示死码/dashboard 静默归零/data-sources 全失败空白页/告警颜色旧枚举/beef 页误导空态/删除双击/双请求/NaN overlay 等）。

**测试基线**：backend 951+1 skip → **971 pass + 1 skip**（94 文件）、frontend 309 → **314**（33 套件）、inference 60 → **64**——合计 1320 → **1349 全绿**，零回退。

**仍开放（未修，登记 TECH-DEBT §十三）**：~~注册默认 EDITOR 架空 AI 付费分层与资讯发布权~~（**已处置 `1073acc`**：注册默认 VIEWER + AI 分层改 `AI_TIER_ENFORCED` env 门控默认关；清理 1796 个测试残留用户，备份可回滚）；~~runAndCachePrediction 并发去重；推理客户端 240s 超时重试放大/无负缓存；datasets import 列数上界；alerts rules timeseriesId 归属校验；/api/market/sources 错误串对 VIEWER 可见；useDashboardStats alerts 双请求；beefIngest MM/DD/YYYY 本地时区解析~~（**权衡批全部处置 `739d375`，2026-08-22**：按用户"最合逻辑 + 尽量简化"原则决断——并发去重用 in-flight 键共享（一次计算+一次 logPrediction，失败不记忆；**负缓存明确不做**，理由记录 TECH-DEBT §十三）；推理客户端超时免重试（AbortError 直接 503，快速网络错误保留单次廉价重试）；valueColumns 上限 50；规则 timeseriesId 属主校验（同 404）；/sources 剥离原始错误串（cacheRoute 全用户共享缓存下按角色分支不可行，status 枚举即故障信号）；dashboard alerts 单请求切片；斜杠日期显式 UTC 解析（越界分量拒绝滚动）；billing/pricing 文案对齐开放阶段现实（"Free=3/Pro=7 AI models" 失实 → 全员 9 模型开放口径，过期 7 修正为 9）。backend 974+1 → **990+1 skip**（96 文件）、合计 **1368 全绿**）。

### 2026-08-22 — round-118 规划执行轮（探查→规划→落地，5 提交，测试 1288→1320）

全项目探查 + 状态分析 + 开发规划后，按规划执行全部可工程化批次（Phase 0 决策采用规划建议的默认值）：

- **TD-8 mutation 全收敛**（`2c6def7`）：9 处 POST/PATCH 裸 fetch（useBeefImport multipart 上传、login/register、data-sources refresh×2、ai/predict + ai/anomalies visualize、apikeys GET+PATCH、WebVitals beacon）全部迁入唯一 API client。配套扩展：ApiFetchError 携带 status + 错误 body（覆盖 `{error:{message}}` / `{message}` / `{error}` 三种后端错误形状的消息提取，迁移站点错误文案逐字保留）；authFetch 对 FormData 跳过默认 Content-Type（浏览器设 multipart boundary）。+7 测试。
- **M3 资讯 RSS 接入**（`0d758d0`）：PRODUCT-SPEC M3 点名的唯一缺口（"model/route/service/页已建，缺外部数据抓取源"）补全——`services/newsRssIngest.ts` + 调度作业 `news-rss-ingest`（6h）；Beef Central + USDA Federal Register 两个实测可达 feed 经共享 scraperFetch 拉取入 market_news；sourceUrl 去重、per-feed/per-item 故障隔离、HTML 剥离、maxItems 洪水护栏、ADMIN 归属 authorId；唯一新依赖 fast-xml-parser 5.11。live 验证：首跑 +15 篇（10+5，2026-08-21 新鲜内容），重启复跑 +0（幂等实证）。+8 测试。
- **核心 hook 测试**（`e978192`）：useTradingData（装配/自动选择/图表映射/currentPrice/信号/中位最优模型/异常/overlay 聚合/actualValues-only 历史 + beef 模式 DESC 升序/顺序无关 latestPrice/双源分组 + 信号错误暴露）与 useBeefCutForecasts（成功映射 + 失败诚实 null）。+5 测试。
- **Tier1 爬虫源级测试**（`887a906`）：commodityPrices（货币对推导/USD 单位反转/平烛诚实/部分跳过/API 宕机兜底）、fredData（空 key 门控钉死当前生产行为/12 条观测上限/'.' 过滤/seriesKey 消歧/global region/单源隔离）、dceFutures（前月结算解析/'-' OHLC 平烛回退 + null volume/坏行跳过/双交易所单符号隔离）——源级覆盖 3/19→6/19。+12 测试。
- **品牌诚实化**（`afe2a55`）：site-stats dataSources 7→19（2026-08-22 实测口径，3 产数的拆分写入头注释）；about "Pretrained models" 卡改为 Chronos 主力口径（原只列统计基线与实际引擎不符）；清除 3 个死按钮（about Contact Us、pricing Contact Sales/View Documentation → 可用的 Create Free Account 链接）。

**数据层实测（2026-08-22，证据入 KNOWN-ISSUES D1）**：网络经 mihomo 出口实际可用（beefcentral/fred/mla/federalregister 200），但 MLA/USDA_MARS/OPENWEATHER 三把 key 在 .env 中为**空串**、FRED_API_KEY 缺失——源复活卡在 key 获取（用户动作），代码侧端到端就绪；真产数源仍为 3（cme_futures/commodity_prices/world_bank）。RSS 资讯成为当前唯一自动新增的外部内容通道。

**测试基线**：backend 931+1 → **951 pass + 1 skip**（92 文件）、frontend 297 → **309**（33 套件）、inference 60 未动；合计 **1320 全绿**，零回退。

### 2026-08-21 — round-117 代码组织深化轮（架构评审被认可后执行，4 提交，397→385 文件）

用户认可文件数量评审结论（文件数是错误目标，深模块/locality 才是），按 Top recommendation 执行 4 批（每批 tsc+全量测试+build+PM2 重启+live 验证+独立提交，明细见 TECH-DEBT §十一）：

- **死文件清理**（`f131707`）：ForecastTrendChart（round-106 起仅存于注释）、backfillFred（全仓零引用）、前端 types 死 barrel（0 引用）——−390 行，deletion test 直接通过。
- **schemas 4→1**（`8b8ff00`）：zod 四微文件合并为单 schemas.ts，导出不变，9 个消费文件 import 改写。
- **alerts 三件套合一**（`792d1c1`）：alert-types + alert-rules 并入 services/alerts.ts，顺带消灭半 barrel。
- **beef 6→2**（`25eb6a4`）：写入侧 beefIngest（import+bridge）/ 读取侧 beefQueries（aggregation+cutSeries+trends+freshness）——改 beef 域从跨 6 文件变 2 文件。
- 量化：前后端文件 397→385（−3.0%），净 −535 行；测试零回退（931+1 skip / 297 / 60）。否决清单（不合并爬虫/测试文件/路由的理由）记录在 TECH-DEBT §十一防重提。

### 2026-08-21 — round-116 开发文档维护轮（documentation-and-adrs，只读实测 + 漂移修复，纯文档 0 代码改动）

指令"维护项目的开发文档"。全部数字当日只读实测（计数命令 / DB 查询 / live curl），核对 AGENTS.md / README / CLAUDE.md / INDEX / KNOWN-ISSUES / TECH-DEBT / AUTOMATION-STATUS / PRODUCT-SPEC 全集后修复 4 份文档 15 处漂移（另刷新本文件 front-matter 日期）：

- **AGENTS.md（7 处）**：核实日期 2026-07-27→2026-08-21（§三 19/30/20/44/9 当日全部复测吻合，live /models 返回 9 id）；"Vitest 2"→"Vitest 4（4.1.10）"——round-90 升级后漂移近 11 天，KNOWN-ISSUES T2 早已实证过期但一直未修；§九 数字纪律示例 31→30；§八 补 PREDICTION-STRATEGY.md / SKILLS.md 两行（前者 INDEX 已收、后者 §十.1 引用，导航表均缺）；端口表 5001 标注"仅 dev 模式监听"（PM2 prod 下实测未监听）；宿主机 PG/Redis 复测日期刷新。
- **README.md（8 处，诚实性修正为主）**："85+ 牛肉切割部位价格"→实测 74 部位分类、其中 16 部位有实价（taxonomy 74 行 / price DISTINCT cutCode=16，psql 实测）——历史夸大数字；"2,400+ 价格"补注"2026-04 种子快照，见 KNOWN-ISSUES D1"（实测 date range 04-01~04-30）；Prisma 模型 31→30（×3 处，round-114 删 organizations 后漂移）；技术栈/前置条件 "PostgreSQL 15 / Redis 7"→"14+ / 6+（生产实测 14.23 / 6.0.16）"——README 版本与宿主机 systemd 实况矛盾近一月；规模数字注行日期刷新。
- **KNOWN-ISSUES.md（1 处）**：R2 单位冲突类补 round-115 wheat_cme 复发记录（同类第 4 例、单源内部变纲，三层修复 + chronos 结论反转），按本文件"追加不删除"约定登记，与 TECH-DEBT §十互链。
- **PRODUCT-SPEC.md（1 处）**：§六 阶段 0 决策 "85+ 牛肉部位（用 landing 现有数字）" 补 2026-08-21 核正——前端已无 "85+" 文案（grep 实测），DB 实测 74 分类/16 实价，防止后续文案再引用夸大数字。
- CLAUDE.md / INDEX.md / TECH-DEBT / AUTOMATION-STATUS 复核无漂移（INDEX 已收录全部活文档；AUTOMATION-STATUS 测试数系 round-115 刚更新）。

### 2026-08-21 — round-115 候选执行轮（推送 73 提交 + 6/6 深化候选落地，6 提交）

指令"推送，然后完成候选项"。先行推送 round-98 以来 73 提交（`6f74ba0..9354996`），随后按评估 §9.7 逐候选执行（每批 tsc+全量测试+build+PM2 重启+live 验证+独立提交，明细见 TECH-DEBT §十）：

- **cand-6 诚实性快修**（`c0bb2b6`）：4 组死链 404（timeseries/show×3、datasets/edit、/terms、/privacy）清除；假 "📡 WebSocket server ready" 启动日志删除；INFERENCE_TIMEOUT 死配置接线进 client.ts（原改 env 无效），REDIS_ENABLED/SCRAPE_INTERVAL_MINUTES 删除。**评估修正**：Badge/Tag"双实现"系勘察误报（状态胶囊 vs 计数角标，不同原语），不收敛。
- **cand-1 模型注册单一事实源**（`6a9172f`）：backend 请求验证清单从推理服务 GET /models 派生（SEED 兜底冷启动），hourly model-registry-sync + drift 告警；已漂移的 VALID_MODELS 手工副本（7 vs 9）删除。live：+35s 日志 "9 ids, no drift"。
- **cand-2 量纲护栏 + 聚合诚实化**（`78a3beb`）：upsertPrice 拒绝 >20× 序列中位数的错尺度写入（wheat_cme 实锤：cme 源 5 月 ¢/bu、8 月 $/bu 同序列混写 → 52 条 chronos 验证行 MAPE≈9500-11500，把 /ai/accuracy 均值拖到 46-59%）；getModelAccuracy 改单条 $queryRaw 同窗算均值+中位数（last7d/30d 改中位数），modelQuality 共识权重与 naive 淘汰线换 robust 统计；前端 4 个数据入口 headlineMape 归一。生产数据修复：2 条 ¢ 行 ÷100 归一 + 52 条污染行转 stale。修复后 chronos 均值 1.36-1.49 / 中位 0.82-0.86——"chronos 退化"证伪，预训练路线结论恢复成立。
- **cand-3 主动告警**（`38090bf`）：dataDigest 每日任务——数据断流（24h 零写入）或摄取错误时经 SMTP 发摘要（复用既有传输），常态休眠不发信；OPS_ALERT_EMAIL 未配置则 no-op（live 实证该路径）。
- **cand-4 部署单一入口**（`c8e9ad9`）：deploy.sh 补 prisma generate + migrate deploy（原缺失——round-114 双库教训的生产面）成为唯一部署实现，CI 内联副本删除改调它；顺带修 AUTOMATION-STATUS 3 处漂移（jobs 7→8、§八部署描述、§五测试数 2026-08-21 实测值）。
- **cand-5 fetch 三层归一**（`bac0afd`）：apiFetch 重写为唯一 API 客户端（path 契约 + authFetch：Bearer/cookie/401 清理），swrFetcher/beefFetcher 变薄委托；8 处机械 GET 站点迁移（models/performance×4/market-news/origin/价格图/部位选择/预测区块）；login POST 等刻意保留站点记录在案。

测试：backend 919→931 pass+1 skip（+14 新增、-2 死旋钮自测）、frontend 297 恒定、inference 60 未动；AGENTS.md 模型数 31→30 修正。未再推送（本轮 6 提交待"推送"指令）。

### 2026-08-21 — round-115 完整性复核 + 技术路线评估（只读；docs/PROJECT-ASSESSMENT §九）

指令"评估开发完整性、寻找更合适的技术路线"。improve-codebase-architecture 全流程（2 并行 Explore agent + 交叉验证），全部数字当日实测：三服务 200、测试 919+297+60 全绿、备份 7 份实测有效。核心结论：**工程完整性 ~90%（产品级）、数据供给 ~35%（牛肉核心）**——调度机器 100% 活（每源 47-49 运行/7d）但仅 3 源有产出（world_bank 4,973/cme 97/commodity_prices 42），beef_cut_prices 冻结 04-30（bridge 近 30 天 0 产出，上游封锁）、market_news 生产 0 行。**技术路线逐层判定无需迁移**（K8s/TimescaleDB/合并 Next API/换基座全负 ROI），产出 6 个深化候选（HTML 报告 /tmp/architecture-review-20260821.html）：模型注册单一事实源（当前 backend 7 vs 推理 9 已漂移）、upsertPrice 量纲护栏 + accuracy 聚合改中位数等。**新发现用户可见错误**：/ai/accuracy 的 chronos 均值 46-59% 系 wheat_cme 6 行量纲混装（6.77/667.60 并存）产生的 20 条 MAPE≈9500 污染行所致——剔除后 chronos 各商品中位数 0.39-5.07 仍全面优于统计基线（beef_carcass_us 1.54，原油上 5.05 vs arima 13.72），预训练路线结论不变。顺带修正：AGENTS.md Prisma 模型数 31→30（round-114 删 organizations 后漂移）；记录 AUTOMATION-STATUS 3 处漂移与前端 4 组死链 404 待后续批次。

### 2026-08-21 — round-114 待办清空轮（6 提交，净 -609 行，6 批全部带生产实证）

用户指令"完成能独立完成的所有待办项"。按 TECH-DEBT §七/§八 记录逐项清空（详见 TECH-DEBT §九）：

- **ops**（`7cb9a9c`）：mt.service systemd 单元安装启用（重启自愈缺口关闭，resurrect 验证零扰动）；pm2-logrotate 卸载 + 根依赖删除（轮转唯一机制 = 系统 logrotate）。TD-16 关闭、TD-17 接线。
- **TD-2 organizations 移除**（`c6cba18`）：迁移双库（mt_db+mt_test）删表/列/FK/组合唯一键，补 UNIQUE(slug)；datasetService 少一次 upsert；5 测试 fixture 简化；前端死字段与恒 0 计数删除。
- **conformal 聚合 SQL 化**（`dbeadb5`，A1-4/A1-6/INT-1）：残差提取/行数门槛/顺序统计量全部下推单条 $queryRaw（原每 60s 拉 ~26k 行进 Node）；single-flight 守卫；routes 与后台对 prediction:* 键族统一 TTL(2700s)+完整 shape。新增真实 DB 集成测试 5 例钉 SQL 语义。生产实证：8 模型（26,666 行）q 0.027–0.299 不变。
- **验证环整体重设计**（`7443ba0`，A3-1~6）：共享 windowHasActualsBarSql 谓词使 expire/restore/verifier 三方窗口、authoritative-source 过滤、min(horizon,3) 门槛完全一致（expire=NOT EXISTS / restore=EXISTS，互为补集无乒乓）；restore 转 6h 常驻 + per-ROW 决策（生产实证：501 标记中仅 204 真可复活——旧整商品复活是过度）；verifier 取数加窗口上界（迟回填不再错配日期）；迁移加 CHECK(horizon>0)；raw SQL 显式 UTC。**顺手修复生产死循环**：mape Decimal(5,2) 溢出（MAPE≥1000 行每 6h 重试）→ Decimal(8,2)+clamp，卡死行已 verified（9537.59）。
- **TD-15 部署描述归档**（`662adfb`）：compose/helm/docker/nginx → deploy/attic/ + README 记录实际拓扑与恢复方法；活文档指针同步。
- **button/card 双实现收敛**（`87cf1ec`，TD-9/TD-18）：基座内联进 PascalCase 包装器（各留单一实现），Modal+3 trading 组件迁移，小写文件删除；apiFetch 逐字重复副本合一（TD-8 子集，余 38 处需逐站点评估维持开放）。

测试：backend 914→920（+6：SQL 语义 5 + mape 溢出 1）、frontend 297 不变；全批 tsc/build/重启/live 200。**流程教训**：backend 跑 dist——本批起 backend 门禁必含 `pnpm build`；迁移必须双库（mt_test 拒绝 mt_db）。

### 2026-08-21 — round-113 多技能交叉审查（7 技能 + 对抗性子代理，2 修复提交）

用户指令"利用尽可能多的 skills 审查前几个 goal 发现的事项"。对 round-108~112 的发现与改动交叉审查：code-review 五轴（round-112 全部 diff 语义等价性逐处验证）、security STRIDE（CSRF 移除无暴露——logout 要求 Bearer 头；Socket.IO 摘除缩小攻击面；diff 无泄密）、deprecation（已删端点前端/swagger/测试/文档 0 残留）、testing-patterns（4 项测试改造合规）、ops-check（三服务+后台任务全绿）。核心是 doubt-driven 的**全新上下文对抗性审查**（只给工件+契约）：round-110 三个统计工件返回 17 项发现，RECONCILE 后修复 5 项（commit 3bb737d）：conformal 池补测试工件过滤（A1-1）、证据门槛改按行数（A1-3）、q≥1 拒绝（A1-2，live q90 最大 0.29）、缓存按 days 分键（A1-5）、真中位数（A2-1）。**生产反向实证 A1-3 是真 bug**：修复后校准模型 10→8——幽灵模型 sundial/timer_xl 的 10 行×~10 步残差此前一直骗过"30 行"门槛、一直在接收校准区间。另清 6 处未用 import（64be16e，3 处 round-112 残留 + 3 处先前存在；inacScraper 墓碑保留）。延后项（验证环 expire/restore/verifier 语义不一致族 A3-1~4、findMany 全量拉取 A1-4 等低危潜伏项）连同理由落档 TECH-DEBT §八。backend 909 → 914 全绿（+5 新测试）。

### 2026-08-20 — round-112 清除没必要存在的代码（4 提交，净 -1,000+ 行）

用户明确判断"代码质量低、鸡肋功能多、存在没必要代码"，据此对既有审计标记（TECH-DEBT TD-15~18、round-105/106/107 遗留）逐项重新核实 0-caller 后执行删除，每批 tsc+全量测试绿+build+PM2 重启+live 验证+独立提交：
- **1ae11b8 设置层**：根 package.json 三处残留（minimatch no-op override/root supertest/msw 条目）、knip.json 死工具配置、pm2-start.sh 孤儿脚本、logrotate.conf 与线上漂移同步、backend/.env.production 死模板。
- **8223df2 backend 死代码**：createModelRecord、tokenBlacklist 4 个 0-caller 函数（LIVE 的 blacklistToken/isTokenBlacklisted 保留，round-104 TTL 回归套件保留）、auth 1% 采样丢弃查询、_importSchema、cache null-sentinel 白付 EXISTS。
- **7ea8105 Socket.IO + 死端点**：零消费者实时栈整体摘除（app.ts 装配+三处 emit+websocket 通道类型+依赖）；`GET /api/auth/csrf-token`（安全剧场）与 `GET /api/billing/usage`（永远空数组、前端 0 调用）移除，live 404/401 验证。
- **4cca71e 配额脚手架 + flaky 根治**：usageService checkLimit/trackUsage（广告限额从未强制）；dataHealth 测试改自包含（原依赖跨运行 DB 残留，干净树即红）；conformal 覆盖率测试种子化（0.879 边界闪断）。**取消** apikeys show/edit 删除——列表→show→edit 接线完整，round-107 孤岛记录过期。
测试 924 → 909（-15 全为被删代码自测，TECH-DEBT 既定豁免口径）；85 文件全绿；`git diff` 31 文件净删 1,028 行。仍开放的产品级决策清单见 TECH-DEBT §七。

### 2026-08-20 — round-111 设置层冗余审计（只读；TECH-DEBT §六 落档 TD-15~18）

与 round-108（磁盘体积）互补，本轮审计**设置/部署/工具链层**的实现冗余，全部只读核实、零代码改动。核心发现：代码层不臃肿（路由挂载无重复、inference 实现干净），**最大冗余在部署描述——4 套并存 1 套在用且互相漂移**：实际拓扑 = PM2 三进程 + 宿主机 systemd PostgreSQL **14.23**/Redis **6.0.16** + CI SSH→deploy.sh（ci.yml/deploy.sh 中 helm/kubectl/docker 引用 0）；而 docker-compose.yml（DB 用户 mt vs 实际 mt_user，从未运行，`docker ps -a` 零容器）、deploy/helm（11 文件）、deploy/docker、nginx/ 全部闲置。据此修正 AGENTS.md §四 技术栈行（原文"PG15/Redis7（docker-compose.yml）"与实测不符）。其余：根 package.json 5 处残留（minimatch override 根 lock 0 命中=no-op、root supertest 0 用途、onlyBuiltDependencies 的 msw 条目 stale、knip.json 死配置且未安装、pm2-logrotate 装而未跑——日志轮转实际走 /etc/logrotate.d/trademind）；脚本层 pm2-start.sh 0 caller 孤儿、scripts/logrotate.conf 与线上 /etc/logrotate.d/trademind 内容漂移、mt.service 未安装（重启后 PM2 不复活，ops 缺口）；代码层复核 ui/button+card 双实现双活（4 vs 45 importer）、backend/.env.production 0 loader 消费（死文件）。处置建议均标注"产品决策/未动"（AGENTS §十.5）。

### 2026-08-17 — round-110 按预测策略方案开工：验证环僵尸饿死修复，chronos 实证到位

按 PREDICTION-STRATEGY §四排序执行第 2 项时发现真根因并非"chronos 未纳入验证环"，而是**心跳僵尸商品饿死验证环**：live_cattle_cme 等 5 个 CME 商品功能上已死但偶发单行心跳价（3 个月 3 行、最新 08-13），同时骗过 verifyDue 的跳过不改状态与 markUnverifiable 的 `latestPrice<=predictedAt` 冻结判定，2.7 万永久跳过行占满 oldest-first take:5000 窗口 → 08-04 后所有验证批次 5000/5000 空转。修复（commit 54ada15）：新增 `expireWindowElapsedPredictions` 窗口过期清扫（anchor+horizon+7d 宽限 + actuals 守卫）+ `restoreVerifiablePredictions` 窗口感知重写（防乒乓）+ 接入 6h 验证任务。live 首跑清扫 26,691 行、随后一批 verified **1,536/2,262**——chronos 首批同代实证 avg MAPE **0.68-0.70**（usd_cny 0.35 / aud 0.47 / brl 0.40 / beef_carcass_us 1.43）。同步修正 PREDICTION-STRATEGY 初版"chronos 0 verified"错误声明（LIMIT 18 截断所致，实际历史已有 ~2,073/variant）并补 round-110 执行记录。backend 909→911 全绿（+2 新测试，2 个旧 restore 测试改窗口语义）。同日完成 §四 第 3、4 项实验：胴体↔驱动因子联动实测（aud_usd r=+0.129 唯一稳健，usd_cny 符号翻转不可用）；sarimax 门禁回测双双零提升（beef×aud 8.34% vs ARIMA 8.10%、对照 crude×natgas 4.28% vs 4.28%）→ 按门禁外生接线暂缓，领先指标（lagged exog）列为后续实验。遗留下一批：统计基线复产（07-26 停产，naive 门槛缺同代证据）。

**同日续（commit d00221b）**：基线复产落地——新增每日 `generateBaselinePredictions` 批次（4 基线模型 × 新鲜商品，同 7d 门禁，绕过订阅 Map 键覆盖问题），行进验证环 ~10 天成熟为同代证据；live 首批 64 条（4 模型 × 16 商品）全部落地，+3 单元测试（模型集合/新鲜度门禁/单模型失败隔离），backend 911→914 全绿。round-110 至此完成方案 §四 第 2/3/4 项与第 5 项基线部分；剩余：数据回填（P0，运营依赖）、conformal 区间、淘汰制加权、预测卡片融入 /beef 页。

**收尾批（commit 3c74878，08-20 复核落档）**：淘汰制 + 区间校准落地——① `resolveModelWeights` 新增 naive 门槛淘汰（双方 ≥20 verified、30d avgMAPE 严格劣于 naive → 权重 0）；live 直跑生产库实证 `[WEIGHTS] Eliminated: arima, holtwinters, exponential_smoothing`（3.55-3.75 vs naive 3.47，各 ~3,247 verified）；默认共识投票集仅 chronos×3 且全部优于 naive，故默认信号路径 0 淘汰日志是正确行为。② 新服务 `intervalCalibration.ts`：split-conformal（60d verified 残差、α=0.1、≥30 行、60s 缓存），接入 `runAndCachePrediction` 与按需 /predict（predictFromCache 绕过缓存路径故路由侧独立挂钩 calibrateBounds）；live `[CONFORMAL] Calibrated intervals for 10 models (26293 verified predictions)` 每 30min 稳定出现，chronos_mini 按需区间均匀 ŷ·(1±0.027)；测试含 held-out 覆盖率 ≈90% 实证。+10 测试，backend 914→924 全绿。③ §四第 6 项核实：/beef 预测卡片（CutForecastCell/MarketForecastBoard → /api/beef/forecasts）已实现，端点因 beef_cut_prices 自 04-30 冻结诚实返回空，待 P0 数据回填自然出数。**round-110 至此收尾**；遗留：P0 数据回填（运营）、lagged-exog 实验、僵尸密度门禁（可选）。基线批次持续性核实（08-18/19/20 照跑）；已知行为：后端重启会重触发当日基线批次（重复行数值相同、无偏，暂不处理）。

### 2026-08-16 — round-109 预测策略评估（只读，落档 PREDICTION-STRATEGY.md）

实测数据面与模型面后给出最优方案。关键发现：32 个牛肉部位商品 30 个零数据点、beef_cut_prices 仅 30 天冻结快照（2026-04-30）；唯一深而活的牛肉序列是 beef_carcass_us（4,241 点 2014→今，verified MAPE 1.73）；verified 模型排名朴素基线最优（naive 3.45 < ES 3.53 < ARIMA 3.67 < HW 3.73 << STL 10.87）；Chronos 3 变体 ~4,340 条预测 0 条 verified；sarimax 0 条日志（外生管线从未接线，而 FX/饲料/原油数据在库且新鲜）。推荐方案：数据回填为 P0 前置 → 部位价短期用"胴体锚 + 汇率折算 + 部位升贴水"自上而下结构比例（不在 30 天噪声上外推）→ sarimax 外生接线（先在胴体序列回测增量）→ Chronos 重定位为过验证环的 ensemble 成员（naive 为淘汰门槛）→ rolling-origin 分层冠军选择 + split-conformal 校准区间 + 数据不足序列诚实降级。全部兼容预训练约束。

### 2026-08-16 — round-108 体积审计与压缩：/root 12G→9.7G，代码不臃肿、臃肿在制品层

全部源码不足 5M（44 页/20 路由/19 爬虫/31 模型），磁盘大头为依赖镜像/构建缓存/无界日志/工具残留。压缩明细：卸载 venv 内 triton 689M（GPU 编译器，`torch 2.12.1+cpu` 不加载，pytest 60 + 全链 chronos 预测验证）；清 `.next/cache` 412M（`next start` 不读）；清 `.npm` 626M（含 `npx prisma@7` 残留 253M——与项目 prisma 5 大版本漂移，勿用）；Playwright 双浏览器去重 521M→259M（e2e 脚本从硬编码 `_npx` 路径改为经 frontend `@playwright/test` 解析，消除 cron ≥80% 清 `_npx` 时脚本失效的隐患）；backend/logs 215M→10M 并给 winston 加 `maxsize 10M×3` 轮换（原无界且无日期命名，cron 30d 规则匹配不到）；coverage 19M、`git gc` 43M→13M。红线未动：pnpm store 3.6G、HF 权重 879M、backups（keep-7 有界）。三套测试基线不回退（backend 909 / frontend 297 / pytest 60），三服务 live 验证。详见 PROJECT-ASSESSMENT §八、AUTOMATION-STATUS §六½。

### 2026-08-16 — round-107b 前后端打通审计：44 页全扫描，6 处断裂修复（API 错误清零）

以真实浏览器逐页访问全部 44 条路由（新增 `scripts/e2e-page-audit.mjs`，登录态 + 逐页收集 API ≥400/网络失败），并经代理实测全部写路径（登录/登出/apikey/dataset/dataset-import/alert-rule/news 创建全通）。

**发现并修复的断裂（页面↔端点从未对接）：**
- `/timeseries/create` → `POST /api/timeseries` 端点不存在（提交必 404）：后端补建（owner 作用域 + slug 去重 + schema 校验）；成功后跳转从不存在的 show 页改为 edit 页。
- `/apikeys/show/[id]` → 资源名写错（`apikeys` vs `api-keys`）×4 处，且 `GET /:id`、`/:id/usage`、`/:id/regenerate` 端点从未存在：后端补 `GET /:id`（安全字段集，原始 key 永不回传）；keyPreview 改由 lastCharacters 构造；usage/regenerate/copy 等永败按钮移除（诚实降级，TECH-DEBT 记录未实现功能）。
- `/apikeys/edit/[id]` → 保存打在 `PATCH /api/api-keys/:id`（端点不存在）：后端补 PATCH（name/isActive）。
- `/alerts/show/[id]` → `GET /api/alerts/:id` 端点不存在（详情页必 404）：后端补建（owner 作用域，注册在 /stats、/rules 字面路由之后防吞并），返回裸对象匹配 useOne 解包。
- `/settings` + `/settings/profile` → 强制 `Authorization: Bearer null` 头（内存 token 刷新即失）绕过 cookie 回退恒 401、靠 localStorage 缓存兜底：移除强制头（authFetch 自带 token/cookie 双路）。
- `/datasets/show/[id]` → 调不存在的 `/:id/timeseries` 子路由（时序表恒空）+ `/datasets/edit|export` 死按钮：改用 GET /:id 已内嵌的 timeseries 数据；修复 path→slug、datapoints 计数字段名；移除死按钮。

**验证**：44 页 API 错误清零（唯一残留 404 为拿 rule id 探测 alerts 端点的正确行为；真 alert id 实测零错误且字段渲染正确）；新增 12 项集成测试（含双用户越权断言）；backend 897→909、frontend 297 不变。测试数据已清理。遗留（usage 日志/rotate 端点/编辑导出 UI/前端零 WebSocket 消费）记录于 TECH-DEBT。

### 2026-08-16 — round-107 前端视觉精装 + 同源 API 架构修复（7 commits）

以 GitHub 顶级设计（shadcn/ui dashboard、Tremor、Vercel Geist、TradingView、Linear）为参照的视觉升级战役；开工实测发现浏览器端整条数据链路实际断裂，先修架构再精装。

**批 0（架构，前端浏览器会话全线断裂的三层叠加缺陷）**
- `API_BASE` 构建期被 `.env.local` 的 `http://localhost:8000` 内联进产物 → 跨源预检被生产 CORS 守卫 500；默认改同源 `""`（走 Next rewrites/nginx 代理），`NEXT_PUBLIC_API_URL` 仅用于真正的分域部署。
- `.env.production` 占位符 `https://api.your-domain.com`（已停放域名）被烙进 routes-manifest rewrites——经代理的每个 `/api/*` 都拿到停放页 HTML；rewrites 改用服务端 `API_PROXY_TARGET`（默认内部后端）。
- 后端 `authenticate` 中间件只认 Bearer 头——SPA 内存 token 刷新即失，cookie 会话形同虚设（round-104 设计未落地）；补 `auth_token` cookie 回退（与 /auth/verify 同优先级，SameSite=Strict 约束 CSRF 面）。
- CORS 委托模式加同源豁免：浏览器 POST 必带 Origin，经自身入口代理的同源请求此前被跨源白名单误杀（登录/web-vitals POST 500）。
- 验证：干净重构建后客户端 chunks 无旧值残留；浏览器 e2e /dashboard 零 API 错误；新增 Playwright 截图基建 `scripts/ui-screenshots.mjs`。

**批 1-5（视觉，"Refined Industrial" 精装化——方向不变，执行拉满）**
- 机加工卡片（Linear/Geist）：1px 顶部内高光 + 36px 垂直光泽 + 分层接触/环境阴影，token 层实现覆盖 shadcn Card + 旧 CSS 卡片 + Tailwind shadow 工具类。
- 金色环境光：页面顶部 1100px 固定径向金晕（0.10 alpha）——安静的品牌签名；暗色中性色加 0.004 暖色偏置统一于金色调。
- 终端数据排版（TradingView）：KPI/表格/趋势全部 tabular-nums；表头 mono 大写眉标；StatCard 图标芯片化（变体色 @10% 底）；`.eyebrow` 工具类。
- 暗色玻璃图表：网格 #3f3f46→#262626、玻璃 tooltip + 金色标签、`goldGradientStops` 面积渐变——六个消费 chart-config 的 Recharts 组件自动继承；修复 ForecastTrendChart 在暗色页渲染浅色网格/白底 tooltip。
- Hero 品牌时刻："Intelligence, Decoded" 暗色下金渐变（亮金→暗金；浅色保持 AA 安全平色）；bento 卡悬停金环。
- `--panel` 层：侧栏一阶高于页面背景，导航轨读作独立层；`.data-table` 行高 40→44px + tabular-nums。

测试基线：backend 894→897（+3 cookie 鉴权）、frontend 296→297（+1 分域覆盖）、pytest 60 不变；biome 10 预存警告不变。视觉验证：Playwright before/after 六页截图 + 视觉模型评审（hero 6.5→7.5、StatCard 6.5→7.5、环境光 4.5/5）。

### 2026-08-16 — round-106 全项目代码审查：~75 项发现，11 commit 修复（Critical/High/Medium 全清）

四路并行审查（20 路由+7 中间件 / 33 服务 / 前端 44 页 91 组件 7 hooks / 推理服务+测试质量）产出 ~75 项发现；每项亲验后按主题分 10 批修复，遗留低优先级项记录于 `TECH-DEBT.md`。

**真缺陷（功能坏/数据错）**
- 测试基建：裸跑 `pnpm test` 静默指向**生产库 mt_db**（两套件随生产数据漂移变红）；默认改 mt_test + 三处拒绝生产库护栏 + `scripts/bootstrap-test-db.sh`。
- 5 个前端页面因未解 `{success,data}` 信封完全坏掉（alerts 列表恒空、apikeys 一次性密钥渲染空白且不可恢复、profile 恒报加载失败）；alerts/rules 的列表/编辑/启停/删除从未接通（后端补 GET/PATCH/DELETE /api/alerts/rules，userId 作用域）。
- anomaly 检测在真实 uuid 上必崩（`BigInt(uuid)` 500）；多源对比图返回**最旧**数据；`/health/ready` 在 Redis/推理宕机时仍 200。
- IDOR 五路径：任意用户可全库 bulk-resolve 异常、删他人模型预测、按 id 读他人时序点、列表泄露他人 dataset。

**诚实性（8 项）**：模型状态伪造 available→unknown、errorRate 实为慢请求占比→真错误率（记录状态码）、支撑/阻力位无模型时捏造 ±5%→null、演示数据图表/假 sessions 页/死 alert 条件类型/加权中位数偶数偏置/完美 MAPE 误判缺数据。

**性能（5 条热路径）**：watchlist 全表拉取→子查询 rn≤2、freshness 1.9 万行拉内存→SQL groupBy、Redis KEYS×2→SCAN、beef forecasts 无界并行→top20+4 池、refresh-all 循环写→createMany。

**输入校验**：NaN window/负分页/Invalid Date/重复参数 → 500 一律收敛为 400/404/clamp；historyPoints 无上限（500 万行 OOM 向量）；推理服务未排序时间戳→422。

**测试质量**：空转跳过（种子缺失静默绿）改响亮失败；冒烟断言（<500 即过）钉精确契约；TTL 竞态消除。

测试基线：backend 983→894（+1 skip），frontend 296，pytest 58→62。生产迁移：`anomalies.datapoint_id` bigint→text（空表，零风险）。

### 2026-07-27 — 项目整理：AI 全自动开发规范化 + 冗余清理 + 安全

把仓库整理成规范、完整的「AI 全自动开发」项目。**纯文档/配置整理，零业务代码变更。**

**AI 代理文档**
- 新增 `AGENTS.md`（项目根，AI 代理首要入口）：项目定位、核心价值链、规模事实（每项附计数方式）、技术栈、目录约定、命令、不可越线约束、文档导航。
- 重写 `CLAUDE.md`：删除整段失效的 gstack 安装说明与 30+ 不存在的 skill 路由表（实测 gstack 未安装），保留 Coding Guidelines / Dev Server / Health Stack，新增"事实严谨"准则并指向 `AGENTS.md`。

**冗余清理（删 + 提取精华）**
- 删除外挂 git 仓库：`docs/references/awesome-design-md/`（2.0M，含完整 .git）、`archive/`（2.6M，含 taste-skill 完整 .git）。
- 删除 47 份 round/review 流水账报告（`docs/archive/` 29 + `docs/reviews/` 18），先提取精华为 `docs/KNOWN-ISSUES.md`（开放阻塞，每条标来源 + 验证日期）与 `docs/TECH-DEBT.md`（过度工程化清单，每条标审计日期 + 待复核）。
- 合并冲突版本：`PROJECT-STATE-AND-VISION-2026-07-26-v2.md` → `docs/PROJECT-VISION.md`，删除被取代的 v1。
- 删除过时文档：自标 DEPRECATED 的 `ROADMAP.md`、`FRONTEND-IMPROVEMENT-PLAN.md`、`FULLSTACK-PROGRESS-2026-07-27.md`、`CHRONOS-ENSEMBLE-MIGRATION-2026-07-27.md`、基于废弃 ROADMAP 流程的 `developer/DEVELOPMENT-WORKFLOW.md`、7 个第三方 `references/*-design.md`。
- 重写 `docs/INDEX.md`（无死链）；修复 `PRODUCT-SPEC.md` / `CHANGELOG.md` frontmatter 死链。

**README 事实纠错**（数字全部改实测值，附计数方式见 `AGENTS.md` §三）
- 数据源 18 → **19**、Prisma 模型 36 → **31**、前端页面 41 → **44**、后端路由 22 → **20**、统计模型 5 → **6**（补 SARIMAX 行 + Chronos 变体说明）。
- 测试数改为"运行 `pnpm test` 获取当前数"（历史各文档数字互相矛盾，不写死）。
- 数据源表按实际 19 个文件重列（删除不存在的 "USDA FAS"，补 Secex / Shipping Index）。

**安全 + 误提交系统文件清理**
- `git rm --cached`（本地文件保留）：`.gnupg/`（**含 GPG 私钥**，安全重点）、`.rpmdb/`、`.pki/`、`.pip/`、`.profile`、`.wget-hsts`、`snap/`。
- 补 `.gitignore`：`.gnupg/`、`.rpmdb/`、`.pki/`、`.pip/`、`.profile`、`snap/`；清理指向已删内容的死规则。
- `nginx/nginx.conf` 基于事实保留：`docker-compose.yml` 把它挂载为 nginx 容器配置（非废弃文件）。

**验证**：4 个规模数字 + 9 个 model id 经只读命令复现 ✅；导航文件无死链 ✅；零业务代码变更 ✅。全部变更（57 条）在工作区/暂存区，未 commit。

### 2026-07-19 — Project unification refactor (R1-R4)

Four-batch refactor to unify project state: kill redundant tests, fix every
broken route, merge duplicate modules, consolidate docs. Each batch was an
independent commit with full tsc + test + live verification.

**R1 — Test slimming + dead code** (`6c674fc`)
- Deleted 5 tautological/over-mocked test files (EmptyState/PageHeader tests,
  datasets page test that mocked PageHeader then asserted the mock, dashboard
  page test that mocked every child, backend system.test triple-200). Kept all
  CORE security/business-logic tests. Tests 840 → 796.
- Deleted 2 dead-code modules with verified zero importers (useOnlineStatus,
  useRetryableFetch/index.ts barrel).

**R2 — Broken route cleanup** (`07c8534`)
- Removed `/forecasts` (3 pages) — called `GET /api/forecasts` which doesn't
  exist; duplicate of `/ai/predict` per PRODUCT-SPEC. Repointed RecentActivity
  + not-found links to `/ai/predict`.
- Removed `/forgot-password` + `/update-password` + their forms — both POSTed
  to non-existent `/auth/forgot-password` / `/auth/reset-password`. LoginForm
  "Forgot password?" → honest "Planned" disabled span.
- Removed orphan `/anomalies` (nav uses `/ai/anomalies`).
- Kept Forecast Prisma model + forecasts table (live: models.ts writes to it).

**R3 — Duplicate/consistency merge** (`bde0d8e`)
- Unified useDashboardStats fetcher pattern (was: raw useSWR + useRetryableFetch
  mix; now all useRetryableFetch). Tests rewritten to URL-key indexing.
- Merged dialog.tsx (10 granular exports, 0 external consumers) into Modal.tsx.
- Extracted shared ErrorPageContent; error.tsx + global-error.tsx now thin wrappers.
- Moved useTradingData.ts app/trading/ → hooks/ (was violating convention).
- Distinct icons for the 4 AI nav items (was 3× TrendingUp).
- Audit correction: `/ai/models` + `/ai/backtest` NOT duplicates (each hits a
  real backend), kept. ErrorBoundaryWrapper NOT redundant (server/client boundary
  boilerplate), kept.

**R4 — Docs** (this commit)
- Deprecated stale ROADMAP.md (pre-repositioning 2026-07-06 numbers; superseded
  by PRODUCT-SPEC). Added deprecation banner.
- Updated INDEX.md to point at PRODUCT-SPEC as single source of truth.
- Updated known-issues doc with R1-R4 status + audit-correction log.

### Removed - Docker Dependency Removal

- **Deleted Docker files** - Removed all Docker configuration
  - `docker-compose.yml` - Replaced by native services (PostgreSQL, Redis) + PM2
  - `backend/Dockerfile` - Backend runs via PM2 directly
  - `frontend/Dockerfile` - Frontend runs via PM2 directly
  - `.docker/` directory - Docker buildx cache no longer needed
- **Updated CI/CD Pipeline** - Replaced Docker-based steps
  - Replaced Docker service containers with native PostgreSQL/Redis installation
  - Replaced Docker image build/push with native build + artifact upload
  - Replaced Docker pull deployment with PM2-based SSH deployment
- **Updated Health Check Script** - Replaced Docker container check with PM2 service check
- **Updated Backup Script** - Replaced `docker-compose.yml` backup with `ecosystem.config.cjs`

> **Why**: Server environment cannot access Docker registries. All services (PostgreSQL, Redis, backend, frontend) run natively via systemd + PM2.

---

## [1.3.0] - 2026-03-21

### Added - Phase 3.1: Observability & Monitoring

#### Prometheus Metrics
- **Metrics Endpoint** - `/metrics` endpoint for Prometheus scraping
  - Available in both production and development modes
  - Exposes system and application metrics
- **HTTP Metrics** - Request tracking with labels
  - Request counter (by method, route, status)
  - Response time histogram (by method, route)
  - Active requests gauge
- **Database Metrics** - PostgreSQL query tracking via Prisma middleware
  - Query counter (by operation, model)
  - Query duration histogram
  - 10% sampling to minimize performance impact
- **Cache Metrics** - Redis cache performance
  - Cache hit counter (by provider)
  - Cache miss counter (by provider)
- **IoTDB Metrics** - Time-series database operations
  - Query counter (by type: select, insert, error)
  - Query duration histogram
  - Data point counter (by series)
- **AI Metrics** - AI model operations
  - Prediction counter (by algorithm, type)
  - Prediction duration histogram
  - Anomaly detection counter
- **Alert Metrics** - Alert system monitoring
  - Alert triggered counter (by severity, type)
  - Alert resolved counter
- **Session Metrics** - Active user sessions
  - 1% sampling for efficiency
  - 15-minute active window tracking

#### Grafana Dashboards
- **Overview Dashboard** - Complete monitoring dashboard
  - Request rate and error rate panels
  - Response time distribution (P50, P95, P99)
  - Active user sessions gauge
  - Database query performance
  - Cache hit/miss ratio
  - IoTDB query metrics
  - AI prediction metrics
  - Alert status overview
- **Automatic Provisioning** - Zero-setup Grafana deployment
  - Datasource provisioning (Prometheus)
  - Dashboard provisioning (auto-import)
  - Configuration in `grafana/provisioning/`

#### AlertManager
- **Email Notifications** - Alert routing via email
  - SMTP configuration support
  - Alert grouping and deduplication
  - Configurable notification templates
- **Alert Rules** - Pre-configured Prometheus alert rules
  - High error rate alerts (>5% for 5 minutes)
  - Slow API response alerts (>1s for 5 minutes)
  - Database connection loss alerts
  - IoTDB connection failure alerts
  - AI model failure alerts
  - High memory usage alerts (>80% for 10 minutes)

#### Systemd Services (Docker-Free Deployment)
- **Service Units** - Complete systemd service configuration
  - `iotdb-postgres.service` - PostgreSQL database
  - `iotdb-redis.service` - Redis cache
  - `iotdb-backend.service` - Backend API (PM2)
  - `iotdb-frontend.service` - Frontend (PM2)
  - `prometheus.service` - Metrics collection
  - `alertmanager.service` - Alert routing
- **Management Scripts** - Easy service management
  - `scripts/systemd/start-all-services.sh` - Start all services in order
  - `scripts/systemd/stop-all-services.sh` - Stop in reverse order
  - `scripts/systemd/check-services.sh` - Status monitoring
- **Automatic Features**
  - Auto-start on boot
  - Auto-restart on failure
  - Centralized logging (journald)
  - Service dependency management
- **Log Rotation** - Automated log management
  - Daily rotation with 14-day retention
  - Compression enabled
  - PM2 reload on rotation
- **Backup Integration** - Cron-based automated backups
  - Daily PostgreSQL backups (2 AM)
  - Weekly full backups
  - Hourly Redis saves
  - Daily Redis backups

#### Documentation
- **Observability Design** - `docs/observability-design.md`
  - Complete system architecture
  - Component designs
  - Implementation phases (3.1-3.4)
  - 1044 lines of detailed planning
- **Systemd Services Guide** - `docs/systemd-services.md`
  - Service configuration reference
  - Management scripts documentation
  - Log management setup
  - Backup integration guide
  - Migration guide from Docker
- **Monitoring Deployment** - `docs/monitoring-deployment-no-docker.md`
  - Binary installation guide
  - Systemd service setup
  - Configuration management
  - Troubleshooting section

### Changed
- **server.ts** - Enable metrics endpoint in development mode
- **database.ts** - Add Prisma middleware for query metrics
- **auth.ts** - Add active session tracking (1% sampling)
- **cache.ts** - Add cache hit/miss metrics (10% sampling)
- **iotdb/client.ts** - Add query and datapoint metrics
- **routes/iotdb.ts** - Add AI prediction metrics
- **services/alert-rules.ts** - Add alert triggered metrics
- **services/alerts.ts** - Add alert resolved metrics

### Performance
- **Sampling Strategy** - 10% sampling for most metrics to minimize performance impact
- **Active Sessions** - 1% sampling for session counting
- **Prisma Middleware** - Efficient query instrumentation

---

## [1.2.0] - 2026-03-04

### Added - Phase 3: AI 功能启用与安全隔离

#### AI 功能
- **AI 预测分析** - 时序数据预测，支持多种算法
  - ARIMA (AutoRegressive Integrated Moving Average)
  - LSTM (timer_xl - Long Short-Term Memory)
  - Transformer (sundial)
  - Holt-Winters 三次指数平滑
  - 指数平滑 (exponential_smoothing)
  - 朴素预测 (naive_forecaster)
  - STL 分解预测 (stl_forecaster)
- **异常检测** - 智能时序数据异常识别
  - 支持多种检测方法 (isolation_forest, sr, pca)
  - 可配置阈值参数
- **批量预测** - 多时间序列批量预测接口
- **模型管理** - 模型列表、详情查看、训练接口
  - 列出可用模型及其参数
  - 查看模型详细信息
  - 模型训练接口

#### 安全隔离 (进程隔离替代 Docker)
- **进程隔离执行** - 使用 Linux 原生功能实现隔离
  - `prlimit` - 资源限制（内存、CPU、文件描述符、进程数）
  - `su ai-executor` - 低权限用户执行
  - 临时脚本文件（自动清理、只读权限）
- **AI 专用用户** - 创建 `ai-executor` 用户运行 AI 脚本
  - UID: 998
  - 无法访问其他用户文件
  - 无 shell 登录权限
- **资源限制**
  - 内存限制: 512M
  - CPU 时间限制: 60 秒
  - 文件描述符限制: 1024
  - 进程数限制: 64
  - 执行超时: 120 秒
- **环境隔离**
  - 清理敏感环境变量（DATABASE_URL、POSTGRES_PASSWORD 等）
  - 临时脚本目录: `/tmp/ai-scripts`
  - AI Node 虚拟环境: `/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/venv`

#### 多层安全防护
- **特性开关** - `AI_FEATURES_DISABLED` 环境变量控制
  - 默认值: `false` (已启用)
  - 可快速禁用所有 AI 功能
- **角色权限检查** - 仅管理员可访问
  - 中间件: `checkAIAccess`
  - 非 ADMIN 角色返回 403 Forbidden
- **IP 白名单** - 可选的 IP 访问限制
  - 环境变量: `AI_ACCESS_WHITELIST`
  - 支持多个 IP（逗号分隔）
  - 支持 CIDR 格式
- **审计日志** - 所有 AI 操作记录
  - 用户、时间戳、操作类型、参数
  - 存储位置: 后端日志
- **速率限制** - AI API 调用速率限制
  - 默认: 10 次/分钟
  - 基于 Redis 存储

#### 脚本优化整理
- **脚本精简** - 从 14 个减少到 11 个核心脚本
  - 删除冗余脚本: `status.sh`、`scripts/check-services.sh`、`frontend/start-dev.sh`
  - 保留核心脚本: 3 个根目录 + 8 个 scripts 目录
- **新增脚本**: `check.sh` - 快速状态检查
  - 替代 `status.sh` 功能
  - 彩色输出，简洁快速
- **脚本增强**:
  - `start.sh` - 超时保护、路径检测、服务降级
  - `stop.sh` - 目录检查、优雅关闭

#### 文档新增
- **RUNNING_MODES.md** - 运行模式完整指南
  - 开发模式 - 热重载、TypeScript 直接执行
  - 生产模式 - 集群模式、多核并行
  - 预发布模式 - 上线前验证
  - 性能对比表、切换指南、故障排查
- **SCRIPTS_GUIDE.md** - 脚本完整使用指南
  - 核心脚本详解
  - 维护脚本使用
  - PM2 命令参考
  - AI 功能测试
- **SCRIPTS_INDEX.md** - 脚本快速索引
  - 11 个脚本分类汇总
  - 使用场景说明
  - 依赖关系图
  - 快速参考表

### Changed
- **版本升级** - 1.1.0 → 1.2.0
- **AI 功能状态** - 从"默认禁用"改为"安全隔离启用"
- **脚本引用** - `./status.sh` → `./check.sh`
- **README.md** - 添加 Phase 3 内容和新文档链接
- **运行模式** - 支持通过 `APP_MODE` 环境变量切换

### Security Improvements
- **进程隔离** - 使用 `prlimit` + `su` 替代 Docker 实现隔离
- **权限控制** - AI 功能仅限管理员访问
- **资源保护** - 防止 AI 脚本耗尽系统资源
- **审计追踪** - 所有 AI 操作记录日志

### Modified Files
#### Backend
- `backend/src/services/iotdb/ai-isolated.ts` - **新建** 隔离 AI 服务
- `backend/src/middleware/aiAccess.ts` - **新建** AI 权限中间件
- `backend/src/routes/iotdb.ts` - 添加 AI 路由和认证中间件
- `backend/src/routes/models.ts` - 添加 AI 权限检查
- `backend/.env` - AI 配置环境变量

#### Scripts
- `start.sh` - 超时保护、路径检测、服务降级
- `stop.sh` - 目录检查、优雅关闭
- `check.sh` - **新建** 快速状态检查

#### Documentation
- `README.md` - 版本升级、Phase 3 内容、新文档链接
- `docs/RUNNING_MODES.md` - **新建** 运行模式详解
- `docs/SCRIPTS_GUIDE.md` - **新建** 脚本使用指南
- `docs/SCRIPTS_INDEX.md` - **新建** 脚本索引
- `CHANGELOG.md` - 添加本版本变更记录

### Deleted Files
- `status.sh` - 功能重复（已被 check.sh 替代）
- `scripts/check-services.sh` - 功能重复
- `frontend/start-dev.sh` - 已整合到 start.sh

### Upgrade Guide from 1.1.0 to 1.2.0

#### 1. 创建 AI 执行用户
```bash
# 创建专用低权限用户
sudo useradd -r -s /bin/false -d /var/lib/ai-executor ai-executor

# 创建临时脚本目录
sudo mkdir -p /tmp/ai-scripts
sudo chown $USER:$USER /tmp/ai-scripts
sudo chmod 700 /tmp/ai-scripts
```

#### 2. 安装必要工具
```bash
# 检查 prlimit 是否可用
which prlimit || sudo apt-get install util-linux
```

#### 3. 更新环境变量
编辑 `backend/.env`:
```bash
# 启用 AI 功能
AI_FEATURES_DISABLED=false
IOTDB_AI_ENABLED=true

# AI Node 配置
AI_NODE_HOME=/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
AI_NODE_HOST=127.0.0.1
AI_NODE_PORT=10810

# 资源限制
AI_MAX_MEMORY=512M
AI_MAX_CPU_TIME=60
AI_TIMEOUT=120

# 可选：IP 白名单
# AI_ACCESS_WHITELIST=127.0.0.1,10.0.0.0/8
```

#### 4. 更新脚本
```bash
# 删除旧脚本
rm -f status.sh scripts/check-services.sh frontend/start-dev.sh

# 使用新脚本
./check.sh  # 替代 ./status.sh
```

#### 5. 重启服务
```bash
./stop.sh
./start.sh
```

#### 6. 验证 AI 功能
```bash
# 检查 AI Node 是否运行
nc -z localhost 10810 && echo "AI Node OK"

# 测试预测 API（需要管理员权限）
curl -X POST http://localhost:8000/api/iotdb/ai/predict \
  -H "Content-Type: application/json" \
  -d '{"timeseries": "root.test1", "horizon": 5, "algorithm": "arima"}'
```

---

## [1.1.0] - 2026-03-04

### Added - Phase 1 (Infrastructure)
- **Testing Framework**
  - Jest test suite with 169 tests across 9 test suites
  - Test coverage reporting with Istanbul/nyc
  - Supertest for API endpoint testing
  - Faker.js for test data generation

- **Error Tracking**
  - Sentry integration for error tracking
  - Performance monitoring with profiling
  - Sensitive data filtering (passwords, tokens, cookies)
  - API request performance tracking

- **Automated Backups**
  - PostgreSQL database backup with verification
  - Configuration file backup
  - IoTDB metadata backup
  - S3 upload support with AWS CLI
  - Telegram notification support
  - Automatic cleanup based on retention policy

- **Log Rotation**
  - Application log rotation (14-day retention)
  - PM2 log rotation (7-day retention)
  - Nginx log rotation (30-day retention)
  - Docker log rotation (7-day retention)
  - Automatic compression with delaycompress

### Added - Phase 2 (Performance & Automation)
- **Database Optimization**
  - Automated VACUUM ANALYZE
  - Automatic index creation and verification
  - Query performance analysis
  - Automatic cleanup of expired data (90-day retention)
  - Optimization report generation

- **Redis Connection Pool**
  - Connection pooling with automatic reconnection
  - Health checks with ping
  - Connection statistics and monitoring
  - Graceful shutdown handling
  - Error handling and retry strategy

- **API Response Caching**
  - Redis-backed HTTP response caching
  - Configurable TTL (60s default, 300s long, 10s short)
  - Smart cache key generation (path, query, headers, user)
  - Cache statistics (hit rate tracking)
  - Cache invalidation by pattern

- **CI/CD Pipeline**
  - GitHub Actions workflow for automated testing
  - Security vulnerability scanning (npm audit, Snyk)
  - ESLint and TypeScript type checking
  - Docker image building and pushing
  - Automated deployment on main branch
  - Automatic rollback on deployment failure
  - Slack/Sentry notification integration

- **Zero-Downtime Deployment**
  - Blue-green deployment pattern
  - Health checks before traffic switch
  - Nginx upstream configuration update
  - Automatic rollback on failure
  - Deployment rollback script

- **Performance Monitoring**
  - Request/response time tracking (P50, P95, P99)
  - CPU, memory, disk usage monitoring
  - Custom metrics collection
  - Alert thresholds (CPU >80%, Memory >80%, Disk >80%)
  - Telegram/Sentry alert integration
  - Express middleware for automatic tracking

### Security Improvements
- **SQL Injection Prevention**
  - Input validation for all IoTDB paths and parameters
  - Dangerous pattern detection
  - Whitelist-based validation for device names, measurements, data types
  - Production credential check for IoTDB (disallows root/root)

- **Token Storage Security**
  - Removed localStorage token usage
  - HttpOnly cookie-only token storage
  - Updated all frontend pages to use authFetch utility

- **CSRF Protection**
  - Backend already has complete CSRF implementation
  - Removed localStorage fallback from csrf.ts
  - Double-submit cookie pattern with Redis

- **AI Service Security**
  - AI features disabled by default
  - Environment variable `AI_FEATURES_DISABLED=true`
  - Graceful 503 response when accessing disabled endpoints

### Changed
- Updated multer from 2.0.2 to 2.1.0 (security fix)
- Created ErrorBoundary component for React error handling
- Added new error class: ServiceUnavailableError
- All 169 tests passing

### Fixed
- Fixed test suite failures by creating authLockout service module
- Fixed TypeScript type errors in new modules
- Fixed import paths for new utility modules

---

## [1.0.0] - 2026-03-03

### Added
- Initial release of MT Platform
- Apache IoTDB 2.0.5 integration
- AI-powered time series prediction and anomaly detection
- RESTful API with Swagger documentation
- Next.js 14 frontend with Ant Design
- PostgreSQL + Redis data storage
- JWT authentication with HttpOnly cookies
- Rate limiting with Redis
- CSRF protection
- API key management
- Alert system with multi-channel notifications
- User management and authorization
- Docker containerization
- Nginx reverse proxy configuration
- PM2 process management
- Comprehensive documentation

### Security Features
- HttpOnly cookies for JWT tokens
- CSRF token validation
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- Input validation with Zod
- SQL injection prevention (basic)

---

## [Unreleased]

### Removed - Documentation & Code Cleanup (2026-03-21)

#### Security Improvements
- **Deleted security-critical file** - `.secrets.tmp` contained plaintext secrets
  - Removed JWT secrets, database credentials, and passwords from disk
  - Eliminated security vulnerability from temporary plaintext file

#### Documentation Cleanup
- **Removed phase completion reports** (6 files, ~32KB)
  - `.phase1-completed.md`, `.phase1.5-completed.md`, `.phase1-final-summary.md`
  - `.phase1-security-summary.md`, `.phase2-completed.md`, `.final-completion-summary.md`
  - Superseded by current documentation and CHANGELOG.md
- **Cleaned archive documentation** (10 files, ~128KB)
  - Removed historical review documents from `docs/archive/reviews/`
  - Old testing reports, code quality reviews, and evaluations
  - Information now reflected in current codebase and documentation

#### Backup Cleanup
- **Removed old backup files** (6 files, ~20KB)
  - `backend/.env.backup-20260321-004458` - superseded by GPG encryption
  - 5 old `.claude.json.backup.*` files from previous configurations
  - Current backup system is sufficient

#### Results
- **Total files removed**: 17+ files
- **Space recovered**: ~180KB
- **Security improved**: Removed plaintext secrets exposure
- **Documentation clarified**: Eliminated duplicate and obsolete files
- **Project structure cleaner**: Only current, relevant documentation remains

### Added - Project Structure Cleanup (2026-03-21)

#### Developer Experience
- **ESLint Configuration** - Code quality linting for backend and frontend
  - TypeScript-aware linting rules
  - Auto-fix capabilities with `npm run lint:fix`
  - Custom rules for project standards
- **Prettier Configuration** - Consistent code formatting
  - Shared configuration for backend and frontend
  - 100 character line width
  - Single quotes, trailing commas
  - Format scripts: `npm run format`
- **Pre-commit Hooks** - Automated code quality checks
  - Husky + lint-staged integration
  - Runs ESLint and Prettier on staged files
  - Blocks commits with failing checks
- **Comprehensive Documentation** - Developer onboarding resources
  - CONTRIBUTING.md - Contribution guidelines and workflow
  - docs/DEVELOPER_GUIDE.md - Comprehensive developer guide
  - Architecture overview and project structure
  - Common tasks and debugging guides

#### Project Organization
- **Centralized Configuration** - `/config/` directory for all config templates
  - `backend.env.example` - Backend environment template
  - `frontend.env.example` - Frontend environment template
  - `.env.production.template` - Production environment template
  - Symlinks for backward compatibility
- **Cleaned Directory Structure** - Removed duplicate and obsolete files
  - Removed duplicate `/root/` project directory
  - Cleaned up 4+ Claude worktrees (~10MB storage recovered)
  - Removed 9 unused dependencies across projects

#### Dependency Management
- **Removed Unused Dependencies**
  - Backend: multer, qrcode, node-fetch, sqlstring
  - Frontend: dompurify, html2canvas
  - Root: swagger-jsdoc, swagger-ui-express, bcrypt, jsonwebtoken
- **Resolved Duplicate Dependencies**
  - Removed jsonwebtoken from root (kept in backend)
  - Removed bcrypt from root (using bcryptjs in backend)
- **Security Fixes**
  - Fixed minimatch vulnerability (GHSA-23c5-xmqv-rm74)
  - Applied pnpm override for minimatch >=3.1.4

#### Code Quality Scripts
```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Run tests
npm test
```

### Changed - Breaking Changes (2026-03-19)

#### Configuration Changes
- **Default port changed from 8002 to 8000**
  - Backend API now runs on port 8000 by default (was 8002)
  - Update your `PORT` environment variable if you relied on the old default
  - Nginx reverse proxy configuration updated to use port 8000
  - This aligns with common API port conventions

#### CI/CD Consolidation
- **GitHub workflows consolidated** from 3 files to 1
  - Merged `deploy.yml`, `security.yml`, and `test.yml` into `ci.yml`
  - All functionality preserved with improved organization
  - Automated testing, security scanning, and deployment in one pipeline

#### Documentation Cleanup
- Removed redundant `docs/SECURITY_SETUP.md` - content now in `docs/SECURITY.md`
- Removed archive documentation that was superseded by current docs

### Added - Test Coverage Improvements (2026-03-13)
- **Core Infrastructure Tests**
  - Error Handler Utilities - 100% coverage (36 tests)
  - JWT Library - 93.33% coverage (56 tests)
  - Response Utilities - 100% coverage (58 tests)
  - Logging Middleware - 100% coverage (64 tests)
  - Security Middleware - 97.46% coverage (74 tests)
  - Cache Middleware - 83.52% coverage (56 tests)
  - AI Access Middleware - 82.75% coverage (21 tests)

- **Test Statistics**
  - Total Tests: 575 (from 527, +48 tests)
  - Overall Coverage: 34.46% (from 31.26%, +3.20%)
  - Middleware Coverage: 61.2% (from 46.52%, +14.68%)
  - Project Score: 8.8/10 (from 8.7/10)

### Changed
- Updated documentation with latest test statistics
- README.md test badge updated to 575 tests
- Moved detailed test reports to archive:
  - `docs/archive/reviews/COMPREHENSIVE_TESTING_REPORT.md`
  - `docs/archive/reviews/TEST_IMPROVEMENTS.md`

### Planned - Phase 4 (Future)
- Advanced analytics dashboard
- Distributed tracing with OpenTelemetry
- Advanced caching strategies (cache warming, stale-while-revalidate)
- Kubernetes deployment manifests
- Horizontal Pod Autoscaler configuration
- Multi-region deployment support
- Advanced security features (2FA, SSO)
- Real-time WebSocket updates
- Data export and reporting
- Custom alert rules engine
- API rate limiting per user
- Request queue management
- Database query optimization
- ElasticSearch integration for log aggregation
- Grafana dashboards
- Prometheus metrics endpoint

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

1. **Update dependencies**:
   ```bash
   cd backend && pnpm install
   cd frontend && pnpm install
   ```

2. **Add new environment variables** (optional):
   ```bash
   # AI Features (disabled by default)
   AI_FEATURES_DISABLED=true

   # Sentry (optional)
   SENTRY_DSN=your-dsn
   SENTRY_ENVIRONMENT=production
   ```

3. **Update IoTDB credentials** (required):
   - Change default `root/root` credentials in production
   - The server will now refuse to start with default credentials in production mode

4. **Run database optimization**:
   ```bash
   ./scripts/optimize-database.sh
   ```

5. **Set up automated backups**:
   ```bash
   crontab -e
   # Add: 0 2 * * * /root/scripts/auto-backup.sh
   ```

6. **Enable monitoring** (optional):
   ```bash
   ./scripts/monitoring.sh --daemon
   ```

---

[1.2.0]: https://github.com/Zouksw/MT/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Zouksw/MT/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Zouksw/MT/releases/tag/v1.0.0
