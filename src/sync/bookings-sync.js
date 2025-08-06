const axios = require('axios');
const { supabase } = require('../database/supabase');
const logger = require('../utils/logger').child({ module: 'bookings-sync' });
const { format, addDays } = require('date-fns');
const { 
  normalizePhone, 
  YCLIENTS_CONFIG, 
  createYclientsHeaders,
  processBatch,
  BATCH_CONFIG
} = require('./sync-utils');

/**
 * Синхронизация активных записей (bookings) из YClients в Supabase
 * Синхронизирует только будущие записи для быстрого доступа AI Admin
 */
class BookingsSync {
  constructor(config) {
    this.config = {
      ...YCLIENTS_CONFIG,
      ...config
    };
    
    this.headers = createYclientsHeaders(true);
    this.stats = {
      created: 0,
      updated: 0,
      cancelled: 0,
      errors: 0
    };
  }

  /**
   * Основной метод синхронизации записей
   */
  async sync(options = {}) {
    const startTime = Date.now();
    this.stats = { created: 0, updated: 0, cancelled: 0, errors: 0 };
    
    try {
      logger.info('🎫 Starting bookings synchronization...');
      
      // Синхронизируем записи на N дней вперед (по умолчанию 60)
      const daysAhead = options.daysAhead || 60;
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');
      
      logger.info(`Syncing bookings from ${startDate} to ${endDate}`);
      
      // Получаем активные записи из YClients
      const bookings = await this.fetchActiveBookings(startDate, endDate);
      
      if (!bookings || bookings.length === 0) {
        logger.info('No active bookings found');
        return {
          duration: Math.round((Date.now() - startTime) / 1000),
          stats: this.stats
        };
      }
      
      logger.info(`Found ${bookings.length} active bookings`);
      
      // Синхронизируем записи пакетами
      await this.syncBookingsBatch(bookings);
      
      // Удаляем старые записи
      await this.cleanupOldBookings();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      logger.info(`✅ Bookings sync completed in ${duration} seconds`, {
        stats: this.stats
      });
      
      return {
        duration,
        stats: this.stats
      };
      
    } catch (error) {
      logger.error('Bookings sync failed:', error);
      throw error;
    }
  }

