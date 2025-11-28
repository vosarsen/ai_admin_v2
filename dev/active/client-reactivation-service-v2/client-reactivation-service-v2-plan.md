# Client Reactivation Service v2 - Strategic Plan (REVIEWED)

**Last Updated:** 2025-11-26 (After Plan Review - All Fixes Applied)
**Status:** 📋 Ready for Implementation (APPROVED WITH CHANGES)
**Timeline:** 4-5 days (revised from 3 days after review)
**Complexity:** Low-Medium (reduced scope)
**Risk Level:** 🟢 Low
**Version:** 2.2 (Post-Review)
**Review Score:** 7.5/10

---

## 🔴 PLAN REVIEW SUMMARY (2025-11-26)

### Verdict: APPROVE WITH CHANGES

### Critical Fixes Applied:
1. **MessageGenerator API** - Fixed to use `providerFactory.getProvider()` + `provider.call()`
2. **ReactivationRepository** - Changed to raw SQL (no `create`/`update` in BaseRepository)
3. **Industry Standard SQL** - Fixed `ILIKE ANY` to `EXISTS` subquery
4. **Sentry Tracking** - Added to all new services (project standard)
5. **Phone Normalization** - Added `InternationalPhone.normalize()` (project standard)

### Timeline Adjustment:
| Phase | Before Review | After Review |
|-------|---------------|--------------|
| Day 2 | 6h | **8h** (+API/SQL fixes) |
| Day 3 | 6h | **8-10h** (+Sentry, phone norm) |
| Buffer | 0.5d | **1d** |
| **Total** | 3 days | **4-5 days** |

---

## 🚨 CRITICAL UPDATE: 2025-11-26 Codebase Review

### Key Discoveries
1. **appointments_cache is EMPTY!** (0 rows) - Level 2 calculations impossible
2. **Supabase fully removed** - Clean PostgreSQL-only codebase
3. **pendingAction pattern exists** - Already used for cancellation flows
4. **clients table has rich data** - 1286 clients with last_services, last_visit_date

### Plan Simplifications
| Original | Post-Discovery | Post-Review |
|----------|----------------|-------------|
| 4 tables | 2 tables | 2 tables |
| 3-level waterfall | 2-level | 2-level |
| 4 days | 3 days | **4-5 days** |
| Complex SQL | Simple queries | **Fixed SQL** |

### Deferred to Month 2
- Level 2 (Service Average) - requires populating appointments_cache
- Level 1 (Personalized) - requires more historical data

---

## 📋 Executive Summary

### Mission
Build an intelligent, AI-powered client reactivation system that automatically identifies inactive clients, sends personalized WhatsApp messages, and **seamlessly integrates with AI Admin v2's Redis context system** to handle responses and track conversions end-to-end.

### Why v2?
This is version 2 of the plan, updated to reflect:
- ✅ **Complete migration to Timeweb PostgreSQL** (November 2025)
- ✅ **Repository pattern already implemented** (ClientRepository, BaseRepository)
- ✅ **Critical Redis context integration** (user-identified requirement)
- ✅ **Simplified 3-level waterfall** (vs original 4-level)

### Key Innovation: Redis Context Integration
**CRITICAL DIFFERENCE from v1:** When a client responds to a reactivation message, AI Admin v2 will:
1. Load `pendingAction` from Redis
2. Understand this is a reactivation response
3. Use suggested service from context
4. Track conversion end-to-end

Without this integration, AI Admin would treat responses as random messages and lose context.

### Success Metrics
- **Conversion Rate:** 15-20% of contacted clients book within 7 days
- **Context Recognition:** 100% of responses correctly identified by AI Admin
- **Timing Accuracy:** 80%+ messages sent within ±5 days of optimal interval
- **System Stability:** Zero crashes in first week

---

## 🔍 Current State Analysis

### What We Have ✅

**Infrastructure (November 2025):**
- ✅ Timeweb PostgreSQL operational (migration complete)
- ✅ Repository pattern implemented (BaseRepository, ClientRepository)
- ✅ Redis Context Service V2 with pendingAction support
- ✅ AI Admin v2 with context-aware message processing
- ✅ WhatsApp Baileys integration stable
- ✅ Gemini Flash API for AI message generation
- ✅ PM2 ecosystem for background workers
- ✅ 98.8% test coverage (165/167 tests passing)

**Database Tables (Existing):**
- ✅ `clients` - visit_count, last_visit_date, last_services, favorite_staff_ids
- ✅ `services` - all company services
- ✅ `staff` - staff information
- ✅ `bookings` - current/upcoming bookings
- ✅ `appointments_cache` - **needs verification!** (critical for historical data)

**Redis Context Structure:**
```
dialog:{companyId}:{phone}       # Current dialog state + selection
messages:{companyId}:{phone}     # Message history (last 50)
client:{companyId}:{phone}       # Cached client data
preferences:{companyId}:{phone}  # Long-term preferences
processing:{companyId}:{phone}   # Processing status
```

### What's Missing ❌

**Database Tables (New):**
- ❌ `service_reactivation_intervals` - Company-specific service averages
- ❌ `industry_standard_intervals` - Pre-seeded global standards (15+ services)
- ❌ `client_reactivation_history` - Campaign tracking with response/booking status
- ❌ `client_personalized_intervals` - Schema only (not used in MVP)

**Service Layer:**
- ❌ ReactivationRepository - Data access with Redis integration
- ❌ IntervalSelector - 3-level waterfall logic
- ❌ MessageGenerator - Gemini + fallback templates
- ❌ ClientReactivationService - Main orchestrator with Redis save
- ❌ ReactivationHandler - AI Admin integration for response detection

**Background Jobs:**
- ❌ Weekly service average calculation
- ❌ Daily reactivation campaign runner (PM2 worker)

---

## 🎯 Proposed Architecture

### 3-Level Interval Selection Waterfall

```
┌─────────────────────────────────────────┐
│  КЛИЕНТ с последней услугой              │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────────────────────────┐
    │ Level 2: Service Average         │ ← 60-70% клиентов
    │ (Компания-специфичные паттерны)  │
    │ Accuracy: 80-85%                 │
    │ SQL: median_interval_days        │
    └──────────┬──────────────────────┘
               │ Нет данных (< 10 bookings)
               ▼
    ┌─────────────────────────────────┐
    │ Level 3: Industry Standard       │ ← 20-25% клиентов
    │ (Отраслевые best practices)      │
    │ Accuracy: 75-80%                 │
    │ Match: keyword matching          │
    └──────────┬──────────────────────┘
               │ Не найдено соответствие
               ▼
    ┌─────────────────────────────────┐
    │ Level 4: Universal Fallback      │ ← 5-10% клиентов
    │ (30/60/90 дней)                  │
    │ Accuracy: 60-70%                 │
    │ Logic: based on days_inactive    │
    └─────────────────────────────────┘
               │
               └─► ВСЕГДА РАБОТАЕТ ✅
```

**Why 3-Level (not 4-Level)?**
- Level 1 (Personalized): Only 10-15% coverage, requires 3-4 days development
- Level 2 (Service Average): 60-70% coverage, 1 day development ✅
- **Decision:** Ship Level 2-4 in MVP (3 days), add Level 1 in Month 2 if ROI justifies

