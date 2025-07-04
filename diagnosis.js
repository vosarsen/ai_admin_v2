// diagnosis.js - Диагностика проблем с WhatsApp
const whatsappClient = require('./src/integrations/whatsapp/client');
const messageQueue = require('./src/queue/message-queue');
const logger = require('./src/utils/logger');

async function diagnoseProblem() {
  try {
    logger.info('🔍 Starting WhatsApp diagnosis...');
    
    // Test phone number (номер из жалобы пользователя)
    const testPhone = '79936363848@c.us';
    
    // 1. Check Venom Bot status
    logger.info('📊 Checking Venom Bot status...');
    const status = await whatsappClient.checkStatus();
    logger.info('Status result:', status);
    
    // 2. Test direct connection
    logger.info('🔗 Testing direct connection...');
    const diagnosis = await whatsappClient.diagnoseProblem(testPhone);
    logger.info('Diagnosis result:', diagnosis);
    
    // 3. Check queue metrics
    logger.info('📊 Checking queue metrics...');
    const queueName = 'company:10012:messages';
    const metrics = await messageQueue.getMetrics(queueName);
    logger.info('Queue metrics:', metrics);
    
    // 4. Test message sending
    logger.info('📱 Testing message sending...');
    const sendResult = await whatsappClient.sendMessage(testPhone, 'Тестовое сообщение для диагностики');
    logger.info('Send result:', sendResult);
    
    logger.info('✅ Diagnosis complete');
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      logger.info('⏰ Timeout reached, exiting...');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    logger.error('❌ Diagnosis failed:', error);
    process.exit(1);
  }
}

diagnoseProblem();