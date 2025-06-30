// src/services/ai/index.js
const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');
const circuitBreakerFactory = require('../../utils/circuit-breaker');

class AIService {
  constructor() {
    this.apiUrl = config.ai.apiUrl;
    this.apiKey = config.ai.apiKey;
    this.model = config.ai.model;
    this.temperature = config.ai.temperature;
    this.maxTokens = config.ai.maxTokens;
    
    // Initialize circuit breaker
    this.circuitBreaker = circuitBreakerFactory.getBreaker('ai-service', {
      timeout: config.ai.timeout,
      errorThreshold: 3,
      resetTimeout: 30000 // 30 seconds
    });
    
    // Create axios instance for AI calls
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: config.ai.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Process message and return structured response
   */
  async processMessage(message, context) {
    try {
      const prompt = this._buildPrompt(message, context);
      const aiResponse = await this._callAI(prompt);
      const parsed = this._parseResponse(aiResponse);
      
      return {
        success: true,
        intent: parsed.intent,
        entities: parsed.entities,
        action: parsed.action,
        response: parsed.response,
        confidence: parsed.confidence
      };
    } catch (error) {
      logger.error('AI processing failed:', error);
      return {
        success: false,
        response: 'Извините, произошла ошибка. Попробуйте еще раз.',
        error: error.message
      };
    }
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

ОПРЕДЕЛИ:
1. intent - намерение (booking, reschedule, cancel, info, other)
2. entities - сущности из сообщения:
   - service: название услуги (точно как в списке)
   - staff: имя мастера (точно как в списке)
   - date: дата (YYYY-MM-DD)
   - time: время (HH:MM)
3. action - действие (search_slots, create_booking, get_info, none)
4. response - ответ клиенту (кратко, по-деловому)
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
   * Call AI API
   */
  async _callAI(prompt) {
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.post('', {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens
        });
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }

      throw new Error('Invalid AI response format');
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        logger.warn('AI service circuit breaker is open');
        throw new Error('AI service temporarily unavailable');
      }
      logger.error('AI API call failed:', {
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
          response: parsed.response || aiResponse,
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