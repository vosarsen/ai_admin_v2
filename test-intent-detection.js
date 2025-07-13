// test-intent-detection.js
// Тестирование определения интентов в AI Admin v2

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
      { message: 'хочу записаться', expectedIntent: 'booking' },
      { message: 'можно записаться на стрижку?', expectedIntent: 'booking' },
      { message: 'записать меня к барберу', expectedIntent: 'booking' },
      { message: 'нужна запись на завтра', expectedIntent: 'booking' },
      { message: 'хочу прийти на маникюр', expectedIntent: 'booking' }
    ]
  },
  
  // Интент: Проверка слотов
  {
    category: 'Проверка доступности',
    tests: [
      { message: 'когда свободно?', expectedIntent: 'check_slots' },
      { message: 'есть время на сегодня?', expectedIntent: 'check_slots' },
      { message: 'свободно завтра утром?', expectedIntent: 'check_slots' },
      { message: 'когда можно прийти?', expectedIntent: 'check_slots' },
      { message: 'покажи свободные окна', expectedIntent: 'check_slots' }
    ]
  },
  
  // Интент: Цены
  {
    category: 'Информация о ценах',
    tests: [
      { message: 'сколько стоит?', expectedIntent: 'prices' },
      { message: 'какие цены?', expectedIntent: 'prices' },
      { message: 'прайс-лист', expectedIntent: 'prices' },
      { message: 'скок стоит стрижка', expectedIntent: 'prices' }, // с опечаткой
      { message: 'цена маникюра', expectedIntent: 'prices' }
    ]
  },
  
  // Интент: Отмена
  {
    category: 'Отмена записи',
    tests: [
      { message: 'хочу отменить запись', expectedIntent: 'cancel' },
      { message: 'отменить визит', expectedIntent: 'cancel' },
      { message: 'не смогу прийти', expectedIntent: 'cancel' },
      { message: 'отмена записи', expectedIntent: 'cancel' },
      { message: 'отменяю встречу', expectedIntent: 'cancel' }
    ]
  },
  
  // Интент: Перенос
  {
    category: 'Перенос записи',
    tests: [
      { message: 'можно перенести запись?', expectedIntent: 'reschedule' },
      { message: 'хочу перенести на другое время', expectedIntent: 'reschedule' },
      { message: 'поменять время записи', expectedIntent: 'reschedule' },
      { message: 'перенесите на завтра', expectedIntent: 'reschedule' },
      { message: 'изменить запись', expectedIntent: 'reschedule' }
    ]
  },
  
  // Интент: Мои записи
  {
    category: 'Проверка своих записей',
    tests: [
      { message: 'мои записи', expectedIntent: 'my_bookings' },
      { message: 'когда я записан?', expectedIntent: 'my_bookings' },
      { message: 'покажи мои визиты', expectedIntent: 'my_bookings' },
      { message: 'проверить запись', expectedIntent: 'my_bookings' },
      { message: 'во сколько я записан?', expectedIntent: 'my_bookings' }
    ]
  },
  
  // Интент: Информация
  {
    category: 'Общая информация',
    tests: [
      { message: 'где вы находитесь?', expectedIntent: 'info' },
      { message: 'какой адрес?', expectedIntent: 'info' },
      { message: 'время работы', expectedIntent: 'info' },
      { message: 'как добраться?', expectedIntent: 'info' },
      { message: 'телефон салона', expectedIntent: 'info' }
    ]
  },
  
  // Интент: Портфолио
  {
    category: 'Работы мастеров',
    tests: [
      { message: 'покажи работы', expectedIntent: 'portfolio' },
      { message: 'фото работ мастера', expectedIntent: 'portfolio' },
      { message: 'примеры стрижек', expectedIntent: 'portfolio' },
      { message: 'посмотреть портфолио', expectedIntent: 'portfolio' },
      { message: 'есть фото?', expectedIntent: 'portfolio' }
    ]
  },
  
  // Сложные кейсы с временными указаниями
  {
    category: 'Временные указания',
    tests: [
      { message: 'свободно завтра после 18?', expectedIntent: 'check_slots', timeExtracted: 'evening' },
      { message: 'можно в пятницу утром?', expectedIntent: 'check_slots', timeExtracted: 'morning' },
      { message: 'есть время через неделю?', expectedIntent: 'check_slots', dateExtracted: 'next_week' },
      { message: 'запиши на выходных', expectedIntent: 'booking', dateExtracted: 'weekend' },
      { message: 'вечером сегодня свободно?', expectedIntent: 'check_slots', timeExtracted: 'evening' }
    ]
  },
  
  // Разговорная речь и сленг
  {
    category: 'Разговорная речь',
    tests: [
      { message: 'че по ценам?', expectedIntent: 'prices' },
      { message: 'скок щас стрижка?', expectedIntent: 'prices' },
      { message: 'запиши плз', expectedIntent: 'booking' },
      { message: 'отменяй все нафиг', expectedIntent: 'cancel' },
      { message: 'када можна прийти?', expectedIntent: 'check_slots' }
    ]
  }
];

