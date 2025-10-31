# Client Reactivation System - Part 5: API, Configuration & Monitoring

## 📡 API Endpoints

### 1. Настройки Реактивации

#### GET `/api/reactivation/settings/:companyId`

Получить настройки системы реактивации для компании.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "tone": "friendly",
    "daily_limit_mode": "auto",
    "manual_daily_limit": null,
    "sending_hours": {
      "start": 10,
      "end": 19
    },
    "sending_days": [1, 2, 3, 4, 5],
    "include_slots_in_message": true,
    "max_slots_to_offer": 3,
    "prefer_favorite_staff": true,
    "notify_admin_on_low_conversion": true,
    "conversion_threshold": 0.15
  }
}
```

#### PUT `/api/reactivation/settings/:companyId`

Обновить настройки.

**Request Body:**
```json
{
  "enabled": true,
  "tone": "professional",
  "daily_limit_mode": "manual",
  "manual_daily_limit": 30,
  "sending_hours": {
    "start": 9,
    "end": 20
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

---

### 2. Правила Реактивации для Услуг

#### GET `/api/reactivation/service-rules/:companyId`

Получить правила для всех услуг компании.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "service_id": 123,
      "service_name": "Стрижка мужская",
      "reactivation_interval_days": 28,
      "retry_interval_days": 14,
      "max_attempts": 3,
      "discount_progression": [10, 15, 20],
      "is_active": true,
      "active_interval_source": "manual",
      "manual_interval": 28,
      "ai_suggested_interval": 30,
      "calculated_avg_interval": 26
    },
    {
      "service_id": 124,
      "service_name": "Чистка зубов",
      "reactivation_interval_days": 180,
      "retry_interval_days": 30,
      "max_attempts": 2,
      "discount_progression": [0, 10],
      "is_active": true,
      "active_interval_source": "ai",
      "manual_interval": null,
      "ai_suggested_interval": 180,
      "calculated_avg_interval": 175
    }
  ]
}
```

#### PUT `/api/reactivation/service-rules/:serviceId`

Обновить правило для услуги.

**Request Body:**
```json
{
  "reactivation_interval_days": 30,
  "retry_interval_days": 14,
  "max_attempts": 3,
  "discount_progression": [15, 20, 25],
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Service rule updated successfully"
}
```

#### POST `/api/reactivation/service-rules/:serviceId/calculate-optimal`

Запросить расчет оптимального интервала через AI.

**Response:**
```json
{
  "success": true,
  "data": {
    "current_interval": 30,
    "suggested_interval": 28,
    "confidence": 0.85,
    "reasoning": "На основе анализа 150 клиентов, средний интервал между визитами составляет 26-28 дней",
    "stats": {
      "total_clients_analyzed": 150,
      "avg_interval_days": 27,
      "std_deviation": 5.2
    }
  }
}
```

---

### 3. Статистика и Аналитика

#### GET `/api/reactivation/stats/:companyId`

Получить общую статистику реактивации.

**Query Parameters:**
- `period` - Период: 'week', 'month', 'quarter', 'year'
- `startDate` - Начальная дата (YYYY-MM-DD)
- `endDate` - Конечная дата (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "period": "month",
  "data": {
    "overview": {
      "total_sent": 450,
      "total_responses": 180,
      "total_bookings": 68,
      "conversion_rate": 0.151,
      "response_rate": 0.4,
      "avg_response_time_hours": 8.5,
      "avg_conversion_time_hours": 18.3
    },
    "by_attempt": [
      {
        "attempt_number": 1,
        "sent": 300,
        "responses": 150,
        "bookings": 50,
        "conversion_rate": 0.167
      },
      {
        "attempt_number": 2,
        "sent": 120,
        "responses": 25,
        "bookings": 15,
        "conversion_rate": 0.125
      },
      {
        "attempt_number": 3,
        "sent": 30,
        "responses": 5,
        "bookings": 3,
        "conversion_rate": 0.1
      }
    ],
    "by_service": [
      {
        "service_id": 123,
        "service_name": "Стрижка мужская",
        "sent": 200,
        "bookings": 35,
        "conversion_rate": 0.175
      },
      {
        "service_id": 125,
        "service_name": "Окрашивание",
        "sent": 150,
        "bookings": 20,
        "conversion_rate": 0.133
      }
    ],
    "best_times": {
      "hours": [
        { "hour": 10, "conversion_rate": 0.21 },
        { "hour": 14, "conversion_rate": 0.19 },
        { "hour": 18, "conversion_rate": 0.17 }
      ],
      "days": [
        { "day": 2, "name": "Вторник", "conversion_rate": 0.18 },
        { "day": 3, "name": "Среда", "conversion_rate": 0.16 },
        { "day": 4, "name": "Четверг", "conversion_rate": 0.15 }
      ]
    },
    "revenue": {
      "total_from_reactivation": 125000,
      "avg_booking_value": 1838,
      "roi": 3.5
    }
  }
}
```

