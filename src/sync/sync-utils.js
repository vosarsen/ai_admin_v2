/**
 * Общие утилиты для синхронизации данных
 * Консолидирует повторяющиеся функции из разных sync модулей
 */

/**
 * Нормализация телефонного номера
 * @param {string} phone - Исходный номер телефона
 * @returns {string|null} Нормализованный номер или null
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Удаляем все не-цифры и заменяем 8 на 7 для российских номеров
  return phone.toString().replace(/\D/g, '').replace(/^8/, '7');
}

/**
 * Расчет уровня лояльности клиента
 * @param {number} visitsCount - Количество визитов
 * @param {number} totalSpent - Общая потраченная сумма
 * @returns {string} Уровень лояльности
 */
function calculateLoyaltyLevel(visitsCount, totalSpent) {
  if (visitsCount >= 20 && totalSpent >= 50000) return 'VIP';
  if (visitsCount >= 10 && totalSpent >= 20000) return 'Gold';
  if (visitsCount >= 5 && totalSpent >= 8000) return 'Silver';
  if (visitsCount >= 2) return 'Bronze';
  return 'New';
}

/**
 * Расчет сегмента клиента (аналог лояльности, но может использовать другие критерии)
 * @param {number} visitsCount - Количество визитов
 * @param {number} totalSpent - Общая потраченная сумма
 * @returns {string} Сегмент клиента
 */
function calculateClientSegment(visitsCount, totalSpent) {
  // Пока используем ту же логику, но можно расширить
  return calculateLoyaltyLevel(visitsCount, totalSpent);
}

/**
 * Задержка выполнения (для соблюдения rate limits)
 * @param {number} ms - Время задержки в миллисекундах
 * @returns {Promise} Promise, который резолвится через указанное время
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Парсинг расписания работы
 * @param {string|Array|Object} schedule - Расписание в разных форматах
 * @returns {Object} Объект с расписанием по дням недели
 */
function parseWorkingHours(schedule) {
  const defaultSchedule = {
    monday: '10:00-21:00',
    tuesday: '10:00-21:00',
    wednesday: '10:00-21:00',
    thursday: '10:00-21:00',
    friday: '10:00-21:00',
    saturday: '10:00-20:00',
    sunday: '10:00-20:00'
  };

  if (!schedule) {
    return defaultSchedule;
  }

  // Если уже объект с правильной структурой
  if (typeof schedule === 'object' && !Array.isArray(schedule)) {
    return { ...defaultSchedule, ...schedule };
  }

  // Если строка (например "Пн-Пт: 10:00-21:00, Сб-Вс: 10:00-20:00")
  if (typeof schedule === 'string') {
    // Простой парсинг, можно расширить при необходимости
    return defaultSchedule;
  }

  // Если массив (например из YClients API)
  if (Array.isArray(schedule)) {
    const parsed = {};
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    schedule.forEach((daySchedule, index) => {
      if (daySchedule && index < dayNames.length) {
        const dayName = dayNames[index];
        if (daySchedule.start && daySchedule.end) {
          parsed[dayName] = `${daySchedule.start}-${daySchedule.end}`;
        }
      }
    });

    return { ...defaultSchedule, ...parsed };
  }

  return defaultSchedule;
}

/**
 * Конфигурация для YClients API
 * Централизованная конфигурация для всех sync модулей
 */
const YCLIENTS_CONFIG = {
  COMPANY_ID: process.env.YCLIENTS_COMPANY_ID || 962302,
  BASE_URL: 'https://api.yclients.com/api/v1',
  BEARER_TOKEN: process.env.YCLIENTS_BEARER_TOKEN,
  USER_TOKEN: process.env.YCLIENTS_USER_TOKEN,
  PARTNER_ID: process.env.YCLIENTS_PARTNER_ID,
  
  // Rate limits
  API_DELAY_MS: 250, // 4 запроса в секунду
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  
  // Пагинация
  PAGE_SIZE: 200,
  MAX_PAGES: 50
};

/**
 * Создание заголовков для YClients API
 * @param {boolean} requireUserToken - Требуется ли user token
 * @returns {Object} Заголовки для запроса
 */
function createYclientsHeaders(requireUserToken = true) {
  const headers = {
    'Accept': 'application/vnd.api.v2+json',
    'Content-Type': 'application/json'
  };

  if (requireUserToken && YCLIENTS_CONFIG.USER_TOKEN) {
    headers['Authorization'] = `Bearer ${YCLIENTS_CONFIG.BEARER_TOKEN}, User ${YCLIENTS_CONFIG.USER_TOKEN}`;
  } else {
    headers['Authorization'] = `Bearer ${YCLIENTS_CONFIG.BEARER_TOKEN}`;
  }

  if (YCLIENTS_CONFIG.PARTNER_ID) {
    headers['X-Partner-ID'] = YCLIENTS_CONFIG.PARTNER_ID;
  }

  return headers;
}

/**
 * Определение типа бизнеса по названию и услугам
 * @param {string} title - Название компании
 * @param {Array} services - Список услуг
 * @returns {string} Тип бизнеса
 */
function detectBusinessType(title = '', services = []) {
  const titleLower = title.toLowerCase();
  const servicesText = services.map(s => s.title || '').join(' ').toLowerCase();
  const combinedText = `${titleLower} ${servicesText}`;

  // Проверяем по ключевым словам
  const typeKeywords = {
    barbershop: ['barbershop', 'барбершоп', 'barber', 'барбер', 'стрижка', 'борода', 'усы', 'бритье'],
    nails: ['nail', 'ногти', 'маникюр', 'педикюр', 'гель-лак', 'наращивание'],
    massage: ['массаж', 'massage', 'спа', 'spa', 'релакс'],
    epilation: ['эпиляция', 'депиляция', 'шугаринг', 'воск', 'лазер'],
    brows: ['брови', 'brow', 'ресницы', 'lash', 'ламинирование'],
    beauty: ['салон', 'beauty', 'косметолог', 'уход', 'процедур']
  };

  for (const [type, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(keyword => combinedText.includes(keyword))) {
      return type;
    }
  }

  return 'beauty'; // По умолчанию
}

/**
 * Форматирование даты для YClients API
 * @param {Date|string} date - Дата
 * @returns {string} Дата в формате YYYY-MM-DD
 */
function formatDateForAPI(date) {
  if (!date) return null;
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

module.exports = {
  // Функции обработки данных
  normalizePhone,
  calculateLoyaltyLevel,
  calculateClientSegment,
  parseWorkingHours,
  detectBusinessType,
  formatDateForAPI,
  
  // Утилиты
  delay,
  
  // Конфигурация и заголовки
  YCLIENTS_CONFIG,
  createYclientsHeaders
};