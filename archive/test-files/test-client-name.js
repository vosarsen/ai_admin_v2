// Тест использования имени клиента из БД
require('dotenv').config();

// Принудительно включаем two-stage
process.env.USE_TWO_STAGE = 'true';
process.env.AI_PROMPT_VERSION = 'two-stage';

const aiAdmin = require('./src/services/ai-admin-v2');
const contextServiceV2 = require('./src/services/context/context-service-v2');

const TEST_PHONE = '+79686484488'; // Ваш тестовый номер (Арсен)
const COMPANY_ID = 962302;

async function testClientName() {
  console.log('🧪 Тестирование использования имени клиента из БД');
  console.log('=========================================\n');
  
  try {
    // Очищаем контекст для чистого теста
    console.log('1️⃣ Очищаем контекст...');
    await contextServiceV2.clearDialogContext(TEST_PHONE, COMPANY_ID);
    await contextServiceV2.invalidateFullContextCache(TEST_PHONE, COMPANY_ID);
    console.log('✅ Контекст очищен\n');
    
    // Первое сообщение - приветствие
    console.log('2️⃣ Отправляем приветствие...');
    const greeting = await aiAdmin.processMessage(
      'Привет! Хочу записаться на стрижку',
      TEST_PHONE,
      COMPANY_ID
    );
    
    console.log('📱 Клиент: "Привет! Хочу записаться на стрижку"');
    console.log('🤖 Бот:', greeting.response);
    
    // Проверяем, использовал ли AI имя из БД
    const hasName = greeting.response.toLowerCase().includes('арсен');
    console.log('\n📊 Результат:');
    console.log(`- Имя "Арсен" ${hasName ? '✅ ИСПОЛЬЗОВАНО' : '❌ НЕ использовано'}`);
    console.log(`- Тип процессора: ${process.env.USE_TWO_STAGE === 'true' ? 'Two-Stage' : 'ReAct'}`);
    
    // Проверим контекст
    console.log('\n3️⃣ Проверяем контекст...');
    const context = await contextServiceV2.getFullContext(TEST_PHONE, COMPANY_ID);
    console.log('📋 Данные клиента в контексте:');
    console.log(`- Имя: ${context.client?.name || 'НЕ ЗАГРУЖЕНО'}`);
    console.log(`- ID: ${context.client?.id || 'НЕ ЗАГРУЖЕНО'}`);
    console.log(`- Визиты: ${context.client?.visits_count || 0}`);
    
    // Второе сообщение - проверяем продолжение диалога
    console.log('\n4️⃣ Проверяем продолжение диалога...');
    const continuation = await aiAdmin.processMessage(
      'Есть время завтра в 15:00?',
      TEST_PHONE,
      COMPANY_ID
    );
    
    console.log('📱 Клиент: "Есть время завтра в 15:00?"');
    console.log('🤖 Бот:', continuation.response);
    
    const hasNameInContinuation = continuation.response.toLowerCase().includes('арсен');
    console.log(`\n- Имя в продолжении: ${hasNameInContinuation ? '✅ используется' : '⚠️ не используется (нормально)'}`);
    
    console.log('\n✅ Тест завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

// Запускаем тест
testClientName();