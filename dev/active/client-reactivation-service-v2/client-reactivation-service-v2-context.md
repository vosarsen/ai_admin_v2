# Client Reactivation Service v2 - Context & Key Decisions

**Last Updated:** 2025-11-12
**Status:** 📋 Ready for Implementation
**Approach:** 3-Level Waterfall MVP + Redis Integration

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

### MVP Priorities
1. 🥇 **Redis Context Integration** (enables end-to-end tracking)
2. 🥈 **3-Level Interval Selection** (good enough for 95% of clients)
3. 🥉 **AI Message Generation** (visible WOW factor)

---

## 🗂️ Key Files & Their Roles

### Core Service Files (To Be Created)

**`src/repositories/ReactivationRepository.js`**
- Extends BaseRepository
- Methods:
  - `findInactiveClients()` - Find clients inactive X+ days
  - `getServiceAverage()` - Level 2 interval lookup
  - `matchIndustryStandard()` - Level 3 keyword matching
  - `saveReactivationRecord()` - Save to history
  - `updateReactivationResponse()` - Track response
  - `updateReactivationBooking()` - Track conversion
  - `getConversionStats()` - Analytics

**`src/services/client-reactivation/interval-selector.js`**
- 3-level waterfall: Level 2 → Level 3 → Level 4
- Returns: `{ interval, source, confidence, metadata }`
- Pure logic + DB queries (no external calls)
- NEVER returns null (Level 4 fallback always works)

**`src/services/client-reactivation/message-generator.js`**
- AI-powered via Gemini Flash
- 3 message types based on days_inactive:
  - gentle (30-44 days)
  - offer (45-74 days)
  - win_back (75+ days)
- Fallback to templates on AI failure
- Rate limiting: 4 sec delay between calls

**`src/services/client-reactivation/index.js`**
- Main orchestrator (pattern: BookingMonitorService)
- Methods:
  - `start()` - Start daily interval (24 hours)
  - `stop()` - Stop interval
  - `runReactivationCampaign()` - Process 30/60/90 day thresholds
  - `processClient()` - Handle one client
  - `_saveReactivationContext()` - **🔥 CRITICAL: Save to Redis**
- Runs daily at 10:00 AM (configurable)

**`src/services/ai-admin-v2/modules/reactivation-handler.js` (NEW!)**
- AI Admin integration for response handling
- Methods:
  - `checkReactivationResponse()` - Detect pendingAction
  - `handleReactivationResponse()` - Classify and enrich prompt
  - `markBookingCreated()` - Update conversion tracking
  - `_classifyResponse()` - positive/negative/neutral
  - `_buildEnrichedPrompt()` - Context for AI

### Worker Files

**`src/workers/reactivation-worker.js`**
- PM2 entry point
- Starts ClientReactivationService
- Graceful shutdown on SIGTERM/SIGINT

### Background Jobs

**`scripts/calculate-service-averages.js`**
- Weekly SQL aggregation
- Calls `calculate_service_averages(company_id)` function
- Updates `service_reactivation_intervals` table
- Run: Sundays 3:00 AM (crontab)

### Existing Files (Reference)

**`src/services/context/context-service-v2.js` (Lines 1-935)**
- **CRITICAL DEPENDENCY** for Redis integration
- Methods we use:
  - `updateDialogContext()` - Save pendingAction
  - `getDialogContext()` - Read pendingAction
  - `addMessage()` - Save message history
  - `saveClientCache()` - Update client cache
  - `clearDialogContext()` - After booking complete

**`src/services/ai-admin-v2/modules/context-manager-v2.js` (Lines 1-430)**
- Loads full context for AI
- `loadFullContext()` - Gets dialog + client + messages
- `saveContext()` - Updates after processing
- `saveCommandContext()` - Extracts info from commands

**`src/services/ai-admin-v2/modules/message-processor.js`**
- Where we ADD reactivation detection
- Before AI processing: check `pendingAction.type`
- After CREATE_BOOKING: mark booking created

**`src/services/booking-monitor/index.js` (Lines 30-77)**
- **Template for our service structure**
- Pattern: `start()` with `setInterval()`, `stop()` with `clearInterval()`
- Proven pattern, copy this structure

---

## 🗄️ Database Schema

### New Tables (Create All 4, Use 3)

