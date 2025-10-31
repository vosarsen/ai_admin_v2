#!/bin/bash

echo "🚀 Настройка окружения для разработки AI Admin v2"
echo ""

# Проверка .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Попросите у команды файл .env.for-team и переименуйте его в .env"
    exit 1
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
npm install

# Создание локальных папок
echo "📁 Создание необходимых папок..."
mkdir -p logs
mkdir -p temp
mkdir -p baileys_sessions

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📚 Полезные команды:"
echo "  ./scripts/sync-for-team.sh  - Получить последние изменения"
echo "  npm run dev                  - Запустить в режиме разработки"
echo "  npm test                     - Запустить тесты"
echo ""
echo "📖 Документация:"
echo "  docs/ARCHITECTURE.md         - Архитектура проекта"
echo "  CLAUDE.md                    - Краткая справка"
echo ""
echo "⚠️  Важно: Всегда работайте в ветке feature/redis-context-cache"