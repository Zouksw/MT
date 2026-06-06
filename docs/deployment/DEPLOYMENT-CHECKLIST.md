# MT - 上线前检查清单

> **Note**: MT no longer uses IoTDB. IoTDB-specific deployment steps are historical and can be skipped.

**创建日期**: 2026-03-26
**项目状态**: 准备上线
**优先级**: 🔴 CRITICAL - 必须完成才能上线

---

## 📊 当前状态概览

### 服务状态 (2026-03-26)
```
✅ PostgreSQL - 运行中
✅ Redis - 运行中
❌ IoTDB DataNode - 未运行
❌ IoTDB ConfigNode - 未运行
❌ AI Node - 未运行
❌ IoTDB REST API - 未运行
✅ Backend (PM2, port 8000) - 运行中
✅ Frontend (PM2, port 3000) - 运行中
```

### 测试覆盖率
```
Statements: 77.1% ⚠️ 目标 80%
Branches: 66.51% ❌ 目标 70% (差 3.49%)
Functions: 70.13% ✅ 已达标
Lines: 77.58% ⚠️ 目标 80%
```

**测试状态**: ❌ 1个测试失败 (`apiKeys.test.ts`)

---

## 🚨 阻塞问题 (必须修复)

### 1. IoTDB 服务未启动
**严重性**: 🔴 CRITICAL
**影响**: 无法存储和查询时间序列数据，AI 功能不可用

**解决方案**:
```bash
# 启动所有服务
./start.sh

# 或单独启动 IoTDB
cd /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin
./sbin/start-standalone.sh

# 启动 AI Node
./scripts/start-ainode.sh
```

**验证**:
```bash
# 检查 IoTDB 端口
nc -z localhost 6667 && echo "IoTDB OK" || echo "IoTDB FAILED"

# 检查 AI Node 端口
nc -z localhost 10810 && echo "AI Node OK" || echo "AI Node FAILED"
```

### 2. 测试失败
**严重性**: 🔴 CRITICAL
**影响**: API Key 验证逻辑可能有问题

**失败测试**: `API Keys Service › validateApiKey › should return null when bcrypt comparison fails`

**位置**: `backend/src/services/__tests__/apiKeys.test.ts:241`

**解决方案**:
1. 检查 `backend/src/services/apiKeys.ts` 中的 `validateApiKey` 函数
2. 确保当 bcrypt 比较失败时返回 `null`，而不是返回部分数据
3. 修复后重新运行测试

### 3. 分支覆盖率未达标
**严重性**: 🟡 MEDIUM
**影响**: 可能存在未测试的代码分支

**当前**: 66.51%
**目标**: 70%
**差距**: 3.49%

**建议**:
- 优先修复上述两个阻塞问题
- 如果时间紧迫，可以临时调整阈值到 65%，但应在上线后立即补充测试

---

## ✅ 上线前检查清单

### Phase 1: 服务准备 (CRITICAL)

- [ ] **1.1 启动所有核心服务**
  ```bash
  ./start.sh
  # 等待 30 秒让服务完全启动
  sleep 30
  ./check.sh
  ```
  预期结果：所有服务显示 ✅

- [ ] **1.2 验证 IoTDB 连接**
  ```bash
  cd backend
  npm run test: -- src/services/iotdb/__tests__/client.test.ts
  ```
  预期结果：测试通过

- [ ] **1.3 验证 AI Node 连接**
  ```bash
  curl -X GET http://localhost:10810/models
  ```
  预期结果：返回可用模型列表

- [ ] **1.4 检查 PM2 进程状态**
  ```bash
  pm2 status
  pm2 logs --lines 50
  ```
  预期结果：所有进程 `online`，无错误日志

### Phase 2: 数据库准备 (CRITICAL)

- [ ] **2.1 运行数据库迁移**
  ```bash
  cd backend
  npx prisma migrate deploy
  ```
  预期结果：显示 "Migration successful"

- [ ] **2.2 验证数据库连接**
  ```bash
  cd backend
  npx prisma db push --accept-data-loss
  ```
  预期结果：数据库 schema 同步成功

- [ ] **2.3 创建备份**
  ```bash
  ./scripts/backup-db.sh
  ```
  预期结果：备份文件创建成功

- [ ] **2.4 检查数据库索引**
  ```sql
  -- 在 PostgreSQL 中运行
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
  ```
  预期结果：关键表有适当的索引

### Phase 3: 配置验证 (CRITICAL)

- [ ] **3.1 验证环境变量**
  ```bash
  # Backend
  cd backend
  cat .env | grep -E "^(NODE_ENV|DATABASE_URL|REDIS_URL|IOTDB_|JWT_SECRET)"
  ```

  **关键检查项**:
  - `NODE_ENV=production` ✅
  - `DATABASE_URL` 正确配置 ✅
  - `REDIS_URL` 正确配置 ✅
  - `JWT_SECRET` 不是默认值 ✅
  - `IOTDB_HOST` 和 `IOTDB_PORT` 正确 ✅
  - `AI_NODE_HOST` 和 `AI_NODE_PORT` 正确 ✅

