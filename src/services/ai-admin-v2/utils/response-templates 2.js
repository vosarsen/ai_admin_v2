/**
 * Response Templates System
 * Система шаблонов для генерации ответов
 */

const RESPONSE_TEMPLATES = {
  SEARCH_SLOTS: {
    hasSlots: {
      morning: '{{greeting}}{{date}} на {{service}} свободно:\nУтром: {{morningSlots}}\n{{question}}',
      afternoon: '{{greeting}}{{date}} на {{service}} свободно:\nДнём: {{afternoonSlots}}\n{{question}}',
      evening: '{{greeting}}{{date}} на {{service}} свободно:\nВечером: {{eveningSlots}}\n{{question}}',
      mixed: '{{greeting}}{{date}} на {{service}} свободно:\n{{formattedSlots}}\n{{question}}',
      compact: '{{greeting}}Есть время: {{slots}}. Какое подойдёт?'
    },
    noSlots: {
      standard: '{{greeting}}К сожалению, на {{date}} все время занято для {{service}}.',
      withAlternative: '{{greeting}}На {{date}} все занято. Могу предложить {{alternative}}.',
      nextDay: '{{greeting}}Сегодня все занято. Есть время на завтра: {{slots}}.'
    },
    needsService: {
      withHistory: '{{name}}, на какую услугу записаться на {{date}}?\n\nОбычно вы выбираете: {{topServices}}.\n\nКакую выберете?',
      noHistory: '{{name}}, на какую услугу хотите записаться на {{date}}?',
      suggestion: 'Могу предложить {{suggestedServices}}. Что выберете?'
    },
    partialWindow: {
      standard: '{{greeting}}На {{date}} есть окна, но недостаточно времени для полной услуги.\nДоступно: {{windows}}.\nМожно сократить услугу или выбрать другой день.'
    }
  },

  CREATE_BOOKING: {
    success: {
      standard: '{{name}}, записал вас на {{service}} {{formattedDate}} в {{time}} к {{staff}}.\n\nЖдём по адресу: {{address}}.',
      compact: '✅ Записал: {{service}}, {{datetime}}, {{staff}}',
      withReminder: '{{name}}, вы записаны на {{service}} {{datetime}}.\nНапомню за день до визита.',
      firstTime: '{{name}}, рады видеть вас! Записал на {{service}} {{datetime}} к {{staff}}.\n\nАдрес: {{address}}'
    },
    failed: {
      timeTaken: 'К сожалению, {{time}} уже занято.\nБлижайшее время: {{alternatives}}.',
      staffBusy: '{{staff}} не работает {{date}}.\nМогу записать к: {{availableStaff}}.',
      serviceUnavailable: 'Услуга "{{service}}" временно недоступна.',
      general: 'Не удалось создать запись: {{error}}.\nДавайте попробуем другое время?'
    }
  },

  CANCEL_BOOKING: {
    success: {
      standard: 'Ваша запись отменена. Будем рады видеть вас снова!',
      withRefund: 'Запись отменена. Предоплата вернётся в течение 3 дней.',
      multiple: 'Отменил {{count}} записей.'
    },
    noBooking: {
      standard: 'У вас нет активных записей.',
      suggestion: 'У вас нет записей. Хотите записаться?'
    }
  },

  SHOW_PRICES: {
    standard: 'У нас есть следующие {{category}}:\n\n{{services}}\n\nКакая услуга интересует?',
    compact: '{{category}}: {{priceRange}}₽\nПодробный прайс: {{services}}',
    byCategory: '{{categories}}\n\nЧто вас интересует?'
  },

  CHECK_STAFF_SCHEDULE: {
    working: {
      standard: '{{staff}} работает {{date}}.\nСвободное время: {{slots}}.',
      compact: '{{staff}} работает {{date}} с {{startTime}} до {{endTime}}.'
    },
    notWorking: {
      standard: '{{staff}} не работает {{date}}.\nРабочие дни: {{workDays}}.',
      withAlternative: '{{staff}} не работает {{date}}.\nНо работают: {{availableStaff}}.'
    },
    notFound: {
      standard: 'У нас нет мастера "{{staffName}}".\nДоступные мастера: {{availableStaff}}.'
    }
  },

  GREETING: {
    morning: 'Доброе утро{{name}}! {{message}}',
    afternoon: 'Добрый день{{name}}! {{message}}',
    evening: 'Добрый вечер{{name}}! {{message}}',
    night: 'Здравствуйте{{name}}! {{message}}'
  },

  CONFIRMATION: {
    time: 'Отлично! Записываю на {{time}}.',
    service: 'Хорошо, {{service}}. Когда вам удобно?',
    general: 'Принято! {{action}}'
  },

  QUESTIONS: {
    time: 'На какое время вас записать?',
    service: 'Какую услугу выберете?',
    staff: 'К какому мастеру предпочитаете?',
    date: 'На какой день записать?',
    name: 'Как вас зовут?'
  }
};

/**
 * Форматирование времени суток
 */
function categorizeTimeSlots(slots) {
  const morning = [];
  const afternoon = [];
  const evening = [];

  slots.forEach(slot => {
    const hour = parseInt(slot.split(':')[0]);
    if (hour < 12) morning.push(slot);
    else if (hour < 18) afternoon.push(slot);
    else evening.push(slot);
  });

  return { morning, afternoon, evening };
}

