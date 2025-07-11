// src/services/ai-admin/index.js
const { supabase } = require('../../database/supabase');
const bookingService = require('../booking');
const logger = require('../../utils/logger');
const config = require('../../config');

/**
 * AI Администратор - простой и эффективный
 * Имеет прямой доступ к БД и может создавать записи
 */
class AIAdmin {
  constructor() {
    this.contextStore = new Map(); // Хранение контекста диалогов
  }

  /**
   * Основной метод обработки сообщений
   */
  async processMessage(message, phone, companyId = config.yclients.companyId) {
    logger.info(`📱 Обработка сообщения от ${phone}: "${message}"`);

    try {
      // 1. Получаем или создаем контекст диалога
      const context = await this.getOrCreateContext(phone, companyId);

      // 2. Загружаем данные компании, клиента и доступные услуги
      const [company, client, services, staff] = await Promise.all([
        this.getCompanyInfo(companyId),
        this.getClientInfo(phone, companyId),
        this.getServices(companyId),
        this.getStaff(companyId)
      ]);

      // 3. Обновляем контекст новым сообщением
      context.messages.push({ role: 'user', content: message, timestamp: new Date() });

      // 4. Формируем промпт для AI
      const prompt = this.buildPrompt({
        message,
        context,
        company,
        client,
        services,
        staff
      });

      // 5. Получаем ответ от AI
      const aiResponse = await this.callAI(prompt);

      // 6. Обрабатываем действия AI
      const result = await this.processAIResponse(aiResponse, {
        phone,
        companyId,
        client,
        context
      });

      // 7. Сохраняем контекст
      context.messages.push({ role: 'assistant', content: result.response, timestamp: new Date() });
      await this.saveContext(phone, context);

      return result;

    } catch (error) {
      logger.error('Ошибка обработки сообщения:', error);
      return {
        success: false,
        response: 'Извините, произошла ошибка. Попробуйте еще раз или позвоните нам напрямую.',
        error: error.message
      };
    }
  }

  /**
   * Построение промпта для AI
   */
  buildPrompt({ message, context, company, client, services, staff }) {
    const lastMessages = context.messages.slice(-10); // Последние 10 сообщений
    
    return `Ты - AI администратор салона красоты "${company.title}".

ИНФОРМАЦИЯ О КОМПАНИИ:
- Название: ${company.title}
- Адрес: ${company.address}
- Телефон: ${company.phone}
- Часы работы: ${JSON.stringify(company.working_hours)}

ИНФОРМАЦИЯ О КЛИЕНТЕ:
- Имя: ${client.name}
- Телефон: ${client.phone}
- Количество визитов: ${client.visit_count}
- Последний визит: ${client.last_visit_date || 'Новый клиент'}
- Любимые услуги: ${client.last_services ? client.last_services.map(s => s.service_name).join(', ') : 'Нет данных'}
- Любимые мастера: ${client.favorite_staff_ids ? client.favorite_staff_ids.join(', ') : 'Нет предпочтений'}

ДОСТУПНЫЕ УСЛУГИ:
${services.map(s => `- ${s.title} (${s.price_min}₽, ${s.duration} мин)`).join('\n')}

ДОСТУПНЫЕ МАСТЕРА:
${staff.map(s => `- ${s.name} (${s.specialization}, рейтинг: ${s.rating || 'нет'})`).join('\n')}

ИСТОРИЯ ДИАЛОГА:
${lastMessages.map(m => `${m.role === 'user' ? 'Клиент' : 'Администратор'}: ${m.content}`).join('\n')}

НОВОЕ СООБЩЕНИЕ КЛИЕНТА: "${message}"

ТВОИ ЗАДАЧИ:
1. Будь дружелюбным и проактивным
2. Помоги клиенту записаться на услугу
3. Если клиент хочет записаться, выясни:
   - Какую услугу (если не указана, предложи популярные)
   - На какую дату и время
   - К какому мастеру (если нет предпочтений, предложи лучших)
4. Когда есть вся информация для записи, укажи в ответе специальную команду:
   [CREATE_BOOKING: service_id=ID, staff_id=ID, date=YYYY-MM-DD, time=HH:MM]

ВАЖНО:
- Если клиент говорит "сегодня", "завтра" и т.д. - переведи в конкретную дату
- Если клиент не указал мастера - предложи выбрать или запиши к любому свободному
- Используй информацию о предпочтениях клиента из истории
- Будь проактивным: предлагай удобное время, популярные услуги

Ответь клиенту дружелюбно и по существу:`;
  }

  /**
   * Вызов AI API
   */
  async callAI(prompt) {
    const aiService = require('../ai');
    const response = await aiService._callAI(prompt);
    return response;
  }