### Redis Context Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: REACTIVATION SERVICE                               │
│  - Finds inactive clients (30/60/90 days)                   │
│  - Generates AI message via Gemini                          │
│  - Sends WhatsApp message                                   │
│  - 🔥 SAVES pendingAction to Redis:                        │
│    {                                                         │
│      type: 'reactivation_response',                         │
│      campaign: 'dormant_30',                                │
│      suggestedService: { id: 123, name: 'Стрижка' },       │
│      daysInactive: 35,                                      │
│      messageSent: "Привет! Давно не виделись...",          │
│      messageSentAt: "2025-11-12T10:00:00Z"                 │
│    }                                                         │
│  - Saves to client_reactivation_history                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    [Client responds 24-72h later]
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: CLIENT RESPONDS                                    │
│  WhatsApp: "Да, хочу записаться на завтра"                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: AI ADMIN MESSAGE PROCESSOR                         │
│  1. Loads dialog context from Redis                         │
│  2. 🔥 Detects pendingAction.type === 'reactivation_response' │
│  3. Calls ReactivationHandler.handleReactivationResponse()  │
│  4. Classifies response: 'positive' / 'negative' / 'neutral'│
│  5. Enriches AI prompt with context:                        │
│     "✅ Клиент не был 35 дней, последняя услуга: Стрижка"  │
│     "КЛИЕНТ ЗАИНТЕРЕСОВАН! Начни процесс бронирования"     │
│  6. Updates response_received = TRUE in history              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: AI GENERATES CONTEXTUAL RESPONSE                   │
│  "Отлично! Записываю вас на стрижку.                       │
│   Какое время удобно: 14:00, 16:00 или 18:00?"            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: CLIENT COMPLETES BOOKING                           │
│  "16:00 подойдет"                                          │
│  → CREATE_BOOKING command executed                          │
│  → 🔥 ReactivationHandler.markBookingCreated()             │
│  → Updates booking_created = TRUE, booking_id = 12345       │
│  → Clears pendingAction from Redis                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
                       ✅ CONVERSION TRACKED!
```

---

## 📐 Implementation Phases

### Phase 1: Database Foundation (Day 1, 6-8 hours)

**Goal:** All tables created, indexes optimized, seed data loaded, SQL functions ready

#### 1.1 Verify appointments_cache Table
**CRITICAL:** Plan reviewer flagged this table might not exist

```sql
-- Check existence
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_name = 'appointments_cache';
```

**If NOT exists:**
- Create table schema
- Populate from `bookings` table + YClients historical sync
- **Add 1 day to timeline**

**If exists:**
- Verify columns: `client_id`, `service_ids`, `appointment_datetime`, `attendance`, `company_id`
- Check data: at least 6 months history

#### 1.2 Create New Tables (4 tables)

**service_reactivation_intervals** (Level 2 - Company patterns)
```sql
CREATE TABLE service_reactivation_intervals (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,

  -- Statistics (prefer median!)
  median_interval_days INTEGER NOT NULL,
  avg_interval_days INTEGER,
  min_interval_days INTEGER,
  max_interval_days INTEGER,
  stddev_days DECIMAL(5,2),
  sample_size INTEGER NOT NULL,  -- Minimum 10 for validity

  -- Metadata
  last_calculated TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  UNIQUE(company_id, service_id)
);

