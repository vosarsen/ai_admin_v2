/**
 * ReAct Processor - обработчик циклов Think-Act-Observe
 * Реализует паттерн ReAct для правильной последовательной обработки команд
 */

const logger = require('../../../utils/logger').child({ module: 'react-processor' });
const commandHandler = require('./command-handler');

class ReActProcessor {
  constructor() {
    this.MAX_ITERATIONS = 5; // Максимум циклов для предотвращения зацикливания
    this.commandCache = new Map(); // Кэш результатов команд
  }

  /**
   * Главный метод обработки ReAct цикла
   */
  async processReActCycle(initialResponse, context, aiService) {
    logger.info('Starting ReAct processing cycle');
    
    let currentResponse = initialResponse;
    let iterations = 0;
    let finalResponse = '';
    let allExecutedCommands = [];
    let continueProcessing = true;
    let isFirstIteration = true;
    
    // Кэш для хранения результатов команд между итерациями
    const commandResults = new Map();
    
    while (continueProcessing && iterations < this.MAX_ITERATIONS) {
      iterations++;
      logger.info(`ReAct iteration ${iterations}`);
      
      // Парсим текущий ответ
      const parsed = this.parseReActResponse(currentResponse);
      
      // На первой итерации игнорируем RESPOND блок, так как AI мог сгенерировать его по ошибке
      if (parsed.respond && !isFirstIteration && !parsed.act) {
        finalResponse = parsed.respond;
        continueProcessing = false;
        logger.info('Found RESPOND block after command execution, completing cycle');
        break;
      } else if (parsed.respond && isFirstIteration) {
        logger.warn('Found RESPOND block in first iteration - ignoring it, AI should wait for command results');
      }
      
      // Если есть команда для выполнения
      if (parsed.act) {
        logger.info(`Executing ACT: ${parsed.act}`);
        
        // Извлекаем и выполняем команду
        const command = this.extractCommand(parsed.act);
        if (command) {
          // Проверяем кэш команд
          const cacheKey = JSON.stringify(command);
          let result;
          
          if (commandResults.has(cacheKey)) {
            logger.info('Using cached command result');
            result = commandResults.get(cacheKey);
          } else {
            // Выполняем команду
            const results = await commandHandler.executeCommands([command], context);
            result = results[0];
            commandResults.set(cacheKey, result);
            
            // Добавляем в список выполненных команд
            allExecutedCommands.push({
              ...command,
              result: result
            });
          }
          
          // Формируем контекст для следующей итерации
          const observeContext = this.formatObserveContext(result, command);
          
          // Генерируем продолжение с результатами команды
          const continuePrompt = this.buildContinuationPrompt(
            parsed,
            observeContext,
            context,
            commandResults
          );
          
          // Вызываем AI для продолжения обработки
          logger.info('Calling AI for continuation after command execution');
          currentResponse = await aiService.callAI(continuePrompt, {
            message: context.currentMessage,
            promptName: 'react-continuation'
          });
          
          // Сбрасываем флаг первой итерации
          isFirstIteration = false;
          
        } else {
          logger.warn('No valid command found in ACT block');
          continueProcessing = false;
        }
      } else if (parsed.think && !parsed.act && !parsed.respond) {
        // Если есть только THINK без ACT и без RESPOND - нужно продолжить
        logger.info('Found THINK without ACT or RESPOND, asking AI to complete');
        
        // После выполнения команды ВСЕГДА должен быть финальный ответ
        // Если AI дал только анализ - просим его завершить ответом
        const needsResponse = !isFirstIteration; // После команд всегда нужен RESPOND
        
        if (needsResponse || this.shouldContinueAfterThink(parsed.think)) {
          // Генерируем запрос на продолжение с акцентом на RESPOND
          const continuePrompt = this.buildThinkContinuationPrompt(parsed, context, needsResponse);
          currentResponse = await aiService.callAI(continuePrompt, {
            message: context.currentMessage,
            promptName: 'react-think-continuation'
          });
          
          // Сбрасываем флаг первой итерации
          isFirstIteration = false;
        } else {
          // На первой итерации без команд - возможно AI решил, что не нужны действия
          logger.warn('AI completed without actions, extracting response');
          finalResponse = this.extractFinalResponse(currentResponse);
          continueProcessing = false;
        }
      } else {
        // Нет распознанных блоков - завершаем
        logger.warn('No recognized ReAct blocks found, ending cycle');
        finalResponse = this.extractFinalResponse(currentResponse);
        continueProcessing = false;
      }
    }
    
    if (iterations >= this.MAX_ITERATIONS) {
      logger.warn('Max iterations reached, forcing completion');
      finalResponse = this.extractFinalResponse(currentResponse);
    }
    
    logger.info(`ReAct cycle completed after ${iterations} iterations`);
    
    return {
      response: finalResponse,
      commands: allExecutedCommands,
      iterations: iterations
    };
  }

