# Client Reactivation System - Part 4: Response Tracking & Edge Cases

## 8. Response Tracker (`managers/response-tracker.js`)

**Ответственность**: Отслеживание ответов клиентов на реактивацию

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');
const contextService = require('../../context');

class ResponseTracker {
  /**
   * Обработать ответ клиента
   * Вызывается из AI Admin когда клиент отвечает на сообщение
   *
   * @param {string} phone - Телефон клиента
   * @param {string} messageText - Текст ответа
   * @param {Object} aiAnalysis - Анализ ответа от AI
   */
  async trackResponse(phone, messageText, aiAnalysis) {
    try {
      // 1. Получить активную кампанию
      const campaign = await this.getActiveCampaign(phone);

      if (!campaign) {
        logger.debug(`No active reactivation campaign for ${phone}`);
        return null;
      }

      logger.info(`📥 Tracking response for campaign ${campaign.id}`);

      // 2. Классифицировать ответ
      const responseType = this.classifyResponse(messageText, aiAnalysis);

      // 3. Обновить кампанию
      await this.updateCampaign(campaign, responseType, messageText);

      // 4. Обработать по типу ответа
      await this.handleResponseType(campaign, responseType, aiAnalysis);

      return {
        campaignId: campaign.id,
        responseType,
        handled: true
      };

    } catch (error) {
      logger.error('❌ Error tracking response:', error);
      throw error;
    }
  }

  /**
   * Получить активную кампанию для клиента
   */
  async getActiveCampaign(phone) {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .eq('client_phone', phone)
      .eq('is_campaign_completed', false)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {  // Not found is OK
      throw error;
    }

    return data;
  }

  /**
   * Классифицировать ответ
   */
  classifyResponse(messageText, aiAnalysis) {
    const text = messageText.toLowerCase();

    // Негативные паттерны
    const negativePatterns = [
      'не надо',
      'не пишите',
      'не беспокойте',
      'отстаньте',
      'не интересно',
      'не хочу'
    ];

    for (const pattern of negativePatterns) {
      if (text.includes(pattern)) {
        return 'negative';
      }
    }

    // Позитивные паттерны (запись создана)
    if (aiAnalysis?.bookingCreated) {
      return 'booking_created';
    }

    // Позитивные паттерны (заинтересован)
    const positivePatterns = [
      'да',
      'хорошо',
      'записать',
      'запишите',
      'подходит',
      'согласен',
      'давайте',
      'можно'
    ];

    for (const pattern of positivePatterns) {
      if (text.includes(pattern)) {
        return 'positive';
      }
    }

    // Нейтральный ответ
    return 'neutral';
  }

  /**
   * Обновить кампанию
   */
  async updateCampaign(campaign, responseType, messageText) {
    const now = new Date();
    const sentAt = new Date(campaign.sent_at);
    const responseTimeHours = Math.round((now - sentAt) / (1000 * 60 * 60));

    const updates = {
      response_received_at: now.toISOString(),
      response_type: responseType,
      response_text: messageText,
      response_time_hours: responseTimeHours,
      updated_at: now.toISOString()
    };

    // Если создана запись или негативный ответ - завершаем кампанию
    if (responseType === 'booking_created' || responseType === 'negative') {
      updates.is_campaign_completed = true;
      updates.completion_reason = responseType === 'booking_created' ? 'converted' : 'opted_out';
    }

    await supabase
      .from('reactivation_campaigns')
      .update(updates)
      .eq('id', campaign.id);

    logger.debug(`✅ Updated campaign ${campaign.id} with response type: ${responseType}`);
  }

  /**
   * Обработать ответ по типу
   */
  async handleResponseType(campaign, responseType, aiAnalysis) {
    const phone = campaign.client_phone;
    const companyId = campaign.company_id;

    switch (responseType) {
      case 'booking_created':
        await this.handleBookingCreated(campaign, aiAnalysis);
        break;

      case 'negative':
        await this.handleNegativeResponse(phone, companyId);
        break;

      case 'positive':
        // Клиент заинтересован, AI Admin продолжит диалог
        logger.info(`✅ Positive response for campaign ${campaign.id}`);
        break;

      case 'neutral':
        // Нейтральный ответ, ждем дальнейших действий
        logger.info(`ℹ️ Neutral response for campaign ${campaign.id}`);
        break;
    }
  }

