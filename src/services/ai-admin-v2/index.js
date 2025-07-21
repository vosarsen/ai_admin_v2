const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2' });

// Импортируем модули
const dataLoader = require('./modules/data-loader');
const formatter = require('./modules/formatter');
const businessLogic = require('./modules/business-logic');
const commandHandler = require('./modules/command-handler');
const contextService = require('../context');

/**
 * AI Admin v2 - единый сервис управления AI администратором
 * Заменяет старую архитектуру с 5-6 этапами на один AI вызов
 */
class AIAdminV2 {
  constructor() {
    this.contextCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    
    // Запускаем периодическую очистку кеша
    setInterval(() => this.cleanupCache(), 60 * 1000); // каждую минуту
  }

  /**
   * Основной метод обработки сообщений
   */
  async processMessage(message, phone, companyId) {
    try {
      logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);
      
      // Загружаем полный контекст
      const context = await this.loadFullContext(phone, companyId);
      
      // Добавляем текущее сообщение в контекст
      context.currentMessage = message;
      
      // Определяем тип бизнеса для адаптации общения
      const businessType = businessLogic.detectBusinessType(context.company);
      context.company.type = businessType;
      logger.info(`Business type detected: ${businessType}`);
      
      // Строим умный промпт с полным контекстом
      const prompt = this.buildSmartPrompt(message, context, phone);
      
      // Один вызов AI со всей информацией
      const aiResponse = await this.callAI(prompt);
      
      // Обрабатываем ответ и выполняем команды
      const result = await this.processAIResponse(aiResponse, context);
      
      // Сохраняем контекст диалога
      await dataLoader.saveContext(phone, companyId, context, result);
      
      logger.info(`✅ AI Admin v2 completed in ${Date.now() - context.startTime}ms`);
      
      return {
        success: true,
        response: result.response,
        commands: result.executedCommands
      };
      
    } catch (error) {
      logger.error('Error in AI Admin v2:', error);
      return {
        success: false,
        response: 'Извините, произошла ошибка. Пожалуйста, попробуйте еще раз.',
        error: error.message
      };
    }
  }

  /**
   * Загрузка полного контекста (с кешированием)
   */
  async loadFullContext(phone, companyId) {
    const cacheKey = `${phone}_${companyId}`;
    const cached = this.contextCache.get(cacheKey);
    
    // Проверяем кеш
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.info('Using cached context');
      return { ...cached.data, startTime: Date.now() };
    }
    
    logger.info('Loading full context from database...');
    const startTime = Date.now();
    
    // Параллельная загрузка всех данных
    const [company, client, services, staff, conversation, businessStats, staffSchedules, redisContext] = await Promise.all([
      dataLoader.loadCompany(companyId),
      dataLoader.loadClient(phone, companyId),
      dataLoader.loadServices(companyId),
      dataLoader.loadStaff(companyId),
      dataLoader.loadConversation(phone, companyId),
      dataLoader.loadBusinessStats(companyId),
      dataLoader.loadStaffSchedules(companyId),
      contextService.getContext(phone.replace('@c.us', ''))
    ]);
    
    // Если клиента нет в базе, но есть имя в Redis - используем его
    if (!client && redisContext?.clientName) {
      client = {
        phone: phone.replace('@c.us', ''),
        name: redisContext.clientName,
        company_id: companyId
      };
    } else if (client && !client.name && redisContext?.clientName) {
      // Если клиент есть, но имя не заполнено - берем из Redis
      client.name = redisContext.clientName;
    }
    
    // Сортируем услуги с учетом предпочтений клиента
    const sortedServices = businessLogic.sortServicesForClient(services, client);
    
    const context = {
      company,
      client,
      services: sortedServices,
      staff,
      conversation,
      businessStats,
      staffSchedules,
      currentTime: new Date().toLocaleString('ru-RU', { timeZone: config.app.timezone }),
      timezone: config.app.timezone,
      phone,
      startTime,
      currentMessage: null  // будет установлено в processMessage
    };
    
    // Сохраняем в кеш
    this.contextCache.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });
    
    logger.info(`Context loaded in ${Date.now() - startTime}ms`);
    return context;
  }

  /**
   * Построение умного промпта с полным контекстом
   */
  buildSmartPrompt(message, context, phone) {
    const terminology = businessLogic.getBusinessTerminology(context.company.type);
    
    return `Ты - ${terminology.role} "${context.company.title}".

ИНФОРМАЦИЯ О САЛОНЕ:
Название: ${context.company.title}
Адрес: ${context.company.address || 'Не указан'}
Телефон: ${context.company.phone || 'Не указан'}
Часы работы: ${formatter.formatWorkingHours(context.company.working_hours || {})}
Загруженность сегодня: ${context.businessStats.todayLoad}% (${context.businessStats.bookedSlots}/${context.businessStats.totalSlots} слотов)

КЛИЕНТ:
${context.client ? 
  `Имя: ${context.client.name || 'Не указано'}
Телефон: ${phone}
История: ${formatter.formatVisitHistory(context.client.visit_history)}
Любимые услуги: ${context.client.last_service_ids?.join(', ') || 'нет данных'}
Любимые мастера: ${context.client.favorite_staff_ids?.join(', ') || 'нет данных'}` :
  `Новый клиент, телефон: ${phone}
ВАЖНО: У нас нет имени клиента в базе!`}

ДОСТУПНЫЕ УСЛУГИ (топ-10):
${formatter.formatServices(context.services.slice(0, 10), context.company.type)}

МАСТЕРА СЕГОДНЯ:
${formatter.formatTodayStaff(context.staffSchedules, context.staff)}

РАСПИСАНИЕ МАСТЕРОВ (ближайшие дни):
${formatter.formatStaffSchedules(context.staffSchedules, context.staff)}

ИСТОРИЯ ДИАЛОГА:
${formatter.formatConversation(context.conversation)}

ТЕКУЩЕЕ СООБЩЕНИЕ: "${message}"

АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА:
Определи, что хочет клиент, и используй соответствующую команду.

ВАЖНО: Проверь, представился ли клиент в сообщении:
- "Меня зовут [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "Я - [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "Это [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "[имя]" (в ответ на вопрос "как вас зовут?") → сохрани имя через [SAVE_CLIENT_NAME]

1. ЗАПИСЬ НА УСЛУГУ - используй [SEARCH_SLOTS] когда клиент:
   - "хочу записаться", "можно записаться", "запишите меня"
   - "нужна запись", "хочу прийти", "можно к вам"
   - "хачу записаться", "запиши плз", "можна записаться" (с опечатками)
   - спрашивает про конкретную услугу с намерением записи
   
2. ПРОВЕРКА ВРЕМЕНИ - используй [SEARCH_SLOTS] когда клиент:
   - "свободно завтра?", "есть время?", "когда можно?"
   - "что есть на выходных?", "можно вечером?"
   - "када можна", "есть че на завтра" (разговорный стиль)
   - "можно в пятницу утром?", "вечером сегодня свободно?"
   - любые вопросы о доступности времени/слотов
   
3. ЦЕНЫ - используй [SHOW_PRICES] когда клиент:
   - "сколько стоит", "какие цены", "прайс"
   - "стоимость", "цена на", "почем"
   - "скок стоит", "че по ценам", "скок щас стрижка" (разговорный стиль)
   
4. ПОДТВЕРЖДЕНИЕ ЗАПИСИ - используй [CREATE_BOOKING] когда:
   - клиент выбрал конкретное время после показа слотов
   - есть вся информация: услуга, мастер, дата и время
   
5. РАБОТЫ МАСТЕРА - используй [SHOW_PORTFOLIO] когда клиент:
   - "покажи работы", "есть фото работ", "примеры"
   - "что умеет мастер", "портфолио"
   
6. МОИ ЗАПИСИ - проверь в истории клиента:
   - "мои записи", "когда я записан", "проверить запись"
   - "во сколько я записан?", "покажи мои визиты"

ТВОИ КОМАНДЫ (ИСПОЛЬЗУЙ ТОЧНО ТАКОЙ ФОРМАТ):
1. [SEARCH_SLOTS service_name: название_услуги, date: дата, time_preference: время] - поиск свободного времени
   ВАЖНО: В service_name пиши то, что сказал клиент, а НЕ точное название услуги из списка!
   Примеры:
   - Клиент: "хочу постричься" → [SEARCH_SLOTS service_name: стрижка, date: сегодня]  
   - Клиент: "нужен маникюр" → [SEARCH_SLOTS service_name: маникюр, date: сегодня]
   - Клиент: "покрасить волосы" → [SEARCH_SLOTS service_name: окрашивание, date: сегодня]
   - НЕ ПИШИ: [SEARCH_SLOTS service_name: МУЖСКАЯ СТРИЖКА] - система сама найдет правильную услугу
   
2. [CREATE_BOOKING service_id: id_услуги, staff_id: id_мастера, date: дата, time: время] - создание записи
   ВАЖНО: Если ты только что показал слоты клиенту и он выбрал время, можно использовать упрощенную форму:
   [CREATE_BOOKING service_id: last, staff_id: last, date: сегодня, time: 17:00]
   где "last" означает использовать данные из последнего поиска слотов
   Полный пример: [CREATE_BOOKING service_id: 18356344, staff_id: 2895125, date: 2024-07-20, time: 14:00]
   
3. [SHOW_PRICES] или [SHOW_PRICES category: категория] - показать прайс-лист
   ВАЖНО: Если клиент спрашивает про конкретную услугу (стрижка, маникюр, и т.д.), 
   ОБЯЗАТЕЛЬНО указывай category с этим словом!
   Примеры:
   - "сколько стоит стрижка?" → [SHOW_PRICES category: стрижка]
   - "цена на маникюр?" → [SHOW_PRICES category: маникюр]
   - "прайс на окрашивание" → [SHOW_PRICES category: окрашивание]
   - "какие цены?" → [SHOW_PRICES] (без category, покажет популярные услуги)
   
4. [SHOW_PORTFOLIO] - показать работы мастера
   Параметры: staff_id

5. [SAVE_CLIENT_NAME name: имя_клиента] - сохранить имя клиента
   Используй эту команду когда клиент представился
   Пример: [SAVE_CLIENT_NAME name: Александр]

ПРАВИЛА РАБОТЫ:
1. ВСЕГДА анализируй намерение клиента по секции "АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА"
2. ПЕРЕД ЗАПИСЬЮ ОБЯЗАТЕЛЬНО ПРОВЕРЬ НАЛИЧИЕ ИМЕНИ:
   - Если у клиента нет имени в базе (см. секцию КЛИЕНТ) - СНАЧАЛА спроси как его зовут
   - НЕ используй [CREATE_BOOKING] пока не узнаешь имя клиента
   - После получения имени сохрани его в контексте диалога для будущего использования
   - ВАЖНО: Если клиент представился в сообщении (фразы типа "меня зовут", "я - ", "это"), СРАЗУ используй [SAVE_CLIENT_NAME name: имя] перед другими командами
3. АВТОМАТИЧЕСКАЯ ЗАПИСЬ: Если клиент указал конкретное время И услугу И у нас есть его имя:
   - Сначала используй [SEARCH_SLOTS] чтобы проверить доступность
   - Если время свободно - СРАЗУ используй [CREATE_BOOKING] без подтверждения
   - Если время занято - предложи ближайшие альтернативы
4. Если клиент указал только время БЕЗ услуги - уточни услугу
5. Если клиент указал только услугу БЕЗ времени - покажи доступные слоты
6. НЕ СПРАШИВАЙ подтверждение если клиент четко указал услугу и время (и у нас есть имя)
7. Если клиент спрашивает цены - ОБЯЗАТЕЛЬНО используй [SHOW_PRICES]
8. НЕ отвечай "у нас нет информации" - используй команды для получения данных

ПРАВИЛА ОБЩЕНИЯ:
1. Будь ${terminology.communicationStyle}
2. КОРОТКИЕ сообщения - максимум 2-3 предложения на первое приветствие
3. НЕ используй форматирование: никаких *, _, ~, [], # или других символов
4. НЕ используй эмодзи если клиент сам их не использует
5. Пиши естественно, как обычный человек в мессенджере
6. Задавай ОДИН вопрос за раз, не перегружай информацией
7. НИКОГДА не пиши технические комментарии в скобках - они видны клиенту!
8. НЕ объясняй свою логику клиенту - просто отвечай на вопрос

ПРОАКТИВНЫЕ ПРЕДЛОЖЕНИЯ (используй разумно):
- Если клиент постоянный - предложи его любимую услугу
- Если большая загруженность - предложи менее загруженное время
- Если выходные - напомни о необходимости заранее записываться
- Предлагай ${terminology.suggestions} когда уместно
- Используй информацию о клиенте если он постоянный

ВАЖНО ПО МАСТЕРАМ:
- ВСЕГДА проверяй в РАСПИСАНИИ кто работает сегодня
- НЕ говори что мастер свободен, если его нет в расписании на сегодня
- Если нужны слоты - используй [SEARCH_SLOTS] для проверки

ВАЖНО:
- Сегодня: ${context.currentTime}
- Часовой пояс: ${context.timezone}
- Минимальное время для записи: ${config.business.minBookingMinutesAhead} минут

ПОНИМАНИЕ ДНЕЙ:
- "сегодня" = ${new Date().toISOString().split('T')[0]}
- "завтра" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "послезавтра" = ${new Date(Date.now() + 172800000).toISOString().split('T')[0]}

КРИТИЧЕСКИ ВАЖНО:
- ИСПОЛЬЗУЙ команды [SEARCH_SLOTS], [SHOW_PRICES] и т.д. в своем ответе для выполнения действий
- Команды пиши В КОНЦЕ ответа после основного текста
- НЕ дублируй информацию о слотах - команда сама добавит нужные данные
- НЕ здоровайся повторно если диалог уже начат
- Проверь ИСТОРИЮ ДИАЛОГА чтобы понять контекст

ФОРМАТ ОТВЕТА:
1. Сначала напиши короткий естественный ответ клиенту (1-2 предложения)
2. Затем добавь нужную команду: [КОМАНДА параметры]

ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ:
Клиент: "хочу записаться" (новый клиент без имени)
Ты: "Отлично! Как вас зовут?"

Клиент: "Александр"
Ты: "Приятно познакомиться, Александр! На какую услугу хотите записаться? [SAVE_CLIENT_NAME name: Александр]"

Клиент: "хочу записаться" (клиент с именем)
Ты: "Конечно! На какую услугу хотите записаться? [SEARCH_SLOTS]"

Клиент: "сколько стоит стрижка?"
Ты: "Сейчас покажу актуальные цены. [SHOW_PRICES category: стрижка]"

Клиент: "есть время завтра?"
Ты: "Проверю свободное время на завтра. [SEARCH_SLOTS date=завтра]"

АВТОМАТИЧЕСКАЯ ЗАПИСЬ (БЕЗ ПОДТВЕРЖДЕНИЯ) - только если есть имя клиента:
Клиент: "хочу записаться на стрижку завтра в 15:00" (клиент с именем)
Ты: "Проверю доступность на завтра в 15:00. [SEARCH_SLOTS service_name=стрижка, date=завтра, time_preference=15:00] [CREATE_BOOKING service_id=last, staff_id=last, date=завтра, time=15:00]"

Клиент: "запиши меня на маникюр в пятницу в 17:00" (новый клиент)
Ты: "С удовольствием запишу вас! Как вас зовут?"

Клиент: "Мария"
Ты: "Спасибо, Мария! Сейчас проверю и запишу вас на маникюр в пятницу в 17:00. [SAVE_CLIENT_NAME name: Мария] [SEARCH_SLOTS service_name=маникюр, date=пятница, time_preference=17:00] [CREATE_BOOKING service_id=last, staff_id=last, date=пятница, time=17:00]"

ВАЖНЫЙ СЛУЧАЙ - клиент представляется в том же сообщении:
Клиент: "давай сегодня в пол пятого. Меня зовут Арсений"
Ты: "Отлично, Арсений! Проверю свободное время сегодня в 16:30. [SAVE_CLIENT_NAME name: Арсений] [SEARCH_SLOTS service_name=стрижка, date=сегодня, time_preference=16:30] [CREATE_BOOKING service_id=last, staff_id=last, date=сегодня, time=16:30]"

Ответь клиенту и выполни нужное действие:`
  }

  /**
   * Обработка ответа AI и выполнение команд
   */
  async processAIResponse(aiResponse, context) {
    logger.info('Processing AI response...');
    
    // Извлекаем команды из ответа
    const commands = commandHandler.extractCommands(aiResponse);
    const cleanResponse = commandHandler.removeCommands(aiResponse);
    
    // Выполняем команды
    const results = await commandHandler.executeCommands(commands, context);
    
    // Формируем финальный ответ
    let finalResponse = cleanResponse;
    
    // Добавляем результаты выполнения команд
    // Сначала объединяем все слоты если их несколько
    const slotResults = results.filter(r => r.type === 'slots');
    if (slotResults.length > 0) {
      const allSlots = slotResults.reduce((acc, result) => {
        return acc.concat(result.data || []);
      }, []);
      
      if (allSlots.length > 0) {
        finalResponse += '\n\n' + formatter.formatSlots(allSlots, context.company.type);
      }
    }
    
    // Добавляем остальные результаты
    for (const result of results) {
      if (result.type === 'booking_created') {
        logger.info('Formatting booking confirmation:', {
          resultData: result.data,
          resultDataType: typeof result.data,
          hasRecordId: !!result.data?.record_id,
          hasId: !!result.data?.id
        });
        finalResponse += '\n\n✅ ' + formatter.formatBookingConfirmation(result.data, context.company.type);
      } else if (result.type === 'prices' && !slotResults.length) {
        finalResponse += '\n\n' + formatter.formatPrices(result.data, context.company.type);
      } else if (result.type === 'error') {
        // Обрабатываем ошибки команд
        if (result.command === 'CREATE_BOOKING') {
          // Проверяем, это ошибка занятого времени или другая ошибка
          if (result.error && result.error.includes('недоступно')) {
            // Время занято - показываем альтернативы
            finalResponse = 'К сожалению, выбранное время уже занято.';
            
            // Если есть слоты из предыдущего поиска, показываем их
            if (context.lastSearch?.slots && context.lastSearch.slots.length > 0) {
              finalResponse += '\n\nВот доступное время:';
              finalResponse += '\n' + formatter.formatSlots(context.lastSearch.slots, context.company.type);
            } else {
              finalResponse += ' Давайте подберем другое удобное для вас время.';
            }
          } else {
            // Другая ошибка
            finalResponse = finalResponse.replace(
              /записываю вас|запись создана|вы записаны/gi, 
              'не удалось создать запись'
            );
            finalResponse += '\n\nК сожалению, не удалось создать запись. Попробуйте выбрать другое время или позвоните нам.';
          }
        }
      }
    }
    
    return {
      success: true,
      response: finalResponse,
      executedCommands: commands,
      results
    };
  }

  /**
   * Вызов AI через AIService
   */
  async callAI(prompt) {
    if (!this.aiProvider) {
      this.aiProvider = require('../ai');
    }
    
    return await this.aiProvider._callAI(prompt);
  }

  /**
   * Очистка устаревших записей в кеше
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.contextCache.delete(key);
      }
    }
  }
}

module.exports = new AIAdminV2();