#!/usr/bin/env node

/**
 * Тестирование YandexGPT 5 Lite для AI Admin v2
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация YandexGPT
const YANDEX_API_KEY = process.env.YANDEX_API_KEY || 'YOUR_API_KEY';
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID || 'YOUR_FOLDER_ID';
const YANDEX_MODEL = 'yandexgpt-lite/latest'; // или 'yandexgpt-lite/rc'

// Промпт из AI Admin v2
const AI_ADMIN_PROMPT = `Вы - AI ассистент салона красоты. Ваша задача - помогать клиентам с записью на услуги.

ВАЖНО: Вы должны встраивать команды в свои ответы в формате [КОМАНДА параметры].

Доступные команды:
- [SEARCH_SLOTS date:"YYYY-MM-DD" service_ids:[1,2,3]] - поиск свободных слотов
- [CREATE_BOOKING ...параметры] - создание записи
- [SHOW_PRICES] - показать цены на услуги
- [SHOW_PORTFOLIO] - показать портфолио

Пример ответа:
"Конечно, давайте найдем удобное время для стрижки. [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] Какое время вам было бы удобно?"

Контекст:
- Компания: Барбершоп "Стиль"
- Услуги: Стрижка (id: 45, 1500 руб), Борода (id: 46, 800 руб)
- Мастера: Иван (id: 101), Петр (id: 102)
- Рабочие часы: 10:00-20:00`;

// Тестовые сценарии
const TEST_SCENARIOS = [
  {
    name: 'Простая запись',
    message: 'Привет! Хочу записаться на стрижку завтра'
  },
  {
    name: 'Запрос цен',
    message: 'Сколько стоит стрижка и оформление бороды?'
  },
  {
    name: 'Сложный запрос',
    message: 'Добрый день! Хочу записаться к Ивану на стрижку в субботу после 15:00'
  },
  {
    name: 'Отмена записи',
    message: 'Мне нужно отменить мою запись на завтра'
  },
  {
    name: 'Неопределенный запрос',
    message: 'что у вас есть?'
  }
];

// Функция вызова YandexGPT API
async function callYandexGPT(prompt, userMessage) {
  const url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  
  const requestBody = {
    modelUri: `gpt://${YANDEX_FOLDER_ID}/${YANDEX_MODEL}`,
    completionOptions: {
      stream: false,
      temperature: 0.3,
      maxTokens: 1000
    },
    messages: [
      {
        role: 'system',
        text: prompt
      },
      {
        role: 'user',
        text: userMessage
      }
    ]
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Api-Key ${YANDEX_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.result.alternatives[0].message.text;
  } catch (error) {
    console.error('Ошибка YandexGPT:', error.response?.data || error.message);
    throw error;
  }
}

// Функция вызова DeepSeek для сравнения
async function callDeepSeek(prompt, userMessage) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
  const url = 'https://api.deepseek.com/v1/chat/completions';
  
  const requestBody = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: prompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ],
    temperature: 0.3,
    max_tokens: 1000
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Ошибка DeepSeek:', error.response?.data || error.message);
    throw error;
  }
}

// Функция извлечения команд из ответа
function extractCommands(text) {
  const commandRegex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
  const commands = [];
  let match;
  
  while ((match = commandRegex.exec(text)) !== null) {
    commands.push({
      command: match[1],
      params: match[2] || ''
    });
  }
  
  return commands;
}

// Основная функция тестирования
async function runTests() {
  console.log('🚀 Начинаем тестирование YandexGPT 5 Lite vs DeepSeek\n');
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(80));
    
    const result = {
      scenario: scenario.name,
      message: scenario.message,
      yandex: {},
      deepseek: {}
    };
    
    // Тест YandexGPT
    if (YANDEX_API_KEY !== 'YOUR_API_KEY') {
      try {
        const startTime = Date.now();
        const response = await callYandexGPT(AI_ADMIN_PROMPT, scenario.message);
        const endTime = Date.now();
        
        result.yandex = {
          response,
          time: endTime - startTime,
          commands: extractCommands(response),
          success: true
        };
        
        console.log('\n🟡 YandexGPT 5 Lite:');
        console.log(`Ответ: ${response}`);
        console.log(`Время: ${result.yandex.time}ms`);
        console.log(`Команды: ${JSON.stringify(result.yandex.commands)}`);
      } catch (error) {
        result.yandex = {
          error: error.message,
          success: false
        };
        console.log('\n🟡 YandexGPT 5 Lite: ОШИБКА', error.message);
      }
    } else {
      console.log('\n🟡 YandexGPT 5 Lite: ПРОПУЩЕНО (нет API ключа)');
    }
    
    // Тест DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const startTime = Date.now();
        const response = await callDeepSeek(AI_ADMIN_PROMPT, scenario.message);
        const endTime = Date.now();
        
        result.deepseek = {
          response,
          time: endTime - startTime,
          commands: extractCommands(response),
          success: true
        };
        
        console.log('\n🔵 DeepSeek:');
        console.log(`Ответ: ${response}`);
        console.log(`Время: ${result.deepseek.time}ms`);
        console.log(`Команды: ${JSON.stringify(result.deepseek.commands)}`);
      } catch (error) {
        result.deepseek = {
          error: error.message,
          success: false
        };
        console.log('\n🔵 DeepSeek: ОШИБКА', error.message);
      }
    }
    
    results.push(result);
    
    // Небольшая пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Сохраняем результаты
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(__dirname, `test-results-${timestamp}.json`);
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n\n✅ Результаты сохранены в: ${resultsPath}`);
  
  // Итоговая статистика
  console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('-'.repeat(80));
  
  const yandexStats = results.filter(r => r.yandex.success);
  const deepseekStats = results.filter(r => r.deepseek.success);
  
  if (yandexStats.length > 0) {
    const avgYandexTime = yandexStats.reduce((sum, r) => sum + r.yandex.time, 0) / yandexStats.length;
    const yandexCommandsFound = yandexStats.filter(r => r.yandex.commands.length > 0).length;
    
    console.log('\n🟡 YandexGPT 5 Lite:');
    console.log(`- Успешных ответов: ${yandexStats.length}/${TEST_SCENARIOS.length}`);
    console.log(`- Среднее время ответа: ${Math.round(avgYandexTime)}ms`);
    console.log(`- Ответов с командами: ${yandexCommandsFound}/${yandexStats.length}`);
  }
  
  if (deepseekStats.length > 0) {
    const avgDeepseekTime = deepseekStats.reduce((sum, r) => sum + r.deepseek.time, 0) / deepseekStats.length;
    const deepseekCommandsFound = deepseekStats.filter(r => r.deepseek.commands.length > 0).length;
    
    console.log('\n🔵 DeepSeek:');
    console.log(`- Успешных ответов: ${deepseekStats.length}/${TEST_SCENARIOS.length}`);
    console.log(`- Среднее время ответа: ${Math.round(avgDeepseekTime)}ms`);
    console.log(`- Ответов с командами: ${deepseekCommandsFound}/${deepseekStats.length}`);
  }
}

// Проверка конфигурации
function checkConfig() {
  console.log('🔧 Проверка конфигурации...\n');
  
  if (YANDEX_API_KEY === 'YOUR_API_KEY') {
    console.log('⚠️  YandexGPT: Требуется установить YANDEX_API_KEY и YANDEX_FOLDER_ID');
    console.log('   Получить ключ: https://cloud.yandex.ru/docs/iam/operations/api-key/create');
  } else {
    console.log('✅ YandexGPT: Конфигурация найдена');
  }
  
  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠️  DeepSeek: DEEPSEEK_API_KEY не установлен');
  } else {
    console.log('✅ DeepSeek: Конфигурация найдена');
  }
  
  console.log('\nДля установки переменных окружения:');
  console.log('export YANDEX_API_KEY="your-key"');
  console.log('export YANDEX_FOLDER_ID="your-folder-id"');
  console.log('export DEEPSEEK_API_KEY="your-key"');
  console.log();
}

// Запуск
if (require.main === module) {
  checkConfig();
  
  if (YANDEX_API_KEY !== 'YOUR_API_KEY' || process.env.DEEPSEEK_API_KEY) {
    runTests().catch(console.error);
  } else {
    console.log('\n❌ Требуется хотя бы один API ключ для запуска тестов');
  }
}

module.exports = { callYandexGPT, callDeepSeek, extractCommands };