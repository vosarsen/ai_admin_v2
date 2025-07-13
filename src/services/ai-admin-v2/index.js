// src/services/ai-admin-v2/index.js
const { 
  loadFullContext: optimizedLoadContext,
  getServices,
  getStaff,
  getClient,
  invalidateCache 
} = require('../../database/optimized-supabase');
const { supabase } = require('../../database/supabase'); // Для обратной совместимости
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * AI Администратор v2 - Простой и эффективный
 * 
 * Философия:
 * - AI получает полный контекст и сам решает что делать
 * - Минимум слоев абстракции
 * - Максимум гибкости через промпты
 * - Адаптация под любой тип бизнеса
 */
class AIAdminV2 {
  constructor() {
    this.contextCache = new Map();
    this.aiProvider = null; // Lazy load
  }

  /**
   * Основной метод обработки сообщения
   */
  async processMessage(message, phone, companyId) {
    const startTime = Date.now();
    logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);
    
    let context = null;
    
    try {
      // 1. Загружаем полный контекст параллельно
      context = await this.loadFullContext(phone, companyId);
      
      // 2. Обновляем историю диалога
      context.conversation.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // 3. Строим промпт с полным контекстом
      const prompt = this.buildSmartPrompt(message, context, phone);
      
      // 4. Получаем ответ от AI
      const aiResponse = await this.callAI(prompt);
      
      // 5. Парсим и выполняем действия
      const result = await this.processAIResponse(aiResponse, context);
      
      // 6. Сохраняем контекст
      await this.saveContext(phone, companyId, context, result);
      
      logger.info(`✅ AI Admin v2 completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      logger.error('AI Admin v2 error:', error);
      return {
        success: false,
        response: this.getErrorMessage(error, context?.company?.type),
        error: error.message
      };
    }
  }

  /**
   * Загружаем ВЕСЬ необходимый контекст (с оптимизацией)
   */
  async loadFullContext(phone, companyId) {
    const startTime = Date.now();
    
    try {
      // Используем оптимизированную загрузку с Redis кэшем
      const baseContext = await optimizedLoadContext(phone, companyId);
      
      // Проверяем, что baseContext содержит необходимые данные
      if (!baseContext) {
        throw new Error('Failed to load base context');
      }
      
      // Дополняем контекст специфичными данными
      const [conversation, businessStats] = await Promise.all([
        this.loadConversation(phone, companyId),
        this.loadBusinessStats(companyId)
      ]);
      
      // Сортируем услуги с учетом предпочтений клиента
      const sortedServices = this.sortServicesForClient(
        baseContext.services || [], 
        baseContext.client
      );
      
      const context = {
        ...baseContext,
        services: sortedServices,
        conversation: conversation || [],
        businessStats: businessStats || { todayLoad: 0, bookedSlots: 0, totalSlots: 50 },
        currentTime: new Date().toISOString(),
        timezone: baseContext.company?.timezone || 'Europe/Moscow',
        phone: phone
      };

      const loadTime = Date.now() - startTime;
      logger.info(`Context loaded in ${loadTime}ms`);
      
      return context;
    } catch (error) {
      logger.error('Error loading context:', error);
      throw error;
    }
  }

  /**
   * Строим умный промпт с учетом типа бизнеса
   */
  buildSmartPrompt(message, context, phone) {
    const { company, client, services, staff, staffSchedules, conversation, businessStats } = context;
    
    // Адаптируем терминологию под тип бизнеса
    const terminology = this.getBusinessTerminology(company.type);
    
    return `Ты - ${terminology.role} в ${company.title}.

ИНФОРМАЦИЯ О БИЗНЕСЕ:
- Тип: ${terminology.businessType}
- Адрес: ${company.address}
- Часы работы: ${this.formatWorkingHours(company.working_hours)}
- Телефон: ${company.phone}
${businessStats ? `- Загрузка на сегодня: ${businessStats.todayLoad}%` : ''}

КЛИЕНТ:
- Имя: ${client?.name || 'Не указано'}
- Телефон: ${client?.phone || phone}
- Статус: ${client?.loyalty_level || 'Новый клиент'}
- Визитов: ${client?.visit_count || 0}
${client?.last_visit_date ? `- Последний визит: ${this.formatDate(client.last_visit_date)}` : ''}
${client?.discount ? `- Персональная скидка: ${client.discount}%` : ''}
${client?.preferences ? `- Предпочтения: ${JSON.stringify(client.preferences)}` : ''}
${client?.favorite_staff_ids?.length ? `- Любимые ${terminology.specialists}: ${this.getStaffNames(client.favorite_staff_ids, staff)}` : ''}
${client?.formatted_visit_history?.length ? `\nИСТОРИЯ ПОСЛЕДНИХ ВИЗИТОВ:\n${client.formatted_visit_history.slice(0, 5).join('\n')}` : ''}

${context.lastSearch ? `ПОСЛЕДНИЙ ПОИСК СЛОТОВ:
- Услуга: ${context.lastSearch.service_name}
- Найдено слотов: ${context.lastSearch.slots?.length || 0}
- Время поиска: ${new Date(context.lastSearch.timestamp).toLocaleTimeString('ru-RU')}
` : ''}

ДОСТУПНЫЕ ${terminology.services.toUpperCase()}:
${this.formatServices(services, company.type)}

КТО РАБОТАЕТ СЕГОДНЯ:
${this.formatTodayStaff(staffSchedules, staff)}

РАСПИСАНИЕ МАСТЕРОВ НА НЕДЕЛЮ:
${this.formatStaffSchedules(staffSchedules, staff)}

ИСТОРИЯ ДИАЛОГА (последние 10 сообщений):
${this.formatConversation(conversation.slice(-10))}

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
   - вопросы о стоимости услуг
   
4. ПОРТФОЛИО - используй [SHOW_PORTFOLIO] когда клиент:
   - "покажи работы", "фото работ", "примеры"
   - "портфолио", "посмотреть работы"
   - "есть фото?", "примеры стрижек"
   
5. ОТМЕНА/ПЕРЕНОС - сообщи, что нужно уточнить детали записи:
   - "отменить запись", "не смогу прийти", "перенести"
   - "отмена записи", "отменяю встречу"
   - "атменить запись" (с опечаткой)
   
6. МОИ ЗАПИСИ - проверь в истории клиента:
   - "мои записи", "когда я записан", "проверить запись"
   - "во сколько я записан?", "покажи мои визиты"

ТВОИ КОМАНДЫ (ИСПОЛЬЗУЙ ТОЧНО ТАКОЙ ФОРМАТ):
1. [SEARCH_SLOTS service_name: название_услуги, date: дата, time_preference: время] - поиск свободного времени
   Примеры:
   - [SEARCH_SLOTS service_name: стрижка, date: завтра]
   - [SEARCH_SLOTS service_name: окрашивание, date: 2024-07-15, time_preference: вечер]
   - [SEARCH_SLOTS service_name: маникюр, staff_name: Ольга, date: сегодня]
   
2. [CREATE_BOOKING service_id: id_услуги, staff_id: id_мастера, date: дата, time: время] - создание записи
   Пример: [CREATE_BOOKING service_id: 123, staff_id: 456, date: 2024-07-15, time: 14:00]
   
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
7. НЕ предлагай сразу услуги и цены - сначала узнай что нужно
8. Адрес и часы работы говори ТОЛЬКО когда спрашивают
9. НЕ перечисляй всех мастеров - говори только о тех, кто СЕГОДНЯ работает
10. Смотри РАСПИСАНИЕ МАСТЕРОВ чтобы знать кто работает сегодня

СТИЛЬ ОБЩЕНИЯ:
- Первое сообщение: просто поздоровайся и спроси чем можешь помочь
- Не нужно сразу представлять салон, услуги и мастеров
- Веди диалог постепенно, как живой человек
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
    const commands = this.extractCommands(aiResponse);
    const cleanResponse = this.removeCommands(aiResponse);
    
    // Выполняем команды
    const results = await this.executeCommands(commands, context);
    
    // Формируем финальный ответ
    let finalResponse = cleanResponse;
    
    // Добавляем результаты выполнения команд
    for (const result of results) {
      if (result.type === 'slots') {
        finalResponse += '\n\n' + this.formatSlots(result.data, context.company.type);
      } else if (result.type === 'booking_created') {
        finalResponse += '\n\n✅ ' + this.formatBookingConfirmation(result.data, context.company.type);
      } else if (result.type === 'prices') {
        finalResponse += '\n\n' + this.formatPrices(result.data, context.company.type);
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
   * Извлечение команд из ответа AI
   */
  extractCommands(response) {
    const commands = [];
    const commandRegex = /\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO)([^\]]*)\]/g;
    
    let match;
    while ((match = commandRegex.exec(response)) !== null) {
      const [fullMatch, command, paramsString] = match;
      const params = this.parseCommandParams(paramsString);
      
      commands.push({
        command,
        params,
        originalText: fullMatch
      });
    }
    
    return commands;
  }

  /**
   * Выполнение команд
   */
  async executeCommands(commands, context) {
    const results = [];
    
    for (const cmd of commands) {
      logger.info(`Executing command: ${cmd.command}`, cmd.params);
      
      try {
        switch (cmd.command) {
          case 'SEARCH_SLOTS':
            const slots = await this.searchSlots(cmd.params, context);
            results.push({ type: 'slots', data: slots });
            // Сохраняем информацию о последнем поиске для создания записи
            context.lastSearch = {
              service_name: cmd.params.service_name,
              slots: slots,
              timestamp: new Date().toISOString()
            };
            break;
            
          case 'CREATE_BOOKING':
            const booking = await this.createBooking(cmd.params, context);
            results.push({ type: 'booking_created', data: booking });
            break;
            
          case 'SHOW_PRICES':
            const prices = await this.getPrices(cmd.params, context);
            results.push({ type: 'prices', data: prices });
            break;
            
          case 'SHOW_PORTFOLIO':
            const portfolio = await this.getPortfolio(cmd.params, context);
            results.push({ type: 'portfolio', data: portfolio });
            break;
        }
      } catch (error) {
        logger.error(`Command ${cmd.command} failed:`, error);
        results.push({ 
          type: 'error', 
          command: cmd.command,
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Поиск свободных слотов
   */
  async searchSlots(params, context) {
    // Используем существующий booking service
    const bookingService = require('../booking');
    
    // Находим service по имени
    const service = context.services.find(s => 
      s.title.toLowerCase().includes(params.service_name?.toLowerCase() || '')
    ) || context.services[0]; // Fallback на популярную услугу
    
    // Находим staff если указан
    let targetStaff = null;
    if (params.staff_name) {
      targetStaff = context.staff.find(s => s.name.toLowerCase().includes(params.staff_name.toLowerCase()));
    }
    
    // Если мастер не указан, используем любимых мастеров клиента
    const staffToCheck = targetStaff ? [targetStaff] : 
      (context.client?.favorite_staff_ids?.length ? 
        context.staff.filter(s => context.client.favorite_staff_ids.includes(s.yclients_id)) : 
        context.staff.slice(0, 3)); // Берем топ-3 мастеров
    
    // Проверяем слоты для нескольких мастеров
    const allSlots = [];
    for (const staff of staffToCheck) {
      try {
        const result = await bookingService.findSuitableSlot({
          companyId: context.company.yclients_id || context.company.company_id,
          serviceId: service?.yclients_id,
          staffId: staff?.yclients_id,
          preferredDate: this.parseRelativeDate(params.date),
          timePreference: params.time_preference
        });
        
        if (result.data?.length) {
          // Добавляем имя мастера к каждому слоту
          result.data.forEach(slot => {
            slot.staff_name = staff.name;
            slot.staff_id = staff.yclients_id;
          });
          allSlots.push(...result.data);
        }
      } catch (error) {
        logger.debug(`Ошибка получения слотов для ${staff.name}:`, error.message);
      }
    }
    
    // Сортируем слоты по времени и группируем по временным зонам
    return this.organizeSlotsByTimeZones(allSlots, params.time_preference);
  }
  
  /**
   * Организация слотов по временным зонам для удобства выбора
   */
  organizeSlotsByTimeZones(slots, timePreference) {
    if (!slots.length) return [];
    
    const timeZones = {
      morning: { start: 9, end: 12, slots: [] },
      afternoon: { start: 12, end: 17, slots: [] },
      evening: { start: 17, end: 21, slots: [] }
    };
    
    slots.forEach(slot => {
      const hour = parseInt(slot.time?.split(':')[0] || slot.datetime?.split('T')[1]?.split(':')[0]);
      if (hour >= timeZones.morning.start && hour < timeZones.morning.end) {
        timeZones.morning.slots.push(slot);
      } else if (hour >= timeZones.afternoon.start && hour < timeZones.afternoon.end) {
        timeZones.afternoon.slots.push(slot);
      } else if (hour >= timeZones.evening.start && hour < timeZones.evening.end) {
        timeZones.evening.slots.push(slot);
      }
    });
    
    // Возвращаем слоты в приоритетном порядке
    let organizedSlots = [];
    if (timePreference === 'morning') {
      organizedSlots = [...timeZones.morning.slots.slice(0, 3), ...timeZones.afternoon.slots.slice(0, 2)];
    } else if (timePreference === 'evening') {
      organizedSlots = [...timeZones.evening.slots.slice(0, 3), ...timeZones.afternoon.slots.slice(0, 2)];
    } else {
      // Берем по 2 слота из каждой временной зоны
      organizedSlots = [
        ...timeZones.morning.slots.slice(0, 2),
        ...timeZones.afternoon.slots.slice(0, 2),
        ...timeZones.evening.slots.slice(0, 2)
      ];
    }
    
    return organizedSlots.slice(0, 6); // Максимум 6 слотов для выбора
  }

  /**
   * Создание записи
   */
  async createBooking(params, context) {
    const bookingService = require('../booking');
    
    const bookingData = {
      phone: context.client?.phone || context.phone,
      fullname: context.client?.name || '',
      email: context.client?.email || '',
      comment: "Запись через AI администратора WhatsApp",
      appointments: [{
        id: 1,
        services: [parseInt(params.service_id)],
        staff_id: parseInt(params.staff_id),
        datetime: `${params.date} ${params.time}:00`
      }]
    };
    
    const result = await bookingService.createBooking(
      bookingData, 
      context.company.yclients_id || context.company.company_id
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Не удалось создать запись');
    }
    
    return result.data;
  }

  /**
   * Вспомогательные методы для загрузки данных
   */
  async loadCompany(companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();
    
    if (error) throw error;
    
    // Определяем тип бизнеса
    const businessType = this.detectBusinessType(data);
    return { ...data, type: businessType };
  }

  async loadClient(phone, companyId) {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .or(`phone.eq.${normalizedPhone},raw_phone.eq.${normalizedPhone}`)
      .single();
    
    // Если клиент найден, форматируем историю визитов
    if (data && data.visit_history) {
      data.formatted_visit_history = this.formatVisitHistory(data.visit_history);
    }
    
    return data || {
      name: 'Гость',
      phone: normalizedPhone,
      visit_count: 0,
      loyalty_level: 'New',
      visit_history: [],
      formatted_visit_history: []
    };
  }

  async loadServices(companyId) {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('weight', { ascending: false })
      .limit(50);
    
    return data || [];
  }
  
  /**
   * Сортировка услуг с учетом предпочтений клиента
   */
  sortServicesForClient(services, client) {
    if (!services || !Array.isArray(services)) {
      return [];
    }
    
    if (!client || !client.last_service_ids?.length) {
      return services;
    }
    
    // Услуги, которые клиент заказывал ранее, идут первыми
    const clientServices = [];
    const otherServices = [];
    
    services.forEach(service => {
      if (client?.last_service_ids?.includes(service.yclients_id)) {
        clientServices.push(service);
      } else {
        otherServices.push(service);
      }
    });
    
    return [...clientServices, ...otherServices];
  }

  async loadStaff(companyId) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('rating', { ascending: false });
    
    return data || [];
  }

  async loadConversation(phone, companyId) {
    try {
      // Убираем @c.us если есть
      const cleanPhone = phone.replace('@c.us', '');
      
      const { data, error } = await supabase
        .from('dialog_contexts')
        .select('messages')
        .eq('user_id', cleanPhone)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        logger.error('Error loading conversation:', error);
        return [];
      }
      
      return data?.messages || [];
    } catch (error) {
      logger.error('Error in loadConversation:', error);
      return [];
    }
  }

  async loadBusinessStats(companyId) {
    try {
      // Загрузка статистики дня (можно расширить)
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments_cache')
        .select('*')
        .eq('company_id', companyId)
        .gte('appointment_datetime', today)
        .lt('appointment_datetime', today + 'T23:59:59');
      
      if (error) {
        logger.error('Error loading business stats:', error);
      }
      
      const totalSlots = 50; // Примерное количество слотов в день
      const bookedSlots = data?.length || 0;
      const todayLoad = Math.round((bookedSlots / totalSlots) * 100);
      
      return { todayLoad, bookedSlots, totalSlots };
    } catch (error) {
      logger.error('Error in loadBusinessStats:', error);
      return { todayLoad: 0, bookedSlots: 0, totalSlots: 50 };
    }
  }
  
  async loadStaffSchedules(companyId) {
    // Загружаем расписание на ближайшие 7 дней
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 7);
    
    const { data } = await supabase
      .from('staff_schedules')
      .select('*')
      .eq('company_id', companyId)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', weekLater.toISOString().split('T')[0])
      .eq('is_working', true)
      .order('date', { ascending: true });
    
    // Группируем по дням для удобства
    const scheduleByDate = {};
    data?.forEach(schedule => {
      if (!scheduleByDate[schedule.date]) {
        scheduleByDate[schedule.date] = [];
      }
      scheduleByDate[schedule.date].push(schedule);
    });
    
    return scheduleByDate;
  }

  /**
   * Определение типа бизнеса по данным компании
   */
  detectBusinessType(company) {
    const title = company.title.toLowerCase();
    const services = company.raw_data?.services || [];
    
    if (title.includes('барбер') || title.includes('barber')) {
      return 'barbershop';
    } else if (title.includes('ногт') || title.includes('маникюр') || title.includes('nail')) {
      return 'nails';
    } else if (title.includes('массаж') || title.includes('спа') || title.includes('spa')) {
      return 'massage';
    } else if (title.includes('эпиляц') || title.includes('лазер')) {
      return 'epilation';
    } else if (title.includes('брови') || title.includes('ресниц')) {
      return 'brows';
    }
    
    return 'beauty'; // По умолчанию салон красоты
  }

  /**
   * Получение терминологии для типа бизнеса
   */
  getBusinessTerminology(businessType) {
    const terminology = {
      barbershop: {
        role: 'администратор барбершопа',
        businessType: 'барбершоп',
        services: 'услуги',
        specialists: 'барберы',
        communicationStyle: 'простым и дружелюбным, без лишних формальностей',
        suggestions: 'стрижку или уход за бородой'
      },
      nails: {
        role: 'администратор студии маникюра',
        businessType: 'ногтевая студия',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'вежливым и заботливым',
        suggestions: 'актуальные дизайны и уходовые процедуры'
      },
      massage: {
        role: 'администратор массажного салона',
        businessType: 'массажный салон',
        services: 'процедуры',
        specialists: 'массажисты',
        communicationStyle: 'спокойным и профессиональным',
        suggestions: 'комплексные программы и курсы массажа'
      },
      epilation: {
        role: 'администратор студии эпиляции',
        businessType: 'студия лазерной эпиляции',
        services: 'процедуры',
        specialists: 'специалисты',
        communicationStyle: 'деликатным и информативным',
        suggestions: 'курсы процедур и сезонные предложения'
      },
      beauty: {
        role: 'администратор салона красоты',
        businessType: 'салон красоты',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'приветливым и профессиональным',
        suggestions: 'комплексные услуги и акции'
      }
    };
    
    return terminology[businessType] || terminology.beauty;
  }

  /**
   * Форматирование данных для промпта
   */
  formatServices(services, businessType) {
    if (!services.length) return 'Нет доступных услуг';
    
    return services.slice(0, 20).map(s => {
      const price = s.price_min ? `от ${s.price_min}₽` : 'по запросу';
      const duration = s.duration ? `${s.duration} мин` : '';
      return `- ${s.title} (${price}${duration ? ', ' + duration : ''}) [ID: ${s.yclients_id}]`;
    }).join('\n');
  }

  formatStaff(staff, businessType) {
    if (!staff.length) return 'Нет доступных специалистов';
    
    return staff.map(s => {
      const rating = s.rating ? `⭐ ${s.rating}` : '';
      const spec = s.specialization || 'универсал';
      return `- ${s.name} (${spec}${rating ? ', ' + rating : ''}) [ID: ${s.yclients_id}]`;
    }).join('\n');
  }

  formatTodayStaff(scheduleByDate, staffList) {
    if (!scheduleByDate || Object.keys(scheduleByDate).length === 0) {
      return 'Нет данных о расписании на сегодня';
    }
    
    // Получаем сегодняшнюю дату
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = scheduleByDate[today];
    
    if (!todaySchedule || todaySchedule.length === 0) {
      return 'Сегодня никто не работает';
    }
    
    // Форматируем список работающих сегодня мастеров
    const workingToday = todaySchedule.map(schedule => {
      const staff = staffList.find(s => s.yclients_id === schedule.staff_id);
      if (!staff) return null;
      
      const rating = staff.rating ? ` (⭐ ${staff.rating})` : '';
      const time = schedule.work_start && schedule.work_end ? 
        ` ${schedule.work_start}-${schedule.work_end}` : '';
      
      return `- ${staff.name}${rating}${time}`;
    }).filter(Boolean);
    
    return workingToday.join('\n');
  }

  formatStaffSchedules(scheduleByDate, staffList) {
    if (!scheduleByDate || Object.keys(scheduleByDate).length === 0) {
      return 'Расписание не загружено';
    }
    
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    let result = [];
    
    // Берем первые 3 дня с расписанием
    Object.keys(scheduleByDate).slice(0, 3).forEach(date => {
      const dayDate = new Date(date);
      const dayName = days[dayDate.getDay()];
      const formattedDate = `${dayDate.getDate()}.${(dayDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const workingStaff = scheduleByDate[date].map(schedule => {
        const staff = staffList.find(s => s.yclients_id === schedule.staff_id);
        return staff ? `${staff.name} (${schedule.work_start}-${schedule.work_end})` : schedule.staff_name;
      });
      
      result.push(`${dayName} ${formattedDate}: ${workingStaff.join(', ')}`);
    });
    
    return result.join('\n');
  }

  formatConversation(messages) {
    if (!messages.length) return 'Нет предыдущих сообщений';
    
    return messages.map(m => 
      `${m.role === 'user' ? 'Клиент' : 'Админ'}: ${m.content}`
    ).join('\n');
  }

  formatWorkingHours(hours) {
    if (!hours) return 'не указаны';
    // Простое форматирование, можно улучшить
    return JSON.stringify(hours);
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU');
  }
  
  formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (dateStr === 'Сегодня') return 'Сегодня';
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === tomorrow.toDateString()) return 'Завтра';
    
    return date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long',
      weekday: 'short'
    });
  }
  
  parseRelativeDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    const today = new Date();
    const dateStrLower = dateStr.toLowerCase();
    
    if (dateStrLower === 'сегодня' || dateStrLower === 'today') {
      return today.toISOString().split('T')[0];
    }
    
    if (dateStrLower === 'завтра' || dateStrLower === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    
    if (dateStrLower === 'послезавтра' || dateStrLower === 'after tomorrow') {
      const afterTomorrow = new Date(today);
      afterTomorrow.setDate(afterTomorrow.getDate() + 2);
      return afterTomorrow.toISOString().split('T')[0];
    }
    
    // Если это уже ISO дата, возвращаем как есть
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Пытаемся распарсить дату
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    // Fallback на сегодня
    return today.toISOString().split('T')[0];
  }

  getStaffNames(staffIds, staffList) {
    return staffIds
      .map(id => staffList.find(s => s.yclients_id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Форматирование результатов для клиента
   */
  formatSlots(slots, businessType) {
    if (!slots || !slots.length) {
      return '😔 К сожалению, на выбранное время нет свободных слотов. Могу предложить другое время или день.';
    }
    
    const terminology = this.getBusinessTerminology(businessType);
    let text = `📅 Доступное время:\n\n`;
    
    // Группируем по мастерам если есть
    const byStaff = {};
    slots.forEach(slot => {
      const staffName = slot.staff_name || 'Любой мастер';
      if (!byStaff[staffName]) byStaff[staffName] = [];
      byStaff[staffName].push(slot);
    });
    
    Object.entries(byStaff).slice(0, 3).forEach(([staffName, staffSlots]) => {
      text += `👤 ${staffName}:\n\n`;
      
      // Группируем по датам
      const byDate = {};
      staffSlots.forEach(slot => {
        const date = slot.date || (slot.datetime ? slot.datetime.split(' ')[0] : new Date().toISOString().split('T')[0]);
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(slot);
      });
      
      // Сортируем даты
      const sortedDates = Object.keys(byDate).sort();
      
      sortedDates.forEach(date => {
        const formattedDate = this.formatDateForDisplay(date);
        text += `${formattedDate}:\n`;
        
        const times = byDate[date]
          .map(slot => slot.time || (slot.datetime ? slot.datetime.split(' ')[1].substring(0, 5) : ''))
          .filter(time => time)
          .slice(0, 6);
        
        text += times.map(time => `- ${time}`).join('\n');
        text += '\n\n';
      });
    });
    
    return text;
  }

  formatBookingConfirmation(booking, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    return `Ваша запись подтверждена! Ждем вас ${booking.date} в ${booking.time}. ${terminology.specialists} ${booking.staff_name} будет вас ждать.`;
  }

  formatPrices(services, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    let text = `💰 Наши ${terminology.services}:\n\n`;
    
    services.slice(0, 10).forEach(s => {
      const price = s.price_min === s.price_max ? 
        `${s.price_min}₽` : 
        `${s.price_min}-${s.price_max}₽`;
      text += `${s.title} - ${price}\n`;
    });
    
    return text;
  }

  /**
   * Парсинг параметров команды
   */
  parseCommandParams(paramsString) {
    const params = {};
    const paramRegex = /(\w+):\s*([^,\]]+)/g;
    
    let match;
    while ((match = paramRegex.exec(paramsString)) !== null) {
      const [, key, value] = match;
      params[key.trim()] = value.trim();
    }
    
    return params;
  }

  /**
   * Удаление команд из ответа
   */
  removeCommands(response) {
    // Убираем команды в квадратных скобках
    let cleaned = response.replace(/\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO)[^\]]*\]/g, '');
    
    // Убираем технические фразы
    cleaned = cleaned.replace(/\(Если клиент.*?\)/g, '');
    cleaned = cleaned.replace(/выполню.*?параметрами\./g, '');
    cleaned = cleaned.replace(/service_name=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/date=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/time_preference=.*?(?=\s|$)/g, '');
    
    // Убираем лишние пробелы и переносы строк
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Сохранение контекста
   */
  async saveContext(phone, companyId, context, result) {
    // Убираем @c.us если есть
    const cleanPhone = phone.replace('@c.us', '');
    
    // Добавляем ответ в историю
    context.conversation.push({
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString()
    });
    
    // Сохраняем в БД
    await supabase
      .from('dialog_contexts')
      .upsert({
        user_id: cleanPhone,
        company_id: companyId,
        messages: context.conversation.slice(-50), // Последние 50 сообщений
        updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        message_count: context.conversation.length
      });
  }

  /**
   * Получение AI провайдера
   */
  async callAI(prompt) {
    if (!this.aiProvider) {
      this.aiProvider = require('../ai');
    }
    
    return await this.aiProvider._callAI(prompt);
  }

  /**
   * Форматирование истории визитов для промпта
   */
  formatVisitHistory(visitHistory) {
    if (!visitHistory || !Array.isArray(visitHistory)) return [];
    
    return visitHistory.slice(0, 5).map((visit, index) => {
      const date = new Date(visit.date).toLocaleDateString('ru-RU');
      const services = visit.services?.join(', ') || 'Услуги не указаны';
      const staff = visit.staff_name || 'Мастер не указан';
      const cost = visit.cost ? `${visit.cost}₽` : 'Стоимость не указана';
      
      return `  ${index + 1}. ${date} - ${services} (${staff}) - ${cost}`;
    });
  }

  /**
   * Сообщения об ошибках с учетом типа бизнеса
   */
  getErrorMessage(error, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    
    if (error.message.includes('timeout')) {
      return `Извините, сервис временно перегружен. Попробуйте через минуту или позвоните нам: ${terminology.businessType} всегда рад вам помочь!`;
    }
    
    return `Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз или свяжитесь с нами по телефону.`;
  }

  /**
   * Очистка кеша
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > 600000) { // 10 минут
        this.contextCache.delete(key);
      }
    }
  }
}

module.exports = new AIAdminV2();