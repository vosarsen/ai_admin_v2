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
        
        // Получаем список всех мастеров
        const staffResult = await this.dataLayer.getStaff(companyId, false);
        
        if (!staffResult.success || !staffResult.data || staffResult.data.length === 0) {
          logger.warn(`❌ No staff available for company ${companyId}`);
          return { 
            success: false, 
            error: 'No staff available',
            reason: 'no_staff',
            data: []
          };
        }
        
        logger.info(`🔍 Found ${staffResult.data.length} staff members, checking availability...`);
        
        // Проверяем слоты у каждого мастера
        const allSlots = [];
        const staffWithSlots = [];
        
        for (const staffMember of staffResult.data) {
          try {
            const staffSlots = await this.getAvailableSlots(
              staffMember.yclients_id,
              targetDate,
              actualServiceId,
              companyId
            );
            
            if (staffSlots.success && staffSlots.data) {
              const slotsData = staffSlots.data?.data || staffSlots.data;
              if (Array.isArray(slotsData) && slotsData.length > 0) {
                logger.info(`✅ Staff ${staffMember.name} has ${slotsData.length} available slots`);
                
                // Добавляем информацию о мастере к каждому слоту
                const slotsWithStaff = slotsData.map(slot => ({
                  ...slot,
                  staff_id: staffMember.yclients_id,
                  staff_name: staffMember.name,
                  staff_rating: staffMember.rating
                }));
                
                allSlots.push(...slotsWithStaff);
                staffWithSlots.push(staffMember);
              } else {
                logger.debug(`Staff ${staffMember.name} has no available slots`);
              }
            }
          } catch (error) {
            logger.warn(`Failed to get slots for staff ${staffMember.name}:`, error.message);
          }
        }
        
        if (allSlots.length === 0) {
          logger.warn(`❌ No available slots found for any staff`);
          return {
            success: false,
            error: 'No available slots found',
            reason: 'fully_booked',
            data: [],
            checkedStaffCount: staffResult.data.length
          };
        }
        
        // Сортируем слоты по времени
        allSlots.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        
        logger.info(`✅ Found ${allSlots.length} total slots from ${staffWithSlots.length} staff members`);
        
        return { 
          success: true, 
          data: allSlots,
          reason: null,
          staffWithSlots: staffWithSlots.length,
          totalStaffChecked: staffResult.data.length
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

      // Получаем массив слотов из ответа API
      // Yclients API возвращает данные в формате { data: { data: [...], meta: [] } }
      const slotsData = slotsResult.data?.data || slotsResult.data;
      const availableSlots = Array.isArray(slotsData) ? slotsData : [];
      
      if (availableSlots.length === 0) {
        logger.warn(`❌ All slots are booked for staff ${staffId}`);
        return {
          success: false,
          error: 'All slots are booked',
          reason: 'fully_booked',
          data: [],
          alternativeSlots: slotsData // Возвращаем все слоты как альтернативы
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
