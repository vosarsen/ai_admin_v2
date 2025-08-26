const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:data-loader' });
const { CompanyInfoSync } = require('../../../sync/company-info-sync');
const companyInfoSync = new CompanyInfoSync();

class DataLoader {
  /**
   * Валидация входных данных
   * Supabase использует параметризованные запросы, поэтому санитизация не нужна
   */
  validateInput(input, type = 'any') {
    if (input === null || input === undefined) return input;
    
    // Валидация по типу
    switch (type) {
      case 'companyId':
      case 'number':
        if (typeof input !== 'number' || isNaN(input)) {
          throw new Error(`Invalid ${type}: ${input}`);
        }
        return input;
      
      case 'phone':
        if (typeof input !== 'string' || !input.match(/^\+?\d{10,15}$/)) {
          logger.warn(`Invalid phone format: ${input}`);
        }
        return input;
      
      default:
        return input;
    }
  }

  /**
   * Загрузка информации о компании
   */
  async loadCompany(companyId) {
    try {
      // Валидация входных данных
      const safeCompanyId = this.validateInput(companyId, 'companyId');
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', safeCompanyId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // Данных нет в БД - синхронизируем из YClients
        logger.info(`Company ${companyId} not found in DB, syncing from YClients...`);
        const syncedData = await companyInfoSync.syncCompanyInfo(companyId);
        return syncedData;
      }
      
      if (error) {
        throw error;
      }
      
      // Проверяем актуальность данных (обновляем если старше 24 часов)
      if (data && data.updated_at) {
        const lastUpdate = new Date(data.updated_at);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceUpdate > 24) {
          logger.info(`Company ${companyId} data is ${hoursSinceUpdate.toFixed(1)} hours old, refreshing...`);
          try {
            const syncedData = await companyInfoSync.syncCompanyInfo(companyId);
            return syncedData;
          } catch (syncError) {
            logger.error('Failed to refresh company data, using cached:', syncError);
            // Используем кэшированные данные если обновление не удалось
          }
        }
      }
      
      // Добавляем business_type из raw_data если его нет
      if (data && !data.business_type && data.raw_data?.short_descr) {
        data.business_type = this.detectBusinessType(data.raw_data.short_descr);
      }
      
