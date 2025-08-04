const logger = require('../../../utils/logger').child({ module: 'response-processor' });

/**
 * Модуль для обработки ответов AI
 * Выделен из index.js для улучшения читаемости и тестируемости
 */
class ResponseProcessor {
  constructor(commandHandler, formatter) {
    this.commandHandler = commandHandler;
    this.formatter = formatter;
  }

  /**
   * Обработка ответа AI и выполнение команд
   */
  async processAIResponse(aiResponse, context) {
    logger.debug('Processing AI response', { responseLength: aiResponse.length });
    
    // Извлекаем команды
    const commands = this.extractCommands(aiResponse);
    
    // Убираем команды из текста ответа
    let cleanedResponse = this.removeCommandsFromResponse(aiResponse);
    
    // Обрабатываем специальные символы
    cleanedResponse = this.processSpecialCharacters(cleanedResponse);
    
    // Выполняем команды
    const results = await this.executeCommands(commands, context);
    
    // Форматируем финальный ответ
    const finalResponse = await this.formatFinalResponse(cleanedResponse, results, context);
    
    return {
      success: true,
      response: finalResponse,
      executedCommands: commands,
      results
    };
  }

  /**
   * Извлечение команд из ответа AI
   */
  extractCommands(text) {
    const commands = [];
    const commandRegex = /\[([A-Z_]+)(?:\s+([^\]]+))?\]/g;
    let match;
    
    while ((match = commandRegex.exec(text)) !== null) {
      const [fullMatch, command, paramsStr] = match;
      const params = this.parseCommandParams(paramsStr);
      
      commands.push({
        command,
        params,
        rawMatch: fullMatch
      });
      
      logger.debug(`Found command: ${command}`, { params });
    }
    
    return commands;
  }

  /**
   * Парсинг параметров команды
   */
  parseCommandParams(paramsStr) {
    if (!paramsStr) return {};
    
    const params = {};
    const paramRegex = /(\w+):\s*([^,]+?)(?:,|$)/g;
    let match;
    
    while ((match = paramRegex.exec(paramsStr)) !== null) {
      const [, key, value] = match;
      params[key] = value.trim();
    }
    
    return params;
  }

  /**
   * Удаление команд из текста ответа
   */
  removeCommandsFromResponse(text) {
    return text.replace(/\[([A-Z_]+)(?:\s+[^\]]+)?\]/g, '').trim();
  }

  /**
   * Обработка специальных символов
   */
  processSpecialCharacters(text) {
    // Убираем символ |, который иногда добавляет AI
    text = text.replace(/\|/g, '. ');
    
    // Убираем двойные пробелы
    text = text.replace(/\s+/g, ' ');
    
    // Убираем пробелы перед знаками препинания
    text = text.replace(/\s+([.,!?])/g, '$1');
    
    return text.trim();
  }

  /**
   * Выполнение команд
   */
  async executeCommands(commands, context) {
    const results = [];
    
    for (const cmd of commands) {
      try {
        logger.info(`Executing command: ${cmd.command}`, { params: cmd.params });
        
        const result = await this.commandHandler.executeCommand(
          cmd.command,
          cmd.params,
          context
        );
        
        results.push({
          command: cmd.command,
          success: true,
          result
        });
        
      } catch (error) {
        logger.error(`Command execution failed: ${cmd.command}`, error);
        
        results.push({
          command: cmd.command,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Форматирование финального ответа
   */
  async formatFinalResponse(baseResponse, commandResults, context) {
    let finalResponse = baseResponse;
    
    // Обработка результатов команд
    for (const result of commandResults) {
      if (!result.success) {
        finalResponse = await this.handleCommandError(
          finalResponse,
          result,
          context
        );
      }
    }
    
    // Применяем форматирование для конкретного типа бизнеса
    finalResponse = this.formatter.applyBusinessTypeFormatting(
      finalResponse,
      context.company.type
    );
    
    return finalResponse;
  }

  /**
   * Обработка ошибок команд
   */
  async handleCommandError(response, errorResult, context) {
    const { command, error } = errorResult;
    
    switch (command) {
      case 'CREATE_BOOKING':
        return await this.handleBookingError(response, error, context);
        
      case 'SEARCH_SLOTS':
        return this.handleSearchError(response, error);
        
      case 'CANCEL_BOOKING':
        return this.handleCancellationError(response, error);
        
      default:
        return response + '\n\nИзвините, произошла техническая ошибка. Попробуйте еще раз.';
    }
  }

  /**
   * Обработка ошибки создания записи
   */
  async handleBookingError(response, error, context) {
    // Проверяем тип ошибки
    if (this.isAvailabilityError(error)) {
      // Убираем фразы об успешной записи
      response = response.replace(
        /записываю вас|запись создана|вы записаны/gi,
        'к сожалению, это время уже занято'
      );
      
      // Предлагаем альтернативы
      response += await this.suggestAlternatives(context);
    } else {
      // Общая ошибка
      response = response.replace(
        /записываю вас|запись создана|вы записаны/gi,
        'не удалось создать запись'
      );
      response += '\n\nПопробуйте выбрать другое время или позвоните нам.';
    }
    
    return response;
  }

  /**
   * Проверка, является ли ошибка проблемой доступности
   */
  isAvailabilityError(error) {
    const availabilityPatterns = [
      'уже занято',
      'недоступно',
      'нет свободных',
      'already booked',
      'not available',
      'no slots'
    ];
    
    const errorLower = error.toLowerCase();
    return availabilityPatterns.some(pattern => errorLower.includes(pattern));
  }

  /**
   * Предложение альтернативных вариантов
   */
  async suggestAlternatives(context) {
    // Здесь можно вызвать поиск альтернативных слотов
    return '\n\nДавайте подберем другое удобное время.';
  }

  /**
   * Обработка ошибки поиска
   */
  handleSearchError(response, error) {
    return response + '\n\nНе удалось найти свободное время. Попробуйте выбрать другую дату.';
  }

  /**
   * Обработка ошибки отмены
   */
  handleCancellationError(response, error) {
    return response + '\n\nНе удалось отменить запись. Пожалуйста, позвоните нам для отмены.';
  }
}

module.exports = ResponseProcessor;