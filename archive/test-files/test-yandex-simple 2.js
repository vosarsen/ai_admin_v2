#!/usr/bin/env node

/**
 * Простой тест YandexGPT vs DeepSeek для AI Admin
 */

const axios = require('axios');

// Промпт из реального AI Admin (упрощенный)
const AI_ADMIN_PROMPT = `Ты - AI администратор барбершопа "Стиль".

ИНФОРМАЦИЯ О САЛОНЕ:
Название: Барбершоп "Стиль"
Адрес: ул. Ленина 1
Часы работы: 10:00-20:00

ДОСТУПНЫЕ УСЛУГИ:
- Стрижка (id: 45) - 1500 руб.
- Борода (id: 46) - 800 руб.
- Комплекс стрижка+борода (id: 47) - 2000 руб.

МАСТЕРА:
- Иван (id: 101) - работает сегодня с 10:00 до 20:00
- Петр (id: 102) - работает сегодня с 12:00 до 18:00

ВАЖНО: Встраивай команды в свои ответы в формате [КОМАНДА параметры]:
- [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] - поиск слотов
- [CREATE_BOOKING date:"2025-08-03" time:"15:00" service_id:45 staff_id:101] - создание записи
- [SHOW_PRICES] - показать цены

Отвечай дружелюбно, используй эмодзи. Если клиент хочет записаться - используй соответствующую команду.`;

async function testYandexGPT(message) {
  // Используем либо IAM токен (как в AI Admin), либо API ключ
  const YANDEX_IAM_TOKEN = process.env.YANDEX_IAM_TOKEN;
  const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
  const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
  
  if (!YANDEX_FOLDER_ID || (!YANDEX_IAM_TOKEN && !YANDEX_API_KEY)) {
    console.log('❌ Установите YANDEX_FOLDER_ID и либо YANDEX_IAM_TOKEN, либо YANDEX_API_KEY');
    return null;
  }
  
  const url = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
  
  try {
    const start = Date.now();
    
    // Заголовки авторизации
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (YANDEX_IAM_TOKEN) {
      headers['Authorization'] = `Bearer ${YANDEX_IAM_TOKEN}`;
    } else {
      headers['Authorization'] = `Api-Key ${YANDEX_API_KEY}`;
    }
    
    const response = await axios.post(url, {
      modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt-lite/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens: 1000
      },
      messages: [
        { role: 'system', text: AI_ADMIN_PROMPT },
        { role: 'user', text: message }
      ]
    }, { headers });
    
    const time = Date.now() - start;
    const text = response.data.result.alternatives[0].message.text;
    
    return { text, time };
  } catch (error) {
    console.error('Ошибка YandexGPT:', error.response?.data || error.message);
    return null;
  }
}

async function testDeepSeek(message) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
    console.log('❌ Установите DEEPSEEK_API_KEY');
    return null;
  }
  
  const url = 'https://api.deepseek.com/v1/chat/completions';
  
  try {
    const start = Date.now();
    const response = await axios.post(url, {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: AI_ADMIN_PROMPT },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    
    return { text, time };
  } catch (error) {
    console.error('Ошибка DeepSeek:', error.response?.data || error.message);
    return null;
  }
}

function extractCommands(text) {
  const regex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
  const commands = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    commands.push(match[0]);
  }
  
  return commands;
}

async function main() {
  console.log('🚀 Тестируем YandexGPT vs DeepSeek\n');
  
  const testMessage = process.argv[2] || 'Привет! Хочу записаться на стрижку завтра в 15:00';
  
  console.log(`📝 Тестовое сообщение: "${testMessage}"\n`);
  
  // Тест YandexGPT
  const yandexResult = await testYandexGPT(testMessage);
  if (yandexResult) {
    console.log('🟡 YandexGPT 5 Lite:');
    console.log(`Ответ: ${yandexResult.text}`);
    console.log(`Время: ${yandexResult.time}ms`);
    console.log(`Команды: ${extractCommands(yandexResult.text).join(', ') || 'нет'}`);
  }
  
  console.log('\n' + '-'.repeat(80) + '\n');
  
  // Тест DeepSeek
  const deepseekResult = await testDeepSeek(testMessage);
  if (deepseekResult) {
    console.log('🔵 DeepSeek:');
    console.log(`Ответ: ${deepseekResult.text}`);
    console.log(`Время: ${deepseekResult.time}ms`);
    console.log(`Команды: ${extractCommands(deepseekResult.text).join(', ') || 'нет'}`);
  }
  
  // Сравнение
  if (yandexResult && deepseekResult) {
    console.log('\n📊 Сравнение:');
    console.log(`Скорость: YandexGPT ${yandexResult.time}ms vs DeepSeek ${deepseekResult.time}ms`);
    console.log(`Быстрее: ${yandexResult.time < deepseekResult.time ? 'YandexGPT 🏆' : 'DeepSeek 🏆'}`);
  }
}

// Инструкции
console.log('Для запуска установите переменные окружения:');
console.log('export YANDEX_IAM_TOKEN="your-iam-token"  # или YANDEX_API_KEY');
console.log('export YANDEX_FOLDER_ID="your-folder-id"');
console.log('export DEEPSEEK_API_KEY="your-key"');
console.log('\nИспользование: node test-yandex-simple.js "Ваше сообщение"');
console.log('');

if ((process.env.YANDEX_IAM_TOKEN || process.env.YANDEX_API_KEY) || process.env.DEEPSEEK_API_KEY) {
  main().catch(console.error);
}