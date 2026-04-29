---
title: "MT 安全配置指南"
en_title: "MT Security Configuration Guide"
version: "1.1.0"
last_updated: "2026-03-04"
status: "stable"
maintainer: "MT Team"
reviewers:
  - "Security Engineer"
  - "DevOps Engineer"
tags:
  - "security"
  - "configuration"
  - "ssl"
  - "firewall"
  - "authentication"
target_audience: "安全工程师、运维工程师、系统管理员"
related_docs:
  - "部署指南": "DEPLOYMENT.md"
  - "使用指南": "GUIDE.md"
  - "文档规范": "DOCUMENTATION_METADATA.md"
  - "部署后配置": "POST-DEPLOYMENT.md"
changes:
  - version: "1.1.0"
    date: "2026-03-04"
    author: "MT Team"
    changes: "更新 - 添加 Phase 1 & 2 安全改进（SQL注入防护、Token存储、CSRF保护、AI功能安全）"
  - version: "1.0.0"
    date: "2026-03-03"
    author: "MT Team"
    changes: "初始版本 - 整合安全配置、密钥管理和安全加固指南"
next_review: "2026-09-04"
approval:
  status: "approved"
  reviewed_by: "Security Engineer"
  approved_date: "2026-03-04"
---

# MT 安全配置指南

本文档提供了 MT 平台的安全配置完整指南，包括密钥管理、基础安全配置、高级安全加固、安全检查清单和应急响应流程。

---

## 最新安全改进 (v1.1.0)

### 已修复的安全漏洞

| 漏洞类型 | 严重程度 | 状态 | 修复方案 |
|---------|---------|------|---------|
| SQL 注入风险 | 🔴 严重 | ✅ 已修复 | 输入验证 + 危险模式检测 |
| AI 服务代码注入 | 🔴 严重 | ✅ 已禁用 | 默认禁用 AI 功能 |
| 硬编码密码 | 🔴 严重 | ✅ 已修复 | 移除硬编码，使用环境变量 |
| Token 存储不一致 | 🔴 严重 | ✅ 已修复 | 统一使用 HttpOnly Cookie |
| CSRF 防护缺失 | 🔴 严重 | ✅ 已验证 | 完整 CSRF 实现 |
| IoTDB 默认凭证 | 🔴 严重 | ✅ 已修复 | 生产环境强制更改 |

### 新增安全功能

- **HttpOnly Cookie**: Token 仅存储在 HttpOnly Cookie 中，无法被 JavaScript 访问
- **CSRF 保护**: 完整的双提交 Cookie 模式实现
- **Rate Limiting**: 基于 Redis 的速率限制（100 请求/15 分钟）
- **输入验证**: 所有 IoTDB 路径和参数的严格验证
- **生产环境检查**: 启动时验证 IoTDB 凭证已更改
- **AI 功能控制**: 默认禁用，可通过环境变量启用

---

## 目录

