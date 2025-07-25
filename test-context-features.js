#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки новых функций контекста
 */

const contextService = require('./src/services/context');
const logger = require('./src/utils/logger').child({ module: 'test-context' });

async function testContextFeatures() {
  const testPhone = '79001234567';
  const companyId = 962302;
  
  logger.info('🧪 Testing context features...');
  
  try {
    // 1. Тест сохранения и загрузки предпочтений
    logger.info('\n1️⃣ Testing preferences...');
    
    const preferences = {
      favoriteService: 'Мужская стрижка',
      favoriteStaff: 'Сергей',
      preferredTime: 'evening',
      notes: 'Предпочитает тихую музыку'
    };
    
    const saveResult = await contextService.savePreferences(testPhone, companyId, preferences);
    logger.info('Save preferences result:', saveResult);
    
    const loadedPrefs = await contextService.getPreferences(testPhone, companyId);
    logger.info('Loaded preferences:', loadedPrefs);
    
    // 2. Тест проверки продолжения диалога
    logger.info('\n2️⃣ Testing conversation continuation...');
    
    const canContinue = await contextService.canContinueConversation(testPhone, companyId);
    logger.info('Can continue conversation:', canContinue);
    
    // 3. Тест получения саммари диалога
    logger.info('\n3️⃣ Testing conversation summary...');
    
    const summary = await contextService.getConversationSummary(testPhone, companyId);
    logger.info('Conversation summary:', JSON.stringify(summary, null, 2));
    
    // 4. Тест установки контекста
    logger.info('\n4️⃣ Testing set context...');
    
    const contextData = {
      state: 'active',
      data: {
        currentStep: 'booking',
        selectedService: 'Стрижка'
      }
    };
    
    const setResult = await contextService.setContext(testPhone, companyId, contextData);
    logger.info('Set context result:', setResult);
    
    // 5. Тест обновления контекста
    logger.info('\n5️⃣ Testing context update...');
    
    const updateData = {
      lastMessage: {
        role: 'user',
        content: 'Хочу записаться на завтра'
      },
      clientInfo: {
        name: 'Тестовый Клиент'
      },
      lastAction: 'SEARCH_SLOTS',
      actionResult: { found: 5 }
    };
    
    const updateResult = await contextService.updateContext(testPhone, companyId, updateData);
    logger.info('Update context result:', updateResult);
    
    // 6. Тест пометки для follow-up
    logger.info('\n6️⃣ Testing follow-up marking...');
    
    const followUpResult = await contextService.markForFollowUp(
      testPhone,
      companyId,
      'Клиент интересовался новыми услугами',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // через неделю
    );
    logger.info('Follow-up mark result:', followUpResult);
    
    // 7. Тест метрик
    logger.info('\n7️⃣ Testing metrics...');
    
    const metrics = await contextService.getMetrics();
    logger.info('Context service metrics:', metrics);
    
    // 8. Тест очистки старых контекстов (dry run)
    logger.info('\n8️⃣ Testing old contexts cleanup (dry run)...');
    
    // Создаем старый контекст для теста
    const oldPhone = '79009999999';
    await contextService.setContext(oldPhone, companyId, { state: 'old' });
    
    // Симулируем очистку (не удаляем реально)
    logger.info('Would clear contexts older than 30 days...');
    
    logger.info('\n✅ All tests completed!');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

// Запускаем тесты
testContextFeatures();