#### GET `/api/reactivation/campaigns/:companyId`

Получить список кампаний.

**Query Parameters:**
- `page` - Номер страницы (default: 1)
- `limit` - Количество на странице (default: 20)
- `status` - Фильтр: 'active', 'completed', 'all'
- `response_type` - Фильтр: 'positive', 'negative', 'no_response', 'booking_created'

**Response:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "uuid-here",
        "client_phone": "79001234567",
        "client_name": "Иван Иванов",
        "service_name": "Стрижка",
        "attempt_number": 1,
        "sent_at": "2025-10-20T10:30:00Z",
        "response_type": "booking_created",
        "conversion_time_hours": 12,
        "discount_offered": 10,
        "booking_created": true
      }
    ],
    "pagination": {
      "total": 450,
      "page": 1,
      "limit": 20,
      "pages": 23
    }
  }
}
```

---

### 4. Управление Кампаниями

#### POST `/api/reactivation/campaigns/manual`

Запустить ручную кампанию реактивации для конкретного клиента.

**Request Body:**
```json
{
  "company_id": 962302,
  "client_phone": "79001234567",
  "service_id": 123,
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaign_id": "uuid-here",
    "message_sent": true,
    "message_text": "Иван, добрый день!..."
  }
}
```

#### POST `/api/reactivation/campaigns/:campaignId/cancel`

Отменить кампанию.

**Response:**
```json
{
  "success": true,
  "message": "Campaign cancelled successfully"
}
```

---

### 5. WhatsApp Account Health

#### GET `/api/reactivation/whatsapp-health/:companyId`

Получить состояние WhatsApp аккаунта.

**Response:**
```json
{
  "success": true,
  "data": {
    "account_age_days": 45,
    "warmup_level": "warm",
    "spam_score": 0.15,
    "limits": {
      "daily": 50,
      "hourly": 10,
      "concurrent": 5
    },
    "current_usage": {
      "daily_sent": 12,
      "hourly_sent": 3,
      "daily_remaining": 38,
      "hourly_remaining": 7
    },
    "last_incident": null,
    "ban_count": 0,
    "health_status": "healthy"
  }
}
```

#### POST `/api/reactivation/whatsapp-health/:companyId/reset-limits`

Сбросить лимиты (admin only).

**Response:**
```json
{
  "success": true,
  "message": "Limits reset successfully"
}
```

---

## ⚙️ Конфигурация

### Конфигурационный Файл (`config/reactivation-config.js`)

```javascript
module.exports = {
  // Основные настройки
  scheduler: {
    enabled: process.env.REACTIVATION_ENABLED !== 'false',
    cronSchedule: process.env.REACTIVATION_CRON || '0 10 * * *',  // Ежедневно в 10:00
    timezone: 'Europe/Moscow'
  },

  // Дефолтные интервалы по типам бизнеса
  defaultIntervals: {
    beauty: {
      haircut: 28,       // Стрижка
      coloring: 45,      // Окрашивание
      manicure: 21,      // Маникюр
      pedicure: 28,      // Педикюр
      massage: 14        // Массаж
    },
    barbershop: {
      haircut: 21,       // Стрижка
      beard: 14          // Борода
    },
    dental: {
      cleaning: 180,     // Чистка
      whitening: 180,    // Отбеливание
      checkup: 180       // Осмотр
    },
    fitness: {
      training: 7        // Тренировка
    }
  },

  // Дефолтные лимиты по warmup level
  defaultLimits: {
    cold: {
      daily: 20,
      hourly: 5,
      concurrent: 2,
      minInterval: 300000  // 5 минут между сообщениями
    },
    warm: {
      daily: 50,
      hourly: 10,
      concurrent: 5,
      minInterval: 120000  // 2 минуты
    },
    hot: {
      daily: 100,
      hourly: 20,
      concurrent: 10,
      minInterval: 30000   // 30 секунд
    }
  },

  // Параметры попыток
  attempts: {
    defaultMaxAttempts: 3,
    defaultRetryInterval: 14,  // дней
    waitForResponseDays: 7,    // дней ожидания ответа
    defaultDiscountProgression: [10, 15, 20]
  },

  // Приоритизация
  prioritization: {
    weights: {
      loyaltyLevel: 0.4,
      totalSpent: 0.3,
      visitCount: 0.2,
      daysSince: 0.1
    },
    loyaltyScores: {
      VIP: 5,
      Gold: 4,
      Silver: 3,
      Bronze: 2,
      New: 1
    }
  },

  // Безопасные часы и дни
  safeSending: {
    hours: {
      start: 10,
      end: 19
    },
    days: [1, 2, 3, 4, 5],  // Пн-Пт
    excludeHolidays: true
  },

  // AI генерация
  ai: {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
    temperature: 0.7,
    maxTokens: 500,
    timeout: 10000,  // 10 секунд
    fallbackToTemplate: true
  },

  // Слоты
  slots: {
    maxToOffer: 3,
    lookAheadDays: 7,
    preferFavoriteStaff: true,
    staffMatchWeight: 0.6,    // 60% вес на любимого мастера
    timeMatchWeight: 0.4      // 40% вес на время
  },

  // Мониторинг
  monitoring: {
    trackConversion: true,
    trackResponseTime: true,
    minConversionRate: 0.1,   // 10%
    alertOnLowConversion: true,
    alertThreshold: 0.08       // 8%
  },

  // Оптимизация
  optimization: {
    autoOptimizeIntervals: true,
    minDataPoints: 50,         // Минимум визитов для расчета
    updateFrequencyDays: 30,   // Обновлять каждые 30 дней
    aiSuggestions: true
  }
};
```

### Environment Variables

```bash
# Основные
REACTIVATION_ENABLED=true
REACTIVATION_CRON="0 10 * * *"

