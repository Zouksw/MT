---
title: "牛肉外贸（海关/贸易流）数据源研究报告"
en_title: "Research Report: Beef Foreign-Trade Data Sources"
version: "2.0.0"
last_updated: "2026-09-07"
status: "active"
maintainer: "MT Team"
tags:
  - research
  - data-sources
  - trade-data
  - product-strategy
target_audience: "Maintainer, Product decisions"
related_docs:
  - "Competitive Analysis Mooket": "COMPETITIVE-ANALYSIS-MOOKET.md"
  - "Info Landscape": "RESEARCH-BEEF-INFO-LANDSCAPE.md"
  - "数据源梳理报告": "中国进口牛肉贸易全链路数据源梳理报告.md"
  - "Known Issues D1": "KNOWN-ISSUES.md"
  - "Scale/Density Evaluation (round-157)": "DATA-SOURCES-EVALUATION.md"
---

# 牛肉外贸（海关/贸易流）数据源研究报告 — 向牧集搜索程度靠近的取数路径

> **2026-08-31 初版（v1.0.0）｜2026-09-07 v2.0.0 深挖扩版（round-160）**。回答一个问题：**要实现牛肉外贸数据的丰富性和准确性（向牧集的搜索体验靠近），贸易数据应该从哪里获取？**
>
> 与既有文档的分工：[COMPETITIVE-ANALYSIS-MOOKET.md](COMPETITIVE-ANALYSIS-MOOKET.md)（下称 CA）回答"MT vs 牧集差距"；[RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md)（下称 Landscape）覆盖行情信息供给全景；[中国进口牛肉贸易全链路数据源梳理报告.md](中国进口牛肉贸易全链路数据源梳理报告.md)（2026-05-12，下称"旧梳理"）覆盖泛数据源清单；[DATA-SOURCES-EVALUATION.md](DATA-SOURCES-EVALUATION.md)（2026-09-06，round-157）回答"规模/密度对标与逐层取数决策"。**本文只深挖"贸易数据"一层**——海关量价统计、厂号注册状态、提单/企业级明细——并对每个关键源做**本机 live 取证**（旧梳理的结论多为检索转述且已 3.5 个月，未含本机可达性与接口实测）。
>
> 取证环境：本机直连 + mihomo 代理（127.0.0.1:7890，订阅 51 节点、**无中国大陆节点**，见 KNOWN-ISSUES D1 round-118 口径）。证据分级沿用 Landscape 约定：**【实测】**=当日本机一手 curl/解析（v1.0.0=2026-08-31、v2.0.0=2026-09-07）；**【代理实测】**=本会话调研子代理在相同机器上的取证（curl 直跑本机 / WebFetch 经其通道）；**【转述】**=网页检索口径（含链接）；未标处默认【实测】。
>
> **v2.0.0 增量（round-160，2026-09-07）**：在 v1.0.0 + round-157/158/159 落地（comtrade_mirror / argentina_exports / inac 复活 / ibge_sidra）之上，六块此前未深挖的面：**§八 国内现货/资讯免费面**（肉交所、Mysteel 牛羊业——国内现货层首批可编程源）、**§九 替代贸易统计镜像**（Eurostat Comext 免 key 打通）、**§十 年度/基线分析库**（OECD-FAO 直链 CSV）、**§十一 厂号名录扩展**（MPI/MGAP/foodmate 等）、**§十二 运价指数免费面**（Drewry WCI/FBX）、**§十三 提单免费档**（ImportYeti）。排查性结论：俄罗斯月度官方路径全灭、ITC Trade Map/WITS 排除。

---

## 一、结论速览（TL;DR）

1. **最大发现：UN Comtrade 公共预览 API 免 key、本机直连可用**，"出口国镜像"策略成立——中国不向 Comtrade 报月度 HS 明细（实测 reporter=156 月度返回 0 行），但**巴西月度新鲜到 t-1**（2026-07 已可查：82,714 吨/$529M），澳/新/美 t-2，且**中国年度分国别明细可查**（2024 年 HS0202：巴西 134.0 万吨/CIF $4,621/吨 …，见 §4.1）。这一条源即可把"分国别×分 HS×月度的对华贸易流量价"从 0 做到 6 国覆盖的 ~80%（缺阿根廷/乌拉圭月度）。
2. **厂号注册查询的官方入口本机可达**：单一窗口 `ciferquery.singlewindow.cn`（进口食品境外生产企业注册信息）页面 200；其查询端点 POST 需**实名登录会话**（实测返回登录壳页）。这是"按厂号搜索"能力的数据地基（牧集 `/followProduct` 按 国家×厂号 订阅，Landscape §8.1）。
3. **中国官方月度分国别口径（stats.customs.gov.cn）在本机直连与代理下均不可达**（000；代理无大陆节点）——该源仍是"需中国出口/人工月度导出"性质，与 KNOWN-ISSUES D1 结论一致。月度节奏可用 **Comtrade 镜像承接 + 中国年度明细校准**。
4. **提单/进口商级明细没有免费路径**：中国海关提单数据不公开，商业库为镜像/第三方申报数据——Volza $1,500 起步（积分制）、环球慧思 ¥4-5 万/年、腾道 ¥5-10 万/年（含 API）【转述】。买不买是预算决策，不是技术问题。
5. **阿根廷是国家开放数据路径的样板**：`datos.gob.ar` / `datos.magyp.gob.ar` CKAN API 本机直连可用（SSPM 出口月度序列 CSV 直链）；SENASA 官方页（含按目的国筛选已注册工厂的"Mercados Abiertos"）需经 mihomo 代理（200）。
6. **确认死路**：乌拉圭 INAC / catalogo.datos.gub.uy 直连+代理均 000（~~全球性下线~~ **2026-09-07 已修正：inac.uy 新域复活并落地，见 round-159；round-162 又打通其出口统计面（§9.2）**）；巴西 ComexStat API 403（Cloudflare WAF，镜像已可替代）；USMEF 出口统计会员制；FAO 401（需 key）。

**v2.0.0 新增发现（round-160，2026-09-07）**：

7. **Eurostat Comext `DS-045409` 免 key 打通（本轮最大增量）**：欧盟批准国（爱尔兰/荷兰/法国/波兰）对华牛肉**月度 CN8 级量价**，本机直连匿名取数（IE→CN HS0202 2024-06 出口额 **€645,967**，亲手复核与调研代理逐位一致）；数据集 2026-08-14 更新已含 2026-06 月度（约 T+6 周），**快于 Comtrade 的欧盟月度报送**。v1.0.0 及旧文档所载 `/sale/` 路径已失效，现行端点见 §九。
8. **国内现货层首次找到免费可编程源（向牧集核心壁垒最近的一步）**：**肉交所 roujiaosuo.com**（进口/国产部位现货挂价 + 带厂号件套成交价，日更 SSR HTML——本机 200/95KB、价格标记 122 处实证）与 **Mysteel 牛羊业频道**（国产热鲜批发市场价 + 进口牛副价 + 冷冻分割品价表，日更 SSR HTML）。但真正核心的"进口分部位日度现货报价"仍锁在微信公众号（冻师傅/冻品攻略/优顶特研究院）与 App（冻品e港）——网页免费层是挂价流与转载，不是牧集级人工行情日报。
9. **厂号名录三个新免费入口**：foodmate 输华注册企业查询库（GACC 数据免费网页版，SSR 免登录，本机 200）；新西兰 MPI 输华肉类企业清单（SSR 含厂号+有效期，但本机双通道被 Incapsula 拦，需浏览器级会话）；乌拉圭 MGAP 输华厂专页（PDF 资产在、带更新日期，直链 JS 隐藏待逆向）。
10. **运价指数免费三源可拼**：Drewry WCI 免费文本值（本机实证 **$4,465/40ft**，周四更新）、Freightos FBX 匿名综合指数（日更）、SCFI（图片渲染+CSRF 壳，不采）——到岸成本工具的运价因子可零成本接入。
11. **俄罗斯整块排查无解**：联邦海关局分商品分国别明细自 2022-03 停更、Agroexport 仅新闻稿数字、肉业协会仅评论级——RU 对华月度量价无免费程序化路径（唯一解=中国官方口径/商业库，均在本仓既有门槛内）。
12. **明确排除**：ITC Trade Map（条款禁抓取+禁再分发）、World Bank WITS（仅年度，Comtrade 年度库的子集）、ImportYeti（仅美国进口方向+本机 CF 403 墙，无中国方向）、SCFI（见 10）、uktradeinfo/StatCan（免 key 可商用但供应量小，P3 备用）。

