// Оптимизированная версия AI Admin v2 с улучшенной работой с БД
const logger = require('../../utils/logger');
const { loadFullContext, invalidateCache, getStats } = require('../../database/optimized-supabase');
const BookingService = require('../booking/booking-service');
const { getBusinessConfig } = require('../../config/business-types');
const CircuitBreaker = require('opossum');

class OptimizedAIAdminV2 {
  constructor() {
    this.bookingService = new BookingService();
    
    // Circuit breaker для AI вызовов
    this.aiCircuitBreaker = new CircuitBreaker(
      this.callAI.bind(this),
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000,
        volumeThreshold: 5
      }
    );
    
    // Статистика производительности
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      avgResponseTime: 0,
      contextLoadTime: [],
      aiCallTime: []
    };
  }

  async processMessage(message, from, companyId) {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      logger.info(`🚀 Optimized AI Admin v2 processing: "${message}" from ${from}`);
      
      // 1. Загружаем контекст (с кэшированием)
      const contextStart = Date.now();
      const context = await loadFullContext(from, companyId);
      const contextTime = Date.now() - contextStart;
      
      this.stats.contextLoadTime.push(contextTime);
      if (this.stats.contextLoadTime.length > 100) {
        this.stats.contextLoadTime.shift();
      }
      
      logger.debug(`Context loaded in ${contextTime}ms`);
      
      // 2. Определяем тип бизнеса
      const businessType = this.detectBusinessType(context.company);
      const businessConfig = getBusinessConfig(businessType);
      
      // 3. Строим оптимизированный промпт
      const prompt = this.buildOptimizedPrompt(message, context, businessConfig);
      
      // 4. Вызываем AI через circuit breaker
      const aiStart = Date.now();
      const aiResponse = await this.aiCircuitBreaker.fire(prompt);
      const aiTime = Date.now() - aiStart;
      
      this.stats.aiCallTime.push(aiTime);
      if (this.stats.aiCallTime.length > 100) {
        this.stats.aiCallTime.shift();
      }
      
      // 5. Выполняем команды
      const commands = this.extractCommands(aiResponse);
      const results = await this.executeCommands(commands, context, companyId);
      
      // 6. Формируем ответ
      const finalResponse = this.formatResponse(aiResponse, results);
      
      const totalTime = Date.now() - startTime;
      logger.info(`✅ Optimized processing completed in ${totalTime}ms (context: ${contextTime}ms, AI: ${aiTime}ms)`);
      
      return finalResponse;
      
    } catch (error) {
      logger.error('Error in optimized AI Admin v2:', error);
      throw error;
    }
  }

  buildOptimizedPrompt(message, context, businessConfig) {
    // Используем только нужные данные для уменьшения размера промпта
    const relevantServices = this.filterRelevantServices(context.services, message);
    const availableStaff = this.filterAvailableStaff(context.staff, context.schedules);
    
    return `Ты AI-администратор ${businessConfig.terminology.businessType}.
    
КОНТЕКСТ:
- Клиент: ${context.client?.name || 'Новый клиент'} (${context.client?.visit_count || 0} визитов)
- Любимые услуги: ${this.getClientFavorites(context.client)}
- Доступные ${businessConfig.terminology.services} (топ-10): ${this.formatServices(relevantServices.slice(0, 10))}
- Работающие ${businessConfig.terminology.specialists}: ${this.formatStaff(availableStaff)}

ДОСТУПНЫЕ КОМАНДЫ:
[SEARCH_SLOTS service_name: название, staff_name: имя (опционально), date: дата, time_preference: утро/день/вечер]
[CREATE_BOOKING service_id: ID, staff_id: ID, date: дата, time: время]
[SHOW_PRICES category: категория (опционально)]

СООБЩЕНИЕ КЛИЕНТА: "${message}"

Ответь дружелюбно и выполни нужные команды.`;
  }

  filterRelevantServices(services, message) {
    if (!services || !message) return services;
    
    const keywords = message.toLowerCase().split(' ');
    
    // Приоритизируем услуги, содержащие ключевые слова
    return services.sort((a, b) => {
      const aRelevance = keywords.filter(k => 
        a.title.toLowerCase().includes(k) || 
        a.category_title?.toLowerCase().includes(k)
      ).length;
      
      const bRelevance = keywords.filter(k => 
        b.title.toLowerCase().includes(k) || 
        b.category_title?.toLowerCase().includes(k)
      ).length;
      
      return bRelevance - aRelevance || b.weight - a.weight;
    });
  }

  filterAvailableStaff(staff, schedules) {
    if (!staff || !schedules) return staff;
    
    const today = new Date().toISOString().split('T')[0];
    const workingToday = new Set(
      schedules
        .filter(s => s.date === today && s.is_working)
        .map(s => s.staff_id)
    );
    
    return staff.filter(s => workingToday.has(s.yclients_id));
  }

  getClientFavorites(client) {
    if (!client?.last_service_ids?.length) return 'нет данных';
    return client.last_service_ids.slice(0, 3).join(', ');
  }

  formatServices(services) {
    if (!services?.length) return 'нет доступных услуг';
    return services.map(s => 
      `${s.title} (${s.price_min}-${s.price_max}₽, ${s.duration}мин)`
    ).join(', ');
  }

  formatStaff(staff) {
    if (!staff?.length) return 'все заняты';
    return staff.map(s => 
      `${s.name}${s.rating ? ` ⭐${s.rating}` : ''}`
    ).join(', ');
  }

  detectBusinessType(company) {
    const name = company?.title?.toLowerCase() || '';
    
    if (name.includes('барбер') || name.includes('barber')) return 'barbershop';
    if (name.includes('ногт') || name.includes('маникюр')) return 'nails';
    if (name.includes('массаж')) return 'massage';
    if (name.includes('эпиляц') || name.includes('шугар')) return 'epilation';
    if (name.includes('бров') || name.includes('ресниц')) return 'brows';
    
    return 'beauty';
  }

  async callAI(prompt) {
    // Здесь ваш вызов к AI API
    // Возвращает ответ AI
  }

  extractCommands(aiResponse) {
    const commands = [];
    const commandRegex = /\[([A-Z_]+)([^\]]*)\]/g;
    
    let match;
    while ((match = commandRegex.exec(aiResponse)) !== null) {
      commands.push({
        type: match[1],
        params: this.parseCommandParams(match[2])
      });
    }
    
    return commands;
  }

  parseCommandParams(paramsStr) {
    const params = {};
    const paramRegex = /(\w+):\s*([^,]+)/g;
    
    let match;
    while ((match = paramRegex.exec(paramsStr)) !== null) {
      params[match[1]] = match[2].trim();
    }
    
    return params;
  }

  async executeCommands(commands, context, companyId) {
    const results = [];
    
    for (const command of commands) {
      try {
        const result = await this.executeCommand(command, context, companyId);
        results.push(result);
      } catch (error) {
        logger.error(`Error executing command ${command.type}:`, error);
        results.push({ 
          error: true, 
          message: 'Произошла ошибка при выполнении команды' 
        });
      }
    }
    
    return results;
  }

  async executeCommand(command, context, companyId) {
    switch (command.type) {
      case 'SEARCH_SLOTS':
        return await this.searchSlots(command.params, context, companyId);
      
      case 'CREATE_BOOKING':
        return await this.createBooking(command.params, context, companyId);
      
      case 'SHOW_PRICES':
        return this.showPrices(command.params, context);
      
      default:
        return { error: true, message: 'Неизвестная команда' };
    }
  }

  formatResponse(aiResponse, commandResults) {
    let response = aiResponse;
    
    // Заменяем команды на результаты
    commandResults.forEach((result, index) => {
      const commandMatch = response.match(/\[[A-Z_]+[^\]]*\]/);
      if (commandMatch) {
        response = response.replace(commandMatch[0], result.formatted || '');
      }
    });
    
    return response;
  }

  // Методы для получения статистики
  async getPerformanceStats() {
    const dbStats = await getStats();
    
    return {
      requests: {
        total: this.stats.totalRequests,
        avgContextLoadTime: this.calculateAverage(this.stats.contextLoadTime),
        avgAICallTime: this.calculateAverage(this.stats.aiCallTime)
      },
      cache: dbStats.redis,
      circuitBreaker: {
        state: this.aiCircuitBreaker.stats(),
        opened: this.aiCircuitBreaker.opened
      }
    };
  }

  calculateAverage(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }

  // Метод для прогрева кэша
  async warmupForCompany(companyId) {
    const { warmupCache } = require('../../database/optimized-supabase');
    await warmupCache(companyId);
  }
}

module.exports = OptimizedAIAdminV2;