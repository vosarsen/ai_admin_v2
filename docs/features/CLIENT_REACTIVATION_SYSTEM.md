# Client Reactivation System - Technical Specification

## 📋 Оглавление

1. [Общее Описание](#общее-описание)
2. [Архитектура Системы](#архитектура-системы)
3. [База Данных](#база-данных)
4. [Компоненты Системы](#компоненты-системы)
5. [Бизнес-Логика](#бизнес-логика)
6. [AI Integration](#ai-integration)
7. [API Endpoints](#api-endpoints)
8. [Конфигурация](#конфигурация)
9. [Edge Cases](#edge-cases)
10. [Мониторинг и Метрики](#мониторинг-и-метрики)
11. [Безопасность WhatsApp](#безопасность-whatsapp)
12. [Тестирование](#тестирование)

---

## 📖 Общее Описание

### Цель
Автоматическая проактивная реактивация клиентов, которые не записывались определенное время, через персонализированные WhatsApp сообщения с использованием AI.

### Ключевые Особенности
- ✅ Гибкая настройка интервалов на уровне услуг
- ✅ AI-генерация персонализированных сообщений
- ✅ Умный анализ предпочтений клиентов
- ✅ Адаптивные лимиты для безопасности WhatsApp
- ✅ Долгосрочная память и контекст диалогов
- ✅ Детальная аналитика и оптимизация
- ✅ Прогрессивные скидки и предложения

### Принципы Работы
1. **Ежедневная проверка** неактивных клиентов (1 раз в день)
2. **Приоритизация** по LTV и loyalty level
3. **Персонализация** на основе истории и предпочтений
4. **Умная генерация** сообщений через AI
5. **Отслеживание** ответов и конверсии
6. **Оптимизация** на основе данных

---

## 🏗️ Архитектура Системы

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DAILY SCHEDULER (10:00)                      │
│                    (Cron: 0 10 * * *)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              INACTIVITY DETECTOR                                 │
│  - Query clients with last_visit > threshold                    │
│  - Filter by opt_out status                                     │
│  - Calculate priority scores                                    │
│  - Apply daily limits                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              CAMPAIGN MANAGER                                    │
│  - For each eligible client:                                    │
│    1. Get service reactivation rules                            │
│    2. Determine attempt number                                  │
│    3. Calculate discount offer                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PREFERENCE ANALYZER                                 │
│  - Analyze visit history                                        │
│  - Determine favorite staff/services                            │
│  - Calculate preferred time slots                               │
│  - Identify visit patterns                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              SLOT FINDER                                         │
│  - Get available slots from YClients                            │
│  - Filter by preferred staff (priority)                         │
│  - Filter by preferred time periods                             │
│  - Filter by preferred days of week                             │
│  - Return top 3-5 matching slots                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI MESSAGE GENERATOR                                │
│  - Prepare context (client, history, preferences)               │
│  - Prepare slots data                                           │
│  - Generate personalized message via Gemini                     │
│  - Apply business tone settings                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              LIMIT MANAGER                                       │
│  - Check WhatsApp account health                                │
│  - Verify daily/hourly limits                                   │
│  - Check sending time window                                    │
│  - Approve or queue for later                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              MESSAGE QUEUE (BullMQ)                              │
│  - Add to WhatsApp message queue                                │
│  - Save to reactivation_campaigns table                         │
│  - Update Redis context                                         │
│  - Set response deadline (+7 days)                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              WhatsApp Client → Client receives message           │
└─────────────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   RESPONSE         NO RESPONSE      NEGATIVE
    (Positive)      (7+ days)        (Opt-out)
        │                │                │
        ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│              RESPONSE TRACKER                                    │
│  - Track response type and timing                               │
│  - Update campaign status                                       │
│  - Update client preferences if needed                          │
│  - Schedule next attempt or mark completed                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              CONVERSION ANALYZER                                 │
│  - Calculate conversion metrics                                 │
│  - Analyze best times/days                                      │
│  - Optimize intervals                                           │
│  - Generate insights                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Client History (Supabase)
    ↓
Service Rules (Supabase)
    ↓
Eligible Clients List
    ↓
Client Preferences Analysis
    ↓
Available Slots (YClients API)
    ↓
AI Context Preparation
    ↓
Message Generation (Gemini API)
    ↓
Limit Check (Redis + Supabase)
    ↓
WhatsApp Queue (BullMQ)
    ↓
Context Update (Redis)
    ↓
Campaign Record (Supabase)
    ↓
Client Receives Message
    ↓
Response Tracking
    ↓
Analytics & Optimization
```

---

## 🗄️ База Данных

### Новые Таблицы

#### 1. `service_reactivation_rules`
Правила реактивации для каждой услуги.

```sql
CREATE TABLE service_reactivation_rules (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),

  -- Основные параметры
  reactivation_interval_days INTEGER NOT NULL DEFAULT 30,
  retry_interval_days INTEGER NOT NULL DEFAULT 14,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Скидки (прогрессия по попыткам)
  discount_progression INTEGER[] DEFAULT ARRAY[10, 15, 20],

  -- Источники интервала (для отладки)
  manual_interval INTEGER,              -- Выставлено клиентом вручную
  ai_suggested_interval INTEGER,        -- Предложено AI
  calculated_avg_interval INTEGER,      -- Рассчитано по истории

  -- Активный интервал (финальное значение)
  active_interval_source TEXT CHECK (active_interval_source IN
    ('manual', 'historical', 'ai', 'default')),

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_optimized_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(service_id, company_id)
);

CREATE INDEX idx_service_reactivation_company ON service_reactivation_rules(company_id);
CREATE INDEX idx_service_reactivation_active ON service_reactivation_rules(is_active);
```

#### 2. `reactivation_campaigns`
История всех кампаний реактивации.

```sql
CREATE TABLE reactivation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Основная информация
  company_id INTEGER NOT NULL REFERENCES companies(id),
  client_phone VARCHAR(20) NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  service_id INTEGER REFERENCES services(id),

  -- Параметры кампании
  attempt_number INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Содержание
  message_text TEXT NOT NULL,
  discount_offered INTEGER,
  slots_offered JSONB,  -- [{ datetime, staff_id, staff_name, service }]

  -- AI контекст
  ai_prompt_used TEXT,
  ai_generation_time_ms INTEGER,
  personalization_data JSONB,  -- Сохраненный контекст для анализа

  -- Результаты
  response_received_at TIMESTAMP WITH TIME ZONE,
  response_type TEXT CHECK (response_type IN
    ('positive', 'negative', 'neutral', 'no_response', 'booking_created')),
  response_text TEXT,

  booking_created BOOLEAN DEFAULT false,
  booking_id INTEGER REFERENCES bookings(id),

  -- Метрики
  conversion_time_hours INTEGER,  -- Часов до конверсии
  response_time_hours INTEGER,     -- Часов до ответа

  -- Планирование следующей попытки
  next_attempt_scheduled_at TIMESTAMP WITH TIME ZONE,
  is_campaign_completed BOOLEAN DEFAULT false,
  completion_reason TEXT CHECK (completion_reason IN
    ('converted', 'max_attempts', 'opted_out', 'cancelled')),

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_phone ON reactivation_campaigns(client_phone);
CREATE INDEX idx_campaigns_company ON reactivation_campaigns(company_id);
CREATE INDEX idx_campaigns_sent_at ON reactivation_campaigns(sent_at);
CREATE INDEX idx_campaigns_next_attempt ON reactivation_campaigns(next_attempt_scheduled_at);
CREATE INDEX idx_campaigns_response_type ON reactivation_campaigns(response_type);
```

#### 3. `whatsapp_account_health`
Мониторинг здоровья WhatsApp аккаунта.

```sql
CREATE TABLE whatsapp_account_health (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),

  -- Параметры аккаунта
  account_created_at TIMESTAMP WITH TIME ZONE,
  account_age_days INTEGER GENERATED ALWAYS AS
    (EXTRACT(DAY FROM NOW() - account_created_at)) STORED,

  warmup_level TEXT NOT NULL DEFAULT 'cold'
    CHECK (warmup_level IN ('cold', 'warm', 'hot')),

  -- Лимиты
  daily_outbound_limit INTEGER NOT NULL DEFAULT 20,
  hourly_outbound_limit INTEGER NOT NULL DEFAULT 5,
  concurrent_limit INTEGER NOT NULL DEFAULT 2,

  -- Текущее состояние
  current_daily_sent INTEGER DEFAULT 0,
  current_hourly_sent INTEGER DEFAULT 0,
  last_message_sent_at TIMESTAMP WITH TIME ZONE,
  last_daily_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_hourly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Здоровье
  spam_score DECIMAL(3,2) DEFAULT 0.0 CHECK (spam_score BETWEEN 0 AND 1),
  last_ban_date TIMESTAMP WITH TIME ZONE,
  ban_count INTEGER DEFAULT 0,

  -- Инциденты
  last_incident_date TIMESTAMP WITH TIME ZONE,
  last_incident_type TEXT,

  -- Настройки безопасности
  safe_sending_hours JSONB DEFAULT '{"start": 10, "end": 19}'::jsonb,
  safe_sending_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],  -- Пн-Пт

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wa_health_company ON whatsapp_account_health(company_id);
CREATE INDEX idx_wa_health_warmup ON whatsapp_account_health(warmup_level);
```

#### 4. `reactivation_settings`
Настройки системы реактивации для компании.

```sql
CREATE TABLE reactivation_settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id),

  -- Основные настройки
  enabled BOOLEAN NOT NULL DEFAULT true,
  tone TEXT DEFAULT 'friendly' CHECK (tone IN ('friendly', 'professional', 'casual')),

  -- Лимиты
  daily_limit_mode TEXT DEFAULT 'auto' CHECK (daily_limit_mode IN ('auto', 'manual')),
  manual_daily_limit INTEGER,

  -- Время отправки
  sending_hours JSONB DEFAULT '{"start": 10, "end": 19}'::jsonb,
  sending_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],

  -- Уведомления
  notify_admin_on_low_conversion BOOLEAN DEFAULT true,
  conversion_threshold DECIMAL(3,2) DEFAULT 0.15,
  admin_notification_chat_id VARCHAR(50),

  -- Дополнительные настройки
  include_slots_in_message BOOLEAN DEFAULT true,
  max_slots_to_offer INTEGER DEFAULT 3,
  prefer_favorite_staff BOOLEAN DEFAULT true,

  -- Метаданные
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reactivation_settings_company ON reactivation_settings(company_id);
```

### Расширение Существующих Таблиц

#### `clients` - добавить поля:

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reactivation_opt_out BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_out_reason TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS opt_out_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_reactivation_sent TIMESTAMP WITH TIME ZONE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reactivation_attempts_count INTEGER DEFAULT 0;

-- Предпочтения клиента (для кэширования)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_time_period TEXT
  CHECK (preferred_time_period IN ('morning', 'afternoon', 'evening'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_days INTEGER[];
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preference_confidence DECIMAL(3,2);

CREATE INDEX idx_clients_opt_out ON clients(reactivation_opt_out);
CREATE INDEX idx_clients_last_reactivation ON clients(last_reactivation_sent);
```

### Миграция Данных

```sql
-- Создать дефолтные правила для существующих услуг
INSERT INTO service_reactivation_rules
  (service_id, company_id, reactivation_interval_days, active_interval_source)
SELECT
  s.id,
  s.company_id,
  30,  -- Дефолтный интервал
  'default'
FROM services s
WHERE s.company_id IS NOT NULL
ON CONFLICT (service_id, company_id) DO NOTHING;

-- Создать дефолтные настройки для компаний
INSERT INTO reactivation_settings (company_id)
SELECT DISTINCT id FROM companies
ON CONFLICT (company_id) DO NOTHING;

-- Инициализировать здоровье WhatsApp аккаунтов
INSERT INTO whatsapp_account_health
  (company_id, account_created_at, warmup_level)
SELECT
  id,
  created_at,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - created_at) > 90 THEN 'hot'
    WHEN EXTRACT(DAY FROM NOW() - created_at) > 30 THEN 'warm'
    ELSE 'cold'
  END
FROM companies
ON CONFLICT (company_id) DO NOTHING;
```

---

## 🔧 Компоненты Системы

### 1. Scheduler (`scheduler.js`)

**Ответственность**: Запуск ежедневной проверки

```javascript
const cron = require('node-cron');
const logger = require('../../utils/logger');
const InactivityDetector = require('./detectors/inactivity-detector');
const CampaignManager = require('./managers/campaign-manager');
const config = require('./config/defaults');

class ReactivationScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Запустить scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('⚠️ Reactivation scheduler is already running');
      return;
    }

    // Ежедневно в 10:00
    this.cronJob = cron.schedule(config.checkSchedule, async () => {
      await this.runDailyCheck();
    });

    logger.info('🚀 Reactivation scheduler started');
    this.isRunning = true;
  }

  /**
   * Остановить scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('🛑 Reactivation scheduler stopped');
  }

  /**
   * Запустить проверку вручную
   */
  async runDailyCheck() {
    try {
      logger.info('🔍 Starting daily reactivation check...');

      const startTime = Date.now();

      // 1. Найти неактивных клиентов
      const detector = new InactivityDetector();
      const eligibleClients = await detector.findEligibleClients();

      logger.info(`📋 Found ${eligibleClients.length} eligible clients for reactivation`);

      // 2. Запустить кампании
      const manager = new CampaignManager();
      const results = await manager.processBatch(eligibleClients);

      const duration = Date.now() - startTime;

      logger.info(`✅ Daily check completed in ${duration}ms`, {
        eligible: eligibleClients.length,
        sent: results.sent,
        skipped: results.skipped,
        failed: results.failed
      });

    } catch (error) {
      logger.error('❌ Error in daily reactivation check:', error);
    }
  }
}

module.exports = new ReactivationScheduler();
```

**Конфигурация**:
- Cron schedule: `'0 10 * * *'` (ежедневно в 10:00)
- Timeout: 30 минут
- Retry on failure: 3 раза с экспоненциальной задержкой

---

### 2. Inactivity Detector (`detectors/inactivity-detector.js`)

**Ответственность**: Поиск клиентов для реактивации

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');

class InactivityDetector {
  /**
   * Найти подходящих клиентов для реактивации
   *
   * @returns {Promise<Array>} Список клиентов с приоритетами
   */
  async findEligibleClients() {
    try {
      // 1. Получить все активные правила реактивации
      const { data: rules, error: rulesError } = await supabase
        .from('service_reactivation_rules')
        .select('*')
        .eq('is_active', true);

      if (rulesError) throw rulesError;

      logger.debug(`📋 Found ${rules.length} active reactivation rules`);

      const eligibleClients = [];

      // 2. Для каждого правила найти неактивных клиентов
      for (const rule of rules) {
        const clients = await this.findClientsForRule(rule);
        eligibleClients.push(...clients);
      }

      // 3. Удалить дубликаты (клиент может подходить под несколько услуг)
      const uniqueClients = this.deduplicateClients(eligibleClients);

      // 4. Применить фильтры
      const filtered = await this.applyFilters(uniqueClients);

      // 5. Приоритизировать
      const prioritized = this.prioritize(filtered);

      // 6. Применить дневной лимит
      const limited = await this.applyDailyLimit(prioritized);

      return limited;

    } catch (error) {
      logger.error('❌ Error finding eligible clients:', error);
      throw error;
    }
  }

  /**
   * Найти клиентов для конкретного правила
   */
  async findClientsForRule(rule) {
    const intervalDays = rule.reactivation_interval_days;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - intervalDays);

    // Получаем последние визиты клиентов по этой услуге
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        client_phone,
        client_id,
        client_name,
        datetime,
        service_ids,
        clients!inner (
          id,
          phone,
          name,
          visit_count,
          loyalty_level,
          total_spent,
          average_bill,
          last_visit_date,
          reactivation_opt_out,
          last_reactivation_sent,
          reactivation_attempts_count
        )
      `)
      .eq('company_id', rule.company_id)
      .contains('service_ids', [rule.service_id])
      .eq('status', 'completed')
      .order('datetime', { ascending: false });

    if (error) {
      logger.error(`Error querying bookings for rule ${rule.id}:`, error);
      return [];
    }

    // Группируем по клиентам и берем последний визит
    const clientMap = new Map();

    for (const booking of bookings) {
      const phone = booking.client_phone;

      if (!clientMap.has(phone)) {
        clientMap.set(phone, {
          client: booking.clients,
          lastVisit: booking.datetime,
          serviceId: rule.service_id,
          rule: rule
        });
      }
    }

    // Фильтруем по дате последнего визита
    const eligible = [];

    for (const [phone, data] of clientMap.entries()) {
      const lastVisitDate = new Date(data.lastVisit);

      if (lastVisitDate < thresholdDate) {
        const daysSinceVisit = Math.floor(
          (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        eligible.push({
          ...data,
          daysSinceVisit,
          phone
        });
      }
    }

    logger.debug(`📊 Rule ${rule.id}: found ${eligible.length} eligible clients`);

    return eligible;
  }

  /**
   * Удалить дубликаты клиентов
   * Если клиент подходит под несколько правил - выбираем с наибольшим приоритетом
   */
  deduplicateClients(clients) {
    const clientMap = new Map();

    for (const client of clients) {
      const phone = client.phone;

      if (!clientMap.has(phone)) {
        clientMap.set(phone, client);
      } else {
        // Если клиент уже есть, выбираем услугу с большим daysSinceVisit
        const existing = clientMap.get(phone);
        if (client.daysSinceVisit > existing.daysSinceVisit) {
          clientMap.set(phone, client);
        }
      }
    }

    return Array.from(clientMap.values());
  }

  /**
   * Применить фильтры
   */
  async applyFilters(clients) {
    return clients.filter(client => {
      // Фильтр 1: Не отказались от реактивации
      if (client.client.reactivation_opt_out) {
        logger.debug(`⏭️ Skipping ${client.phone}: opted out`);
        return false;
      }

      // Фильтр 2: Не отправляли недавно (минимум 7 дней между попытками)
      if (client.client.last_reactivation_sent) {
        const daysSinceLast = Math.floor(
          (Date.now() - new Date(client.client.last_reactivation_sent).getTime())
          / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLast < 7) {
          logger.debug(`⏭️ Skipping ${client.phone}: sent ${daysSinceLast} days ago`);
          return false;
        }
      }

      // Фильтр 3: Не превышен лимит попыток
      const maxAttempts = client.rule.max_attempts;
      if (client.client.reactivation_attempts_count >= maxAttempts) {
        logger.debug(`⏭️ Skipping ${client.phone}: max attempts reached`);
        return false;
      }

      // Фильтр 4: Есть телефон
      if (!client.phone || client.phone.length < 10) {
        return false;
      }

      return true;
    });
  }

  /**
   * Приоритизировать клиентов
   */
  prioritize(clients) {
    const weights = {
      loyaltyLevel: 0.4,
      totalSpent: 0.3,
      visitCount: 0.2,
      daysSince: 0.1
    };

    const loyaltyScores = {
      'VIP': 5,
      'Gold': 4,
      'Silver': 3,
      'Bronze': 2,
      'New': 1
    };

    return clients.map(client => {
      const score =
        (loyaltyScores[client.client.loyalty_level] || 1) * weights.loyaltyLevel +
        ((client.client.total_spent || 0) / 1000) * weights.totalSpent +
        ((client.client.visit_count || 0) * 2) * weights.visitCount +
        (client.daysSinceVisit / 10) * weights.daysSince;

      return {
        ...client,
        priorityScore: score
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Применить дневной лимит
   */
  async applyDailyLimit(clients) {
    // Получаем настройки для каждой компании
    const companiesSet = new Set(clients.map(c => c.rule.company_id));
    const limits = new Map();

    for (const companyId of companiesSet) {
      const { data: health } = await supabase
        .from('whatsapp_account_health')
        .select('daily_outbound_limit, current_daily_sent')
        .eq('company_id', companyId)
        .single();

      if (health) {
        const available = health.daily_outbound_limit - health.current_daily_sent;
        limits.set(companyId, available);
      }
    }

    // Группируем по компаниям и применяем лимиты
    const result = [];
    const byCompany = new Map();

    for (const client of clients) {
      const companyId = client.rule.company_id;
      if (!byCompany.has(companyId)) {
        byCompany.set(companyId, []);
      }
      byCompany.get(companyId).push(client);
    }

    for (const [companyId, companyClients] of byCompany.entries()) {
      const limit = limits.get(companyId) || 0;
      result.push(...companyClients.slice(0, limit));
    }

    logger.info(`📊 Applied daily limits: ${result.length} / ${clients.length} clients`);

    return result;
  }
}

module.exports = InactivityDetector;
```

**Логика работы**:
1. Получить все активные правила реактивации
2. Для каждого правила найти клиентов с last_visit > interval
3. Удалить дубликаты (один клиент может подходить под несколько услуг)
4. Применить фильтры (opt_out, recent attempts, max attempts)
5. Приоритизировать (VIP → Regular → New, по LTV)
6. Применить дневной лимит

---

*Продолжение следует...*

