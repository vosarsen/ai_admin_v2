// test-redis-race.js
require('dotenv').config();
const batchService = require('./src/services/redis-batch-service');

async function simulateRapidFire() {
  console.log('Simulating rapid-fire messages...\n');
  
  try {
    await batchService.initialize();
    console.log('✅ Batch service initialized');
    
    const phone = '79999999999';
    const messages = ['привет', 'запиши', 'меня', 'к бари', 'на завтра', 'в 7 вечера'];
    
    // Симулируем быструю отправку
    console.log('Sending messages rapidly...');
    for (let i = 0; i < messages.length; i++) {
      await batchService.addMessage(phone, messages[i], 962302);
      console.log(`  [${i+1}/${messages.length}] Added: "${messages[i]}"`);
      
      // Небольшая задержка между сообщениями
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Проверяем статистику сразу
    let stats = await batchService.getStats();
    console.log('\nImmediate stats:', JSON.stringify(stats, null, 2));
    
    // Мониторим TTL
    console.log('\nMonitoring TTL...');
    const batchKey = `rapid-fire:${phone}`;
    
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Проверяем напрямую через Redis
      const ttl = await batchService.redis.ttl(batchKey);
      const exists = await batchService.redis.exists(batchKey);
      const len = await batchService.redis.llen(batchKey);
      
      console.log(`[${i+1}s] exists=${exists}, length=${len}, ttl=${ttl}`);
      
      if (!exists) {
        console.log('❌ Batch disappeared!');
        break;
      }
      
      // На 10-й секунде пробуем обработать
      if (i === 9) {
        console.log('\nTrying to process batches...');
        const result = await batchService.processPendingBatches();
        console.log('Process result:', result);
      }
    }
    
    // Финальная статистика
    stats = await batchService.getStats();
    console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
    
    await batchService.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

simulateRapidFire();