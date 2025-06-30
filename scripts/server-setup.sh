#!/bin/bash
# scripts/server-setup.sh - Быстрая установка на новом сервере

set -e

echo "🚀 AI Admin Server Setup Script"
echo "=============================="
echo ""

# Проверка root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   exit 1
fi

# Обновление системы
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Установка базовых пакетов
echo "🔧 Installing required packages..."
apt install -y \
    curl \
    git \
    nginx \
    certbot \
    python3-certbot-nginx \
    redis-server \
    build-essential \
    ufw

# Установка Node.js
echo "📗 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PM2
echo "🔄 Installing PM2..."
npm install -g pm2

# Настройка Redis
echo "🔐 Configuring Redis..."
REDIS_PASSWORD=$(openssl rand -base64 32)
cat >> /etc/redis/redis.conf << EOF
requirepass $REDIS_PASSWORD
maxmemory 512mb
maxmemory-policy allkeys-lru
bind 127.0.0.1
EOF
systemctl restart redis-server
systemctl enable redis-server

# Создание пользователя
echo "👤 Creating application user..."
if ! id -u ai-admin > /dev/null 2>&1; then
    adduser --system --group ai-admin
fi

# Создание директорий
echo "📁 Creating directories..."
mkdir -p /opt/ai-admin
mkdir -p /opt/venom-bot
mkdir -p /backups/ai-admin
chown -R ai-admin:ai-admin /opt/ai-admin
chown -R ai-admin:ai-admin /opt/venom-bot
chown -R ai-admin:ai-admin /backups/ai-admin

# Настройка firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Создание swap (если нужно)
if [ ! -f /swapfile ]; then
    echo "💾 Creating swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Сохранение конфигурации
cat > /root/ai-admin-config.txt << EOF
AI Admin Installation Complete!
==============================

Redis Password: $REDIS_PASSWORD

Next steps:
1. Clone your repositories to /opt/ai-admin and /opt/venom-bot
2. Configure environment variables
3. Set up Nginx configuration
4. Obtain SSL certificate with certbot
5. Start services with PM2

For detailed instructions, see DEPLOYMENT_GUIDE.md
EOF

echo ""
echo "✅ Server setup complete!"
echo ""
echo "📋 Configuration saved to: /root/ai-admin-config.txt"
echo ""
echo "Next steps:"
echo "1. su - ai-admin"
echo "2. cd /opt/ai-admin"
echo "3. git clone your-repository"
echo "4. Follow DEPLOYMENT_GUIDE.md"