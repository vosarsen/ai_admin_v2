const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'ai-provider-adapter' });
const dashscopeProvider = require('../ai/dashscope-provider');

/**
 * Адаптер для интеграции DashScope Provider в AI Admin v2
 * Заменяет прямые вызовы DeepSeek на интеллектуальную систему Qwen
 */
class AIProviderAdapter {
  constructor() {
    this.provider = dashscopeProvider;
    this.deepseekEnabled = process.env.ENABLE_DEEPSEEK_FALLBACK === 'true';
    
    // Для обратной совместимости с текущим кодом
    this.model = 'qwen-adaptive'; // Виртуальная модель
  }

  /**
   * Метод для обратной совместимости с текущим _callAI
   */
  async callAI(prompt, context = {}) {
    try {
      // Извлекаем сообщение пользователя из промпта
      const messageMatch = prompt.match(/ТЕКУЩЕЕ СООБЩЕНИЕ: "(.+?)"/s);
      const userMessage = messageMatch ? messageMatch[1] : '';
      
      // Вызываем DashScope с интеллектуальным выбором модели
      const result = await this.provider.call(prompt, {
        message: userMessage,
        context: {
          conversation: context.conversation || [],
          isReturningClient: context.isReturningClient || false,
          client: context.client
        }
      });
      
      logger.info('AI Provider Response:', {
        model: result.model,
        modelType: result.modelType,
        responseTime: result.responseTime,
        complexity: result.complexity
      });
      
      return result.text;
      
    } catch (error) {
      logger.error('AI Provider Error:', error);
      
      // Fallback на DeepSeek если включен
      if (this.deepseekEnabled) {
        logger.warn('Falling back to DeepSeek...');
        return this.callDeepSeekFallback(prompt);
      }
      
      throw error;
    }
  }

  /**
   * DeepSeek fallback для надежности
   */
  async callDeepSeekFallback(prompt) {
    const axios = require('axios');
    
    try {
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      
      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('DeepSeek fallback also failed:', error);
      throw error;
    }
  }

  /**
   * Получить статистику использования моделей
   */
  getUsageStats() {
    // Проверяем наличие метода getStats у провайдера
    if (!this.provider.getStats) {
      return { total: 0, byModel: {} };
    }
    
    const stats = this.provider.getStats();
    
    const totalRequests = stats.fast.count + stats.smart.count;
    const fastPercentage = totalRequests > 0 ? (stats.fast.count / totalRequests * 100).toFixed(1) : 0;
    const smartPercentage = totalRequests > 0 ? (stats.smart.count / totalRequests * 100).toFixed(1) : 0;
    
    return {
      total: totalRequests,
      distribution: {
        fast: `${fastPercentage}%`,
        smart: `${smartPercentage}%`
      },
      models: {
        'qwen-plus': stats.fast,
        'qwen2.5-72b': stats.smart
      },
      estimatedMonthlyCost: this.calculateMonthlyCost(stats)
    };
  }

  /**
   * Расчет примерной стоимости
   */
  calculateMonthlyCost(stats) {
    // Средние токены на запрос (оценка)
    const avgInputTokens = 500;
    const avgOutputTokens = 200;
    
    // Цены за 1M токенов
    const prices = {
      fast: { input: 0.42, output: 1.26 },
      smart: { input: 0.80, output: 2.40 }
    };
    
    // Расчет стоимости
    const fastCost = stats.fast.count * (
      (avgInputTokens * prices.fast.input / 1000000) +
      (avgOutputTokens * prices.fast.output / 1000000)
    );
    
    const smartCost = stats.smart.count * (
      (avgInputTokens * prices.smart.input / 1000000) +
      (avgOutputTokens * prices.smart.output / 1000000)
    );
    
    const dailyTotal = fastCost + smartCost;
    const monthlyProjection = dailyTotal * 30;
    
    return {
      daily: `$${dailyTotal.toFixed(2)}`,
      monthly: `$${monthlyProjection.toFixed(2)}`,
      breakdown: {
        fast: `$${(fastCost * 30).toFixed(2)}/mo`,
        smart: `$${(smartCost * 30).toFixed(2)}/mo`
      }
    };
  }

  /**
   * Проверка здоровья системы
   */
  async healthCheck() {
    const health = await this.provider.healthCheck();
    
    return {
      ...health,
      provider: 'DashScope (Qwen)',
      adaptiveModels: true,
      deepseekFallback: this.deepseekEnabled
    };
  }
  
  
  /**
   * Сбросить статистику
   */
  resetStats() {
    // DashScope provider не имеет метода resetStats, сбрасываем вручную
    if (this.provider.stats) {
      this.provider.stats = {
        fast: { count: 0, totalTime: 0, errors: 0 },
        smart: { count: 0, totalTime: 0, errors: 0 }
      };
    }
    return true;
  }
}

module.exports = AIProviderAdapter;