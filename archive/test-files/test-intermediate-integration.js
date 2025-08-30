// test-intermediate-integration.js
// Интеграционный тест промежуточного контекста с реальным AI Admin v2

require('dotenv').config();
const AIAdminV2 = require('./src/services/ai-admin-v2');
const intermediateContext = require('./src/services/context/intermediate-context');
const contextService = require('./src/services/context');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function simulateRapidMessages() {
  const testPhone = '79001234567';
  const companyId = 962302;
  
  console.log('\n' + colors.bright + colors.magenta + '🚀 Тест быстрых последовательных сообщений с AI Admin v2\n' + colors.reset);
  
  // Очищаем контекст перед тестом
  await contextService.clearContext(testPhone, companyId);
  log('🧹 Контекст очищен', 'cyan');
  
  // Сценарий: клиент быстро отправляет несколько сообщений
  const messages = [
    { text: 'Привет', delay: 0 },
    { text: 'хочу записаться', delay: 500 },  // через 0.5 сек
    { text: 'на стрижку', delay: 1000 },      // через 1 сек
    { text: 'завтра в 15:00', delay: 1500 }   // через 1.5 сек
  ];
  
  // Функция для отправки сообщения
  async function sendMessage(text, index) {
    log(`\n📱 Сообщение ${index + 1}: "${text}"`, 'yellow');
    
    // Проверяем промежуточный контекст перед отправкой
    const beforeContext = await intermediateContext.getIntermediateContext(testPhone);
    if (beforeContext && beforeContext.isRecent) {
      log(`⏳ Найден активный контекст (${beforeContext.processingStatus})`, 'cyan');
      if (beforeContext.lastBotQuestion) {
        log(`❓ Последний вопрос бота: "${beforeContext.lastBotQuestion}"`, 'blue');
      }
    }
    
    try {
      // Отправляем сообщение в AI Admin
      const startTime = Date.now();
      const response = await AIAdminV2.processMessage(text, testPhone, companyId);
      const processingTime = Date.now() - startTime;
      
      if (response.success) {
        log(`✅ Обработано за ${processingTime}ms`, 'green');
        log(`🤖 Ответ: "${response.response.substring(0, 100)}..."`, 'green');
        
        // Проверяем сохраненный контекст после обработки
        const afterContext = await intermediateContext.getIntermediateContext(testPhone);
        if (afterContext && afterContext.processingStatus === 'completed') {
          if (afterContext.mentionedServices.length > 0) {
            log(`📋 Упомянутые услуги: ${afterContext.mentionedServices.join(', ')}`, 'cyan');
          }
          if (afterContext.mentionedDates.length > 0) {
            log(`📅 Упомянутые даты: ${afterContext.mentionedDates.join(', ')}`, 'cyan');
          }
          if (afterContext.mentionedTimes.length > 0) {
            log(`⏰ Упомянутое время: ${afterContext.mentionedTimes.join(', ')}`, 'cyan');
          }
        }
      } else {
        log(`❌ Ошибка: ${response.error}`, 'red');
      }
    } catch (error) {
      log(`❌ Критическая ошибка: ${error.message}`, 'red');
    }
  }
  
  // Отправляем сообщения с задержками
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (msg.delay > 0) {
      log(`\n⏱️  Ждем ${msg.delay}ms перед следующим сообщением...`, 'cyan');
      await new Promise(resolve => setTimeout(resolve, msg.delay));
    }
    
    await sendMessage(msg.text, i);
  }
  
  // Финальная проверка контекста диалога
  log('\n📊 Финальная проверка контекста диалога:', 'bright');
  
  const finalContext = await contextService.getContext(testPhone, companyId);
  const conversationSummary = await contextService.getConversationSummary(testPhone, companyId);
  
  if (finalContext && finalContext.conversation) {
    log(`💬 Сообщений в диалоге: ${finalContext.conversation.length}`, 'cyan');
    
    // Проверяем, что все сообщения сохранены
    const userMessages = finalContext.conversation.filter(m => m.role === 'user').map(m => m.content);
    const expectedMessages = messages.map(m => m.text);
    
    let allMessagesSaved = true;
    for (const expected of expectedMessages) {
      if (!userMessages.some(msg => msg.includes(expected))) {
        log(`⚠️  Сообщение "${expected}" не найдено в контексте`, 'yellow');
        allMessagesSaved = false;
      }
    }
    
    if (allMessagesSaved) {
      log('✅ Все сообщения корректно сохранены в контексте!', 'green');
    } else {
      log('❌ Некоторые сообщения потеряны', 'red');
    }
  }
  
  if (conversationSummary) {
    log('\n📝 Саммари диалога:', 'cyan');
    console.log(conversationSummary);
  }
}

// Запуск теста
async function main() {
  try {
    await simulateRapidMessages();
    
    log('\n✅ Тест завершен!', 'bright');
    
    // Ждем немного перед выходом, чтобы все асинхронные операции завершились
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (error) {
    log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();