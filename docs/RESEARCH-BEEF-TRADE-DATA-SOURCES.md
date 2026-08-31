---
title: "牛肉外贸（海关/贸易流）数据源研究报告"
en_title: "Research Report: Beef Foreign-Trade Data Sources"
version: "1.0.0"
last_updated: "2026-08-31"
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
---

# 牛肉外贸（海关/贸易流）数据源研究报告 — 向牧集搜索程度靠近的取数路径

> **2026-08-31**。回答一个问题：**要实现牛肉外贸数据的丰富性和准确性（向牧集的搜索体验靠近），贸易数据应该从哪里获取？**
>
> 与既有文档的分工：[COMPETITIVE-ANALYSIS-MOOKET.md](COMPETITIVE-ANALYSIS-MOOKET.md)（下称 CA）回答"MT vs 牧集差距"；[RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md)（下称 Landscape）覆盖行情信息供给全景；[中国进口牛肉贸易全链路数据源梳理报告.md](中国进口牛肉贸易全链路数据源梳理报告.md)（2026-05-12，下称"旧梳理"）覆盖泛数据源清单。**本文只深挖"贸易数据"一层**——海关量价统计、厂号注册状态、提单/企业级明细——并对每个关键源做**本机 live 取证**（旧梳理的结论多为检索转述且已 3.5 个月，未含本机可达性与接口实测）。
>
> 取证环境：本机直连 + mihomo 代理（127.0.0.1:7890，订阅 51 节点、**无中国大陆节点**，见 KNOWN-ISSUES D1 round-118 口径）。证据分级沿用 Landscape 约定：**【实测】**=2026-08-31 一手 curl/解析；**【转述】**=网页检索口径（含链接）；未标处默认【实测】。

---

## 一、结论速览（TL;DR）

1. **最大发现：UN Comtrade 公共预览 API 免 key、本机直连可用**，"出口国镜像"策略成立——中国不向 Comtrade 报月度 HS 明细（实测 reporter=156 月度返回 0 行），但**巴西月度新鲜到 t-1**（2026-07 已可查：82,714 吨/$529M），澳/新/美 t-2，且**中国年度分国别明细可查**（2024 年 HS0202：巴西 134.0 万吨/CIF $4,621/吨 …，见 §4.1）。这一条源即可把"分国别×分 HS×月度的对华贸易流量价"从 0 做到 6 国覆盖的 ~80%（缺阿根廷/乌拉圭月度）。
2. **厂号注册查询的官方入口本机可达**：单一窗口 `ciferquery.singlewindow.cn`（进口食品境外生产企业注册信息）页面 200；其查询端点 POST 需**实名登录会话**（实测返回登录壳页）。这是"按厂号搜索"能力的数据地基（牧集 `/followProduct` 按 国家×厂号 订阅，Landscape §8.1）。
3. **中国官方月度分国别口径（stats.customs.gov.cn）在本机直连与代理下均不可达**（000；代理无大陆节点）——该源仍是"需中国出口/人工月度导出"性质，与 KNOWN-ISSUES D1 结论一致。月度节奏可用 **Comtrade 镜像承接 + 中国年度明细校准**。
4. **提单/进口商级明细没有免费路径**：中国海关提单数据不公开，商业库为镜像/第三方申报数据——Volza $1,500 起步（积分制）、环球慧思 ¥4-5 万/年、腾道 ¥5-10 万/年（含 API）【转述】。买不买是预算决策，不是技术问题。
5. **阿根廷是国家开放数据路径的样板**：`datos.gob.ar` / `datos.magyp.gob.ar` CKAN API 本机直连可用（SSPM 出口月度序列 CSV 直链）；SENASA 官方页（含按目的国筛选已注册工厂的"Mercados Abiertos"）需经 mihomo 代理（200）。
6. **确认死路**：乌拉圭 INAC / catalogo.datos.gub.uy 直连+代理均 000（全球性下线，维持 KNOWN-ISSUES D1 round-103 结论）；巴西 ComexStat API 403（Cloudflare WAF，镜像已可替代）；USMEF 出口统计会员制；FAO 401（需 key）。

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
- INDEC 出口按 NCM 立场的月度库【待确认可达性与下载形态】。
- 兜底：Comtrade 阿根廷**年度**对华明细可用（镜像校准）。

### 4.5 其他出口国现状（与 KNOWN-ISSUES D1 对照，本轮增量）

- **巴西**：ComexStat API 被 Cloudflare WAF 拦（403，换出口 IP 同拦）——**不再必要**：Comtrade 镜像 t-1 已覆盖月度量价；ComexStat 的增量价值只剩市级/NCM8 更细粒度（P2 级，可经 basedosdados 等镜像【待确认】）。
- **乌拉圭**：INAC 官网与国家开放数据目录**全球性下线**（直连+代理 000）。月度数据目前**无免费程序化路径**；年度镜像（Comtrade）可用。**待确认**：INAC 重构后的新入口。
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
| 现货盘口（部位×厂号×VL×吨） | BeefCutPrice 冻结（D1）；CSV 手动导入通道可用 | 场外（CA §二.2 结论不变） | 用户运营（周度导入 runbook 已有） |

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

---

## 七、合规与风险

1. **UN Comtrade**：公共预览 API 官方开放；数据再分发条款（署名要求/商用限制）**待确认**——集成前查 comtradeplus.un.org terms。
2. **单一窗口注册查询**：官方公共服务，但脚本化登录抓取的 ToS **未验证**——建议低频 + 人工触发，动手前复核协议（与 CEPEA 的 ToS 风险登记同级，KNOWN-ISSUES D1）。
3. **商业库数据**：再分发普遍受限（Volza/腾道等用户协议），只能内用不可转售展示——若未来公开页要用，需商务授权。
4. **数据口径诚实**：镜像月度（出口国 FOB 报送）≠ 中国官方 CIF 口径（年度校准值实测有系统性差异：巴西 2024 年度 CIF $4,621/t vs 2026-06 月度 FOB $6,751/t，含时间与 FOB/CIF 双重差异）——展示层必须标注口径（MT 已有 source/metadata 机制）。

---

## 八、附录：关键取证命令（2026-08-31，可复现）

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