---

## 二、目标拆解：'牧集搜索的程度'在贸易数据上意味着什么

牧集的搜索面（CA §八 + Landscape §二 实测汇总）：

| 牧集能力 | 证据 | 贸易数据侧的对应物 |
|---|---|---|
| 行情/报盘按 **部位×饲养×VL×品种×厂号×国别×仓位×吨数** 检索 | CA §8.3 报盘样例；Landscape §2.4 schema | 现货盘口是场外数据（不可爬，CA §二.2 结论不变）；**可公开获取的对应物是贸易统计层**：分国别×分 HS（部位近似）×分厂号的量价与状态 |
| 关注产品按 **国家×厂号×现货/期货** 订阅 | `/followProduct/{add,edit}` 路由 + 筛选常量"国家厂号不限" | 需要**厂号维度的权威参照表**（谁有资格输华、状态有效/暂停）→ GACC 注册名单 |
| 资讯/研报独立检索 | `/information/search` 等路由 | MT 已有 /api/search（round-146）；内容侧不在本文范围 |
| 行业数据词汇 | 首页"今日 JBS 件套市场价格…"、进口牛肉日报 | 需要量价背景数据支撑内容生成 |

因此"向牧集搜索的程度靠近"在贸易数据层 = **四层能力**（下文逐层给出取数路径）：

- **L-A 量价统计**：对华出口量/金额/均价，按 国别 × HS（4/6 位）× 月。
- **L-B 厂号注册状态**：哪些工厂有输华资质、注册号、有效/暂停（牧集/必孚的"新增准入"类情报的地基，Landscape §3.2）。
- **L-C 提单/企业级**：谁进口了多少、什么船、什么港（牧集未公开做此层，商业库领域）。
- **L-D 现货盘口**：场内报盘流（牧集核心壁垒，公开不可得，本文不展开）。

---

## 三、本机可达性实测矩阵（2026-08-31）

| 源/主机 | 直连 | 经 mihomo 代理 | 判定 |
|---|---|---|---|
| `comtradeapi.un.org`（UN Comtrade 公共预览 API） | **可用**（400/429 为参数与限流，数据可取） | — | ✅ 免 key 可编程 |
| `ciferquery.singlewindow.cn`（单一窗口·境外生产企业注册查询） | **200** | — | ⚠️ 可达，查询需实名登录会话 |
| `www.singlewindow.cn` | 200 | — | ✅ 可达 |
| `stats.customs.gov.cn`（海关统计在线查询平台） | 000 | 000 | ❌ 需中国出口 |
| `jckspj.customs.gov.cn`（总署·进口食品企业注册查询旧入口） | 502(http)/000(https) | — | ❌ 不可用（新入口=单一窗口） |
| `www.customs.gov.cn/eportal/ui?pageId=374112`（输华名单静态页） | 412 | — | ❌ 反爬 |
| `datos.gob.ar`（阿根廷开放数据门户）+ CKAN API | **200/可用** | — | ✅ 可编程 |
| `datos.magyp.gob.ar`（阿根廷农贸部 CKAN） | **可用** | — | ✅ 可编程 |
| `www.argentina.gob.ar`（SENASA 统计/开放市场） | 000 | **200** | ⚠️ 需代理 |
| `api.fas.usda.gov`（USDA FAS API 网关） | 404(根路径)/主机可达 | — | ⚠️ 可达，需 data.gov 免费 key（配额待确认） |
| `apps.fas.usda.gov/gats` | 302 可达 | — | ⚠️ 同上 |
| `www.usmef.org`（美肉协出口统计） | 200（统计入口 404/会员制） | 200 | ❌ 会员墙 |
| `www.volza.com`（商业提单库） | 403（CF） | — | 商业库（网页取证受 CF 拦截） |
| `web.mooket.com` | 200 | — | 参照面（SPA 壳） |
| `catalogo.datos.gub.uy` / `www.inac.gub.uy`（乌拉圭） | 000 | 000 | ❌ 全球性下线（与 round-103 口径一致） |
| `api-comexstat.mdic.gov.br`（巴西 ComexStat） | 403 | 403（round-118 经巴西节点同拦） | ❌ Cloudflare WAF（镜像已可替代其月度量价） |

复现命令形如：`curl -s -m 8 -o /dev/null -w "%{http_code}" <url>`（完整取证脚本见附录）。

**v2.0.0 新增主机矩阵（round-160，2026-09-07 实测）**：

| 源/主机 | 直连 | 经 mihomo 代理 | 判定 |
|---|---|---|---|
| `ec.europa.eu/eurostat/api/comext/...`（Comext API） | **可用**（取到真值） | — | ✅ 免 key 可编程 |
| `sdmx.oecd.org`（OECD-FAO Outlook CSV） | **200**（30.5MB 实拉） | — | ✅ 免 key 直链 |
| `www.roujiaosuo.com`（肉交所） | **200**（95KB SSR 价格表） | — | ✅ 可编程（ToS 复核先行） |
| `m.mysteel.com` / `ncp.m.mysteel.com/nyy/`（Mysteel 牛羊业） | **200**（桌面版文章 SSR 表格） | — | ✅ 可编程（移动版正文缺失，须桌面 UA） |
| `jwqyp.foodmate.net`（输华注册企业查询） | **200** | — | ✅ 可编程 |
| `www.drewry.co.uk`（WCI 免费页） | **200**（文本值在） | — | ✅ 文本抽取 |
| `api.uktradeinfo.com`（HMRC OTS） | 200【代理实测】 | — | ✅ 免 key（P3，量小） |
| `www150.statcan.gc.ca`（CIMT） | 301→经代理 **200** | 200 | ✅ 页面可用（P3） |
| `wits.worldbank.org` | **200** | — | ⚠️ 页面活但 API 形状迁移未打通；**仅年度→排除** |
| `www.trademap.org`（ITC） | **200**（JS 壳） | — | ❌ 条款禁抓取/禁再分发 |
| `customs.gov.ru` / `www.agroexport.gov.ru` | 000 | 000 | ❌ 俄域双通道封锁（明细 2022-03 起停更，见 §九） |
| `aemcx.ru` / `nspg.ru` | —（代理 web 侧可读） | — | ⚠️ 仅新闻稿/评论级【代理实测】 |
| `www.importyeti.com` | 403 | 403 | ❌ CF 墙（且仅美国方向） |
| `www.mpi.govt.nz`（输华清单页） | 200 但 849B 壳 | 200 但 849B 壳 | ❌ Incapsula 拦 curl（数据面存在，需浏览器级会话） |
| `www.gub.uy`（MGAP 输华厂页） | **200**（44KB，PDF 资产 JS 隐藏） | — | ⚠️ P2（直链待逆向） |
| `sigsif.agricultura.gov.br`（MAPA 按国别授权报表） | 502 | — | ❌ 本机不可达（现行入口身份经 ABIEC 官方按钮确证） |
| `www.aussiemeattradehub.com.au/rmed/search`（MLA RMED） | **200**（476KB，XHR 驱动） | — | ⚠️ 端点逆向 P2（有 China 准入筛选） |
| `www.sse.net.cn`（SCFI） | **200**（数值图片渲染；POST 端点回 CSRF HTML 壳） | — | ❌ 无结构化免费面 |
| `fbx.freightos.com` | 301→terminal 页【代理实测值可见】 | www 变体 000 | ⚠️ 匿名综合值可见，航线明细需免费注册 |
| `apps.fas.usda.gov`（PSD/circulars） | 000 | 000 | ❌ 主机级封锁（内容经 NAL 存档确证有效） |

---

## 四、逐层取数路径（含实测数据样例）

### 4.1 L-A 量价统计：UN Comtrade 公共预览 API（本轮核心增量）

**端点与规则（实测）**：

```
GET https://comtradeapi.un.org/public/v1/preview/C/{freq}/{type}/HS
    ?reporterCode=76&period=202606&cmdCode=0202&flowCode=X&partnerCode=156
```

