// src/services/ai-admin-v2/index.js
const { supabase } = require('../../database/supabase');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * AI Администратор v2 - Простой и эффективный
 * 
 * Философия:
 * - AI получает полный контекст и сам решает что делать
 * - Минимум слоев абстракции
 * - Максимум гибкости через промпты
 * - Адаптация под любой тип бизнеса
 */
class AIAdminV2 {
  constructor() {
    this.contextCache = new Map();
    this.aiProvider = null; // Lazy load
  }

  /**
   * Основной метод обработки сообщения
   */
  async processMessage(message, phone, companyId) {
    const startTime = Date.now();
    logger.info(`🤖 AI Admin v2 processing: "${message}" from ${phone}`);

    try {
      // 1. Загружаем полный контекст параллельно
      const context = await this.loadFullContext(phone, companyId);
      
      // 2. Обновляем историю диалога
      context.conversation.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      });

      // 3. Строим промпт с полным контекстом
      const prompt = this.buildSmartPrompt(message, context);
      
      // 4. Получаем ответ от AI
      const aiResponse = await this.callAI(prompt);
      
      // 5. Парсим и выполняем действия
      const result = await this.processAIResponse(aiResponse, context);
      
      // 6. Сохраняем контекст
      await this.saveContext(phone, companyId, context, result);
      
