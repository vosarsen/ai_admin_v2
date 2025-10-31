#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки напоминаний с разными комбинациями услуг
 * Генерирует 50 случайных напоминаний и выводит их для проверки
 */

const { generateDayBeforeReminder } = require('../src/services/reminder/templates');

// Доступные услуги с полными склонениями
const availableServices = [
  {
    title: 'МУЖСКАЯ СТРИЖКА',
    declensions: {
      nominative: 'мужская стрижка',
      genitive: 'мужской стрижки',
      dative: 'мужской стрижке',
      accusative: 'мужскую стрижку',
      prepositional: 'мужской стрижке',
      prepositional_na: 'мужскую стрижку'
    },
    price: 2000
  },
  {
    title: 'ЖЕНСКАЯ СТРИЖКА',
    declensions: {
      nominative: 'женская стрижка',
      genitive: 'женской стрижки',
      dative: 'женской стрижке',
      accusative: 'женскую стрижку',
      prepositional: 'женской стрижке',
      prepositional_na: 'женскую стрижку'
    },
    price: 3000
  },
  {
    title: 'МОДЕЛИРОВАНИЕ БОРОДЫ',
    declensions: {
      nominative: 'моделирование бороды',
      genitive: 'моделирования бороды',
      dative: 'моделированию бороды',
      accusative: 'моделирование бороды',
      prepositional: 'моделировании бороды',
      prepositional_na: 'моделирование бороды'
    },
    price: 1000
  },
  {
    title: 'ДЕТСКАЯ СТРИЖКА',
    declensions: {
      nominative: 'детская стрижка',
      genitive: 'детской стрижки',
      dative: 'детской стрижке',
      accusative: 'детскую стрижку',
      prepositional: 'детской стрижке',
      prepositional_na: 'детскую стрижку'
    },
    price: 1500
  },
  {
    title: 'ОКРАШИВАНИЕ',
    declensions: {
      nominative: 'окрашивание',
      genitive: 'окрашивания',
      dative: 'окрашиванию',
      accusative: 'окрашивание',
      prepositional: 'окрашивании',
      prepositional_na: 'окрашивание'
    },
    price: 5000
  },
  {
    title: 'МАНИКЮР',
    declensions: {
      nominative: 'маникюр',
      genitive: 'маникюра',
      dative: 'маникюру',
      accusative: 'маникюр',
      prepositional: 'маникюре',
      prepositional_na: 'маникюр'
    },
    price: 2500
  },
  {
    title: 'ПЕДИКЮР',
    declensions: {
      nominative: 'педикюр',
      genitive: 'педикюра',
      dative: 'педикюру',
      accusative: 'педикюр',
      prepositional: 'педикюре',
      prepositional_na: 'педикюр'
    },
    price: 3000
  }
];

const clientNames = ['Иван', 'Мария', 'Александр', 'Елена', 'Дмитрий', 'Ольга', 'Сергей', 'Анна'];
const staffNames = ['Сергей', 'Бари', 'Али', 'Марина', 'Ольга'];
const times = ['10:00', '12:00', '14:30', '16:00', '18:30', '20:00'];

// Функция для случайного выбора элемента
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Функция для генерации случайного набора услуг
function generateRandomServices() {
  const scenarios = [
    // 1 услуга, количество 1
    () => {
      const service = randomChoice(availableServices);
      return { services: [service], count: 1 };
    },
    // 1 услуга, количество 2
    () => {
      const service = randomChoice(availableServices);
      return { services: [service, service], count: 2 };
    },
    // 1 услуга, количество 3
    () => {
      const service = randomChoice(availableServices);
      return { services: [service, service, service], count: 3 };
    },
    // 2 разные услуги
    () => {
      const service1 = randomChoice(availableServices);
      let service2 = randomChoice(availableServices);
      // Убеждаемся что услуги разные
      while (service2.title === service1.title) {
        service2 = randomChoice(availableServices);
      }
      return { services: [service1, service2], count: 2 };
    },
    // 3 разные услуги
    () => {
      const services = [];
      const titles = new Set();
      while (services.length < 3) {
        const service = randomChoice(availableServices);
        if (!titles.has(service.title)) {
          services.push(service);
          titles.add(service.title);
        }
      }
      return { services, count: 3 };
    },
    // 2 одинаковые + 1 другая
    () => {
      const service1 = randomChoice(availableServices);
      let service2 = randomChoice(availableServices);
      while (service2.title === service1.title) {
        service2 = randomChoice(availableServices);
      }
      return { services: [service1, service1, service2], count: 3 };
    }
  ];

  return randomChoice(scenarios)();
}

// Генерация тестовых данных
function generateTestReminder(index) {
  const { services } = generateRandomServices();
  const clientName = randomChoice(clientNames);
  const staffName = randomChoice(staffNames);
  const time = randomChoice(times);

  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

  const data = {
    clientName,
    time,
    staff: staffName,
    price: totalPrice,
    address: 'Малаховка, Южная улица, 1 (напротив ТЦ Малаховский)',
    servicesWithDeclensions: services,
    staffDeclensions: {
      nominative: staffName,
      genitive: staffName === 'Сергей' ? 'Сергея' : staffName,
      dative: staffName === 'Сергей' ? 'Сергею' : staffName,
      accusative: staffName === 'Сергей' ? 'Сергея' : staffName,
      prepositional_u: `у ${staffName === 'Сергей' ? 'Сергея' : staffName}`
    }
  };

  return {
    index,
    services: services.map(s => s.title),
    reminder: generateDayBeforeReminder(data)
  };
}

// Генерируем и выводим 50 напоминаний
console.log('═══════════════════════════════════════════════════════════════');
console.log('  ТЕСТ ГЕНЕРАЦИИ НАПОМИНАНИЙ - 50 СЛУЧАЙНЫХ КОМБИНАЦИЙ');
console.log('═══════════════════════════════════════════════════════════════\n');

for (let i = 1; i <= 50; i++) {
  const { index, services, reminder } = generateTestReminder(i);

  console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│ ТЕСТ #${index.toString().padStart(2, '0')} │ Услуги: ${services.join(', ')}`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
  console.log(reminder);
  console.log('');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  ТЕСТИРОВАНИЕ ЗАВЕРШЕНО');
console.log('═══════════════════════════════════════════════════════════════');
console.log('\nПРОВЕРЬТЕ:');
console.log('  1. Правильность склонений услуг');
console.log('  2. Корректность множественного числа (2/3 услуги)');
console.log('  3. Отсутствие орфографических ошибок');
console.log('  4. Логичность фраз');
console.log('  5. Правильность окончаний прилагательных (мужскИе, а не мужскЫе)');
