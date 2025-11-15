# Client Reactivation Service - Strategic Plan (MVP)

**Last Updated:** 2025-01-08 (Revised after plan-reviewer analysis)
**Status:** 📋 Planning Complete - Ready for Implementation
**Complexity:** Medium (3 days MVP)
**Approach:** 3-Level Waterfall with Phased Enhancement

---

## 📋 Executive Summary

### Mission
Build a **smart, AI-powered client reactivation system** that automatically identifies inactive clients and sends personalized WhatsApp messages at optimal times to bring them back.

**MVP Focus:** Fast time-to-market (3 days) with high-impact features, progressive enhancement later.

### Key Requirements (MVP)
- ✅ **3-Level Interval Selection:** Service Average → Industry Standards → Universal Fallback
- ✅ **AI Message Generation:** Gemini-powered personalization (WOW factor!)
- ✅ **Works Day 1:** For new AND established companies
- ✅ **Multi-Tenant Ready:** Company-specific patterns
- ✅ **Simple & Stable:** Proven patterns, low risk

### Deferred to Month 2
- ⏸️ **Level 1 (Personalized):** Individual client patterns (+2-3 days later)
- ⏸️ **A/B Testing Framework**
- ⏸️ **Advanced Analytics Dashboard**

### Success Metrics
- **Conversion Rate:** 15-20% of contacted clients book within 7 days
- **Timing Accuracy:** 80%+ messages sent within ±5 days of optimal time
- **System Adoption:** Works for 100% of companies from Day 1
- **Time to Market:** 3 days (vs 6-7 days with 4-level)

---

## 🔍 Current State Analysis (Updated)

### What We Have ✅

**Database Infrastructure:**
- ✅ **appointments_cache** - EXISTS! Full booking history with attendance tracking
- ✅ **clients** - visit_count, last_visit_date, last_services, favorite_staff_ids
- ✅ **bookings** - Current active bookings
- ✅ **booking_notifications** - Notification history

**Integrations:**
- ✅ YClients API (getRecords, searchClients, createBooking)
- ✅ WhatsApp Baileys (sendMessage with multi-tenant)
- ✅ Gemini Flash API (generateText for AI messages)
- ✅ PM2 ecosystem (proven worker pattern)

**Reference Code:**
- ✅ BookingMonitorService (interval-based pattern) - `/src/services/booking-monitor/index.js:30-77`
- ✅ Message templates - `/src/services/reminder/templates.js`
- ✅ AI provider factory - `/src/services/ai/provider-factory.js`

### What's Missing ❌

