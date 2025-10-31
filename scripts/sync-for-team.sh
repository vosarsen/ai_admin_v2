#!/bin/bash

# Скрипт для быстрой синхронизации с GitHub для команды
# Использование: ./scripts/sync-for-team.sh

echo "🔄 Синхронизация с GitHub..."

# Сохранить текущие изменения
git stash

# Получить последние изменения
git pull origin feature/redis-context-cache

# Восстановить локальные изменения (если были)
if git stash list | grep -q "stash@{0}"; then
    echo "📦 Восстановление локальных изменений..."
    git stash pop
fi

echo "✅ Синхронизация завершена!"
echo ""
echo "Для отправки своих изменений используйте:"
echo "  git add ."
echo "  git commit -m 'описание изменений'"
echo "  git push origin feature/redis-context-cache"