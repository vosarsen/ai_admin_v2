#!/bin/bash

# Скрипт для тестирования системы подтверждений на сервере
# Запускает тест с правильными настройками Redis

echo "🚀 Запуск теста системы подтверждений на сервере..."

# Временно устанавливаем переменные окружения для сервера
export REDIS_URL=redis://default:mybrilliantpas@localhost:6379/0
export NODE_ENV=production

# Запускаем тест
node test-reminder-confirmation.js

# Возвращаем переменные обратно
unset REDIS_URL
unset NODE_ENV

echo "✅ Тест завершен"