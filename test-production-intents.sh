#!/bin/bash
# test-production-intents.sh
# Тестирование определения интентов в production

echo "🧪 Тестирование определения интентов AI Admin v2 в PRODUCTION"
echo "=================================================="
echo ""

# Функция для отправки сообщения и мониторинга результата
test_intent() {
    local message="$1"
    local expected="$2"
    local phone="79000000123"  # Тестовый номер
    
    echo -e "\n📝 Тест: \"$message\""
    echo "💡 Ожидаем: $expected"
    
    # Создаем тестовое сообщение в очереди
    ssh root@46.149.70.219 "cd /opt/ai-admin && node -e \"
        const queue = require('./src/queue/message-queue');
        queue.add({
            type: 'message',
            from: '$phone',
            body: '$message',
            timestamp: new Date().toISOString()
        }).then(() => console.log('✅ Сообщение добавлено в очередь'));
    \""
    
    # Ждем обработки
    sleep 3
    
    # Смотрим последние логи
    echo "📊 Результат:"
    ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --nostream --lines 50 | grep -A5 '$message' | grep -E '(SEARCH_SLOTS|SHOW_PRICES|CREATE_BOOKING|SHOW_PORTFOLIO|Executing command|✅)' | tail -5"
    
    echo "---"
}

# Запускаем тесты
echo "🚀 Начинаем тестирование..."

# Базовые интенты
test_intent "хочу записаться" "команда SEARCH_SLOTS"
test_intent "сколько стоит стрижка?" "команда SHOW_PRICES"
test_intent "свободно завтра?" "команда SEARCH_SLOTS с датой"
test_intent "покажи работы" "команда SHOW_PORTFOLIO"

# Разговорная речь
test_intent "че по ценам?" "команда SHOW_PRICES"
test_intent "када можна придти?" "команда SEARCH_SLOTS"
test_intent "запиши плз" "команда SEARCH_SLOTS"

# Сложные запросы
test_intent "можно на завтра к Ивану?" "команда SEARCH_SLOTS с мастером"
test_intent "есть время вечером на стрижку?" "команда SEARCH_SLOTS с временем"

echo -e "\n✅ Тестирование завершено!"
echo ""
echo "📈 Для детального анализа выполните:"
echo "ssh root@46.149.70.219 'pm2 logs ai-admin-worker-v2 --lines 200 | grep -E \"(processMessage|extractCommands|Executing command)\"'"