// test-intermediate-quick.js
// Быстрая проверка работы промежуточного контекста

const intermediateContext = require('./src/services/context/intermediate-context');

async function quickTest() {
  const phone = '79001234567';
  
  console.log('🔍 Быстрая проверка промежуточного контекста\n');
  
  // 1. Проверка текущего состояния
  console.log('1️⃣ Проверка текущего состояния...');
  const current = await intermediateContext.getIntermediateContext(phone);
  
  if (current) {
    console.log('✅ Найден существующий контекст:');
    console.log(`   - Статус: ${current.processingStatus}`);
    console.log(`   - Возраст: ${Math.round(current.age / 1000)} сек`);
    console.log(`   - Сообщение: "${current.currentMessage}"`);
    console.log(`   - Последний вопрос: "${current.lastBotQuestion || 'нет'}"`);
    
    if (current.isRecent && current.processingStatus === 'started') {
      console.log('⚠️  Сообщение все еще обрабатывается!');
    }
  } else {
    console.log('ℹ️  Промежуточный контекст не найден');
  }
  
  // 2. Проверка обработки
  console.log('\n2️⃣ Проверка статуса обработки...');
  const isProcessing = await intermediateContext.isProcessing(phone);
  console.log(`   Обрабатывается: ${isProcessing ? 'ДА ⏳' : 'НЕТ ✅'}`);
  
  // 3. Симуляция нового сообщения
  console.log('\n3️⃣ Симуляция нового сообщения...');
  
  const testContext = {
    client: { name: 'Тест' },
    conversation: [
      { role: 'assistant', content: 'Привет! На какую услугу вы хотели бы записаться?' },
      { role: 'user', content: 'на стрижку' }
    ]
  };
  
  await intermediateContext.saveProcessingStart(phone, 'завтра в 15:00', testContext);
  console.log('✅ Сохранен новый промежуточный контекст');
  
  // 4. Проверка сохраненного
  const saved = await intermediateContext.getIntermediateContext(phone);
  console.log('\n4️⃣ Проверка сохраненного контекста:');
  console.log(`   - Последний вопрос: "${saved.lastBotQuestion}"`);
  console.log(`   - Тип ожидаемого ответа: ${saved.expectedReplyType}`);
  console.log(`   - Статус: ${saved.processingStatus}`);
  
  // 5. Очистка
  await intermediateContext.markAsCompleted(phone, { success: true });
  console.log('\n✅ Тест завершен, контекст помечен как обработанный');
}

quickTest().catch(console.error);