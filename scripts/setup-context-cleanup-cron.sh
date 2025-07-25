#!/bin/bash
# Скрипт для настройки cron задания для очистки старых контекстов

# Путь к проекту
PROJECT_DIR="/opt/ai-admin"

# Создаем cron задание для запуска каждый день в 3:00 ночи
CRON_JOB="0 3 * * * cd $PROJECT_DIR && /usr/bin/node scripts/cleanup-old-contexts.js --days=30 >> logs/context-cleanup.log 2>&1"

# Проверяем, существует ли уже такая задача
if crontab -l 2>/dev/null | grep -q "cleanup-old-contexts.js"; then
    echo "Cron job for context cleanup already exists"
else
    # Добавляем новую задачу
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job for context cleanup has been added"
    echo "It will run daily at 3:00 AM"
fi

# Показываем текущие cron задачи
echo ""
echo "Current cron jobs:"
crontab -l | grep -E "(ai-admin|cleanup-old-contexts)" || echo "No AI Admin cron jobs found"