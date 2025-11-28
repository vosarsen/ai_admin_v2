# Client Reactivation Service v2 - Context & Key Decisions

**Last Updated:** 2025-11-26 (After Plan Review)
**Status:** 📋 Ready for Implementation (Fixes Applied)
**Approach:** 2-Level Waterfall MVP + Redis Integration
**Review Score:** 7.5/10 → APPROVE WITH CHANGES

---

## 🚨 CRITICAL DISCOVERIES (Session 2025-11-26)

### 1. appointments_cache Table is EMPTY!
**Discovery:** Таблица `appointments_cache` существует но ПУСТАЯ (0 записей).
```sql
-- Проверка показала:
SELECT COUNT(*) FROM appointments_cache;  -- 0 rows!
```

**Impact:** Level 2 (Service Average) НЕ БУДЕТ РАБОТАТЬ без данных в этой таблице!

**Solution Options:**
1. **Option A (Recommended):** Использовать `clients.last_services` массив вместо appointments_cache
2. **Option B:** Populate appointments_cache из YClients API (historical data)
3. **Option C:** Skip Level 2, start with Level 3 (Industry Standards) only

**Decision:** Нужно изменить SQL функцию `calculate_service_averages()` для работы с `clients.last_services` вместо `appointments_cache`.

### 2. Supabase Fully Removed!
**Discovery:** Проект `supabase-full-removal` завершён 2025-11-26.
- Supabase полностью удалён из кодовой базы
- Все 30+ файлов мигрированы на Timeweb PostgreSQL
- `@supabase/supabase-js` удалён из package.json

**Impact:** План v2 корректен - используем Repository Pattern напрямую с PostgreSQL.

### 3. Repository Pattern Already Comprehensive
**Discovery:** Уже есть 14 репозиториев, включая:
- `AppointmentsCacheRepository` (но таблица пустая!)
- `ClientRepository` с методами `findByPhone`, `findUpcoming`, `searchByName`
- `BookingRepository`, `ServiceRepository`, `StaffRepository`
- `BaseRepository` с методами `findOne`, `findMany`, `upsert`, `withTransaction`

**Impact:** Не нужно создавать ReactivationRepository с нуля - расширяем существующие.

### 4. pendingAction Pattern Already Exists
**Discovery:** `pendingAction` уже используется в проекте:
- `context-service-v2.js` - сохраняет/читает pendingAction из Redis
- `context-manager-v2.js` - обрабатывает pendingAction в `handlePendingActions()`
- Существует тип `cancellation` для pendingAction

**Impact:** Нужно только добавить новый тип `reactivation_response` - паттерн уже есть!

### 5. clients Table Has Rich Data
**Discovery:** Таблица `clients` имеет все нужные поля:
- `last_visit_date` - 1286 клиентов с данными
- `last_services` - массив строк с именами услуг
- `last_service_ids` - массив ID услуг (но часто пустой `{}`)
- `visit_count` - количество визитов
- `blacklisted` - флаг для исключения
- `total_spent` - для сортировки VIP клиентов

**Impact:** Можно найти неактивных клиентов напрямую из `clients` без appointments_cache!

---

## 🎯 Project Context

### What We're Building
Smart, AI-powered client reactivation system with **3-level interval selection** and **Redis context integration** for seamless AI Admin response handling.

### Why v2?
This is NOT a continuation of January 2025 plan. Key differences:
1. **Database:** Timeweb PostgreSQL (migration complete Nov 2025)
2. **Waterfall:** 3-level (not 4-level) - Level 1 deferred to Month 2
3. **Redis Integration:** **CRITICAL ADDITION** - enables AI Admin to understand reactivation responses
4. **Repository Pattern:** Already implemented, we're using it
5. **Supabase Removed:** No legacy code, clean architecture

### MVP Priorities (Revised)
1. 🥇 **Redis Context Integration** (enables end-to-end tracking)
2. 🥈 **3-Level Interval Selection** (simplified due to empty appointments_cache)
3. 🥉 **AI Message Generation** (visible WOW factor)

---

## 🗂️ Key Files & Their Roles

### Existing Files to Use

**`src/repositories/ClientRepository.js`**
- Already has `findByPhone()`, `findUpcoming()`, `searchByName()`
- Need to add: `findInactiveClients()` method

