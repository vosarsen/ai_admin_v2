const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const { YclientsClient } = require('../../integrations/yclients/client');
const whatsappClient = require('../../integrations/whatsapp/client');
const config = require('../../config');

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
 * Сервис мониторинга новых записей в YClients
 * Периодически проверяет новые записи и отправляет уведомления клиентам
 */
class BookingMonitorService {
  constructor() {
    this.yclientsClient = new YclientsClient();
    this.whatsappClient = whatsappClient; // Используем уже созданный экземпляр
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

    logger.info('🚀 Starting booking monitor service');
    this.isRunning = true;

    // Первая проверка сразу
    this.checkNewBookings();

    // Затем проверяем периодически
    this.intervalId = setInterval(() => {
      this.checkNewBookings();
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
   * Проверить новые записи
   */
  async checkNewBookings() {
    try {
      logger.debug('🔍 Checking for new bookings...');

      const companyId = config.yclients.companyId;

      // Получаем записи на сегодня и завтра
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      logger.debug(`📅 Checking bookings for today and tomorrow`);

      // Получаем записи из YClients
      const formatDateForAPI = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const records = await this.yclientsClient.getRecords(companyId, {
        start_date: formatDateForAPI(today),
        end_date: formatDateForAPI(tomorrow)
      });

      if (!records.data || records.data.length === 0) {
        logger.debug('✅ No bookings found');
        return;
      }

      logger.info(`📋 Found ${records.data.length} bookings to check`);

      // Получаем все уже обработанные записи из БД
      const { data: processedRecords } = await supabase
        .from('booking_notifications')
        .select('yclients_record_id')
        .not('yclients_record_id', 'is', null);

      const processedIds = new Set(processedRecords?.map(r => r.yclients_record_id.toString()) || []);
      
      // Фильтруем только необработанные записи и записи в будущем
      const now = new Date();
      const newRecords = records.data.filter(record => {
        // Пропускаем уже обработанные
        if (processedIds.has(record.id.toString())) {
          return false;
        }
        
        // Пропускаем записи на прошедшее время
        const recordDate = new Date(record.datetime);
        if (recordDate < now) {
          logger.debug(`⏭️ Skipping past booking ${record.id} at ${record.datetime}`);
          return false;
        }
        
        // Пропускаем записи созданные более 30 минут назад
        const createdAt = new Date(record.created || record.datetime);
        const timeSinceCreation = now - createdAt;
        const maxAge = 30 * 60 * 1000; // 30 минут
        if (timeSinceCreation > maxAge) {
          logger.debug(`⏭️ Skipping old booking ${record.id} created ${Math.round(timeSinceCreation / 1000 / 60)} minutes ago`);
          return false;
        }
        
        return true;
      });

      if (newRecords.length === 0) {
        logger.debug('✅ No new bookings found (all already processed)');
        return;
      }

      logger.info(`📋 Found ${newRecords.length} new bookings to process`);

      // Обрабатываем каждую новую запись
      for (const record of newRecords) {
        await this.processNewBooking(record);
      }

    } catch (error) {
      logger.error('❌ Error checking new bookings:', error);
    }
  }

  /**
   * Обработать новую запись
   */
  async processNewBooking(record) {
    try {
      // Проверяем, не отправляли ли мы уже уведомление для этой записи
      const { data: existingNotification } = await supabase
        .from('booking_notifications')
        .select('id')
        .eq('yclients_record_id', record.id.toString())
        .single();

      if (existingNotification) {
        logger.debug(`✅ Notification already sent for booking ${record.id}`);
        return;
      }

      // Проверяем, создана ли запись через нашего бота
      const { data: ourBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('yclients_record_id', record.id)
        .single();

      if (ourBooking) {
        logger.debug(`✅ Booking ${record.id} was created by our bot, skipping notification`);
        return;
      }

      // Проверяем, есть ли номер телефона клиента
      const phone = record.client?.phone || record.phone;
      if (!phone) {
        logger.warn(`⚠️ No phone number for booking ${record.id}`);
        return;
      }


      // Форматируем номер телефона
      const formattedPhone = this.formatPhoneNumber(phone);

      // Отправляем уведомление и получаем текст сообщения
      const message = await this.sendBookingNotification(record, formattedPhone);

      // Сохраняем информацию об отправленном уведомлении
      const { error: insertError } = await supabase
        .from('booking_notifications')
        .insert({
          yclients_record_id: record.id.toString(), // Обязательно как строка
          phone: formattedPhone,
          notification_type: 'booking_confirmed',
          message: message, // Сохраняем отправленное сообщение
          sent_at: new Date().toISOString(),
          company_id: record.company_id || config.yclients.companyId
        });
      
      if (insertError) {
        logger.error('❌ Failed to save notification record:', insertError);
      }

      logger.info(`✅ Notification sent for booking ${record.id} to ${formattedPhone}`);

    } catch (error) {
      logger.error(`❌ Error processing booking ${record.id}:`, error);
    }
  }

  /**
   * Отправить уведомление о записи
   */
  async sendBookingNotification(record, phone) {
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    
    // Получаем информацию об услугах
    const services = record.services?.map(s => s.title).join(', ') || 'Услуга';
    const staff = record.staff?.name || 'Мастер';
    const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

    // Получаем информацию о компании
    const { data: company } = await supabase
      .from('companies')
      .select('name, address')
      .eq('id', record.company_id)
      .single();

    const companyName = company?.name || 'Салон';
    const address = company?.address || '';

    // Формируем сообщение
    const message = `✅ *Ваша запись подтверждена!*

📋 *Детали записи:*
🏢 ${companyName}
📅 ${date}
🕐 ${time}
💇 ${services}
👤 ${staff}
${price > 0 ? `💰 Стоимость: ${price} руб.\n` : ''}${address ? `📍 ${address}\n` : ''}
💬 _Ждём вас! Если планы изменятся, пожалуйста, предупредите заранее._

🤖 _Это автоматическое уведомление от AI Ассистента_`;

    // Отправляем сообщение через WhatsApp
    await this.whatsappClient.sendMessage(phone, message);
    return message; // Возвращаем сообщение для сохранения в БД
  }

  /**
   * Форматировать номер телефона
   */
  formatPhoneNumber(phone) {
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

}

// Создаем singleton экземпляр
const bookingMonitor = new BookingMonitorService();

module.exports = bookingMonitor;