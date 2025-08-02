/**
 * Модифицированная версия AI Admin v2 с поддержкой Qwen
 * 
 * Изменения:
 * 1. Использует DashScope Provider вместо прямых вызовов AI
 * 2. Автоматически выбирает между Qwen-Plus и Qwen2.5-72B
 * 3. Добавлена статистика использования моделей
 */

// Получаем оригинальный инстанс
const aiAdminV2Instance = require('./index');
const AIProviderAdapter = require('./ai-provider-adapter');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2-qwen' });

// Создаем новый AI Provider
const qwenProvider = new AIProviderAdapter();

// Сохраняем оригинальный метод callAI
const originalCallAI = aiAdminV2Instance.callAI.bind(aiAdminV2Instance);

// Переопределяем метод callAI для использования Qwen
aiAdminV2Instance.callAI = async function(prompt, context) {
  logger.info('🚀 Using Qwen adaptive AI system');
  
  try {
    // Используем адаптер, который сам выберет подходящую модель
    const response = await qwenProvider.callAI(prompt, context);
    
    // Логируем статистику после каждых 100 запросов
    const stats = qwenProvider.getUsageStats();
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

// Добавляем новый метод для получения статистики
aiAdminV2Instance.getAIStats = function() {
  return qwenProvider.getUsageStats();
};

// Добавляем метод для принудительного использования умной модели
aiAdminV2Instance.processComplexMessage = async function(message, phone, companyId) {
  logger.info('🧠 Forcing smart model for complex message');
  
  // Сохраняем текущий callAI
  const currentCallAI = this.callAI.bind(this);
  
  // Временно заменяем на версию с принудительной умной моделью
  this.callAI = async (prompt, context) => {
    return qwenProvider.callAI(prompt, {
      ...context,
      forceModel: 'smart'
    });
  };
  
  try {
    // Вызываем обработку с умной моделью
    const result = await this.processMessage(message, phone, companyId);
    
    // Восстанавливаем оригинальный метод
    this.callAI = currentCallAI;
    
    return result;
  } catch (error) {
    // Восстанавливаем оригинальный метод даже при ошибке
    this.callAI = currentCallAI;
    throw error;
  }
};

logger.info('✅ Qwen integration activated');

// Экспортируем модифицированный инстанс
module.exports = aiAdminV2Instance;