const logger = require('../../utils/logger').child({ module: 'ai-provider-factory' });

/**
 * Фабрика для создания AI провайдеров
 * Поддерживает: deepseek, qwen (с выбором модели)
 */
class AIProviderFactory {
  constructor() {
    this.providers = {};
    this.defaultProvider = process.env.AI_PROVIDER || 'deepseek';
  }

  /**
   * Получить провайдера по имени
   */
  async getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    
    // Кэшируем провайдеров
    if (this.providers[providerName]) {
      return this.providers[providerName];
    }

    switch (providerName) {
      case 'deepseek':
        this.providers[providerName] = await this.createDeepSeekProvider();
        break;
      
      case 'qwen':
      case 'qwen-plus':
        this.providers[providerName] = await this.createQwenProvider('qwen-plus');
        break;
      
      case 'qwen-72b':
        this.providers[providerName] = await this.createQwenProvider('qwen2.5-72b-instruct');
        break;
      
      default:
        throw new Error(`Unknown AI provider: ${providerName}`);
    }

    logger.info(`✅ AI provider initialized: ${providerName}`);
    return this.providers[providerName];
  }

  /**
   * Создать DeepSeek провайдера
   */
  async createDeepSeekProvider() {
    return {
      name: 'deepseek',
      async call(prompt, options = {}) {
        const axios = require('axios');
        const apiKey = process.env.DEEPSEEK_API_KEY;
        
        if (!apiKey) {
          throw new Error('DEEPSEEK_API_KEY is not configured');
        }

        try {
          const response = await axios.post('https://api.deepseek.com/chat/completions', {
            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: options.message || '' }
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 1000
          }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          return {
            text: response.data.choices[0].message.content,
            model: 'deepseek',
            usage: response.data.usage
          };
        } catch (error) {
          logger.error('DeepSeek API error:', error);
          throw error;
        }
      }
    };
  }

  /**
   * Создать Qwen провайдера
   */
  async createQwenProvider(model) {
    return {
      name: `qwen-${model}`,
      model,
      async call(prompt, options = {}) {
        const axios = require('axios');
        const apiKey = process.env.DASHSCOPE_API_KEY;
        
        if (!apiKey) {
          throw new Error('DASHSCOPE_API_KEY is not configured');
        }

        try {
          const response = await axios.post(
            'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
            {
              model,
              messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: options.message || '' }
              ],
              temperature: options.temperature || 0.7,
              max_tokens: options.maxTokens || 1000,
              top_p: options.topP || 0.8
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );

          return {
            text: response.data.choices[0].message.content,
            model,
            usage: response.data.usage
          };
        } catch (error) {
          logger.error(`Qwen (${model}) API error:`, error);
          throw error;
        }
      }
    };
  }

  /**
   * Установить провайдера по умолчанию
   */
  setDefaultProvider(name) {
    this.defaultProvider = name;
    logger.info(`Default AI provider set to: ${name}`);
  }

  /**
   * Получить список доступных провайдеров
   */
  getAvailableProviders() {
    return ['deepseek', 'qwen', 'qwen-plus', 'qwen-72b'];
  }
}

// Экспортируем singleton
module.exports = new AIProviderFactory();