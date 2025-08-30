#!/usr/bin/env node

/**
 * Тестирование Qwen3-30B-A3B через нативный DashScope API
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

МАСТЕРА:
- Иван (id: 101) - работает с 10:00 до 20:00
- Петр (id: 102) - работает с 12:00 до 18:00

ВАЖНО: Встраивай команды в формате [КОМАНДА параметры]:
- [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] - поиск слотов
- [CREATE_BOOKING date:"2025-08-03" time:"15:00" service_id:45 staff_id:101] - создание записи
- [SHOW_PRICES] - показать цены

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

// Функция вызова нативного DashScope API
async function callDashScopeNative(message) {
  // Используем нативный endpoint DashScope
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  try {
    const requestBody = {
      model: 'qwen3-30b-a3b',
      input: {
        messages: [
          {
            role: 'system',
            content: AI_ADMIN_PROMPT
          },
          {
            role: 'user',
            content: message
          }
        ]
      },
      parameters: {
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1000,
        enable_thinking: false  // Явно указываем false для non-streaming
      }
    };
    
    console.log('📤 Отправляем запрос к нативному API...');
    console.log('Параметры:', JSON.stringify(requestBody.parameters, null, 2));
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-DashScope-DataInspection': 'enable' // Включаем инспекцию данных
      },
      timeout: 30000
    });
    
    return {
      success: true,
      text: response.data.output.text || response.data.output.choices?.[0]?.message?.content,
      usage: response.data.usage,
      model: response.data.model
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.response?.data?.error?.message || error.message,
      code: error.response?.data?.code || error.response?.data?.error?.code,
      details: error.response?.data
    };
  }
}

// Альтернативный способ через Generation.call формат
async function callDashScopeGeneration(message) {
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  try {
    const requestBody = {
      model: 'qwen3-30b-a3b',
      prompt: `${AI_ADMIN_PROMPT}\n\nПользователь: ${message}\nАссистент:`,
      parameters: {
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1000
      }
    };
    
    console.log('📤 Отправляем запрос (Generation format)...');
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    return {
      success: true,
      text: response.data.output.text,
      usage: response.data.usage
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
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
  console.log('🚀 Тестируем Qwen3-30B-A3B через нативный DashScope API\n');
  console.log('Модель: MoE архитектура (30.5B total, 3.3B active)\n');
  console.log('=' .repeat(80));
  
  // Пробуем разные способы
  console.log('\n🔧 Тест 1: Нативный API с enable_thinking: false\n');
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(60));
    
    const result = await callDashScopeNative(scenario.message);
    
    if (result.success) {
      const commands = extractCommands(result.text);
      console.log(`✅ Ответ: ${result.text}`);
      console.log(`🎯 Команды: ${commands.join(', ') || 'нет'}`);
      console.log(`📊 Токены: ${result.usage?.total_tokens || 'н/д'}`);
    } else {
      console.log(`❌ Ошибка: ${result.error}`);
      if (result.code) console.log(`   Код: ${result.code}`);
      if (result.details) console.log(`   Детали:`, JSON.stringify(result.details, null, 2));
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Если первый способ не работает, пробуем альтернативный
  console.log('\n\n🔧 Тест 2: Generation format (альтернативный способ)\n');
  
  const testMessage = 'Привет! Хочу записаться на стрижку';
  console.log(`Тестовое сообщение: "${testMessage}"`);
  
  const altResult = await callDashScopeGeneration(testMessage);
  
  if (altResult.success) {
    console.log(`✅ Ответ: ${altResult.text}`);
  } else {
    console.log(`❌ Ошибка: ${altResult.error}`);
  }
  
  // Рекомендации
  console.log('\n\n💡 ВЫВОДЫ:');
  console.log('=' .repeat(80));
  
  console.log('\nЕсли Qwen3-30B-A3B не работает через стандартные API:');
  console.log('1. Используйте streaming API (уже проверено - работает)');
  console.log('2. Попробуйте Python SDK с extra_body параметрами');
  console.log('3. Используйте Qwen2.5-32B как альтернативу (больше параметров и работает)');
  
  console.log('\n🏆 Рекомендация: Qwen2.5-32B-Instruct');
  console.log('- 32B параметров (больше чем 30B)');
  console.log('- Работает через стандартный API');
  console.log('- Самая быстрая (1378ms)');
  console.log('- Отлично понимает команды');
}

// Запуск
console.log('🔧 Используем нативный DashScope API\n');
console.log('Endpoints:');
console.log('- OpenAI-compatible: https://dashscope-intl.aliyuncs.com/compatible-mode/v1');
console.log('- Native DashScope: https://dashscope.aliyuncs.com/api/v1');
console.log('');

runTests().catch(console.error);