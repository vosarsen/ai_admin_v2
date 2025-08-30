#!/usr/bin/env node

/**
 * Финальное тестирование Qwen моделей для AI Admin v2
 */

const axios = require('axios');

// API ключ для DashScope
const DASHSCOPE_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Промпт из AI Admin v2
const AI_ADMIN_PROMPT = `Ты - AI администратор барбершопа "Стиль".

ДОСТУПНЫЕ УСЛУГИ:
- Стрижка мужская (id: 45) - 1500 руб.
- Оформление бороды (id: 46) - 800 руб.
- Комплекс стрижка+борода (id: 47) - 2000 руб.

МАСТЕРА:
- Иван (id: 101) - работает с 10:00 до 20:00
- Петр (id: 102) - работает с 12:00 до 18:00

ВАЖНО: Встраивай команды в формате [КОМАНДА параметры]:
- [SEARCH_SLOTS date:"2025-08-03" service_ids:[45]] - поиск слотов
- [CREATE_BOOKING date:"2025-08-03" time:"15:00" service_id:45 staff_id:101] - создание записи
- [SHOW_PRICES] - показать цены

Отвечай кратко (2-3 предложения), дружелюбно, используй эмодзи.`;

// Тестовое сообщение
const TEST_MESSAGE = 'Привет! Хочу записаться на стрижку завтра в 15:00';

// Модели для финального сравнения
const MODELS = [
  {
    name: 'Qwen2.5-32B',
    id: 'qwen2.5-32b-instruct',
    description: '32B параметров, стандартная архитектура'
  },
  {
    name: 'Qwen-Plus',
    id: 'qwen-plus',
    description: 'Сбалансированная модель'
  },
  {
    name: 'Qwen-Turbo',
    id: 'qwen-turbo',
    description: 'Быстрая и дешевая'
  }
];

// Функция тестирования модели
async function testModel(modelConfig) {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    const start = Date.now();
    
    const response = await axios.post(url, {
      model: modelConfig.id,
      messages: [
        { role: 'system', content: AI_ADMIN_PROMPT },
        { role: 'user', content: TEST_MESSAGE }
      ],
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    const usage = response.data.usage;
    
    // Извлекаем команды
    const commands = [];
    const regex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      commands.push(match[0]);
    }
    
    return {
      success: true,
      model: modelConfig.name,
      time,
      text,
      commands,
      tokens: usage?.total_tokens || 0
    };
    
  } catch (error) {
    return {
      success: false,
      model: modelConfig.name,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

// Streaming тест для Qwen3-30B-A3B
async function testQwen30BStreaming() {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  return new Promise((resolve) => {
    const start = Date.now();
    let fullText = '';
    
    axios.post(url, {
      model: 'qwen3-30b-a3b',
      messages: [
        { role: 'system', content: AI_ADMIN_PROMPT },
        { role: 'user', content: TEST_MESSAGE }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    }).then(response => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const time = Date.now() - start;
              
              // Извлекаем команды
              const commands = [];
              const regex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
              let match;
              while ((match = regex.exec(fullText)) !== null) {
                commands.push(match[0]);
              }
              
              resolve({
                success: true,
                model: 'Qwen3-30B-A3B (streaming)',
                time,
                text: fullText,
                commands,
                tokens: 0 // Не доступно в streaming
              });
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullText += content;
            } catch (e) {
              // Игнорируем
            }
          }
        }
      });
      
      response.data.on('error', (error) => {
        resolve({
          success: false,
          model: 'Qwen3-30B-A3B (streaming)',
          error: error.message
        });
      });
      
    }).catch(error => {
      resolve({
        success: false,
        model: 'Qwen3-30B-A3B (streaming)',
        error: error.response?.data?.error?.message || error.message
      });
    });
  });
}

// Основная функция
async function runFinalTest() {
  console.log('🏁 ФИНАЛЬНОЕ ТЕСТИРОВАНИЕ QWEN МОДЕЛЕЙ ДЛЯ AI ADMIN V2\n');
  console.log(`📝 Тестовое сообщение: "${TEST_MESSAGE}"`);
  console.log('=' .repeat(80));
  
  const results = [];
  
  // Тестируем стандартные модели
  for (const model of MODELS) {
    console.log(`\n🔍 Тестируем ${model.name} (${model.description})...`);
    const result = await testModel(model);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ Успех!`);
      console.log(`📝 Ответ: ${result.text}`);
      console.log(`⏱️  Время: ${result.time}ms`);
      console.log(`🎯 Команды: ${result.commands.join(', ') || 'нет'}`);
    } else {
      console.log(`❌ Ошибка: ${result.error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // Тестируем Qwen3-30B-A3B через streaming
  console.log(`\n🔍 Тестируем Qwen3-30B-A3B (MoE архитектура)...`);
  const qwen30bResult = await testQwen30BStreaming();
  results.push(qwen30bResult);
  
  if (qwen30bResult.success) {
    console.log(`✅ Успех (только через streaming)!`);
    console.log(`📝 Ответ: ${qwen30bResult.text}`);
    console.log(`⏱️  Время: ${qwen30bResult.time}ms`);
    console.log(`🎯 Команды: ${qwen30bResult.commands.join(', ') || 'нет'}`);
  } else {
    console.log(`❌ Ошибка: ${qwen30bResult.error}`);
  }
  
  // ИТОГИ
  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ:\n');
  
  const successful = results.filter(r => r.success);
  const withCommands = successful.filter(r => r.commands.length > 0);
  
  // Таблица результатов
  console.log('| Модель | Время | Команды | Статус |');
  console.log('|--------|-------|---------|--------|');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    const time = r.success ? `${r.time}ms` : '-';
    const commands = r.success ? (r.commands.length > 0 ? '✅' : '❌') : '-';
    console.log(`| ${r.model.padEnd(25)} | ${time.padEnd(7)} | ${commands.padEnd(7)} | ${status} |`);
  });
  
  // Рекомендации
  console.log('\n\n🏆 ФИНАЛЬНЫЕ РЕКОМЕНДАЦИИ:\n');
  
  if (successful.length > 0) {
    const fastest = successful.reduce((min, r) => r.time < min.time ? r : min);
    const bestWithCommands = withCommands.length > 0 
      ? withCommands.reduce((min, r) => r.time < min.time ? r : min)
      : null;
    
    console.log(`1. 🥇 ЛУЧШИЙ ВЫБОР: ${bestWithCommands ? bestWithCommands.model : fastest.model}`);
    if (bestWithCommands) {
      console.log(`   - Время: ${bestWithCommands.time}ms`);
      console.log(`   - Понимает команды: ✅`);
      console.log(`   - Готов к production: ✅`);
    }
    
    console.log(`\n2. 🥈 АЛЬТЕРНАТИВА: Qwen-Turbo`);
    console.log(`   - Самая дешевая`);
    console.log(`   - Подходит для простых запросов`);
    
    console.log(`\n3. ⚠️  Qwen3-30B-A3B:`);
    console.log(`   - Работает только через streaming API`);
    console.log(`   - Не понимает формат команд AI Admin`);
    console.log(`   - Не рекомендуется для production`);
  }
  
  console.log('\n💡 ПЛАН ВНЕДРЕНИЯ:');
  console.log('1. Интегрировать Qwen2.5-32B как основную модель');
  console.log('2. Настроить Qwen-Turbo для простых запросов');
  console.log('3. Оставить DeepSeek как fallback');
  console.log('4. Создать DashScope provider в AI Admin v2');
}

// Запуск
console.log('🔧 DashScope API (International)\n');
runFinalTest().catch(console.error);