const config = require('../../config');
const logger = require('../../utils/logger').child({ module: 'ai-admin-v2' });

// Импортируем модули
const dataLoader = require('./modules/data-loader');
const formatter = require('./modules/formatter');
const businessLogic = require('./modules/business-logic');
const commandHandler = require('./modules/command-handler');

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
    const [company, client, services, staff, conversation, businessStats, staffSchedules] = await Promise.all([
      dataLoader.loadCompany(companyId),
      dataLoader.loadClient(phone, companyId),
      dataLoader.loadServices(companyId),
      dataLoader.loadStaff(companyId),
      dataLoader.loadConversation(phone, companyId),
      dataLoader.loadBusinessStats(companyId),
      dataLoader.loadStaffSchedules(companyId)
    ]);
    
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
      startTime
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
  `Новый клиент, телефон: ${phone}`}

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
Определи, что хочет клиент, и используй соответствующую команду:

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
   
4. [SHOW_PORTFOLIO] - показать работы мастера
   Параметры: staff_id

ПРАВИЛА РАБОТЫ:
1. ВСЕГДА анализируй намерение клиента по секции "АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА"
2. Если клиент указал конкретное время (например "в 13:00") И услугу - это означает что он хочет записаться на это время
3. Если клиент просто указал время без услуги после показа слотов - уточни услугу
4. Когда есть вся информация (услуга, время, мастер) - используй [CREATE_BOOKING]
5. Если клиент хочет записаться или проверить время - ОБЯЗАТЕЛЬНО используй [SEARCH_SLOTS]
6. Если клиент спрашивает цены - ОБЯЗАТЕЛЬНО используй [SHOW_PRICES]
7. НЕ отвечай "у нас нет информации" - используй команды для получения данных

ПРАВИЛА ОБЩЕНИЯ:
1. Будь ${terminology.communicationStyle}
2. КОРОТКИЕ сообщения - максимум 2-3 предложения на первое приветствие
3. НЕ используй форматирование: никаких *, _, ~, [], # или других символов
4. НЕ используй эмодзи если клиент сам их не использует
5. Пиши естественно, как обычный человек в мессенджере
6. Задавай ОДИН вопрос за раз, не перегружай информацией

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
Клиент: "хочу записаться"
Ты: "Конечно! На какую услугу хотите записаться? [SEARCH_SLOTS]"

Клиент: "сколько стоит стрижка?"
Ты: "Сейчас покажу актуальные цены. [SHOW_PRICES]"

Клиент: "есть время завтра?"
Ты: "Проверю свободное время на завтра. [SEARCH_SLOTS date=завтра]"

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
          // Заменяем сообщение об успешной записи на сообщение об ошибке
          finalResponse = finalResponse.replace(
            /записываю вас|запись создана|вы записаны/gi, 
            'не удалось создать запись'
          );
          finalResponse += '\n\nК сожалению, не удалось создать запись. Попробуйте выбрать другое время или позвоните нам.';
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