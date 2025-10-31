#!/usr/bin/env node

/**
 * Полное тестирование ВСЕХ доступных Qwen моделей
 */

const axios = require('axios');

// API ключ для DashScope
const DASHSCOPE_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Простой промпт для быстрого теста
const TEST_PROMPT = 'Ты AI-ассистент. Встраивай команды [SEARCH_SLOTS date:"2025-08-03"]';
const TEST_MESSAGE = 'Хочу записаться на стрижку завтра';

// ВСЕ возможные Qwen модели (из документации и тестов)
const ALL_QWEN_MODELS = [
  // Qwen 3 серия
  'qwen3-30b-a3b',
  'qwen3-30b-a3b-instruct',
  'qwen3-coder',
  'qwen3-coder-plus',
  'qwen3-235b-a22b',
  'qwen3-235b-a22b-instruct',
  
  // Qwen 2.5 серия
  'qwen2.5-72b-instruct',
  'qwen2.5-32b-instruct',
  'qwen2.5-14b-instruct',
  'qwen2.5-7b-instruct',
  'qwen2.5-3b-instruct',
  'qwen2.5-1.5b-instruct',
  'qwen2.5-0.5b-instruct',
  
  // Qwen 2.5 Coder серия
  'qwen2.5-coder-32b-instruct',
  'qwen2.5-coder-14b-instruct',
  'qwen2.5-coder-7b-instruct',
  'qwen2.5-coder-3b-instruct',
  'qwen2.5-coder-1.5b-instruct',
  
  // Qwen 2.5 Math серия
  'qwen2.5-math-72b-instruct',
  'qwen2.5-math-7b-instruct',
  'qwen2.5-math-1.5b-instruct',
  
  // Основные модели
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'qwen-long',
  
  // Старые версии
  'qwen2-72b-instruct',
  'qwen2-57b-a14b-instruct',
  'qwen2-7b-instruct',
  'qwen2-1.5b-instruct',
  'qwen2-0.5b-instruct',
  
  // Специализированные
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen-audio-turbo',
  
  // QwQ (reasoning)
  'qwq-32b-preview'
];

// Функция тестирования модели
async function testModel(modelName) {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    const start = Date.now();
    
    const response = await axios.post(url, {
      model: modelName,
      messages: [
        { role: 'system', content: TEST_PROMPT },
        { role: 'user', content: TEST_MESSAGE }
      ],
      temperature: 0.7,
      max_tokens: 100,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    
    // Проверяем наличие команд
    const hasCommand = text.includes('[SEARCH_SLOTS') || text.includes('[');
    
    return {
      success: true,
      model: modelName,
      time,
      hasCommand,
      preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    };
    
  } catch (error) {
    // Если модель требует streaming, пробуем со streaming
    if (error.response?.data?.error?.message?.includes('streaming')) {
      return await testModelStreaming(modelName);
    }
    
    return {
      success: false,
      model: modelName,
      error: error.response?.data?.error?.message || error.message,
      code: error.response?.data?.error?.code
    };
  }
}

// Функция для streaming моделей
async function testModelStreaming(modelName) {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  return new Promise((resolve) => {
    const start = Date.now();
    let fullText = '';
    
    axios.post(url, {
      model: modelName,
      messages: [
        { role: 'system', content: TEST_PROMPT },
        { role: 'user', content: TEST_MESSAGE }
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 100
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 15000
    }).then(response => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const time = Date.now() - start;
              const hasCommand = fullText.includes('[SEARCH_SLOTS') || fullText.includes('[');
              
              resolve({
                success: true,
                model: modelName,
                time,
                hasCommand,
                streaming: true,
                preview: fullText.substring(0, 100) + (fullText.length > 100 ? '...' : '')
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
          model: modelName,
          error: error.message
        });
      });
      
    }).catch(error => {
      resolve({
        success: false,
        model: modelName,
        error: error.response?.data?.error?.message || error.message
      });
    });
  });
}

