#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки генерации склонений
 */

require('dotenv').config();
const serviceDeclension = require('./src/services/declension/service-declension');
const logger = require('./src/utils/logger').child({ module: 'test-declensions' });

async function testDeclensions() {
  try {
    logger.info('🔤 Testing declension generation...');
    
    // Тестовые названия услуг
    const testServices = [
      'Мужская стрижка',
      'Стрижка бороды',
      'Маникюр с покрытием',
      'Окрашивание волос',
      'Массаж лица'
    ];
    
    logger.info(`Testing ${testServices.length} service names...`);
    
    for (const serviceName of testServices) {
      logger.info(`\n📋 Service: "${serviceName}"`);
      
      const declensions = await serviceDeclension.generateDeclensions(serviceName);
      
      // Выводим результаты
      console.log('Склонения:');
      console.log(`  Именительный (кто? что?): ${declensions.nominative}`);
      console.log(`  Родительный (кого? чего?): ${declensions.genitive}`);
      console.log(`  Дательный (кому? чему?): ${declensions.dative}`);
      console.log(`  Винительный (кого? что?): ${declensions.accusative}`);
      console.log(`  Творительный (кем? чем?): ${declensions.instrumental}`);
      console.log(`  Предложный (о ком? о чём?): ${declensions.prepositional}`);
      console.log(`  Предложный с НА: ${declensions.prepositional_na}`);
      
      // Тестируем в контексте фраз
      console.log('\nПримеры использования:');
      console.log(`  "Завтра ждём вас на ${declensions.prepositional_na || serviceName}"`);
      console.log(`  "Ваша запись на ${declensions.accusative || serviceName} подтверждена"`);
      console.log(`  "Напоминаем о ${declensions.prepositional || serviceName}"`);
    }
    
    logger.info('\n✅ Declension test completed!');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Запускаем тест
testDeclensions();