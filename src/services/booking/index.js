// src/services/booking/index.js
const { SupabaseDataLayer } = require('../../integrations/yclients/data/supabase-data-layer');
const { YclientsClient } = require('../../integrations/yclients/client');
const config = require('../../config');
const logger = require('../../utils/logger');
const DataTransformers = require('../../utils/data-transformers');
const { format, addDays, subDays, parse, isAfter, isBefore } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');
const { RetryHandler } = require('../../utils/retry-handler');
const criticalErrorLogger = require('../../utils/critical-error-logger');
const bookingOwnership = require('./booking-ownership');
const slotValidator = require('./slot-validator');

class BookingService {
  constructor() {
    this.timezone = config.business.timezone;
    this.maxDaysAhead = config.business.maxBookingDaysAhead;
    this.minMinutesAhead = config.business.minBookingMinutesAhead;
    this.dataLayer = new SupabaseDataLayer();
    this.yclientsClient = null;
    
    // Временные периоды для фильтрации
    this.timePeriods = {
      morning: { start: 6, end: 12 },      // 6:00-12:00
      afternoon: { start: 12, end: 18 },    // 12:00-18:00
      evening: { start: 18, end: 23 }       // 18:00-23:00
    };
    
    // Retry handler для критичных операций
    this.retryHandler = new RetryHandler({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'],
      retryableStatusCodes: [408, 429, 500, 502, 503, 504]
    });
  }

  getYclientsClient() {
    if (!this.yclientsClient) {
      this.yclientsClient = new YclientsClient();
    }
    return this.yclientsClient;
  }