  /**
   * Обработка ответа AI и выполнение действий
   */
  async processAIResponse(aiResponse, { phone, companyId, client, context }) {
    logger.info('🤖 AI ответ:', aiResponse);

    // Проверяем, есть ли команда создания записи
    const bookingMatch = aiResponse.match(/\[CREATE_BOOKING: service_id=(\d+), staff_id=(\d+), date=([\d-]+), time=([\d:]+)\]/);
    
    if (bookingMatch) {
      const [, serviceId, staffId, date, time] = bookingMatch;
      
      logger.info('📅 AI хочет создать запись:', { serviceId, staffId, date, time });
      
      // Создаем запись через booking service
      const bookingResult = await bookingService.createBooking({
        client: {
          phone: client.phone,
          name: client.name,
          email: client.email
        },
        services: [parseInt(serviceId)],
        staff_id: parseInt(staffId),
        datetime: `${date} ${time}:00`,
        comment: 'Запись через AI администратора WhatsApp'
      }, companyId);

      if (bookingResult.success) {
        // Убираем команду из ответа
        const cleanResponse = aiResponse.replace(bookingMatch[0], '').trim();
        return {
          success: true,
          response: cleanResponse + '\n\n✅ Запись успешно создана!',
          booking: bookingResult.data
        };
      } else {
        return {
          success: false,
          response: 'Извините, не удалось создать запись. Попробуйте выбрать другое время или позвоните нам.',
          error: bookingResult.error
        };
      }
    }

    // Проверяем, нужно ли искать слоты
    const needSlots = aiResponse.toLowerCase().includes('свободн') || 
                     aiResponse.toLowerCase().includes('доступн') ||
                     aiResponse.toLowerCase().includes('слот');

    if (needSlots && context.lastIntent === 'booking') {
      // Ищем доступные слоты
      const slots = await this.findAvailableSlots(context);
      if (slots.length > 0) {
        const slotsText = this.formatSlots(slots);
        return {
          success: true,
          response: aiResponse + '\n\n' + slotsText
        };
      }
    }

    return {
      success: true,
      response: aiResponse
    };
  }

  /**
   * Поиск доступных слотов
   */
  async findAvailableSlots(context) {
    const { preferredDate, preferredService, preferredStaff } = context;
    
    const result = await bookingService.findSuitableSlot({
      serviceId: preferredService,
      staffId: preferredStaff,
      preferredDate: preferredDate || new Date().toISOString().split('T')[0]
    });

    return result.success ? result.data : [];
  }

  /**
   * Форматирование слотов для отображения
   */
  formatSlots(slots) {
    if (!slots || slots.length === 0) {
      return 'К сожалению, на выбранное время нет свободных слотов.';
    }

    const grouped = {};
    slots.forEach(slot => {
      const staffName = slot.staff_name || 'Мастер';
      if (!grouped[staffName]) {
        grouped[staffName] = [];
      }
      grouped[staffName].push(slot.time || slot.datetime.split(' ')[1]);
    });

    let text = '📅 Доступные слоты:\n\n';
    for (const [staff, times] of Object.entries(grouped)) {
      text += `👤 ${staff}:\n`;
      text += times.map(time => `• ${time}`).join('\n');
      text += '\n\n';
    }

    return text;
  }

  /**
   * Получение информации о компании
   */
  async getCompanyInfo(companyId) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (error) {
      logger.error('Ошибка получения данных компании:', error);
      return { title: 'Салон красоты', address: '', phone: '' };
    }

    return data;
  }

  /**
   * Получение информации о клиенте
   */
  async getClientInfo(phone, companyId) {
    // Нормализуем номер телефона
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .or(`phone.eq.${normalizedPhone},raw_phone.eq.${normalizedPhone}`)
      .single();

    if (error || !data) {
      logger.info('Клиент не найден, создаем нового');
      // Создаем нового клиента
      const { data: newClient } = await supabase
        .from('clients')
        .insert({
          company_id: companyId,
          phone: normalizedPhone,
          raw_phone: phone,
          name: 'Новый клиент',
          created_by_ai: true,
          source: 'whatsapp'
        })
        .select()
        .single();
      
      return newClient || { name: 'Клиент', phone: normalizedPhone };
    }

    return data;
  }

  /**
   * Получение списка услуг
   */
  async getServices(companyId) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('is_bookable', true)
      .order('weight', { ascending: false })
      .limit(20);

    if (error) {
      logger.error('Ошибка получения услуг:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Получение списка мастеров
   */
  async getStaff(companyId) {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('is_bookable', true)
      .order('rating', { ascending: false });

    if (error) {
      logger.error('Ошибка получения мастеров:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Получение или создание контекста диалога
   */
  async getOrCreateContext(phone, companyId) {
    const contextKey = `${phone}_${companyId}`;
    
    if (this.contextStore.has(contextKey)) {
      return this.contextStore.get(contextKey);
    }

    // Загружаем из БД
    const { data } = await supabase
      .from('dialog_contexts')
      .select('*')
      .eq('user_id', phone)
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const context = {
        messages: data.messages || [],
        state: data.state,
        data: data.data || {},
        lastActivity: new Date(data.updated_at)
      };
      this.contextStore.set(contextKey, context);
      return context;
    }

    // Создаем новый контекст
    const newContext = {
      messages: [],
      state: 'INIT',
      data: {},
      lastActivity: new Date()
    };

    this.contextStore.set(contextKey, newContext);
    return newContext;
  }

  /**
   * Сохранение контекста диалога
   */
  async saveContext(phone, context) {
    const { error } = await supabase
      .from('dialog_contexts')
      .upsert({
        user_id: phone,
        company_id: context.companyId || config.yclients.companyId,
        messages: context.messages,
        state: context.state,
        data: context.data,
        updated_at: new Date(),
        message_count: context.messages.length
      });

    if (error) {
      logger.error('Ошибка сохранения контекста:', error);
    }
  }

  /**
   * Очистка старых контекстов из памяти
   */
  cleanupOldContexts() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 минут

    for (const [key, context] of this.contextStore.entries()) {
      if (now - context.lastActivity.getTime() > maxAge) {
        this.contextStore.delete(key);
      }
    }
  }
}

module.exports = new AIAdmin();