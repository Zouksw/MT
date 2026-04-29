# Design System — MT Platform

## Product Context
- **What this is**: MT Platform — 基于 Apache IoTDB 2.0.5 + AI Node 的增强型时序数据库平台，提供完整的时序数据存储、查询和 AI 预测分析功能
- **Who it's for**: 工业物联网工程师、运维工程师、数据科学家、开发者
- **Space/industry**: IoT / Industrial Monitoring / Time-Series Database Infrastructure
- **Project type**: 完整的 SaaS 平台（营销网站 + Web 应用 + 仪表板）
- **Current tech**: Next.js 14 + React 19 + Ant Design 5 + Refine

## Aesthetic Direction
- **Direction**: Industrial Data + — Warm, approachable, technical but not cold
- **Decoration level**: Intentional（微妙但精心设计的视觉层次）
- **Mood**: 专业可靠、工业级精度、现代不冰冷、数据优先但易用
- **Reference sites**:
  - [Grafana](https://grafana.com) — 数据密集布局参考
  - [InfluxDB](https://www.influxdata.com) — 营销页面参考
  - [Linear](https://linear.app) — 现代应用交互参考

---

## Typography

### 字体加载策略
使用 Google Fonts（通过 Bunny Fonts 隐私友好 CDN）：

```html
<link rel="preconnect" href="https://fonts.bunny.net">
<link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
<link href="https://fonts.bunny.net/css?family=satoshi:700&family=dm+sans:400;500;600&family=geist+mono:wght@400;500;600&family=jetbrains+mono:wght@400;500&display=swap" rel="stylesheet"/>
```

### 字体角色

**Display/Hero**: **Satoshi** (Bold 700)
- **用途**: 页面标题、Hero 区域、营销文案、主要 CTA
- **Rationale**: 几何现代、醒目易记、在工业产品中脱颖而出
- **示例**: "Monitor Everything in Real-Time"

**Body**: **DM Sans** (Regular 400, Medium 500, SemiBold 600)
- **用途**: 正文、标签、导航、按钮文字、表单说明
- **Rationale**: 清晰易读、数据友好、开发者熟悉
- **示例**: "MT provides AI-powered time-series analytics"

**UI/Labels**: **DM Sans** (same as body)
- **用途**: 组件标签、按钮、导航项
- **说明**: 与 body 字体保持一致，确保视觉连贯

**Data/Tables**: **Geist Mono** (Regular 400, Medium 500, SemiBold 600)
- **用途**: 所有数据表格、时间序列值、指标、代码片段、日志
- **Rationale**: **关键选择** — 等宽数字确保列对齐，tabular-nums 特性优化数据可读性
- **示例**: `1,234.56 ms`, `98.7%`, `2026-03-25 14:32:01`
- **CSS**: `font-variant-numeric: tabular-nums;`

**Code**: **JetBrains Mono** (Regular 400, Medium 500)
- **用途**: API 文档代码示例、配置文件、终端命令
- **Rationale**: 开发者友好、语法高亮支持好、连字特性（ligatures）

### 字体比例尺（Type Scale）

| Level | Font Family | Weight | Size | Line-height | Usage |
|-------|-------------|--------|------|-------------|-------|
| Display | Satoshi | 700 | 48px / 3rem | 1.1 | Hero titles |
| H1 | Satoshi | 700 | 36px / 2.25rem | 1.2 | Page titles |
| H2 | DM Sans | 600 | 28px / 1.75rem | 1.3 | Section headers |
| H3 | DM Sans | 600 | 22px / 1.375rem | 1.4 | Card titles |
| H4 | DM Sans | 500 | 18px / 1.125rem | 1.5 | Subsection headers |
| Body Large | DM Sans | 400 | 16px / 1rem | 1.5 | Lead paragraphs |
| Body | DM Sans | 400 | 14px / 0.875rem | 1.5 | Body text |
| Body Small | DM Sans | 400 | 12px / 0.75rem | 1.5 | Metadata, captions |
| Data Large | Geist Mono | 600 | 18px / 1.125rem | 1.4 | Metric values |
| Data | Geist Mono | 500 | 14px / 0.875rem | 1.4 | Table data, logs |
| Data Small | Geist Mono | 400 | 12px / 0.75rem | 1.4 | Compact tables |
| Code | JetBrains Mono | 400 | 13px / 0.8125rem | 1.6 | Code blocks |

---

## Color

### 颜色方法
**Balanced**（平衡）— Primary accent + secondary accent + semantic colors + full neutral range

### 主色调（Primary Colors）

**Primary: Amber** `#F59E0B`
- **RGB**: rgb(245, 158, 11)
- **HSL**: hsl(38, 92%, 50%)
- **用途**: 主按钮、链接、强调元素、品牌识别
- **语义**: 警示、注意、工业控制面板、温暖可接近
- **变体**:
  - Hover: `#D97706` ( darker 10%)
  - Active: `#B45309` ( darker 20%)
  - Light: `#FEF3C7` ( light 90%, for backgrounds)

**Secondary: Slate Blue** `#475569`
- **RGB**: rgb(71, 85, 105)
- **用途**: 次要按钮、非强调链接、辅助信息
- **语义**: 技术可靠、桥接暖色调到冷中性色

### 中性色（Neutrals）

**Cool Grays** — 从浅到深：

```css
--gray-50:  #F8FAFC;  /* 背景色，亮色模式页面背景 */
--gray-100: #F1F5F9;  /* 卡片背景，hover 背景 */
--gray-200: #E2E8F0;  /* 边框、分割线 */
--gray-300: #CBD5E1;  /* 禁用状态边框 */
--gray-400: #94A3B8;  /* 占位符文字、次要图标 */
--gray-500: #64748B;  /* 次要文字 */
--gray-600: #475569;  /* 正文文字（亮色模式） */
--gray-700: #334155;  /* 强调文字 */
--gray-800: #1E293B;  /* 深色背景 */
--gray-900: #0F172A;  /* 主背景（暗色模式）、主文字 */
```

**语义**:
- Cool grays 比纯黑更柔和、更现代
- 与暖色 amber 形成良好对比
- 暗色模式默认使用 `#0F172A` 而非纯黑

### 语义色（Semantic Colors）

**Success**: `#10B981` (Emerald 500)
- RGB: rgb(16, 185, 129)
- 用途: 成功状态、在线状态、正常操作、积极趋势
- Light: `#D1FAE5` (背景)
- Dark: `#047857` (文字)

**Warning**: `#F59E0B` (Amber 500)
- **与 primary 共享**，保持一致性
- 用途: 警告状态、注意、待处理
- Light: `#FEF3C7` (背景)
- Dark: `#B45309` (文字)

**Error**: `#EF4444` (Red 500)
- RGB: rgb(239, 68, 68)
- 用途: 错误状态、离线、失败操作、消极趋势
- Light: `#FEE2E2` (背景)
- Dark: `#B91C1C` (文字)

**Info**: `#3B82F6` (Blue 500)
- RGB: rgb(59, 130, 246)
- 用途: 信息提示、链接（非 primary）、新功能
- Light: `#DBEAFE` (背景)
- Dark: `#1D4ED8` (文字)

### 暗色模式策略（Dark Mode）

**原则**: Redesign surfaces, reduce saturation 10-20%

```css
/* 暗色模式背景 */
--dark-bg-primary:   #0F172A;  /* 主背景 */
--dark-bg-secondary: #1E293B;  /* 卡片、二级背景 */
--dark-bg-tertiary:  #334155;  /* 悬浮、输入框 */

/* 暗色模式文字 */
--dark-text-primary:   #F1F5F9;  /* 主文字 */
--dark-text-secondary: #94A3B8;  /* 次要文字 */
--dark-text-tertiary:  #64748B;  /* 占位符 */

/* 暗色模式语义色 - 饱和度降低 10-15% */
--dark-success: #34D399;  /* 更亮 */
--dark-warning:  #FBBF24;  /* 更亮 */
--dark-error:    #F87171;  /* 更亮 */
--dark-info:     #60A5FA;  /* 更亮 */
```

**切换方式**:
- 使用 CSS 自定义属性 + 类名切换
- Tailwind: `dark:` 前缀
- 组件级: `ThemeProvider` 上下文

---

## Spacing

### 基础单位（Base Unit）
**4px** — 所有间距都是 4 的倍数

### 密度（Density）
**Comfortable-Dense** — 比消费者应用紧凑，比纯企业工具宽松

### 间距比例尺

| Token | Value | Usage |
|-------|-------|-------|
| `spacing-2xs` | 4px | 紧凑图标间距、徽章内边距 |
| `spacing-xs` | 8px | 小元素间距、标签内边距 |
| `spacing-sm` | 12px | 相关元素组内间距 |
| `spacing-md` | 16px | 标准间距、卡片内边距 |
| `spacing-lg` | 24px | 区块间距、section 间距 |
| `spacing-xl` | 32px | 大区块间距、页面级间距 |
| `spacing-2xl` | 48px | Hero 区域、主要 section 间距 |
| `spacing-3xl` | 64px | 页面顶级间距 |

### 应用原则

**营销页面**:
- Section 间距: `spacing-2xl` (48px) 或 `spacing-3xl` (64px)
- 元素间距: `spacing-md` (16px)

**应用/仪表板**:
- 卡片内边距: `spacing-md` (16px)
- 卡片间距: `spacing-md` (16px) 或 `spacing-lg` (24px)
- 紧凑数据表格: `spacing-sm` (12px) 或 `spacing-xs` (8px)

**表单**:
- 输入框内边距: `spacing-xs` (8px) 垂直，`spacing-sm` (12px) 水平
- 表单字段间距: `spacing-md` (16px)

---

## Layout

### 布局方法（Layout Approach）
**Hybrid** — Grid-disciplined for app, creative-editorial for marketing

### 网格系统（Grid）

**12-column grid system**:

```css
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 spacing-md;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: spacing-md;
}

/* 响应式断点 */
.col-span-12 { grid-column: span 12; }  /* Mobile */
.col-span-6  { grid-column: span 6; }   /* Tablet: 2 columns */
.col-span-4  { grid-column: span 4; }   /* Desktop: 3 columns */
.col-span-3  { grid-column: span 3; }   /* Desktop: 4 columns */
```

### 断点（Breakpoints）

```css
--breakpoint-sm:  640px;   /* Mobile landscape */
--breakpoint-md:  768px;   /* Tablet */
--breakpoint-lg:  1024px;  /* Desktop */
--breakpoint-xl:  1280px;  /* Wide desktop */
--breakpoint-2xl: 1536px;  /* Extra wide */
```

### 最大内容宽度（Max Content Width）

| Page Type | Max Width | Rationale |
|-----------|-----------|-----------|
| Marketing landing | 1280px | 标准 marketing 宽度 |
| Dashboard/app | 1440px | 数据密集型，需要更多空间 |
| Documentation | 960px | 最佳阅读宽度 |
| Settings pages | 800px | 表单和配置，不需要过宽 |

### 圆角（Border Radius）

分层圆角系统：

```css
--radius-sm:   4px;   /* 小元素：按钮、徽章、输入框 */
--radius-md:   8px;   /* 卡片、面板、下拉菜单 */
--radius-lg:   12px;  /* 大卡片、模态框 */
--radius-xl:   16px;  /* Hero 区域、特殊容器 */
--radius-full: 9999px; /* 圆形按钮、头像、标签 */
```

### 页面类型布局

**1. 营销页面（Marketing Pages）**
- Hero: 全宽，居中内容，72px 垂直间距
- Features: 3 列网格，48px section 间距
- CTA sections: 全宽背景，居中容器
- Footer: 4 列网格（品牌、产品、资源、公司）

**2. 仪表板（Dashboard）**
- 侧边栏: 240px 宽，固定
- 顶部栏: 64px 高，固定
- 主内容: 剩余空间，内边距 24px
- 卡片网格: 响应式，自动换行

**3. 数据表格页面**
- 表格容器: 全宽，水平滚动
- 列宽: 比例分配，关键列更宽
- 行高: 48px（紧凑）或 56px（标准）
- 分页: 底部右对齐

**4. 表单页面**
- 表单容器: 最大 600px 宽，居中
- 字段间距: 24px
- 输入框高度: 40px
- 提交按钮: 44px 高

---

## Motion

### 动效方法（Motion Approach）
**Intentional** — 有意义的过渡和微交互，不过度装饰

### 缓动函数（Easing）

```css
--ease-enter:  cubic-bezier(0, 0, 0.2, 1);   /* ease-out */
--ease-exit:   cubic-bezier(0.4, 0, 1, 1);   /* ease-in */
--ease-move:   cubic-bezier(0.4, 0, 0.2, 1); /* ease-in-out */
```

### 持续时间（Duration）

| Level | Duration | Usage |
|-------|----------|-------|
| Micro | 50-100ms | Tooltip 显示、微小状态变化 |
| Short | 150-250ms | 按钮 hover、下拉菜单展开、toggle 切换 |
| Medium | 250-400ms | 模态框进入/退出、页面过渡 |
| Long | 400-700ms | 复杂动画、Hero 元素进入 |

### 动效示例

**按钮 Hover**:
```css
transition: background-color 150ms var(--ease-move),
            transform 100ms var(--ease-enter);
```

**模态框进入**:
```css
animation: modal-in 300ms var(--ease-enter);

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

**数据加载骨架屏**:
```css
animation: skeleton-pulse 1.5s ease-in-out infinite;

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

**页面过渡**:
```css
.page-transition {
  transition: opacity 250ms var(--ease-enter),
              transform 250ms var(--ease-enter);
}
```

### 微交互（Micro-interactions）

1. **按钮点击**: 轻微缩小（scale 0.98）
2. **链接 hover**: 下划线从左到右展开
3. **卡片 hover**: 轻微上浮（translateY -4px）+ 阴影增强
4. **输入框 focus**: 边框颜色过渡 + 外发光
5. **表格行 hover**: 背景色过渡
6. **开关切换**: 滑块动画 + 颜色渐变

---

## Components

### 按钮（Buttons）

**Primary Button**:
```css
background: #F59E0B;
color: white;
padding: 10px 20px;
border-radius: var(--radius-sm);
font-weight: 600;
transition: all 150ms var(--ease-move);

&:hover {
  background: #D97706;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

&:active {
  transform: translateY(0) scale(0.98);
}
```

**Secondary Button**:
```css
background: #475569;
color: white;
/* 相同的 hover/active 状态 */
```

**Ghost Button**:
```css
background: transparent;
color: #F59E0B;
border: 1px solid #F59E0B;

&:hover {
  background: rgba(245, 158, 11, 0.1);
}
```

### 卡片（Cards）

```css
.card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  transition: all 200ms var(--ease-move);

  /* 微妙装饰 - 暂时不添加 grain，保持性能 */
}

.card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
```

### 输入框（Inputs）

```css
.input {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-family: DM Sans, sans-serif;
  font-size: 14px;
  transition: all 150ms var(--ease-move);
}

.input:focus {
  outline: none;
  border-color: #F59E0B;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}
```

### 数据表格（Data Tables）

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  background: var(--gray-50);
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
  border-bottom: 2px solid var(--gray-200);
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--gray-100);
  font-family: Geist Mono, monospace; /* 关键：数据字体 */
  font-size: 14px;
  color: var(--gray-600);
}

.table tr:hover {
  background: var(--gray-50);
}
```

### 徽章（Badges）

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  background: #D1FAE5;
  color: #047857;
}

.badge-warning {
  background: #FEF3C7;
  color: #B45309;
}

.badge-error {
  background: #FEE2E2;
  color: #B91C1C;
}

.badge-info {
  background: #DBEAFE;
  color: #1D4ED8;
}
```

---

## Page Templates

### 1. 营销落地页（Marketing Landing）

**Hero Section**:
```
┌─────────────────────────────────────────────────┐
│  [Logo]  Products  Pricing  Docs    [CTA]      │
├─────────────────────────────────────────────────┤
│                                                  │
│        [H1: Monitor Everything]                 │
│        [Subtitle: Real-time analytics]           │
│        [Primary CTA] [Secondary CTA]             │
│                                                  │
│        [Hero Image/Dashboard Preview]            │
│                                                  │
├─────────────────────────────────────────────────┤
│  [Feature Grid: 3 columns]                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Icon    │ │ Icon    │ │ Icon    │           │
│  │ Title   │ │ Title   │ │ Title   │           │
│  │ Desc    │ │ Desc    │ │ Desc    │           │
│  └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────┤
│  [Social Proof: Trusted by...]                   │
├─────────────────────────────────────────────────┤
│  [CTA Section: Get Started]                      │
└─────────────────────────────────────────────────┘
```

### 2. 仪表板页面（Dashboard）

```
┌────┬──────────────────────────────────────────┐
│    │ [Logo] [Search]     [User ▾] [Theme]     │
├────┴──────────────────────────────────────────┤
│ Nav│                                          │
│    │  [Stat Cards: 4 columns]                │
│ ├─  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ •  │ │Data  │ │Times │ │Forec │ │Alert │  │
 │Datas│ │sets  │ │eries │ │asts  │ │s     │  │
 │    │ └──────┘ └──────┘ └──────┘ └──────┘  │
 ├─  │                                          │
 │Time│  [Chart Section: 60% width]  [Alerts]│
 │Seri│  ┌──────────────────────┐ ┌────────┐│
 │    │  │ [Time Series Chart]  │ │Dist    ││
 │    │  │                      │ │Chart   ││
 │    │  │                      │ └────────┘│
 ├─  │  └──────────────────────┘           │
 │Fore│                                          │
 │cast│  [Recent Activity: Table]              │
 │    │  ┌────────────────────────────────┐  │
 │    │  │ Device │ Metric    │ Value     │  │
 │AI   │  │────────┼───────────┼──────────│  │
 │    │  │ dev-1  │ temp      │ 23.5°C    │  │
 ├─  │  │ dev-2  │ humidity  │ 45%       │  │
 │Model│  └────────────────────────────────┘  │
 │    │                                          │
 └────┴──────────────────────────────────────────┘
```

### 3. 数据表格页面（Data Table）

```
┌─────────────────────────────────────────────────┐
│  [← Back]  Time Series  [Search] [Filter] [Add]│
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─┬──────────────┬──────────┬───────┬───────┐│
│  ││ Name         │ Created   │Points │Status ││
│  ├─┼──────────────┼──────────┼───────┼───────┤│
│  ││ root.sg.dev1 │ 03-25    │ 1.2M  │ ✓    ││
│  ││ root.sg.dev2 │ 03-24    │ 856K  │ ✓    ││
│  ││ root.sg.dev3 │ 03-23    │ 2.3M  │ ✗    ││
│  ││ ...          │ ...      │ ...   │ ...   ││
│  └─┴──────────────┴──────────┴───────┴───────┘│
│                                                 │
│  [Previous]  Page 1 of 10  [Next]              │
└─────────────────────────────────────────────────┘
```

### 4. 表单页面（Form）

```
┌─────────────────────────────────────────┐
│  [← Back]  Create Time Series           │
├─────────────────────────────────────────┤
│                                         │
│  Name                                   │
│  ┌─────────────────────────────────┐   │
│  │ root.sg.device1.temperature     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Data Type  [*]                         │
│  ┌─────────────────────────────────┐   │
│  │ FLOAT (Double Precision)    ▼   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Encoding                               │
│  ○ GORILLA  ● PLAIN  ○ RLE  ○ TS_2DIFF │
│                                         │
│  Tags                                   │
│  ┌─────────────────────────────────┐   │
│  │ device_1  temperature  sensor_A │   │
│  │ [+ Add Tag]                     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Cancel]  [Create Time Series]         │
└─────────────────────────────────────────┘
```

### 5. 告警和通知页面（Alerts）

```
┌─────────────────────────────────────────────────┐
│  [← Back]  Alerts  [All ▾] [Date Range]         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL  CPU Usage > 90%              │  │
│  │    server-prod-01 • 2 minutes ago         │  │
│  │    [View] [Acknowledge] [Dismiss]         │  │
│  ├───────────────────────────────────────────┤  │
│  │ 🟡 WARNING  Memory Usage > 80%            │  │
│  │    server-prod-02 • 15 minutes ago        │  │
│  │    [View] [Acknowledge] [Dismiss]         │  │
│  ├───────────────────────────────────────────┤  │
│  │ ✅ RESOLVED  Disk Space Low               │  │
│  │    server-prod-03 • 1 hour ago            │  │
│  │    [View] [Dismiss]                       │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Load More]                                   │
└─────────────────────────────────────────────────┘
```

---

## Iconography

### Icon 库
使用 **Lucide React**（与 Refine/Ant Design 集成良好）

### 图标样式
- **尺寸**: 16px, 20px, 24px
- **粗细**: stroke-width="2"（默认）
- **颜色**: 继承文字颜色，或使用语义色

### 常用图标

| 概念 | 图标 | 用途 |
|------|------|------|
| Dashboard | `layout-dashboard` | 仪表板导航 |
| Time Series | `line-chart` | 时间序列 |
| Forecasts | `trending-up` | 预测 |
| Alerts | `bell` | 告警 |
| Settings | `settings` | 设置 |
| Database | `database` | 数据集 |
| Devices | `server` | 设备 |
| User | `user` | 用户 |
| Search | `search` | 搜索 |
| Filter | `filter` | 筛选 |
| Add | `plus` | 添加 |
| Delete | `trash-2` | 删除 |
| Edit | `pencil` | 编辑 |
| Export | `download` | 导出 |
| Import | `upload` | 导入 |
| Refresh | `refresh-cw` | 刷新 |
| Warning | `alert-triangle` | 警告 |
| Error | `alert-circle` | 错误 |
| Success | `check-circle` | 成功 |
| Info | `info` | 信息 |

---

## Illustration

### 插图风格
**Minimal geometric** — 简洁几何图形，与品牌色调一致

### 用途
- Empty states（空状态）
- Onboarding（引导流程）
- Error pages（错误页面）
- Marketing sections（营销区块）

### 规格
- **格式**: SVG（可缩放）
- **颜色**: Amber + Gray 调色板
- **风格**: 扁平，无渐变，微妙阴影

---

## Accessibility

### 对比度（Contrast）
- **最小对比度**: WCAG AA (4.5:1 for normal text)
- **推荐对比度**: WCAG AAA (7:1 for body text)

### 键盘导航
- **Focus visible**: 清晰的 focus ring（3px amber outline）
- **Tab order**: 逻辑顺序
- **Skip links**: 跳转到主内容

### 屏幕阅读器
- **ARIA labels**: 所有交互元素
- **Semantic HTML**: 正确的 HTML 语义
- **Live regions**: 动态更新通知

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | Initial design system created | Created by /design-consultation based on MT product context and competitive research (Grafana, InfluxDB) |
| 2026-03-25 | Amber primary color `#F59E0B` | Warm, industrial feel — distinctive in sea of blue/purple IoT tools. Evokes control panels and warning lights familiar to industrial users. |
| 2026-03-25 | Geist Mono for data | Tabular nums ensure column alignment in tables. Critical for time-series values and metrics. |
| 2026-03-25 | Comfortable-dense spacing | Balances efficiency (power users see more) with readability (not overwhelming) |
| 2026-03-25 | Dark mode default | 80% of monitoring tools use dark themes — matches user expectations |
| 2026-03-25 | Grid-disciplined layout | Predictable, professional, easier to implement and maintain |

---

## Implementation Guide

### Next.js 14 + Tailwind CSS 配置

**tailwind.config.ts**:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#F59E0B",
          hover: "#D97706",
          active: "#B45309",
          light: "#FEF3C7",
        },
        secondary: {
          DEFAULT: "#475569",
        },
        success: {
          DEFAULT: "#10B981",
          light: "#D1FAE5",
          dark: "#047857",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
          dark: "#B45309",
        },
        error: {
          DEFAULT: "#EF4444",
          light: "#FEE2E2",
          dark: "#B91C1C",
        },
        info: {
          DEFAULT: "#3B82F6",
          light: "#DBEAFE",
          dark: "#1D4ED8",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Satoshi", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
        code: ["JetBrains Mono", "monospace"],
      },
      spacing: {
        "2xs": "4px",
        "3xs": "8px",
      },
      borderRadius: {
        "sm": "4px",
        "md": "8px",
        "lg": "12px",
        "xl": "16px",
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 1.5s ease-in-out infinite",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
  darkMode: "class",
};

