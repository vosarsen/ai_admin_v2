#!/usr/bin/env node

/**
 * Тестирование Qwen3-30B-A3B с параметром enable_thinking
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
    name: 'Сложный запрос',
    message: 'Я хочу записаться на комплекс стрижка+борода, но не знаю к кому лучше. Кто из мастеров лучше работает с бородой?'
  },
  {
    name: 'Запрос цен',
    message: 'Сколько стоит стрижка и борода?'
  }
];

// Функция вызова Qwen3-30B-A3B с thinking
async function callQwen30B(message, enableThinking = false) {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    const start = Date.now();
    
    // Базовое тело запроса
    const requestBody = {
      model: 'qwen3-30b-a3b',
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
    };
    
    // Пробуем разные способы передачи параметра
    if (enableThinking !== null) {
      // Способ 1: напрямую в теле запроса
      requestBody.enable_thinking = enableThinking;
      
      // Способ 2: в parameters
      requestBody.parameters = {
        enable_thinking: enableThinking
      };
      
      // Способ 3: в extra_body (как было)
      requestBody.extra_body = {
        enable_thinking: enableThinking
      };
    }
    
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    const usage = response.data.usage;
    
    // Проверяем, есть ли thinking в ответе
    const hasThinking = response.data.choices[0].message.thinking_content || 
                       text.includes('<thinking>') || 
                       response.data.choices[0].thinking;
    
    return { 
      success: true,
      text, 
      time, 
      usage,
      hasThinking,
      thinking: response.data.choices[0].message.thinking_content || response.data.choices[0].thinking
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code
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
  console.log('🚀 Тестируем Qwen3-30B-A3B (MoE: 30B total, 3.3B active)\n');
  console.log('Особенности модели:');
  console.log('- Mixture of Experts архитектура');
  console.log('- 30.5B параметров всего, но только 3.3B активны');
  console.log('- Контекст: 262K токенов');
  console.log('- Поддержка "thinking" режима для рассуждений');
  console.log('=' .repeat(80));
  
  // Сначала попробуем разные варианты параметров
  console.log('\n🔧 Тест 1: Поиск правильной конфигурации...\n');
  
  const configs = [
    { name: 'С enable_thinking: false', enableThinking: false },
    { name: 'С enable_thinking: true', enableThinking: true },
    { name: 'Без extra_body', enableThinking: null }
  ];
  
  let workingConfig = null;
  
  for (const config of configs) {
    console.log(`Пробуем ${config.name}...`);
    const result = await callQwen30B('Привет!', config.enableThinking);
    
    if (result.success) {
      console.log(`✅ Успех! Конфигурация работает`);
      workingConfig = config;
      break;
    } else {
      console.log(`❌ Ошибка: ${result.error}`);
    }
  }
  
  if (!workingConfig) {
    console.log('\n❌ Не удалось найти рабочую конфигурацию для Qwen3-30B-A3B');
    return;
  }
  
  // Теперь тестируем на реальных сценариях
  console.log(`\n\n🎯 Тест 2: Реальные сценарии с конфигурацией "${workingConfig.name}"\n`);
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(80));
    
    const result = await callQwen30B(scenario.message, workingConfig.enableThinking);
    
    if (result.success) {
      const commands = extractCommands(result.text);
      
      console.log(`\n✅ Ответ: ${result.text}`);
      console.log(`⏱️  Время: ${result.time}ms`);
      console.log(`🎯 Команды: ${commands.join(', ') || 'нет'}`);
      console.log(`📊 Токены: ${result.usage?.total_tokens || 'н/д'}`);
      
      if (result.hasThinking && result.thinking) {
        console.log(`💭 Размышления: ${result.thinking.substring(0, 200)}...`);
      }
      
      results.push({
        scenario: scenario.name,
        time: result.time,
        commands: commands.length,
        tokens: result.usage?.total_tokens || 0,
        hasThinking: result.hasThinking
      });
    } else {
      console.log(`❌ Ошибка: ${result.error}`);
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Итоговая статистика
  if (results.length > 0) {
    console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log('='.repeat(80));
    
    const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
    const commandSuccess = results.filter(r => r.commands > 0).length;
    const avgTokens = results.reduce((sum, r) => sum + r.tokens, 0) / results.length;
    const withThinking = results.filter(r => r.hasThinking).length;
    
    console.log('\n🟢 Qwen3-30B-A3B (MoE):');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.length}`);
    console.log(`- Средние токены: ${Math.round(avgTokens)}`);
    console.log(`- Ответов с размышлениями: ${withThinking}/${results.length}`);
    console.log(`- Архитектура: MoE (30.5B total, 3.3B active)`);
    console.log(`- Контекст: 262K токенов`);
    
    console.log('\n🆚 Сравнение с другими моделями:');
    console.log('- Qwen2.5-32B: 1378ms (обычная архитектура)');
    console.log('- Qwen-Turbo: 1499ms (самая дешевая)');
    console.log('- DeepSeek: ~7500ms (текущее решение)');
    
    console.log('\n💡 ПРЕИМУЩЕСТВА Qwen3-30B-A3B:');
    console.log('1. MoE архитектура - скорость маленькой модели (3.3B) с качеством большой (30B)');
    console.log('2. Огромный контекст 262K токенов (в 2 раза больше DeepSeek)');
    console.log('3. Режим размышлений для сложных задач');
    console.log('4. Оптимальна для чат-ботов с длинными диалогами');
  }
}

// Запуск
console.log('🔧 Используем DashScope API (Alibaba Cloud)\n');
runTests().catch(console.error);