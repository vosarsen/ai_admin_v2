const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:command-handler' });
const bookingService = require('../../booking');
const formatter = require('./formatter');
const serviceMatcher = require('./service-matcher');
// dateParser теперь используется из formatter

class CommandHandler {
  /**
   * Извлечение команд из ответа AI
   */
  extractCommands(response) {
    const commands = [];
    const commandRegex = /\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO|CANCEL_BOOKING|SAVE_CLIENT_NAME|CONFIRM_BOOKING|MARK_NO_SHOW|RESCHEDULE_BOOKING|CHECK_STAFF_SCHEDULE)([^\]]*)\]/g;
    
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
   * Парсинг параметров команды
   */
  parseCommandParams(paramsString) {
    const params = {};
    if (!paramsString) return params;
    
    // Разбираем параметры вида key: value или key=value
    const paramRegex = /(\w+)[:=]\s*([^,]+)/g;
    let match;
    while ((match = paramRegex.exec(paramsString)) !== null) {
      const [, key, value] = match;
      params[key.trim()] = value.trim();
    }
    
    return params;
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
            const slotsResult = await this.searchSlots(cmd.params, context);
            results.push({ type: 'slots', data: slotsResult.slots });
            // Сохраняем информацию о последнем поиске для создания записи
            context.lastSearch = {
              service_name: cmd.params.service_name,
              service_id: slotsResult.service?.yclients_id,
              service_title: slotsResult.service?.title,
              staff_id: slotsResult.staff?.yclients_id,
              staff_name: slotsResult.staff?.name,
              slots: slotsResult.slots,
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
            
          case 'SAVE_CLIENT_NAME':
            const savedName = await this.saveClientName(cmd.params, context);
            results.push({ type: 'name_saved', data: savedName });
            break;
            
          case 'CANCEL_BOOKING':
            const cancelResult = await this.cancelBooking(cmd.params, context);
            results.push({ type: 'booking_list', data: cancelResult });
            break;
            
          case 'CONFIRM_BOOKING':
            const confirmResult = await this.confirmBooking(cmd.params, context);
            results.push({ type: 'booking_confirmed', data: confirmResult });
            break;
            
          case 'MARK_NO_SHOW':
            const noShowResult = await this.markNoShow(cmd.params, context);
            results.push({ type: 'booking_no_show', data: noShowResult });
            break;
            
          case 'RESCHEDULE_BOOKING':
            const rescheduleResult = await this.rescheduleBooking(cmd.params, context);
            results.push({ type: 'booking_rescheduled', data: rescheduleResult });
            break;
            
          case 'CHECK_STAFF_SCHEDULE':
            const scheduleResult = await this.checkStaffSchedule(cmd.params, context);
            results.push({ type: 'staff_schedule', data: scheduleResult });
            break;
        }
      } catch (error) {
        logger.error(`Command ${cmd.command} failed:`, error);
        results.push({ 
          type: 'error', 
          command: cmd.command,
          error: error.message,
          params: cmd.params // Добавляем параметры для обработки ошибок
        });
      }
    }
    
    return results;
  }

  /**
   * Поиск свободных слотов
   */
  async searchSlots(params, context) {
    // Используем интеллектуальный поиск услуги
    const service = serviceMatcher.findBestMatch(
      params.service_name || '', 
      context.services
    );
    
    if (!service) {
      logger.warn('Service not found for query:', params.service_name);
      // Возвращаем пустой массив слотов вместо использования первой услуги
      return [];
    }
    
    logger.info('Found service for query:', {
      query: params.service_name,
      found: service.title,
      serviceId: service.yclients_id
    });
    
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
    
    // Логируем дату для отладки
    const parsedDate = formatter.parseRelativeDate(params.date);
    logger.info('SEARCH_SLOTS date parsing:', {
      originalDate: params.date,
      parsedDate: parsedDate,
      params: params
    });
    
    for (const staff of staffToCheck) {
      try {
        // ВАЖНО: Проверяем слоты передавая и serviceId и staffId
        // YClients API вернет слоты только если мастер оказывает услугу
        const result = await bookingService.findSuitableSlot({
          companyId: context.company.yclients_id || context.company.company_id,
          serviceId: service?.yclients_id,
          staffId: staff?.yclients_id,
          preferredDate: parsedDate,
          timePreference: params.time_preference
        });
        
        // Проверяем структуру результата
        const slots = result.data?.data || result.data || [];
        
        if (Array.isArray(slots) && slots.length > 0) {
          // Добавляем имя мастера к каждому слоту
          slots.forEach(slot => {
            slot.staff_name = staff.name;
            slot.staff_id = staff.yclients_id;
          });
          allSlots.push(...slots);
        }
      } catch (error) {
        logger.debug(`Ошибка получения слотов для ${staff.name}:`, error.message);
      }
    }
    
    // Группируем слоты по мастерам
    const slotsByStaff = allSlots.reduce((acc, slot) => {
      const name = slot.staff_name || 'Unknown';
      if (!acc[name]) acc[name] = [];
      acc[name].push(slot);
      return acc;
    }, {});
    
    // Выбираем мастера с наибольшим количеством свободных слотов
    const staffWithMostSlots = Object.entries(slotsByStaff)
      .sort(([, slotsA], [, slotsB]) => slotsB.length - slotsA.length)[0];
    
    if (!staffWithMostSlots) {
      return { service, staff: null, slots: [] };
    }
    
    const [selectedStaffName, selectedSlots] = staffWithMostSlots;
    
    // Находим объект мастера по имени
    const selectedStaff = staffToCheck.find(s => s.name === selectedStaffName) || 
                         context.staff.find(s => s.name === selectedStaffName);
    
    // Возвращаем полную информацию
    return {
      service: service,
      staff: selectedStaff,
      slots: this.organizeSlotsByTimeZones(selectedSlots, params.time_preference)
    };
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
      organizedSlots = [...timeZones.morning.slots.slice(0, 5), ...timeZones.afternoon.slots.slice(0, 3)];
    } else if (timePreference === 'evening') {
      organizedSlots = [...timeZones.evening.slots.slice(0, 5), ...timeZones.afternoon.slots.slice(0, 3)];
    } else {
      // Берем больше слотов из каждой временной зоны для лучшего выбора
      organizedSlots = [
        ...timeZones.morning.slots.slice(0, 10),
        ...timeZones.afternoon.slots.slice(0, 10),
        ...timeZones.evening.slots.slice(0, 10)
      ];
    }
    
    return organizedSlots; // Возвращаем все слоты для обработки алгоритмом выбора
  }

  /**
   * Создание записи
   */
  async createBooking(params, context) {
    // Если передан service_name вместо service_id, ищем услугу
    let serviceId = params.service_id;
    if (params.service_name && !params.service_id) {
      const service = serviceMatcher.findBestMatch(
        params.service_name, 
        context.services
      );
      if (service) {
        serviceId = service.yclients_id;
        logger.info('Found service by name:', { 
          query: params.service_name, 
          found: service.title,
          serviceId: service.yclients_id
        });
      }
    } else if (params.service_id === 'last') {
      // Если AI передал "last", используем данные из последнего поиска
      serviceId = context.lastSearch?.service_id;
    } else {
      serviceId = parseInt(params.service_id);
    }
    
    let staffId = params.staff_id === 'last' ? 
      context.lastSearch?.staff_id : parseInt(params.staff_id);
    
    // Если указано имя мастера вместо ID, ищем по имени
    if (params.staff_name && (!staffId || isNaN(staffId))) {
      const staffMember = context.staff.find(s => 
        s.name.toLowerCase().includes(params.staff_name.toLowerCase())
      );
      if (staffMember) {
        staffId = staffMember.yclients_id;
        logger.info('Found staff by name:', { 
          query: params.staff_name, 
          found: staffMember.name,
          staffId: staffMember.yclients_id
        });
      }
    }
    
    // Если все еще нет staff_id, пытаемся найти в тексте сообщения упоминание мастера
    if (!staffId && context.currentMessage) {
      const message = context.currentMessage.toLowerCase();
      const staffMember = context.staff.find(s => 
        message.includes(s.name.toLowerCase())
      );
      if (staffMember) {
        staffId = staffMember.yclients_id;
        logger.info('Found staff by name in message:', { 
          found: staffMember.name,
          staffId: staffMember.yclients_id,
          message: context.currentMessage
        });
      }
    }
    
    // Если AI передал неправильные ID (1, 2 и т.д.), используем данные из последнего поиска
    if ((!serviceId || serviceId < 1000) && context.lastSearch?.service_id) {
      logger.info('Using service_id from lastSearch:', context.lastSearch.service_id);
      serviceId = context.lastSearch.service_id;
    }
    
    if ((!staffId || staffId < 1000 || isNaN(staffId)) && context.lastSearch?.staff_id) {
      logger.info('Using staff_id from lastSearch:', context.lastSearch.staff_id);
      staffId = context.lastSearch.staff_id;
    }
    
    // Если staff_id не указан, пытаемся найти доступного мастера
    if (!staffId && serviceId) {
      // Парсим дату для проверки доступности
      const parsedDate = formatter.parseRelativeDate(params.date);
      
      // Ищем мастера, который может выполнить эту услугу в указанное время
      for (const staff of context.staff) {
        try {
          const slots = await bookingService.getAvailableSlots(
            staff.yclients_id,
            parsedDate,
            serviceId,
            context.company.yclients_id || context.company.company_id
          );
          
          // Проверяем, есть ли нужное время среди доступных слотов
          const hasRequestedTime = slots.some(slot => slot.time === params.time);
          if (hasRequestedTime) {
            staffId = staff.yclients_id;
            logger.info('Found available staff for time:', { 
              staffName: staff.name,
              staffId: staff.yclients_id,
              time: params.time 
            });
            break;
          }
        } catch (error) {
          logger.warn('Error checking staff availability:', { 
            staffId: staff.yclients_id, 
            error: error.message 
          });
        }
      }
    }
    
    // Если все еще нет правильных ID, пытаемся найти по имени
    if (!serviceId || serviceId < 1000) {
      const service = context.services.find(s => 
        s.title.toLowerCase().includes('стрижка')
      );
      if (service) {
        serviceId = service.yclients_id;
        logger.info('Found service by name search:', service.title, serviceId);
      }
    }
    
    // Проверяем доступность выбранного времени из последнего поиска
    if (context.lastSearch?.slots && params.time) {
      const requestedTime = params.time;
      const isTimeAvailable = context.lastSearch.slots.some(slot => 
        slot.time === requestedTime || 
        (slot.datetime && slot.datetime.includes(`T${requestedTime}:`))
      );
      
      if (!isTimeAvailable) {
        logger.warn('Requested time is not available:', { 
          requestedTime, 
          availableSlots: context.lastSearch.slots.map(s => s.time) 
        });
        throw new Error(`Время ${requestedTime} недоступно. Выберите другое время из предложенных.`);
      }
    }
    
    // Парсим относительную дату (завтра, послезавтра и т.д.)
    const parsedDate = formatter.parseRelativeDate(params.date);
    logger.info('Parsing date for booking:', { 
      originalDate: params.date, 
      parsedDate: parsedDate,
      time: params.time 
    });
    
    // Извлекаем чистый номер телефона (убираем @c.us)
    const cleanPhone = (context.client?.phone || context.phone || '').replace('@c.us', '');
    
    // Получаем имя клиента из контекста или Redis
    let clientName = context.client?.name;
    
    logger.info('Initial client name check:', { 
      clientName, 
      hasClient: !!context.client,
      clientData: context.client,
      currentMessage: context.currentMessage 
    });
    
    // Если имени нет в контексте клиента, проверяем Redis
    if (!clientName) {
      const contextService = require('../../context');
      const redisContext = await contextService.getContext(cleanPhone);
      if (redisContext && redisContext.clientName) {
        clientName = redisContext.clientName;
      }
      logger.info('Redis context check:', { clientName, redisContext });
    }
    
    // ВСЕГДА проверяем, не представился ли клиент в текущем сообщении
    if (context.currentMessage) {
      const extractedName = this.extractNameFromMessage(context.currentMessage);
      
      // Если клиент представился в текущем сообщении, используем это имя
      if (extractedName) {
        // Логируем если имя изменилось
        if (clientName && clientName !== extractedName) {
          logger.info('Client introduced with new name:', { 
            oldName: clientName, 
            newName: extractedName, 
            phone: cleanPhone 
          });
        }
        
        clientName = extractedName;
        logger.info('Using name from current message:', { name: clientName, phone: cleanPhone });
        
        // Сохраняем в Redis для будущего использования
        const contextService = require('../../context');
        await contextService.updateContext(cleanPhone, context.company.yclients_id || context.company.company_id, {
          clientInfo: { name: clientName }
        });
        
        // Обновляем контекст текущей сессии
        if (context.client) {
          context.client.name = clientName;
        } else {
          context.client = {
            phone: cleanPhone,
            name: clientName,
            company_id: context.company.yclients_id || context.company.company_id
          };
        }
      }
    }
    
    // Если имя все еще не найдено, это ошибка
    if (!clientName) {
      throw new Error('Пожалуйста, сначала представьтесь. Как вас зовут?');
    }
    
    // Проверяем, что staff_id определен
    if (!staffId || isNaN(staffId)) {
      logger.error('Staff ID is not defined:', { 
        staffId, 
        params,
        lastSearch: context.lastSearch
      });
      throw new Error('Не удалось определить мастера для записи. Пожалуйста, укажите конкретного мастера.');
    }
    
    const bookingData = {
      phone: cleanPhone,
      fullname: clientName,
      email: context.client?.email || '',
      comment: "Запись через AI администратора WhatsApp",
      appointments: [{
        id: 1,
        services: [serviceId],
        staff_id: staffId,
        datetime: `${parsedDate} ${params.time}:00`
      }]
    };
    
    // Детальное логирование для отладки
    logger.info('CREATE_BOOKING request data:', {
      serviceId: serviceId,
      staffId: staffId,
      datetime: `${parsedDate} ${params.time}:00`,
      phone: bookingData.phone,
      lastSearch: context.lastSearch,
      fullBookingData: JSON.stringify(bookingData)
    });
    
    // Сначала ищем или создаем клиента в YClients
    const yclientsClient = bookingService.getYclientsClient();
    const companyId = context.company.yclients_id || context.company.company_id;
    
    try {
      // Поиск клиента по телефону
      const searchResult = await yclientsClient.searchClients(bookingData.phone, companyId);
      
      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        // Клиент не найден - создаем нового
        logger.info('Client not found in YClients, creating new client:', {
          phone: bookingData.phone,
          name: clientName
        });
        
        const createClientResult = await yclientsClient.createClient({
          name: clientName,
          phone: bookingData.phone,
          email: bookingData.email
        }, companyId);
        
        if (!createClientResult.success) {
          logger.warn('Failed to create client in YClients:', createClientResult);
          // Продолжаем создание записи даже если не удалось создать клиента
        } else {
          logger.info('Client created successfully in YClients:', createClientResult.data);
        }
      } else {
        logger.info('Client found in YClients:', {
          phone: bookingData.phone,
          clientsCount: searchResult.data.length
        });
      }
    } catch (error) {
      logger.error('Error searching/creating client:', error);
      // Продолжаем создание записи даже при ошибке
    }
    
    const result = await bookingService.createBooking(
      bookingData, 
      companyId
    );
    
    // Логируем полный результат для отладки
    logger.info('Booking created successfully:', {
      fullResponse: result
    });
    
    if (!result.success) {
      // Извлекаем детальные ошибки от YClients
      let errorMessage = 'Не удалось создать запись';
      
      // Проверяем наличие ошибок от YClients API
      if (result.error && result.error.yclientsErrors && Array.isArray(result.error.yclientsErrors)) {
        errorMessage = result.error.yclientsErrors.map(err => err.message).join('. ');
      } else if (result.yclientsErrors && Array.isArray(result.yclientsErrors)) {
        errorMessage = result.yclientsErrors.map(err => err.message).join('. ');
      } else if (result.error && typeof result.error === 'object') {
        errorMessage = result.error.message || JSON.stringify(result.error);
      } else if (result.error) {
        errorMessage = String(result.error);
      }
      
      logger.error('Booking creation failed with error:', { 
        errorMessage, 
        fullResult: result 
      });
      
      throw new Error(errorMessage);
    }
    
    // YClients возвращает вложенную структуру data.data
    const responseData = result.data?.data || result.data || [];
    const bookingRecord = Array.isArray(responseData) ? responseData[0] : responseData;
    
    // Найдем информацию о цене услуги
    let servicePrice = null;
    if (serviceId && context.services) {
      const service = context.services.find(s => s.yclients_id === serviceId);
      if (service) {
        servicePrice = service.price_min || service.price || null;
      }
    }
    
    // Возвращаем объект с нужными полями для отображения
    return {
      id: bookingRecord?.record_id,
      record_id: bookingRecord?.record_id,
      record_hash: bookingRecord?.record_hash,
      service_name: context.lastSearch?.service_name,
      staff_name: context.lastSearch?.staff_name,
      datetime: `${parsedDate} ${params.time}:00`,
      address: context.company?.address || null,
      price: servicePrice
    };
  }

  /**
   * Получение прайс-листа
   */
  async getPrices(params, context) {
    const { services } = context;
    
    if (params.category) {
      const searchTerm = params.category.toLowerCase().trim();
      logger.info(`Searching prices for category: "${params.category}"`);
      
      // Создаем карту ключевых слов для лучшего поиска
      const searchKeywords = {
        'стрижка': ['мужская стрижка', 'стрижка машинкой', 'стрижка ножницами', 'детская стрижка', 'стрижка для', 'стрижка +'],
        'борода': ['борода', 'усы', 'моделирование бороды'],
        'окрашивание': ['окрашивание', 'тонирование', 'мелирование', 'осветление'],
        'укладка': ['укладка', 'стайлинг', 'прическа'],
        'маникюр': ['маникюр', 'ногти', 'покрытие', 'дизайн ногтей'],
        'педикюр': ['педикюр', 'стопы'],
        'брови': ['брови', 'бровей', 'коррекция бровей', 'окрашивание бровей'],
        'ресницы': ['ресницы', 'ресниц', 'наращивание ресниц', 'ламинирование ресниц'],
        'массаж': ['массаж', 'spa', 'релакс'],
        'эпиляция': ['эпиляция', 'депиляция', 'шугаринг', 'воск']
      };
      
      // Сначала пробуем найти по точному совпадению с ключевыми словами
      let keywords = searchKeywords[searchTerm] || [searchTerm];
      
      // Фильтруем услуги по релевантности
      const filtered = services.filter(s => {
        const title = s.title?.toLowerCase() || '';
        const category = s.category_title?.toLowerCase() || '';
        
        // Приоритет точному совпадению с ключевыми словами
        return keywords.some(keyword => 
          title.includes(keyword) || category.includes(keyword)
        );
      });
      
      // Сортируем по релевантности и цене
      const sorted = filtered.sort((a, b) => {
        // Сначала сортируем по точному совпадению в начале названия
        const aStartsWith = keywords.some(k => a.title?.toLowerCase().startsWith(k));
        const bStartsWith = keywords.some(k => b.title?.toLowerCase().startsWith(k));
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // Затем по цене
        const priceA = a.price_min || a.price || 0;
        const priceB = b.price_min || b.price || 0;
        return priceA - priceB;
      });
      
      logger.info(`Found ${sorted.length} services matching "${params.category}"`);
      
      // Возвращаем только первые 10 наиболее релевантных услуг
      return sorted.slice(0, 10);
    }
    
    // Если категория не указана, возвращаем популярные услуги
    logger.info(`Returning popular services`);
    
    // Фильтруем базовые услуги (без комплексных)
    const basicServices = services.filter(s => {
      const title = s.title?.toLowerCase() || '';
      // Исключаем комплексные услуги
      return !title.includes(' + ') && !title.includes('отец') && !title.includes('luxina');
    });
    
    // Сортируем по цене и возвращаем первые 15
    return basicServices.sort((a, b) => {
      const priceA = a.price_min || a.price || 0;
      const priceB = b.price_min || b.price || 0;
      return priceA - priceB;
    }).slice(0, 15);
  }

  /**
   * Получение портфолио (заглушка на будущее)
   */
  async getPortfolio(params, context) {
    // TODO: Implement portfolio retrieval
    return [];
  }

  /**
   * Удаление команд из ответа
   */
  /**
   * Извлечение имени из сообщения
   */
  extractNameFromMessage(message) {
    if (!message) return null;
    
    // Паттерны для поиска имени
    const patterns = [
      /меня зовут\s+([А-ЯЁа-яё]+)/i,
      /я\s+([А-ЯЁа-яё]+)(?:\s|$)/i,  // "я Арсен" - имя после "я" с пробелом
      /я\s*[-–—]\s*([А-ЯЁа-яё]+)/i,
      /это\s+([А-ЯЁа-яё]+)/i,
      /^([А-ЯЁ][а-яё]+)$/m  // Одиночное слово с заглавной буквы в начале строки
    ];
    
    // Также проверяем распространенные имена в сообщении
    const commonNames = [
      'Александр', 'Алексей', 'Андрей', 'Антон', 'Артем', 'Артур', 'Арсен', 'Арсений', 'Борис', 
      'Вадим', 'Валентин', 'Валерий', 'Василий', 'Виктор', 'Виталий', 'Владимир', 'Владислав',
      'Вячеслав', 'Геннадий', 'Георгий', 'Глеб', 'Григорий', 'Даниил', 'Денис', 'Дмитрий',
      'Евгений', 'Егор', 'Иван', 'Игорь', 'Илья', 'Кирилл', 'Константин', 'Леонид', 'Максим',
      'Марк', 'Матвей', 'Михаил', 'Никита', 'Николай', 'Олег', 'Павел', 'Петр', 'Роман',
      'Руслан', 'Сергей', 'Станислав', 'Степан', 'Тимофей', 'Тимур', 'Федор', 'Филипп', 'Юрий',
      'Ярослав', 'Анна', 'Алена', 'Алина', 'Алиса', 'Алла', 'Анастасия', 'Ангелина', 'Анжела',
      'Валентина', 'Валерия', 'Варвара', 'Василиса', 'Вера', 'Вероника', 'Виктория', 'Галина',
      'Дарья', 'Диана', 'Ева', 'Евгения', 'Екатерина', 'Елена', 'Елизавета', 'Жанна', 'Зинаида',
      'Инна', 'Ирина', 'Карина', 'Кристина', 'Ксения', 'Лариса', 'Лидия', 'Лилия', 'Любовь',
      'Людмила', 'Маргарита', 'Марина', 'Мария', 'Милана', 'Надежда', 'Наталья', 'Нина', 'Оксана',
      'Ольга', 'Полина', 'Раиса', 'Регина', 'Светлана', 'София', 'Таисия', 'Тамара', 'Татьяна',
      'Ульяна', 'Юлия', 'Яна'
    ];
    
    // Пробуем найти имя по паттернам
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Проверяем, что это похоже на имя (с заглавной буквы)
        if (name.length > 1 && name[0] === name[0].toUpperCase()) {
          return name;
        }
      }
    }
    
    // Проверяем наличие распространенных имен в сообщении
    const words = message.split(/\s+/);
    for (const word of words) {
      // Приводим к правильному регистру для сравнения
      const normalizedWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (commonNames.includes(normalizedWord)) {
        return normalizedWord;
      }
    }
    
    logger.debug('Could not extract name from message:', { message });
    return null;
  }

  /**
   * Сохранение имени клиента
   */
  async saveClientName(params, context) {
    if (!params.name) {
      throw new Error('Имя клиента не указано');
    }

    const cleanPhone = (context.client?.phone || context.phone || '').replace('@c.us', '');
    
    // Сохраняем имя в контексте для текущей сессии
    if (context.client) {
      context.client.name = params.name;
    } else {
      context.client = {
        phone: cleanPhone,
        name: params.name,
        company_id: context.company.yclients_id || context.company.company_id
      };
    }
    
    // Сохраняем имя в Redis для будущих сессий
    const contextService = require('../../context');
    await contextService.updateContext(cleanPhone, context.company.yclients_id || context.company.company_id, {
      clientInfo: { name: params.name }
    });
    
    logger.info('Client name saved:', { phone: cleanPhone, name: params.name });
    
    return {
      name: params.name,
      phone: cleanPhone
    };
  }

  /**
   * Обработка отмены записи
   */
  async cancelBooking(params, context) {
    const phone = context.phone.replace('@c.us', '');
    
    // Временное решение - информируем о невозможности отмены через бота
    return {
      success: false,
      temporaryLimitation: true,
      message: 'К сожалению, отмена записи через бота временно недоступна из-за ограничений API.',
      instructions: [
        '📱 Отменить запись через мобильное приложение YClients',
        '💻 Отменить запись на сайте yclients.com',
        `📞 Позвонить администратору: ${context.company?.phones?.[0] || '+7 (XXX) XXX-XX-XX'}`
      ],
      bookings: [] // Не показываем список записей, так как все равно не можем их отменить
    };
    
    // Старый код закомментирован для будущего использования
    /*
    // Если передан ID записи, пытаемся сразу удалить
    if (params.booking_id || params.record_id) {
      const recordId = params.booking_id || params.record_id;
      logger.info(`Attempting to cancel booking directly with ID: ${recordId}`);
      
      const cancelResult = await bookingService.cancelBooking(recordId, context.company.company_id);
      
      if (cancelResult.success) {
        return {
          success: true,
          directCancellation: true,
          message: `Запись ${recordId} успешно отменена!`
        };
      } else {
        return {
          success: false,
          error: cancelResult.error,
          message: `Не удалось отменить запись ${recordId}. ${typeof cancelResult.error === 'object' ? JSON.stringify(cancelResult.error) : cancelResult.error}`
        };
      }
    }
    */
    
    // Иначе показываем список записей
    const bookingsResult = await bookingService.getClientBookings(phone, context.company.company_id);
    
    if (!bookingsResult.success) {
      return {
        success: false,
        error: bookingsResult.error
      };
    }
    
    if (!bookingsResult.bookings || bookingsResult.bookings.length === 0) {
      return {
        success: true,
        bookings: [],
        message: 'У вас нет активных записей'
      };
    }
    
    // Форматируем список записей для показа клиенту
    const formattedBookings = bookingsResult.bookings.map((booking, index) => {
      const date = new Date(booking.datetime);
      const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        weekday: 'short'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const services = booking.services.map(s => s.title).join(', ');
      const staff = booking.staff ? booking.staff.name : 'Любой мастер';
      
      return {
        index: index + 1,
        id: booking.id,
        date: dateStr,
        time: timeStr,
        services: services,
        staff: staff,
        price: booking.price_min || 0
      };
    });
    
    return {
      success: true,
      bookings: formattedBookings,
      message: 'Выберите запись для отмены'
    };
  }

  /**
   * Подтвердить запись
   */
  async confirmBooking(params, context) {
    // Временное решение - информируем о недоступности
    return {
      success: false,
      temporaryLimitation: true,
      message: 'К сожалению, подтверждение записи через бота временно недоступно из-за ограничений API.',
      instructions: [
        '✅ Ваша запись уже активна',
        '📱 Статус можно увидеть в приложении YClients',
        `📞 По вопросам звоните: ${context.company?.phones?.[0] || '+7 (XXX) XXX-XX-XX'}`
      ]
    };
    
    // Код для будущего использования
    /*
    const recordId = params.booking_id || params.record_id;
    const visitId = params.visit_id || recordId; // По умолчанию visitId = recordId
    
    if (!recordId) {
      return {
        success: false,
        error: 'Не указан ID записи для подтверждения'
      };
    }
    
    const result = await bookingService.confirmBooking(visitId, recordId);
    return result;
    */
  }

  /**
   * Отметить неявку
   */
  async markNoShow(params, context) {
    // Временное решение - информируем о недоступности
    return {
      success: false,
      temporaryLimitation: true,
      message: 'К сожалению, отметка о неявке через бота временно недоступна из-за ограничений API.',
      instructions: [
        '📱 Отметить неявку можно в приложении YClients',
        '💬 Или сообщите администратору',
        `📞 Телефон: ${context.company?.phones?.[0] || '+7 (XXX) XXX-XX-XX'}`
      ],
      suggestion: 'Если вы хотите отменить запись, напишите "отменить запись"'
    };
    
    // Код для будущего использования
    /*
    const recordId = params.booking_id || params.record_id;
    const visitId = params.visit_id || recordId;
    const reason = params.reason || 'Клиент не явился';
    
    if (!recordId) {
      return {
        success: false,
        error: 'Не указан ID записи'
      };
    }
    
    const result = await bookingService.markNoShow(visitId, recordId, reason);
    return result;
    */
  }

  /**
   * Перенос записи
   */
  async rescheduleBooking(params, context) {
    const phone = context.phone.replace('@c.us', '');
    
    // Временное решение - информируем о невозможности переноса через бота
    return {
      success: false,
      temporaryLimitation: true,
      message: 'К сожалению, перенос записи через бота временно недоступен из-за ограничений API.',
      instructions: [
        '📱 Перенести запись через мобильное приложение YClients',
        '💻 Перенести запись на сайте yclients.com',
        `📞 Позвонить администратору: ${context.company?.phones?.[0] || '+7 (XXX) XXX-XX-XX'}`
      ]
    };
    
    // Код для будущего использования когда получим права API
    /*
    // Если не указан ID записи, показываем список
    if (!params.booking_id && !params.record_id) {
      const bookingsResult = await bookingService.getClientBookings(phone, context.company.company_id);
      
      if (!bookingsResult.success) {
        return {
          success: false,
          error: bookingsResult.error
        };
      }
      
      const activeBookings = bookingsResult.data?.filter(b => 
        new Date(b.datetime) > new Date()
      ) || [];
      
      // Сохраняем список в контексте для следующего шага
      const contextService = require('../../context');
      const redisContext = await contextService.getContext(phone) || {};
      redisContext.rescheduleStep = 'selectBooking';
      redisContext.activeBookings = activeBookings;
      await contextService.setContext(phone, redisContext);
      
      return {
        success: true,
        bookings: activeBookings,
        needsSelection: true
      };
    }
    
    const recordId = params.booking_id || params.record_id;
    const newDate = params.date;
    const newTime = params.time;
    
    if (!newDate || !newTime) {
      return {
        success: false,
        error: 'Не указаны новые дата и время для переноса'
      };
    }
    
    // Форматируем дату для YClients
    const dateTime = formatter.parseRelativeDate(newDate);
    const formattedDateTime = `${dateTime} ${newTime}:00`;
    
    // Обновляем запись
    const updateData = {
      datetime: formattedDateTime,
      comment: 'Перенесено через WhatsApp бота'
    };
    
    const updateResult = await bookingService.getYclientsClient().updateRecord(
      context.company.company_id, 
      recordId, 
      updateData
    );
    
    if (updateResult.success) {
      // Очищаем контекст переноса
      const contextService = require('../../context');
      const redisContext = await contextService.getContext(phone) || {};
      delete redisContext.rescheduleStep;
      delete redisContext.activeBookings;
      await contextService.setContext(phone, redisContext);
      
      return {
        success: true,
        recordId: recordId,
        newDateTime: formattedDateTime,
        message: `Запись успешно перенесена на ${formatter.formatDate(dateTime)} в ${newTime}`
      };
    } else {
      return {
        success: false,
        error: updateResult.error
      };
    }
    */
  }

  /**
   * Проверить расписание мастера
   */
  async checkStaffSchedule(params, context) {
    const { staff_name, date } = params;
    
    // Парсим дату
    const dateStr = formatter.parseRelativeDate(date || 'сегодня');
    const targetDate = new Date(dateStr);
    
    // Находим мастера по имени
    let staff = null;
    if (staff_name) {
      staff = context.staff.find(s => 
        s.name.toLowerCase().includes(staff_name.toLowerCase()) ||
        staff_name.toLowerCase().includes(s.name.toLowerCase())
      );
    }
    
    // Получаем расписание из базы данных
    const { supabase } = require('../../../database/supabase');
    
    let query = supabase
      .from('staff_schedules')
      .select('*')
      .eq('date', dateStr);
      
    if (staff) {
      query = query.eq('staff_id', staff.yclients_id);
    }
    
    const { data: schedules, error } = await query;
    
    if (error) {
      logger.error('Error fetching staff schedules:', error);
      return {
        success: false,
        error: 'Не удалось получить расписание'
      };
    }
    
    // Формируем результат
    const result = {
      date: dateStr,
      formattedDate: formatter.formatDate(targetDate),
      staff: [],
      working: [],
      notWorking: []
    };
    
    if (schedules && schedules.length > 0) {
      schedules.forEach(schedule => {
        const staffInfo = {
          id: schedule.staff_id,
          name: schedule.staff_name,
          isWorking: schedule.is_working,
          hasSlots: schedule.has_booking_slots,
          workStart: schedule.work_start,
          workEnd: schedule.work_end
        };
        
        result.staff.push(staffInfo);
        
        if (schedule.is_working && schedule.has_booking_slots) {
          result.working.push(schedule.staff_name);
        } else {
          result.notWorking.push(schedule.staff_name);
        }
      });
    }
    
    // Если искали конкретного мастера
    if (staff_name && staff) {
      const staffSchedule = schedules.find(s => s.staff_id === staff.yclients_id);
      result.targetStaff = {
        name: staff.name,
        found: !!staffSchedule,
        isWorking: staffSchedule?.is_working && staffSchedule?.has_booking_slots
      };
    }
    
    return result;
  }

  removeCommands(response) {
    // Убираем команды в квадратных скобках
    let cleaned = response.replace(/\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO|SAVE_CLIENT_NAME|CANCEL_BOOKING|CONFIRM_BOOKING|MARK_NO_SHOW|RESCHEDULE_BOOKING|CHECK_STAFF_SCHEDULE)[^\]]*\]/g, '');
    
    // Убираем технические фразы в скобках
    cleaned = cleaned.replace(/\([^)]*(?:клиент|тестовое|команду|обратите внимание|поскольку)[^)]*\)/gi, '');
    cleaned = cleaned.replace(/\(Если клиент.*?\)/g, '');
    cleaned = cleaned.replace(/выполню.*?параметрами\./g, '');
    cleaned = cleaned.replace(/service_name=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/date=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/time_preference=.*?(?=\s|$)/g, '');
    
    // Убираем лишние пробелы и переносы строк
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
}

module.exports = new CommandHandler();