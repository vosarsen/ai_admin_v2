#!/usr/bin/env node

/**
 * Тест для проверки:
 * 1. Приветствия при первом сообщении за день
 * 2. Корректного показа услуг по запросу
 * 3. Очистки старого контекста
 */

require('dotenv').config();
const logger = require('./src/utils/logger');
const contextService = require('./src/services/context');
const AIAdminV2 = require('./src/services/ai-admin-v2');

// Установим USE_TWO_STAGE для тестирования
process.env.USE_TWO_STAGE = 'true';
process.env.AI_PROMPT_VERSION = 'two-stage';

const TEST_PHONE = '+79001234567';
const COMPANY_ID = 962302;

async function clearContext() {
  console.log('\n🧹 Очищаем старый контекст...');
  const contextKey = `${COMPANY_ID}:${TEST_PHONE}`;
  
  // Устанавливаем контекст с датой вчерашнего дня
  await contextService.setContext(TEST_PHONE, COMPANY_ID, {
    state: 'active',
    data: {
      lastCommand: 'CANCEL_BOOKING',
      lastService: 'old_service',
      clientName: 'Тестовый Клиент'
    }
  });
  
  // Меняем lastActivity на вчера
  const redis = contextService.redis;
  const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  await redis.hset(`context:${contextKey}`, 'lastActivity', yesterday);
  
  console.log('✅ Установлен старый контекст с lastActivity:', yesterday);
}

async function testFirstMessage() {
  console.log('\n📱 Тест 1: Первое сообщение за день (должно быть приветствие)');
  console.log('Отправляем: "Добрый день"');
  
  const aiAdmin = new AIAdminV2();
  const result = await aiAdmin.processMessage(
    'Добрый день',
    TEST_PHONE,
    COMPANY_ID
  );
  
  console.log('\n🤖 Ответ бота:');
  console.log(result.response);
  
  // Проверяем наличие приветствия
  const hasGreeting = /добр|здравствуй|привет/i.test(result.response);
  console.log(`\n✅ Приветствие в ответе: ${hasGreeting ? 'ДА' : 'НЕТ (ошибка!)'}`);
  
  return result;
}

async function testServiceQuery() {
  console.log('\n📱 Тест 2: Запрос про стрижки (должны показать конкретные услуги)');
  console.log('Отправляем: "Какие стрижки вы делаете?"');
  
  const aiAdmin = new AIAdminV2();
  const result = await aiAdmin.processMessage(
    'Какие стрижки вы делаете?',
    TEST_PHONE,
    COMPANY_ID
  );
  
  console.log('\n🤖 Ответ бота:');
  console.log(result.response);
  
  // Проверяем наличие конкретных услуг с ценами
  const hasPrices = /\d+₽|\d+ руб/i.test(result.response);
  const hasServices = /стрижк|модель|машинк|полубокс|канадка/i.test(result.response);
  
  console.log(`\n✅ Конкретные услуги в ответе: ${hasServices ? 'ДА' : 'НЕТ (ошибка!)'}`);
  console.log(`✅ Цены в ответе: ${hasPrices ? 'ДА' : 'НЕТ (ошибка!)'}`);
  
  // Проверяем выполненные команды
  if (result.commands && result.commands.length > 0) {
    console.log('\n📋 Выполненные команды:');
    result.commands.forEach(cmd => {
      console.log(`  - ${cmd.command}: ${cmd.success ? '✅' : '❌'}`);
    });
  }
  
  return result;
}

async function checkContextAfter() {
  console.log('\n🔍 Проверяем контекст после обработки...');
  
  const context = await contextService.getContext(TEST_PHONE, COMPANY_ID);
  const contextKey = `${COMPANY_ID}:${TEST_PHONE}`;
  const redis = contextService.redis;
  const contextData = await redis.hgetall(`context:${contextKey}`);
  
  console.log('\n📊 Текущий контекст:');
  
  if (contextData.data) {
    const data = JSON.parse(contextData.data);
    console.log('  Сохраненные данные:', data);
    
    // Проверяем, что старые данные очищены
    const hasOldCommand = data.lastCommand === 'CANCEL_BOOKING';
    const hasOldService = data.lastService === 'old_service';
    const hasClientName = !!data.clientName;
    
    console.log(`\n✅ Старая команда очищена: ${!hasOldCommand ? 'ДА' : 'НЕТ (ошибка!)'}`);
    console.log(`✅ Старый сервис очищен: ${!hasOldService ? 'ДА' : 'НЕТ (ошибка!)'}`);
    console.log(`✅ Имя клиента сохранено: ${hasClientName ? 'ДА' : 'НЕТ'}`);
  }
  
  // Проверяем обновление lastActivity
  const lastActivity = contextData.lastActivity;
  const isRecent = (Date.now() - new Date(lastActivity).getTime()) < 60000; // менее минуты назад
  console.log(`✅ lastActivity обновлен: ${isRecent ? 'ДА' : 'НЕТ (ошибка!)'}`);
}

async function runTests() {
  try {
    console.log('🚀 Запуск тестов для проверки приветствия и показа услуг\n');
    console.log('=' .repeat(60));
    
    // Подготовка - устанавливаем старый контекст
    await clearContext();
    
    // Тест 1: Первое сообщение за день
    await testFirstMessage();
    console.log('\n' + '-'.repeat(60));
    
    // Небольшая пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Тест 2: Запрос про услуги
    await testServiceQuery();
    console.log('\n' + '-'.repeat(60));
    
    // Проверка контекста
    await checkContextAfter();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Тесты завершены!\n');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении тестов:', error);
  } finally {
    process.exit(0);
  }
}

// Запускаем тесты
runTests();