- [ ] **3.2 验证前端配置**
  ```bash
  cd frontend
  cat .env.local | grep -E "^(NEXT_PUBLIC_API_URL|NODE_ENV)"
  ```
  预期结果：API URL 指向生产环境

- [ ] **3.3 检查日志配置**
  ```bash
  # 确保日志目录存在且有写权限
  ls -la backend/logs/
  ls -la /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/
  ```

- [ ] **3.4 验证 CORS 配置**
  检查 `backend/src/lib/config.ts` 中的 CORS 设置是否允许生产域名

### Phase 4: 安全检查 (CRITICAL)

- [ ] **4.1 验证 JWT 密钥强度**
  ```bash
  cd backend
  grep JWT_SECRET .env | wc -c
  ```
  预期结果：至少 32 个字符

- [ ] **4.2 验证 Session 密钥**
  ```bash
  cd backend
  grep SESSION_SECRET .env | wc -c
  ```
  预期结果：至少 32 个字符

- [ ] **4.3 检查 CSRF 保护**
  ```bash
  curl -I http://localhost:8000/api/health
  ```
  预期结果：响应头包含 CSRF 相关设置

- [ ] **4.4 验证 rate limiting**
  检查 Redis 中的 rate limit 数据：
  ```bash
  redis-cli keys "rate_limit:*"
  ```

- [ ] **4.5 检查 AI 服务隔离**
  ```bash
  # 验证 prlimit 配置
  ps aux | grep ai-isolated
  cat /proc/<PID>/limits | grep "max memory"
  ```
  预期结果：内存限制生效

- [ ] **4.6 验证 HTTPS 配置** (如果使用)
  ```bash
  openssl s_client -connect your-domain.com:443
  ```
  预期结果：证书有效，TLS 版本 >= 1.2

### Phase 5: 性能检查 (HIGH)

- [ ] **5.1 运行性能测试**
  ```bash
  cd backend
  npm run test: -- src/lib/__tests__/performanceMonitor.test.ts
  ```
  预期结果：所有性能测试通过

- [ ] **5.2 检查 Redis 连接池**
  ```bash
  redis-cli info clients
  ```
  预期结果：连接数在合理范围内

- [ ] **5.3 验证缓存配置**
  ```bash
  redis-cli info stats
  ```
  预期结果：缓存命中率 > 80%

- [ ] **5.4 检查数据库连接池**
  查看 `backend/src/lib/prisma.ts` 中的连接池配置
  预期结果：
  - `connection_limit` >= 10
  - `pool_timeout` 合理设置

### Phase 6: 监控和日志 (HIGH)

- [ ] **6.1 配置日志轮转**
  ```bash
  # 检查 PM2 日志轮转
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 100M
  pm2 set pm2-logrotate:retain 7
  ```

- [ ] **6.2 验证错误追踪** (Sentry)
  检查 `backend/src/lib/sentry.ts` 配置
  预期结果：DSN 配置正确

- [ ] **6.3 配置健康检查**
  ```bash
  curl http://localhost:8000/api/health
  curl http://localhost:8000/api/ready
  curl http://localhost:8000/api/live
  ```
  预期结果：所有端点返回 200

- [ ] **6.4 设置监控告警**
  - 配置 Prometheus metrics (如果使用)
  - 设置磁盘空间告警 (< 20%)
  - 设置内存使用告警 (> 80%)
  - 设置 CPU 使用告警 (> 80%)

### Phase 7: 备份和恢复 (CRITICAL)

- [ ] **7.1 创建完整备份**
  ```bash
  # 数据库备份
  ./scripts/backup-db.sh

  # 配置文件备份
  tar -czf backup-config-$(date +%Y%m%d).tar.gz \
    backend/.env \
    frontend/.env.local \
    nginx/nginx.conf \
    ecosystem.config.cjs
  ```

- [ ] **7.2 验证备份文件**
  ```bash
  ls -lh /path/to/backups/
  ```
  预期结果：备份文件存在且大小合理

- [ ] **7.3 测试恢复流程** (可选但推荐)
  在测试环境中验证备份可以恢复

- [ ] **7.4 设置自动备份**
  配置 cron 任务：
  ```bash
  # 每天凌晨 2 点备份
  0 2 * * * /path/to/MT/scripts/backup-db.sh
  ```

### Phase 8: 文档和部署 (MEDIUM)

- [ ] **8.1 更新部署文档**
  - [ ] `docs/deployment.md` 最新
  - [ ] `docs/ai-node-setup.md` 最新
  - [ ] `README.md` 包含正确的启动命令

- [ ] **8.2 创建运行手册**
  - [ ] 启动/停止流程
  - [ ] 故障排查指南
  - [ ] 联系信息

