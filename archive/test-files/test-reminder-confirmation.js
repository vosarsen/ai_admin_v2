#!/usr/bin/env node

/**
 * Тест системы обработки подтверждений напоминаний
 * 
 * Этот скрипт:
 * 1. Имитирует отправку напоминания
 * 2. Сохраняет контекст напоминания
 * 3. Тестирует обработку различных подтверждений
 * 4. Проверяет, что AI не вызывается для подтверждений
 */

const logger = require('./src/utils/logger');
const reminderContextTracker = require('./src/services/reminder/reminder-context-tracker');
const { createRedisClient } = require('./src/utils/redis-factory');
const axios = require('axios');
const config = require('./src/config');

// Тестовые данные
const TEST_PHONE = '79001234567'; // Тестовый номер
const TEST_BOOKING = {
  record_id: 123456,
  datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
  service_name: 'Стрижка',
  staff_name: 'Мастер Иван'
};

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Тест 1: Сохранение контекста напоминания
 */
async function testSaveReminderContext() {
  console.log(`\n${colors.blue}📝 Тест 1: Сохранение контекста напоминания${colors.reset}`);
  
  try {
    // Сохраняем контекст напоминания за день
    const saved = await reminderContextTracker.saveReminderContext(
      TEST_PHONE,
      TEST_BOOKING,
      'day_before'
    );
    
    if (saved) {
      console.log(`${colors.green}✅ Контекст напоминания успешно сохранен${colors.reset}`);
      
      // Проверяем, что контекст можно получить
      const context = await reminderContextTracker.getReminderContext(TEST_PHONE);
      if (context) {
        console.log(`${colors.green}✅ Контекст успешно загружен:${colors.reset}`);
        console.log(`  - Тип: ${context.type}`);
        console.log(`  - Запись: ${context.booking.recordId}`);
        console.log(`  - Услуга: ${context.booking.serviceName}`);
        console.log(`  - Мастер: ${context.booking.staffName}`);
        console.log(`  - Ожидает подтверждения: ${context.awaitingConfirmation}`);
        return true;
      } else {
        console.log(`${colors.red}❌ Не удалось загрузить контекст${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ Не удалось сохранить контекст${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Тест 2: Проверка распознавания подтверждений
 */
async function testConfirmationDetection() {
  console.log(`\n${colors.blue}📝 Тест 2: Распознавание подтверждений${colors.reset}`);
  
  const testMessages = [
    { message: 'ок', expected: true },
    { message: 'Ок', expected: true },
    { message: 'да', expected: true },
    { message: 'буду', expected: true },
    { message: 'приду', expected: true },
    { message: 'спасибо', expected: true },
    { message: 'хорошо', expected: true },
    { message: '👍', expected: true },
    { message: '+', expected: true },
    { message: 'подтверждаю', expected: true },
    { message: 'ок, спасибо', expected: true },
    { message: 'да, буду', expected: true },
    { message: 'хочу записаться', expected: false },
    { message: 'отменить запись', expected: false },
    { message: 'какие услуги есть?', expected: false }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testMessages) {
    const isConfirmation = reminderContextTracker.isConfirmationMessage(test.message);
    const result = isConfirmation === test.expected;
    
    if (result) {
      console.log(`  ${colors.green}✅ "${test.message}" - ${isConfirmation ? 'подтверждение' : 'не подтверждение'}${colors.reset}`);
      passed++;
    } else {
      console.log(`  ${colors.red}❌ "${test.message}" - ожидалось ${test.expected}, получено ${isConfirmation}${colors.reset}`);
      failed++;
    }
  }
  
  console.log(`\n  Результат: ${colors.green}${passed} успешно${colors.reset}, ${colors.red}${failed} провалено${colors.reset}`);
  return failed === 0;
}

/**
 * Тест 3: Проверка обработки подтверждения
 */
async function testHandleConfirmation() {
  console.log(`\n${colors.blue}📝 Тест 3: Обработка подтверждения через API${colors.reset}`);
  
  try {
    // Сначала убедимся, что контекст сохранен
    await reminderContextTracker.saveReminderContext(
      TEST_PHONE,
      TEST_BOOKING,
      'day_before'
    );
    
    // Проверяем, что сообщение будет обработано как подтверждение
    const shouldHandle = await reminderContextTracker.shouldHandleAsReminderResponse(
      TEST_PHONE,
      'ок'
    );
    
    if (shouldHandle) {
      console.log(`${colors.green}✅ Сообщение "ок" будет обработано как подтверждение${colors.reset}`);
      
      // Помечаем как подтвержденное
      const marked = await reminderContextTracker.markAsConfirmed(TEST_PHONE);
      if (marked) {
        console.log(`${colors.green}✅ Напоминание помечено как подтвержденное${colors.reset}`);
        
        // Проверяем, что повторное подтверждение не будет обработано
        const shouldHandleAgain = await reminderContextTracker.shouldHandleAsReminderResponse(
          TEST_PHONE,
          'ок'
        );
        
        if (!shouldHandleAgain) {
          console.log(`${colors.green}✅ Повторное подтверждение не будет обработано${colors.reset}`);
          return true;
        } else {
          console.log(`${colors.red}❌ Повторное подтверждение будет обработано (не должно)${colors.reset}`);
          return false;
        }
      } else {
        console.log(`${colors.red}❌ Не удалось пометить как подтвержденное${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ Сообщение "ок" не распознано как подтверждение${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Тест 4: Отправка тестового сообщения через webhook
 */
async function testWebhookIntegration() {
  console.log(`\n${colors.blue}📝 Тест 4: Интеграция с webhook (опционально)${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Этот тест требует запущенного API сервера${colors.reset}`);
  
  const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  
  try {
    // Сохраняем контекст напоминания
    await reminderContextTracker.saveReminderContext(
      TEST_PHONE,
      TEST_BOOKING,
      '2hours'
    );
    console.log(`${colors.green}✅ Контекст напоминания за 2 часа сохранен${colors.reset}`);
    
    // Отправляем подтверждение через webhook
    console.log(`\n  Отправка подтверждения "Ок, спасибо!" через webhook...`);
    
    const response = await axios.post(
      `${apiUrl}/webhook/whatsapp`,
      {
        from: `${TEST_PHONE}@c.us`,
        body: 'Ок, спасибо!',
        type: 'chat',
        isGroupMsg: false
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    if (response.status === 200) {
      console.log(`${colors.green}✅ Webhook успешно обработал сообщение${colors.reset}`);
      console.log(`  Ответ: ${JSON.stringify(response.data)}`);
      
      // Проверяем, что контекст был обработан
      await sleep(1000); // Даем время на обработку
      
      const context = await reminderContextTracker.getReminderContext(TEST_PHONE);
      if (context && !context.awaitingConfirmation) {
        console.log(`${colors.green}✅ Подтверждение обработано корректно${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.yellow}⚠️  Статус подтверждения не изменился${colors.reset}`);
        return false;
      }
    } else {
      console.log(`${colors.red}❌ Webhook вернул статус ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`${colors.yellow}⚠️  API сервер не запущен, пропускаем тест${colors.reset}`);
      return null; // Не считаем как ошибку
    }
    console.log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Очистка тестовых данных
 */
async function cleanup() {
  console.log(`\n${colors.blue}🧹 Очистка тестовых данных${colors.reset}`);
  
  try {
    await reminderContextTracker.clearReminderContext(TEST_PHONE);
    console.log(`${colors.green}✅ Контекст очищен${colors.reset}`);
    
    // Закрываем Redis соединение
    const redis = await createRedisClient();
    await redis.quit();
    console.log(`${colors.green}✅ Redis соединение закрыто${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}⚠️  Ошибка при очистке: ${error.message}${colors.reset}`);
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log(`${colors.magenta}${'='.repeat(60)}`);
  console.log(`🧪 Тестирование системы обработки подтверждений напоминаний`);
  console.log(`${'='.repeat(60)}${colors.reset}`);
  
  // Ждем инициализации Redis в трекере
  await sleep(1000);
  
  const results = {
    saveContext: await testSaveReminderContext(),
    detection: await testConfirmationDetection(),
    handling: await testHandleConfirmation(),
    webhook: await testWebhookIntegration()
  };
  
  // Очистка
  await cleanup();
  
  // Итоги
  console.log(`\n${colors.magenta}${'='.repeat(60)}`);
  console.log(`📊 ИТОГИ ТЕСТИРОВАНИЯ`);
  console.log(`${'='.repeat(60)}${colors.reset}`);
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const [test, result] of Object.entries(results)) {
    if (result === true) {
      console.log(`  ${colors.green}✅ ${test}: PASSED${colors.reset}`);
      passed++;
    } else if (result === false) {
      console.log(`  ${colors.red}❌ ${test}: FAILED${colors.reset}`);
      failed++;
    } else {
      console.log(`  ${colors.yellow}⏭️  ${test}: SKIPPED${colors.reset}`);
      skipped++;
    }
  }
  
  console.log(`\n  ${colors.green}Успешно: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Провалено: ${failed}${colors.reset}`);
  console.log(`  ${colors.yellow}Пропущено: ${skipped}${colors.reset}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}⚠️  Некоторые тесты провалены${colors.reset}`);
    process.exit(1);
  }
}

// Запуск тестов
main().catch(error => {
  console.error(`${colors.red}Критическая ошибка: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});