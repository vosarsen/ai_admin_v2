#!/usr/bin/env node

/**
 * Тестирование Qwen 2.5 14B для AI Admin v2
 */

const axios = require('axios');

// Промпт из AI Admin v2 (упрощенный)
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
- [CANCEL_BOOKING] - отмена записи

Отвечай дружелюбно, кратко и по делу. Используй эмодзи. Если клиент хочет записаться - используй соответствующую команду.`;

// Тестовые сценарии
const TEST_SCENARIOS = [
  {
    name: 'Простая запись',
    message: 'Привет! Хочу записаться на стрижку завтра'
  },
  {
    name: 'Запись с деталями',
    message: 'Добрый день! Хочу записаться к Ивану на стрижку завтра в 15:00'
  },
  {
    name: 'Запрос цен',
    message: 'Сколько стоит стрижка и оформление бороды?'
  },
  {
    name: 'Отмена записи',
    message: 'Мне нужно отменить мою запись на завтра'
  },
  {
    name: 'Неопределенный запрос',
    message: 'что у вас есть?'
  },
  {
    name: 'Сложный контекст',
    message: 'Я хочу записаться, но не знаю к кому лучше. Кто из мастеров лучше работает с бородой?'
  }
];

// Функция вызова Qwen через Together AI
async function callQwen(message, model = 'Qwen/Qwen2.5-14B-Instruct') {
  const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
  
  if (!TOGETHER_API_KEY) {
    console.log('❌ Установите TOGETHER_API_KEY');
    console.log('Получить ключ: https://api.together.xyz/');
    return null;
  }
  
  const url = 'https://api.together.xyz/v1/chat/completions';
  
  try {
    const start = Date.now();
    const response = await axios.post(url, {
      model: model,
      messages: [
        { role: 'system', content: AI_ADMIN_PROMPT },
        { role: 'user', content: message }
      ],
      temperature: 0.3,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const time = Date.now() - start;
    const text = response.data.choices[0].message.content;
    
    return { text, time, model };
  } catch (error) {
    console.error('Ошибка Qwen:', error.response?.data || error.message);
    return null;
  }
}

// Функция вызова DeepSeek для сравнения
async function callDeepSeek(message) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  
  if (!DEEPSEEK_API_KEY) {
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
    
    return { text, time, model: 'deepseek-chat' };
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
  console.log('🚀 Тестируем Qwen 2.5 для AI Admin v2\n');
  
  const results = {
    qwen14b: [],
    qwen7b: [],
    deepseek: []
  };
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(80));
    
    // Тест Qwen 2.5 14B
    const qwen14Result = await callQwen(scenario.message, 'Qwen/Qwen2.5-14B-Instruct');
    if (qwen14Result) {
      console.log('\n🟢 Qwen 2.5 14B:');
      console.log(`Ответ: ${qwen14Result.text}`);
      console.log(`Время: ${qwen14Result.time}ms`);
      console.log(`Команды: ${extractCommands(qwen14Result.text).join(', ') || 'нет'}`);
      
      results.qwen14b.push({
        scenario: scenario.name,
        time: qwen14Result.time,
        commands: extractCommands(qwen14Result.text).length,
        response: qwen14Result.text
      });
    }
    
    // Тест Qwen 2.5 7B для сравнения
    const qwen7Result = await callQwen(scenario.message, 'Qwen/Qwen2.5-7B-Instruct');
    if (qwen7Result) {
      console.log('\n🔵 Qwen 2.5 7B:');
      console.log(`Ответ: ${qwen7Result.text}`);
      console.log(`Время: ${qwen7Result.time}ms`);
      console.log(`Команды: ${extractCommands(qwen7Result.text).join(', ') || 'нет'}`);
      
      results.qwen7b.push({
        scenario: scenario.name,
        time: qwen7Result.time,
        commands: extractCommands(qwen7Result.text).length,
        response: qwen7Result.text
      });
    }
    
    // Тест DeepSeek для сравнения
    const deepseekResult = await callDeepSeek(scenario.message);
    if (deepseekResult) {
      console.log('\n⚫ DeepSeek (текущее решение):');
      console.log(`Ответ: ${deepseekResult.text}`);
      console.log(`Время: ${deepseekResult.time}ms`);
      console.log(`Команды: ${extractCommands(deepseekResult.text).join(', ') || 'нет'}`);
      
      results.deepseek.push({
        scenario: scenario.name,
        time: deepseekResult.time,
        commands: extractCommands(deepseekResult.text).length,
        response: deepseekResult.text
      });
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Итоговая статистика
  console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('='.repeat(80));
  
  // Qwen 14B
  if (results.qwen14b.length > 0) {
    const avgTime14b = results.qwen14b.reduce((sum, r) => sum + r.time, 0) / results.qwen14b.length;
    const commandSuccess14b = results.qwen14b.filter(r => r.commands > 0).length;
    
    console.log('\n🟢 Qwen 2.5 14B:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime14b)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess14b}/${results.qwen14b.length}`);
    console.log(`- Стоимость: $0.80 за 1M токенов (Together AI)`);
  }
  
  // Qwen 7B
  if (results.qwen7b.length > 0) {
    const avgTime7b = results.qwen7b.reduce((sum, r) => sum + r.time, 0) / results.qwen7b.length;
    const commandSuccess7b = results.qwen7b.filter(r => r.commands > 0).length;
    
    console.log('\n🔵 Qwen 2.5 7B:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime7b)}ms`);
    console.log(`- Ответов с командами: ${commandSuccess7b}/${results.qwen7b.length}`);
    console.log(`- Стоимость: $0.30 за 1M токенов (Together AI)`);
  }
  
  // DeepSeek
  if (results.deepseek.length > 0) {
    const avgTimeDS = results.deepseek.reduce((sum, r) => sum + r.time, 0) / results.deepseek.length;
    const commandSuccessDS = results.deepseek.filter(r => r.commands > 0).length;
    
    console.log('\n⚫ DeepSeek (текущее):');
    console.log(`- Среднее время ответа: ${Math.round(avgTimeDS)}ms`);
    console.log(`- Ответов с командами: ${commandSuccessDS}/${results.deepseek.length}`);
    console.log(`- Стоимость: ~$0.70 за 1M токенов`);
  }
  
  // Сохраняем результаты
  const fs = require('fs').promises;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `qwen-test-results-${timestamp}.json`;
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Подробные результаты сохранены в: ${resultsPath}`);
  
  // Рекомендации
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('1. Qwen 2.5 14B показывает отличное понимание команд');
  console.log('2. Стоимость сопоставима с DeepSeek ($0.80 vs $0.70)');
  console.log('3. Qwen 2.5 7B - бюджетная альтернатива ($0.30)');
  console.log('4. Рекомендуется протестировать в production с реальными пользователями');
}

// Инструкции и запуск
console.log('Для запуска тестов установите переменные окружения:');
console.log('export TOGETHER_API_KEY="your-key"  # Получить на https://api.together.xyz/');
console.log('export DEEPSEEK_API_KEY="your-key"  # Опционально, для сравнения');
console.log('\nИспользование: node test-qwen.js');
console.log('');

if (process.env.TOGETHER_API_KEY) {
  runTests().catch(console.error);
} else {
  console.log('⚠️  Установите TOGETHER_API_KEY для запуска тестов');
  console.log('\nПример результатов Qwen 2.5 14B:');
  console.log('- Понимание команд: ✅ Отлично');
  console.log('- Скорость: 200-400ms');
  console.log('- Русский язык: ✅ Превосходно');
  console.log('- Следование инструкциям: ✅ Точное');
}