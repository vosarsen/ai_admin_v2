/**
 * Context Optimizer for Two-Stage Prompts
 * Динамическая оптимизация контекста для уменьшения размера промптов
 */

/**
 * Извлечение ключевых слов из сообщения
 */
function extractKeywords(message) {
  const keywords = [];

  // Услуги
  if (message.match(/стриж|парикмах|укладк/i)) keywords.push('стрижка', 'волосы');
  if (message.match(/маник|ногт|педик/i)) keywords.push('маникюр', 'педикюр', 'ногти');
  if (message.match(/брови|ресниц/i)) keywords.push('брови', 'ресницы');
  if (message.match(/масса|спа/i)) keywords.push('массаж', 'спа');
  if (message.match(/дет|ребен|сын|дочк/i)) keywords.push('детский', 'детская');
  if (message.match(/борода|усы/i)) keywords.push('борода', 'усы');
  if (message.match(/окрашив|красить|цвет/i)) keywords.push('окрашивание', 'краска');

  // Время
  if (message.match(/сегодня/i)) keywords.push('today');
  if (message.match(/завтра/i)) keywords.push('tomorrow');
  if (message.match(/выходн/i)) keywords.push('weekend');

  return keywords;
}

/**
 * Расчет релевантности услуги
 */
function calculateRelevanceScore(service, keywords, clientHistory = []) {
  let score = 0;
  const serviceLower = service.title.toLowerCase();

  // Проверка истории клиента (максимальный приоритет)
  if (clientHistory.includes(service.title)) {
    score += 100;
  }

  // Проверка ключевых слов
  keywords.forEach(keyword => {
    if (serviceLower.includes(keyword.toLowerCase())) {
      score += 50;
    }
  });

  // Пенализация комплексных услуг (с "+")
  if (service.title.includes('+')) {
    score -= 20;
  }

  // Бонус для популярных услуг
  if (service.popularity > 0.7) {
    score += 10;
  }

  return score;
}

/**
 * Получение релевантных услуг на основе контекста
 */
function getRelevantServices(message, client, services, maxCount = 8) {
  const keywords = extractKeywords(message);
  const clientHistory = client?.last_services || [];

  // Если нет ключевых слов, возвращаем топ услуги клиента или популярные
  if (keywords.length === 0) {
    if (clientHistory.length > 0) {
      // Возвращаем услуги из истории клиента
      const historyServices = services.filter(s =>
        clientHistory.includes(s.title)
      ).slice(0, maxCount);

      if (historyServices.length > 0) {
        return historyServices;
      }
    }

    // Возвращаем популярные услуги
    return services
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, maxCount);
  }

  // Сортировка по релевантности
  return services
    .map(service => ({
      ...service,
      score: calculateRelevanceScore(service, keywords, clientHistory)
    }))
    .sort((a, b) => b.score - a.score)
    .filter(s => s.score > 0) // Только релевантные
    .slice(0, maxCount);
}

/**
 * Определение намерения из сообщения
 */
function detectIntent(message) {
  const messageLower = message.toLowerCase();

  if (messageLower.match(/записат|хочу|можно.*время|свободн/)) {
    return 'booking';
  }

  if (messageLower.match(/цен|стоим|стоит|прайс|сколько.*руб/)) {
    return 'pricing';
  }

  if (messageLower.match(/работает|график|расписан/)) {
    return 'schedule';
  }

  if (messageLower.match(/отмен|перенес/)) {
    return 'cancellation';
  }

  if (messageLower.match(/привет|здравст|добр/)) {
    return 'greeting';
  }

  return 'general';
}

/**
 * Получение минимального контекста на основе намерения
 */
function getContextByIntent(message, fullContext) {
  const intent = detectIntent(message);

  switch(intent) {
    case 'booking':
      return {
        services: getRelevantServices(message, fullContext.client, fullContext.services, 6),
        staff: fullContext.staff.filter(s => s.is_active !== false).slice(0, 5),
        previousSelection: fullContext.currentSelection,
        clientHistory: fullContext.client?.last_services?.slice(0, 3)
      };

    case 'pricing':
      return {
        services: getRelevantServices(message, fullContext.client, fullContext.services, 10),
        categories: [...new Set(fullContext.services.map(s => s.category))].filter(Boolean)
      };

    case 'schedule':
      const staffName = extractStaffName(message);
      return {
        staff: staffName ?
          fullContext.staff.filter(s => s.name.toLowerCase().includes(staffName)) :
          fullContext.staff.slice(0, 8),
        workingHours: fullContext.company.working_hours
      };

    case 'cancellation':
      return {
        lastBooking: fullContext.client?.last_booking,
        clientName: fullContext.client?.name
      };

    case 'greeting':
      return {
        clientName: fullContext.client?.name,
        isNewClient: !fullContext.client?.visit_count
      };

    default:
      return {
        services: fullContext.services.slice(0, 5),
        staff: fullContext.staff.slice(0, 3)
      };
  }
}

/**
 * Извлечение имени мастера из сообщения
 */
function extractStaffName(message) {
  // Простое извлечение имени после ключевых слов
  const match = message.match(/(?:работает|свободен|есть)\s+([А-ЯЁ][а-яё]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Форматирование предложенных слотов компактно
 */
function formatProposedSlots(slots) {
  if (!slots || slots.length === 0) return '';

  return slots.slice(0, 3)
    .map(s => `${s.time}`)
    .join(', ');
}

/**
 * Получение контекстуальных правил на основе сообщения
 */
function getContextualRules(message) {
  const rules = [];

  if (message.match(/\d{1,2}[:.]?\d{0,2}/)) {
    rules.push('время указано → CREATE_BOOKING');
  }

  if (message.match(/свободн|можно|есть.*время/i)) {
    rules.push('поиск времени → SEARCH_SLOTS');
  }

  if (message.match(/да|давай|хорошо|подходит/i)) {
    rules.push('подтверждение → используй контекст');
  }

  if (message.match(/отмен|перенес/i)) {
    rules.push('изменение → CANCEL/RESCHEDULE');
  }

  return rules.length > 0 ? rules.join(', ') : 'стандартные правила';
}

module.exports = {
  extractKeywords,
  calculateRelevanceScore,
  getRelevantServices,
  detectIntent,
  getContextByIntent,
  extractStaffName,
  formatProposedSlots,
  getContextualRules
};