CREATE INDEX idx_service_intervals_lookup
ON service_reactivation_intervals(company_id, service_id, is_active);
```

**industry_standard_intervals** (Level 3 - Global standards)
```sql
CREATE TABLE industry_standard_intervals (
  id SERIAL PRIMARY KEY,
  category_key TEXT UNIQUE NOT NULL,
  category_name TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  min_days INTEGER,
  max_days INTEGER,

  -- For matching service names
  keywords TEXT[] NOT NULL,
  service_type TEXT,  -- 'hair', 'nails', 'beauty', etc.

  confidence_score DECIMAL(3,2) DEFAULT 0.75,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_industry_keywords
ON industry_standard_intervals USING GIN(keywords);
```

**Seed Data (15+ industry standards):**
```sql
INSERT INTO industry_standard_intervals
(category_key, category_name, interval_days, min_days, max_days, keywords, service_type) VALUES
('haircut_male', 'Мужская стрижка', 28, 21, 35, ARRAY['стрижка', 'мужская', 'мужск'], 'hair'),
('haircut_female', 'Женская стрижка', 40, 35, 50, ARRAY['стрижка', 'женская', 'женск'], 'hair'),
('coloring', 'Окрашивание волос', 50, 40, 70, ARRAY['окрашивание', 'цвет', 'краска'], 'hair'),
('manicure_gel', 'Маникюр гель-лак', 21, 14, 28, ARRAY['маникюр', 'гель'], 'nails'),
('manicure_regular', 'Обычный маникюр', 14, 10, 21, ARRAY['маникюр', 'обычный', 'классический'], 'nails'),
('pedicure', 'Педикюр', 30, 21, 40, ARRAY['педикюр'], 'nails'),
('beard', 'Стрижка бороды', 21, 14, 28, ARRAY['борода', 'бород'], 'hair'),
('facial', 'Чистка лица', 28, 21, 35, ARRAY['чистка', 'лицо', 'лица'], 'beauty'),
('massage_face', 'Массаж лица', 14, 7, 21, ARRAY['массаж', 'лица'], 'beauty'),
('peeling', 'Пилинг', 21, 14, 28, ARRAY['пилинг'], 'beauty'),
('epilation_legs', 'Эпиляция ног', 35, 28, 45, ARRAY['эпиляция', 'ноги', 'ног'], 'beauty'),
('epilation_bikini', 'Эпиляция бикини', 28, 21, 35, ARRAY['эпиляция', 'бикини'], 'beauty'),
('epilation_underarms', 'Эпиляция подмышек', 21, 14, 28, ARRAY['эпиляция', 'подмышки', 'подмышек'], 'beauty'),
('balayage', 'Балаяж', 90, 70, 120, ARRAY['балаяж'], 'hair'),
('hair_extensions', 'Наращивание волос', 60, 45, 90, ARRAY['наращивание', 'волос'], 'hair'),
('botox_hair', 'Ботокс для волос', 45, 30, 60, ARRAY['ботокс', 'волос'], 'hair');
```

**client_reactivation_history** (Audit log + Analytics)
```sql
CREATE TABLE client_reactivation_history (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  phone TEXT NOT NULL,

  -- Message details
  message_sent_at TIMESTAMP DEFAULT NOW(),
  message_text TEXT NOT NULL,

  -- Last service context
  last_service_id INTEGER,
  last_service_name TEXT,
  inactive_days INTEGER NOT NULL,
  last_visit_date DATE,

  -- Interval metadata
  interval_days INTEGER NOT NULL,
  interval_source TEXT NOT NULL,  -- 'service_average', 'industry_standard', 'universal'
  confidence_score DECIMAL(3,2),

  -- 🔥 Response tracking (NEW!)
  response_received BOOLEAN DEFAULT FALSE,
  response_at TIMESTAMP,
  response_type TEXT,  -- 'positive', 'negative', 'neutral'
  response_text TEXT,

  -- 🔥 Booking tracking (NEW!)
  booking_created BOOLEAN DEFAULT FALSE,
  booking_id BIGINT,
  booking_created_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Critical indexes for performance
CREATE INDEX idx_reactivation_phone ON client_reactivation_history(phone);
CREATE INDEX idx_reactivation_company ON client_reactivation_history(company_id);
CREATE INDEX idx_reactivation_client ON client_reactivation_history(client_id);
CREATE INDEX idx_reactivation_status ON client_reactivation_history(
  response_received, booking_created, message_sent_at DESC
);
CREATE INDEX idx_reactivation_dates ON client_reactivation_history(
  message_sent_at, response_at, booking_created_at
);
```

**client_personalized_intervals** (Schema only - NOT used in MVP)
```sql
CREATE TABLE client_personalized_intervals (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  service_id INTEGER NOT NULL,
  personal_interval_days INTEGER NOT NULL,
  visit_count INTEGER NOT NULL,
  consistency_score DECIMAL(3,2),
  last_calculated TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, client_id, service_id)
);

-- Note: Table created for future (Month 2), but not populated in MVP
```

#### 1.3 SQL Function: Calculate Service Averages

```sql
CREATE OR REPLACE FUNCTION calculate_service_averages(p_company_id BIGINT)
RETURNS TABLE(
  service_id INTEGER,
  service_name TEXT,
  median_interval INTEGER,
  sample_size INTEGER,
  avg_interval INTEGER,
  min_interval INTEGER,
  max_interval INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH service_intervals AS (
    SELECT
      unnest(ac1.service_ids) as sid,
      ac1.client_id,
      ac1.appointment_datetime,
      LEAD(ac1.appointment_datetime) OVER (
        PARTITION BY ac1.client_id, unnest(ac1.service_ids)
        ORDER BY ac1.appointment_datetime
      ) as next_visit
    FROM appointments_cache ac1
    WHERE ac1.company_id = p_company_id
      AND ac1.attendance = 1  -- Only completed visits
      AND ac1.appointment_datetime >= NOW() - INTERVAL '6 months'
  ),
  interval_calculations AS (
    SELECT
      si.sid,
      EXTRACT(EPOCH FROM (si.next_visit - si.appointment_datetime)) / 86400 as days_between
    FROM service_intervals si
    WHERE si.next_visit IS NOT NULL
      AND EXTRACT(EPOCH FROM (si.next_visit - si.appointment_datetime)) / 86400 BETWEEN 1 AND 365
  )
  SELECT
    ic.sid::INTEGER,
    s.title as service_name,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ic.days_between)::INTEGER as median_interval,
    COUNT(*)::INTEGER as sample_size,
    AVG(ic.days_between)::INTEGER as avg_interval,
    MIN(ic.days_between)::INTEGER as min_interval,
    MAX(ic.days_between)::INTEGER as max_interval
  FROM interval_calculations ic
  JOIN services s ON s.yclients_id = ic.sid
  WHERE s.company_id = p_company_id
  GROUP BY ic.sid, s.title
  HAVING COUNT(*) >= 10;  -- Minimum 10 visits for statistical validity
END;
$$ LANGUAGE plpgsql;
```

#### 1.4 Acceptance Criteria Day 1

- [ ] `appointments_cache` table exists and has 6+ months data
- [ ] All 4 new tables created successfully
- [ ] 15+ industry standards seeded
- [ ] SQL function `calculate_service_averages()` returns results
- [ ] All indexes created (query performance < 100ms)
- [ ] Migration tested on local Timeweb instance
- [ ] Migration applied to production Timeweb

**Files Created:**
- `migrations/20251112_reactivation_mvp_schema.sql`
- `scripts/test-reactivation-schema.js`

---

### Phase 2: Core Logic (Day 2, 6-8 hours)

**Goal:** Interval selector + Message generator working with full test coverage

#### 2.1 ReactivationRepository

```javascript
// src/repositories/ReactivationRepository.js
const BaseRepository = require('./BaseRepository');
const logger = require('../utils/logger').child({ module: 'reactivation-repo' });

class ReactivationRepository extends BaseRepository {
  /**
   * Find inactive clients for reactivation
   */
  async findInactiveClients(companyId, daysThreshold, limit = 100) {
    const sql = `
      SELECT c.*,
        CURRENT_DATE - c.last_visit_date as days_inactive
      FROM clients c
      WHERE c.company_id = $1
        AND c.last_visit_date < CURRENT_DATE - INTERVAL '1 day' * $2
        AND c.blacklisted = FALSE
        AND c.visit_count > 0
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.client_phone = c.phone
            AND b.datetime > CURRENT_DATE
            AND b.status != 'deleted'
        )
        AND NOT EXISTS (
          SELECT 1 FROM client_reactivation_history crh
          WHERE crh.client_id = c.id
            AND crh.message_sent_at > CURRENT_DATE - INTERVAL '7 days'
        )
      ORDER BY c.total_spent DESC, c.last_visit_date ASC
      LIMIT $3
    `;

    return this.queryMany(sql, [companyId, daysThreshold, limit]);
  }

  /**
   * Get service average interval
   */
  async getServiceAverage(companyId, serviceId) {
    const sql = `
      SELECT * FROM service_reactivation_intervals
      WHERE company_id = $1
        AND service_id = $2
        AND is_active = TRUE
        AND sample_size >= 10
    `;

    return this.queryOne(sql, [companyId, serviceId]);
  }

  /**
   * Match service to industry standard by keywords
   */
  async matchIndustryStandard(serviceName) {
    const sql = `
      SELECT * FROM industry_standard_intervals
      WHERE $1 ILIKE ANY(
        SELECT '%' || keyword || '%'
        FROM unnest(keywords) AS keyword
      )
      ORDER BY confidence_score DESC
      LIMIT 1
    `;

    return this.queryOne(sql, [serviceName.toLowerCase()]);
  }

  /**
   * Save reactivation record
   */
  async saveReactivationRecord(data) {
    const result = await this.create('client_reactivation_history', data);
    return result.id;
  }

  /**
   * Update response received
   */
  async updateReactivationResponse(historyId, responseType, responseText) {
    return this.update('client_reactivation_history', historyId, {
      response_received: true,
      response_at: new Date(),
      response_type: responseType,
      response_text: responseText,
      updated_at: new Date()
    });
  }

  /**
   * Update booking created
   */
  async updateReactivationBooking(historyId, bookingId) {
    return this.update('client_reactivation_history', historyId, {
      booking_created: true,
      booking_id: bookingId,
      booking_created_at: new Date(),
      updated_at: new Date()
    });
  }

  /**
   * Check if client was contacted recently
   */
  async checkContactedToday(clientId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sql = `
      SELECT COUNT(*) as count
      FROM client_reactivation_history
      WHERE client_id = $1
        AND message_sent_at >= $2
    `;

    const result = await this.queryOne(sql, [clientId, todayStart]);
    return result && result.count > 0;
  }

  /**
   * Get conversion statistics
   */
  async getConversionStats(companyId, dateFrom, dateTo) {
    const sql = `
      SELECT
        campaign_type,
        COUNT(*) as total_sent,
        COUNT(CASE WHEN response_received THEN 1 END) as responses,
        COUNT(CASE WHEN response_type = 'positive' THEN 1 END) as positive_responses,
        COUNT(CASE WHEN booking_created THEN 1 END) as bookings_created,
        ROUND(100.0 * COUNT(CASE WHEN response_received THEN 1 END) / COUNT(*), 2) as response_rate,
        ROUND(100.0 * COUNT(CASE WHEN booking_created THEN 1 END) / COUNT(*), 2) as conversion_rate
      FROM (
        SELECT *,
          CASE
            WHEN inactive_days < 45 THEN 'dormant_30'
            WHEN inactive_days < 75 THEN 'dormant_60'
            ELSE 'dormant_90'
          END as campaign_type
        FROM client_reactivation_history
        WHERE company_id = $1
          AND message_sent_at >= $2
          AND message_sent_at < $3
      ) campaigns
      GROUP BY campaign_type
      ORDER BY campaign_type
    `;

    return this.queryMany(sql, [companyId, dateFrom, dateTo]);
  }
}

module.exports = ReactivationRepository;
```

#### 2.2 IntervalSelector (3-Level Waterfall)

```javascript
// src/services/client-reactivation/interval-selector.js
const logger = require('../../utils/logger').child({ module: 'interval-selector' });

class IntervalSelector {
  constructor(reactivationRepo) {
    this.repo = reactivationRepo;
  }

  /**
   * Main waterfall: Level 2 → Level 3 → Level 4
   */
  async selectOptimalInterval(client, lastService) {
    if (!client || !lastService) {
      logger.warn('Missing client or lastService, using universal fallback');
      return this.getUniversalFallback(client);
    }

    // Level 2: Service Average (company-specific)
    try {
      const serviceAvg = await this.tryServiceAverageInterval(client, lastService);
      if (serviceAvg) return serviceAvg;
    } catch (error) {
      logger.error('Level 2 failed:', error);
    }

    // Level 3: Industry Standard
    try {
      const industry = await this.tryIndustryStandardInterval(lastService);
      if (industry) return industry;
    } catch (error) {
      logger.error('Level 3 failed:', error);
    }

    // Level 4: Universal Fallback (always works)
    return this.getUniversalFallback(client, lastService);
  }

  /**
   * Level 2: Service Average
   */
  async tryServiceAverageInterval(client, lastService) {
    const serviceAvg = await this.repo.getServiceAverage(
      client.company_id,
      lastService.service_id
    );

    if (serviceAvg && serviceAvg.sample_size >= 10) {
      logger.info(`✅ Level 2: Service average found (${serviceAvg.sample_size} samples)`);
      return {
        interval: serviceAvg.median_interval_days,
        source: 'service_average',
        confidence: 0.85,
        metadata: {
          sampleSize: serviceAvg.sample_size,
          serviceName: serviceAvg.service_name
        }
      };
    }

    logger.debug('Level 2: No service average (insufficient data)');
    return null;
  }

  /**
   * Level 3: Industry Standard
   */
  async tryIndustryStandardInterval(lastService) {
    const industry = await this.repo.matchIndustryStandard(lastService.name);

    if (industry) {
      logger.info(`✅ Level 3: Industry standard matched (${industry.category_name})`);
      return {
        interval: industry.interval_days,
        source: 'industry_standard',
        confidence: industry.confidence_score || 0.75,
        metadata: {
          category: industry.category_name,
          serviceType: industry.service_type
        }
      };
    }

    logger.debug('Level 3: No industry standard match');
    return null;
  }

  /**
   * Level 4: Universal Fallback (30/60/90 days)
   */
  getUniversalFallback(client, lastService) {
    const daysSince = client?.days_inactive || 30;

    let interval;
    if (daysSince < 45) {
      interval = 30;
    } else if (daysSince < 75) {
      interval = 60;
    } else {
      interval = 90;
    }

    logger.info(`✅ Level 4: Universal fallback (${interval} days)`);

    return {
      interval,
      source: 'universal',
      confidence: 0.60,
      metadata: {
        daysInactive: daysSince,
        rule: `${daysSince} < 45 ? 30 : (< 75 ? 60 : 90)`
      }
    };
  }
}

module.exports = IntervalSelector;
```

#### 2.3 MessageGenerator (Gemini + Fallback)

```javascript
// src/services/client-reactivation/message-generator.js
const { createProvider } = require('../ai/provider-factory');
const logger = require('../../utils/logger').child({ module: 'message-generator' });

class ReactivationMessageGenerator {
  constructor() {
    this.rateLimitDelay = 4000; // 4 seconds (15 req/min)
  }

  async generateMessage(clientData) {
    const { name, daysInactive, lastService } = clientData;

    try {
      // Try Gemini AI generation
      const provider = createProvider('gemini-flash');
      const prompt = this._buildPrompt(clientData);

      logger.info('Generating AI message for client', { name, daysInactive });

      const message = await provider.generateText(prompt);

      // Rate limiting
      await this._delay(this.rateLimitDelay);

      logger.info('✅ AI message generated successfully');
      return message.trim();

    } catch (error) {
      logger.warn('AI generation failed, using fallback template', { error: error.message });
      return this._getFallbackTemplate(clientData);
    }
  }

  _buildPrompt(clientData) {
    const { name, daysInactive, lastService } = clientData;

    let messageType, instructions;

    if (daysInactive < 45) {
      messageType = 'gentle';
      instructions = `Тон: лёгкий, дружелюбный, не навязчивый.
Длина: до 150 символов.
Избегай слов "скучаем", "ждём" (слишком пафосно).`;
    } else if (daysInactive < 75) {
      messageType = 'offer';
      instructions = `Тон: дружелюбный, с акцентом на выгоду.
Длина: до 200 символов.
Упомяни специальное предложение или скидку 10%.`;
    } else {
      messageType = 'win_back';
      instructions = `Тон: искренний, заботливый, персональный.
Длина: до 250 символов.
Предложи скидку 20% как знак признательности.`;
    }

    return `Создай персональное WhatsApp сообщение для клиента салона красоты.

Клиент: ${name}
Не был: ${daysInactive} дней
Последняя услуга: ${lastService || 'не указана'}

Тип сообщения: ${messageType}

${instructions}

Важно:
- Используй имя клиента
- Будь естественным, как человек
- Не используй emoji (максимум 1-2)
- Закончи вопросом о записи

Только текст сообщения, без пояснений:`;
  }

  _getFallbackTemplate(clientData) {
    const { name, daysInactive, lastService } = clientData;

    if (daysInactive < 45) {
      return `Привет, ${name}! Давно не виделись 😊 Хотите снова записаться${lastService ? ` на ${lastService}` : ''}?`;
    } else if (daysInactive < 75) {
      return `${name}, мы помним о вас! Специально для вас скидка 10%${lastService ? ` на ${lastService}` : ''} 🎁 Записать вас?`;
    } else {
      return `${name}, мы очень ценим вас как клиента! Возвращайтесь, дарим 20% скидку 💙 Запишем вас?`;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ReactivationMessageGenerator;
```

#### 2.4 Unit Tests

```javascript
// src/services/client-reactivation/__tests__/interval-selector.test.js
describe('IntervalSelector', () => {
  it('returns service average when available (Level 2)', async () => {
    // Mock repo to return service average
    const result = await selector.selectOptimalInterval(client, lastService);
    expect(result.source).toBe('service_average');
    expect(result.confidence).toBe(0.85);
  });

  it('falls back to industry standard when no service data (Level 3)', async () => {
    // Mock repo: no service average, but industry match
    const result = await selector.selectOptimalInterval(client, lastService);
    expect(result.source).toBe('industry_standard');
    expect(result.confidence).toBe(0.75);
  });

  it('uses universal fallback when no matches (Level 4)', async () => {
    // Mock repo: no data at all
    const result = await selector.selectOptimalInterval(client, lastService);
    expect(result.source).toBe('universal');
    expect(result.interval).toBeOneOf([30, 60, 90]);
  });

  it('never returns null', async () => {
    const result = await selector.selectOptimalInterval(null, null);
    expect(result).not.toBeNull();
    expect(result.interval).toBeGreaterThan(0);
  });
});
```

#### 2.5 Acceptance Criteria Day 2

- [ ] IntervalSelector returns interval for 100% of inputs (never null)
- [ ] All 3 levels tested and working
- [ ] MessageGenerator creates unique AI messages
- [ ] Fallback templates work when AI unavailable
- [ ] Rate limiting respected (4 sec delay between Gemini calls)
- [ ] Unit tests pass (95%+ coverage)

**Files Created:**
- `src/repositories/ReactivationRepository.js`
- `src/services/client-reactivation/interval-selector.js`
- `src/services/client-reactivation/message-generator.js`
- `src/services/client-reactivation/templates.js`
- `src/services/client-reactivation/__tests__/interval-selector.test.js`
- `src/services/client-reactivation/__tests__/message-generator.test.js`

---

### Phase 3: Service Integration (Day 3, 6-8 hours)

**Goal:** End-to-end reactivation service working with PM2 worker

#### 3.1 ClientReactivationService (Main Orchestrator)

```javascript
// src/services/client-reactivation/index.js
const ReactivationRepository = require('../../repositories/ReactivationRepository');
const IntervalSelector = require('./interval-selector');
const ReactivationMessageGenerator = require('./message-generator');
const contextService = require('../context/context-service-v2');
const logger = require('../../utils/logger').child({ module: 'reactivation-service' });

class ClientReactivationService {
  constructor() {
    this.repo = new ReactivationRepository();
    this.intervalSelector = new IntervalSelector(this.repo);
    this.messageGenerator = new ReactivationMessageGenerator();
    this.whatsappClient = require('../../integrations/whatsapp/client');
    this.contextService = contextService;

    this.checkInterval = 86400000; // 24 hours
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      logger.warn('Service already running');
      return;
    }

    logger.info('🚀 Starting client reactivation service');
    this.isRunning = true;

    // Immediate first run
    this.runReactivationCampaign();

    // Schedule daily runs
    this.intervalId = setInterval(() => {
      this.runReactivationCampaign();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('📛 Client reactivation service stopped');
  }

  async runReactivationCampaign() {
    const companyId = 962302; // Single tenant for MVP
    const thresholds = [30, 60, 90];

    logger.info('🔄 Starting reactivation campaign run');

    try {
      for (const threshold of thresholds) {
        const clients = await this.repo.findInactiveClients(companyId, threshold);
        logger.info(`Found ${clients.length} inactive clients (${threshold}+ days)`);

        for (const client of clients) {
          try {
            await this.processClient(client);
            // Small delay between clients to avoid overwhelming systems
            await this._delay(2000);
          } catch (error) {
            logger.error(`Failed to process client ${client.id}:`, error);
            // Continue to next client
          }
        }
      }

      logger.info('✅ Reactivation campaign run completed');
    } catch (error) {
      logger.error('❌ Reactivation campaign failed:', error);
    }
  }

  async processClient(client) {
    logger.info(`Processing client ${client.id} (${client.phone})`);

    // Check if already contacted today
    const contactedToday = await this.repo.checkContactedToday(client.id);
    if (contactedToday) {
      logger.debug(`Client ${client.id} already contacted today, skipping`);
      return;
    }

    // Get last service
    const lastService = client.last_services?.[0] || {
      service_id: null,
      name: 'процедуру'
    };

    // Select optimal interval
    const { interval, source, confidence, metadata } = await this.intervalSelector
      .selectOptimalInterval(client, lastService);

    logger.info(`Selected interval: ${interval} days (${source}, confidence: ${confidence})`);

    // Generate personalized message
    const message = await this.messageGenerator.generateMessage({
      name: client.name || 'Уважаемый клиент',
      daysInactive: client.days_inactive,
      lastService: lastService.name
    });

    // Send WhatsApp message
    const result = await this.whatsappClient.sendMessage(client.phone, message);

    if (!result.success) {
      logger.error(`Failed to send WhatsApp to ${client.phone}:`, result.error);
      return;
    }

    logger.info(`✅ WhatsApp message sent to ${client.phone}`);

    // Save reactivation record to database
    const historyId = await this.repo.saveReactivationRecord({
      company_id: client.company_id,
      client_id: client.id,
      phone: client.phone,
      message_text: message,
      last_service_id: lastService.service_id,
      last_service_name: lastService.name,
      inactive_days: client.days_inactive,
      last_visit_date: client.last_visit_date,
      interval_days: interval,
      interval_source: source,
      confidence_score: confidence
    });

    logger.info(`Reactivation record saved: ${historyId}`);

    // 🔥 CRITICAL: Save context to Redis for AI Admin integration
    await this._saveReactivationContext(client, lastService, message, {
      interval,
      source,
      confidence,
      historyId
    });
  }

  /**
   * 🔥 Save reactivation context to Redis
   * This enables AI Admin to understand and respond to client replies
   */
  async _saveReactivationContext(client, lastService, message, metadata) {
    const { phone, company_id: companyId, name } = client;

    try {
      logger.info(`Saving reactivation context to Redis for ${phone}`);

      // Update dialog context with pending action
      await this.contextService.updateDialogContext(phone, companyId, {
        state: 'active',
        clientName: name,

        // This is what AI Admin will read when client responds
        pendingAction: {
          type: 'reactivation_response',
          campaign: this._getCampaignType(client.days_inactive),
          daysInactive: client.days_inactive,
          lastVisitDate: client.last_visit_date,

          // Suggested service for booking
          suggestedService: lastService.service_id ? {
            id: lastService.service_id,
            name: lastService.name
          } : null,

          // Interval metadata
          intervalDays: metadata.interval,
          intervalSource: metadata.source,
          confidence: metadata.confidence,

          // Message context
          messageSent: message,
          messageSentAt: new Date().toISOString(),

          // For tracking
          reactivationHistoryId: metadata.historyId
        }
      });

      // Add message to history (from bot)
      await this.contextService.addMessage(phone, companyId, {
        sender: 'bot',
        text: message,
        timestamp: new Date().toISOString(),
        type: 'reactivation'
      });

      // Update client cache
      const clientCache = await this.contextService.getClientCache(phone, companyId);
      if (clientCache) {
        await this.contextService.saveClientCache(phone, companyId, {
          ...clientCache,
          lastReactivationAt: new Date().toISOString(),
          reactivationCampaign: this._getCampaignType(client.days_inactive)
        });
      }

      logger.info(`✅ Reactivation context saved to Redis for ${phone}`);

    } catch (error) {
      logger.error('Failed to save reactivation context to Redis:', error);
      // Don't throw - message already sent, this is non-critical
    }
  }

  _getCampaignType(daysInactive) {
    if (daysInactive < 45) return 'dormant_30';
    if (daysInactive < 75) return 'dormant_60';
    return 'dormant_90';
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ClientReactivationService();
```

#### 3.2 Acceptance Criteria Day 3 (Part 1)

- [ ] Service processes 100+ clients without crashing
- [ ] Skips clients contacted in last 24h
- [ ] All messages delivered successfully via WhatsApp
- [ ] All records saved to `client_reactivation_history`
- [ ] All contexts saved to Redis `dialog:{companyId}:{phone}`

**Files Created:**
- `src/services/client-reactivation/index.js`

---

### Phase 4: AI Admin Integration (Day 3.5, 4 hours)

**Goal:** AI Admin detects and handles reactivation responses

#### 4.1 ReactivationHandler (NEW!)

```javascript
// src/services/ai-admin-v2/modules/reactivation-handler.js
const logger = require('../../../utils/logger').child({ module: 'reactivation-handler' });
const contextService = require('../../context/context-service-v2');
const ReactivationRepository = require('../../../repositories/ReactivationRepository');

class ReactivationHandler {
  constructor() {
    this.repo = new ReactivationRepository();
  }

  /**
   * Check if this is a reactivation response
   */
  async checkReactivationResponse(phone, companyId) {
    try {
      const dialogContext = await contextService.getDialogContext(phone, companyId);

      if (!dialogContext?.pendingAction) {
        return { isReactivation: false };
      }

      const { pendingAction } = dialogContext;

      if (pendingAction.type === 'reactivation_response') {
        logger.info(`📨 Detected reactivation response from ${phone}`, {
          campaign: pendingAction.campaign,
          daysInactive: pendingAction.daysInactive
        });

        return {
          isReactivation: true,
          context: pendingAction
        };
      }

      return { isReactivation: false };

    } catch (error) {
      logger.error('Error checking reactivation response:', error);
      return { isReactivation: false };
    }
  }

  /**
   * Handle reactivation response
   */
  async handleReactivationResponse(userMessage, phone, companyId, reactivationContext) {
    logger.info('Handling reactivation response', {
      phone,
      campaign: reactivationContext.campaign,
      daysInactive: reactivationContext.daysInactive
    });

    // Classify response type
    const responseType = this._classifyResponse(userMessage);

    logger.info(`Response classified as: ${responseType}`);

    // Update history in database
    if (reactivationContext.reactivationHistoryId) {
      try {
        await this.repo.updateReactivationResponse(
          reactivationContext.reactivationHistoryId,
          responseType,
          userMessage
        );
      } catch (error) {
        logger.error('Failed to update reactivation response:', error);
      }
    }

    // Build enriched prompt for AI
    const enrichedPrompt = this._buildEnrichedPrompt(
      userMessage,
      reactivationContext,
      responseType
    );

    return {
      responseType,
      enrichedPrompt,
      suggestedService: reactivationContext.suggestedService,
      shouldStartBooking: responseType === 'positive'
    };
  }

  /**
   * Classify client response
   */
  _classifyResponse(message) {
    const text = message.toLowerCase();

    // Positive indicators
    const positiveKeywords = [
      'да', 'хочу', 'конечно', 'запиш', 'можно', 'давайте',
      'согласен', 'ок', 'окей', 'записать', 'записаться',
      'когда', 'время', 'завтра', 'сегодня', 'на этой неделе',
      'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу'
    ];

    // Negative indicators
    const negativeKeywords = [
      'нет', 'не хочу', 'не нужно', 'не интересно', 'не могу',
      'отстань', 'не пиши', 'удали', 'отписаться', 'не беспокойте'
    ];

    const hasPositive = positiveKeywords.some(kw => text.includes(kw));
    const hasNegative = negativeKeywords.some(kw => text.includes(kw));

    if (hasPositive && !hasNegative) {
      return 'positive';
    }

    if (hasNegative) {
      return 'negative';
    }

    return 'neutral';
  }

  /**
   * Build enriched prompt for AI
   */
  _buildEnrichedPrompt(userMessage, reactivationContext, responseType) {
    const serviceName = reactivationContext.suggestedService?.name || 'услугу';

    let aiInstruction;
    if (responseType === 'positive') {
      aiInstruction = `✅ КЛИЕНТ ЗАИНТЕРЕСОВАН! Начни процесс бронирования с предложения услуги "${serviceName}".`;
    } else if (responseType === 'negative') {
      aiInstruction = `❌ КЛИЕНТ НЕ ЗАИНТЕРЕСОВАН. Вежливо попрощайся и не настаивай. Можешь предложить связаться позже.`;
    } else {
      aiInstruction = `⚠️ ОТВЕТ НЕОДНОЗНАЧНЫЙ. Уточни намерения клиента: хочет ли записаться или нет?`;
    }

    return `
КОНТЕКСТ РЕАКТИВАЦИИ:
- Клиент не был ${reactivationContext.daysInactive} дней (с ${reactivationContext.lastVisitDate})
- Последняя услуга: ${serviceName}
- Кампания: ${reactivationContext.campaign}
- Отправленное сообщение: "${reactivationContext.messageSent}"
- Время отправки: ${reactivationContext.messageSentAt}

АНАЛИЗ ОТВЕТА:
- Тип ответа: ${responseType}
- Сообщение клиента: "${userMessage}"

${aiInstruction}
`;
  }

  /**
   * Mark booking as created after successful booking
   */
  async markBookingCreated(phone, companyId, bookingId) {
    try {
      const dialogContext = await contextService.getDialogContext(phone, companyId);

      if (!dialogContext?.pendingAction ||
          dialogContext.pendingAction.type !== 'reactivation_response') {
        return;
      }

      const reactivationHistoryId = dialogContext.pendingAction.reactivationHistoryId;

      if (reactivationHistoryId) {
        await this.repo.updateReactivationBooking(reactivationHistoryId, bookingId);
        logger.info(`✅ Marked reactivation booking created: history=${reactivationHistoryId}, booking=${bookingId}`);
      }

      // Clear pendingAction
      await contextService.updateDialogContext(phone, companyId, {
        pendingAction: null
      });

    } catch (error) {
      logger.error('Error marking booking created:', error);
    }
  }
}

module.exports = new ReactivationHandler();
```

#### 4.2 Integration into Message Processor

```javascript
// src/services/ai-admin-v2/modules/message-processor.js
// ADD at top:
const reactivationHandler = require('./reactivation-handler');

// MODIFY processMessage method - add BEFORE AI processing:
async processMessage(phone, companyId, message) {
  // ... existing code (load context, etc.) ...

  // 🔥 NEW: Check for reactivation response
  const reactivationCheck = await reactivationHandler.checkReactivationResponse(
    phone,
    companyId
  );

  if (reactivationCheck.isReactivation) {
    logger.info('📨 Processing reactivation response');

    const {
      responseType,
      enrichedPrompt,
      suggestedService,
      shouldStartBooking
    } = await reactivationHandler.handleReactivationResponse(
      message,
      phone,
      companyId,
      reactivationCheck.context
    );

    // Enrich context for AI
    context.reactivationContext = {
      responseType,
      suggestedService,
      shouldStartBooking
    };

    // Add enriched prompt to system message
    systemPrompt += `\n\n${enrichedPrompt}`;

    logger.info('Context enriched with reactivation data');
  }

  // ... continue with existing AI processing ...
}

// MODIFY command handler - add AFTER successful CREATE_BOOKING:
// In the section where commands are processed, after CREATE_BOOKING succeeds:
if (result.command === 'CREATE_BOOKING' && result.success) {
  // ... existing code ...

  // 🔥 NEW: Check if this was a reactivation conversion
  await reactivationHandler.markBookingCreated(
    phone,
    companyId,
    result.data.booking_id
  );
}
```

#### 4.3 Acceptance Criteria Day 3.5

- [ ] AI Admin detects reactivation responses (pendingAction check)
- [ ] Response classification works (positive/negative/neutral)
- [ ] AI receives enriched prompt with reactivation context
- [ ] Booking creation updates `booking_created` flag
- [ ] `pendingAction` cleared after booking

**Files Created:**
- `src/services/ai-admin-v2/modules/reactivation-handler.js`

**Files Modified:**
- `src/services/ai-admin-v2/modules/message-processor.js` (+40 lines)

---

### Phase 5: PM2 Worker & Deployment (Day 4, 4 hours)

**Goal:** Production deployment with monitoring

#### 5.1 PM2 Worker

```javascript
// src/workers/reactivation-worker.js
const reactivationService = require('../services/client-reactivation');
const logger = require('../utils/logger').child({ module: 'reactivation-worker' });

async function startReactivationWorker() {
  logger.info('🚀 Starting reactivation worker');

  try {
    reactivationService.start();

    logger.info('✅ Reactivation worker started successfully');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('📛 SIGTERM received, stopping worker...');
      reactivationService.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('📛 SIGINT received, stopping worker...');
      reactivationService.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Worker failed to start:', error);
    process.exit(1);
  }
}

startReactivationWorker().catch(error => {
  logger.error('❌ Unhandled error in worker:', error);
  process.exit(1);
});
```

#### 5.2 PM2 Configuration

```javascript
// ecosystem.config.js - ADD new app:
{
  name: 'ai-admin-reactivation',
  script: './src/workers/reactivation-worker.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    CHECK_INTERVAL: '86400000' // 24 hours
  },
  error_file: './logs/reactivation-error.log',
  out_file: './logs/reactivation-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_memory_restart: '200M',
  autorestart: true,
  restart_delay: 10000 // 10 seconds
}
```

#### 5.3 Background Job: Service Averages Calculation

```javascript
// scripts/calculate-service-averages.js
const { ReactivationRepository } = require('../src/repositories');
const logger = require('../src/utils/logger').child({ module: 'service-averages' });

async function calculateServiceAverages(companyId) {
  logger.info(`Calculating service averages for company ${companyId}`);

  const repo = new ReactivationRepository();

  try {
    const sql = `
      SELECT * FROM calculate_service_averages($1)
    `;

    const results = await repo.queryMany(sql, [companyId]);

    logger.info(`Found ${results.length} services with sufficient data`);

    // Upsert to service_reactivation_intervals
    for (const row of results) {
      await repo.upsert('service_reactivation_intervals', {
        company_id: companyId,
        service_id: row.service_id,
        service_name: row.service_name,
        median_interval_days: row.median_interval,
        avg_interval_days: row.avg_interval,
        min_interval_days: row.min_interval,
        max_interval_days: row.max_interval,
        sample_size: row.sample_size,
        last_calculated: new Date(),
        is_active: true
      }, ['company_id', 'service_id']);
    }

    logger.info(`✅ Service averages updated for company ${companyId}`);

    return { success: true, servicesUpdated: results.length };

  } catch (error) {
    logger.error('Failed to calculate service averages:', error);
    throw error;
  }
}

// Execute for company 962302
calculateServiceAverages(962302)
  .then(result => {
    console.log('✅ Success:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
```

**Cron Schedule (system crontab):**
```bash
# Run every Sunday at 3 AM
0 3 * * 0 cd /opt/ai-admin && node scripts/calculate-service-averages.js >> logs/service-averages.log 2>&1
```

#### 5.4 Testing

**Local Testing:**
```bash
# Test with dry-run (no actual messages)
node src/workers/reactivation-worker.js

# Monitor logs
tail -f logs/reactivation-out.log
tail -f logs/reactivation-error.log
```

**Production Deployment:**
```bash
# 1. Commit changes
git add .
git commit -m "feat: Add client reactivation service with Redis integration

- 3-level interval selection (service/industry/universal)
- AI message generation via Gemini
- Redis context integration for AI Admin response handling
- Conversion tracking end-to-end
- PM2 worker for daily campaigns

Closes #XXX"

# 2. Push to main
git push origin main

# 3. Deploy to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main"

# 4. Run database migrations
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql \$DATABASE_URL -f migrations/20251112_reactivation_mvp_schema.sql"

# 5. Start PM2 worker
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && pm2 start ecosystem.config.js --only ai-admin-reactivation"

# 6. Save PM2 config
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 save"

# 7. Monitor logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-reactivation --lines 100"
```

#### 5.5 Monitoring & Health Checks

**Health Check API (optional):**
```javascript
// src/api/routes/reactivation.js
router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'running',
    lastRun: null, // TODO: track last run time
    stats: {
      messagesLast24h: null,
      responsesLast24h: null,
      bookingsLast24h: null
    }
  };

  res.json(health);
});
```

**Metrics Queries:**
```sql
-- Daily campaign summary
SELECT
  DATE(message_sent_at) as date,
  COUNT(*) as messages_sent,
  COUNT(CASE WHEN response_received THEN 1 END) as responses,
  COUNT(CASE WHEN booking_created THEN 1 END) as bookings
FROM client_reactivation_history
WHERE message_sent_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(message_sent_at)
ORDER BY date DESC;
```

#### 5.6 Acceptance Criteria Day 4

- [ ] PM2 worker starts successfully
- [ ] Worker runs without crashes for 24 hours
- [ ] Logs are clean (no errors)
- [ ] First campaign run completes successfully
- [ ] Test reactivation message sent to 89686484488
- [ ] Test response detected by AI Admin
- [ ] Test booking created and tracked

**Files Created:**
- `src/workers/reactivation-worker.js`
- `scripts/calculate-service-averages.js`
- `docs/features/CLIENT_REACTIVATION_SERVICE.md`

**Files Modified:**
- `ecosystem.config.js` (+12 lines)
- `CLAUDE.md` (add reactivation service docs)

---

## ⚠️ Risk Assessment & Mitigation

### High Risks

**1. appointments_cache Table Missing**
- **Risk:** Critical table doesn't exist, breaks Level 2 interval selection
- **Impact:** 60-70% of clients get worse intervals
- **Mitigation:**
  - Verify table existence on Day 1
  - If missing, create and populate from bookings + YClients history
  - Add 1 day to timeline if needed
- **Probability:** 40%
- **Severity:** High

**2. Gemini API Rate Limits**
- **Risk:** 15 req/min limit causes delays for large batches
- **Impact:** Campaign run takes 30+ minutes for 100+ clients
- **Mitigation:**
  - 4 second delay between calls
  - Fallback to templates on failures
  - Process in batches of 50
- **Probability:** 60%
- **Severity:** Medium

**3. Redis Context Not Saved**
- **Risk:** Context save fails, AI Admin doesn't understand responses
- **Impact:** Lost conversions, confusion in conversations
- **Mitigation:**
  - Try-catch around context save (non-blocking)
  - Log all failures for debugging
  - Monitor context save success rate
- **Probability:** 20%
- **Severity:** High

### Medium Risks

**4. WhatsApp Message Delivery Failures**
- **Risk:** Messages not delivered due to Baileys issues
- **Impact:** Clients not contacted, wasted effort
- **Mitigation:**
  - Check WhatsApp status before campaign
  - Retry failed messages once
  - Track delivery failures
- **Probability:** 30%
- **Severity:** Medium

**5. Database Performance Issues**
- **Risk:** Queries timeout on large client tables (10K+ records)
- **Impact:** Campaign run fails or takes hours
- **Mitigation:**
  - All indexes created (critical!)
  - LIMIT 100 in queries
  - Test with production data size
- **Probability:** 25%
- **Severity:** Medium

### Low Risks

**6. Multi-Tenant Data Leakage**
- **Risk:** Wrong `company_id` filter leaks data
- **Impact:** Privacy violation, wrong clients contacted
- **Mitigation:**
  - Every query has `company_id` filter
  - Code review checklist
  - Single tenant in MVP (962302 only)
- **Probability:** 10%
- **Severity:** Critical (if happens)

**7. Opt-Out Mechanism Missing**
- **Risk:** No way to unsubscribe from reactivation messages
- **Impact:** Annoyed clients, potential complaints
- **Mitigation:**
  - Add in Week 2
  - Parse "stop", "отписаться" keywords
  - Add `reactivation_opted_out` flag
- **Probability:** 50%
- **Severity:** Low

---

## 📊 Success Metrics

### Primary KPIs

**Conversion Rate:**
- **Target:** 15-20% of contacted clients book within 7 days
- **Measurement:** `(bookings_created / messages_sent) * 100`
- **Query:**
```sql
SELECT
  COUNT(*) as messages_sent,
  COUNT(CASE WHEN booking_created THEN 1 END) as bookings,
  ROUND(100.0 * COUNT(CASE WHEN booking_created THEN 1 END) / COUNT(*), 2) as conversion_rate
FROM client_reactivation_history
WHERE message_sent_at >= CURRENT_DATE - INTERVAL '7 days';
```

**Context Recognition:**
- **Target:** 100% of responses correctly identified by AI Admin
- **Measurement:** Manual verification of logs
- **Check:** `pendingAction.type === 'reactivation_response'` always set

**Timing Accuracy:**
- **Target:** 80%+ messages sent within ±5 days of optimal
- **Measurement:** Post-booking interval analysis
- **Query:**
```sql
SELECT
  AVG(ABS(
    EXTRACT(days FROM (booking_created_at - last_visit_date)) - interval_days
  )) as avg_deviation_days
FROM client_reactivation_history
WHERE booking_created = TRUE;
```

### Secondary KPIs

**Response Rate:**
- **Target:** 40-50% of messages get any response
- **Measurement:** `(response_received / messages_sent) * 100`

**Performance:**
- **Target:** < 10 minutes for 100 clients
- **Measurement:** Worker execution duration logs

**Level Usage:**
- **Track:** % using Level 2 vs 3 vs 4
- **Goal:** Level 2 usage increases over time as data accumulates

**System Stability:**
- **Target:** Zero crashes in first week
- **Measurement:** PM2 restart count

---

## 🛠️ Required Resources & Dependencies

### Technical Dependencies (All Available ✅)
- ✅ Timeweb PostgreSQL (operational)
- ✅ Redis (context service v2)
- ✅ Gemini Flash API (with VPN proxy)
- ✅ WhatsApp Baileys (stable)
- ✅ PM2 (ecosystem ready)
- ✅ Repository pattern (BaseRepository, ClientRepository)

### New Dependencies (None!)
All infrastructure already in place, no new packages needed.

### Team Resources
- **Developer:** 4 days (one developer, full-time)
- **Testing:** Overlaps with development (0.5 days manual testing)
- **Review:** 0.5 days code review before merge

### Costs
- **Gemini API:** ~$0.20/day for 100 messages = $6/month (negligible)
- **No additional infrastructure costs**

---

## 📅 Timeline Summary

### Conservative Estimate

```
Day 1 (6-8h): Database Foundation
  - Morning: Verify appointments_cache, create 4 tables
  - Afternoon: Seed industry standards, SQL functions
  - Evening: Test migrations locally and on production

Day 2 (6-8h): Core Logic
  - Morning: ReactivationRepository, IntervalSelector
  - Afternoon: MessageGenerator, templates
  - Evening: Unit tests, integration tests

Day 3 (6-8h): Service Integration
  - Morning: ClientReactivationService with Redis save
  - Afternoon: ReactivationHandler, AI Admin integration
  - Evening: End-to-end testing

Day 4 (4h): PM2 Worker & Deployment
  - Morning: Worker setup, PM2 config
  - Afternoon: Production deployment, monitoring
  - Evening: First campaign run validation
```

### Buffer
- **+0.5 days:** For unexpected issues (appointments_cache, debugging, etc.)

### Total Timeline
**4 days** (3.5 days + 0.5 buffer)

---

## 📝 Changes from v1 Plan (January 2025)

### Major Updates

1. **Database:** Supabase → Timeweb PostgreSQL native
2. **Waterfall:** 4-level → 3-level (removed Level 1 from MVP)
3. **Redis Integration:** NEW! Critical addition for AI Admin context
4. **Repository Pattern:** Already implemented, not building from scratch
5. **Test Coverage:** 98.8% baseline, not starting from zero

### Why These Changes?

- **Timeweb Migration Complete:** No need to plan for Supabase anymore
- **Level 1 Deferred:** Plan reviewer analysis showed 10-15% coverage not worth 3-4 days
- **Redis Integration:** User feedback identified this as critical missing piece
- **Faster Development:** Existing infrastructure reduces implementation time

### What Stayed the Same?

- ✅ 3-tier architecture (Repository → Service → Worker)
- ✅ AI message generation via Gemini
- ✅ Industry standards approach
- ✅ PM2 worker pattern
- ✅ Success metrics and KPIs

---

## 🎯 Next Steps After Approval

1. **Create feature branch:** `git checkout -b feature/client-reactivation-v2`
2. **Day 1:** Verify appointments_cache, run database migrations
3. **Daily updates:** Use `/dev-docs-update` before context limits
4. **Incremental testing:** Test each phase before moving forward
5. **Production deployment:** After Day 4 validation
6. **Monitor first week:** Track metrics, tune AI prompts, fix issues
7. **Month 2 decision:** Add Level 1 based on real conversion data

---

## 📚 References

**Existing Code Patterns:**
- `src/services/booking-monitor/index.js` - Interval service pattern
- `src/services/context/context-service-v2.js` - Redis context system
- `src/services/ai-admin-v2/modules/context-manager-v2.js` - Context integration
- `src/repositories/BaseRepository.js` - Repository pattern
- `src/integrations/whatsapp/client.js` - WhatsApp messaging

**Documentation:**
- `docs/GEMINI_INTEGRATION_GUIDE.md` - AI provider usage
- `docs/WHATSAPP_MONITORING_GUIDE.md` - WhatsApp best practices
- `docs/01-architecture/database/TIMEWEB_POSTGRES_SUMMARY.md` - Database details

**Related Projects:**
- `dev/completed/infrastructure-improvements/` - Repository pattern implementation
- `dev/completed/database-migration-supabase-timeweb/` - Database migration docs

---

**Plan Status:** ✅ Ready for Implementation
**Risk Level:** 🟢 Low (proven patterns, realistic scope, critical integration addressed)
**Confidence:** 95% (comprehensive analysis, user feedback incorporated, realistic timeline)

---

**Last Updated:** 2025-11-12
**Version:** 2.0 (Redis Integration Update)
