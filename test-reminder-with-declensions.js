#!/usr/bin/env node

// Тестовый скрипт для проверки шаблонов напоминаний со склонениями
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

// Тестовые данные со склонениями из БД
const testBookings = [
  {
    clientName: 'Александр',
    time: '15:00',
    service: 'Мужская стрижка',
    staff: 'Сергей',
    price: 1500,
    address: 'ул. Культуры 15/11',
    // Склонения мастера Сергей
    staffDeclensions: {
      nominative: 'Сергей',
      genitive: 'Сергея',
      dative: 'Сергею',
      accusative: 'Сергея',
      instrumental: 'Сергеем',
      prepositional: 'Сергее',
      prepositional_u: 'у Сергея'
    },
    // Склонения услуги "Мужская стрижка"
    serviceDeclensions: {
      nominative: 'мужская стрижка',
      genitive: 'мужской стрижки',
      dative: 'мужской стрижке',
      accusative: 'мужскую стрижку',
      instrumental: 'мужской стрижкой',
      prepositional: 'мужской стрижке',
      prepositional_na: 'мужскую стрижку'
    }
  },
  {
    clientName: 'Дмитрий',
    time: '12:30',
    service: 'Стрижка машинкой',
    staff: 'Бари',
    price: 1000,
    address: 'ул. Культуры 15/11',
    // Склонения мастера Бари
    staffDeclensions: {
      nominative: 'Бари',
      genitive: 'Бари',
      dative: 'Бари',
      accusative: 'Бари',
      instrumental: 'Бари',
      prepositional: 'Бари',
      prepositional_u: 'у Бари'
    },
    // Склонения услуги "Стрижка машинкой"
    serviceDeclensions: {
      nominative: 'стрижка машинкой',
      genitive: 'стрижки машинкой',
      dative: 'стрижке машинкой',
      accusative: 'стрижку машинкой',
      instrumental: 'стрижкой машинкой',
      prepositional: 'стрижке машинкой',
      prepositional_na: 'стрижку машинкой'
    }
  },
  {
    clientName: 'Роман',
    time: '18:00',
    service: 'Моделирование бороды',
    staff: 'Али',
    price: 800,
    address: 'ул. Культуры 15/11',
    // Склонения мастера Али
    staffDeclensions: {
      nominative: 'Али',
      genitive: 'Али',
      dative: 'Али',
      accusative: 'Али',
      instrumental: 'Али',
      prepositional: 'Али',
      prepositional_u: 'у Али'
    },
    // Склонения услуги "Моделирование бороды"
    serviceDeclensions: {
      nominative: 'моделирование бороды',
      genitive: 'моделирования бороды',
      dative: 'моделированию бороды',
      accusative: 'моделирование бороды',
      instrumental: 'моделированием бороды',
      prepositional: 'моделировании бороды',
      prepositional_na: 'моделирование бороды'
    }
  }
];

console.log('============================================');
console.log('НАПОМИНАНИЯ СО СКЛОНЕНИЯМИ ИЗ БД:');
console.log('============================================\n');

console.log('📅 ВЕЧЕРНИЕ НАПОМИНАНИЯ (за день):');
console.log('============================================\n');

// Генерируем примеры напоминаний за день
testBookings.forEach((booking, index) => {
  console.log(`\n--- Клиент: ${booking.clientName} ---`);
  console.log(`Услуга: ${booking.service}, Мастер: ${booking.staff}`);
  console.log('---');
  for (let i = 0; i < 3; i++) {
    console.log(`\n💬 Вариант ${i + 1}:`);
    console.log(generateDayBeforeReminder(booking));
  }
  console.log('\n' + '='.repeat(50));
});

console.log('\n\n⏰ НАПОМИНАНИЯ ЗА 2 ЧАСА:');
console.log('============================================\n');

// Генерируем примеры напоминаний за 2 часа
testBookings.forEach((booking, index) => {
  console.log(`\n--- Клиент: ${booking.clientName} ---`);
  console.log(`Услуга: ${booking.service}, Мастер: ${booking.staff}`);
  console.log('---');
  for (let i = 0; i < 3; i++) {
    console.log(`\n💬 Вариант ${i + 1}:`);
    console.log(generateTwoHoursReminder(booking));
  }
  console.log('\n' + '='.repeat(50));
});