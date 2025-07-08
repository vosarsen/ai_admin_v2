// src/services/ai/index.js
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const circuitBreakerFactory = require('../../utils/circuit-breaker');
const SmartNLU = require('../nlu/smart-nlu');

class AIService {
  constructor() {
    // Primary provider (DeepSeek)
    this.primaryProvider = {
      name: 'deepseek',
      apiUrl: config.ai.apiUrl,
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
      timeout: config.ai.timeout
    };
    
    // Backup provider (YandexGPT)
    this.backupProvider = {
      name: 'yandex',
      apiUrl: 'https://llm.api.cloud.yandex.net/foundationModels/v1',
      iamToken: process.env.YANDEX_IAM_TOKEN,
      folderId: process.env.YANDEX_FOLDER_ID,
      model: process.env.YANDEX_MODEL || 'yandexgpt',
      temperature: config.ai.temperature,
      maxTokens: config.ai.maxTokens,
      timeout: parseInt(process.env.YANDEX_TIMEOUT) || 10000
    };
    
    // Initialize circuit breakers for both providers
    this.primaryCircuitBreaker = circuitBreakerFactory.getBreaker('ai-service-primary', {
      timeout: this.primaryProvider.timeout,
      errorThreshold: 2, // Быстрее переключаемся на backup
      resetTimeout: 60000 // 1 minute
    });
    
    this.backupCircuitBreaker = circuitBreakerFactory.getBreaker('ai-service-backup', {
      timeout: this.backupProvider.timeout,
      errorThreshold: 3,
      resetTimeout: 30000
    });
    
    // Create axios instances
    this.primaryClient = this._createClient(this.primaryProvider);
    this.backupClient = this._createClient(this.backupProvider);
    
    // Initialize Smart NLU
    this.smartNLU = new SmartNLU(this);
  }

  _createClient(provider) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Different auth for different providers
    if (provider.name === 'yandex') {
      headers['Authorization'] = `Bearer ${provider.iamToken}`;
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }
    