**Database Tables (New):**
- ❌ `service_reactivation_intervals` - Company-specific service averages
- ❌ `industry_standard_intervals` - Pre-seeded global standards
- ❌ `client_reactivation_history` - Campaign tracking
- ❌ `client_personalized_intervals` - (Create schema, but don't populate yet)

**Service Layer:**
- ❌ ClientReactivationService (orchestrator)
- ❌ IntervalSelector (3-level waterfall logic)
- ❌ MessageGenerator (AI integration)

**Background Jobs:**
- ❌ Weekly service average calculation
- ❌ Daily reactivation campaign runner

---

## 🎯 Proposed Architecture (3-Level MVP)

### Interval Selection Waterfall

```
┌─────────────────────────────────────────┐
│  КЛИЕНТ с последней услугой              │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────────────────────────┐
    │ Level 2: Service Average         │ ← 60-70% клиентов
    │ (Компания-специфичные паттерны)  │
    │ Accuracy: 80-85%                 │
    └──────────┬──────────────────────┘
               │ Нет данных (< 10 bookings)
               ▼
    ┌─────────────────────────────────┐
    │ Level 3: Industry Standard       │ ← 20-25% клиентов
    │ (Отраслевые best practices)      │
    │ Accuracy: 75-80%                 │
    └──────────┬──────────────────────┘
               │ Не найдено соответствие
               ▼
    ┌─────────────────────────────────┐
    │ Level 4: Universal Fallback      │ ← 5-10% клиентов
    │ (30/60/90 дней)                  │
    │ Accuracy: 60-70%                 │
    └─────────────────────────────────┘
               │
               └─► ВСЕГДА РАБОТАЕТ ✅
```

### Why 3-Level Instead of 4-Level?

**Level 1 (Personalized) Analysis:**
- Coverage: Only 10-15% of clients initially
- Complexity: 3-4 days development
- SQL: Complex window functions, consistency scoring
- **Verdict:** Overkill for MVP, add in Month 2

**3-Level Coverage:**
- Level 2: 60-70% (company patterns)
- Level 3: 20-25% (industry standards)
- Level 4: 5-10% (safety net)
- **Total: 100% coverage with 50% less dev time**

### Database Schema (4 Tables)

**1. service_reactivation_intervals** (MVP - Active)
```sql
CREATE TABLE service_reactivation_intervals (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  median_interval_days INTEGER NOT NULL,  -- Prefer median over average
  avg_interval_days INTEGER,
  min_interval_days INTEGER,
  max_interval_days INTEGER,
  stddev_days DECIMAL(5,2),
  sample_size INTEGER NOT NULL,  -- Min 10 for validity
  last_calculated TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(company_id, service_id)
);
```

**2. industry_standard_intervals** (MVP - Pre-seeded)
```sql
CREATE TABLE industry_standard_intervals (
  id SERIAL PRIMARY KEY,
  category_key TEXT UNIQUE,
  category_name TEXT,
  interval_days INTEGER NOT NULL,
  min_days INTEGER,
  max_days INTEGER,
  keywords TEXT[],  -- For matching service names
  service_type TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.75,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with 15+ standards
INSERT INTO industry_standard_intervals VALUES
('haircut_male', 'Мужская стрижка', 28, 21, 35, ARRAY['стрижка', 'мужская'], 'hair'),
('manicure_gel', 'Маникюр гель', 21, 14, 28, ARRAY['маникюр', 'гель'], 'nails'),
('coloring', 'Окрашивание', 50, 40, 70, ARRAY['окрашивание', 'цвет'], 'hair'),
-- ... 12 more services
```

**3. client_reactivation_history** (MVP - Active)
```sql
CREATE TABLE client_reactivation_history (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  phone TEXT NOT NULL,
  message_sent_at TIMESTAMP DEFAULT NOW(),
  message_text TEXT,
  last_service_id INTEGER,
  last_service_name TEXT,
  inactive_days INTEGER,
  last_visit_date DATE,
  interval_days INTEGER,
  interval_source TEXT NOT NULL,  -- 'service_average', 'industry_standard', 'universal'
  confidence_score DECIMAL(3,2),
  response_received BOOLEAN DEFAULT FALSE,
  booking_created BOOLEAN DEFAULT FALSE,
  booking_id BIGINT
);
```

**4. client_personalized_intervals** (Schema Only - Not Used in MVP)
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
-- Created for future use (Month 2), but not populated in MVP
```

---

## 📐 Implementation Phases (3 Days)

### Day 1: Database Foundation (8 hours)

**Goal:** All tables created, seed data loaded, SQL functions ready

**Tasks:**
1. ✅ Create migration: All 4 tables
2. ✅ Add indexes for performance
3. ✅ Seed industry_standard_intervals (15+ entries)
4. ✅ Write SQL function: `calculate_service_averages(company_id)`
5. ✅ Test on local database
6. ✅ Apply to production (Timeweb PostgreSQL)

**SQL Function Example:**
```sql
CREATE OR REPLACE FUNCTION calculate_service_averages(p_company_id BIGINT)
RETURNS TABLE(
  service_id INTEGER,
  service_name TEXT,
  median_interval INTEGER,
  sample_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH service_intervals AS (
    SELECT
      unnest(ac1.service_ids) as sid,
      ac1.appointment_datetime,
      LEAD(ac1.appointment_datetime) OVER (
        PARTITION BY ac1.client_id, unnest(ac1.service_ids)
        ORDER BY ac1.appointment_datetime
      ) as next_visit
    FROM appointments_cache ac1
    WHERE ac1.company_id = p_company_id
      AND ac1.attendance = 1
      AND ac1.appointment_datetime >= NOW() - INTERVAL '6 months'
  )
  SELECT
    si.sid,
    s.title,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(DAYS FROM (next_visit - appointment_datetime))
    )::INTEGER,
    COUNT(*)::INTEGER
  FROM service_intervals si
  JOIN services s ON s.yclients_id = si.sid
  WHERE next_visit IS NOT NULL
  GROUP BY si.sid, s.title
  HAVING COUNT(*) >= 10;
END;
$$ LANGUAGE plpgsql;
```

**Acceptance Criteria:**
- All 4 tables created successfully
- Industry standards table has 15+ entries
- SQL function returns correct aggregations
- Can query in < 100ms

**Files:**
- `migrations/20250108_reactivation_mvp_schema.sql`
- `scripts/test-reactivation-schema.js`

---

### Day 2: Core Logic (8 hours)

**Goal:** Interval selector + AI message generator working

#### 2.1 IntervalSelector (3-Level Waterfall)

**File:** `src/services/client-reactivation/interval-selector.js`

**Methods:**
- `selectOptimalInterval(client, lastService)` - Main waterfall
- `tryServiceAverageInterval()` - Level 2
- `tryIndustryStandardInterval()` - Level 3
- `getUniversalFallback()` - Level 4

**Logic:**
```javascript
async selectOptimalInterval(client, lastService) {
  // Level 2: Service Average
  const serviceAvg = await this.tryServiceAverageInterval(client, lastService);
  if (serviceAvg && serviceAvg.sample_size >= 10) {
    return { interval: serviceAvg.median_interval, source: 'service_average', confidence: 0.85 };
  }

  // Level 3: Industry Standard
  const industry = await this.tryIndustryStandardInterval(lastService);
  if (industry) {
    return { interval: industry.interval_days, source: 'industry_standard', confidence: 0.75 };
  }

  // Level 4: Universal Fallback
  const daysSince = getDaysSince(client.last_visit_date);
  const interval = daysSince < 45 ? 30 : (daysSince < 75 ? 60 : 90);
  return { interval, source: 'universal', confidence: 0.60 };
}
```

#### 2.2 MessageGenerator (AI-Powered)

**File:** `src/services/client-reactivation/message-generator.js`

**Key Features:**
- Gemini Flash API integration
- 3 message types: gentle (30d), offer (60d), win_back (90d)
- Fallback templates when AI unavailable

**AI Prompts:**
```javascript
const prompts = {
  gentle: `Создай дружелюбное напоминание для клиента салона.
    Клиент: ${clientName}
    Не был: ${inactiveDays} дней
    Последняя услуга: ${lastService}

    Тон: легкий, не навязчивый
    Длина: до 150 символов
    Без слов "скучаем", "ждем"`,

  offer: `Создай сообщение с персональным предложением.
    Клиент: ${clientName}
    Не был: ${inactiveDays} дней
    Любимые услуги: ${services}

    Тон: дружелюбный, с выгодой
    Длина: до 200 символов
    Упомяни скидку 10%`,

  win_back: `Создай сообщение win-back для давнего клиента.
    Клиент: ${clientName}
    Не был: ${inactiveDays} дней

    Тон: искренний, заботливый
    Длина: до 250 символов
    Предложи скидку 20%`
};
```

**Acceptance Criteria:**
- Returns interval for 100% of clients
- AI generates unique messages (no duplicates)
- Falls back to templates gracefully
- Response time < 5 seconds

**Files:**
- `src/services/client-reactivation/interval-selector.js`
- `src/services/client-reactivation/message-generator.js`
- `src/services/client-reactivation/templates.js` (fallback)
- `src/services/client-reactivation/__tests__/interval-selector.test.js`

---

### Day 3: Service Integration & Deployment (8 hours)

**Goal:** End-to-end working system in production

#### 3.1 ClientReactivationService

**File:** `src/services/client-reactivation/index.js`

**Pattern:** Identical to BookingMonitorService

**Key Methods:**
```javascript
class ClientReactivationService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checkInterval = 86400000; // 24 hours
  }

  start() {
    this.runReactivationCampaign(); // Immediate first run
    this.intervalId = setInterval(() => {
      this.runReactivationCampaign();
    }, this.checkInterval);
  }

  stop() {
    clearInterval(this.intervalId);
  }

  async runReactivationCampaign() {
    const inactiveClients = await this.findInactiveClients();

    for (const client of inactiveClients) {
      try {
        await this.processInactiveClient(client);
      } catch (error) {
        logger.error('Failed to process client:', error);
        // Continue to next client
      }
    }
  }

  async processInactiveClient(client) {
    // 1. Check if already contacted today
    // 2. Select interval via IntervalSelector
    // 3. Generate message via MessageGenerator
    // 4. Send WhatsApp message
    // 5. Save to history
  }
}
```

#### 3.2 PM2 Worker

**File:** `src/workers/reactivation-worker.js`

```javascript
const reactivationService = require('../services/client-reactivation');
const logger = require('../utils/logger');

