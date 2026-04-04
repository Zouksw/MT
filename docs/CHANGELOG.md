---
title: "IoTDB Enhanced Platform Changelog"
en_title: "IoTDB Enhanced Platform Changelog"
version: "1.0.0"
last_updated: "2026-03-13"
status: "active"
maintainer: "IoTDB Enhanced Team"
reviewers:
  - "Release Manager"
  - "Project Maintainer"
tags:
  - "changelog"
  - "release-notes"
  - "version-history"
target_audience: "Developers, Users, Contributors"
related_docs:
  - "Roadmap": "ROADMAP.md"
  - "Deployment Guide": "docs/DEPLOYMENT.md"
  - "API Reference": "docs/API.md"
changes:
  - version: "1.0.0"
    date: "2026-03-10"
    author: "IoTDB Enhanced Team"
    changes: "Added YAML metadata header"
next_review: "2026-09-10"
approval:
  status: "approved"
  reviewed_by: "Release Manager"
  approved_date: "2026-03-10"
---

# Changelog

All notable changes to the IoTDB Enhanced Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Removed - Docker Dependency Removal

- **Deleted Docker files** - Removed all Docker configuration
  - `docker-compose.yml` - Replaced by native services (PostgreSQL, Redis) + PM2
  - `backend/Dockerfile` - Backend runs via PM2 directly
  - `frontend/Dockerfile` - Frontend runs via PM2 directly
  - `.docker/` directory - Docker buildx cache no longer needed
- **Updated CI/CD Pipeline** - Replaced Docker-based steps
  - Replaced Docker service containers with native PostgreSQL/Redis installation
  - Replaced Docker image build/push with native build + artifact upload
  - Replaced Docker pull deployment with PM2-based SSH deployment
- **Updated Health Check Script** - Replaced Docker container check with PM2 service check
- **Updated Backup Script** - Replaced `docker-compose.yml` backup with `ecosystem.config.cjs`

> **Why**: Server environment cannot access Docker registries. All services (PostgreSQL, Redis, backend, frontend) run natively via systemd + PM2.

---

## [1.3.0] - 2026-03-21

### Added - Phase 3.1: Observability & Monitoring

#### Prometheus Metrics
- **Metrics Endpoint** - `/metrics` endpoint for Prometheus scraping
  - Available in both production and development modes
  - Exposes system and application metrics
- **HTTP Metrics** - Request tracking with labels
  - Request counter (by method, route, status)
  - Response time histogram (by method, route)
  - Active requests gauge
- **Database Metrics** - PostgreSQL query tracking via Prisma middleware
  - Query counter (by operation, model)
  - Query duration histogram
  - 10% sampling to minimize performance impact
- **Cache Metrics** - Redis cache performance
  - Cache hit counter (by provider)
  - Cache miss counter (by provider)
- **IoTDB Metrics** - Time-series database operations
  - Query counter (by type: select, insert, error)
  - Query duration histogram
  - Data point counter (by series)
- **AI Metrics** - AI model operations
  - Prediction counter (by algorithm, type)
  - Prediction duration histogram
  - Anomaly detection counter
- **Alert Metrics** - Alert system monitoring
  - Alert triggered counter (by severity, type)
  - Alert resolved counter
- **Session Metrics** - Active user sessions
  - 1% sampling for efficiency
  - 15-minute active window tracking

#### Grafana Dashboards
- **Overview Dashboard** - Complete monitoring dashboard
  - Request rate and error rate panels
  - Response time distribution (P50, P95, P99)
  - Active user sessions gauge
  - Database query performance
  - Cache hit/miss ratio
  - IoTDB query metrics
  - AI prediction metrics
  - Alert status overview
- **Automatic Provisioning** - Zero-setup Grafana deployment
  - Datasource provisioning (Prometheus)
  - Dashboard provisioning (auto-import)
  - Configuration in `grafana/provisioning/`

#### AlertManager
- **Email Notifications** - Alert routing via email
  - SMTP configuration support
  - Alert grouping and deduplication
  - Configurable notification templates
- **Alert Rules** - Pre-configured Prometheus alert rules
  - High error rate alerts (>5% for 5 minutes)
  - Slow API response alerts (>1s for 5 minutes)
  - Database connection loss alerts
  - IoTDB connection failure alerts
  - AI model failure alerts
  - High memory usage alerts (>80% for 10 minutes)

