// test-intent-detection-v2.js
// Улучшенное тестирование определения интентов в AI Admin v2

require('dotenv').config();
const AIAdminV2 = require('./src/services/ai-admin-v2');
const logger = require('./src/utils/logger');

// Цветной вывод для лучшей читаемости
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Тестовые кейсы для определения интентов
const testCases = [
  // Интент: Запись
  {
    category: 'Запись на услугу',
    tests: [
      { message: 'хочу записаться', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'можно записаться на стрижку?', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'записать меня к барберу', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'нужна запись на завтра', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'хочу прийти на маникюр', expectedCommand: 'SEARCH_SLOTS' }
    ]
  },
  // Интент: Отмена
  {
    category: 'Отмена записи',
    tests: [
      { message: 'хочу отменить запись', expectedCommand: 'none', expectedText: 'отмен' },
      { message: 'отмена записи', expectedCommand: 'none', expectedText: 'отмен' },
      { message: 'отменяю встречу', expectedCommand: 'none', expectedText: 'отмен' },
      { message: 'не приду', expectedCommand: 'none', expectedText: 'отмен' },
      { message: 'отменить все', expectedCommand: 'none', expectedText: 'отмен' }
    ]
  },
  // Интент: Проверка времени
  {
    category: 'Проверка слотов',
    tests: [
      { message: 'свободно завтра?', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'есть время в пятницу?', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'когда можно записаться?', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'покажи свободные окна', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'что есть на выходных?', expectedCommand: 'SEARCH_SLOTS' }
    ]
  },
  // Интент: Цены
  {
    category: 'Запрос цен',
    tests: [
      { message: 'сколько стоит стрижка?', expectedCommand: 'SHOW_PRICES' },
      { message: 'какие цены?', expectedCommand: 'SHOW_PRICES' },
      { message: 'прайс-лист', expectedCommand: 'SHOW_PRICES' },
      { message: 'цена маникюра', expectedCommand: 'SHOW_PRICES' }
    ]
  },
  // Интент: Портфолио
  {
    category: 'Портфолио',
    tests: [
      { message: 'покажи работы', expectedCommand: 'SHOW_PORTFOLIO' },
      { message: 'фото работ мастера', expectedCommand: 'SHOW_PORTFOLIO' },
      { message: 'примеры стрижек', expectedCommand: 'SHOW_PORTFOLIO' },
      { message: 'посмотреть портфолио', expectedCommand: 'SHOW_PORTFOLIO' },
      { message: 'есть фото?', expectedCommand: 'SHOW_PORTFOLIO' }
    ]
  },
  // Сложные кейсы
  {
    category: 'Временные конструкции',
    tests: [
      { message: 'можно в пятницу утром?', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'запиши на выходных', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'вечером сегодня свободно?', expectedCommand: 'SEARCH_SLOTS' }
    ]
  },
  // Разговорная речь
  {
    category: 'Разговорная речь',
    tests: [
      { message: 'че по ценам?', expectedCommand: 'SHOW_PRICES' },
      { message: 'скок щас стрижка?', expectedCommand: 'SHOW_PRICES' },
      { message: 'запиши плз', expectedCommand: 'SEARCH_SLOTS' },
      { message: 'када можна прийти?', expectedCommand: 'SEARCH_SLOTS' }
    ]
  }
];

// Главная функция тестирования
async function runIntentTests() {
  console.log(`\n${colors.cyan}=== Тестирование определения интентов AI Admin v2 ===${colors.reset}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let failedCases = [];
  
  // Создаем экземпляр AI Admin v2
  const aiAdmin = new AIAdminV2();
  
  // Тестируем каждую категорию
  for (const category of testCases) {
    console.log(`\n${colors.blue}📋 ${category.category}:${colors.reset}`);
    
    for (const test of category.tests) {
      totalTests++;
      
      try {
        // Вызываем processMessage и получаем полный результат
        const result = await aiAdmin.processMessage(
          test.message,
          '79000000001', // тестовый номер
          509113 // ID тестовой компании
        );
        
        // Проверяем выполненные команды
        let passed = false;
        let detectedCommand = 'none';
        
        if (result.executedCommands && result.executedCommands.length > 0) {
          detectedCommand = result.executedCommands[0].command;
          passed = detectedCommand === test.expectedCommand;
        } else if (test.expectedCommand === 'none') {
          // Для команд без действий проверяем текст
          if (test.expectedText && result.response.toLowerCase().includes(test.expectedText)) {
            passed = true;
          }
        } else {
          passed = false;
        }
        
        if (passed) {
          passedTests++;
          console.log(`  ${colors.green}✓${colors.reset} "${test.message}" → ${detectedCommand}`);
        } else {
          failedTests++;
          failedCases.push({
            message: test.message,
            expected: test.expectedCommand,
            actual: detectedCommand,
            response: result.response.substring(0, 100) + '...'
          });
          console.log(`  ${colors.red}✗${colors.reset} "${test.message}" → ${detectedCommand} (ожидалось: ${test.expectedCommand})`);
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failedTests++;
        console.log(`  ${colors.red}✗${colors.reset} "${test.message}" → Ошибка: ${error.message}`);
      }
    }
  }
  
  // Итоговая статистика
  console.log(`\n${colors.cyan}=== Результаты тестирования ===${colors.reset}`);
  console.log(`Всего тестов: ${totalTests}`);
  console.log(`${colors.green}Успешных: ${passedTests} (${Math.round(passedTests/totalTests*100)}%)${colors.reset}`);
  console.log(`${colors.red}Провалено: ${failedTests} (${Math.round(failedTests/totalTests*100)}%)${colors.reset}`);
  
  // Детали провальных тестов
  if (failedCases.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Детали провальных тестов:${colors.reset}`);
    failedCases.forEach((fail, index) => {
      console.log(`\n${index + 1}. Сообщение: "${fail.message}"`);
      console.log(`   Ожидалось: ${fail.expected}`);
      console.log(`   Получено: ${fail.actual}`);
      console.log(`   Ответ AI: ${fail.response}`);
    });
  }
  
  // Оценка
  const score = Math.round(passedTests / totalTests * 10);
  console.log(`\n${colors.magenta}Оценка: ${score}/10${colors.reset}`);
  
  if (score >= 9) {
    console.log(`${colors.green}✅ Отличный результат! Система хорошо определяет интенты.${colors.reset}`);
  } else if (score >= 7) {
    console.log(`${colors.yellow}⚠️  Хороший результат, но есть что улучшить.${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Требуется доработка системы определения интентов.${colors.reset}`);
  }
}

// Запуск тестов
runIntentTests().catch(console.error);