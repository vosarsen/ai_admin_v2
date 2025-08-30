#!/usr/bin/env node

/**
 * Превью всех вариантов напоминаний с реальными склонениями
 */

const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

// Тестовые данные с реальными склонениями
const testData = {
  clientName: 'Александр',
  time: '15:00',
  service: 'МУЖСКАЯ СТРИЖКА',
  serviceDeclensions: {
    original: "МУЖСКАЯ СТРИЖКА",
    nominative: "мужская стрижка",
    genitive: "мужской стрижки",
    dative: "мужской стрижке",
    accusative: "мужскую стрижку",
    instrumental: "мужской стрижкой",
    prepositional: "мужской стрижке",
    prepositional_na: "мужской стрижке"
  },
  staff: 'Бари',
  price: 2000,
  address: 'Малаховка, Южная улица, 38',
  date: '30 августа'
};

// Альтернативные примеры услуг
const services = [
  {
    service: 'ДЕТСКАЯ СТРИЖКА',
    serviceDeclensions: {
      nominative: "детская стрижка",
      genitive: "детской стрижки",
      dative: "детской стрижке",
      accusative: "детскую стрижку",
      instrumental: "детской стрижкой",
      prepositional: "детской стрижке",
      prepositional_na: "детской стрижке"
    }
  },
  {
    service: 'МОДЕЛИРОВАНИЕ БОРОДЫ',
    serviceDeclensions: {
      nominative: "моделирование бороды",
      genitive: "моделирования бороды",
      dative: "моделированию бороды",
      accusative: "моделирование бороды",
      instrumental: "моделированием бороды",
      prepositional: "моделировании бороды",
      prepositional_na: "моделировании бороды"
    }
  },
  {
    service: 'СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ',
    serviceDeclensions: {
      nominative: "стрижка и моделирование бороды",
      genitive: "стрижки и моделирования бороды",
      dative: "стрижке и моделированию бороды",
      accusative: "стрижку и моделирование бороды",
      instrumental: "стрижкой и моделированием бороды",
      prepositional: "стрижке и моделировании бороды",
      prepositional_na: "стрижке и моделировании бороды"
    }
  }
];

console.log('=' .repeat(80));
console.log('ПРИМЕРЫ НАПОМИНАНИЙ ЗА ДЕНЬ (вечером)');
console.log('=' .repeat(80));

// Генерируем 5 примеров за день
for (let i = 0; i < 5; i++) {
  const serviceData = services[i % services.length];
  const data = { ...testData, ...serviceData };
  console.log(`\n--- Вариант ${i + 1} (${serviceData.service}) ---`);
  const reminder = generateDayBeforeReminder(data);
  console.log(reminder);
}

console.log('\n' + '=' .repeat(80));
console.log('ПРИМЕРЫ НАПОМИНАНИЙ ЗА 2 ЧАСА');
console.log('=' .repeat(80));

// Генерируем 5 примеров за 2 часа
for (let i = 0; i < 5; i++) {
  const serviceData = services[i % services.length];
  const data = { ...testData, ...serviceData };
  console.log(`\n--- Вариант ${i + 1} (${serviceData.service}) ---`);
  const reminder = generateTwoHoursReminder(data);
  console.log(reminder);
}

console.log('\n' + '=' .repeat(80));
console.log('ПРОВЕРКА КОНКРЕТНЫХ ПАДЕЖЕЙ');
console.log('=' .repeat(80));

// Проверяем конкретные конструкции
const checkPhrases = [
  'о записи на {service}',
  'на {service}',
  'про {service}',
  'для {service}',
  'до {service}',
  'к {service}',
  '{service} запланирована',
  'у вас {service}',
  'вас ждёт {service}',
  'начнётся {service}'
];

console.log('\nДля услуги "МУЖСКАЯ СТРИЖКА":');
checkPhrases.forEach(phrase => {
  let result = phrase;
  const declensions = testData.serviceDeclensions;
  
  result = result.replace(/на {service}/g, `на ${declensions.prepositional_na}`);
  result = result.replace(/записи на {service}/g, `записи на ${declensions.prepositional_na}`);
  result = result.replace(/про {service}/g, `про ${declensions.accusative}`);
  result = result.replace(/для {service}/g, `для ${declensions.genitive}`);
  result = result.replace(/до {service}/g, `до ${declensions.genitive}`);
  result = result.replace(/к {service}/g, `к ${declensions.dative}`);
  result = result.replace(/{service} запланирована/g, `${declensions.nominative} запланирована`);
  result = result.replace(/у вас {service}/g, `у вас ${declensions.nominative}`);
  result = result.replace(/вас ждёт {service}/g, `вас ждёт ${declensions.nominative}`);
  result = result.replace(/начнётся {service}/g, `начнётся ${declensions.nominative}`);
  result = result.replace(/{service}/g, declensions.nominative);
  
  console.log(`  ${phrase.padEnd(30)} → ${result}`);
});