// Основная функция
async function testAllModels() {
  console.log('🔍 ПОЛНОЕ ТЕСТИРОВАНИЕ ВСЕХ QWEN МОДЕЛЕЙ\n');
  console.log(`📝 Тестовых моделей: ${ALL_QWEN_MODELS.length}`);
  console.log(`💬 Тест: "${TEST_MESSAGE}"`);
  console.log('=' .repeat(80));
  
  const results = {
    working: [],
    notFound: [],
    needsStreaming: [],
    otherErrors: []
  };
  
  let tested = 0;
  
  for (const model of ALL_QWEN_MODELS) {
    tested++;
    process.stdout.write(`\r[${tested}/${ALL_QWEN_MODELS.length}] Тестируем ${model}...`.padEnd(60));
    
    const result = await testModel(model);
    
    if (result.success) {
      results.working.push(result);
    } else if (result.error?.includes('does not exist')) {
      results.notFound.push(result);
    } else if (result.error?.includes('streaming')) {
      results.needsStreaming.push(result);
    } else {
      results.otherErrors.push(result);
    }
    
    // Небольшая пауза
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n' + '=' .repeat(80));
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:\n');
  
  // Работающие модели
  console.log(`✅ РАБОТАЮЩИЕ МОДЕЛИ (${results.working.length}):`);
  if (results.working.length > 0) {
    console.log('\n| Модель | Время | Команды | Streaming |');
    console.log('|--------|-------|---------|-----------|');
    
    // Сортируем по скорости
    results.working.sort((a, b) => a.time - b.time);
    
    results.working.forEach(r => {
      const commands = r.hasCommand ? '✅' : '❌';
      const streaming = r.streaming ? '✅' : '❌';
      console.log(`| ${r.model.padEnd(30)} | ${(r.time + 'ms').padEnd(7)} | ${commands.padEnd(9)} | ${streaming.padEnd(11)} |`);
    });
    
    // Топ-5 самых быстрых
    console.log('\n🏆 ТОП-5 САМЫХ БЫСТРЫХ:');
    results.working.slice(0, 5).forEach((r, i) => {
      console.log(`${i + 1}. ${r.model} - ${r.time}ms ${r.hasCommand ? '(с командами)' : ''}`);
    });
    
    // С поддержкой команд
    const withCommands = results.working.filter(r => r.hasCommand);
    console.log(`\n🎯 С ПОДДЕРЖКОЙ КОМАНД (${withCommands.length}/${results.working.length}):`);
    withCommands.slice(0, 5).forEach(r => {
      console.log(`- ${r.model} (${r.time}ms)`);
    });
  }
  
  // Не найденные модели
  console.log(`\n\n❌ НЕ НАЙДЕНЫ (${results.notFound.length}):`);
  if (results.notFound.length > 0) {
    results.notFound.forEach(r => {
      console.log(`- ${r.model}`);
    });
  }
  
  // Другие ошибки
  if (results.otherErrors.length > 0) {
    console.log(`\n\n⚠️ ДРУГИЕ ОШИБКИ (${results.otherErrors.length}):`);
    results.otherErrors.forEach(r => {
      console.log(`- ${r.model}: ${r.error}`);
    });
  }
  
  // Сохраняем полные результаты
  const fs = require('fs').promises;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `all-qwen-models-results-${timestamp}.json`;
  await fs.writeFile(resultsPath, JSON.stringify({
    tested: ALL_QWEN_MODELS.length,
    results: results,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log(`\n\n💾 Полные результаты сохранены в: ${resultsPath}`);
  
  // Финальные рекомендации
  console.log('\n\n🎯 РЕКОМЕНДАЦИИ ДЛЯ AI ADMIN:');
  
  const bestFast = results.working
    .filter(r => r.hasCommand && r.time < 2000)
    .sort((a, b) => a.time - b.time)[0];
    
  const bestBalanced = results.working
    .filter(r => r.hasCommand && r.model.includes('32b'))
    .sort((a, b) => a.time - b.time)[0];
    
  if (bestFast) {
    console.log(`\n1. 🚀 САМАЯ БЫСТРАЯ: ${bestFast.model}`);
    console.log(`   - Время: ${bestFast.time}ms`);
    console.log(`   - Поддержка команд: ✅`);
  }
  
  if (bestBalanced) {
    console.log(`\n2. 💎 ЛУЧШИЙ БАЛАНС: ${bestBalanced.model}`);
    console.log(`   - Время: ${bestBalanced.time}ms`);
    console.log(`   - Размер: 32B параметров`);
  }
  
  console.log('\n3. 💡 ОБЩИЕ ВЫВОДЫ:');
  console.log(`   - Доступно моделей: ${results.working.length}/${ALL_QWEN_MODELS.length}`);
  console.log(`   - С командами: ${results.working.filter(r => r.hasCommand).length}`);
  console.log(`   - Требуют streaming: ${results.working.filter(r => r.streaming).length}`);
}

// Запуск
console.log('🔧 DashScope API - Полное тестирование\n');
testAllModels().catch(console.error);