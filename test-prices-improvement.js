#!/usr/bin/env node

const path = require('path');
const commandHandler = require('./src/services/ai-admin-v2/modules/command-handler');
const formatter = require('./src/services/ai-admin-v2/modules/formatter');

// Тестовые данные услуг
const testServices = [
  { id: 1, title: 'МУЖСКАЯ СТРИЖКА', price_min: 2000, seance_length: 3600 },
  { id: 2, title: 'СТРИЖКА МАШИНКОЙ', price_min: 1500, seance_length: 1800 },
  { id: 3, title: 'СТРИЖКА НОЖНИЦАМИ', price_min: 2800, seance_length: 3600 },
  { id: 4, title: 'ДЕТСКАЯ СТРИЖКА', price_min: 1800, seance_length: 2700 },
  { id: 5, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ', price_min: 3800, seance_length: 5400 },
  { id: 6, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ВОСК', price_min: 4500, seance_length: 5400 },
  { id: 7, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ | LUXINA', price_min: 4000, seance_length: 7200 },
  { id: 8, title: 'СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)', price_min: 1500, seance_length: 1800 },
  { id: 9, title: 'СТРИЖКА МАШИНКОЙ | 1 НАСАДКА', price_min: 1200, seance_length: 1800 },
  { id: 10, title: 'СТРИЖКА ДЛЯ СТУДЕНТОВ И ШКОЛЬНИКОВ', price_min: 1800, seance_length: 2700 },
  { id: 11, title: 'СТРИЖКА | СЧАСТЛИВЫЕ ЧАСЫ', price_min: 1800, seance_length: 2700 },
  { id: 12, title: 'ОТЕЦ + СЫН (ДО 12 ЛЕТ)', price_min: 3500, seance_length: 6300 },
  { id: 13, title: 'СТРИЖКА + VOLCANO + ВОСК', price_min: 4200, seance_length: 5100 },
  { id: 14, title: 'СТРИЖКА МАШИНКОЙ + СТРИЖКА БОРОДЫ', price_min: 2500, seance_length: 3600 },
  { id: 15, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ТОНИРОВАНИЕ БОРОДЫ', price_min: 5000, seance_length: 7500 },
  { id: 16, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + VOLCANO + ВОСК', price_min: 6000, seance_length: 7800 },
  { id: 17, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ТОНИРОВАНИЕ ВОЛОС + ТОНИРОВАНИЕ БОРОДЫ', price_min: 6600, seance_length: 8700 },
  { id: 18, title: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ + ВОСК | LUXINA', price_min: 4800, seance_length: 7800 }
];

async function testPriceImprovement() {
  console.log('=== Тестирование улучшенного отображения цен ===\n');
  
  const context = {
    services: testServices,
    company: { type: 'barbershop' }
  };
  
  // Тест 1: Запрос цен на стрижку
  console.log('1. Запрос: "сколько стоит стрижка?"');
  const pricesForHaircut = await commandHandler.getPrices({ category: 'стрижка' }, context);
  console.log(`   Найдено услуг: ${pricesForHaircut.length}`);
  console.log('   Результат:');
  console.log(formatter.formatPrices(pricesForHaircut, 'barbershop'));
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Тест 2: Запрос всех цен
  console.log('2. Запрос: "какие цены?"');
  const allPrices = await commandHandler.getPrices({}, context);
  console.log(`   Найдено услуг: ${allPrices.length}`);
  console.log('   Результат:');
  console.log(formatter.formatPrices(allPrices, 'barbershop'));
  console.log('\n' + '='.repeat(60) + '\n');
  
  // Тест 3: Запрос цен на бороду
  console.log('3. Запрос: "сколько стоит борода?"');
  const pricesForBeard = await commandHandler.getPrices({ category: 'борода' }, context);
  console.log(`   Найдено услуг: ${pricesForBeard.length}`);
  console.log('   Результат:');
  console.log(formatter.formatPrices(pricesForBeard, 'barbershop'));
}

testPriceImprovement().catch(console.error);