# Client Reactivation System - Part 3: AI Generation & Campaign Management

## 5. AI Message Generator (`generators/ai-message-generator.js`)

**Ответственность**: Генерация персонализированных сообщений через Gemini AI

```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { getProxyAgent } = require('../../../utils/proxy');

class AIMessageGenerator {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  }

  /**
   * Сгенерировать персонализированное сообщение реактивации
   *
   * @param {Object} context - Контекст для генерации
   * @returns {Promise<Object>} Сгенерированное сообщение и метаданные
   */
  async generateReactivationMessage(context) {
    const startTime = Date.now();

    try {
      const prompt = this.buildPrompt(context);

      logger.debug('🤖 Generating reactivation message via Gemini...');

      // Генерируем через Gemini с прокси
      const result = await this.callGeminiWithProxy(prompt);

      const generationTime = Date.now() - startTime;

      const message = this.parseResponse(result);

      logger.info(`✅ Generated message in ${generationTime}ms`);

      return {
        message,
        generationTime,
        prompt,
        modelUsed: 'gemini-2.0-flash-exp'
      };

    } catch (error) {
      logger.error('❌ Error generating message:', error);
      // Fallback to template
      return {
        message: this.generateFallbackMessage(context),
        generationTime: Date.now() - startTime,
        modelUsed: 'fallback-template',
        error: error.message
      };
    }
  }

  /**
   * Построить промпт для AI
   */
  buildPrompt(context) {
    const {
      client,
      preferences,
      slots,
      attemptNumber,
      discountOffered,
      businessType,
      tone,
      serviceOffered,
      daysSinceVisit
    } = context;

    const toneDescriptions = {
      friendly: 'дружелюбный и теплый',
      professional: 'профессиональный и вежливый',
      casual: 'неформальный и легкий'
    };

    const businessTerms = {
      beauty: { service: 'процедура', master: 'мастер' },
      barbershop: { service: 'стрижка', master: 'барбер' },
      dental: { service: 'визит', master: 'врач' },
      fitness: { service: 'тренировка', master: 'тренер' }
    };

    const terms = businessTerms[businessType] || businessTerms.beauty;

    // Формируем информацию о слотах
    let slotsText = '';
    if (slots && slots.length > 0) {
      slotsText = slots.map((slot, i) => {
        const dateObj = new Date(slot.datetime);
        const dateStr = this.formatDateRussian(dateObj);
        const reason = slot.matchReason ? ` (${slot.matchReason})` : '';
        return `${i + 1}. ${dateStr} в ${slot.time}${reason}`;
      }).join('\n');
    }

    // Информация о любимом мастере
    const favoriteStaff = preferences?.staffPreferences?.favoriteStaffName;
    const staffMention = favoriteStaff
      ? `Любимый ${terms.master}: ${favoriteStaff}`
      : '';

    // Информация о регулярности
    const isRegular = preferences?.visitPattern?.isRegular;
    const avgInterval = preferences?.visitPattern?.averageIntervalDays;
    const regularityNote = isRegular && avgInterval
      ? `Обычно посещает каждые ${avgInterval} дней`
      : '';

    const prompt = `Ты - AI администратор салона красоты/барбершопа/клиники.

ЗАДАЧА: Написать персонализированное сообщение для реактивации клиента.

КОНТЕКСТ КЛИЕНТА:
- Имя: ${client.name || 'клиент'}
- Последний визит: ${daysSinceVisit} дней назад
- Количество визитов всего: ${client.visit_count || 0}
- Уровень лояльности: ${client.loyalty_level || 'New'}
- Потрачено всего: ${client.total_spent || 0} руб.
${staffMention}
${regularityNote}

ПРЕДЛОЖЕНИЕ:
- Услуга: ${serviceOffered}
- Попытка реактивации: ${attemptNumber}
- Скидка: ${discountOffered}%
${slotsText ? `- Доступные слоты:\n${slotsText}` : ''}

