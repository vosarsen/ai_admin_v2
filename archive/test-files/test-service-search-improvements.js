#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки улучшений поиска услуг
 * Проверяет работу ServiceMatcher с различными запросами
 */

require('dotenv').config();
const serviceMatcher = require('./src/services/ai-admin-v2/modules/service-matcher');
const logger = require('./src/utils/logger').child({ module: 'test-service-search' });

// Тестовые услуги из реальной базы
const testServices = [
  { id: 73, title: 'ДЕТСКАЯ СТРИЖКА', price: 1800, category: 'Стрижки' },
  { id: 42, title: 'МУЖСКАЯ СТРИЖКА', price: 2000, category: 'Стрижки' },
  { id: 44, title: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА', price: 1200, category: 'Стрижки' },
  { id: 45, title: 'СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ', price: 1800, category: 'Стрижки' },
  { id: 46, title: 'СТРИЖКА НОЖНИЦАМИ', price: 2800, category: 'Стрижки' },
  { id: 47, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price: 3800, category: 'Стрижки' },
  { id: 48, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ТОНИРОВАНИЕ', price: 5000, category: 'Стрижки' },
  { id: 49, title: 'ОТЕЦ + СЫН', price: 3500, category: 'Стрижки' },
  { id: 50, title: 'МОДЕЛИРОВАНИЕ БОРОДЫ', price: 2000, category: 'Борода' },
  { id: 51, title: 'БРИТЬЕ', price: 2500, category: 'Борода' },
];

// Тестовые запросы
const testQueries = [
  // Проблемные кейсы из документации
  { query: 'детская', expected: 'ДЕТСКАЯ СТРИЖКА' },
  { query: 'а детская сколько стоит', expected: 'ДЕТСКАЯ СТРИЖКА' },
  { query: 'детская стрижка', expected: 'ДЕТСКАЯ СТРИЖКА' },
  { query: 'ребенок', expected: 'ДЕТСКАЯ СТРИЖКА' },
  { query: 'сын', expected: 'ОТЕЦ + СЫН или ДЕТСКАЯ СТРИЖКА' },
  
  // Синонимы
  { query: 'подстричься', expected: 'МУЖСКАЯ СТРИЖКА или любая стрижка' },
  { query: 'подстричь', expected: 'МУЖСКАЯ СТРИЖКА или любая стрижка' },
  { query: 'постричься', expected: 'МУЖСКАЯ СТРИЖКА или любая стрижка' },
  
  // Борода
  { query: 'борода', expected: 'МОДЕЛИРОВАНИЕ БОРОДЫ' },
  { query: 'убрать бороду', expected: 'МОДЕЛИРОВАНИЕ БОРОДЫ' },
  { query: 'оформить бороду', expected: 'МОДЕЛИРОВАНИЕ БОРОДЫ' },
  
  // Комплексные
  { query: 'стрижка и борода', expected: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ' },
  { query: 'полный комплекс', expected: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ТОНИРОВАНИЕ' },
  
  // Описательные
  { query: 'недорого', expected: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА' },
  { query: 'быстро', expected: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА' },
  { query: 'самое дешевое', expected: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА' },
];

console.log('🧪 Тестирование поиска услуг\n');
console.log('=' .repeat(80));

let passedTests = 0;
let failedTests = 0;

// Тестируем каждый запрос
testQueries.forEach((test, index) => {
  console.log(`\n📝 Тест ${index + 1}: "${test.query}"`);
  console.log(`   Ожидается: ${test.expected}`);
  
  const result = serviceMatcher.findBestMatch(test.query, testServices);
  
  if (result) {
    console.log(`   ✅ Найдено: ${result.title} (${result.price}₽)`);
    
    // Проверяем, соответствует ли результат ожиданиям
    const isExpected = test.expected.includes(result.title) || 
                       test.expected.includes('любая стрижка') && result.title.includes('СТРИЖКА');
    
    if (isExpected) {
      console.log(`   ✅ ТЕСТ ПРОЙДЕН`);
      passedTests++;
    } else {
      console.log(`   ⚠️  НЕОЖИДАННЫЙ РЕЗУЛЬТАТ`);
      failedTests++;
    }
  } else {
    console.log(`   ❌ Ничего не найдено`);
    console.log(`   ❌ ТЕСТ ПРОВАЛЕН`);
    failedTests++;
  }
  
  // Показываем топ-3 для анализа
  const top3 = serviceMatcher.findTopMatches(test.query, testServices, 3);
  if (top3.length > 0) {
    console.log(`   Топ-3 результата:`);
    top3.forEach((service, i) => {
      console.log(`     ${i + 1}. ${service.title} (${service.price}₽)`);
    });
  }
});

console.log('\n' + '=' .repeat(80));
console.log(`\n📊 ИТОГИ ТЕСТИРОВАНИЯ:`);
console.log(`   ✅ Пройдено: ${passedTests} из ${testQueries.length}`);
console.log(`   ❌ Провалено: ${failedTests} из ${testQueries.length}`);
console.log(`   📈 Успешность: ${Math.round(passedTests / testQueries.length * 100)}%`);

// Тестируем поиск нескольких услуг (для SHOW_PRICES)
console.log('\n' + '=' .repeat(80));
console.log('\n🔍 Тест поиска всех стрижек (для SHOW_PRICES):');

const haircutServices = serviceMatcher.findTopMatches('стрижка', testServices, 10);
console.log(`Найдено ${haircutServices.length} услуг:`);
haircutServices.forEach((service, i) => {
  console.log(`  ${i + 1}. ${service.title}: ${service.price}₽`);
});

process.exit(failedTests > 0 ? 1 : 0);