- `freq`：`M` 月度 / `A` 年度；`flowCode`：**`X` 出口 / `M` 进口**（`1` 无效，实测 400）；`partnerCode=156` 即中国。
- **必须按 `motCode==0` 过滤后取数**：预览接口按运输方式拆行（海运会重复计入总计行，实测不对齐过滤求和会得到 ~2× 的量）。
- 限流：公共预览约 1 req/s（实测 429 "Try again in 1 seconds"）；**免费注册 key（comtradeplus.un.org）可提配额——具体配额档位待确认**。
- HS 粒度：4 位与 6 位均可查（6 位是贸易数据里最接近"部位"的公开粒度：0202.30 冻去骨 / 0202.20 冻带骨 / 0206.10-29 牛杂逐项）。

**各出口国新鲜度实测（HS0202 对华，2026-08-31 查询）**：

| reporter | 2026-06 | 2026-07 | 滞后结论 |
|---|---|---|---|
| 巴西(76) | 158,365 t / $1,069.2M / **$6,751/t** | 82,714 t / $529.2M / $6,398/t | **t-1，六国最新鲜** |
| 澳洲(36) | 8,549 t / $53.8M / $6,288/t | 无 | t-2 |
| 新西兰(554) | 14,069 t / $74.0M / $5,257/t | 11,180 t / $62.1M / $5,556/t | t-1~t-2 |
| 美国(842) | 1,640 t / $9.4M / $5,733/t | 无 | t-2 |
| 阿根廷(32) | 2026-04/05/06 均无 | — | **不报月度明细**（年度有）→ 走国家级源（§4.4） |
| 乌拉圭(858) | 2026-03~06 均无 | — | 同上（且 INAC 官网下线，§4.5） |

**中国作为 reporter（官方口径镜像）**：月度 HS 明细**不报**（实测 0 行）；**年度分国别明细可查**（2024 HS0202 进口，CIF）：

| 伙伴 | 数量 | 金额 | 均价 |
|---|---|---|---|
| 巴西 | 1,339,849 t | $6,191.9M | $4,621/t |
| 阿根廷 | 592,360 t | $2,205.1M | $3,723/t |
| 乌拉圭 | 242,770 t | $805.5M | $3,318/t |
| 澳洲 | 175,100 t | $1,131.5M | $6,462/t |
| 新西兰 | 144,114 t | $635.5M | $4,410/t |
| 美国 | 118,311 t | $1,101.3M | $9,308/t |
| 全球 | 2,802,593 t | $12,892.0M | $4,599/t |

（HS 口径补充实测：巴西 2026-06 对华 0201 鲜冷 13 t/$12,032/t、0206 牛杂 1,718 t/$2,944/t、020629 其他冻牛杂 33 t/$3,316/t——**杂碎/副产线也可直接建序列**。）

**价值定位**：这组数据 = 中国最大六家供应国的对华量价月度全景，免 key、免爬虫、结构化 JSON、可回溯历史（Comtrade 库深 1988 起【待确认最早年份】）。均价（金额/数量）是**HS 级进口均价**——与旧梳理 §二.2 所述海关总署平台口径同源（Comtrade 的中国年度数据即中国官方报送），但**月度镜像来自出口国报送**，两侧可互校。

**与既有源的关系**：MT 现有 `chinaCustomsStats.ts` 指向 `stats.customs.gov.cn/api/trade/query`——**该端点是推测虚构的（从未成功过）**，且主机被封锁。落地时应以 Comtrade 镜像源替代（§六 P0），保留 MarketFactor 落库模型（type=`export_0202_to_cn` 等，region=`BR→CN`）。

### 4.2 L-A 中国官方口径：stats.customs.gov.cn（条件路径）

- 现状：本机直连+代理均 000（无大陆节点）。**不是代码可修**（KNOWN-ISSUES D1 round-63/118 口径，本轮复核成立）。
- 可行获取方式（按成本排序）：① 订阅增加中国大陆节点后走代理；② 人工月度导出（平台免费、CSV、维度=HS×国别×贸易方式×收发货地，旧梳理 §二.2 实锤）；③ 用 Comtrade 中国**年度**明细 + 出口国**月度**镜像拼合（年度校准 + 月度插值，零成本零合规风险）。
- 月度节奏的免费替代：海关总署每月新闻稿的牛肉进口总量（gacc.gov.cn，同被封锁/反爬；国内出口可取）。**待确认**：是否有第三方免费转载月度分国别数据（必孚公众号等，属 L2 墙内/公众号层）。

### 4.3 L-B 厂号注册状态：官方查询入口（本轮核心增量之二）

| 入口 | 状态 | 说明 |
|---|---|---|
| **单一窗口 `ciferquery.singlewindow.cn`** | **本机 200**；查询 POST `/sw/cfppweb/indexTwo` 需实名登录会话（无会话返回登录壳页；bundle 内含 CAS 验证与"请登录系统/实名注册"文案） | 官方现行入口（搜索结果与页面 title"进口食品境外生产企业注册信息"一致）。字段含：国家（地区）、所在地区注册编号、企业名称、注册类型、产品清单、状态。**免费注册单一窗口账号后可查询**（账号获取=用户动作） |
| 总署 eportal 输华名单静态页（如巴西名单 pageId=374112） | 412 反爬 | 名单页按国家不定期更新（暂停/恢复），需中国出口+反爬处理；行业转载版（必孚/公众号 PDF）可作人工兜底 |
| 旧入口 `jckspaj.customs.gov.cn` | 502/000 | 已不可用 |
| 阿根廷 SENASA "Mercados Abiertos" | 代理 200 | **按目的国筛选已注册出口工厂**——工厂级注册状态的国别源样板（argentina.gob.ar/senasa/exportaciones-e-importaciones/mercados-abiertos） |

**落地形态**：注册名单是**低频全量快照**（周/月拉一次），适合落独立参照表（MT 已有 Factory 模型，`factoryId/country` 字段现成），供报价/行情页做厂号搜索维度与状态标注（有效/暂停）——这正是牧集"国家×厂号"订阅维度（Landscape §8.1）与必孚"新增准入"情报（Landscape §3.2）的公共数据地基。

**合规注记**：单一窗口查询是官方公共服务，但**自动批量抓取的 ToS 未验证**——登录态脚本化属灰色（建议：人工导出/低频半自动，控制频率；动手前复核用户协议）。

### 4.4 阿根廷路径（月度缺口的补法）

- **`datos.gob.ar` CKAN API（直连可用）**：`/api/3/action/package_search` 实测可用。相关数据集：SSPM 宏观出口序列（Exportaciones FOB por rubro，月度 CSV 直链 `infra.datos.gob.ar/catalog/sspm/...`）——**月度出口总额级**，牛肉专项需在目录中再定位（本轮检索未命中牛肉专项月度序列，**待确认**）。
- **`datos.magyp.gob.ar`（农贸部 CKAN，直连可用）**：现有 carnes 相关数据集 = SIO Carnes（指数/分区）、Producción de carne bovina（产量）——**产量/价格面，非分目的国出口**。
- **SENASA 统计页（需代理）**：`argentina.gob.ar/senasa/estadisticas-historicas-de-exportacion-e-importacion-de-carne-bovina-bubalina-y-lacteos`——按年度的出口/进口统计（含按厂/目的国口径的细分表，**粒度待下载核验**）。
- ~~INDEC 出口按 NCM 立场的月度库【待确认可达性与下载形态】~~ **2026-09-07 已打通（round-163）**：comex.indec.gob.ar 公共 API 全量可达，NCM8×目的地×月度量价已落地 `indec_comex`，契约见 §9.3。
- 兜底：Comtrade 阿根廷**年度**对华明细可用（镜像校准）。

### 4.5 其他出口国现状（与 KNOWN-ISSUES D1 对照，本轮增量）

- **巴西**：ComexStat API 被 Cloudflare WAF 拦（403，换出口 IP 同拦）——**不再必要**：Comtrade 镜像 t-1 已覆盖月度量价；ComexStat 的增量价值只剩市级/NCM8 更细粒度（P2 级，可经 basedosdados 等镜像【待确认】）。
- **乌拉圭**：~~INAC 官网与国家开放数据目录全球性下线~~（v1.0.0 时实测；**2026-09-07 已两度修正**：round-159 复活 novillo 价格，round-162 打通 eDIAE 出口统计——对华月度 FOB 金额 + 部位族 USD/kg 已落地 `inac_expo`，契约见 §9.2）。Comtrade 侧 UY 月度报送仍稀疏，INAC 官方通道即月度主路径。
- **澳洲**：MLA 统计 API 需 key（D1 A1 口径）；ABARES 报告为 PDF/Excel。Comtrade 镜像 t-2 已覆盖月度量价。
- **美国**：FAS GATS（双边、HS10、官方出口口径）API 主机可达（`api.fas.usda.gov`），需 data.gov 免费 key——**HS10 粒度比 Comtrade HS6 更细（含 cutoff/trimming 等子目）**，值得作为 P1 扩展（配额待确认）。

