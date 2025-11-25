const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2' });
const InternationalPhone = require('../../utils/international-phone');

// Импортируем модули
const dataLoader = require('./modules/cached-data-loader'); // Используем версию с кэшем
const formatter = require('./modules/formatter');
const businessLogic = require('./modules/business-logic');
const commandHandler = require('./modules/command-handler');
const contextServiceV2 = require('../context/context-service-v2');
const intermediateContext = require('../context/intermediate-context');
const errorMessages = require('../../utils/error-messages');
const criticalErrorLogger = require('../../utils/critical-error-logger');
const providerFactory = require('../ai/provider-factory');
const promptManager = require('./prompt-manager');
const reactProcessor = require('./modules/react-processor');
const twoStageProcessor = require('./modules/two-stage-processor');
// ResponseProcessor удален - используем commandHandler напрямую
const { ErrorHandler, BookingError, ContextError, ValidationError } = require('./modules/error-handler');
const MessageProcessor = require('./modules/message-processor');
// Используем новый context-manager-v2
const contextManager = require('./modules/context-manager-v2');
const performanceMetrics = require('./modules/performance-metrics');
const prometheusMetrics = require('./modules/prometheus-metrics');
const ClientPersonalizationService = require('../personalization/client-personalization');
// Импортируем обработчик подтверждений напоминаний
const reminderResponseHandler = require('../reminder/reminder-response-handler');

/**
 * AI Admin v2 - единый сервис управления AI администратором
 * Заменяет старую архитектуру с 5-6 этапами на один AI вызов
 */
