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

      case 'gemini':
      case 'gemini-flash':
        this.providers[providerName] = await this.createGeminiProvider('gemini-2.5-flash');
        break;

      case 'gemini-pro':
        this.providers[providerName] = await this.createGeminiProvider('gemini-2.5-pro');
        break;

      case 'gemini-flash-lite':
        this.providers[providerName] = await this.createGeminiProvider('gemini-2.5-flash-lite');
        break;

      case 'qwen':
      case 'qwen-plus':
        this.providers[providerName] = await this.createQwenProvider('qwen-plus');
        break;

      case 'qwen-max':
        this.providers[providerName] = await this.createQwenProvider('qwen-max');
        break;

      case 'qwen-turbo':
        this.providers[providerName] = await this.createQwenProvider('qwen-turbo');
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
   * Создать Gemini провайдера
   */
  async createGeminiProvider(model) {
    return {
      name: `gemini-${model}`,
      model,
      async call(prompt, options = {}) {
        const axios = require('axios');
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not configured');
        }

        try {
          // Определяем нужен ли structured output
          const useStructuredOutput = options.structuredOutput || options.jsonMode;

          const requestBody = {
            contents: [{
              parts: [{
                text: options.message ? `${prompt}\n\n${options.message}` : prompt
              }]
            }]
          };

          // Добавляем generationConfig для structured output
          if (useStructuredOutput && options.responseSchema) {
            requestBody.generationConfig = {
              responseMimeType: 'application/json',
              responseSchema: options.responseSchema,
              temperature: options.temperature || 0.7,
              maxOutputTokens: options.maxTokens || 1000
            };
          } else {
            requestBody.generationConfig = {
              temperature: options.temperature || 0.7,
              maxOutputTokens: options.maxTokens || 1000
            };
          }

          // Настройка прокси если указан в env
          const axiosConfig = {
            headers: {
              'x-goog-api-key': apiKey,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          };

          // Добавляем прокси если указан HTTPS_PROXY или SOCKS_PROXY
          if (process.env.HTTPS_PROXY || process.env.https_proxy) {
            const { HttpsProxyAgent } = require('https-proxy-agent');
            const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
            axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
            logger.info(`Using HTTPS proxy for Gemini API: ${proxyUrl}`);
          } else if (process.env.SOCKS_PROXY || process.env.socks_proxy) {
            const { SocksProxyAgent } = require('socks-proxy-agent');
            const proxyUrl = process.env.SOCKS_PROXY || process.env.socks_proxy;
            axiosConfig.httpsAgent = new SocksProxyAgent(proxyUrl);
            logger.info(`Using SOCKS proxy for Gemini API: ${proxyUrl}`);
          }

          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            requestBody,
            axiosConfig
          );

          const text = response.data.candidates[0].content.parts[0].text;

          return {
            text,
            model,
            usage: response.data.usageMetadata || {
              promptTokenCount: 0,
              candidatesTokenCount: 0,
              totalTokenCount: 0
            }
          };
        } catch (error) {
          logger.error(`Gemini (${model}) API error:`, error.response?.data || error.message);
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
    return [
      'deepseek',
      'gemini-flash',
      'gemini-pro',
      'gemini-flash-lite',
      'qwen-plus',
      'qwen-max',
      'qwen-turbo'
    ];
  }
}

// Экспортируем singleton
module.exports = new AIProviderFactory();