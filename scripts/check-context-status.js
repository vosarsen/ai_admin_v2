#!/usr/bin/env node
/**
 * Быстрая проверка состояния контекста для телефона
 * Использование: node check-context-status.js 79001234567
 */

const contextService = require('./src/services/context');
const { createRedisClient } = require('./src/utils/redis-factory');
const logger = require('./src/utils/logger').child({ module: 'check-context' });

async function checkContextStatus(phone) {
  const companyId = 962302;
  const normalizedPhone = phone.replace(/\D/g, '');
  
  console.log(`\n🔍 Проверка контекста для: ${normalizedPhone}\n`);
  
  try {
    // 1. Проверка основного контекста
    console.log('1️⃣ ОСНОВНОЙ КОНТЕКСТ:');
    const context = await contextService.getContext(normalizedPhone, companyId);
    console.log('- Клиент:', context.client || 'Не найден');
    console.log('- Сообщений в истории:', context.lastMessages?.length || 0);
    console.log('- Последняя запись:', context.lastBooking || 'Нет');
    
    // 2. Проверка предпочтений
    console.log('\n2️⃣ ПРЕДПОЧТЕНИЯ:');
    const preferences = await contextService.getPreferences(normalizedPhone, companyId);
    if (preferences) {
      console.log('- Любимая услуга:', preferences.favoriteService);
      console.log('- Любимый мастер:', preferences.favoriteStaff);
      console.log('- Предпочитаемое время:', preferences.preferredTime);
      console.log('- Последнее обновление:', preferences.lastUpdated);
    } else {
      console.log('- Предпочтения не сохранены');
    }
    
    // 3. Проверка возможности продолжения
    console.log('\n3️⃣ ПРОДОЛЖЕНИЕ ДИАЛОГА:');
    const canContinue = await contextService.canContinueConversation(normalizedPhone, companyId);
    console.log('- Можно продолжить:', canContinue ? 'ДА ✅' : 'НЕТ ❌');
    
    // 4. Саммари диалога
    console.log('\n4️⃣ САММАРИ ДИАЛОГА:');
    const summary = await contextService.getConversationSummary(normalizedPhone, companyId);
    if (summary) {
      console.log('- Есть история:', summary.hasHistory ? 'ДА' : 'НЕТ');
      console.log('- Количество сообщений:', summary.messageCount);
      console.log('- Последние сообщения:');
      summary.recentMessages?.forEach(msg => {
        console.log(`  ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    }
    
    // 5. Проверка в Redis напрямую
    console.log('\n5️⃣ ДАННЫЕ В REDIS:');
    const redis = createRedisClient('context');
    
    const contextKey = `context:${companyId}:${normalizedPhone}`;
    const exists = await redis.exists(contextKey);
    console.log('- Контекст существует:', exists ? 'ДА' : 'НЕТ');
    
    if (exists) {
      const ttl = await redis.ttl(contextKey);
      console.log('- TTL (дней):', Math.floor(ttl / 86400));
      
      const lastActivity = await redis.hget(contextKey, 'lastActivity');
      if (lastActivity) {
        const hours = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
        console.log('- Часов с последней активности:', Math.floor(hours));
      }
    }
    
    const prefKey = `preferences:${companyId}:${normalizedPhone}`;
    const prefExists = await redis.exists(prefKey);
    console.log('- Предпочтения существуют:', prefExists ? 'ДА' : 'НЕТ');
    
    await redis.quit();
    
    console.log('\n✅ Проверка завершена!\n');
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
  
  process.exit(0);
}

// Запуск
const phone = process.argv[2];
if (!phone) {
  console.log('Использование: node check-context-status.js <phone>');
  console.log('Пример: node check-context-status.js 79001234567');
  process.exit(1);
}

checkContextStatus(phone);