  /**
   * Получить активные записи из YClients
   */
  async fetchActiveBookings(startDate, endDate) {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        include_finance_transactions: 0
      });
      
      const url = `${this.config.BASE_URL}/records/${this.config.COMPANY_ID}?${params}`;
      
      const response = await axios.get(url, { headers: this.headers });
      
      if (response.data?.success === false) {
        throw new Error(response.data.message || 'Failed to fetch bookings');
      }
      
      const records = response.data?.data || [];
      
      // Фильтруем только активные записи (не удаленные и не прошедшие)
      const activeBookings = records.filter(record => {
        const recordDate = new Date(record.datetime);
        const now = new Date();
        return recordDate > now && !record.deleted;
      });
      
      return activeBookings;
      
    } catch (error) {
      logger.error('Error fetching bookings:', error.message);
      throw error;
    }
  }

  /**
   * Синхронизировать записи пакетами
   */
  async syncBookingsBatch(bookings) {
    // Преобразуем записи в формат для БД
    const transformedBookings = bookings.map(booking => this.transformBooking(booking));
    
    // Обрабатываем пакетами
    await processBatch(
      transformedBookings,
      async (batch) => {
        await this.upsertBookings(batch);
      },
      BATCH_CONFIG.BOOKINGS_BATCH_SIZE
    );
  }

  /**
   * Преобразовать запись из формата YClients в формат БД
   */
  transformBooking(ycBooking) {
    const services = ycBooking.services || [];
    const serviceNames = services.map(s => s.title).filter(Boolean);
    const totalCost = services.reduce((sum, s) => sum + (s.cost || 0), 0);
    
    return {
      yclients_record_id: ycBooking.id,
      company_id: this.config.COMPANY_ID,
      client_phone: normalizePhone(ycBooking.client?.phone || ''),
      client_name: ycBooking.client?.name || '',
      client_yclients_id: ycBooking.client?.id || null,
      staff_id: ycBooking.staff?.id || null,
      staff_name: ycBooking.staff?.name || '',
      services: serviceNames,
      service_ids: services.map(s => s.id).filter(Boolean),
      datetime: ycBooking.datetime,
      date: ycBooking.date,
      duration: services.reduce((sum, s) => sum + (s.seance_length || 0), 0),
      cost: totalCost,
      prepaid: ycBooking.prepaid || 0,
      status: this.mapStatus(ycBooking),
      comment: ycBooking.comment || '',
      visit_attendance: ycBooking.visit_attendance || 0,
      online: ycBooking.online || false,
      record_hash: ycBooking.record_hash || null,
      synced_at: new Date().toISOString()
    };
  }

  /**
   * Маппинг статуса записи
   */
  mapStatus(booking) {
    if (booking.deleted) return 'cancelled';
    if (booking.visit_attendance === 1) return 'completed';
    if (booking.visit_attendance === -1) return 'no_show';
    if (booking.visit_attendance === 2) return 'confirmed';
    
    const now = new Date();
    const bookingDate = new Date(booking.datetime);
    
    if (bookingDate < now) return 'past';
    return 'active';
  }

  /**
   * Сохранить или обновить записи в БД
   */
  async upsertBookings(bookings) {
    try {
      // Получаем существующие записи
      const recordIds = bookings.map(b => b.yclients_record_id);
      
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('id, yclients_record_id, status')
        .in('yclients_record_id', recordIds);
      
      const existingMap = new Map(
        (existingBookings || []).map(b => [b.yclients_record_id, b])
      );
      
      // Разделяем на новые и обновляемые
      const toInsert = [];
      const toUpdate = [];
      
      for (const booking of bookings) {
        const existing = existingMap.get(booking.yclients_record_id);
        
        if (existing) {
          // Обновляем только если изменился статус или другие важные поля
          if (existing.status !== booking.status) {
            toUpdate.push({
              ...booking,
              id: existing.id,
              updated_at: new Date().toISOString()
            });
          }
        } else {
          toInsert.push({
            ...booking,
            created_at: new Date().toISOString()
          });
        }
      }
      
      // Вставляем новые записи
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('bookings')
          .insert(toInsert);
        
        if (insertError) {
          logger.error('Error inserting bookings:', insertError);
          this.stats.errors += toInsert.length;
        } else {
          this.stats.created += toInsert.length;
        }
      }
      
      // Обновляем существующие записи
      if (toUpdate.length > 0) {
        // Обновляем по одной записи из-за ограничений Supabase
        for (const booking of toUpdate) {
          const { error: updateError } = await supabase
            .from('bookings')
            .update(booking)
            .eq('id', booking.id);
          
          if (updateError) {
            logger.error('Error updating booking:', updateError);
            this.stats.errors++;
          } else {
            this.stats.updated++;
            if (booking.status === 'cancelled') {
              this.stats.cancelled++;
            }
          }
        }
      }
      
    } catch (error) {
      logger.error('Error upserting bookings:', error);
      this.stats.errors += bookings.length;
    }
  }

  /**
   * Удалить старые записи (прошедшие более 7 дней назад)
   */
  async cleanupOldBookings() {
    try {
      const cutoffDate = format(addDays(new Date(), -7), 'yyyy-MM-dd');
      
      const { data: oldBookings, error: selectError } = await supabase
        .from('bookings')
        .select('id')
        .lt('date', cutoffDate);
      
      if (selectError) {
        logger.error('Error selecting old bookings:', selectError);
        return;
      }
      
      if (oldBookings && oldBookings.length > 0) {
        const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .lt('date', cutoffDate);
        
        if (deleteError) {
          logger.error('Error deleting old bookings:', deleteError);
        } else {
          logger.info(`Cleaned up ${oldBookings.length} old bookings`);
        }
      }
      
    } catch (error) {
      logger.error('Error cleaning up old bookings:', error);
    }
  }

  /**
   * Синхронизировать записи конкретного клиента
   */
  async syncClientBookings(phone) {
    try {
      const normalizedPhone = normalizePhone(phone);
      logger.info(`Syncing bookings for client: ${normalizedPhone}`);
      
      // Получаем все активные записи
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');
      
      const allBookings = await this.fetchActiveBookings(startDate, endDate);
      
      // Фильтруем записи клиента
      const clientBookings = allBookings.filter(booking => {
        const bookingPhone = normalizePhone(booking.client?.phone || '');
        return bookingPhone === normalizedPhone;
      });
      
      if (clientBookings.length === 0) {
        logger.info('No active bookings found for client');
        return { success: true, count: 0 };
      }
      
      // Синхронизируем только записи этого клиента
      await this.syncBookingsBatch(clientBookings);
      
      logger.info(`Synced ${clientBookings.length} bookings for client`);
      
      return { 
        success: true, 
        count: clientBookings.length,
        bookings: clientBookings
      };
      
    } catch (error) {
      logger.error('Error syncing client bookings:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = { BookingsSync };