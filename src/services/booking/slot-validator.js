const logger = require('../../utils/logger').child({ module: 'slot-validator' });
const { format, parseISO, addSeconds, isAfter, isBefore, isEqual } = require('date-fns');

class SlotValidator {
  /**
   * Валидирует доступность слотов с учетом существующих записей
   * @param {Array} slots - Массив слотов от YClients API
   * @param {Array} existingBookings - Существующие записи мастера
   * @param {number} serviceDuration - Длительность услуги в секундах
   * @param {Object} workingHours - Рабочие часы {start: 'HH:mm', end: 'HH:mm'}
   * @returns {Array} Отфильтрованные действительно доступные слоты
   */
  validateSlots(slots, existingBookings = [], serviceDuration = null, workingHours = null) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return [];
    }

    logger.info(`Validating ${slots.length} slots against ${existingBookings.length} existing bookings`);

    // Логируем переданную длительность для отладки
    if (serviceDuration) {
      logger.info(`Using service duration: ${serviceDuration / 60} minutes (passed from database)`);
    }

    // Сортируем записи по времени для проверки следующей записи
    const sortedBookings = [...existingBookings].sort((a, b) => {
      const timeA = typeof a.datetime === 'string' ? parseISO(a.datetime) : new Date(a.datetime * 1000);
      const timeB = typeof b.datetime === 'string' ? parseISO(b.datetime) : new Date(b.datetime * 1000);
      return timeA - timeB;
    });

    return slots.filter(slot => {
      // Приоритет: переданная длительность услуги > длительность из слота > дефолт
      // Это важно, так как YClients может возвращать неправильную длительность
      const duration = serviceDuration || slot.seance_length || 3600; // По умолчанию 1 час
      
      const slotStart = typeof slot.datetime === 'string' 
        ? parseISO(slot.datetime) 
        : new Date(slot.datetime * 1000); // Unix timestamp
        
      const slotEnd = addSeconds(slotStart, duration);

      logger.debug(`Checking slot ${slot.time}:`, {
        start: format(slotStart, 'HH:mm'),
        end: format(slotEnd, 'HH:mm'),
        duration: duration / 60 + ' min'
      });

      // Проверка 1: Хватает ли времени до конца рабочего дня
      if (workingHours && workingHours.end) {
        const workEndTime = workingHours.end; // Формат "22:00"
        const [endHour, endMinute] = workEndTime.split(':').map(Number);
        const workEndDate = new Date(slotStart);
        workEndDate.setHours(endHour, endMinute, 0, 0);
        
        if (isAfter(slotEnd, workEndDate)) {
          logger.warn(`Slot ${slot.time} extends beyond working hours:`, {
            slotEnd: format(slotEnd, 'HH:mm'),
            workEnd: workEndTime
          });
          return false;
        }
      }

      // Проверка 2: Достаточно ли времени до следующей записи
      for (const booking of sortedBookings) {
        const bookingStart = typeof booking.datetime === 'string'
          ? parseISO(booking.datetime)
          : new Date(booking.datetime * 1000);
        
        // Если запись начинается после нашего слота
        if (isAfter(bookingStart, slotStart)) {
          // Проверяем, достаточно ли времени между началом слота и началом следующей записи
          const availableTime = Math.floor((bookingStart - slotStart) / 1000); // в секундах
          
          if (availableTime < duration) {
            logger.warn(`Slot ${slot.time} has insufficient time before next booking:`, {
              slotTime: format(slotStart, 'HH:mm'),
              nextBookingTime: format(bookingStart, 'HH:mm'),
              availableMinutes: availableTime / 60,
              requiredMinutes: duration / 60
            });
            return false;
          }
          // Нашли первую запись после слота, дальше проверять не нужно
          break;
        }
      }

      // Проверка 3: Пересечение с существующими записями (оригинальная логика)
      for (const booking of existingBookings) {
        const bookingStart = typeof booking.datetime === 'string'
          ? parseISO(booking.datetime)
          : new Date(booking.datetime * 1000);
          
        // Длительность записи - сумма всех услуг или дефолт
        const bookingDuration = booking.seance_length || 
                               booking.duration ||
                               (booking.services?.reduce((sum, s) => sum + (s.seance_length || 0), 0)) ||
                               3600;
                               
        const bookingEnd = addSeconds(bookingStart, bookingDuration);

        // Проверяем пересечение
        const hasOverlap = this.checkTimeOverlap(
          slotStart, slotEnd,
          bookingStart, bookingEnd
        );

        if (hasOverlap) {
          logger.warn(`Slot ${slot.time} overlaps with existing booking:`, {
            slotTime: `${format(slotStart, 'HH:mm')}-${format(slotEnd, 'HH:mm')}`,
            bookingTime: `${format(bookingStart, 'HH:mm')}-${format(bookingEnd, 'HH:mm')}`,
            client: booking.client?.name || 'Unknown'
          });
          return false;
        }
      }

      logger.debug(`Slot ${slot.time} is valid`);
      return true;
    });
  }

  /**
   * Проверяет пересечение двух временных интервалов
   */
  checkTimeOverlap(start1, end1, start2, end2) {
    // Интервалы пересекаются если:
    // - начало первого находится внутри второго (включая границы)
    // - конец первого находится внутри второго
    // - первый полностью включает второй
    // - слоты начинаются в одно и то же время
    const overlap = (
      (isEqual(start1, start2)) ||                                    // начинаются одновременно
      (isAfter(start1, start2) && isBefore(start1, end2)) ||         // start1 внутри booking
      (isAfter(end1, start2) && isBefore(end1, end2)) ||            // end1 внутри booking
      (isEqual(end1, end2)) ||                                       // заканчиваются одновременно
      (isBefore(start1, start2) && isAfter(end1, end2))             // slot покрывает booking
    );

    if (overlap) {
      logger.debug(`Time overlap detected:`, {
        slot: `${format(start1, 'HH:mm')}-${format(end1, 'HH:mm')}`,
        booking: `${format(start2, 'HH:mm')}-${format(end2, 'HH:mm')}`
      });
    }

    return overlap;
  }

  /**
   * Получает существующие записи мастера на дату
   */
  async getStaffBookings(yclientsClient, companyId, staffId, date) {
    try {
      const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
      
      logger.info(`Fetching bookings for staff ${staffId} on ${dateStr}`);
      
      const result = await yclientsClient.getRecords(companyId, {
        staff_id: staffId,
        start_date: dateStr,
        end_date: dateStr
      });

      if (!result.success || !result.data) {
        logger.warn('Failed to fetch staff bookings:', result.error);
        return [];
      }

      const bookings = Array.isArray(result.data) ? result.data : 
                      (result.data.data ? result.data.data : []);

      logger.info(`Found ${bookings.length} existing bookings for staff ${staffId}`);
      
      return bookings;
    } catch (error) {
      logger.error('Error fetching staff bookings:', error);
      return [];
    }
  }

  /**
   * Валидирует слоты для услуг с временными ограничениями
   * @param {Array} slots - Массив слотов для проверки
   * @param {Object} service - Информация об услуге из БД (с raw_data)
   * @returns {Array} Отфильтрованные слоты, соответствующие ограничениям услуги
   */
  validateTimeRestrictedSlots(slots, service) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return [];
    }

    if (!service) {
      return slots;
    }

    // Сначала проверяем данные из YClients API
    const rawData = service.raw_data || service;

    // 1. Проверка временных окон из API (seance_search_start/finish)
    if (rawData.seance_search_start !== undefined && rawData.seance_search_finish !== undefined) {
      const startHour = Math.floor(rawData.seance_search_start / 3600); // Секунды в часы
      const endHour = Math.ceil(rawData.seance_search_finish / 3600);

      if (startHour > 0 || endHour < 24) {
        logger.info(`⏰ Service "${service.title}" has YClients time window: ${startHour}:00 - ${endHour}:00`);

        const validSlots = slots.filter(slot => {
          const slotTime = typeof slot.datetime === 'string'
            ? parseISO(slot.datetime)
            : new Date(slot.datetime * 1000);

          const hour = slotTime.getHours();
          const minutes = slotTime.getMinutes();
          const totalMinutes = hour * 60 + minutes;
          const slotSeconds = totalMinutes * 60;

          // Проверяем, попадает ли слот в разрешенное временное окно
          if (slotSeconds < rawData.seance_search_start) {
            logger.debug(`Slot ${slot.time} rejected: too early (before ${startHour}:00)`);
            return false;
          }

          if (slotSeconds >= rawData.seance_search_finish) {
            logger.debug(`Slot ${slot.time} rejected: too late (after ${endHour}:00)`);
            return false;
          }

          return true;
        });

        logger.info(`YClients time window validation: ${validSlots.length}/${slots.length} slots are valid`);
        return validSlots;
      }
    }

    // 2. Фоллбэк на проверку по названию услуги (для УТРО/ДЕНЬ/ВЕЧЕР)
    const serviceTitle = service.title.toLowerCase();
    const restrictions = {
      'утро': { maxHour: 13, message: 'доступна только до 13:00' },
      'день': { minHour: 13, maxHour: 17, message: 'доступна с 13:00 до 17:00' },
      'вечер': { minHour: 17, message: 'доступна только после 17:00' }
    };

    let restriction = null;
    for (const [key, value] of Object.entries(restrictions)) {
      if (serviceTitle.includes(key)) {
        restriction = value;
        logger.info(`⏰ Service "${service.title}" has name-based time restriction: ${value.message}`);
        break;
      }
    }

    if (!restriction) {
      return slots; // Нет ограничений
    }

    // Фильтруем слоты по временным ограничениям из названия
    const validSlots = slots.filter(slot => {
      const slotTime = typeof slot.datetime === 'string'
        ? parseISO(slot.datetime)
        : new Date(slot.datetime * 1000);

      const hour = slotTime.getHours();

      if (restriction.minHour !== undefined && hour < restriction.minHour) {
        logger.debug(`Slot ${slot.time} rejected: too early for ${service.title} (${hour}:00 < ${restriction.minHour}:00)`);
        return false;
      }

      if (restriction.maxHour !== undefined && hour >= restriction.maxHour) {
        logger.debug(`Slot ${slot.time} rejected: too late for ${service.title} (${hour}:00 >= ${restriction.maxHour}:00)`);
        return false;
      }

      return true;
    });

    logger.info(`Name-based time restriction validation: ${validSlots.length}/${slots.length} slots are valid for "${service.title}"`);

    return validSlots;
  }

  /**
   * Валидирует слоты по дням недели для услуг с ограничениями
   * @param {Array} slots - Массив слотов для проверки
   * @param {Object} service - Информация об услуге из БД
   * @param {string} date - Дата для проверки (YYYY-MM-DD)
   * @returns {Array} Отфильтрованные слоты
   */
  validateDateRestrictedSlots(slots, service, date) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return [];
    }

    if (!service || !date) {
      return slots;
    }

    const rawData = service.raw_data || service;

    // Проверка конкретных дат из API
    if (rawData.dates && Array.isArray(rawData.dates) && rawData.dates.length > 0) {
      // Проверяем, есть ли текущая дата в списке разрешенных
      if (!rawData.dates.includes(date)) {
        logger.info(`📅 Service "${service.title}" is not available on ${date} (not in allowed dates list)`);
        return [];
      }
    }

    // Проверка периода доступности
    if (rawData.date_from && rawData.date_from !== '0000-00-00' &&
        rawData.date_to && rawData.date_to !== '0000-00-00') {
      const currentDate = parseISO(date);
      const dateFrom = parseISO(rawData.date_from);
      const dateTo = parseISO(rawData.date_to);

      if (isBefore(currentDate, dateFrom) || isAfter(currentDate, dateTo)) {
        logger.info(`📅 Service "${service.title}" is not available on ${date} (outside date range ${rawData.date_from} - ${rawData.date_to})`);
        return [];
      }
    }

    // Проверка дня недели для услуг типа "для студентов" (пн-чт)
    const serviceTitleLower = service.title.toLowerCase();
    if (serviceTitleLower.includes('студент') || serviceTitleLower.includes('школьник')) {
      const dayOfWeek = new Date(date).getDay();
      // 0 - воскресенье, 1 - понедельник, ..., 6 - суббота
      // Разрешаем только пн-чт (1-4)
      if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        logger.info(`📅 Service "${service.title}" is not available on weekends (only Mon-Thu)`);
        return [];
      }
    }

    return slots;
  }

  /**
   * Валидирует и фильтрует слоты с учетом реальной доступности
   */
  async validateSlotsWithBookings(slots, yclientsClient, companyId, staffId, date, serviceDuration = null, workingHours = null, service = null) {
    // Получаем существующие записи
    const existingBookings = await this.getStaffBookings(
      yclientsClient,
      companyId,
      staffId,
      date
    );

    // Валидируем слоты с учетом длительности услуги и рабочих часов
    let validSlots = this.validateSlots(slots, existingBookings, serviceDuration, workingHours);

    // Дополнительно проверяем ограничения услуги
    if (service) {
      // Проверяем временные ограничения (часы работы)
      validSlots = this.validateTimeRestrictedSlots(validSlots, service);

      // Проверяем ограничения по датам/дням недели
      const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
      validSlots = this.validateDateRestrictedSlots(validSlots, service, dateStr);
    }

    logger.info(`Validation result: ${validSlots.length}/${slots.length} slots are actually available`);

    return validSlots;
  }
}

module.exports = new SlotValidator();