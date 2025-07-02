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

    try {
      const targetDate = preferredDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      const slotsResult = await this.getAvailableSlots(
        staffId,
        targetDate,
        serviceId,
        companyId
      );

      if (!slotsResult.success || !slotsResult.data) {
        return { success: false, error: 'No available slots found' };
      }

      return { success: true, data: slotsResult.data };
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
