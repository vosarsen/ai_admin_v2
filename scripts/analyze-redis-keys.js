#!/usr/bin/env node

const Redis = require('ioredis');

const redis = new Redis({
  port: 6380,
  host: 'localhost',
  password: process.env.REDIS_PASSWORD || 'your_redis_password_here',
  db: 0
});

async function analyzeRedisKeys() {
  console.log('🔍 Анализ всех ключей Redis...\n');
  
  const allKeys = await redis.keys('*');
  console.log(`📊 Всего ключей: ${allKeys.length}\n`);
  
  // Группируем ключи по паттернам
  const patterns = {};
  const keyDetails = {};
  
  for (const key of allKeys) {
    // Определяем паттерн ключа
    const pattern = key.split(':').slice(0, 2).join(':');
    if (!patterns[pattern]) {
      patterns[pattern] = [];
    }
    patterns[pattern].push(key);
    
    // Получаем информацию о ключе
    const type = await redis.type(key);
    const ttl = await redis.ttl(key);
    
    keyDetails[key] = {
      type,
      ttl: ttl === -1 ? 'no expiry' : `${ttl}s`,
      pattern
    };
  }
  
  // Анализ по паттернам
  console.log('📁 Группировка по паттернам:\n');
  const sortedPatterns = Object.entries(patterns)
    .sort(([,a], [,b]) => b.length - a.length);
  
  for (const [pattern, keys] of sortedPatterns) {
    console.log(`  ${pattern}: ${keys.length} ключей`);
  }
  
  // Детальный анализ основных типов
  console.log('\n🔎 Детальный анализ основных типов:\n');
  
  // 1. Контексты диалогов
  console.log('1️⃣ Контексты диалогов (dialog:*)');
  const dialogKeys = allKeys.filter(k => k.startsWith('dialog:'));
  for (const key of dialogKeys.slice(0, 5)) {
    const type = await redis.type(key);
    const ttl = await redis.ttl(key);
    
    if (type === 'hash') {
      const data = await redis.hgetall(key);
      console.log(`  ${key}:`);
      console.log(`    TTL: ${ttl === -1 ? 'no expiry' : ttl + 's'}`);
      console.log(`    Поля: ${Object.keys(data).join(', ')}`);
      if (data.stage) console.log(`    Stage: ${data.stage}`);
      if (data.lastActivity) {
        const lastActivity = new Date(parseInt(data.lastActivity));
        console.log(`    Last Activity: ${lastActivity.toLocaleString()}`);
      }
    }
  }
  
  // 2. Настройки клиентов
  console.log('\n2️⃣ Настройки клиентов (preferences:* и prefs:*)');
  const prefKeys = allKeys.filter(k => k.startsWith('preferences:') || k.startsWith('prefs:'));
  console.log(`  Найдено: ${prefKeys.length} ключей`);
  for (const key of prefKeys.slice(0, 3)) {
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);
    try {
      const data = JSON.parse(value);
      console.log(`  ${key}:`);
      console.log(`    TTL: ${ttl === -1 ? 'no expiry' : Math.floor(ttl / 86400) + ' дней'}`);
      console.log(`    Данные: ${JSON.stringify(data, null, 2).split('\n').slice(0, 5).join('\n    ')}`);
    } catch (e) {
      console.log(`  ${key}: не JSON`);
    }
  }
  
  // 3. Информация о клиентах
  console.log('\n3️⃣ Информация о клиентах (client:*)');
  const clientKeys = allKeys.filter(k => k.startsWith('client:'));
  console.log(`  Найдено: ${clientKeys.length} ключей`);
  for (const key of clientKeys.slice(0, 3)) {
    const value = await redis.get(key);
    const ttl = await redis.ttl(key);
    try {
      const data = JSON.parse(value);
      console.log(`  ${key}:`);
      console.log(`    TTL: ${ttl === -1 ? 'no expiry' : Math.floor(ttl / 3600) + ' часов'}`);
      console.log(`    ID клиента: ${data.id || 'не указан'}`);
      console.log(`    Имя: ${data.name || 'не указано'}`);
    } catch (e) {
      console.log(`  ${key}: не JSON`);
    }
  }
  
  // 4. Сообщения
  console.log('\n4️⃣ История сообщений (messages:*)');
  const messageKeys = allKeys.filter(k => k.startsWith('messages:'));
  console.log(`  Найдено: ${messageKeys.length} ключей`);
  for (const key of messageKeys.slice(0, 3)) {
    const length = await redis.llen(key);
    const ttl = await redis.ttl(key);
    console.log(`  ${key}:`);
    console.log(`    Тип: list`);
    console.log(`    Длина: ${length} сообщений`);
    console.log(`    TTL: ${ttl === -1 ? 'no expiry' : Math.floor(ttl / 3600) + ' часов'}`);
  }
  
  // 5. Букинги
  console.log('\n5️⃣ Букинги (booking:*)');
  const bookingKeys = allKeys.filter(k => k.startsWith('booking:'));
  console.log(`  Найдено: ${bookingKeys.length} ключей`);
  console.log(`  Все без TTL (постоянные)`);
  
  // 6. BullMQ очереди
  console.log('\n6️⃣ BullMQ очереди (bull:*)');
  const bullKeys = allKeys.filter(k => k.startsWith('bull:'));
  const bullQueues = {};
  for (const key of bullKeys) {
    const parts = key.split(':');
    if (parts[1]) {
      const queueName = parts[1];
      if (!bullQueues[queueName]) {
        bullQueues[queueName] = 0;
      }
      bullQueues[queueName]++;
    }
  }
  console.log(`  Найдено очередей:`);
  for (const [queue, count] of Object.entries(bullQueues)) {
    console.log(`    ${queue}: ${count} ключей`);
  }
  
  // 7. Rate limiting
  console.log('\n7️⃣ Rate limiting (rate:*)');
  const rateKeys = allKeys.filter(k => k.startsWith('rate:'));
  console.log(`  Найдено: ${rateKeys.length} ключей`);
  for (const key of rateKeys.slice(0, 3)) {
    const ttl = await redis.ttl(key);
    const size = await redis.zcard(key);
    console.log(`  ${key}:`);
    console.log(`    Тип: zset`);
    console.log(`    Записей: ${size}`);
    console.log(`    TTL: ${ttl === -1 ? 'no expiry' : Math.floor(ttl / 3600) + ' часов'}`);
  }
  
  // 8. Reminder contexts
  console.log('\n8️⃣ Reminder contexts (reminder_context:*)');
  const reminderKeys = allKeys.filter(k => k.startsWith('reminder_context:'));
  console.log(`  Найдено: ${reminderKeys.length} ключей`);
  
  // Проблемы и рекомендации
  console.log('\n⚠️  Обнаруженные проблемы:\n');
  
  // Проверка на дубликаты паттернов (preferences vs prefs)
  const prefDuplicates = allKeys.filter(k => k.startsWith('preferences:')).length;
  const prefsDuplicates = allKeys.filter(k => k.startsWith('prefs:')).length;
  if (prefDuplicates > 0 && prefsDuplicates > 0) {
    console.log('  ❌ Дублирование паттернов: используются и "preferences:" и "prefs:"');
    console.log(`     preferences: ${prefDuplicates}, prefs: ${prefsDuplicates}`);
    console.log('     Рекомендация: использовать единый паттерн');
  }
  
  // Проверка на ключи без TTL
  const noTtlKeys = allKeys.filter(k => keyDetails[k].ttl === 'no expiry' && !k.startsWith('bull:') && !k.startsWith('booking:'));
  if (noTtlKeys.length > 0) {
    console.log(`\n  ⚠️  ${noTtlKeys.length} ключей без TTL (кроме bull и booking):`);
    noTtlKeys.slice(0, 5).forEach(k => console.log(`     - ${k}`));
  }
  
  // Проверка на странные паттерны
  const strangeKeys = allKeys.filter(k => k.includes('[object Object]'));
  if (strangeKeys.length > 0) {
    console.log(`\n  ❌ Найдены ключи с [object Object]: ${strangeKeys.length}`);
    strangeKeys.forEach(k => console.log(`     - ${k}`));
  }
  
  console.log('\n✅ Рекомендации по оптимизации:\n');
  console.log('  1. Унифицировать паттерны: использовать либо preferences, либо prefs');
  console.log('  2. Установить TTL для всех временных данных');
  console.log('  3. Исправить генерацию ключей с [object Object]');
  console.log('  4. Регулярно очищать старые ключи BullMQ');
  console.log('  5. Использовать единую схему именования: {entity}:{companyId}:{identifier}');
  
  await redis.quit();
}

analyzeRedisKeys().catch(console.error);