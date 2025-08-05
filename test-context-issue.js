#!/usr/bin/env node

const { createRedisClient } = require('./src/utils/redis-factory');
const logger = require('./src/utils/logger').child({ module: 'test-context-issue' });

async function testContextIssue() {
  const redis = createRedisClient('test-context-issue');
  
  try {
    // Тестовый номер Арсена
    const phone = '79068831915@c.us';
    const cleanPhone = phone.replace('@c.us', '');
    
    console.log('\n=== Проверка контекста для Арсена ===');
    console.log('Телефон:', phone);
    console.log('Чистый телефон:', cleanPhone);
    
    // 1. Проверяем промежуточный контекст
    const intermediateKey = `intermediate:${phone}`;
    const intermediate = await redis.get(intermediateKey);
    
    if (intermediate) {
      const data = JSON.parse(intermediate);
      console.log('\n📝 Промежуточный контекст:');
      console.log('- Статус:', data.processingStatus);
      console.log('- Последнее сообщение:', data.currentMessage);
      console.log('- Упомянутые услуги:', data.mentionedServices);
      console.log('- Упомянутые мастера:', data.mentionedStaff);
      console.log('- Упомянутое время:', data.mentionedTimes);
      console.log('- Последний вопрос бота:', data.lastBotQuestion);
    } else {
      console.log('\n❌ Промежуточный контекст не найден');
    }
    
    // 2. Проверяем основной контекст диалога
    const contextKey = `context:962302:${cleanPhone}`;
    const context = await redis.get(contextKey);
    
    if (context) {
      const data = JSON.parse(context);
      console.log('\n💬 Основной контекст:');
      console.log('- Последняя команда:', data.lastCommand);
      console.log('- Последняя услуга:', data.lastService);
      console.log('- Последний мастер:', data.lastStaff);
      console.log('- Имя клиента:', data.clientName);
      console.log('- Последние сообщения:', data.recentMessages?.length || 0);
    } else {
      console.log('\n❌ Основной контекст не найден');
    }
    
    // 3. Проверяем историю сообщений
    const messagesKey = `context:962302:${cleanPhone}:messages`;
    const messages = await redis.lrange(messagesKey, 0, -1);
    
    if (messages && messages.length > 0) {
      console.log('\n📚 История сообщений (последние 5):');
      const lastMessages = messages.slice(-5).map(m => JSON.parse(m));
      lastMessages.forEach((msg, idx) => {
        console.log(`${idx + 1}. [${new Date(msg.timestamp).toLocaleTimeString()}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    } else {
      console.log('\n❌ История сообщений не найдена');
    }
    
    // 4. Проверяем клиента в базе Supabase
    const { supabase } = require('./src/database/supabase');
    
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('company_id', 962302)
      .maybeSingle();
      
    if (client) {
      console.log('\n👤 Клиент в базе:');
      console.log('- ID:', client.id);
      console.log('- Имя:', client.name);
      console.log('- Телефон:', client.phone);
      console.log('- Любимая услуга:', client.favorite_service);
      console.log('- Любимый мастер:', client.favorite_staff);
    } else {
      console.log('\n❌ Клиент не найден в базе');
      if (error) console.error('Ошибка:', error);
    }
    
    // 5. Проверяем последнюю команду
    console.log('\n=== Анализ проблемы ===');
    if (intermediate) {
      const data = JSON.parse(intermediate);
      if (data.mentionedServices?.length === 0) {
        console.log('❗ Проблема: услуга "детская стрижка" не сохранена в mentionedServices');
        console.log('   Возможные причины:');
        console.log('   - AI не использовал команду с service_name');
        console.log('   - updateAfterAIAnalysis не вызван или не получил команды');
      }
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    redis.disconnect();
  }
}

// Запускаем тест
testContextIssue();