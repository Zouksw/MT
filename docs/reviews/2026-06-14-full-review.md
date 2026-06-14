# MT 项目全面审查报告

> **日期**: 2026-06-14
> **范围**: 设计、架构、代码实现、安全、开发体验全量审查
> **方法**: autoplan pipeline (plan-eng-review + plan-design-review + plan-devex-review + cso + review)
> **覆盖**: backend 139 文件 / 28,242 LOC + frontend 219 文件 / 37,579 LOC (共 ~66k LOC)

---

## 执行摘要

| 维度 | 评级 | 一句话结论 |
|------|------|-----------|
| 类型安全 | 🟢 **优秀** | 生产代码 0 个 `as any`、0 个 `@ts-ignore` |
| 安全基线 | 🟢 **良好** | JWT/RBAC/Prisma/Helmet/CORS 均正确,但有 1 个 Critical |
| 数据采集层 | 🟢 **优秀** | registry 模式 + 共享 helper,19 个源无重复 |
| 错误处理/认证 | 🟢 **优秀** | 集中化、分层清晰、token 黑名单 |
| 服务层分离 | 🟡 **中等** | 服务层存在但路由绕过它直连 Prisma |
| 路由规模 | 🔴 **差** | 6 个路由 >600 行,auth.ts 达 831 行 |
| 设计系统遵循 | 🟡 **中等** | 字体/圆角/网格近乎完美,但 376 处硬编码颜色 |
| 前端数据层 | 🔴 **差** | 两套并行的数据获取模式(SWR vs 原生 fetch) |
| 文档一致性 | 🔴 **差** | 两份 DESIGN.md 冲突 + AI 模型数量矛盾 + 测试数过时 |

**总体**: 工程质量在类型安全和数据采集架构上表现优秀,主要债务集中在**路由层臃肿**、**前端数据模式不统一**、**文档分裂** 三处。

---

## 🔴 Critical 发现(必须立即处理)

### C1. seed.ts 提交了明文管理员凭据
- **位置**: `backend/prisma/seed.ts:82-97`
- **内容**: `admin@trademind.com / Admin123!` (ADMIN)、`user@trademind.com / User123!` (EDITOR)、`demo@trademind.com / Demo123!` (VIEWER),且在 `:1644` 行还会 echo 出来
- **影响**: 任何能读仓库的人即拥有已知 ADMIN 登录;若 seed 跑到生产/预发库则直接被入侵
- **修复**: 从 seed 移除明文密码,改用环境变量提供,或生产环境跳过 admin seeding

---

## 🟠 High 发现

### H1. 账户锁定服务是死代码,登录无暴力破解防护
- **位置**: `services/authLockout.ts` 导出 4 个函数(`checkAccountLockout`/`recordFailedLogin`/`clearFailedLoginAttempts`/`formatLockoutTime`),但 `routes/auth.ts` **零调用**(已验证)
- **现状**: 登录仅有 per-IP 限流(10 req/15min),攻击者轮换 IP 或压在阈值下即可无限尝试单账户
- **修复**: 在 login handler 中调用 — verify 前 `checkAccountLockout`、密码错时 `recordFailedLogin`、成功时 `clearFailedLoginAttempts`

### H2. 无全局速率限制
- **位置**: `server.ts` 未挂任何 `app.use(rateLimiter)`
- **现状**: datasets/marketData GET/analytics/signals/watchlist 等路由无限流,`/logout`、`/verify` 也未限流
- **修复**: 加全局 limiter(如 300/min/IP),并对 `/logout`、`/verify` 补充

### H3. 6 个路由超 600 行(最大 831)
- `auth.ts` 831、`marketData.ts` 793、`anomalies.ts` 682、`metrics.ts` 657、`datasets.ts` 648、`models.ts` 629
- 根因: 路由内联了 CRUD + 业务逻辑 + 校验,且直连 Prisma(18/21 路由共 208 处 `prisma.` 调用)
- **修复**: 抽取服务层,路由只做 HTTP 边界 + 委托

---

## 🟡 Medium 发现

### M1. 208 处路由直连 Prisma,服务层被架空
- 18/21 路由从 `@/lib` import prisma 并直接 CRUD。最严重: auth(20)、marketData(19)、social(17)、watchlist(17)
- 这是**最大的架构债** —— 服务层存在但形同虚设

### M2. 两份 DESIGN.md 内容冲突
- `/root/DESIGN.md`: 主文本色 `#fafafa`、surface `#171717`、base unit 8px、bearish `#ef4444`
- `/root/docs/DESIGN.md`: 主文本用 gray 体系(`gray-900 #111827`)、base unit 4px、bearish `#DC2626`
- 两份文档对同一设计系统给出**不同的颜色/间距规范**,实现者无所适从

