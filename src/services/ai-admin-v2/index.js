const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2' });

// Импортируем модули
const dataLoader = require('./modules/cached-data-loader'); // Используем версию с кэшем
const formatter = require('./modules/formatter');
const businessLogic = require('./modules/business-logic');
const commandHandler = require('./modules/command-handler');
const contextService = require('../context');
const intermediateContext = require('../context/intermediate-context');
const errorMessages = require('../../utils/error-messages');
const criticalErrorLogger = require('../../utils/critical-error-logger');
const providerFactory = require('../ai/provider-factory');
const promptManager = require('./prompt-manager');
const ResponseProcessor = require('./modules/response-processor');
const { ErrorHandler, BookingError, ContextError, ValidationError } = require('./modules/error-handler');
const MessageProcessor = require('./modules/message-processor');
const contextManager = require('./modules/context-manager');
const performanceMetrics = require('./modules/performance-metrics');
const prometheusMetrics = require('./modules/prometheus-metrics');
const ClientPersonalizationService = require('../personalization/client-personalization');

/**
 * AI Admin v2 - единый сервис управления AI администратором
 * Заменяет старую архитектуру с 5-6 этапами на один AI вызов
 */
class AIAdminV2 {
  constructor() {
    this.responseFormatter = formatter; // Добавляем форматтер
    this.responseProcessor = new ResponseProcessor(formatter);
    this.errorHandler = ErrorHandler;
    this.messageProcessor = new MessageProcessor(dataLoader, contextService, intermediateContext);
    this.personalizationService = new ClientPersonalizationService();
  }

  /**
   * Валидация входных данных
   */
  validateInput(message, phone, companyId) {
    // Валидация сообщения
    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message is required and must be a string', 'message', message);
    }
    
    if (message.length > 5000) {
      throw new ValidationError('Message is too long (max 5000 characters)', 'message', message.length);
    }
    
    // Валидация телефона
    if (!phone || typeof phone !== 'string') {
      throw new ValidationError('Phone is required and must be a string', 'phone', phone);
    }
    
    // Поддерживаем формат с @c.us и без
    const phoneRegex = /^(\+?\d{10,15}|[\d\-\(\)\s]{10,20}(@c\.us)?)$/;
    if (!phoneRegex.test(phone)) {
      throw new ValidationError('Invalid phone format', 'phone', phone);
    }
    
    // Валидация ID компании
    if (!companyId || (typeof companyId !== 'number' && typeof companyId !== 'string')) {
      throw new ValidationError('CompanyId is required', 'companyId', companyId);
    }
    
