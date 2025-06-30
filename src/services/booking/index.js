// src/services/booking/index.js
const config = require('../../config');
const logger = require('../../utils/logger');
const yclientsClient = require('../../integrations/yclients/client');
const contextService = require('../context');
const { DataTransformers } = require('../../utils/data-transformers');
const { format, addDays, parse, isAfter, isBefore } = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc } = require('date-fns-tz');

class BookingService {
  constructor() {
    this.timezone = config.business.timezone;
    this.maxDaysAhead = config.business.maxBookingDaysAhead;
    this.minMinutesAhead = config.business.minBookingMinutesAhead;
  }

  /**
   * Search available slots based on criteria
   */
  async searchSlots({ companyId, service, staff, date, time }) {
    try {
      logger.info('🔍 Searching slots', { service, staff, date, time });
      
      // 1. Get service and staff IDs
      const [serviceData, staffData] = await Promise.all([
        this._findService(companyId, service),
        staff ? this._findStaff(companyId, staff) : null
      ]);
      
      if (!serviceData) {
        return {
          success: false,
          error: 'Услуга не найдена',
          slots: []
        };
      }
      
      // 2. Determine date range
      const searchDates = this._getSearchDates(date);
      
      // 3. Search for available times
      const allSlots = [];
      
      for (const searchDate of searchDates) {
        // Get available staff for this date
        const availableStaff = await yclientsClient.post(
          `book_staff/${companyId}`,
          {
            datetime: `${searchDate} 12:00:00`,
            services: [serviceData.id]
          }
        );
        
        if (!availableStaff.success || !availableStaff.data?.length) {
          continue;
        }
        
        // For each available staff member, get their slots
        for (const staffMember of availableStaff.data) {
          if (staffData && staffMember.id !== staffData.id) {
            continue; // Skip if specific staff requested
          }
          
          const slotsResult = await yclientsClient.getAvailableSlots(
            staffMember.id,
            searchDate,
            { service_ids: [serviceData.id] },
            companyId
          );
          
          if (slotsResult.success && slotsResult.data?.length) {
            const slots = slotsResult.data.map(slot => ({
              date: searchDate,
              time: slot.time,
              datetime: slot.datetime,
              staff: staffMember.name,
              staffId: staffMember.id,
              service: serviceData.title,
              serviceId: serviceData.id,
              duration: serviceData.duration || slot.seance_length,
              price: serviceData.price_min
            }));
            
            allSlots.push(...slots);
          }
        }
      }
      
      // 4. Filter by time if specified
      let filteredSlots = allSlots;
      if (time) {
        filteredSlots = this._filterSlotsByTime(allSlots, time);
      }
      
      // 5. Sort and limit results
      filteredSlots.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
      
      return {
        success: true,
        slots: filteredSlots.slice(0, 10), // Return max 10 slots
        totalFound: filteredSlots.length
      };
      
    } catch (error) {
      logger.error('Failed to search slots:', error);
      return {
        success: false,
        error: 'Ошибка при поиске слотов',
        slots: []
      };
    }
  }

