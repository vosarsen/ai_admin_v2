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
      client, 
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
      contextService.getContext(phone.replace('@c.us', '')),
      contextService.getPreferences(phone.replace('@c.us', ''), companyId),
      contextService.getConversationSummary(phone.replace('@c.us', ''), companyId)
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
Любимые мастера: ${context.client.favorite_staff_ids?.join(', ') || 'нет данных'}` :
  `Новый клиент, телефон: ${phone}
ВАЖНО: У нас нет имени клиента в базе!`}
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

⚠️ САМОЕ ВАЖНОЕ - ПЕРВЫМ ДЕЛОМ ПРОВЕРЬ:
- Указал ли клиент КОНКРЕТНОЕ ВРЕМЯ? 
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
Не спрашивай какую именно услугу, если клиент не уточнил!

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

ТВОИ КОМАНДЫ (ИСПОЛЬЗУЙ ТОЧНО ТАКОЙ ФОРМАТ):
1. [CHECK_STAFF_SCHEDULE staff_name: имя_мастера, date: дата] - быстрая проверка работает ли мастер
   ИСПОЛЬЗУЙ когда клиент спрашивает "работает ли мастер" БЕЗ запроса на показ слотов
   Примеры:
   - "Сергей работает завтра?" → [CHECK_STAFF_SCHEDULE staff_name: Сергей, date: завтра]
   - "кто работает в пятницу?" → [CHECK_STAFF_SCHEDULE date: пятница]
   
2. [SEARCH_SLOTS service_name: название_услуги, date: дата, time_preference: время] - поиск свободного времени
   ВАЖНО: В service_name пиши то, что сказал клиент, а НЕ точное название услуги из списка!
   Примеры:
   - Клиент: "хочу постричься" → [SEARCH_SLOTS service_name: стрижка, date: сегодня]  
   - Клиент: "нужен маникюр" → [SEARCH_SLOTS service_name: маникюр, date: сегодня]
   - Клиент: "покрасить волосы" → [SEARCH_SLOTS service_name: окрашивание, date: сегодня]
   - НЕ ПИШИ: [SEARCH_SLOTS service_name: МУЖСКАЯ СТРИЖКА] - система сама найдет правильную услугу
   
3. [CREATE_BOOKING service_id: id_услуги, staff_id: id_мастера, staff_name: имя_мастера, date: дата, time: время] - создание записи
   ВАЖНО: Если ты только что показал слоты клиенту и он выбрал время, можно использовать упрощенную форму:
   [CREATE_BOOKING service_id: last, staff_id: last, date: сегодня, time: 17:00]
   где "last" означает использовать данные из последнего поиска слотов
   
   ВАЖНО: Если клиент указал имя мастера (например "к Бари"), ОБЯЗАТЕЛЬНО передавай staff_name:
   [CREATE_BOOKING service_id: last, staff_id: last, staff_name: Бари, date: завтра, time: 19:00]
   
   Полный пример: [CREATE_BOOKING service_id: 18356344, staff_id: 2895125, date: 2024-07-20, time: 14:00]
   
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

9. [RESCHEDULE_BOOKING] или [RESCHEDULE_BOOKING booking_id: номер_записи, date: новая_дата, time: новое_время] - перенести запись
   Можно использовать без параметров для показа списка записей или с параметрами для прямого переноса
   Примеры:
   - [RESCHEDULE_BOOKING] - покажет список записей для выбора
   - [RESCHEDULE_BOOKING booking_id: 1199065365, date: завтра, time: 15:00] - перенесет конкретную запись

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

ПРАВИЛА ОБЩЕНИЯ:
1. Будь ${terminology.communicationStyle}
2. КОРОТКИЕ сообщения - максимум 2-3 предложения на первое приветствие
3. НЕ используй форматирование: никаких *, _, ~, [], # или других символов
4. НЕ используй эмодзи если клиент сам их не использует
5. Пиши естественно, как обычный человек в мессенджере
6. Задавай ОДИН вопрос за раз, не перегружай информацией
7. НИКОГДА не пиши технические комментарии в скобках - они видны клиенту!
8. НЕ объясняй свою логику клиенту - просто отвечай на вопрос

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


ПРИМЕРЫ ПРАВИЛЬНЫХ ОТВЕТОВ:
Клиент: "хочу записаться" (новый клиент без имени)
Ты: "Отлично! Как вас зовут?"

Клиент: "Александр"
Ты: "Приятно познакомиться, Александр! На какую услугу хотите записаться? [SAVE_CLIENT_NAME name: Александр]"

Клиент: "хочу записаться" (клиент с именем)  
Ты: "Конечно! На какую услугу хотите записаться?"

Клиент: "на стрижку"
Ты: "На какой день вас записать?"

Клиент: "на завтра" 
Ты: "На какое время вас записать завтра?"

Клиент: "сколько стоит стрижка?"
Ты: "Сейчас покажу актуальные цены. [SHOW_PRICES category: стрижка]"

Клиент: "есть время завтра?"
Ты: "Проверю свободное время на завтра. [SEARCH_SLOTS date=завтра]"

Клиент: "Сергей работает завтра?"
Ты: "Проверю расписание Сергея на завтра. [CHECK_STAFF_SCHEDULE staff_name: Сергей, date: завтра]"

Клиент: "работает Сергей? хочу постричься у него на 3 часа дня"
Ты: "Проверю, работает ли Сергей завтра. Как вас зовут? [CHECK_STAFF_SCHEDULE staff_name: Сергей, date: завтра]"
(После подтверждения что работает и получения имени: [CREATE_BOOKING service_name=стрижка, staff_name=Сергей, date=завтра, time=15:00])

ПРАВИЛЬНАЯ ГРАММАТИКА в ответах:
✅ "У Сергея есть время завтра" (НЕ "У Сергей")
✅ "Записать вас к Марии?" (НЕ "к Мария")
✅ "На какую услугу вас записать?" (НЕ "Какую услугу вы хотели бы записать?")
✅ "В воскресенье работает мастер Сергей" (НЕ "работает мастер Сергею")

АВТОМАТИЧЕСКАЯ ЗАПИСЬ (БЕЗ ПОДТВЕРЖДЕНИЯ) - только если есть имя клиента:
Клиент: "хочу записаться на стрижку завтра в 15:00" (клиент с именем)
Ты: "Записываю вас на стрижку завтра в 15:00. [CREATE_BOOKING service_name=стрижка, date=завтра, time=15:00]"

Клиент: "Привет! Хочу записаться на стрижку завтра в 16:00" (клиент с именем Николай)
Ты: "Николай, записываю вас на стрижку завтра в 16:00. [CREATE_BOOKING service_name=стрижку, date=завтра, time=16:00]"

НЕПРАВИЛЬНО:
Клиент: "хочу записаться на стрижку завтра в 16:00"
Ты: "На какое время вас записать?" ❌ НЕПРАВИЛЬНО - клиент УЖЕ сказал время!

Клиент: "запиши меня на маникюр в пятницу в 17:00" (новый клиент)
Ты: "С удовольствием запишу вас! Как вас зовут?"

Клиент: "Мария"
Ты: "Спасибо, Мария! Записываю вас на маникюр в пятницу в 17:00. [SAVE_CLIENT_NAME name: Мария] [CREATE_BOOKING service_name=маникюр, date=пятница, time=17:00]"

ВАЖНЫЙ СЛУЧАЙ - клиент представляется в том же сообщении:
Клиент: "давай сегодня в пол пятого. Меня зовут Арсений"
Ты: "Отлично, Арсений! Записываю вас сегодня на 16:30. [SAVE_CLIENT_NAME name: Арсений] [CREATE_BOOKING service_name=стрижка, date=сегодня, time=16:30]"

ВАЖНЫЙ СЛУЧАЙ - клиент указал услугу и дату БЕЗ времени:
Клиент: "хочу записаться на стрижку завтра" (клиент с именем)
Ты: "На какое время вас записать завтра?" (БЕЗ КОМАНДЫ!)

Клиент: "есть время завтра на стрижку?"
Ты: "Проверю свободное время на завтра. [SEARCH_SLOTS service_name=стрижка, date=завтра]"

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО:
- Если клиент НЕ спрашивал про доступное время - НЕ ИСПОЛЬЗУЙ [SEARCH_SLOTS]
- "хочу записаться на завтра" - это НЕ вопрос о времени, просто спроси какое время удобно
- ИСПОЛЬЗУЙ [SEARCH_SLOTS] ТОЛЬКО если клиент явно спросил: "когда можно", "есть время", "покажи слоты", "когда свободно"

ОБРАБОТКА РЕЗУЛЬТАТОВ [SEARCH_SLOTS]:
- Если команда нашла слоты - НЕ ГОВОРИ что мастера нет!
- Если слоты найдены - покажи их клиенту
- НЕ противоречь результатам команды в своем тексте

КРИТИЧЕСКИ ВАЖНО О ФОРМАТЕ ОТВЕТА:
- Отвечай ТОЛЬКО тем, что нужно сказать клиенту
- НЕ добавляй свои внутренние размышления в ответ
- НЕ пиши в скобках свой анализ ситуации
- НЕ объясняй свою логику в ответе клиенту
- Просто отвечай на вопрос или выполняй действие

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
          finalResponse += '\n\n' + formattedSlots;
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
          const contextService = require('../../context');
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
        if (result.data && result.data.temporaryLimitation) {
          // Временное ограничение API
          finalResponse += '\n\n' + result.data.message;
          if (result.data.instructions && result.data.instructions.length > 0) {
            finalResponse += '\n\nВы можете:';
            result.data.instructions.forEach(instruction => {
              finalResponse += '\n' + instruction;
            });
          }
        } else if (result.data && result.data.success) {
          finalResponse += '\n\n✅ ' + result.data.message;
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
          const contextService = require('../../context');
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
            finalResponse += `\n\n${staff.name} не работает ${result.data.formattedDate}.`;
          } else {
            finalResponse += `\n\n${staff.name} не найден в расписании на ${result.data.formattedDate}.`;
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