/**
 * Рендеринг шаблона с данными
 */
function renderTemplate(template, data) {
  if (!template) return '';

  let result = template;

  // Обработка условных блоков {{?condition}}...{{/condition}}
  result = result.replace(/\{\{\?(\w+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
    return data[key] ? content : '';
  });

  // Замена переменных
  result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key === 'name' && data[key]) {
      return `, ${data[key]}`;
    }
    return data[key] !== undefined ? data[key] : '';
  });

  // Очистка лишних пробелов и переносов
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Выбор подходящего шаблона на основе контекста
 */
function selectTemplate(command, result, context) {
  const templates = RESPONSE_TEMPLATES[command];
  if (!templates) return null;

  // Для SEARCH_SLOTS
  if (command === 'SEARCH_SLOTS') {
    if (result.data?.requiresServiceSelection) {
      return context.client?.last_services?.length > 0 ?
        templates.needsService.withHistory :
        templates.needsService.noHistory;
    }

    if (result.data?.slots?.length > 0) {
      const slots = result.data.slots;
      if (slots.length <= 3) {
        return templates.hasSlots.compact;
      }

      const categorized = categorizeTimeSlots(slots);
      if (categorized.morning.length && !categorized.afternoon.length && !categorized.evening.length) {
        return templates.hasSlots.morning;
      }
      if (categorized.afternoon.length && !categorized.morning.length && !categorized.evening.length) {
        return templates.hasSlots.afternoon;
      }
      if (categorized.evening.length && !categorized.morning.length && !categorized.afternoon.length) {
        return templates.hasSlots.evening;
      }

      return templates.hasSlots.mixed;
    }

    if (result.data?.partialWindows?.length > 0) {
      return templates.partialWindow.standard;
    }

    return templates.noSlots.standard;
  }

  // Для CREATE_BOOKING
  if (command === 'CREATE_BOOKING') {
    if (result.success) {
      if (context.client?.visit_count === 0) {
        return templates.success.firstTime;
      }
      return templates.success.standard;
    }

    if (result.error?.includes('время занято')) {
      return templates.failed.timeTaken;
    }
    if (result.error?.includes('не работает')) {
      return templates.failed.staffBusy;
    }

    return templates.failed.general;
  }

  // Для других команд - выбор по успеху/неудаче
  const category = result.success ? 'success' : 'failed';
  return templates[category]?.standard || templates.standard;
}

/**
 * Форматирование данных для шаблона
 */
function prepareTemplateData(command, result, context) {
  const data = {
    ...result.data,
    name: context.client?.name || '',
    greeting: context.isFirstMessage ? getGreeting() : '',
    question: QUESTIONS.time,
    address: context.company?.address || ''
  };

  // Форматирование слотов
  if (data.slots && Array.isArray(data.slots)) {
    const categorized = categorizeTimeSlots(data.slots);
    data.morningSlots = categorized.morning.join(', ');
    data.afternoonSlots = categorized.afternoon.join(', ');
    data.eveningSlots = categorized.evening.join(', ');
    data.formattedSlots = formatSlotsWithCategories(categorized);
    data.slots = data.slots.slice(0, 5).join(', ') + (data.slots.length > 5 ? '...' : '');
  }

  // Форматирование услуг
  if (data.services && Array.isArray(data.services)) {
    data.services = data.services
      .slice(0, 10)
      .map(s => `- ${s.title}: ${s.price_min}₽`)
      .join('\n');
  }

  // Форматирование даты
  if (data.date) {
    data.formattedDate = formatDate(data.date);
  }

  return data;
}

/**
 * Получение приветствия по времени суток
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Здравствуйте! ';
  if (hour < 12) return 'Доброе утро! ';
  if (hour < 18) return 'Добрый день! ';
  return 'Добрый вечер! ';
}

/**
 * Форматирование слотов с категориями
 */
function formatSlotsWithCategories(categorized) {
  const parts = [];
  if (categorized.morning.length) {
    parts.push(`Утром: ${categorized.morning.join(', ')}`);
  }
  if (categorized.afternoon.length) {
    parts.push(`Днём: ${categorized.afternoon.join(', ')}`);
  }
  if (categorized.evening.length) {
    parts.push(`Вечером: ${categorized.evening.join(', ')}`);
  }
  return parts.join('\n');
}

/**
 * Форматирование даты
 */
function formatDate(date) {
  if (date === 'сегодня' || date === 'завтра') return date;

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return date;

  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  return `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
}

/**
 * Основная функция генерации ответа из шаблона
 */
function generateFromTemplate(command, result, context) {
  const template = selectTemplate(command, result, context);
  if (!template) {
    return `${result.success ? '✅' : '❌'} ${command}: ${JSON.stringify(result.data || result.error)}`;
  }

  const data = prepareTemplateData(command, result, context);
  return renderTemplate(template, data);
}

module.exports = {
  RESPONSE_TEMPLATES,
  renderTemplate,
  selectTemplate,
  prepareTemplateData,
  generateFromTemplate,
  categorizeTimeSlots,
  formatDate,
  getGreeting
};