### 4.6 L-C 提单/企业级：商业库一览【转述】

| 供应商 | 覆盖/特点 | 价格口径 |
|---|---|---|
| Volza | 200 国、35 亿+ 货运记录，提单检索（买家/供应商/品名/重量） | 在线访问 $1,500 起，积分制下载 |
| 环球慧思 GlobalWits | 80+ 国海关数据终端 | ¥4-5 万/年（分级，无免费版） |
| 腾道 Tendata | 228+ 国、API 接口 + AI 追溯提单 | ¥5-10 万/年 |
| 必孚 BTC | 进口牛肉垂直（工厂/准入/贸易流数据库） | 企业合同制（Landscape §3.3） |

**关键警告（检索口径）**：中国进口方向的**提单级明细本身不公开**，商业平台提供的是其他国家海关申报的镜像记录 + 第三方数据；购买前务必用免费试用验证"中国进口方向"的实际覆盖。【转述，来源见附录】

来源：[知乎对比评测](https://zhuanlan.zhihu.com/p/1983934535239493132)、[腾道官网](https://www.tendata.cn/)、[腾道 API 页](https://www.tendata.cn/service/consult/)、[Volza 提单数据页](https://www.volza.com/p/bill-lading-form/)、[小满 OKKI 评测](https://www.xiaoman.cn/article/991.html)

---

## 五、差距矩阵：从牧集搜索能力到 MT 取数路径

| 牧集搜索维度 | MT 现状（2026-08-31） | 公开可得的最佳填补 | 成本/条件 |
|---|---|---|---|
| 按国别看对华量价（月度） | MarketFactor 有模型无活数据（chinaCustomsStats 虚构端点，0 行） | **Comtrade 镜像**（BR/AU/NZ/US 月度 + AR/UY 年度） | 免 key 起步，0 元 |
| 按部位近似（HS6：冻去骨/带骨/杂碎） | 无 | Comtrade HS6 子目 | 同上 |
| 按厂号（注册状态/准入变动） | Factory 表 21 家（site-stats 口径），无注册状态维度 | 单一窗口注册查询（需实名账号）+ SENASA 目的国工厂筛选（代理） | 用户动作（注册账号）；ToS 待复核 |
| 中国官方口径（含收发货地/贸易方式） | 无 | stats.customs.gov.cn | 需中国出口或人工月度导出 |
| 提单/进口商级 | 无（也不在 PRODUCT-SPEC 当前范围） | Volza/环球慧思/腾道/必孚 | ¥1-40 万/年级 |
| 现货盘口（部位×厂号×VL×吨） | BeefCutPrice 冻结（D1）；CSV 手动导入通道可用 | 场外（CA §二.2 结论不变）——**round-160 修正**：场外"人工行情日报"仍无公开源，但挂价流免费层存在（肉交所带厂号件套成交价，见 §八） | 用户运营（周度导入 runbook 已有）+ 肉交所采集（P1b，ToS 复核先行） |

---

## 六、落地路线（建议，未实施）

> 本文为调研产物，未动代码。以下为按 ROI 排序的集成建议，供排期决策。

**P0 — Comtrade 镜像源（`comtradeMirror`）**：
- 新增月度爬虫：6 reporter（76/32/36/858/554/842）× HS（0201/0202/0202.30/0202.20/0206 族）× flow=X×partner=156，`motCode==0` 过滤，落 MarketFactor（`type=export_to_cn_0202` 等，`region=BR→CN`，metadata 存 qty/value/unitPrice/partner/period）。年度补中国 reporter 官方口径（freq=A）。
- 节律：月度（每月上旬拉上月）；限速 ≥1.5s/req；配额升级走免费 key（待确认档位）。
- 同时处置 `chinaCustomsStats.ts`：其 `stats.customs.gov.cn/api/trade/query` 为虚构端点（从未产数）——按 TECH-DEBT 惯例登记后替换或移除注册（文件保留）。

**P1 — 厂号注册参照表**：用户提供单一窗口账号会话后，低频（周/月）拉全量注册快照落 Factory 表（+状态字段），为报价页/搜索页提供"国家×厂号"筛选维度（牧集对等能力的公共数据版）。

**P1 — 阿根廷月度**：datos.gob.ar SSPM 序列直连可编程；SENASA 统计下载经代理。定位牛肉专项月度出口序列（本轮未命中，待确认）。

**P2 — FAS GATS（HS10 细粒度）**：免费 key 申请后评估（主机已可达）。

**P2 — 商业提单库**：仅在产品决策需要 L-C 层时启动（预算 ¥1-40 万/年）；先用 Volza 试用验证中国方向覆盖。

**不做清单**：爬付费墙转售（Landscape §7.4 红线）；中国官方平台无中国出口时的硬闯（维持 D1 口径）；乌拉圭死站等待（登记待其恢复）。

**v2.0.0 路线增补（round-160，2026-09-07；未实施，供排期决策）**：

- **P1a — Comext 欧盟月度镜像**：`DS-045409` 逐产品逐指标查询（避免 413），reporter=IE/NL/FR/PL × product=0201/0202/020230/020220/0206 族 × partner=CN × flow=2，月度节奏；落 MarketFactor（type=`export_to_cn_{hs}` 复用现有命名，region=`IE→CN` 等，**EUR→USD 口径换算或双币并存的口径注记必须先行设计**，与 Comtrade USD 镜像互校不合并）。署名条款遵守（Eurostat source 标注）。
- **P1b — 国内现货免费层（肉交所 + Mysteel）**：肉交所部位挂价表 + 带厂号件套成交价（**这是 MT 首个"现货层"自动源**——落 BeefCutPrice 需先解决词汇映射与仓储/物流点语义）；Mysteel 国产热鲜批发 + 进口牛副（落 BeefCutPrice 国产线需先复核 PRODUCT-SPEC 国产维度删除边界——round-155 已删国产维度，**Mysteel 牛副/冷冻分割品若做需产品决策先行**）。两者 ToS 复核先行、日 1 次低频。
  - **实现设计登记（round-164 批C 勘察，2026-09-19 live 复核）**：
    - **入口/翻页**：`GET https://www.roujiaosuo.com/sell/index-htm-page-{N}.html`（N=0 最新页；全站 ~16,979 页**只翻新页**，命中已入库 listing id 即停——增量幂等）。robots 允许 `/sell/`，**禁 `/*search*` 与 `/member/`/`/api/`——品类搜索端点不可用，牛肉过滤必须客户端做**（列表为全品类混排：牛/猪/禽/水产同页，实测首页 40 项中牛系仅少数）。
    - **列表解析**：40 项/页，anchor `sell/show/{listingId}/` + 标题（中文俗名品名）+ 价格标记 `X.XX 元/公斤`（实测 20 处/页）。
    - **牛系词汇映射（关键前置）**：标题先过"牛"系白名单再排除猪/禽（如"预煮花肠猪杂"）；俗名→cutCode 复用 BeefCutTaxonomy 四语别名表（牛霖→KNUCKLE 族），**映射未命中落 OFFAL/登记新词，宁缺勿错不猜码**。
    - **详情页字段**（实测 `/sell/show/1930363/`）：价格：/数量：（公斤）/产地：/仓库位置：（如"江苏苏州市"）+ 面包屑品类（牛产品>牛油类）；round-160 实证"最新成交"块含**带厂号件套**（牛霖411厂，元/吨级）——**单位混用风险：列表元/公斤 vs 成交元/吨，解析按单位字段归一存储，绝不跨单位换算或合并**。
    - **落库设计（两阶段）**：第一阶段只落**无厂号平台挂价**为 market 行（源 `roujiaosuo_spot`，Tier 4 日更；metadata 存 listingId/仓库/产地/单位/priceType='listing'/sourceUrl 幂等键；currency=CNY——与 USD 系 BeefCutPrice 并存时 freshness/聚合面按币种注记，绝不隐式换算）；第二阶段厂号成交价（411 厂等不在 Factory seed 21 家内，需厂号→factoryCode 映射批先行）。**挂价≠成交价**，metadata.priceType 强制区分。
      > **round-168 进展注记（2026-09-19）**：二阶段拆半执行——①**厂号挂牌归属已落地**（前导厂号提取 + 产地→ISO2 + `{ISO2}-{厂号}` 工厂码，BR 沿用 SIF 前缀；详见 DATA-SOURCES-EVALUATION round-168 记录）；②**成交块采集诚实缩界**：round-160 实证的"最新成交"块 2026-09-19 复检已非 SSR（三详情页含当年取证页 1930363 静态 HTML 均无成交标记），抓取需 JS 执行或内部端点，越出"仅 /sell/ 公开页"合规边界——停摆登记，待 SSR 回归（round-170 注：P1 名册路径已落地但只解锁归属核验，不解锁成交块；round-170 当日再取 5 页详情复检仍 0 成交标记）。
    - **合规边界**：日 1 次低频 + 仅 /sell/ 公开列表/详情页；无登录态；不改写请求绕限制。
- **P2 — 厂号名录三源**：foodmate GACC 镜像（免登录，最优先）；MGAP PDF 直链逆向；MPI 需浏览器级会话（playwright 引入需独立决策）。落 Factory 参照表快照（周/月）。
  > **round-170 执行记录（2026-09-19）**：**foodmate 镜像路径已落地**（源 `gacc_registry`，周快照内建 7 天新鲜度门、挂 DAILY 调度）：jwqyp.foodmate.net（robots 全放行）layui 表格的 POST `/index/index/getlist` 分页接口，扫 6 源国 × 肉类共 **1346 家**（US 950/BR 103/AR 95/NZ 95/AU 75/UY 28——接口 count 字段封顶 100，分页以 data.length 为准）落 `FactoryRegistryEntry` 参照表。三道诚实约束：①**物种不可知**（镜像只有"肉类"大类，条目语义=该国注册肉类厂，绝不称牛肉专属）；②approvalNo→factoryCode **格式观测归一**（BR SIF 前缀含空格变体、NZ ME 前缀剥离；US 字母后缀/P/V 前缀与 NZ S/PH/CS 系列为独立编号空间，宁缺勿错保持 null，768/1346 未映射是正确行为而非缺陷）；③周门内 unchanged 行 touch lastSeenAt 防静态名册日日重扫。**直接收益：厂号归属转正**——BR-SIF2543 核验为 MARFRIG GLOBAL FOODS S.A.（kind→gacc-plant-verified）；**NZ-30 名册无 ME30，如实停留未验证**（挂牌证据保留行内）；肉交所采集侧同步接线（新归属即查名册，命中即 verified + 企业名替换泛称）。工程教训：镜像 PHP 栈对 `Accept-Language: *` 500（undici fetch 默认头、curl 不发——报文级二分定位后显式发 zh-CN 解决）；MGAP/MPI 备选路径维持登记未动。
- **P2 — 运价因子**：Drewry WCI 文本抽取（周四）+ FBX 综合值（日更）进 landing-cost 白名单（USD/40ft 口径标注）。
- **P2 — OECD-FAO 基线**：年度 CSV 本地过滤入 MarketFactor（供需平衡表关键序列），服务预测叙事。
- **P3 — uktradeinfo/StatCan**（全供应国覆盖时再议）。
- **不做（本轮确证）**：ITC Trade Map（ToS 禁抓取/再分发）、WITS（仅年度）、SCFI（无结构化免费面）、ImportYeti/52wmb（方向不符/伪免费）、俄罗斯官方月度（停更+封锁）。

---

## 七、合规与风险

1. **UN Comtrade**：公共预览 API 官方开放；数据再分发条款（署名要求/商用限制）**待确认**——集成前查 comtradeplus.un.org terms。
2. **单一窗口注册查询**：官方公共服务，但脚本化登录抓取的 ToS **未验证**——建议低频 + 人工触发，动手前复核协议（与 CEPEA 的 ToS 风险登记同级，KNOWN-ISSUES D1）。
3. **商业库数据**：再分发普遍受限（Volza/腾道等用户协议），只能内用不可转售展示——若未来公开页要用，需商务授权。
4. **数据口径诚实**：镜像月度（出口国 FOB 报送）≠ 中国官方 CIF 口径（年度校准值实测有系统性差异：巴西 2024 年度 CIF $4,621/t vs 2026-06 月度 FOB $6,751/t，含时间与 FOB/CIF 双重差异）——展示层必须标注口径（MT 已有 source/metadata 机制）。

---

## 八、国内现货/资讯免费面（v2.0.0 新增，round-160 核心增量之一）

> 回答"牧集现货日报层是否存在任何免费可编程源"。调研方式：三路并发子代理（本机 curl + WebFetch/WebSearch）+ 本机亲手复核承重项。此前 v1.0.0/round-157 只覆盖了牧集/必孚付费终端结论，未排查免费层。

| 平台 | URL | 免费数据面 | 节奏 | 形态 | 判定（证据分级） |
|---|---|---|---|---|---|
| **肉交所** | `roujiaosuo.com` | 进口/国产部位现货**挂价表**（产地/仓库/更新日期）+"最新成交"**带厂号件套价**（例：牛霖 411厂 57,878 元/吨、牛腩 90VL 52,828 元/吨）+ 50+ 产国筛选 + 行情资讯 | 日更（当日有更新） | **SSR HTML 表格** | **可编程采集**【实测：本机 200/95KB，"元/公斤"标记 122 处、牛腩/牛霖/厂号在页】 |
| **Mysteel 牛羊业频道** | 频道 `ncp.m.mysteel.com/nyy/`；读数用桌面文章页 `m.mysteel.com/a/...` | 国内重点省份热鲜牛肉批发价（北京岳各庄/顺鑫石门/大洋路、天津韩家墅海吉星、内蒙古/新疆/宁夏/山东/江苏/上海/广东佛山中南，元/公斤）、**进口牛副价格汇总**（天津/河南）、**冷冻牛肉分割品价格**（山东）、屠宰企业出厂价 | 日更（多篇/日） | SSR HTML 表格 | **可编程采集**【实测：文章页 200，岳各庄/大洋路/韩家墅/元/公斤在页】。**坑**：移动版域名正文表格缺失（只有 AI 摘要），必须桌面版域名/UA |
| **食品伙伴网** | 资讯 `foodmate.net`；查询库 `jwqyp.foodmate.net` | 进口肉类产业资讯（SSR 免登录）+ **进口食品境外生产企业注册信息查询**（数据源海关总署，肉类 5 类产品）+ 疫病国家禁止输入名录 | 资讯日更 | SSR HTML | **可编程采集（厂号镜像 ⭐，无报价）**【实测：jwqyp 200】 |
| 玉湖福谷 | `frozengoods.com.hk`（价格行情栏 `/news?cate=138&child=1457`） | 转载"冻品攻略"行情文章，正文价格数字免费可见（牛肉批发价、巴西配额进度） | 跟随公众号（滞后） | SSR HTML | 可编程（转载源）【代理实测】 |
| 中国价格信息网 | `chinaprice.cn/sysp` | 官方周更全国各省农批市场牛肉价（~33.94 元/500克 级） | 周更 | HTML | 可编程（官方周频，非现货件套）【代理实测】 |
| 新华·阳信牛肉价格指数 | `indices.cnfin.com` | 活牛收购/胴体指数 | 日/周 | HTML | 可编程（指数非现货报价）【代理实测】 |
| 冻师傅 | 知乎专栏（zhuanlan.zhihu.com） | 进口牛羊分部位日报价 | 日更 | 专栏 403 反爬 | **公众号墙**（内容免费但需登录态）【代理实测】 |
| 冻品攻略 / 优顶特研究院 | 微信公众号 | 进口牛肉行情日报/准入动态解读 | 日更 | 公众号 | **公众号墙**（玉湖福谷为其滞后网页转载） |
| 冻品e港 | App（北京建设 0925.HK 旗下） | 价格报盘/行情报告 | 日更 | App | **App 墙** |
| 一亩田 / 21food | `ymt.com` / `price.21food.cn` | 国产牛肉批发行情/冻肉批发价 | 日更 | JS 渲染 | 待确认（需 headless 或其接口） |
| 找牛网 | `zhaoniuw.com`（36氪 记录域名） | （无法验证） | — | — | **待确认**：该域名现为无关体育导航站（疑易主）；zhaoniu.com/zhaoniu888.com 连接重置；App 在架（清真牛羊 B2B）【代理实测】 |
| 牛羊天地网 | `niuyangtiandi.com` | （无法验证） | — | — | **待确认**：连接重置、搜索引擎零收录，疑公众号形态或关站 |
| 农产品集购网 | `16988.com` | 无牛肉数据（主打白糖/豆油，证书过期，SPA） | — | — | 无免费牛肉数据【代理实测】 |
| 涌益咨询 | `data.yongyizixun888.com` | 仅生猪产业链 | 日/周 | HTML | 与牛肉无关【代理实测】 |

**分层结论**：国内现货层存在**少量**免费可编程源（肉交所=Mooket 型挂价流最近似的免费镜像；Mysteel=国产热鲜+进口牛副官方级日更）；**牧集核心的"人工行情员日报+件套价"不存在免费等价物**——维持 round-157 §2.3 三层结论，但把"现货层无任何公开源"收窄为"无人工行情日报级公开源，挂价流免费层存在"。

**合规注记**：肉交所/Mysteel 自动采集的 ToS 未复核——接入前查各自条款，低频（日 1 次）+ 限速，与 CEPEA 同级风险登记（KNOWN-ISSUES 惯例）。转载源（玉湖福谷）只可作佐证不作主源。

## 九、替代贸易统计镜像（v2.0.0 新增）

### 9.1 Eurostat Comext `DS-045409`（本轮最大增量，免 key 打通）

**现行端点（v1.0.0 时代的 `/sale/` 路径已 404 失效）**：

```
GET https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/ds-045409
    ?lang=EN&freq=M&reporter=IE&partner=CN&product=0202&flow=2
    &indicators=VALUE_IN_EUROS&time=2024-06
```

- **维度契约（实测确认，非文档推测）**：`freq=M`；`reporter`=ISO2（IE/NL/FR/PL…）；`partner=CN`（或 WORLD）；`product`=HS2/4/6 及 CN8（0201、0202、020230…）；**`flow=2` 出口 / `1` 进口**；`indicators`∈{`VALUE_IN_EUROS`, `QUANTITY_IN_100KG`, `SUPPLEMENTARY_QUANTITY`}；区间用 `sinceTimePeriod=2026-01&untilTimePeriod=2026-06`（`time=2026-01..2026-06` 冒号语法无效）。
- **坑（实测）**：多值过滤用 `+`（`product=0201+0202`）会触发 413 异步排队（ASYNCHRONOUS_RESPONSE）——**逐产品逐指标查询**；`indic_de`/`formatType` 是无效参数名（400）。
- **本机亲手复核**：IE→CN 0202 2024-06 出口额 **€645,967**（与调研代理逐位一致）；NL→CN 近月空值经 partner=WORLD 对照验证为真实近零流量而非查询失败。
- **新鲜度**：数据集 updated=2026-08-14，已含 2026-06 月度（约 T+6 周）——**快于欧盟成员国在 Comtrade 的月度报送**。
- **价值定位**：欧盟输华批准国（爱尔兰/荷兰/法国/波兰…）月度 CN8 级对华量价——是 comtrade_mirror 六通道之外**唯一的月度增量通道**；口径为欧盟申报 FOB-EUR（注意与 Comtrade USD 口径换算与互校，勿合并）。
- **条款**：Eurostat 免费复用（含商用）需署名（copyright 页 200 实测）；官方指南明示禁止全量批量下载（逐查询过滤）。

### 9.2 INAC eDIAE 乌拉圭官方出口统计（round-162 打通并落地 `inac_expo`，免 key）

乌拉圭官方统计所 INAC 的交互数据应用后端 `https://www.inac.uy/inac/DIAEUtils`（与 round-159 复活的 novillo 价格同一服务，expo 子应用；前端在 `/inac/diae/expo.html`，契约经 `expo/expo.js` 逆向）：

- **按目的地×月（Lane A）** `?cmdaction=exportaciones-query3`：`n1="Carne bovina"`、`pais="REPÚBLICA POPULAR CHINA "`（**尾随空格是服务端自己的下拉值**）、`apertura=Pais`、`desglozar=0`、`mostrar=-1` → 中国行 4 数（当月/当年累计 USD 千元 × 今年/去年）。实测 2026-06 对华 **67,491 千美元**（YTD 381,236），与全目的地表中国行逐位一致；2023-06 历史深验通过（81,272）。**新鲜度 T+1**（datosiniciales app=expo 报 maxAno/maxMes，2026-09-07 时=2026-07）。
- **按产品×月（Lane B）** `?cmdaction=exportaciones-query4`：钻取 `n1="Carne bovina"→n2="Refrigerada"→n3∈{Congelada,Enfriada}→n4=""`（**n4 必须显式传空**，省略则稳定返回空表）→ 部位族叶行带 USD(千) + 装船吨位 → **USD/kg 均价**（千美元÷吨=USD/kg 恰好）。部位族词表（n4）：胴体/四分体带骨与去骨、小件、前四带骨/去骨、后四带骨/去骨、其他带骨/去骨。注意：主干冻品在 **Refrigerada→Congelada** 分支（193M USD/月），"Producto carnico bovino" 是小的预制食品支，别钻错。
- **响应形态坑**：JasperReports HTML 包在 `$('#reportplace').html('…')` JS 片段里（`\n \' \" \uXXXX` 转义、全部分页合并在单响应、结尾 `');doNextPage=false;`）；`html('')` 空标记是**瞬时抖动**（重试即恢复）；query4 标题带 `Mes 7/2026` 应与请求月互核（防服务端忽略参数回落默认月）；数字用点千分位（"193.021"）。
- **robots**：`/robots.txt` 404 无声明；服务为公开查询应用，无登录。
- **登记缺口**：eDIAE 无分国吨位（Lane A 金额-only，不折均价）；query4 无目的地维度（Lane B 为全球口径）；"部位×目的地交叉"不存在。

### 9.3 INDEC COMEX 阿根廷官方查询系统（round-163 打通并落地 `indec_comex`，免 key）

[comex.indec.gob.ar](https://comex.indec.gob.ar/)（React SPA）的后端 **`https://comexbe.indec.gob.ar/public-api/*`**（契约经 SPA bundle 逆向，本机直连可达；SPA 域名本身需代理+TLS1.2，后端域名不需要）：

- **核心查询** `GET /public-api/search/?commerceType=export&year=Y&period=monthly&countryQuery=allCountries&products=["02023000",…]&countries=["CN-310"]` → 产品×国家×月行 `{amount(FOB USD), weight(kg), month, isConfidential?}`，**一次请求返回全年全国家**（`countries` 过滤形同虚设，客户端按 iso2=CN 过滤）；products 支持多码合单——15 个牛肉族 NCM 一次请求全覆盖。period 取值 `monthly`/`yearly`。
- **辅助**：`/public-api/staticData`（{lastYear,lastMonth} 新鲜度界，2026-09-07 时=2026-07，T+1；另含 zipFiles 整年月度归档下载面）；`/public-api/search/products|countries`（NCM8 词表/国家 id——中国=310）。
- **保密规则（关键）**：小目的地流被财政保密（amount=0/weight=0 + isConfidential）——这正是 AR 在 Comtrade 月度报送稀疏的根因；中国行公开。
- **NCM 词表（实测）**：冻品 02021000/02022010/02022020/02022090/02023000；冷鲜 02011000/02012010/02012020/02012090/02013000；杂碎 02061000/02062100/02062200/**02062910（牛尾）/02062990（其他）**（02062900 不存在）。对华有流：02023000（主干，2025 年 $1.51B/310.8kt、$4.87/kg）、02022010/20/90（带骨三兄弟，$4.3M/$3.2M/$362M）、02062990、02013000（冷鲜去骨——2023 起有流，冷鲜协议通道）。
- **robots**：无 robots.txt（SPA 404）；查询 API 温和使用（年请求≈数据年数）。
- **登记缺口关闭**：v1.0/v2.0 的"阿根廷产品×目的国交叉不存在于 SSPM 75/77"由本通道补齐（SSPM 75/77 缺口登记正式关闭）；出口商级（提单最接近的免费面）未见公开端点。

### 9.4 小供应国免 key API（P3 备用）

| 源 | 契约 | 实测 | 条款 |
|---|---|---|---|
| UK HMRC `api.uktradeinfo.com`（OTS） | OData：月度 × CN8（CommodityId 去前导零）× 伙伴国（`/Country` 查 id）× FlowTypeId；限流 60 req/min | `/OTS?$top=1` 取到真数据【代理实测，本机】；批量 CSV 在 data.gov.uk | **OGL 3.0 允许商用再分发（署名）** |
| 加拿大 StatCan CIMT | 月度 HS8 × 伙伴国，网页查询+CSV（catalogue 65F0013X）；WDS API 免 key | 页面 200（直连 301、代理 200）【实测】 | Canada OGL 可商用 |

供应量小（UK/加对华牛肉均为小几百~千吨级年量），列为 P3——若做"全供应国覆盖"时再接。

### 9.5 排除项与俄罗斯缺口

- **World Bank WITS**：页面 200 但 REST 端点 307→405 未打通；**根本问题：仅年度（Comtrade 年度库+TRAINS 关税），无月度**——对月度量价目标价值≈0，排除（关税表面若做税率工具再评估）。
- **ITC Trade Map**：免费注册可看月/季/年度 HS6 双边（MAT Pro beta 期免费，正式化后月度及时数据转付费档）；**条款（ITC Market Analysis 工具族统一条款）明文禁机器人批量抽取 + 限非商用自用 + 未经书面授权禁再分发**——只能人工交叉核查，不入管道。
- **俄罗斯（对华前几大供应国，整块排查）**：①联邦海关局 ФТС `customs.gov.ru/statistic` 明细统计**自 2022-03 起停更**（分商品分国别月度不可用，年度汇编仍在）；本机直连+代理双 000；②Agroexport（`aemcx.ru`）仅新闻稿数字（2024 对华冻牛肉 $86.6M；2026 1-7 月 $80.2M，口径实为中方数据）；③НСПГ 肉业协会仅评论级。**结论：RU 对华月度量价无免费程序化路径**——解法只剩中国官方口径（D1 既有门槛）或商业库；Comtrade 的 RU 报送同样中断，comtrade_mirror 无法补此通道。

## 十、年度/基线分析库（v2.0.0 新增，非月度）

| 库 | 直链/入口 | 实测 | 用途定位 |
|---|---|---|---|
| **OECD-FAO Agricultural Outlook** | `sdmx.oecd.org/public/rest/data/OECD.TAD.ATM,DSD_AGR@DF_OUTLOOK_2026_2035,1.1?format=csvfilewithlabels&startPeriod=...`（历史各版同在；UI=data-explorer.oecd.org，bovine meat=CPC_EX_BV） | **200，30.5MB 实拉**【实测】。坑：`c[COMMODITY]` 服务端过滤 422，须全量下+本地过滤 | 年度 × 国家/区域 × 供需平衡表 + **10 年预测**——价格基准与中长期基线（预测叙事弹药），非月度监测 |
| USDA FAS Livestock & Poultry: World Markets and Trade | 半年刊 PDF `apps.fas.usda.gov/psdonline/circulars/livestock_poultry.PDF`（最新 2026-04-09）；机读替代=PSD downloads CSV（apps 域，Beef×全部国家×营销年） | apps 域本机 000（内容经 NAL 存档确证）【代理实测+实测】 | 年度供需+贸易展望；PSD 通道已在我们 key 门清单（usda_psd 同族） |

> **round-171 执行记录（2026-09-20，外部信息扩容轮——三源落地）**：
> ① **`oecd_outlook` 已落地**（上表 OECD-FAO 行兑现）：全量 CSV 2026-2035 版实测 **237MB / 773,719 行**（较 v2.0.0 记录的 30.5MB 大幅膨胀——版次与列宽变化），服务端过滤 `c[COMMODITY]` 现回 404、`c[REF_AREA]` 被忽略（带过滤仍全量）→ **Response.body 流式解析 + 本地过滤**（含引号内逗号的 quote-aware 切分——标签列含逗号会错位），牛因子 CPC_EX_BV × 8 区域（CHN/BRA/ARG/AUS/NZL/USA/PRY/OECD；**URY 未被单列建模**，乌拉圭数据走 inac/inac_expo）× 4 度量（QP 产量/QC 消费/IM 进口/EX 出口，**千吨口径**——CHN QP 2024=7791kt≈7.79Mt 与现实吻合校准；PP 本币价与零散 WP 世界价因量纲不可靠**不落**）× 1990→2035，**2027-2035 九个预测年 metadata.projection=true 如实标注**，共 **1467 行** MarketFactor（type `outlook_bovine`，seriesKey=度量）。量纲陷阱：UNIT_MULT=3（千吨）勿误乘。调度：DAILY 挂载 + 源内 7 天门（读自身最后一条 success ingestionLog——只修订不新增的再扫不会把门焊死）。版本钉死 2026_2035 版：新版发布需人工换 dataflow id。
> ② **`fao_index` 已落地**（新源，非本文档 v2.0.0 表内项）：FAO 世界粮食形势免费 CSV `food_price_indices_data.csv`（URL 不带 sfvrsn 版本号亦稳定 200，48KB；robots 仅禁 CMS 路径）——**六指数族月度 1990-01→t-1**（Food/Meat/Dairy/Cereals/Oils/Sugar，2014-16=100；**牛因子子指数不在此文件**，叙事稿才有，不造）→ CommodityPrice 月度序列 **2640 行**，fao_meat_index 等以月度预测门（90 天窗+≥3 点，ADR-0001 ⑤）**自动进入预测环**（实测 on-demand chronos 月度 3 步预测通）。增量 3 个月尾窗（新发布+FAO 近月修订）+ noChange 契约。
> ③ **`hmrc_ots` 已落地**（§9.4 P3 升格）：UK OTS OData 免 key（OGL 3.0 可商用署名再分发）——**UK 脱欧后不在 Comext、Comtrade 无伙伴明细（reporter 826 月度×CN=0 行实测）**，此 API 是 GB→CN 月度唯一程序化路径。落地镜像家族形状（type `export_uk_to_cn_0201/0202`、region `GB→CN`、**GBP/ton 派生单价**=ΣValue£÷ΣNetMass(kg)×1000；抑制月份（Value null）诚实跳过不造价）。量级小（2025-01 以来 5 个月有贸易，£4k-£188k/月）——覆盖性通道。**工程教训（报文级二分）**：OData `in (...)` 谓词触发主机 WAF 403（in-1 即拦、or 链 200）——CommodityId 用 or 链；另注 undici 隐式头三件套在本主机均 200（非 jwqyp 型头问题）。
> **同轮死路登记（不再试）**：Comtrade 预览 API 伙伴国扩容——PY/BO/BY/KZ/CL/GB/NL 等候选国**均无伙伴×月度明细**（PY 仅 World 总额、EU 成员仅年度且已被 Comext 月度覆盖、GB 无伙伴拆分），预览 API 且**单次仅 1 个 period**；RSS 扩源——meatpoultry（topic feed 停更：latest-news 停在 2018、trade 停在 2026-05）、beefinternational（301→000）、mla（404）、fas.usda.gov（403）、chordata（代理外 000）、ipcva（301 死链）、foodmate 无 RSS——**当前双 feed（Beef Central/Federal Register）即免费面全部**；FBX 运价需代理且 www 变体 000，维持登记未动。

## 十一、厂号注册名录扩展（v1.0.0 §4.3 增补）

| 入口 | 对华维度 | 本机实测 | 判定 |
|---|---|---|---|
| **foodmate 输华注册企业查询** `jwqyp.foodmate.net` | GACC 注册数据镜像（肉类 5 类产品，按国家/企业/产品查） | **200 免登录 SSR**【实测】 | **P1 候选**：单一窗口的免登录免费镜像，可作 Factory 参照表快照源（周/月低频；ToS 复核先行，数据实源为海关总署） |
| 新西兰 MPI 输华肉类企业清单（`mpi.govt.nz/.../mpi-list-for-china-meat-establishments`） | 清单即输华名单：厂号（ME118 等）+物种+活动+**Valid until（至 2028）** | 页面 200 但双通道均 849B Incapsula 壳（数据面存在【代理实测】，curl 被拦） | P2：需浏览器级会话（playwright）或人工导出 |
| 乌拉圭 MGAP 输华厂专页（`gub.uy/.../china-lista-establecimientos-habilitados`） | 专门输华 PDF（文件名带日期：`China_2026_17032026_0.pdf`，2026-03-17） | 页面 200/44KB，**PDF 资产直链 JS 隐藏**【实测】 | P2：直链待逆向（下载按钮的 data 端点） |
| 阿根廷 SENASA | Mercados Abiertos/APSA=**市场级**（协议开放+条件，非厂级，JSF POST 表单无 JSON）；厂级对华 PDF **停在 2021-09-26**（过期）；活工厂登记查询（aps2）无目的国列 | 代理 200（v1.0.0 口径）【代理实测】 | 维持 v1.0.0：阿方厂级以 GACC 侧为准 |
| 巴西 MAPA SIGSIF 按国别授权报表（`sigsif.agricultura.gov.br/sigsif_cons/!ap_exportador_nac_pais_rep_net`，行业入口 ABIEC `abiec.com.br/habilitacoes-por-pais/`） | **有**：按目的国（含 China）出已注册 SIF 企业 | 本机 502/000【实测】（ABIEC 官方按钮确证其现行入口身份） | P2：需巴西出口节点（mihomo 无 BR 节点，D1 同类） |
| 澳大利亚 DAFF / MLA RMED | DAFF **不发布免费肉类厂名录**（乳/蛋/鱼有清单，肉没有；对华走中国 CIFER）；MLA RMED（`aussiemeattradehub.com.au/rmed/search`）有 **"Specific Country Export Eligibility: China"** 筛选（Beef 物种），但**公司级非厂号级**、XHR 驱动 | RMED 页面 200/476KB（China 筛选值在页），端点逆向未做【实测】 | P2：RMED XHR 逆向 + key 门之外的免费澳方补充 |

## 十二、海运运价指数免费面（到岸成本工具的运价因子）

| 指数 | 免费面 | 节奏 | 实测 |
|---|---|---|---|
| **Drewry WCI**（`drewry.co.uk/maritime-research-opinion-browser/world-container-index-assessed-by-drewry`） | 综合指数 + 8 条东西向航线即期运价**纯文本值**（本期综合 $4,465/40ft；上海-洛杉矶 $7,185 等） | 每周四 | **200，$4,465 在页可抽取**【实测】 |
| Freightos FBX（301→`freightos.com/enterprise/terminal/...`） | 匿名综合指数（~$3,520）；航线明细"View Data for Free"需免费注册；API 付费 | 日更（06:00 UTC 算，14:00 发布） | terminal 页值可见【代理实测】；www 变体代理 000 |
| SCFI（上海航运交易所，`en.sse.net.cn/indices/scfinew.jsp`） | 页面免登录但当期值**图片渲染**（`/index/indexImg`）；页面 JS 暴露 `/index/currentIndex`、`/singleIndex/scfi` POST 端点但本机两步 CSRF 实测均回 HTML 壳 | 每周五 15:00 北京 | **不采**【实测：图片+CSRF 壳】；历史查询是否强制登录待确认 |

**落地形态**：landing-cost 的运价因子可零成本拼 "WCI（周四）+ FBX（日更综合）" 双源交叉（均为 USD/40ft 口径，标注评估口径）；SCFI 仅人工参照。

## 十三、提单级免费档（v1.0.0 §4.6 增补）

| 源 | 免费 | 中国方向 | 判定 |
|---|---|---|---|
| ImportYeti（`importyeti.com`） | 免费注册无限检索 ~7.1 亿条**美国海运进口**提单（供应商/发货国/重量/提单数画像，日更）；付费 Power Query ~$130/30 天解锁明细+CSV | **无**（仅美国进口方向） | 本机 CF 403 双通道【实测】——且方向不符，**不接**；仅当未来做"美国进口面"参考 |
| 52wmb 外贸邦（`52wmb.com/billsearch`） | "免费送数据"实为**注册限量体验**，完整明细/下载付费 | 无中国方向（限于提单公开国） | 不接【代理实测】 |
| Volza / Panjiva / ImportGenius | 无免费档（v1.0.0 §4.6 已登记） | 中国方向覆盖需试用验证 | 预算决策，维持 |

**结论不变**：中国进口方向提单级明细不存在免费路径（v1.0.0 §4.6 口径成立）。

---

## 十四、附录：关键取证命令（v1.0.0=2026-08-31；v2.0.0 增补=2026-09-07，均可复现）

```bash
# Comtrade：巴西对华冻牛肉月度（注意 motCode==0 过滤与 flowCode=X）
curl -s "https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=76&period=202606&cmdCode=0202&flowCode=X&partnerCode=156"
# 中国年度官方口径（分伙伴）
curl -s "https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=156&period=2024&cmdCode=0202&flowCode=M&partnerCode=76"
# 中国月度（实测 0 行——中国不报月度 HS 明细）
curl -s "https://comtradeapi.un.org/public/v1/preview/C/M/HS?reporterCode=156&period=202606&cmdCode=0202&flowCode=M"

# 单一窗口厂号查询（页面可达；查询需登录会话）
curl -s -o /dev/null -w "%{http_code}" https://ciferquery.singlewindow.cn/
curl -s -X POST https://ciferquery.singlewindow.cn/sw/cfppweb/indexTwo -d "pageNumber=1&pageSize=10&country=BRA"

# 阿根廷开放数据（CKAN）
curl -s "https://datos.gob.ar/api/3/action/package_search?q=exportaciones+por+destino&rows=5"
curl -s "https://datos.magyp.gob.ar/api/3/action/package_search?q=carne&rows=8"

# 可达性矩阵（直连 vs 代理）
curl -s -o /dev/null -m 8 -w "%{http_code}" https://stats.customs.gov.cn/          # 000
curl -s -o /dev/null -m 8 -x http://127.0.0.1:7890 -w "%{http_code}" \
  https://www.argentina.gob.ar/senasa/bovinos-y-bubalinos-exportacion-importacion  # 200（代理）
```

原始输出摘要：巴西 2026-06 mot=0 行 `netWgt=158365xxx kg / fobvalue=1069158523`；单一窗口 POST 返回"中国国际贸易单一窗口"登录壳页 HTML；阿根廷 CKAN `success:true` + SSPM CSV 直链。

```bash
# ── v2.0.0（round-160，2026-09-07）────────────────────────────────────────
# Eurostat Comext：爱尔兰对华冻牛肉月度出口额（免 key；flow=2 出口；逐产品查避免 413）
curl -s "https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/ds-045409?lang=EN&freq=M&reporter=IE&partner=CN&product=0202&flow=2&indicators=VALUE_IN_EUROS&time=2024-06"
# → value: {'0': 645967}（€645,967，本机亲手复核）

# OECD-FAO Outlook 全量 CSV（30.5MB 实拉；服务端商品过滤 422，须本地过滤）
curl -sO "https://sdmx.oecd.org/public/rest/data/OECD.TAD.ATM,DSD_AGR@DF_OUTLOOK_2026_2035,1.1?format=csvfilewithlabels&startPeriod=2025"

# 肉交所（SSR 现货挂价+带厂号成交价）与 Mysteel 牛羊业（桌面版文章页才含表格）
curl -s -A "$UA" https://www.roujiaosuo.com/ | grep -c "元/公斤"          # 122
curl -s -A "$UA" "https://m.mysteel.com/a/26031811/3579DDB5B855FCC7_abc.html" | grep -cE "岳各庄|大洋路"

# foodmate 输华注册企业查询（GACC 镜像，免登录）
curl -s -o /dev/null -w "%{http_code}\n" https://jwqyp.foodmate.net/        # 200

# Drewry WCI 免费文本值
curl -sL -A "$UA" "https://www.drewry.co.uk/maritime-research-opinion-browser/world-container-index-assessed-by-drewry" | grep -oE "\\\$[0-9,]+ per 40ft" | head -1   # $4,465 per 40ft

# 判死面复测（直连+代理）
for u in https://customs.gov.ru/ https://www.agroexport.gov.ru/ https://www.importyeti.com/ \
         https://www.mpi.govt.nz/export/export-requirements/country-listing-requirements-for-animal-products/lists-of-approved-premises-for-specified-products/mpi-list-for-china-meat-establishments/ \
         http://sigsif.agricultura.gov.br/sigsif_cons/!ap_exportador_nac_pais_rep_net ; do
  printf "%s direct:%s proxy:%s\n" "$u" \
    "$(curl -s -o /dev/null -m 10 -w '%{http_code}' -A "$UA" "$u")" \
    "$(curl -s -o /dev/null -m 12 -x http://127.0.0.1:7890 -w '%{http_code}' -A "$UA" "$u")"
done
# → customs.gov.ru 000/000；agroexport 000/000；importyeti 403/403；MPI 200(849B壳)/200(849B壳)；SIGSIF 502/—
```