  /**
   * Обработать создание записи
   */
  async handleBookingCreated(campaign, aiAnalysis) {
    const now = new Date();
    const sentAt = new Date(campaign.sent_at);
    const conversionTimeHours = Math.round((now - sentAt) / (1000 * 60 * 60));

    // Обновляем кампанию с информацией о записи
    await supabase
      .from('reactivation_campaigns')
      .update({
        booking_created: true,
        booking_id: aiAnalysis.bookingId,
        conversion_time_hours: conversionTimeHours
      })
      .eq('id', campaign.id);

    logger.info(`🎉 Reactivation converted! Campaign ${campaign.id} -> Booking ${aiAnalysis.bookingId}`);

    // Сбрасываем счетчик попыток клиента
    await supabase
      .from('clients')
      .update({
        reactivation_attempts_count: 0
      })
      .eq('phone', campaign.client_phone)
      .eq('company_id', campaign.company_id);
  }

  /**
   * Обработать негативный ответ (opt-out)
   */
  async handleNegativeResponse(phone, companyId) {
    // Помечаем клиента как opt-out
    await supabase
      .from('clients')
      .update({
        reactivation_opt_out: true,
        opt_out_reason: 'user_requested',
        opt_out_date: new Date().toISOString()
      })
      .eq('phone', phone)
      .eq('company_id', companyId);

    logger.info(`🚫 Client ${phone} opted out from reactivation`);

    // Обновляем контекст
    const phoneForContext = phone.replace('@c.us', '');
    const context = await contextService.getContext(phoneForContext);

    context.reactivationStatus = 'opted_out';

    await contextService.updateContext(phoneForContext, context);
  }

  /**
   * Проверить и планировать следующие попытки
   * Вызывается ежедневно scheduler'ом
   */
  async scheduleNextAttempts() {
    try {
      const now = new Date();

      // Находим кампании где прошел срок ожидания ответа
      const { data: campaigns, error } = await supabase
        .from('reactivation_campaigns')
        .select('*')
        .eq('is_campaign_completed', false)
        .eq('response_received_at', null)
        .lte('next_attempt_scheduled_at', now.toISOString());

      if (error) throw error;

      logger.info(`📋 Found ${campaigns?.length || 0} campaigns ready for next attempt`);

      for (const campaign of campaigns || []) {
        await this.handleNoResponse(campaign);
      }

    } catch (error) {
      logger.error('❌ Error scheduling next attempts:', error);
    }
  }

