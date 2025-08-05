const logger = require('../../../utils/logger').child({ module: 'command-executor' });
const bookingService = require('../../booking');
const contextService = require('../../context');
const config = require('../config/modules-config');

/**
 * @typedef {Object} Command
 * @property {string} command - Command name
 * @property {Object} params - Command parameters
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Whether command succeeded
 * @property {string} [error] - Error message if failed
 * @property {*} [data] - Result data
 * @property {string} [type] - Result type
 * @property {Object} [details] - Additional details
 */

/**
 * @typedef {Object} ExecutionContext
 * @property {string} phone - User phone number
 * @property {number} companyId - Company ID
 * @property {Object} company - Company data
 * @property {Array} services - Available services
 * @property {Array} staff - Available staff
 * @property {Array} staffSchedules - Staff schedules
 * @property {Object} client - Client data
 * @property {*} [booking] - Current booking context
 */

/**
 * @callback CommandHandler
 * @param {Object} params - Command parameters
 * @param {ExecutionContext} context - Execution context
 * @returns {Promise<CommandResult>} Command result
 */

/**
 * Модуль для выполнения команд AI
 */
class CommandExecutor {
  constructor() {
    /** @type {Map<string, CommandHandler>} */
    this.commands = new Map();
    this.registerCommands();
  }

  /**
   * Регистрация всех доступных команд
   * @private
   * @returns {void}
   */
  registerCommands() {
    // Команды для поиска
    this.register('SEARCH_SLOTS', this.searchSlots);
    this.register('SEARCH_SERVICES', this.searchServices);
    this.register('SEARCH_STAFF', this.searchStaff);
    
    // Команды для записи
    this.register('CREATE_BOOKING', this.createBooking);
    this.register('CHECK_BOOKING', this.checkBooking);
    this.register('CANCEL_BOOKING', this.cancelBooking);
    this.register('RESCHEDULE_BOOKING', this.rescheduleBooking);
    this.register('CONFIRM_BOOKING', this.confirmBooking);
    this.register('MARK_NO_SHOW', this.markNoShow);
    
    // Команды для информации
    this.register('SHOW_PRICES', this.showPrices);
    this.register('SHOW_PORTFOLIO', this.showPortfolio);
    this.register('SHOW_MY_BOOKINGS', this.showMyBookings);
    this.register('CHECK_STAFF_SCHEDULE', this.checkStaffSchedule);
    
    // Команды для клиента
    this.register('SAVE_CLIENT_NAME', this.saveClientName);
    this.register('UPDATE_PREFERENCES', this.updatePreferences);
  }

  /**
   * Регистрация команды
   * @private
   * @param {string} name - Command name
   * @param {CommandHandler} handler - Command handler
   * @returns {void}
   */
  register(name, handler) {
    this.commands.set(name, handler.bind(this));
  }

  /**
   * Выполнение команды
   * @param {Command} command - Command to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<CommandResult>} Execution result
   */
  async execute(command, context) {
    const { command: commandName, params } = command;
    
    logger.info(`Executing command: ${commandName}`, { params });
    
    // Проверяем существование команды
    if (!this.commands.has(commandName)) {
      logger.warn(`Unknown command: ${commandName}`);
      return {
        success: false,
        error: `Неизвестная команда: ${commandName}`
      };
    }

    try {
      // Выполняем команду
      const handler = this.commands.get(commandName);
      const result = await handler(params, context);
      
      logger.info(`Command ${commandName} executed successfully`, { 
        success: result.success 
      });
      
      return result;
      
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      
      return {
        success: false,
        error: error.message,
        details: error
      };
    }
  }

