// src/utils/data-transformers.js
const { format, parse, parseISO, isValid } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');
const InternationalPhone = require('./international-phone');

/**
 * Data transformation utilities
 */
class DataTransformers {
  /**
   * Normalize phone number to international format (E.164)
   * Supports any international numbers
   */
  static normalizePhoneNumber(phone) {
    // Используем централизованную утилиту
    return InternationalPhone.format(phone);
  }

  /**
   * Format phone for WhatsApp
   */
  static formatPhoneForWhatsApp(phone) {
    // Используем централизованную утилиту
    return InternationalPhone.formatForWhatsApp(phone);
  }

  /**
   * Format date/time to Moscow timezone
   */
  static formatDateTime(date, formatStr = 'dd.MM.yyyy HH:mm') {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(dateObj)) return '';
    
    const moscowTime = utcToZonedTime(dateObj, 'Europe/Moscow');
    return format(moscowTime, formatStr);
  }

  /**
   * Parse date/time from string
   */
  static parseDateTime(dateStr, formatStr = 'dd.MM.yyyy HH:mm') {
    if (!dateStr) return null;
    
    try {
      // Try ISO format first
      if (dateStr.includes('T') || dateStr.includes('-')) {
        return parseISO(dateStr);
      }
      
      // Parse with format
      return parse(dateStr, formatStr, new Date());
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input, maxLength = 1000) {
    if (!input) return '';
    
    return input
      .toString()
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, maxLength);
  }

  /**
   * Parse number safely
   */
  static parseNumber(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Normalize string for search
   */
  static normalizeString(str) {
    if (!str) return '';
    
    return str
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Format price
   */
  static formatPrice(price) {
    const num = this.parseNumber(price, 0);
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  /**
   * Format duration in minutes to human readable
   */
  static formatDuration(minutes) {
    const mins = this.parseNumber(minutes, 0);
    
    if (mins < 60) {
      return `${mins} мин`;
    }
    
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    
    if (remainingMins === 0) {
      return `${hours} ч`;
    }
    
    return `${hours} ч ${remainingMins} мин`;
  }
}

module.exports = DataTransformers;