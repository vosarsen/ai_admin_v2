// Финальная демонстрация напоминаний с разным количеством услуг
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('./src/services/reminder/templates');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  ДЕМОНСТРАЦИЯ НАПОМИНАНИЙ - ФИНАЛЬНАЯ ВЕРСИЯ              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ========================================
// ПРИМЕР 1: Одна услуга
// ========================================
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│ 📌 ПРИМЕР 1: ОДНА УСЛУГА                                │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const example1 = {
  clientName: 'Иван',
  time: '14:00',
  staff: 'Сергей',
  price: 1500,
  address: 'Малаховка, Южная улица, 38',
  date: '23 октября',
  servicesWithDeclensions: [{
    title: 'Мужская стрижка',
    declensions: {
      nominative: 'мужская стрижка',
      accusative: 'мужскую стрижку',
      prepositional_na: 'мужскую стрижку'
    }
  }],
  staffDeclensions: {
    nominative: 'Сергей',
    prepositional_u: 'у Сергея'
  }
};

console.log('🔔 НАПОМИНАНИЕ ЗА ДЕНЬ:\n');
console.log(generateDayBeforeReminder(example1));
console.log('\n' + '─'.repeat(60) + '\n');
console.log('⏰ НАПОМИНАНИЕ ЗА 2 ЧАСА:\n');
console.log(generateTwoHoursReminder(example1));
console.log('\n' + '═'.repeat(60) + '\n\n');

// ========================================
// ПРИМЕР 2: Две услуги
// ========================================
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│ 📌 ПРИМЕР 2: ДВЕ УСЛУГИ                                 │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const example2 = {
  clientName: 'Александр',
  time: '16:00',
  staff: 'Али',
  price: 2500,
  address: 'Малаховка, Южная улица, 38',
  date: '23 октября',
  servicesWithDeclensions: [
    {
      title: 'Мужская стрижка',
      declensions: {
        nominative: 'мужская стрижка',
        accusative: 'мужскую стрижку',
        prepositional_na: 'мужскую стрижку'
      }
    },
    {
      title: 'Моделирование бороды',
      declensions: {
        nominative: 'моделирование бороды',
        accusative: 'моделирование бороды',
        prepositional_na: 'моделирование бороды'
      }
    }
  ],
  staffDeclensions: {
    nominative: 'Али',
    prepositional_u: 'у Али'
  }
};

console.log('🔔 НАПОМИНАНИЕ ЗА ДЕНЬ:\n');
console.log(generateDayBeforeReminder(example2));
console.log('\n' + '─'.repeat(60) + '\n');
console.log('⏰ НАПОМИНАНИЕ ЗА 2 ЧАСА:\n');
console.log(generateTwoHoursReminder(example2));
console.log('\n' + '═'.repeat(60) + '\n\n');

// ========================================
// ПРИМЕР 3: Три услуги
// ========================================
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│ 📌 ПРИМЕР 3: ТРИ УСЛУГИ                                 │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const example3 = {
  clientName: 'Дмитрий',
  time: '18:30',
  staff: 'Сергей',
  price: 3500,
  address: 'Малаховка, Южная улица, 38',
  date: '23 октября',
  servicesWithDeclensions: [
    {
      title: 'Мужская стрижка',
      declensions: {
        nominative: 'мужская стрижка',
        accusative: 'мужскую стрижку',
        prepositional_na: 'мужскую стрижку'
      }
    },
    {
      title: 'Моделирование бороды',
      declensions: {
        nominative: 'моделирование бороды',
        accusative: 'моделирование бороды',
        prepositional_na: 'моделирование бороды'
      }
    },
    {
      title: 'Укладка',
      declensions: {
        nominative: 'укладка',
        accusative: 'укладку',
        prepositional_na: 'укладку'
      }
    }
  ],
  staffDeclensions: {
    nominative: 'Сергей',
    prepositional_u: 'у Сергея'
  }
};

console.log('🔔 НАПОМИНАНИЕ ЗА ДЕНЬ:\n');
console.log(generateDayBeforeReminder(example3));
console.log('\n' + '─'.repeat(60) + '\n');
console.log('⏰ НАПОМИНАНИЕ ЗА 2 ЧАСА:\n');
console.log(generateTwoHoursReminder(example3));
console.log('\n' + '═'.repeat(60) + '\n\n');

// ========================================
// ПРИМЕР 4: Четыре услуги
// ========================================
console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│ 📌 ПРИМЕР 4: ЧЕТЫРЕ УСЛУГИ (ПОЛНЫЙ КОМПЛЕКС)            │');
console.log('└─────────────────────────────────────────────────────────┘\n');

const example4 = {
  clientName: 'Михаил',
  time: '12:00',
  staff: 'Али',
  price: 5000,
  address: 'Малаховка, Южная улица, 38',
  date: '23 октября',
  servicesWithDeclensions: [
    {
      title: 'Мужская стрижка',
      declensions: {
        nominative: 'мужская стрижка',
        accusative: 'мужскую стрижку',
        prepositional_na: 'мужскую стрижку'
      }
    },
    {
      title: 'Моделирование бороды',
      declensions: {
        nominative: 'моделирование бороды',
        accusative: 'моделирование бороды',
        prepositional_na: 'моделирование бороды'
      }
    },
    {
      title: 'Укладка',
      declensions: {
        nominative: 'укладка',
        accusative: 'укладку',
        prepositional_na: 'укладку'
      }
    },
    {
      title: 'Тонирование волос',
      declensions: {
        nominative: 'тонирование волос',
        accusative: 'тонирование волос',
        prepositional_na: 'тонирование волос'
      }
    }
  ],
  staffDeclensions: {
    nominative: 'Али',
    prepositional_u: 'у Али'
  }
};

console.log('🔔 НАПОМИНАНИЕ ЗА ДЕНЬ:\n');
console.log(generateDayBeforeReminder(example4));
console.log('\n' + '─'.repeat(60) + '\n');
console.log('⏰ НАПОМИНАНИЕ ЗА 2 ЧАСА:\n');
console.log(generateTwoHoursReminder(example4));
console.log('\n' + '═'.repeat(60) + '\n\n');

// ========================================
// ИТОГИ
// ========================================
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  ✅ КЛЮЧЕВЫЕ ОСОБЕННОСТИ                                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log('✓ Естественное форматирование через запятую с "и"');
console.log('✓ Все услуги в правильных падежах');
console.log('✓ Компактно и легко читается');
console.log('✓ Случайные шаблоны для разнообразия');
console.log('✓ Сохраняет естественный поток предложения\n');