НАСТРОЙКИ:
- Тип бизнеса: ${businessType}
- Тон сообщения: ${toneDescriptions[tone] || toneDescriptions.friendly}

ТРЕБОВАНИЯ:
1. Обращайся к клиенту по имени (если есть)
2. Упомяни, сколько времени прошло с последнего визита
3. Если есть любимый ${terms.master} - обязательно упомяни
4. Предложи конкретные слоты (если есть)
5. Упомяни скидку ${discountOffered}%, если это не первая попытка
6. Используй ${toneDescriptions[tone]} стиль
7. Добавь легкий эмодзи (1-2), но не переборщи
8. Сообщение должно быть коротким (максимум 5-6 строк)
9. Закончи призывом к действию (записаться, подтвердить время и т.д.)

ВАЖНО:
- НЕ используй слова "реактивация", "вернуть вас"
- Пиши естественно, как живой администратор
- Если это VIP клиент - подчеркни его статус
- Если клиент регулярный - упомяни "как обычно"
- НЕ извиняйся за "беспокойство"

ФОРМАТ ОТВЕТА:
Напиши только текст сообщения, без пояснений и комментариев.`;

    return prompt;
  }

  /**
   * Вызвать Gemini API через прокси
   */
  async callGeminiWithProxy(prompt) {
    const proxyAgent = getProxyAgent();

    // Устанавливаем прокси для fetch
    const originalFetch = global.fetch;
    global.fetch = (url, options = {}) => {
      return originalFetch(url, {
        ...options,
        agent: proxyAgent
      });
    };

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } finally {
      // Восстанавливаем оригинальный fetch
      global.fetch = originalFetch;
    }
  }

  /**
   * Парсинг ответа AI
   */
  parseResponse(response) {
    // Убираем возможные markdown форматирование
    let message = response.trim();
    message = message.replace(/```/g, '');
    message = message.replace(/\*\*/g, '');

    // Проверяем длину
    if (message.length > 500) {
      logger.warn('⚠️ Generated message too long, truncating...');
      message = message.substring(0, 497) + '...';
    }

    return message;
  }

  /**
   * Fallback сообщение (если AI не работает)
   */
  generateFallbackMessage(context) {
    const {
      client,
      daysSinceVisit,
      discountOffered,
      slots,
      serviceOffered
    } = context;

    const name = client.name || 'дорогой клиент';

    let message = `Здравствуйте, ${name}! 😊\n\n`;
    message += `Прошло уже ${daysSinceVisit} дней с вашего последнего визита. `;
    message += `Соскучились!\n\n`;

    if (discountOffered > 0) {
      message += `Специально для вас - скидка ${discountOffered}% на ${serviceOffered}.\n\n`;
    }

    if (slots && slots.length > 0) {
      message += `Есть свободные слоты:\n`;
      slots.forEach((slot, i) => {
        const dateStr = this.formatDateRussian(new Date(slot.datetime));
        message += `• ${dateStr} в ${slot.time}\n`;
      });
      message += `\n`;
    }

    message += `Записать вас?`;

    return message;
  }

  /**
   * Форматировать дату на русском
   */
  formatDateRussian(date) {
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                   'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];

    // Определяем "сегодня", "завтра", "послезавтра"
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'сегодня';
    if (diffDays === 1) return 'завтра';
    if (diffDays === 2) return 'послезавтра';

    return `${dayName}, ${day} ${month}`;
  }
}

