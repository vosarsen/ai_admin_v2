#!/usr/bin/env node

/**
 * Тестирование ReAct паттерна для AI Admin v2
 */

require('dotenv').config();
const logger = require('./src/utils/logger').child({ module: 'test-react' });

// Включаем ReAct
process.env.USE_REACT = 'true';
process.env.AI_PROMPT_VERSION = 'react-prompt';

async function testReAct() {
  try {
    logger.info('🚀 Starting ReAct pattern test...');
    
    // Импортируем AI Admin v2
    const aiAdmin = require('./src/services/ai-admin-v2');
    
    // Загружаем промпты
    const promptManager = require('./src/services/ai-admin-v2/prompt-manager');
    await promptManager.loadPrompts();
    
    // Тестовые сценарии
    const testCases = [
      {
        name: 'Запись на конкретное время (доступное)',
        message: 'Запиши меня на стрижку сегодня в 19:00',
        expectedBehavior: 'Должен проверить слоты, найти 19:00 и создать запись'
      },
      {
        name: 'Запись на конкретное время (занятое)',
        message: 'Запиши меня на стрижку сегодня в 17:00',
        expectedBehavior: 'Должен проверить слоты, не найти 17:00 и предложить альтернативы'
      },
      {
        name: 'Запрос доступного времени',
        message: 'Какое время свободно на стрижку завтра?',
        expectedBehavior: 'Должен получить слоты и показать их клиенту'
      },
      {
        name: 'Запись без указания времени',
        message: 'Хочу записаться на стрижку завтра',
        expectedBehavior: 'Должен получить слоты и спросить какое время удобно'
      }
    ];
    
    const phone = '79001234567';
    const companyId = 962302;
    
    for (const testCase of testCases) {
      logger.info(`\n${'='.repeat(80)}`);
      logger.info(`📝 Test: ${testCase.name}`);
      logger.info(`Message: "${testCase.message}"`);
      logger.info(`Expected: ${testCase.expectedBehavior}`);
      logger.info(`${'='.repeat(80)}\n`);
      
      try {
        const result = await aiAdmin.processMessage(
          testCase.message,
          phone,
          companyId
        );
        
        logger.info('✅ Result:', {
          success: result.success,
          response: result.response?.substring(0, 200),
          commandsCount: result.executedCommands?.length || 0,
          commands: result.executedCommands?.map(c => c.command)
        });
        
        // Проверяем что использовался ReAct
        if (result.executedCommands && result.executedCommands.length > 0) {
          logger.info('✅ Commands were executed via ReAct');
        }
        
        // Небольшая пауза между тестами
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`❌ Test failed: ${error.message}`);
      }
    }
    
    logger.info('\n✅ All ReAct tests completed!');
    
  } catch (error) {
    logger.error('Fatal error in test:', error);
  } finally {
    process.exit(0);
  }
}

// Запускаем тесты
testReAct();