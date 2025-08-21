const logger = require('../../utils/logger').child({ module: 'slot-validator' });
const { format, parseISO, addSeconds, isAfter, isBefore } = require('date-fns');

class SlotValidator {
  /**
   * Валидирует доступность слотов с учетом существующих записей
   * @param {Array} slots - Массив слотов от YClients API
   * @param {Array} existingBookings - Существующие записи мастера
   * @param {number} serviceDuration - Длительность услуги в секундах
   * @returns {Array} Отфильтрованные действительно доступные слоты
   */
  validateSlots(slots, existingBookings = [], serviceDuration = null) {
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return [];
    }

    logger.info(`Validating ${slots.length} slots against ${existingBookings.length} existing bookings`);

    return slots.filter(slot => {
      // Используем длительность из слота или переданную
      const duration = slot.seance_length || serviceDuration || 3600; // По умолчанию 1 час
      
      const slotStart = typeof slot.datetime === 'string' 
        ? parseISO(slot.datetime) 
        : new Date(slot.datetime * 1000); // Unix timestamp
        
      const slotEnd = addSeconds(slotStart, duration);

      logger.debug(`Checking slot ${slot.time}:`, {
        start: format(slotStart, 'HH:mm'),
        end: format(slotEnd, 'HH:mm'),
        duration: duration / 60 + ' min'
      });

      // Проверяем пересечение с существующими записями
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

      // Дополнительная проверка: достаточно ли времени до конца рабочего дня
      // (можно добавить проверку расписания мастера)

      logger.debug(`Slot ${slot.time} is valid`);
      return true;
    });
  }

  /**
   * Проверяет пересечение двух временных интервалов
   */
  checkTimeOverlap(start1, end1, start2, end2) {
    // Интервалы пересекаются если:
    // - начало первого находится внутри второго
    // - конец первого находится внутри второго  
    // - первый полностью включает второй
    return (
      (isAfter(start1, start2) && isBefore(start1, end2)) || // start1 внутри booking
      (isAfter(end1, start2) && isBefore(end1, end2)) ||     // end1 внутри booking
      (isBefore(start1, start2) && isAfter(end1, end2)) ||   // slot полностью покрывает booking
      (isAfter(start1, start2) && isBefore(end1, end2))      // slot внутри booking
    );
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
   * Валидирует и фильтрует слоты с учетом реальной доступности
   */
  async validateSlotsWithBookings(slots, yclientsClient, companyId, staffId, date) {
    // Получаем существующие записи
    const existingBookings = await this.getStaffBookings(
      yclientsClient, 
      companyId, 
      staffId, 
      date
    );

    // Валидируем слоты
    const validSlots = this.validateSlots(slots, existingBookings);

    logger.info(`Validation result: ${validSlots.length}/${slots.length} slots are actually available`);

    return validSlots;
  }
}

module.exports = new SlotValidator();