module.exports = AIMessageGenerator;
```

---

## 6. Campaign Manager (`managers/campaign-manager.js`)

**Ответственность**: Управление кампаниями реактивации

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');
const PreferenceAnalyzer = require('../detectors/preference-analyzer');
const SlotFinder = require('../generators/slot-finder');
const AIMessageGenerator = require('../generators/ai-message-generator');
const LimitManager = require('./limit-manager');
const whatsappClient = require('../../../integrations/whatsapp/client');
const contextService = require('../../context');

class CampaignManager {
  constructor() {
    this.preferenceAnalyzer = new PreferenceAnalyzer();
    this.slotFinder = new SlotFinder();
    this.aiGenerator = new AIMessageGenerator();
    this.limitManager = new LimitManager();
  }

  /**
   * Обработать пакет клиентов
   */
  async processBatch(clients) {
    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
      details: []
    };

    for (const clientData of clients) {
      try {
        const result = await this.processClient(clientData);

        if (result.success) {
          results.sent++;
        } else if (result.skipped) {
          results.skipped++;
        } else {
          results.failed++;
        }

        results.details.push(result);

        // Задержка между отправками (500ms)
        await this.sleep(500);

      } catch (error) {
        logger.error(`❌ Error processing client ${clientData.phone}:`, error);
        results.failed++;
        results.details.push({
          phone: clientData.phone,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Обработать одного клиента
   */
  async processClient(clientData) {
    const {
      client,
      phone,
      serviceId,
      rule,
      daysSinceVisit
    } = clientData;

    const companyId = rule.company_id;

    logger.info(`📤 Processing reactivation for ${phone}...`);

    try {
      // 1. Проверить лимиты
      const limitCheck = await this.limitManager.checkLimits(companyId);

      if (!limitCheck.allowed) {
        logger.warn(`⏭️ Skipping ${phone}: ${limitCheck.reason}`);
        return {
          phone,
          success: false,
          skipped: true,
          reason: limitCheck.reason
        };
      }

      // 2. Определить номер попытки
      const attemptNumber = await this.getAttemptNumber(phone, companyId, serviceId);

      // 3. Получить скидку для этой попытки
      const discountOffered = this.getDiscountForAttempt(
        rule.discount_progression,
        attemptNumber
      );

      // 4. Проанализировать предпочтения
      const preferences = await this.preferenceAnalyzer.analyzePreferences(
        client,
        companyId
      );

      // 5. Найти подходящие слоты
      const slots = await this.slotFinder.findMatchingSlots({
        companyId,
        serviceId,
        preferences,
        maxSlots: 3
      });

      // 6. Получить настройки компании
      const settings = await this.getCompanySettings(companyId);

      // 7. Получить информацию об услуге
      const service = await this.getServiceInfo(serviceId, companyId);

      // 8. Сгенерировать сообщение через AI
      const messageData = await this.aiGenerator.generateReactivationMessage({
        client,
        preferences,
        slots,
        attemptNumber,
        discountOffered,
        businessType: settings.business_type || 'beauty',
        tone: settings.tone || 'friendly',
        serviceOffered: service?.title || 'услугу',
        daysSinceVisit
      });

      // 9. Отправить сообщение
      await whatsappClient.sendMessage(phone, messageData.message);

      // 10. Сохранить кампанию
      const campaign = await this.saveCampaign({
        companyId,
        clientPhone: phone,
        clientId: client.id,
        serviceId,
        attemptNumber,
        messageText: messageData.message,
        discountOffered,
        slotsOffered: slots,
        aiPrompt: messageData.prompt,
        generationTime: messageData.generationTime,
        personalizationData: {
          preferences,
          daysSinceVisit,
          loyaltyLevel: client.loyalty_level
        }
      });

      // 11. Обновить контекст в Redis
      await this.updateClientContext(phone, campaign, messageData.message, slots);

      // 12. Обновить статистику клиента
      await this.updateClientStats(phone, companyId);

      // 13. Обновить лимиты
      await this.limitManager.incrementCounter(companyId);

      logger.info(`✅ Sent reactivation to ${phone} (attempt ${attemptNumber})`);

      return {
        phone,
        success: true,
        campaignId: campaign.id,
        attemptNumber,
        discount: discountOffered
      };

    } catch (error) {
      logger.error(`❌ Error processing ${phone}:`, error);
      return {
        phone,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получить номер попытки реактивации
   */
  async getAttemptNumber(phone, companyId, serviceId) {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('attempt_number')
      .eq('client_phone', phone)
      .eq('company_id', companyId)
      .eq('service_id', serviceId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 1; // Первая попытка
    }

    // Если последняя кампания завершена - начинаем новую серию
    if (data.is_campaign_completed) {
      return 1;
    }

    return (data.attempt_number || 0) + 1;
  }

  /**
   * Получить скидку для попытки
   */
  getDiscountForAttempt(progression, attemptNumber) {
    if (!progression || progression.length === 0) {
      return 0;
    }

    const index = attemptNumber - 1;
    if (index >= progression.length) {
      return progression[progression.length - 1]; // Последняя скидка
    }

    return progression[index];
  }

  /**
   * Сохранить кампанию в БД
   */
  async saveCampaign(data) {
    const nextAttemptDate = new Date();
    nextAttemptDate.setDate(
      nextAttemptDate.getDate() + 7  // Ждем ответа 7 дней
    );

    const { data: campaign, error } = await supabase
      .from('reactivation_campaigns')
      .insert({
        company_id: data.companyId,
        client_phone: data.clientPhone,
        client_id: data.clientId,
        service_id: data.serviceId,
        attempt_number: data.attemptNumber,
        message_text: data.messageText,
        discount_offered: data.discountOffered,
        slots_offered: data.slotsOffered,
        ai_prompt_used: data.aiPrompt,
        ai_generation_time_ms: data.generationTime,
        personalization_data: data.personalizationData,
        sent_at: new Date().toISOString(),
        next_attempt_scheduled_at: nextAttemptDate.toISOString(),
        is_campaign_completed: false
      })
      .select()
      .single();

    if (error) throw error;

    return campaign;
  }

  /**
   * Обновить контекст клиента в Redis
   */
  async updateClientContext(phone, campaign, message, slots) {
    try {
      const phoneForContext = phone.replace('@c.us', '');
      const context = await contextService.getContext(phoneForContext);

      // Добавляем информацию о реактивации
      context.lastSystemAction = {
        type: 'reactivation',
        sentAt: new Date().toISOString(),
        campaignId: campaign.id,
        attemptNumber: campaign.attempt_number,
        serviceOffered: campaign.service_id,
        discountOffered: campaign.discount_offered,
        slotsOffered: slots
      };

      // Флаг ожидания ответа
      context.expectingResponse = true;
      context.responseDeadline = campaign.next_attempt_scheduled_at;

      // Добавляем в историю диалога
      if (!context.dialogHistory) {
        context.dialogHistory = [];
      }

      context.dialogHistory.push({
        role: 'system',
        content: `[Отправлено сообщение реактивации]\n${message}`,
        timestamp: new Date().toISOString()
      });

      // Сохраняем контекст
      await contextService.updateContext(phoneForContext, context);

      logger.debug(`✅ Updated context for ${phoneForContext}`);

    } catch (error) {
      logger.warn('Failed to update client context:', error);
      // Не прерываем процесс
    }
  }

  /**
   * Обновить статистику клиента
   */
  async updateClientStats(phone, companyId) {
    await supabase
      .from('clients')
      .update({
        last_reactivation_sent: new Date().toISOString(),
        reactivation_attempts_count: supabase.raw('reactivation_attempts_count + 1')
      })
      .eq('phone', phone)
      .eq('company_id', companyId);
  }

  /**
   * Получить настройки компании
   */
  async getCompanySettings(companyId) {
    const { data } = await supabase
      .from('reactivation_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    return data || {};
  }

  /**
   * Получить информацию об услуге
   */
  async getServiceInfo(serviceId, companyId) {
    const { data } = await supabase
      .from('services')
      .select('title')
      .eq('yclients_id', serviceId)
      .eq('company_id', companyId)
      .single();

    return data;
  }

  /**
   * Задержка
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CampaignManager;
```

