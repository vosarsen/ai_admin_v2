#!/usr/bin/env node

const axios = require('axios');

// Тестовые сценарии для некорректных вводов
const testScenarios = [
  {
    name: "Опечатки в командах",
    messages: [
      "хачу записацца",           // опечатка в "хочу записаться"
      "хочу запистаься",          // опечатка
      "записть меня пжлста",      // сокращения и опечатки
      "запсь на маникр",          // сильные сокращения
      "стрчк",                    // попытка написать "стрижка"
      "мнкр",                     // попытка написать "маникюр"
    ]
  },
  {
    name: "Неполная информация",
    messages: [
      "записаться",               // без указания услуги
      "хочу завтра",              // без услуги
      "на 15:00",                 // без даты и услуги
      "к Ольге",                  // только мастер
      "маникюр",                  // только услуга
      "в пятницу",                // день без времени
    ]
  },
  {
    name: "Противоречивые запросы",
    messages: [
      "хочу записаться на маникюр и стрижку одновременно на 15:00",
      "запишите меня вчера на 10 утра",
      "хочу на маникюр но чтобы без маникюра",
      "к Ольге но не к Ольге",
      "на сегодня в прошлом месяце",
      "утром в 23:00",
    ]
  },
  {
    name: "Спам и повторы",
    messages: [
      "!!!!!!!!!",
      "ЗАПИШИ МЕНЯ СРОЧНО!!!",
      "а",
      "аааааааааааааааааааааааа",
      "123123123123123",
      "тест тест тест тест тест",
    ]
  }
];

// Настройки
const API_URL = 'http://46.149.70.219:3000';
const TEST_PHONE = '79001234567';
const COMPANY_ID = 962302;
const SECRET_KEY = process.env.SECRET_KEY || 'defaultSecretKey123';

async function sendMessage(phone, message) {
  try {
    const payload = {
      messages: [{
        from: phone,
        body: message,
        type: 'chat',
        timestamp: new Date().toISOString()
      }],
      companyId: COMPANY_ID
    };

    const response = await axios.post(
      `${API_URL}/webhook/whatsapp/ai-admin`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature': 'test-signature'
        }
      }
    );

    return response.data;
  } catch (error) {
    return { error: error.message };
  }
}

async function waitForResponse(phone, timeout = 10000) {
  console.log(`⏳ Ожидание ответа (${timeout/1000}с)...`);
  
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const { exec } = require('child_process');
      const command = `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "tail -20 /root/.pm2/logs/ai-admin-worker-v2-out.log | grep -A5 '🤖 Bot response to ${phone}'"`;
      
      const result = await new Promise((resolve) => {
        exec(command, (error, stdout) => {
          resolve(stdout || '');
        });
      });
      
      if (result && result.includes('🤖 Bot response')) {
        return result;
      }
    } catch (error) {
      // Игнорируем ошибки и продолжаем ждать
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return 'Timeout - no response';
}

async function runTests() {
  console.log('🧪 Тестирование некорректных вводов для AI Admin v2\n');
  console.log('=' .repeat(80));

  for (const scenario of testScenarios) {
    console.log(`\n📋 Сценарий: ${scenario.name}`);
    console.log('-'.repeat(80));

    for (const message of scenario.messages) {
      console.log(`\n📤 Отправка: "${message}"`);
      
      const result = await sendMessage(TEST_PHONE, message);
      
      if (result.error) {
        console.log(`❌ Ошибка отправки: ${result.error}`);
      } else {
        console.log(`✅ Сообщение отправлено`);
        
        // Ждем ответ
        const response = await waitForResponse(TEST_PHONE);
        
        if (response && response !== 'Timeout - no response') {
          // Извлекаем текст ответа
          const responseMatch = response.match(/🤖 Bot response to \d+: (.*?)(\n|$)/);
          if (responseMatch) {
            console.log(`🤖 Ответ бота: ${responseMatch[1]}`);
          } else {
            console.log(`📝 Лог: ${response.substring(0, 200)}...`);
          }
        } else {
          console.log(`⏱️ Таймаут - ответ не получен`);
        }
      }
      
      // Пауза между сообщениями
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Тестирование завершено!');
  console.log('\n💡 Рекомендации:');
  console.log('1. Проверьте логи на сервере для детального анализа');
  console.log('2. Убедитесь, что бот корректно обрабатывает опечатки');
  console.log('3. Проверьте, что бот запрашивает недостающую информацию');
  console.log('4. Убедитесь, что спам-сообщения игнорируются или обрабатываются корректно');
}

// Запуск тестов
runTests().catch(console.error);