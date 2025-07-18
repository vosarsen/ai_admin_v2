const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger').child({ module: 'ai-admin-v2:data-loader' });

class DataLoader {
  /**
   * Загрузка информации о компании
   */
  async loadCompany(companyId) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();
    
    return data;
  }

  /**
   * Загрузка информации о клиенте
   */
  async loadClient(phone, companyId) {
    try {
      // Убираем @c.us если есть
      const cleanPhone = phone.replace('@c.us', '');
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', cleanPhone)
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (error) {
        logger.error('Error loading client:', error);
        return null;
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
    // Загружаем расписание на ближайшие 7 дней
    const today = new Date();
    const weekLater = new Date();
    weekLater.setDate(today.getDate() + 7);
    
    logger.info(`Loading staff schedules from ${today.toISOString().split('T')[0]} to ${weekLater.toISOString().split('T')[0]}`);
    
    // TODO: После выполнения миграции раскомментировать строку с company_id
    // Миграция: scripts/database/add-company-id-to-staff-schedules-fixed.sql
    const { data, error } = await supabase
      .from('staff_schedules')
      .select('*')
      // .eq('company_id', companyId) // TODO: Раскомментировать после миграции
      .gte('date', today.toISOString().split('T')[0])
      .lte('date', weekLater.toISOString().split('T')[0])
      .eq('is_working', true)
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
      const cleanPhone = phone.replace('@c.us', '');
      
      // Добавляем новое сообщение в историю
      const messages = context.conversation || [];
      messages.push({
        role: 'user',
        content: context.currentMessage,
        timestamp: new Date().toISOString()
      });
      messages.push({
        role: 'assistant',
        content: result.response,
        timestamp: new Date().toISOString()
      });
      
      // Оставляем только последние 20 сообщений
      const recentMessages = messages.slice(-20);
      
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
    } catch (error) {
      logger.error('Error saving context:', error);
    }
  }
}

module.exports = new DataLoader();