export default config;
```

### 全局样式（`globals.css`）

```css
@import "tailwindcss/base";
@import "tailwindcss/components";
@import "tailwindcss/utilities";

/* Google Fonts */
@import url("https://fonts.bunny.net/css?family=satoshi:700&family=dm+sans:400;500;600&family=geist+mono:wght@400;500;600&family=jetbrains+mono:wght@400;500&display=swap");

@layer base {
  :root {
    --color-primary: #F59E0B;
    --color-secondary: #475569;
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-error: #EF4444;
    --color-info: #3B82F6;
  }

  body {
    @apply font-sans text-gray-600 bg-white;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* 数据字体使用 Geist Mono */
  .data-text {
    @apply font-mono;
    font-variant-numeric: tabular-nums;
  }
}

@layer components {
  /* Primary Button */
  .btn-primary {
    @apply bg-primary text-white px-5 py-2.5 rounded-sm font-semibold
           transition-all duration-150 ease-in-out;
  }

  .btn-primary:hover {
    @apply bg-primary-hover;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  .btn-primary:active {
    transform: translateY(0) scale(0.98);
  }

  /* Card */
  .card {
    @apply bg-white border border-gray-200 rounded-md p-4
           transition-all duration-200 ease-in-out;
  }

  .card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  /* Input */
  .input {
    @apply bg-white border border-gray-200 rounded-sm
           py-2 px-3 text-sm
           transition-all duration-150 ease-in-out;
  }

  .input:focus {
    @apply outline-none border-primary;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
  }

  /* Table */
  .table-container {
    @apply w-full border-collapse;
  }

  .table th {
    @apply bg-gray-50 py-3 px-4 text-left
           font-semibold text-xs uppercase tracking-wider
           text-gray-500 border-b-2 border-gray-200;
  }

  .table td {
    @apply py-3 px-4 border-b border-gray-100
           font-mono text-sm text-gray-600;
    font-variant-numeric: tabular-nums;
  }

  .table tr:hover {
    @apply bg-gray-50;
  }
}
```

### 组件示例（`components/Button.tsx`）

```typescript
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) => {
  const baseClasses = "font-semibold rounded-sm transition-all duration-150 ease-in-out";

  const variantClasses = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "bg-secondary text-white hover:bg-opacity-90",
    ghost: "bg-transparent text-primary border border-primary hover:bg-primary-light",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

---

## Migration Strategy

### Phase 1: Foundation（1-2天）
1. 安装字体和配置 Tailwind
2. 创建全局样式和 CSS 变量
3. 构建基础组件（Button, Input, Card）
4. 设置暗色模式切换

### Phase 2: Page-by-Page（3-5天）
1. **Week 1**: 营销页面（首页、定价、关于）
2. **Week 2**: 应用页面（仪表板、数据表、设置）
3. **Week 3**: 表单和交互（登录、创建设备、配置）

### Phase 3: Polish（1-2天）
1. 动画和微交互
2. 响应式调整
3. 可访问性审计
4. 性能优化

### 向后兼容
- 保留 Ant Design 组件（渐进式替换）
- 新页面优先使用新设计系统
- 旧页面可继续使用现有 UI

---

## Resources

### Design Assets
- **Figma**: (待创建)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Fonts**: [Satoshi](https://satoshi.font.com/), [DM Sans](https://fonts.google.com/specimen/DM+Sans), [Geist Mono](https://vercel.com/font/geist), [JetBrains Mono](https://www.jetbrains.com/jetbrainsmono/)

### Documentation
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/) (无障碍组件)
- [Next.js 14](https://nextjs.org/docs)

### Inspiration
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/visualizations/dashboards/)
- [Linear App](https://linear.app) — 交互参考
- [Vercel Design System](https://vercel.com/design) — 现代设计系统参考

---

## Glossary

- **Comfortable-Dense**: 介于紧凑和宽松之间的密度，平衡效率和可读性
- **Grid-disciplined**: 严格遵循网格系统的布局方法
- **Intentional decoration**: 有意义的视觉装饰，不是过度装饰
- **Tabular nums**: 字体特性，确保数字等宽，用于对齐数据列
- **Hybrid layout**: 营销页面使用创意布局，应用页面使用网格布局

---

## Implementation Status

**Last Updated**: 2026-03-26

### Phase 1: Foundation ✅ COMPLETE
**Status**: 已完成 (2026-03-25)
**Commits**: `36c8b3a`, `c5cb942`

- ✅ 字体系统配置（Satoshi, DM Sans, Geist Mono, JetBrains Mono）
- ✅ Tailwind 设计令牌（颜色、间距、圆角、阴影、动画）
- ✅ 全局样式（CSS 变量、工具类）
- ✅ 基础组件（Button, Input, Card, Table）
- ✅ 暗色模式（ThemeToggle + ColorModeContext）
- ✅ 演示页面（DesignSystemDemo）

### Phase 2: Pages ✅ COMPLETE
**Status**: 已完成 (2026-03-26)
**Commits**: `3f9dc88`, `074b15e`, `3dda685`, `a33d171`, `d37d6b1`, `bcd184f`, `d3ae0f9`, `1ef266c`, `a26dae1`, `c0393af`, `efb4123`, `3515eb0`, `0e9369e`, `1125d38`, `bd7098f`, `d9fd355`, `ef46ea8`

**营销页面**:
- ✅ 首页 (`/`) — Hero + 功能 + 仪表板预览 + CTA
- ✅ 关于页面 (`/about`) — 使命 + 价值观 + 团队
- ✅ 定价页面 (`/pricing`) — 3 层定价 + FAQ

**应用页面**:
- ✅ 仪表板 (`/dashboard`) — 更新为设计系统
- ✅ Forecasts 列表 (`/forecasts`) — 按复杂度优先迁移完成
- ✅ Timeseries 列表 (`/timeseries`) — 按复杂度优先迁移完成
- ✅ Alerts 列表 (`/alerts`) — 按复杂度优先迁移完成（最复杂）
- ✅ AI Models (`/ai/models`) — 已迁移到设计系统
- ✅ AI Anomalies (`/ai/anomalies`) — 已迁移到设计系统
- ✅ Settings (`/settings`) — 已迁移到设计系统
- ✅ Auth Page (`/login`, `/register`) — 已迁移到设计系统
- ✅ StatCard 组件 — 应用设计令牌

**表单页面**:
- ✅ Timeseries Create (`/timeseries/create`) — 已迁移到设计系统
- ✅ Alerts Create (`/alerts/create`) — 已迁移到设计系统
- ✅ Forecasts Create (`/forecasts/create`) — 已迁移到设计系统（复杂表单）

**详情页面**:
- ✅ Forecasts Show (`/forecasts/show/[id]`) — 已迁移到设计系统
- ✅ Datasets Show (`/datasets/show/[id]`) — 已迁移到设计系统
- ✅ Alerts Show (`/alerts/show/[id]`) — 已迁移到设计系统
- ✅ Anomalies Show (`/anomalies/show/[id]`) — 已迁移到设计系统
- ✅ API Keys Show (`/apikeys/show/[id]`) — 已迁移到设计系统

### Phase 3: Polish ⏳ PENDING
**Status**: 待实施
**预计时间**: 1-2 天

- [ ] 动画和微交互优化
- [ ] 响应式调整（移动端导航、平板布局）
- [ ] 可访问性审计（键盘导航、屏幕阅读器、对比度）
- [ ] 性能优化（图片优化、代码分割、字体加载）

### Component Coverage

| Component | Design System Applied | Status |
|-----------|----------------------|--------|
| Button | ✅ Complete | ✅ Done |
| Input | ✅ Complete | ✅ Done |
| Card | ✅ Complete | ✅ Done |
| Table | ✅ Complete | ✅ Done |
| StatCard | ✅ Complete | ✅ Done |
| ThemeToggle | ✅ Complete | ✅ Done |
| ErrorDisplay | ⏳ Partial update needed | ⏳ TODO |
| LoadingState | ⏳ Partial update needed | ⏳ TODO |
| OnlineStatus | ⏳ Partial update needed | ⏳ TODO |

### Page Coverage

| Page | Design System Applied | Status |
|------|----------------------|--------|
| **Marketing Pages** | | |
| Homepage (`/`) | ✅ Complete | ✅ Done |
| About (`/about`) | ✅ Complete | ✅ Done |
| Pricing (`/pricing`) | ✅ Complete | ✅ Done |
| **App Pages** | | |
| Dashboard (`/dashboard`) | ✅ Complete | ✅ Done |
| Forecasts List (`/forecasts`) | ✅ Complete | ✅ Done |
| Timeseries List (`/timeseries`) | ✅ Complete | ✅ Done |
| Alerts List (`/alerts`) | ✅ Complete | ✅ Done |
| AI Models (`/ai/models`) | ✅ Complete | ✅ Done |
| AI Anomalies (`/ai/anomalies`) | ✅ Complete | ✅ Done |
| Settings (`/settings`) | ✅ Complete | ✅ Done |
| **Auth Pages** | | |
| Login (`/login`) | ✅ Complete | ✅ Done |
| Register (`/register`) | ✅ Complete | ✅ Done |
| **Form Pages** | | |
| Timeseries Create (`/timeseries/create`) | ✅ Complete | ✅ Done |
| Alerts Create (`/alerts/create`) | ✅ Complete | ✅ Done |
| Forecasts Create (`/forecasts/create`) | ✅ Complete | ✅ Done |
| **Detail Pages** | | |
| Forecasts Show (`/forecasts/show/[id]`) | ✅ Complete | ✅ Done |
| Datasets Show (`/datasets/show/[id]`) | ✅ Complete | ✅ Done |
| Alerts Show (`/alerts/show/[id]`) | ✅ Complete | ✅ Done |
| Anomalies Show (`/anomalies/show/[id]`) | ✅ Complete | ✅ Done |
| API Keys Show (`/apikeys/show/[id]`) | ✅ Complete | ✅ Done |

### Migration Progress

**Overall Progress**: 100% (17/17 core pages fully migrated) 🎉

**Completed**:
- ✅ 3 marketing pages (100%)
- ✅ 7 list/app pages (100%)
- ✅ 3 form pages (100%)
- ✅ 5 detail pages (100%)
- ✅ 2 auth pages (100%)
- ✅ Auth Page component (affects Login and Register)

**Remaining**:
- Edit pages (if they exist) - Lower priority
- Additional specialized pages (if needed)

---

*Last Updated: 2026-03-26*
*Maintained by: MT Team*
*Created by: /design-consultation skill*