    const companyIdNum = parseInt(companyId);
    if (isNaN(companyIdNum) || companyIdNum <= 0) {
      throw new ValidationError('CompanyId must be a positive number', 'companyId', companyId);
    }
  }

  /**
   * Основной метод обработки сообщений
   * Упрощен с использованием MessageProcessor
   */
  async processMessage(message, phone, companyId) {
    let context = null;
    let results = null;
    
    // Начинаем отслеживание операции
    const operation = performanceMetrics.startOperation('processMessage');
    
    try {
      // Валидация входных данных
      this.validateInput(message, phone, companyId);
      
      logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);
      
      // 1. Проверяем ожидающую отмену записи
      const redisContext = await contextService.getContext(phone.replace('@c.us', ''));
      if (redisContext?.pendingCancellation) {
        const cancellationResult = await this.messageProcessor.handlePendingCancellation(
          message, phone, companyId, redisContext
        );
        
        if (cancellationResult.handled) {
          return cancellationResult.response;
        }
      }
      
      // 2. Проверяем и ждем завершения предыдущей обработки
      await this.messageProcessor.checkAndWaitForPreviousProcessing(phone);
      
      // 3. Загружаем полный контекст
      context = await this.messageProcessor.loadContext(phone, companyId);
      
      // 4. Сохраняем промежуточный контекст
      await intermediateContext.saveProcessingStart(phone, message, context);
      
      // Добавляем текущее сообщение в контекст
      context.currentMessage = message;
      
      // Определяем тип бизнеса для адаптации общения
      const businessType = businessLogic.detectBusinessType(context.company);
      context.company.type = businessType;
      logger.info(`Business type detected: ${businessType}`);
      
      // Логируем промежуточный контекст для отладки
      if (context.intermediateContext) {
        logger.info('Intermediate context found:', {
          isRecent: context.intermediateContext.isRecent,
          mentionedServices: context.intermediateContext.mentionedServices,
          mentionedStaff: context.intermediateContext.mentionedStaff,
          lastBotQuestion: context.intermediateContext.lastBotQuestion
        });
      } else {
        logger.info('No intermediate context found');
      }
      
      // Строим умный промпт с полным контекстом
      const prompt = this.buildSmartPrompt(message, context, phone);
      
      // Определяем имя промпта для статистики
      const promptName = process.env.AI_PROMPT_VERSION || 'enhanced-prompt';
      
      // Один вызов AI со всей информацией
      const aiResponse = await this.callAI(prompt, {
        message: message,
        promptName: promptName
      });
      
      // Обрабатываем ответ и выполняем команды
      const result = await this.processAIResponse(aiResponse, context);
      results = result.results;
      
      // Обновляем статистику с количеством выполненных команд
      if (result.executedCommands?.length > 0) {
        promptManager.recordUsage(promptName, {
          success: true,
          commandsExecuted: result.executedCommands.length
        });
      }
      
      // Обновляем промежуточный контекст после AI анализа
      await intermediateContext.updateAfterAIAnalysis(phone, aiResponse, result.executedCommands || []);
      
      // Сохраняем сообщения в контекст
      await contextService.updateContext(phone.replace('@c.us', ''), companyId, {
        lastMessage: {
          sender: 'user',
          text: message,
          timestamp: new Date().toISOString()
        }
      });
      
      await contextService.updateContext(phone.replace('@c.us', ''), companyId, {
        lastMessage: {
          sender: 'bot',
          text: result.response,
          timestamp: new Date().toISOString()
        }
      });
      
      // Сохраняем информацию о выбранных услуге и времени из выполненных команд
      if (result.executedCommands && result.executedCommands.length > 0) {
        const normalizedPhone = phone.replace('@c.us', '');
        const contextData = {};
        
        // Извлекаем информацию из выполненных команд
        result.executedCommands.forEach(cmd => {
          if (cmd.params?.service_name) {
            contextData.lastService = cmd.params.service_name;
          }
          if (cmd.params?.time) {
            contextData.lastTime = cmd.params.time;
          }
          if (cmd.params?.staff_name) {
            contextData.lastStaff = cmd.params.staff_name;
          }
          if (cmd.params?.date) {
            contextData.lastDate = cmd.params.date;
          }
          contextData.lastCommand = cmd.command;
        });
        
        // Сохраняем в Redis контекст
        if (Object.keys(contextData).length > 0) {
          await contextService.setContext(normalizedPhone, companyId, {
            data: contextData,
            state: 'active'
          });
          logger.info('Context data saved:', contextData);
        }
      }
      
      // Сохраняем контекст диалога
      await contextManager.saveContext(context);
      
      // Помечаем обработку как завершенную
      await intermediateContext.markAsCompleted(phone, result);
      
      const processingTime = Date.now() - context.startTime;
      logger.info(`✅ AI Admin v2 completed in ${processingTime}ms`);
      
      // Завершаем отслеживание операции
      performanceMetrics.endOperation(operation, true);
      
      // Отправляем метрики в Prometheus
      prometheusMetrics.recordMessageProcessing(
        'text',
        processingTime / 1000,
        true,
        context.company?.type || 'unknown'
      );
      
      // Записываем метрики команд
      if (result.executedCommands) {
        result.executedCommands.forEach(cmd => {
          performanceMetrics.recordCommand(cmd.command, true);
          
          // Отдельно отслеживаем создание и отмену записей
          if (cmd.command === 'CREATE_BOOKING' && cmd.success) {
            const serviceType = cmd.params?.service_name || 'unknown';
            prometheusMetrics.recordBookingCreated(serviceType, true);
          } else if (cmd.command === 'CANCEL_BOOKING' && cmd.success) {
            prometheusMetrics.recordBookingCancelled('user_request');
          }
        });
      }
      
      return {
        success: true,
        response: result.response,
        commands: result.executedCommands,
        executedCommands: result.executedCommands,
        results: result.results
      };
      
    } catch (error) {
      logger.error('Error in AI Admin v2:', error);
      
      // Завершаем отслеживание операции с ошибкой
      performanceMetrics.endOperation(operation, false);
      
      // Отправляем метрики ошибки в Prometheus
      const processingTime = Date.now() - (context?.startTime || Date.now());
      prometheusMetrics.recordMessageProcessing(
        'text',
        processingTime / 1000,
        false,
        context?.company?.type || 'unknown'
      );
      
      // Обрабатываем ошибку через ErrorHandler
      const errorInfo = await this.errorHandler.handleError(error, {
        operation: 'processMessage',
        companyId,
        phone,
        hasContext: !!context,
        message
      });
      
      // Отмечаем ошибку в промежуточном контексте
      if (phone) {
        await intermediateContext.setProcessingStatus(phone, 'error');
      }
      
      // Логируем критичные ошибки
      if (errorInfo.severity === 'high') {
        logger.error('Critical error in message processing', errorInfo);
      }
      
      return {
        success: false,
        response: errorInfo.userMessage || 'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам напрямую.',
        error: errorInfo.message,
        needsRetry: errorInfo.needsRetry
      };
    }
  }

  /**
   * Загрузка полного контекста (делегируем в ContextManager)
   */
  async loadFullContext(phone, companyId) {
    return await contextManager.loadFullContext(phone, companyId);
  }

  /**
   * Построение умного промпта с полным контекстом
   */
  buildSmartPrompt(message, context, phone) {
    const terminology = businessLogic.getBusinessTerminology(context.company.type);
    
    // Анализируем клиента для персонализации
    const clientAnalysis = this.personalizationService.analyzeClient(context.client);
    
    // Подготавливаем ПОЛНЫЙ контекст для промпта (включая все данные)
    const promptContext = {
      // Базовая информация для совместимости со старыми промптами
      businessInfo: {
        title: context.company?.title || config.app.defaultCompanyName || 'Салон красоты',
        type: terminology.businessName,
        workHours: context.company?.work_hours || '9:00-21:00',
        address: context.company?.address || '',
        phone: context.company?.phone || ''
      },
      services: context.services || [],
      staff: context.staff || [],
      recentBookings: context.client?.bookings || [],
      userInfo: {
        name: context.client?.name || '',
        phone: phone,
        isReturning: context.isReturningClient || false
      },
      
      // Данные для персонализации
      clientData: context.client || null,
      clientAnalysis: clientAnalysis,
      
      // Полный контекст для detailed-prompt
      ...context,
      phone,
      terminology,
      currentTime: context.currentTime || new Date().toISOString(),
      timezone: context.timezone || 'Europe/Moscow',
      // ВАЖНО: передаем промежуточный контекст для промптов
      intermediateContext: context.intermediateContext || null
    };
    
    // Получаем промпт из менеджера
    let basePrompt;
    const promptVersion = process.env.AI_PROMPT_VERSION || 'personalized-prompt'; // По умолчанию используем personalized
    
    if (process.env.AI_PROMPT_AB_TEST === 'true') {
      // A/B тестирование
      const abTestResult = promptManager.getPromptForABTest(promptContext);
      basePrompt = abTestResult.text;
      logger.info(`Using prompt ${abTestResult.name} v${abTestResult.version} for A/B test`);
    } else {
      // Используем указанную версию
      basePrompt = promptManager.getActivePrompt(promptContext);
    }
    
    // Заменяем плейсхолдер на реальное сообщение
    basePrompt = basePrompt.replace('{message}', message);
    
    return basePrompt;
  }

  /**
   * Обработка ответа AI и выполнение команд
   * Делегирует работу в ResponseProcessor для лучшей модульности
   */
  async processAIResponse(aiResponse, context) {
    try {
      // Используем новый модульный процессор
      const result = await this.responseProcessor.processAIResponse(aiResponse, context);
      
      // Обрабатываем специфичные результаты команд
      await this.handleCommandResults(result.results, result.response, context);
      
      return result;
      
    } catch (error) {
      logger.error('Error processing AI response:', error);
      
      // Обрабатываем ошибку через ErrorHandler
      const errorInfo = await this.errorHandler.handleError(error, {
        operation: 'processAIResponse',
        context
      });
      
      return {
        success: false,
        response: errorInfo.userMessage,
        error: errorInfo
      };
    }
  }

  /**
   * Обработка результатов выполнения команд
   * Выделено из processAIResponse для упрощения
   */
  async handleCommandResults(results, finalResponse, context) {
    // Обрабатываем слоты если они есть
    const slotResults = results.filter(r => r.type === 'slots');
    if (slotResults.length > 0) {
      const allSlots = slotResults.reduce((acc, result) => {
        return acc.concat(result.data || []);
      }, []);
      
      if (allSlots.length > 0) {
        const slotsData = formatter.formatSlots(allSlots, context.company.type);
        if (slotsData) {
          // Вызываем AI для форматирования слотов
          const slotsPrompt = `Покажи доступное время на основе данных:
${JSON.stringify(slotsData)}

Используй правильные падежи. Например: "У Сергея свободно", не "У Сергей".
Сгруппируй по периодам дня. Будь кратким и естественным.`;
          
          const formattedSlots = await this.callAI(slotsPrompt);
          // Удаляем форматирование из ответа AI о слотах
          const cleanFormattedSlots = commandHandler.removeCommands(formattedSlots);
          finalResponse += '\n\n' + cleanFormattedSlots;
        }
      }
    }
    
    // Обрабатываем специфичные результаты команд
    for (const result of results) {
      if (result.type === 'booking_created') {
        // Сохраняем информацию о записи
        await this.saveBookingToDatabase(result.data, context);
      }
    }
    
    return finalResponse;
  }

  /**
   * Сохранение информации о записи в базу данных
   */
  async saveBookingToDatabase(bookingData, context) {
    if (!bookingData?.record_id) return;
    
    try {
      const { supabase } = require('../../database/supabase');
      const phone = context.phone.replace('@c.us', '');
      
      // Находим клиента
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', phone)
        .eq('company_id', context.company.company_id)
        .maybeSingle();
      
      // Сохраняем запись
      const appointmentData = {
        yclients_record_id: parseInt(bookingData.record_id),
        company_id: context.company.company_id,
        client_id: clientData?.id || null,
        appointment_datetime: bookingData.datetime || null,
        status: 'confirmed',
        comment: 'Запись через AI администратора WhatsApp',
        synced_at: new Date().toISOString()
      };
      
      await supabase
        .from('appointments_cache')
        .insert([appointmentData]);
        
      // Инвалидируем кэш
      await dataLoader.invalidateCache('fullContext', `${phone}_${context.company.company_id}`);
      
      logger.info('Booking saved to database:', appointmentData);
    } catch (error) {
      logger.error('Failed to save booking to database:', error);
    }
  }

  /**
   * Вызов AI через новую систему провайдеров
   */
  async callAI(prompt, context = {}) {
    const startTime = Date.now();
    
    // Используем retry логику из ErrorHandler
    return await this.errorHandler.executeWithRetry(async () => {
      // Получаем провайдера через фабрику
      const provider = await providerFactory.getProvider();
      
      // Вызываем AI
      const result = await provider.call(prompt, {
        message: context.message || '',
        temperature: 0.7,
        maxTokens: 1000
      });
      
      const responseTime = Date.now() - startTime;
      
      // Записываем метрики AI провайдера
      performanceMetrics.recordAICall(responseTime, true);
      
      // Записываем статистику для промпта
      if (context.promptName) {
        promptManager.recordUsage(context.promptName, {
          success: true,
          responseTime,
          commandsExecuted: context.commandsExecuted || 0
        });
      }
      
      logger.info(`✅ AI responded in ${responseTime}ms using ${provider.name}`);
      
      return result.text;
    }, {
      operationName: 'callAI',
      promptName: context.promptName,
      startTime
    }).catch(error => {
      const responseTime = Date.now() - startTime;
      
      // Записываем метрики AI провайдера
      performanceMetrics.recordAICall(responseTime, false, 'unknown', 'unknown');
      
      // Записываем ошибку в статистику
      if (context.promptName) {
        promptManager.recordUsage(context.promptName, {
          success: false,
          responseTime: responseTime,
          error: error.message
        });
      }
      
      throw error;
    });
  }
  
  /**
   * Получить метрики производительности
   */
  getPerformanceMetrics() {
    return performanceMetrics.getSummary();
  }
}

module.exports = new AIAdminV2();
