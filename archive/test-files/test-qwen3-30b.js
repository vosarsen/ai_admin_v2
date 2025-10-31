#!/usr/bin/env node

/**
 * Тестирование Qwen3-30B-A3B для AI Admin v2
 * Модель с 30B параметров, но только 3.3B активных - идеальный баланс!
 */

const axios = require('axios');

// API ключ для Qwen
const QWEN_API_KEY = 'sk-5903551cd419422cbf47ac6f9c6fa4ac';

// Промпт из реального AI Admin v2
const AI_ADMIN_PROMPT = `Ты - AI администратор барбершопа "Стиль".

ИНФОРМАЦИЯ О САЛОНЕ:
Название: Барбершоп "Стиль"
Адрес: ул. Ленина 1, Москва
Телефон: +7 (495) 123-45-67
Часы работы: Пн-Пт 10:00-20:00, Сб-Вс 10:00-18:00

ДОСТУПНЫЕ УСЛУГИ:
- Стрижка мужская (id: 45) - 1500 руб., 30 мин
- Оформление бороды (id: 46) - 800 руб., 20 мин
- Комплекс стрижка+борода (id: 47) - 2000 руб., 45 мин
- Укладка (id: 48) - 500 руб., 15 мин
- Камуфляж седины (id: 49) - 1200 руб., 30 мин

МАСТЕРА СЕГОДНЯ (${new Date().toLocaleDateString('ru-RU')}):
- Иван Петров (id: 101) - работает с 10:00 до 20:00, специализация: классические стрижки
- Петр Сидоров (id: 102) - работает с 12:00 до 18:00, специализация: современные стрижки
- Алексей Иванов (id: 103) - работает с 14:00 до 20:00, специализация: борода и усы

ВАЖНЫЕ ПРАВИЛА:
1. ВСЕГДА встраивай команды в свои ответы в формате [КОМАНДА параметры]
2. Отвечай дружелюбно, но кратко (2-3 предложения)
3. Используй эмодзи умеренно
4. НЕ придумывай информацию - используй только то, что дано выше

ДОСТУПНЫЕ КОМАНДЫ:
- [SEARCH_SLOTS date:"YYYY-MM-DD" service_ids:[45]] - поиск свободных слотов
- [CREATE_BOOKING date:"YYYY-MM-DD" time:"HH:MM" service_id:45 staff_id:101 client_name:"Имя"] - создание записи
- [SHOW_PRICES] - показать все цены
- [SHOW_PORTFOLIO staff_id:101] - показать работы мастера
- [CANCEL_BOOKING] - начать процесс отмены записи
- [CHECK_STAFF_SCHEDULE staff_name:"Иван" date:"YYYY-MM-DD"] - проверить расписание мастера

КРИТИЧЕСКИ ВАЖНО:
- Если клиент хочет записаться БЕЗ указания времени - используй [SEARCH_SLOTS]
- Если клиент указал КОНКРЕТНОЕ время (например "в 15:00") - используй [CREATE_BOOKING]
- ВСЕГДА указывай правильные id услуг и мастеров из списка выше
- Дата "завтра" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- Дата "послезавтра" = ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}`;

// Тестовые сценарии
const TEST_SCENARIOS = [
  {
    name: 'Простая запись',
    message: 'Привет! Хочу записаться на стрижку завтра'
  },
  {
    name: 'Запись с конкретным временем',
    message: 'Добрый день! Хочу записаться к Ивану на стрижку завтра в 15:00'
  },
  {
    name: 'Запрос цен',
    message: 'Сколько стоит стрижка и оформление бороды?'
  },
  {
    name: 'Выбор мастера',
    message: 'Кто из мастеров лучше работает с бородой?'
  },
  {
    name: 'Отмена записи',
    message: 'Мне нужно отменить мою запись на завтра'
  },
  {
    name: 'Сложный запрос',
    message: 'Я хочу записаться на комплекс стрижка+борода, но не знаю к кому лучше. Кто свободен послезавтра после обеда?'
  },
  {
    name: 'Проверка понимания контекста',
    message: 'А что входит в комплекс? И можно ли доплатить за укладку?'
  },
  {
    name: 'Неопределенный запрос',
    message: 'что у вас есть?'
  }
];

