#!/usr/bin/env node

/**
 * Тестирование различных моделей Qwen3 через DashScope
 */

const axios = require('axios');

// API ключ для DashScope
const DASHSCOPE_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Промпт из AI Admin v2
const AI_ADMIN_PROMPT = `Ты - AI администратор барбершопа. Встраивай команды в формате [КОМАНДА параметры]:
- [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] - поиск слотов
- [CREATE_BOOKING] - создание записи
Отвечай кратко (2-3 предложения), дружелюбно.`;

// Модели для тестирования
const MODELS_TO_TEST = [
  'qwen3-30b-a3b',           // Искомая модель MoE
  'qwen3-30b-a3b-instruct',  // Возможное имя
  'qwen3-coder-plus',        // Новая модель с кодированием
  'qwen-plus',               // Проверенная модель
  'qwen-turbo',              // Быстрая модель
  'qwen-max',                // Максимальная модель
  'qwen2.5-72b-instruct',    // Qwen 2.5
  'qwen2.5-32b-instruct',    // Qwen 2.5 меньше
  'qwen2.5-14b-instruct',    // Qwen 2.5 еще меньше
];

// Тестовое сообщение
const TEST_MESSAGE = 'Привет! Хочу записаться на стрижку завтра в 15:00';

// Функция вызова DashScope API
async function testModel(model) {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    console.log(`\n🔍 Тестируем модель: ${model}`);
    
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
          content: TEST_MESSAGE
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    const model_used = response.data.model;
    
    console.log(`✅ УСПЕХ! Модель доступна`);
    console.log(`📝 Ответ: ${text}`);
    console.log(`⏱️  Время: ${time}ms`);
    console.log(`🏷️  Использована модель: ${model_used}`);
    
    // Проверяем наличие команд
    const hasCommands = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/.test(text);
    console.log(`🎯 Команды: ${hasCommands ? 'Есть' : 'Нет'}`);
    
    return { success: true, model, time, hasCommands };
    
  } catch (error) {
    console.log(`❌ ОШИБКА: ${error.response?.data?.error?.message || error.message}`);
    
    if (error.response?.data?.error?.code) {
      console.log(`   Код ошибки: ${error.response.data.error.code}`);
    }
    
    return { success: false, model, error: error.response?.data?.error?.message };
  }
}

// Основная функция
async function runTests() {
  console.log('🚀 Поиск доступных моделей Qwen3 в DashScope\n');
  console.log(`📝 Тестовое сообщение: "${TEST_MESSAGE}"`);
  console.log('=' .repeat(80));
  
  const results = [];
  
  for (const model of MODELS_TO_TEST) {
    const result = await testModel(model);
    results.push(result);
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Итоги
  console.log('\n\n📊 ИТОГИ ТЕСТИРОВАНИЯ:');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => r.success);
  const withCommands = successful.filter(r => r.hasCommands);
  
  console.log(`\n✅ Доступные модели (${successful.length}/${results.length}):`);
  successful.forEach(r => {
    console.log(`   - ${r.model} (${r.time}ms) ${r.hasCommands ? '🎯' : ''}`);
  });
  
  console.log(`\n🎯 Модели с пониманием команд (${withCommands.length}/${successful.length}):`);
  withCommands.forEach(r => {
    console.log(`   - ${r.model}`);
  });
  
  console.log(`\n❌ Недоступные модели:`);
  results.filter(r => !r.success).forEach(r => {
    console.log(`   - ${r.model}: ${r.error}`);
  });
  
  // Рекомендация
  if (successful.length > 0) {
    const fastest = successful.reduce((min, r) => r.time < min.time ? r : min);
    console.log(`\n💡 РЕКОМЕНДАЦИЯ:`);
    console.log(`   Самая быстрая модель: ${fastest.model} (${fastest.time}ms)`);
    
    if (withCommands.length > 0) {
      const bestWithCommands = withCommands.reduce((min, r) => r.time < min.time ? r : min);
      console.log(`   Лучшая с командами: ${bestWithCommands.model} (${bestWithCommands.time}ms)`);
    }
  }
  
  // Специальная проверка на Qwen3-30B-A3B
  const qwen30b = results.find(r => r.model.includes('30b-a3b'));
  if (qwen30b && !qwen30b.success) {
    console.log('\n⚠️  К сожалению, Qwen3-30B-A3B не доступен через DashScope API');
    console.log('   Возможно, эта модель доступна только через:');
    console.log('   - Hugging Face Inference API');
    console.log('   - Together AI');
    console.log('   - Replicate');
    console.log('   - Локальный запуск');
  }
}

// Запуск
console.log('🔧 Используем DashScope API (Alibaba Cloud)\n');
runTests().catch(console.error);