#!/usr/bin/env node

/**
 * Тестирование Qwen через DashScope API (Alibaba Cloud)
 */

const axios = require('axios');

// API ключ для DashScope
const DASHSCOPE_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Промпт из AI Admin v2
const AI_ADMIN_PROMPT = `Ты - AI администратор барбершопа "Стиль".

ИНФОРМАЦИЯ О САЛОНЕ:
Название: Барбершоп "Стиль"
Адрес: ул. Ленина 1, Москва
Часы работы: 10:00-20:00

ДОСТУПНЫЕ УСЛУГИ:
- Стрижка мужская (id: 45) - 1500 руб., 30 мин
- Оформление бороды (id: 46) - 800 руб., 20 мин
- Комплекс стрижка+борода (id: 47) - 2000 руб., 45 мин

МАСТЕРА СЕГОДНЯ:
- Иван (id: 101) - работает с 10:00 до 20:00
- Петр (id: 102) - работает с 12:00 до 18:00
- Алексей (id: 103) - работает с 14:00 до 20:00, специалист по бороде

ВАЖНО: Встраивай команды в формате [КОМАНДА параметры]:
- [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] - поиск слотов
- [CREATE_BOOKING date:"2025-08-03" time:"15:00" service_id:45 staff_id:101] - создание записи
- [SHOW_PRICES] - показать цены
- [CANCEL_BOOKING] - отмена записи

Отвечай кратко (2-3 предложения), дружелюбно, используй эмодзи умеренно.`;

// Тестовые сценарии
const TEST_SCENARIOS = [
  {
    name: 'Простая запись',
    message: 'Привет! Хочу записаться на стрижку завтра'
  },
  {
    name: 'Запись с временем',
    message: 'Хочу записаться к Ивану на стрижку завтра в 15:00'
  },
  {
    name: 'Запрос цен',
    message: 'Сколько стоит стрижка и борода?'
  }
];

// Функция вызова DashScope API
async function callDashScope(message, model = 'qwen-plus') {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    const start = Date.now();
    const response = await axios.post(url, {
      model: model,
      messages: [
        {
          role: 'system',
          content: AI_ADMIN_PROMPT
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    const usage = response.data.usage;
    
    return { text, time, model, usage };
  } catch (error) {
    console.error(`Ошибка DashScope (${model}):`, error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data.error, null, 2));
    }
    return null;
  }
}

// Функция вызова DeepSeek для сравнения
async function callDeepSeek(message) {
  const DEEPSEEK_API_KEY = 'sk-cb40ab0d0272423abb726a9bebbba9a8';
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
    const usage = response.data.usage;
    
    return { text, time, model: 'deepseek-chat', usage };
  } catch (error) {
    console.error('Ошибка DeepSeek:', error.response?.data || error.message);
    return null;
  }
}

// Функция извлечения команд
function extractCommands(text) {
  const regex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
  const commands = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    commands.push(match[0]);
  }
  
  return commands;
}