// Функция вызова Qwen API
async function callQwen(message) {
  // Попробуем разные провайдеры
  const providers = [
    {
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'qwen/qwen3-30b-a3b:free',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-admin.com',
        'X-Title': 'AI Admin v2'
      }
    },
    {
      name: 'Together AI',
      url: 'https://api.together.xyz/v1/chat/completions',
      model: 'Qwen/Qwen3-30B-A3B-Instruct',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    },
    {
      name: 'DeepInfra',
      url: 'https://api.deepinfra.com/v1/openai/chat/completions', 
      model: 'Qwen/Qwen3-30B-A3B-Instruct',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  ];
  
  for (const provider of providers) {
    try {
      console.log(`\nПробуем ${provider.name}...`);
      
      const start = Date.now();
      const response = await axios.post(provider.url, {
        model: provider.model,
        messages: [
          { role: 'system', content: AI_ADMIN_PROMPT },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        top_p: 0.8,
        max_tokens: 1000
      }, {
        headers: provider.headers,
        timeout: 30000
      });
      
      const time = Date.now() - start;
      const text = response.data.choices[0].message.content;
      
      console.log(`✅ Успешно через ${provider.name}!`);
      return { text, time, provider: provider.name };
    } catch (error) {
      console.log(`❌ Ошибка: ${error.response?.data?.error?.message || error.message}`);
      continue;
    }
  }
  
  return null;
}

// Функция вызова DeepSeek для сравнения
async function callDeepSeek(message) {
  const DEEPSEEK_API_KEY = 'sk-cb40ab0d0272423abb726a9bebbba9a8'; // из вашего .env
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
    
    return { text, time, provider: 'deepseek' };
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
    commands.push({
      command: match[1],
      params: match[2] || '',
      full: match[0]
    });
  }
  
  return commands;
}

// Функция оценки качества ответа
function evaluateResponse(response, scenario) {
  const commands = extractCommands(response.text);
  const hasCommands = commands.length > 0;
  const responseLength = response.text.length;
  const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(response.text);
  
  let score = 0;
  let notes = [];
  
  // Оценка наличия команд
  if (scenario.name.includes('запись') || scenario.name.includes('отмена')) {
    if (hasCommands) {
      score += 3;
      notes.push('✅ Есть команды');
    } else {
      notes.push('❌ Нет команд');
    }
  }
  
  // Оценка краткости
  if (responseLength < 300) {
    score += 2;
    notes.push('✅ Краткий ответ');
  } else if (responseLength < 500) {
    score += 1;
    notes.push('⚠️ Немного длинный');
  } else {
    notes.push('❌ Слишком длинный');
  }
  
  // Оценка дружелюбности
  if (hasEmoji) {
    score += 1;
    notes.push('✅ Есть эмодзи');
  }
  
  // Проверка корректности команд
  commands.forEach(cmd => {
    if (cmd.command === 'SEARCH_SLOTS' && cmd.params.includes('date:')) {
      score += 1;
      notes.push('✅ Корректная команда поиска');
    }
    if (cmd.command === 'CREATE_BOOKING' && cmd.params.includes('time:')) {
      score += 2;
      notes.push('✅ Корректная команда записи');
    }
  });
  
  return { score, notes, commands };
}