// Мок компании для тестирования
const mockCompany = {
  company_id: 'test_company',
  yclients_id: 123456,
  title: 'Test Barbershop',
  type: 'barbershop',
  address: 'Test Address',
  phone: '+7 (999) 123-45-67',
  working_hours: { mon: '09:00-21:00' }
};

// Функция для извлечения интента из ответа AI
function extractIntentFromResponse(response) {
  // Проверяем по командам
  if (response.includes('[SEARCH_SLOTS]')) return 'check_slots';
  if (response.includes('[CREATE_BOOKING]')) return 'booking';
  if (response.includes('[SHOW_PRICES]')) return 'prices';
  if (response.includes('[SHOW_PORTFOLIO]')) return 'portfolio';
  
  // Проверяем по ключевым словам в ответе
  const lowerResponse = response.toLowerCase();
  
  if (lowerResponse.includes('отмен') || lowerResponse.includes('не смо')) return 'cancel';
  if (lowerResponse.includes('перенес') || lowerResponse.includes('изменить время')) return 'reschedule';
  if (lowerResponse.includes('ваши записи') || lowerResponse.includes('вы записаны')) return 'my_bookings';
  if (lowerResponse.includes('адрес') || lowerResponse.includes('находимся')) return 'info';
  if (lowerResponse.includes('записать вас') || lowerResponse.includes('оформить запись')) return 'booking';
  if (lowerResponse.includes('свободное время') || lowerResponse.includes('доступн')) return 'check_slots';
  if (lowerResponse.includes('стоимост') || lowerResponse.includes('цен')) return 'prices';
  
  return 'unknown';
}

// Главная функция тестирования
async function runIntentTests() {
  console.log(`\n${colors.cyan}=== Тестирование определения интентов AI Admin v2 ===${colors.reset}\n`);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failedCases = [];
  
  // Создаем минимальный контекст для тестирования
  const mockContext = {
    company: mockCompany,
    client: { name: 'Тестовый клиент', phone: '79001234567' },
    services: [],
    staff: [],
    staffSchedules: {},
    conversation: [],
    currentTime: new Date().toISOString(),
    timezone: 'Europe/Moscow'
  };
  
  for (const category of testCases) {
    console.log(`\n${colors.blue}📋 ${category.category}:${colors.reset}`);
    
    for (const test of category.tests) {
      totalTests++;
      
      try {
        // Строим промпт как в реальной системе
        const prompt = AIAdminV2.buildSmartPrompt(test.message, mockContext);
        
        // Вызываем AI
        const aiResponse = await AIAdminV2.callAI(prompt);
        
        // Извлекаем интент из ответа
        const detectedIntent = extractIntentFromResponse(aiResponse);
        
        // Проверяем результат
        const passed = detectedIntent === test.expectedIntent;
        
        if (passed) {
          passedTests++;
          console.log(`  ${colors.green}✓${colors.reset} "${test.message}" → ${detectedIntent}`);
        } else {
          failedTests++;
          failedCases.push({
            message: test.message,
            expected: test.expectedIntent,
            actual: detectedIntent,
            response: aiResponse.substring(0, 100) + '...'
          });
          console.log(`  ${colors.red}✗${colors.reset} "${test.message}" → ${detectedIntent} (ожидалось: ${test.expectedIntent})`);
        }
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 500));
        
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