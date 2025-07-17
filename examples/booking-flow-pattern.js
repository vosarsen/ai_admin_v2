/**
 * Booking Flow Pattern Example
 * 
 * This pattern shows the complete booking flow from slot search
 * to confirmation in AI Admin v2.
 */

const { yclientsAPI } = require('../integrations/yclients');
const { supabase } = require('../database/supabase');

// Example 1: Search Available Slots
const searchAvailableSlots = async (companyId, params) => {
  const {
    service_ids,
    staff_id = 0, // 0 means any available staff
    date = new Date().toISOString().split('T')[0],
    days_ahead = 7
  } = params;
  
  try {
    // Get available times from YClients
    const response = await yclientsAPI.get(
      `/book_times/${companyId}/${staff_id}/${date}`,
      {
        params: {
          service_ids: service_ids.join(',')
        }
      }
    );
    
    // Format slots for display
    const slots = response.data.map(slot => ({
      time: slot.time,
      datetime: slot.datetime,
      duration: slot.seance_length,
      available_staff: slot.staff || []
    }));
    
    // Group by time periods
    return groupSlotsByTimeOfDay(slots);
    
  } catch (error) {
    logger.error('Error searching slots:', error);
    throw new Error('Не удалось получить доступные времена');
  }
};

// Example 2: Create Booking
const createBooking = async (companyId, bookingData) => {
  const {
    phone,
    fullname,
    email,
    services,
    staff_id,
    datetime,
    comment = '',
    notify_by_sms = 24, // hours before
    custom_fields = {}
  } = bookingData;
  
  try {
    // Validate booking parameters
    await validateBookingParams(companyId, {
      services, staff_id, datetime
    });
    
    // Create booking in YClients
    const ycResponse = await yclientsAPI.post(
      `/book_record/${companyId}`,
      {
        phone: formatPhone(phone),
        fullname: fullname,
        email: email || '',
        appointments: [{
          id: 1,
          services: services,
          staff_id: staff_id,
          datetime: datetime,
          custom_fields: custom_fields
        }],
        comment: comment,
        notify_by_sms: notify_by_sms,
        api_id: `ai_admin_${Date.now()}`
      }
    );
    
    // Save to local database
    const booking = await saveBookingToDatabase({
      yclients_id: ycResponse.data[0].id,
      company_id: companyId,
      client_phone: phone,
      services: services,
      staff_id: staff_id,
      datetime: datetime,
      status: 'confirmed',
      source: 'whatsapp_ai'
    });
    
    return {
      success: true,
      booking_id: booking.id,
      yclients_id: ycResponse.data[0].id,
      datetime: datetime,
      services: await getServiceNames(services),
      staff: await getStaffName(staff_id)
    };
    
  } catch (error) {
    logger.error('Error creating booking:', error);
    
    // Handle specific errors
    if (error.response?.status === 422) {
      throw new Error('Это время уже занято. Пожалуйста, выберите другое.');
    }
    
    throw new Error('Не удалось создать запись. Попробуйте еще раз.');
  }
};

// Example 3: Booking Validation
const validateBookingParams = async (companyId, params) => {
  const { services, staff_id, datetime } = params;
  
  // Check if datetime is in the future
  if (new Date(datetime) <= new Date()) {
    throw new Error('Нельзя записаться на прошедшее время');
  }
  
  // Check if services exist and are active
  const serviceCheck = await supabase
    .from('services')
    .select('id, title, is_active')
    .eq('company_id', companyId)
    .in('yclients_id', services);
    
  const activeServices = serviceCheck.data?.filter(s => s.is_active);
  if (activeServices?.length !== services.length) {
    throw new Error('Некоторые услуги недоступны');
  }
  
  // Check if staff exists and can provide these services
  if (staff_id > 0) {
    const staffCheck = await supabase
      .from('staff')
      .select(`
        id, 
        name, 
        is_active,
        staff_services!inner(service_id)
      `)
      .eq('company_id', companyId)
      .eq('yclients_id', staff_id)
      .maybeSingle();
      
    if (!staffCheck.data?.is_active) {
      throw new Error('Выбранный мастер недоступен');
    }
    
    // Check if staff provides all requested services
    const staffServiceIds = staffCheck.data.staff_services.map(ss => ss.service_id);
    const canProvideAll = services.every(sid => 
      staffServiceIds.includes(sid)
    );
    
    if (!canProvideAll) {
      throw new Error('Мастер не предоставляет все выбранные услуги');
    }
  }
  
  // Check business hours
  const bookingHour = new Date(datetime).getHours();
  const businessHours = await getBusinessHours(companyId);
  
  if (bookingHour < businessHours.open || bookingHour >= businessHours.close) {
    throw new Error('Время за пределами рабочих часов салона');
  }
  
  return true;
};

