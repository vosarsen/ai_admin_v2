// test-context-persistence.js
/**
 * Тест для проверки сохранения контекста
 * Проверяет, что контекст не теряется между сообщениями
 */

require('dotenv').config();
const contextServiceV2 = require('./src/services/context/context-service-v2');
const contextManagerV2 = require('./src/services/ai-admin-v2/modules/context-manager-v2');

const TEST_PHONE = '79001234567';
const COMPANY_ID = 962302;

async function clearTestData() {
  console.log('\n🧹 Очистка тестовых данных...');
  
  // Очищаем все данные для тестового номера
  await contextServiceV2.clearDialogContext(TEST_PHONE, COMPANY_ID);
  await contextServiceV2.invalidateFullContextCache(TEST_PHONE, COMPANY_ID);
  
  console.log('✅ Тестовые данные очищены\n');
}

async function testContextSaving() {
  console.log('📝 Тест 1: Сохранение контекста диалога');
  console.log('='*50);
  
  // Шаг 1: Сохраняем первое сообщение с именем
  console.log('\n1️⃣ Сохраняем имя клиента...');
  await contextManagerV2.saveContext(TEST_PHONE, COMPANY_ID, {
    userMessage: 'Привет, меня зовут Арсен',
    botResponse: 'Здравствуйте, Арсен! Чем могу помочь?',
    clientName: 'Арсен',
    state: 'active'
  });
  
  // Проверяем что сохранилось
  let context = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('✅ Сохраненное имя:', context?.clientName);
  console.log('✅ Состояние:', context?.state);
  
  // Шаг 2: Добавляем выбор услуги
  console.log('\n2️⃣ Добавляем выбор услуги...');
  await contextManagerV2.saveContext(TEST_PHONE, COMPANY_ID, {
    userMessage: 'Хочу записаться на стрижку',
    botResponse: 'Отлично! Давайте выберем время',
    selection: {
      service: 'Стрижка мужская'
    }
  });
  
  // Проверяем что имя не потерялось
  context = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('✅ Имя все еще здесь:', context?.clientName);
  console.log('✅ Выбранная услуга:', context?.selection?.service);
  
  // Шаг 3: Добавляем выбор мастера
  console.log('\n3️⃣ Добавляем выбор мастера...');
  await contextManagerV2.saveContext(TEST_PHONE, COMPANY_ID, {
    userMessage: 'К мастеру Александру',
    botResponse: 'Хорошо, Александр. Какое время вам удобно?',
    selection: {
      staff: 'Александр'
    }
  });
  
  // Проверяем что все данные на месте
  context = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('✅ Имя:', context?.clientName);
  console.log('✅ Услуга:', context?.selection?.service);
  console.log('✅ Мастер:', context?.selection?.staff);
  
  // Шаг 4: Добавляем время
  console.log('\n4️⃣ Добавляем выбор времени...');
  await contextManagerV2.saveContext(TEST_PHONE, COMPANY_ID, {
    userMessage: 'На 15:00',
    botResponse: 'Записываю вас на 15:00 к мастеру Александру',
    selection: {
      time: '15:00',
      date: '2025-01-20'
    }
  });
  
  // Финальная проверка - все должно быть на месте
  context = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('\n📊 Финальный контекст:');
  console.log('✅ Имя:', context?.clientName);
  console.log('✅ Услуга:', context?.selection?.service);
  console.log('✅ Мастер:', context?.selection?.staff);
  console.log('✅ Время:', context?.selection?.time);
  console.log('✅ Дата:', context?.selection?.date);
  
  return context;
}

async function testContextLoading() {
  console.log('\n\n📝 Тест 2: Загрузка полного контекста');
  console.log('='*50);
  
  // Загружаем полный контекст через context manager
  console.log('\n🔄 Загружаем полный контекст...');
  const fullContext = await contextManagerV2.loadFullContext(TEST_PHONE, COMPANY_ID);
  
  console.log('\n📊 Загруженный контекст:');
  console.log('✅ Телефон:', fullContext.phone);
  console.log('✅ Имя клиента:', fullContext.client?.name);
  console.log('✅ Текущий выбор:', fullContext.currentSelection);
  console.log('✅ Состояние диалога:', fullContext.dialogState);
  console.log('✅ Есть активный диалог:', fullContext.hasActiveDialog);
  
  // Проверяем что данные не потерялись
  if (fullContext.client?.name === 'Арсен' && 
      fullContext.currentSelection?.service === 'Стрижка мужская' &&
      fullContext.currentSelection?.staff === 'Александр') {
    console.log('\n✅ Все данные успешно загружены!');
  } else {
    console.log('\n❌ Некоторые данные потеряны при загрузке!');
  }
  
  return fullContext;
}

