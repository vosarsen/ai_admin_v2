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
    this.responseFormatter = formatter; // Добавляем форматтер
    
    // Запускаем периодическую очистку кеша
    setInterval(() => this.cleanupCache(), 60 * 1000); // каждую минуту
  }

  /**
   * Основной метод обработки сообщений
   */
  async processMessage(message, phone, companyId) {
    try {
      logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);
      
      // Проверяем, есть ли ожидающая отмена
      const contextService = require('../context');
      const redisContext = await contextService.getContext(phone.replace('@c.us', ''));
      
      if (redisContext?.pendingCancellation) {
        // Пробуем интерпретировать сообщение как номер записи
        const selectedNumber = parseInt(message.trim());
        
        if (!isNaN(selectedNumber) && selectedNumber > 0 && selectedNumber <= redisContext.pendingCancellation.length) {
          // Получаем выбранную запись
          const selectedBooking = redisContext.pendingCancellation[selectedNumber - 1];
          
          // Отменяем запись
          const cancelResult = await bookingService.cancelBooking(selectedBooking.id, companyId);
          
          // Очищаем состояние ожидания
          delete redisContext.pendingCancellation;
          await contextService.setContext(phone.replace('@c.us', ''), redisContext);
          
          if (cancelResult.success) {
            return `✅ Запись успешно отменена!\n\n${selectedBooking.date} в ${selectedBooking.time}\n${selectedBooking.services}\nМастер: ${selectedBooking.staff}\n\nЕсли захотите записаться снова - обращайтесь! 😊`;
          } else {
            return `❌ Не удалось отменить запись: ${cancelResult.error}\n\nПопробуйте позже или свяжитесь с администратором.`;
          }
        }
        
        // Если ввели не номер или неправильный номер - продолжаем обычную обработку
        // но очищаем состояние ожидания
        delete redisContext.pendingCancellation;
        await contextService.setContext(phone.replace('@c.us', ''), redisContext);
      }
      
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
        commands: result.executedCommands,
        executedCommands: result.executedCommands,
        results: result.results
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
    const [
      company, 
      clientFromDb, 
      services, 
      staff, 
      conversation, 
      businessStats, 
      staffSchedules, 
      redisContext,
      preferences,
      conversationSummary
    ] = await Promise.all([
      dataLoader.loadCompany(companyId),
      dataLoader.loadClient(phone, companyId),
      dataLoader.loadServices(companyId),
      dataLoader.loadStaff(companyId),
      dataLoader.loadConversation(phone, companyId),
      dataLoader.loadBusinessStats(companyId),
      dataLoader.loadStaffSchedules(companyId),
      contextService.getContext(phone.replace('@c.us', ''), companyId),
      contextService.getPreferences(phone.replace('@c.us', ''), companyId),
      contextService.getConversationSummary(phone.replace('@c.us', ''), companyId)
    ]);
    
    // Логируем что загрузилось из Redis
    logger.info('Redis context loaded:', {
      hasRedisContext: !!redisContext,
      hasClient: !!redisContext?.client,
      clientName: redisContext?.clientName,
      clientFromContext: redisContext?.client
    });
    
    // Если клиента нет в базе, но есть имя в Redis - используем его
    let client = clientFromDb;
    const clientNameFromRedis = redisContext?.client?.name || redisContext?.clientName;
    if (!client && clientNameFromRedis) {
      client = {
        phone: phone.replace('@c.us', ''),
        name: clientNameFromRedis,
        company_id: companyId
      };
      logger.info('Using client name from Redis:', { name: clientNameFromRedis });
    } else if (client && !client.name && clientNameFromRedis) {
      // Если клиент есть, но имя не заполнено - берем из Redis
      client = { ...client, name: clientNameFromRedis };
      logger.info('Updated client name from Redis:', { name: clientNameFromRedis });
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
      currentMessage: null,  // будет установлено в processMessage
      preferences: preferences || {},
      conversationSummary: conversationSummary || {},
      canContinueConversation: conversationSummary?.canContinue || false,
      isReturningClient: conversationSummary?.hasHistory || false
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
    
    // Добавляем информацию о продолжении диалога
    let continuationInfo = '';
    if (context.canContinueConversation && context.conversationSummary?.recentMessages?.length > 0) {
      continuationInfo = `
ВАЖНО: Это продолжение прерванного диалога. Последние сообщения:
${context.conversationSummary.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Учти контекст предыдущего разговора при ответе.
`;
    }
    
    // Добавляем информацию о предпочтениях
    let preferencesInfo = '';
    if (context.preferences && Object.keys(context.preferences).length > 0) {
      preferencesInfo = `
ПРЕДПОЧТЕНИЯ КЛИЕНТА:
${context.preferences.favoriteService ? `- Любимая услуга: ${context.preferences.favoriteService}` : ''}
${context.preferences.favoriteStaff ? `- Предпочитаемый мастер: ${context.preferences.favoriteStaff}` : ''}
${context.preferences.preferredTime ? `- Предпочитаемое время: ${context.preferences.preferredTime}` : ''}
${context.preferences.notes ? `- Заметки: ${context.preferences.notes}` : ''}
`;
    }
    
    return `Ты - ${terminology.role} "${context.company.title}".
${continuationInfo}
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
Любимые мастера: ${context.client.favorite_staff_ids?.join(', ') || 'нет данных'}
ВАЖНО: Клиент УЖЕ ИЗВЕСТЕН! НЕ спрашивай как его зовут! Используй имя из базы!` :
  `Новый клиент, телефон: ${phone}
ВАЖНО: У нас нет имени клиента в базе! Спроси имя при создании записи!`}
${preferencesInfo}

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

🔴 КРИТИЧЕСКИ ВАЖНО - ПРОВЕРЬ СЕКЦИЮ "КЛИЕНТ":
- Если там есть имя (не "Не указано") → НИКОГДА НЕ СПРАШИВАЙ как зовут!
- Используй имя из базы при общении: "Здравствуйте, {имя}!"
- Если имени нет → спроси ТОЛЬКО при создании записи

🔴 ПРИОРИТЕТ #1 - ПЕРЕНОС ЗАПИСИ:
Если клиент упоминает слова: "перенести", "изменить время", "другое время", "другой день", "не подходит время"
→ СРАЗУ используй [RESCHEDULE_BOOKING], НЕ CHECK_STAFF_SCHEDULE!

⚠️ САМОЕ ВАЖНОЕ - ПЕРВЫМ ДЕЛОМ ПРОВЕРЬ:

1. Проверь ИСТОРИЮ ДИАЛОГА:
- Если в предыдущем твоем сообщении есть [CHECK_STAFF_SCHEDULE] → НЕ говори про проверку снова!
- Если ты уже сказал "проверю расписание" → НЕ повторяй это!
- Сразу переходи к следующему шагу (сохранение имени, создание записи и т.д.)

2. Указал ли клиент КОНКРЕТНОЕ ВРЕМЯ? 
- Примеры: "в 15:00", "в 16:00", "в три часа", "давайте в 4", "на 3 часа дня"
- Если ДА → это ЗАПИСЬ НА КОНКРЕТНОЕ ВРЕМЯ!
- Если ДА и есть УСЛУГА и ИМЯ → используй [CREATE_BOOKING], НЕ [SEARCH_SLOTS]!
- Если ДА и есть УСЛУГА, но нет ИМЕНИ → спроси имя, затем [CREATE_BOOKING]!
- НИКОГДА НЕ ПОКАЗЫВАЙ СЛОТЫ ЕСЛИ ВРЕМЯ УЖЕ УКАЗАНО!

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО О ВРЕМЕНИ:
- "давайте в 4" = клиент указал КОНКРЕТНОЕ ВРЕМЯ (16:00)
- "в 3 часа" = клиент указал КОНКРЕТНОЕ ВРЕМЯ (15:00)
- "на 10 утра" = клиент указал КОНКРЕТНОЕ ВРЕМЯ (10:00)
- ЕСЛИ ЕСТЬ КОНКРЕТНОЕ ВРЕМЯ → НЕ ПОКАЗЫВАЙ СЛОТЫ!
- ЕСЛИ ЕСТЬ КОНКРЕТНОЕ ВРЕМЯ → ИСПОЛЬЗУЙ [CREATE_BOOKING]!

ВАЖНО: Если клиент хочет записаться и указал:
- Имя мастера (например "к Сергею")
- Время (например "в 16:30", "давайте в 4", "на 10 утра")
- С датой или без даты

Тогда:
1. Сохрани имя клиента если он представился
2. Если дата НЕ указана - спроси на какой день записать
3. Если дата указана И время НЕ указано - выполни [SEARCH_SLOTS] для показа слотов
4. Если дата указана И время УКАЗАНО - используй [CREATE_BOOKING] (НЕ [SEARCH_SLOTS]!)
5. НИКОГДА НЕ ГОВОРИ "у нас нет мастера" без проверки
6. НЕ ПОКАЗЫВАЙ СЛОТЫ если клиент УЖЕ СКАЗАЛ КОНКРЕТНОЕ ВРЕМЯ!
7. ПОМНИ КОНТЕКСТ - если клиент уже сказал услугу (например "стрижка"), НЕ спрашивай снова!
8. Используй простое слово из контекста - если клиент сказал "стричься", используй "стрижка"
9. ВСЕГДА читай ИСТОРИЮ ДИАЛОГА - если клиент уже сказал услугу в предыдущих сообщениях, НЕ спрашивай повторно
10. После CHECK_STAFF_SCHEDULE - сообщи результат и продолжай с той услугой, которую клиент уже назвал

РАСПОЗНАВАНИЕ УСЛУГ В СООБЩЕНИИ:
- "на стрижку" = услуга: стрижка
- "стричься" = услуга: стрижка
- "подстричься" = услуга: стрижка
- "подстричь волосы" = услуга: стрижка
- "на маникюр" = услуга: маникюр
- "ногти сделать" = услуга: маникюр
- "на педикюр" = услуга: педикюр
ВАЖНО: Если клиент упомянул услугу ЛЮБЫМ способом - НЕ СПРАШИВАЙ "какую услугу?"!

ВАЖНО: Проверь, представился ли клиент в сообщении:
- "Меня зовут [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "Я [имя]" (например: "я Арсен", "я Мария") → сохрани имя через [SAVE_CLIENT_NAME]
- "Я - [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "Это [имя]" → сохрани имя через [SAVE_CLIENT_NAME]
- "[имя]" (в ответ на вопрос "как вас зовут?") → сохрани имя через [SAVE_CLIENT_NAME]

ВСЕГДА сохраняй имя клиента, если он представился в любой форме!

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
   
7. ОТМЕНА ЗАПИСИ - используй [CANCEL_BOOKING] когда клиент:
   - "отменить запись", "отменить визит"
   - "удалить запись", "снять запись"
   - "отмена", "отменяю" (в контексте записи)
   
8. ПОДТВЕРЖДЕНИЕ ЗАПИСИ - используй [CONFIRM_BOOKING] когда клиент:
   - "подтверждаю запись", "подтверждаю", "да, приду"
   - "буду", "жду", "до встречи" (в контексте записи)
   - "все верно", "да" (после информации о записи)
   
9. НЕЯВКА - используй [MARK_NO_SHOW] когда клиент:
   - "не смогу прийти", "не приду", "не получится"
   - "заболел", "опоздаю больше 15 минут"
   - НЕ используй для переноса - для этого есть отдельная команда

10. ПЕРЕНОС ЗАПИСИ - используй [RESCHEDULE_BOOKING] когда клиент:
   - "перенести запись", "перенести визит", "изменить время"
   - "можно перенести на", "давайте перенесем"
   - "хочу изменить дату", "нужно другое время"
   - "перенесите", "измените время", "поменять время"
   - "можно в другое время", "есть ли другое время"
   - "не подходит время", "давайте в другой день"
   - "хочу записаться на другое время/день" (если у клиента УЖЕ ЕСТЬ запись)
   ВАЖНО: если клиент говорит "не смогу прийти" и НЕ просит перенос - используй CANCEL_BOOKING
   КРИТИЧНО: При переносе НЕ ИСПОЛЬЗУЙ CHECK_STAFF_SCHEDULE! Сразу используй RESCHEDULE_BOOKING!
   КРИТИЧНО: При переносе НЕ СПРАШИВАЙ "на какую услугу" - услуги остаются те же что в существующей записи!

ТВОИ КОМАНДЫ (ИСПОЛЬЗУЙ ТОЧНО ТАКОЙ ФОРМАТ):
1. [CHECK_STAFF_SCHEDULE staff_name: имя_мастера, date: дата] - быстрая проверка работает ли мастер
   🔴 КРИТИЧЕСКИ ВАЖНО: НЕ ГОВОРИ КЛИЕНТУ О ПРОВЕРКЕ! НЕ ПИШИ "Проверяю расписание" и т.п.!
   Проверяй МОЛЧА и сразу действуй по результату:
   - Если мастер работает → продолжай запись
   - Если НЕ работает → сообщи что мастер не работает и предложи альтернативы
   
   КРИТИЧЕСКИ ВАЖНО: СНАЧАЛА ПРОВЕРЬ РАЗДЕЛ "РАСПИСАНИЕ МАСТЕРОВ"!
   - Если нужная дата ЕСТЬ в расписании → НЕ ИСПОЛЬЗУЙ эту команду, просто посмотри кто работает
   - Если нужной даты НЕТ в расписании → используй команду для проверки
   ИСПОЛЬЗУЙ ТОЛЬКО когда:
   - Клиент спрашивает про дату, которой НЕТ в разделе "РАСПИСАНИЕ МАСТЕРОВ"
   - Клиент хочет записаться к конкретному мастеру на конкретную дату
   Примеры:
   - "Сергей работает завтра?" → сначала проверь расписание, если завтра есть - ответь без команды
   - "кто работает через 2 недели?" → используй команду (такой далекой даты нет в расписании)
   
2. [SEARCH_SLOTS service_name: название_услуги, date: дата, time_preference: время] - поиск свободного времени
   ВАЖНО: В service_name пиши то, что сказал клиент, а НЕ точное название услуги из списка!
   Примеры:
   - Клиент: "хочу постричься" → [SEARCH_SLOTS service_name: стрижка, date: сегодня]  
   - Клиент: "нужен маникюр" → [SEARCH_SLOTS service_name: маникюр, date: сегодня]
   - Клиент: "покрасить волосы" → [SEARCH_SLOTS service_name: окрашивание, date: сегодня]
   - НЕ ПИШИ: [SEARCH_SLOTS service_name: МУЖСКАЯ СТРИЖКА] - система сама найдет правильную услугу
   
3. [CREATE_BOOKING service_name: название_услуги, date: дата, time: время] - создание записи
   КРИТИЧЕСКИ ВАЖНО: ВСЕГДА передавай ВСЕ параметры! НИКОГДА не используй [CREATE_BOOKING] без параметров!
   
   ⚠️ КРИТИЧЕСКИ ВАЖНО ПРО МАСТЕРОВ:
   Если клиент указал конкретного мастера (например "к Бари", "к Сергею"):
   1. СНАЧАЛА используй [CHECK_STAFF_SCHEDULE staff_name: имя, date: дата] для проверки работает ли мастер
   2. ТОЛЬКО если мастер работает - используй [CREATE_BOOKING] с параметром staff_name
   3. Если мастер НЕ работает - предложи другой день или другого мастера
   
   ОБЯЗАТЕЛЬНЫЕ параметры:
   - service_name: название услуги (стрижка, маникюр и т.д.)
   - date: дата (сегодня, завтра, 2024-07-25)
   - time: время в формате ЧЧ:ММ (15:00, 16:30)
   
   ОПЦИОНАЛЬНЫЕ параметры:
   - staff_name: имя мастера (ТОЛЬКО если проверил что работает!)
   - service_id: ID услуги (используй "last" после SEARCH_SLOTS)
   - staff_id: ID мастера (используй "last" после SEARCH_SLOTS)
   
   Примеры:
   - [CREATE_BOOKING service_name: стрижка, date: сегодня, time: 19:00]
   - [CREATE_BOOKING service_name: стрижка, staff_name: Сергей, date: завтра, time: 15:00]
   - [CREATE_BOOKING service_id: last, staff_id: last, date: сегодня, time: 17:00] (после SEARCH_SLOTS)
   
   ❌ НЕПРАВИЛЬНО: [CREATE_BOOKING] - БЕЗ параметров
   ❌ НЕПРАВИЛЬНО: [CREATE_BOOKING staff_name: Бари] - БЕЗ проверки расписания
   ✅ ПРАВИЛЬНО: Сначала [CHECK_STAFF_SCHEDULE], потом [CREATE_BOOKING]
   
   КРИТИЧЕСКИ ВАЖНО ПРО ВРЕМЯ:
   - "в 3" = 15:00 (НЕ 15:30!)
   - "в 3:30" или "в три тридцать" = 15:30
   - "в половину четвертого" = 15:30
   - "давайте в 4" = 16:00
   - "на 3 часа дня" = 15:00
   - Всегда интерпретируй "в X" как X:00, если не указаны минуты!
   
   ИСПОЛЬЗУЙ CREATE_BOOKING СРАЗУ когда клиент сказал конкретное время!
   
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

6. [CANCEL_BOOKING] или [CANCEL_BOOKING booking_id: номер_записи] - отменить запись
   Можно использовать с ID записи для прямой отмены или без ID для показа списка
   Примеры:
   - [CANCEL_BOOKING] - покажет список записей
   - [CANCEL_BOOKING booking_id: 1199065365] - отменит конкретную запись

7. [CONFIRM_BOOKING booking_id: номер_записи, visit_id: номер_визита] - подтвердить запись
   Используй когда клиент подтверждает что придет
   Примеры: "подтверждаю запись", "да, приду", "буду"
   
8. [MARK_NO_SHOW booking_id: номер_записи, visit_id: номер_визита, reason: причина] - отметить неявку
   Используй когда клиент сообщает что НЕ придет (но не хочет отменять)
   Примеры: "не смогу прийти", "опоздаю больше чем на 15 минут", "заболел"

9. [RESCHEDULE_BOOKING] или [RESCHEDULE_BOOKING date: новая_дата, time: новое_время, booking_number: номер_записи] - перенести запись
   Система автоматически проверит доступность времени перед переносом!
   ВАЖНО: НЕ СПРАШИВАЙ "на какую услугу перенести" - услуги сохраняются из существующей записи!
   ВАЖНО: НЕ ГОВОРИ "на какую услугу вам перенести запись?" - просто спроси новую дату и время!
   Примеры:
   - [RESCHEDULE_BOOKING] - покажет список записей и запросит новое время
   - [RESCHEDULE_BOOKING date: завтра, time: 15:00] - перенесет последнюю запись
   - [RESCHEDULE_BOOKING date: 29 июля, time: 16:00, booking_number: 2] - перенесет запись №2 из списка
   ВСЕГДА используй эту команду при запросе на перенос!

ПРАВИЛА РАБОТЫ:
1. ВСЕГДА анализируй намерение клиента по секции "АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА"
2. ПЕРЕД ЗАПИСЬЮ ОБЯЗАТЕЛЬНО ПРОВЕРЬ НАЛИЧИЕ ИМЕНИ:
   - Если у клиента нет имени в базе (см. секцию КЛИЕНТ) - СНАЧАЛА спроси как его зовут
   - НЕ используй [CREATE_BOOKING] пока не узнаешь имя клиента
   - После получения имени сохрани его в контексте диалога для будущего использования
   - ВАЖНО: Если клиент представился в сообщении (фразы типа "меня зовут", "я - ", "это"), СРАЗУ используй [SAVE_CLIENT_NAME name: имя] перед другими командами
3. КРИТИЧЕСКИ ВАЖНО - АВТОМАТИЧЕСКАЯ ЗАПИСЬ: 
   - ЕСЛИ клиент указал КОНКРЕТНОЕ ВРЕМЯ (например: "в 15:00", "в три часа", "в 16:00") - это КОНКРЕТНОЕ ВРЕМЯ!
   - ЕСЛИ есть КОНКРЕТНОЕ ВРЕМЯ + УСЛУГА + ИМЯ клиента = ИСПОЛЬЗУЙ [CREATE_BOOKING]
   - ЕСЛИ есть КОНКРЕТНОЕ ВРЕМЯ + УСЛУГА, но НЕТ ИМЕНИ = сначала спроси имя, потом [CREATE_BOOKING]
   - НЕ ИСПОЛЬЗУЙ [SEARCH_SLOTS] когда клиент УЖЕ СКАЗАЛ ВРЕМЯ!
   - НЕ СПРАШИВАЙ "на какое время" если клиент УЖЕ СКАЗАЛ ВРЕМЯ!
   - НЕ ПОКАЗЫВАЙ СЛОТЫ если клиент СКАЗАЛ КОНКРЕТНОЕ ВРЕМЯ!
   - Примеры КОНКРЕТНОГО времени: "в 14:00", "в два часа", "в половину третьего", "в 16:00", "на 3 часа дня"
   - Если [CREATE_BOOKING] вернул ошибку - только тогда покажи альтернативные слоты
   - ВАЖНО: Даже если клиент спросил "работает ли мастер?" и указал время - это запрос НА ЗАПИСЬ!
4. Если клиент указал только время БЕЗ услуги - уточни услугу
5. ВАЖНО О СЛОТАХ - НЕ ИСПОЛЬЗУЙ [SEARCH_SLOTS] если клиент не спрашивал о времени:
   - ИСПОЛЬЗУЙ [SEARCH_SLOTS] ТОЛЬКО при вопросах: "когда можно?", "есть время?", "покажи слоты", "когда свободно?"
   - НЕ ИСПОЛЬЗУЙ [SEARCH_SLOTS] если клиент сказал "хочу записаться на завтра" - это НЕ вопрос о времени
   - Вместо [SEARCH_SLOTS] просто спроси: "На какое время вас записать?" БЕЗ КОМАНДЫ
6. НЕ СПРАШИВАЙ подтверждение если клиент четко указал услугу и время (и у нас есть имя)
7. Если клиент спрашивает цены - ОБЯЗАТЕЛЬНО используй [SHOW_PRICES]
8. НЕ отвечай "у нас нет информации" - используй команды для получения данных

ПРАВИЛА ОБЩЕНИЯ (КРИТИЧЕСКИ ВАЖНО - ПИШИ КАК ЧЕЛОВЕК):
1. Будь ${terminology.communicationStyle}
2. РАЗДЕЛЯЙ ответы на НЕСКОЛЬКО коротких сообщений используя символ |
3. Каждое сообщение - МАКСИМУМ 1-2 предложения
4. НЕ используй форматирование: никаких *, _, ~, [], # или других символов
5. НЕ используй эмодзи если клиент сам их не использует
6. Пиши естественно, как обычный человек в мессенджере
7. ОДИН вопрос = ОДНО сообщение, не смешивай темы
8. НИКОГДА не пиши технические комментарии в скобках - они видны клиенту!
9. НЕ объясняй свою логику клиенту - просто отвечай на вопрос
10. НЕ ГОВОРИ "проверю", "сейчас проверю", "секунду" - команды выполняются мгновенно!

ПРИМЕРЫ РАЗДЕЛЕНИЯ НА СООБЩЕНИЯ:
❌ ПЛОХО: "Алексей, проверяю, работает ли Сергей сегодня на 14:00. Какую услугу вы планируете?"
✅ ХОРОШО: "Алексей, здравствуйте!|Какую услугу планируете?"

❌ ПЛОХО: "Конечно! На какую услугу хотите записаться? У нас есть стрижка, борода, укладка."
✅ ХОРОШО: "Конечно!|На какую услугу записать?"

❌ ПЛОХО: "Проверю свободное время на завтра. Какую услугу вы хотели бы?"
✅ ХОРОШО: "Какую услугу хотите?"

❌ ПЛОХО: "Спасибо, Николай! Записываю вас на стрижку завтра в 16:00."
✅ ХОРОШО: "Спасибо, Николай!|Записываю на стрижку|Завтра в 16:00"

ПРИВЕТСТВИЕ ВЕРНУВШИХСЯ КЛИЕНТОВ:
${context.isReturningClient && context.client?.name ? `
- Обращайся по имени: "${context.client.name}"
- Если это продолжение диалога в течение дня - НЕ здоровайся повторно
- Если прошло больше суток - поздоровайся кратко: "Привет, ${context.client.name}!"
${context.preferences?.favoriteService ? `- Можешь предложить любимую услугу: "${context.preferences.favoriteService}"` : ''}
${context.preferences?.favoriteStaff ? `- Можешь предложить любимого мастера: "${context.preferences.favoriteStaff}"` : ''}
${context.canContinueConversation ? '- Учти контекст предыдущего разговора при ответе' : ''}
` : ''}

ГРАММАТИКА РУССКОГО ЯЗЫКА (КРИТИЧЕСКИ ВАЖНО):
Имена в РОДИТЕЛЬНОМ падеже (у кого? чего?):
- "У Сергея свободно" (НЕ "У Сергей")
- "У Марии есть время" (НЕ "У Мария")
- "У Рамзана окна" (НЕ "У Рамзан")
- "Нет свободного времени у Бари" (НЕ "у Бари" - тут правильно, но НЕ "у Барий")

Имена в ДАТЕЛЬНОМ падеже (к кому? чему?):
- "Записать вас к Сергею" (НЕ "к Сергей")
- "К Марии на маникюр" (НЕ "к Мария")
- "Подойти к Рамзану" (НЕ "к Рамзан")

Правильные вопросы:
- "На какую услугу вас записать?" (НЕ "Какую услугу вы хотели бы записать?")
- "К какому мастеру вас записать?" (НЕ "Какого мастера вы хотели бы?")
- "На какое время вас записать?" (НЕ "Во сколько вы хотели бы записать?")

ВСЕГДА проверяй падежи имен мастеров в своих ответах!

ПРОАКТИВНЫЕ ПРЕДЛОЖЕНИЯ (используй разумно):
- Если клиент постоянный - предложи его любимую услугу
- Если большая загруженность - предложи менее загруженное время
- Если выходные - напомни о необходимости заранее записываться
- Предлагай ${terminology.suggestions} когда уместно
- Используй информацию о клиенте если он постоянный

ВАЖНО ПО МАСТЕРАМ:
- "МАСТЕРА СЕГОДНЯ" показывает ТОЛЬКО кто работает СЕГОДНЯ
- "РАСПИСАНИЕ МАСТЕРОВ" показывает кто работает в БЛИЖАЙШИЕ ДНИ
- НИКОГДА не говори "у нас нет мастера" если клиент спрашивает про другой день!
- Если клиент спрашивает "работает ли мастер" - СНАЧАЛА используй [CHECK_STAFF_SCHEDULE] для быстрой проверки
- Если мастер работает И клиент указал время - сразу используй [CREATE_BOOKING] (или спроси имя если нет)
- Если мастер работает но время НЕ указано - спроси на какое время записать
- НЕ делай выводы о доступности мастера без проверки
- Используй [SEARCH_SLOTS] только если нужно показать доступные слоты

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
2. Затем добавь нужную команду: [КОМАНДА параметры] ТОЛЬКО если это нужно
3. НЕ ДОБАВЛЯЙ КОМАНДУ если просто спрашиваешь время у клиента!


ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ (С РАЗДЕЛЕНИЕМ НА СООБЩЕНИЯ):
Клиент: "хочу записаться" (новый клиент без имени)
Ты: "Здравствуйте!|Как вас зовут?"

Клиент: "Александр"
Ты: "Приятно познакомиться, Александр!|На какую услугу записать? [SAVE_CLIENT_NAME name: Александр]"

Клиент: "хочу записаться" (клиент с именем)  
Ты: "Конечно!|На какую услугу?"

Клиент: "на стрижку"
Ты: "На какой день?"

Клиент: "на завтра" 
Ты: "На какое время?"

Клиент: "сколько стоит стрижка?"
Ты: "[SHOW_PRICES category: стрижка]"

Клиент: "есть время завтра?"
Ты: "[SEARCH_SLOTS date: завтра]"

Клиент: "Сергей работает завтра?"
Ты: "[CHECK_STAFF_SCHEDULE staff_name: Сергей, date: завтра]"

Клиент: "работает Сергей? хочу постричься у него на 3 часа дня"
Ты: "Как вас зовут? [CHECK_STAFF_SCHEDULE staff_name: Сергей, date: сегодня]"
ВАЖНО: НЕ ГОВОРИ о проверке! После выполнения CHECK_STAFF_SCHEDULE в следующем сообщении:
- Если мастер работает: просто продолжи запись без упоминания проверки
- Если НЕ работает: сказать "К сожалению, Сергей сегодня не работает" и предложить альтернативы

Клиент: "Привет! Запиши меня к Бари на воскресенье на 10 утра стричься"
Ты: "Привет!|Как вас зовут? [CHECK_STAFF_SCHEDULE staff_name: Бари, date: воскресенье]"
ВАЖНО: НЕ ГОВОРИ клиенту о проверке расписания! Проверяй молча!
Клиент: "Арсен"
ВАЖНО: CHECK_STAFF_SCHEDULE уже выполнена в предыдущем сообщении! Результат уже известен!
Если Бари работает: "Спасибо, Арсен!|Записываю к Бари|Воскресенье, 10:00 [SAVE_CLIENT_NAME name: Арсен] [CREATE_BOOKING service_name: стрижка, staff_name: Бари, date: воскресенье, time: 10:00]"
Если Бари НЕ работает: "Спасибо, Арсен!|К сожалению, Бари не работает в воскресенье|Могу предложить другого мастера? [SAVE_CLIENT_NAME name: Арсен]"

ПРАВИЛЬНАЯ ГРАММАТИКА в ответах:
✅ "У Сергея есть время завтра" (НЕ "У Сергей")
✅ "Записать вас к Марии?" (НЕ "к Мария")
✅ "На какую услугу вас записать?" (НЕ "Какую услугу вы хотели бы записать?")
✅ "В воскресенье работает мастер Сергей" (НЕ "работает мастер Сергею")

АВТОМАТИЧЕСКАЯ ЗАПИСЬ (БЕЗ ПОДТВЕРЖДЕНИЯ) - только если есть имя клиента:
Клиент: "хочу записаться на стрижку завтра в 15:00" (клиент с именем)
Ты: "Записываю на стрижку|Завтра в 15:00 [CREATE_BOOKING service_name: стрижка, date: завтра, time: 15:00]"

Клиент: "Привет! Хочу записаться на стрижку завтра в 16:00" (клиент с именем Николай)
Ты: "Привет, Николай!|Записываю на стрижку|Завтра в 16:00 [CREATE_BOOKING service_name: стрижка, date: завтра, time: 16:00]"

НЕПРАВИЛЬНО:
Клиент: "хочу записаться на стрижку завтра в 16:00"
Ты: "На какое время вас записать?" ❌ НЕПРАВИЛЬНО - клиент УЖЕ сказал время!

Клиент: "запиши меня на маникюр в пятницу в 17:00" (новый клиент)
Ты: "С удовольствием запишу вас! Как вас зовут?"

Клиент: "Мария"
Ты: "Спасибо, Мария! Записываю вас на маникюр в пятницу в 17:00. [SAVE_CLIENT_NAME name: Мария] [CREATE_BOOKING service_name: маникюр, date: пятница, time: 17:00]"

ВАЖНЫЙ СЛУЧАЙ - клиент представляется в том же сообщении:
Клиент: "давай сегодня в пол пятого. Меня зовут Арсений"
Ты: "Отлично, Арсений! Записываю вас сегодня на 16:30. [SAVE_CLIENT_NAME name: Арсений] [CREATE_BOOKING service_name: стрижка, date: сегодня, time: 16:30]"

ВАЖНЫЙ СЛУЧАЙ - клиент указал услугу и дату БЕЗ времени:
Клиент: "хочу записаться на стрижку завтра" (клиент с именем)
Ты: "На какое время вас записать завтра?" (БЕЗ КОМАНДЫ!)

ВАЖНЫЙ СЛУЧАЙ - клиент указал конкретного мастера:
Клиент: "запишите меня к Бари на завтра в 19:00 на стрижку"
Ты: "Как вас зовут? [CHECK_STAFF_SCHEDULE staff_name: Бари, date: завтра]"
ВАЖНО: НЕ ГОВОРИ "проверяю расписание"! Просто спроси имя и проверь молча!
Клиент: "Владимир"
(Если Бари работает): "Спасибо, Владимир!|Записываю вас к Бари на стрижку|Завтра в 19:00 [SAVE_CLIENT_NAME name: Владимир] [CREATE_BOOKING service_name: стрижка, staff_name: Бари, date: завтра, time: 19:00]"
(Если Бари НЕ работает): "Владимир, к сожалению Бари не работает завтра|Могу предложить другого мастера?"

КРИТИЧЕСКИЙ ПРИМЕР - запись к конкретному мастеру на конкретное время:

Вариант 1 - ИЗВЕСТНЫЙ КЛИЕНТ (есть имя в базе):
Клиент: "Запишите меня к Бари на стрижку 7 августа в 10 утра"
Ты: "Здравствуйте, {ИМЯ_ИЗ_БАЗЫ}! [CHECK_STAFF_SCHEDULE staff_name: Бари, date: 2025-08-07]"
НЕ спрашивай имя! Используй имя из секции КЛИЕНТ!
(Если Бари работает): "Записываю вас к Бари|7 августа в 10:00 [CREATE_BOOKING service_name: стрижка, staff_name: Бари, date: 2025-08-07, time: 10:00]"
(Если Бари НЕ работает): "К сожалению, Бари не работает 7 августа|Могу записать к другому мастеру или выбрать другой день?"

Вариант 2 - НОВЫЙ КЛИЕНТ (нет в базе):
Клиент: "Запишите меня к Бари на стрижку 7 августа в 10 утра"
Ты: "Здравствуйте!|Как вас зовут? [CHECK_STAFF_SCHEDULE staff_name: Бари, date: 2025-08-07]"
НЕ ГОВОРИ "проверяю работает ли Бари"! Молча проверь и действуй по результату!
Клиент: "Арсен"
(Если Бари работает): "Арсен, записываю вас к Бари|7 августа в 10:00 [SAVE_CLIENT_NAME name: Арсен] [CREATE_BOOKING service_name: стрижка, staff_name: Бари, date: 2025-08-07, time: 10:00]"
(Если Бари НЕ работает): "Арсен, к сожалению Бари не работает 7 августа|Могу записать к другому мастеру или выбрать другой день?"

Клиент: "есть время завтра на стрижку?"
Ты: "Проверю свободное время на завтра. [SEARCH_SLOTS service_name: стрижка, date: завтра]"

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО:
- Если клиент НЕ спрашивал про доступное время - НЕ ИСПОЛЬЗУЙ [SEARCH_SLOTS]
- "хочу записаться на завтра" - это НЕ вопрос о времени, просто спроси какое время удобно
- ИСПОЛЬЗУЙ [SEARCH_SLOTS] ТОЛЬКО если клиент явно спросил: "когда можно", "есть время", "покажи слоты", "когда свободно"

ОБРАБОТКА РЕЗУЛЬТАТОВ КОМАНД:

[CHECK_STAFF_SCHEDULE]:
- Команда вернет информацию о том, кто работает в указанный день
- КРИТИЧЕСКИ ВАЖНО: После выполнения команды CHECK_STAFF_SCHEDULE ВСЕГДА сообщи результат клиенту!
- Если проверял конкретного мастера:
  - Работает → "Хорошие новости! [Имя мастера] работает [дата]" и продолжай запись
  - НЕ работает → "К сожалению, [Имя мастера] не работает [дата]" и предложи альтернативы
- НЕ спрашивай повторно об услуге, если клиент уже сказал (стрижка, маникюр и т.д.)
- НЕ добавляй информацию о том, кто НЕ работает - только кто работает
- ДОВЕРЯЙ результату команды - это точные данные из расписания
- ВАЖНО: Если ты уже выполнил CHECK_STAFF_SCHEDULE в предыдущем сообщении - НЕ ПОВТОРЯЙ проверку!
- Если клиент сообщает имя после того как ты проверил расписание - сразу благодари и продолжай запись!

[SEARCH_SLOTS]:
- Если команда нашла слоты - НЕ ГОВОРИ что мастера нет!
- Если слоты найдены - покажи их клиенту
- НЕ противоречь результатам команды в своем тексте

КРИТИЧЕСКИ ВАЖНО О ФОРМАТЕ ОТВЕТА:
- Отвечай ТОЛЬКО тем, что нужно сказать клиенту
- НЕ добавляй свои внутренние размышления в ответ
- НЕ пиши в скобках свой анализ ситуации
- НЕ объясняй свою логику в ответе клиенту
- Просто отвечай на вопрос или выполняй действие
- ЗАПРЕЩЕНО писать что-то вроде "клиент не представился", "нужно узнать имя" и т.д.
- Если нужно имя - просто спроси "Как вас зовут?"
- НИКАКИХ объяснений почему ты спрашиваешь!

ФОРМАТИРОВАНИЕ WHATSAPP:
- НЕ ИСПОЛЬЗУЙ звездочки (*) для выделения текста
- НЕ ИСПОЛЬЗУЙ подчеркивания (_) или другие символы форматирования
- НЕ ИСПОЛЬЗУЙ жирный шрифт или курсив
- Пиши простым текстом как обычный человек
- Вместо *Утро:* пиши просто "Утро:"
- Вместо **текст** пиши просто "текст"

Ответь клиенту и выполни нужное действие:`
  }

  /**
   * Обработка ответа AI и выполнение команд
   */
  async processAIResponse(aiResponse, context) {
    logger.info('Processing AI response...');
    logger.debug('AI response text:', aiResponse);
    
    // Извлекаем команды из ответа
    const commands = commandHandler.extractCommands(aiResponse);
    logger.debug('Extracted commands:', commands);
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
    
    // Добавляем остальные результаты
    for (const result of results) {
      if (result.type === 'booking_created') {
        logger.info('Formatting booking confirmation:', {
          resultData: result.data,
          resultDataType: typeof result.data,
          hasRecordId: !!result.data?.record_id,
          hasId: !!result.data?.id
        });
        
        // Сохраняем информацию о записи в базу данных
        if (result.data?.record_id) {
          try {
            const { supabase } = require('../../database/supabase');
            const bookingData = {
              user_id: context.phone.replace('@c.us', ''),
              record_id: result.data.record_id,
              appointment_datetime: result.data.datetime,
              metadata: {
                record_hash: result.data.record_hash,
                service_name: result.data.service_name,
                staff_name: result.data.staff_name,
                company_id: context.company.company_id
              }
            };
            
            const { error } = await supabase
              .from('bookings')
              .insert([bookingData]);
              
            if (error) {
              logger.error('Failed to save booking to database:', error);
            } else {
              logger.info('Booking saved to database:', {
                record_id: result.data.record_id,
                user_id: bookingData.user_id
              });
            }
          } catch (error) {
            logger.error('Error saving booking to database:', error);
          }
        }
        
        finalResponse += '\n\n✅ ' + formatter.formatBookingConfirmation(result.data, context.company.type);
      } else if (result.type === 'prices' && !slotResults.length) {
        finalResponse += '\n\n' + formatter.formatPrices(result.data, context.company.type);
      } else if (result.type === 'booking_list') {
        // Проверяем, была ли это прямая отмена
        if (result.data && result.data.directCancellation) {
          if (result.data.success) {
            finalResponse += '\n\n✅ ' + result.data.message;
          } else {
            finalResponse += '\n\n❌ ' + result.data.message;
          }
        } else if (result.data && result.data.bookings && result.data.bookings.length > 0) {
          // Форматируем список записей для отмены
          finalResponse += '\n\n📅 Ваши активные записи:\n';
          result.data.bookings.forEach(booking => {
            finalResponse += `\n${booking.index}. ${booking.date} в ${booking.time}`;
            finalResponse += `\n   Услуга: ${booking.services}`;
            finalResponse += `\n   Мастер: ${booking.staff}`;
            if (booking.price > 0) {
              finalResponse += `\n   Стоимость: ${booking.price} руб.`;
            }
          });
          finalResponse += '\n\nНапишите номер записи, которую хотите отменить.';
          
          // Сохраняем список записей в контекст для последующей обработки
          const contextService = require('../context');
          const redisContext = await contextService.getContext(context.phone.replace('@c.us', ''));
          redisContext.pendingCancellation = result.data.bookings;
          await contextService.setContext(context.phone.replace('@c.us', ''), redisContext);
        } else if (result.data && result.data.message) {
          finalResponse += '\n\n' + result.data.message;
        } else {
          finalResponse += '\n\nНе удалось получить список записей. Попробуйте позже.';
        }
      } else if (result.type === 'booking_rescheduled') {
        // Обработка результата переноса записи
        if (result.data && result.data.permissionError) {
          // Ошибка прав доступа - запись создана через другой канал
          finalResponse += '\n\n' + result.data.error;
          // Убираем лишний текст с инструкциями
        } else if (result.data && result.data.temporaryLimitation) {
          // Временное ограничение API
          finalResponse += '\n\n' + result.data.message;
          if (result.data.instructions && result.data.instructions.length > 0) {
            finalResponse += '\n\nВы можете:';
            result.data.instructions.forEach(instruction => {
              finalResponse += '\n' + instruction;
            });
          }
        } else if (result.data && result.data.success) {
          // Успешный перенос
          const formatter = this.responseFormatter;
          const formattedResult = formatter.formatRescheduleConfirmation(result.data);
          if (formattedResult && formattedResult !== '') {
            finalResponse += '\n\n' + formattedResult;
          } else {
            finalResponse += '\n\n✅ Запись успешно перенесена!';
          }
        } else if (result.data && result.data.needsDateTime) {
          // Запрашиваем дату и время
          finalResponse += '\n\n' + result.data.message;
        } else if (result.data && result.data.slotNotAvailable) {
          // Время занято, предлагаем альтернативы
          finalResponse += '\n\n' + result.data.message;
          if (result.data.suggestions) {
            finalResponse += '\n\n' + result.data.suggestions;
          }
        } else if (result.data && result.data.bookings && result.data.needsSelection) {
          // Показываем список записей для выбора
          finalResponse += '\n\n📅 Ваши активные записи:\n';
          result.data.bookings.forEach((booking, index) => {
            finalResponse += `\n${index + 1}. ${booking.date} в ${booking.time}`;
            finalResponse += `\n   Услуга: ${booking.services}`;
            finalResponse += `\n   Мастер: ${booking.staff}`;
          });
          finalResponse += '\n\nНапишите номер записи, которую хотите перенести.';
          
          // Сохраняем в контекст для следующего шага
          const contextService = require('../context');
          const redisContext = await contextService.getContext(context.phone.replace('@c.us', '')) || {};
          redisContext.rescheduleStep = 'selectBooking';
          redisContext.activeBookings = result.data.bookings;
          await contextService.setContext(context.phone.replace('@c.us', ''), redisContext);
        } else {
          finalResponse += '\n\n❌ Не удалось перенести запись.';
          if (result.data && result.data.error) {
            finalResponse += ' ' + result.data.error;
          }
        }
      } else if (result.type === 'staff_schedule') {
        // Обработка результата проверки расписания мастеров
        if (result.data && result.data.targetStaff) {
          // Ответ про конкретного мастера
          const staff = result.data.targetStaff;
          if (staff.isWorking) {
            // Мастер работает - не добавляем ничего, AI сам ответит
          } else if (staff.found && !staff.isWorking) {
            finalResponse += `\n\n${staff.name} не работает ${staff.formattedDate || result.data.formattedDate}.`;
          } else {
            finalResponse += `\n\n${staff.name} не найден в расписании на ${staff.formattedDate || result.data.formattedDate}.`;
          }
        } else if (result.data && result.data.working.length > 0) {
          // Общее расписание
          finalResponse += `\n\n${result.data.formattedDate} работают: ${result.data.working.join(', ')}.`;
          if (result.data.notWorking.length > 0) {
            finalResponse += `\nНе работают: ${result.data.notWorking.join(', ')}.`;
          }
        } else if (result.data) {
          finalResponse += `\n\n${result.data.formattedDate} никто не работает.`;
        }
      } else if (result.type === 'error') {
        // Обрабатываем ошибки команд
        logger.info('Processing error result:', {
          command: result.command,
          error: result.error,
          errorType: typeof result.error,
          params: result.params
        });
        
        if (result.command === 'CREATE_BOOKING') {
          // Проверяем, это ошибка доступности времени или другая ошибка
          const isAvailabilityError = result.error && (
            result.error.includes('недоступн') || // недоступно, недоступна, недоступны
            result.error.includes('Услуга недоступна') ||
            result.error.includes('Нет доступных') ||
            result.error.includes('выбранное время') ||
            result.error.includes('занято')
          );
          
          logger.info('Availability error check:', {
            isAvailabilityError,
            error: result.error
          });
          
          if (isAvailabilityError) {
            // Время/мастер недоступны - нужно показать альтернативы
            finalResponse = 'К сожалению, выбранное время недоступно.';
            
            // Пытаемся найти альтернативные слоты
            if (result.params) {
              try {
                // Извлекаем параметры из неудачной попытки бронирования
                const { service_name, service_id, date, time } = result.params;
                
                // Ищем доступные слоты для этой услуги и даты
                const searchParams = {
                  service_name: service_name || (service_id ? null : 'стрижка'),
                  service_id: service_id,
                  date: date || 'сегодня'
                };
                
                logger.info('Searching for alternative slots after booking error:', searchParams);
                const searchResult = await commandHandler.searchSlots(searchParams, context);
                
                if (searchResult && searchResult.slots && searchResult.slots.length > 0) {
                  const slotsData = formatter.formatSlots(searchResult.slots, context.company.type);
                  if (slotsData) {
                    // Вызываем AI для форматирования альтернативных слотов
                    const altPrompt = `Предложи альтернативное время на основе данных:
${JSON.stringify(slotsData)}

Начни с фразы вроде "Вот доступное время:" или "Могу предложить другое время:".
Используй правильные падежи. Будь кратким.`;
                    
                    const formattedAltSlots = await this.callAI(altPrompt);
                    finalResponse += '\n\n' + formattedAltSlots;
                  }
                  
                  // Сохраняем результат поиска для последующего использования
                  context.lastSearch = searchResult;
                } else {
                  finalResponse += ' К сожалению, на сегодня все занято. Попробуйте выбрать другой день.';
                }
              } catch (searchError) {
                logger.error('Error searching for alternative slots:', searchError);
                finalResponse += ' Давайте подберем другое удобное для вас время.';
              }
            } else if (context.lastSearch?.slots && context.lastSearch.slots.length > 0) {
              // Если нет параметров, но есть предыдущий поиск
              const slotsData = formatter.formatSlots(context.lastSearch.slots, context.company.type);
              if (slotsData) {
                const prevPrompt = `Покажи ранее найденное время на основе данных:
${JSON.stringify(slotsData)}

Начни с "Вот доступное время:". Используй правильные падежи.`;
                
                const formattedPrevSlots = await this.callAI(prevPrompt);
                finalResponse += '\n\n' + formattedPrevSlots;
              }
            } else {
              finalResponse += ' Давайте подберем другое удобное для вас время.';
            }
          } else {
            // Другая ошибка (не связанная с доступностью)
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