# Client Reactivation Service - Context & Key Decisions (MVP)

**Last Updated:** 2025-01-08 (Revised after plan-reviewer analysis)
**Status:** 📋 Planning Complete - Ready for Implementation
**Approach:** 3-Level Waterfall MVP (3 days)

---

## 🎯 Project Context

### What We're Building
Smart, AI-powered client reactivation system with **3-level interval selection** and Gemini-generated personalized messages.

### Why 3-Level Instead of 4-Level?
**Plan-reviewer analysis showed:**
- Level 1 (Personalized): Only 10-15% coverage, 3-4 days dev time
- Level 2 (Service Average): 60-70% coverage, 1 day dev time
- **Verdict:** Ship 3-level MVP fast (3 days), add Level 1 in Month 2

### MVP Priorities
1. 🥇 **AI Message Generation** (visible WOW factor)
2. 🥈 **Service-specific intervals** (company intelligence)
3. 🥉 **Industry standards** (best practices)
4. 🏅 **Universal fallback** (safety net)

---

## 🗂️ Key Files & Their Roles

### Core Service Files (To Be Created)

**`src/services/client-reactivation/index.js`**
- Main orchestrator (pattern: BookingMonitorService)
- Methods: `start()`, `stop()`, `findInactiveClients()`, `processInactiveClient()`
- Runs daily at 10:00 AM

**`src/services/client-reactivation/interval-selector.js`**
- 3-level waterfall: Level 2 → Level 3 → Level 4
- Returns: `{ interval, source, confidence }`
- Pure logic + DB queries (no external service calls)

**`src/services/client-reactivation/message-generator.js`**
- AI-powered via Gemini Flash
- 3 prompts: gentle (30d), offer (60d), win_back (90d)
- Fallback to templates on AI failure

### Worker Files

**`src/workers/reactivation-worker.js`**
- PM2 entry point
- Starts ClientReactivationService
- Graceful shutdown on SIGTERM

### Background Jobs (Week 2)

**`scripts/calculate-service-averages.js`**
- Weekly SQL aggregation
- Updates `service_reactivation_intervals` table
- Run: Sundays 3:00 AM

### Existing Files (Reference)

**`src/services/booking-monitor/index.js` (Lines 30-77)**
- **Template for our service structure**
- Pattern: `start()` with `setInterval()`, `stop()` with `clearInterval()`

**`src/integrations/yclients/client.js`**
- Already has all needed methods
- No modifications required

**`src/integrations/whatsapp/whatsapp-manager-unified.js`**
- `sendMessage(phone, message, { companyId })`
- Multi-tenant ready

**`src/services/ai/provider-factory.js`**
- `createProvider('gemini-flash')`
- Returns provider with `generateText()`

---

## 🗄️ Database Schema (MVP)

### New Tables (Create All 4, Use 3)

**1. service_reactivation_intervals** (ACTIVE in MVP)
```sql
CREATE TABLE service_reactivation_intervals (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  service_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  median_interval_days INTEGER NOT NULL,  -- Prefer median!
  sample_size INTEGER NOT NULL,  -- Min 10
  last_calculated TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(company_id, service_id)
);
```

**Purpose:** Level 2 - Company-specific service patterns
**Coverage:** 60-70% of clients
**Update:** Weekly via background job

**2. industry_standard_intervals** (ACTIVE in MVP)
```sql
CREATE TABLE industry_standard_intervals (
  id SERIAL PRIMARY KEY,
  category_key TEXT UNIQUE,
  category_name TEXT,
  interval_days INTEGER NOT NULL,
  keywords TEXT[],  -- For matching
  service_type TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.75
);
```

**Purpose:** Level 3 - Global best practices
**Coverage:** 20-25% of clients
**Data:** Pre-seeded with 15+ entries

**3. client_reactivation_history** (ACTIVE in MVP)
```sql
CREATE TABLE client_reactivation_history (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  phone TEXT NOT NULL,
  message_sent_at TIMESTAMP DEFAULT NOW(),
  message_text TEXT,
  interval_days INTEGER,
  interval_source TEXT NOT NULL,  -- 'service_average', 'industry_standard', 'universal'
  confidence_score DECIMAL(3,2),
  response_received BOOLEAN DEFAULT FALSE,
  booking_created BOOLEAN DEFAULT FALSE
);
```

**Purpose:** Audit log + Analytics
**Usage:** Track conversion rates, performance