---

## 7. Limit Manager (`managers/limit-manager.js`)

**Ответственность**: Контроль лимитов WhatsApp

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');

class LimitManager {
  /**
   * Проверить можно ли отправить сообщение
   */
  async checkLimits(companyId) {
    try {
      // 1. Получить здоровье аккаунта
      const { data: health, error } = await supabase
        .from('whatsapp_account_health')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error) {
        logger.warn(`No health data for company ${companyId}, using defaults`);
        return { allowed: true };
      }

      // 2. Сбросить счетчики если нужно
      await this.resetCountersIfNeeded(health);

      // 3. Проверить дневной лимит
      if (health.current_daily_sent >= health.daily_outbound_limit) {
        return {
          allowed: false,
          reason: `Daily limit reached (${health.daily_outbound_limit})`
        };
      }

      // 4. Проверить часовой лимит
      if (health.current_hourly_sent >= health.hourly_outbound_limit) {
        return {
          allowed: false,
          reason: `Hourly limit reached (${health.hourly_outbound_limit})`
        };
      }

      // 5. Проверить время отправки
      const timeCheck = this.checkSendingTime(health.safe_sending_hours);
      if (!timeCheck.allowed) {
        return timeCheck;
      }

      // 6. Проверить день недели
      const dayCheck = this.checkSendingDay(health.safe_sending_days);
      if (!dayCheck.allowed) {
        return dayCheck;
      }

      // 7. Проверить spam score
      if (health.spam_score > 0.7) {
        return {
          allowed: false,
          reason: `High spam score (${health.spam_score})`
        };
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Error checking limits:', error);
      // В случае ошибки разрешаем отправку (fail-open)
      return { allowed: true };
    }
  }

