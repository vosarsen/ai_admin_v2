const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:command-handler' });
const bookingService = require('../../booking');
const formatter = require('./formatter');
const serviceMatcher = require('./service-matcher');
const contextService = require('../../context');
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
            // Сохраняем результат проверки для последующего использования в CREATE_BOOKING
            if (scheduleResult.targetStaff) {
              context.lastStaffCheck = {
                staff_name: scheduleResult.targetStaff.name,
                is_working: scheduleResult.targetStaff.isWorking,
                date: scheduleResult.date,
                timestamp: new Date().toISOString()
              };
            }
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
    // Проверяем, если указан конкретный мастер
    if (params.staff_name && context.lastStaffCheck) {
      // Проверяем, что это тот же мастер и дата
      if (context.lastStaffCheck.staff_name === params.staff_name && 
          context.lastStaffCheck.date === formatter.parseRelativeDate(params.date)) {
        
        if (!context.lastStaffCheck.is_working) {
          logger.info('Staff is not working according to previous check:', context.lastStaffCheck);
          return {
            success: false,
            error: `${params.staff_name} не работает ${params.date}`
          };
        }
      }
    }
    
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
    
    // Проверяем, что время указано
    if (!params.time) {
      logger.error('Time is not specified in CREATE_BOOKING:', {
        params,
        message: context.message,
        conversation: context.conversation
      });
      throw new Error('Не указано время для записи. Пожалуйста, укажите желаемое время.');
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
    
    // Найдем информацию о услуге и мастере
    let serviceName = context.lastSearch?.service_name;
    let staffName = context.lastSearch?.staff_name;
    
    // Если нет в lastSearch, ищем по ID
    if (!serviceName && serviceId && context.services) {
      const service = context.services.find(s => s.yclients_id === serviceId);
      if (service) {
        serviceName = service.title;
      }
    }
    
    if (!staffName && staffId && context.staff) {
      const staff = context.staff.find(s => s.yclients_id === staffId);
      if (staff) {
        staffName = staff.name;
      }
    }
    
    // Сохраняем предпочтения клиента после успешной записи
    if (context.phone && serviceName && staffName) {
      try {
        const preferences = {
          favoriteService: serviceName,
          favoriteStaff: staffName,
          preferredTime: params.time.includes(':') ? 
            (parseInt(params.time.split(':')[0]) < 12 ? 'morning' : 
             parseInt(params.time.split(':')[0]) < 17 ? 'afternoon' : 'evening') : 
            'any',
          lastBookingDate: parsedDate
        };
        
        await contextService.savePreferences(
          context.phone.replace('@c.us', ''), 
          context.company.company_id || context.company.yclients_id,
          preferences
        );
        
        logger.info('Client preferences saved after booking:', preferences);
      } catch (error) {
        logger.error('Failed to save preferences:', error);
        // Не прерываем процесс если не удалось сохранить предпочтения
      }
    }
    
    // Возвращаем объект с нужными полями для отображения
    return {
      id: bookingRecord?.record_id,
      record_id: bookingRecord?.record_id,
      record_hash: bookingRecord?.record_hash,
      service_name: serviceName,
      staff_name: staffName,
      datetime: `${parsedDate} ${params.time}:00`,
      address: context.company?.address || null
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
    const companyId = context.company.yclients_id || context.company.company_id;
    await contextService.updateContext(cleanPhone, companyId, {
      clientInfo: { name: params.name }
    });
    
    // Также сохраняем в основной контекст для обратной совместимости
    await contextService.setContext(cleanPhone, companyId, {
      data: { clientName: params.name }
    });
    
    // Инвалидируем кеш контекста чтобы при следующем запросе загрузить обновленные данные
    const aiAdminV2 = require('../index');
    const cacheKey = `${context.phone}_${companyId}`;
    aiAdminV2.contextCache.delete(cacheKey);
    
    logger.info('Client name saved:', { phone: cleanPhone, name: params.name, cacheInvalidated: true });
    
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
    
    // Получаем список всех записей клиента
    const bookingsResult = await bookingService.getClientBookings(phone, context.company.company_id);
    
    if (!bookingsResult.success) {
      return {
        success: false,
        error: bookingsResult.error,
        message: 'Не удалось получить список записей'
      };
    }
    
    if (!bookingsResult.bookings || bookingsResult.bookings.length === 0) {
      return {
        success: true,
        bookings: [],
        message: 'У вас нет активных записей'
      };
    }
    
    // Сортируем записи по дате создания (последние созданные первыми)
    const sortedBookings = bookingsResult.bookings.sort((a, b) => {
      // Если есть поле created_at, используем его
      if (a.created && b.created) {
        return new Date(b.created) - new Date(a.created);
      }
      // Иначе используем ID (больший ID = более новая запись)
      return b.id - a.id;
    });
    
    // Берём последнюю созданную запись
    const lastBooking = sortedBookings[0];
    
    logger.info(`Attempting to cancel last booking with ID: ${lastBooking.id}`, {
      datetime: lastBooking.datetime,
      services: lastBooking.services?.map(s => s.title).join(', '),
      staff: lastBooking.staff?.name
    });
    
    // Отменяем последнюю запись
    const cancelResult = await bookingService.cancelBooking(lastBooking.id, context.company.company_id);
    
    if (cancelResult.success) {
      const date = new Date(lastBooking.datetime);
      const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        weekday: 'short'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return {
        success: true,
        directCancellation: true,
        cancelledBooking: {
          date: dateStr,
          time: timeStr,
          services: lastBooking.services?.map(s => s.title).join(', '),
          staff: lastBooking.staff?.name
        },
        message: `✅ Запись на ${dateStr} в ${timeStr} успешно отменена!`
      };
    } else {
      return {
        success: false,
        error: cancelResult.error,
        message: `Не удалось отменить запись. ${typeof cancelResult.error === 'object' ? JSON.stringify(cancelResult.error) : cancelResult.error}`
      };
    }
    
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
    const companyId = context.company.yclients_id || context.company.company_id;
    
    try {
      // Получаем список записей клиента
      logger.info('📋 Getting bookings for reschedule', { phone, companyId });
      const bookingsResult = await bookingService.getClientBookings(phone, companyId);
      
      if (!bookingsResult.success || !bookingsResult.bookings || bookingsResult.bookings.length === 0) {
        return {
          success: false,
          error: 'У вас нет активных записей'
        };
      }
      
      // Фильтруем только будущие записи
      const now = new Date();
      const futureBookings = bookingsResult.bookings.filter(booking => {
        const bookingDate = new Date(booking.datetime);
        return bookingDate > now;
      });
      
      if (futureBookings.length === 0) {
        return {
          success: false,
          error: 'У вас нет предстоящих записей для переноса'
        };
      }
      
      // Сортируем записи по дате создания (последние созданные первыми)
      futureBookings.sort((a, b) => {
        // Если есть дата создания, используем её
        if (a.create_date && b.create_date) {
          return new Date(b.create_date) - new Date(a.create_date);
        }
        // Иначе сортируем по ID (больший ID = более новая запись)
        return (b.id || 0) - (a.id || 0);
      });
      
      // Если не указаны новые дата и время, запрашиваем их
      if (!params.date || !params.time) {
        return {
          success: false,
          needsDateTime: true,
          bookings: futureBookings,
          message: 'На какую дату и время вы хотите перенести запись?'
        };
      }
      
      // Определяем, какую запись переносить
      let bookingToReschedule;
      
      // Всегда берем последнюю созданную запись (первую после сортировки)
      bookingToReschedule = futureBookings[0];
      
      logger.info('📋 Selected booking for reschedule', {
        bookingId: bookingToReschedule.id,
        datetime: bookingToReschedule.datetime,
        services: bookingToReschedule.services,
        staff: bookingToReschedule.staff,
        createDate: bookingToReschedule.create_date
      });
      const recordId = bookingToReschedule.id;
      
      // Парсим новую дату и время
      const targetDate = formatter.parseRelativeDate(params.date);
      // Формируем дату-время для YClients API (ожидает локальное время)
      const isoDateTime = `${targetDate}T${params.time}:00`;
      
      logger.info('📅 Date formatting for reschedule', {
        inputDate: params.date,
        inputTime: params.time,
        parsedDate: targetDate,
        formattedDateTime: isoDateTime
      });
      
      logger.info('📅 Attempting to reschedule booking', {
        recordId,
        currentDateTime: bookingToReschedule.datetime,
        newDateTime: isoDateTime,
        staffId: bookingToReschedule.staff?.id,
        services: bookingToReschedule.services
      });
      
      // Проверяем доступность нового времени
      const staffId = bookingToReschedule.staff?.id || bookingToReschedule.staff_id;
      const serviceIds = bookingToReschedule.services?.map(s => s.id) || [];
      
      logger.info('🔍 Checking slot availability for reschedule', {
        staffId,
        date: targetDate,
        time: params.time,
        serviceIds
      });
      
      // Получаем доступные слоты
      const yclientsClient = bookingService.getYclientsClient();
      const slotsResult = await yclientsClient.getAvailableSlots(
        staffId,
        targetDate,
        { service_ids: serviceIds },
        companyId
      );
      
      if (slotsResult.success && Array.isArray(slotsResult.data)) {
        // Проверяем, есть ли нужное время в доступных слотах
        const requestedTime = params.time;
        const slotAvailable = slotsResult.data.some(slot => {
          const slotTime = slot.time || slot;
          return slotTime === requestedTime || slotTime === `${requestedTime}:00`;
        });
        
        if (!slotAvailable) {
          // Находим ближайшие доступные слоты
          const nearbySlots = slotsResult.data
            .map(slot => slot.time || slot)
            .filter(time => {
              const slotHour = parseInt(time.split(':')[0]);
              const requestedHour = parseInt(requestedTime.split(':')[0]);
              return Math.abs(slotHour - requestedHour) <= 2; // В пределах 2 часов
            })
            .slice(0, 3);
          
          return {
            success: false,
            slotNotAvailable: true,
            requestedTime: requestedTime,
            nearbySlots: nearbySlots,
            message: `К сожалению, время ${requestedTime} уже занято.`,
            suggestions: nearbySlots.length > 0 
              ? `Доступное время поблизости: ${nearbySlots.join(', ')}`
              : 'В этот день нет доступного времени рядом с желаемым.'
          };
        }
      }
      
      // Пытаемся перенести запись через простой API
      const rescheduleResult = await yclientsClient.rescheduleRecord(
        companyId,
        recordId,
        isoDateTime,
        `Перенос записи через WhatsApp бота`
      );
      
      if (rescheduleResult.success) {
        logger.info('✅ Successfully rescheduled booking', { recordId, newDateTime });
        
        // Обновляем напоминания для новой даты
        // TODO: Добавить обновление напоминаний когда модуль будет доступен
        logger.info('⚠️ Reminder rescheduling skipped - module not available');
        
        return {
          success: true,
          oldDateTime: bookingToReschedule.datetime,
          newDateTime: isoDateTime,
          services: bookingToReschedule.services,
          staff: bookingToReschedule.staff
        };
      }
      
      // Если простой метод не сработал, пробуем через полное обновление
      logger.warn('Simple reschedule failed, trying full update', { error: rescheduleResult.error });
      
      // Проверяем, если это ошибка доступа (403), даем более понятное сообщение
      if (rescheduleResult.error && rescheduleResult.error.includes('403')) {
        logger.error('Permission denied for reschedule - booking may be created through different channel', {
          recordId,
          error: rescheduleResult.error
        });
        
        return {
          success: false,
          permissionError: true,
          error: 'К сожалению, не удалось перенести запись через бота.',
          alternativeAction: 'cancel_and_rebook'
        };
      }
      
      // Получаем длительность услуги для fallback метода
      let seanceLength = 3600; // По умолчанию 1 час
      
      if (bookingToReschedule.services && bookingToReschedule.services.length > 0) {
        const serviceId = bookingToReschedule.services[0].id;
        try {
          const servicesResult = await yclientsClient.getServices({}, companyId);
          if (servicesResult.success && servicesResult.data) {
            const service = servicesResult.data.find(s => s.id === serviceId);
            if (service && service.seance_length) {
              seanceLength = service.seance_length;
              logger.info('Found service seance_length', { serviceId, seanceLength });
            }
          }
        } catch (error) {
          logger.warn('Failed to get service seance_length, using default', { error: error.message });
        }
      }
      
      const updateResult = await yclientsClient.updateRecord(
        companyId,
        recordId,
        {
          datetime: isoDateTime,
          staff_id: bookingToReschedule.staff?.id || bookingToReschedule.staff_id,
          seance_length: seanceLength,
          services: bookingToReschedule.services?.map(s => ({
            id: s.id,
            cost: s.cost || s.price_min || 0,
            discount: s.discount || 0
          })) || [],
          client: {
            phone: phone,
            name: context.client?.name || bookingToReschedule.client?.name || '',
            email: bookingToReschedule.client?.email || ''
          },
          comment: `Перенос записи через WhatsApp бота с ${bookingToReschedule.datetime} на ${isoDateTime}`
        }
      );
      
      if (updateResult.success) {
        logger.info('✅ Successfully rescheduled booking via full update', { recordId, newDateTime: isoDateTime });
        
        // Обновляем напоминания для новой даты
        // TODO: Добавить обновление напоминаний когда модуль будет доступен
        logger.info('⚠️ Reminder rescheduling skipped - module not available');
        
        return {
          success: true,
          oldDateTime: bookingToReschedule.datetime,
          newDateTime: isoDateTime,
          services: bookingToReschedule.services,
          staff: bookingToReschedule.staff
        };
      }
      
      // Если ничего не сработало, возвращаем ошибку
      return {
        success: false,
        error: updateResult.error || 'Не удалось перенести запись'
      };
      
    } catch (error) {
      logger.error('Error in rescheduleBooking:', error);
      return {
        success: false,
        error: error.message || 'Произошла ошибка при переносе записи'
      };
    }
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
      originalDate: date || 'сегодня',
      formattedDate: formatter.formatDate(targetDate),
      staff: [],
      working: [],
      notWorking: [],
      success: true
    };
    
    // Получаем всех мастеров компании
    const allStaffIds = context.staff.map(s => s.yclients_id);
    const workingStaffIds = new Set();
    
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
          workingStaffIds.add(schedule.staff_id);
        }
      });
    }
    
    // Находим всех кто НЕ работает
    context.staff.forEach(staffMember => {
      if (!workingStaffIds.has(staffMember.yclients_id)) {
        result.notWorking.push(staffMember.name);
      }
    });
    
    // Если искали конкретного мастера
    if (staff_name && staff) {
      const staffSchedule = schedules.find(s => s.staff_id === staff.yclients_id);
      result.targetStaff = {
        name: staff.name,
        found: !!staffSchedule,
        isWorking: staffSchedule?.is_working && staffSchedule?.has_booking_slots,
        date: result.originalDate,
        formattedDate: result.formattedDate
      };
    }
    
    return result;
  }

  removeCommands(response) {
    // Убираем команды в квадратных скобках
    let cleaned = response.replace(/\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO|SAVE_CLIENT_NAME|CANCEL_BOOKING|CONFIRM_BOOKING|MARK_NO_SHOW|RESCHEDULE_BOOKING|CHECK_STAFF_SCHEDULE|SHOWBOOKINGS)[^\]]*\]/g, '');
    
    // Убираем технические фразы в скобках (расширенный список)
    cleaned = cleaned.replace(/\([^)]*(?:клиент|тестовое|команду|обратите внимание|поскольку|После выполнения|если.*работает|Если.*работает|После проверки|продолжить запись|предложить альтернативы|сразу запишем)[^)]*\)/gi, '');
    cleaned = cleaned.replace(/\(Если клиент.*?\)/g, '');
    cleaned = cleaned.replace(/\(После.*?\)/gi, '');
    cleaned = cleaned.replace(/\(если.*?\)/gi, '');
    cleaned = cleaned.replace(/выполню.*?параметрами\./g, '');
    cleaned = cleaned.replace(/service_name=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/date=.*?(?=\s|$)/g, '');
    cleaned = cleaned.replace(/time_preference=.*?(?=\s|$)/g, '');
    
    // ВАЖНО: Убираем форматирование WhatsApp (звездочки)
    // Заменяем **текст** на текст
    cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, '$1');
    // Заменяем *текст* на текст
    cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
    // Убираем подчеркивания и другое форматирование
    cleaned = cleaned.replace(/_(.+?)_/g, '$1');
    cleaned = cleaned.replace(/~(.+?)~/g, '$1');
    
    // Убираем лишние пробелы и переносы строк
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
}

module.exports = new CommandHandler();