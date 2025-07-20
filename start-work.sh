#!/bin/bash

# AI Admin v2 - Quick Start Script
# Этот скрипт поможет быстро начать работу и получить полный контекст

echo "🚀 AI Admin v2 - Быстрый старт работы"
echo "====================================="
echo ""

# 1. Проверка git статуса
echo "📋 Git статус:"
git status --short
echo ""

# 2. Проверка Redis туннеля
echo "🔴 Redis туннель:"
./scripts/maintain-redis-tunnel.sh status
echo ""

# 3. Показать текущие задачи
echo "📝 Текущие задачи из TASK.md:"
echo "----------------------------"
grep -A 5 "^### 🔴 High Priority" TASK.md | head -10
echo ""

# 4. Последние изменения
echo "📊 Последние коммиты:"
git log --oneline -5
echo ""

# 5. Проверка сервера
echo "🖥️  Статус сервисов на сервере:"
ssh ai-admin-server "pm2 status" 2>/dev/null || echo "❌ SSH недоступен"
echo ""

# 6. Показать последнюю запись из дневника
echo "📔 Последняя запись в дневнике разработки:"
if [ -d "docs/development-diary" ]; then
    LAST_ENTRY=$(ls docs/development-diary/*.md 2>/dev/null | grep -v README | sort -r | head -1)
    if [ -n "$LAST_ENTRY" ]; then
        echo "- $(basename "$LAST_ENTRY" .md | sed 's/-/ /g')"
    fi
fi
echo ""

# 7. Напоминание о важных файлах
echo "📚 Важные файлы для контекста:"
echo "- CLAUDE.md - инструкции и текущий статус"
echo "- TASK.md - список задач"
echo "- RECOMMENDATIONS.md - рекомендации по улучшению"
echo "- docs/TROUBLESHOOTING.md - решение проблем"
echo "- docs/guides/AI_ADMIN_FEATURES_CHECKLIST.md - чек-лист функций"
echo "- docs/development-diary/ - история разработки"
echo ""

# 7. Последние ошибки (если есть)
echo "⚠️  Последние известные проблемы:"
grep -A 2 "^### Pending" CLAUDE.md | head -5
echo ""

# 8. Быстрые команды
echo "🛠️  Полезные команды:"
echo "-------------------"
cat << 'EOF'
# Запустить Redis туннель:
./scripts/maintain-redis-tunnel.sh start

# Отправить тестовое сообщение:
node test-webhook.js "текст сообщения"

# Проверить логи на сервере:
ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 50"

# Синхронизировать с GitHub и перезапустить:
git push && ssh ai-admin-server "cd /opt/ai-admin && git pull && pm2 restart all"

# Проверить health API:
curl -s http://46.149.70.219:3000/health | jq .
EOF
echo ""

echo "✅ Готово к работе!"
echo ""
echo "💡 Совет: Начните с прочтения CLAUDE.md для полного контекста"