  /**
   * Сбросить счетчики если прошел период
   */
  async resetCountersIfNeeded(health) {
    const now = new Date();
    const needsUpdate = {};

    // Сброс дневного счетчика
    const lastDailyReset = new Date(health.last_daily_reset_at);
    if (now.getDate() !== lastDailyReset.getDate()) {
      needsUpdate.current_daily_sent = 0;
      needsUpdate.last_daily_reset_at = now.toISOString();
    }

    // Сброс часового счетчика
    const lastHourlyReset = new Date(health.last_hourly_reset_at);
    if (now.getTime() - lastHourlyReset.getTime() > 3600000) {  // 1 час
      needsUpdate.current_hourly_sent = 0;
      needsUpdate.last_hourly_reset_at = now.toISOString();
    }

    if (Object.keys(needsUpdate).length > 0) {
      await supabase
        .from('whatsapp_account_health')
        .update(needsUpdate)
        .eq('company_id', health.company_id);
    }
  }

  /**
   * Проверить время отправки
   */
  checkSendingTime(safeHours) {
    const now = new Date();
    const currentHour = now.getHours();

    const start = safeHours?.start || 10;
    const end = safeHours?.end || 19;

    if (currentHour < start || currentHour >= end) {
      return {
        allowed: false,
        reason: `Outside safe sending hours (${start}-${end})`
      };
    }

    return { allowed: true };
  }

  /**
   * Проверить день недели
   */
  checkSendingDay(safeDays) {
    if (!safeDays || safeDays.length === 0) {
      return { allowed: true };
    }

    const today = new Date().getDay();

    if (!safeDays.includes(today)) {
      return {
        allowed: false,
        reason: `Not a safe sending day (${today})`
      };
    }

    return { allowed: true };
  }

  /**
   * Увеличить счетчик отправленных сообщений
   */
  async incrementCounter(companyId) {
    await supabase.rpc('increment_whatsapp_counters', {
      p_company_id: companyId
    });
  }
}

module.exports = LimitManager;
```

**SQL функция для инкремента**:
```sql
CREATE OR REPLACE FUNCTION increment_whatsapp_counters(p_company_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE whatsapp_account_health
  SET
    current_daily_sent = current_daily_sent + 1,
    current_hourly_sent = current_hourly_sent + 1,
    last_message_sent_at = NOW(),
    updated_at = NOW()
  WHERE company_id = p_company_id;
END;
$$ LANGUAGE plpgsql;
```

---

*Продолжение в Part 4...*