  /**
   * Обработать отсутствие ответа
   */
  async handleNoResponse(campaign) {
    // Получаем правила для услуги
    const { data: rule } = await supabase
      .from('service_reactivation_rules')
      .select('*')
      .eq('service_id', campaign.service_id)
      .eq('company_id', campaign.company_id)
      .single();

    if (!rule) {
      logger.warn(`No rule found for service ${campaign.service_id}`);
      return;
    }

    // Проверяем не превышен ли лимит попыток
    if (campaign.attempt_number >= rule.max_attempts) {
      // Завершаем кампанию
      await supabase
        .from('reactivation_campaigns')
        .update({
          is_campaign_completed: true,
          completion_reason: 'max_attempts',
          response_type: 'no_response',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      logger.info(`✅ Campaign ${campaign.id} completed: max attempts reached`);
      return;
    }

    // Планируем следующую попытку
    const nextAttemptDate = new Date();
    nextAttemptDate.setDate(nextAttemptDate.getDate() + rule.retry_interval_days);

    await supabase
      .from('reactivation_campaigns')
      .update({
        response_type: 'no_response',
        next_attempt_scheduled_at: nextAttemptDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    logger.info(`📅 Scheduled next attempt for campaign ${campaign.id} at ${nextAttemptDate}`);
  }
}

module.exports = new ResponseTracker();
```

---

## 🎯 Edge Cases - Детальное Описание

### Edge Case 1: Клиент просит другую услугу

**Сценарий**:
Отправили реактивацию на "Стрижка", клиент отвечает "А можно маникюр?"

**Обработка**:

```javascript
// В AI Admin (обработка команды CREATE_BOOKING)

async handleBookingIntent(phone, intent, context) {
  // Проверяем есть ли активная реактивация
  if (context.lastSystemAction?.type === 'reactivation') {
    const reactivationService = context.lastSystemAction.serviceOffered;
    const requestedService = intent.service;

    if (reactivationService !== requestedService) {
      // Клиент хочет другую услугу!

      // 1. Обновляем контекст
      context.servicePreferenceChange = {
        from: reactivationService,
        to: requestedService,
        timestamp: new Date().toISOString()
      };

      // 2. Помечаем в кампании
      await supabase
        .from('reactivation_campaigns')
        .update({
          personalization_data: {
            ...campaign.personalization_data,
            service_changed: true,
            requested_service: requestedService
          }
        })
        .eq('id', context.lastSystemAction.campaignId);

      // 3. Сохраняем предпочтение для будущего
      await this.saveNewServicePreference(phone, requestedService);

      // 4. Продолжаем запись с новой услугой
      return this.createBooking(phone, {
        ...intent,
        service: requestedService
      });
    }
  }
}
```

### Edge Case 2: Клиент хочет другого мастера

**Сценарий**:
Предложили любимого мастера "Иван", клиент отвечает "Хочу к Марии"

**Обработка**:

```javascript
async handleStaffChange(phone, requestedStaff, context) {
  const favoriteStaff = context.lastSystemAction?.personalizationData?.favoriteStaff;

  if (favoriteStaff && requestedStaff !== favoriteStaff) {
    // 1. Обновляем временное предпочтение
    context.currentSession = {
      ...context.currentSession,
      staff: requestedStaff,
      staffChanged: true,
      previousStaff: favoriteStaff
    };

    // 2. Если клиент регулярно меняет - обновляем базовое предпочтение
    const changeHistory = await this.getStaffChangeHistory(phone);

    if (changeHistory.filter(c => c.to === requestedStaff).length >= 2) {
      // Клиент уже 2 раза просил этого мастера
      await this.updateFavoriteStaff(phone, requestedStaff);

      logger.info(`✨ Updated favorite staff for ${phone}: ${favoriteStaff} → ${requestedStaff}`);
    }

    // 3. AI уведомляем клиента
    return {
      shouldAcknowledge: true,
      message: `Хорошо, записываю вас к ${requestedStaff}`
    };
  }
}
```

### Edge Case 3: Клиент в отпуске / временно недоступен

**Сценарий**:
"Я сейчас в отпуске до 15 числа, потом запишусь"

**Обработка**:

```javascript
async handleTemporaryUnavailable(phone, returnDate) {
  // 1. Сохраняем временную паузу
  await supabase
    .from('clients')
    .update({
      temporary_pause_until: returnDate,
      temporary_pause_reason: 'vacation'
    })
    .eq('phone', phone);

  // 2. Обновляем текущую кампанию
  const campaign = await responseTracker.getActiveCampaign(phone);

  if (campaign) {
    await supabase
      .from('reactivation_campaigns')
      .update({
        response_type: 'neutral',
        response_text: 'Client temporarily unavailable',
        next_attempt_scheduled_at: new Date(returnDate).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', campaign.id);
  }

  logger.info(`📅 Client ${phone} paused until ${returnDate}`);
}
```

### Edge Case 4: Клиент уже записался напрямую

**Сценарий**:
Отправили реактивацию, но клиент уже записался через сайт/по телефону

**Обработка**:

```javascript
// В booking-monitor при обнаружении новой записи

async onNewBookingCreated(booking) {
  // Проверяем есть ли активная реактивация для этого клиента
  const { data: campaign } = await supabase
    .from('reactivation_campaigns')
    .select('*')
    .eq('client_phone', booking.client_phone)
    .eq('is_campaign_completed', false)
    .order('sent_at', { ascending: false })
    .limit(1)
    .single();

  if (campaign) {
    // Проверяем что запись создана в течение 7 дней после реактивации
    const sentAt = new Date(campaign.sent_at);
    const bookingAt = new Date(booking.created_at);
    const daysDiff = (bookingAt - sentAt) / (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) {
      // Засчитываем как конверсию реактивации!
      await supabase
        .from('reactivation_campaigns')
        .update({
          booking_created: true,
          booking_id: booking.id,
          response_type: 'booking_created',
          conversion_time_hours: Math.round(daysDiff * 24),
          is_campaign_completed: true,
          completion_reason: 'converted',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign.id);

      logger.info(`🎉 Booking ${booking.id} attributed to reactivation campaign ${campaign.id}`);
    }
  }
}
```

### Edge Case 5: Множественные активные кампании

**Сценарий**:
Клиент подходит под реактивацию по нескольким услугам

**Обработка**:

```javascript
// В InactivityDetector.deduplicateClients()

deduplicateClients(clients) {
  const clientMap = new Map();

  for (const client of clients) {
    const phone = client.phone;

    if (!clientMap.has(phone)) {
      clientMap.set(phone, [client]);
    } else {
      clientMap.get(phone).push(client);
    }
  }

  // Для каждого клиента выбираем одну наиболее подходящую услугу
  const result = [];

  for (const [phone, clientServices] of clientMap.entries()) {
    if (clientServices.length === 1) {
      result.push(clientServices[0]);
      continue;
    }

    // Приоритет:
    // 1. Услуга с наибольшим daysSinceVisit (давно не был)
    // 2. Услуга с наибольшей частотой в истории
    // 3. Услуга с наибольшей стоимостью

    const sorted = clientServices.sort((a, b) => {
      // Сначала по daysSinceVisit
      if (b.daysSinceVisit !== a.daysSinceVisit) {
        return b.daysSinceVisit - a.daysSinceVisit;
      }

      // Потом по частоте
      const aFreq = a.serviceFrequency || 0;
      const bFreq = b.serviceFrequency || 0;
      if (bFreq !== aFreq) {
        return bFreq - aFreq;
      }

      // Потом по стоимости
      return (b.serviceCost || 0) - (a.serviceCost || 0);
    });

    result.push(sorted[0]);

    logger.debug(`📊 Client ${phone} has ${clientServices.length} eligible services, chose: ${sorted[0].serviceId}`);
  }

  return result;
}
```

### Edge Case 6: WhatsApp аккаунт забанен

**Сценарий**:
Попытка отправки возвращает ошибку бана

**Обработка**:

```javascript
// В whatsappClient.sendMessage() wrapper

async sendMessageWithTracking(phone, message) {
  try {
    const result = await whatsappClient.sendMessage(phone, message);
    return result;

  } catch (error) {
    // Проверяем тип ошибки
    if (this.isBanError(error)) {
      logger.error(`🚨 WhatsApp account banned!`);

      // 1. Обновляем health
      await supabase
        .from('whatsapp_account_health')
        .update({
          last_ban_date: new Date().toISOString(),
          ban_count: supabase.raw('ban_count + 1'),
          warmup_level: 'cold',
          spam_score: 1.0,
          daily_outbound_limit: 5,  // Резко снижаем лимиты
          last_incident_type: 'ban',
          last_incident_date: new Date().toISOString()
        })
        .eq('company_id', companyId);

      // 2. Уведомляем админа
      await this.notifyAdminAboutBan(companyId);

      // 3. Останавливаем все реактивации
      await this.pauseReactivations(companyId);

      throw new Error('WhatsApp account banned');
    }

    throw error;
  }
}

isBanError(error) {
  const banPatterns = [
    'account banned',
    'blocked',
    'suspended',
    '403'
  ];

  const errorMsg = error.message?.toLowerCase() || '';

  return banPatterns.some(pattern => errorMsg.includes(pattern));
}
```

### Edge Case 7: Изменение предпочтений в процессе диалога

**Сценарий**:
```
AI: "Записать к Ивану в 18:00?"
Клиент: "Нет, хочу утром"
AI: "Понял, есть утром в 10:00 к Ивану"
Клиент: "А можно к Марии?"
```

**Обработка**:

```javascript
// В AI Admin - динамическое обновление контекста

async processConversation(phone, messages) {
  const context = await contextService.getContext(phone);

  // Отслеживаем изменения в предпочтениях ВНУТРИ диалога
  const conversationPreferences = {
    time: context.currentSession?.preferredTime || null,
    staff: context.currentSession?.preferredStaff || null,
    service: context.currentSession?.preferredService || null
  };

  // При каждом сообщении клиента анализируем изменения
  for (const msg of messages) {
    const changes = this.detectPreferenceChanges(msg.content, conversationPreferences);

    if (changes.time) {
      conversationPreferences.time = changes.time;
      context.currentSession.preferredTime = changes.time;
    }

    if (changes.staff) {
      conversationPreferences.staff = changes.staff;
      context.currentSession.preferredStaff = changes.staff;
    }

    if (changes.service) {
      conversationPreferences.service = changes.service;
      context.currentSession.preferredService = changes.service;
    }
  }

  // Сохраняем обновленный контекст
  await contextService.updateContext(phone, context);

  // AI видит актуальные предпочтения
  return {
    context,
    preferences: conversationPreferences
  };
}
```

---

*Продолжение в Part 5: API, Configuration, Monitoring...*
