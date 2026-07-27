<div align="center">

# MT

**牛肉贸易价格数据与分析平台**

进口/国产牛肉价格采集 · 行情展示 · 多维分析 · AI 模型价格预测

[![Backend Tests](https://img.shields.io/badge/backend-Vitest-brightgreen)]()
[![Frontend Tests](https://img.shields.io/badge/frontend-Jest-brightgreen)]()
[![Inference Tests](https://img.shields.io/badge/inference-pytest-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-gray)]()

</div>

---

## MT 是什么

MT 是一个**牛肉贸易价格数据与分析平台**，为进口商、贸易商和分析师提供牛肉切割部位价格、市场动态和 AI 价格预测。

> **对标** [牧集网](https://web.mooket.com/)（数据+资讯+展示）× IoTDB AINode（预训练模型预测）。
> **不做交易撮合** — 只做数据采集、行情展示、多维分析和 AI 预测。

### 一句话概括

> 85+ 牛肉切割部位价格，跨 5 个进口来源国（US/BR/AUS/URY/ARG），AI 模型预测 7 天价格走势，市场资讯每日更新。

---

## 核心功能

### AI 价格预测（融入行情）

基于 IoTDB AINode 架构的预训练模型，在行情页面直接展示 7 天价格预测：

| 模型 | 方法 | 用途 |
|------|------|------|
| ARIMA | 自回归移动平均 (ARIMA(2,1,1)) | 短期趋势 |
| SARIMAX | 带外生变量的季节 ARIMA | 多因素短期 |
| Holt-Winters | 三次指数平滑 | 季节性周期 |
| Exp. Smoothing | 二次指数平滑 | 平滑趋势 |
| STL | 季节分解 + 阻尼外推 | 周期分离 |
| Naive | 朴素基线 | 对比基准 |
| Chronos (×3 变体) | 预训练时序基座 (tiny/mini/base) | 基座预测 |

> 6 个统计模型 + 3 个 Chronos 变体 = 9 个 model id（实现在 `inference-service`）。

每个模型独立预测，输出预测值、95% 置信区间和 MAPE 精度。预测结果**直接编织进行情行**（MarketForecastBoard），而非藏在子页面。

### 资讯模块

类牧集的市场动态 feed，覆盖价格异动、供应产能、贸易政策、市场分析、企业动态，每条资讯关联相关牛肉部位。

### 数据覆盖

- **85+ 牛肉切割部位** — 进口（US/BR/AUS/URY/ARG）+ 国产
- **21 个工厂** — 工厂级别价格溯源
- **2,400+ 牛肉切割价格** — 按部位 × 工厂 × 来源
- **19 个数据源** — USDA、CEPEA、MLA、INAC、ABARES、World Bank、FRED、CME、DCE 等（实现在 `backend/src/services/dataIngestion/sources/`）

---

## 技术架构

```
MT
├── frontend/          Next.js 15 + React 19 + Tailwind CSS
│   ├── app/           44 页面 (App Router)
│   └── components/    可复用组件库
├── backend/           Express + TypeScript + Prisma ORM
│   ├── routes/        20 API 路由模块
│   ├── services/      业务服务（含 dataIngestion/sources/ 19 个数据采集源）
│   └── middleware/     认证、限流、安全、日志
├── inference-service/ Python FastAPI 推理服务（6 统计模型 + 3 Chronos 变体）
├── prisma/            数据库 Schema（31 个模型）
├── scripts/           运维脚本
├── deploy/            Docker + Helm 部署配置
└── docs/              文档
```

### 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15, React 19, Tailwind CSS, Recharts, SWR, TypeScript 5.8, Jest |
| 后端 | Express, TypeScript 5.4, Prisma ORM, Vitest |
| 推理 | Python 3.10, FastAPI, statsmodels, sktime, chronos-forecasting, torch (CPU), pytest |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| 进程管理 | PM2 |
| 安全 | JWT, bcrypt, CSRF, Helmet, rate limiting |

> 上述规模数字（44 页面 / 20 路由 / 19 源 / 31 模型 / 9 model id）为 2026-07-27 实测，计数方式见 [AGENTS.md](AGENTS.md) §三。测试总数随时间变化，运行 `pnpm test` 获取当前值。

---

## 快速开始

### 前置条件

- Node.js >= 20
- pnpm 9+
- PostgreSQL 15
- Redis 7

### 安装

> **注意**:本项目不是 pnpm workspace,需分别在 `backend/` 和 `frontend/` 安装依赖。

```bash
git clone https://github.com/Zouksw/MT.git
cd MT

# 1. 安装依赖(根目录 + 两个子项目)
pnpm install
cd backend && pnpm install && cd ..
cd frontend && pnpm install && cd ..

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env —— 必须设置:
#   JWT_SECRET      (openssl rand -base64 48)
#   SESSION_SECRET  (openssl rand -base64 48)
#   DATABASE_URL    (如需改用户/密码/库名)

# 3. 创建数据库(首次需要)
sudo -u postgres createuser mt_user --createdb
sudo -u postgres psql -c "ALTER USER mt_user WITH PASSWORD 'mt_password';"
sudo -u postgres createdb mt_db -O mt_user

# 4. 运行迁移 + 种子数据(创建测试用户和示例数据)
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..

# 5. 启动开发服务器
pnpm restart
```

服务启动后：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/api-docs |

种子数据创建的测试账号:

| 邮箱 | 密码 | 角色 |
|------|------|------|
| admin@trademind.com | (见 SEED_ADMIN_PASSWORD 或 dev fallback) | ADMIN |
| user@trademind.com | (见 SEED_USER_PASSWORD 或 dev fallback) | EDITOR |
| demo@trademind.com | (见 SEED_DEMO_PASSWORD 或 dev fallback) | VIEWER |

> 生产环境必须通过 `SEED_*_PASSWORD` 环境变量提供密码,seed 脚本会拒绝在 production 下使用默认密码。

### Docker 启动

```bash
# 启动 PostgreSQL + Redis
docker compose up -d postgres redis

# 然后按上面的步骤 4-5 初始化数据库并启动
```

---

## 页面一览

| 页面 | 路径 | 功能 |
|------|------|------|
| Dashboard | `/dashboard` | 牛肉均价 KPI hero、AI 预测、图表 |
| Beef Market | `/beef` | 牛肉行情 + AI 7天预测板（融入行情行） |
| Market News | `/market-news` | 资讯 feed（价格异动/政策/供应） |
| Price Trends | `/trading` | 价格图表、AI 信号、因素面板 |
| AI Models | `/ai/models` | 模型对比、MAPE、趋势分析 |
| Prediction Accuracy | `/ai/accuracy` | 精度仪表盘、模型排行 |
| Beef Cuts | `/beef/cuts/[code]` | 单部位详情、价格历史 |
| Pricing | `/pricing` | AI 功能分档定价 |

---

## API 示例

```bash
# 登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trademind.com","password":"<your-seed-password>"}'

# 获取 AI 信号
curl http://localhost:8000/api/signals/aus_cube_roll_m9 \
  -H "Authorization: Bearer <token>"

# 模型精度
curl http://localhost:8000/api/signals/models/accuracy \
  -H "Authorization: Bearer <token>"

# AI 7天价格预测
curl -X POST http://localhost:8000/api/inference/predict \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"commodityId":"aus_cube_roll_m9","horizon":7}'

# 牛肉切割价格
curl http://localhost:8000/api/beef/cuts \
  -H "Authorization: Bearer <token>"

# 资讯 feed
curl http://localhost:8000/api/news?pageSize=5 \
  -H "Authorization: Bearer <token>"
```

---

## 测试

```bash
# 后端 (Vitest)
cd backend && pnpm test

# 前端 (Jest)
cd frontend && pnpm test

# 推理服务 (pytest)
cd inference-service && source venv/bin/activate && pytest -q

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

测试总数随时间变化，运行上述命令获取当前值。后端测试为**真实集成测试** — 连接真实 PostgreSQL 和 Redis，不使用 mock。

---

## 项目结构

```
backend/
├── src/
│   ├── routes/              # API 路由
│   │   ├── auth.ts          # 认证（登录、注册、JWT）
│   │   ├── signals.ts       # AI 信号引擎
│   │   ├── marketData.ts    # 商品价格与因子
│   │   ├── beef.ts          # 牛肉数据
│   │   └── ...
│   ├── services/
│   │   ├── tradingSignals.ts    # 多模型信号聚合
│   │   ├── mapeTracking.ts      # 预测精度追踪
│   │   ├── backtesting.ts       # 历史回测
│   │   ├── correlationAnalysis.ts  # 相关性分析
│   │   ├── dataIngestion/sources/  # 19 个数据采集源
│   │   └── ...
│   └── middleware/          # 认证、安全、限流
├── prisma/
│   └── schema.prisma        # 31 个数据模型
└── vitest.config.ts

frontend/
├── src/
│   ├── app/                 # 44 个页面（App Router）
│   ├── components/
│   │   ├── trading/         # 交易面板、图表、信号
│   │   ├── charts/          # Recharts 可视化
│   │   ├── ui/              # 设计系统组件
│   │   └── layout/          # 响应式导航
│   ├── hooks/               # SWR 数据钩子
│   └── styles/              # 设计 token + CSS 模块
└── tailwind.config.ts
```

---

## 数据源

> 共 19 个数据源，实现于 `backend/src/services/dataIngestion/sources/`。下表按覆盖地域归类：

| 来源（文件） | 数据类型 | 覆盖 |
|------|----------|------|
| ABARES (`abaresData.ts`) | 农产品价格 | 澳大利亚 |
| MLA NLRS (`mlaNlrs.ts`) | 畜牧/部位价格 | 澳大利亚 |
| USDA AMS (`usdaAms.ts`) | 部位级价格 | 美国 |
| USDA PSD (`usdaPsd.ts`) | 供需平衡 | 全球 |
| CEPEA (`cepeaData.ts`) | 农产品价格 | 巴西 |
| Secex (`secexData.ts`) | 出口统计 | 巴西 |
| INAC (`inacData.ts`) | 肉类价格 | 乌拉圭 |
| FAO (`faoPrices.ts`) | 食品价格指数 | 全球 |
| World Bank (`worldBankPrices.ts`) | 大宗商品价格 | 全球 |
| FRED (`fredData.ts`) | 经济/能源指标 | 美国 |
| Commodity Prices (`commodityPrices.ts`) | 综合价格/外汇 | 全球 |
| CME Futures (`cmeFutures.ts`) | 期货价格 | 全球 |
| DCE Futures (`dceFutures.ts`) | 期货价格 | 中国 |
| China Customs (`chinaCustomsStats.ts`) | 进出口 | 中国 |
| China Wholesale (`chinaWholesale.ts`) | 批发价格 | 中国 |
| Baltic Dry (`balticDry.ts`) | 干散货运费指数 | 全球 |
| Shipping Index (`shippingIndex.ts`) | 集运指数 | 全球 |
| Weather Data (`weatherData.ts`) | 气象数据 | 全球 |
| Manual Import (`manualImport.ts`) | 手动导入 | 自定义 |

---

## 安全

- JWT + bcrypt 认证，HttpOnly cookie
- CSRF 双重提交保护
- Redis 限流（100 req/15min）
- Helmet 安全头
- 输入验证与消毒
- 完整审计日志
- AI 功能管理员权限控制

详见 [SECURITY.md](docs/SECURITY.md)

---

## 许可

Apache License 2.0
