// src/services/reminder/index.js
const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const messageQueue = require('../../queue/message-queue');
const config = require('../../config');

class ReminderService {
  /**
   * Загрузить все активные записи и запланировать напоминания
   */
  async scheduleRemindersForExistingBookings() {
    try {
      logger.info('📅 Loading existing bookings for reminders...');
      
      // Получаем записи из базы данных на следующие 7 дней
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const weekLater = new Date();
      weekLater.setDate(weekLater.getDate() + 7);
      weekLater.setHours(23, 59, 59, 999);
      
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .gte('datetime', tomorrow.toISOString())
        .lte('datetime', weekLater.toISOString())
        .eq('status', 'active');
        
      if (error) {
        logger.error('Failed to load bookings:', error);
        return;
      }
      
      if (!bookings || bookings.length === 0) {
        logger.info('No upcoming bookings found');
        return;
      }
      
      logger.info(`Found ${bookings.length} upcoming bookings`);
      
      // Планируем напоминания для каждой записи
      for (const booking of bookings) {
        await this.scheduleRemindersForBooking(booking);
      }
      
      logger.info(`✅ Scheduled reminders for ${bookings.length} bookings`);
      
    } catch (error) {
      logger.error('Failed to schedule reminders for existing bookings:', error);
    }
  }
  
  /**
   * Запланировать напоминания для одной записи
   */
  async scheduleRemindersForBooking(booking) {
    try {
      const bookingTime = new Date(booking.datetime);
      const now = new Date();
      
      // Извлекаем данные из booking
      const bookingData = {
        datetime: booking.datetime,
        service_name: booking.services?.join(', ') || 'услуга',
        staff_name: booking.staff_name || 'мастер',
        record_id: booking.yclients_record_id
      };
      
      // Напоминание за день в случайное время между 19:00 и 21:00
      const dayBefore = new Date(bookingTime);
      dayBefore.setDate(dayBefore.getDate() - 1);
      
      // Выбираем случайное время между 19:00 и 21:00
      const randomHour = 19 + Math.floor(Math.random() * 2); // 19 или 20
      const randomMinute = Math.floor(Math.random() * 60); // 0-59
      dayBefore.setHours(randomHour, randomMinute, 0, 0);
      
      // Проверяем, не отправлено ли уже напоминание
      if (dayBefore > now && !booking.day_before_sent) {
        await messageQueue.addReminder({
          type: 'day_before',
          booking: bookingData,
          phone: booking.client_phone,
          bookingId: booking.id
        }, dayBefore);
        logger.info(`📅 Scheduled day-before reminder for booking ${booking.yclients_record_id}`);
      }
      
      // Напоминание за 2 часа
      const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
      
      if (twoHoursBefore > now && !booking.hour_before_sent) {
        await messageQueue.addReminder({
          type: 'hours_before',
          booking: bookingData,
          phone: booking.client_phone,
          hours: 2,
          bookingId: booking.id
        }, twoHoursBefore);
        logger.info(`⏰ Scheduled 2-hour reminder for booking ${booking.yclients_record_id}`);
      }
      
    } catch (error) {
      logger.error(`Failed to schedule reminders for booking ${booking.yclients_record_id}:`, error);
    }
  }
  
  /**
   * Отправить напоминание клиенту
   */
  async sendReminder(phone, booking, message) {
    try {
      const whatsappClient = require('../../integrations/whatsapp/client');
      
      // Формируем сообщение напоминания
      let reminderText = message || this.formatReminderMessage(booking);
      
      // Отправляем через WhatsApp
      await whatsappClient.sendMessage(phone, reminderText);
      
      logger.info(`✅ Reminder sent to ${phone}`);
      
      // Отмечаем напоминание как отправленное
      if (booking.id) {
        const reminderType = message?.includes('завтра') ? 'day_before' : 'hours_before';
        await this.markReminderSent(booking.id, reminderType);
      }
      
    } catch (error) {
      logger.error(`Failed to send reminder to ${phone}:`, error);
      throw error;
    }
  }
  
  /**
   * Форматировать сообщение напоминания
   */
  formatReminderMessage(booking) {
    const date = new Date(booking.datetime);
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    
    return `🔔 Напоминание о записи!\n\n` +
           `📅 ${dateStr} в ${timeStr}\n` +
           `💈 Услуга: ${booking.service_name}\n` +
           `👤 Мастер: ${booking.staff_name}\n\n` +
           `Ждем вас! Если планы изменились, пожалуйста, сообщите нам.`;
  }
  
  /**
   * Отметить, что напоминание отправлено
   */
  async markReminderSent(bookingId, reminderType) {
    try {
      const updateData = {};
      
      if (reminderType === 'day_before') {
        updateData.day_before_sent = true;
        updateData.day_before_sent_at = new Date().toISOString();
      } else if (reminderType === 'hours_before') {
        updateData.hour_before_sent = true;
        updateData.hour_before_sent_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);
        
      if (error) {
        logger.error(`Failed to mark reminder as sent:`, error);
      }
      
    } catch (error) {
      logger.error('Error marking reminder as sent:', error);
    }
  }
}

module.exports = new ReminderService();