- [ ] **8.3 准备回滚计划**
  - [ ] 记录当前版本
  - [ ] 准备回滚脚本
  - [ ] 测试回滚流程

### Phase 9: 用户数据准备 (MEDIUM)

- [ ] **9.1 创建默认管理员用户**
  ```bash
  ./scripts/user-management.sh create-admin
  ```
  预期结果：管理员账号创建成功

- [ ] **9.2 准备示例数据** (可选)
  - 创建示例时间序列
  - 导入示例数据集
  - 配置示例告警规则

### Phase 10: 最终验证 (CRITICAL)

- [ ] **10.1 运行所有测试**
  ```bash
  cd backend
  npm test
  ```
  预期结果：所有测试通过 ✅

- [ ] **10.2 检查测试覆盖率**
  ```bash
  cd backend
  npm run test:coverage
  ```
  预期结果：覆盖率 >= 目标值

- [ ] **10.3 端到端测试**
  - [ ] 注册新用户
  - [ ] 登录
  - [ ] 创建时间序列
  - [ ] 插入数据
  - [ ] 查询数据
  - [ ] 测试 AI 预测 (如果启用)
  - [ ] 创建告警规则
  - [ ] 登出

- [ ] **10.4 压力测试** (可选)
  ```bash
  # 使用 Apache Bench 或类似工具
  ab -n 1000 -c 10 http://localhost:8000/api/health
  ```
  预期结果：无错误，响应时间 < 200ms

- [ ] **10.5 安全扫描** (可选)
  ```bash
  npm audit
  ```
  预期结果：无高危漏洞

---

## 🚀 上线步骤

### 1. 最终检查
```bash
# 确保所有服务运行
./check.sh

# 确保所有测试通过
cd backend && npm test

# 确认环境配置
cat backend/.env | grep NODE_ENV
```

### 2. 启动生产环境
```bash
# 如果还没启动
./start.sh

# 等待服务完全启动
sleep 30

# 验证所有服务
./check.sh
```

### 3. 配置反向代理 (Nginx)
```bash
# 检查 Nginx 配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 验证 Nginx 状态
sudo systemctl status nginx
```

### 4. 设置开机自启动
```bash
# PM2 开机自启动
pm2 startup
pm2 save

# IoTDB 开机自启动 (如果需要)
sudo systemctl enable iotdb
```

### 5. 验证外部访问
```bash
# 替换为你的域名或 IP
curl http://your-domain.com/api/health
curl https://your-domain.com
```

### 6. 监控日志
```bash
# 实时查看日志
pm2 logs

# 查看特定服务日志
pm2 logs backend
pm2 logs frontend
```

---

## 📋 上线后检查

### 第一小时
- [ ] 检查错误日志
- [ ] 监控 CPU/内存使用
- [ ] 验证关键功能
- [ ] 检查数据库性能

### 第一天
- [ ] 每小时检查日志
- [ ] 监控用户反馈
- [ ] 检查备份任务
- [ ] 验证告警系统

### 第一周
- [ ] 每日健康检查
- [ ] 性能监控
- [ ] 安全审计
- [ ] 用户反馈收集

---

## 🆘 故障排查

### IoTDB 无法启动
```bash
# 检查端口占用
netstat -tulpn | grep 6667

# 查看 IoTDB 日志
tail -f /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_error.log

# 重启 IoTDB
cd /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin
./sbin/stop-standalone.sh
./sbin/start-standalone.sh
```

### Backend 无法启动
```bash
# 查看 PM2 日志
pm2 logs backend --err

# 检查端口占用
netstat -tulpn | grep 8000

# 重启 backend
pm2 restart backend
```

### 数据库连接失败
```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查连接字符串
cat backend/.env | grep DATABASE_URL

# 测试连接
psql -U postgres -d iotdb_enhanced
```

### Redis 连接失败
```bash
# 检查 Redis 状态
sudo systemctl status redis

# 测试连接
redis-cli ping
```

---

## 📞 紧急联系

**技术负责人**: [填写]
**运维负责人**: [填写]
**紧急联系**: [填写]

**文档位置**:
- 部署文档: `docs/deployment.md`
- AI Node 文档: `docs/ai-node-setup.md`
- API 文档: `docs/api.md`

---

## ✅ 上线完成标准

当以下所有条件满足时，可以认为上线成功：

1. ✅ 所有核心服务运行正常
2. ✅ 所有测试通过
3. ✅ 健康检查端点返回 200
4. ✅ 可以通过外部访问
5. ✅ 错误日志无严重错误
6. ✅ 性能指标在正常范围
7. ✅ 备份任务配置完成
8. ✅ 监控告警配置完成
9. ✅ 文档更新完成
10. ✅ 回滚计划准备就绪

---

**最后更新**: 2026-03-26
**状态**: 🟡 准备中 - 有 3 个阻塞问题需要解决
**下一步**: 修复 IoTDB 服务和测试失败
