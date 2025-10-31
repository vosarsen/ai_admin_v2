const axios = require('axios');
const logger = require('../../utils/logger').child({ module: 'dashscope-provider' });

/**
 * DashScope Provider для Qwen моделей
 * Интеллектуальная двухуровневая система:
 * - Qwen-Plus: быстрые ответы для 90% запросов
 * - Qwen2.5-72B: сложные случаи требующие глубокого понимания
 */
class DashScopeProvider {
  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY || '';
    if (!this.apiKey) {
      logger.error('DASHSCOPE_API_KEY is not set in environment variables');
      throw new Error('DASHSCOPE_API_KEY is required for DashScope provider');
    }
    this.apiUrl = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
    
    // Две модели для разных задач
    this.models = {
      fast: 'qwen-plus',           // Быстрая модель для большинства запросов
      smart: 'qwen2.5-72b-instruct' // Умная модель для сложных случаев
    };
    
    // Настройки по умолчанию
    this.defaultParams = {
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1000
    };
    
    // Статистика использования
    this.stats = {
      fast: { count: 0, totalTime: 0, errors: 0 },
      smart: { count: 0, totalTime: 0, errors: 0 }
    };
  }

  /**
   * Определяет сложность запроса
   */
  assessComplexity(message, context) {
    
    // Факторы сложности
    const factors = {
      // Длина сообщения
      messageLength: message.length > 200 ? 2 : 0,
      
      // Множественные вопросы
      multipleQuestions: (message.match(/\?/g) || []).length > 1 ? 2 : 0,
      
      // Упоминания прошлого контекста
      contextReferences: /прошл|ранее|говорил|упоминал|помнишь/i.test(message) ? 3 : 0,
      
      // Сложные временные конструкции
      complexTime: /после.*перед|между.*и|кроме|исключая/i.test(message) ? 2 : 0,
      
      // Негативные или проблемные сценарии
      problems: /не могу|не получается|проблема|ошибка|отмен|перенес/i.test(message) ? 2 : 0,
      
      // Условные конструкции
      conditions: /если|либо|или.*или|в случае/i.test(message) ? 2 : 0,
      
      // История диалога длинная
      longHistory: context.conversation?.length > 5 ? 2 : 0,
      
      // Клиент возвращается после долгого перерыва
      returningClient: context.isReturningClient ? 1 : 0
    };
    
    // Подсчет общей сложности
    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);
    
    logger.debug('Complexity assessment:', {
      message: message.substring(0, 50) + '...',
      factors,
      totalScore
    });
    
    return {
      score: totalScore,
      useSmartModel: totalScore >= 5, // Порог для умной модели
      factors
    };
  }

  /**
   * Основной метод для вызова API
   */
  async call(prompt, options = {}) {
    const { 
      message = '', 
      context = {},
      forceModel = null // Позволяет принудительно выбрать модель
    } = options;
    
    // Определяем какую модель использовать
    const complexity = this.assessComplexity(message, context);
    const modelType = forceModel || (complexity.useSmartModel ? 'smart' : 'fast');
    const model = this.models[modelType];
    
    logger.info(`🤖 Using ${modelType} model (${model})`, {
      complexityScore: complexity.score,
      messagePreview: message.substring(0, 50) + '...'
    });
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post(this.apiUrl, {
        model,
        messages: [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user', 
            content: message
          }
        ],
        ...this.defaultParams,
        ...options.params // Позволяет переопределить параметры
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: modelType === 'smart' ? 30000 : 15000 // Больше времени для умной модели
      });
      
      const responseTime = Date.now() - startTime;
      const responseText = response.data.choices[0].message.content;
      
      // Обновляем статистику
      this.stats[modelType].count++;
      this.stats[modelType].totalTime += responseTime;
      
      logger.info(`✅ ${model} responded in ${responseTime}ms`);
      
      return {
        text: responseText,
        model,
        modelType,
        responseTime,
        complexity: complexity.score,
        usage: response.data.usage
      };
      
    } catch (error) {
      this.stats[modelType].errors++;
      
      logger.error(`❌ ${model} API error:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Если умная модель не сработала, пробуем быструю
      if (modelType === 'smart' && !forceModel) {
        logger.warn('Falling back to fast model...');
        return this.call(prompt, { ...options, forceModel: 'fast' });
      }
      
      throw error;
    }
  }

  /**
   * Получить статистику использования
   */
  getStats() {
    const stats = {};
    
    for (const [type, data] of Object.entries(this.stats)) {
      stats[type] = {
        ...data,
        avgResponseTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
        successRate: data.count > 0 ? ((data.count - data.errors) / data.count * 100).toFixed(1) + '%' : '0%'
      };
    }
    
    return stats;
  }

  /**
   * Проверка доступности провайдера
   */
  async healthCheck() {
    try {
      const response = await this.call('Привет', {
        message: 'Тест',
        forceModel: 'fast',
        params: { max_tokens: 10 }
      });
      
      return {
        available: true,
        models: this.models,
        responseTime: response.responseTime
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

// Экспортируем singleton
module.exports = new DashScopeProvider();