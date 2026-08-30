---
title: "改进方案 — 竞争分析落地执行计划"
en_title: "Improvement Plan — Executing the Competitive Analysis"
version: "3.4.0"
last_updated: "2026-08-31"
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
---

# 改进方案 — 按 [牧集对标分析](COMPETITIVE-ANALYSIS-MOOKET.md) 制定的执行计划

> ## 第六波 v3.4.0（2026-08-31，round-145 规划）— 功能设计缺陷收敛：诚实化 IA、预测粒度对齐、触达补全
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
