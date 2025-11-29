const logger = require('../../utils/logger');
const postgres = require('../../database/postgres');
const Sentry = require('@sentry/node');
const {
  BookingRepository,
  BookingNotificationRepository,
  CompanyRepository,
  ServiceRepository,
  StaffRepository
} = require('../../repositories');
const { YclientsClient } = require('../../integrations/yclients/client');
const whatsappClient = require('../../integrations/whatsapp/client');
const config = require('../../config');
const businessTypes = require('../../config/business-types');
const { detectBusinessType, defaultEmojis } = businessTypes;
const { generateDayBeforeReminder, generateTwoHoursReminder } = require('../reminder/templates');
const contextService = require('../context');
const reminderContextTracker = require('../reminder/reminder-context-tracker');
const messages = require('../../config/booking-monitor-messages');

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
    this.bookingRepo = new BookingRepository(postgres.pool);
    this.notificationRepo = new BookingNotificationRepository(postgres.pool);
    this.companyRepo = new CompanyRepository(postgres.pool);
    this.serviceRepo = new ServiceRepository(postgres.pool);
    this.staffRepo = new StaffRepository(postgres.pool);
    this.checkInterval = config.bookingMonitor?.checkInterval || 60000; // 1 минута по умолчанию
    this.duplicateCheckWindow = config.bookingMonitor?.duplicateCheckWindow || 60 * 60 * 1000; // 1 час по умолчанию
    this.isRunning = false;
    this.isChecking = false; // Mutex to prevent overlapping checks
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
    // Mutex to prevent overlapping checks
    if (this.isChecking) {
      logger.debug('⏭️ Skipping - previous check running');
      return;
    }
    this.isChecking = true;

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
        // Проверяем и отправляем напоминания
        await this.checkAndSendReminders(record);
      }

      // TODO: Migrate cleanup to use BookingRepository
      // Очищаем старые записи из bookings (старше 30 дней)
      // const thirtyDaysAgo = new Date();
      // thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      // await this.bookingRepo.delete... (implement later)

    } catch (error) {
      logger.error('❌ Error checking bookings:', error);
      Sentry.captureException(error, {
        tags: { component: 'booking-monitor', operation: 'checkBookings' }
      });
    } finally {
      this.isChecking = false;
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
      const previousState = await this.bookingRepo.findByRecordId(parseInt(recordId));

      // Подготавливаем текущее состояние для таблицы bookings
      const currentState = {
        yclients_record_id: parseInt(recordId),
        company_id: record.company_id || config.yclients.companyId,
        client_phone: this.formatPhoneNumber(record.client?.phone || record.phone || ''),
        client_name: record.client?.name || '',
        client_yclients_id: record.client?.id || null,
        staff_id: record.staff?.id || record.staff_id,
        staff_name: record.staff?.name || '',
        services: record.services?.map(s => s.title || s.name) || [],
        service_ids: record.services?.map(s => s.id) || [],
        datetime: record.datetime,
        date: record.datetime.split('T')[0],
        duration: record.seance_length || 0,
        cost: record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0,
        prepaid: record.prepaid || 0,
        status: record.deleted ? 'cancelled' : (record.attendance === 1 ? 'completed' : 'active'),
        visit_attendance: record.attendance || 0,
        comment: record.comment || '',
        online: record.online || false,
        created_by_bot: false,
        synced_at: now.toISOString(),
        updated_at: now.toISOString()
      };

      // Если записи нет в БД - это новая запись
      if (!previousState) {
        // Сохраняем состояние
        await this.bookingRepo.upsert(currentState);

        // Отправляем уведомление о создании только для attendance = 0 (ожидается)
        // и только если запись НЕ создана ботом
        if (!currentState.created_by_bot && record.attendance === 0) {
          logger.info(`📝 New booking ${recordId} created externally, sending confirmation`);
          await this.sendBookingConfirmation(record);
        } else if (currentState.created_by_bot) {
          logger.debug(`📝 New booking ${recordId} created by bot, skipping notification`);
        } else {
          logger.debug(`📝 New booking ${recordId} saved without notification (attendance=${record.attendance})`);
        }
        return;
      }

      // Проверяем изменения
      const changes = this.detectChanges(previousState, currentState);

      if (changes.length === 0) {
        // Обновляем только updated_at (используем upsert)
        await this.bookingRepo.upsert({
          ...currentState,
          updated_at: now.toISOString()
        });

        logger.debug(`✅ No changes in booking ${recordId}`);
        return;
      }

      // Обновляем состояние в БД (используем upsert)
      const updateData = {
        ...currentState,
        updated_at: now.toISOString()
      };

      await this.bookingRepo.upsert(updateData);

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
    const prevAttendance = previousState.visit_attendance ?? 0;
    const currAttendance = currentState.visit_attendance ?? 0;
    
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

    // Проверяем изменение услуг (с учетом порядка)
    const prevServices = (previousState.services || []).sort();
    const currServices = (currentState.services || []).sort();
    const prevServicesStr = JSON.stringify(prevServices);
    const currServicesStr = JSON.stringify(currServices);
    if (prevServicesStr !== currServicesStr) {
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

    // Проверяем услуги (с учетом порядка)
    const prevServices = (previousState.services || []).sort();
    const currServices = (currentState.services || []).sort();
    const prevServicesStr = JSON.stringify(prevServices);
    const currServicesStr = JSON.stringify(currServices);
    if (prevServicesStr !== currServicesStr) return true;

    // Проверяем цену
    if (previousState.cost !== currentState.cost) return true;

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
    let recentNotifications = [];
    try {
      recentNotifications = await this.notificationRepo.findRecent(
        parseInt(record.id),
        this.duplicateCheckWindow
      );
    } catch (error) {
      logger.error(`Failed to check recent notifications:`, error);
      Sentry.captureException(error, {
        tags: { component: 'booking-monitor', operation: 'sendChangeNotifications' }
      });
    }

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
    const isDuplicate = recentNotifications.some(n =>
      n.notification_type === notificationType
    );

    if (isDuplicate) {
      logger.debug(`⏭️ Skipping duplicate notification for booking ${record.id}`);
      return;
    }

    // Отправляем сообщение
    try {
      await this.whatsappClient.sendMessage(phone, message);

      // Сохраняем информацию об отправке
      await this.notificationRepo.create({
        yclients_record_id: parseInt(record.id),
        phone: phone,
        notification_type: notificationType,
        message: message,
        company_id: record.company_id || config.yclients.companyId
      });

      logger.info(`✅ ${notificationType} notification sent for booking ${record.id} to ${phone}`);
    } catch (error) {
      logger.error(`❌ Failed to send notification for booking ${record.id}:`, error);
      Sentry.captureException(error, {
        tags: { component: 'booking-monitor', operation: 'sendChangeNotifications' }
      });
    }
  }

  /**
   * Форматировать сообщение об отмене
   */
  async formatCancellationMessage(record, companyId) {
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    const services = record.services?.map(s => s.title).join(', ') || messages.defaults.service;

    return messages.cancellation.template
      .replace('{date}', date)
      .replace('{time}', time)
      .replace('{services}', services);
  }

  /**
   * Форматировать сообщение об изменениях
   */
  async formatChangeMessage(record, changes, previousState, companyId) {
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    const services = record.services?.map(s => s.title).join(', ') || messages.defaults.service;
    const staff = record.staff?.name || messages.defaults.staff;
    const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

    let changesList = [];

    changes.forEach(change => {
      if (change.type === 'booking_time_changed') {
        const oldDate = formatDate(new Date(change.oldValue));
        const oldTime = formatTime(new Date(change.oldValue));
        changesList.push(
          messages.change.changes.time
            .replace('{oldDateTime}', `${oldDate} ${oldTime}`)
            .replace('{newDateTime}', `${date} ${time}`)
        );
      } else if (change.type === 'booking_staff_changed') {
        changesList.push(
          messages.change.changes.staff
            .replace('{oldStaff}', change.oldValue || messages.change.changes.notSpecified)
            .replace('{newStaff}', staff)
        );
      } else if (change.type === 'booking_service_changed') {
        changesList.push(messages.change.changes.services);
      }
    });

    return messages.change.template
      .replace('{changesList}', changesList.join('\n'))
      .replace('{date}', date)
      .replace('{time}', time)
      .replace('{services}', services)
      .replace('{staff}', staff)
      .replace('{price}', price);
  }

  /**
   * Отправить подтверждение о создании записи
   */
  async sendBookingConfirmation(record) {
    try {
      const phone = this.formatPhoneNumber(record.client?.phone || record.phone || '');
      if (!phone) {
        logger.warn(`⚠️ No phone number for booking ${record.id}`);
        return;
      }

      // Форматируем сообщение
      const date = formatDate(new Date(record.datetime));
      const time = formatTime(new Date(record.datetime));
      const services = record.services?.map(s => s.title || s.name).join(', ') || 'Услуга';
      const staff = record.staff?.name || 'Специалист';
      const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
      
      // Получаем адрес компании
      let address = 'Малаховка, Южная улица, 38';
      try {
        const company = await this.companyRepo.findById(record.company_id || config.yclients.companyId);
        if (company?.address) {
          address = company.address;
        }
      } catch (error) {
        logger.warn('Failed to get company address:', error);
      }

      const message = `✅ Ваша запись успешно создана!

📅 ${date} в ${time}
💇 ${services}
👤 Мастер: ${staff}
${price > 0 ? `💰 Стоимость: ${price} руб.\n` : ''}
📍 Адрес: ${address}

До встречи! Если планы изменятся, пожалуйста, предупредите нас заранее.`;

      // Отправляем сообщение
      await this.whatsappClient.sendMessage(phone, message);

      // Сохраняем информацию об отправке
      await this.notificationRepo.create({
        yclients_record_id: parseInt(record.id),
        phone: phone,
        notification_type: 'booking_created',
        message: message,
        company_id: record.company_id || config.yclients.companyId
      });

      logger.info(`✅ booking_created notification sent for booking ${record.id} to ${phone}`);

    } catch (error) {
      logger.error(`❌ Error sending booking confirmation for ${record.id}:`, error);
      Sentry.captureException(error, {
        tags: { component: 'booking-monitor', operation: 'sendBookingConfirmation' }
      });
    }
  }

  /**
   * Получить конфигурацию бизнеса (эмодзи, терминологию)
   */
  async getBusinessConfig(companyId) {
    try {
      // Получаем информацию о компании
      const company = await this.companyRepo.findById(companyId);

      // Определяем тип бизнеса
      let businessType = company?.business_type;
      if (!businessType && company?.name) {
        // Пытаемся определить по названию компании
        const services = await this.serviceRepo.findAll(companyId);

        businessType = detectBusinessType(company.name, services || []);
      }

      // Получаем конфигурацию для типа бизнеса
      const businessConfig = businessTypes[businessType] || businessTypes.beauty;
      return {
        emojis: businessConfig.emojis || defaultEmojis,
        terminology: businessConfig.terminology || businessTypes.beauty.terminology,
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
      
      // Check if client visited today
      const todayVisits = await this.bookingRepo.findMany('bookings', {
        client_phone: phone,
        datetime: { gte: today.toISOString(), lte: tomorrow.toISOString() },
        visit_attendance: 1
      });
      
      if (todayVisits && todayVisits.length > 0) {
        logger.debug(`⏭️ Skipping reminder for ${phone} - client visited today`);
        return;
      }

      // Получаем информацию о ранее отправленных напоминаниях (FIXED: was hardcoded empty array!)
      let sentReminders = [];
      try {
        sentReminders = await this.notificationRepo.findSentToday(
          parseInt(record.id),
          ['reminder_day_before', 'reminder_2hours']
        );
        logger.debug(`📋 Found ${sentReminders.length} sent reminders for record ${record.id}`);
      } catch (error) {
        logger.error(`Failed to check sent reminders for ${record.id}:`, error);
        Sentry.captureException(error, {
          tags: { component: 'booking-monitor', operation: 'checkAndSendReminders' }
        });
      }

      // Проверяем, не отправляли ли мы уже напоминание сегодня
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const sentDayBeforeToday = sentReminders.some(r =>
        r.notification_type === 'reminder_day_before' &&
        new Date(r.sent_at) > todayStart
      );

      const sent2HoursToday = sentReminders.some(r =>
        r.notification_type === 'reminder_2hours' &&
        new Date(r.sent_at) > todayStart
      );
      
      // Рассчитываем время для напоминаний
      const timeDiff = recordDate - now;
      const hoursUntil = timeDiff / (1000 * 60 * 60);
      
      // Более точный расчёт: проверяем, что запись именно завтра
      const tomorrowDateCheck = new Date(now);
      tomorrowDateCheck.setDate(tomorrowDateCheck.getDate() + 1);
      const isRecordTomorrow = recordDate.toDateString() === tomorrowDateCheck.toDateString();
      
      // Напоминание за день (отправляем вечером предыдущего дня между 19:00 и 21:00)
      const currentHour = now.getHours();
      const isEvening = currentHour >= 19 && currentHour <= 21;
      
      // Логирование для отладки
      logger.debug(`📅 Reminder check for record ${recordId}:`, {
        now: now.toDateString(),
        recordDate: recordDate.toDateString(),
        tomorrow: tomorrowDateCheck.toDateString(),
        isRecordTomorrow,
        hoursUntil: Math.round(hoursUntil),
        isEvening
      });
      
      // Проверяем, нужно ли отправить напоминание за день
      if (isEvening && 
          isRecordTomorrow && 
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
      const company = await this.companyRepo.findById(companyId);
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
      const staff = record.staff?.name || 'Мастер';
      const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

      // Получаем информацию о компании и клиенте
      const companyInfo = await this.getCompanyInfo(record.company_id || config.yclients.companyId);
      const address = companyInfo?.address || '';

      // Получаем имя клиента
      const clientName = record.client?.name || '';

      // Получаем склонения для ВСЕХ услуг из БД
      const servicesWithDeclensions = [];
      if (record.services && record.services.length > 0) {
        for (const service of record.services) {
          const serviceInfo = {
            id: service.id,
            title: service.title,
            cost: service.cost || 0,
            declensions: null
          };

          // Пытаемся получить склонения из БД
          if (service.id) {
            try {
              const serviceData = await this.serviceRepo.findById(
                service.id,
                record.company_id || config.yclients.companyId
              );

              if (serviceData?.declensions) {
                serviceInfo.declensions = serviceData.declensions;
              }
            } catch (error) {
              logger.debug(`Could not fetch declensions for service ${service.id}:`, error);
            }
          }

          servicesWithDeclensions.push(serviceInfo);
        }
      }

      // Для обратной совместимости создаем строку со всеми услугами
      const services = servicesWithDeclensions.map(s => s.title).join(', ') || 'Услуга';

      // Для одной услуги используем старую логику (склонения первой услуги)
      const serviceDeclensions = servicesWithDeclensions.length > 0
        ? servicesWithDeclensions[0].declensions
        : null;
      
      // Получаем склонения для мастера из БД
      let staffDeclensions = null;
      if (record.staff?.id) {
        try {
          const staffData = await this.staffRepo.findById(
            record.staff.id,
            record.company_id || config.yclients.companyId
          );

          if (staffData?.declensions) {
            staffDeclensions = staffData.declensions;
          }
        } catch (error) {
          logger.debug('Could not fetch staff declensions:', error);
        }
      }
      
      // Подготавливаем данные для шаблона
      const templateData = {
        clientName: clientName,
        time: time,
        service: services, // Для обратной совместимости - строка со всеми услугами
        serviceDeclensions: serviceDeclensions, // Склонения первой услуги для обратной совместимости
        servicesWithDeclensions: servicesWithDeclensions, // НОВОЕ: массив всех услуг со склонениями
        staff: staff,
        staffDeclensions: staffDeclensions, // Передаем склонения мастера
        price: price,
        address: address,
        date: date
      };
      
      let message = '';
      let notificationType = '';
      
      if (reminderType === 'day_before') {
        notificationType = 'reminder_day_before';
        message = generateDayBeforeReminder(templateData);
      } else if (reminderType === '2hours') {
        notificationType = 'reminder_2hours';
        message = generateTwoHoursReminder(templateData);
      }
      
      if (!message) return;
      
      // Отправляем сообщение
      await this.whatsappClient.sendMessage(phone, message);
      
      // Сохраняем контекст напоминания для правильной обработки ответов
      const phoneForTracker = phone.replace('@c.us', '');
      await reminderContextTracker.saveReminderContext(phoneForTracker, {
        record_id: record.id,
        datetime: record.datetime,
        service_name: services,
        staff_name: staff,
        company_id: record.company_id || config.yclients.companyId // КРИТИЧНО для multi-tenant
      }, reminderType);
      
      // Сохраняем информацию об отправке в БД
      await this.notificationRepo.create({
        yclients_record_id: parseInt(record.id),
        phone: phone,
        notification_type: notificationType,
        message: message,
        company_id: record.company_id || config.yclients.companyId
      });
      
      // Добавляем напоминание в контекст диалога для AI Admin
      try {
        const phoneForContext = phone.replace('@c.us', '');
        const companyId = record.company_id || config.yclients.companyId;

        // Добавляем информацию о напоминании в историю
        const reminderInfo = {
          type: 'system_reminder',
          timestamp: new Date().toISOString(),
          reminderType: notificationType,
          message: message,
          bookingDetails: {
            datetime: record.datetime,
            services: services,
            staff: staff,
            price: price,
            recordId: record.id
          }
        };

        // Обновляем контекст с информацией о напоминании
        // NOTE: booking-monitor currently only supports WhatsApp reminders
        // Telegram reminders will be added in Phase 3
        const updateResult = await contextService.updateDialogContext(phoneForContext, companyId, {
          lastSystemAction: JSON.stringify(reminderInfo)
        }, { platform: 'whatsapp' });

        if (updateResult.success) {
          // Добавляем сообщение в историю диалога
          await contextService.addMessage(phoneForContext, companyId, {
            sender: 'system',
            text: `[Отправлено напоминание о записи]\n${message}`,
            timestamp: new Date().toISOString()
          }, { platform: 'whatsapp' });

          logger.info(`📝 Reminder added to dialog context for ${phoneForContext}`);
        } else {
          logger.warn(`Failed to update dialog context: ${updateResult.error}`);
        }
      } catch (error) {
        logger.warn('Failed to add reminder to context:', { error: error.message, stack: error.stack });
        // Не прерываем процесс, если не удалось обновить контекст
      }
      
      logger.info(`✅ ${notificationType} sent for booking ${record.id} to ${phone}`);
      
    } catch (error) {
      logger.error(`❌ Failed to send reminder for booking ${record.id}:`, error);
    }
  }
}

// Создаем singleton экземпляр
const bookingMonitor = new BookingMonitorService();

module.exports = bookingMonitor;