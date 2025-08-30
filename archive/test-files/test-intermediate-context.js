// test-intermediate-context.js
// Тестирование промежуточного контекста для исправления потери контекста при быстрых сообщениях

const intermediateContext = require('./src/services/context/intermediate-context');
const contextService = require('./src/services/context');
const logger = require('./src/utils/logger').child({ module: 'test-intermediate-context' });

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
  console.log(`\n${colors.bright}${colors.blue}====== ${testName} ======${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

function logInfo(message) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

// Тестовые данные
const testPhone = '79001234567';
const testCompanyId = 962302;

// Симуляция контекста диалога
const mockContext = {
  client: {
    name: 'Александр',
    phone: testPhone
  },
  conversation: [
    {
      role: 'user',
      content: 'Привет! Хочу записаться на стрижку',
      timestamp: Date.now() - 120000
    },
    {
      role: 'assistant',
      content: 'Здравствуйте! Рад вас видеть. Какой вид стрижки вас интересует? У нас есть:\n- Мужская стрижка (1500₽)\n- Мужская стрижка + борода (2000₽)\n- Детская стрижка (1000₽)',
      timestamp: Date.now() - 110000
    },
    {
      role: 'user',
      content: 'мужская стрижка',
      timestamp: Date.now() - 100000
    },
    {
      role: 'assistant',
      content: 'Отлично! Мужская стрижка - хороший выбор. К какому мастеру вы хотели бы записаться? У нас работают:\n- Иван (опыт 5 лет)\n- Петр (опыт 3 года)\n- Сергей (опыт 7 лет)',
      timestamp: Date.now() - 90000
    }
  ]
};

// Тест 1: Сохранение и извлечение промежуточного контекста
async function test1_SaveAndRetrieve() {
  logTest('Тест 1: Сохранение и извлечение промежуточного контекста');
  
  try {
    // Сохраняем контекст
    const message = 'к Ивану';
    const saveResult = await intermediateContext.saveProcessingStart(testPhone, message, mockContext);
    
    if (saveResult.success) {
      logSuccess('Промежуточный контекст сохранен');
    } else {
      logError(`Ошибка сохранения: ${saveResult.error}`);
      return false;
    }
    
    // Извлекаем контекст
    const retrieved = await intermediateContext.getIntermediateContext(testPhone);
    
    if (retrieved) {
      logSuccess('Промежуточный контекст извлечен');
      logInfo(`Текущее сообщение: "${retrieved.currentMessage}"`);
      logInfo(`Последний вопрос бота: "${retrieved.lastBotQuestion}"`);
      logInfo(`Ожидаемый тип ответа: ${retrieved.expectedReplyType}`);
      logInfo(`Возраст контекста: ${retrieved.age}ms`);
      logInfo(`Статус: ${retrieved.processingStatus}`);
      
      // Проверяем корректность извлечения
      if (retrieved.currentMessage === message &&
          retrieved.lastBotQuestion === 'К какому мастеру вы хотели бы записаться?' &&
          retrieved.expectedReplyType === 'staff_selection') {
        logSuccess('Все данные извлечены корректно!');
        return true;
      } else {
        logError('Данные извлечены некорректно');
        return false;
      }
    } else {
      logError('Не удалось извлечь контекст');
      return false;
    }
  } catch (error) {
    logError(`Ошибка в тесте 1: ${error.message}`);
    return false;
  }
}

// Тест 2: Симуляция быстрых последовательных сообщений
async function test2_RapidMessages() {
  logTest('Тест 2: Быстрые последовательные сообщения');
  
  try {
    // Первое сообщение
    const message1 = 'завтра';
    logInfo(`Отправка первого сообщения: "${message1}"`);
    
    await intermediateContext.saveProcessingStart(testPhone, message1, mockContext);
    logSuccess('Первое сообщение начало обработку');
    
    // Симулируем обработку AI (занимает время)
    setTimeout(async () => {
      await intermediateContext.updateAfterAIAnalysis(testPhone, 'На какое время завтра вы хотели бы записаться?', [
        { command: 'SEARCH_SLOTS', params: { date: '2025-08-02' } }
      ]);
      
      await intermediateContext.markAsCompleted(testPhone, {
        success: true,
        response: 'На какое время завтра вы хотели бы записаться? У нас есть свободные окна: 10:00, 12:00, 15:00, 17:00'
      });
      
      logSuccess('Первое сообщение обработано');
    }, 1500);
    
    // Второе сообщение через 1 секунду
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const message2 = 'в 15:00';
    logInfo(`Отправка второго сообщения: "${message2}"`);
    
    // Проверяем, что первое еще обрабатывается
    const isProcessing = await intermediateContext.isProcessing(testPhone);
    if (isProcessing) {
      logInfo('Обнаружена обработка предыдущего сообщения, ожидание...');
      
      const waited = await intermediateContext.waitForCompletion(testPhone, 3000);
      if (waited) {
        logSuccess('Дождались завершения предыдущего сообщения');
      } else {
        logError('Таймаут ожидания предыдущего сообщения');
      }
    }
    
    // Получаем контекст после ожидания
    const contextAfterWait = await intermediateContext.getIntermediateContext(testPhone);
    if (contextAfterWait && contextAfterWait.processingStatus === 'completed') {
      logSuccess('Предыдущее сообщение успешно обработано');
      logInfo(`Упомянутые даты: ${contextAfterWait.mentionedDates.join(', ')}`);
    }
    
    // Обрабатываем второе сообщение
    await intermediateContext.saveProcessingStart(testPhone, message2, {
      ...mockContext,
      conversation: [
        ...mockContext.conversation,
        {
          role: 'user',
          content: message1,
          timestamp: Date.now() - 2000
        },
        {
          role: 'assistant',
          content: 'На какое время завтра вы хотели бы записаться? У нас есть свободные окна: 10:00, 12:00, 15:00, 17:00',
          timestamp: Date.now() - 1000
        }
      ]
    });
    
    logSuccess('Второе сообщение начало обработку с обновленным контекстом');
    
    return true;
  } catch (error) {
    logError(`Ошибка в тесте 2: ${error.message}`);
    return false;
  }
}

// Тест 3: Извлечение вопросов и определение типа ответа
async function test3_QuestionExtraction() {
  logTest('Тест 3: Извлечение вопросов и определение типа ответа');
  
  try {
    const testCases = [
      {
        conversation: [
          { role: 'assistant', content: 'Как вас зовут?' }
        ],
        expectedQuestion: 'Как вас зовут?',
        expectedType: 'name_request'
      },
      {
        conversation: [
          { role: 'assistant', content: 'Отлично! На какую дату вы хотели бы записаться?' }
        ],
        expectedQuestion: 'На какую дату вы хотели бы записаться?',
        expectedType: 'date_selection'
      },
      {
        conversation: [
          { role: 'assistant', content: 'Хорошо, записываю вас на стрижку к Ивану на завтра в 15:00. Все верно?' }
        ],
        expectedQuestion: 'Все верно?',
        expectedType: 'confirmation'
      },
      {
        conversation: [
          { role: 'assistant', content: 'Привет! Чем могу помочь?' }
        ],
        expectedQuestion: 'Чем могу помочь?',
        expectedType: 'unknown'
      }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const context = { ...mockContext, conversation: testCase.conversation };
      await intermediateContext.saveProcessingStart(testPhone, 'test', context);
      
      const retrieved = await intermediateContext.getIntermediateContext(testPhone);
      
      if (retrieved.lastBotQuestion === testCase.expectedQuestion &&
          retrieved.expectedReplyType === testCase.expectedType) {
        logSuccess(`✓ "${testCase.expectedQuestion}" → ${testCase.expectedType}`);
      } else {
        logError(`✗ Ожидалось: "${testCase.expectedQuestion}" → ${testCase.expectedType}`);
        logError(`  Получено: "${retrieved.lastBotQuestion}" → ${retrieved.expectedReplyType}`);
        allPassed = false;
      }
    }
    
    return allPassed;
  } catch (error) {
    logError(`Ошибка в тесте 3: ${error.message}`);
    return false;
  }
}

// Тест 4: Обновление после AI анализа
async function test4_AIAnalysisUpdate() {
  logTest('Тест 4: Обновление контекста после AI анализа');
  
  try {
    // Сохраняем начальный контекст
    await intermediateContext.saveProcessingStart(testPhone, 'хочу записаться на маникюр завтра в 14:00', mockContext);
    
    // Симулируем ответ AI с командами
    const aiResponse = 'Хорошо, проверяю доступность времени на маникюр завтра в 14:00...';
    const commands = [
      {
        command: 'SEARCH_SLOTS',
        params: {
          service_name: 'Маникюр',
          date: '2025-08-02',
          time: '14:00'
        }
      }
    ];
    
    // Обновляем контекст
    await intermediateContext.updateAfterAIAnalysis(testPhone, aiResponse, commands);
    
    // Проверяем обновленный контекст
    const updated = await intermediateContext.getIntermediateContext(testPhone);
    
    if (updated.processingStatus === 'ai_analyzed' &&
        updated.mentionedServices.includes('Маникюр') &&
        updated.mentionedDates.includes('2025-08-02') &&
        updated.mentionedTimes.includes('14:00')) {
      logSuccess('Контекст успешно обновлен после AI анализа');
      logInfo(`Упомянутые услуги: ${updated.mentionedServices.join(', ')}`);
      logInfo(`Упомянутые даты: ${updated.mentionedDates.join(', ')}`);
      logInfo(`Упомянутые времена: ${updated.mentionedTimes.join(', ')}`);
      return true;
    } else {
      logError('Контекст не обновлен корректно');
      return false;
    }
  } catch (error) {
    logError(`Ошибка в тесте 4: ${error.message}`);
    return false;
  }
}

// Главная функция для запуска всех тестов
async function runAllTests() {
  console.log(colors.bright + colors.yellow + '\n🚀 Запуск тестов промежуточного контекста\n' + colors.reset);
  
  const tests = [
    { name: 'Сохранение и извлечение', fn: test1_SaveAndRetrieve },
    { name: 'Быстрые сообщения', fn: test2_RapidMessages },
    { name: 'Извлечение вопросов', fn: test3_QuestionExtraction },
    { name: 'AI анализ', fn: test4_AIAnalysisUpdate }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
      
      // Очищаем контекст между тестами
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logError(`Критическая ошибка в тесте "${test.name}": ${error.message}`);
      failed++;
    }
  }
  
  // Итоговый результат
  console.log('\n' + colors.bright + '====== РЕЗУЛЬТАТЫ ======' + colors.reset);
  console.log(`${colors.green}Пройдено: ${passed}${colors.reset}`);
  console.log(`${colors.red}Провалено: ${failed}${colors.reset}`);
  
  if (failed === 0) {
    console.log('\n' + colors.bright + colors.green + '🎉 Все тесты пройдены успешно!' + colors.reset);
  } else {
    console.log('\n' + colors.bright + colors.red + '⚠️  Некоторые тесты провалены' + colors.reset);
  }
  
  // Выход
  process.exit(failed === 0 ? 0 : 1);
}

// Запуск тестов
runAllTests().catch(error => {
  logError(`Критическая ошибка: ${error.message}`);
  console.error(error);
  process.exit(1);
});