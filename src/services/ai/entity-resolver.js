// src/services/ai/entity-resolver.js
const smartCache = require('../cache/smart-cache');
const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');

/**
 * 🎯 ENTITY RESOLUTION SERVICE
 * AI-powered поиск и разрешение сущностей (услуги, мастера)
 * 
 * Возможности:
 * - Семантический поиск через AI
 * - Smart кэширование результатов
 * - Fuzzy matching и автокоррекция
 * - Контекстно-зависимый поиск
 * - Multi-tenant поддержка
 */
class EntityResolver {
  constructor() {
    this.aiService = null; // Будет инициализирован lazily
    this.fallbackTimeout = 5000; // 5 секунд таймаут для AI
  }

  /**
   * Ленивая инициализация AI сервиса
   */
  async _getAIService() {
    if (!this.aiService) {
      this.aiService = require('./index');
    }
    return this.aiService;
  }

  /**
   * 🛍️ Поиск услуги по названию через AI + DB
   */
  async resolveService(serviceName, companyId, context = {}) {
    if (!serviceName || !companyId) {
      throw new Error('ServiceName and companyId are required');
    }

    logger.info(`🔍 Resolving service: "${serviceName}" for company ${companyId}`);

    try {
      // 1. Проверяем Smart Cache
      const result = await smartCache.getSemanticCache(
        serviceName,
        companyId,
        () => this._computeServiceResolution(serviceName, companyId, context),
        { 
          ttl: 1800, // 30 минут
          type: 'entity',
          entityType: 'service'
        }
      );

      logger.info(`✅ Service resolved: ${serviceName} → ${result.title} (ID: ${result.yclients_id})`);
      return result;

    } catch (error) {
      logger.error(`Error resolving service "${serviceName}":`, error);
      
      // Fallback к первой доступной услуге
      const fallback = await this._getFallbackService(companyId);
      logger.warn(`🔄 Using fallback service: ${fallback.title}`);
      return fallback;
    }
  }

  /**
   * 👤 Поиск мастера по имени через AI + DB
   */
  async resolveStaff(staffName, companyId, context = {}) {
    // Если мастер не указан, возвращаем популярного
    if (!staffName || staffName === 'любой' || staffName === 'любого') {
      return this._getPopularStaff(companyId, context);
    }

    logger.info(`🔍 Resolving staff: "${staffName}" for company ${companyId}`);

    try {
      // 1. Проверяем Smart Cache
      const result = await smartCache.getSemanticCache(
        `staff_${staffName}`,
        companyId,
        () => this._computeStaffResolution(staffName, companyId, context),
        { 
          ttl: 3600, // 1 час (мастера меняются реже)
          type: 'entity',
          entityType: 'staff'
        }
      );

      logger.info(`✅ Staff resolved: ${staffName} → ${result.name} (ID: ${result.yclients_id})`);
      return result;

    } catch (error) {
      logger.error(`Error resolving staff "${staffName}":`, error);
      
      // Fallback к популярному мастеру
      const fallback = await this._getPopularStaff(companyId, context);
      logger.warn(`🔄 Using fallback staff: ${fallback.name}`);
      return fallback;
    }
  }

  /**
   * 🎯 Комплексное разрешение сущностей из сообщения
   */
  async resolveEntities(message, companyId, context = {}) {
    logger.info(`🧠 Resolving entities from message: "${message}"`);

    try {
      // 1. Извлекаем сущности через AI
      const aiService = await this._getAIService();
      const extraction = await Promise.race([
        aiService.processMessage(message, context),
        this._createTimeout(this.fallbackTimeout, 'AI entity extraction timeout')
      ]);

      if (!extraction.success) {
        throw new Error(extraction.error || 'AI extraction failed');
      }

      const entities = extraction.entities || {};

      // 2. Параллельно разрешаем все сущности
      const [service, staff] = await Promise.all([
        entities.service ? this.resolveService(entities.service, companyId, context) : null,
        entities.staff ? this.resolveStaff(entities.staff, companyId, context) : null
      ]);

      const result = {
        success: true,
        entities: {
          service,
          staff,
          date: entities.date,
          time: entities.time,
          action: extraction.action
        },
        confidence: extraction.confidence || 0.8,
        aiResponse: extraction.response
      };

      logger.info('✅ Entities resolved successfully:', {
        service: service?.title,
        staff: staff?.name,
        action: result.entities.action
      });

      return result;

    } catch (error) {
      logger.error('Error resolving entities:', error);
      
      // Fallback к базовому разбору
      return this._getFallbackEntities(message, companyId, context);
    }
  }

  // =================== PRIVATE METHODS ===================

