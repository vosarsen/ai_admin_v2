/**
 * Синхронизация активных записей (bookings) из YClients в PostgreSQL
 * Migration: Supabase → PostgreSQL Repository Pattern (2025-11-26)
 * Синхронизирует только будущие записи для быстрого доступа AI Admin
 */

const axios = require('axios');
const postgres = require('../database/postgres');
const Sentry = require('@sentry/node');
const BookingRepository = require('../repositories/BookingRepository');
const logger = require('../utils/logger').child({ module: 'bookings-sync' });
const { format, addDays } = require('date-fns');
const {
  normalizePhone,
  YCLIENTS_CONFIG,
  createYclientsHeaders
} = require('./sync-utils');

class BookingsSync {
  constructor(config) {
    this.config = {
      ...YCLIENTS_CONFIG,
      ...config
    };

    this.headers = createYclientsHeaders(true);
    this.bookingRepo = new BookingRepository(postgres.pool);
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
      Sentry.captureException(error, {
        tags: {
          component: 'sync',
          sync_type: 'bookings'
        }
      });
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
   * Синхронизировать записи пакетами (через Repository)
   */
  async syncBookingsBatch(bookings) {
    // Преобразуем записи в формат для БД
    const transformedBookings = bookings.map(booking => this.transformBooking(booking));

    try {
      // Используем батчевый upsert через репозиторий
      const result = await this.bookingRepo.syncBulkUpsert(transformedBookings);
      this.stats.created = result.count;

      logger.info(`✅ Batch upsert completed: ${result.count} bookings in ${result.duration}ms`);
    } catch (error) {
      logger.error('❌ Batch upsert failed', { error: error.message });
      this.stats.errors += transformedBookings.length;
    }
  }

  /**
   * Преобразовать запись из формата YClients в формат БД
   */
  transformBooking(ycBooking) {
    const services = ycBooking.services || [];

    // Обрабатываем amount: если amount > 1, дублируем услугу
    const serviceNames = [];
    const serviceIds = [];

    services.forEach(service => {
      const amount = service.amount || 1;
      const title = service.title;
      const id = service.id;

      if (amount > 1) {
        // Если amount > 1, добавляем услугу amount раз
        for (let i = 0; i < amount; i++) {
          if (title) serviceNames.push(title);
          if (id) serviceIds.push(id);
        }
      } else {
        // Если amount = 1 или не указан, добавляем один раз
        if (title) serviceNames.push(title);
        if (id) serviceIds.push(id);
      }
    });

    const totalCost = services.reduce((sum, s) => {
      const amount = s.amount || 1;
      return sum + ((s.cost || 0) * amount);
    }, 0);

    return {
      yclients_record_id: ycBooking.id,
      company_id: this.config.COMPANY_ID,
      client_phone: normalizePhone(ycBooking.client?.phone || ''),
      client_name: ycBooking.client?.name || '',
      client_yclients_id: ycBooking.client?.id || null,
      staff_id: ycBooking.staff?.id || null,
      staff_name: ycBooking.staff?.name || '',
      services: serviceNames,
      service_ids: serviceIds,
      datetime: ycBooking.datetime,
      date: ycBooking.date,
      duration: services.reduce((sum, s) => {
        const amount = s.amount || 1;
        return sum + ((s.seance_length || 0) * amount);
      }, 0),
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
   * Удалить старые записи (прошедшие более 7 дней назад)
   */
  async cleanupOldBookings() {
    try {
      const cutoffDate = format(addDays(new Date(), -7), 'yyyy-MM-dd');

      // Use repository pattern for booking cleanup
      const deletedCount = await this.bookingRepo.deleteOlderThan(cutoffDate);

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old bookings`);
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