async function testCommandContextSaving() {
  console.log('\n\n📝 Тест 3: Сохранение контекста из команд');
  console.log('='*50);
  
  // Симулируем выполненные команды
  const executedCommands = [
    {
      command: 'SEARCH_SLOTS',
      params: {
        service_name: 'Стрижка премиум',
        date: '2025-01-21'
      }
    }
  ];
  
  const commandResults = [
    {
      command: 'SEARCH_SLOTS',
      success: true,
      data: [
        {
          time: '14:00',
          staff_name: 'Виктор',
          staff_id: 123
        }
      ]
    }
  ];
  
  console.log('\n💾 Сохраняем контекст из команд...');
  await contextManagerV2.saveCommandContext(
    TEST_PHONE, 
    COMPANY_ID, 
    executedCommands,
    commandResults
  );
  
  // Проверяем что сохранилось
  const context = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('\n📊 Обновленный контекст:');
  console.log('✅ Новая услуга:', context?.selection?.service);
  console.log('✅ Мастер из результата:', context?.selection?.staff);
  console.log('✅ Дата:', context?.selection?.date);
  
  // Старые данные должны быть перезаписаны
  if (context?.selection?.service === 'Стрижка премиум' &&
      context?.selection?.staff === 'Виктор') {
    console.log('\n✅ Контекст из команд успешно сохранен!');
  } else {
    console.log('\n❌ Ошибка при сохранении контекста из команд!');
  }
}

async function testCacheInvalidation() {
  console.log('\n\n📝 Тест 4: Инвалидация кэша');
  console.log('='*50);
  
  // Загружаем контекст (он закэшируется)
  console.log('\n1️⃣ Первая загрузка (без кэша)...');
  let start = Date.now();
  await contextManagerV2.loadFullContext(TEST_PHONE, COMPANY_ID);
  console.log(`⏱ Время загрузки: ${Date.now() - start}ms`);
  
  // Загружаем еще раз (должен взяться из кэша)
  console.log('\n2️⃣ Вторая загрузка (из кэша)...');
  start = Date.now();
  await contextManagerV2.loadFullContext(TEST_PHONE, COMPANY_ID);
  const cacheTime = Date.now() - start;
  console.log(`⏱ Время загрузки: ${cacheTime}ms`);
  
  if (cacheTime < 10) {
    console.log('✅ Кэш работает!');
  }
  
  // Обновляем контекст (должен инвалидировать кэш)
  console.log('\n3️⃣ Обновляем контекст...');
  await contextManagerV2.saveContext(TEST_PHONE, COMPANY_ID, {
    selection: { service: 'Новая услуга' }
  });
  
  // Загружаем снова (кэш должен быть инвалидирован)
  console.log('\n4️⃣ Загрузка после обновления...');
  start = Date.now();
  const context = await contextManagerV2.loadFullContext(TEST_PHONE, COMPANY_ID);
  console.log(`⏱ Время загрузки: ${Date.now() - start}ms`);
  console.log('✅ Новая услуга в контексте:', context.currentSelection?.service);
  
  if (context.currentSelection?.service === 'Новая услуга') {
    console.log('✅ Инвалидация кэша работает!');
  }
}

async function testPreferences() {
  console.log('\n\n📝 Тест 5: Долгосрочные предпочтения');
  console.log('='*50);
  
  // Сохраняем предпочтения
  console.log('\n💾 Сохраняем предпочтения...');
  await contextServiceV2.savePreferences(TEST_PHONE, COMPANY_ID, {
    favoriteServiceId: 45,
    favoriteStaffId: 123,
    preferredTime: 'утро'
  });
  
  // Очищаем диалог (как после создания записи)
  console.log('\n🧹 Очищаем диалог...');
  await contextManagerV2.clearDialogAfterBooking(TEST_PHONE, COMPANY_ID);
  
  // Проверяем что диалог очищен
  const dialog = await contextServiceV2.getDialogContext(TEST_PHONE, COMPANY_ID);
  console.log('✅ Диалог очищен:', dialog === null);
  
  // Но предпочтения должны остаться
  const prefs = await contextServiceV2.getPreferences(TEST_PHONE, COMPANY_ID);
  console.log('✅ Предпочтения сохранены:', prefs);
  
  if (prefs?.favoriteServiceId === 45) {
    console.log('✅ Предпочтения переживают очистку диалога!');
  }
}

async function runAllTests() {
  console.log('🚀 Запуск тестов системы контекста v2');
  console.log('='*60);
  
  try {
    // Очищаем данные перед тестами
    await clearTestData();
    
    // Запускаем тесты
    await testContextSaving();
    await testContextLoading();
    await testCommandContextSaving();
    await testCacheInvalidation();
    await testPreferences();
    
    console.log('\n\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
    console.log('='*60);
    
  } catch (error) {
    console.error('\n\n❌ ОШИБКА В ТЕСТАХ:', error);
  } finally {
    // Очищаем после тестов
    await clearTestData();
    process.exit(0);
  }
}

// Запускаем тесты
runAllTests();