**4. client_personalized_intervals** (Schema only, NOT used in MVP)
```sql
CREATE TABLE client_personalized_intervals (
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  client_id BIGINT NOT NULL,
  service_id INTEGER NOT NULL,
  personal_interval_days INTEGER NOT NULL,
  visit_count INTEGER NOT NULL,
  consistency_score DECIMAL(3,2),
  UNIQUE(company_id, client_id, service_id)
);
```

**Purpose:** Level 1 (deferred to Month 2)
**Status:** Create schema now for future use, don't populate

### Existing Tables (Read-Only)

**`appointments_cache`** ✅ EXISTS!
- Full booking history with attendance
- Used for calculating service averages
- Filter: `attendance = 1` (completed only)

**`clients`**
- `last_visit_date` - Find inactive clients
- `visit_count` - Exclude brand new
- `last_services` - Message personalization

**`bookings`**
- Current active bookings
- Skip clients with upcoming bookings

---

## 🧠 Key Architectural Decisions

### Decision 1: 3-Level Waterfall (Not 4-Level)

**Chosen:** Level 2 → Level 3 → Level 4 (Skip Level 1 in MVP)

**Rationale (from plan-reviewer):**
- Level 1 coverage: 10-15% (not worth 3-4 days)
- Level 2 coverage: 60-70% (worth 1 day!)
- 3-level = 100% coverage with 50% less dev time

**Trade-off:** Slightly lower accuracy for 10-15% of clients initially, but faster time-to-market

---

### Decision 2: AI Messages as Primary WOW Factor

**Chosen:** Focus dev time on AI message generation, not complex intervals

**Rationale:**
- **Visible:** Clients see unique AI messages
- **Invisible:** Clients don't see waterfall complexity
- **Impact:** AI messages drive conversion more than perfect intervals

**Priority:**
1. AI message quality > Interval precision
2. Ship fast with good > Ship slow with perfect

---

### Decision 3: Median Over Average

**Chosen:** Use `median_interval_days` instead of `avg_interval_days`