#### Systemd Services (Docker-Free Deployment)
- **Service Units** - Complete systemd service configuration
  - `iotdb-postgres.service` - PostgreSQL database
  - `iotdb-redis.service` - Redis cache
  - `iotdb-backend.service` - Backend API (PM2)
  - `iotdb-frontend.service` - Frontend (PM2)
  - `prometheus.service` - Metrics collection
  - `alertmanager.service` - Alert routing
- **Management Scripts** - Easy service management
  - `scripts/systemd/start-all-services.sh` - Start all services in order
  - `scripts/systemd/stop-all-services.sh` - Stop in reverse order
  - `scripts/systemd/check-services.sh` - Status monitoring
- **Automatic Features**
  - Auto-start on boot
  - Auto-restart on failure
  - Centralized logging (journald)
  - Service dependency management
- **Log Rotation** - Automated log management
  - Daily rotation with 14-day retention
  - Compression enabled
  - PM2 reload on rotation
- **Backup Integration** - Cron-based automated backups
  - Daily PostgreSQL backups (2 AM)
  - Weekly full backups
  - Hourly Redis saves
  - Daily Redis backups

#### Documentation
- **Observability Design** - `docs/observability-design.md`
  - Complete system architecture
  - Component designs
  - Implementation phases (3.1-3.4)
  - 1044 lines of detailed planning
- **Systemd Services Guide** - `docs/systemd-services.md`
  - Service configuration reference
  - Management scripts documentation
  - Log management setup
  - Backup integration guide
  - Migration guide from Docker
- **Monitoring Deployment** - `docs/monitoring-deployment-no-docker.md`
  - Binary installation guide
  - Systemd service setup
  - Configuration management
  - Troubleshooting section

### Changed
- **server.ts** - Enable metrics endpoint in development mode
- **database.ts** - Add Prisma middleware for query metrics
- **auth.ts** - Add active session tracking (1% sampling)
- **cache.ts** - Add cache hit/miss metrics (10% sampling)
- **iotdb/client.ts** - Add query and datapoint metrics
- **routes/iotdb.ts** - Add AI prediction metrics
- **services/alert-rules.ts** - Add alert triggered metrics
- **services/alerts.ts** - Add alert resolved metrics

### Performance
- **Sampling Strategy** - 10% sampling for most metrics to minimize performance impact
- **Active Sessions** - 1% sampling for session counting
- **Prisma Middleware** - Efficient query instrumentation

---

## [1.2.0] - 2026-03-04

### Added - Phase 3: AI 功能启用与安全隔离

#### AI 功能
- **AI 预测分析** - 时序数据预测，支持多种算法
  - ARIMA (AutoRegressive Integrated Moving Average)
  - LSTM (timer_xl - Long Short-Term Memory)
  - Transformer (sundial)
  - Holt-Winters 三次指数平滑
  - 指数平滑 (exponential_smoothing)
  - 朴素预测 (naive_forecaster)
  - STL 分解预测 (stl_forecaster)
- **异常检测** - 智能时序数据异常识别
  - 支持多种检测方法 (isolation_forest, sr, pca)
  - 可配置阈值参数
- **批量预测** - 多时间序列批量预测接口
- **模型管理** - 模型列表、详情查看、训练接口
  - 列出可用模型及其参数
  - 查看模型详细信息
  - 模型训练接口

#### 安全隔离 (进程隔离替代 Docker)
- **进程隔离执行** - 使用 Linux 原生功能实现隔离
  - `prlimit` - 资源限制（内存、CPU、文件描述符、进程数）
  - `su ai-executor` - 低权限用户执行
  - 临时脚本文件（自动清理、只读权限）
- **AI 专用用户** - 创建 `ai-executor` 用户运行 AI 脚本
  - UID: 998
  - 无法访问其他用户文件
  - 无 shell 登录权限
- **资源限制**
  - 内存限制: 512M
  - CPU 时间限制: 60 秒
  - 文件描述符限制: 1024
  - 进程数限制: 64
  - 执行超时: 120 秒
- **环境隔离**
  - 清理敏感环境变量（DATABASE_URL、POSTGRES_PASSWORD 等）
  - 临时脚本目录: `/tmp/ai-scripts`
  - AI Node 虚拟环境: `/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/venv`

