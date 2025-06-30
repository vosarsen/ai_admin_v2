#!/bin/bash
# start-local.sh - Быстрый запуск для локальной разработки

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting AI Admin locally${NC}"
echo "============================"

# Проверка .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo -e "${RED}Please configure .env file and run again${NC}"
    exit 1
fi

# Проверка Redis
echo -e "\n${YELLOW}🔍 Checking Redis...${NC}"
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${RED}❌ Redis is not running!${NC}"
    echo "Please start Redis: redis-server"
    exit 1
fi
echo -e "${GREEN}✅ Redis is running${NC}"

# Проверка Venom-bot
echo -e "\n${YELLOW}🔍 Checking Venom-bot...${NC}"
if ! curl -s http://localhost:3001/status > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Venom-bot is not running${NC}"
    echo "Start it manually in another terminal"
else
    echo -e "${GREEN}✅ Venom-bot is running${NC}"
fi

# Установка зависимостей если нужно
if [ ! -d "node_modules" ]; then
    echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Запуск
echo -e "\n${GREEN}🎯 Starting services...${NC}"
echo "API Server: http://localhost:3000"
echo "Health Check: http://localhost:3000/health"
echo ""

# Запускаем в режиме разработки
npm run dev