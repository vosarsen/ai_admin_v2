/**
 * Простая версия интеграции Qwen без наследования
 * Заменяет метод callAI напрямую в экземпляре
 */

// Получаем существующий экземпляр
const aiAdminV2 = require('./index');
const AIProviderAdapter = require('./ai-provider-adapter');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2-qwen' });

// Создаем адаптер
const aiProvider = new AIProviderAdapter();

// Сохраняем оригинальный метод
const originalCallAI = aiAdminV2.callAI.bind(aiAdminV2);

// Заменяем метод callAI
aiAdminV2.callAI = async function(prompt) {
  logger.info('🚀 Using Qwen adaptive AI system');
  
  try {
    // Используем адаптер, который сам выберет подходящую модель
    const response = await aiProvider.callAI(prompt, {});
    
    // Логируем статистику после каждых 100 запросов
    const stats = aiProvider.getUsageStats();
    if (stats.total % 100 === 0 && stats.total > 0) {
      logger.info('📊 AI Usage Statistics:', stats);
    }
    
    return response;
    
  } catch (error) {
    logger.error('Qwen AI call failed:', error);
    
    // Если настроен fallback на оригинальный метод
    if (process.env.USE_ORIGINAL_AI === 'true') {
      logger.warn('Falling back to original AI provider...');
      return originalCallAI(prompt);
    }
    
    throw error;
  }
};

// Добавляем метод для получения статистики
aiAdminV2.getAIStats = function() {
  return aiProvider.getUsageStats();
};

// Добавляем метод для сброса статистики
aiAdminV2.resetAIStats = function() {
  return aiProvider.resetStats();
};

logger.info('✅ Qwen integration activated');

module.exports = aiAdminV2;