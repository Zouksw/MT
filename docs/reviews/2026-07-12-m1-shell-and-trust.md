# M1 — 可信的牛肉行情平台 (应用 Shell + 信任修复 + beef 统一)

**日期**: 2026-07-12
**里程碑**: M1 (PRODUCT-SPEC.md §8)
**状态**: ✅ 完成

---

## M1-1/2/3: 应用 Shell (侧栏 + 顶栏 + 移动抽屉)

### 问题
`components/header/index.tsx` 是**死代码** — 从未被任何页面渲染。50 路由 / 10 顶级区,用户进 dashboard 后只能靠 QuickActions (4 链接) 或手改 URL 导航。移动端零导航。

### 修复
**新组件** `components/layout/AppShell.tsx`:
- 桌面: 固定左侧栏 (w-60),5 个 IA 分组 (行情/分析/AI预测/数据/系统),active 项高亮
- 顶栏: 搜索占位 + 告警铃铛
- 移动: hamburger → 左滑抽屉 (w-72, max-80vw) + 遮罩,复用 landing 的模式
- 品牌标: "MT 牛肉行情" + 金色 logo 方块

**挂载方式** (零路由风险):
`PageContainer` (35 个认证页共用) 现在 `<AppShell>{children}</AppShell>` 包裹。
marketing/auth 页不用 PageContainer → 保持全屏,不获得 shell。
**不移动路由,不改 middleware** — 最小风险。

### 视觉验证 (Playwright,需 dev CORS)
- 桌面 dashboard: "persistent left sidebar... 5 sections (行情/分析/AI预测/数据/系统)... active item highlighted"
- 移动抽屉: "left slide-in drawer... full navigation structure... backdrop overlay"

### 测试修复
`alerts/__tests__/page.test.tsx` 的局部 `next/navigation` mock 缺 `usePathname` → 补上。

---

## M1-4: 信任修复

### N2a 删虚假 WebSocket 声明
landing 声称 "WebSocket — alerts arrive in under 50ms" (`FAQ.tsx:42`, `Features.tsx:51`),但前端**零 WebSocket 代码**。
**修复**: 改为 "refreshed every few minutes" (与实际轮询能力一致)。

### N2b 仪表盘假数据 → 诚实空态
`ForecastTrendChart` 默认显示硬编码 mock (Mon=12...Sun=28),dashboard 不传真实 data → 永远显示假数据。
**修复**: 删除 mockData/mockData30d/mockData90d;无 data 时显示 "暂无预测趋势数据" 空态。
(真实趋势 API 不存在,空态比假数据诚实。)

---

## M1-5: beef-only 统一

### 问题
产品故事自相矛盾: landing=beef-only (85cuts/6models), about/pricing=108 商品 (7models), GettingStarted 显示 Crude Oil/Gold。

### 修复 (统一为 beef 叙事: 85+ 部位 / 6 模型 / 5 来源国)
| 文件 | 改动 |
|------|------|
| `about/page.tsx:78-81` | 假统计 (487企业用户/47国/1.2B/天) → 真实牛肉数据 (85+部位/5来源国/6模型/7+数据源) |
| `about/page.tsx:138-141` | 假指标 (99.94%uptime/<1ms/10M+) → 真实 (85+部位/6模型/5国/24/7采集) |
| `about/page.tsx:351` | "108 commodities. 7 models. 131 factors" → "85+ 牛肉部位。6 个模型。5 个来源国。" |
| `pricing/page.tsx` | 6 处 "108 commodity/commodities" → "85+ beef cut prices" / "全部 85+ 牛肉部位" |
| `GettingStarted.tsx:11,18` | "108 commodities" → "85+ 牛肉部位" |
| `GettingStarted.tsx:22-24` | Crude Oil/Gold/Natural Gas → Chuck Roll(巴西)/Brisket(美国)/牛腩(国产) |

---

## 验证

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错误 |
| `next build` | exit 0 |
| jest | **272/272** (20 suites) |
| Playwright 桌面截图 | 侧栏 5 区 + 顶栏 + active 高亮 ✓ |
| Playwright 移动截图 | hamburger 抽屉 + 遮罩 ✓ |

---

## 文件变更 (8 文件)

**新增**: `components/layout/AppShell.tsx`
**修改**:
- `components/layout/PageContainer.tsx` — 挂载 AppShell
- `components/landing/FAQ.tsx` — 删 WebSocket 假声明
- `components/landing/Features.tsx` — 同上
- `components/dashboard/ForecastTrendChart.tsx` — 删 mock → 空态
- `app/(marketing)/about/page.tsx` — beef 统一 + 删假统计
- `app/(marketing)/pricing/page.tsx` — 108 → 85+ beef
- `components/landing/GettingStarted.tsx` — beef 示例
- `app/alerts/__tests__/page.test.tsx` — usePathname mock 补全

---

## M2 预告

下一步 (M2): AI 预测融入主流程 — 行情总览重构 (库存计数→实时牛肉价格看板) + 每个部位旁显示预测摘要 + 格式化器 + 颜色语义。