**Rationale:**
- Outlier resistant (one client who came once 6 months ago doesn't skew)
- Better represents "typical" client behavior

**Example:**
```
Visits: [25, 26, 28, 27, 180] days
Average: 57 days (WRONG!)
Median: 27 days (CORRECT!)
```

---

### Decision 4: Interval-Based Service (Not Event-Driven)

**Chosen:** `setInterval()` pattern, runs daily at 10:00 AM

**Rationale:**
- Proven pattern (BookingMonitorService)
- Predictable, easy to debug
- Daily frequency sufficient for reactivation

---

### Decision 5: Create All 4 Tables Now

**Chosen:** Create schema for all 4 tables, but only populate 3 in MVP

**Rationale:**
- Avoid schema migration later
- Level 1 ready when needed (Month 2)
- Minimal cost (empty table)

---

## 🚨 Critical Implementation Notes

### Multi-Tenant Isolation

**CRITICAL:** Every query must filter by `company_id`

**Correct:**
```javascript
const { data } = await supabase
  .from('service_reactivation_intervals')
  .select('*')
  .eq('company_id', companyId)  // ✅ ALWAYS
  .eq('service_id', serviceId);
```

**WRONG:**
```javascript
const { data } = await supabase
  .from('service_reactivation_intervals')
  .select('*')
  .eq('service_id', serviceId);  // ❌ MISSING company_id
```

---

### Deduplication Strategy

**Check before sending:**
```javascript
const { data: recentMessages } = await supabase
  .from('client_reactivation_history')
  .select('*')
  .eq('client_id', clientId)
  .eq('company_id', companyId)
  .gte('message_sent_at', todayStart);

if (recentMessages && recentMessages.length > 0) {
  logger.debug('Already contacted today, skipping');
  return;
}
```

---

### Error Handling Per Client

**Pattern:**
```javascript
for (const client of inactiveClients) {
  try {
    await processInactiveClient(client);
  } catch (error) {
    logger.error(`Failed for client ${client.id}:`, error);
    // CONTINUE to next client
  }
}
```

**Don't use `Promise.all()` - first error stops everything!**

---

## 📊 Performance Considerations

### Database Indexes (CRITICAL)

```sql
-- For finding inactive clients
CREATE INDEX idx_clients_last_visit
ON clients(company_id, last_visit_date);

-- For interval lookups
CREATE INDEX idx_service_intervals
ON service_reactivation_intervals(company_id, service_id, is_active);

-- For industry standard matching
CREATE INDEX idx_industry_standards
ON industry_standard_intervals USING GIN(keywords);

-- For deduplication
CREATE INDEX idx_reactivation_history_recent
ON client_reactivation_history(client_id, message_sent_at);
```

**Without these:** Queries timeout on 10K+ clients

---

### Batch Processing Limits

**Gemini Rate Limits:**
- 15 requests/minute (Flash tier)
- Solution: 4 second delay between calls
- 100 clients = ~7 minutes (acceptable)

**WhatsApp:**
- No hard limit, but avoid bursts
- Solution: 1 second delay
- 100 clients = ~2 minutes

**Total time budget:** 10 minutes for 100 clients

---

## 🧪 Testing Strategy

### Unit Tests

**interval-selector.test.js:**
- ✅ Service with 10+ bookings → Returns service average
- ✅ Service with < 10 bookings → Falls to industry standard
- ✅ Service name "Стрижка" → Matches "haircut_male"
- ✅ No match → Returns universal (30/60/90)
- ✅ Never returns null

**message-generator.test.js:**
- ✅ Generates unique messages
- ✅ Falls back to template when AI fails
- ✅ Message length < 250 chars
- ✅ No placeholders in output

### Integration Test

**Full flow:**
1. Create test client (35 days inactive)
2. Run `findInactiveClients()`
3. Verify client in results
4. Run `processInactiveClient()`
5. Verify WhatsApp message sent
6. Verify record in history

---

## 🔄 Phased Rollout Strategy

### Phase 1: MVP (3 Days)
```
Day 1: Database (all 4 tables)
Day 2: IntervalSelector (3 levels) + MessageGenerator
Day 3: ReactivationService + Worker + Testing
```

### Phase 2: Week 2
- Collect conversion data
- Tune AI prompts
- Add opt-out mechanism
- Add A/B testing

### Phase 3: Month 2 (Optional)
- Add Level 1 (Personalized)
- Becomes 4-level waterfall
- Decision based on ROI

---

## 📚 Integration Points

**YClientsClient:**
- Method: `getRecords()` - If needed for validation
- No modifications required

**WhatsAppManager:**
- Method: `sendMessage(phone, message, { companyId })`
- Already multi-tenant

**Gemini Provider:**
- Method: `createProvider('gemini-flash')`
- Returns provider with `generateText()`

**Supabase:**
- All DB operations
- Use existing connection

**Logger:**
- Winston with Telegram
- Pattern: `logger.info()`, `logger.error()`

---

## 🐛 Potential Issues & Mitigations

**Issue 1: SQL Aggregation Slow**
- Symptom: `calculate_service_averages()` takes > 30 sec
- Solution: Add indexes, LIMIT in subqueries, batch companies
- Test: `EXPLAIN ANALYZE` on production data size

**Issue 2: Gemini API Down**
- Symptom: All messages fail
- Solution: Automatic fallback to static templates
- Test: Simulate API error, verify fallback

**Issue 3: Duplicate Messages**
- Symptom: Client gets 2+ messages same day
- Solution: Deduplication check in `client_reactivation_history`
- Test: Run service twice, verify no duplicates

---

## 🎯 Month 2 Enhancement Path

**When:** After 30 days of MVP operation
**Decision Criteria:**
- Conversion rate from Levels 2-4 meets/exceeds 15%
- Have real data on which services need personalization
- Technical capacity available

**Tasks:**
1. Write SQL to populate `client_personalized_intervals`
2. Add `tryPersonalizedInterval()` to IntervalSelector
3. Update waterfall to check Level 1 first
4. Test with 10-20 clients
5. Deploy if results > 5% better than Level 2

**Estimated:** +2-3 days

---

## 📝 Changes from Original Context

**Original:** 4-level waterfall, complex per-client SQL
**Revised:** 3-level waterfall, simpler implementation

**Key Simplifications:**
- No `client_personalized_intervals` population in MVP
- No window functions (LEAD/LAG) in initial SQL
- No consistency scoring algorithm
- Defer complex logic to Month 2

**Benefits:**
- 50% faster development (3 days vs 6-7)
- Lower risk (simpler SQL)
- Still covers 100% of clients
- Can add Level 1 later if ROI justifies

---

**Context Status:** ✅ Complete - Ready for Implementation
**Last Review:** 2025-01-08 (plan-reviewer approved)
**Next Step:** Day 1 - Database migrations
