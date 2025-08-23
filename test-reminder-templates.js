#!/usr/bin/env node

// Тестирование генерации напоминаний с правильными склонениями
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

// Тестовые данные с реальными склонениями из БД
const testData = {
  clientName: 'Александр',
  time: '15:00',
  service: 'МУЖСКАЯ СТРИЖКА',
  serviceDeclensions: {
    "dative": "мужской стрижке",
    "genitive": "мужской стрижки",
    "original": "МУЖСКАЯ СТРИЖКА",
    "accusative": "мужскую стрижку",
    "nominative": "мужская стрижка",
    "instrumental": "мужской стрижкой",
    "prepositional": "мужской стрижке",
    "prepositional_na": "мужскую стрижку"
  },
  staff: 'Сергей',
  price: 1800,
  address: 'Малаховка, Южная улица, 38'
};

console.log('🔍 Тестирование шаблонов напоминаний с правильными склонениями\n');
console.log('=' .repeat(60));

// Тестируем несколько вариантов напоминаний за день
console.log('\n📅 НАПОМИНАНИЯ ЗА ДЕНЬ (5 случайных вариантов):\n');
for (let i = 0; i < 5; i++) {
  const reminder = generateDayBeforeReminder(testData);
  console.log(`Вариант ${i + 1}:`);
  console.log(reminder);
  console.log('-'.repeat(60));
}

// Тестируем несколько вариантов напоминаний за 2 часа
console.log('\n⏰ НАПОМИНАНИЯ ЗА 2 ЧАСА (5 случайных вариантов):\n');
for (let i = 0; i < 5; i++) {
  const reminder = generateTwoHoursReminder(testData);
  console.log(`Вариант ${i + 1}:`);
  console.log(reminder);
  console.log('-'.repeat(60));
}

// Тестируем с другой услугой
const testData2 = {
  clientName: 'Мария',
  time: '18:30',
  service: 'КОМПЛЕКСНЫЙ УХОД ЗА КОЖЕЙ ГОЛОВЫ | LUXINA',
  serviceDeclensions: {
    "dative": "комплексному уходу за кожей головы | LUXINA",
    "genitive": "комплексного ухода за кожей головы | LUXINA",
    "original": "КОМПЛЕКСНЫЙ УХОД ЗА КОЖЕЙ ГОЛОВЫ | LUXINA",
    "accusative": "комплексный уход за кожей головы | LUXINA",
    "nominative": "комплексный уход за кожей головы | LUXINA",
    "instrumental": "комплексным уходом за кожей головы | LUXINA",
    "prepositional": "комплексном уходе за кожей головы | LUXINA",
    "prepositional_na": "комплексном уходе за кожей головы | LUXINA"
  },
  staff: 'Бари',
  price: 2500,
  address: 'Малаховка, Южная улица, 38'
};

console.log('\n\n💇‍♀️ ТЕСТ С ДРУГОЙ УСЛУГОЙ:\n');
console.log('=' .repeat(60));

console.log('\nНапоминание за день:');
console.log(generateDayBeforeReminder(testData2));
console.log('-'.repeat(60));

console.log('\nНапоминание за 2 часа:');
console.log(generateTwoHoursReminder(testData2));

// Тестируем без склонений (fallback)
const testDataNoDecl = {
  clientName: '',
  time: '12:00',
  service: 'НОВАЯ УСЛУГА БЕЗ СКЛОНЕНИЙ',
  staff: 'Мастер',
  price: 0,
  address: 'Малаховка, Южная улица, 38'
};

console.log('\n\n⚠️ ТЕСТ БЕЗ СКЛОНЕНИЙ (fallback):\n');
console.log('=' .repeat(60));

console.log('\nНапоминание за день:');
console.log(generateDayBeforeReminder(testDataNoDecl));
console.log('-'.repeat(60));

console.log('\nНапоминание за 2 часа:');
console.log(generateTwoHoursReminder(testDataNoDecl));

console.log('\n✅ Тестирование завершено!');