  /**
   * Выполнение нескольких команд
   * @param {Command[]} commands - Commands to execute
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<Array<{command: string, params: Object, result: CommandResult}>>} Results
   */
  async executeMultiple(commands, context) {
    const results = [];
    
    for (const command of commands) {
      const result = await this.execute(command, context);
      results.push({
        command: command.command,
        params: command.params,
        result
      });
      
      // Если критическая команда не выполнилась, прекращаем
      if (!result.success && this.isCritical(command.command)) {
        logger.warn(`Critical command ${command.command} failed, stopping execution`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Проверка критичности команды
   * @param {string} commandName - Command name
   * @returns {boolean} True if critical
   */
  isCritical(commandName) {
    const criticalCommands = config.commandExecutor.criticalCommands;
    return criticalCommands.includes(commandName);
  }

  // ========== Реализация команд ==========

  /**
   * Поиск свободных слотов
   * @param {Object} params - Parameters
   * @param {string} [params.service_name] - Service name filter
   * @param {string} [params.date] - Date in YYYY-MM-DD format
   * @param {string} [params.time_preference] - Time preference
   * @param {string} [params.staff_name] - Staff name filter
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<CommandResult>} Available slots
   */
  async searchSlots(params, context) {
    try {
      const { service_name, date, time_preference, staff_name } = params;
      
      // Определяем услугу
      let serviceId = null;
      if (service_name) {
        const service = context.services?.find(s => 
          s.title.toLowerCase().includes(service_name.toLowerCase())
        );
        serviceId = service?.id;
      }
      
      // Определяем мастера
      let staffId = null;
      if (staff_name) {
        const staff = context.staff?.find(s => 
          s.name.toLowerCase().includes(staff_name.toLowerCase())
        );
        staffId = staff?.id;
      }
      
      // Ищем слоты
      const slots = await bookingService.getAvailableSlots(
        context.company.id,
        date || new Date().toISOString().split('T')[0],
        serviceId ? [serviceId] : null,
        staffId
      );
      
      return {
        success: true,
        data: slots,
        type: 'slots'
      };
      
    } catch (error) {
      logger.error('Error searching slots:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Поиск услуг
   * @param {Object} params - Parameters
   * @param {string} [params.category] - Category filter
   * @param {string} [params.keywords] - Keywords to search
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<CommandResult>} Matching services
   */
  async searchServices(params, context) {
    try {
      const { category, keywords } = params;
      
      let services = context.services || [];
      
      // Фильтруем по категории
      if (category) {
        services = services.filter(s => 
          s.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      // Фильтруем по ключевым словам
      if (keywords) {
        const keywordList = keywords.toLowerCase().split(',').map(k => k.trim());
        services = services.filter(s => 
          keywordList.some(keyword => 
            s.title.toLowerCase().includes(keyword) ||
            s.comment?.toLowerCase().includes(keyword)
          )
        );
      }
      
      return {
        success: true,
        data: services,
        type: 'services'
      };
      
    } catch (error) {
      logger.error('Error searching services:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Поиск мастеров
   * @param {Object} params - Parameters
   * @param {string} [params.specialization] - Specialization filter
   * @param {string} [params.name] - Name filter
   * @param {ExecutionContext} context - Execution context
   * @returns {Promise<CommandResult>} Matching staff
   */
  async searchStaff(params, context) {
    try {
      const { specialization, name } = params;
      
      let staff = context.staff || [];
      
      // Фильтруем по специализации
      if (specialization) {
        staff = staff.filter(s => 
          s.specialization?.toLowerCase().includes(specialization.toLowerCase())
        );
      }
      
      // Фильтруем по имени
      if (name) {
        staff = staff.filter(s => 
          s.name.toLowerCase().includes(name.toLowerCase())
        );
      }
      
      return {
        success: true,
        data: staff,
        type: 'staff'
      };
      
    } catch (error) {
      logger.error('Error searching staff:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Создание записи
   */
  async createBooking(params, context) {
    try {
      const { service_id, staff_id, datetime, comment } = params;
      
      // Валидация параметров
      if (!service_id || !datetime) {
        return {
          success: false,
          error: 'Не указаны обязательные параметры: услуга и время'
        };
      }
      
      // Создаем запись
      const booking = await bookingService.createBooking({
        phone: context.phone,
        services: [{ id: parseInt(service_id) }],
        staff_id: staff_id ? parseInt(staff_id) : null,
        datetime,
        comment,
        company_id: context.company.id,
        fullname: context.client?.name
      });
      
      return {
        success: true,
        data: booking,
        type: 'booking_created'
      };
      
    } catch (error) {
      logger.error('Error creating booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка возможности записи
   */
  async checkBooking(params, context) {
    try {
      const { service_id, staff_id, datetime } = params;
      
      // Проверяем доступность
      const availability = await bookingService.checkAvailability(
        context.company.id,
        datetime,
        service_id ? parseInt(service_id) : null,
        staff_id ? parseInt(staff_id) : null
      );
      
      return {
        success: true,
        data: availability,
        type: 'availability_check'
      };
      
    } catch (error) {
      logger.error('Error checking booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отмена записи
   */
  async cancelBooking(params, context) {
    try {
      const { booking_id } = params;
      
      if (!booking_id) {
        return {
          success: false,
          error: 'Не указан ID записи для отмены'
        };
      }
      
      // Отменяем запись
      const result = await bookingService.cancelBooking(
        parseInt(booking_id),
        context.company.id
      );
      
      return {
        success: result.success,
        data: result,
        type: 'booking_cancelled',
        error: result.error
      };
      
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Показать цены
   */
  async showPrices(params, context) {
    try {
      const { category, service_name } = params;
      
      let services = context.services || [];
      
      // Фильтруем если нужно
      if (category) {
        services = services.filter(s => 
          s.category?.toLowerCase().includes(category.toLowerCase())
        );
      }
      
      if (service_name) {
        services = services.filter(s => 
          s.title.toLowerCase().includes(service_name.toLowerCase())
        );
      }
      
      // Форматируем для отображения цен
      const priceList = services.map(s => ({
        id: s.id,
        title: s.title,
        price: s.price_min === s.price_max 
          ? s.price_min 
          : `${s.price_min}-${s.price_max}`,
        duration: s.duration,
        category: s.category
      }));
      
      return {
        success: true,
        data: priceList,
        type: 'price_list'
      };
      
    } catch (error) {
      logger.error('Error showing prices:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Показать портфолио
   */
  async showPortfolio(params, context) {
    try {
      const { staff_name, category } = params;
      
      // TODO: Интеграция с системой портфолио
      // Пока возвращаем заглушку
      
      return {
        success: true,
        data: {
          message: 'Портфолио временно недоступно. Вы можете посмотреть наши работы в Instagram или на сайте.'
        },
        type: 'portfolio'
      };
      
    } catch (error) {
      logger.error('Error showing portfolio:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Показать записи клиента
   */
  async showMyBookings(params, context) {
    try {
      const bookings = await bookingService.getClientBookings(
        context.phone,
        context.company.id
      );
      
      return {
        success: true,
        data: bookings,
        type: 'client_bookings'
      };
      
    } catch (error) {
      logger.error('Error showing bookings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Сохранить имя клиента
   */
  async saveClientName(params, context) {
    try {
      const { name } = params;
      
      if (!name) {
        return {
          success: false,
          error: 'Имя не указано'
        };
      }
      
      // Нормализуем номер телефона перед сохранением
      const phone = context.phone?.replace('@c.us', '') || context.phone;
      
      // Обновляем имя клиента
      await contextService.updateContext(phone, context.companyId, { clientInfo: {
        name,
        company_id: context.company.id
      }});
      
      return {
        success: true,
        data: { name },
        type: 'client_updated'
      };
      
    } catch (error) {
      logger.error('Error saving client name:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить предпочтения
   */
  async updatePreferences(params, context) {
    try {
      const { favorite_service, favorite_staff, preferred_time } = params;
      
      const preferences = {};
      
      if (favorite_service) {
        preferences.favorite_service_id = context.services?.find(s => 
          s.title.toLowerCase().includes(favorite_service.toLowerCase())
        )?.id;
      }
      
      if (favorite_staff) {
        preferences.favorite_staff_id = context.staff?.find(s => 
          s.name.toLowerCase().includes(favorite_staff.toLowerCase())
        )?.id;
      }
      
      if (preferred_time) {
        preferences.preferred_time = preferred_time;
      }
      
      // Сохраняем предпочтения
      await contextService.updateContext(context.phone, context.companyId, { 
        preferences: preferences
      });
      
      return {
        success: true,
        data: preferences,
        type: 'preferences_updated'
      };
      
    } catch (error) {
      logger.error('Error updating preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Перенос записи
   */
  async rescheduleBooking(params, context) {
    try {
      const { booking_id, new_datetime } = params;
      
      if (!booking_id || !new_datetime) {
        return {
          success: false,
          error: 'Не указаны обязательные параметры: ID записи и новое время'
        };
      }
      
      // Переносим запись
      const result = await bookingService.rescheduleBooking(
        parseInt(booking_id),
        new_datetime,
        context.company.id
      );
      
      return {
        success: result.success,
        data: result,
        type: 'booking_rescheduled',
        error: result.error
      };
      
    } catch (error) {
      logger.error('Error rescheduling booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Подтверждение записи
   */
  async confirmBooking(params, context) {
    try {
      const { booking_id } = params;
      
      if (!booking_id) {
        return {
          success: false,
          error: 'Не указан ID записи для подтверждения'
        };
      }
      
      // Подтверждаем запись
      const result = await bookingService.confirmBooking(
        parseInt(booking_id),
        context.company.id
      );
      
      return {
        success: result.success,
        data: result,
        type: 'booking_confirmed',
        error: result.error
      };
      
    } catch (error) {
      logger.error('Error confirming booking:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Отметка о неявке
   */
  async markNoShow(params, context) {
    try {
      const { booking_id } = params;
      
      if (!booking_id) {
        return {
          success: false,
          error: 'Не указан ID записи'
        };
      }
      
      // Отмечаем неявку
      const result = await bookingService.markNoShow(
        parseInt(booking_id),
        context.company.id
      );
      
      return {
        success: result.success,
        data: result,
        type: 'marked_no_show',
        error: result.error
      };
      
    } catch (error) {
      logger.error('Error marking no-show:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Проверка расписания персонала
   */
  async checkStaffSchedule(params, context) {
    try {
      const { date, staff_name } = params;
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      // Если указан конкретный мастер
      if (staff_name) {
        const staff = context.staff?.find(s => 
          s.name.toLowerCase().includes(staff_name.toLowerCase())
        );
        
        if (!staff) {
          return {
            success: false,
            error: `Мастер ${staff_name} не найден`
          };
        }
        
        // Проверяем расписание конкретного мастера
        const schedule = context.staffSchedules?.find(s => 
          s.staff_id === staff.yclients_id && 
          s.date === targetDate
        );
        
        return {
          success: true,
          data: {
            staff_name: staff.name,
            date: targetDate,
            is_working: schedule?.is_working || false,
            has_slots: schedule?.has_booking_slots || false,
            working_hours: schedule?.working_hours || null
          },
          type: 'staff_schedule'
        };
      }
      
      // Если мастер не указан, возвращаем всех работающих
      const workingStaff = context.staffSchedules
        ?.filter(s => s.date === targetDate && s.is_working && s.has_booking_slots)
        ?.map(schedule => {
          const staff = context.staff?.find(st => st.yclients_id === schedule.staff_id);
          return {
            name: staff?.name || 'Неизвестный мастер',
            working_hours: schedule.working_hours
          };
        }) || [];
      
      return {
        success: true,
        data: {
          date: targetDate,
          working_staff: workingStaff
        },
        type: 'daily_schedule'
      };
      
    } catch (error) {
      logger.error('Error checking staff schedule:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new CommandExecutor();