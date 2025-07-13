require('dotenv').config();
const AIAdminV2 = require('../../src/services/ai-admin-v2');
const logger = require('../../src/utils/logger');

// Реальные интеграционные тесты с AI Admin v2
describe('AI Admin v2 - Real Intent Detection', () => {
  let aiAdmin;
  const testPhone = '79000000001'; // Тестовый номер
  const testCompanyId = process.env.TEST_COMPANY_ID || 509113; // ID тестовой компании

  beforeAll(async () => {
    // Инициализируем реальный экземпляр AI Admin v2
    aiAdmin = new AIAdminV2();
    
    // Проверяем, что все необходимые сервисы доступны
    const companyInfo = await aiAdmin.yclientsService.getCompanyInfo(testCompanyId);
    expect(companyInfo).toBeDefined();
    expect(companyInfo.id).toBe(testCompanyId);
    
    logger.info(`Тестируем с компанией: ${companyInfo.title}`);
  });

  describe('1. Базовое понимание текста и определение намерений', () => {
    test('Распознавание интента: запись', async () => {
      const testMessages = [
        'хочу записаться',
        'можно записаться?',
        'запишите меня пожалуйста',
        'нужна запись на стрижку',
        'хочу прийти к вам'
      ];

      for (const message of testMessages) {
        console.log(`\n📝 Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем, что AI понял намерение записаться
        expect(response.toLowerCase()).toMatch(/запис|услуг|мастер|время|когда|свободн/);
        
        // Проверяем, что нет сообщений о непонимании
        expect(response.toLowerCase()).not.toMatch(/не понял|не понимаю|непонятно/);
        
        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    test('Распознавание интента: отмена', async () => {
      const testMessages = [
        'нужно отменить запись',
        'хочу отменить',
        'не смогу прийти',
        'отмените мою запись пожалуйста'
      ];

      for (const message of testMessages) {
        console.log(`\n🚫 Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем, что AI понял намерение отменить
        expect(response.toLowerCase()).toMatch(/отмен|запис|не найден|нет.*запис/);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    test('Распознавание интента: проверка слотов + дата', async () => {
      const testMessages = [
        'свободно завтра?',
        'есть время на этой неделе?',
        'когда можно записаться?',
        'покажи свободные окна на выходных'
      ];

      for (const message of testMessages) {
        console.log(`\n📅 Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем, что AI показывает время/слоты
        expect(response).toMatch(/\d{1,2}:\d{2}|время|слот|свободн|доступн|можете.*запис/i);
        
        // Проверяем упоминание дат
        if (message.includes('завтра')) {
          expect(response.toLowerCase()).toMatch(/завтра/);
        }
        if (message.includes('выходн')) {
          expect(response.toLowerCase()).toMatch(/суббот|воскресен|выходн/);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    test('Распознавание интента: цены (с опечатками)', async () => {
      const testMessages = [
        'сколько стоит стрижка?',
        'какие у вас цены?',
        'прайс лист',
        'скок стоит покраска', // намеренная опечатка
        'стоимость маникюра'
      ];

      for (const message of testMessages) {
        console.log(`\n💰 Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем, что AI показывает цены
        expect(response).toMatch(/\d+.*руб|цен|стоимост|прайс|стоит/i);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
  });

  describe('Обработка временных указаний', () => {
    test('Понимание относительных дат', async () => {
      const testCases = [
        { message: 'можно записаться на завтра?', shouldContain: ['завтра'] },
        { message: 'есть время в пятницу?', shouldContain: ['пятниц'] },
        { message: 'через неделю можно?', shouldContain: ['недел'] },
        { message: 'на выходных свободно?', shouldContain: ['суббот', 'воскресен', 'выходн'] }
      ];

      for (const { message, shouldContain } of testCases) {
        console.log(`\n🗓️ Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем, что хотя бы одно из ожидаемых слов присутствует
        const containsExpected = shouldContain.some(word => 
          response.toLowerCase().includes(word.toLowerCase())
        );
        expect(containsExpected).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    test('Понимание конкретного времени', async () => {
      const testMessages = [
        'можно записаться на 15:00?',
        'есть время к 3 часам дня?',
        'свободно в 10 утра?',
        'можно вечером после 18:00?'
      ];

      for (const message of testMessages) {
        console.log(`\n⏰ Тестируем: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // Проверяем упоминание времени
        expect(response).toMatch(/\d{1,2}:\d{2}|час|утр|вечер|время/i);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
  });

  describe('Комплексные сценарии', () => {
    test('Обработка составных запросов', async () => {
      const testCases = [
        {
          message: 'сколько стоит стрижка и можно записаться на завтра?',
          shouldMatch: [/\d+.*руб|цен|стоит/, /завтра|время|запис/]
        },
        {
          message: 'покажи что есть на маникюр к Марине',
          shouldMatch: [/маникюр/, /Марин|мастер/]
        }
      ];

      for (const { message, shouldMatch } of testCases) {
        console.log(`\n🔄 Тестируем составной запрос: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 200)}...`);
        
        // Проверяем все ожидаемые паттерны
        for (const pattern of shouldMatch) {
          expect(response).toMatch(pattern);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    test('Обработка некорректных сообщений', async () => {
      const testMessages = [
        'asdfghjkl',
        '123456789',
        'ыыыыы'
      ];

      for (const message of testMessages) {
        console.log(`\n❌ Тестируем некорректное: "${message}"`);
        
        const response = await aiAdmin.processMessage(message, testPhone, testCompanyId);
        console.log(`✅ Ответ: ${response.substring(0, 150)}...`);
        
        // AI должен вежливо переспросить или предложить помощь
        expect(response).toMatch(/помочь|услуг|запис|уточнит|не понял/i);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
  });

  afterAll(() => {
    console.log('\n✅ Все тесты определения намерений завершены!');
  });
});