    return axios.create({
      baseURL: provider.apiUrl,
      timeout: provider.timeout,
      headers
    });
  }

  /**
   * Process message using Smart NLU system
   */
  async processMessage(message, context) {
    logger.info('🧠 Processing message with Smart NLU system');
    
    try {
      // Use Smart NLU for comprehensive entity extraction and intent detection
      const result = await this.smartNLU.processMessage(message, context);
      
      logger.info('🤖 Smart NLU Result:', {
        success: result.success,
        intent: result.intent,
        action: result.action,
        entities: result.entities,
        confidence: result.confidence,
        provider: result.provider
      });
      
      return result;
      
    } catch (error) {
      logger.error('❌ Smart NLU processing failed:', error.message);
      
      // Ultimate fallback to simple pattern matching
      logger.info('🔄 Using emergency fallback processing');
      return this._emergencyFallback(message, context);
    }
  }

  /**
   * Emergency fallback when Smart NLU fails completely
   */
  _emergencyFallback(message, context) {
    logger.warn('⚠️ Using emergency fallback - limited functionality');
    
    return {
      success: true,
      intent: 'other',
      entities: {},
      action: 'none', 
      response: 'Извините, возникли технические трудности. Пожалуйста, уточните ваш запрос или позвоните нам напрямую.',
      confidence: 0.1,
      provider: 'emergency'
    };
  }

  /**
   * Legacy fallback processing using simple patterns (deprecated)
   */
  _fallbackProcessing(message, context) {
    const msg = message.toLowerCase();
    
    // Simple booking pattern detection
    const isBookingRequest = 
      (msg.includes('запиш') || msg.includes('записат') || msg.includes('записыва')) &&
      (msg.includes('стриж') || msg.includes('брод') || msg.includes('услуг'));
    
    if (isBookingRequest) {
      // Extract basic entities using regex
      const entities = this._extractEntitiesSimple(message);
      
      if (entities.date && entities.time && entities.staff) {
        return {
          success: true,
          intent: 'booking',
          entities: entities,
          action: 'create_booking',
          response: `Записываю вас к ${entities.staff} ${entities.date} в ${entities.time}. Подтверждаю запись.`,
          confidence: 0.8
        };
      } else {
        return {
          success: true,
          intent: 'booking',
          entities: entities,
          action: 'search_slots',
          response: null,
          confidence: 0.6
        };
      }
    }
    
    // Default fallback
    return {
      success: true,
      intent: 'other',
      entities: {},
      action: 'none',
      response: 'Здравствуйте! Я помогу вам записаться на услуги. Скажите, на какую дату и время вы хотели бы записаться?',
      confidence: 0.5
    };
  }

  /**
   * Simple entity extraction using regex
   */
  _extractEntitiesSimple(message) {
    const entities = {};
    
    // Extract staff names
    const staff = ['бари', 'сергей', 'сергею', 'рамзан'];
    for (const name of staff) {
      if (message.toLowerCase().includes(name)) {
        entities.staff = name.charAt(0).toUpperCase() + name.slice(1);
        break;
      }
    }
    
    // Extract time (HH:MM format)
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})|(\d{1,2})\s*(утра|дня|вечера)/);
    if (timeMatch) {
      if (timeMatch[1] && timeMatch[2]) {
        entities.time = `${timeMatch[1]}:${timeMatch[2]}`;
      } else if (timeMatch[3]) {
        entities.time = `${timeMatch[3]}:00`;
      }
    }
    
    // Extract date patterns
    if (message.includes('завтра')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      entities.date = tomorrow.toISOString().split('T')[0];
    } else if (message.includes('послезавтра')) {
      const dayAfter = new Date();
      dayAfter.setDate(dayAfter.getDate() + 2);
      entities.date = dayAfter.toISOString().split('T')[0];
    } else if (message.includes('сегодня')) {
      entities.date = new Date().toISOString().split('T')[0];
    }
    
    // Extract service
    if (message.includes('стриж')) {
      entities.service = 'стрижка';
    } else if (message.includes('брод') || message.includes('борода')) {
      entities.service = 'стрижка бороды';
    }
    
    return entities;
  }

  /**
   * Build AI prompt with context
   */
  _buildPrompt(message, context) {
    const { client, services, staff, lastMessages } = context;
    
    return `Ты - AI администратор салона красоты. Ответь кратко и по делу.

КОНТЕКСТ:
- Клиент: ${client ? client.name : 'Новый клиент'}
- Телефон: ${context.phone}
- Последнее посещение: ${client?.lastVisit || 'Нет данных'}
- Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}

ДОСТУПНЫЕ УСЛУГИ (топ-10):
${services.slice(0, 10).map(s => `- ${s.title} (${s.price_min}₽, ${s.duration}мин)`).join('\n')}

ДОСТУПНЫЕ МАСТЕРА (топ-5):
${staff.slice(0, 5).map(s => `- ${s.name} (${s.specialization})`).join('\n')}

ИСТОРИЯ ДИАЛОГА:
${lastMessages.map(m => `Клиент: ${m.user}\nАдмин: ${m.assistant}`).join('\n')}

СООБЩЕНИЕ КЛИЕНТА: "${message}"

ВАЖНО: 
- Если клиент говорит "тогда", "туда", "в это время" - используй контекст из предыдущих сообщений
- Если в текущем сообщении нет даты, но она была в предыдущих - используй её
- "22 утра" вероятно означает "10 утра" (опечатка)

ОПРЕДЕЛИ:
1. intent - намерение (booking, reschedule, cancel, info, other)
2. entities - сущности из сообщения:
   - service: название услуги (точно как в списке)
   - staff: имя мастера (точно как в списке)
   - date: дата (YYYY-MM-DD)
   - time: время (HH:MM)
   - time_preference: временное предпочтение (morning, afternoon, evening, или описание типа "с утра", "после обеда", "вечером", "после 18:00")
3. action - действие:
   - create_booking: когда клиент просит записаться И указал мастера И указал время
   - search_slots: когда клиент просит записаться но НЕ указал конкретное время
   - get_info: когда клиент спрашивает информацию о услугах/ценах
   - none: в остальных случаях
4. response - ответ клиенту (кратко, по-деловому). ВАЖНО: для action "search_slots" ВСЕГДА возвращай response: null
5. confidence - уверенность 0-1

Ответь ТОЛЬКО в формате JSON:
{
  "intent": "...",
  "entities": {...},
  "action": "...",
  "response": "...",
  "confidence": 0.9
}`;
  }

  /**
   * Call AI API with specified provider
   */
  async _callAI(prompt, providerType = 'primary') {
    const provider = providerType === 'primary' ? this.primaryProvider : this.backupProvider;
    const client = providerType === 'primary' ? this.primaryClient : this.backupClient;
    const circuitBreaker = providerType === 'primary' ? this.primaryCircuitBreaker : this.backupCircuitBreaker;
    
    try {
      const response = await circuitBreaker.execute(async () => {
        let requestBody;
        let endpoint;
        
        if (provider.name === 'yandex') {
          // YandexGPT format
          requestBody = {
            modelUri: `gpt://${provider.folderId}/${provider.model}`,
            completionOptions: {
              stream: false,
              temperature: provider.temperature,
              maxTokens: provider.maxTokens.toString()
            },
            messages: [
              {
                role: 'user',
                text: prompt
              }
            ]
          };
          endpoint = '/completion';
        } else {
          // OpenAI format
          requestBody = {
            model: provider.model,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: provider.temperature,
            max_tokens: provider.maxTokens
          };
          endpoint = provider.name === 'openai' ? '/chat/completions' : '';
        }
        
        logger.info(`📡 Calling ${provider.name} API...`, {
          model: provider.model,
          endpoint: endpoint,
          folderId: provider.folderId
        });
        
        return await client.post(endpoint, requestBody);
      });

      // Different response formats for different providers
      let responseText;
      
      if (provider.name === 'yandex') {
        // YandexGPT response format
        responseText = response.data?.result?.alternatives?.[0]?.message?.text;
      } else {
        // OpenAI response format
        responseText = response.data?.choices?.[0]?.message?.content;
      }
      
      if (responseText) {
        logger.info(`✅ ${provider.name} API responded successfully`);
        return responseText.trim();
      }

      throw new Error(`Invalid AI response format from ${provider.name}`);
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        logger.warn(`${provider.name} circuit breaker is open`);
        throw new Error(`${provider.name} service temporarily unavailable`);
      }
      logger.error(`${provider.name} API call failed:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Parse AI response
   */
  _parseResponse(aiResponse) {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate required fields
        return {
          intent: parsed.intent || 'other',
          entities: parsed.entities || {},
          action: parsed.action || 'none',
          response: parsed.response !== undefined ? parsed.response : aiResponse,
          confidence: parsed.confidence || 0.5
        };
      }
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON:', error.message);
    }

    // Fallback - return raw response
    return {
      intent: 'other',
      entities: {},
      action: 'none',
      response: aiResponse,
      confidence: 0.3
    };
  }

  /**
   * Generate calendar event description
   */
  generateCalendarEvent(booking) {
    const { service, staff, datetime, duration } = booking;
    
    return {
      title: `${service} - ${staff}`,
      start: datetime,
      duration: duration,
      description: `Запись в салон красоты\nУслуга: ${service}\nМастер: ${staff}`,
      location: 'Салон красоты' // TODO: Get from company data
    };
  }

  /**
   * Generate reminder message
   */
  generateReminder(booking, hoursBeore) {
    const { service, staff, datetime } = booking;
    const time = new Date(datetime).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    if (hoursBeore === 24) {
      return `Добрый вечер! Напоминаем о записи завтра:\n📅 ${service}\n👤 Мастер: ${staff}\n🕐 Время: ${time}\n\nБудете?`;
    } else {
      return `Напоминаем о записи через ${hoursBeore} часа:\n📅 ${service}\n👤 Мастер: ${staff}\n🕐 Время: ${time}\n\nЖдем вас!`;
    }
  }
}

// Singleton instance
module.exports = new AIService();