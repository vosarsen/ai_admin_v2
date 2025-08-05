const logger = require('../../../utils/logger').child({ module: 'schedule-analyzer' });

/**
 * Модуль анализа расписания мастеров
 * Определяет реальные рабочие часы на основе доступных слотов
 */
class ScheduleAnalyzer {
  /**
   * Анализирует расписание мастера и определяет его рабочие часы
   * @param {Array} slots - массив слотов из staff_schedules
   * @param {string} staffName - имя мастера
   * @returns {Object} - информация о рабочих часах
   */
  analyzeStaffWorkingHours(slots, staffName) {
    if (!slots || slots.length === 0) {
      return {
        isWorking: false,
        startTime: null,
        endTime: null,
        message: `${staffName} сегодня не работает`
      };
    }

    // Фильтруем только рабочие слоты
    const workingSlots = slots.filter(slot => slot.is_working);
    
    if (workingSlots.length === 0) {
      return {
        isWorking: false,
        startTime: null,
        endTime: null,
        message: `${staffName} сегодня не работает`
      };
    }

    // Находим первый и последний слот
    const times = workingSlots
      .map(slot => slot.time)
      .sort();
    
    const firstSlot = times[0];
    const lastSlot = times[times.length - 1];
    
    // Для последнего слота добавляем длительность сеанса
    const lastSlotDuration = workingSlots.find(s => s.time === lastSlot)?.seance_length || 1800;
    const endTimeMinutes = this.timeToMinutes(lastSlot) + Math.floor(lastSlotDuration / 60);
    const endTime = this.minutesToTime(endTimeMinutes);
    
    logger.info(`Staff working hours analyzed for ${staffName}:`, {
      firstSlot,
      lastSlot,
      endTime,
      totalSlots: workingSlots.length
    });
    
    return {
      isWorking: true,
      startTime: firstSlot,
      endTime: endTime,
      lastAvailableSlot: lastSlot,
      message: `${staffName} работает с ${firstSlot} до ${endTime}`
    };
  }

  /**
   * Анализирует доступные слоты для записи
   * @param {Array} slots - массив слотов
   * @returns {Array} - доступные временные слоты
   */
  getAvailableSlots(slots) {
    if (!slots || slots.length === 0) return [];
    
    return slots
      .filter(slot => slot.is_working && slot.is_free)
      .map(slot => ({
        time: slot.time,
        duration: slot.seance_length,
        datetime: slot.datetime
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  /**
   * Группирует слоты по периодам дня
   * @param {Array} slots - массив слотов
   * @returns {Object} - слоты, сгруппированные по периодам
   */
  groupSlotsByPeriod(slots) {
    const periods = {
      morning: { name: 'Утро', slots: [], range: '10:00-12:00' },
      afternoon: { name: 'День', slots: [], range: '12:00-17:00' },
      evening: { name: 'Вечер', slots: [], range: '17:00-22:00' }
    };
    
    slots.forEach(slot => {
      const minutes = this.timeToMinutes(slot.time);
      
      if (minutes < 720) { // до 12:00
        periods.morning.slots.push(slot);
      } else if (minutes < 1020) { // до 17:00
        periods.afternoon.slots.push(slot);
      } else {
        periods.evening.slots.push(slot);
      }
    });
    
    return periods;
  }

  /**
   * Находит ближайшие доступные слоты
   * @param {Array} slots - массив всех слотов
   * @param {string} preferredTime - предпочитаемое время
   * @param {number} count - количество слотов для поиска
   * @returns {Array} - ближайшие доступные слоты
   */
  findNearestSlots(slots, preferredTime, count = 3) {
    const availableSlots = this.getAvailableSlots(slots);
    
    if (!preferredTime) {
      return availableSlots.slice(0, count);
    }
    
    const targetMinutes = this.timeToMinutes(preferredTime);
    
    // Сортируем по близости к предпочитаемому времени
    const sorted = availableSlots.sort((a, b) => {
      const diffA = Math.abs(this.timeToMinutes(a.time) - targetMinutes);
      const diffB = Math.abs(this.timeToMinutes(b.time) - targetMinutes);
      return diffA - diffB;
    });
    
    return sorted.slice(0, count);
  }

  /**
   * Преобразует время в минуты
   * @param {string} time - время в формате HH:MM
   * @returns {number} - минуты от начала дня
   */
  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Преобразует минуты в время
   * @param {number} minutes - минуты от начала дня
   * @returns {string} - время в формате HH:MM
   */
  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Анализирует загруженность мастера
   * @param {Array} slots - массив слотов
   * @returns {Object} - информация о загруженности
   */
  analyzeStaffLoad(slots) {
    const totalSlots = slots.filter(s => s.is_working).length;
    const busySlots = slots.filter(s => s.is_working && !s.is_free).length;
    const freeSlots = totalSlots - busySlots;
    const loadPercent = totalSlots > 0 ? Math.round((busySlots / totalSlots) * 100) : 0;
    
    return {
      totalSlots,
      busySlots,
      freeSlots,
      loadPercent,
      status: loadPercent > 80 ? 'высокая загрузка' : loadPercent > 50 ? 'средняя загрузка' : 'есть свободные места'
    };
  }
}

module.exports = new ScheduleAnalyzer();