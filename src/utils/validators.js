// src/utils/validators.js
// Утилиты для валидации и санитизации входных данных

/**
 * Валидация телефонного номера
 * @param {string} phone - Телефонный номер
 * @returns {boolean} - Валиден ли номер
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;

  // Удаляем все не-цифры
  const cleanPhone = phone.replace(/\D/g, '');

  // Проверяем длину (10-15 цифр)
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return false;
  }

  // Для российских номеров проверяем формат
  if (cleanPhone.startsWith('7') && cleanPhone.length !== 11) {
    return false;
  }

  return true;
}

/**
 * Нормализация телефонного номера
 * @param {string} phone - Телефонный номер
 * @returns {string} - Нормализованный номер (только цифры)
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';

  // Удаляем все не-цифры
  let cleanPhone = phone.replace(/\D/g, '');

  // Для российских номеров убираем лишнюю 8 в начале
  if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
    cleanPhone = '7' + cleanPhone.substring(1);
  }

  return cleanPhone;
}

/**
 * Валидация email
 * @param {string} email - Email адрес
 * @returns {boolean} - Валиден ли email
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;

  // Базовая проверка формата email
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Проверяем длину (максимум 254 символа по RFC)
  if (email.length > 254) return false;

  return emailRegex.test(email);
}

/**
 * Санитизация строки (удаление опасных символов)
 * @param {string} input - Входная строка
 * @param {number} maxLength - Максимальная длина (по умолчанию 255)
 * @returns {string} - Очищенная строка
 */
function sanitizeString(input, maxLength = 255) {
  if (!input) return '';
  if (typeof input !== 'string') return String(input);

  // Удаляем управляющие символы и обрезаем
  let clean = input
    .replace(/[\x00-\x1F\x7F]/g, '') // Удаляем управляющие символы
    .trim()
    .substring(0, maxLength);

  return clean;
}

/**
 * Валидация и санитизация ID (должен быть положительным числом)
 * @param {any} id - ID для проверки
 * @returns {number|null} - Валидный ID или null
 */
function validateId(id) {
  const numId = parseInt(id);

  if (!Number.isInteger(numId) || numId <= 0) {
    return null;
  }

  // Максимальное значение для INT в PostgreSQL
  if (numId > 2147483647) {
    return null;
  }

  return numId;
}

/**
 * Валидация URL
 * @param {string} url - URL для проверки
 * @returns {boolean} - Валиден ли URL
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;

  try {
    const urlObj = new URL(url);
    // Проверяем только http и https протоколы
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Экранирование специальных символов для SQL LIKE запросов
 * @param {string} input - Входная строка
 * @returns {string} - Экранированная строка
 */
function escapeLikePattern(input) {
  if (!input || typeof input !== 'string') return '';

  // Экранируем специальные символы LIKE: %, _, \
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

/**
 * Валидация даты в ISO формате
 * @param {string} dateString - Строка с датой
 * @returns {boolean} - Валидна ли дата
 */
function validateISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Валидация объекта с обязательными полями
 * @param {object} obj - Объект для проверки
 * @param {string[]} requiredFields - Массив обязательных полей
 * @returns {object} - Объект с результатом валидации и ошибками
 */
function validateRequiredFields(obj, requiredFields) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Объект не передан'] };
  }

  for (const field of requiredFields) {
    if (!obj[field]) {
      errors.push(`Поле "${field}" обязательно для заполнения`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Санитизация объекта компании для БД
 * @param {object} companyData - Данные компании
 * @returns {object} - Очищенные данные
 */
function sanitizeCompanyData(companyData) {
  return {
    yclients_id: validateId(companyData.yclients_id),
    company_id: validateId(companyData.company_id || companyData.yclients_id),
    title: sanitizeString(companyData.title, 255),
    phone: normalizePhone(companyData.phone),
    email: validateEmail(companyData.email) ? companyData.email : '',
    address: sanitizeString(companyData.address, 500),
    timezone: sanitizeString(companyData.timezone, 50) || 'Europe/Moscow',
    whatsapp_enabled: Boolean(companyData.whatsapp_enabled),
    ai_enabled: companyData.ai_enabled !== false, // По умолчанию true
    sync_enabled: companyData.sync_enabled !== false, // По умолчанию true
    raw_data: companyData.raw_data || {}
  };
}

module.exports = {
  validatePhone,
  normalizePhone,
  validateEmail,
  sanitizeString,
  validateId,
  validateUrl,
  escapeLikePattern,
  validateISODate,
  validateRequiredFields,
  sanitizeCompanyData
};