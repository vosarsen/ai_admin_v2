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
    for (const staff of staffToCheck) {
      try {
        const result = await bookingService.findSuitableSlot({
          companyId: context.company.yclients_id || context.company.company_id,
          serviceId: service?.yclients_id,
          staffId: staff?.yclients_id,
          preferredDate: formatter.parseRelativeDate(params.date),
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
    
    // Парсим относительную дату (завтра, послезавтра и т.д.)
    const parsedDate = formatter.parseRelativeDate(params.date);
    logger.info('Parsing date for booking:', { 
      originalDate: params.date, 
      parsedDate: parsedDate,
      time: params.time 
    });
    
    const bookingData = {
      phone: context.client?.phone || context.phone,
      fullname: context.client?.name || '',
      email: context.client?.email || '',
      comment: "Запись через AI администратора WhatsApp",
      appointments: [{
        id: 1,
        services: [serviceId],
        staff_id: staffId,
        datetime: `${parsedDate} ${params.time}:00`
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
   * Получение прайс-листа
   */
  async getPrices(params, context) {
    const { services } = context;
    
    if (params.category) {
      // Ищем по названию услуги, так как category_title часто null
      const searchTerm = params.category.toLowerCase();
      logger.info(`Searching prices for category: "${params.category}"`);
      
      const filtered = services.filter(s => 
        s.title?.toLowerCase().includes(searchTerm) ||
        s.category_title?.toLowerCase().includes(searchTerm) ||
        s.description?.toLowerCase().includes(searchTerm)
      );
      
      logger.info(`Found ${filtered.length} services matching "${params.category}"`);
      
      // Если ничего не нашли, возвращаем все услуги
      return filtered.length > 0 ? filtered : services;
    }
    
    logger.info(`Returning all ${services.length} services`);
    return services;
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
}

module.exports = new CommandHandler();