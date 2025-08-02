/**
 * Модифицированная версия AI Admin v2 с поддержкой Qwen
 * 
 * Изменения:
 * 1. Использует DashScope Provider вместо прямых вызовов AI
 * 2. Автоматически выбирает между Qwen-Plus и Qwen2.5-72B
 * 3. Добавлена статистика использования моделей
 */

// Копируем оригинальный класс
const AIAdminV2Original = require('./index');
const AIProviderAdapter = require('./ai-provider-adapter');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2-qwen' });

class AIAdminV2WithQwen extends AIAdminV2Original {
  constructor() {
    super();
    this.aiProvider = new AIProviderAdapter();
  }

  /**
   * Переопределяем метод _callAI для использования нового провайдера
   */
  async _callAI(prompt, context) {
    logger.info('🚀 Using Qwen adaptive AI system');
    
    try {
      // Используем адаптер, который сам выберет подходящую модель
      const response = await this.aiProvider.callAI(prompt, context);
      
      // Логируем статистику после каждых 100 запросов
      const stats = this.aiProvider.getUsageStats();
      if (stats.total % 100 === 0 && stats.total > 0) {
        logger.info('📊 AI Usage Statistics:', stats);
      }
      
      return response;
      
    } catch (error) {
      logger.error('Qwen AI call failed:', error);
      
      // Если настроен fallback на оригинальный метод
      if (process.env.USE_ORIGINAL_AI === 'true') {
        logger.warn('Falling back to original AI provider...');
        return super._callAI(prompt);
      }
      
      throw error;
    }
  }

  /**
   * Новый метод для получения статистики AI
   */
  getAIStats() {
    return this.aiProvider.getUsageStats();
  }

  /**
   * Метод для принудительного использования умной модели
   */
  async processComplexMessage(message, phone, companyId) {
    logger.info('🧠 Forcing smart model for complex message');
    
    // Сохраняем оригинальный _callAI
    const originalCallAI = this._callAI.bind(this);
    
    // Временно заменяем на версию с принудительной умной моделью
    this._callAI = async (prompt, context) => {
      return this.aiProvider.callAI(prompt, {
        ...context,
        forceModel: 'smart'
      });
    };
    
    try {
      // Вызываем обработку с умной моделью
      const result = await this.processMessage(message, phone, companyId);
      
      // Восстанавливаем оригинальный метод
      this._callAI = originalCallAI;
      
      return result;
    } catch (error) {
      // Восстанавливаем оригинальный метод даже при ошибке
      this._callAI = originalCallAI;
      throw error;
    }
  }
}

// Экспортируем модифицированную версию
module.exports = AIAdminV2WithQwen;