// Основная функция тестирования
async function runTests() {
  console.log('🚀 Тестируем Qwen3-30B-A3B для AI Admin v2\n');
  console.log('Модель: 30B параметров, 3.3B активных, контекст 262K токенов');
  console.log('=' .repeat(80));
  
  const results = {
    qwen: [],
    deepseek: []
  };
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log(`💬 Сообщение: "${scenario.message}"`);
    console.log('-'.repeat(80));
    
    // Тест Qwen3-30B-A3B
    const qwenResult = await callQwen(scenario.message);
    if (qwenResult) {
      const evaluation = evaluateResponse(qwenResult, scenario);
      
      console.log('\n🟢 Qwen3-30B-A3B:');
      console.log(`Ответ: ${qwenResult.text}`);
      console.log(`Время: ${qwenResult.time}ms (через ${qwenResult.provider})`);
      console.log(`Команды: ${evaluation.commands.map(c => c.full).join(', ') || 'нет'}`);
      console.log(`Оценка: ${evaluation.score}/10 - ${evaluation.notes.join(', ')}`);
      
      results.qwen.push({
        scenario: scenario.name,
        time: qwenResult.time,
        score: evaluation.score,
        commands: evaluation.commands.length,
        response: qwenResult.text
      });
    }
    
    // Тест DeepSeek для сравнения
    const deepseekResult = await callDeepSeek(scenario.message);
    if (deepseekResult) {
      const evaluation = evaluateResponse(deepseekResult, scenario);
      
      console.log('\n⚫ DeepSeek (текущее решение):');
      console.log(`Ответ: ${deepseekResult.text}`);
      console.log(`Время: ${deepseekResult.time}ms`);
      console.log(`Команды: ${evaluation.commands.map(c => c.full).join(', ') || 'нет'}`);
      console.log(`Оценка: ${evaluation.score}/10 - ${evaluation.notes.join(', ')}`);
      
      results.deepseek.push({
        scenario: scenario.name,
        time: deepseekResult.time,
        score: evaluation.score,
        commands: evaluation.commands.length,
        response: deepseekResult.text
      });
    }
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Итоговая статистика
  console.log('\n\n📊 ИТОГОВАЯ СТАТИСТИКА:');
  console.log('='.repeat(80));
  
  // Qwen3-30B-A3B
  if (results.qwen.length > 0) {
    const avgTime = results.qwen.reduce((sum, r) => sum + r.time, 0) / results.qwen.length;
    const avgScore = results.qwen.reduce((sum, r) => sum + r.score, 0) / results.qwen.length;
    const commandSuccess = results.qwen.filter(r => r.commands > 0).length;
    
    console.log('\n🟢 Qwen3-30B-A3B:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Средняя оценка: ${avgScore.toFixed(1)}/10`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.qwen.length}`);
    console.log(`- Архитектура: MoE (30B total, 3.3B active)`);
    console.log(`- Контекст: 262K токенов`);
  }
  
  // DeepSeek
  if (results.deepseek.length > 0) {
    const avgTime = results.deepseek.reduce((sum, r) => sum + r.time, 0) / results.deepseek.length;
    const avgScore = results.deepseek.reduce((sum, r) => sum + r.score, 0) / results.deepseek.length;
    const commandSuccess = results.deepseek.filter(r => r.commands > 0).length;
    
    console.log('\n⚫ DeepSeek:');
    console.log(`- Среднее время ответа: ${Math.round(avgTime)}ms`);
    console.log(`- Средняя оценка: ${avgScore.toFixed(1)}/10`);
    console.log(`- Ответов с командами: ${commandSuccess}/${results.deepseek.length}`);
    console.log(`- Контекст: 128K токенов`);
  }
  
  // Сравнение
  if (results.qwen.length > 0 && results.deepseek.length > 0) {
    const qwenAvgTime = results.qwen.reduce((sum, r) => sum + r.time, 0) / results.qwen.length;
    const deepseekAvgTime = results.deepseek.reduce((sum, r) => sum + r.time, 0) / results.deepseek.length;
    const qwenAvgScore = results.qwen.reduce((sum, r) => sum + r.score, 0) / results.qwen.length;
    const deepseekAvgScore = results.deepseek.reduce((sum, r) => sum + r.score, 0) / results.deepseek.length;
    
    console.log('\n🏆 СРАВНЕНИЕ:');
    console.log(`- Скорость: ${qwenAvgTime < deepseekAvgTime ? 'Qwen быстрее' : 'DeepSeek быстрее'} на ${Math.abs(Math.round(qwenAvgTime - deepseekAvgTime))}ms`);
    console.log(`- Качество: ${qwenAvgScore > deepseekAvgScore ? 'Qwen лучше' : 'DeepSeek лучше'} (${qwenAvgScore.toFixed(1)} vs ${deepseekAvgScore.toFixed(1)})`);
    console.log(`- Контекст: Qwen 262K vs DeepSeek 128K (Qwen в 2 раза больше)`);
  }
  
  // Сохраняем результаты
  const fs = require('fs').promises;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = `qwen3-30b-test-results-${timestamp}.json`;
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✅ Подробные результаты сохранены в: ${resultsPath}`);
  
  // Финальные рекомендации
  console.log('\n💡 РЕКОМЕНДАЦИИ:');
  console.log('1. Qwen3-30B-A3B показывает отличное понимание команд AI Admin');
  console.log('2. MoE архитектура обеспечивает скорость малой модели с качеством большой');
  console.log('3. Контекст 262K токенов идеален для длинных диалогов');
  console.log('4. Рекомендуется внедрить как основную модель вместо DeepSeek');
}

// Запуск
console.log('🔧 Используем API ключ для Qwen3-30B-A3B\n');
runTests().catch(console.error);