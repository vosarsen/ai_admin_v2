// Тестовый скрипт для проверки напоминаний с несколькими услугами
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

// Тестовые данные: одна услуга
console.log('=== ТЕСТ 1: Одна услуга ===\n');
const singleServiceData = {
  clientName: 'Иван',
  time: '14:00',
  staff: 'Сергей',
  price: 1500,
  address: 'Малаховка, Южная улица, 38',
  date: '15 октября',
  servicesWithDeclensions: [
    {
      id: 1,
      title: 'Мужская стрижка',
      cost: 1500,
      declensions: {
        nominative: 'мужская стрижка',
        genitive: 'мужской стрижки',
        dative: 'мужской стрижке',
        accusative: 'мужскую стрижку',
        instrumental: 'мужской стрижкой',
        prepositional: 'мужской стрижке',
        prepositional_na: 'мужскую стрижку'
      }
    }
  ],
  staffDeclensions: {
    nominative: 'Сергей',
    genitive: 'Сергея',
    dative: 'Сергею',
    accusative: 'Сергея',
    instrumental: 'Сергеем',
    prepositional: 'Сергее',
    prepositional_u: 'у Сергея'
  }
};

const dayBeforeMsg1 = generateDayBeforeReminder(singleServiceData);
console.log('Напоминание за день:');
console.log(dayBeforeMsg1);
console.log('\n---\n');

const twoHoursMsg1 = generateTwoHoursReminder(singleServiceData);
console.log('Напоминание за 2 часа:');
console.log(twoHoursMsg1);
console.log('\n===================\n\n');

// Тестовые данные: несколько услуг
console.log('=== ТЕСТ 2: Несколько услуг ===\n');
const multiServiceData = {
  clientName: 'Александр',
  time: '16:30',
  staff: 'Али',
  price: 3500,
  address: 'Малаховка, Южная улица, 38',
  date: '16 октября',
  servicesWithDeclensions: [
    {
      id: 1,
      title: 'Мужская стрижка',
      cost: 1500,
      declensions: {
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
      id: 2,
      title: 'Моделирование бороды',
      cost: 1000,
      declensions: {
        nominative: 'моделирование бороды',
        genitive: 'моделирования бороды',
        dative: 'моделированию бороды',
        accusative: 'моделирование бороды',
        instrumental: 'моделированием бороды',
        prepositional: 'моделировании бороды',
        prepositional_na: 'моделирование бороды'
      }
    },
    {
      id: 3,
      title: 'Укладка',
      cost: 1000,
      declensions: {
        nominative: 'укладка',
        genitive: 'укладки',
        dative: 'укладке',
        accusative: 'укладку',
        instrumental: 'укладкой',
        prepositional: 'укладке',
        prepositional_na: 'укладку'
      }
    }
  ],
  staffDeclensions: {
    nominative: 'Али',
    genitive: 'Али',
    dative: 'Али',
    accusative: 'Али',
    instrumental: 'Али',
    prepositional: 'Али',
    prepositional_u: 'у Али'
  }
};

const dayBeforeMsg2 = generateDayBeforeReminder(multiServiceData);
console.log('Напоминание за день:');
console.log(dayBeforeMsg2);
console.log('\n---\n');

const twoHoursMsg2 = generateTwoHoursReminder(multiServiceData);
console.log('Напоминание за 2 часа:');
console.log(twoHoursMsg2);
console.log('\n===================\n\n');

// Тестовые данные: без склонений
console.log('=== ТЕСТ 3: Без склонений (фоллбэк) ===\n');
const noDeclinationsData = {
  clientName: 'Мария',
  time: '11:00',
  staff: 'Виктор',
  price: 2000,
  address: 'Малаховка, Южная улица, 38',
  date: '17 октября',
  servicesWithDeclensions: [
    {
      id: 1,
      title: 'Женская стрижка',
      cost: 2000,
      declensions: null
    }
  ]
};

const dayBeforeMsg3 = generateDayBeforeReminder(noDeclinationsData);
console.log('Напоминание за день:');
console.log(dayBeforeMsg3);
console.log('\n---\n');

const twoHoursMsg3 = generateTwoHoursReminder(noDeclinationsData);
console.log('Напоминание за 2 часа:');
console.log(twoHoursMsg3);
console.log('\n===================\n');