#### 多层安全防护
- **特性开关** - `AI_FEATURES_DISABLED` 环境变量控制
  - 默认值: `false` (已启用)
  - 可快速禁用所有 AI 功能
- **角色权限检查** - 仅管理员可访问
  - 中间件: `checkAIAccess`
  - 非 ADMIN 角色返回 403 Forbidden
- **IP 白名单** - 可选的 IP 访问限制
  - 环境变量: `AI_ACCESS_WHITELIST`
  - 支持多个 IP（逗号分隔）
  - 支持 CIDR 格式
- **审计日志** - 所有 AI 操作记录
  - 用户、时间戳、操作类型、参数
  - 存储位置: 后端日志
- **速率限制** - AI API 调用速率限制
  - 默认: 10 次/分钟
  - 基于 Redis 存储

#### 脚本优化整理
- **脚本精简** - 从 14 个减少到 11 个核心脚本
  - 删除冗余脚本: `status.sh`、`scripts/check-services.sh`、`frontend/start-dev.sh`
  - 保留核心脚本: 3 个根目录 + 8 个 scripts 目录
- **新增脚本**: `check.sh` - 快速状态检查
  - 替代 `status.sh` 功能
  - 彩色输出，简洁快速
- **脚本增强**:
  - `start.sh` - 超时保护、路径检测、服务降级
  - `stop.sh` - 目录检查、优雅关闭

#### 文档新增
- **RUNNING_MODES.md** - 运行模式完整指南
  - 开发模式 - 热重载、TypeScript 直接执行
  - 生产模式 - 集群模式、多核并行
  - 预发布模式 - 上线前验证
  - 性能对比表、切换指南、故障排查
- **SCRIPTS_GUIDE.md** - 脚本完整使用指南
  - 核心脚本详解
  - 维护脚本使用
  - PM2 命令参考
  - AI 功能测试
- **SCRIPTS_INDEX.md** - 脚本快速索引
  - 11 个脚本分类汇总
  - 使用场景说明
  - 依赖关系图
  - 快速参考表

### Changed
- **版本升级** - 1.1.0 → 1.2.0
- **AI 功能状态** - 从"默认禁用"改为"安全隔离启用"
- **脚本引用** - `./status.sh` → `./check.sh`
- **README.md** - 添加 Phase 3 内容和新文档链接
- **运行模式** - 支持通过 `APP_MODE` 环境变量切换

### Security Improvements
- **进程隔离** - 使用 `prlimit` + `su` 替代 Docker 实现隔离
- **权限控制** - AI 功能仅限管理员访问
- **资源保护** - 防止 AI 脚本耗尽系统资源
- **审计追踪** - 所有 AI 操作记录日志

### Modified Files
#### Backend
- `backend/src/services/iotdb/ai-isolated.ts` - **新建** 隔离 AI 服务
- `backend/src/middleware/aiAccess.ts` - **新建** AI 权限中间件
- `backend/src/routes/iotdb.ts` - 添加 AI 路由和认证中间件
- `backend/src/routes/models.ts` - 添加 AI 权限检查
- `backend/.env` - AI 配置环境变量

#### Scripts
- `start.sh` - 超时保护、路径检测、服务降级
- `stop.sh` - 目录检查、优雅关闭
- `check.sh` - **新建** 快速状态检查

#### Documentation
- `README.md` - 版本升级、Phase 3 内容、新文档链接
- `docs/RUNNING_MODES.md` - **新建** 运行模式详解
- `docs/SCRIPTS_GUIDE.md` - **新建** 脚本使用指南
- `docs/SCRIPTS_INDEX.md` - **新建** 脚本索引
- `CHANGELOG.md` - 添加本版本变更记录

### Deleted Files
- `status.sh` - 功能重复（已被 check.sh 替代）
- `scripts/check-services.sh` - 功能重复
- `frontend/start-dev.sh` - 已整合到 start.sh

### Upgrade Guide from 1.1.0 to 1.2.0

#### 1. 创建 AI 执行用户
```bash
# 创建专用低权限用户
sudo useradd -r -s /bin/false -d /var/lib/ai-executor ai-executor

# 创建临时脚本目录
sudo mkdir -p /tmp/ai-scripts
sudo chown $USER:$USER /tmp/ai-scripts
sudo chmod 700 /tmp/ai-scripts
```

#### 2. 安装必要工具
```bash
# 检查 prlimit 是否可用
which prlimit || sudo apt-get install util-linux
```

