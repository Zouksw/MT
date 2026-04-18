#!/bin/bash
# TradeMind AI - User Management Script
# ========================================
# 统一用户管理脚本：创建管理员、修改密码

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 显示使用说明
show_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  create-admin <email> <password>    创建管理员用户"
    echo "  change-password <email> <newpwd>   修改用户密码"
    echo "  list-users                         列出所有用户"
    echo ""
    echo "Examples:"
    echo "  $0 create-admin admin@example.com SecurePass123"
    echo "  $0 change-password admin@example.com NewSecurePass456"
    exit 1
}

# 检查后端目录
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: Backend directory not found${NC}"
    exit 1
fi

# 解析命令
COMMAND="${1:-}"
case "$COMMAND" in
    create-admin)
        if [ "$#" -ne 3 ]; then
            echo -e "${RED}Error: create-admin requires email and password${NC}"
            show_usage
        fi

        EMAIL="$2"
        PASSWORD="$3"

        echo -e "${YELLOW}Creating admin user...${NC}"

        # Validate email format (basic check)
        if [[ ! "$EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            echo -e "${RED}Error: Invalid email format${NC}"
            exit 1
        fi

        # Validate password length
        if [ ${#PASSWORD} -lt 8 ]; then
            echo -e "${RED}Error: Password must be at least 8 characters${NC}"
            exit 1
        fi

        cd "$BACKEND_DIR"
        # Use environment variables instead of string interpolation to prevent injection
        export CREATE_ADMIN_EMAIL="$EMAIL"
        export CREATE_ADMIN_PASSWORD="$PASSWORD"

        node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
    const email = process.env.CREATE_ADMIN_EMAIL;
    const password = process.env.CREATE_ADMIN_PASSWORD;

    if (!email || !password) {
        console.error('Missing email or password');
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
        where: { email: email },
        update: {
            passwordHash: hashedPassword,
            role: 'ADMIN',
        },
        create: {
            email: email,
            passwordHash: hashedPassword,
            name: 'Administrator',
            role: 'ADMIN',
        },
    });

    console.log('Admin user created/updated:', user.email);
    await prisma.\$disconnect();
}

createAdmin().catch(console.error);
"

        unset CREATE_ADMIN_EMAIL
        unset CREATE_ADMIN_PASSWORD

        echo -e "${GREEN}✓ Admin user created: $EMAIL${NC}"
        ;;

    change-password)
        if [ "$#" -ne 3 ]; then
            echo -e "${RED}Error: change-password requires email and new password${NC}"
            show_usage
        fi

        EMAIL="$2"
        NEW_PASSWORD="$3"

        # Validate password length
        if [ ${#NEW_PASSWORD} -lt 8 ]; then
            echo -e "${RED}Error: Password must be at least 8 characters${NC}"
            exit 1
        fi

        echo -e "${YELLOW}Changing password for: $EMAIL${NC}"

        cd "$BACKEND_DIR"
        # Use environment variables instead of string interpolation to prevent injection
        export CHANGE_PASSWORD_EMAIL="$EMAIL"
        export CHANGE_PASSWORD_NEW="$NEW_PASSWORD"

        node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function changePassword() {
    const email = process.env.CHANGE_PASSWORD_EMAIL;
    const newPassword = process.env.CHANGE_PASSWORD_NEW;

    if (!email || !newPassword) {
        console.error('Missing email or password');
        process.exit(1);
    }

    const user = await prisma.user.findUnique({
        where: { email: email },
    });

    if (!user) {
        console.error('User not found:', email);
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
        where: { email: email },
        data: { passwordHash: hashedPassword },
    });

    console.log('Password changed for:', user.email);
    await prisma.\$disconnect();
}

changePassword().catch(console.error);
"

        echo -e "${GREEN}✓ Password changed for: $EMAIL${NC}"
        ;;

    list-users)
        echo -e "${YELLOW}Listing all users...${NC}"

        cd "$BACKEND_DIR"
        node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            isAdmin: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    console.log('\\nUsers:');
    users.forEach((user, i) => {
        console.log(\`\${i + 1}. \${user.email} (\${user.name}) - \${user.isAdmin ? 'Admin' : 'User'}\`);
    });

    await prisma.\$disconnect();
}

listUsers().catch(console.error);
"
        ;;

    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${NC}"
        show_usage
        ;;
esac
