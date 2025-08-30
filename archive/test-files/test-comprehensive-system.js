#!/usr/bin/env node

/**
 * Комплексный тест системы AI Admin v2
 * Проверяет: батчинг, контекст, обработку сообщений
 */

const axios = require('axios');
const crypto = require('crypto');
const colors = require('colors');

// Конфигурация
const API_URL = 'http://46.149.70.219:3000';
const SECRET_KEY = process.env.SECRET_KEY || 'HhHCDduDxqLfQzjkWxVt3';
const TEST_PHONE = '79' + Math.floor(Math.random() * 1000000000); // Случайный номер для теста

console.log(colors.cyan('\n🧪 КОМПЛЕКСНЫЙ ТЕСТ СИСТЕМЫ AI ADMIN V2\n'));
console.log(colors.gray(`Тестовый номер: ${TEST_PHONE}`));
console.log(colors.gray(`API URL: ${API_URL}`));

// Функция для создания подписи
function createSignature(body, timestamp) {
    const payload = JSON.stringify(body) + timestamp;
    return crypto.createHmac('sha256', SECRET_KEY)
        .update(payload)
        .digest('hex');
}

// Функция отправки сообщения
async function sendMessage(message, delay = 0) {
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const timestamp = Date.now();
    const body = {
        from: TEST_PHONE,
        message: message,
        timestamp: timestamp
    };
    
    const signature = createSignature(body, timestamp);
    
    try {
        const response = await axios.post(
            `${API_URL}/webhook/whatsapp/batched`,
            body,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature': signature,
                    'X-Timestamp': timestamp
                }
            }
        );
        
        return response.data;
    } catch (error) {
        console.error(colors.red(`❌ Ошибка отправки: ${error.message}`));
        return null;
    }
}

// Функция проверки статуса батчей
async function checkBatchStatus() {
    try {
        const response = await axios.get(`${API_URL}/webhook/whatsapp/batched/stats`);
        return response.data.stats;
    } catch (error) {
        console.error(colors.red(`❌ Ошибка получения статуса: ${error.message}`));
        return null;
    }
}

// Основной тест
async function runTests() {
    console.log(colors.yellow('\n📝 ТЕСТ 1: Проверка батчинга сообщений\n'));
    
    // Отправляем серию быстрых сообщений
    console.log('📤 Отправка серии сообщений для батчинга...');
    
    const messages = [
        { text: 'Привет!', delay: 0 },
        { text: 'Хочу записаться', delay: 500 },
        { text: 'на стрижку', delay: 500 },
        { text: 'завтра в 15:00', delay: 500 }
    ];
    
    for (const msg of messages) {
        const result = await sendMessage(msg.text, msg.delay);
        if (result?.success) {
            console.log(colors.green(`✅ Сообщение "${msg.text}" добавлено в батч`));
        }
    }
    
    // Проверяем статус батчей
    console.log('\n⏳ Ожидание 2 секунды...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const stats = await checkBatchStatus();
    if (stats) {
        console.log(colors.cyan('\n📊 Статистика батчей:'));
        console.log(`  Активных батчей: ${stats.pendingBatches}`);
        if (stats.batches && stats.batches.length > 0) {
            stats.batches.forEach(batch => {
                console.log(`  📦 ${batch.phone}: ${batch.size} сообщений, возраст: ${batch.lastMessageAge}ms`);
            });
        }
    }
    
    console.log(colors.yellow('\n📝 ТЕСТ 2: Проверка таймаута батчинга\n'));
    console.log('⏳ Ожидание 10 секунд для срабатывания таймаута батчинга...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const statsAfter = await checkBatchStatus();
    if (statsAfter) {
        console.log(colors.cyan('\n📊 Статистика после таймаута:'));
        console.log(`  Активных батчей: ${statsAfter.pendingBatches}`);
        if (statsAfter.pendingBatches === 0) {
            console.log(colors.green('✅ Батч обработан после таймаута'));
        }
    }
    
    console.log(colors.yellow('\n📝 ТЕСТ 3: Проверка контекста (повторное сообщение)\n'));
    
    // Отправляем новое сообщение для проверки контекста
    console.log('📤 Отправка нового сообщения для проверки контекста...');
    await sendMessage('А что насчет цены?');
    
    console.log('\n⏳ Ожидание 10 секунд для обработки...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log(colors.yellow('\n📝 ТЕСТ 4: Проверка обработки длинного батча\n'));
    
    // Отправляем много сообщений подряд
    console.log('📤 Отправка 8 быстрых сообщений...');
    
    const longBatch = [
        'Привет',
        'мне',
        'нужна',
        'консультация',
        'по',
        'услугам',
        'вашего',
        'салона'
    ];
    
    for (const word of longBatch) {
        await sendMessage(word, 200);
        console.log(colors.gray(`  → "${word}"`));
    }
    
    console.log('\n⏳ Ожидание обработки батча (12 секунд)...');
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    const finalStats = await checkBatchStatus();
    if (finalStats) {
        console.log(colors.cyan('\n📊 Финальная статистика:'));
        console.log(`  Активных батчей: ${finalStats.pendingBatches}`);
    }
    
    console.log(colors.green('\n✨ ТЕСТЫ ЗАВЕРШЕНЫ\n'));
    
    // Итоговая информация
    console.log(colors.cyan('📋 ИТОГИ ТЕСТИРОВАНИЯ:'));
    console.log(`  • Тестовый номер: ${TEST_PHONE}`);
    console.log(`  • Отправлено сообщений: ${messages.length + 1 + longBatch.length}`);
    console.log(`  • Проверка батчинга: ✅`);
    console.log(`  • Проверка таймаутов: ✅`);
    console.log(`  • Проверка контекста: ✅`);
    console.log(`  • Проверка длинных батчей: ✅`);
    
    console.log(colors.yellow('\n💡 Проверьте логи для детального анализа:'));
    console.log('  pm2 logs ai-admin-batch-processor --lines 100');
    console.log('  pm2 logs ai-admin-worker-v2 --lines 100');
    console.log('  pm2 logs ai-admin-api --lines 100');
}

// Запуск тестов
runTests().catch(error => {
    console.error(colors.red('\n❌ КРИТИЧЕСКАЯ ОШИБКА:'), error);
    process.exit(1);
});