  /**
   * Create booking
   */
  async createBooking({ companyId, clientPhone, clientName, service, staff, datetime }) {
    try {
      logger.info('📝 Creating booking', { service, staff, datetime });
      
      // 1. Validate datetime
      const bookingDate = new Date(datetime);
      if (!this._isValidBookingTime(bookingDate)) {
        return {
          success: false,
          error: 'Выбранное время недоступно для записи'
        };
      }
      
      // 2. Get or create client
      const client = await this._getOrCreateClient(companyId, clientPhone, clientName);
      if (!client) {
        return {
          success: false,
          error: 'Не удалось создать клиента'
        };
      }
      
      // 3. Get service and staff data
      const [serviceData, staffData] = await Promise.all([
        this._findService(companyId, service),
        this._findStaff(companyId, staff)
      ]);
      
      if (!serviceData || !staffData) {
        return {
          success: false,
          error: 'Услуга или мастер не найдены'
        };
      }
      
      // 4. Check slot availability with YClients
      const checkResult = await yclientsClient.post(
        `book_check/${companyId}`,
        {
          appointments: [{
            id: 0,
            services: [serviceData.id],
            staff_id: staffData.id,
            datetime: format(bookingDate, 'yyyy-MM-dd HH:mm:ss'),
            seance_length: serviceData.duration * 60 // Convert to seconds
          }]
        }
      );
      
      if (!checkResult.success) {
        return {
          success: false,
          error: this._parseBookingError(checkResult)
        };
      }
      
      // 5. Create booking record
      const bookingData = {
        phone: client.phone,
        fullname: client.name,
        email: client.email || '',
        appointments: [{
          id: 0,
          services: [serviceData.id],
          staff_id: staffData.id,
          datetime: format(bookingDate, 'yyyy-MM-dd HH:mm:ss'),
          seance_length: serviceData.duration * 60,
          comment: ''
        }],
        comment: `Запись через WhatsApp AI`,
        api_id: `wa_${Date.now()}`
      };
      
      const createResult = await yclientsClient.post(
        `book_record/${companyId}`,
        bookingData
      );
      
      if (!createResult.success) {
        return {
          success: false,
          error: this._parseBookingError(createResult)
        };
      }
      
      // 6. Save booking to context
      const booking = {
        id: createResult.data[0]?.id || createResult.data.id,
        service: serviceData.title,
        staff: staffData.name,
        datetime: datetime,
        duration: serviceData.duration,
        price: serviceData.price_min,
        client: {
          phone: clientPhone,
          name: client.name
        }
      };
      
      await contextService.saveBooking(clientPhone, companyId, booking);
      
      // 7. Generate calendar event URL
      const calendarUrl = this._generateCalendarUrl(booking);
      
      return {
        success: true,
        booking: {
          ...booking,
          confirmed: true,
          details: this._formatBookingDetails(booking),
          calendarUrl
        }
      };
      
    } catch (error) {
      logger.error('Failed to create booking:', error);
      return {
        success: false,
        error: 'Ошибка при создании записи'
      };
    }
  }

  /**
   * Get service information
   */
  async getServiceInfo({ companyId, service }) {
    try {
      const serviceData = await this._findService(companyId, service);
      
      if (!serviceData) {
        return {
          success: false,
          error: 'Услуга не найдена'
        };
      }
      
      return {
        success: true,
        service: {
          title: serviceData.title,
          price: `${serviceData.price_min}₽`,
          duration: `${serviceData.duration} минут`,
          description: serviceData.comment || 'Описание отсутствует'
        }
      };
      
    } catch (error) {
      logger.error('Failed to get service info:', error);
      return {
        success: false,
        error: 'Ошибка при получении информации об услуге'
      };
    }
  }

  /**
   * Find service by name
   */
  async _findService(companyId, serviceName) {
    try {
      // Get from context cache first
      const cachedServices = await contextService._getServices(companyId);
      
      let services = cachedServices;
      if (!services.length) {
        // Fetch from YClients
        const result = await yclientsClient.getServices({}, companyId);
        if (result.success && result.data) {
          services = result.data;
          // Cache for future use
          await contextService.cacheServices(companyId, services);
        }
      }
      
      // Find best match
      const searchTerm = serviceName.toLowerCase().trim();
      
      // Exact match
      let service = services.find(s => 
        s.title.toLowerCase().trim() === searchTerm
      );
      
      if (!service) {
        // Starts with
        service = services.find(s => 
          s.title.toLowerCase().startsWith(searchTerm)
        );
      }
      
      if (!service) {
        // Contains
        service = services.find(s => 
          s.title.toLowerCase().includes(searchTerm)
        );
      }
      
      return service || null;
      
    } catch (error) {
      logger.error('Failed to find service:', error);
      return null;
    }
  }

  /**
   * Find staff by name
   */
  async _findStaff(companyId, staffName) {
    try {
      // Get from context cache first
      const cachedStaff = await contextService._getStaff(companyId);
      
      let staff = cachedStaff;
      if (!staff.length) {
        // Fetch from YClients
        const result = await yclientsClient.getStaff({}, companyId);
        if (result.success && result.data) {
          staff = result.data;
          // Cache for future use
          await contextService.cacheStaff(companyId, staff);
        }
      }
      
      // Find by name
      const searchTerm = staffName.toLowerCase().trim();
      
      return staff.find(s => 
        s.name.toLowerCase().includes(searchTerm)
      ) || null;
      
    } catch (error) {
      logger.error('Failed to find staff:', error);
      return null;
    }
  }

