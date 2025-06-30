#!/bin/bash
# deploy-to-server.sh - Автоматический деплой на сервер

set -e

# Конфигурация
SERVER_USER="ai-admin"
SERVER_HOST="your-server-ip"
SERVER_PATH="/opt/ai-admin/ai_admin_v2"
BRANCH="main"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 AI Admin Deployment Script${NC}"
echo "================================"

# Проверка параметров
if [ "$1" == "--help" ]; then
    echo "Usage: ./deploy-to-server.sh [options]"
    echo ""
    echo "Options:"
    echo "  --production    Deploy to production server"
    echo "  --staging       Deploy to staging server"
    echo "  --rollback      Rollback to previous version"
    echo ""
    exit 0
fi

# Определение окружения
if [ "$1" == "--production" ]; then
    SERVER_HOST="your-production-server"
    echo -e "${RED}⚠️  Deploying to PRODUCTION${NC}"
elif [ "$1" == "--staging" ]; then
    SERVER_HOST="your-staging-server"
    echo -e "${YELLOW}📦 Deploying to STAGING${NC}"
else
    echo -e "${YELLOW}📦 Deploying to DEFAULT server: $SERVER_HOST${NC}"
fi

# Функция для выполнения команд на сервере
remote_exec() {
    ssh $SERVER_USER@$SERVER_HOST "$1"
}

# Проверка соединения
echo -e "\n${YELLOW}🔍 Checking server connection...${NC}"
if ! ssh -q $SERVER_USER@$SERVER_HOST exit; then
    echo -e "${RED}❌ Cannot connect to server${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Connection successful${NC}"

# Создание бэкапа
echo -e "\n${YELLOW}💾 Creating backup...${NC}"
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
remote_exec "cd $SERVER_PATH && tar -czf ../$BACKUP_NAME.tar.gz . --exclude=node_modules --exclude=logs"
echo -e "${GREEN}✅ Backup created: $BACKUP_NAME.tar.gz${NC}"

# Обновление кода
echo -e "\n${YELLOW}📥 Pulling latest code...${NC}"
remote_exec "cd $SERVER_PATH && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH"

# Проверка изменений в package.json
echo -e "\n${YELLOW}📦 Checking dependencies...${NC}"
if remote_exec "cd $SERVER_PATH && git diff HEAD@{1} HEAD --name-only | grep -q package.json"; then
    echo "Package.json changed, installing dependencies..."
    remote_exec "cd $SERVER_PATH && npm ci --production"
else
    echo "No dependency changes"
fi

# Проверка изменений в конфигурации
echo -e "\n${YELLOW}⚙️  Checking configuration...${NC}"
if remote_exec "cd $SERVER_PATH && git diff HEAD@{1} HEAD --name-only | grep -q '.env.example'"; then
    echo -e "${YELLOW}⚠️  .env.example changed! Please check if you need to update .env${NC}"
    read -p "Continue deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
fi

# Запуск миграций базы данных (если есть)
if remote_exec "test -f $SERVER_PATH/scripts/migrate.js"; then
    echo -e "\n${YELLOW}🗄️  Running database migrations...${NC}"
    remote_exec "cd $SERVER_PATH && node scripts/migrate.js"
fi

# Очистка кэша Redis (опционально)
read -p "Clear Redis cache? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🧹 Clearing Redis cache...${NC}"
    remote_exec "cd $SERVER_PATH && node scripts/clean-redis.js"
fi

# Перезапуск приложения
echo -e "\n${YELLOW}🔄 Restarting application...${NC}"
remote_exec "pm2 restart ecosystem.config.js"

# Проверка здоровья
echo -e "\n${YELLOW}❤️  Checking application health...${NC}"
sleep 5

# Ждём запуска
for i in {1..10}; do
    if curl -f -s "http://$SERVER_HOST/health" > /dev/null; then
        echo -e "${GREEN}✅ Application is healthy${NC}"
        break
    else
        if [ $i -eq 10 ]; then
            echo -e "${RED}❌ Health check failed!${NC}"
            echo -e "${YELLOW}🔙 Rolling back...${NC}"
            remote_exec "cd $SERVER_PATH/.. && tar -xzf $BACKUP_NAME.tar.gz -C $SERVER_PATH"
            remote_exec "pm2 restart ecosystem.config.js"
            exit 1
        fi
        echo "Waiting for application to start... ($i/10)"
        sleep 3
    fi
done

# Показать статус
echo -e "\n${YELLOW}📊 Application status:${NC}"
remote_exec "pm2 status"

# Показать последние логи
echo -e "\n${YELLOW}📜 Recent logs:${NC}"
remote_exec "pm2 logs --lines 20 --nostream"

# Очистка старых бэкапов
echo -e "\n${YELLOW}🧹 Cleaning old backups...${NC}"
remote_exec "cd $SERVER_PATH/.. && ls -t backup_*.tar.gz | tail -n +6 | xargs -r rm"

echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Check application at http://$SERVER_HOST"
echo "2. Monitor logs: ssh $SERVER_USER@$SERVER_HOST 'pm2 logs'"
echo "3. Check metrics: http://$SERVER_HOST/api/metrics"

# Отправка уведомления (опционально)
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    MESSAGE="🚀 AI Admin deployed successfully to $SERVER_HOST"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="$MESSAGE" > /dev/null
fi