**`src/repositories/BaseRepository.js`**
- Has `withTransaction()`, `upsert()`, `bulkUpsert()`
- Has `_buildWhere()` with operators: gte, lte, neq, ilike, in

**`src/services/context/context-service-v2.js`**
- Has `getDialogContext()`, `updateDialogContext()`
- Has `pendingAction` support (used for cancellation)
- Has `addMessage()` for message history

**`src/services/ai-admin-v2/modules/context-manager-v2.js`**
- Has `handlePendingActions()` - add reactivation handler here
- Has `saveContext()` for updating pendingAction

**`src/services/booking-monitor/index.js`**
- Template for service structure (start/stop pattern)
- Uses repositories, PM2 worker pattern

### New Files to Create

**`src/repositories/ReactivationRepository.js`** (Simplified)
- Extend BaseRepository
- `findInactiveClients()` - query clients table directly
- `matchIndustryStandard()` - keyword matching
- `saveReactivationRecord()`, `updateReactivationResponse()`, `updateReactivationBooking()`

**`src/services/client-reactivation/interval-selector.js`**
- 3-level waterfall: Level 2 → Level 3 → Level 4
- Level 2: Use `clients.last_services` pattern matching (NOT appointments_cache!)
- Level 3: Industry standards
- Level 4: Universal fallback (30/60/90)

**`src/services/client-reactivation/message-generator.js`**
- Gemini Flash API integration
- Fallback templates

**`src/services/client-reactivation/index.js`**
- Main orchestrator
- Save pendingAction to Redis

**`src/services/ai-admin-v2/modules/reactivation-handler.js`**
- Check pendingAction.type === 'reactivation_response'
- Classify response (positive/negative/neutral)
- Build enriched prompt for AI

---

## 🗄️ Database Schema (REVISED)

### Existing Tables (READ-ONLY)

**`clients`** - Primary source for inactive clients
```sql
-- Key columns:
last_visit_date DATE          -- 1286 clients have data
last_services TEXT[]          -- Array of service names
last_service_ids INTEGER[]    -- Array of service IDs (often empty)
visit_count INTEGER           -- Number of visits
blacklisted BOOLEAN           -- Exclude from campaigns
total_spent NUMERIC           -- For VIP sorting
company_id INTEGER            -- Multi-tenant filter
```

**`appointments_cache`** - EXISTS but EMPTY!
- Table exists with correct schema
- Has 0 records
- NOT suitable for Level 2 calculations until populated
- Consider populating from YClients API in future

### New Tables to Create (3 tables)

**1. industry_standard_intervals** (Level 3)
```sql
CREATE TABLE industry_standard_intervals (
  id SERIAL PRIMARY KEY,
  category_key TEXT UNIQUE NOT NULL,
  category_name TEXT NOT NULL,
  interval_days INTEGER NOT NULL,
  min_days INTEGER,
  max_days INTEGER,
  keywords TEXT[] NOT NULL,
  service_type TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.75,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_industry_keywords ON industry_standard_intervals USING GIN(keywords);
```

**2. client_reactivation_history** (Audit log)
```sql
CREATE TABLE client_reactivation_history (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  phone TEXT NOT NULL,
  message_sent_at TIMESTAMP DEFAULT NOW(),
  message_text TEXT NOT NULL,
  last_service_id INTEGER,
  last_service_name TEXT,
  inactive_days INTEGER NOT NULL,
  last_visit_date DATE,
  interval_days INTEGER NOT NULL,
  interval_source TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  response_received BOOLEAN DEFAULT FALSE,
  response_at TIMESTAMP,
  response_type TEXT,
  response_text TEXT,
  booking_created BOOLEAN DEFAULT FALSE,
  booking_id BIGINT,
  booking_created_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reactivation_phone ON client_reactivation_history(phone);
CREATE INDEX idx_reactivation_company ON client_reactivation_history(company_id);
CREATE INDEX idx_reactivation_status ON client_reactivation_history(response_received, booking_created);
```

**3. client_personalized_intervals** (Schema only, NOT used in MVP)
- Create for future use (Month 2)

### REMOVED from Plan
- `service_reactivation_intervals` - SKIP for MVP (requires populated appointments_cache)
- `calculate_service_averages()` SQL function - SKIP for MVP

---

