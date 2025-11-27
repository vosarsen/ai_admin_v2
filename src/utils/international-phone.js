// src/utils/international-phone.js

/**
 * Централизованная утилита для работы с международными телефонными номерами
 * Поддерживает любые международные форматы
 */

class InternationalPhone {
  /**
   * Нормализует телефон к формату E.164 без +
   * Примеры:
   * +7 900 123 45 67 -> 79001234567
   * 8 900 123 45 67 -> 79001234567
   * +1 647 588 3553 -> 16475883553
   * +44 20 1234 5678 -> 442012345678
   * 
   * @param {string} phone - Телефон в любом формате
   * @returns {string|null} Нормализованный телефон или null
   */
  static normalize(phone) {
    if (!phone) return null;

    // Demo mode: сохраняем demo_ префикс как есть (для демо-чата)
    if (phone.toString().startsWith('demo_')) {
      return phone.toString();
    }

    // Удаляем все нецифровые символы
    let cleaned = phone.toString().replace(/[^\d]/g, '');

    // Обработка WhatsApp формата (79001234567@c.us)
    if (phone.includes('@c.us')) {
      cleaned = phone.split('@')[0].replace(/[^\d]/g, '');
    }
    
    // Обработка российских номеров
    if (cleaned.length === 10 && cleaned.startsWith('9')) {
      // Российский мобильный без кода страны (9xx xxx xx xx)
      cleaned = '7' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('8')) {
      // Российский номер с префиксом 8 (8 9xx xxx xx xx)
      cleaned = '7' + cleaned.substring(1);
    }
    
    // Валидация длины по стандарту E.164
    // Минимум 7 цифр (некоторые страны), максимум 15 цифр
    if (cleaned.length < 7 || cleaned.length > 15) {
      console.warn(`Invalid phone number length: ${phone} -> ${cleaned} (${cleaned.length} digits)`);
      return null;
    }
    
    // Логирование международных номеров для мониторинга
    if (!cleaned.startsWith('7') || cleaned.length !== 11) {
      console.log(`International phone normalized: ${phone} -> ${cleaned}`);
    }
    
    return cleaned;
  }

  /**
   * Форматирует телефон для отображения пользователю с +
   * @param {string} phone - Нормализованный или сырой телефон
   * @returns {string|null} Телефон в формате +79001234567
   */
  static format(phone) {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    return '+' + normalized;
  }

  /**
   * Форматирует телефон для WhatsApp
   * @param {string} phone - Телефон в любом формате
   * @returns {string|null} Телефон в формате 79001234567@c.us
   */
  static formatForWhatsApp(phone) {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    return normalized + '@c.us';
  }

  /**
   * Проверяет валидность телефона
   * @param {string} phone - Телефон в любом формате
   * @returns {boolean}
   */
  static isValid(phone) {
    const normalized = this.normalize(phone);
    return normalized !== null;
  }

  /**
   * Определяет страну по коду телефона
   * @param {string} phone - Телефон в любом формате
   * @returns {string|null} Код страны или название
   */
  static getCountry(phone) {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    
    // Простая таблица маппинга для основных стран
    const countryMap = {
      '7': 'RU/KZ', // Россия/Казахстан
      '1': 'US/CA', // США/Канада
      '44': 'UK',   // Великобритания
      '49': 'DE',   // Германия
      '33': 'FR',   // Франция
      '39': 'IT',   // Италия
      '34': 'ES',   // Испания
      '86': 'CN',   // Китай
      '91': 'IN',   // Индия
      '380': 'UA',  // Украина
      '375': 'BY',  // Беларусь
      '972': 'IL',  // Израиль
      '90': 'TR',   // Турция
    };
    
    // Проверяем по убыванию длины кода страны (от 3 до 1 цифры)
    for (let len = 3; len >= 1; len--) {
      const code = normalized.substring(0, len);
      if (countryMap[code]) {
        return countryMap[code];
      }
    }
    
    return 'Unknown';
  }

  /**
   * Проверяет, является ли номер российским
   * @param {string} phone - Телефон в любом формате
   * @returns {boolean}
   */
  static isRussian(phone) {
    const normalized = this.normalize(phone);
    return normalized && normalized.startsWith('7') && normalized.length === 11;
  }

  /**
   * Создает ключ для Redis/кеша на основе телефона
   * @param {string} phone - Телефон в любом формате
   * @param {string} prefix - Префикс для ключа
   * @returns {string|null} Ключ или null
   */
  static getCacheKey(phone, prefix = '') {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    return prefix + normalized;
  }

  /**
   * Сравнивает два телефона (приводит к нормализованному виду)
   * @param {string} phone1 
   * @param {string} phone2 
   * @returns {boolean}
   */
  static equals(phone1, phone2) {
    const normalized1 = this.normalize(phone1);
    const normalized2 = this.normalize(phone2);
    return normalized1 && normalized2 && normalized1 === normalized2;
  }
}

module.exports = InternationalPhone;