// Example 4: Smart Slot Grouping
const groupSlotsByTimeOfDay = (slots) => {
  const groups = {
    morning: { label: '🌅 Утро (9:00-12:00)', slots: [] },
    afternoon: { label: '☀️ День (12:00-17:00)', slots: [] },
    evening: { label: '🌆 Вечер (17:00-21:00)', slots: [] }
  };
  
  slots.forEach(slot => {
    const hour = parseInt(slot.time.split(':')[0]);
    
    if (hour >= 9 && hour < 12) {
      groups.morning.slots.push(slot);
    } else if (hour >= 12 && hour < 17) {
      groups.afternoon.slots.push(slot);
    } else if (hour >= 17 && hour < 21) {
      groups.evening.slots.push(slot);
    }
  });
  
  // Return only non-empty groups
  return Object.values(groups).filter(g => g.slots.length > 0);
};

// Example 5: Booking Confirmation Message
const formatBookingConfirmation = (booking, context) => {
  const { company, client } = context;
  const businessType = company.type || 'beauty';
  
  // Adapt message to business type
  const templates = {
    barbershop: `
✅ Отлично, ${client?.name || 'дружище'}! Записал тебя:

📅 ${formatDate(booking.datetime)}
⏰ ${formatTime(booking.datetime)}
✂️ ${booking.services.join(', ')}
👨‍💼 Мастер: ${booking.staff}

До встречи в ${company.title}!
`,
    beauty: `
✅ Прекрасно! Ваша запись подтверждена:

📅 ${formatDate(booking.datetime)}
⏰ ${formatTime(booking.datetime)}
💅 ${booking.services.join(', ')}
👩‍💼 Мастер: ${booking.staff}

Ждем вас в ${company.title}!
`,
    nails: `
✅ Супер! Вы записаны:

📅 ${formatDate(booking.datetime)}
⏰ ${formatTime(booking.datetime)}
💅 ${booking.services.join(', ')}
🧑‍🎨 Мастер: ${booking.staff}

До встречи в ${company.title}!
`
  };
  
  return templates[businessType] || templates.beauty;
};

// Example 6: Booking State Machine
class BookingStateMachine {
  constructor(context) {
    this.context = context;
    this.state = 'initial';
    this.bookingData = {};
  }
  
  async transition(message) {
    switch (this.state) {
      case 'initial':
        if (this.detectBookingIntent(message)) {
          this.state = 'selecting_service';
          return 'Какую услугу вы хотели бы выбрать?';
        }
        break;
        
      case 'selecting_service':
        const service = await this.extractService(message);
        if (service) {
          this.bookingData.services = [service.id];
          this.state = 'selecting_date';
          return 'На какой день вы хотите записаться?';
        }
        break;
        
      case 'selecting_date':
        const date = this.extractDate(message);
        if (date) {
          this.bookingData.date = date;
          this.state = 'selecting_time';
          const slots = await searchAvailableSlots(
            this.context.companyId, 
            this.bookingData
          );
          return this.formatSlotsMessage(slots);
        }
        break;
        
      case 'selecting_time':
        const time = this.extractTime(message);
        if (time) {
          this.bookingData.datetime = this.combineDatetime(
            this.bookingData.date, 
            time
          );
          this.state = 'confirming';
          return this.formatConfirmationRequest();
        }
        break;
        
      case 'confirming':
        if (this.detectConfirmation(message)) {
          const booking = await createBooking(
            this.context.companyId,
            this.bookingData
          );
          this.state = 'completed';
          return formatBookingConfirmation(booking, this.context);
        }
        break;
    }
    
    return null;
  }
}

module.exports = {
  searchAvailableSlots,
  createBooking,
  validateBookingParams,
  groupSlotsByTimeOfDay,
  formatBookingConfirmation,
  BookingStateMachine
};