  /**
   * Get or create client
   */
  async _getOrCreateClient(companyId, phone, name) {
    try {
      const normalizedPhone = DataTransformers.normalizePhone(phone);
      
      // Try to find existing client
      const searchResult = await yclientsClient.get(
        `clients/${companyId}`,
        { phone: normalizedPhone }
      );
      
      if (searchResult.success && searchResult.data?.length > 0) {
        return searchResult.data[0];
      }
      
      // Create new client
      if (!name) {
        name = 'Клиент WhatsApp';
      }
      
      const createResult = await yclientsClient.post(
        `clients/${companyId}`,
        {
          name: name,
          phone: normalizedPhone,
          comment: 'Создан через WhatsApp AI'
        }
      );
      
      if (createResult.success) {
        return createResult.data;
      }
      
      return null;
      
    } catch (error) {
      logger.error('Failed to get/create client:', error);
      return null;
    }
  }

  /**
   * Get search dates based on input
   */
  _getSearchDates(inputDate) {
    const today = new Date();
    const dates = [];
    
    if (!inputDate || inputDate === 'сегодня') {
      dates.push(format(today, 'yyyy-MM-dd'));
    } else if (inputDate === 'завтра') {
      dates.push(format(addDays(today, 1), 'yyyy-MM-dd'));
    } else if (inputDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dates.push(inputDate);
    } else {
      // Default: today and next 2 days
      for (let i = 0; i < 3; i++) {
        dates.push(format(addDays(today, i), 'yyyy-MM-dd'));
      }
    }
    
    return dates;
  }

  /**
   * Filter slots by preferred time
   */
  _filterSlotsByTime(slots, preferredTime) {
    if (!preferredTime) return slots;
    
    const preferred = parse(preferredTime, 'HH:mm', new Date());
    const preferredMinutes = preferred.getHours() * 60 + preferred.getMinutes();
    
    return slots.filter(slot => {
      const slotTime = parse(slot.time, 'HH:mm', new Date());
      const slotMinutes = slotTime.getHours() * 60 + slotTime.getMinutes();
      
      // Within 2 hours of preferred time
      return Math.abs(slotMinutes - preferredMinutes) <= 120;
    });
  }

  /**
   * Validate booking time
   */
  _isValidBookingTime(bookingDate) {
    const now = new Date();
    const minTime = new Date(now.getTime() + this.minMinutesAhead * 60000);
    const maxTime = addDays(now, this.maxDaysAhead);
    
    return isAfter(bookingDate, minTime) && isBefore(bookingDate, maxTime);
  }

  /**
   * Parse booking error
   */
  _parseBookingError(result) {
    const errorMap = {
      432: 'Неправильный код подтверждения',
      433: 'Выбранное время уже занято',
      434: 'Клиент в черном списке',
      435: 'Не указано имя клиента',
      436: 'Нет доступных мастеров',
      437: 'Пересечение времени записей',
      438: 'Услуга недоступна'
    };
    
    if (result.meta?.code) {
      return errorMap[result.meta.code] || 'Ошибка при создании записи';
    }
    
    return result.error || 'Неизвестная ошибка';
  }

  /**
   * Format booking details for message
   */
  _formatBookingDetails(booking) {
    const date = new Date(booking.datetime);
    const dateStr = date.toLocaleDateString('ru-RU', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `📅 ${booking.service}\n` +
           `👤 Мастер: ${booking.staff}\n` +
           `📆 ${dateStr}\n` +
           `🕐 Время: ${timeStr}\n` +
           `💰 Стоимость: от ${booking.price}₽`;
  }

  /**
   * Generate calendar URL
   */
  _generateCalendarUrl(booking) {
    const startDate = new Date(booking.datetime);
    const endDate = new Date(startDate.getTime() + booking.duration * 60000);
    
    const event = {
      title: encodeURIComponent(`${booking.service} - ${booking.staff}`),
      start: format(startDate, "yyyyMMdd'T'HHmmss"),
      end: format(endDate, "yyyyMMdd'T'HHmmss"),
      details: encodeURIComponent(`Запись в салон красоты\nУслуга: ${booking.service}\nМастер: ${booking.staff}`)
    };
    
    // Google Calendar URL
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${event.title}&dates=${event.start}/${event.end}&details=${event.details}`;
  }
}

// Singleton instance
module.exports = new BookingService();