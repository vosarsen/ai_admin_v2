// src/services/booking/index.js
const { SupabaseDataLayer } = require('../../integrations/yclients/data/supabase-data-layer');
const { YclientsClient } = require('../../integrations/yclients/client');
const config = require('../../config');
const logger = require('../../utils/logger');
const DataTransformers = require('../../utils/data-transformers');
const { format, addDays, parse, isAfter, isBefore } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

class BookingService {
  constructor() {
    this.timezone = config.business.timezone;
    this.maxDaysAhead = config.business.maxBookingDaysAhead;
    this.minMinutesAhead = config.business.minBookingMinutesAhead;
    this.dataLayer = new SupabaseDataLayer();
    this.yclientsClient = null;
  }

  getYclientsClient() {
    if (!this.yclientsClient) {
      this.yclientsClient = new YclientsClient();
    }
    return this.yclientsClient;
  }

  async getServices(filters = {}, companyId = config.yclients.companyId) {
    try {
      // Сначала пробуем получить из Supabase
      const result = await this.dataLayer.getServices(filters, companyId);
      if (result.success && result.data && result.data.length > 0) {
        logger.info(`✅ Services loaded from Supabase: ${result.data.length}`);
        return result;
      }
      
      // Если в Supabase пусто, получаем из YClients
      logger.info('📱 Services not found in Supabase, fetching from YClients...');
      return await this.getYclientsClient().getServices(filters, companyId);
    } catch (error) {
      logger.error('Error getting services:', error);
      return { success: false, error: error.message };
    }
  }

  async getAvailableSlots(staffId, date, serviceId, companyId = config.yclients.companyId) {
    try {
      // Слоты всегда получаем из YClients (они динамические)
      return await this.getYclientsClient().getAvailableSlots(staffId, date, serviceId, companyId);
    } catch (error) {
      logger.error('Error getting available slots:', error);
      return { success: false, error: error.message };
    }
  }

  async findSuitableSlot(options = {}) {
    const {
      serviceId,
      staffId,
      preferredDate,
      preferredTime,
      companyId = config.yclients.companyId
    } = options;

    logger.info(`🔍 findSuitableSlot called with:`, {
      serviceId,
      staffId,
      preferredDate,
      preferredTime,
      companyId
    });

    try {
      // Если не указан serviceId, используем default для стрижки
      const actualServiceId = serviceId || 18356041; // СТРИЖКА МАШИНКОЙ
      
      const targetDate = preferredDate || format(new Date(), 'yyyy-MM-dd');
      
      logger.info(`🎯 Searching slots for service ${actualServiceId} on ${targetDate}`);
      
      // Если нет staffId, ищем слоты у всех мастеров
      if (!staffId) {
        logger.info(`👥 No specific staff requested, searching all available staff`);
        // TODO: Получить список всех мастеров и найти у кого есть слоты
        return { 
          success: true, 
          data: [{
            time: "10:00",
            datetime: `${targetDate} 10:00:00`,
            staff_name: "Любой мастер",
            available: true
          }, {
            time: "14:00", 
            datetime: `${targetDate} 14:00:00`,
            staff_name: "Любой мастер",
            available: true
          }]
        };
      }
      
      const slotsResult = await this.getAvailableSlots(
        staffId,
        targetDate,
        actualServiceId,
        companyId
      );

      if (!slotsResult.success || !slotsResult.data) {
        logger.warn(`❌ No slots found for staff ${staffId}`);
        return { 
          success: false, 
          error: 'No available slots found',
          reason: 'no_slots',
          data: []
        };
      }

      // Проверяем, есть ли свободные слоты
      const availableSlots = slotsResult.data.filter(slot => slot.available !== false);
      
      if (availableSlots.length === 0) {
        logger.warn(`❌ All slots are booked for staff ${staffId}`);
        return {
          success: false,
          error: 'All slots are booked',
          reason: 'fully_booked',
          data: [],
          alternativeSlots: slotsResult.data // Возвращаем все слоты как альтернативы
        };
      }

      logger.info(`✅ Found ${availableSlots.length} available slots`);
      return { 
        success: true, 
        data: availableSlots,
        reason: null 
      };
    } catch (error) {
      logger.error('Error finding suitable slot:', error);
      return { success: false, error: error.message };
    }
  }

  async createBooking(bookingData, companyId = config.yclients.companyId) {
    try {
      // Бронирование всегда создаем через YClients
      return await this.getYclientsClient().createBooking(bookingData, companyId);
    } catch (error) {
      logger.error('Error creating booking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search available slots based on criteria
   */
  async searchSlots({ companyId, service, staff, date, time }) {
    try {
      const result = await this.findSuitableSlot({
        serviceId: service?.id,
        staffId: staff?.id,
        preferredDate: date,
        preferredTime: time,
        companyId
      });

      return result;
    } catch (error) {
      logger.error('Error searching slots:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BookingService();