      logger.info(`✅ AI Admin v2 completed in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      logger.error('AI Admin v2 error:', error);
      return {
        success: false,
        response: this.getErrorMessage(error, context?.company?.type),
        error: error.message
      };
    }
  }

  /**
   * Загружаем ВЕСЬ необходимый контекст
   */
  async loadFullContext(phone, companyId) {
    // Проверяем кеш
    const cacheKey = `${phone}_${companyId}`;
    const cached = this.contextCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 минут
      logger.debug('Using cached context');
      return cached.data;
    }

    logger.info('Loading full context from database...');
    
    // Загружаем всё параллельно для скорости
    const [company, client, services, staff, conversation, businessStats] = await Promise.all([
      this.loadCompany(companyId),
      this.loadClient(phone, companyId),
      this.loadServices(companyId),
      this.loadStaff(companyId),
      this.loadConversation(phone, companyId),
      this.loadBusinessStats(companyId)
    ]);

    const context = {
      company,
      client,
      services,
      staff,
      conversation,
      businessStats,
      currentTime: new Date().toISOString(),
      timezone: company.timezone || 'Europe/Moscow'
    };

    // Кешируем
    this.contextCache.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });

    return context;
  }

  /**
   * Строим умный промпт с учетом типа бизнеса
   */
  buildSmartPrompt(message, context) {
    const { company, client, services, staff, conversation, businessStats } = context;
    
    // Адаптируем терминологию под тип бизнеса
    const terminology = this.getBusinessTerminology(company.type);
    
    return `Ты - ${terminology.role} в ${company.title}.

ИНФОРМАЦИЯ О БИЗНЕСЕ:
- Тип: ${terminology.businessType}
- Адрес: ${company.address}
- Часы работы: ${this.formatWorkingHours(company.working_hours)}
- Телефон: ${company.phone}
${businessStats ? `- Загрузка на сегодня: ${businessStats.todayLoad}%` : ''}

КЛИЕНТ:
- Имя: ${client.name}
- Телефон: ${client.phone}
- Статус: ${client.loyalty_level || 'Новый клиент'}
- Визитов: ${client.visit_count || 0}
${client.last_visit_date ? `- Последний визит: ${this.formatDate(client.last_visit_date)}` : ''}
${client.preferences ? `- Предпочтения: ${JSON.stringify(client.preferences)}` : ''}
${client.favorite_staff_ids?.length ? `- Любимые ${terminology.specialists}: ${this.getStaffNames(client.favorite_staff_ids, staff)}` : ''}

ДОСТУПНЫЕ ${terminology.services.toUpperCase()}:
${this.formatServices(services, company.type)}

${terminology.specialists.toUpperCase()} СЕГОДНЯ:
${this.formatStaff(staff, company.type)}

ИСТОРИЯ ДИАЛОГА (последние 10 сообщений):
${this.formatConversation(conversation.slice(-10))}

ТЕКУЩЕЕ СООБЩЕНИЕ: "${message}"

ТВОИ ВОЗМОЖНОСТИ:
1. [SEARCH_SLOTS] - поиск свободного времени
   Параметры: service_name, staff_name (опционально), date, time_preference
   
2. [CREATE_BOOKING] - создание записи
   Параметры: service_id, staff_id, date, time
   
3. [SHOW_PRICES] - показать прайс-лист
   Параметры: category (опционально)
   
4. [SHOW_PORTFOLIO] - показать работы мастера
   Параметры: staff_id

ПРАВИЛА:
1. Будь ${terminology.communicationStyle}
2. Используй терминологию для ${terminology.businessType}
3. Проактивно предлагай ${terminology.suggestions}
4. Если нужны слоты - ВСЕГДА используй [SEARCH_SLOTS]
5. НЕ придумывай время и дату - всегда проверяй доступность
6. Учитывай предпочтения и историю клиента
7. Предлагай дополнительные услуги когда уместно

ВАЖНО:
- Сегодня: ${context.currentTime}
- Часовой пояс: ${context.timezone}
- Минимальное время для записи: ${config.business.minBookingMinutesAhead} минут

Ответь клиенту и выполни необходимые действия:`
  }

  /**
   * Обработка ответа AI и выполнение команд
   */
  async processAIResponse(aiResponse, context) {
    logger.info('Processing AI response...');
    
    // Извлекаем команды из ответа
    const commands = this.extractCommands(aiResponse);
    const cleanResponse = this.removeCommands(aiResponse);
    
    // Выполняем команды
    const results = await this.executeCommands(commands, context);
    
    // Формируем финальный ответ
    let finalResponse = cleanResponse;
    
    // Добавляем результаты выполнения команд
    for (const result of results) {
      if (result.type === 'slots') {
        finalResponse += '\n\n' + this.formatSlots(result.data, context.company.type);
      } else if (result.type === 'booking_created') {
        finalResponse += '\n\n✅ ' + this.formatBookingConfirmation(result.data, context.company.type);
      } else if (result.type === 'prices') {
        finalResponse += '\n\n' + this.formatPrices(result.data, context.company.type);
      }
    }
    
    return {
      success: true,
      response: finalResponse,
      executedCommands: commands,
      results
    };
  }

  /**
   * Извлечение команд из ответа AI
   */
  extractCommands(response) {
    const commands = [];
    const commandRegex = /\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO)([^\]]*)\]/g;
    
    let match;
    while ((match = commandRegex.exec(response)) !== null) {
      const [fullMatch, command, paramsString] = match;
      const params = this.parseCommandParams(paramsString);
      
      commands.push({
        command,
        params,
        originalText: fullMatch
      });
    }
    
    return commands;
  }

  /**
   * Выполнение команд
   */
  async executeCommands(commands, context) {
    const results = [];
    
    for (const cmd of commands) {
      logger.info(`Executing command: ${cmd.command}`, cmd.params);
      
      try {
        switch (cmd.command) {
          case 'SEARCH_SLOTS':
            const slots = await this.searchSlots(cmd.params, context);
            results.push({ type: 'slots', data: slots });
            break;
            
          case 'CREATE_BOOKING':
            const booking = await this.createBooking(cmd.params, context);
            results.push({ type: 'booking_created', data: booking });
            break;
            
          case 'SHOW_PRICES':
            const prices = await this.getPrices(cmd.params, context);
            results.push({ type: 'prices', data: prices });
            break;
            
          case 'SHOW_PORTFOLIO':
            const portfolio = await this.getPortfolio(cmd.params, context);
            results.push({ type: 'portfolio', data: portfolio });
            break;
        }
      } catch (error) {
        logger.error(`Command ${cmd.command} failed:`, error);
        results.push({ 
          type: 'error', 
          command: cmd.command,
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Поиск свободных слотов
   */
  async searchSlots(params, context) {
    // Используем существующий booking service
    const bookingService = require('../booking');
    
    // Находим service по имени
    const service = context.services.find(s => 
      s.title.toLowerCase().includes(params.service_name?.toLowerCase() || '')
    ) || context.services[0]; // Fallback на популярную услугу
    
    // Находим staff если указан
    const staff = params.staff_name ? 
      context.staff.find(s => s.name.toLowerCase().includes(params.staff_name.toLowerCase())) : 
      null;
    
    const result = await bookingService.findSuitableSlot({
      companyId: context.company.yclients_id || context.company.company_id,
      serviceId: service?.yclients_id,
      staffId: staff?.yclients_id,
      preferredDate: params.date || new Date().toISOString().split('T')[0],
      timePreference: params.time_preference
    });
    
    return result.data || [];
  }

  /**
   * Создание записи
   */
  async createBooking(params, context) {
    const bookingService = require('../booking');
    
    const bookingData = {
      phone: context.client.phone,
      fullname: context.client.name,
      email: context.client.email,
      comment: "Запись через AI администратора WhatsApp",
      appointments: [{
        id: 1,
        services: [parseInt(params.service_id)],
        staff_id: parseInt(params.staff_id),
        datetime: `${params.date} ${params.time}:00`
      }]
    };
    
    const result = await bookingService.createBooking(
      bookingData, 
      context.company.yclients_id || context.company.company_id
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Не удалось создать запись');
    }
    
    return result.data;
  }

  /**
   * Вспомогательные методы для загрузки данных
   */
  async loadCompany(companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();
    
    if (error) throw error;
    
    // Определяем тип бизнеса
    const businessType = this.detectBusinessType(data);
    return { ...data, type: businessType };
  }

  async loadClient(phone, companyId) {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .or(`phone.eq.${normalizedPhone},raw_phone.eq.${normalizedPhone}`)
      .single();
    
    return data || {
      name: 'Гость',
      phone: normalizedPhone,
      visit_count: 0,
      loyalty_level: 'New'
    };
  }

  async loadServices(companyId) {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('weight', { ascending: false })
      .limit(50);
    
    return data || [];
  }

  async loadStaff(companyId) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('rating', { ascending: false });
    
    return data || [];
  }

  async loadConversation(phone, companyId) {
    const { data } = await supabase
      .from('dialog_contexts')
      .select('messages')
      .eq('user_id', phone)
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    return data?.messages || [];
  }

  async loadBusinessStats(companyId) {
    // Загрузка статистики дня (можно расширить)
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('appointments_cache')
      .select('*')
      .eq('company_id', companyId)
      .gte('appointment_datetime', today)
      .lt('appointment_datetime', today + 'T23:59:59');
    
    const totalSlots = 50; // Примерное количество слотов в день
    const bookedSlots = data?.length || 0;
    const todayLoad = Math.round((bookedSlots / totalSlots) * 100);
    
    return { todayLoad, bookedSlots, totalSlots };
  }

  /**
   * Определение типа бизнеса по данным компании
   */
  detectBusinessType(company) {
    const title = company.title.toLowerCase();
    const services = company.raw_data?.services || [];
    
    if (title.includes('барбер') || title.includes('barber')) {
      return 'barbershop';
    } else if (title.includes('ногт') || title.includes('маникюр') || title.includes('nail')) {
      return 'nails';
    } else if (title.includes('массаж') || title.includes('спа') || title.includes('spa')) {
      return 'massage';
    } else if (title.includes('эпиляц') || title.includes('лазер')) {
      return 'epilation';
    } else if (title.includes('брови') || title.includes('ресниц')) {
      return 'brows';
    }
    
    return 'beauty'; // По умолчанию салон красоты
  }

  /**
   * Получение терминологии для типа бизнеса
   */
  getBusinessTerminology(businessType) {
    const terminology = {
      barbershop: {
        role: 'администратор барбершопа',
        businessType: 'барбершоп',
        services: 'услуги',
        specialists: 'барберы',
        communicationStyle: 'дружелюбным и неформальным',
        suggestions: 'популярные стрижки и уход за бородой'
      },
      nails: {
        role: 'администратор студии маникюра',
        businessType: 'ногтевая студия',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'вежливым и заботливым',
        suggestions: 'актуальные дизайны и уходовые процедуры'
      },
      massage: {
        role: 'администратор массажного салона',
        businessType: 'массажный салон',
        services: 'процедуры',
        specialists: 'массажисты',
        communicationStyle: 'спокойным и профессиональным',
        suggestions: 'комплексные программы и курсы массажа'
      },
      epilation: {
        role: 'администратор студии эпиляции',
        businessType: 'студия лазерной эпиляции',
        services: 'процедуры',
        specialists: 'специалисты',
        communicationStyle: 'деликатным и информативным',
        suggestions: 'курсы процедур и сезонные предложения'
      },
      beauty: {
        role: 'администратор салона красоты',
        businessType: 'салон красоты',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'приветливым и профессиональным',
        suggestions: 'комплексные услуги и акции'
      }
    };
    
    return terminology[businessType] || terminology.beauty;
  }

  /**
   * Форматирование данных для промпта
   */
  formatServices(services, businessType) {
    if (!services.length) return 'Нет доступных услуг';
    
    return services.slice(0, 20).map(s => {
      const price = s.price_min ? `от ${s.price_min}₽` : 'по запросу';
      const duration = s.duration ? `${s.duration} мин` : '';
      return `- ${s.title} (${price}${duration ? ', ' + duration : ''}) [ID: ${s.yclients_id}]`;
    }).join('\n');
  }

  formatStaff(staff, businessType) {
    if (!staff.length) return 'Нет доступных специалистов';
    
    return staff.map(s => {
      const rating = s.rating ? `⭐ ${s.rating}` : '';
      const spec = s.specialization || 'универсал';
      return `- ${s.name} (${spec}${rating ? ', ' + rating : ''}) [ID: ${s.yclients_id}]`;
    }).join('\n');
  }

  formatConversation(messages) {
    if (!messages.length) return 'Нет предыдущих сообщений';
    
    return messages.map(m => 
      `${m.role === 'user' ? 'Клиент' : 'Админ'}: ${m.content}`
    ).join('\n');
  }

  formatWorkingHours(hours) {
    if (!hours) return 'не указаны';
    // Простое форматирование, можно улучшить
    return JSON.stringify(hours);
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('ru-RU');
  }

  getStaffNames(staffIds, staffList) {
    return staffIds
      .map(id => staffList.find(s => s.yclients_id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Форматирование результатов для клиента
   */
  formatSlots(slots, businessType) {
    if (!slots || !slots.length) {
      return '😔 К сожалению, на выбранное время нет свободных слотов. Могу предложить другое время или день.';
    }
    
    const terminology = this.getBusinessTerminology(businessType);
    let text = `📅 Доступное время:\n\n`;
    
    // Группируем по мастерам если есть
    const byStaff = {};
    slots.forEach(slot => {
      const staffName = slot.staff_name || 'Любой мастер';
      if (!byStaff[staffName]) byStaff[staffName] = [];
      byStaff[staffName].push(slot);
    });
    
    Object.entries(byStaff).slice(0, 3).forEach(([staffName, staffSlots]) => {
      text += `👤 ${staffName}:\n`;
      staffSlots.slice(0, 5).forEach(slot => {
        text += `  • ${slot.time || slot.datetime}\n`;
      });
      text += '\n';
    });
    
    return text;
  }

  formatBookingConfirmation(booking, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    return `Ваша запись подтверждена! Ждем вас ${booking.date} в ${booking.time}. ${terminology.specialists} ${booking.staff_name} будет вас ждать.`;
  }

  formatPrices(services, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    let text = `💰 Наши ${terminology.services}:\n\n`;
    
    services.slice(0, 10).forEach(s => {
      const price = s.price_min === s.price_max ? 
        `${s.price_min}₽` : 
        `${s.price_min}-${s.price_max}₽`;
      text += `${s.title} - ${price}\n`;
    });
    
    return text;
  }

  /**
   * Парсинг параметров команды
   */
  parseCommandParams(paramsString) {
    const params = {};
    const paramRegex = /(\w+):\s*([^,\]]+)/g;
    
    let match;
    while ((match = paramRegex.exec(paramsString)) !== null) {
      const [, key, value] = match;
      params[key.trim()] = value.trim();
    }
    
    return params;
  }

  /**
   * Удаление команд из ответа
   */
  removeCommands(response) {
    return response.replace(/\[(SEARCH_SLOTS|CREATE_BOOKING|SHOW_PRICES|SHOW_PORTFOLIO)[^\]]*\]/g, '').trim();
  }

  /**
   * Сохранение контекста
   */
  async saveContext(phone, companyId, context, result) {
    // Добавляем ответ в историю
    context.conversation.push({
      role: 'assistant',
      content: result.response,
      timestamp: new Date().toISOString()
    });
    
    // Сохраняем в БД
    await supabase
      .from('dialog_contexts')
      .upsert({
        user_id: phone,
        company_id: companyId,
        messages: context.conversation.slice(-50), // Последние 50 сообщений
        updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        message_count: context.conversation.length
      });
  }

  /**
   * Получение AI провайдера
   */
  async callAI(prompt) {
    if (!this.aiProvider) {
      this.aiProvider = require('../ai');
    }
    
    return await this.aiProvider._callAI(prompt);
  }

  /**
   * Сообщения об ошибках с учетом типа бизнеса
   */
  getErrorMessage(error, businessType) {
    const terminology = this.getBusinessTerminology(businessType);
    
    if (error.message.includes('timeout')) {
      return `Извините, сервис временно перегружен. Попробуйте через минуту или позвоните нам: ${terminology.businessType} всегда рад вам помочь!`;
    }
    
    return `Произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте еще раз или свяжитесь с нами по телефону.`;
  }

  /**
   * Очистка кеша
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > 600000) { // 10 минут
        this.contextCache.delete(key);
      }
    }
  }
}

module.exports = new AIAdminV2();