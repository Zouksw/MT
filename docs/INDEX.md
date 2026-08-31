# MT — 文档索引

> 产品方向唯一事实来源：[PRODUCT-SPEC.md](PRODUCT-SPEC.md)
> AI 代理工作入口：[../AGENTS.md](../AGENTS.md) · 编码准则：[../CLAUDE.md](../CLAUDE.md)

---

## 产品与规划

| 文档 | 内容 |
|------|------|
| [PRODUCT-SPEC.md](PRODUCT-SPEC.md) | **产品方向唯一事实来源**（定位、功能、里程碑、范围边界） |
| [PROJECT-VISION.md](PROJECT-VISION.md) | 项目状态全景 + 产品愿景 + 核心特性设计 |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | 开放阻塞与待决策（数据源失效、MAPE 验证环、Chronos 接入等），每条标注来源与验证日期 |
| [TECH-DEBT.md](TECH-DEBT.md) | 过度工程化与冗余清单（BullMQ 死队列、多租户脚手架、死模型等），每条标注审计日期，动手前需复核 |
| [AUTOMATION-STATUS.md](AUTOMATION-STATUS.md) | CI/CD、cron、护栏等自动化基础设施状态 |
| [COMPETITIVE-ANALYSIS-MOOKET.md](COMPETITIVE-ANALYSIS-MOOKET.md) | 牧集对标分析：真正差距、价值未兑现根因、优势落实路径 + §八 深度探查（SPA 路由图/报盘词汇/公司事实，2026-08-30） |
| [RESEARCH-BEEF-INFO-LANDSCAPE.md](RESEARCH-BEEF-INFO-LANDSCAPE.md) | **牧集及同类牛肉行情信息网站调研报告**（v1.0.0，2026-08-31）：国内外 17 家供给全景（国内 B2B 平台/行情服务商/国际基准源五层）、牧集+必孚 bundle 级深探、报价 schema 词汇表、商业模式五型与付费墙双假设、数据合规框架、对 MT 九条启示（新发地免费部位级接口/MLA 90CL/空位验证）；经独立复审修订 |
| [RESEARCH-BEEF-TRADE-DATA-SOURCES.md](RESEARCH-BEEF-TRADE-DATA-SOURCES.md) | **牛肉外贸（海关/贸易流）数据源研究报告**（v1.0.0，2026-08-31）：全部关键源本机 live 取证——UN Comtrade 免 key 镜像实测（巴西 t-1/澳新美 t-2、中国年度分国别、HS6 粒度）、单一窗口厂号注册查询可达性（需实名会话）、stats.customs.gov.cn 需中国出口、商业提单库价格带、牧集搜索能力四层拆解与 P0-P2 落地路线 |
| [RESEARCH-LLM-NUMERIC-FORECASTING.md](RESEARCH-LLM-NUMERIC-FORECASTING.md) | **数值预测与大模型实践调研报告**（v1.0.0，2026-08-31）：服务器/预测链路 08-31 现状复查（10 model_id 精度双口径、牛肉月度 28 行到期时刻、代码级方案梳理）+ 量化金融（组合预测之谜/LLM=文本→特征/Tan et al. 引用纠偏）+ 肉类农产品（USDA 混合制/Expana naive-95.7% 批判/基差分解/arXiv 2601.06371）+ TSFM 工程全景（许可商用性核查/微调门槛/GreedyEnsemble）+ R1-R8 增量启示；经独立批评代理复审修订 |
| [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md) | 改进方案：v3.6.0 第八波（数据通路波：Comtrade 镜像贸易流/厂号注册表/阿根廷月度/FAS GATS/读侧面，2026-08-31）+ v3.5.0 第七波已落地（90CL 周度源等）；更早波次存档于文内 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 |

## 技术参考

| 文档 | 内容 |
|------|------|
| [API.md](API.md) | REST API 参考 |
| [DESIGN.md](DESIGN.md) | UI/UX 设计规范 |
| [SKILLS.md](SKILLS.md) | **AI 代理 skill 使用规划**（技术栈→skill 映射、触发场景、已验证组合、不适用清单） |
| [DESIGN-SYSTEM-AUDIT.md](DESIGN-SYSTEM-AUDIT.md) | 前端设计系统深度审计（token 漂移、a11y、AI-slop、组件深度，2026-08-07） |
| [DESIGN-OPTIMIZATION-PLAN.md](DESIGN-OPTIMIZATION-PLAN.md) | 前端美学优化计划：live 截图评估 + Linear/Geist/TradingView 参照 + 分批执行方案（2026-08-31） |
| [PROJECT-ASSESSMENT.md](PROJECT-ASSESSMENT.md) | 项目整体规划与实现状态评估（运维/价值链/架构/规划对齐，2026-08-08） |
| [PREDICTION-STRATEGY.md](PREDICTION-STRATEGY.md) | 牛肉价格预测策略评估：数据/模型现状实测、缺口清单、最优方案 + §八现行大模型预测方案维护（2026-08-31） |
| [SECURITY.md](SECURITY.md) | 安全策略 |

## 开发与运维

| 文档 | 内容 |
|------|------|
| [deployment/DEPLOYMENT-CHECKLIST.md](deployment/DEPLOYMENT-CHECKLIST.md) | 生产部署清单 |
| [guides/WEEKLY-DATA-IMPORT.md](guides/WEEKLY-DATA-IMPORT.md) | 牛肉价格周度导入 runbook（CSV 手动导入=数据解冻唯一路径，D1 期间） |
| [guides/CONTRIBUTING.md](guides/CONTRIBUTING.md) | 贡献指南 |
| [guides/SECRETS-MANAGEMENT.md](guides/SECRETS-MANAGEMENT.md) | 凭据管理 |
| [../CLAUDE.md](../CLAUDE.md) | 编码准则 + Dev Server 管理 + Health Stack 质量门 |
| [../AGENTS.md](../AGENTS.md) | 项目定位、价值链、规模事实、命令、约束 |

## 参考资料（业务数据）

| 文件 | 内容 |
|------|------|
| [references/beef-reference.xlsx](references/beef-reference.xlsx) | 牛肉部位/工厂数据参考表 |
| [中国进口牛肉贸易全链路数据源梳理报告.md](中国进口牛肉贸易全链路数据源梳理报告.md) | 进口牛肉贸易数据源梳理 |
| [数据源全链路审计报告.md](数据源全链路审计报告.md) | 数据源全链路审计 |

---

## 文档约定

- **数字必须实测**：不沿用历史 README / round 报告里已被发现矛盾的数字（规模事实见 [../AGENTS.md](../AGENTS.md) §三，附计数方式）。
- **易变数字不写死**：测试总数等只写"运行命令获取当前数"。
- **issue / 技术债**：每条标注证据来源与日期；未验证的标"待确认/待复核"。
- 解决某条 issue / 技术债时，在原条目末尾追加"已解决（日期）"，不删除（保留历史可防重复审计）。
