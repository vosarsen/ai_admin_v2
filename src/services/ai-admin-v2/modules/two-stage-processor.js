/**
 * Two-Stage Processor
 * Упрощенная двухэтапная обработка сообщений
 * 
 * Этап 1: Извлечение команд (AI → JSON с командами)
 * Этап 2: Генерация ответа (Результаты → AI → Текст)
 */

const logger = require('../../../utils/logger').child({ module: 'two-stage-processor' });
const commandHandler = require('./command-handler');

class TwoStageProcessor {
  constructor() {
    this.commandPrompt = require('../prompts/two-stage-command-prompt');
    this.responsePrompt = require('../prompts/two-stage-response-prompt');
    this.performanceMetrics = {
      stage1Times: [],
      stage2Times: [],
      commandExecutionTimes: []
    };
  }

  /**
   * Главный метод двухэтапной обработки
   */
  async processTwoStage(message, context, aiService, aiProvider = null) {
    const startTime = Date.now();
    logger.info('🚀 Starting Two-Stage processing');
    
    try {
      // ============ ЭТАП 1: ИЗВЛЕЧЕНИЕ КОМАНД ============
      const stage1Start = Date.now();
      logger.info('📋 Stage 1: Command extraction');
      
      // Строим промпт для извлечения команд
      const commandPromptText = this.commandPrompt.getPrompt({
        message,
        phone: context.phone,
        company: context.company,
        client: context.client,
        services: context.services,
        staff: context.staff,
        redisContext: context.redisContext,
        intermediateContext: context.intermediateContext,
        currentSelection: context.currentSelection // Передаем из context-v2
      });
      
      // ОТЛАДКА: Логируем ключевые части промпта для диагностики
      logger.debug(`📝 Stage 1 Context: phone=${context.phone}, message="${message}"`);
      logger.debug(`📝 Stage 1 Redis Context: ${JSON.stringify(context.redisContext)}`);
      if (context.redisContext?.data) {
        logger.debug(`📝 Stage 1 Redis Data: ${context.redisContext.data}`);
      }
      
      // Вызываем AI для извлечения команд
      const commandsResponse = await aiService.callAI(commandPromptText, {
        message: message,
        promptName: 'two-stage-command'
      }, aiProvider);
      
      // ОТЛАДКА: Логируем сырой ответ AI для диагностики
      logger.debug(`📝 Stage 1 Raw AI Response: ${commandsResponse}`);
      
      // Парсим JSON ответ
      const commands = this.parseCommandsResponse(commandsResponse);

      // 🎯 КРИТИЧНО: Перезаписываем service_name в CREATE_BOOKING если есть lastSearch
      // AI иногда игнорирует lastService и использует персонализацию
      if (commands.length > 0 && context.lastSearch?.service) {
        for (const cmd of commands) {
          if (cmd.name === 'CREATE_BOOKING' && cmd.params?.service_name) {
            const lastSearchService = context.lastSearch.service;
            // Проверяем что service_name не совпадает с lastSearch
            const paramServiceNormalized = cmd.params.service_name.toLowerCase().replace(/[^\wа-яё]/g, '');
            const lastSearchNormalized = lastSearchService.toLowerCase().replace(/[^\wа-яё]/g, '');

            if (paramServiceNormalized !== lastSearchNormalized) {
              logger.warn(`⚠️ Stage 1 extracted wrong service_name="${cmd.params.service_name}", overriding with lastSearch="${lastSearchService}"`);
              cmd.params.service_name = lastSearchService;
            } else {
              logger.info(`✅ Stage 1 service_name="${cmd.params.service_name}" matches lastSearch`);
            }
          }
        }
      }

      const stage1Time = Date.now() - stage1Start;
      logger.info(`✅ Stage 1 completed in ${stage1Time}ms, found ${commands.length} commands`);
      this.performanceMetrics.stage1Times.push(stage1Time);
      
      // ============ ВЫПОЛНЕНИЕ КОМАНД ============
      let commandResults = [];
      let executedCommands = [];
      
      if (commands.length > 0) {
        const execStart = Date.now();
        logger.info(`⚙️ Executing ${commands.length} commands`);
        
        // Выполняем команды параллельно где возможно
        // Добавляем message в контекст для лучшей фильтрации
        const commandContext = { ...context, message };
        commandResults = await this.executeCommandsOptimized(commands, commandContext);
        
        // Форматируем для совместимости
        executedCommands = commands.map((cmd, index) => ({
          command: cmd.name,
          params: cmd.params,
          success: commandResults[index]?.success || false,
          result: commandResults[index]
        }));
        
        const execTime = Date.now() - execStart;
        logger.info(`✅ Commands executed in ${execTime}ms`);
        this.performanceMetrics.commandExecutionTimes.push(execTime);
      }
      
      // ============ ЭТАП 2: ГЕНЕРАЦИЯ ОТВЕТА ============
      const stage2Start = Date.now();
      logger.info('💬 Stage 2: Response generation');
      
      // Строим промпт для генерации ответа  
      // redisContext содержит lastActivity и lastMessageDate на верхнем уровне
      const responsePromptText = this.responsePrompt.getPrompt({
        message,
        company: context.company,
        client: context.client,
        commandResults,
        executedCommands,
        intermediateContext: context.intermediateContext,
        lastActivity: context.redisContext?.lastActivity || context.lastActivity,
        lastMessageDate: context.redisContext?.lastMessageDate || context.lastMessageDate,
        // Передаем флаги вопросов
        askedForTimeSelection: context.redisContext?.askedForTimeSelection || false,
        askedForTimeAt: context.redisContext?.askedForTimeAt || null,
        shownSlotsAt: context.redisContext?.shownSlotsAt || null,
        // Передаем предложенные слоты
        proposedSlots: context.redisContext?.proposedSlots || null
      });
      
      // Вызываем AI для генерации ответа
      const finalResponse = await aiService.callAI(responsePromptText, {
        message: message,
        promptName: 'two-stage-response'
      }, aiProvider);
      
      const stage2Time = Date.now() - stage2Start;
      logger.info(`✅ Stage 2 completed in ${stage2Time}ms`);
      this.performanceMetrics.stage2Times.push(stage2Time);
      
      // ============ ФИНАЛИЗАЦИЯ ============
      const totalTime = Date.now() - startTime;
      logger.info(`🎉 Two-Stage processing completed in ${totalTime}ms`);
      
      // Логируем статистику
      this.logPerformanceStats();
      
      return {
        response: finalResponse,
        commands: executedCommands,
        executedCommands: executedCommands, // Добавляем для совместимости с сохранением контекста
        commandResults: commandResults, // Добавляем для сохранения результатов
        iterations: 2, // Всегда 2 этапа
        metrics: {
          stage1Time,
          stage2Time,
          commandExecutionTime: commandResults.length > 0 ? 
            this.performanceMetrics.commandExecutionTimes[this.performanceMetrics.commandExecutionTimes.length - 1] : 0,
          totalTime
        }
      };
      
    } catch (error) {
      logger.error('Error in Two-Stage processing:', error);
      throw error;
    }
  }