  /**
   * Вычисление разрешения услуги (вызывается при cache miss)
   */
  async _computeServiceResolution(serviceName, companyId, context) {
    // 1. Получаем все услуги компании
    const services = await this._getCompanyServices(companyId);
    
    if (services.length === 0) {
      throw new Error(`No services found for company ${companyId}`);
    }

    // 2. Простой поиск по точному совпадению (быстро)
    const exactMatch = services.find(s => 
      s.title.toLowerCase() === serviceName.toLowerCase()
    );
    
    if (exactMatch) {
      logger.debug(`📍 Exact match found: ${exactMatch.title}`);
      return exactMatch;
    }
    
    // 2.5. Если есть несколько услуг с этим словом, используем AI
    const partialMatches = services.filter(s => 
      s.title.toLowerCase().includes(serviceName.toLowerCase())
    );
    
    if (partialMatches.length > 1) {
      logger.debug(`🔍 Found ${partialMatches.length} partial matches for "${serviceName}", using AI to select best`);
      // Переходим сразу к AI выбору
    } else if (partialMatches.length === 1) {
      logger.debug(`📍 Single partial match found: ${partialMatches[0].title}`);
      return partialMatches[0];
    }

    // 3. AI поиск для сложных случаев
    try {
      // Используем либо частичные совпадения, либо все услуги
      const candidateServices = partialMatches.length > 0 ? partialMatches : services;
      
      // Временная логика выбора лучшей услуги для "стрижка"
      if (serviceName.toLowerCase() === 'стрижка' && candidateServices.length > 1) {
        // Приоритеты для выбора услуги стрижки
        const priorities = [
          'мужская стрижка',
          'стрижка машинкой',
          'стрижка ножницами',
          'стрижка | счастливые часы'
        ];
        
        for (const priority of priorities) {
          const match = candidateServices.find(s => 
            s.title.toLowerCase() === priority.toLowerCase()
          );
          if (match) {
            logger.debug(`📋 Priority match found: ${match.title}`);
            return match;
          }
        }
        
        // Если не нашли по приоритетам, берем самую дешевую базовую стрижку
        const basicServices = candidateServices.filter(s => 
          !s.title.includes('+') && // без комбо-услуг
          !s.title.includes('БОРОД') && // без услуг бороды
          !s.title.includes('ТОНИРОВАНИЕ') // без тонирования
        );
        
        if (basicServices.length > 0) {
          const cheapest = basicServices.sort((a, b) => 
            (a.price_min || 9999) - (b.price_min || 9999)
          )[0];
          logger.debug(`💰 Cheapest basic service selected: ${cheapest.title}`);
          return cheapest;
        }
      }
      
      // Для других случаев пробуем AI (если он реализован)
      try {
        const aiService = await this._getAIService();
        if (aiService && typeof aiService.selectBestService === 'function') {
          const bestMatch = await Promise.race([
            aiService.selectBestService(serviceName, candidateServices, context),
            this._createTimeout(3000, 'AI service selection timeout')
          ]);
          
          if (bestMatch) {
            logger.debug(`🧠 AI match found: ${bestMatch.title}`);
            return bestMatch;
          }
        }
      } catch (aiError) {
        logger.debug('AI service not available or failed:', aiError.message);
      }
    } catch (error) {
      logger.warn('Service selection failed:', error.message);
    }

    // 4. Fuzzy match fallback
    const fuzzyMatch = this._findFuzzyMatch(serviceName, services, 'title');
    if (fuzzyMatch) {
      logger.debug(`🔍 Fuzzy match found: ${fuzzyMatch.title}`);
      return fuzzyMatch;
    }

    // 5. Популярная услуга как последний fallback
    const popular = services.find(s => s.weight > 0) || services[0];
    logger.debug(`⭐ Popular service fallback: ${popular.title}`);
    return popular;
  }

  /**
   * Вычисление разрешения мастера (вызывается при cache miss)
   */
  async _computeStaffResolution(staffName, companyId, context) {
    // 1. Получаем всех мастеров компании
    const staff = await this._getCompanyStaff(companyId);
    
    if (staff.length === 0) {
      throw new Error(`No staff found for company ${companyId}`);
    }

    // 2. Точный поиск по имени
    const exactMatch = staff.find(s => 
      s.name.toLowerCase().includes(staffName.toLowerCase())
    );
    
    if (exactMatch) {
      logger.debug(`📍 Exact staff match: ${exactMatch.name}`);
      return exactMatch;
    }

    // 3. Fuzzy match по имени
    const fuzzyMatch = this._findFuzzyMatch(staffName, staff, 'name');
    if (fuzzyMatch) {
      logger.debug(`🔍 Fuzzy staff match: ${fuzzyMatch.name}`);
      return fuzzyMatch;
    }

    // 4. Мастер с лучшим рейтингом
    const topRated = staff
      .filter(s => s.rating > 0)
      .sort((a, b) => b.rating - a.rating)[0];
      
    if (topRated) {
      logger.debug(`⭐ Top rated staff fallback: ${topRated.name}`);
      return topRated;
    }

    // 5. Первый доступный мастер
    return staff[0];
  }

