/**
 * Сервис управления владением записями
 * Решает проблему некорректных ответов YClients API
 * Хранит связь телефон → записи в Redis для быстрого доступа
 */

const logger = require('../../utils/logger').child({ module: 'booking-ownership' });
const { getRedisClient } = require('../../config/redis-factory');
const config = require('../../config');

class BookingOwnershipService {
  constructor() {
    this.redis = null;
    this.initialized = false;
    this.ACTIVE_BOOKINGS_PREFIX = 'bookings:active:';
    this.BOOKING_OWNER_PREFIX = 'booking:owner:';
    this.DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 дней
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.redis = await getRedisClient();
      this.initialized = true;
      logger.info('✅ BookingOwnershipService initialized');
    } catch (error) {
      logger.error('Failed to initialize BookingOwnershipService:', error);
      throw error;
    }
  }

  /**
   * Нормализация телефона для консистентного хранения
   */
  normalizePhone(phone) {
    if (!phone) return null;
    // Убираем все лишнее и приводим к формату 79XXXXXXXXX
    return phone.replace(/[\s\-\(\)\+]/g, '')
                .replace(/^8/, '7')
                .replace(/^([^7])/, '7$1');
  }

  /**
   * Сохранить связь запись → клиент
   */
  async saveBookingOwnership(recordId, phone, bookingData = {}) {
    await this.initialize();
    
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone || !recordId) {
      logger.warn('Invalid data for saving booking ownership', { recordId, phone });
      return false;
    }

    try {
      // 1. Добавляем ID записи в список записей клиента
      const clientKey = `${this.ACTIVE_BOOKINGS_PREFIX}${normalizedPhone}`;
      await this.redis.sadd(clientKey, recordId.toString());
      
      // 2. Сохраняем детали записи для быстрого доступа
      const ownerKey = `${this.BOOKING_OWNER_PREFIX}${recordId}`;
      const ownerData = {
        phone: normalizedPhone,
        client_id: bookingData.client_id || null,
        client_name: bookingData.client_name || null,
        created_at: new Date().toISOString(),
        datetime: bookingData.datetime || null,
        service: bookingData.service || null,
        staff: bookingData.staff || null,
        company_id: bookingData.company_id || config.yclients.companyId
      };
      
      await this.redis.set(ownerKey, JSON.stringify(ownerData));
      
      // 3. Устанавливаем TTL на основе даты записи
      if (bookingData.datetime) {
        const bookingDate = new Date(bookingData.datetime);
        const ttl = Math.max(
          this.DEFAULT_TTL,
          Math.floor((bookingDate.getTime() - Date.now()) / 1000) + 86400 // +1 день после записи
        );
        await this.redis.expire(clientKey, ttl);
        await this.redis.expire(ownerKey, ttl);
      } else {
        await this.redis.expire(clientKey, this.DEFAULT_TTL);
        await this.redis.expire(ownerKey, this.DEFAULT_TTL);
      }

      logger.info(`✅ Saved booking ownership: ${recordId} → ${normalizedPhone}`, {
        recordId,
        phone: normalizedPhone,
        service: bookingData.service,
        datetime: bookingData.datetime
      });

      return true;
    } catch (error) {
      logger.error('Failed to save booking ownership:', error);
      return false;
    }
  }

  /**
   * Получить все активные записи клиента
   */
  async getClientBookings(phone) {
    await this.initialize();
    
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) return [];

    try {
      const clientKey = `${this.ACTIVE_BOOKINGS_PREFIX}${normalizedPhone}`;
      const recordIds = await this.redis.smembers(clientKey);
      
      // Получаем детали каждой записи
      const bookings = [];
      for (const recordId of recordIds) {
        const ownerData = await this.getBookingOwner(recordId);
        if (ownerData) {
          bookings.push({
            id: recordId,
            ...ownerData
          });
        }
      }

      logger.info(`Found ${bookings.length} active bookings for ${normalizedPhone}`);
      return bookings;
    } catch (error) {
      logger.error('Failed to get client bookings:', error);
      return [];
    }
  }

  /**
   * Проверить владельца записи
   */
  async getBookingOwner(recordId) {
    await this.initialize();
    
    if (!recordId) return null;

    try {
      const ownerKey = `${this.BOOKING_OWNER_PREFIX}${recordId}`;
      const ownerData = await this.redis.get(ownerKey);
      
      if (!ownerData) {
        logger.debug(`No owner data found for booking ${recordId}`);
        return null;
      }

      return JSON.parse(ownerData);
    } catch (error) {
      logger.error('Failed to get booking owner:', error);
      return null;
    }
  }

  /**
   * Проверить, принадлежит ли запись клиенту
   */
  async isBookingOwnedBy(recordId, phone) {
    const normalizedPhone = this.normalizePhone(phone);
    const owner = await this.getBookingOwner(recordId);
    
    if (!owner) {
      logger.warn(`No owner found for booking ${recordId}`);
      return false;
    }

    const isOwned = owner.phone === normalizedPhone;
    
    if (!isOwned) {
      logger.warn(`Booking ${recordId} is not owned by ${normalizedPhone}`, {
        actualOwner: owner.phone,
        requestedBy: normalizedPhone
      });
    }

    return isOwned;
  }

  /**
   * Удалить запись (при отмене или завершении)
   */
  async removeBooking(recordId, phone = null) {
    await this.initialize();
    
    try {
      // Если телефон не указан, получаем из данных владельца
      let normalizedPhone = phone ? this.normalizePhone(phone) : null;
      
      if (!normalizedPhone) {
        const owner = await this.getBookingOwner(recordId);
        if (owner) {
          normalizedPhone = owner.phone;
        }
      }

      if (normalizedPhone) {
        // Удаляем из списка записей клиента
        const clientKey = `${this.ACTIVE_BOOKINGS_PREFIX}${normalizedPhone}`;
        await this.redis.srem(clientKey, recordId.toString());
      }

      // Удаляем данные владельца
      const ownerKey = `${this.BOOKING_OWNER_PREFIX}${recordId}`;
      await this.redis.del(ownerKey);

      logger.info(`✅ Removed booking ${recordId} from ownership tracking`);
      return true;
    } catch (error) {
      logger.error('Failed to remove booking:', error);
      return false;
    }
  }

  /**
   * Обновить данные записи
   */
  async updateBooking(recordId, updates = {}) {
    const owner = await this.getBookingOwner(recordId);
    if (!owner) {
      logger.warn(`Cannot update non-existent booking ${recordId}`);
      return false;
    }

    const updatedData = { ...owner, ...updates };
    
    try {
      const ownerKey = `${this.BOOKING_OWNER_PREFIX}${recordId}`;
      await this.redis.set(ownerKey, JSON.stringify(updatedData));
      
      logger.info(`✅ Updated booking ${recordId}`);
      return true;
    } catch (error) {
      logger.error('Failed to update booking:', error);
      return false;
    }
  }

  /**
   * Синхронизация с базой данных (для восстановления после сбоев)
   */
  async syncFromDatabase(supabase) {
    try {
      logger.info('Starting sync from database...');
      
      // Получаем все активные записи из БД
      const { data: activeBookings, error } = await supabase
        .from('appointments_cache')
        .select('*')
        .gte('datetime', new Date().toISOString())
        .eq('deleted', false);

      if (error) {
        logger.error('Failed to fetch bookings from database:', error);
        return false;
      }

      let synced = 0;
      for (const booking of activeBookings) {
        if (booking.client_phone && booking.yclients_id) {
          await this.saveBookingOwnership(
            booking.yclients_id,
            booking.client_phone,
            {
              client_id: booking.client_id,
              client_name: booking.client_name,
              datetime: booking.datetime,
              service: booking.service_name,
              staff: booking.staff_name,
              company_id: booking.company_id
            }
          );
          synced++;
        }
      }

      logger.info(`✅ Synced ${synced} bookings from database`);
      return true;
    } catch (error) {
      logger.error('Failed to sync from database:', error);
      return false;
    }
  }

  /**
   * Очистка устаревших записей
   */
  async cleanupExpiredBookings() {
    await this.initialize();
    
    try {
      const pattern = `${this.BOOKING_OWNER_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      let cleaned = 0;
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const booking = JSON.parse(data);
          if (booking.datetime && new Date(booking.datetime) < new Date()) {
            const recordId = key.replace(this.BOOKING_OWNER_PREFIX, '');
            await this.removeBooking(recordId, booking.phone);
            cleaned++;
          }
        }
      }

      logger.info(`✅ Cleaned up ${cleaned} expired bookings`);
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup expired bookings:', error);
      return 0;
    }
  }
}

module.exports = new BookingOwnershipService();