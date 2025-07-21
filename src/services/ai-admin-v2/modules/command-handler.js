const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:command-handler' });
const bookingService = require('../../booking');
const formatter = require('./formatter');
const serviceMatcher = require('./service-matcher');

class CommandHandler {
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
    // Если AI передал "last", используем данные из последнего поиска
    let serviceId = params.service_id === 'last' ? 
      context.lastSearch?.service_id : parseInt(params.service_id);
    let staffId = params.staff_id === 'last' ? 
      context.lastSearch?.staff_id : parseInt(params.staff_id);
    
    // Если AI передал неправильные ID (1, 2 и т.д.), используем данные из последнего поиска
    if ((!serviceId || serviceId < 1000) && context.lastSearch?.service_id) {
      logger.info('Using service_id from lastSearch:', context.lastSearch.service_id);
      serviceId = context.lastSearch.service_id;
    }
    
    if ((!staffId || staffId < 1000) && context.lastSearch?.staff_id) {
      logger.info('Using staff_id from lastSearch:', context.lastSearch.staff_id);
      staffId = context.lastSearch.staff_id;
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
    
    // Если имени нет в контексте клиента, проверяем Redis
    if (!clientName) {
      const contextService = require('../../context');
      const redisContext = await contextService.getContext(cleanPhone);
      if (redisContext && redisContext.clientName) {
        clientName = redisContext.clientName;
      }
    }
    
    // Если имя все еще не найдено, это ошибка
    if (!clientName) {
      throw new Error('Пожалуйста, сначала представьтесь. Как вас зовут?');
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
    
    const result = await bookingService.createBooking(
      bookingData, 
      context.company.yclients_id || context.company.company_id
    );
    
    // Логируем полный результат для отладки
    logger.info('Booking created successfully:', {
      fullResponse: result
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Не удалось создать запись');
    }
    
    // YClients возвращает вложенную структуру data.data
    const responseData = result.data?.data || result.data || [];
    const bookingRecord = Array.isArray(responseData) ? responseData[0] : responseData;
    
    // Возвращаем объект с нужными полями для отображения
    return {
      id: bookingRecord?.record_id,
      record_id: bookingRecord?.record_id,
      record_hash: bookingRecord?.record_hash,
      service_name: context.lastSearch?.service_name,
      staff_name: context.lastSearch?.staff_name,
      datetime: `${parsedDate} ${params.time}:00`
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
    const redisContext = await contextService.getContext(cleanPhone);
    if (redisContext) {
      redisContext.clientName = params.name;
      await contextService.saveContext(cleanPhone, redisContext);
    }
    
    logger.info('Client name saved:', { phone: cleanPhone, name: params.name });
    
    return {
      name: params.name,
      phone: cleanPhone
    };
  }

  removeCommands(response) {
    // Убираем команды в квадратных скобках
    let cleaned = response.replace(/\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO|SAVE_CLIENT_NAME)[^\]]*\]/g, '');
    
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
}

module.exports = new CommandHandler();