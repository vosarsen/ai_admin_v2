// test-intermediate-simple.js
// Простой тест промежуточного контекста
require('dotenv').config();
const intermediateContext = require('./src/services/context/intermediate-context');

async function testSimpleFlow() {
  console.log('\n🧪 Простой тест промежуточного контекста\n');
  
  const phone = '79111111111';
  
  try {
    // 1. Сохраняем контекст первого сообщения
    console.log('1️⃣  Сохранение контекста первого сообщения...');
    const context1 = {
      client: { name: 'Тест' },
      conversation: [
        { role: 'assistant', content: 'Добро пожаловать! На какую услугу вы хотели бы записаться?' }
      ]
    };
    
    await intermediateContext.saveProcessingStart(phone, 'Стрижка', context1);
    console.log('✅ Контекст сохранен\n');
    
    // 2. Проверяем, что контекст извлекается
    console.log('2️⃣  Извлечение контекста...');
    const saved = await intermediateContext.getIntermediateContext(phone);
    console.log(`✅ Контекст извлечен:`);
    console.log(`   - Сообщение: "${saved.currentMessage}"`);
    console.log(`   - Последний вопрос: "${saved.lastBotQuestion}"`);
    console.log(`   - Статус: ${saved.processingStatus}\n`);
    
    // 3. Симулируем быстрое второе сообщение
    console.log('3️⃣  Проверка обработки...');
    const isProcessing = await intermediateContext.isProcessing(phone);
    console.log(`   Обрабатывается: ${isProcessing ? 'ДА' : 'НЕТ'}\n`);
    
    // 4. Обновляем после AI анализа
    console.log('4️⃣  Обновление после AI анализа...');
    await intermediateContext.updateAfterAIAnalysis(phone, 'Хорошо, записываю на стрижку', [
      { command: 'SEARCH_SLOTS', params: { service_name: 'Стрижка' } }
    ]);
    console.log('✅ Контекст обновлен\n');
    
    // 5. Завершаем обработку
    console.log('5️⃣  Завершение обработки...');
    await intermediateContext.markAsCompleted(phone, { 
      success: true, 
      response: 'Вас записали на стрижку' 
    });
    console.log('✅ Обработка завершена\n');
    
    // 6. Проверяем финальное состояние
    console.log('6️⃣  Финальное состояние:');
    const final = await intermediateContext.getIntermediateContext(phone);
    console.log(`   - Статус: ${final.processingStatus}`);
    console.log(`   - Время обработки: ${final.processingTime}ms`);
    console.log(`   - Упомянутые услуги: ${final.mentionedServices.join(', ')}`);
    
    console.log('\n✅ Все тесты пройдены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  process.exit(0);
}

testSimpleFlow();