## 🧠 Key Architectural Decisions

### Decision 1: Skip Level 2 in MVP
**Chosen:** Level 3 → Level 4 only (Skip Level 2 initially)

**Rationale:**
- `appointments_cache` is empty
- `clients.last_service_ids` is often empty `{}`
- Level 3 (Industry Standards) + Level 4 (Universal) gives 100% coverage
- Add Level 2 when we populate appointments_cache

**Trade-off:** Lower accuracy initially, but faster time-to-market

### Decision 2: Use clients.last_services for Matching
**Chosen:** Match industry standards against `clients.last_services` array

**Example:**
```javascript
// clients.last_services = ["МУЖСКАЯ СТРИЖКА", "ОКАНТОВКА ГОЛОВЫ | БОРОДЫ"]
// Match against industry_standard_intervals.keywords
```

### Decision 3: Extend Existing pendingAction Pattern
**Chosen:** Add `type: 'reactivation_response'` to existing pendingAction system

**Implementation:**
```javascript
// In context-manager-v2.js handlePendingActions():
if (context.pendingAction.type === 'reactivation_response') {
  return await reactivationHandler.handleReactivationResponse(...);
}
```

---

## 📊 Current Database State (2025-11-26)

```sql
-- Tables in Timeweb PostgreSQL:
17 tables total:
- appointments_cache (EXISTS, 0 rows)
- clients (1304 rows, 1286 with visit data)
- bookings (13 active future bookings)
- services, staff, staff_schedules
- companies, dialog_contexts, messages
- booking_notifications, webhook_events
- marketplace_events, demo_chat_events
- whatsapp_auth, whatsapp_keys
- company_sync_status, actions

-- Client data for company 962302:
Total clients: 1304
With visits: 1286
With last_visit_date: 1286
```

---

## 🔄 Revised Implementation Phases

### Day 1: Database Foundation (SIMPLIFIED - 4 hours)
1. Create 2 tables: `industry_standard_intervals`, `client_reactivation_history`
2. Seed industry standards (15+ entries)
3. Create indexes
4. Skip: `service_reactivation_intervals`, `calculate_service_averages()` function

### Day 2: Core Logic (6 hours)
1. Create `ReactivationRepository` (simplified)
2. Create `IntervalSelector` (2-level: Industry + Universal)
3. Create `MessageGenerator`
4. Unit tests

### Day 3: Service Integration (6 hours)
1. Create `ClientReactivationService`
2. Create `ReactivationHandler`
3. Integrate with AI Admin

### Day 4: PM2 Worker & Deployment (4 hours)
1. Create PM2 worker
2. Deploy to production
3. Test full flow

---

## 📝 Session Summary (2025-11-26)

### What Was Done
1. ✅ Deleted outdated `client-reactivation-service` v1
2. ✅ Reviewed all completed projects (supabase-full-removal, etc.)
3. ✅ Discovered critical issues:
   - appointments_cache is EMPTY
   - clients table has rich data we can use
   - pendingAction pattern already exists
4. ✅ Updated plan to work around empty appointments_cache

### Key Files Reviewed
- `src/repositories/BaseRepository.js` - Full implementation
- `src/repositories/ClientRepository.js` - Methods available
- `src/repositories/AppointmentsCacheRepository.js` - Exists but table empty
- `src/services/context/context-service-v2.js` - pendingAction support
- `src/services/ai-admin-v2/modules/context-manager-v2.js` - handlePendingActions()
- `src/services/booking-monitor/index.js` - PM2 pattern template

### Next Steps (For Next Session)
1. Create migration file with 2 tables (skip service_reactivation_intervals)
2. Seed industry standards
3. Create ReactivationRepository
4. Create IntervalSelector (2-level MVP)
5. Integrate with pendingAction system

---

## 🔴 PLAN REVIEW CRITICAL FIXES (Must Apply)

### Fix 1: MessageGenerator API Pattern
**Problem:** План использует несуществующий API
```javascript
// НЕПРАВИЛЬНО (в плане):
const provider = createProvider('gemini-flash');
const message = await provider.generateText(prompt);

// ПРАВИЛЬНО (реальный код):
const providerFactory = require('../ai/provider-factory');
const provider = await providerFactory.getProvider('gemini-flash');
const result = await provider.call(prompt, { message: '' });
return result.text;
```

