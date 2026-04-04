# 🔐 生产环境密钥管理方案

## 问题说明

**当前风险**: 敏感凭据以明文形式存储在 `.env` 文件中

### 潜在威胁
- ✅ 已修复: 文件权限过于宽松（现在是 600）
- ⚠️  需要处理: Git 历史中包含旧的默认凭据
- ⚠️  需要实施: 生产环境密钥管理策略

---

## 短期解决方案（立即实施）

### 1. 文件权限 ✅ 已完成
```bash
chmod 600 /root/backend/.env
chmod 600 /root/frontend/.env.local
chmod 600 /root/.secrets.tmp
```

### 2. .gitignore 配置 ✅ 已配置
```bash
# 确保以下文件在 .gitignore 中
.env
.env.local
.env.production
.env.*.local
.secrets.tmp
*.key
*.pem
```

### 3. 清理 Git 历史中的敏感信息 ⚠️ 需要执行

#### 方法 A: 使用 BFG Repo-Cleaner（推荐）
```bash
# 安装 BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
java -jar bfg-1.14.0.jar --replace-text passwords.txt /root/iotdb-enhanced

# passwords.txt 内容：
# IOTDB_PASSWORD=root→IOTDB_PASSWORD=***REMOVED***
# JWT_SECRET=1Df1XIs7XJMUmDS4R+zLKESAIi5xvF1fG4lVavTiEDg=→JWT_SECRET=***REMOVED***

# 清理和压缩
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### 方法 B: 使用 git-filter-branch
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# 强制推送（⚠️ 谨慎使用）
git push origin --force --all
```

---

## 中期解决方案（1-2周内实施）

### 1. 使用环境变量注入

#### PM2 Environment Variables
```bash
# ecosystem.config.cjs reads environment variables directly
# Secrets should be stored in encrypted .env files
gpg --symmetric --cipher-algo AES256 /root/backend/.env

# On deployment, decrypt:
gpg --decrypt /root/backend/.env.gpg > /root/backend/.env
```

#### Kubernetes Secrets (for cloud deployment)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: iotdb-secrets
type: Opaque
stringData:
  JWT_SECRET: <base64-encoded-value>
  IOTDB_PASSWORD: <base64-encoded-value>
```

### 2. 加密的 .env 文件

#### 使用 GPG 加密
```bash
# 加密 .env 文件
gpg --symmetric --cipher-algo AES256 /root/backend/.env
# 输出: /root/backend/.env.gpg

# 解密（运行时）
gpg --decrypt /root/backend/.env.gpg > /root/backend/.env

# 在 .gitignore 中添加
echo "*.env.gpg" >> .gitignore
```

#### 使用 git-crypt
```bash
# 安装 git-crypt
apt-get install git-crypt

# 初始化
git-crypt init

# 配置加密的文件模式
echo "*.env.gpg filter=git-crypt diff=git-crypt" >> .gitattributes

# 生成 GPG 密钥
gpg --gen-key

# 添加 GPG 密钥到 git-crypt
git-crypt add-gpg-user user@example.com

# 加密文件
git-crypt status
```

---

## 长期解决方案（生产环境推荐）

### 1. 云服务商密钥管理

#### AWS Secrets Manager
```bash
# 安装 AWS CLI
apt-get install awscli

# 存储密钥
aws secretsmanager create-secret \
  --name iotdb-enhanced/jwt-secret \
  --secret-string "$(openssl rand -base64 64)"

# 检索密钥（应用启动时）
aws secretsmanager get-secret-value \
  --secret-id iotdb-enhanced/jwt-secret \
  --query SecretString \
  --output text
```

#### HashiCorp Vault
```bash
# 安装 Vault
# 配置 Vault 服务器

# 存储密钥
vault kv put secret/iotdb-enhanced \
  jwt_secret="$(openssl rand -base64 64)" \
  iotdb_password="$(openssl rand -base64 32)"

# 检索密钥
vault kv get -field=jwt_secret secret/iotdb-enhanced
```

### 2. CI/CD 集成

#### GitHub Actions 示例
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      
      - name: Retrieve secrets from AWS Secrets Manager
        id: secrets
        run: |
          JWT_SECRET=$(aws secretsmanager get-secret-value \
            --secret-id iotdb-enhanced/jwt-secret \
            --query SecretString --output text)
          echo "jwt_secret=$JWT_SECRET" >> $GITHUB_OUTPUT
      
      - name: Deploy to server
        run: |
          ssh user@server "JWT_SECRET='${{ steps.secrets.outputs.jwt_secret }}' ./deploy.sh"
```

---

## 当前最佳实践建议

### 开发环境
- ✅ 使用 `.env` 文件
- ✅ 权限设置为 `600`
- ✅ 添加到 `.gitignore`
- ✅ 使用强随机密码

### 生产环境
- ⚠️ **不要**将 `.env` 文件提交到版本控制
- ⚠️ **不要**在生产服务器上存储明文密码
- ✅ 使用密钥管理服务（AWS Secrets Manager、HashiCorp Vault）
- ✅ 或使用加密的环境文件
- ✅ 定期轮换密钥（每 90 天）
- ✅ 使用不同的密钥用于不同环境

---

## 密钥轮换策略

### 自动轮换脚本
```bash
#!/bin/bash
# scripts/rotate-secrets.sh

echo "=== Secret Rotation Script ==="

# 1. 生成新密钥
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_IOTDB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# 2. 更新 .env 文件
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_JWT_SECRET/" /root/backend/.env
sed -i "s/^IOTDB_PASSWORD=.*/IOTDB_PASSWORD=$NEW_IOTDB_PASSWORD/" /root/backend/.env

# 3. 更新 IoTDB 用户密码
# (需要先更改旧密码，然后再设置新密码)

# 4. 重启服务
pm2 restart iotdb-backend --update-env

# 5. 验证服务
sleep 10
curl -f http://localhost:8000/health || exit 1

echo "✓ Secret rotation completed successfully"
```

### 定期轮换
```bash
# 添加到 crontab（每90天自动轮换）
0 0 1 */3 * /root/scripts/rotate-secrets.sh >> /var/log/secret-rotation.log 2>&1
```

---

## 紧急响应计划

### 如果发现密钥已泄露

1. **立即行动**（5分钟内）
   ```bash
   # 停止所有服务
   pm2 stop all
   
   # 撤销所有 JWT tokens（Redis flush）
   redis-cli -a "$REDIS_PASSWORD" FLUSHALL
   
   # 更换所有密钥
   ./scripts/rotate-secrets.sh
   ```

2. **调查影响**（1小时内）
   - 检查访问日志
   - 识别异常活动
   - 通知所有用户重置密码

3. **加强安全**（24小时内）
   - 启用 2FA
   - 增加 IP 白名单
   - 启用审计日志
   - 通知安全团队

---

## 当前状态

- ✅ 文件权限已修复（600）
- ✅ .gitignore 配置正确
- ⚠️  Git 历史需要清理
- ⚠️  需要实施生产密钥管理方案
- 📋 计划在 Phase 3 中实施

---

**最后更新**: 2026-03-21
**负责人**: DevOps Team
**审核周期**: 每 90 天
