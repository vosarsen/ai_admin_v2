// src/services/nlu/entity-extractor.js
const logger = require('../../utils/logger');

class EntityExtractor {
  constructor() {
    // Company-specific data will be loaded dynamically
    this.companyData = new Map(); // companyId -> { services, staff }
    
    // Default patterns for new companies or fallback
    this.defaultServicePatterns = {};
    this.defaultStaffPatterns = {};

    this.intentPatterns = {
      'booking': [
        'записать', 'запиши', 'записаться', 'запись', 'хочу записаться',
        'можно записаться', 'свободно', 'доступно', 'слоты', 'время',
        'хочу постричься', 'нужно постричься', 'можно постричься'
      ],
      'reschedule': [
        'перенести', 'изменить', 'перезаписать', 'другое время',
        'изменить запись', 'перенести запись'
      ],
      'cancel': [
        'отменить', 'отмена', 'не приду', 'не смогу прийти',
        'отменить запись', 'отказаться'
      ],
      'info': [
        'сколько стоит', 'цена', 'прайс', 'расценки', 'стоимость',
        'адрес', 'где находится', 'режим работы', 'часы работы',
        'какие цены', 'какая цена', 'какой прайс', 'что почем',
        'услуги', 'какие услуги', 'что делаете', 'кто работает',
        'контакты', 'телефон', 'как добраться', 'график'
      ]
    };

    this.timePatterns = [
      // HH:MM format
      /(\d{1,2}):(\d{2})/g,
      // Natural language times
      /(\d{1,2})\s*(час|утра|дня|вечера|ночи)/g,
      // Relative times
      /(утром|днем|вечером|ночью|рано|поздно)/g
    ];

    this.datePatterns = {
      'сегодня': () => this.formatDate(new Date()),
      'завтра': () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return this.formatDate(tomorrow);
      },
      'послезавтра': () => {
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        return this.formatDate(dayAfter);
      },
      'понедельник': () => this.getNextWeekday(1),
      'вторник': () => this.getNextWeekday(2),
      'среда': () => this.getNextWeekday(3),
      'четверг': () => this.getNextWeekday(4),
      'пятница': () => this.getNextWeekday(5),
      'суббота': () => this.getNextWeekday(6),
      'воскресенье': () => this.getNextWeekday(0)
    };
  }

  /**
   * Update company-specific data from Supabase
   * @param {string} companyId - Company ID
   * @param {Array} services - Array of services from database
   * @param {Array} staff - Array of staff from database
   */
  updateCompanyData(companyId, services = [], staff = []) {
    const servicePatterns = {};
    const staffPatterns = {};

    // Generate patterns from actual service names
    services.forEach(service => {
      const title = service.title.toLowerCase();
      const patterns = [title];
      
      // Add common variations
      if (title.includes('стрижк')) {
        patterns.push('стрижк', 'постричь', 'подстричь', 'постригс');
      }
      if (title.includes('бород')) {
        patterns.push('борода', 'бород', 'бороду');
      }
      if (title.includes('маникюр')) {
        patterns.push('маникюр', 'ногти', 'ноготки');
      }
      if (title.includes('педикюр')) {
        patterns.push('педикюр', 'стопы', 'ножки');
      }
      
      servicePatterns[service.yclients_id] = {
        title: service.title,
        patterns: patterns,
        price_min: service.price_min,
        price_max: service.price_max,
        yclients_id: service.yclients_id
      };
    });

    // Generate patterns from actual staff names
    staff.forEach(staffMember => {
      const name = staffMember.name.toLowerCase();
      const patterns = [name];
      
      // Add variations with prepositions
      patterns.push(`к ${name}`, `у ${name}`, `мастер ${name}`);
      
      // Add common name variations (if applicable)
      const firstName = name.split(' ')[0];
      if (firstName !== name) {
        patterns.push(firstName, `к ${firstName}`, `у ${firstName}`);
      }
      
      staffPatterns[staffMember.yclients_id] = {
        name: staffMember.name,
        patterns: patterns,
        rating: staffMember.rating,
        specialization: staffMember.specialization,
        yclients_id: staffMember.yclients_id
      };
    });

    // Store company data
    this.companyData.set(companyId, {
      services: servicePatterns,
      staff: staffPatterns,
      lastUpdated: Date.now()
    });

    logger.debug(`✅ Updated entity patterns for company ${companyId}: ${Object.keys(servicePatterns).length} services, ${Object.keys(staffPatterns).length} staff`);
  }

  /**
   * Extract all entities from message using multiple methods
   */
  extract(message, companyId = null) {
    const text = message.toLowerCase().trim();
    
    const entities = {
      intent: this.extractIntent(text),
      service: this.extractService(text, companyId),
      staff: this.extractStaff(text, companyId),
      date: this.extractDate(text),
      time: this.extractTime(text),
      confidence: this.calculateConfidence(text)
    };

    logger.debug('🔍 Entity extraction result:', {
      originalMessage: message,
      extractedEntities: entities,
      companyId
    });

    return entities;
  }

  /**
   * Extract intent from message
   */
  extractIntent(text) {
    let maxScore = 0;
    let detectedIntent = 'other';

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      const score = this.calculatePatternScore(text, patterns);
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
      }
    }

    return {
      name: detectedIntent,
      confidence: maxScore
    };
  }

  /**
   * Extract service from message
   */
  extractService(text, companyId = null) {
    let maxScore = 0;
    let detectedService = null;
    let detectedServiceInfo = null;

    // Get patterns for the company if available
    const companyInfo = companyId ? this.companyData.get(companyId) : null;
    const servicePatterns = companyInfo?.services || this.defaultServicePatterns;

    // If no patterns available, return null
    if (!servicePatterns || Object.keys(servicePatterns).length === 0) {
      logger.debug('No service patterns available for extraction');
      return null;
    }

    // Check each service's patterns
    for (const [serviceId, serviceInfo] of Object.entries(servicePatterns)) {
      const score = this.calculatePatternScore(text, serviceInfo.patterns);
      if (score > maxScore) {
        maxScore = score;
        detectedService = serviceInfo.title;
        detectedServiceInfo = serviceInfo;
      }
    }

    return detectedService ? {
      name: detectedService,
      confidence: maxScore,
      yclients_id: detectedServiceInfo?.yclients_id,
      price_min: detectedServiceInfo?.price_min,
      price_max: detectedServiceInfo?.price_max
    } : null;
  }

  /**
   * Extract staff from message
   */
  extractStaff(text, companyId = null) {
    let maxScore = 0;
    let detectedStaff = null;
    let detectedStaffInfo = null;

    // Get patterns for the company if available
    const companyInfo = companyId ? this.companyData.get(companyId) : null;
    const staffPatterns = companyInfo?.staff || this.defaultStaffPatterns;

    // If no patterns available, return null
    if (!staffPatterns || Object.keys(staffPatterns).length === 0) {
      logger.debug('No staff patterns available for extraction');
      return null;
    }

    // Check each staff member's patterns
    for (const [staffId, staffInfo] of Object.entries(staffPatterns)) {
      const score = this.calculatePatternScore(text, staffInfo.patterns);
      if (score > maxScore) {
        maxScore = score;
        detectedStaff = staffInfo.name;
        detectedStaffInfo = staffInfo;
      }
    }

    return detectedStaff ? {
      name: detectedStaff,
      confidence: maxScore,
      yclients_id: detectedStaffInfo?.yclients_id,
      rating: detectedStaffInfo?.rating,
      specialization: detectedStaffInfo?.specialization
    } : null;
  }

  /**
   * Extract date from message
   */
  extractDate(text) {
    // Check for relative dates first
    for (const [pattern, dateFunc] of Object.entries(this.datePatterns)) {
      if (text.includes(pattern)) {
        return {
          date: dateFunc(),
          original: pattern,
          confidence: 0.9
        };
      }
    }

    // Check for absolute dates (DD.MM, DD/MM, etc.)
    const absoluteDatePattern = /(\d{1,2})[\.\/\-](\d{1,2})(?:[\.\/\-](\d{2,4}))?/;
    const match = text.match(absoluteDatePattern);
    
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]);
      const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
      
      const date = new Date(year, month - 1, day);
      return {
        date: this.formatDate(date),
        original: match[0],
        confidence: 0.8
      };
    }

    return null;
  }

  /**
   * Extract time from message
   */
  extractTime(text) {
    // Try HH:MM format first
    const exactTimeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (exactTimeMatch) {
      const hours = parseInt(exactTimeMatch[1]);
      const minutes = parseInt(exactTimeMatch[2]);
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return {
          time: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
          original: exactTimeMatch[0],
          confidence: 0.95
        };
      }
    }

    // Try natural language times
    const naturalTimeMatch = text.match(/(\d{1,2})\s*(час|утра|дня|вечера|ночи)/);
    if (naturalTimeMatch) {
      let hours = parseInt(naturalTimeMatch[1]);
      const period = naturalTimeMatch[2];
      
      // Adjust for time periods
      if (period === 'вечера' && hours < 12) hours += 12;
      if (period === 'утра' && hours === 12) hours = 0;
      
      return {
        time: `${hours.toString().padStart(2, '0')}:00`,
        original: naturalTimeMatch[0],
        confidence: 0.7
      };
    }

    // Try relative times
    const relativeTimeMap = {
      'утром': '09:00',
      'днем': '14:00', 
      'вечером': '18:00',
      'рано': '08:00',
      'поздно': '20:00'
    };

    for (const [pattern, time] of Object.entries(relativeTimeMap)) {
      if (text.includes(pattern)) {
        return {
          time: time,
          original: pattern,
          confidence: 0.5
        };
      }
    }

    return null;
  }

  /**
   * Calculate pattern matching score
   */
  calculatePatternScore(text, patterns) {
    let score = 0;
    let matches = 0;

    for (const pattern of patterns) {
      if (text.includes(pattern.toLowerCase())) {
        matches++;
        // Longer patterns get higher scores
        score += pattern.length / 10;
      }
    }

    // Normalize score
    return matches > 0 ? Math.min(score / patterns.length, 1.0) : 0;
  }

  /**
   * Calculate overall confidence
   */
  calculateConfidence(text) {
    const factors = [];
    
    // Text length factor
    if (text.length > 10) factors.push(0.2);
    
    // Contains question words
    const questionWords = ['какие', 'когда', 'сколько', 'где', 'как', 'что'];
    if (questionWords.some(word => text.includes(word))) factors.push(0.3);
    
    // Contains action words  
    const actionWords = ['хочу', 'нужно', 'можно', 'записать', 'забронировать'];
    if (actionWords.some(word => text.includes(word))) factors.push(0.3);
    
    // Contains time/date references
    const timeWords = ['сегодня', 'завтра', 'время', 'час', ':'];
    if (timeWords.some(word => text.includes(word))) factors.push(0.2);

    return Math.min(factors.reduce((sum, factor) => sum + factor, 0), 1.0);
  }

  /**
   * Helper methods
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  getNextWeekday(targetDay) {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return this.formatDate(targetDate);
  }
}

module.exports = EntityExtractor;