### Fix 2: ReactivationRepository Methods
**Problem:** `BaseRepository` НЕ имеет методов `create()` и `update()`

**Решение для saveReactivationRecord:**
```javascript
async saveReactivationRecord(data) {
  const sql = `
    INSERT INTO client_reactivation_history
    (company_id, client_id, phone, message_text, last_service_name,
     inactive_days, last_visit_date, interval_days, interval_source, confidence_score)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;
  const result = await this.db.query(sql, [...]);
  return result.rows[0].id;
}
```

**Решение для updateReactivationResponse:**
```javascript
async updateReactivationResponse(historyId, responseType, responseText) {
  const sql = `
    UPDATE client_reactivation_history
    SET response_received = true, response_at = NOW(),
        response_type = $2, response_text = $3, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const result = await this.db.query(sql, [historyId, responseType, responseText]);
  return result.rows[0];
}
```

### Fix 3: Industry Standard SQL Query
**Problem:** `ILIKE ANY(subquery)` синтаксически неверен

```sql
-- НЕПРАВИЛЬНО:
WHERE $1 ILIKE ANY(SELECT '%' || keyword || '%' FROM unnest(keywords))

-- ПРАВИЛЬНО:
WHERE EXISTS (
  SELECT 1 FROM unnest(keywords) AS keyword
  WHERE $1 ILIKE '%' || keyword || '%'
)
ORDER BY confidence_score DESC
LIMIT 1
```

### Fix 4: Add Sentry Error Tracking
**Problem:** План не включает Sentry, но это обязательно

```javascript
const Sentry = require('@sentry/node');

// В каждом catch блоке:
catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'reactivation-service',
      operation: 'processClient'
    },
    extra: { clientId: client.id, phone: client.phone }
  });
  throw error;
}
```

### Fix 5: Phone Number Normalization
**Problem:** План не использует нормализацию телефона

```javascript
const InternationalPhone = require('../../utils/international-phone');

// При сохранении контекста:
const normalizedPhone = InternationalPhone.normalize(client.phone);
await contextService.updateDialogContext(normalizedPhone, companyId, {...});
```

---

## 🟡 PLAN REVIEW RECOMMENDATIONS (Should Apply)

### Recommendation 1: Add Opt-Out Column
Подготовить SQL для будущего opt-out:
```sql
-- В миграцию (закомментировано для MVP):
-- ALTER TABLE clients ADD COLUMN reactivation_opted_out BOOLEAN DEFAULT FALSE;
```

### Recommendation 2: Duplicate Prevention Per Run
```javascript
// В ClientReactivationService:
constructor() {
  // ...existing code...
  this.processedClientsThisRun = new Set(); // Prevent duplicates if restart mid-run
}

async processClient(client) {
  if (this.processedClientsThisRun.has(client.id)) {
    return; // Already processed in this run
  }
  this.processedClientsThisRun.add(client.id);
  // ...rest of processing...
}
```

### Recommendation 3: Timezone Handling
```javascript
// Явно использовать Moscow timezone:
const moscowNow = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Empty appointments_cache
**Status:** Known, workaround in place
**Workaround:** Use `clients.last_services` for service matching
**Permanent Fix:** Populate appointments_cache from YClients API (future)

### Issue 2: clients.last_service_ids Often Empty
**Status:** Known
**Workaround:** Match by service name strings instead of IDs
**Example:** Match "МУЖСКАЯ СТРИЖКА" to industry standard "haircut_male"

---

## ⏱️ REVISED TIMELINE (After Review)

| Phase | Original | Revised | Delta |
|-------|----------|---------|-------|
| Day 1: Database | 4-6h | 4-6h | - |
| Day 2: Core Logic | 6h | **8h** | +2h (API fixes, SQL fixes) |
| Day 3: Integration | 6h | **8-10h** | +2-4h (Sentry, error handling) |
| Day 4: Testing | 4h | **4-6h** | +0-2h (E2E tests) |
| Buffer | 0.5d | **1d** | +0.5d |

**Total: 4-5 days** (было 3 дня)

---

**Context Status:** ✅ Updated with Plan Review fixes
**Next Session:** Start Day 1 database work (with fixes applied)
**Confidence:** 85% (after addressing review findings)