#### 3. 更新环境变量
编辑 `backend/.env`:
```bash
# 启用 AI 功能
AI_FEATURES_DISABLED=false
IOTDB_AI_ENABLED=true

# AI Node 配置
AI_NODE_HOME=/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
AI_NODE_HOST=127.0.0.1
AI_NODE_PORT=10810

# 资源限制
AI_MAX_MEMORY=512M
AI_MAX_CPU_TIME=60
AI_TIMEOUT=120

# 可选：IP 白名单
# AI_ACCESS_WHITELIST=127.0.0.1,10.0.0.0/8
```

#### 4. 更新脚本
```bash
# 删除旧脚本
rm -f status.sh scripts/check-services.sh frontend/start-dev.sh

# 使用新脚本
./check.sh  # 替代 ./status.sh
```

#### 5. 重启服务
```bash
./stop.sh
./start.sh
```

#### 6. 验证 AI 功能
```bash
# 检查 AI Node 是否运行
nc -z localhost 10810 && echo "AI Node OK"

# 测试预测 API（需要管理员权限）
curl -X POST http://localhost:8000/api/iotdb/ai/predict \
  -H "Content-Type: application/json" \
  -d '{"timeseries": "root.test1", "horizon": 5, "algorithm": "arima"}'
```

---

## [1.1.0] - 2026-03-04

### Added - Phase 1 (Infrastructure)
- **Testing Framework**
  - Jest test suite with 169 tests across 9 test suites
  - Test coverage reporting with Istanbul/nyc
  - Supertest for API endpoint testing
  - Faker.js for test data generation

- **Error Tracking**
  - Sentry integration for error tracking
  - Performance monitoring with profiling
  - Sensitive data filtering (passwords, tokens, cookies)
  - API request performance tracking

- **Automated Backups**
  - PostgreSQL database backup with verification
  - Configuration file backup
  - IoTDB metadata backup
  - S3 upload support with AWS CLI
  - Telegram notification support
  - Automatic cleanup based on retention policy

- **Log Rotation**
  - Application log rotation (14-day retention)
  - PM2 log rotation (7-day retention)
  - Nginx log rotation (30-day retention)
  - Docker log rotation (7-day retention)
  - Automatic compression with delaycompress

### Added - Phase 2 (Performance & Automation)
- **Database Optimization**
  - Automated VACUUM ANALYZE
  - Automatic index creation and verification
  - Query performance analysis
  - Automatic cleanup of expired data (90-day retention)
  - Optimization report generation

- **Redis Connection Pool**
  - Connection pooling with automatic reconnection
  - Health checks with ping
  - Connection statistics and monitoring
  - Graceful shutdown handling
  - Error handling and retry strategy

- **API Response Caching**
  - Redis-backed HTTP response caching
  - Configurable TTL (60s default, 300s long, 10s short)
  - Smart cache key generation (path, query, headers, user)
  - Cache statistics (hit rate tracking)
  - Cache invalidation by pattern

- **CI/CD Pipeline**
  - GitHub Actions workflow for automated testing
  - Security vulnerability scanning (npm audit, Snyk)
  - ESLint and TypeScript type checking
  - Docker image building and pushing
  - Automated deployment on main branch
  - Automatic rollback on deployment failure
  - Slack/Sentry notification integration

- **Zero-Downtime Deployment**
  - Blue-green deployment pattern
  - Health checks before traffic switch
  - Nginx upstream configuration update
  - Automatic rollback on failure
  - Deployment rollback script

- **Performance Monitoring**
  - Request/response time tracking (P50, P95, P99)
  - CPU, memory, disk usage monitoring
  - Custom metrics collection
  - Alert thresholds (CPU >80%, Memory >80%, Disk >80%)
  - Telegram/Sentry alert integration
  - Express middleware for automatic tracking

### Security Improvements
- **SQL Injection Prevention**
  - Input validation for all IoTDB paths and parameters
  - Dangerous pattern detection
  - Whitelist-based validation for device names, measurements, data types
  - Production credential check for IoTDB (disallows root/root)

- **Token Storage Security**
  - Removed localStorage token usage
  - HttpOnly cookie-only token storage
  - Updated all frontend pages to use authFetch utility