      return data;
    } catch (error) {
      logger.error(`Error loading company ${companyId}:`, error);
      
      // Возвращаем минимальные данные чтобы бот продолжил работать
      const config = require('../../../config');
      return {
        company_id: companyId,
        title: config.company?.defaultTitle || 'Салон красоты',
        address: config.company?.defaultAddress || '',
        phone: config.company?.defaultPhone || '',
        timezone: config.app?.timezone || 'Europe/Moscow',
        working_hours: config.company?.defaultWorkingHours || {
          monday: { start: '10:00', end: '22:00' },
          tuesday: { start: '10:00', end: '22:00' },
          wednesday: { start: '10:00', end: '22:00' },
          thursday: { start: '10:00', end: '22:00' },
          friday: { start: '10:00', end: '22:00' },
          saturday: { start: '10:00', end: '22:00' },
          sunday: { start: '10:00', end: '20:00' }
        }
      };
    }
  }

  /**
   * Определить тип бизнеса по описанию из YClients
   */
  detectBusinessType(shortDescr) {
    if (!shortDescr) return 'beauty';
    
    const description = shortDescr.toLowerCase();
    
    // Маппинг описаний YClients на типы бизнеса AI Admin
    const businessTypeMap = {
      'барбершоп': 'barbershop',
      'barbershop': 'barbershop',
      'мужская парикмахерская': 'barbershop',
      'для мужчин': 'barbershop',
      'маникюр': 'nails',
      'ногти': 'nails',
      'ногтевая': 'nails',
      'nail': 'nails',
      'массаж': 'massage',
      'спа': 'massage',
      'spa': 'massage',
      'эпиляция': 'epilation',
      'депиляция': 'epilation',
      'шугаринг': 'epilation',
      'воск': 'epilation',
      'брови': 'brows',
      'ресницы': 'brows',
      'brow': 'brows',
      'lash': 'brows'
    };

    // Ищем совпадения
    for (const [keyword, type] of Object.entries(businessTypeMap)) {
      if (description.includes(keyword)) {
        return type;
      }
    }

    // По умолчанию - универсальный салон красоты
    return 'beauty';
  }

  /**
   * Загрузка информации о клиенте
   */
  async loadClient(phone, companyId) {
    try {
      // Валидация входных данных
      const safePhone = this.validateInput(phone, 'phone');
      const safeCompanyId = this.validateInput(companyId, 'companyId');
      
      // Убираем @c.us если есть, но оставляем + для raw_phone
      const cleanPhone = safePhone.replace('@c.us', '');
      
      // Добавляем + если его нет (для поиска по raw_phone)
      const phoneWithPlus = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
      
      logger.debug(`Searching for client with raw_phone: ${phoneWithPlus} in company: ${safeCompanyId}`);
      
      // Ищем по raw_phone (с +)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('raw_phone', phoneWithPlus)
        .eq('company_id', safeCompanyId)
        .maybeSingle();
      
      if (error) {
        logger.error('Error loading client:', error);
        return null;
      }
      
      if (data) {
        logger.info(`✅ Client found: ${data.name} (${data.phone})`);
        
        // Маппинг полей для совместимости с персонализацией
        if (data.visit_history) {
          data.visits = data.visit_history; // Для ServiceMatcher.calculatePersonalizationScore
        }
        if (data.services_amount) {
          data.average_check = Math.round(data.services_amount / (data.visit_count || 1));
        }
        // favorite_services пока не храним в БД, но можем извлечь из last_services
        if (data.last_services && Array.isArray(data.last_services)) {
          // Пытаемся найти ID услуг по названиям (временное решение)
          data.favorite_services = [];
        }
        
        logger.debug(`Client data mapped for personalization:`, {
          has_visits: !!data.visits,
          visit_count: data.visit_count,
          average_check: data.average_check
        });
      } else {
        logger.debug(`No client found for raw_phone: ${phoneWithPlus}`);
      }
      
      return data;
    } catch (error) {
      logger.error('Error in loadClient:', error);
      return null;
    }
  }

  /**
   * Загрузка услуг компании
   */
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

  /**
   * Загрузка персонала компании
   */
  async loadStaff(companyId) {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('rating', { ascending: false });
    
    return data || [];
  }

  /**
   * Загрузка записей клиента
   */
  async loadBookings(clientId, companyId) {
    try {
      if (!clientId) {
        logger.debug('No clientId provided for loadBookings');
        return [];
      }
      
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('client_id', clientId)
        .eq('company_id', companyId)
        .gte('appointment_datetime', new Date().toISOString())
        .order('appointment_datetime', { ascending: true })
        .limit(10);
      
      if (error) {
        // Если таблица не существует, просто возвращаем пустой массив
        if (error.code === '42P01') {
          logger.debug('Bookings table does not exist yet');
        } else {
          logger.error('Error loading bookings:', error);
        }
        return [];
      }
      
      return data || [];
    } catch (error) {
      logger.error('Error in loadBookings:', error);
      return [];
    }
  }

  /**
   * Загрузка последних сообщений
   */
  async loadRecentMessages(phone, companyId) {
    try {
      // В текущей версии сообщения хранятся в Redis контексте
      // Этот метод возвращает пустой массив для совместимости
      logger.debug('loadRecentMessages called - messages are in Redis context');
      return [];
    } catch (error) {
      logger.error('Error in loadRecentMessages:', error);
      return [];
    }
  }

  /**
   * Загрузка истории диалога
   */
  async loadConversation(phone, companyId) {
    try {
      // Убираем @c.us если есть
      const cleanPhone = phone.replace('@c.us', '');
      
      const { data, error } = await supabase
        .from('dialog_contexts')
        .select('messages')
        .eq('user_id', cleanPhone)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        logger.error('Error loading conversation:', error);
        return [];
      }
      
      return data?.messages || [];
    } catch (error) {
      logger.error('Error in loadConversation:', error);
      return [];
    }
  }

  /**
   * Загрузка статистики бизнеса
   */
  async loadBusinessStats(companyId) {
    try {
      // Загрузка статистики дня (можно расширить)
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments_cache')
        .select('*')
        .eq('company_id', companyId)
        .gte('appointment_datetime', today)
        .lt('appointment_datetime', today + 'T23:59:59');
      
      if (error) {
        logger.error('Error loading business stats:', error);
      }
      
      const totalSlots = 50; // Примерное количество слотов в день
      const bookedSlots = data?.length || 0;
      const todayLoad = Math.round((bookedSlots / totalSlots) * 100);
      
      return { todayLoad, bookedSlots, totalSlots };
    } catch (error) {
      logger.error('Error in loadBusinessStats:', error);
      return { todayLoad: 0, bookedSlots: 0, totalSlots: 50 };
    }
  }

  /**
   * Загрузка расписания персонала
   */
  async loadStaffSchedules(companyId) {
    // Загружаем расписание на ближайшие 30 дней
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 30);
    
    logger.info(`Loading staff schedules from ${today.toISOString().split('T')[0]} to ${weekLater.toISOString().split('T')[0]}`);
    
    // Получаем список staff_id для данной компании
    const { data: companyStaff } = await supabase
      .from('staff')
      .select('yclients_id')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    const staffIds = companyStaff?.map(s => s.yclients_id) || [];
    
    if (staffIds.length === 0) {
      logger.warn('No active staff found for company', companyId);
      return {};
    }
    
    // Фильтруем расписание по staff_id вместо company_id
    const { data, error } = await supabase
      .from('staff_schedules')
      .select('*')
      .in('staff_id', staffIds)
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', weekLater.toISOString().split('T')[0])
      .order('date', { ascending: true });
    
    if (error) {
      logger.error('Error loading staff schedules:', error);
      return {};
    }
    
    logger.info(`Loaded ${data?.length || 0} schedule records`);
    
    // Группируем по дням для удобства
    const scheduleByDate = {};
    data?.forEach(schedule => {
      if (!scheduleByDate[schedule.date]) {
        scheduleByDate[schedule.date] = [];
      }
      scheduleByDate[schedule.date].push(schedule);
    });
    
    // Логируем расписание на сегодня для отладки
    const todayStr = today.toISOString().split('T')[0];
    logger.info(`Today's schedule (${todayStr}):`, {
      recordsCount: scheduleByDate[todayStr]?.length || 0,
      todayData: scheduleByDate[todayStr],
      allDates: Object.keys(scheduleByDate)
    });
    
    return scheduleByDate;
  }

  /**
   * Сохранение контекста диалога
   */
  async saveContext(phone, companyId, context, result) {
    try {
      // Валидация входных данных
      const safePhone = this.validateInput(phone, 'phone');
      const safeCompanyId = this.validateInput(companyId, 'companyId');
      const cleanPhone = safePhone.replace('@c.us', '');
      
      // Добавляем новое сообщение в историю
      const messages = context.conversation || [];
      messages.push({
        role: 'user',
        content: this.validateInput(context.currentMessage),
        timestamp: new Date().toISOString()
      });
      messages.push({
        role: 'assistant',
        content: this.validateInput(result.response),
        timestamp: new Date().toISOString()
      });
      
      // Оставляем только последние 20 сообщений
      const recentMessages = messages.slice(-20);
      
      // Сохраняем в Supabase
      await supabase
        .from('dialog_contexts')
        .upsert({
          user_id: cleanPhone,
          company_id: companyId,
          messages: recentMessages,
          last_command: result.executedCommands?.[0]?.command || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,company_id'
        });
      
      // ВАЖНО: Также сохраняем контекст в Redis для быстрого доступа
      const contextServiceV2 = require('../../context/context-service-v2');
      
      // Сохраняем информацию о последней команде и услуге через updateDialogContext
      const contextUpdates = {
        selection: {
          lastCommand: result.executedCommands?.[0]?.command || null,
          lastService: result.executedCommands?.[0]?.params?.service_name || null,
          lastStaff: result.executedCommands?.[0]?.params?.staff_name || null,
        },
        clientName: context.client?.name || null
      };
      
      await contextServiceV2.updateDialogContext(cleanPhone, companyId, contextUpdates);
      
      // Добавляем сообщения в историю
      for (const msg of recentMessages.slice(-5)) {
        await contextServiceV2.addMessage(cleanPhone, companyId, {
          text: msg.content,
          type: msg.role === 'user' ? 'incoming' : 'outgoing',
          timestamp: msg.timestamp || new Date().toISOString()
        });
      }
      
      logger.info('Context saved to both Supabase and Redis');
    } catch (error) {
      logger.error('Error saving context:', error);
    }
  }
}

module.exports = new DataLoader();