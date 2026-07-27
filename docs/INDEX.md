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
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 |

## 技术参考

| 文档 | 内容 |
|------|------|
| [API.md](API.md) | REST API 参考 |
| [DESIGN.md](DESIGN.md) | UI/UX 设计规范 |
| [SECURITY.md](SECURITY.md) | 安全策略 |

## 开发与运维

| 文档 | 内容 |
|------|------|
| [deployment/DEPLOYMENT-CHECKLIST.md](deployment/DEPLOYMENT-CHECKLIST.md) | 生产部署清单 |
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
