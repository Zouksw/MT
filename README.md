<div align="center">

# MT

**大宗商品市场信息与分析平台**

AI 驱动的多模型价格预测 · 多因素市场分析 · 108 种大宗商品实时追踪

[![Tests](https://img.shields.io/badge/backend-~420%20tests%20(Vitest)-brightgreen)]()
[![Tests](https://img.shields.io/badge/frontend-305%20tests%20(Jest)-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)]()
[![Next.js](https://img.shields.io/badge/Next.js-15-black)]()
[![License](https://img.shields.io/badge/license-Apache%202.0-gray)]()

</div>

---

## MT 是什么

MT 是一个**信息和分析平台**，为分析师、交易员和决策者提供大宗商品市场的深度洞察。

> **不是交易平台。** 不涉及下单、账户余额或实际支付。
> 核心价值：数据展示 + 多因素分析 + AI 自动预测。

### 一句话概括

> 8 个 AI 模型并行预测大宗商品价格走势，结合天气、汇率、运费、关税等多维因素，给出买入/卖出/持有信号。

---

## 核心功能

### AI 信号引擎

8 个独立预测模型并行运行，自动计算共识信号：

| 模型 | 方法 | 用途 |
|------|------|------|
| ARIMA | 自回归移动平均 | 短期趋势 |
| Holt-Winters | 三次指数平滑 | 季节性周期 |
| Exp. Smoothing | 二次指数平滑 | 平滑趋势 |
| STL | 季节分解 | 周期分离 |
| Naive | 朴素基线 | 对比基准 |
| Timer-XL | 时序 Transformer | 复杂模式 |
| Sundial | 大模型推理 | 长周期预测 |
| Chronos | 预训练时序模型 | 零样本预测 |

每个模型独立产出信号，引擎汇总后输出 MAPE 精度、置信区间和趋势判断。

### 多因素分析

市场不只是价格。MT 追踪影响价格的底层因素：

- **供需** — 库存、产量、消费量
- **经济** — 利率、通胀、GDP
- **天气** — 降雨、温度、干旱指数
- **汇率** — 主要货币对
- **运费** — 波罗的海干散货指数
- **关税** — 贸易政策变动

### 数据覆盖

- **108 种大宗商品** — 谷物、能源、金属、软商品、外汇、牛肉等 13 个品类
- **18 个数据源** — ABARES、USDA、FAO、世界银行、FRED、CME、DCE 等
- **34,960 条牛肉切割价格** — 工厂级别、按切割部位
- **131 个市场因子** — 实时关联分析

---

## 技术架构

```
MT
├── frontend/          Next.js 15 + React 19 + Tailwind CSS
│   ├── app/           41 页面 (App Router)
│   └── components/    可复用组件库
├── backend/           Express + TypeScript + Prisma ORM
│   ├── routes/        22 API 路由模块
│   ├── services/      45 业务服务（含 18 个数据采集源）
│   └── middleware/     认证、限流、安全、日志
├── prisma/            数据库 Schema（36 个模型）
├── scripts/           运维脚本
├── deploy/            Docker + Helm 部署配置
└── docs/              完整文档
```

### 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 15, React 19, Tailwind CSS, Recharts, SWR |
| 后端 | Express, TypeScript 5.8, Prisma ORM |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| 实时 | Socket.IO (JWT 认证) |
| 测试 | Vitest (后端 ~420 tests), Jest (前端 305 tests) |
| 安全 | JWT, bcrypt, CSRF, Helmet, rate limiting |

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
| Dashboard | `/dashboard` | 数据概览、AI 模型状态、图表 |
| Market Intelligence | `/trading` | 价格图表、AI 信号、因素面板 |
| AI Models | `/ai/models` | 7 模型对比、MAPE、趋势分析 |
| Prediction Accuracy | `/ai/accuracy` | 精度仪表盘、模型排行 |
| Backtest Reports | `/ai/backtest` | 历史回测、窗口分析 |
| Beef Data | `/beef` | 牛肉切割数据、工厂目录 |
| Watchlists | `/trading/watchlist` | 自选商品追踪 |
| Analysis Groups | `/trading/portfolio` | 品种分组对比 |
| Pricing | `/pricing` | AI 功能分档定价 |

---

## API 示例

```bash
# 登录
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trademind.com","password":"<your-seed-password>"}'

# 获取 AI 信号
curl http://localhost:8000/api/signals/wheat \
  -H "Authorization: Bearer <token>"

# 模型精度
curl http://localhost:8000/api/signals/models/accuracy \
  -H "Authorization: Bearer <token>"

# 商品相关性
curl "http://localhost:8000/api/signals/correlation?a=wheat&a2=corn" \
  -H "Authorization: Bearer <token>"

# 牛肉切割价格
curl http://localhost:8000/api/beef/cuts \
  -H "Authorization: Bearer <token>"
```

---

## 测试

```bash
# 后端 (Vitest)
cd backend && pnpm test              # ~420 tests

# 前端 (Jest)
cd frontend && pnpm test             # 305 tests

# 类型检查
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

所有测试均为**真实集成测试** — 连接真实 PostgreSQL 和 Redis，不使用 mock。

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
│   │   ├── dataIngestion/       # 18 个数据采集源
│   │   └── ...
│   └── middleware/          # 认证、安全、限流
├── prisma/
│   └── schema.prisma        # 36 个数据模型
└── vitest.config.ts

frontend/
├── src/
│   ├── app/                 # 41 个页面（App Router）
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

| 来源 | 数据类型 | 覆盖 |
|------|----------|------|
| ABARES | 农产品价格 | 澳大利亚 |
| USDA AMS | 农产品价格 | 美国 |
| USDA PSD | 供需平衡 | 全球 |
| USDA FAS | 农产品贸易 | 全球 |
| FAO | 食品价格指数 | 全球 |
| World Bank | 大宗商品价格 | 全球 |
| FRED | 经济指标 | 美国 |
| CME Futures | 期货价格 | 全球 |
| DCE Futures | 期货价格 | 中国 |
| China Customs | 进出口 | 中国 |
| China Wholesale | 批发价格 | 中国 |
| CEPEA | 农产品价格 | 巴西 |
| INAC | 肉类价格 | 乌拉圭 |
| MLA NLRS | 畜牧价格 | 澳大利亚 |
| Baltic Dry | 运费指数 | 全球 |
| Commodity Prices | 综合价格 | 全球 |
| Weather Data | 气象数据 | 全球 |
| Manual Import | 手动导入 | 自定义 |

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