1. [安全概述](#安全概述)
2. [密钥管理](#密钥管理)
3. [基础安全配置](#基础安全配置)
4. [高级安全加固](#高级安全加固)
5. [安全检查清单](#安全检查清单)
6. [应急响应](#应急响应)

---

## 安全概述

### 安全威胁模型

MT 平台面临的主要安全威胁包括：

| 威胁类型 | 描述 | 风险等级 | 缓解措施 |
|---------|------|---------|---------|
| 未授权访问 | 默认密码未更改 | 🔴 高 | 强制密码策略 |
| 中间人攻击 | 未加密的 HTTP 通信 | 🔴 高 | SSL/TLS 配置 |
| 注入攻击 | SQL/命令注入 | 🔴 高 | 输入验证、参数化查询 |
| DDoS 攻击 | 暴力破解、资源耗尽 | 🟡 中 | 速率限制、防火墙 |
| 数据泄露 | 敏感数据暴露 | 🔴 高 | 加密存储、访问控制 |

### 安全原则

1. **最小权限原则**: 仅授予必要的访问权限
2. **纵深防御**: 多层安全控制
3. **默认拒绝**: 默认拒绝所有访问，显式允许必要的访问
4. **持续监控**: 记录和监控所有安全相关事件

---

## 密钥管理

### 生成安全密钥

生产环境必须使用强随机密钥。请使用以下方法生成：

```bash
# 方法 1: 使用 OpenSSL
openssl rand -base64 32 | tr -d '/+='

# 方法 2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方法 3: 使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 必需的安全密钥

| 密钥名称 | 用途 | 长度要求 | 生成算法 |
|---------|------|---------|---------|
| `JWT_SECRET` | JWT 令牌签名 | 32+ 字节 | Base64 编码随机字节 |
| `SESSION_SECRET` | 会话加密 | 32+ 字节 | Base64 编码随机字节 |
| `ENCRYPTION_KEY` | 数据加密 | 32 字节 (十六进制) | 随机十六进制字符串 |
| `IOTDB_PASSWORD` | IoTDB 认证 | 16+ 字符 | 强密码 |
| `DATABASE_PASSWORD` | PostgreSQL 认证 | 16+ 字符 | 强密码 |

### 配置步骤

1. **生成所有密钥**:

```bash
# 生成 JWT_SECRET
export JWT_SECRET=$(openssl rand -base64 32)

# 生成 SESSION_SECRET
export SESSION_SECRET=$(openssl rand -base64 32)

# 生成 ENCRYPTION_KEY (32 字节十六进制)
export ENCRYPTION_KEY=$(openssl rand -hex 16)

# 生成数据库密码
export IOTDB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
export DATABASE_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')

# 显示生成的密钥 (妥善保管)
echo "JWT_SECRET=$JWT_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "IOTDB_PASSWORD=$IOTDB_PASSWORD"
echo "DATABASE_PASSWORD=$DATABASE_PASSWORD"
```

2. **更新环境变量**:

```bash
# 编辑后端环境变量
cd /root/backend
cp .env.example .env

# 将生成的密钥添加到 .env 文件
vim .env
```

3. **更新数据库密码**:

```bash
# 更改 PostgreSQL 用户密码
sudo -u postgres psql
ALTER USER iotdb_user WITH PASSWORD 'YOUR_DATABASE_PASSWORD';
\q

# 更改 IoTDB 密码
cd /opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
./sbin/start-cli.sh -h localhost -p 6667 -u root -pw root
# 在 CLI 中执行: SET PASSWORD TO YOUR_IOTDB_PASSWORD
```

4. **设置文件权限**:

```bash
# 确保 .env 文件权限安全
chmod 600 /root/backend/.env
chmod 600 /root/frontend/.env.local
```

### 密钥轮换策略

| 密钥类型 | 轮换频率 | 轮换方法 |
|---------|---------|---------|
| JWT_SECRET | 每 3-6 个月 | 生成新密钥，重新部署 |
| SESSION_SECRET | 每 3-6 个月 | 生成新密钥，重新部署 |
| ENCRYPTION_KEY | 每年 | 数据迁移后更新 |
| 服务密码 | 每 3-6 个月 | 直接更新 |

---

## 基础安全配置

### 密码策略

#### PostgreSQL 密码配置

```bash
# 1. 连接到 PostgreSQL
sudo -u postgres psql

# 2. 更改密码
ALTER USER iotdb_user WITH PASSWORD 'your_new_secure_password';

# 3. 设置密码策略
ALTER ROLE iotdb_user WITH LOGIN PASSWORD_EXPIRATION 90;
```

#### IoTDB 密码配置

```bash
# 方法 1: 使用 CLI (推荐)
cd /opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
./sbin/start-cli.sh -h localhost -p 6667 -u root -pw root

# 在 CLI 中执行
SET PASSWORD TO new_password

# 退出
quit
```

### JWT 和会话配置

#### 环境变量配置

```bash
# backend/.env
JWT_SECRET=your_32_char_base64_secret
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

SESSION_SECRET=your_32_char_base64_secret
SESSION_MAX_AGE=86400000
```

#### 会话管理最佳实践

- 设置合理的令牌过期时间
- 实施令牌刷新机制
- 在用户登出时使令牌失效
- 监控异常会话活动

### CORS 配置

```bash
# backend/.env
CORS_ORIGIN=https://your-domain.com
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,PATCH
```

**生产环境注意事项**:
- 仅允许受信任的域名
- 避免使用 `*` 通配符
- 启用凭证支持时需要指定域名

---

## 高级安全加固

### SSL/TLS 配置

#### 使用 Let's Encrypt (推荐)

```bash
# 1. 安装 Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# 2. 获取证书
sudo certbot --nginx -d your-domain.com

# 3. 验证自动续期
sudo certbot renew --dry-run

# 4. 证书位置
# 证书: /etc/letsencrypt/live/your-domain.com/fullchain.pem
# 私钥: /etc/letsencrypt/live/your-domain.com/privkey.pem
```

#### Nginx SSL 配置示例

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 协议和密码套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # SSL 会话缓存
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头部
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # 日志
    access_log /var/log/nginx/iotdb-access.log;
    error_log /var/log/nginx/iotdb-error.log;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 防火墙配置

#### 使用 UFW (推荐)

```bash
# 1. 安装 UFW
sudo apt update
sudo apt install ufw

# 2. 设置默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3. 允许 SSH (重要!)
sudo ufw allow 22/tcp

# 4. 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 5. 启用防火墙
sudo ufw enable

# 6. 查看状态
sudo ufw status verbose
```

#### 生产环境端口规则

```bash
# 开放的端口 (外部访问)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 内部端口 (仅本地访问)
sudo ufw deny 6667/tcp   # IoTDB DataNode
sudo ufw deny 6678/tcp   # IoTDB Sync
sudo ufw deny 10710/tcp  # IoTDB ConfigNode
sudo ufw deny 10810/tcp  # AI Node
sudo ufw deny 5432/tcp   # PostgreSQL
sudo ufw deny 6379/tcp   # Redis
sudo ufw deny 8000/tcp   # Backend API
sudo ufw deny 3000/tcp   # Frontend
```

#### 使用 iptables 限制本地端口

```bash
# 限制 IoTDB 端口仅本地访问
sudo iptables -A INPUT -p tcp --dport 6667 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6667 -j DROP

# 限制 PostgreSQL 仅本地访问
sudo iptables -A INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP

# 限制 Redis 仅本地访问
sudo iptables -A INPUT -p tcp --dport 6379 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6379 -j DROP

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4
```

### 速率限制

#### Nginx 速率限制配置

```nginx
# 在 http 块中添加
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# 在 location 块中应用
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://localhost:8000;
}

location /api/auth/ {
    limit_req zone=auth_limit burst=5 nodelay;
    proxy_pass http://localhost:8000;
}
```

#### 应用层速率限制

```javascript
// 后端速率限制中间件
const rateLimit = require('express-rate-limit');

// API 速率限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 限制 100 个请求
  message: '请求过于频繁，请稍后再试'
});

// 认证速率限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 每个 IP 限制 5 次登录尝试
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
```

### CSRF 保护

#### 后端 CSRF 配置

```javascript
// 使用 csrf-cookie 等库
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

app.use(csrfProtection);

// 提供 CSRF 令牌
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

#### 前端 CSRF 处理

```javascript
// 在请求头中包含 CSRF 令牌
fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

---

## 安全检查清单

### 上线前必做 🔴

- [ ] 更改所有默认密码 (IoTDB、PostgreSQL、Redis)
- [ ] 生成并配置 JWT_SECRET 和 SESSION_SECRET
- [ ] 配置 SSL/TLS 证书
- [ ] 配置防火墙规则 (仅开放 80/443 端口)
- [ ] 确保所有内部端口不对外暴露
- [ ] 配置 CORS 白名单
- [ ] 设置环境变量文件权限为 600
- [ ] 验证所有安全密钥已配置

### 建议完成 🟡

- [ ] 设置数据库自动备份
- [ ] 配置日志监控和告警
- [ ] 启用审计日志
- [ ] 配置速率限制
- [ ] 设置入侵检测系统
- [ ] 定期安全更新
- [ ] 配置 WAF (Web 应用防火墙)
- [ ] 实施日志集中管理

### 高级安全 🟢

- [ ] 实施 SIEM (安全信息和事件管理)
- [ ] 配置数据库加密
- [ ] 实施网络分段
- [ ] 配置 HIDS (主机入侵检测系统)
- [ ] 实施端点保护
- [ ] 定期渗透测试
- [ ] 实施零信任架构
- [ ] 配置 DDoS 防护

---

## 应急响应

### 安全事件分类

| 级别 | 描述 | 响应时间 | 示例 |
|------|------|---------|------|
| 🔴 严重 | 系统被入侵、数据泄露 | 立即 | 数据库被攻击 |
| 🟠 高 | 服务中断、可疑活动 | 1 小时 | 暴力破解攻击 |
| 🟡 中 | 异常登录、配置错误 | 4 小时 | 异常访问模式 |
| 🟢 低 | 误报、轻微问题 | 1 天 | 配置漂移 |

### 密码泄露响应

```bash
# 1. 立即隔离受影响系统
sudo ufw deny from <攻击者 IP>

# 2. 更改所有密码
sudo -u postgres psql -c "ALTER USER iotdb_user WITH PASSWORD 'new_password';"
/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/sbin/start-cli.sh -h localhost -p 6667 -u root -pw old_password
# 在 CLI 中: SET PASSWORD TO new_password

# 3. 重新生成 JWT 密钥
export JWT_SECRET=$(openssl rand -base64 32)
export SESSION_SECRET=$(openssl rand -base64 32)
# 更新 .env 文件

# 4. 检查审计日志
sudo tail -f /var/log/postgresql/postgresql-14-main.log
sudo tail -f /root/.pm2/logs/backend-error.log
sudo tail -f /var/log/nginx/access.log

# 5. 检查异常登录
sudo lastb
sudo who

# 6. 重启所有服务
pm2 restart all
```

### DDoS 攻击响应

```bash
# 1. 启用速率限制
# 编辑 Nginx 配置
vim /etc/nginx/nginx.conf
# 添加速率限制配置

# 2. 使用 fail2ban 封禁攻击 IP
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 3. 启用云服务 DDoS 防护
# (如使用云服务提供商的 DDoS 防护)

# 4. 监控流量
sudo tcpdump -i eth0 -n host <攻击者 IP>

# 5. 联系 ISP 获取帮助
```

### 常用应急命令

```bash
# 查看活跃连接
sudo netstat -ant | grep ESTABLISHED

# 查看端口占用
sudo netstat -tlnp

# 查看最近的登录
sudo last

# 查看失败的登录尝试
sudo lastb

# 查看系统进程
sudo ps aux

# 查看系统资源
htop

# 查看磁盘使用
df -h

# 查看日志
sudo journalctl -f
sudo tail -f /var/log/syslog
```

### 安全事件报告

安全事件处理后，应填写事件报告：

1. **事件概述**: 时间、类型、影响范围
2. **根本原因**: 事件原因分析
3. **响应措施**: 采取的应对措施
4. **损失评估**: 数据和业务影响
5. **改进措施**: 防止再次发生的措施
6. **经验教训**: 团队学习要点

---

## 附录

### 端口参考

| 端口 | 服务 | 外部访问 | 说明 |
|------|------|---------|------|
| 22 | SSH | 是 | 管理访问 |
| 80 | HTTP | 是 | 重定向到 HTTPS |
| 443 | HTTPS | 是 | Web 界面和 API |
| 3000 | Frontend | 否 | 通过 Nginx 代理 |
| 8000 | Backend API | 否 | 通过 Nginx 代理 |
| 5432 | PostgreSQL | 否 | 仅本地访问 |
| 6379 | Redis | 否 | 仅本地访问 |
| 6667 | IoTDB DataNode | 否 | 仅本地访问 |
| 6678 | IoTDB Sync | 否 | 仅本地访问 |
| 10710 | IoTDB ConfigNode | 否 | 仅本地访问 |
| 10810 | AI Node | 否 | 仅本地访问 |
| 18080 | IoTDB REST | 否 | 通过后端代理访问 |

### 安全相关文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| 环境变量 | `/root/backend/.env` | 后端配置 |
| 环境变量 | `/root/frontend/.env.local` | 前端配置 |
| Nginx 配置 | `/etc/nginx/nginx.conf` | Web 服务器配置 |
| 防火墙规则 | `/etc/iptables/rules.v4` | iptables 规则 |
| 日志目录 | `/var/log/` | 系统日志 |
| PM2 日志 | `~/.pm2/logs/` | 应用日志 |

### 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/archive/2023/2023_top25_list.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [安全编码规范](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)

---

**文档版本**: 1.0.0
**最后更新**: 2026-03-03
**下次审查**: 2026-09-03