  /**
   * Парсинг JSON ответа с командами
   */
  parseCommandsResponse(response) {
    try {
      // Пытаемся найти JSON в ответе
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in command response, assuming no commands needed');
        logger.debug(`📝 Response that failed JSON parsing: "${response}"`);
        return [];
      }
      
      logger.debug(`📝 Found JSON to parse: ${jsonMatch[0]}`);
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.commands || !Array.isArray(parsed.commands)) {
        logger.warn('Invalid commands structure in response');
        return [];
      }
      
      // Валидируем и нормализуем команды
      return parsed.commands.filter(cmd => {
        if (!cmd.name) {
          logger.warn('Command without name found, skipping');
          return false;
        }
        
        // Нормализуем параметры
        cmd.params = cmd.params || {};
        
        return true;
      });
      
    } catch (error) {
      logger.error('Failed to parse commands JSON:', error);
      
      // Fallback: пытаемся извлечь команды через regex
      return this.fallbackCommandExtraction(response);
    }
  }

  /**
   * Резервный метод извлечения команд через regex
   */
  fallbackCommandExtraction(response) {
    logger.info('Using fallback command extraction');
    
    const commands = [];
    const commandRegex = /\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|CANCEL_BOOKING|CHECK_STAFF_SCHEDULE)([^\]]*)\]/g;
    
    let match;
    while ((match = commandRegex.exec(response)) !== null) {
      const [, commandName, paramsString] = match;
      
      // Парсим параметры
      const params = {};
      if (paramsString) {
        const paramRegex = /(\w+)[:=]\s*([^,]+)/g;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(paramsString)) !== null) {
          const [, key, value] = paramMatch;
          params[key.trim()] = value.trim();
        }
      }
      
      commands.push({
        name: commandName,
        params
      });
    }
    
    return commands;
  }

  /**
   * Оптимизированное выполнение команд
   */
  async executeCommandsOptimized(commands, context) {
    const results = [];
    
    // Группируем команды по типу для оптимизации
    const independentCommands = [];
    const dependentCommands = [];
    
    for (const cmd of commands) {
      if (cmd.name === 'CREATE_BOOKING') {
        // CREATE_BOOKING зависит от результатов SEARCH_SLOTS
        dependentCommands.push(cmd);
      } else {
        independentCommands.push(cmd);
      }
    }
    
    // Выполняем независимые команды параллельно
    if (independentCommands.length > 0) {
      logger.info(`Executing ${independentCommands.length} independent commands in parallel`);
      
      const independentResults = await Promise.all(
        independentCommands.map(cmd => this.executeSingleCommand(cmd, context))
      );
      
      results.push(...independentResults);
    }
    
    // Выполняем зависимые команды последовательно
    for (const cmd of dependentCommands) {
      logger.info(`Executing dependent command: ${cmd.name}`);
      const result = await this.executeSingleCommand(cmd, context);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Выполнение одной команды
   */
  async executeSingleCommand(cmd, context) {
    try {
      // Преобразуем в формат для commandHandler
      const commandObj = {
        command: cmd.name,
        params: cmd.params,
        originalText: `[${cmd.name}]`
      };
      
      // Выполняем через существующий commandHandler
      const results = await commandHandler.executeCommands([commandObj], context);
      
      if (results && results.length > 0) {
        const result = results[0];
        return {
          command: cmd.name,
          success: true,
          data: result.data || result,
          ...result
        };
      }
      
      return {
        command: cmd.name,
        success: false,
        error: 'No result returned'
      };
      
    } catch (error) {
      logger.error(`Error executing command ${cmd.name}:`, error);
      return {
        command: cmd.name,
        success: false,
        error: error.message,
        errorCode: error.code || null
      };
    }
  }

  /**
   * Логирование статистики производительности
   */
  logPerformanceStats() {
    const avg = (arr) => arr.length > 0 ? 
      Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    
    const stats = {
      avgStage1: avg(this.performanceMetrics.stage1Times),
      avgStage2: avg(this.performanceMetrics.stage2Times),
      avgCommandExec: avg(this.performanceMetrics.commandExecutionTimes),
      totalCalls: this.performanceMetrics.stage1Times.length
    };
    
    if (stats.totalCalls % 10 === 0 && stats.totalCalls > 0) {
      logger.info('📊 Two-Stage Performance Stats:', stats);
    }
  }

  /**
   * Сброс метрик (для тестирования)
   */
  resetMetrics() {
    this.performanceMetrics = {
      stage1Times: [],
      stage2Times: [],
      commandExecutionTimes: []
    };
  }
}

module.exports = new TwoStageProcessor();