// Основная функция тестирования
async function runTests() {
  console.log('🚀 Тестируем Qwen через DashScope API\n');
  console.log('Доступные модели: qwen-plus, qwen-turbo, qwen-max\n');
  console.log('=' .repeat(80));
  
  const results = {
    qwenPlus: [],
    qwenTurbo: [],
    deepseek: []
  };
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(80));
    
    // Тест Qwen-Plus
    console.log('\n🟢 Пробуем Qwen-Plus...');
    const qwenPlusResult = await callDashScope(scenario.message, 'qwen-plus');
    if (qwenPlusResult) {
      console.log(`✅ Qwen-Plus:`);
      console.log(`Ответ: ${qwenPlusResult.text}`);
      console.log(`Время: ${qwenPlusResult.time}ms`);
      console.log(`Команды: ${extractCommands(qwenPlusResult.text).join(', ') || 'нет'}`);
      console.log(`Токены: ${qwenPlusResult.usage?.total_tokens || 'н/д'}`);
      
      results.qwenPlus.push({
        scenario: scenario.name,
        time: qwenPlusResult.time,
        commands: extractCommands(qwenPlusResult.text).length,
        tokens: qwenPlusResult.usage?.total_tokens || 0
      });
    }
    
    // Тест Qwen-Turbo (более быстрая и дешевая)
    console.log('\n🔵 Пробуем Qwen-Turbo...');
    const qwenTurboResult = await callDashScope(scenario.message, 'qwen-turbo');
    if (qwenTurboResult) {
      console.log(`✅ Qwen-Turbo:`);
      console.log(`Ответ: ${qwenTurboResult.text}`);
      console.log(`Время: ${qwenTurboResult.time}ms`);
      console.log(`Команды: ${extractCommands(qwenTurboResult.text).join(', ') || 'нет'}`);
      console.log(`Токены: ${qwenTurboResult.usage?.total_tokens || 'н/д'}`);
      
      results.qwenTurbo.push({
        scenario: scenario.name,
        time: qwenTurboResult.time,
        commands: extractCommands(qwenTurboResult.text).length,
        tokens: qwenTurboResult.usage?.total_tokens || 0
      });
    }
    
    // Тест DeepSeek для сравнения
    console.log('\n⚫ Пробуем DeepSeek...');
    const deepseekResult = await callDeepSeek(scenario.message);
    if (deepseekResult) {
      console.log(`✅ DeepSeek:`);
      console.log(`Ответ: ${deepseekResult.text}`);
      console.log(`Время: ${deepseekResult.time}ms`);
      console.log(`Команды: ${extractCommands(deepseekResult.text).join(', ') || 'нет'}`);
      console.log(`Токены: ${deepseekResult.usage?.total_tokens || 'н/д'}`);
      
      results.deepseek.push({
        scenario: scenario.name,
        time: deepseekResult.time,
        commands: extractCommands(deepseekResult.text).length,
        tokens: deepseekResult.usage?.total_tokens || 0
      });
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Итоговая статистика
  console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('='.repeat(80));
  
  // Qwen-Plus
  if (results.qwenPlus.length > 0) {
    const avgTime = results.qwenPlus.reduce((sum, r) => sum + r.time, 0) / results.qwenPlus.length;
    const commandSuccess = results.qwenPlus.filter(r => r.commands > 0).length;
    const avgTokens = results.qwenPlus.reduce((sum, r) => sum + r.tokens, 0) / results.qwenPlus.length;
    
    console.log('\n🟢 Qwen-Plus:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.qwenPlus.length}`);
    console.log(`- Средние токены: ${Math.round(avgTokens)}`);
    console.log(`- Стоимость: $0.42 input / $1.26 output за 1M токенов`);
  }
  
  // Qwen-Turbo
  if (results.qwenTurbo.length > 0) {
    const avgTime = results.qwenTurbo.reduce((sum, r) => sum + r.time, 0) / results.qwenTurbo.length;
    const commandSuccess = results.qwenTurbo.filter(r => r.commands > 0).length;
    const avgTokens = results.qwenTurbo.reduce((sum, r) => sum + r.tokens, 0) / results.qwenTurbo.length;
    
    console.log('\n🔵 Qwen-Turbo:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.qwenTurbo.length}`);
    console.log(`- Средние токены: ${Math.round(avgTokens)}`);
    console.log(`- Стоимость: $0.0525 input / $0.21 output за 1M токенов`);
  }
  
  // DeepSeek
  if (results.deepseek.length > 0) {
    const avgTime = results.deepseek.reduce((sum, r) => sum + r.time, 0) / results.deepseek.length;
    const commandSuccess = results.deepseek.filter(r => r.commands > 0).length;
    const avgTokens = results.deepseek.reduce((sum, r) => sum + r.tokens, 0) / results.deepseek.length;
    
    console.log('\n⚫ DeepSeek:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.deepseek.length}`);
    console.log(`- Средние токены: ${Math.round(avgTokens)}`);
    console.log(`- Стоимость: $0.27 input / $1.09 output за 1M токенов`);
  }
  
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('1. Qwen-Turbo - самый дешевый вариант (в 5 раз дешевле DeepSeek)');
  console.log('2. Qwen-Plus - баланс качества и цены');
  console.log('3. Qwen-Max - максимальное качество (не тестировали)');
  console.log('4. Все модели Qwen отлично поддерживают русский язык');
}

// Запуск
console.log('🔧 Используем DashScope API (Alibaba Cloud)\n');
console.log('API документация: https://www.alibabacloud.com/help/en/model-studio/');
console.log('');

runTests().catch(console.error);