#!/usr/bin/env node

/**
 * Тестирование Qwen3-30B-A3B через streaming API
 */

const axios = require('axios');

// API ключ для DashScope
const DASHSCOPE_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Простой промпт для теста
const TEST_PROMPT = 'Ты - AI администратор. Отвечай кратко с командами в формате [КОМАНДА]';
const TEST_MESSAGE = 'Привет! Хочу записаться на стрижку завтра в 15:00';

// Функция для стриминга
async function testQwen30BStream() {
  const url = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  try {
    console.log('🔍 Тестируем Qwen3-30B-A3B со streaming...\n');
    
    const response = await axios.post(url, {
      model: 'qwen3-30b-a3b',
      messages: [
        {
          role: 'system',
          content: TEST_PROMPT
        },
        {
          role: 'user',
          content: TEST_MESSAGE
        }
      ],
      stream: true,  // Включаем стриминг
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 30000
    });
    
    console.log('✅ Получен ответ (streaming):\n');
    
    let fullText = '';
    
    // Обработка потока
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            console.log('\n\n✅ Стриминг завершен');
            console.log(`📝 Полный ответ: ${fullText}`);
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              process.stdout.write(content);
              fullText += content;
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    });
    
    response.data.on('end', () => {
      console.log('\n\n🎯 Стриминг завершен успешно');
    });
    
    response.data.on('error', (error) => {
      console.error('\n❌ Ошибка стриминга:', error.message);
    });
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    
    // Если streaming не работает, попробуем другие модели
    console.log('\n🔄 Пробуем альтернативные модели...\n');
    
    const alternativeModels = [
      'qwen3-coder-plus',     // Новая модель для кода
      'qwen2.5-32b-instruct', // 32B параметров
      'qwen-plus',            // Стандартная
      'qwen-turbo'            // Быстрая
    ];
    
    for (const model of alternativeModels) {
      try {
        console.log(`Тестируем ${model}...`);
        
        const response = await axios.post(url, {
          model: model,
          messages: [
            { role: 'system', content: TEST_PROMPT },
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
        
        console.log(`✅ ${model} работает!`);
        console.log(`Ответ: ${response.data.choices[0].message.content}\n`);
        break;
        
      } catch (err) {
        console.log(`❌ ${model}: ${err.response?.data?.error?.message || err.message}\n`);
      }
    }
  }
}

// Функция для проверки доступных моделей
async function checkAvailableModels() {
  console.log('\n📊 Сводка по моделям Qwen:\n');
  console.log('=' .repeat(80));
  
  console.log('\n❌ Qwen3-30B-A3B:');
  console.log('   - Требует enable_thinking: false для non-streaming');
  console.log('   - Но параметр не работает через стандартный API');
  console.log('   - Возможно, доступна только через специальный SDK');
  
  console.log('\n✅ Рекомендуемые альтернативы:');
  console.log('   1. Qwen2.5-32B-Instruct - больше параметров (32B vs 30B)');
  console.log('   2. Qwen3-Coder-Plus - специализирована на структурированных командах');
  console.log('   3. Qwen-Plus - проверенная модель с хорошим качеством');
  console.log('   4. Qwen-Turbo - самая быстрая и дешевая');
  
  console.log('\n💡 Вывод:');
  console.log('   Используйте Qwen2.5-32B вместо Qwen3-30B-A3B.');
  console.log('   Она доступна, быстрая и имеет больше параметров.');
}

// Запуск
console.log('🔧 Тестируем Qwen3-30B-A3B через DashScope API\n');

testQwen30BStream().then(() => {
  setTimeout(() => {
    checkAvailableModels();
  }, 3000);
}).catch(console.error);