# AI
GEMINI_API_KEY=your-api-key-here
SOCKS_PROXY=socks5://127.0.0.1:1080

# Лимиты (опционально, переопределяют дефолты)
REACTIVATION_DAILY_LIMIT=50
REACTIVATION_HOURLY_LIMIT=10

# Мониторинг
REACTIVATION_ALERT_TELEGRAM_CHAT="-1001234567890"
REACTIVATION_MIN_CONVERSION_RATE=0.1

# Дебаг
REACTIVATION_DEBUG=false
```

---

## 📊 Monitoring & Analytics

### 1. Conversion Analyzer (`analyzers/conversion-analyzer.js`)

```javascript
const { supabase } = require('../../../database/supabase');
const logger = require('../../../utils/logger');

class ConversionAnalyzer {
  /**
   * Анализировать конверсию реактивации
   */
  async analyzeConversion(companyId, period = 'month') {
    try {
      const dateRange = this.getDateRange(period);

      // 1. Общая статистика
      const overview = await this.getOverviewStats(companyId, dateRange);

      // 2. По попыткам
      const byAttempt = await this.getStatsByAttempt(companyId, dateRange);

      // 3. По услугам
      const byService = await this.getStatsByService(companyId, dateRange);

      // 4. Лучшее время отправки
      const bestTimes = await this.analyzeBestTimes(companyId, dateRange);

      // 5. ROI
      const revenue = await this.calculateRevenue(companyId, dateRange);

      return {
        period,
        dateRange,
        overview,
        byAttempt,
        byService,
        bestTimes,
        revenue
      };

    } catch (error) {
      logger.error('❌ Error analyzing conversion:', error);
      throw error;
    }
  }

  /**
   * Получить общую статистику
   */
  async getOverviewStats(companyId, dateRange) {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .eq('company_id', companyId)
      .gte('sent_at', dateRange.start)
      .lte('sent_at', dateRange.end);

    if (error) throw error;

    const totalSent = data.length;
    const totalResponses = data.filter(c => c.response_received_at).length;
    const totalBookings = data.filter(c => c.booking_created).length;

    const responseTimes = data
      .filter(c => c.response_time_hours)
      .map(c => c.response_time_hours);

    const conversionTimes = data
      .filter(c => c.conversion_time_hours)
      .map(c => c.conversion_time_hours);

    return {
      total_sent: totalSent,
      total_responses: totalResponses,
      total_bookings: totalBookings,
      conversion_rate: totalSent > 0 ? totalBookings / totalSent : 0,
      response_rate: totalSent > 0 ? totalResponses / totalSent : 0,
      avg_response_time_hours: this.average(responseTimes),
      avg_conversion_time_hours: this.average(conversionTimes)
    };
  }

