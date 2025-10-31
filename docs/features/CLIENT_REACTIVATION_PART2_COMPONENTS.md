# Client Reactivation System - Part 2: Components Details

## 3. Preference Analyzer (`detectors/preference-analyzer.js`)

**Ответственность**: Анализ предпочтений клиента по времени, дням недели, мастерам

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');

class PreferenceAnalyzer {
  /**
   * Проанализировать предпочтения клиента
   *
   * @param {Object} client - Данные клиента
   * @param {number} companyId - ID компании
   * @returns {Promise<Object>} Объект с предпочтениями
   */
  async analyzePreferences(client, companyId) {
    try {
      // Получаем историю визитов клиента
      const { data: history, error } = await supabase
        .from('bookings')
        .select('datetime, staff_id, staff_name, service_ids, services')
        .eq('client_phone', client.phone)
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .order('datetime', { ascending: false })
        .limit(20);  // Последние 20 визитов

      if (error) throw error;

      if (!history || history.length === 0) {
        return this.getDefaultPreferences();
      }

      const preferences = {
        timePreferences: this.analyzeTimePreferences(history),
        dayPreferences: this.analyzeDayPreferences(history),
        staffPreferences: this.analyzeStaffPreferences(history),
        servicePreferences: this.analyzeServicePreferences(history),
        visitPattern: this.analyzeVisitPattern(history),
        confidence: this.calculateConfidence(history.length)
      };

      logger.debug(`📊 Analyzed preferences for ${client.phone}:`, preferences);

      return preferences;

    } catch (error) {
      logger.error('❌ Error analyzing preferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Анализ предпочитаемого времени дня
   */
  analyzeTimePreferences(history) {
    const periods = {
      morning: 0,    // 9:00 - 12:00
      afternoon: 0,  // 12:00 - 17:00
      evening: 0     // 17:00 - 21:00
    };

    for (const visit of history) {
      const hour = new Date(visit.datetime).getHours();

      if (hour >= 9 && hour < 12) {
        periods.morning++;
      } else if (hour >= 12 && hour < 17) {
        periods.afternoon++;
      } else if (hour >= 17 && hour < 21) {
        periods.evening++;
      }
    }

    // Находим самый популярный период
    const total = history.length;
    const percentages = {
      morning: (periods.morning / total) * 100,
      afternoon: (periods.afternoon / total) * 100,
      evening: (periods.evening / total) * 100
    };

    // Определяем предпочитаемый период (если > 40%)
    let preferred = null;
    let preferredPercentage = 0;

    for (const [period, percentage] of Object.entries(percentages)) {
      if (percentage > 40 && percentage > preferredPercentage) {
        preferred = period;
        preferredPercentage = percentage;
      }
    }

    return {
      preferred,
      distribution: percentages,
      confidence: preferredPercentage / 100
    };
  }

  /**
   * Анализ предпочитаемых дней недели
   */
  analyzeDayPreferences(history) {
    const days = {
      1: 0, // Понедельник
      2: 0, // Вторник
      3: 0, // Среда
      4: 0, // Четверг
      5: 0, // Пятница
      6: 0, // Суббота
      0: 0  // Воскресенье
    };

    for (const visit of history) {
      const day = new Date(visit.datetime).getDay();
      days[day]++;
    }

    // Находим топ-3 дня
    const sortedDays = Object.entries(days)
      .map(([day, count]) => ({
        day: parseInt(day),
        count,
        percentage: (count / history.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      topDays: sortedDays.map(d => d.day),
      distribution: days,
      confidence: sortedDays[0]?.percentage / 100 || 0
    };
  }

  /**
   * Анализ предпочитаемых мастеров
   */
  analyzeStaffPreferences(history) {
    const staffCounts = {};

    for (const visit of history) {
      if (visit.staff_id) {
        if (!staffCounts[visit.staff_id]) {
          staffCounts[visit.staff_id] = {
            id: visit.staff_id,
            name: visit.staff_name,
            count: 0
          };
        }
        staffCounts[visit.staff_id].count++;
      }
    }

    const sorted = Object.values(staffCounts)
      .map(staff => ({
        ...staff,
        percentage: (staff.count / history.length) * 100
      }))
      .sort((a, b) => b.count - a.count);

    const favorite = sorted[0];

    return {
      favoriteStaffId: favorite?.id || null,
      favoriteStaffName: favorite?.name || null,
      percentage: favorite?.percentage || 0,
      confidence: (favorite?.percentage || 0) / 100,
      alternatives: sorted.slice(1, 3)
    };
  }

  /**
   * Анализ предпочитаемых услуг
   */
  analyzeServicePreferences(history) {
    const serviceCounts = {};

    for (const visit of history) {
      if (visit.services && Array.isArray(visit.services)) {
        for (const service of visit.services) {
          if (!serviceCounts[service]) {
            serviceCounts[service] = 0;
          }
          serviceCounts[service]++;
        }
      }
    }

    const sorted = Object.entries(serviceCounts)
      .map(([service, count]) => ({
        service,
        count,
        percentage: (count / history.length) * 100
      }))
      .sort((a, b) => b.count - a.count);

    return {
      favoriteService: sorted[0]?.service || null,
      percentage: sorted[0]?.percentage || 0,
      topServices: sorted.slice(0, 3)
    };
  }

  /**
   * Анализ паттерна визитов
   */
  analyzeVisitPattern(history) {
    if (history.length < 2) {
      return null;
    }

    // Сортируем по дате
    const sorted = [...history].sort((a, b) =>
      new Date(a.datetime) - new Date(b.datetime)
    );

    // Вычисляем интервалы между визитами
    const intervals = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = new Date(sorted[i].datetime) - new Date(sorted[i - 1].datetime);
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      intervals.push(days);
    }

    // Средний интервал
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Стандартное отклонение (регулярность)
    const variance = intervals.reduce((sum, interval) =>
      sum + Math.pow(interval - avgInterval, 2), 0
    ) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Регулярность (чем меньше stdDev, тем регулярнее)
    const regularity = 1 - Math.min(stdDev / avgInterval, 1);

    return {
      averageIntervalDays: Math.round(avgInterval),
      regularity: regularity,  // 0-1, где 1 = очень регулярно
      isRegular: regularity > 0.7
    };
  }

  /**
   * Рассчитать уверенность в предпочтениях
   */
  calculateConfidence(historyLength) {
    // Чем больше визитов, тем выше уверенность
    if (historyLength >= 10) return 0.9;
    if (historyLength >= 5) return 0.7;
    if (historyLength >= 3) return 0.5;
    return 0.3;
  }

  /**
   * Дефолтные предпочтения для новых клиентов
   */
  getDefaultPreferences() {
    return {
      timePreferences: {
        preferred: null,
        distribution: { morning: 33, afternoon: 33, evening: 33 },
        confidence: 0
      },
      dayPreferences: {
        topDays: [1, 2, 3, 4, 5],  // Будни
        confidence: 0
      },
      staffPreferences: {
        favoriteStaffId: null,
        favoriteStaffName: null,
        percentage: 0,
        confidence: 0
      },
      servicePreferences: {
        favoriteService: null,
        percentage: 0
      },
      visitPattern: null,
      confidence: 0
    };
  }

  /**
   * Обновить предпочтения в БД (кэширование)
   */
  async cachePreferences(clientPhone, companyId, preferences) {
    try {
      await supabase
        .from('clients')
        .update({
          preferred_time_period: preferences.timePreferences.preferred,
          preferred_days: preferences.dayPreferences.topDays,
          preference_confidence: preferences.confidence
        })
        .eq('phone', clientPhone)
        .eq('company_id', companyId);

      logger.debug(`✅ Cached preferences for ${clientPhone}`);
    } catch (error) {
      logger.warn('Failed to cache preferences:', error);
    }
  }
}

module.exports = PreferenceAnalyzer;
```

---

## 4. Slot Finder (`generators/slot-finder.js`)

**Ответственность**: Поиск подходящих слотов на основе предпочтений клиента

```javascript
const { YclientsClient } = require('../../../integrations/yclients/client');
const logger = require('../../../utils/logger');

class SlotFinder {
  constructor() {
    this.yclientsClient = new YclientsClient();
  }

  /**
   * Найти подходящие слоты для клиента
   *
   * @param {Object} options
   * @param {number} options.companyId - ID компании
   * @param {number} options.serviceId - ID услуги
   * @param {Object} options.preferences - Предпочтения клиента
   * @param {number} options.maxSlots - Максимум слотов (default: 3)
   * @returns {Promise<Array>} Массив подходящих слотов
   */
  async findMatchingSlots(options) {
    const {
      companyId,
      serviceId,
      preferences,
      maxSlots = 3
    } = options;

    try {
      // 1. Получаем доступные даты на следующие 7 дней
      const dateRange = this.getDateRange(7);

      // 2. Получаем слоты из YClients
      const allSlots = await this.fetchAvailableSlots(
        companyId,
        serviceId,
        dateRange
      );

      logger.debug(`📅 Found ${allSlots.length} available slots`);

      if (allSlots.length === 0) {
        return [];
      }

      // 3. Фильтруем по предпочтениям
      const filtered = this.filterByPreferences(allSlots, preferences);

      logger.debug(`✨ Filtered to ${filtered.length} matching slots`);

      // 4. Ранжируем по релевантности
      const ranked = this.rankSlots(filtered, preferences);

      // 5. Возвращаем топ N
      return ranked.slice(0, maxSlots);

    } catch (error) {
      logger.error('❌ Error finding slots:', error);
      return [];
    }
  }

  /**
   * Получить диапазон дат
   */
  getDateRange(days) {
    const dates = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return dates;
  }

  /**
   * Получить доступные слоты из YClients
   */
  async fetchAvailableSlots(companyId, serviceId, dates) {
    const slots = [];

    for (const date of dates) {
      try {
        const dateStr = this.formatDate(date);

        // Получаем сетку доступного времени
        const result = await this.yclientsClient.getBookingDates(companyId, {
          date: dateStr,
          service_id: serviceId
        });

        if (result.success && result.data?.booking_dates) {
          for (const [datetime, staffIds] of Object.entries(result.data.booking_dates)) {
            for (const staffId of staffIds) {
              // Получаем информацию о мастере
              const staff = await this.getStaffInfo(companyId, staffId);

              slots.push({
                datetime: new Date(datetime),
                date: dateStr,
                time: this.formatTime(new Date(datetime)),
                staffId: staffId,
                staffName: staff?.name || 'Специалист',
                serviceId: serviceId
              });
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch slots for ${date}:`, error);
      }
    }

    return slots;
  }

  /**
   * Фильтровать слоты по предпочтениям
   */
  filterByPreferences(slots, preferences) {
    return slots.filter(slot => {
      const datetime = new Date(slot.datetime);
      const hour = datetime.getHours();
      const dayOfWeek = datetime.getDay();

      // 1. Фильтр по времени дня
      if (preferences.timePreferences?.preferred) {
        const period = this.getTimePeriod(hour);
        if (period !== preferences.timePreferences.preferred &&
            preferences.timePreferences.confidence > 0.6) {
          return false;
        }
      }

      // 2. Фильтр по дню недели
      if (preferences.dayPreferences?.topDays?.length > 0 &&
          preferences.dayPreferences.confidence > 0.5) {
        if (!preferences.dayPreferences.topDays.includes(dayOfWeek)) {
          return false;
        }
      }

      // 3. Приоритет любимому мастеру (НЕ фильтр, а бонус при ранжировании)
      // Поэтому здесь не фильтруем

      return true;
    });
  }

  /**
   * Ранжировать слоты по релевантности
   */
  rankSlots(slots, preferences) {
    return slots.map(slot => {
      let score = 0;
      const datetime = new Date(slot.datetime);
      const hour = datetime.getHours();
      const dayOfWeek = datetime.getDay();

      // 1. Бонус за предпочитаемое время (40%)
      if (preferences.timePreferences?.preferred) {
        const period = this.getTimePeriod(hour);
        if (period === preferences.timePreferences.preferred) {
          score += 40 * preferences.timePreferences.confidence;
        }
      }

      // 2. Бонус за предпочитаемый день недели (20%)
      if (preferences.dayPreferences?.topDays?.includes(dayOfWeek)) {
        const dayIndex = preferences.dayPreferences.topDays.indexOf(dayOfWeek);
        score += (20 - dayIndex * 5) * preferences.dayPreferences.confidence;
      }

      // 3. ГЛАВНЫЙ БОНУС за любимого мастера (60%)
      if (preferences.staffPreferences?.favoriteStaffId &&
          slot.staffId === preferences.staffPreferences.favoriteStaffId) {
        score += 60 * preferences.staffPreferences.confidence;
      }

      // 4. Бонус за близость по времени (чем раньше, тем лучше, но не завтра)
      const daysAhead = Math.ceil((datetime - new Date()) / (1000 * 60 * 60 * 24));
      if (daysAhead === 2 || daysAhead === 3) {
        score += 10;  // Послезавтра или через 2 дня - оптимально
      }

      return {
        ...slot,
        score,
        matchReason: this.getMatchReason(slot, preferences)
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Определить период дня по часу
   */
  getTimePeriod(hour) {
    if (hour >= 9 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return null;
  }

  /**
   * Получить причину соответствия
   */
  getMatchReason(slot, preferences) {
    const reasons = [];

    const datetime = new Date(slot.datetime);
    const hour = datetime.getHours();

    // Любимый мастер
    if (preferences.staffPreferences?.favoriteStaffId === slot.staffId) {
      reasons.push(`ваш мастер ${slot.staffName}`);
    }

    // Предпочитаемое время
    if (preferences.timePreferences?.preferred) {
      const period = this.getTimePeriod(hour);
      if (period === preferences.timePreferences.preferred) {
        const periodNames = {
          morning: 'утром',
          afternoon: 'днем',
          evening: 'вечером'
        };
        reasons.push(`ваше любимое время (${periodNames[period]})`);
      }
    }

    return reasons.join(', ');
  }

  /**
   * Получить информацию о мастере
   */
  async getStaffInfo(companyId, staffId) {
    try {
      const { data } = await this.yclientsClient.getStaff(companyId);
      return data?.find(s => s.id === staffId);
    } catch (error) {
      logger.warn(`Failed to get staff info for ${staffId}:`, error);
      return null;
    }
  }

  /**
   * Форматировать дату для API
   */
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Форматировать время для отображения
   */
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

module.exports = SlotFinder;
```

**Логика ранжирования слотов**:
1. **60 баллов** - Любимый мастер (ПРИОРИТЕТ #1)
2. **40 баллов** - Предпочитаемое время дня
3. **20 баллов** - Предпочитаемый день недели
4. **10 баллов** - Оптимальная дистанция (2-3 дня вперед)

---

*Продолжение следует в Part 3...*