- **CSRF Protection**
  - Backend already has complete CSRF implementation
  - Removed localStorage fallback from csrf.ts
  - Double-submit cookie pattern with Redis

- **AI Service Security**
  - AI features disabled by default
  - Environment variable `AI_FEATURES_DISABLED=true`
  - Graceful 503 response when accessing disabled endpoints

### Changed
- Updated multer from 2.0.2 to 2.1.0 (security fix)
- Created ErrorBoundary component for React error handling
- Added new error class: ServiceUnavailableError
- All 169 tests passing

### Fixed
- Fixed test suite failures by creating authLockout service module
- Fixed TypeScript type errors in new modules
- Fixed import paths for new utility modules

---

## [1.0.0] - 2026-03-03

### Added
- Initial release of IoTDB Enhanced Platform
- Apache IoTDB 2.0.5 integration
- AI-powered time series prediction and anomaly detection
- RESTful API with Swagger documentation
- Next.js 14 frontend with Ant Design
- PostgreSQL + Redis data storage
- JWT authentication with HttpOnly cookies
- Rate limiting with Redis
- CSRF protection
- API key management
- Alert system with multi-channel notifications
- User management and authorization
- Docker containerization
- Nginx reverse proxy configuration
- PM2 process management
- Comprehensive documentation

### Security Features
- HttpOnly cookies for JWT tokens
- CSRF token validation
- Rate limiting (100 req/15min per IP)
- Helmet.js security headers
- Input validation with Zod
- SQL injection prevention (basic)

---

## [Unreleased]

### Removed - Documentation & Code Cleanup (2026-03-21)

#### Security Improvements
- **Deleted security-critical file** - `.secrets.tmp` contained plaintext secrets
  - Removed JWT secrets, database credentials, and passwords from disk
  - Eliminated security vulnerability from temporary plaintext file

#### Documentation Cleanup
- **Removed phase completion reports** (6 files, ~32KB)
  - `.phase1-completed.md`, `.phase1.5-completed.md`, `.phase1-final-summary.md`
  - `.phase1-security-summary.md`, `.phase2-completed.md`, `.final-completion-summary.md`
  - Superseded by current documentation and CHANGELOG.md
- **Cleaned archive documentation** (10 files, ~128KB)
  - Removed historical review documents from `docs/archive/reviews/`
  - Old testing reports, code quality reviews, and evaluations
  - Information now reflected in current codebase and documentation

#### Backup Cleanup
- **Removed old backup files** (6 files, ~20KB)
  - `backend/.env.backup-20260321-004458` - superseded by GPG encryption
  - 5 old `.claude.json.backup.*` files from previous configurations
  - Current backup system is sufficient

#### Results
- **Total files removed**: 17+ files
- **Space recovered**: ~180KB
- **Security improved**: Removed plaintext secrets exposure
- **Documentation clarified**: Eliminated duplicate and obsolete files
- **Project structure cleaner**: Only current, relevant documentation remains

### Added - Project Structure Cleanup (2026-03-21)

#### Developer Experience
- **ESLint Configuration** - Code quality linting for backend and frontend
  - TypeScript-aware linting rules
  - Auto-fix capabilities with `npm run lint:fix`
  - Custom rules for project standards
- **Prettier Configuration** - Consistent code formatting
  - Shared configuration for backend and frontend
  - 100 character line width
  - Single quotes, trailing commas
  - Format scripts: `npm run format`
- **Pre-commit Hooks** - Automated code quality checks
  - Husky + lint-staged integration
  - Runs ESLint and Prettier on staged files
  - Blocks commits with failing checks
- **Comprehensive Documentation** - Developer onboarding resources
  - CONTRIBUTING.md - Contribution guidelines and workflow
  - docs/DEVELOPER_GUIDE.md - Comprehensive developer guide
  - Architecture overview and project structure
  - Common tasks and debugging guides

#### Project Organization
- **Centralized Configuration** - `/config/` directory for all config templates
  - `backend.env.example` - Backend environment template
  - `frontend.env.example` - Frontend environment template
  - `.env.production.template` - Production environment template
  - Symlinks for backward compatibility
- **Cleaned Directory Structure** - Removed duplicate and obsolete files
  - Removed duplicate `/root/iotdb-enhanced/` project directory
  - Cleaned up 4+ Claude worktrees (~10MB storage recovered)
  - Removed 9 unused dependencies across projects

