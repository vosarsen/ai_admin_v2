// src/services/context/intermediate-context.js
const { createRedisClient } = require('../../utils/redis-factory');
const logger = require('../../utils/logger').child({ module: 'intermediate-context' });

class IntermediateContext {
  constructor() {
    this.redis = createRedisClient('intermediate-context');
    this.ttl = 300; // 5 минут для промежуточного контекста
  }

  /**
   * Сохранить промежуточное состояние в начале обработки
   */
  async saveProcessingStart(phone, message, currentContext) {
    const key = `intermediate:${phone}`;
    
    try {
      const intermediateData = {
        // Метаданные
        timestamp: Date.now(),
        processingStatus: 'started',
        
        // Текущее сообщение
        currentMessage: message,
        messageLength: message.length,
        
        // Контекст из предыдущих сообщений
        clientName: currentContext.client?.name || null,
        lastMessages: currentContext.conversation?.slice(-3) || [],
        
        // Состояние диалога
        lastBotMessage: this.extractLastBotMessage(currentContext.conversation),
        lastBotQuestion: this.extractLastBotQuestion(currentContext.conversation),
        expectedReplyType: this.detectExpectedReplyType(currentContext.conversation),
        
        // Упоминания в диалоге
        mentionedServices: [],
        mentionedStaff: [],
        mentionedDates: [],
        mentionedTimes: []
      };
      
      await this.redis.setex(
        key, 
        this.ttl, 
        JSON.stringify(intermediateData)
      );
      
      logger.info(`Saved intermediate context for ${phone}`, {
        lastBotQuestion: intermediateData.lastBotQuestion,
        expectedReplyType: intermediateData.expectedReplyType
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to save intermediate context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обновить промежуточное состояние после анализа AI
   */
  async updateAfterAIAnalysis(phone, aiResponse, extractedCommands) {
    const key = `intermediate:${phone}`;
    
    try {
      const existing = await this.redis.get(key);
      if (!existing) return { success: false, error: 'No intermediate context' };
      
      const data = JSON.parse(existing);
      
      // Обновляем данные
      data.processingStatus = 'ai_analyzed';
      data.aiResponse = aiResponse.substring(0, 200); // Первые 200 символов
      data.extractedCommands = extractedCommands.map(cmd => ({
        command: cmd.command,
        params: cmd.params
      }));
      
      // Извлекаем упоминания из команд
      extractedCommands.forEach(cmd => {
        if (cmd.params?.service_name) {
          data.mentionedServices.push(cmd.params.service_name);
        }
        if (cmd.params?.staff_name) {
          data.mentionedStaff.push(cmd.params.staff_name);
        }
        if (cmd.params?.date) {
          data.mentionedDates.push(cmd.params.date);
        }
        if (cmd.params?.time) {
          data.mentionedTimes.push(cmd.params.time);
        }
      });
      
      await this.redis.setex(key, this.ttl, JSON.stringify(data));
      
      logger.info(`Updated intermediate context after AI analysis for ${phone}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update after AI analysis:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить промежуточный контекст
   */
  async getIntermediateContext(phone) {
    const key = `intermediate:${phone}`;
    
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Добавляем информацию о времени
      parsed.age = Date.now() - parsed.timestamp;
      parsed.isRecent = parsed.age < 60000; // Меньше минуты
      
      return parsed;
    } catch (error) {
      logger.error('Failed to get intermediate context:', error);
      return null;
    }
  }

  /**
   * Пометить обработку как завершенную
   */
  async markAsCompleted(phone, result) {
    const key = `intermediate:${phone}`;
    
    try {
      const existing = await this.redis.get(key);
      if (!existing) return { success: false };
      
      const data = JSON.parse(existing);
      data.processingStatus = 'completed';
      data.completedAt = Date.now();
      data.processingTime = Date.now() - data.timestamp;
      data.result = {
        success: result.success,
        response: result.response?.substring(0, 100)
      };
      
      // Сохраняем на короткое время для следующего сообщения
      await this.redis.setex(key, 60, JSON.stringify(data));
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to mark as completed:', error);
      return { success: false };
    }
  }

  /**
   * Извлечь последнее сообщение бота
   */
  extractLastBotMessage(conversation) {
    if (!conversation || !conversation.length) return null;
    
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === 'assistant') {
        return conversation[i].content;
      }
    }
    return null;
  }

  /**
   * Извлечь последний вопрос бота
   */
  extractLastBotQuestion(conversation) {
    const lastBot = this.extractLastBotMessage(conversation);
    if (!lastBot) return null;
    
    // Ищем вопросительные паттерны
    const questionPatterns = [
      /Какой .+ (вас интересует|выбрать|хотите)\?/i,
      /На какую .+\?/i,
      /Как вас зовут\?/i,
      /Когда .+\?/i,
      /В какое время .+\?/i,
      /К какому мастеру .+\?/i
    ];
    
    for (const pattern of questionPatterns) {
      const match = lastBot.match(pattern);
      if (match) {
        return match[0];
      }
    }
    
    // Если есть знак вопроса - берем последнее предложение с вопросом
    if (lastBot.includes('?')) {
      const sentences = lastBot.split(/[.!]/);
      for (let i = sentences.length - 1; i >= 0; i--) {
        if (sentences[i].includes('?')) {
          return sentences[i].trim() + '?';
        }
      }
    }
    
    return null;
  }

  /**
   * Определить ожидаемый тип ответа
   */
  detectExpectedReplyType(conversation) {
    const lastQuestion = this.extractLastBotQuestion(conversation);
    if (!lastQuestion) return null;
    
    const typePatterns = {
      'service_selection': /Какой .+ услуг|На какую услугу|Что вас интересует/i,
      'time_selection': /В какое время|Когда|На какое время/i,
      'date_selection': /На какой день|Когда|На какую дату/i,
      'staff_selection': /К какому мастеру|К кому|Выберите мастера/i,
      'name_request': /Как вас зовут|Ваше имя|Представьтесь/i,
      'confirmation': /Подтверждаете|Все верно|Записать вас/i
    };
    
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(lastQuestion)) {
        return type;
      }
    }
    
    return 'unknown';
  }

  /**
   * Проверить, обрабатывается ли сообщение
   */
  async isProcessing(phone) {
    const context = await this.getIntermediateContext(phone);
    if (!context) return false;
    
    return context.processingStatus === 'started' && 
           context.age < 60000; // Обрабатывается меньше минуты
  }

  /**
   * Ждать завершения обработки предыдущего сообщения
   */
  async waitForCompletion(phone, maxWait = 3000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const context = await this.getIntermediateContext(phone);
      
      if (!context || context.processingStatus === 'completed') {
        return true; // Обработка завершена
      }
      
      // Ждем 100мс перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return false; // Таймаут
  }
}

module.exports = new IntermediateContext();