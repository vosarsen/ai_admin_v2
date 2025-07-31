#!/bin/bash

# Скрипт для тестирования Redis кеширования на сервере
# Использование: ./scripts/test-redis-cache.sh

echo "🧪 Тестирование Redis кеширования контекста на сервере..."
echo ""

# Тестовые данные
TEST_PHONE="+79001234567"
TEST_COMPANY_ID="962302"
CACHE_KEY="full_context:${TEST_COMPANY_ID}:${TEST_PHONE}"

# SSH команда
SSH_CMD="ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219"

echo "1️⃣ Проверка подключения к Redis..."
$SSH_CMD "redis-cli -a \$REDIS_PASSWORD ping" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Redis подключен"
else
    echo "❌ Не удалось подключиться к Redis"
    exit 1
fi

echo ""
echo "2️⃣ Очистка старого кеша..."
$SSH_CMD "redis-cli -a \$REDIS_PASSWORD del ${CACHE_KEY}" 2>/dev/null
echo "✅ Кеш очищен"

echo ""
echo "3️⃣ Проверка что кеш пуст..."
RESULT=$($SSH_CMD "redis-cli -a \$REDIS_PASSWORD get ${CACHE_KEY}" 2>/dev/null)
if [ "$RESULT" == "(nil)" ]; then
    echo "✅ Кеш пуст"
else
    echo "❌ Кеш не пуст!"
fi

echo ""
echo "4️⃣ Тестовое сохранение в кеш..."
TEST_DATA='{"test":"data","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}'
$SSH_CMD "redis-cli -a \$REDIS_PASSWORD setex ${CACHE_KEY} 43200 '${TEST_DATA}'" 2>/dev/null
echo "✅ Данные сохранены"

echo ""
echo "5️⃣ Проверка TTL..."
TTL=$($SSH_CMD "redis-cli -a \$REDIS_PASSWORD ttl ${CACHE_KEY}" 2>/dev/null)
echo "✅ TTL: ${TTL} секунд (~$((TTL/3600)) часов)"

echo ""
echo "6️⃣ Проверка чтения из кеша..."
CACHED=$($SSH_CMD "redis-cli -a \$REDIS_PASSWORD get ${CACHE_KEY}" 2>/dev/null)
if [ -n "$CACHED" ] && [ "$CACHED" != "(nil)" ]; then
    echo "✅ Данные успешно прочитаны из кеша"
    echo "   Размер: ${#CACHED} байт"
else
    echo "❌ Не удалось прочитать данные из кеша"
fi

echo ""
echo "7️⃣ Очистка тестовых данных..."
$SSH_CMD "redis-cli -a \$REDIS_PASSWORD del ${CACHE_KEY}" 2>/dev/null
echo "✅ Тестовые данные удалены"

echo ""
echo "8️⃣ Проверка ключей контекста..."
CONTEXT_KEYS=$($SSH_CMD "redis-cli -a \$REDIS_PASSWORD keys 'full_context:*' | wc -l" 2>/dev/null)
echo "📊 Найдено кешированных контекстов: ${CONTEXT_KEYS}"

echo ""
echo "✅ Тестирование завершено!"
echo ""
echo "💡 Для мониторинга в реальном времени используйте:"
echo "   $SSH_CMD \"redis-cli -a \\\$REDIS_PASSWORD monitor | grep full_context\""