**1. service_reactivation_intervals** (ACTIVE in MVP)
```sql
company_id BIGINT NOT NULL
service_id INTEGER NOT NULL
service_name TEXT
median_interval_days INTEGER NOT NULL  -- Prefer median!
sample_size INTEGER NOT NULL  -- Min 10 for validity
last_calculated TIMESTAMP
is_active BOOLEAN
UNIQUE(company_id, service_id)
```

**Purpose:** Level 2 - Company-specific service patterns
**Coverage:** 60-70% of clients
**Update:** Weekly via `calculate_service_averages()` function

**2. industry_standard_intervals** (ACTIVE in MVP)
```sql
category_key TEXT UNIQUE
category_name TEXT
interval_days INTEGER NOT NULL
keywords TEXT[]  -- For matching service names
service_type TEXT  -- 'hair', 'nails', 'beauty'
confidence_score DECIMAL(3,2) DEFAULT 0.75
```

**Purpose:** Level 3 - Global best practices
**Coverage:** 20-25% of clients
**Data:** Pre-seeded with 15+ beauty industry standards

**3. client_reactivation_history** (ACTIVE in MVP)
```sql
company_id, client_id, phone
message_sent_at, message_text
last_service_id, last_service_name
inactive_days, last_visit_date
interval_days, interval_source, confidence_score

-- 🔥 Response tracking
response_received BOOLEAN
response_at TIMESTAMP
response_type TEXT  -- 'positive', 'negative', 'neutral'
response_text TEXT

-- 🔥 Booking tracking
booking_created BOOLEAN
booking_id BIGINT
booking_created_at TIMESTAMP
```

**Purpose:** Audit log + Analytics + Conversion tracking
**Usage:** Track end-to-end reactivation funnel

**4. client_personalized_intervals** (Schema only, NOT used in MVP)
```sql
company_id, client_id, service_id
personal_interval_days INTEGER
visit_count, consistency_score
```

**Purpose:** Level 1 (deferred to Month 2)
**Status:** Create schema now, don't populate

### Existing Tables (Read-Only)

**`clients`** - Main client data
- `last_visit_date` - Find inactive clients
- `visit_count` - Exclude brand new (0 visits)
- `last_services` - JSONB array, use [0] for last service
- `blacklisted` - CRITICAL: exclude from campaigns
- `favorite_staff_ids`, `preferred_time_slots` - For AI context

**`appointments_cache`** - **NEEDS VERIFICATION!**
- Used by `calculate_service_averages()` function
- Columns: `client_id`, `service_ids[]`, `appointment_datetime`, `attendance`, `company_id`
- Filter: `attendance = 1` (completed visits only)
- **Action:** Verify existence on Day 1, create if missing

**`bookings`** - Current/upcoming bookings
- Skip clients with `datetime > CURRENT_DATE` and `status != 'deleted'`
- Used to exclude clients with upcoming appointments

**`services`** - All company services
- Used in SQL function for service name lookup
- Join on `yclients_id = service_id`

---

## 🧠 Key Architectural Decisions

### Decision 1: 3-Level Waterfall (Not 4-Level)

**Chosen:** Level 2 → Level 3 → Level 4 (Skip Level 1 in MVP)

**Rationale (from plan-reviewer):**
- Level 1 (Personalized) coverage: 10-15% (not worth 3-4 days dev time)
- Level 2 (Service Average) coverage: 60-70% (worth 1 day!) ✅
- 3-level = 100% coverage with 50% less dev time

**Trade-off:** Slightly lower accuracy for 10-15% of clients initially, but faster time-to-market

**Path Forward:** Add Level 1 in Month 2 if conversion rate > 15% proves value

---

### Decision 2: Redis Context Integration (CRITICAL!)

**Chosen:** Save `pendingAction` to Redis after sending reactivation message

**Why Critical:**
Without this, when client responds "Да, хочу записаться", AI Admin would:
- ❌ Treat it as random message
- ❌ Not understand it's a reactivation response
- ❌ Not pre-fill service selection
- ❌ Not track conversion

With this:
- ✅ AI Admin reads `pendingAction.type === 'reactivation_response'`
- ✅ Knows client is responding to reactivation
- ✅ Pre-fills `suggestedService` from context
- ✅ Tracks booking → updates `booking_created = TRUE`