async function startReactivationWorker() {
  logger.info('🚀 Starting reactivation worker');

  reactivationService.start();

  process.on('SIGTERM', () => {
    logger.info('📛 SIGTERM received');
    reactivationService.stop();
    process.exit(0);
  });
}

startReactivationWorker().catch(error => {
  logger.error('❌ Worker failed:', error);
  process.exit(1);
});
```

#### 3.3 PM2 Configuration

**File:** `ecosystem.config.js` (add new app)

```javascript
{
  name: 'ai-admin-client-reactivation',
  script: './src/workers/reactivation-worker.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    CHECK_INTERVAL: '86400000' // 24 hours
  },
  error_file: './logs/reactivation-error.log',
  out_file: './logs/reactivation-out.log',
  max_memory_restart: '200M',
  autorestart: true
}
```

#### 3.4 Testing

**Small Batch Test:**
- Select 5-10 inactive clients
- Run reactivation manually
- Verify WhatsApp delivery
- Check history records

**Performance Test:**
- Run with 100+ clients
- Measure execution time
- Verify no crashes

**Acceptance Criteria:**
- Processes 100+ clients without crashing
- Skips clients contacted in last 24h
- All messages delivered successfully
- First production run completes

**Files:**
- `src/services/client-reactivation/index.js`
- `src/workers/reactivation-worker.js`
- Modified: `ecosystem.config.js`

---

## 🔄 Month 2 Enhancement: Add Level 1 (Optional)

**When:** After 30 days of MVP operation
**Why:** After collecting real conversion data
**Timeline:** +2-3 days

**Tasks:**
1. Populate `client_personalized_intervals` table
2. Add `tryPersonalizedInterval()` method to IntervalSelector
3. Update waterfall logic to check Level 1 first
4. Test with real client data

**This becomes a 4-level waterfall after enhancement**

---

## ⚠️ Risk Assessment

### High Risks (Addressed)

**1. Database Performance**
- **Mitigation:** Indexes on all query columns, LIMIT 100 in queries
- **Test:** EXPLAIN ANALYZE before production

**2. Gemini API Rate Limits**
- **Mitigation:** 4 sec delay between calls, fallback templates
- **Reality:** 15 req/min = max 15 clients/min (acceptable for daily job)

**3. WhatsApp Delivery**
- **Mitigation:** Check session status, retry on failure, log failures

### Medium Risks

**4. Conversion Tracking**
- **Risk:** Manual tracking initially
- **Mitigation:** Add `booking_created` field, track responses manually in Month 1

**5. Opt-Out Mechanism**
- **Risk:** No GDPR-compliant opt-out initially
- **Mitigation:** Add in Week 2, respond to "stop" messages

### Low Risks

**6. Multi-Tenant Isolation**
- **Mitigation:** Always filter by `company_id`, code review checklist

---

## 📊 Success Metrics

### Primary KPIs

**Conversion Rate:**
- Target: 15-20% book within 7 days
- Measurement: `(bookings_created / messages_sent) * 100`

**Timing Accuracy:**
- Target: 80%+ within ±5 days of optimal
- Measurement: Post-booking analysis

**System Coverage:**
- Target: 100% of companies work from Day 1
- Measurement: Zero fallback failures

### Secondary KPIs

**Performance:**
- Target: < 10 minutes for 100 clients
- Measurement: Worker execution duration

**Level Usage:**
- Track: % using Level 2 vs 3 vs 4
- Goal: Level 2 usage increases over time

---

## 🛠️ Required Resources

### Technical Dependencies
- ✅ Supabase/PostgreSQL (configured)
- ✅ Gemini Flash API (available)
- ✅ WhatsApp Baileys (working)
- ✅ Redis (operational)
- ✅ PM2 (in use)

### New Dependencies
- None! All infrastructure ready.

### Team Resources
- Developer: 3 days (one developer)
- Testing: 0.5 days (overlaps with development)

### Costs
- Gemini API: ~$0.20/day for 100 messages = $6/month (negligible)

---

## 📅 Timeline

### Conservative (3 Days)
```
Day 1: Database Foundation
  - Morning: Create 4 tables + indexes
  - Afternoon: Seed industry standards, SQL functions
  - Evening: Test locally

