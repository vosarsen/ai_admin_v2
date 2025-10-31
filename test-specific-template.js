// Тест конкретного шаблона "у вас запланирована {service}"
const { generateDayBeforeReminder } = require('./src/services/reminder/templates');

const testData = {
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

console.log('Генерируем 10 напоминаний, чтобы найти шаблон "у вас запланирована"...\n');

for (let i = 1; i <= 10; i++) {
  const msg = generateDayBeforeReminder(testData);
  const firstLine = msg.split('\n')[0];

  if (firstLine.includes('запланирована')) {
    console.log(`✅ ПОПЫТКА ${i}: НАШЛИ НУЖНЫЙ ШАБЛОН!`);
    console.log('─'.repeat(60));
    console.log(msg);
    console.log('─'.repeat(60));

    // Проверяем правильность падежа
    if (firstLine.includes('мужская стрижка') ||
        firstLine.includes('мужскую стрижку, моделирование бороды, укладка и тонирование волос')) {
      console.log('\n✅ ПРАВИЛЬНЫЙ ПАДЕЖ! (именительный)');
    } else if (firstLine.includes('мужскую стрижку')) {
      console.log('\n❌ НЕПРАВИЛЬНЫЙ ПАДЕЖ! (винительный вместо именительного)');
    }
    break;
  } else {
    console.log(`   Попытка ${i}: "${firstLine}"`);
  }
}
