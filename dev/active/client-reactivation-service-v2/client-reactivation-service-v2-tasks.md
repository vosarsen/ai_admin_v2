# Client Reactivation Service v2 - Task Checklist (REVISED + REVIEWED)

**Last Updated:** 2025-11-26 (After Plan Review - Fixes Applied)
**Status:** 📋 Ready to Start
**Timeline:** 4-5 days (revised after review from 3 days)
**Progress:** 0% (0/72 tasks completed)
**Review Score:** 7.5/10 → APPROVE WITH CHANGES

---

## 🚨 CRITICAL CHANGES

### Original → After Codebase Review → After Plan Review
| Aspect | Original | Post-Discovery | Post-Review |
|--------|----------|----------------|-------------|
| Tables | 4 | 2 | 2 |
| Waterfall | 3-level | 2-level | 2-level |
| Timeline | 4 days | 3 days | **4-5 days** |
| API Pattern | Wrong | Wrong | **Fixed** |
| SQL Query | Wrong | Wrong | **Fixed** |
| Sentry | Missing | Missing | **Added** |

### Why Extended Timeline:
1. MessageGenerator needs correct provider API pattern
2. ReactivationRepository needs raw SQL (no create/update in BaseRepository)
3. Industry standard SQL query was syntactically wrong
4. Must add Sentry error tracking (project standard)
5. Must add phone normalization (project standard)

---

## ✅ Task Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ⏸️ Deferred (Month 2)
- ❌ Blocked
- 🚫 REMOVED (no longer needed)

---

## 📦 DAY 1: Database Foundation (4 hours)

### 1.1 Create Migration File
- ⬜ Create `migrations/20251126_reactivation_mvp_schema.sql`
- ⬜ Add header comments
- ⬜ Add rollback section

### 1.2 Create Table: industry_standard_intervals
- ⬜ Define columns (id, category_key, category_name, interval_days, keywords[], etc.)
- ⬜ Add UNIQUE constraint on category_key
- ⬜ Create GIN index on keywords

### 1.3 Seed Industry Standards (15+ entries)
- ⬜ haircut_male (28 days, ['стрижка', 'мужская', 'мужск'])
- ⬜ haircut_female (40 days, ['стрижка', 'женская', 'женск'])
- ⬜ coloring (50 days, ['окрашивание', 'цвет', 'краска'])
- ⬜ manicure_gel (21 days, ['маникюр', 'гель'])
- ⬜ manicure_regular (14 days, ['маникюр', 'обычный', 'классический'])
- ⬜ pedicure (30 days, ['педикюр'])
- ⬜ beard (21 days, ['борода', 'бород', 'окантовка'])
- ⬜ facial (28 days, ['чистка', 'лицо', 'лица'])
- ⬜ massage_face (14 days, ['массаж', 'лица'])
- ⬜ peeling (21 days, ['пилинг'])
- ⬜ epilation_legs (35 days, ['эпиляция', 'ноги', 'ног'])
- ⬜ epilation_bikini (28 days, ['эпиляция', 'бикини'])
- ⬜ balayage (90 days, ['балаяж'])
- ⬜ hair_extensions (60 days, ['наращивание', 'волос'])
- ⬜ botox_hair (45 days, ['ботокс', 'волос'])
- ⬜ Verify: 15+ standards inserted

### 1.4 Create Table: client_reactivation_history
- ⬜ Define columns (company_id, client_id, phone, message_sent_at, etc.)
- ⬜ Add response tracking columns
- ⬜ Add booking tracking columns
- ⬜ Create indexes (phone, company_id, status)

### 1.5 Apply Migration
- ⬜ Test locally
- ⬜ Apply to production Timeweb
- ⬜ Verify tables created
- ⬜ Verify seed data loaded

