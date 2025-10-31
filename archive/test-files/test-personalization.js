#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки персонализации поиска услуг
 */

require('dotenv').config();
const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');
const logger = require('./src/utils/logger').child({ module: 'test-personalization' });

// Тестовые услуги
const testServices = [
  { id: 42, title: 'МУЖСКАЯ СТРИЖКА', price: 2000, category: 'Стрижки' },
  { id: 73, title: 'ДЕТСКАЯ СТРИЖКА', price: 1800, category: 'Стрижки' },
  { id: 44, title: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА', price: 1200, category: 'Стрижки' },
  { id: 46, title: 'СТРИЖКА НОЖНИЦАМИ', price: 2800, category: 'Стрижки' },
  { id: 50, title: 'МОДЕЛИРОВАНИЕ БОРОДЫ', price: 2000, category: 'Борода' },
  { id: 47, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price: 3800, category: 'Комплекс' },
  { id: 51, title: 'БРИТЬЕ', price: 2500, category: 'Борода' },
  { id: 52, title: 'СТРИЖКА LUXINA', price: 4500, category: 'Премиум' },
  { id: 45, title: 'СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ', price: 1800, category: 'Стрижки' },
];

// Тестовые клиенты с историей
const testClients = [
  {
    name: 'Постоянный клиент премиум',
    phone: '+79001234567',
    gender: 'male',
    visits: [
      { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-07-01') },
      { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-07-15') },
      { service_id: 46, service_name: 'СТРИЖКА НОЖНИЦАМИ', date: new Date('2025-08-01') },
      { service_id: 50, service_name: 'МОДЕЛИРОВАНИЕ БОРОДЫ', date: new Date('2025-08-01') },
    ],
    favorite_services: [46], // СТРИЖКА НОЖНИЦАМИ
    average_check: 2800
  },
  {
    name: 'Эконом клиент',
    phone: '+79002345678',
    gender: 'male',
    visits: [
      { service_id: 44, service_name: 'СТРИЖКА МАШИНКОЙ', date: new Date('2025-06-01') },
      { service_id: 44, service_name: 'СТРИЖКА МАШИНКОЙ', date: new Date('2025-07-01') },
      { service_id: 44, service_name: 'СТРИЖКА МАШИНКОЙ', date: new Date('2025-08-01') },
    ],
    favorite_services: [44], // СТРИЖКА МАШИНКОЙ
    average_check: 1200
  },
  {
    name: 'Родитель с ребенком',
    phone: '+79003456789',
    gender: 'male',
    visits: [
      { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-06-15') },
      { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-07-15') },
      { service_id: 42, service_name: 'МУЖСКАЯ СТРИЖКА', date: new Date('2025-07-15') },
      { service_id: 73, service_name: 'ДЕТСКАЯ СТРИЖКА', date: new Date('2025-08-15') },
    ],
    favorite_services: [73], // ДЕТСКАЯ СТРИЖКА
    average_check: 1850
  },
  {
    name: 'Новый клиент',
    phone: '+79004567890',
    gender: 'male',
    visits: [],
    favorite_services: [],
    average_check: 0
  },
  {
    name: 'Женщина (для теста фильтрации)',
    phone: '+79005678901',
    gender: 'female',
    visits: [],
    favorite_services: [],
    average_check: 0
  }
];

// Тестовые сценарии
const testScenarios = [
  {
    name: 'Постоянный премиум клиент ищет стрижку',
    query: 'стрижка',
    client: testClients[0],
    expected: 'СТРИЖКА НОЖНИЦАМИ должна быть первой'
  },
  {
    name: 'Эконом клиент ищет стрижку',
    query: 'стрижка',
    client: testClients[1],
    expected: 'СТРИЖКА МАШИНКОЙ должна быть первой'
  },
  {
    name: 'Родитель ищет стрижку',
    query: 'стрижка',
    client: testClients[2],
    expected: 'ДЕТСКАЯ СТРИЖКА должна быть в топе'
  },
  {
    name: 'Новый клиент ищет стрижку',
    query: 'стрижка',
    client: testClients[3],
    expected: 'Популярные услуги первыми'
  },
  {
    name: 'Утренний запрос (быстрые услуги)',
    query: 'стрижка',
    client: testClients[3],
    timeOfDay: 8,
    expected: 'СТРИЖКА МАШИНКОЙ (быстрая) должна быть выше'
  },
  {
    name: 'Вечерний запрос пятницы (комплексные)',
    query: 'стрижка',
    client: testClients[0],
    dayOfWeek: 5, // Friday
    timeOfDay: 18,
    expected: 'Комплексные услуги должны быть выше'
  },
  {
    name: 'Женщина ищет услуги (фильтрация)',
    query: 'стрижка',
    client: testClients[4],
    expected: 'Мужские услуги должны быть ниже или отфильтрованы'
  }
];

console.log('🧪 Тестирование персонализации поиска услуг\n');
console.log('=' .repeat(80));

// Мокаем текущее время для тестов
const originalDate = global.Date;

testScenarios.forEach((scenario, index) => {
  console.log(`\n📝 Тест ${index + 1}: ${scenario.name}`);
  console.log(`   Запрос: "${scenario.query}"`);
  console.log(`   Клиент: ${scenario.client.name}`);
  if (scenario.timeOfDay !== undefined) {
    console.log(`   Время: ${scenario.timeOfDay}:00`);
  }
  if (scenario.dayOfWeek !== undefined) {
    console.log(`   День недели: ${scenario.dayOfWeek}`);
  }
  console.log(`   Ожидается: ${scenario.expected}`);
  console.log('   ' + '-'.repeat(60));
  
  // Мокаем время если нужно
  if (scenario.timeOfDay !== undefined || scenario.dayOfWeek !== undefined) {
    const mockDate = new Date('2025-08-16T10:00:00');
    if (scenario.timeOfDay !== undefined) {
      mockDate.setHours(scenario.timeOfDay);
    }
    if (scenario.dayOfWeek !== undefined) {
      // Устанавливаем нужный день недели
      const currentDay = mockDate.getDay();
      const diff = scenario.dayOfWeek - currentDay;
      mockDate.setDate(mockDate.getDate() + diff);
    }
    global.Date = class extends originalDate {
      constructor() {
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    };
  }
  
  // Получаем результаты с персонализацией
  const results = serviceMatcher.findTopMatchesWithPersonalization(
    scenario.query,
    testServices,
    scenario.client,
    10
  );
  
  // Восстанавливаем оригинальную дату
  global.Date = originalDate;
  
  if (results.length > 0) {
    console.log(`   ✅ Найдено ${results.length} услуг:`);
    results.slice(0, 5).forEach((service, i) => {
      const marker = service.personalization_boost ? '⭐' : '  ';
      console.log(`     ${marker} ${i + 1}. ${service.title}: ${service.price}₽ (score: ${service.final_score || 'N/A'})`);
    });
    
    // Проверяем ожидания
    const firstService = results[0];
    console.log(`\n   Результат: Первая услуга - ${firstService.title}`);
    
    // Анализ персонализации
    if (firstService.personalization_reason) {
      console.log(`   💡 Причина персонализации: ${firstService.personalization_reason}`);
    }
  } else {
    console.log(`   ❌ Ничего не найдено`);
  }
});

console.log('\n' + '=' .repeat(80));

// Тест категоризации по времени
console.log('\n🕐 Тест рекомендаций по времени суток:\n');

const timeTests = [
  { hour: 7, expected: 'Быстрые услуги' },
  { hour: 10, expected: 'Обычные услуги' },
  { hour: 13, expected: 'Обычные услуги' },
  { hour: 18, expected: 'Комплексные услуги (если пятница/суббота)' },
  { hour: 20, expected: 'Быстрые услуги' }
];

timeTests.forEach(test => {
  const mockDate = new Date('2025-08-16T10:00:00');
  mockDate.setHours(test.hour);
  
  global.Date = class extends originalDate {
    constructor() {
      return mockDate;
    }
    static now() {
      return mockDate.getTime();
    }
  };
  
  const recommendations = serviceMatcher.getTimeBasedRecommendations(testServices);
  
  console.log(`${test.hour}:00 - ${test.expected}`);
  console.log(`   Рекомендовано: ${recommendations.slice(0, 3).map(s => s.title).join(', ')}`);
});

global.Date = originalDate;

console.log('\n' + '=' .repeat(80));
console.log('\n✅ Тестирование персонализации завершено\n');