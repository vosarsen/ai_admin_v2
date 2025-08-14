const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:command-handler' });
const bookingService = require('../../booking');
const formatter = require('./formatter');
const serviceMatcher = require('./service-matcher');
const contextService = require('../../context');
const errorMessages = require('../../../utils/error-messages');
const FuzzyMatcher = require('../../../utils/fuzzy-matcher');
const businessLogic = require('./business-logic');
const { formatHumanDate, formatWorkingDays } = require('../../../utils/date-formatter');
// dateParser теперь используется из formatter

class CommandHandler {
  /**
   * Извлечение команд из ответа AI с защитой от DoS
   */
  extractCommands(response) {
    // Защита от слишком больших ответов
    const MAX_RESPONSE_LENGTH = 10000;
    const MAX_COMMANDS = 10;
    const MAX_PARAM_LENGTH = 500;
    
    if (!response || typeof response !== 'string') {
      logger.warn('Invalid response type for command extraction');
      return [];
    }
    
    if (response.length > MAX_RESPONSE_LENGTH) {
      logger.warn(`Response too long (${response.length} chars), truncating to ${MAX_RESPONSE_LENGTH}`);
      response = response.substring(0, MAX_RESPONSE_LENGTH);
    }
    
    const commands = [];
    // Безопасный regex с ограничением длины параметров
    const commandRegex = /\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO|CANCEL_BOOKING|SAVE_CLIENT_NAME|CONFIRM_BOOKING|MARK_NO_SHOW|RESCHEDULE_BOOKING|CHECK_STAFF_SCHEDULE)([^\]]{0,500})\]/g;
    
    let match;
    let matchCount = 0;
    
    while ((match = commandRegex.exec(response)) !== null && matchCount < MAX_COMMANDS) {
      matchCount++;
      
      const [fullMatch, command, paramsString] = match;
      
      // Дополнительная проверка длины параметров
      if (paramsString && paramsString.length > MAX_PARAM_LENGTH) {
        logger.warn(`Command params too long for ${command}, skipping`);
        continue;
      }
      
      try {
        const params = this.parseCommandParams(paramsString);
        
        commands.push({
          command,
          params,
          originalText: fullMatch
        });
      } catch (error) {
        logger.error(`Failed to parse command params for ${command}:`, error);
        continue;
      }
    }
    
    if (matchCount >= MAX_COMMANDS) {
      logger.warn(`Too many commands found (${matchCount}), limiting to ${MAX_COMMANDS}`);
    }
    
    return commands;
  }

  /**
   * Парсинг параметров команды с защитой от атак
   */
  parseCommandParams(paramsString) {
    const params = {};
    if (!paramsString) return params;
    
    // Ограничения для защиты
    const MAX_PARAMS = 10;
    const MAX_KEY_LENGTH = 50;
    const MAX_VALUE_LENGTH = 200;
    
    // Санитизация входной строки
    paramsString = paramsString.substring(0, 500);
    
    // Разбираем параметры вида key: value или key=value
    const paramRegex = /(\w+)[:=]\s*([^,]+)/g;
    let match;
    let paramCount = 0;
    
    while ((match = paramRegex.exec(paramsString)) !== null && paramCount < MAX_PARAMS) {
      paramCount++;
      
      const [, key, value] = match;
      const cleanKey = key.trim().substring(0, MAX_KEY_LENGTH);
      const cleanValue = value.trim().substring(0, MAX_VALUE_LENGTH);
      
      // Базовая санитизация значений
      params[cleanKey] = this.sanitizeValue(cleanValue);
    }
    
    if (paramCount >= MAX_PARAMS) {
      logger.warn(`Too many params found (${paramCount}), limiting to ${MAX_PARAMS}`);
    }
    
    return params;
  }
  
  /**
   * Санитизация значения параметра
   */
  sanitizeValue(value) {
    if (!value) return '';
    
    // Удаляем потенциально опасные символы
    return value
      .replace(/[<>'"]/g, '') // Удаляем HTML/SQL символы
      .replace(/[\x00-\x1F\x7F]/g, '') // Удаляем управляющие символы
      .trim();
  }

  /**
   * Санитизация параметров для логирования
   */
  sanitizeParamsForLogging(params) {
    const safe = {};
    const sensitiveKeys = ['phone', 'name', 'client_name', 'email', 'comment'];
    
    for (const [key, value] of Object.entries(params)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        // Маскируем чувствительные данные
        safe[key] = value ? '***' : '';
      } else {
        safe[key] = String(value).substring(0, 50);
      }
    }
    
    return safe;
  }

  /**
   * Выполнение команд с защитой от перегрузки
   */
  async executeCommands(commands, context) {
    const results = [];
    const MAX_EXECUTION_TIME = 30000; // 30 секунд максимум
    const startTime = Date.now();
    
    // Ограничиваем количество команд
    if (commands.length > 10) {
      logger.warn(`Too many commands to execute (${commands.length}), limiting to 10`);
      commands = commands.slice(0, 10);
    }
    
    for (const cmd of commands) {
      // Проверяем таймаут
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        logger.error('Command execution timeout reached, stopping');
        break;
      }
      
      // Не логируем чувствительные данные
      const safeParams = this.sanitizeParamsForLogging(cmd.params);
      logger.info(`Executing command: ${cmd.command}`, safeParams);
      
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
            
          case 'SHOWBOOKINGS':
          case 'SHOW_BOOKINGS':
            const bookingsListResult = await this.showBookings(cmd.params, context);
            results.push({ type: 'bookings_list', data: bookingsListResult });
            break;
        }
      } catch (error) {
        logger.error(`Command ${cmd.command} failed:`, error);
        // Получаем user-friendly сообщение об ошибке
        const errorContext = {
          operation: 'command_execution',
          command: cmd.command,
          params: cmd.params
        };
        const errorResult = errorMessages.getUserMessage(error, errorContext);
        
        results.push({ 
          type: 'error', 
          command: cmd.command,
          error: errorResult.message,
          technicalError: error.message,
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
    // 🔴 КРИТИЧЕСКАЯ ПРОВЕРКА: Проверяем доступность слота перед созданием записи
    if (params.time && context.lastSearch?.slots) {
      const requestedTime = params.time;
      const availableSlots = context.lastSearch.slots;
      
      // Извлекаем времена из слотов
      const availableTimes = availableSlots.map(slot => {
        if (typeof slot === 'string') return slot;
        if (slot.time) return slot.time;
        if (slot.datetime) {
          const timePart = slot.datetime.split('T')[1];
          if (timePart) return timePart.substring(0, 5);
        }
        return null;
      }).filter(Boolean);
      
      logger.info('Checking slot availability before CREATE_BOOKING:', {
        requestedTime,
        availableTimes,
        isAvailable: availableTimes.includes(requestedTime)
      });
      
      // Если время недоступно - НЕ создаём запись
      if (!availableTimes.includes(requestedTime)) {
        logger.warn(`❌ Attempted to book unavailable time: ${requestedTime}`);
        
        // Находим ближайшие альтернативы
        const alternatives = availableTimes
          .filter(time => time !== requestedTime)
          .slice(0, 3);
        
        return {
          success: false,
          error: `Время ${requestedTime} недоступно`,
          alternatives: alternatives,
          message: `К сожалению, время ${requestedTime} уже занято. Доступные слоты: ${alternatives.join(', ')}`
        };
      }
      
      logger.info(`✅ Time ${requestedTime} is available, proceeding with booking`);
    } else if (params.time && !context.lastSearch?.slots) {
      logger.warn('No previous slot search found, will search for availability');
      
      // Если нет предыдущего поиска, выполняем поиск слотов
      try {
        // Определяем услугу и мастера для поиска
        let searchServiceId = params.service_id;
        let searchStaffId = params.staff_id;
        
        // Если передан service_name, находим услугу
        if (params.service_name && !searchServiceId) {
          const service = serviceMatcher.findBestMatch(
            params.service_name, 
            context.services
          );
          if (service) {
            searchServiceId = service.yclients_id;
            logger.info('Found service for search:', {
              query: params.service_name,
              found: service.title,
              serviceId: service.yclients_id
            });
          }
        }
        
        // Если указано имя мастера, находим его
        if (params.staff_name && !searchStaffId) {
          const staffMember = context.staff.find(s => 
            s.name.toLowerCase().includes(params.staff_name.toLowerCase())
          );
          if (staffMember) {
            searchStaffId = staffMember.yclients_id;
            logger.info('Found staff for search:', {
              query: params.staff_name,
              found: staffMember.name,
              staffId: staffMember.yclients_id
            });
          }
        }
        
        // Парсим дату
        const parsedDate = formatter.parseRelativeDate(params.date);
        
        // Выполняем поиск слотов
        logger.info('Performing slot search before booking:', {
          serviceId: searchServiceId,
          staffId: searchStaffId,
          date: parsedDate
        });
        
        const slotsResult = await this.searchSlots(
          {
            service_name: params.service_name,
            service_id: searchServiceId,
            staff_name: params.staff_name,
            staff_id: searchStaffId,
            date: params.date
          },
          context
        );
        
        // Extract actual slots array from the result
        const slots = slotsResult.slots || [];
        
        if (!slots || slots.length === 0) {
          return {
            success: false,
            error: 'Не удалось проверить доступность времени',
            message: 'К сожалению, не могу найти свободные слоты для записи.'
          };
        }
        
        // Обновляем контекст с результатами поиска
        context.lastSearch = {
          slots: slots,
          service_id: searchServiceId,
          staff_id: searchStaffId,
          date: parsedDate
        };
        
        // Проверяем доступность запрашиваемого времени
        const requestedTime = params.time;
        const isAvailable = slots.some(slot => 
          slot.time === requestedTime || 
          slot.time.startsWith(requestedTime)
        );
        
        if (!isAvailable) {
          const alternatives = slots
            .slice(0, 3)
            .map(slot => slot.time);
          
          return {
            success: false,
            error: 'Время недоступно',
            message: `К сожалению, время ${requestedTime} уже занято. Доступные слоты: ${alternatives.join(', ')}`
          };
        }
        
        logger.info(`✅ Time ${requestedTime} is available after search, proceeding with booking`);
        
      } catch (error) {
        logger.error('Failed to search slots before booking:', error);
        return {
          success: false,
          error: 'Ошибка при проверке доступности',
          message: 'Не удалось проверить доступность времени. Попробуйте еще раз.'
        };
      }
    }
    
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
        const unavailableError = new Error(`Время ${requestedTime} недоступно`);
        unavailableError.code = 'TIME_UNAVAILABLE';
        throw unavailableError;
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
      const companyId = context.company?.yclients_id || context.company?.company_id;
      try {
        const redisContext = await contextService.getContext(cleanPhone, companyId);
        if (redisContext && redisContext.clientName) {
          clientName = redisContext.clientName;
        }
        logger.info('Redis context check:', { clientName, redisContext });
      } catch (error) {
        logger.error('Failed to get Redis context:', error);
      }
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
      const nameError = new Error('Требуется имя клиента');
      nameError.code = 'CLIENT_NAME_REQUIRED';
      throw nameError;
    }
    
    // Проверяем, что staff_id определен
    if (!staffId || isNaN(staffId)) {
      logger.error('Staff ID is not defined:', { 
        staffId, 
        params,
        lastSearch: context.lastSearch
      });
      const staffError = new Error('Мастер не определен');
      staffError.code = 'STAFF_NOT_SPECIFIED';
      throw staffError;
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
    
    // Инвалидируем кеш контекста после успешного создания записи
    try {
      await contextService.invalidateCachedContext(
        context.phone || cleanPhone, 
        context.company.company_id || context.company.yclients_id
      );
      logger.info('Context cache invalidated after booking creation');
    } catch (error) {
      logger.error('Failed to invalidate context cache:', error);
      // Не прерываем процесс если не удалось инвалидировать кеш
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
    const { services, message } = context;
    
    // Пытаемся найти категорию или услуги по запросу
    let filteredServices = [];
    let detectedCategory = params.category;
    
    if (message) {
      // Извлекаем ключевые слова из сообщения
      const keywords = FuzzyMatcher.extractKeywords(message);
      const searchQuery = keywords.join(' ') || message;
      
      logger.info(`Searching for services with query: "${searchQuery}"`);
      
      // Используем fuzzy matching для поиска услуг (только по title, так как category_title пустой)
      filteredServices = FuzzyMatcher.findBestMatches(searchQuery, services, {
        keys: ['title'],  // Ищем только по названию услуги
        threshold: 0.15,  // Понижаем порог для большего охвата
        limit: 30
      });
      
      // Если нашли услуги - определяем псевдо-категорию по ключевым словам
      if (filteredServices.length > 0) {
        // Анализируем найденные услуги для определения типа
        const titleLower = filteredServices[0].title?.toLowerCase() || '';
        if (titleLower.includes('стриж')) {
          detectedCategory = 'стрижки';
        } else if (titleLower.includes('бород')) {
          detectedCategory = 'борода и усы';
        } else if (titleLower.includes('окраш') || titleLower.includes('тонир')) {
          detectedCategory = 'окрашивание';
        } else if (titleLower.includes('уход')) {
          detectedCategory = 'уход';
        } else {
          detectedCategory = 'услуги';
        }
        
        logger.info(`Found ${filteredServices.length} services using fuzzy matching`);
      }
    }
    
    // Если указана категория в параметрах - фильтруем по названию услуги
    if (params.category && filteredServices.length === 0) {
      detectedCategory = params.category;
      const searchTerm = detectedCategory.toLowerCase();
      filteredServices = services.filter(service => 
        service.title?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Если после всех попыток ничего не нашли - показываем популярные
    if (filteredServices.length === 0) {
      logger.info('No specific services found, returning popular ones');
      filteredServices = services;
      detectedCategory = 'популярные услуги';
    }
    
    // Сортируем по популярности и весу
    const sorted = businessLogic.sortServicesForClient(filteredServices, context.client);
    
    // Возвращаем структурированные данные
    return {
      category: detectedCategory,
      count: sorted.length,
      prices: sorted.slice(0, 15).map(s => ({
        title: s.title,
        price_min: s.price_min || s.price || 0,
        price_max: s.price_max || s.price || s.price_min || 0,
        duration: s.duration || 60,
        category: s.category_title
      }))
    };
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
    
    // Список слов, которые НЕ являются именами (услуги, дни недели и т.д.)
    const notNames = [
      'стрижка', 'маникюр', 'педикюр', 'окрашивание', 'укладка', 
      'макияж', 'массаж', 'эпиляция', 'брови', 'ресницы', 'стричься',
      'услуга', 'процедура', 'сегодня', 'завтра', 'послезавтра',
      'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье',
      'утром', 'днем', 'вечером', 'утро', 'день', 'вечер',
      'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 
      'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
    ];
    
    // Паттерны для поиска имени (УБИРАЕМ проблемный паттерн с одиночным словом)
    const patterns = [
      /меня зовут\s+([А-ЯЁа-яё]+)/i,
      /я\s+([А-ЯЁа-яё]+)(?:\s|$)/i,  // "я Арсен" - имя после "я" с пробелом
      /я\s*[-–—]\s*([А-ЯЁа-яё]+)/i,
      /это\s+([А-ЯЁа-яё]+)/i
      // УБРАЛИ: /^([А-ЯЁ][а-яё]+)$/m  // Этот паттерн ловил "Стрижка"
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
      'Людмила', 'Маргарита', 'Марина', 'Мария', 'Милана', 'Надежда', 'Наталья', 'Наталия', 'Нина', 'Оксана',
      'Ольга', 'Полина', 'Раиса', 'Регина', 'Светлана', 'София', 'Таисия', 'Тамара', 'Татьяна',
      'Ульяна', 'Юлия', 'Яна'
    ];
    
    // Пробуем найти имя по паттернам
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim();
        // Проверяем, что это не услуга или другое слово из черного списка
        if (!notNames.includes(potentialName.toLowerCase()) && 
            potentialName.length > 1 && 
            potentialName[0] === potentialName[0].toUpperCase()) {
          logger.debug(`Extracted name from pattern: ${potentialName}`);
          return potentialName;
        }
      }
    }
    
    // Проверяем наличие распространенных имен в сообщении
    const words = message.split(/\s+/);
    for (const word of words) {
      // Приводим к правильному регистру для сравнения
      const normalizedWord = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      if (commonNames.includes(normalizedWord)) {
        logger.debug(`Found common name: ${normalizedWord}`);
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
   * Показать список активных записей клиента
   */
  async showBookings(params, context) {
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
    
    // Форматируем список записей для отображения
    const formattedBookings = bookingsResult.bookings.map(booking => {
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
      
      return {
        id: booking.id,
        date: dateStr,
        time: timeStr,
        services: booking.services?.map(s => s.title).join(', ') || 'Услуга не указана',
        staff: booking.staff?.name || 'Мастер не указан',
        status: booking.attendance === 2 ? 'Подтверждена' : 'Ожидает подтверждения'
      };
    });
    
    return {
      success: true,
      bookings: formattedBookings,
      total: formattedBookings.length,
      message: `У вас ${formattedBookings.length} активных записей`
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
    
    let targetBooking = null;
    
    // Если есть параметры для фильтрации, пытаемся найти конкретную запись
    if (params.date || params.time || params.service || params.staff_name) {
      logger.info('Searching for specific booking with params:', params);
      
      targetBooking = bookingsResult.bookings.find(booking => {
        const bookingDate = new Date(booking.datetime);
        
        // Проверяем дату
        if (params.date) {
          const targetDate = new Date(params.date);
          if (bookingDate.toDateString() !== targetDate.toDateString()) {
            return false;
          }
        }
        
        // Проверяем время
        if (params.time) {
          const bookingTime = bookingDate.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          if (!bookingTime.includes(params.time)) {
            return false;
          }
        }
        
        // Проверяем мастера
        if (params.staff_name && booking.staff?.name) {
          if (!booking.staff.name.toLowerCase().includes(params.staff_name.toLowerCase())) {
            return false;
          }
        }
        
        // Проверяем услугу
        if (params.service && booking.services?.length > 0) {
          const hasService = booking.services.some(s => 
            s.title.toLowerCase().includes(params.service.toLowerCase())
          );
          if (!hasService) {
            return false;
          }
        }
        
        return true;
      });
      
      if (!targetBooking) {
        logger.warn('Could not find booking matching params, falling back to latest booking');
      }
    }
    
    // Если конкретная запись не найдена, берём последнюю созданную
    if (!targetBooking) {
      // Сортируем записи по дате/времени записи (ближайшие первыми)
      const sortedBookings = bookingsResult.bookings.sort((a, b) => {
        return new Date(a.datetime) - new Date(b.datetime);
      });
      
      // Берём первую (ближайшую) запись
      targetBooking = sortedBookings[0];
    }
    
    logger.info(`Attempting to cancel booking with ID: ${targetBooking.id}`, {
      datetime: targetBooking.datetime,
      services: targetBooking.services?.map(s => s.title).join(', '),
      staff: targetBooking.staff?.name
    });
    
    // Отменяем выбранную запись
    const cancelResult = await bookingService.cancelBooking(targetBooking.id, context.company.company_id);
    
    if (cancelResult.success) {
      const date = new Date(targetBooking.datetime);
      const dateStr = date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        weekday: 'short'
      });
      const timeStr = date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Инвалидируем кеш контекста после успешной отмены
      try {
        const contextService = require('../../context');
        await contextService.invalidateCachedContext(
          context.phone, 
          context.company.company_id || context.company.yclients_id
        );
        logger.info('Context cache invalidated after booking cancellation');
      } catch (error) {
        logger.error('Failed to invalidate context cache:', error);
      }
      
      return {
        success: true,
        directCancellation: true,
        cancelledBooking: {
          date: dateStr,
          time: timeStr,
          services: targetBooking.services?.map(s => s.title).join(', '),
          staff: targetBooking.staff?.name
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
      
      // Поддерживаем оба формата параметров для обратной совместимости
      const date = params.date || params.new_date;
      const time = params.time || params.new_time;
      
      // Если не указаны новые дата и время, запрашиваем их
      if (!date || !time) {
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
      const targetDate = formatter.parseRelativeDate(date);
      // Формируем дату-время для YClients API (ожидает локальное время)
      const isoDateTime = `${targetDate}T${time}:00`;
      
      logger.info('📅 Date formatting for reschedule', {
        inputDate: date,
        inputTime: time,
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
        time: time,
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
        const requestedTime = time;
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
    
    // Если проверяем конкретного мастера - получим его рабочие дни на ближайшие 14 дней
    let workingDays = [];
    if (staff) {
      const futureDate = new Date(dateStr);
      futureDate.setDate(futureDate.getDate() + 14);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      
      const { data: futureSchedules } = await supabase
        .from('staff_schedules')
        .select('date, is_working, has_booking_slots')
        .eq('staff_id', staff.yclients_id)
        .gte('date', dateStr)
        .lte('date', futureDateStr)
        .eq('is_working', true)
        .eq('has_booking_slots', true)
        .order('date', { ascending: true });
      
      if (futureSchedules && futureSchedules.length > 0) {
        workingDays = futureSchedules.map(s => {
          // Используем человечное форматирование дат
          return formatHumanDate(s.date);
        });
      }
    }
    
    // Формируем результат
    const result = {
      date: dateStr,
      originalDate: date || 'сегодня',
      formattedDate: formatHumanDate(targetDate),
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
    
    // Находим всех кто НЕ работает из тех, кто есть в расписании
    // Если мастера нет в расписании на эту дату - считаем что он не работает
    const scheduledStaffIds = new Set(schedules.map(s => s.staff_id));
    
    context.staff.forEach(staffMember => {
      if (!scheduledStaffIds.has(staffMember.yclients_id) || !workingStaffIds.has(staffMember.yclients_id)) {
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
        formattedDate: result.formattedDate,
        workingDays: workingDays.length > 0 ? workingDays : null,
        workHours: null
      };
      
      // Если мастер работает сегодня - определим часы работы
      if (staffSchedule?.is_working && staffSchedule?.working_hours) {
        try {
          let hours = staffSchedule.working_hours;
          // Если working_hours это массив
          if (Array.isArray(hours) && hours.length > 0) {
            const freeSlots = hours.filter(slot => slot.is_free);
            if (freeSlots.length > 0) {
              const firstTime = freeSlots[0].time;
              const lastTime = freeSlots[freeSlots.length - 1].time;
              result.targetStaff.workHours = `${firstTime}-${lastTime}`;
            }
          }
        } catch (e) {
          logger.debug('Could not parse work hours:', e);
        }
      }
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