### 🚫 REMOVED Tasks (Not Needed)
- 🚫 ~~Create service_reactivation_intervals~~ (appointments_cache empty)
- 🚫 ~~Create calculate_service_averages()~~ (no data to calculate)
- 🚫 ~~Create client_personalized_intervals~~ (defer to Month 2)
- 🚫 ~~Verify appointments_cache~~ (already verified - it's empty)

**Day 1 Acceptance Criteria:**
- [ ] 2 tables created
- [ ] 15+ industry standards seeded
- [ ] All indexes created
- [ ] Migration applied to production

---

## 🧠 DAY 2: Core Logic (8 hours) ⚠️ REVISED

### 2.1 Create ReactivationRepository
- ⬜ Create file: `src/repositories/ReactivationRepository.js`
- ⬜ Extend BaseRepository
- ⬜ Add Sentry import: `const Sentry = require('@sentry/node')`
- ⬜ Method: `findInactiveClients(companyId, daysThreshold, limit=50)`
  ```sql
  SELECT c.*, (CURRENT_DATE - c.last_visit_date) as days_inactive
  FROM clients c
  WHERE c.company_id = $1
    AND c.last_visit_date < CURRENT_DATE - INTERVAL '1 day' * $2
    AND c.blacklisted = FALSE
    AND c.visit_count > 0
    AND NOT EXISTS (SELECT 1 FROM bookings b
                    WHERE b.client_phone = c.phone
                    AND b.datetime > NOW() AND b.status != 'deleted')
    AND NOT EXISTS (SELECT 1 FROM client_reactivation_history crh
                    WHERE crh.client_id = c.id
                    AND crh.message_sent_at > CURRENT_DATE - INTERVAL '7 days')
  ORDER BY c.total_spent DESC, c.last_visit_date ASC
  LIMIT $3
  ```
- ⬜ Method: `matchIndustryStandard(serviceName)` - **🔴 FIXED SQL:**
  ```sql
  -- ПРАВИЛЬНЫЙ SQL (исправлен после ревью):
  SELECT * FROM industry_standard_intervals
  WHERE EXISTS (
    SELECT 1 FROM unnest(keywords) AS keyword
    WHERE $1 ILIKE '%' || keyword || '%'
  )
  ORDER BY confidence_score DESC
  LIMIT 1
  ```
- ⬜ Method: `saveReactivationRecord(data)` - **🔴 USE RAW SQL (no create in BaseRepository):**
  ```javascript
  async saveReactivationRecord(data) {
    const sql = `INSERT INTO client_reactivation_history (...) VALUES (...) RETURNING id`;
    const result = await this.db.query(sql, [...values]);
    return result.rows[0].id;
  }
  ```
- ⬜ Method: `updateReactivationResponse(historyId, responseType, responseText)` - **🔴 USE RAW SQL:**
  ```javascript
  async updateReactivationResponse(historyId, responseType, responseText) {
    const sql = `UPDATE client_reactivation_history SET ... WHERE id = $1 RETURNING *`;
    const result = await this.db.query(sql, [historyId, responseType, responseText]);
    return result.rows[0];
  }
  ```
- ⬜ Method: `updateReactivationBooking(historyId, bookingId)` - USE RAW SQL
- ⬜ Method: `checkContactedRecently(clientId, days=7)`
- ⬜ Add Sentry error tracking to all methods
- ⬜ Export in `src/repositories/index.js`

### 2.2 Create IntervalSelector (SIMPLIFIED - 2 levels)
- ⬜ Create file: `src/services/client-reactivation/interval-selector.js`
- ⬜ Constructor: Accept reactivationRepo
- ⬜ Method: `selectOptimalInterval(client)`
  - ⬜ Try Level 3: `tryIndustryStandardInterval(client.last_services)`
  - ⬜ Fallback Level 4: `getUniversalFallback(client.days_inactive)`
  - ⬜ Always return { interval, source, confidence }
- ⬜ Method: `tryIndustryStandardInterval(lastServices)`
  - ⬜ Loop through lastServices array
  - ⬜ Match each service name against industry keywords
  - ⬜ Return first match with highest confidence
- ⬜ Method: `getUniversalFallback(daysInactive)`
  - ⬜ Logic: days < 45 ? 30 : (days < 75 ? 60 : 90)

### 🚫 REMOVED (Level 2 - Service Average)
- 🚫 ~~tryServiceAverageInterval()~~ (appointments_cache empty)
- 🚫 ~~Query service_reactivation_intervals~~ (table not created)

### 2.3 Create MessageGenerator - **🔴 FIXED API PATTERN**
- ⬜ Create file: `src/services/client-reactivation/message-generator.js`
- ⬜ **🔴 CORRECT IMPORTS:**
  ```javascript
  const providerFactory = require('../ai/provider-factory');  // НЕ createProvider!
  const Sentry = require('@sentry/node');
  ```
- ⬜ Method: `generateMessage(clientData)` - **🔴 CORRECT API USAGE:**
  ```javascript
  async generateMessage(clientData) {
    try {
      const provider = await providerFactory.getProvider('gemini-flash');
      const prompt = this._buildPrompt(clientData);
      const result = await provider.call(prompt, { message: '' });
      await this._delay(this.rateLimitDelay);
      return result.text.trim();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'message-generator', operation: 'generateMessage' }
      });
      return this._getFallbackTemplate(clientData);
    }
  }
  ```
- ⬜ Method: `_buildPrompt(clientData)` - AI prompt based on days_inactive
- ⬜ Method: `_getFallbackTemplate(clientData)` - static templates
- ⬜ Rate limiting: 4 sec delay between Gemini calls
- ⬜ Add Sentry error tracking

### 2.4 Create Fallback Templates
- ⬜ Create file: `src/services/client-reactivation/templates.js`
- ⬜ GENTLE_TEMPLATE (< 45 days)
- ⬜ OFFER_TEMPLATE (45-74 days)
- ⬜ WIN_BACK_TEMPLATE (75+ days)

### 2.5 Unit Tests
- ⬜ `interval-selector.test.js`
  - ⬜ Test: "МУЖСКАЯ СТРИЖКА" matches haircut_male
  - ⬜ Test: Unknown service returns universal fallback
  - ⬜ Test: Never returns null
- ⬜ `message-generator.test.js`
  - ⬜ Test: Fallback when AI fails
  - ⬜ Test: Message length < 250 chars

**Day 2 Acceptance Criteria:**
- [ ] IntervalSelector returns interval for 100% of inputs
- [ ] Industry standard matching works
- [ ] MessageGenerator creates unique AI messages
- [ ] Fallback templates work
- [ ] Unit tests pass

---

## 🚀 DAY 3: Service Integration (8-10 hours) ⚠️ REVISED

### 3.1 Create ClientReactivationService - **🔴 WITH REVIEW FIXES**
- ⬜ Create file: `src/services/client-reactivation/index.js`
- ⬜ Pattern: Copy from booking-monitor/index.js
- ⬜ **🔴 REQUIRED IMPORTS:**
  ```javascript
  const Sentry = require('@sentry/node');
  const InternationalPhone = require('../../utils/international-phone');
  ```
- ⬜ Constructor: Initialize repo, intervalSelector, messageGenerator
- ⬜ **🔴 ADD duplicate prevention:**
  ```javascript
  this.processedClientsThisRun = new Set();
  ```
- ⬜ Property: checkInterval = 86400000 (24 hours)
- ⬜ Method: `start()` - immediate run + setInterval
- ⬜ Method: `stop()` - clearInterval, clear processedClientsThisRun
- ⬜ Method: `runReactivationCampaign()` - process 30/60/90 day thresholds
- ⬜ Method: `processClient(client)` - **🔴 WITH FIXES:**
  - ⬜ **🔴 Check duplicate in this run:** `if (this.processedClientsThisRun.has(client.id)) return;`
  - ⬜ **🔴 Add to processed:** `this.processedClientsThisRun.add(client.id);`
  - ⬜ Check: Already contacted in 7 days? Skip
  - ⬜ Get: Last service from client.last_services[0]
  - ⬜ Select: Interval via intervalSelector
  - ⬜ Generate: Message via messageGenerator
  - ⬜ Send: WhatsApp message
  - ⬜ Save: reactivation record to database
  - ⬜ Save: pendingAction to Redis (CRITICAL!)
  - ⬜ **🔴 Add Sentry try-catch around entire method**
- ⬜ Method: `_saveReactivationContext()` 🔥 - **🔴 WITH PHONE NORMALIZATION:**
  ```javascript
  const normalizedPhone = InternationalPhone.normalize(client.phone);
  await contextService.updateDialogContext(normalizedPhone, companyId, {...});
  ```
  - ⬜ Set: pendingAction.type = 'reactivation_response'
  - ⬜ Set: suggestedService, daysInactive, historyId
  - ⬜ Call: contextService.addMessage() - bot message

### 3.2 Create ReactivationHandler
- ⬜ Create file: `src/services/ai-admin-v2/modules/reactivation-handler.js`
- ⬜ Method: `checkReactivationResponse(phone, companyId)`
  - ⬜ Load: dialogContext from contextService
  - ⬜ Check: pendingAction.type === 'reactivation_response'
  - ⬜ Return: { isReactivation, context }
- ⬜ Method: `handleReactivationResponse(userMessage, phone, companyId, context)`
  - ⬜ Classify: response (positive/negative/neutral)
  - ⬜ Update: database response_received = TRUE
  - ⬜ Build: enriched prompt for AI
- ⬜ Method: `_classifyResponse(message)` - keyword matching
- ⬜ Method: `_buildEnrichedPrompt()` - context for AI
- ⬜ Method: `markBookingCreated(phone, companyId, bookingId)`
  - ⬜ Update: booking_created = TRUE in database
  - ⬜ Clear: pendingAction from Redis

### 3.3 Integrate into AI Admin
- ⬜ Modify: `context-manager-v2.js` handlePendingActions()
  - ⬜ Add: case for 'reactivation_response'
  - ⬜ Call: reactivationHandler.handleReactivationResponse()
- ⬜ Modify: After CREATE_BOOKING success
  - ⬜ Call: reactivationHandler.markBookingCreated()

### 3.4 Create PM2 Worker
- ⬜ Create file: `src/workers/reactivation-worker.js`
- ⬜ Import: reactivationService
- ⬜ Start: reactivationService.start()
- ⬜ Handle: SIGTERM graceful shutdown

### 3.5 Update PM2 Configuration
- ⬜ Add to ecosystem.config.js: ai-admin-reactivation
- ⬜ Set: instances = 1, max_memory_restart = '200M'

### 3.6 Git Commit & Deploy
- ⬜ Commit: Feature complete
- ⬜ Push: to main
- ⬜ Deploy: to production
- ⬜ Run: migrations
- ⬜ Start: PM2 worker
- ⬜ Test: Full flow with 89686484488

### 3.7 Production Validation
- ⬜ Check: PM2 logs clean
- ⬜ Check: First campaign run
- ⬜ Test: Send reactivation to test phone
- ⬜ Test: Respond "Да, хочу записаться"
- ⬜ Verify: AI Admin detected response
- ⬜ Complete: booking flow
- ⬜ Check: booking_created = TRUE in database

**Day 3 Acceptance Criteria:**
- [ ] PM2 worker running
- [ ] Redis pendingAction saved correctly
- [ ] AI Admin detects reactivation responses
- [ ] Response classification works
- [ ] Booking tracking works end-to-end

---

## 📝 POST-MVP: Documentation (2 hours)

- ⬜ Create: `docs/features/CLIENT_REACTIVATION_SERVICE.md`
- ⬜ Update: `CLAUDE.md` with reactivation section
- ⬜ Create: Development diary entry

---

## ⏸️ DEFERRED TO MONTH 2

### Level 2: Service Average
- ⏸️ Populate appointments_cache from YClients API
- ⏸️ Create service_reactivation_intervals table
- ⏸️ Create calculate_service_averages() function
- ⏸️ Add tryServiceAverageInterval() to IntervalSelector

### Level 1: Personalized Intervals
- ⏸️ Create client_personalized_intervals table
- ⏸️ Add tryPersonalizedInterval() to IntervalSelector

---

## 📊 Progress Tracking

### Phase Completion
- [ ] Day 1: Database Foundation (0/18 tasks)
- [ ] Day 2: Core Logic (0/28 tasks) ⚠️ +4 tasks (Sentry, API fixes)
- [ ] Day 3: Service Integration (0/26 tasks) ⚠️ +3 tasks (phone normalization, duplicate prevention)

### Overall Progress
**0% Complete** (0/72 MVP tasks) ⚠️ Updated after review

---

## 🔗 Quick Reference

### Key Files to Create
```
src/repositories/ReactivationRepository.js
src/services/client-reactivation/index.js
src/services/client-reactivation/interval-selector.js
src/services/client-reactivation/message-generator.js
src/services/client-reactivation/templates.js
src/services/ai-admin-v2/modules/reactivation-handler.js
src/workers/reactivation-worker.js
migrations/20251126_reactivation_mvp_schema.sql
```

### Key Files to Modify
```
src/repositories/index.js (add ReactivationRepository export)
src/services/ai-admin-v2/modules/context-manager-v2.js (add reactivation case)
ecosystem.config.js (add worker)
```

### Existing Pattern References
```
src/services/booking-monitor/index.js - PM2 worker pattern
src/services/context/context-service-v2.js - pendingAction usage
src/services/ai-admin-v2/modules/context-manager-v2.js:318 - handlePendingActions()
```

---

**Task Status:** 📋 Ready to Begin
**Next Task:** Day 1 - Create migration file
**Timeline:** 3 days (simplified)

---

**Last Updated:** 2025-11-26 (Simplified plan)
**Version:** 2.1 (Post-codebase review)
