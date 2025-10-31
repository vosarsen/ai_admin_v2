// src/utils/phone-normalizer.js

/**
 * Нормализует номер телефона к единому формату +79XXXXXXXXX
 * @param {string} phone - Номер телефона в любом формате
 * @returns {string} Нормализованный номер телефона
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  
  let normalized = phone.toString();
  
  // Убираем @c.us если есть (WhatsApp формат)
  if (normalized.includes('@c.us')) {
    normalized = normalized.replace('@c.us', '');
  }
  
  // Убираем все нечисловые символы кроме +
  normalized = normalized.replace(/[^\d+]/g, '');
  
  // Добавляем + если его нет
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  
  return normalized;
}

/**
 * Проверяет, является ли номер валидным
 * @param {string} phone - Номер телефона
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  // Проверяем что номер начинается с + и содержит от 10 до 15 цифр
  return /^\+\d{10,15}$/.test(normalized);
}

/**
 * Извлекает номер из WhatsApp ID
 * @param {string} whatsappId - ID в формате 79XXXXXXXXX@c.us
 * @returns {string} Нормализованный номер
 */
function extractPhoneFromWhatsAppId(whatsappId) {
  if (!whatsappId) return whatsappId;
  return normalizePhone(whatsappId);
}

module.exports = {
  normalizePhone,
  isValidPhone,
  extractPhoneFromWhatsAppId
};