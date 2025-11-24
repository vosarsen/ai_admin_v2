#!/usr/bin/env node
// start-batch-processor.js
// Скрипт для запуска batch processor в dev режиме

const BatchProcessor = require('./src/workers/batch-processor');
const logger = require('./src/utils/logger');

console.log('🚀 Запуск Batch Processor в dev режиме...\n');

const processor = new BatchProcessor();

processor.start()
  .then(() => {
    console.log('✅ Batch Processor запущен успешно!');
    console.log('   Нажмите Ctrl+C для остановки\n');
  })
  .catch(error => {
    console.error('❌ Ошибка запуска:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Остановка Batch Processor...');
  await processor.stop();
  process.exit(0);
});