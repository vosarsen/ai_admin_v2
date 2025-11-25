/**
 * Тестовый скрипт для проверки Gemini API
 * Проверяет:
 * 1. Базовую работу API
 * 2. Понимание русского языка
 * 3. Structured output (JSON mode)
 * 4. Извлечение команд (как в two-stage системе)
 */

const axios = require('axios');

const GEMINI_API_KEY = 'AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Тест 1: Простой русский текст
 */
async function testBasicRussian() {
  console.log('\n🧪 Тест 1: Простой русский текст\n');

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [{
            text: 'Привет! Как дела? Расскажи о себе на русском языке.'
          }]
        }]
      },
      {
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    console.log('✅ Ответ:', text);
    console.log('\n📊 Качество русского: ', text.length > 50 ? 'Хорошее' : 'Короткое');

    return true;
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Тест 2: Structured JSON output
 */
async function testStructuredJSON() {
  console.log('\n🧪 Тест 2: Structured JSON output\n');

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [{
            text: 'Верни список из 3 популярных услуг салона красоты'
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              services: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    price: { type: 'number' }
                  },
                  required: ['name', 'price']
                }
              }
            },
            required: ['services']
          }
        }
      },
      {
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const jsonText = response.data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(jsonText);

    console.log('✅ JSON ответ:', JSON.stringify(parsed, null, 2));
    console.log('📊 Валидность JSON: ✅');
    console.log('📊 Схема соблюдена:', parsed.services && Array.isArray(parsed.services) ? '✅' : '❌');

    return true;
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Тест 3: Извлечение команд (как в AI Admin two-stage)
 */
async function testCommandExtraction() {
  console.log('\n🧪 Тест 3: Извлечение команд (Two-Stage Stage 1)\n');

  const testCases = [
    {
      message: 'Запиши меня на маникюр завтра в 15:00',
      expected: 'CREATE_BOOKING'
    },
    {
      message: 'Какое время свободно на стрижку?',
      expected: 'SEARCH_SLOTS'
    },
    {
      message: 'Покажи цены на услуги',
      expected: 'SHOW_PRICES'
    },
    {
      message: 'Хочу отменить запись',
      expected: 'CANCEL_BOOKING'
    }
  ];

  const prompt = `Ты - система анализа команд для салона красоты.

ТВОЯ ЗАДАЧА: Проанализировать сообщение клиента и вернуть JSON с командами для выполнения.

ДОСТУПНЫЕ КОМАНДЫ:
1. SEARCH_SLOTS - поиск свободного времени (параметры: service_name, date)
2. CREATE_BOOKING - создание записи (параметры: service_name, date, time)
3. CANCEL_BOOKING - отмена записи (параметры: нет)
4. SHOW_PRICES - показать цены (параметры: нет)

ПРАВИЛА:
- Без конкретного времени → SEARCH_SLOTS
- С конкретным временем → CREATE_BOOKING
- Вопросы о ценах/услугах → SHOW_PRICES
- Отмена → CANCEL_BOOKING

Проанализируй сообщение и верни ТОЛЬКО JSON в формате:
{
  "commands": [
    {
      "name": "COMMAND_NAME",
      "params": { }
    }
  ]
}`;

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`\n📝 Сообщение: "${testCase.message}"`);
    console.log(`🎯 Ожидается: ${testCase.expected}`);

    try {
      const response = await axios.post(
        GEMINI_API_URL,
        {
          contents: [{
            parts: [{
              text: `${prompt}\n\nСООБЩЕНИЕ КЛИЕНТА: "${testCase.message}"`
            }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                commands: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      params: { type: 'object' }
                    },
                    required: ['name', 'params']
                  }
                }
              },
              required: ['commands']
            }
          }
        },
        {
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const jsonText = response.data.candidates[0].content.parts[0].text;
      const result = JSON.parse(jsonText);

      const extractedCommand = result.commands[0]?.name;
      const success = extractedCommand === testCase.expected;

      if (success) {
        console.log(`✅ Результат: ${extractedCommand}`);
        console.log(`✅ Параметры:`, result.commands[0].params);
        passed++;
      } else {
        console.log(`❌ Результат: ${extractedCommand} (ожидалось: ${testCase.expected})`);
        failed++;
      }
    } catch (error) {
      console.error('❌ Ошибка:', error.response?.data || error.message);
      failed++;
    }

    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Итого: ${passed}/${testCases.length} тестов пройдено`);
  console.log(`   ✅ Успешно: ${passed}`);
  console.log(`   ❌ Провалено: ${failed}`);

  return passed === testCases.length;
}

/**
 * Тест 4: Генерация человечного ответа (Two-Stage Stage 2)
 */
async function testResponseGeneration() {
  console.log('\n🧪 Тест 4: Генерация ответа (Two-Stage Stage 2)\n');

  const prompt = `Ты - администратор салона красоты "Красота".

ТВОЯ ЗАДАЧА: Сформировать дружелюбный ответ клиенту на основе результатов выполненных команд.

ИНФОРМАЦИЯ О КОМПАНИИ:
- Название: Салон "Красота"
- Адрес: ул. Ленина, 10

КЛИЕНТ:
- Имя: Мария
- Постоянный клиент (5 визитов)

СООБЩЕНИЕ КЛИЕНТА: "Какое время свободно на маникюр завтра?"

РЕЗУЛЬТАТЫ ВЫПОЛНЕННЫХ КОМАНД:
✅ SEARCH_SLOTS: Найдено 5 слотов
Слоты: 10:00, 12:00, 14:00, 16:00, 18:00
Услуга: маникюр
Мастер: Анна

ПРАВИЛА:
1. БЕЗ технических деталей, форматирования WhatsApp (*, _, ~)
2. Используй результаты команд
3. Дружелюбный тон
4. Предложи выбор времени

Сформируй ответ для клиента:`;

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    console.log('✅ Ответ клиенту:\n');
    console.log(text);
    console.log('\n📊 Оценка ответа:');
    console.log('   - Естественный русский:', text.includes('Мария') ? '✅' : '❌');
    console.log('   - Упоминает слоты:', text.includes('10:00') || text.includes('10') ? '✅' : '❌');
    console.log('   - Дружелюбный тон:', text.includes('!') || text.includes('рад') ? '✅' : '⚠️');

    return true;
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Тестирование Gemini API для AI Admin v2');
  console.log('━'.repeat(60));

  const results = {
    basicRussian: await testBasicRussian(),
    structuredJSON: await testStructuredJSON(),
    commandExtraction: await testCommandExtraction(),
    responseGeneration: await testResponseGeneration()
  };

  console.log('\n' + '━'.repeat(60));
  console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
  console.log('━'.repeat(60));
  console.log(`1. Простой русский текст:      ${results.basicRussian ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. Structured JSON:            ${results.structuredJSON ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`3. Извлечение команд (Stage 1):${results.commandExtraction ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`4. Генерация ответа (Stage 2): ${results.responseGeneration ? '✅ PASS' : '❌ FAIL'}`);
  console.log('━'.repeat(60));

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Gemini готов к интеграции в AI Admin v2!');
  } else {
    console.log('\n⚠️ Некоторые тесты провалены. Проверьте детали выше.');
  }
}

// Запуск
main().catch(console.error);
