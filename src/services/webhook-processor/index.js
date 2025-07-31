const logger = require('../../utils/logger');
const { supabase } = require('../../database/supabase');
const whatsappClient = require('../../integrations/whatsapp/client');
const { YclientsClient } = require('../../integrations/yclients/client');
const config = require('../../config');

class YClientsWebhookProcessor {
  constructor() {
    this.whatsappClient = whatsappClient;
    this.yclientsClient = new YclientsClient();
    this.companyId = config.yclients?.companyId || 962302;
  }

  /**
   * Обрабатывает входящее webhook событие
   */
  async processEvent(event) {
    const { id: eventId, type, companyId, data, timestamp } = event;
    
    logger.info('🔄 Processing webhook event', {
      eventId,
      type,
      companyId,
      recordId: data?.id
    });

    try {
      // Маркируем событие как обработанное
      await this.markEventProcessed(eventId);

      // Роутим событие по типу
      switch (type) {
        case 'record.created':
          await this.handleRecordCreated(data, companyId);
          break;
        
        case 'record.updated':
          await this.handleRecordUpdated(data, companyId);
          break;
        
        case 'record.deleted':
          await this.handleRecordDeleted(data, companyId);
          break;
        
        default:
          logger.warn('⚠️ Unknown event type', { type });
      }

      logger.info('✅ Event processed successfully', { eventId });
    } catch (error) {
      logger.error('❌ Error processing event', {
        eventId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Обработка создания новой записи
   */
  async handleRecordCreated(recordData, companyId) {
    logger.info('📝 Handling record.created event', {
      recordId: recordData.id,
      clientPhone: recordData.client?.phone
    });

    // Проверяем, создана ли запись через нашего бота
    const isOurBooking = await this.isBookingCreatedByBot(recordData);
    if (isOurBooking) {
      logger.info('✅ Booking created by our bot, skipping notification');
      return;
    }

    // Проверяем наличие телефона клиента
    const clientPhone = recordData.client?.phone;
    if (!clientPhone) {
      logger.warn('⚠️ No client phone in record data');
      return;
    }

    // Форматируем телефон для WhatsApp
    const formattedPhone = this.formatPhoneForWhatsApp(clientPhone);

    // Получаем дополнительную информацию о компании
    const companyInfo = await this.getCompanyInfo(companyId);

    // Формируем сообщение
    const message = this.formatNewBookingMessage(recordData, companyInfo);

    // Отправляем уведомление
    await this.sendWhatsAppNotification(formattedPhone, message, 'booking_created');

    // Сохраняем запись в нашу БД для синхронизации
    await this.saveBookingToCache(recordData, companyId);
  }

  /**
   * Обработка изменения записи
   */
  async handleRecordUpdated(recordData, companyId) {
    logger.info('✏️ Handling record.updated event', {
      recordId: recordData.id,
      clientPhone: recordData.client?.phone
    });

    const clientPhone = recordData.client?.phone;
    if (!clientPhone) {
      logger.warn('⚠️ No client phone in record data');
      return;
    }

    // Получаем предыдущую версию записи для сравнения
    const previousRecord = await this.getPreviousRecordData(recordData.id);
    
    // Определяем что именно изменилось
    const changes = this.detectChanges(previousRecord, recordData);
    
    // Если нет предыдущей записи в кеше, всё равно отправляем уведомление
    // так как запись была изменена (YClients отправил webhook)
    if (!previousRecord) {
      logger.info('📝 No previous record in cache, but sending update notification anyway');
    } else if (Object.keys(changes).length === 0) {
      logger.info('✅ No significant changes detected');
      return;
    }

    const formattedPhone = this.formatPhoneForWhatsApp(clientPhone);
    const companyInfo = await this.getCompanyInfo(companyId);

    // Формируем сообщение в зависимости от изменений
    const message = this.formatUpdateMessage(recordData, changes, companyInfo);

    // Отправляем уведомление
    await this.sendWhatsAppNotification(formattedPhone, message, 'booking_updated');

    // Обновляем запись в кеше
    await this.updateBookingInCache(recordData, companyId);
  }

  /**
   * Обработка удаления записи
   */
  async handleRecordDeleted(recordData, companyId) {
    logger.info('🗑️ Handling record.deleted event', {
      recordId: recordData.id,
      clientPhone: recordData.client?.phone
    });

    const clientPhone = recordData.client?.phone;
    if (!clientPhone) {
      // Пытаемся получить телефон из нашей БД
      const cachedRecord = await this.getCachedRecord(recordData.id);
      if (!cachedRecord?.client_phone) {
        logger.warn('⚠️ Cannot find client phone for deleted record');
        return;
      }
      clientPhone = cachedRecord.client_phone;
    }

    const formattedPhone = this.formatPhoneForWhatsApp(clientPhone);
    const companyInfo = await this.getCompanyInfo(companyId);

    // Формируем сообщение об отмене
    const message = this.formatCancellationMessage(recordData, companyInfo);

    // Отправляем уведомление
    await this.sendWhatsAppNotification(formattedPhone, message, 'booking_cancelled');

    // Помечаем запись как отмененную в кеше
    await this.markBookingAsCancelled(recordData.id);
  }

  /**
   * Форматирует сообщение о новой записи
   */
  formatNewBookingMessage(record, companyInfo) {
    const date = new Date(record.datetime);
    const dateStr = date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long' 
    });
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const services = record.services?.map(s => s.title).join(', ') || 'Услуга';
    const staffName = record.staff?.name || 'Мастер';
    
    // Рассчитываем общую стоимость и скидку
    const totalCost = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
    const totalFirstCost = record.services?.reduce((sum, s) => sum + (s.first_cost || s.cost || 0), 0) || 0;
    const totalDiscount = record.services?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;

    let message = `✅ *Вы записаны!*\n\n`;
    message += `📅 ${dateStr} в ${timeStr}\n`;
    message += `💇 ${services}\n`;
    message += `👤 Мастер: ${staffName}\n`;
    
    if (totalCost > 0) {
      if (totalDiscount > 0) {
        message += `💰 Стоимость: ~${totalFirstCost} руб~ ${totalCost} руб (скидка ${totalDiscount}%)\n`;
      } else {
        message += `💰 Стоимость: ${totalCost} руб\n`;
      }
    }
    
    if (companyInfo?.address) {
      message += `📍 ${companyInfo.address}\n`;
    }
    
    message += `\nДля отмены или переноса напишите мне здесь 👇`;
    
    return message;
  }

  /**
   * Форматирует сообщение об изменениях
   */
  formatUpdateMessage(record, changes, companyInfo) {
    const date = new Date(record.datetime);
    const dateStr = date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long' 
    });
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    let message = `📝 *Ваша запись изменена*\n\n`;

    // Показываем что изменилось
    if (changes && changes.datetime) {
      const oldDate = new Date(changes.datetime.old);
      const oldDateStr = oldDate.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long' 
      });
      const oldTimeStr = oldDate.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      message += `Было: ${oldDateStr} в ${oldTimeStr}\n`;
      message += `Стало: ${dateStr} в ${timeStr}\n\n`;
    } else {
      message += `📅 ${dateStr} в ${timeStr}\n`;
    }

    if (changes && changes.services) {
      message += `💇 Услуга изменена на: ${record.services?.map(s => s.title).join(', ')}\n`;
    } else {
      message += `💇 ${record.services?.map(s => s.title).join(', ')}\n`;
    }

    if (changes && changes.staff) {
      message += `👤 Новый мастер: ${record.staff?.name}\n`;
    } else {
      message += `👤 Мастер: ${record.staff?.name}\n`;
    }

    // Добавляем информацию о стоимости и скидке
    const totalCost = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
    const totalFirstCost = record.services?.reduce((sum, s) => sum + (s.first_cost || s.cost || 0), 0) || 0;
    const totalDiscount = record.services?.reduce((sum, s) => sum + (s.discount || 0), 0) || 0;

    if (totalCost > 0) {
      if (totalDiscount > 0) {
        message += `💰 Стоимость: ~${totalFirstCost} руб~ ${totalCost} руб (скидка ${totalDiscount}%)\n`;
      } else {
        message += `💰 Стоимость: ${totalCost} руб\n`;
      }
    }

    if (companyInfo?.address) {
      message += `📍 ${companyInfo.address}\n`;
    }

    message += `\nЕсли есть вопросы - пишите!`;
    
    return message;
  }

  /**
   * Форматирует сообщение об отмене
   */
  formatCancellationMessage(record, companyInfo) {
    const date = new Date(record.datetime);
    const dateStr = date.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long' 
    });
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    const services = record.services?.map(s => s.title).join(', ') || 'Услуга';

    let message = `❌ *Ваша запись отменена*\n\n`;
    message += `Была на: ${dateStr} в ${timeStr}\n`;
    message += `Услуга: ${services}\n\n`;
    message += `Хотите записаться на другое время? Напишите мне!`;
    
    return message;
  }

  /**
   * Вспомогательные методы
   */

  async isBookingCreatedByBot(recordData) {
    // Проверяем по нескольким критериям
    
    // 1. Проверяем комментарий записи
    if (recordData.comment && (
      recordData.comment.includes('AI администратор') ||
      recordData.comment.includes('WhatsApp') ||
      recordData.comment.includes('AI Admin')
    )) {
      return true;
    }
    
    // 2. Проверяем недавнюю активность клиента в боте
    const clientPhone = this.formatPhoneForWhatsApp(recordData.client?.phone);
    if (clientPhone) {
      // Получаем последнее сообщение от клиента
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('created_at')
        .eq('phone', clientPhone)
        .eq('direction', 'incoming')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (recentMessages && recentMessages.length > 0) {
        logger.info('📱 Client was recently active in bot, skipping notification');
        return true;
      }
    }
    
    return false;
  }

  formatPhoneForWhatsApp(phone) {
    // Убираем все не-цифры
    let cleaned = phone.replace(/\D/g, '');
    
    // Если начинается с 8, меняем на 7
    if (cleaned.startsWith('8') && cleaned.length === 11) {
      cleaned = '7' + cleaned.slice(1);
    }
    
    // Добавляем 7 если нет кода страны
    if (cleaned.length === 10) {
      cleaned = '7' + cleaned;
    }
    
    return cleaned;
  }

  async getCompanyInfo(companyId) {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('yclients_id', companyId)
      .single();
    
    return data;
  }

  async sendWhatsAppNotification(phone, message, notificationType) {
    try {
      logger.info('📤 Sending WhatsApp notification', {
        phone,
        type: notificationType,
        messageLength: message.length
      });

      const result = await this.whatsappClient.sendMessage(phone, message);
      
      if (result.success) {
        logger.info('✅ WhatsApp notification sent successfully');
        
        // Записываем в историю уведомлений
        await supabase
          .from('booking_notifications')
          .insert({
            phone,
            notification_type: notificationType,
            message,
            sent_at: new Date().toISOString()
          });
      } else {
        logger.error('❌ Failed to send WhatsApp notification', result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('❌ Error sending WhatsApp notification', error);
      throw error;
    }
  }

  async markEventProcessed(eventId) {
    await supabase
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', eventId);
  }

  async saveBookingToCache(recordData, companyId) {
    try {
      const { error } = await supabase
        .from('appointments_cache')
        .insert({
          yclients_record_id: recordData.id,
          company_id: companyId,
          client_id: recordData.client?.id,
          service_id: recordData.services?.[0]?.id,
          staff_id: recordData.staff?.id,
          appointment_datetime: recordData.datetime,
          cost: recordData.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0,
          status: 'confirmed',
          raw_data: recordData,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to save booking to cache', error);
      }
    } catch (error) {
      logger.error('Error saving booking to cache', error);
    }
  }

  async updateBookingInCache(recordData, companyId) {
    try {
      const { error } = await supabase
        .from('appointments_cache')
        .update({
          service_id: recordData.services?.[0]?.id,
          staff_id: recordData.staff?.id,
          appointment_datetime: recordData.datetime,
          cost: recordData.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0,
          raw_data: recordData,
          updated_at: new Date().toISOString()
        })
        .eq('yclients_record_id', recordData.id);

      if (error) {
        logger.error('Failed to update booking in cache', error);
      }
    } catch (error) {
      logger.error('Error updating booking in cache', error);
    }
  }

  async markBookingAsCancelled(recordId) {
    try {
      const { error } = await supabase
        .from('appointments_cache')
        .update({
          is_cancelled: true,
          status: 'cancelled',
          cancellation_reason: 'Deleted in YClients',
          updated_at: new Date().toISOString()
        })
        .eq('yclients_record_id', recordId);

      if (error) {
        logger.error('Failed to mark booking as cancelled', error);
      }
    } catch (error) {
      logger.error('Error marking booking as cancelled', error);
    }
  }

  async getPreviousRecordData(recordId) {
    const { data } = await supabase
      .from('appointments_cache')
      .select('raw_data')
      .eq('yclients_record_id', recordId)
      .single();
    
    return data?.raw_data;
  }

  async getCachedRecord(recordId) {
    const { data } = await supabase
      .from('appointments_cache')
      .select('*')
      .eq('yclients_record_id', recordId)
      .single();
    
    return data;
  }

  detectChanges(oldRecord, newRecord) {
    const changes = {};
    
    if (!oldRecord) return changes;
    
    // Проверяем изменение времени
    if (oldRecord.datetime !== newRecord.datetime) {
      changes.datetime = {
        old: oldRecord.datetime,
        new: newRecord.datetime
      };
    }
    
    // Проверяем изменение услуг
    const oldServices = JSON.stringify(oldRecord.services?.map(s => s.id).sort());
    const newServices = JSON.stringify(newRecord.services?.map(s => s.id).sort());
    if (oldServices !== newServices) {
      changes.services = {
        old: oldRecord.services,
        new: newRecord.services
      };
    }
    
    // Проверяем изменение мастера
    if (oldRecord.staff?.id !== newRecord.staff?.id) {
      changes.staff = {
        old: oldRecord.staff,
        new: newRecord.staff
      };
    }
    
    return changes;
  }
}

module.exports = YClientsWebhookProcessor;