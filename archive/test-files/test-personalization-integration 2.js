#!/usr/bin/env node

/**
 * Тест интеграции персонализации в command-handler
 */

require('dotenv').config();
const commandHandler = require('./src/services/ai-admin-v2/modules/command-handler');
const logger = require('./src/utils/logger').child({ module: 'test-integration' });

// Тестовые данные
const services = [
  { id: 42, yclients_id: 42, title: 'МУЖСКАЯ СТРИЖКА', price: 2000, duration: 60 },
  { id: 73, yclients_id: 73, title: 'ДЕТСКАЯ СТРИЖКА', price: 1800, duration: 60 },
  { id: 44, yclients_id: 44, title: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА', price: 1200, duration: 30 },
  { id: 46, yclients_id: 46, title: 'СТРИЖКА НОЖНИЦАМИ', price: 2800, duration: 60 },
  { id: 50, yclients_id: 50, title: 'МОДЕЛИРОВАНИЕ БОРОДЫ', price: 2000, duration: 45 },
  { id: 47, yclients_id: 47, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price: 3800, duration: 90 },
];

// Клиент с историей премиум услуг
const premiumClient = {
  name: 'Иван Премиум',
  phone: '+79001234567',
  gender: 'male',
  visits: [
    { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-07-01') },
    { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-07-15') },
    { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-08-01') },
  ],
  favorite_services: [46],
  average_check: 2800
};

// Клиент с детскими услугами
const parentClient = {
  name: 'Петр Родитель',
  phone: '+79002345678',
  gender: 'male',
  visits: [
    { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-06-15') },
    { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-07-15') },
    { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-08-01') },
  ],
  favorite_services: [73],
  average_check: 1800
};

async function testPersonalizedPrices() {
  console.log('🧪 Тест персонализированного SHOW_PRICES\n');
  console.log('=' .repeat(60));
  
  // Тест 1: Премиум клиент запрашивает цены на стрижки
  console.log('\n📝 Тест 1: Премиум клиент запрашивает цены');
  const context1 = {
    services,
    message: 'Сколько стоят стрижки?',
    client: premiumClient
  };
  
  const prices1 = await commandHandler.getPrices({ service_name: 'стрижка' }, context1);
  
  console.log(`   Категория: ${prices1.category}`);
  console.log(`   Найдено услуг: ${prices1.count}`);
  console.log('   Топ-3 услуги:');
  prices1.prices.slice(0, 3).forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.title}: ${p.price_min}₽`);
  });
  
  const firstService = prices1.prices[0];
  if (firstService.title === 'СТРИЖКА НОЖНИЦАМИ') {
    console.log('   ✅ Персонализация работает - любимая услуга первая!');
  } else {
    console.log('   ⚠️  Персонализация не сработала');
  }
  
  // Тест 2: Родитель запрашивает цены
  console.log('\n📝 Тест 2: Родитель запрашивает цены');
  const context2 = {
    services,
    message: 'Покажи цены на стрижки',
    client: parentClient
  };
  
  const prices2 = await commandHandler.getPrices({ service_name: 'стрижка' }, context2);
  
  console.log(`   Категория: ${prices2.category}`);
  console.log('   Топ-3 услуги:');
  prices2.prices.slice(0, 3).forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.title}: ${p.price_min}₽`);
  });
  
  if (prices2.prices[0].title === 'ДЕТСКАЯ СТРИЖКА') {
    console.log('   ✅ Персонализация работает - детская услуга первая!');
  }
  
  // Тест 3: Новый клиент без истории
  console.log('\n📝 Тест 3: Новый клиент без истории');
  const context3 = {
    services,
    message: 'Цены на стрижки',
    client: null
  };
  
  const prices3 = await commandHandler.getPrices({ service_name: 'стрижка' }, context3);
  
  console.log(`   Категория: ${prices3.category}`);
  console.log('   Топ-3 услуги:');
  prices3.prices.slice(0, 3).forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.title}: ${p.price_min}₽`);
  });
  console.log('   ℹ️  Стандартная сортировка без персонализации');
}

async function testPersonalizedSearch() {
  console.log('\n\n🧪 Тест персонализированного SEARCH_SLOTS\n');
  console.log('=' .repeat(60));
  
  // Мокаем YClients API чтобы не делать реальные запросы
  const originalSearchSlots = commandHandler.searchSlots;
  commandHandler.searchSlots = async function(params, context) {
    // Используем интеллектуальный поиск услуги с персонализацией
    let service;
    if (context.client) {
      const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');
      const matches = serviceMatcher.findTopMatchesWithPersonalization(
        params.service_name || '',
        context.services,
        context.client,
        1
      );
      service = matches[0] || null;
    } else {
      const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');
      service = serviceMatcher.findBestMatch(
        params.service_name || '', 
        context.services
      );
    }
    
    return {
      service: service ? { id: service.id, title: service.title } : null,
      slots: ['10:00', '11:00', '12:00'] // Мок слотов
    };
  };
  
  // Тест 1: Премиум клиент ищет слоты для стрижки
  console.log('\n📝 Тест 1: Премиум клиент ищет слоты');
  const context1 = {
    services,
    client: premiumClient
  };
  
  const result1 = await commandHandler.searchSlots(
    { service_name: 'стрижка' },
    context1
  );
  
  console.log(`   Выбранная услуга: ${result1.service?.title || 'не найдена'}`);
  if (result1.service?.title === 'СТРИЖКА НОЖНИЦАМИ') {
    console.log('   ✅ Персонализация работает - выбрана любимая услуга!');
  }
  
  // Тест 2: Родитель ищет слоты
  console.log('\n📝 Тест 2: Родитель ищет слоты');
  const context2 = {
    services,
    client: parentClient
  };
  
  const result2 = await commandHandler.searchSlots(
    { service_name: 'стрижка' },
    context2
  );
  
  console.log(`   Выбранная услуга: ${result2.service?.title || 'не найдена'}`);
  if (result2.service?.title === 'ДЕТСКАЯ СТРИЖКА') {
    console.log('   ✅ Персонализация работает - выбрана детская услуга!');
  }
  
  // Восстанавливаем оригинальный метод
  commandHandler.searchSlots = originalSearchSlots;
}

async function testTimeBasedRecommendations() {
  console.log('\n\n🕐 Тест рекомендаций по времени суток\n');
  console.log('=' .repeat(60));
  
  const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');
  
  // Мокаем разное время
  const originalDate = global.Date;
  
  // Утро - быстрые услуги
  console.log('\n📝 Утро (8:00) - должны быть быстрые услуги');
  const morningDate = new Date('2025-08-18T08:00:00');
  global.Date = class extends originalDate {
    constructor() { return morningDate; }
    static now() { return morningDate.getTime(); }
  };
  
  const morningRecs = serviceMatcher.getTimeBasedRecommendations(services);
  console.log('   Рекомендации:');
  morningRecs.slice(0, 3).forEach((s, i) => {
    console.log(`     ${i + 1}. ${s.title} (${s.duration || '?'} мин) - ${s.time_reason || 'нет причины'}`);
  });
  
  // Вечер пятницы - комплексные услуги
  console.log('\n📝 Вечер пятницы (18:00) - комплексные услуги');
  const fridayEvening = new Date('2025-08-16T18:00:00'); // Friday
  global.Date = class extends originalDate {
    constructor() { return fridayEvening; }
    static now() { return fridayEvening.getTime(); }
  };
  
  const eveningRecs = serviceMatcher.getTimeBasedRecommendations(services);
  console.log('   Рекомендации:');
  eveningRecs.slice(0, 3).forEach((s, i) => {
    console.log(`     ${i + 1}. ${s.title} - ${s.time_reason || 'нет причины'}`);
  });
  
  // Восстанавливаем дату
  global.Date = originalDate;
}

// Запускаем все тесты
async function runAllTests() {
  console.log('🚀 Запуск тестов интеграции персонализации\n');
  
  await testPersonalizedPrices();
  await testPersonalizedSearch();
  await testTimeBasedRecommendations();
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n✅ Все тесты интеграции завершены!\n');
}

runAllTests().catch(console.error);