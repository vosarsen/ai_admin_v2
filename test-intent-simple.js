// test-intent-simple.js
// Простой тест для проверки определения интентов

require('dotenv').config();
const aiAdmin = require('./src/services/ai-admin-v2'); // Используем готовый экземпляр

// Тестовые сообщения
const testMessages = [
  // Запись
  'хочу записаться',
  'можно записаться на стрижку?',
  
  // Цены
  'сколько стоит стрижка?',
  'какие цены?',
  'че по ценам?',
  
  // Время
  'свободно завтра?',
  'есть время в пятницу?',
  'можно вечером?',
  
  // Отмена
  'хочу отменить запись',
  'не смогу прийти'
];

async function testIntent() {
  console.log('🧪 Тестирование определения интентов AI Admin v2\n');
  
  for (const message of testMessages) {
    try {
      console.log(`\n📝 Сообщение: "${message}"`);
      
      const result = await aiAdmin.processMessage(
        message,
        '79000000001',
        509113
      );
      
      // Проверяем команды
      if (result.executedCommands && result.executedCommands.length > 0) {
        console.log(`✅ Команда: ${result.executedCommands.map(c => c.command).join(', ')}`);
      } else {
        console.log('❌ Команды не найдены');
      }
      
      console.log(`💬 Ответ: ${result.response.substring(0, 100)}...`);
      
      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Ошибка: ${error.message}`);
    }
  }
}

testIntent().catch(console.error);