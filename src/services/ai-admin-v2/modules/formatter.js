const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:formatter' });
const scheduleAnalyzer = require('./schedule-analyzer');

class Formatter {
  /**
   * Форматирование услуг для отображения
   */
  formatServices(services, businessType) {
    return services.map(s => 
      `- ${s.title} (${s.duration} мин, ${s.price} руб)`
    ).join('\n');
  }

  /**
   * Форматирование персонала
   */
  formatStaff(staff, businessType) {
    return staff.map(s => 
      `- ${s.name} (рейтинг: ${s.rating || '5.0'})`
    ).join('\n');
  }

  /**
   * Форматирование текущего персонала на сегодня
   */
  formatTodayStaff(scheduleByDate, staffList, availableSlots = null) {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedule = scheduleByDate[today] || [];
    
    logger.info(`Formatting today's staff for ${today}:`, {
      scheduleCount: todaySchedule.length,
      scheduleByDateKeys: Object.keys(scheduleByDate),
      staffCount: staffList?.length || 0,
      todaySchedule: todaySchedule,
      scheduleByDate: scheduleByDate
    });
    
    if (todaySchedule.length === 0) {
      logger.warn(`No staff working today (${today})`);
      return "Сегодня никто не работает";
    }
    
    // Фильтруем только работающих мастеров с доступными слотами
    const workingSchedules = todaySchedule.filter(s => s.is_working && s.has_booking_slots);
    
    if (workingSchedules.length === 0) {
      logger.warn(`No staff with available slots today (${today})`);
      return "Сегодня никто не работает";
    }
    
    const workingStaffIds = workingSchedules.map(s => s.staff_id);
    
    logger.info(`Staff IDs from schedule:`, workingStaffIds);
    logger.info(`Staff list IDs:`, staffList.map(s => ({ id: s.yclients_id, name: s.name })));
    
    // Фильтруем мастеров из базы данных
    let workingStaff = staffList.filter(staff => 
      workingStaffIds.includes(staff.yclients_id)
    );
    
    // Если переданы доступные слоты, дополнительно фильтруем по ним
    if (availableSlots) {
      const staffWithSlots = new Set();
      availableSlots.forEach(slot => {
        if (slot.staff_id) {
          staffWithSlots.add(slot.staff_id);
        }
      });
      
      // Фильтруем только тех, у кого есть слоты
      workingStaff = workingStaff.filter(staff => 
        staffWithSlots.has(staff.yclients_id)
      );
      
      logger.info(`Filtered by available slots:`, {
        staffWithSlots: Array.from(staffWithSlots),
        filteredCount: workingStaff.length
      });
    }
    
    logger.info(`Working staff today:`, {
      workingStaffIds,
      workingStaffCount: workingStaff.length,
      workingStaff: workingStaff.map(s => ({ id: s.yclients_id, name: s.name }))
    });
    
    if (workingStaff.length === 0) {
      logger.warn(`No working staff found in staffList for IDs: ${workingStaffIds.join(', ')}`);
      return "Проверяю доступность мастеров...";
    }
    
    return workingStaff.map(staff => {
      const schedule = todaySchedule.find(s => s.staff_id === staff.yclients_id);
      
      // Получаем слоты мастера из working_hours
      const staffSlots = schedule?.working_hours?.seances || [];
      
      // Анализируем рабочие часы мастера
      const workingHours = scheduleAnalyzer.analyzeStaffWorkingHours(staffSlots, staff.name);
      
      if (workingHours.isWorking) {
        return `- ${staff.name} (работает с ${workingHours.startTime} до ${workingHours.endTime})`;
      } else {
        return `- ${staff.name} (не работает)`;
      }
    }).join('\n');
  }

  /**
   * Форматирование расписания персонала
   */
  formatStaffSchedules(scheduleByDate, staffList) {
    const days = Object.keys(scheduleByDate).sort().slice(0, 30);
    return days.map(date => {
      const daySchedule = scheduleByDate[date];
      // Фильтруем только работающих мастеров с доступными слотами
      const workingStaff = daySchedule.filter(s => s.is_working && s.has_booking_slots);
      
      if (workingStaff.length === 0) {
        return `${this.formatDateForDisplay(date)}: никто не работает`;
      }
      
      const staffNames = this.getStaffNames(
        workingStaff.map(s => s.staff_id), 
        staffList
      );
      return `${this.formatDateForDisplay(date)}: ${staffNames}`;
    }).join('\n');
  }