  /**
   * Фильтрует слоты по временным предпочтениям
   */
  filterSlotsByTimePreference(slots, timePreference) {
    if (!timePreference || !slots || slots.length === 0) {
      return slots;
    }
    
    logger.info(`⏰ Filtering ${slots.length} slots by time preference: ${timePreference}`);
    
    // Определяем временной период
    const preference = timePreference.toLowerCase();
    let period = null;
    
    // Проверяем стандартные периоды
    if (preference.includes('утр') || preference === 'morning') {
      period = this.timePeriods.morning;
    } else if (preference.includes('день') || preference.includes('обед') || preference === 'afternoon') {
      period = this.timePeriods.afternoon;
    } else if (preference.includes('вечер') || preference === 'evening') {
      period = this.timePeriods.evening;
    }
    
    // Проверяем конкретное время (например, "после 18:00")
    const afterMatch = preference.match(/после\s*(\d{1,2})/);
    if (afterMatch) {
      const hour = parseInt(afterMatch[1]);
      period = { start: hour, end: 23 };
    }
    
    const beforeMatch = preference.match(/до\s*(\d{1,2})/);
    if (beforeMatch) {
      const hour = parseInt(beforeMatch[1]);
      period = { start: 6, end: hour };
    }
    
    if (!period) {
      logger.warn(`Could not parse time preference: ${timePreference}`);
      return slots;
    }
    
    // Фильтруем слоты
    const filtered = slots.filter(slot => {
      const time = slot.time || slot.datetime;
      const hour = parseInt(time.split(':')[0]);
      return hour >= period.start && hour < period.end;
    });
    
    logger.info(`✅ Filtered to ${filtered.length} slots (${period.start}:00-${period.end}:00)`);
    
    return filtered;
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

  async getAvailableSlots(staffId, date, serviceId, companyId = config.yclients.companyId, validateSlots = false) {
    try {
      // Слоты всегда получаем из YClients (они динамические)
      const result = await this.getYclientsClient().getAvailableSlots(staffId, date, { service_id: serviceId }, companyId);
      
      // Если нужна валидация и запрос успешен
      if (validateSlots && result.success && result.data) {
        const slots = Array.isArray(result.data) ? result.data : 
                     (result.data.data ? result.data.data : []);
        
        if (slots.length > 0) {
          logger.info(`Validating ${slots.length} slots for staff ${staffId} on ${date}`);
          
          // Валидируем слоты с учетом существующих записей
          const validSlots = await slotValidator.validateSlotsWithBookings(
            slots,
            this.getYclientsClient(),
            companyId,
            staffId,
            date
          );
          
          // Возвращаем результат с валидированными слотами
          return {
            ...result,
            data: Array.isArray(result.data) ? validSlots : { ...result.data, data: validSlots },
            originalCount: slots.length,
            validatedCount: validSlots.length
          };
        }
      }
      
      return result;
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
      timePreference,
      companyId = config.yclients.companyId
    } = options;

    logger.info(`🔍 findSuitableSlot called with:`, {
      serviceId,
      staffId,
      preferredDate,
      preferredTime,
      timePreference,
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
              companyId,
              true // Включаем валидацию слотов
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
        
        // Фильтруем по временным предпочтениям если указаны
        let filteredSlots = allSlots;
        if (timePreference) {
          filteredSlots = this.filterSlotsByTimePreference(allSlots, timePreference);
          
          if (filteredSlots.length === 0) {
            logger.warn(`❌ No slots found matching time preference: ${timePreference}`);
            return {
              success: false,
              error: `No available slots found ${timePreference}`,
              reason: 'no_matching_time',
              data: [],
              allSlotsCount: allSlots.length,
              timePreference
            };
          }
        }
        
        // Сортируем слоты по времени
        filteredSlots.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        
        logger.info(`✅ Found ${filteredSlots.length} slots${timePreference ? ` for ${timePreference}` : ''} from ${staffWithSlots.length} staff members`);
        
        return { 
          success: true, 
          data: filteredSlots,
          reason: null,
          staffWithSlots: staffWithSlots.length,
          totalStaffChecked: staffResult.data.length,
          totalSlotsBeforeFilter: allSlots.length
        };
      }
      
      const slotsResult = await this.retryHandler.execute(
        async () => {
          const result = await this.getAvailableSlots(
            staffId,
            targetDate,
            actualServiceId,
            companyId,
            true // Включаем валидацию слотов
          );
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to get available slots');
          }
          
          return result;
        },
        'getAvailableSlots',
        { companyId, date: targetDate, staffId, serviceId: actualServiceId }
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

      // Фильтруем по временным предпочтениям если указаны
      let finalSlots = availableSlots;
      if (timePreference) {
        finalSlots = this.filterSlotsByTimePreference(availableSlots, timePreference);
        
        if (finalSlots.length === 0) {
          logger.warn(`❌ No slots found matching time preference: ${timePreference}`);
          return {
            success: false,
            error: `No available slots found ${timePreference}`,
            reason: 'no_matching_time',
            data: [],
            allSlotsCount: availableSlots.length,
            timePreference
          };
        }
      }
      
      logger.info(`✅ Found ${finalSlots.length} available slots${timePreference ? ` for ${timePreference}` : ''}`);
      return { 
        success: true, 
        data: finalSlots,
        reason: null,
        totalSlotsBeforeFilter: availableSlots.length
      };
    } catch (error) {
      logger.error('Error finding suitable slot:', error);
      return { success: false, error: error.message };
    }
  }

  async createBooking(bookingData, companyId = config.yclients.companyId) {
    try {
      logger.info('🔄 Creating booking with retry mechanism', {
        companyId,
        hasServices: !!bookingData.appointments,
        servicesCount: bookingData.appointments?.length
      });
      
      // Используем retry handler для создания записи
      const result = await this.retryHandler.execute(
        async () => {
          const response = await this.getYclientsClient().createBooking(bookingData, companyId);
          
          // Проверяем успешность ответа
          if (!response.success) {
            // Логируем полный ответ для диагностики
            logger.error('❌ Booking creation failed:', {
              response: response,
              errorType: typeof response.error,
              bookingData: bookingData
            });
            
            // Получаем текст ошибки (может быть строкой или объектом)
            const errorMessage = typeof response.error === 'string' 
              ? response.error 
              : (response.error?.message || JSON.stringify(response.error) || 'Booking creation failed');
            
            // Если ошибка временная (например, слот занят), не повторяем
            if (errorMessage && (
              errorMessage.includes('занят') ||
              errorMessage.includes('недоступ') ||
              errorMessage.includes('не работает')
            )) {
              throw Object.assign(new Error(errorMessage), { retryable: false });
            }
            
            // Для других ошибок позволяем retry
            throw new Error(errorMessage);
          }
          
          return response;
        },
        'createBooking',
        { companyId, clientPhone: bookingData.phone }
      );
      
      logger.info('✅ Booking created successfully', {
        recordId: result.data?.record_id,
        companyId
      });
      
      // Сохраняем владение записью
      if (result.data?.record_id && bookingData.phone) {
        try {
          await bookingOwnership.saveBookingOwnership(
            result.data.record_id,
            bookingData.phone,
            {
              client_id: bookingData.client_id,
              client_name: bookingData.full_name,
              datetime: bookingData.datetime,
              service: bookingData.appointments?.[0]?.services?.[0]?.title,
              staff: bookingData.appointments?.[0]?.staff?.name,
              company_id: companyId
            }
          );
        } catch (error) {
          logger.warn('Failed to save booking ownership:', error.message);
          // Не прерываем процесс, так как запись уже создана
        }
      }
      
      return result;
    } catch (error) {
      // Проверяем, была ли это не-повторяемая ошибка
      if (error.retryable === false) {
        logger.warn('Non-retryable booking error:', error.message);
        return { success: false, error: error.message };
      }
      
      logger.error('Error creating booking after retries:', error);
      
      // Логируем критичную ошибку создания записи
      await criticalErrorLogger.logCriticalError(error, {
        operation: 'createBooking',
        service: 'booking',
        companyId,
        clientPhone: bookingData.phone,
        clientName: bookingData.fullname,
        bookingData: {
          hasAppointments: !!bookingData.appointments,
          appointmentsCount: bookingData.appointments?.length,
          services: bookingData.appointments?.map(a => a.services),
          datetime: bookingData.appointments?.[0]?.datetime
        },
        retryAttempts: this.retryHandler.maxRetries,
        errorAfterRetries: true
      });
      
      return { 
        success: false, 
        error: error.message || 'Не удалось создать запись. Попробуйте позже.' 
      };
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

  /**
   * Get client bookings
   */
  async getClientBookings(phone, companyId = config.yclients.companyId) {
    try {
      logger.info(`📋 Getting bookings for client ${phone} at company ${companyId}`);
      
      // Сначала проверяем в нашем кэше владения записями
      const cachedBookings = await bookingOwnership.getClientBookings(phone);
      if (cachedBookings && cachedBookings.length > 0) {
        logger.info(`✅ Found ${cachedBookings.length} bookings in ownership cache`);
        
        // Получаем детали записей из YClients для актуальной информации
        const detailedBookings = [];
        for (const cached of cachedBookings) {
          try {
            const details = await this.getYclientsClient().getRecord(companyId, cached.id);
            if (details.success && details.data) {
              detailedBookings.push(details.data);
            }
          } catch (error) {
            logger.warn(`Failed to get details for booking ${cached.id}:`, error.message);
          }
        }
        
        if (detailedBookings.length > 0) {
          return { 
            success: true, 
            bookings: detailedBookings,
            source: 'ownership_cache'
          };
        }
      }
      
      // Fallback: получаем записи через YClients API
      logger.info('Falling back to YClients API search');
      const bookings = await this.getYclientsClient().getRecords(companyId, {
        client_phone: phone,
        start_date: format(new Date(), 'yyyy-MM-dd'), // Начинаем с сегодня
        end_date: format(addDays(new Date(), 60), 'yyyy-MM-dd') // Ищем на 60 дней вперед
      });

      if (!bookings.success || !bookings.data) {
        return { success: false, error: 'Failed to fetch bookings' };
      }

      // Логируем структуру ответа для отладки
      logger.debug('Bookings response structure:', { 
        type: typeof bookings.data,
        isArray: Array.isArray(bookings.data),
        keys: Object.keys(bookings.data || {}),
        sample: JSON.stringify(bookings.data).substring(0, 200)
      });

      // Проверяем формат данных - YClients может вернуть объект с массивом data
      const bookingsList = Array.isArray(bookings.data) ? bookings.data : 
                          (bookings.data.data ? bookings.data.data : []);
      
      // ВАЖНО: Дополнительно проверяем, что запись действительно принадлежит этому клиенту
      // YClients API иногда возвращает записи других клиентов
      const InternationalPhone = require('../../utils/international-phone');
      const normalizedPhone = InternationalPhone.normalize(phone);
      
      // Фильтруем только активные записи (не отмененные и не прошедшие)
      const activeBookings = bookingsList.filter(booking => {
        // Проверяем телефон клиента в записи
        if (booking.client && booking.client.phone) {
          const bookingPhone = InternationalPhone.normalize(booking.client.phone);
          if (!InternationalPhone.equals(bookingPhone, normalizedPhone)) {
            logger.warn(`⚠️ Skipping booking ${booking.id} - belongs to different client`, {
              requestedPhone: phone,
              bookingPhone: booking.client.phone,
              clientName: booking.client.name
            });
            return false;
          }
        }
        
        // Проверяем статус attendance (пропускаем записи со статусом "не пришел" = -1)
        if (booking.attendance === -1 || booking.visit_attendance === -1) {
          logger.info(`⚠️ Skipping booking ${booking.id} - already cancelled (no-show status)`, {
            attendance: booking.attendance,
            visit_attendance: booking.visit_attendance
          });
          return false;
        }
        
        const bookingDate = new Date(booking.datetime);
        const now = new Date();
        return bookingDate > now && booking.deleted === false;
      });

      logger.info(`✅ Found ${activeBookings.length} active bookings for ${phone} (filtered ${bookingsList.length - activeBookings.length} invalid/past bookings)`);
      
      return { 
        success: true, 
        bookings: activeBookings 
      };
    } catch (error) {
      logger.error('Error getting client bookings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(recordId, companyId = config.yclients.companyId) {
    try {
      logger.info(`🚫 Canceling booking ${recordId} at company ${companyId}`);
      
      // Сначала пробуем мягкую отмену через изменение статуса
      const softCancelResult = await this.getYclientsClient().cancelRecordSoft(companyId, recordId);
      
      if (softCancelResult.success) {
        logger.info(`✅ Successfully soft-canceled booking ${recordId} (status: не пришел)`);
        
        // Удаляем из сервиса владения
        try {
          await bookingOwnership.removeBooking(recordId);
        } catch (error) {
          logger.warn('Failed to remove booking ownership:', error.message);
        }
        
        return softCancelResult;
      }
      
      // Если мягкая отмена не удалась, пробуем удалить запись
      logger.warn(`⚠️ Soft cancel failed, trying to delete record ${recordId}`);
      const deleteResult = await this.getYclientsClient().deleteRecord(companyId, recordId);

      if (deleteResult.success) {
        logger.info(`✅ Successfully deleted booking ${recordId}`);
        
        // Удаляем из сервиса владения
        try {
          await bookingOwnership.removeBooking(recordId);
        } catch (error) {
          logger.warn('Failed to remove booking ownership:', error.message);
        }
      } else {
        logger.error(`❌ Failed to cancel booking ${recordId}: ${deleteResult.error}`);
      }

      return deleteResult;
    } catch (error) {
      logger.error('Error canceling booking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel user booking with record hash
   * Использует user endpoint который не требует прав администратора
   */
  async cancelUserBooking(recordId, recordHash) {
    try {
      logger.info(`🚫 Canceling user booking ${recordId} with hash`);
      
      // Отменяем запись через user endpoint
      const result = await this.getYclientsClient().deleteUserRecord(recordId, recordHash);

      if (result.success) {
        logger.info(`✅ Successfully canceled user booking ${recordId}`);
      } else {
        logger.error(`❌ Failed to cancel user booking ${recordId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error canceling user booking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Подтвердить запись клиента
   * @param {number} visitId - ID визита
   * @param {number} recordId - ID записи
   */
  async confirmBooking(visitId, recordId) {
    try {
      logger.info(`✅ Confirming booking ${recordId}`);
      
      const result = await this.getYclientsClient().updateVisitStatus(
        visitId,
        recordId,
        2, // Статус "Подтвердил"
        { comment: 'Подтверждено через WhatsApp бота' }
      );

      if (result.success) {
        logger.info(`✅ Successfully confirmed booking ${recordId}`);
      } else {
        logger.error(`❌ Failed to confirm booking ${recordId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error confirming booking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Отметить неявку клиента
   * @param {number} visitId - ID визита
   * @param {number} recordId - ID записи
   */
  async markNoShow(visitId, recordId, reason = '') {
    try {
      logger.info(`❌ Marking no-show for booking ${recordId}`);
      
      const result = await this.getYclientsClient().updateVisitStatus(
        visitId,
        recordId,
        -1, // Статус "Не пришел"
        { comment: reason || 'Клиент не явился' }
      );

      if (result.success) {
        logger.info(`✅ Successfully marked no-show for booking ${recordId}`);
      } else {
        logger.error(`❌ Failed to mark no-show for booking ${recordId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error marking no-show:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Отметить что клиент пришел
   * @param {number} visitId - ID визита
   * @param {number} recordId - ID записи
   */
  async markArrived(visitId, recordId) {
    try {
      logger.info(`✅ Marking arrived for booking ${recordId}`);
      
      const result = await this.getYclientsClient().updateVisitStatus(
        visitId,
        recordId,
        1, // Статус "Пришел"
        { comment: 'Клиент пришел' }
      );

      if (result.success) {
        logger.info(`✅ Successfully marked arrived for booking ${recordId}`);
      } else {
        logger.error(`❌ Failed to mark arrived for booking ${recordId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error marking arrived:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BookingService();