### M3. metrics / inference.status 端点未鉴权
- `routes/metrics.ts:247,283,339,407,507,560` — `/endpoints`、`/web-vitals`、`/web-vitals/history`、`/api-latency`、`/summary` 暴露运维遥测给任何人
- `routes/inference.ts:26-37` — `/api/inference/status` 未鉴权且返回 `process.env.INFERENCE_URL`
- **修复**: 加 `authenticate`

### M4. 前端两套数据获取模式并行
- Pattern A (SWR): `lib/api.ts` 的 `useList/useOne/createRecord` — 13 页使用,干净
- Pattern B (原生): `utils/auth.ts` 的 `authFetch` + 手动 `useState/useEffect` — 14 页使用,无缓存无去重
- ~28 个数据页只有一半走 SWR,另一半各自重复实现 loading/error 状态

### M5. ROADMAP 已知漏洞仍未修
- `docs/ROADMAP.md:47-48` 自述: "27 dependency vulns, 11 high"、Next.js 缓存投毒、qs 原型污染(Critical)
- 已用 `pnpm.overrides` 缓解部分(handlebars/path-to-regexp/ws),但**未覆盖 qs**
- Express 4.22.1 → 建议升 5.x 清掉 qs 链

### M6. `trust proxy` 未设置
- `server.ts` 无 `app.set('trust proxy', ...)`,导致 TLS 终结代理后 `req.secure` 恒为 false → secure cookie 失效、rate-limit keying 不准

### M7. VIEWER 可调用 AI 端点
- `middleware/aiAccess.ts:50` 仅检查 `req.user` 存在,无角色分层;CLAUDE.md 定义 AI 是计费层功能,但 VIEWER 免费用户也能调

---

## 🟢 Low 发现

| # | 发现 | 位置 |
|---|------|------|
| L1 | 376 处硬编码 hex 颜色(应用 design token) | 前端 src/ 普遍,chart 配置除外 |
| L2 | ~6 个 card 组件用 CSS `border` 而非 shadow-as-border | Skeleton、MobileStatsCard、GlassCard |
| L3 | 524 行死代码 `ResponsiveNav.tsx` + `DetailPageLayout`、`tables/DataTable`、`LanguageSwitcher` 均无引用 | frontend components/ |
| L4 | i18n 是摆设: next-intl 全套设施但仅 1 个(死的)组件消费,header 自行实现 locale 切换 | frontend i18n/ + header |
| L5 | logger 有 3 条 import 路径指向同一单例 | backend lib/logger + utils/logger + lib barrel |
| L6 | `AuthenticatedRequest` 类型在两处定义且不兼容 | middleware/auth.ts:16 + types/index.ts:67 |
| L7 | 分页 schema 重复且默认值不同(limit max 1000 vs 100) | schemas/common.ts:12 + middleware/security.ts:100 |
| L8 | `beefCutNormalizer.ts` 852 行(多为查找表) | backend services/dataIngestion/ |
| L9 | a11y: 62 个 `<Input>` 仅 10 个 `<label>`;多个图标按钮缺 aria-label | frontend components/ |
| L10 | CSP `styleSrc 'unsafe-inline'` | backend middleware/security.ts:19 |

---

## 代码质量(逐层)

### Backend
- **类型安全**: 生产代码 18 处 `as unknown as`(多为 Prisma JSON 字段转换和 Express req/res monkey-patch),**0 个 `as any`、0 个 `@ts-ignore`** —— 这是全代码库最强的维度
- **错误处理**: `errorHandler.ts` 集中处理 ZodError/Prisma/JWT/自定义 ApiError 层级,有 `asyncHandler` 包装,只在 server.ts:177 注册一次
- **数据采集**: 19 个源实现统一 `Scraper` 接口,`scraperManager.ts` registry 模式,`helpers.ts` 提供 `ensureCommodity/upsertPrice/upsertPrice` —— **正例,可作为其他层重构的样板**
- **背景任务**: 3 档 cron(30s/hourly/6h/daily)+ BullMQ 预测队列 + Socket.IO 房间(含私有房间归属校验,上限 20 订阅)

### Frontend
- **类型安全**: 43 处 escape hatch,其中 13/16 个 `as any` 在测试里;仅 `lib/auth.ts:49` 一处生产 `as any`
- **设计系统遵循**: 字体(仅 1 处 `font-black` 装饰用违规)、圆角、网格近乎完美;颜色 token 化是短板
- **组件规模**: 7 个组件 >300 行(`ProfessionalChart.tsx` 581、`AnomalyChart.tsx` 551、`ResponsiveNav.tsx` 524 且已死)

---

## 推荐优先级修复路径

1. **立即**: C1 (seed 凭据) — 安全红线
2. **本周**: H1 (接线 authLockout) + H2 (全局限流) + M3 (metrics 鉴权) — 安全加固
3. **下周**: H3 + M1 (路由抽服务层) — 架构债,最大工作量
4. **持续**: M2 (合并 DESIGN.md) + M4 (统一前端数据层) + L1-L10

---

*本报告由 autoplan pipeline 生成,所有 Critical/High 发现已人工二次验证。*