  /**
   * Парсинг ReAct ответа на блоки
   */
  parseReActResponse(response) {
    const blocks = {};
    
    // Извлекаем THINK блок
    const thinkMatch = response.match(/\[THINK\]([\s\S]*?)\[\/THINK\]/);
    if (thinkMatch) {
      blocks.think = thinkMatch[1].trim();
    }
    
    // Извлекаем ACT блок
    const actMatch = response.match(/\[ACT:\s*([^\]]+)\]/);
    if (actMatch) {
      blocks.act = actMatch[1].trim();
    }
    
    // Извлекаем OBSERVE блок
    const observeMatch = response.match(/\[OBSERVE\]([\s\S]*?)\[\/OBSERVE\]/);
    if (observeMatch) {
      blocks.observe = observeMatch[1].trim();
    }
    
    // Извлекаем RESPOND блок
    const respondMatch = response.match(/\[RESPOND\]([\s\S]*?)\[\/RESPOND\]/);
    if (respondMatch) {
      blocks.respond = respondMatch[1].trim();
    }
    
    logger.debug('Parsed ReAct blocks:', {
      hasThink: !!blocks.think,
      hasAct: !!blocks.act,
      hasObserve: !!blocks.observe,
      hasRespond: !!blocks.respond
    });
    
    return blocks;
  }

  /**
   * Извлечение команды из ACT блока
   */
  extractCommand(actBlock) {
    // Парсим команду в формате: COMMAND_NAME param1: value1, param2: value2
    const parts = actBlock.split(/\s+/);
    const commandName = parts[0];
    
    // Извлекаем параметры
    const paramsString = actBlock.substring(commandName.length).trim();
    const params = {};
    
    // Парсим параметры вида key: value
    const paramRegex = /(\w+):\s*([^,]+)(?:,|$)/g;
    let match;
    while ((match = paramRegex.exec(paramsString)) !== null) {
      params[match[1]] = match[2].trim();
    }
    
    return {
      command: commandName,
      params: params
    };
  }

  /**
   * Форматирование контекста наблюдения после выполнения команды
   */
  formatObserveContext(result, command) {
    if (!result) {
      return 'Команда не вернула результат';
    }
    
    let context = '';
    
    switch (result.type) {
      case 'slots':
        if (result.data && result.data.length > 0) {
          const times = result.data.map(slot => {
            const time = slot.time || slot.datetime?.split('T')[1]?.substring(0, 5);
            return time;
          });
          
          // Передаём полную информацию, а не только времена
          context = `Найдены доступные слоты: ${times.join(', ')}
Полный список доступного времени: [${times.join(', ')}]
Всего доступно слотов: ${times.length}`;
          
          // Если искали конкретное время, явно укажем его наличие
          if (command.params?.time) {
            const requestedTime = command.params.time;
            const isAvailable = times.includes(requestedTime);
            context += `\nЗапрошенное время ${requestedTime}: ${isAvailable ? 'ДОСТУПНО' : 'ЗАНЯТО'}`;
          }
        } else {
          context = 'Не найдено доступных слотов на указанную дату';
        }
        break;
        
      case 'booking_created':
        context = `Запись успешно создана!
ID записи: ${result.data?.record_id}
Услуга: ${result.data?.service}
Дата и время: ${result.data?.datetime}
Мастер: ${result.data?.staff}`;
        break;
        
      case 'booking_cancelled':
        context = 'Запись успешно отменена';
        break;
        
      case 'error':
        context = `Ошибка при выполнении команды: ${result.error || 'Неизвестная ошибка'}`;
        break;
        
      default:
        context = JSON.stringify(result.data || result, null, 2);
    }
    
    return context;
  }

  /**
   * Построение промпта для продолжения после выполнения команды
   */
  buildContinuationPrompt(parsed, observeContext, context, previousResults) {
    let prompt = 'Ты выполнил команду и получил результаты. Продолжай обработку.\n\n';
    
    // Добавляем предыдущие блоки
    if (parsed.think) {
      prompt += `Твой предыдущий анализ:\n[THINK]\n${parsed.think}\n[/THINK]\n\n`;
    }
    
    if (parsed.act) {
      prompt += `Ты выполнил команду:\n[ACT: ${parsed.act}]\n\n`;
    }
    
    // Добавляем результат наблюдения
    prompt += `Результаты выполнения команды:\n[OBSERVE]\n${observeContext}\n[/OBSERVE]\n\n`;
    
    // Добавляем инструкцию продолжить
    prompt += `ВАЖНО: Теперь проанализируй РЕАЛЬНЫЕ результаты!

Правила продолжения:
1. Начни с [THINK] - проанализируй полученные данные
2. Если клиент просил конкретное время - проверь его в списке слотов
3. Если время есть - можешь создать запись командой [ACT: CREATE_BOOKING ...]
4. Если времени нет - предложи альтернативы в [RESPOND]
5. Если все готово - заверши блоком [RESPOND]

НЕ выдумывай! Используй только те слоты, которые есть в [OBSERVE].

Клиент спросил: "${context.currentMessage}"

Продолжай с анализа результатов:`;
    
    return prompt;
  }

  /**
   * Проверка нужно ли продолжать после THINK
   */
  shouldContinueAfterThink(thinkContent) {
    const lowerThink = thinkContent.toLowerCase();
    
    // Ключевые фразы, указывающие на необходимость действия
    const actionIndicators = [
      'нужно проверить',
      'необходимо узнать',
      'должен получить',
      'требуется информация',
      'нужны данные',
      'проверю'
    ];
    
    return actionIndicators.some(indicator => lowerThink.includes(indicator));
  }

  /**
   * Построение промпта для продолжения после THINK
   */
  buildThinkContinuationPrompt(parsed, context, needsResponse = false) {
    let prompt = `Ты проанализировал запрос:\n\n[THINK]\n${parsed.think}\n[/THINK]\n\n`;
    
    if (needsResponse) {
      // После выполнения команды ОБЯЗАТЕЛЬНО нужен финальный ответ
      prompt += `ВАЖНО: Ты уже выполнил команду и получил результаты!
Теперь ОБЯЗАТЕЛЬНО дай финальный ответ клиенту.

Основываясь на твоём анализе, добавь блок [RESPOND] с ответом.
Если нужна ещё команда - сначала [ACT: команда], потом [RESPOND].
НО ОБЯЗАТЕЛЬНО заверши блоком [RESPOND]!

Клиент ждёт ответ на: "${context.currentMessage}"

Продолжай:`;
    } else {
      prompt += `Теперь выполни необходимое действие.
Добавь блок [ACT: команда] для выполнения команды
ИЛИ блок [RESPOND] если можешь сразу ответить клиенту.

Продолжай:`;
    }
    
    return prompt;
  }

  /**
   * Извлечение финального ответа если нет RESPOND блока
   */
  extractFinalResponse(response) {
    // Удаляем все технические блоки
    let cleaned = response
      .replace(/\[THINK\][\s\S]*?\[\/THINK\]/g, '')
      .replace(/\[ACT:[^\]]+\]/g, '')
      .replace(/\[OBSERVE\][\s\S]*?\[\/OBSERVE\]/g, '')
      .replace(/\[RESPOND\][\s\S]*?\[\/RESPOND\]/g, '');
    
    // Если остался текст - возвращаем его
    cleaned = cleaned.trim();
    
    if (cleaned) {
      return cleaned;
    }
    
    // Если ничего не осталось - возвращаем стандартный ответ
    return 'Обработка вашего запроса завершена. Чем еще могу помочь?';
  }

  /**
   * Очистка кэша команд
   */
  clearCache() {
    this.commandCache.clear();
    logger.info('Command cache cleared');
  }
}

module.exports = new ReActProcessor();