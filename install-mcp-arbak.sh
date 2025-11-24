#!/bin/bash

# Автоматическая установка MCP для Арбака
# Запускать из папки проекта: ~/Documents/GitHub/ai_admin_v2

echo "🚀 Установка MCP серверов для AI Admin v2"
echo ""

# Проверка что мы в правильной папке
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: запусти скрипт из папки проекта ai_admin_v2"
    exit 1
fi

# Распаковка архива (если нужна)
if [ ! -d "mcp" ]; then
    echo "📦 Распаковка MCP серверов..."
    if [ -f ~/Downloads/mcp-servers-complete.zip ]; then
        unzip -q -o ~/Downloads/mcp-servers-complete.zip
        echo "✅ Архив распакован"
    else
        echo "⚠️ MCP папка не найдена и архив тоже"
    fi
fi

# Установка зависимостей
if [ -d "mcp" ]; then
    echo ""
    echo "📦 Установка зависимостей для каждого MCP сервера..."
    cd mcp

    for dir in mcp-*/; do
        if [ -d "$dir" ]; then
            echo "  Installing $dir..."
            cd "$dir"
            npm install --silent 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "  ✅ $dir установлен"
            else
                echo "  ⚠️ Проблема с $dir"
            fi
            cd ..
        fi
    done

    # test-simple тоже нужен
    if [ -d "test-simple" ]; then
        echo "  Installing test-simple..."
        cd test-simple
        npm install --silent 2>/dev/null
        echo "  ✅ test-simple установлен"
        cd ..
    fi

    cd ..
fi

# Создание конфигов с ПРАВИЛЬНЫМИ переменными из env-complete-arbak.txt
echo ""
echo "⚙️ Создание конфигурационных файлов..."

# WhatsApp
cat > mcp/mcp-whatsapp/.env << 'EOF'
API_URL=http://46.149.70.219:3000
API_TOKEN=sk_venom_webhook_3553
COMPANY_ID=962302
EOF
echo "  ✅ WhatsApp конфиг создан"

# Redis (с паролем!)
cat > mcp/mcp-redis/.env << 'EOF'
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg=
EOF
echo "  ✅ Redis конфиг создан"

# Logs
cat > mcp/mcp-logs/.env << EOF
SSH_KEY=/Users/$USER/.ssh/id_ed25519_ai_admin
SSH_HOST=root@46.149.70.219
PM2_PATH=/opt/ai-admin
EOF
echo "  ✅ Logs конфиг создан"

# Supabase (с правильным URL и ключом!)
cat > mcp/mcp-supabase/.env << 'EOF'
SUPABASE_URL=https://yazteodihdglhoxgqunp.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhenRlb2RpaGRnbGhveGdxdW5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI5NTQ3NywiZXhwIjoyMDU5ODcxNDc3fQ.43Hq1KlOaTnkhddnybWZWgKlbHGK0FCuhytXVTUBhgY
EOF
echo "  ✅ Supabase конфиг создан"

# YClients
cat > mcp/mcp-yclients/.env << 'EOF'
YCLIENTS_BEARER_TOKEN=cfjbs9dpuseefh8ed5cp
YCLIENTS_USER_TOKEN=16e0dffa0d71350dcb83381e03e7af29
YCLIENTS_PARTNER_ID=8444
YCLIENTS_COMPANY_ID=962302
EOF
echo "  ✅ YClients конфиг создан"

# Проверка SSH ключа
echo ""
echo "🔑 Проверка SSH ключа..."
if [ -f ~/.ssh/id_ed25519_ai_admin ]; then
    echo "  ✅ SSH ключ найден"
    chmod 600 ~/.ssh/id_ed25519_ai_admin
else
    echo "  ⚠️ SSH ключ не найден в ~/.ssh/id_ed25519_ai_admin"
    echo "     Получи файл id_ed25519_ai_admin_brother и установи:"
    echo "     cp ~/Downloads/id_ed25519_ai_admin_brother ~/.ssh/id_ed25519_ai_admin"
    echo "     chmod 600 ~/.ssh/id_ed25519_ai_admin"
fi

# Проверка Redis туннеля
echo ""
echo "🔄 Проверка Redis туннеля..."
if pgrep -f "ssh.*6380:localhost:6379" > /dev/null; then
    echo "  ✅ Redis туннель уже запущен"
else
    echo "  ⚠️ Redis туннель не запущен"
    echo "     Запусти его командой: ./scripts/maintain-redis-tunnel.sh start"
fi

# Финальная проверка
echo ""
echo "🎯 Установка завершена!"
echo ""
echo "📝 Теперь в Claude Code проверь работу MCP:"
echo '   Используй mcp__test-simple__echo с message:"test"'
echo ""
echo "⚠️ Не забудь:"
echo "  1. Установить SSH ключ если его нет"
echo "  2. Запустить Redis туннель: ./scripts/maintain-redis-tunnel.sh start"
echo "  3. Тестировать только на номере: 89686484488"
echo ""
echo "✅ MCP серверы готовы к работе!"