  /**
   * Форматирование истории диалога
   */
  formatConversation(messages) {
    return messages.slice(-5).map(m => 
      `${m.role}: ${m.content}`
    ).join('\n');
  }

  /**
   * Форматирование часов работы
   */
  formatWorkingHours(hours) {
    // Если передана строка (например "10:00-22:00")
    if (typeof hours === 'string') {
      return hours;
    }
    
    // Если передан объект с расписанием по дням
    if (hours && typeof hours === 'object' && !hours.start) {
      // Берем сегодняшний день недели
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = days[new Date().getDay()];
      
      if (hours[today]) {
        return `${hours[today].start || '10:00'}-${hours[today].end || '22:00'}`;
      }
      
      // Если нет данных на сегодня, берем понедельник как образец
      if (hours.monday) {
        return `${hours.monday.start || '10:00'}-${hours.monday.end || '22:00'}`;
      }
    }
    
    // Старый формат с единым расписанием
    return `${hours?.start || '10:00'}-${hours?.end || '22:00'}`;
  }

  /**
   * Форматирование даты
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU');
  }

  /**
   * Форматирование даты для отображения пользователю
   */
  formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T12:00:00'); // Добавляем время для корректной работы с часовыми поясами
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    // Сравниваем только даты без времени
    const dateOnly = dateStr;
    const todayOnly = today.toISOString().split('T')[0];
    const tomorrowOnly = tomorrow.toISOString().split('T')[0];
    