  /**
   * Статистика по попыткам
   */
  async getStatsByAttempt(companyId, dateRange) {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('attempt_number, booking_created, response_received_at')
      .eq('company_id', companyId)
      .gte('sent_at', dateRange.start)
      .lte('sent_at', dateRange.end);

    if (error) throw error;

    // Группируем по attempt_number
    const grouped = {};

    for (const campaign of data) {
      const attempt = campaign.attempt_number;

      if (!grouped[attempt]) {
        grouped[attempt] = {
          sent: 0,
          responses: 0,
          bookings: 0
        };
      }

      grouped[attempt].sent++;

      if (campaign.response_received_at) {
        grouped[attempt].responses++;
      }

      if (campaign.booking_created) {
        grouped[attempt].bookings++;
      }
    }

    // Преобразуем в массив
    return Object.entries(grouped).map(([attempt, stats]) => ({
      attempt_number: parseInt(attempt),
      sent: stats.sent,
      responses: stats.responses,
      bookings: stats.bookings,
      conversion_rate: stats.sent > 0 ? stats.bookings / stats.sent : 0
    })).sort((a, b) => a.attempt_number - b.attempt_number);
  }

  /**
   * Анализ лучшего времени отправки
   */
  async analyzeBestTimes(companyId, dateRange) {
    const { data, error } = await supabase
      .from('reactivation_campaigns')
      .select('sent_at, booking_created')
      .eq('company_id', companyId)
      .gte('sent_at', dateRange.start)
      .lte('sent_at', dateRange.end);

    if (error) throw error;

    // По часам
    const byHour = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = { sent: 0, bookings: 0 };
    }

    // По дням недели
    const byDay = {};
    for (let d = 0; d < 7; d++) {
      byDay[d] = { sent: 0, bookings: 0 };
    }

    for (const campaign of data) {
      const date = new Date(campaign.sent_at);
      const hour = date.getHours();
      const day = date.getDay();

      byHour[hour].sent++;
      byDay[day].sent++;

      if (campaign.booking_created) {
        byHour[hour].bookings++;
        byDay[day].bookings++;
      }
    }

    // Топ-3 часа
    const topHours = Object.entries(byHour)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        conversion_rate: stats.sent > 0 ? stats.bookings / stats.sent : 0,
        ...stats
      }))
      .filter(h => h.sent >= 5)  // Минимум 5 отправок
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, 3);

    // Топ-3 дня
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

    const topDays = Object.entries(byDay)
      .map(([day, stats]) => ({
        day: parseInt(day),
        name: dayNames[day],
        conversion_rate: stats.sent > 0 ? stats.bookings / stats.sent : 0,
        ...stats
      }))
      .filter(d => d.sent >= 5)
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, 3);

    return {
      hours: topHours,
      days: topDays
    };
  }

  /**
   * Рассчитать revenue
   */
  async calculateRevenue(companyId, dateRange) {
    // Получаем кампании с созданными записями
    const { data: campaigns, error } = await supabase
      .from('reactivation_campaigns')
      .select('booking_id')
      .eq('company_id', companyId)
      .eq('booking_created', true)
      .gte('sent_at', dateRange.start)
      .lte('sent_at', dateRange.end);

    if (error) throw error;

    if (!campaigns || campaigns.length === 0) {
      return {
        total_from_reactivation: 0,
        avg_booking_value: 0,
        roi: 0
      };
    }

    // Получаем стоимость записей
    const bookingIds = campaigns.map(c => c.booking_id);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('cost')
      .in('id', bookingIds);

    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.cost || 0), 0) || 0;
    const avgValue = bookings?.length > 0 ? totalRevenue / bookings.length : 0;

    // Примерная стоимость реактивации (AI calls + время)
    const estimatedCost = campaigns.length * 5;  // ~5 руб за кампанию

    const roi = estimatedCost > 0 ? totalRevenue / estimatedCost : 0;

    return {
      total_from_reactivation: totalRevenue,
      avg_booking_value: Math.round(avgValue),
      roi: Math.round(roi * 10) / 10
    };
  }

  /**
   * Среднее значение
   */
  average(arr) {
    if (!arr || arr.length === 0) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  }

  /**
   * Получить диапазон дат
   */
  getDateRange(period) {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }
}

module.exports = new ConversionAnalyzer();
```

---

*Продолжение в Part 6: Testing & Implementation Guide...*