#### Dependency Management
- **Removed Unused Dependencies**
  - Backend: multer, qrcode, node-fetch, sqlstring
  - Frontend: dompurify, html2canvas
  - Root: swagger-jsdoc, swagger-ui-express, bcrypt, jsonwebtoken
- **Resolved Duplicate Dependencies**
  - Removed jsonwebtoken from root (kept in backend)
  - Removed bcrypt from root (using bcryptjs in backend)
- **Security Fixes**
  - Fixed minimatch vulnerability (GHSA-23c5-xmqv-rm74)
  - Applied pnpm override for minimatch >=3.1.4

#### Code Quality Scripts
```bash
# Lint code
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Run tests
npm test
```

### Changed - Breaking Changes (2026-03-19)

#### Configuration Changes
- **Default port changed from 8002 to 8000**
  - Backend API now runs on port 8000 by default (was 8002)
  - Update your `PORT` environment variable if you relied on the old default
  - Nginx reverse proxy configuration updated to use port 8000
  - This aligns with common API port conventions

#### CI/CD Consolidation
- **GitHub workflows consolidated** from 3 files to 1
  - Merged `deploy.yml`, `security.yml`, and `test.yml` into `ci.yml`
  - All functionality preserved with improved organization
  - Automated testing, security scanning, and deployment in one pipeline

#### Documentation Cleanup
- Removed redundant `docs/SECURITY_SETUP.md` - content now in `docs/SECURITY.md`
- Removed archive documentation that was superseded by current docs

### Added - Test Coverage Improvements (2026-03-13)
- **Core Infrastructure Tests**
  - Error Handler Utilities - 100% coverage (36 tests)
  - JWT Library - 93.33% coverage (56 tests)
  - Response Utilities - 100% coverage (58 tests)
  - Logging Middleware - 100% coverage (64 tests)
  - Security Middleware - 97.46% coverage (74 tests)
  - Cache Middleware - 83.52% coverage (56 tests)
  - AI Access Middleware - 82.75% coverage (21 tests)

- **Test Statistics**
  - Total Tests: 575 (from 527, +48 tests)
  - Overall Coverage: 34.46% (from 31.26%, +3.20%)
  - Middleware Coverage: 61.2% (from 46.52%, +14.68%)
  - Project Score: 8.8/10 (from 8.7/10)

### Changed
- Updated documentation with latest test statistics
- README.md test badge updated to 575 tests
- Moved detailed test reports to archive:
  - `docs/archive/reviews/COMPREHENSIVE_TESTING_REPORT.md`
  - `docs/archive/reviews/TEST_IMPROVEMENTS.md`

### Planned - Phase 4 (Future)
- Advanced analytics dashboard
- Distributed tracing with OpenTelemetry
- Advanced caching strategies (cache warming, stale-while-revalidate)
- Kubernetes deployment manifests
- Horizontal Pod Autoscaler configuration
- Multi-region deployment support
- Advanced security features (2FA, SSO)
- Real-time WebSocket updates
- Data export and reporting
- Custom alert rules engine
- API rate limiting per user
- Request queue management
- Database query optimization
- ElasticSearch integration for log aggregation
- Grafana dashboards
- Prometheus metrics endpoint

---

## Upgrade Guide

### From 1.0.0 to 1.1.0

1. **Update dependencies**:
   ```bash
   cd backend && pnpm install
   cd frontend && pnpm install
   ```

2. **Add new environment variables** (optional):
   ```bash
   # AI Features (disabled by default)
   AI_FEATURES_DISABLED=true

   # Sentry (optional)
   SENTRY_DSN=your-dsn
   SENTRY_ENVIRONMENT=production
   ```

3. **Update IoTDB credentials** (required):
   - Change default `root/root` credentials in production
   - The server will now refuse to start with default credentials in production mode

4. **Run database optimization**:
   ```bash
   ./scripts/optimize-database.sh
   ```

5. **Set up automated backups**:
   ```bash
   crontab -e
   # Add: 0 2 * * * /root/iotdb-enhanced/scripts/auto-backup.sh
   ```

6. **Enable monitoring** (optional):
   ```bash
   ./scripts/monitoring.sh --daemon
   ```

---

[1.2.0]: https://github.com/Zouksw/iotdb-enhanced/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Zouksw/iotdb-enhanced/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Zouksw/iotdb-enhanced/releases/tag/v1.0.0