    if (dateOnly === todayOnly) {
      return 'Сегодня';
    } else if (dateOnly === tomorrowOnly) {
      return 'Завтра';
    } else {
      const dayNames = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
      const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      
      const dayOfWeek = dayNames[date.getDay()];
      const day = date.getDate();
      const month = monthNames[date.getMonth()];
      
      return `${dayOfWeek}, ${day} ${month}`;
    }
  }

  /**
   * Парсинг относительной даты
   */
  parseRelativeDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    
    const today = new Date();
    const lowerDate = dateStr.toLowerCase();
    
    if (lowerDate === 'сегодня' || lowerDate === 'today') {
      return today.toISOString().split('T')[0];
    } else if (lowerDate === 'завтра' || lowerDate === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    } else if (lowerDate === 'послезавтра') {
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);
      return dayAfter.toISOString().split('T')[0];
    } else if (lowerDate.includes('понедельник')) {
      return this.getNextWeekday(1);
    } else if (lowerDate.includes('вторник')) {
      return this.getNextWeekday(2);
    } else if (lowerDate.includes('среда')) {
      return this.getNextWeekday(3);
    } else if (lowerDate.includes('четверг')) {
      return this.getNextWeekday(4);
    } else if (lowerDate.includes('пятница')) {
      return this.getNextWeekday(5);
    } else if (lowerDate.includes('суббота')) {
      return this.getNextWeekday(6);
    } else if (lowerDate.includes('воскресенье')) {
      return this.getNextWeekday(0);
    }
    
    // Проверяем формат "число месяц" (например, "7 августа")
    const monthPattern = /(\d{1,2})\s*(январ|феврал|март|апрел|май|мая|июн|июл|август|сентябр|октябр|ноябр|декабр)/i;
    const monthMatch = lowerDate.match(monthPattern);
    if (monthMatch) {
      const day = parseInt(monthMatch[1]);
      const monthStr = monthMatch[2];
      const monthMap = {
        'январ': 0, 'феврал': 1, 'март': 2, 'апрел': 3, 
        'май': 4, 'мая': 4, 'июн': 5, 'июл': 6, 
        'август': 7, 'сентябр': 8, 'октябр': 9, 
        'ноябр': 10, 'декабр': 11
      };
      
      for (const [key, monthIndex] of Object.entries(monthMap)) {
        if (monthStr.startsWith(key)) {
          const year = today.getFullYear();
          const targetDate = new Date(year, monthIndex, day);
          
          // Если дата уже прошла в этом году, берем следующий год
          if (targetDate < today) {
            targetDate.setFullYear(year + 1);
          }
          
          // Форматируем дату правильно для локального времени
          const yearStr = targetDate.getFullYear();
          const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
          const dayStr = String(targetDate.getDate()).padStart(2, '0');
          
          return `${yearStr}-${monthStr}-${dayStr}`;
        }
      }
    }
    
    // Пробуем распарсить как обычную дату
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return today.toISOString().split('T')[0];
  }

  getNextWeekday(targetDay) {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    return targetDate.toISOString().split('T')[0];
  }

  /**
   * Получение имен персонала по ID
   */
  getStaffNames(staffIds, staffList) {
    return staffIds.map(id => {
      const staff = staffList.find(s => s.yclients_id === id);
      return staff ? staff.name : 'Неизвестный мастер';
    }).join(', ');
  }

  /**
   * Форматирование слотов для отображения
   * Возвращает структурированные данные вместо готового текста
   */
  formatSlots(slots, businessType) {
    if (!slots || !slots.length) {
      return null; // AI сам решит как сказать об отсутствии слотов
    }
    
    // Группируем по мастерам если есть
    const byStaff = {};
    slots.forEach(slot => {
      const staffName = slot.staff_name || 'Любой мастер';
      if (!byStaff[staffName]) byStaff[staffName] = [];
      byStaff[staffName].push(slot);
    });
    
    const result = {};
    
    Object.entries(byStaff).slice(0, 3).forEach(([staffName, staffSlots]) => {
      // Группируем по датам
      const byDate = {};
      staffSlots.forEach(slot => {
        // Извлекаем только дату из datetime (убираем время)
        let date;
        if (slot.date) {
          date = slot.date;
        } else if (slot.datetime) {
          // Если datetime в формате ISO, берем только дату
          date = slot.datetime.split('T')[0];
        } else {
          date = new Date().toISOString().split('T')[0];
        }
        
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push(slot);
      });
      
      result[staffName] = {};
      
      // Для каждой даты
      Object.entries(byDate).forEach(([date, dateSlots]) => {
        const formattedDate = this.formatDateForDisplay(date);
        
        // Группируем по времени дня
        const timeGroups = this.groupSlotsByTimeOfDay(dateSlots);
        
        // Проверяем есть ли хотя бы один период с слотами
        const hasSlots = timeGroups.morning.length > 0 || timeGroups.day.length > 0 || timeGroups.evening.length > 0;
        
        if (hasSlots) {
          result[staffName][formattedDate] = {
            morning: timeGroups.morning,
            day: timeGroups.day,
            evening: timeGroups.evening,
            rawDate: date
          };
        }
      });
    });
    
    return result;
  }

  /**
   * Группировка слотов по времени дня (оптимизированная версия)
   */
  groupSlotsByTimeOfDay(slots) {
    logger.info('groupSlotsByTimeOfDay called with slots:', {
      totalSlots: slots.length
    });
    
    const groups = {
      morning: [],  // до 12:00
      day: [],      // 12:00 - 17:00
      evening: []   // после 17:00
    };
    
    // Оптимизированная обработка без создания лишних объектов
    const processedSlots = [];
    
    for (const slot of slots) {
      // Извлекаем время один раз
      let timeStr = slot.time;
      if (!timeStr && slot.datetime) {
        // Оптимизированное извлечение времени
        const tIndex = slot.datetime.indexOf('T');
        if (tIndex !== -1) {
          timeStr = slot.datetime.substring(tIndex + 1, tIndex + 6);
        } else if (slot.datetime.indexOf(' ') !== -1) {
          timeStr = slot.datetime.split(' ')[1]?.substring(0, 5);
        }
      }
      
      if (!timeStr) continue;
      
      // Быстрое извлечение часа без split
      const colonIndex = timeStr.indexOf(':');
      if (colonIndex === -1) continue;
      
      const hour = parseInt(timeStr.substring(0, colonIndex));
      const minutes = parseInt(timeStr.substring(colonIndex + 1, colonIndex + 3));
      
      if (isNaN(hour) || isNaN(minutes)) continue;
      
      const hourDecimal = hour + (minutes / 60);
      
      // Добавляем в соответствующую группу
      const slotInfo = { time: timeStr, hour, minutes, hourDecimal, slot };
      
      if (hour < 12) {
        processedSlots.push({ ...slotInfo, period: 'morning' });
      } else if (hour < 17) {
        processedSlots.push({ ...slotInfo, period: 'day' });
      } else {
        processedSlots.push({ ...slotInfo, period: 'evening' });
      }
    }
    
    // Сортируем один раз все слоты
    processedSlots.sort((a, b) => a.hourDecimal - b.hourDecimal);
    
    // Группируем отсортированные слоты
    const periodSlots = {
      morning: [],
      day: [],
      evening: []
    };
    
    for (const slot of processedSlots) {
      periodSlots[slot.period].push(slot);
    }
    
    // Оптимизированная функция выбора слотов с промежутками
    const selectSlotsWithGaps = (slots, maxCount) => {
      if (slots.length === 0) return [];
      if (slots.length === 1) return [slots[0].time];
      
      // Если слотов меньше или равно maxCount, возвращаем все
      if (slots.length <= maxCount) {
        return slots.map(s => s.time);
      }
      
      // Оптимизированный алгоритм выбора с промежутками
      const selected = [];
      const minGap = 1.0; // Минимальный промежуток 1 час
      let lastSelectedHourDecimal = -999;
      
      // Берем первый слот
      selected.push(slots[0].time);
      lastSelectedHourDecimal = slots[0].hourDecimal;
      
      // Проходим по остальным слотам
      for (let i = 1; i < slots.length && selected.length < maxCount; i++) {
        const slot = slots[i];
        const gap = slot.hourDecimal - lastSelectedHourDecimal;
        
        if (gap >= minGap) {
          selected.push(slot.time);
          lastSelectedHourDecimal = slot.hourDecimal;
        }
      }
      
      // Если выбрали меньше чем нужно, добавляем еще слоты
      if (selected.length < maxCount) {
        // Оптимизированный алгоритм: используем Set для быстрого поиска
        const selectedSet = new Set(selected);
        const slotsToAdd = maxCount - selected.length;
        
        // Равномерно распределяем оставшиеся слоты
        let addedCount = 0;
        const step = Math.ceil(slots.length / slotsToAdd);
        
        for (let i = 0; i < slots.length && addedCount < slotsToAdd; i += step) {
          if (!selectedSet.has(slots[i].time)) {
            selected.push(slots[i].time);
            addedCount++;
          }
        }
      }
      
      return selected;
    };
    
    // Формируем финальные группы с вариативностью (2-3 слота в каждом периоде)
    groups.morning = selectSlotsWithGaps(periodSlots.morning, 3);
    groups.day = selectSlotsWithGaps(periodSlots.day, 3);
    groups.evening = selectSlotsWithGaps(periodSlots.evening, 3);
    
    // Подробный дебаг для отладки
    logger.info('Slot gap selection detailed debug:', {
      morning: {
        input: periodSlots.morning.map(s => ({ 
          time: s.time, 
          hour: s.hour, 
          minutes: s.minutes,
          hourDecimal: s.hourDecimal 
        })),
        output: groups.morning
      },
      day: {
        input: periodSlots.day.map(s => ({ 
          time: s.time, 
          hour: s.hour, 
          minutes: s.minutes,
          hourDecimal: s.hourDecimal 
        })),
        output: groups.day
      },
      evening: {
        input: periodSlots.evening.map(s => ({ 
          time: s.time, 
          hour: s.hour, 
          minutes: s.minutes,
          hourDecimal: s.hourDecimal 
        })),
        output: groups.evening
      }
    });
    
    return groups;
  }

  /**
   * Форматирование подтверждения записи
   */
  formatBookingConfirmation(booking, businessType) {
    // Поддерживаем разные форматы данных записи
    logger.info('formatBookingConfirmation received:', {
      booking: booking,
      bookingType: typeof booking,
      hasRecordId: !!booking?.record_id,
      hasId: !!booking?.id,
      recordIdValue: booking?.record_id,
      idValue: booking?.id
    });
    
    // Форматируем красивое саммари записи
    let summary = '✅ Запись успешно создана!\n\n';
    summary += '📋 Детали вашей записи:\n';
    
    // Дата и время
    if (booking.datetime) {
      const [dateStr, timeStr] = booking.datetime.split(' ');
      const formattedDate = this.formatDateForDisplay(dateStr);
      const time = timeStr ? timeStr.substring(0, 5) : '';
      
      // Добавляем числовую дату после "Завтра" или "Сегодня"
      const date = new Date(dateStr + 'T12:00:00');
      const dateNumber = date.getDate();
      const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                          'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      const month = monthNames[date.getMonth()];
      
      if (formattedDate === 'Завтра' || formattedDate === 'Сегодня') {
        summary += `📅 ${formattedDate} (${dateNumber} ${month})\n`;
      } else {
        summary += `📅 ${formattedDate}\n`;
      }
      summary += `🕐 ${time}\n`;
    }
    
    // Услуга
    if (booking.service_name) {
      summary += `💇 ${booking.service_name}\n`;
    }
    
    // Мастер
    if (booking.staff_name) {
      const masterLabel = businessType === 'barbershop' ? 'Барбер' : 'Мастер';
      summary += `👤 ${masterLabel}: ${booking.staff_name}\n`;
    }
    
    // Адрес (если есть в контексте)
    if (booking.address) {
      summary += `📍 ${booking.address}\n`;
    }
    
    summary += '\n💬 Ждём вас! Если планы изменятся, пожалуйста, предупредите заранее.';
    
    return summary;
  }

  /**
   * Форматирование прайс-листа
   */
  formatPrices(services, businessType) {
    if (!services || services.length === 0) {
      return null; // AI сам решит как сказать об отсутствии прайса
    }
    
    // Определяем тип запроса по первой услуге
    const firstService = services[0]?.title?.toLowerCase() || '';
    let intro = '';
    
    if (firstService.includes('стрижка')) {
      intro = 'Наши цены на стрижки:';
    } else if (firstService.includes('бород')) {
      intro = 'Услуги для бороды и усов:';
    } else if (firstService.includes('маникюр')) {
      intro = 'Наши цены на маникюр:';
    } else if (firstService.includes('педикюр')) {
      intro = 'Наши цены на педикюр:';
    } else if (firstService.includes('бров')) {
      intro = 'Услуги для бровей:';
    } else if (firstService.includes('ресниц')) {
      intro = 'Услуги для ресниц:';
    } else if (firstService.includes('окрашивание')) {
      intro = 'Наши цены на окрашивание:';
    } else {
      intro = 'Наши услуги:';
    }
    
    let text = intro + '\n\n';
    
    // Разделяем услуги на базовые и дополнительные
    const basicServices = [];
    const complexServices = [];
    
    services.forEach(service => {
      const title = service.title?.toLowerCase() || '';
      if (title.includes(' + ') || title.includes('luxina') || title.includes('отец')) {
        complexServices.push(service);
      } else {
        basicServices.push(service);
      }
    });
    
    // Сначала выводим базовые услуги
    if (basicServices.length > 0) {
      basicServices.forEach(service => {
        const price = service.price_min || service.price || 0;
        const priceStr = price > 0 ? `${price} руб` : 'цена по запросу';
        
        const duration = service.seance_length || 
                        service.duration || 
                        service.raw_data?.duration ||
                        0;
        const durationStr = duration ? ` (${Math.round(duration / 60)} мин)` : '';
        
        // Сокращаем длинные названия
        let title = service.title;
        if (title.length > 40) {
          title = title.substring(0, 40) + '...';
        }
        
        text += `${title} - ${priceStr}${durationStr}\n`;
      });
    }
    
    // Если есть комплексные услуги, добавляем их отдельно
    if (complexServices.length > 0 && services.length > 5) {
      text += '\nКомплексные услуги:\n';
      complexServices.slice(0, 3).forEach(service => {
        const price = service.price_min || service.price || 0;
        const priceStr = price > 0 ? `${price} руб` : 'цена по запросу';
        
        // Сокращаем длинные названия
        let title = service.title;
        if (title.length > 40) {
          title = title.substring(0, 40) + '...';
        }
        
        text += `${title} - ${priceStr}\n`;
      });
    }
    
    // Добавляем примечание если услуг много
    if (services.length > 10) {
      text += '\nПолный прайс-лист можно уточнить у администратора.';
    }
    
    return text.trim();
  }

  /**
   * Форматирование истории визитов
   */
  formatVisitHistory(visitHistory) {
    if (!visitHistory || visitHistory.length === 0) {
      return 'новый клиент';
    }
    
    const lastVisit = visitHistory[0];
    const visitCount = visitHistory.length;
    
    return `${visitCount} визитов, последний: ${this.formatDate(lastVisit.date)}`;
  }

  /**
   * Получение сообщения об ошибке
   */
  getErrorMessage(error, businessType) {
    const errorMessages = {
      'no_slots': 'К сожалению, на выбранное время нет свободных слотов. Попробуйте выбрать другое время или день.',
      'booking_failed': 'Не удалось создать запись. Пожалуйста, попробуйте еще раз или позвоните нам.',
      'service_not_found': 'Услуга не найдена. Уточните название или выберите из списка.',
      'default': 'Произошла ошибка. Пожалуйста, попробуйте еще раз.'
    };
    
    return errorMessages[error.code] || errorMessages.default;
  }
  /**
   * Применение форматирования в зависимости от типа бизнеса
   */
  applyBusinessTypeFormatting(text, businessType) {
    if (!text || !businessType) return text;
    
    // Получаем терминологию для типа бизнеса
    const businessLogic = require('./business-logic');
    const terminology = businessLogic.getBusinessTerminology(businessType);
    
    // Применяем замены в тексте в зависимости от типа бизнеса
    let formattedText = text;
    
    switch (businessType) {
      case 'barbershop':
        // Заменяем общие термины на барбершоп-специфичные
        formattedText = formattedText
          .replace(/мастер(?!а)/gi, 'барбер')
          .replace(/мастера/gi, 'барбера')
          .replace(/салон/gi, 'барбершоп')
          .replace(/записаться/gi, 'забронировать время');
        break;
        
      case 'nails':
        // Специфика для ногтевого сервиса
        formattedText = formattedText
          .replace(/салон/gi, 'студия')
          .replace(/парикмахер/gi, 'мастер маникюра');
        break;
        
      case 'massage':
        // Специфика для массажа
        formattedText = formattedText
          .replace(/салон/gi, 'кабинет')
          .replace(/мастер/gi, 'массажист')
          .replace(/стрижка/gi, 'массаж');
        break;
        
      case 'epilation':
        // Специфика для эпиляции
        formattedText = formattedText
          .replace(/салон/gi, 'студия эпиляции')
          .replace(/парикмахер/gi, 'мастер эпиляции');
        break;
        
      case 'brows':
        // Специфика для бровей
        formattedText = formattedText
          .replace(/салон/gi, 'студия красоты')
          .replace(/мастер/gi, 'бровист');
        break;
        
      case 'beauty':
        // Общий салон красоты - минимальные изменения
        formattedText = formattedText
          .replace(/барбершоп/gi, 'салон красоты');
        break;
    }
    
    // Применяем стиль общения из терминологии
    if (terminology.communicationStyle === 'дружелюбным и неформальным') {
      // Делаем текст более неформальным
      formattedText = formattedText
        .replace(/Здравствуйте/gi, 'Привет')
        .replace(/До свидания/gi, 'Пока')
        .replace(/Вы /g, 'ты ')
        .replace(/Вас /g, 'тебя ')
        .replace(/Ваш/gi, 'твой');
    }
    
    return formattedText;
  }

  /**
   * Форматирование подтверждения переноса записи
   */
  formatRescheduleConfirmation(data) {
    try {
      if (!data || !data.newDateTime) {
        return '';
      }

      const oldDate = new Date(data.oldDateTime);
      const newDate = new Date(data.newDateTime);
      
      // Форматируем даты
      const formatter = new Intl.DateTimeFormat('ru', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const oldFormatted = formatter.format(oldDate);
      const newFormatted = formatter.format(newDate);
      
      let response = `✅ ✅ Запись успешно перенесена!\n\n`;
      response += `📋 Детали переноса:\n`;
      response += `❌ Старое время: ${oldFormatted}\n`;
      response += `✅ Новое время: ${newFormatted}\n`;
      
      if (data.services && data.services.length > 0) {
        const serviceName = data.services[0].title || data.services[0].name || 'Услуга';
        response += `💇 Услуга: ${serviceName}\n`;
      }
      
      if (data.staff) {
        const staffName = data.staff.name || data.staff.title || 'Мастер';
        response += `👤 Мастер: ${staffName}\n`;
      }
      
      response += `\n💬 Ждём вас в новое время! Если планы изменятся, пожалуйста, предупредите заранее.`;
      
      return response;
    } catch (error) {
      logger.error('Error formatting reschedule confirmation:', error);
      return '✅ Запись успешно перенесена!';
    }
  }
}

module.exports = new Formatter();