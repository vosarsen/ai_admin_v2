// test-redis-keys-debug.js
const { createRedisClient } = require('./src/utils/redis-factory');
const logger = require('./src/utils/logger');

async function debugRedisKeys() {
  logger.info('=== Redis Keys Debug Tool ===');
  
  // Устанавливаем production окружение
  process.env.NODE_ENV = 'production';
  
  const client = createRedisClient('debug');
  
  try {
    // Ждем подключения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info('1. Checking all keys in Redis...');
    const allKeys = await client.keys('*');
    logger.info(`Total keys: ${allKeys.length}`);
    
    // Группируем ключи по префиксам
    const keyGroups = {};
    for (const key of allKeys) {
      const prefix = key.split(':')[0];
      if (!keyGroups[prefix]) {
        keyGroups[prefix] = [];
      }
      keyGroups[prefix].push(key);
    }
    
    logger.info('2. Keys grouped by prefix:');
    for (const [prefix, keys] of Object.entries(keyGroups)) {
      logger.info(`  ${prefix}: ${keys.length} keys`);
      if (prefix === 'rapid-fire' || prefix === 'last-msg') {
        logger.info(`    Examples: ${keys.slice(0, 3).join(', ')}`);
      }
    }
    
    logger.info('3. Searching for rapid-fire keys...');
    const rapidFireKeys = await client.keys('rapid-fire:*');
    logger.info(`Found ${rapidFireKeys.length} rapid-fire keys`);
    
    if (rapidFireKeys.length > 0) {
      logger.info('4. Checking rapid-fire key details:');
      for (const key of rapidFireKeys) {
        const ttl = await client.ttl(key);
        const size = await client.llen(key);
        const messages = await client.lrange(key, 0, -1);
        logger.info(`  ${key}:`);
        logger.info(`    TTL: ${ttl} seconds`);
        logger.info(`    Messages: ${size}`);
        logger.info(`    Content: ${messages.map(m => JSON.parse(m).message).join(' | ')}`);
      }
    }
    
    logger.info('5. Creating test rapid-fire key...');
    const testKey = 'rapid-fire:test-' + Date.now();
    const testMessage = JSON.stringify({
      message: 'Test message',
      companyId: 962302,
      metadata: {},
      timestamp: Date.now()
    });
    
    await client.rpush(testKey, testMessage);
    await client.expire(testKey, 600);
    logger.info(`Created test key: ${testKey}`);
    
    // Проверяем что ключ создан
    const exists = await client.exists(testKey);
    const ttl = await client.ttl(testKey);
    logger.info(`Test key exists: ${exists}, TTL: ${ttl}`);
    
    // Проверяем что ключ виден через keys
    const foundKeys = await client.keys('rapid-fire:test-*');
    logger.info(`Test key found via keys: ${foundKeys.includes(testKey)}`);
    
    // Удаляем тестовый ключ
    await client.del(testKey);
    
    logger.info('6. Testing with actual phone number format...');
    const phoneKey = 'rapid-fire:+79686484488';
    await client.rpush(phoneKey, testMessage);
    await client.expire(phoneKey, 600);
    
    const phoneExists = await client.exists(phoneKey);
    const phoneTTL = await client.ttl(phoneKey);
    logger.info(`Phone key exists: ${phoneExists}, TTL: ${phoneTTL}`);
    
    // Ищем через разные паттерны
    const pattern1 = await client.keys('rapid-fire:*');
    const pattern2 = await client.keys('rapid-fire:+*');
    const pattern3 = await client.keys('rapid-fire:\\+*');
    
    logger.info('Pattern search results:');
    logger.info(`  rapid-fire:* found ${pattern1.length} keys`);
    logger.info(`  rapid-fire:+* found ${pattern2.length} keys`);
    logger.info(`  rapid-fire:\\+* found ${pattern3.length} keys`);
    
    // Очистка
    await client.del(phoneKey);
    
  } catch (error) {
    logger.error('Debug failed:', error);
  } finally {
    await client.quit();
  }
}

// Запускаем на сервере через SSH
if (require.main === module) {
  // Создаем команду для запуска на сервере
  const { exec } = require('child_process');
  const fs = require('fs');
  
  // Копируем скрипт на сервер
  logger.info('Copying script to server...');
  exec(`scp -i ~/.ssh/id_ed25519_ai_admin ${__filename} root@46.149.70.219:/opt/ai-admin/test-redis-keys-debug.js`, (err) => {
    if (err) {
      logger.error('Failed to copy script:', err);
      return;
    }
    
    logger.info('Running script on server...');
    exec(`ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node test-redis-keys-debug.js"`, (err, stdout, stderr) => {
      if (err) {
        logger.error('Failed to run script:', err);
        if (stderr) logger.error('Stderr:', stderr);
        return;
      }
      
      console.log(stdout);
      if (stderr) console.error('Stderr:', stderr);
    });
  });
}