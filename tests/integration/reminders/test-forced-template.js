// Принудительно тестируем конкретный шаблон
const templates = require('./src/services/reminder/templates');

// Импортируем внутреннюю функцию напрямую
const fs = require('fs');
const templateCode = fs.readFileSync('./src/services/reminder/templates.js', 'utf-8');

// Найдем шаблон
const match = templateCode.match(/"Добрый вечер! \{name\}, завтра в \{time\} у вас запланирована \{service\} ⭐"/);

console.log('Проверяем наличие проблемного шаблона...\n');

if (match) {
  console.log('✅ Шаблон найден в коде:');
  console.log(match[0]);
  console.log('\n');
} else {
  console.log('❌ Шаблон НЕ найден в коде');
}

// Создадим мини-функцию для тестирования конкретной замены
function testReplacement() {
  const template = "Добрый вечер! {name}, завтра в {time} у вас запланирована {service} ⭐";

  const services = [
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
  ];

  // Симулируем логику из fillTemplate
  let result = template;

  // Заменяем имя и время
  result = result.replace(/{name}/g, 'Михаил');
  result = result.replace(/{time}/g, '12:00');

  console.log('='.repeat(60));
  console.log('ТЕСТ ЗАМЕНЫ:');
  console.log('='.repeat(60));
  console.log('\nИсходный шаблон:');
  console.log(template);

  // Форматируем услуги
  const formatServicesInCase = (services, caseType) => {
    if (services.length === 1) {
      return services[0].declensions[caseType] || services[0].title.toLowerCase();
    }
    const formatted = services.map(s => s.declensions[caseType] || s.title.toLowerCase());
    if (formatted.length === 2) {
      return `${formatted[0]} и ${formatted[1]}`;
    }
    const allButLast = formatted.slice(0, -1).join(', ');
    const last = formatted[formatted.length - 1];
    return `${allButLast} и ${last}`;
  };

  console.log('\n1️⃣ ПЕРВЫМ делом: "у вас запланирована {service}"');
  result = result.replace(/у вас запланирована {service}/g,
    `у вас запланирована ${formatServicesInCase(services, 'nominative')}`);
  console.log(result);

  console.log('\n✅ РЕЗУЛЬТАТ:');
  console.log(result);

  if (result.includes('мужская стрижка и моделирование бороды')) {
    console.log('\n🎉 ПРАВИЛЬНО! Именительный падеж!');
  } else if (result.includes('мужскую стрижку')) {
    console.log('\n❌ ОШИБКА! Винительный падеж вместо именительного!');
  }
}

testReplacement();