class AIAdminV2 {
  constructor() {
    this.responseFormatter = formatter; // Добавляем форматтер
    // ResponseProcessor удален - используем commandHandler напрямую
    this.errorHandler = ErrorHandler;
    this.messageProcessor = new MessageProcessor(dataLoader, contextServiceV2, intermediateContext);
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
   * Обработка демо-режима с простыми ответами
   */
  handleDemoMode(message, demoData) {
    const lowerMsg = message.toLowerCase();

    // Приветствие
    if (lowerMsg.match(/привет|здравствуй|добрый день/)) {
      return `Здравствуйте! Я AI администратор салона "${demoData.name}". Чем могу помочь? Могу записать вас на услугу, рассказать о ценах или ответить на вопросы.`;
    }

    // Запрос цен
    if (lowerMsg.match(/цен|стоимость|сколько стоит|прайс|тариф/)) {
      const servicesList = demoData.services
        .map(s => `• ${s.title} — ${s.price}₽`)
        .join('\n');

      return `📋 Наши услуги и цены:\n\n${servicesList}\n\nНа какую услугу хотите записаться?`;
    }

    // Запись на услугу
    if (lowerMsg.match(/запис|хочу|можно/)) {
      return `Отлично! В демо-режиме вы можете ознакомиться с нашими услугами:\n\n${demoData.services.map(s => `• ${s.title}`).join('\n')}\n\n📌 Для реальной записи свяжитесь с нами через форму на сайте.`;
    }

    // Время работы / свободное время
    if (lowerMsg.match(/время|свободн|график|работа|когда/)) {
      return `В демо-версии я могу показать, как работает запись. На самом деле у нас есть свободные места на завтра и послезавтра. Для точного расписания свяжитесь с нами!`;
    }

    // Мастера / специалисты
    if (lowerMsg.match(/мастер|специалист|кто/)) {
      const staffList = demoData.staff.map(s => `• ${s.name}`).join('\n');
      return `У нас работают опытные мастера:\n\n${staffList}\n\nВсе специалисты прошли профессиональное обучение!`;
    }

    // Отмена / перенос
    if (lowerMsg.match(/отмен|перенес|измен/)) {
      return `В демо-режиме записи не сохраняются. В реальном боте вы сможете легко перенести или отменить запись через WhatsApp — просто напишите мне!`;
    }

    // Благодарность
    if (lowerMsg.match(/спасибо|благодар/)) {
      return `Пожалуйста! Если есть вопросы — обращайтесь! 😊`;
    }

    // Общий ответ для неопознанных запросов
    return `Я AI-администратор в демо-режиме. Могу:\n\n• Показать цены на услуги\n• Рассказать о мастерах\n• Показать, как работает запись\n\nДля реальной записи свяжитесь с нами через сайт! Что вас интересует?`;
  }

  /**
   * Основной метод обработки сообщений
   * Упрощен с использованием MessageProcessor
   */
  async processMessage(message, phone, companyId, options = {}) {
    let context = null;
    let results = null;
    const { shouldAskHowToHelp = false, isThankYouMessage = false } = options;
    
    // Начинаем отслеживание операции
    const operation = performanceMetrics.startOperation('processMessage');
    
    try {
      // Валидация входных данных
      this.validateInput(message, phone, companyId);

      logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);

      // DEMO MODE: Если включен демо-режим, возвращаем простые ответы
      if (options.isDemoMode && options.demoCompanyData) {
        logger.info('📊 Demo mode enabled, using mock responses');
        return this.handleDemoMode(message, options.demoCompanyData);
      }

      // 0. ПЕРЕД ВСЕМ: Проверяем ответ на напоминание (должно быть ДО вызова AI)
      const reminderResult = await reminderResponseHandler.handleResponse(
        phone,
        message,
        options.messageId // передаем messageId для реакции
      );

      if (reminderResult.confirmed) {
        // Клиент подтвердил визит - возвращаем короткий ответ
        logger.info(`✅ Visit confirmed for ${phone}, sending short response`);
        return '❤️ Отлично! Ждём вас!';
      }

      // 1. Проверяем ожидающую отмену записи (через v2)
      const cleanPhone = InternationalPhone.normalize(phone) || phone.replace('@c.us', '');
      const dialogContext = await contextServiceV2.getDialogContext(cleanPhone, companyId);
      const redisContext = dialogContext ? {
        ...dialogContext,
        pendingCancellation: dialogContext.pendingAction?.type === 'cancellation'
      } : null;
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
      
      // 3. Загружаем полный контекст через новый context manager
      context = await contextManager.loadFullContext(phone, companyId);
      
      // КРИТИЧНО: Добавляем Redis контекст в полный контекст для Stage 1
      context.redisContext = redisContext;
      
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
      const prompt = this.buildSmartPrompt(message, context, phone, {
        shouldAskHowToHelp,
        isThankYouMessage
      });
      
      // Определяем имя промпта для статистики
      const promptName = process.env.AI_PROMPT_VERSION || 'enhanced-prompt';
      
      // Проверяем какой процессор использовать
      const useReAct = promptName === 'react-prompt' || process.env.USE_REACT === 'true';
      const useTwoStage = promptName === 'two-stage' || process.env.USE_TWO_STAGE === 'true';
      
      let finalResponse;
      let executedCommands = [];
      
      let commandResults = []; // Добавляем переменную для результатов команд
      
      if (useTwoStage) {
        // Используем новый двухэтапный процессор
        logger.info('🎯 Using Two-Stage processor for fast response');
        const twoStageResult = await twoStageProcessor.processTwoStage(
          message,
          context,
          this // передаем ссылку на AIAdminV2 для вызова callAI
        );
        
        finalResponse = twoStageResult.response;
        executedCommands = twoStageResult.commands;
        commandResults = twoStageResult.commandResults || []; // Сохраняем результаты команд
        
        logger.info(`✅ Two-Stage completed in 2 iterations with ${twoStageResult.metrics.totalTime}ms`);
      } else if (useReAct) {
        // Используем ReAct процессор для циклической обработки
        logger.info('Using ReAct processor for response handling');
        
        // Один вызов AI со всей информацией для ReAct
        const aiResponse = await this.callAI(prompt, {
          message: message,
          promptName: promptName
        });
        
        const reactResult = await reactProcessor.processReActCycle(
          aiResponse, 
          context,
          this, // передаем ссылку на AIAdminV2 для вызова callAI
          {
            shouldAskHowToHelp,
            isThankYouMessage
          }
        );
        
        finalResponse = reactResult.response;
        executedCommands = reactResult.commands;
        
        logger.info(`ReAct completed in ${reactResult.iterations} iterations`);
      } else {
        // Старая логика обработки
        
        // Один вызов AI со всей информацией
        const aiResponse = await this.callAI(prompt, {
          message: message,
          promptName: promptName
        });
        
        finalResponse = await this.processAIResponse(aiResponse, context);
        executedCommands = commandHandler.extractCommands(aiResponse);
      }
      
      // Создаем объект результата для совместимости
      const result = {
        success: true,
        response: finalResponse,
        executedCommands: executedCommands,
        commandResults: commandResults, // Добавляем результаты команд для сохранения контекста
        results: []
      };
      
      // Обновляем статистику с количеством выполненных команд
      if (result.executedCommands?.length > 0) {
        promptManager.recordUsage(promptName, {
          success: true,
          commandsExecuted: result.executedCommands.length
        });
      }
      
      // Обновляем промежуточный контекст после AI анализа
      // Для Two-Stage используем finalResponse, для остальных - aiResponse
      const responseForContext = useTwoStage ? finalResponse : (typeof aiResponse !== 'undefined' ? aiResponse : finalResponse);
      await intermediateContext.updateAfterAIAnalysis(phone, responseForContext, result.executedCommands || []);
      
      // НОВЫЙ ПОДХОД: Единое атомарное сохранение контекста
      const normalizedPhone = InternationalPhone.normalize(phone) || phone.replace('@c.us', '');
      
      // Собираем все данные для сохранения
      const contextUpdates = {
        userMessage: message,
        botResponse: result.response,
        state: 'active'
      };
      
      // Извлекаем информацию о выборе из команд
      if (result.executedCommands && result.executedCommands.length > 0) {
        const selection = {};
        let hasDateFromSearch = false;
        
        result.executedCommands.forEach(cmd => {
          if (cmd.params?.service_name) {
            selection.service = cmd.params.service_name;
          }
          if (cmd.params?.staff_name) {
            selection.staff = cmd.params.staff_name;
          }
          if (cmd.params?.time) {
            selection.time = cmd.params.time;
          }
          if (cmd.params?.date) {
            selection.date = cmd.params.date;
            // Особенно важно сохранить дату из SEARCH_SLOTS
            if (cmd.command === 'SEARCH_SLOTS') {
              hasDateFromSearch = true;
              logger.info(`Saving date from SEARCH_SLOTS: ${cmd.params.date}`);
            }
          }
        });
        
        if (Object.keys(selection).length > 0) {
          contextUpdates.selection = selection;
        }
        
        // Также сохраняем в старый формат для совместимости
        if (hasDateFromSearch && selection.date) {
          contextUpdates.lastDate = selection.date;
        }
      }
      
      // Сохраняем имя клиента если оно было извлечено
      if (context.client?.name && !context.client?.fromDatabase) {
        contextUpdates.clientName = context.client.name;
      }
      
      // Отслеживаем вопросы о времени записи
      if (result.response && result.response.includes('На какое время вас записать?')) {
        contextUpdates.askedForTimeSelection = true;
        contextUpdates.askedForTimeAt = new Date().toISOString();
        logger.info('📝 Detected time selection question in response');
      }
      
      // Отслеживаем показ слотов и сохраняем предложенные слоты
      if (result.executedCommands && result.executedCommands.some(cmd => 
        cmd.command === 'SEARCH_SLOTS' && cmd.success
      )) {
        contextUpdates.shownSlotsAt = new Date().toISOString();
        
        // Извлекаем и сохраняем предложенные слоты
        const searchSlotsCommand = result.executedCommands.find(cmd => 
          cmd.command === 'SEARCH_SLOTS' && cmd.success
        );
        
        if (searchSlotsCommand && searchSlotsCommand.result && searchSlotsCommand.result.data) {
          // Извлекаем время из ответа бота (это более надежно, чем брать все слоты)
          const timePattern = /(\d{1,2}:\d{2})/g;
          const mentionedTimes = result.response ? result.response.match(timePattern) : [];
          
          if (mentionedTimes && mentionedTimes.length > 0) {
            contextUpdates.proposedSlots = mentionedTimes.map(time => ({
              time,
              date: contextUpdates.lastDate || searchSlotsCommand.params?.date || 'сегодня',
              staff: searchSlotsCommand.params?.staff_name || contextUpdates.selection?.staff,
              service: searchSlotsCommand.params?.service_name || contextUpdates.selection?.service
            }));
            logger.info('📝 Saved proposed slots:', contextUpdates.proposedSlots);
          }
        }
        
        logger.info('📝 Marked slots shown at', contextUpdates.shownSlotsAt);
      }
      
      // Сбрасываем флаги после успешной записи
      if (result.executedCommands && result.executedCommands.some(cmd => 
        cmd.command === 'CREATE_BOOKING' && cmd.success
      )) {
        contextUpdates.askedForTimeSelection = false;
        contextUpdates.askedForTimeAt = null;
        contextUpdates.shownSlotsAt = null;
        contextUpdates.proposedSlots = null; // Очищаем предложенные слоты
        logger.info('📝 Reset question flags after successful booking');
      }
      
      // Единый вызов для сохранения всего контекста
      logger.info('🔥 Calling contextManager.saveContext with:', {
        phone: normalizedPhone,
        companyId,
        updates: contextUpdates
      });
      await contextManager.saveContext(normalizedPhone, companyId, contextUpdates);
      
      // Сохраняем контекст из команд (включая результаты)
      if (result.executedCommands && result.executedCommands.length > 0) {
        logger.info('🔥 Calling contextManager.saveCommandContext with:', {
          phone: normalizedPhone,
          companyId,
          commands: result.executedCommands,
          hasResults: !!result.commandResults
        });
        await contextManager.saveCommandContext(
          normalizedPhone, 
          companyId, 
          result.executedCommands,
          result.commandResults
        );
        
        // Дополнительно сохраняем дату в старом формате для совместимости
        const dateCommand = result.executedCommands.find(cmd => 
          cmd.params?.date && (cmd.command === 'SEARCH_SLOTS' || cmd.command === 'CREATE_BOOKING')
        );
        
        if (dateCommand) {
          logger.info(`Date synchronized to context: ${dateCommand.params.date}`);
        }
      }
      
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
  buildSmartPrompt(message, context, phone, options = {}) {
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
      intermediateContext: context.intermediateContext || null,
      
      // Опции управления диалогом
      conversationOptions: {
        shouldAskHowToHelp: options.shouldAskHowToHelp || false,
        isThankYouMessage: options.isThankYouMessage || false
      }
    };
    
    // Получаем промпт из менеджера
    let basePrompt;
    const promptVersion = process.env.AI_PROMPT_VERSION || 
                         (process.env.USE_REACT === 'true' ? 'react-prompt' : 'personalized-prompt');
    
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
   */
  async processAIResponse(aiResponse, context) {
    logger.info('Processing AI response...');
    
    // Полное логирование ответа AI для отладки
    if (aiResponse) {
      const preview = aiResponse.substring(0, 1000);
      logger.info('🤖 AI full response:', { 
        preview,
        totalLength: aiResponse.length,
        hasCommands: aiResponse.includes('['),
        firstBracket: aiResponse.indexOf('['),
        sample: aiResponse.substring(0, 200)
      });
    } else {
      logger.warn('⚠️ AI response is empty or null');
    }
    
    // Извлекаем команды из ответа
    const commands = commandHandler.extractCommands(aiResponse);
    
    // Логируем извлеченные команды
    if (commands && commands.length > 0) {
      logger.info(`📋 Extracted ${commands.length} commands:`, commands.map(c => c.command));
    } else {
      logger.warn('⚠️ No commands extracted from AI response');
    }
    
    const cleanResponse = commandHandler.removeCommands(aiResponse);
    
    // Выполняем команды
    const results = await commandHandler.executeCommands(commands, context);
    
    // Формируем финальный ответ
    let finalResponse = cleanResponse;
    
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
    
    // Обрабатываем результаты CHECK_STAFF_SCHEDULE
    const staffScheduleResults = results.filter(r => r.type === 'staff_schedule');
    if (staffScheduleResults.length > 0) {
      const scheduleResult = staffScheduleResults[0].data;
      if (scheduleResult.success) {
        // Проверяем конкретного мастера, если искали его
        if (scheduleResult.targetStaff) {
          if (!scheduleResult.targetStaff.isWorking) {
            // Мастер не работает - AI должен предложить альтернативы
            logger.info('Target staff is not working:', scheduleResult.targetStaff);
          }
        } else if (scheduleResult.working?.length > 0) {
          // Показываем только тех, кто работает
          const workingNames = scheduleResult.working.join(', ');
          
          // Добавляем информацию только если она еще не в ответе
          if (!finalResponse.includes(workingNames)) {
            finalResponse += `\n\n${scheduleResult.formattedDate} работают: ${workingNames}.`;
          }
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
      const phone = InternationalPhone.normalize(context.phone) || context.phone.replace('@c.us', '');
      
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