Day 2: Core Logic
  - Morning: IntervalSelector (3 levels)
  - Afternoon: MessageGenerator (Gemini + fallback)
  - Evening: Unit tests

Day 3: Integration & Deployment
  - Morning: ClientReactivationService + Worker
  - Afternoon: PM2 deployment, testing
  - Evening: Production validation
```

### Realistic Buffer
- Add 0.5 days buffer for unexpected issues
- **Total: 3.5 days**

---

## 🎯 Sales Positioning

### Pitch for 3-Level MVP

**For Clients:**
> "Our AI learns YOUR salon's unique patterns - it knows that YOUR clients get haircuts every 26 days, not the generic 30. Combined with AI-crafted messages, it's like having a personal assistant for each client."

**Key Differentiators:**
1. ✅ **AI-Generated Messages** - Every message is unique (VISIBLE MAGIC)
2. ✅ **Your Salon's Patterns** - Not generic, learns from YOUR data
3. ✅ **Industry Best Practices** - Backed by beauty industry standards
4. ✅ **Smart Timing** - Not just 30/60/90, adapts to each service

**vs Competitors:**
- Competitors: Fixed intervals, template messages
- Us: Adaptive intervals, AI messages, company-specific learning

**Progressive Enhancement Message:**
> "Starts smart on Day 1, gets smarter every week as it learns. In Month 2, we add individual client personalization for even better results."

---

## 🎯 Next Steps After Approval

1. **Create feature branch:** `git checkout -b feature/client-reactivation-mvp`
2. **Day 1:** Start database migrations
3. **Daily updates:** Use `/dev-docs-update` before context limits
4. **Incremental testing:** Test each phase before moving forward
5. **Production deployment:** After Day 3 validation
6. **Monitor first week:** Track metrics, tune AI prompts
7. **Month 2 decision:** Add Level 1 based on conversion data

---

## 📚 References

**Code Patterns:**
- `src/services/booking-monitor/index.js:30-77` - Interval service pattern
- `src/services/reminder/templates.js` - Message templates
- `src/services/ai/provider-factory.js` - Gemini integration

**Documentation:**
- `docs/SYNC_SYSTEM.md` - YClients patterns
- `docs/GEMINI_INTEGRATION_GUIDE.md` - AI usage
- `docs/WHATSAPP_MONITORING_GUIDE.md` - WhatsApp best practices

**Plan Review:**
- `dev/active/client-reactivation-service/PLAN_REVIEW_REPORT.md` - Detailed analysis by plan-reviewer agent

---

**Plan Status:** ✅ Ready for Implementation (3-Level MVP)
**Risk Level:** 🟢 Low (proven patterns, realistic scope)
**Confidence:** 95% (based on plan-reviewer analysis)
**Timeline:** 3 days + 0.5 buffer = **3.5 days realistic**

---

## 📝 Changes from Original Plan

**Original Plan:** 4-level waterfall, 6-7 days
**Revised Plan:** 3-level waterfall, 3 days

**Key Changes:**
- ✅ Removed Level 1 (Personalized) from MVP - defer to Month 2
- ✅ Reduced timeline from 6-7 days to 3 days
- ✅ Focus on AI messages as primary WOW factor
- ✅ Simplified SQL (no complex window functions in MVP)
- ✅ Create all 4 tables but only use 3 levels initially
- ✅ Phased rollout strategy: MVP → Enhancement

**Rationale:** Plan-reviewer analysis showed Level 1 covers only 10-15% of clients but requires 3-4 days. Better ROI to ship MVP fast and iterate based on real data.