**Implementation:**
```javascript
// After sending WhatsApp message:
await contextService.updateDialogContext(phone, companyId, {
  pendingAction: {
    type: 'reactivation_response',
    campaign: 'dormant_30',
    suggestedService: { id: 123, name: 'Стрижка' },
    daysInactive: 35,
    messageSent: "...",
    messageSentAt: "2025-11-12T10:00:00Z",
    reactivationHistoryId: 456
  }
});
```

---

### Decision 3: Median Over Average

**Chosen:** Use `median_interval_days` instead of `avg_interval_days`

**Rationale:**
- Outlier resistant (one client who came 6 months ago doesn't skew data)
- Better represents "typical" client behavior
- PostgreSQL: `PERCENTILE_CONT(0.5)` function

**Example:**
```
Client visits to same service:
[25, 26, 28, 27, 180] days between visits

Average: 57 days (WRONG! Skewed by outlier)
Median: 27 days (CORRECT! Typical behavior)
```

---

### Decision 4: Daily Interval Service (Not Event-Driven)

**Chosen:** `setInterval()` pattern, runs every 24 hours

**Rationale:**
- Proven pattern (BookingMonitorService uses this)
- Predictable, easy to debug
- Daily frequency sufficient for reactivation
- No need for complex event system

**Alternative Considered:** Event-driven after each booking completion
- Pro: More precise timing
- Con: More complex, requires event infrastructure
- Verdict: Overkill for MVP

---

### Decision 5: Create All 4 Tables Now

**Chosen:** Create schema for all 4 tables, but only populate 3 in MVP

**Rationale:**
- Avoid schema migration later (when adding Level 1 in Month 2)
- Minimal cost (empty table doesn't hurt)
- Level 1 ready when needed

---

## 🚨 Critical Implementation Notes

### Multi-Tenant Isolation (CRITICAL!)

**RULE:** Every query MUST filter by `company_id`

**Correct:**
```javascript
const { data } = await repo.queryMany(`
  SELECT * FROM clients
  WHERE company_id = $1  -- ✅ ALWAYS
    AND last_visit_date < $2
`, [companyId, threshold]);
```

**WRONG:**
```javascript
const { data } = await repo.queryMany(`
  SELECT * FROM clients
  WHERE last_visit_date < $1  -- ❌ MISSING company_id
`, [threshold]);
```

**Code Review Checklist:**
- [ ] Every SELECT has `WHERE company_id = ...`
- [ ] Every INSERT has `company_id` column
- [ ] Every UPDATE verifies ownership

---

### Deduplication Strategy

**Check before sending each message:**
```javascript
// src/services/client-reactivation/index.js

const contactedToday = await this.repo.checkContactedToday(client.id);
if (contactedToday) {
  logger.debug(`Client ${client.id} already contacted today, skipping`);
  return;
}
```

**Database check:**
```sql
SELECT COUNT(*) FROM client_reactivation_history
WHERE client_id = $1
  AND message_sent_at >= CURRENT_DATE
```

**Why Important:** Prevents annoying clients with duplicate messages

---

### Error Handling Per Client

**Pattern:**
```javascript
for (const client of inactiveClients) {
  try {
    await processClient(client);
  } catch (error) {
    logger.error(`Failed for client ${client.id}:`, error);
    // CONTINUE to next client (don't throw!)
  }
}
```

**Why:** One client's error shouldn't stop entire campaign

**DON'T use `Promise.all()`** - first error stops everything!

---

### Redis Context Survival

**Problem:** What if Redis save fails?

**Solution:** Non-blocking try-catch
```javascript
try {
  await this._saveReactivationContext(...);
  logger.info('✅ Context saved to Redis');
} catch (error) {
  logger.error('Failed to save context:', error);
  // Don't throw! Message already sent, this is non-critical
  // AI Admin just won't have context (degraded but not broken)
}
```

---

## 📊 Performance Considerations

### Database Indexes (CRITICAL!)

**Without these, queries timeout on 10K+ clients:**

```sql
-- For finding inactive clients (most important!)
CREATE INDEX idx_clients_last_visit
ON clients(company_id, last_visit_date);

-- For interval lookups
CREATE INDEX idx_service_intervals
ON service_reactivation_intervals(company_id, service_id, is_active);

-- For industry standard matching
CREATE INDEX idx_industry_keywords
ON industry_standard_intervals USING GIN(keywords);

-- For deduplication checks
CREATE INDEX idx_reactivation_history_recent
ON client_reactivation_history(client_id, message_sent_at DESC);

-- For analytics
CREATE INDEX idx_reactivation_status
ON client_reactivation_history(response_received, booking_created, message_sent_at DESC);
```

**Test with EXPLAIN ANALYZE:**
```sql
EXPLAIN ANALYZE
SELECT * FROM clients
WHERE company_id = 962302
  AND last_visit_date < CURRENT_DATE - INTERVAL '30 days'
  AND blacklisted = FALSE
LIMIT 100;

-- Should use idx_clients_last_visit
-- Should complete in < 100ms
```

---

### Batch Processing Limits

**Gemini Rate Limits:**
- 15 requests/minute (Flash tier)
- Solution: 4 second delay between calls
- 100 clients × 4 sec = 400 sec (~7 minutes)

**WhatsApp:**
- No hard limit, but avoid bursts
- Solution: 2 second delay between messages
- 100 clients = ~3 minutes

**Total Campaign Time:**
- 100 clients: ~10 minutes
- 200 clients: ~20 minutes
- Acceptable for daily job

**Daily Limit:**
- Max 100 clients per campaign
- 3 campaigns (30/60/90 days)
- Total: 300 clients/day maximum

---

## 🧪 Testing Strategy

### Unit Tests

**interval-selector.test.js:**
- ✅ Service with 10+ bookings → Returns service average (Level 2)
- ✅ Service with < 10 bookings → Falls to industry standard (Level 3)
- ✅ Service name "Стрижка мужская" → Matches "haircut_male"
- ✅ No match → Returns universal (30/60/90)
- ✅ Never returns null
- ✅ Confidence scores correct

**message-generator.test.js:**
- ✅ Generates unique messages for different clients
- ✅ Falls back to template when AI fails
- ✅ Message length < 250 chars
- ✅ No placeholders in output (`{clientName}` replaced)
- ✅ Rate limiting respected (4 sec delay)

### Integration Test (Critical!)

**Full flow with test phone 89686484488:**
```bash
# 1. Send reactivation message
# Service runs, contacts test phone

# 2. Check Redis context
redis-cli GET "dialog:962302:89686484488"
# Should show pendingAction with type: 'reactivation_response'

# 3. Respond via WhatsApp
# Send: "Да, хочу записаться"

# 4. Check AI Admin logs
pm2 logs ai-admin-worker-v2 --lines 50
# Should show: "📨 Detected reactivation response"
# Should show: "Response classified as: positive"

# 5. Complete booking
# Follow AI Admin flow, create booking

# 6. Check database
SELECT * FROM client_reactivation_history
WHERE phone = '89686484488'
ORDER BY created_at DESC
LIMIT 1;
# Should show: booking_created = TRUE, booking_id = XXX
```

**Success Criteria:**
- [ ] Message sent successfully
- [ ] Redis context saved with pendingAction
- [ ] AI Admin detected reactivation response
- [ ] Response classified correctly
- [ ] Booking created and tracked

---

## 🔄 Phased Rollout Strategy

### Phase 1: MVP (4 Days)
```
Day 1: Database (all 4 tables, 3 used)
Day 2: IntervalSelector (3 levels) + MessageGenerator
Day 3: ReactivationService + ReactivationHandler
Day 4: PM2 Worker + Deployment + Testing
```

### Week 2: Stabilization
- Monitor conversion rates
- Tune AI prompts based on responses
- Add opt-out mechanism ("stop", "отписаться")
- Fix any bugs found in production

### Month 2: Enhancements (Optional)
**Decision Point:** Add Level 1 (Personalized) if:
- Conversion rate > 15% (proves value)
- Have 3+ months of data (enough for personalization)
- Technical capacity available

**Tasks:**
- Populate `client_personalized_intervals` table
- Add `tryPersonalizedInterval()` to IntervalSelector
- Update waterfall to check Level 1 first
- Test with 10-20 clients
- Deploy if results > 5% better than Level 2

**Timeline:** +2-3 days

---

## 📚 Integration Points

### YClientsClient
- **Method:** `getRecords()` - If needed for validation
- **No modifications required** - works as-is

### WhatsAppManager
- **Method:** `sendMessage(phone, message, { companyId })`
- **Already multi-tenant** - ready to use
- **Location:** `src/integrations/whatsapp/client.js`

### Gemini Provider
- **Method:** `createProvider('gemini-flash')`
- **Returns:** Provider with `generateText()` method
- **Location:** `src/services/ai/provider-factory.js`
- **Rate Limit:** 15 req/min, add 4 sec delay

### Context Service V2
- **Methods:** `updateDialogContext()`, `getDialogContext()`, `addMessage()`
- **Location:** `src/services/context/context-service-v2.js`
- **Critical for Redis integration**

### Logger
- **Winston with Telegram alerts**
- **Pattern:** `logger.info()`, `logger.error()`, `logger.warn()`
- **Child logger:** `logger.child({ module: 'reactivation' })`

---

## 🐛 Potential Issues & Mitigations

### Issue 1: appointments_cache Table Missing

**Symptom:** SQL function fails, Level 2 doesn't work
**Solution:**
- Check on Day 1: `SELECT * FROM information_schema.tables WHERE table_name = 'appointments_cache'`
- If missing: Create table, populate from bookings + YClients history
- Add 1 day to timeline
**Test:** `SELECT COUNT(*) FROM appointments_cache WHERE company_id = 962302`

---

### Issue 2: Gemini API Down

**Symptom:** All AI messages fail, logs show Gemini errors
**Solution:**
- Automatic fallback to static templates
- Log failures for debugging
- Templates still personalized (use client name, days inactive)
**Test:** Simulate API error, verify fallback works

---

### Issue 3: Redis Context Not Saved

**Symptom:** AI Admin doesn't recognize reactivation responses
**Solution:**
- Non-blocking try-catch around context save
- Log all failures
- Monitor success rate
- Manual Redis check: `redis-cli GET "dialog:962302:{phone}"`
**Test:** Check Redis after each reactivation message

---

### Issue 4: Duplicate Messages

**Symptom:** Client gets 2+ messages same day
**Solution:**
- Deduplication check in `client_reactivation_history`
- Query: `message_sent_at >= CURRENT_DATE`
- Skip if already contacted today
**Test:** Run service twice, verify no duplicates

---

### Issue 5: SQL Performance Slow

**Symptom:** `calculate_service_averages()` takes > 30 sec
**Solution:**
- Add indexes (critical!)
- LIMIT in subqueries
- Test with production data size
**Test:** `EXPLAIN ANALYZE` on production

---

## 🎯 Month 2 Enhancement Path

**When:** After 30 days of MVP operation

**Decision Criteria:**
1. Conversion rate from Levels 2-4 meets/exceeds 15%
2. Have real data on which services need personalization
3. Technical capacity available
4. Business case: ROI > 20% improvement expected

**Tasks:**
1. Write SQL to populate `client_personalized_intervals`
2. Add `tryPersonalizedInterval()` to IntervalSelector
3. Update waterfall to check Level 1 first
4. Test with 10-20 clients
5. A/B test: Level 1 vs Level 2-4
6. Deploy if results > 5% better

**Estimated:** +2-3 days

---

## 📝 Key Learnings from Plan Review

### What Plan Reviewer Flagged

1. **appointments_cache might not exist** - CRITICAL, verify on Day 1
2. **Multi-tenant claims were false** - Simplified to single-tenant (962302)
3. **4-level waterfall was overkill** - Reduced to 3-level MVP
4. **Redis integration was missing** - Now core feature of v2 plan

### What We Changed

- ✅ Realistic timeline: 4 days (not 6-7)
- ✅ Focus on Redis integration as critical path
- ✅ Verify appointments_cache before starting
- ✅ Single-tenant MVP (multi-tenant later if needed)
- ✅ Conservative estimates with buffer

### What Stayed Strong

- ✅ Repository pattern (already implemented)
- ✅ Service architecture (proven with booking-monitor)
- ✅ AI message generation (unique differentiator)
- ✅ PM2 worker pattern (stable in production)

---

**Context Status:** ✅ Complete - Ready for Implementation
**Last Review:** 2025-11-12
**Version:** 2.0 (Redis Integration)
**Next Step:** Day 1 - Database migrations + verification
