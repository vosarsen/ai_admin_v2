#!/usr/bin/env node

/**
 * Тестирование Two-Stage процессора
 * Сравнение с ReAct по скорости и качеству
 */

require('dotenv').config();

// Простая цветная консоль без chalk
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  white: (text) => text,
  bold: {
    green: (text) => `\x1b[1m\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[1m\x1b[33m${text}\x1b[0m`
  }
};
const chalk = colors;

// Временно устанавливаем Two-Stage режим
process.env.USE_TWO_STAGE = 'true';
process.env.AI_PROMPT_VERSION = 'two-stage';

const aiAdmin = require('./src/services/ai-admin-v2');
const logger = require('./src/utils/logger').child({ module: 'test-two-stage' });

// Тестовые сценарии
const testScenarios = [
  {
    name: 'Простой запрос слотов',
    message: 'Какое время свободно на стрижку завтра?',
    expectedCommands: ['SEARCH_SLOTS']
  },
  {
    name: 'Создание записи с конкретным временем',
    message: 'Запишите меня на стрижку завтра в 15:00',
    expectedCommands: ['CREATE_BOOKING']
  },
  {
    name: 'Проверка мастера и цен',
    message: 'Работает ли Бари в пятницу? И покажите цены',
    expectedCommands: ['CHECK_STAFF_SCHEDULE', 'SHOW_PRICES']
  },
  {
    name: 'Отмена записи',
    message: 'Хочу отменить запись',
    expectedCommands: ['CANCEL_BOOKING']
  },
  {
    name: 'Простое приветствие',
    message: 'Привет!',
    expectedCommands: []
  },
  {
    name: 'Продолжение диалога',
    message: 'давайте в 14:00',
    expectedCommands: ['CREATE_BOOKING'],
    context: {
      lastService: 'стрижка',
      lastDate: 'завтра'
    }
  }
];

async function testScenario(scenario) {
  console.log(chalk.blue(`\n📋 Тест: ${scenario.name}`));
  console.log(chalk.gray(`Сообщение: "${scenario.message}"`));
  
  const startTime = Date.now();
  
  try {
    // Мокаем контекст если нужно
    if (scenario.context) {
      // Здесь можно добавить установку контекста через Redis
      console.log(chalk.gray('Контекст:', JSON.stringify(scenario.context)));
    }
    
    // Вызываем AI Admin
    const result = await aiAdmin.processMessage(
      scenario.message,
      '+79001234567',
      962302
    );
    
    const executionTime = Date.now() - startTime;
    
    // Анализируем результат
    console.log(chalk.green(`✅ Успешно за ${executionTime}ms`));
    
    // Проверяем команды
    const executedCommands = result.commands || result.executedCommands || [];
    const commandNames = executedCommands.map(c => c.command || c.name);
    
    console.log(chalk.cyan('Выполненные команды:'), commandNames.length > 0 ? commandNames : 'нет команд');
    
    // Проверяем соответствие ожиданиям
    const expectedSet = new Set(scenario.expectedCommands);
    const actualSet = new Set(commandNames);
    
    const isCorrect = scenario.expectedCommands.every(cmd => actualSet.has(cmd));
    
    if (isCorrect) {
      console.log(chalk.green('✅ Команды соответствуют ожиданиям'));
    } else {
      console.log(chalk.yellow('⚠️ Команды не соответствуют'));
      console.log(chalk.gray('Ожидалось:'), scenario.expectedCommands);
      console.log(chalk.gray('Получено:'), commandNames);
    }
    
    // Показываем ответ
    console.log(chalk.magenta('Ответ:'));
    console.log(chalk.white(result.response.substring(0, 200) + (result.response.length > 200 ? '...' : '')));
    
    return {
      success: true,
      time: executionTime,
      correctCommands: isCorrect
    };
    
  } catch (error) {
    console.log(chalk.red(`❌ Ошибка: ${error.message}`));
    return {
      success: false,
      error: error.message
    };
  }
}

async function compareWithReact() {
  console.log(chalk.yellow('\n\n🔄 Сравнение Two-Stage vs ReAct'));
  
  const testMessage = 'Хочу записаться на стрижку завтра в 15:00';
  
  // Тест Two-Stage
  console.log(chalk.blue('\n1️⃣ Two-Stage:'));
  process.env.USE_TWO_STAGE = 'true';
  process.env.USE_REACT = 'false';
  
  const twoStageStart = Date.now();
  const twoStageResult = await aiAdmin.processMessage(testMessage, '+79001234567', 962302);
  const twoStageTime = Date.now() - twoStageStart;
  
  console.log(chalk.green(`Время: ${twoStageTime}ms`));
  console.log(chalk.gray('Ответ:', twoStageResult.response.substring(0, 100)));
  
  // Тест ReAct
  console.log(chalk.blue('\n2️⃣ ReAct:'));
  process.env.USE_TWO_STAGE = 'false';
  process.env.USE_REACT = 'true';
  process.env.AI_PROMPT_VERSION = 'react-prompt';
  
  const reactStart = Date.now();
  const reactResult = await aiAdmin.processMessage(testMessage, '+79001234567', 962302);
  const reactTime = Date.now() - reactStart;
  
  console.log(chalk.green(`Время: ${reactTime}ms`));
  console.log(chalk.gray('Ответ:', reactResult.response.substring(0, 100)));
  
  // Сравнение
  console.log(chalk.yellow('\n📊 Результаты:'));
  const speedup = ((reactTime - twoStageTime) / reactTime * 100).toFixed(1);
  
  if (twoStageTime < reactTime) {
    console.log(chalk.green(`✅ Two-Stage быстрее на ${speedup}%`));
  } else {
    console.log(chalk.red(`❌ ReAct быстрее на ${Math.abs(speedup)}%`));
  }
  
  console.log(chalk.cyan(`Two-Stage: ${twoStageTime}ms`));
  console.log(chalk.cyan(`ReAct: ${reactTime}ms`));
}

async function runAllTests() {
  console.log(chalk.bold.green('\n🚀 Запуск тестов Two-Stage процессора\n'));
  
  const results = [];
  
  // Тестируем все сценарии
  for (const scenario of testScenarios) {
    const result = await testScenario(scenario);
    results.push(result);
    
    // Небольшая пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Статистика
  console.log(chalk.bold.yellow('\n\n📊 Общая статистика:'));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const correctCommands = results.filter(r => r.correctCommands).length;
  const avgTime = results
    .filter(r => r.time)
    .reduce((acc, r) => acc + r.time, 0) / results.filter(r => r.time).length;
  
  console.log(chalk.green(`✅ Успешных: ${successful}/${results.length}`));
  console.log(chalk.red(`❌ Неудачных: ${failed}/${results.length}`));
  console.log(chalk.cyan(`🎯 Правильных команд: ${correctCommands}/${results.length}`));
  console.log(chalk.magenta(`⏱️ Среднее время: ${Math.round(avgTime)}ms`));
  
  // Сравнение с ReAct
  await compareWithReact();
}

// Запуск тестов
runAllTests()
  .then(() => {
    console.log(chalk.bold.green('\n✅ Тестирование завершено!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Ошибка тестирования:'), error);
    process.exit(1);
  });