#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки улучшенной команды SHOW_PRICES
 */

require('dotenv').config();
const commandHandler = require('./src/services/ai-admin-v2/modules/command-handler');

// Тестовые услуги из реальной базы
const testServices = [
  // Быстрые и недорогие
  { id: 44, title: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА', price: 1200, category_title: 'Стрижки', duration: 30 },
  { id: 45, title: 'СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ', price: 1800, category_title: 'Стрижки', duration: 45 },
  
  // Стрижки обычные
  { id: 42, title: 'МУЖСКАЯ СТРИЖКА', price: 2000, category_title: 'Стрижки', duration: 60 },
  { id: 46, title: 'СТРИЖКА НОЖНИЦАМИ', price: 2800, category_title: 'Стрижки', duration: 60 },
  
  // Детские
  { id: 73, title: 'ДЕТСКАЯ СТРИЖКА', price: 1800, category_title: 'Стрижки', duration: 60 },
  { id: 49, title: 'ОТЕЦ + СЫН', price: 3500, category_title: 'Стрижки', duration: 90 },
  
  // Борода
  { id: 50, title: 'МОДЕЛИРОВАНИЕ БОРОДЫ', price: 2000, category_title: 'Борода', duration: 45 },
  { id: 51, title: 'БРИТЬЕ', price: 2500, category_title: 'Борода', duration: 45 },
  
  // Комплексные
  { id: 47, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price: 3800, category_title: 'Комплекс', duration: 90 },
  { id: 48, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ТОНИРОВАНИЕ', price: 5000, category_title: 'Комплекс', duration: 120 },
  
  // Премиум
  { id: 52, title: 'СТРИЖКА LUXINA', price: 4500, category_title: 'Премиум', duration: 90 },
  { id: 53, title: 'VIP КОМПЛЕКС', price: 7000, category_title: 'Премиум', duration: 150 },
  
  // Другие
  { id: 54, title: 'КАМУФЛЯЖ СЕДИНЫ', price: 1500, category_title: 'Окрашивание', duration: 30 },
  { id: 55, title: 'УКЛАДКА', price: 800, category_title: 'Укладка', duration: 20 },
];

// Тестовые запросы
const testQueries = [
  { 
    query: 'Сколько стоят стрижки?',
    params: { service_name: 'стрижка' },
    expected: 'Должны показаться ВСЕ виды стрижек'
  },
  { 
    query: 'А детская сколько стоит?',
    params: { service_name: 'детская' },
    expected: 'Должна показаться детская стрижка первой'
  },
  { 
    query: 'Что есть недорого?',
    params: { service_name: 'недорого' },
    expected: 'Должны показаться услуги до 1500₽'
  },
  { 
    query: 'Покажи все услуги',
    params: {},
    expected: 'Все услуги категоризированно'
  },
  { 
    query: 'Что есть для бороды?',
    params: { service_name: 'борода' },
    expected: 'Услуги для бороды'
  },
  { 
    query: 'Комплексные услуги',
    params: { service_name: 'комплекс' },
    expected: 'Услуги с +'
  }
];

async function testShowPrices() {
  console.log('🧪 Тестирование улучшенной команды SHOW_PRICES\n');
  console.log('=' .repeat(80));
  
  for (const test of testQueries) {
    console.log(`\n📝 Запрос: "${test.query}"`);
    console.log(`   Ожидается: ${test.expected}`);
    console.log('   ' + '-'.repeat(60));
    
    // Создаем контекст для теста
    const context = {
      services: testServices,
      message: test.query,
      client: null
    };
    
    try {
      // Вызываем getPrices
      const result = await commandHandler.getPrices(test.params, context);
      
      console.log(`   ✅ Найдено: ${result.count} услуг`);
      console.log(`   📂 Категория: ${result.category}`);
      
      // Показываем первые 5 услуг
      console.log(`\n   Топ-5 услуг:`);
      result.prices.slice(0, 5).forEach((service, i) => {
        const priceStr = service.price_min === service.price_max 
          ? `${service.price_min}₽`
          : `${service.price_min}-${service.price_max}₽`;
        console.log(`     ${i + 1}. ${service.title}: ${priceStr} (${service.duration} мин)`);
      });
      
      // Показываем категоризацию если есть
      if (result.categorized) {
        console.log(`\n   📊 Категоризация:`);
        Object.entries(result.categorized).forEach(([category, services]) => {
          console.log(`     ${category}: ${services.length} услуг`);
          // Показываем первые 2 услуги в категории
          services.slice(0, 2).forEach(s => {
            const price = s.price || s.price_min || 0;
            console.log(`       • ${s.title}: ${price}₽`);
          });
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Ошибка: ${error.message}`);
    }
  }
  
  console.log('\n' + '=' .repeat(80));
  console.log('\n✅ Тестирование завершено\n');
}

// Запускаем тесты
testShowPrices().catch(console.error);