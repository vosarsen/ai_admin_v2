#!/usr/bin/env node
/**
 * Сценарий тестирования управления контекстом через WhatsApp
 * Симулирует реальные диалоги с клиентами
 */

const config = require('./src/config');
const logger = require('./src/utils/logger').child({ module: 'test-context-scenario' });

// Тестовые номера телефонов
const TEST_PHONES = {
  newClient: '79001111111',        // Новый клиент
  returningClient: '79002222222',  // Вернувшийся клиент
  continuingDialog: '79003333333'  // Продолжающий диалог
};

async function runTestScenarios() {
  logger.info('🧪 Запуск сценариев тестирования контекста...\n');
  
  console.log(`
📋 ПЛАН ТЕСТИРОВАНИЯ КОНТЕКСТА

1. НОВЫЙ КЛИЕНТ (${TEST_PHONES.newClient})
   - Отправить: "Привет"
   - Ожидаем: Приветствие без имени
   - Отправить: "Хочу записаться на стрижку"
   - Ожидаем: Вопрос об имени
   - Отправить: "Меня зовут Александр"
   - Ожидаем: Сохранение имени
   - Отправить: "Завтра в 15:00"
   - Ожидаем: Создание записи + сохранение предпочтений

2. ВЕРНУВШИЙСЯ КЛИЕНТ (${TEST_PHONES.returningClient})
   - Предварительно создать контекст с именем "Мария"
   - Отправить: "Привет"
   - Ожидаем: "Привет, Мария!" (обращение по имени)
   - Отправить: "Хочу записаться"
   - Ожидаем: Предложение любимой услуги/мастера

3. ПРОДОЛЖЕНИЕ ДИАЛОГА (${TEST_PHONES.continuingDialog})
   - Сценарий А (в течение дня):
     - Отправить: "Привет, хочу на маникюр"
     - Подождать 5 минут
     - Отправить: "Давай на 16:00"
     - Ожидаем: БЕЗ повторного приветствия
   
   - Сценарий Б (через сутки):
     - Создать старый контекст (25+ часов)
     - Отправить: "Привет"
     - Ожидаем: Приветствие с именем

4. ТЕСТ ПРЕДПОЧТЕНИЙ
   - Использовать клиента с сохраненными предпочтениями
   - Отправить: "Хочу записаться"
   - Ожидаем: "Вас интересует Мужская стрижка к Сергею?"

5. ТЕСТ ОЧИСТКИ КОНТЕКСТА
   - Запустить: node scripts/cleanup-old-contexts.js --dry-run
   - Проверить логи очистки
   - Убедиться что контексты старше 30 дней помечены для удаления
`);

  console.log('\n📱 КОМАНДЫ ДЛЯ ТЕСТИРОВАНИЯ:\n');
  
  // Команды для отправки тестовых сообщений
  for (const [scenario, phone] of Object.entries(TEST_PHONES)) {
    console.log(`# ${scenario}:`);
    console.log(`node test-webhook.js "${phone}" "Привет"`);
    console.log(`node test-webhook.js "${phone}" "Хочу записаться на стрижку"`);
    console.log(`node test-webhook.js "${phone}" "Меня зовут Тест"`);
    console.log('');
  }
  
  console.log('🔍 ПРОВЕРКА ЧЕРЕЗ MCP:\n');
  console.log('# В Claude Code используйте команды MCP:');
  console.log('@redis get_context phone:79001111111');
  console.log('@redis get_all_keys preferences:*');
  console.log('@redis get_all_keys context:*');
  console.log('');
  
  console.log('📊 МОНИТОРИНГ:\n');
  console.log('# Проверка логов:');
  console.log('ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 100 | grep -E \\"(preferences|context|Returning client)\\""\n');
  
  console.log('# Проверка сохранения в БД:');
  console.log('@supabase query_table table:dialog_contexts limit:10\n');
  
  console.log('✅ Используйте эти команды для пошагового тестирования!');
}

// Запуск
runTestScenarios();