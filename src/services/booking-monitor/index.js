const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const { YclientsClient } = require('../../integrations/yclients/client');
const whatsappClient = require('../../integrations/whatsapp/client');
const config = require('../../config');
const businessTypes = require('../../config/business-types');
const { detectBusinessType, defaultEmojis } = businessTypes;

// Простые функции форматирования даты
const formatDate = (date) => {
  const d = new Date(date);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
};

const formatTime = (date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/**
 * Новый сервис мониторинга записей в YClients
 * Отслеживает изменения в записях и отправляет уведомления только когда нужно
 */
class BookingMonitorService {
  constructor() {
    this.yclientsClient = new YclientsClient();
    this.whatsappClient = whatsappClient;
    this.checkInterval = config.bookingMonitor?.checkInterval || 60000; // 1 минута по умолчанию
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Запустить мониторинг
   */
  start() {
    if (this.isRunning) {
      logger.warn('⚠️ Booking monitor is already running');
      return;
    }

    logger.info('🚀 Starting booking monitor service (new version)');
    this.isRunning = true;

    // Первая проверка сразу
    this.checkBookings();

    // Затем проверяем периодически
    this.intervalId = setInterval(() => {
      this.checkBookings();
    }, this.checkInterval);
  }

  /**
   * Остановить мониторинг
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('⚠️ Booking monitor is not running');
      return;
    }

    logger.info('🛑 Stopping booking monitor service');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Проверить записи и их изменения
   */
  async checkBookings() {
    try {
      logger.debug('🔍 Checking bookings for changes...');

      const companyId = config.yclients.companyId;

      // Получаем записи на сегодня и следующие 7 дней
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const formatDateForAPI = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Получаем записи из YClients
      const result = await this.yclientsClient.getRecords(companyId, {
        start_date: formatDateForAPI(today),
        end_date: formatDateForAPI(nextWeek)
      });

      const records = result.data || [];
      
      if (records.length === 0) {
        logger.debug('✅ No bookings found');
        return;
      }

      logger.info(`📋 Found ${records.length} bookings to check`);

      // Обрабатываем каждую запись
      for (const record of records) {
        await this.processBooking(record);
        // ВРЕМЕННО ОТКЛЮЧЕНО: Проверяем и отправляем напоминания
        // await this.checkAndSendReminders(record);
      }

      // Очищаем старые записи из booking_states (старше 30 дней)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await supabase
        .from('booking_states')
        .delete()
        .lt('datetime', thirtyDaysAgo.toISOString());

    } catch (error) {
      logger.error('❌ Error checking bookings:', error);
    }
  }

  /**
   * Обработать запись - проверить изменения и отправить уведомления если нужно
   */
  async processBooking(record) {
    try {
      const recordId = record.id.toString();
      const now = new Date();
      const recordDate = new Date(record.datetime);

      // Пропускаем записи в прошлом
      if (recordDate < now) {
        logger.debug(`⏭️ Skipping past booking ${recordId} at ${record.datetime}`);
        return;
      }

      // Пропускаем записи со статусом "пришел" (attendance = 1)
      if (record.attendance === 1) {
        logger.debug(`⏭️ Skipping completed booking ${recordId} (client attended)`);
        return;
      }

      // Получаем предыдущее состояние записи из БД
      const { data: previousState } = await supabase
        .from('booking_states')
        .select('*')
        .eq('yclients_record_id', recordId)
        .single();

      // Подготавливаем текущее состояние
      const currentState = {
        yclients_record_id: recordId,
        company_id: record.company_id || config.yclients.companyId,
        attendance: record.attendance || 0,
        datetime: record.datetime,
        services: record.services || [],
        staff_id: record.staff?.id || record.staff_id,
        staff_name: record.staff?.name || '',
        client_phone: this.formatPhoneNumber(record.client?.phone || record.phone || ''),
        client_name: record.client?.name || '',
        price: record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0,
        last_checked_at: now.toISOString()
      };

      // Если записи нет в БД - это новая запись
      if (!previousState) {
        // Сохраняем состояние
        await supabase
          .from('booking_states')
          .insert(currentState);

        // НЕ отправляем уведомление для новых записей с attendance = 0 или 2
        // Только если запись создана через админку (не через бота)
        if (record.attendance !== 2 && record.attendance !== 0) {
          logger.debug(`📝 New booking ${recordId} saved, but no notification (attendance=${record.attendance})`);
        } else {
          logger.debug(`📝 New booking ${recordId} saved without notification`);
        }
        return;
      }

      // Проверяем изменения
      const changes = this.detectChanges(previousState, currentState);

      if (changes.length === 0) {
        // Обновляем только last_checked_at
        await supabase
          .from('booking_states')
          .update({ last_checked_at: now.toISOString() })
          .eq('yclients_record_id', recordId);
        
        logger.debug(`✅ No changes in booking ${recordId}`);
        return;
      }

      // Обновляем состояние в БД с сохранением предыдущих значений
      const updateData = {
        ...currentState,
        last_attendance: previousState.attendance,
        last_datetime: previousState.datetime,
        last_services: previousState.services,
        last_staff_id: previousState.staff_id,
        updated_at: now.toISOString()
      };

      await supabase
        .from('booking_states')
        .update(updateData)
        .eq('yclients_record_id', recordId);

      // Отправляем уведомления об изменениях
      await this.sendChangeNotifications(record, changes, previousState);

    } catch (error) {
      logger.error(`❌ Error processing booking ${record.id}:`, error);
    }
  }

  /**
   * Определить изменения между состояниями
   */
  detectChanges(previousState, currentState) {
    const changes = [];

    // ВАЖНО: Сначала проверяем статусы attendance
    // Игнорируем изменения статуса на "подтвержден" (0->2, null->2, undefined->2)
    const prevAttendance = previousState.attendance ?? 0;
    const currAttendance = currentState.attendance ?? 0;
    
    // Если только изменился статус с "ожидается" на "подтвержден"
    if ((prevAttendance === 0 || prevAttendance === null || prevAttendance === undefined) && 
        currAttendance === 2) {
      logger.debug('📝 Booking confirmed (0/null->2), no notification needed');
      // Проверяем есть ли другие изменения кроме статуса
      const hasOtherChanges = this.hasOtherChanges(previousState, currentState);
      if (!hasOtherChanges) {
        return []; // Если только статус изменился - не отправляем уведомление
      }
    }

    // Если изменился на статус "пришел"
    if (currAttendance === 1) {
      logger.debug('📝 Client attended (->1), no notification needed');
      return [];
    }

    // Проверяем отмену (attendance изменился на -1)
    if (prevAttendance !== -1 && currAttendance === -1) {
      changes.push({
        type: 'booking_cancelled',
        description: 'Запись отменена'
      });
    }

    // Проверяем изменение времени
    const prevTime = new Date(previousState.datetime).getTime();
    const currTime = new Date(currentState.datetime).getTime();
    if (prevTime !== currTime) {
      changes.push({
        type: 'booking_time_changed',
        description: 'Изменено время записи',
        oldValue: previousState.datetime,
        newValue: currentState.datetime
      });
    }

    // Проверяем изменение мастера
    if (previousState.staff_id !== currentState.staff_id && currentState.staff_id) {
      changes.push({
        type: 'booking_staff_changed',
        description: 'Изменен мастер',
        oldValue: previousState.staff_name,
        newValue: currentState.staff_name
      });
    }

    // Проверяем изменение услуг
    const prevServices = JSON.stringify(previousState.services || []);
    const currServices = JSON.stringify(currentState.services || []);
    if (prevServices !== currServices) {
      changes.push({
        type: 'booking_service_changed',
        description: 'Изменены услуги',
        oldValue: previousState.services,
        newValue: currentState.services
      });
    }

    return changes;
  }

  /**
   * Проверить есть ли изменения помимо статуса attendance
   */
  hasOtherChanges(previousState, currentState) {
    // Проверяем время
    const prevTime = new Date(previousState.datetime).getTime();
    const currTime = new Date(currentState.datetime).getTime();
    if (prevTime !== currTime) return true;

    // Проверяем мастера
    if (previousState.staff_id !== currentState.staff_id) return true;

    // Проверяем услуги
    const prevServices = JSON.stringify(previousState.services || []);
    const currServices = JSON.stringify(currentState.services || []);
    if (prevServices !== currServices) return true;

    // Проверяем цену
    if (previousState.price !== currentState.price) return true;

    return false;
  }

  /**
   * Отправить уведомления об изменениях
   */
  async sendChangeNotifications(record, changes, previousState) {
    const phone = this.formatPhoneNumber(record.client?.phone || record.phone);
    
    if (!phone) {
      logger.warn(`⚠️ No phone number for booking ${record.id}`);
      return;
    }

    // Проверяем, не отправляли ли мы уже уведомление об этих изменениях недавно
    const { data: recentNotifications } = await supabase
      .from('booking_notifications')
      .select('*')
      .eq('yclients_record_id', record.id.toString())
      .gte('sent_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // За последние 30 минут
      .order('sent_at', { ascending: false });

    // Группируем изменения для одного сообщения
    let message = '';
    let notificationType = '';

    // Проверяем тип изменений
    const isCancelled = changes.some(c => c.type === 'booking_cancelled');
    const timeChanged = changes.find(c => c.type === 'booking_time_changed');
    const staffChanged = changes.find(c => c.type === 'booking_staff_changed');
    const serviceChanged = changes.find(c => c.type === 'booking_service_changed');

    if (isCancelled) {
      // Отмена записи
      notificationType = 'booking_cancelled';
      message = await this.formatCancellationMessage(record, record.company_id || config.yclients.companyId);
    } else if (timeChanged || staffChanged || serviceChanged) {
      // Изменения в записи
      notificationType = 'booking_changed';
      message = await this.formatChangeMessage(record, changes, previousState, record.company_id || config.yclients.companyId);
    }

    if (!message) {
      logger.debug(`📝 No notification needed for changes in booking ${record.id}`);
      return;
    }

    // Проверяем, не отправляли ли мы такое же уведомление недавно
    const isDuplicate = recentNotifications?.some(n => 
      n.notification_type_new === notificationType
    );

    if (isDuplicate) {
      logger.debug(`⏭️ Skipping duplicate notification for booking ${record.id}`);
      return;
    }

    // Отправляем сообщение
    try {
      await this.whatsappClient.sendMessage(phone, message);

      // Сохраняем информацию об отправке
      await supabase
        .from('booking_notifications')
        .insert({
          yclients_record_id: record.id.toString(),
          phone: phone,
          notification_type: notificationType, // Старое поле для совместимости
          notification_type_new: notificationType,
          message: message,
          sent_at: new Date().toISOString(),
          company_id: record.company_id || config.yclients.companyId
        });

      logger.info(`✅ ${notificationType} notification sent for booking ${record.id} to ${phone}`);
    } catch (error) {
      logger.error(`❌ Failed to send notification for booking ${record.id}:`, error);
    }
  }

  /**
   * Форматировать сообщение об отмене
   */
  async formatCancellationMessage(record, companyId) {
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    const services = record.services?.map(s => s.title).join(', ') || 'Услуга';

    return `Ваша запись отменена

${date} в ${time}
${services}

Если это ошибка, пожалуйста, свяжитесь с нами для восстановления записи.`;
  }

  /**
   * Форматировать сообщение об изменениях
   */
  async formatChangeMessage(record, changes, previousState, companyId) {
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    const services = record.services?.map(s => s.title).join(', ') || 'Услуга';
    const staff = record.staff?.name || 'Специалист';
    const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

    let changesList = [];

    changes.forEach(change => {
      if (change.type === 'booking_time_changed') {
        const oldDate = formatDate(new Date(change.oldValue));
        const oldTime = formatTime(new Date(change.oldValue));
        changesList.push(`Время изменено: ${oldDate} ${oldTime} → ${date} ${time}`);
      } else if (change.type === 'booking_staff_changed') {
        changesList.push(`Мастер изменен: ${change.oldValue || 'Не указан'} → ${staff}`);
      } else if (change.type === 'booking_service_changed') {
        changesList.push(`Услуги изменены`);
      }
    });

    return `Ваша запись изменена

${changesList.join('\n')}

Актуальные данные:
${date} в ${time}
${services}
Мастер: ${staff}
${price > 0 ? `Стоимость: ${price} руб.\n` : ''}
Если есть вопросы - пишите!`;
  }

  /**
   * Получить конфигурацию бизнеса (эмодзи, терминологию)
   */
  async getBusinessConfig(companyId) {
    try {
      // Получаем информацию о компании
      const { data: company } = await supabase
        .from('companies')
        .select('name, business_type')
        .eq('yclients_id', companyId)
        .single();
      
      // Определяем тип бизнеса
      let businessType = company?.business_type;
      if (!businessType && company?.name) {
        // Пытаемся определить по названию компании
        const { data: services } = await supabase
          .from('services')
          .select('title')
          .eq('company_id', companyId)
          .limit(10);
        
        businessType = detectBusinessType(company.name, services || []);
      }
      
      // Получаем конфигурацию для типа бизнеса
      const config = businessTypes[businessType] || businessTypes.beauty;
      return {
        emojis: config.emojis || defaultEmojis,
        terminology: config.terminology || businessTypes.beauty.terminology,
        businessType: businessType || 'beauty'
      };
    } catch (error) {
      logger.warn('Failed to get business config, using defaults', error);
      return {
        emojis: defaultEmojis,
        terminology: businessTypes.beauty.terminology,
        businessType: 'beauty'
      };
    }
  }

  /**
   * Форматировать номер телефона
   */
  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Удаляем все не-цифры
    let cleaned = phone.replace(/\D/g, '');
    
    // Если начинается с 8, заменяем на 7
    if (cleaned.startsWith('8') && cleaned.length === 11) {
      cleaned = '7' + cleaned.slice(1);
    }
    
    // Если не начинается с 7, добавляем
    if (!cleaned.startsWith('7') && cleaned.length === 10) {
      cleaned = '7' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Проверить и отправить напоминания для записи
   */
  async checkAndSendReminders(record) {
    try {
      const recordId = record.id.toString();
      const now = new Date();
      const recordDate = new Date(record.datetime);
      
      // Пропускаем прошедшие записи
      if (recordDate <= now) {
        return;
      }

      // Пропускаем отмененные записи или записи со статусом "пришел"
      if (record.attendance === -1 || record.attendance === 1) {
        return;
      }

      const phone = this.formatPhoneNumber(record.client?.phone || record.phone);
      if (!phone) {
        return;
      }

      // ВАЖНО: Проверяем, был ли клиент сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      
      const { data: todayVisits } = await supabase
        .from('booking_states')
        .select('*')
        .eq('client_phone', phone)
        .gte('datetime', today.toISOString())
        .lt('datetime', tomorrow.toISOString())
        .eq('attendance', 1);
      
      if (todayVisits && todayVisits.length > 0) {
        logger.debug(`⏭️ Skipping reminder for ${phone} - client visited today`);
        return;
      }

      // Получаем информацию о ранее отправленных напоминаниях
      const { data: sentReminders } = await supabase
        .from('booking_notifications')
        .select('notification_type_new, sent_at')
        .eq('yclients_record_id', recordId)
        .in('notification_type_new', ['reminder_day_before', 'reminder_2hours'])
        .order('sent_at', { ascending: false });

      // Проверяем, не отправляли ли мы уже напоминание сегодня
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const sentDayBeforeToday = sentReminders?.some(r => 
        r.notification_type_new === 'reminder_day_before' && 
        new Date(r.sent_at) > todayStart
      );
      
      const sent2HoursToday = sentReminders?.some(r => 
        r.notification_type_new === 'reminder_2hours' && 
        new Date(r.sent_at) > todayStart
      );
      
      // Рассчитываем время для напоминаний
      const timeDiff = recordDate - now;
      const hoursUntil = timeDiff / (1000 * 60 * 60);
      const daysUntil = Math.floor(hoursUntil / 24);
      
      // Напоминание за день (отправляем вечером предыдущего дня между 19:00 и 21:00)
      const currentHour = now.getHours();
      const isEvening = currentHour >= 19 && currentHour <= 21;
      const isTomorrow = daysUntil === 0 && recordDate.getDate() !== now.getDate() || daysUntil === 1;
      
      // Проверяем, нужно ли отправить напоминание за день
      if (isEvening && 
          isTomorrow && 
          !sentDayBeforeToday) {
        
        await this.sendReminderNotification(record, 'day_before', phone);
      }
      
      // Напоминание за 2 часа (только в день записи)
      const isToday = recordDate.toDateString() === now.toDateString();
      if (isToday &&
          hoursUntil <= 2.5 && 
          hoursUntil >= 1.5 && 
          !sent2HoursToday) {
        
        await this.sendReminderNotification(record, '2hours', phone);
      }
      
    } catch (error) {
      logger.error(`❌ Error checking reminders for booking ${record.id}:`, error);
    }
  }

  /**
   * Получить информацию о компании
   */
  async getCompanyInfo(companyId) {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('address')
        .eq('yclients_id', companyId)
        .single();
      
      return company;
    } catch (error) {
      logger.warn('Failed to get company info', error);
      return null;
    }
  }

  /**
   * Отправить напоминание о записи
   */
  async sendReminderNotification(record, reminderType, phone) {
    try {
      const recordDate = new Date(record.datetime);
      const now = new Date();
      const date = formatDate(recordDate);
      const time = formatTime(recordDate);
      const services = record.services?.map(s => s.title).join(', ') || 'Услуга';
      const staff = record.staff?.name || 'Мастер';
      const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
      
      // Получаем информацию о компании из базы данных
      const companyInfo = await this.getCompanyInfo(record.company_id || config.yclients.companyId);
      const address = companyInfo?.address || '';
      
      // Получаем конфигурацию бизнеса (эмодзи и терминологию)
      const businessConfig = await this.getBusinessConfig(record.company_id || config.yclients.companyId);
      const { emojis = defaultEmojis, terminology = businessTypes.beauty.terminology } = businessConfig || {};
      
      // Определяем, это сегодня или завтра
      const isToday = recordDate.toDateString() === now.toDateString();
      const dayText = isToday ? 'сегодня' : 'завтра';
      
      let message = '';
      let notificationType = '';
      
      if (reminderType === 'day_before') {
        notificationType = 'reminder_day_before';
        message = `Добрый вечер! Напоминаем, что завтра вас ждут:

${date} в ${time}
${services}
Мастер: ${staff}
${price > 0 ? `Стоимость: ${price} руб.\n` : ''}
${address ? `Адрес: ${address}\n` : ''}
Если планы изменились, пожалуйста, предупредите заранее.`;
      } else if (reminderType === '2hours') {
        notificationType = 'reminder_2hours';
        message = `Здравствуйте! Через 2 часа вас ждут.

Сегодня в ${time}
${services}
Мастер: ${staff}
${price > 0 ? `Стоимость: ${price} руб.\n` : ''}
${address ? `Адрес: ${address}\n` : ''}
До встречи!`;
      }
      
      if (!message) return;
      
      // Отправляем сообщение
      await this.whatsappClient.sendMessage(phone, message);
      
      // Сохраняем информацию об отправке
      await supabase
        .from('booking_notifications')
        .insert({
          yclients_record_id: record.id.toString(),
          phone: phone,
          notification_type: notificationType, // Для совместимости
          notification_type_new: notificationType,
          message: message,
          sent_at: new Date().toISOString(),
          company_id: record.company_id || config.yclients.companyId
        });
      
      logger.info(`✅ ${notificationType} sent for booking ${record.id} to ${phone}`);
      
    } catch (error) {
      logger.error(`❌ Failed to send reminder for booking ${record.id}:`, error);
    }
  }
}

// Создаем singleton экземпляр
const bookingMonitor = new BookingMonitorService();

module.exports = bookingMonitor;