  /**
   * Получение услуг компании из БД с кэшированием
   */
  async _getCompanyServices(companyId) {
    return smartCache.getOrCompute(
      `company_services_${companyId}`,
      async () => {
        const { data, error } = await supabase
          .from('services')
          .select('yclients_id, title, price_min, price_max, duration, description, weight')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .eq('is_bookable', true)
          .order('weight', { ascending: false });

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
      },
      { 
        ttl: 1800, // 30 минут
        type: 'static'
      }
    );
  }

  /**
   * Получение мастеров компании из БД с кэшированием
   */
  async _getCompanyStaff(companyId) {
    return smartCache.getOrCompute(
      `company_staff_${companyId}`,
      async () => {
        const { data, error } = await supabase
          .from('staff')
          .select('yclients_id, name, specialization, rating, service_ids')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .eq('is_bookable', true)
          .order('rating', { ascending: false });

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
      },
      { 
        ttl: 3600, // 1 час
        type: 'static'
      }
    );
  }

  /**
   * Fallback услуга (самая популярная или первая)
   */
  async _getFallbackService(companyId) {
    const services = await this._getCompanyServices(companyId);
    
    if (services.length === 0) {
      throw new Error(`No services available for company ${companyId}`);
    }

    // Возвращаем самую популярную (с наибольшим weight) или первую
    return services.find(s => s.weight > 0) || services[0];
  }

  /**
   * Популярный мастер на основе контекста и рейтинга
   */
  async _getPopularStaff(companyId, context) {
    const staff = await this._getCompanyStaff(companyId);
    
    if (staff.length === 0) {
      throw new Error(`No staff available for company ${companyId}`);
    }

    // Если есть предпочитаемые мастера в контексте
    if (context.client?.favorite_staff_ids?.length > 0) {
      const favorite = staff.find(s => 
        context.client.favorite_staff_ids.includes(s.yclients_id)
      );
      if (favorite) {
        logger.debug(`❤️ Returning favorite staff: ${favorite.name}`);
        return favorite;
      }
    }

    // Мастер с лучшим рейтингом
    const topRated = staff
      .filter(s => s.rating > 0)
      .sort((a, b) => b.rating - a.rating)[0];
      
    return topRated || staff[0];
  }

  /**
   * Fuzzy matching для поиска похожих названий
   */
  _findFuzzyMatch(query, items, field) {
    const threshold = 0.6; // Минимальное сходство
    let bestMatch = null;
    let bestScore = 0;

    for (const item of items) {
      const score = this._calculateSimilarity(
        query.toLowerCase(),
        item[field].toLowerCase()
      );
      
      if (score > threshold && score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    return bestMatch;
  }

  /**
   * Расчет схожести строк (простой алгоритм)
   */
  _calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this._levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Расстояние Левенштейна
   */
  _levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Fallback разбор сущностей без AI
   */
  async _getFallbackEntities(message, companyId, context) {
    logger.info('🔄 Using fallback entity extraction');
    
    // Простые паттерны для экстренного случая
    const servicePatterns = ['стрижка', 'маникюр', 'педикюр', 'массаж', 'борода'];
    const staffPatterns = ['сергей', 'бари', 'рамзан', 'мастер'];
    
    const foundService = servicePatterns.find(pattern => 
      message.toLowerCase().includes(pattern)
    );
    
    const foundStaff = staffPatterns.find(pattern => 
      message.toLowerCase().includes(pattern)
    );

    return {
      success: true,
      entities: {
        service: foundService ? await this._getFallbackService(companyId) : null,
        staff: foundStaff ? await this._getPopularStaff(companyId, context) : null,
        date: null,
        time: null,
        action: 'search_slots'
      },
      confidence: 0.3,
      aiResponse: 'Понял! Помогу найти подходящий вариант.',
      fallback: true
    };
  }

  /**
   * Создание Promise с таймаутом
   */
  _createTimeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Инвалидация кэша при изменении данных
   */
  async invalidateCache(companyId, type = 'all') {
    const patterns = [];
    
    if (type === 'all' || type === 'services') {
      patterns.push(`company_services_${companyId}`);
      patterns.push(`intent_*_${companyId}`);
    }
    
    if (type === 'all' || type === 'staff') {
      patterns.push(`company_staff_${companyId}`);
      patterns.push(`staff_*_${companyId}`);
    }
    
    for (const pattern of patterns) {
      await smartCache.invalidatePattern(pattern);
    }
    
    logger.info(`🗑️ Cache invalidated for company ${companyId}, type: ${type}`);
  }

  /**
   * Получение статистики
   */
  getStats() {
    return smartCache.getStats();
  }
}

// Singleton instance
module.exports = new EntityResolver();