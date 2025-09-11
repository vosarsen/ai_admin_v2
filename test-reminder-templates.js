#!/usr/bin/env node

// Тестовый скрипт для проверки шаблонов напоминаний
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

// Тестовые данные
const testBookings = [
  {
    clientName: 'Александр',
    time: '15:00',
    service: 'Мужская стрижка',
    staff: 'Сергей',
    price: 1500,
    address: 'ул. Культуры 15/11'
  },
  {
    clientName: 'Дмитрий',
    time: '12:30',
    service: 'Стрижка машинкой',
    staff: 'Бари',
    price: 1000,
    address: 'ул. Культуры 15/11'
  },
  {
    clientName: 'Роман',
    time: '18:00',
    service: 'Моделирование бороды',
    staff: 'Али',
    price: 800,
    address: 'ул. Культуры 15/11'
  }
];

console.log('============================================');
console.log('ПРИМЕРЫ НАПОМИНАНИЙ ЗА ДЕНЬ (вечерние):');
console.log('============================================\n');

// Генерируем 3 примера напоминаний за день для каждого клиента
testBookings.forEach((booking, index) => {
  console.log(`\n--- Клиент: ${booking.clientName} ---`);
  for (let i = 0; i < 2; i++) {
    console.log(`\nВариант ${i + 1}:`);
    console.log('---');
    console.log(generateDayBeforeReminder(booking));
    console.log('---');
  }
});

console.log('\n\n============================================');
console.log('ПРИМЕРЫ НАПОМИНАНИЙ ЗА 2 ЧАСА:');
console.log('============================================\n');

// Генерируем 3 примера напоминаний за 2 часа для каждого клиента
testBookings.forEach((booking, index) => {
  console.log(`\n--- Клиент: ${booking.clientName} ---`);
  for (let i = 0; i < 2; i++) {
    console.log(`\nВариант ${i + 1}:`);
    console.log('---');
    console.log(generateTwoHoursReminder(booking));
    console.log('---');
  }
});