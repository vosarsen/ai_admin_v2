#!/bin/bash
# Миграция VPS Москва → Санкт-Петербург
# Usage: ./scripts/migrate-vps-msk-to-spb.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Миграция VPS: Москва → Санкт-Петербург"
echo ""

# Конфигурация
MSK_HOST="82.97.248.146"  # Московский VPS
SPB_HOST="188.225.45.57"  # Питерский VPS (замените на реальный!)
SSH_KEY="$HOME/.ssh/id_ed25519_ai_admin"

echo "📋 Конфигурация:"
echo "   Источник (МСК): $MSK_HOST"
echo "   Назначение (СПБ): $SPB_HOST"
echo ""

# Проверка доступности серверов
echo "1️⃣ Проверка доступности серверов..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 root@"$MSK_HOST" "echo 'OK'" > /dev/null 2>&1; then
  echo -e "${RED}❌ Московский VPS недоступен!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Московский VPS доступен${NC}"

if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 root@"$SPB_HOST" "echo 'OK'" > /dev/null 2>&1; then
  echo -e "${RED}❌ Питерский VPS недоступен!${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Питерский VPS доступен${NC}"

echo ""
echo "2️⃣ Подготовка питерского VPS..."

# Установка необходимых пакетов на СПБ VPS
ssh -i "$SSH_KEY" root@"$SPB_HOST" << 'ENDSSH'
set -e

echo "   Обновление системы..."
apt update > /dev/null 2>&1

echo "   Установка Node.js 20..."
if ! command -v node > /dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt install -y nodejs > /dev/null 2>&1
fi

echo "   Установка PM2..."
if ! command -v pm2 > /dev/null 2>&1; then
  npm install -g pm2 > /dev/null 2>&1
fi

echo "   Установка Redis..."
if ! command -v redis-server > /dev/null 2>&1; then
  apt install -y redis-server > /dev/null 2>&1
  systemctl enable redis-server > /dev/null 2>&1
  systemctl start redis-server > /dev/null 2>&1
fi

echo "   Установка Git..."
if ! command -v git > /dev/null 2>&1; then
  apt install -y git > /dev/null 2>&1
fi

echo "   Создание директории /opt/ai-admin..."
mkdir -p /opt/ai-admin

echo "✅ Подготовка завершена"
ENDSSH

echo -e "${GREEN}✅ Питерский VPS подготовлен${NC}"

echo ""
echo "3️⃣ Копирование данных (это может занять 10-30 минут)..."
echo ""

# Копирование основных файлов
echo "   📁 Копирование кода приложения..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  --exclude 'node_modules' \
  --exclude 'baileys_sessions' \
  --exclude '.git' \
  root@"$MSK_HOST":/opt/ai-admin/ \
  /tmp/ai-admin-backup/

echo ""
echo "   📤 Загрузка на питерский VPS..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  /tmp/ai-admin-backup/ \
  root@"$SPB_HOST":/opt/ai-admin/

# Копирование Baileys sessions отдельно (важно!)
echo ""
echo "   🔐 Копирование WhatsApp сессий..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  root@"$MSK_HOST":/opt/ai-admin/baileys_sessions/ \
  /tmp/baileys_sessions_backup/

rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  /tmp/baileys_sessions_backup/ \
  root@"$SPB_HOST":/opt/ai-admin/baileys_sessions/

echo ""
echo "   📄 Копирование .env файла..."
scp -i "$SSH_KEY" \
  root@"$MSK_HOST":/opt/ai-admin/.env \
  /tmp/.env.backup

scp -i "$SSH_KEY" \
  /tmp/.env.backup \
  root@"$SPB_HOST":/opt/ai-admin/.env

echo -e "${GREEN}✅ Данные скопированы${NC}"

echo ""
echo "4️⃣ Установка зависимостей на питерском VPS..."
ssh -i "$SSH_KEY" root@"$SPB_HOST" << 'ENDSSH'
set -e
cd /opt/ai-admin

echo "   Установка npm пакетов..."
npm install --production > /dev/null 2>&1

echo "   Настройка прав..."
chown -R root:root /opt/ai-admin

echo "✅ Зависимости установлены"
ENDSSH

echo -e "${GREEN}✅ Зависимости установлены${NC}"

echo ""
echo "5️⃣ Очистка временных файлов..."
rm -rf /tmp/ai-admin-backup
rm -rf /tmp/baileys_sessions_backup
rm -f /tmp/.env.backup
echo -e "${GREEN}✅ Очистка завершена${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Миграция завершена успешно!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Подключить питерский VPS к приватной сети 'Cute Crossbill'"
echo "   - В панели Timeweb → VPS → Сети → Добавить сеть"
echo ""
echo "2. Узнать IP питерского VPS в приватной сети"
echo "   ssh -i $SSH_KEY root@$SPB_HOST 'ip addr show'"
echo ""
echo "3. Узнать IP PostgreSQL в приватной сети"
echo "   (посмотреть в панели Timeweb → БД → Cute Crossbill)"
echo ""
echo "4. Обновить .env на питерском VPS:"
echo "   ssh -i $SSH_KEY root@$SPB_HOST"
echo "   nano /opt/ai-admin/.env"
echo "   # Обновить POSTGRES_HOST на IP из приватной сети"
echo ""
echo "5. Запустить приложение:"
echo "   cd /opt/ai-admin"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "6. Тест:"
echo "   pm2 logs --lines 50"
echo "   ./scripts/test-timeweb-connection.sh"
echo ""
echo "7. Переключить DNS на новый IP: $SPB_HOST"
echo ""
