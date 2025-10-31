// examples/critical-error-logging-example.js
const criticalErrorLogger = require('../src/utils/critical-error-logger');

// Примеры использования системы критичного логирования

async function demonstrateCriticalLogging() {
  console.log('=== Демонстрация критичного логирования ===\n');
  
  // 1. Ошибка подключения к базе данных
  console.log('1. Логирование ошибки базы данных:');
  const dbError = new Error('Connection to database failed');
  dbError.code = 'ECONNREFUSED';
  dbError.syscall = 'connect';
  dbError.address = '127.0.0.1';
  dbError.port = 5432;
  
  const errorId1 = await criticalErrorLogger.logCriticalError(dbError, {
    service: 'database',
    operation: 'connect',
    companyId: 123,
    attemptNumber: 3
  });
  console.log(`   Logged with ID: ${errorId1}`);
  console.log('');
  
  // 2. Ошибка YClients API
  console.log('2. Логирование ошибки YClients API:');
  const yclientsError = new Error('YClients API request failed: Service Unavailable');
  yclientsError.response = {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'retry-after': '60' },
    data: { error: 'API is under maintenance' }
  };
  yclientsError.config = {
    url: 'https://api.yclients.com/api/v1/book_record/123',
    method: 'POST',
    timeout: 30000
  };
  
  const errorId2 = await criticalErrorLogger.logCriticalError(yclientsError, {
    operation: 'createBooking',
    service: 'yclients',
    companyId: 123,
    clientPhone: '79001234567',
    bookingData: {
      services: [18356041],
      datetime: '2025-07-30 15:00:00'
    }
  });
  console.log(`   Logged with ID: ${errorId2}`);
  console.log('');
  
  // 3. Ошибка безопасности
  console.log('3. Логирование ошибки безопасности:');
  const securityError = new Error('Invalid HMAC signature in webhook');
  securityError.code = 'INVALID_HMAC';
  securityError.name = 'SecurityError';
  
  const errorId3 = await criticalErrorLogger.logCriticalError(securityError, {
    operation: 'webhook_validation',
    security: true,
    ip: '192.168.1.100',
    userAgent: 'Unknown Bot',
    webhookUrl: '/webhook/whatsapp',
    receivedSignature: 'abc123',
    expectedSignature: 'def456'
  });
  console.log(`   Logged with ID: ${errorId3}`);
  console.log('');
  
  // 4. Множественные ошибки (паттерн)
  console.log('4. Симуляция паттерна ошибок:');
  const aiError = new Error('AI service timeout');
  aiError.code = 'ETIMEDOUT';
  
  // Логируем несколько раз для создания паттерна
  for (let i = 0; i < 6; i++) {
    await criticalErrorLogger.logCriticalError(aiError, {
      operation: 'ai_call',
      service: 'deepseek',
      attemptNumber: i + 1,
      userId: '79001234567'
    });
    
    // Небольшая задержка между ошибками
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Анализируем паттерн
  const pattern = criticalErrorLogger.analyzeErrorPattern(aiError, {
    operation: 'ai_call',
    service: 'deepseek'
  });
  
  console.log(`   Паттерн обнаружен: ${pattern.isPattern ? 'ДА' : 'НЕТ'}`);
  if (pattern.isPattern) {
    console.log(`   Тип паттерна: ${pattern.patternType}`);
    console.log(`   Частота: ${pattern.frequency} ошибок`);
  }
  console.log('');
  
  // 5. Проверка статистики
  console.log('5. Текущая статистика ошибок:');
  const recentErrors = criticalErrorLogger.getRecentErrors();
  console.log('   Недавние ошибки:');
  for (const error of recentErrors) {
    console.log(`   - ${error.type}: ${error.count} раз, последняя: ${error.lastSeen}`);
  }
  console.log('');
  
  // 6. Различные уровни серьезности
  console.log('6. Демонстрация уровней серьезности:');
  const errors = [
    { 
      error: new Error('Слот занят'), 
      context: { operation: 'booking' },
      expectedSeverity: 'low'
    },
    {
      error: Object.assign(new Error('WhatsApp disconnected'), { code: 'WHATSAPP_ERROR' }),
      context: { service: 'whatsapp' },
      expectedSeverity: 'high'
    },
    {
      error: Object.assign(new Error('Database connection lost'), { code: 'ECONNREFUSED' }),
      context: { service: 'database' },
      expectedSeverity: 'critical'
    }
  ];
  
  for (const { error, context, expectedSeverity } of errors) {
    const severity = criticalErrorLogger.calculateSeverity(error, context);
    console.log(`   ${error.message}: ${severity} (ожидалось: ${expectedSeverity})`);
  }
}

// Запуск демонстрации
if (require.main === module) {
  demonstrateCriticalLogging()
    .then(() => {
      console.log('\n✅ Демонстрация завершена');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
}

module.exports = demonstrateCriticalLogging;