#!/usr/bin/env node
/**
 * Создание тестового контекста для проверки функций
 * Использование: node scripts/create-test-context.js
 */

const contextService = require('../src/services/context');
const dataLoader = require('../src/services/ai-admin-v2/modules/data-loader');
const logger = require('../src/utils/logger').child({ module: 'create-test-context' });

async function createTestContexts() {
  const companyId = 962302;
  
  logger.info('🎭 Создание тестовых контекстов...\n');
  
  try {
    // 1. Постоянный клиент с предпочтениями
    logger.info('1️⃣ Создаем постоянного клиента Марию...');
    const mariaPhone = '79002222222';
    
    // Сохраняем предпочтения
    await contextService.savePreferences(mariaPhone, companyId, {
      favoriteService: 'Маникюр с покрытием',
      favoriteStaff: 'Анна',
      preferredTime: 'morning',
      lastBookingDate: '2025-07-20',
      notes: 'Предпочитает классические цвета'
    });
    
    // Добавляем историю сообщений
    await contextService.updateContext(mariaPhone, companyId, {
      lastMessage: { role: 'user', content: 'Хочу записаться на маникюр' },
      clientInfo: { name: 'Мария' }
    });
    
    await contextService.updateContext(mariaPhone, companyId, {
      lastMessage: { role: 'assistant', content: 'Мария, записала вас на маникюр к Анне!' }
    });
    
    logger.info('✅ Мария создана с предпочтениями\n');
    
    // 2. Клиент с недавним диалогом
    logger.info('2️⃣ Создаем клиента Николая с активным диалогом...');
    const nikolayPhone = '79003333333';
    
    await contextService.setContext(nikolayPhone, companyId, {
      state: 'active',
      data: { clientName: 'Николай' }
    });
    
    // Симулируем диалог 2 часа назад
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await contextService.updateContext(nikolayPhone, companyId, {
      lastMessage: { 
        role: 'user', 
        content: 'Привет, хочу записаться на стрижку',
        timestamp: twoHoursAgo.toISOString()
      },
      clientInfo: { name: 'Николай' }
    });
    
    await contextService.updateContext(nikolayPhone, companyId, {
      lastMessage: { 
        role: 'assistant', 
        content: 'Николай, на какой день вас записать?',
        timestamp: new Date(twoHoursAgo.getTime() + 60000).toISOString()
      }
    });
    
    logger.info('✅ Николай создан с прерванным диалогом\n');
    
    // 3. Старый клиент (для теста очистки)
    logger.info('3️⃣ Создаем старого клиента Петра...');
    const petrPhone = '79004444444';
    
    // Создаем контекст и вручную устанавливаем старую дату
    const redis = contextService.redis;
    const oldContextKey = `${companyId}:${petrPhone}`;
    
    await redis.hset(oldContextKey, {
      'phone': petrPhone,
      'companyId': companyId,
      'lastActivity': new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 дней назад
      'state': 'old',
      'data': JSON.stringify({ clientName: 'Петр' })
    });
    
    // Устанавливаем короткий TTL для демонстрации
    await redis.expire(oldContextKey, 60 * 60); // 1 час
    
    logger.info('✅ Петр создан со старым контекстом (35 дней)\n');
    
    // 4. Сохраняем тестовые данные в Supabase
    logger.info('4️⃣ Сохраняем в Supabase...');
    
    await dataLoader.saveContext(mariaPhone + '@c.us', companyId, {
      client: { name: 'Мария', phone: mariaPhone },
      conversation: []
    }, {
      response: 'Тестовое сохранение',
      executedCommands: []
    });
    
    logger.info('✅ Данные сохранены в Supabase\n');
    
    // Показываем итоговую статистику
    console.log('📊 СОЗДАННЫЕ ТЕСТОВЫЕ ДАННЫЕ:\n');
    console.log(`1. Мария (${mariaPhone})`);
    console.log('   - Постоянный клиент с предпочтениями');
    console.log('   - Любит маникюр с Анной по утрам');
    console.log('');
    console.log(`2. Николай (${nikolayPhone})`);
    console.log('   - Активный диалог 2 часа назад');
    console.log('   - Не завершил запись на стрижку');
    console.log('');
    console.log(`3. Петр (${petrPhone})`);
    console.log('   - Старый контекст (35 дней)');
    console.log('   - Для теста автоочистки');
    console.log('');
    
    console.log('🧪 КОМАНДЫ ДЛЯ ПРОВЕРКИ:\n');
    console.log('# Проверить контекст Марии:');
    console.log(`node check-context-status.js ${mariaPhone}\n`);
    
    console.log('# Отправить сообщение от Марии:');
    console.log(`node test-webhook.js "${mariaPhone}" "Привет"\n`);
    
    console.log('# Продолжить диалог Николая:');
    console.log(`node test-webhook.js "${nikolayPhone}" "Давай на завтра в 15:00"\n`);
    
    console.log('# Проверить очистку (dry run):');
    console.log('node scripts/cleanup-old-contexts.js --days=30 --dry-run\n');
    
    logger.info('✅ Все тестовые контексты созданы!');
    
  } catch (error) {
    logger.error('❌ Ошибка создания тестовых данных:', error);
  }
  
  process.exit(0);
}

// Запуск
createTestContexts();