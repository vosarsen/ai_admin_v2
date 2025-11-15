# Client Reactivation Service v2 - Task Checklist

**Last Updated:** 2025-11-12
**Status:** 📋 Ready to Start
**Timeline:** 4 days (3.5 days + 0.5 buffer)
**Progress:** 0% (0/78 tasks completed)

---

## ✅ Task Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ⏸️ Deferred to Month 2
- ❌ Blocked

---

## 📦 DAY 1: Database Foundation (6-8 hours)

### 1.1 Verify appointments_cache Table (CRITICAL!)
- ⬜ Check table existence: `SELECT * FROM information_schema.tables WHERE table_name = 'appointments_cache'`
- ⬜ If exists: Verify columns (client_id, service_ids[], appointment_datetime, attendance, company_id)
- ⬜ If exists: Check data completeness (6+ months, company 962302)
- ⬜ If missing: Create table schema
- ⬜ If missing: Populate from bookings table + YClients history
- ⬜ If missing: Add 1 day to timeline estimate

**Acceptance:** appointments_cache exists with 6+ months of data for company 962302

### 1.2 Create Migration File
- ⬜ Create `migrations/20251112_reactivation_mvp_schema.sql`
- ⬜ Add header comments (purpose, date, author)
- ⬜ Add rollback section (DROP TABLE statements)

### 1.3 Create Table: service_reactivation_intervals
- ⬜ Define columns (id, company_id, service_id, service_name, median_interval_days, etc.)
- ⬜ Add UNIQUE constraint (company_id, service_id)
- ⬜ Add NOT NULL constraints
- ⬜ Create index: idx_service_intervals_lookup (company_id, service_id, is_active)

### 1.4 Create Table: industry_standard_intervals
- ⬜ Define columns (id, category_key, category_name, interval_days, keywords[], etc.)
- ⬜ Add UNIQUE constraint on category_key
- ⬜ Create GIN index: idx_industry_keywords (keywords)

### 1.5 Seed Industry Standards
- ⬜ Insert: haircut_male (28 days, keywords: ['стрижка', 'мужская'])
- ⬜ Insert: haircut_female (40 days, keywords: ['стрижка', 'женская'])
- ⬜ Insert: coloring (50 days, keywords: ['окрашивание', 'цвет'])
- ⬜ Insert: manicure_gel (21 days, keywords: ['маникюр', 'гель'])
- ⬜ Insert: manicure_regular (14 days, keywords: ['маникюр', 'обычный'])
- ⬜ Insert: pedicure (30 days, keywords: ['педикюр'])
- ⬜ Insert: beard (21 days, keywords: ['борода'])
- ⬜ Insert: facial (28 days, keywords: ['чистка', 'лицо'])
- ⬜ Insert: massage_face (14 days, keywords: ['массаж', 'лица'])
- ⬜ Insert: peeling (21 days, keywords: ['пилинг'])
- ⬜ Insert: epilation_legs (35 days, keywords: ['эпиляция', 'ноги'])
- ⬜ Insert: epilation_bikini (28 days, keywords: ['эпиляция', 'бикини'])
- ⬜ Insert: epilation_underarms (21 days, keywords: ['эпиляция', 'подмышки'])
- ⬜ Insert: balayage (90 days, keywords: ['балаяж'])
- ⬜ Insert: hair_extensions (60 days, keywords: ['наращивание', 'волос'])
- ⬜ Insert: botox_hair (45 days, keywords: ['ботокс', 'волос'])
- ⬜ Verify: 15+ standards inserted

### 1.6 Create Table: client_reactivation_history
- ⬜ Define columns (id, company_id, client_id, phone, message_sent_at, etc.)
- ⬜ Add response tracking columns (response_received, response_at, response_type, response_text)
- ⬜ Add booking tracking columns (booking_created, booking_id, booking_created_at)
- ⬜ Create index: idx_reactivation_phone (phone)
- ⬜ Create index: idx_reactivation_company (company_id)
- ⬜ Create index: idx_reactivation_client (client_id)
- ⬜ Create index: idx_reactivation_status (response_received, booking_created, message_sent_at DESC)
- ⬜ Create index: idx_reactivation_dates (message_sent_at, response_at, booking_created_at)

### 1.7 Create Table: client_personalized_intervals (Schema Only)
- ⬜ Define columns (id, company_id, client_id, service_id, personal_interval_days, etc.)
- ⬜ Add UNIQUE constraint (company_id, client_id, service_id)
- ⬜ Add comment: "Not used in MVP - for Month 2 enhancement"

### 1.8 Create SQL Function: calculate_service_averages
- ⬜ Define function signature: `calculate_service_averages(p_company_id BIGINT)`
- ⬜ Add CTE: service_intervals (unnest service_ids, LEAD for next_visit)
- ⬜ Add CTE: interval_calculations (days between visits)
- ⬜ Add SELECT: service_id, service_name, PERCENTILE_CONT for median
- ⬜ Add JOIN: services table for service names
- ⬜ Add HAVING: COUNT(*) >= 10 (minimum sample size)
- ⬜ Add WHERE: Filter attendance = 1 (completed visits only)
- ⬜ Add WHERE: Filter last 6 months only
- ⬜ Test function: `SELECT * FROM calculate_service_averages(962302)`

### 1.9 Create Additional Indexes (Performance Critical)
- ⬜ Create index: idx_clients_last_visit (company_id, last_visit_date) - **MOST IMPORTANT**
- ⬜ Verify index usage: EXPLAIN ANALYZE on findInactiveClients query
- ⬜ Ensure query completes in < 100ms

### 1.10 Test Migration Locally
- ⬜ Create test script: `scripts/test-reactivation-schema.js`
- ⬜ Test: All 4 tables created
- ⬜ Test: All indexes exist
- ⬜ Test: Seed data loaded (15+ records)
- ⬜ Test: SQL function returns results
- ⬜ Run migration on local database
- ⬜ Verify no errors

### 1.11 Apply Migration to Production
- ⬜ Backup production database first
- ⬜ Run migration on Timeweb PostgreSQL
- ⬜ Verify all tables created: `\dt` in psql
- ⬜ Verify seed data: `SELECT COUNT(*) FROM industry_standard_intervals`
- ⬜ Test SQL function on production: `SELECT * FROM calculate_service_averages(962302)`
- ⬜ Check query performance: < 100ms

**Day 1 Acceptance Criteria:**
- [ ] appointments_cache table exists and has data
- [ ] All 4 new tables created successfully
- [ ] 15+ industry standards seeded
- [ ] SQL function returns correct aggregations
- [ ] All indexes created, query performance < 100ms
- [ ] Migration applied to production Timeweb

---

## 🧠 DAY 2: Core Logic (6-8 hours)

### 2.1 Create ReactivationRepository
- ⬜ Create file: `src/repositories/ReactivationRepository.js`
- ⬜ Extend BaseRepository
- ⬜ Method: `findInactiveClients(companyId, daysThreshold, limit=100)`
  - ⬜ SQL: Filter by company_id, last_visit_date, blacklisted=FALSE
  - ⬜ SQL: Exclude clients with upcoming bookings
  - ⬜ SQL: Exclude clients contacted in last 7 days
  - ⬜ SQL: Order by total_spent DESC, last_visit_date ASC
  - ⬜ SQL: LIMIT 100
- ⬜ Method: `getServiceAverage(companyId, serviceId)`
  - ⬜ SQL: SELECT from service_reactivation_intervals
  - ⬜ SQL: WHERE company_id, service_id, is_active=TRUE, sample_size >= 10
- ⬜ Method: `matchIndustryStandard(serviceName)`
  - ⬜ SQL: Match keywords using ILIKE ANY
  - ⬜ SQL: ORDER BY confidence_score DESC
  - ⬜ SQL: LIMIT 1
- ⬜ Method: `saveReactivationRecord(data)` - CREATE in client_reactivation_history
- ⬜ Method: `updateReactivationResponse(historyId, responseType, responseText)`
- ⬜ Method: `updateReactivationBooking(historyId, bookingId)`
- ⬜ Method: `checkContactedToday(clientId)` - Check if message sent today
- ⬜ Method: `getConversionStats(companyId, dateFrom, dateTo)` - Analytics query

### 2.2 Create IntervalSelector
- ⬜ Create file: `src/services/client-reactivation/interval-selector.js`
- ⬜ Constructor: Accept reactivationRepo
- ⬜ Method: `selectOptimalInterval(client, lastService)` - Main waterfall
  - ⬜ Try Level 2: tryServiceAverageInterval()
  - ⬜ Try Level 3: tryIndustryStandardInterval()
  - ⬜ Fallback Level 4: getUniversalFallback()
  - ⬜ Always return { interval, source, confidence, metadata }
- ⬜ Method: `tryServiceAverageInterval(client, lastService)`
  - ⬜ Call repo.getServiceAverage()
  - ⬜ Check sample_size >= 10
  - ⬜ Return { interval: median, source: 'service_average', confidence: 0.85 }
  - ⬜ Return null if no data
- ⬜ Method: `tryIndustryStandardInterval(lastService)`
  - ⬜ Call repo.matchIndustryStandard()
  - ⬜ Return { interval, source: 'industry_standard', confidence: 0.75 }
  - ⬜ Return null if no match
- ⬜ Method: `getUniversalFallback(client, lastService)`
  - ⬜ Logic: days < 45 ? 30 : (days < 75 ? 60 : 90)
  - ⬜ Return { interval, source: 'universal', confidence: 0.60 }
  - ⬜ Never returns null

### 2.3 Create MessageGenerator
- ⬜ Create file: `src/services/client-reactivation/message-generator.js`
- ⬜ Constructor: Set rateLimitDelay = 4000 (4 seconds)
- ⬜ Method: `generateMessage(clientData)`
  - ⬜ Extract: name, daysInactive, lastService
  - ⬜ Try: AI generation via Gemini
  - ⬜ Catch: Fallback to templates
  - ⬜ Return: message string
- ⬜ Method: `_buildPrompt(clientData)`
  - ⬜ Determine message type: gentle (< 45 days), offer (45-74), win_back (75+)
  - ⬜ Build prompt with instructions
  - ⬜ Include client name, days inactive, last service
  - ⬜ Specify tone, length, no emojis rule
- ⬜ Method: `_getFallbackTemplate(clientData)`
  - ⬜ Template gentle: "Привет, {name}! Давно не виделись..."
  - ⬜ Template offer: "{name}, мы помним о вас! Скидка 10%..."
  - ⬜ Template win_back: "{name}, мы очень ценим вас! Скидка 20%..."
- ⬜ Method: `_delay(ms)` - Rate limiting helper

### 2.4 Create Fallback Templates
- ⬜ Create file: `src/services/client-reactivation/templates.js`
- ⬜ Export: GENTLE_TEMPLATE
- ⬜ Export: OFFER_TEMPLATE
- ⬜ Export: WIN_BACK_TEMPLATE
- ⬜ Add placeholders: {name}, {daysInactive}, {lastService}

### 2.5 Unit Tests - IntervalSelector
- ⬜ Create file: `src/services/client-reactivation/__tests__/interval-selector.test.js`
- ⬜ Test: Service with 10+ bookings → Returns service average (Level 2)
- ⬜ Test: Service with < 10 bookings → Falls to industry standard (Level 3)
- ⬜ Test: Service "Стрижка мужская" → Matches "haircut_male"
- ⬜ Test: No match → Returns universal (30/60/90)
- ⬜ Test: Confidence scores correct (0.85, 0.75, 0.60)
- ⬜ Test: Never returns null
- ⬜ Test: Metadata includes correct info

### 2.6 Unit Tests - MessageGenerator
- ⬜ Create file: `src/services/client-reactivation/__tests__/message-generator.test.js`
- ⬜ Test: Generates unique messages for different clients
- ⬜ Test: Falls back to template when AI fails
- ⬜ Test: Message length < 250 characters
- ⬜ Test: No placeholders in output (e.g., `{clientName}` replaced)
- ⬜ Test: Rate limiting respected (4 sec delay between calls)
- ⬜ Mock: Gemini API responses

### 2.7 Run Unit Tests
- ⬜ Run: `npm test -- interval-selector.test.js`
- ⬜ Run: `npm test -- message-generator.test.js`
- ⬜ Verify: All tests pass
- ⬜ Verify: Coverage > 95%

**Day 2 Acceptance Criteria:**
- [ ] IntervalSelector returns interval for 100% of inputs (never null)
- [ ] All 3 levels tested and working
- [ ] MessageGenerator creates unique AI messages
- [ ] Fallback templates work when AI unavailable
- [ ] Rate limiting respected (4 sec delay)
- [ ] Unit tests pass (95%+ coverage)

---

## 🚀 DAY 3: Service Integration (6-8 hours)

### 3.1 Create ClientReactivationService
- ⬜ Create file: `src/services/client-reactivation/index.js`
- ⬜ Constructor: Initialize repo, intervalSelector, messageGenerator, whatsappClient
- ⬜ Property: checkInterval = 86400000 (24 hours)
- ⬜ Property: intervalId = null
- ⬜ Property: isRunning = false
- ⬜ Method: `start()`
  - ⬜ Check if already running
  - ⬜ Set isRunning = true
  - ⬜ Call runReactivationCampaign() immediately
  - ⬜ Set interval: setInterval(runReactivationCampaign, 24h)
- ⬜ Method: `stop()`
  - ⬜ Clear interval
  - ⬜ Set isRunning = false
- ⬜ Method: `runReactivationCampaign()`
  - ⬜ Define companyId = 962302 (single tenant MVP)
  - ⬜ Define thresholds = [30, 60, 90]
  - ⬜ Loop: For each threshold
    - ⬜ Find inactive clients
    - ⬜ Log count found
    - ⬜ Process each client with try-catch
    - ⬜ Delay 2 seconds between clients
- ⬜ Method: `processClient(client)`
  - ⬜ Check: Already contacted today? Skip if yes
  - ⬜ Get: Last service from client.last_services[0]
  - ⬜ Select: Optimal interval via intervalSelector
  - ⬜ Generate: Message via messageGenerator
  - ⬜ Send: WhatsApp message
  - ⬜ If success: Save reactivation record to database
  - ⬜ If success: Save reactivation context to Redis (CRITICAL!)
- ⬜ Method: `_saveReactivationContext(client, lastService, message, metadata)` 🔥
  - ⬜ Call: contextService.updateDialogContext()
  - ⬜ Set: pendingAction.type = 'reactivation_response'
  - ⬜ Set: pendingAction.campaign = getCampaignType()
  - ⬜ Set: pendingAction.suggestedService = { id, name }
  - ⬜ Set: pendingAction.daysInactive, intervalDays, etc.
  - ⬜ Call: contextService.addMessage() - bot message
  - ⬜ Call: contextService.saveClientCache() - update cache
  - ⬜ Try-catch: Non-blocking (log error, don't throw)
- ⬜ Method: `_getCampaignType(daysInactive)` - Helper
- ⬜ Method: `_delay(ms)` - Helper
- ⬜ Export: Singleton instance

### 3.2 Test Service Locally
- ⬜ Create test script: `scripts/test-reactivation-service.js`
- ⬜ Mock: whatsappClient.sendMessage()
- ⬜ Mock: contextService methods
- ⬜ Test: processClient() completes without errors
- ⬜ Test: Redis context saved correctly
- ⬜ Test: Deduplication works (skip if contacted today)
- ⬜ Test: Error handling (one client fails, others continue)

**Day 3 Part 1 Acceptance Criteria:**
- [ ] Service processes 100+ clients without crashing
- [ ] Skips clients contacted in last 24h
- [ ] All messages delivered successfully
- [ ] All records saved to client_reactivation_history
- [ ] All contexts saved to Redis

---

## 🔥 DAY 3.5: AI Admin Integration (4 hours)

### 4.1 Create ReactivationHandler
- ⬜ Create file: `src/services/ai-admin-v2/modules/reactivation-handler.js`
- ⬜ Constructor: Initialize ReactivationRepository
- ⬜ Method: `checkReactivationResponse(phone, companyId)`
  - ⬜ Load: dialogContext from contextService
  - ⬜ Check: pendingAction exists and type === 'reactivation_response'
  - ⬜ Return: { isReactivation: boolean, context?: pendingAction }
- ⬜ Method: `handleReactivationResponse(userMessage, phone, companyId, reactivationContext)`
  - ⬜ Classify: response type (positive/negative/neutral)
  - ⬜ Update: database response_received = TRUE
  - ⬜ Build: enriched prompt for AI
  - ⬜ Return: { responseType, enrichedPrompt, suggestedService, shouldStartBooking }
- ⬜ Method: `_classifyResponse(message)` - Keyword matching
  - ⬜ Define: positiveKeywords = ['да', 'хочу', 'конечно', 'запиш', ...]
  - ⬜ Define: negativeKeywords = ['нет', 'не хочу', 'не нужно', ...]
  - ⬜ Check: hasPositive && !hasNegative → 'positive'
  - ⬜ Check: hasNegative → 'negative'
  - ⬜ Default: 'neutral'
- ⬜ Method: `_buildEnrichedPrompt(userMessage, reactivationContext, responseType)`
  - ⬜ Include: Client inactive days, last service, campaign type
  - ⬜ Include: Message sent, response analysis
  - ⬜ Include: AI instruction based on response type
  - ⬜ Format: Clear, structured prompt for AI
- ⬜ Method: `markBookingCreated(phone, companyId, bookingId)`
  - ⬜ Load: dialogContext
  - ⬜ Get: reactivationHistoryId from pendingAction
  - ⬜ Update: booking_created = TRUE in database
  - ⬜ Clear: pendingAction from Redis
- ⬜ Export: Singleton instance

### 4.2 Integrate into Message Processor
- ⬜ Open file: `src/services/ai-admin-v2/modules/message-processor.js`
- ⬜ Import: reactivationHandler at top
- ⬜ Modify: `processMessage()` method
  - ⬜ Add: Before AI processing block
  - ⬜ Call: reactivationHandler.checkReactivationResponse()
  - ⬜ If isReactivation:
    - ⬜ Call: reactivationHandler.handleReactivationResponse()
    - ⬜ Enrich: context.reactivationContext
    - ⬜ Append: enrichedPrompt to systemPrompt
    - ⬜ Log: "📨 Processing reactivation response"
- ⬜ Modify: Command handler section
  - ⬜ Find: After CREATE_BOOKING success block
  - ⬜ Add: Call reactivationHandler.markBookingCreated()
  - ⬜ Log: "✅ Marked reactivation booking created"

### 4.3 Test AI Admin Integration
- ⬜ Manual test: Send reactivation message to 89686484488
- ⬜ Check Redis: `redis-cli GET "dialog:962302:89686484488"`
- ⬜ Verify: pendingAction exists with correct data
- ⬜ Respond: "Да, хочу записаться" via WhatsApp
- ⬜ Check logs: AI Admin detected reactivation response
- ⬜ Check logs: Response classified as 'positive'
- ⬜ Check AI response: Includes suggested service
- ⬜ Complete booking: Follow AI Admin flow
- ⬜ Check database: booking_created = TRUE, booking_id filled
- ⬜ Check Redis: pendingAction cleared

**Day 3.5 Acceptance Criteria:**
- [ ] AI Admin detects reactivation responses
- [ ] Response classification works (positive/negative/neutral)
- [ ] AI receives enriched prompt with context
- [ ] Booking creation updates booking_created flag
- [ ] pendingAction cleared after booking

---

## 🎯 DAY 4: PM2 Worker & Deployment (4 hours)

### 5.1 Create PM2 Worker
- ⬜ Create file: `src/workers/reactivation-worker.js`
- ⬜ Import: reactivationService
- ⬜ Function: `startReactivationWorker()`
  - ⬜ Call: reactivationService.start()
  - ⬜ Log: Worker started
  - ⬜ Handle: SIGTERM - graceful shutdown
  - ⬜ Handle: SIGINT - graceful shutdown
- ⬜ Call: startReactivationWorker()
- ⬜ Catch: Unhandled errors, exit(1)

### 5.2 Update PM2 Configuration
- ⬜ Open file: `ecosystem.config.js`
- ⬜ Add new app: `ai-admin-reactivation`
  - ⬜ Set: script = './src/workers/reactivation-worker.js'
  - ⬜ Set: instances = 1
  - ⬜ Set: exec_mode = 'fork'
  - ⬜ Set: env.CHECK_INTERVAL = '86400000' (24 hours)
  - ⬜ Set: error_file = './logs/reactivation-error.log'
  - ⬜ Set: out_file = './logs/reactivation-out.log'
  - ⬜ Set: max_memory_restart = '200M'
  - ⬜ Set: autorestart = true

### 5.3 Create Background Job Script
- ⬜ Create file: `scripts/calculate-service-averages.js`
- ⬜ Import: ReactivationRepository
- ⬜ Function: `calculateServiceAverages(companyId)`
  - ⬜ Call: SQL function calculate_service_averages()
  - ⬜ Loop: For each result
    - ⬜ Upsert: service_reactivation_intervals table
  - ⬜ Log: Number of services updated
  - ⬜ Return: { success, servicesUpdated }
- ⬜ Execute: calculateServiceAverages(962302)
- ⬜ Handle: Errors, exit codes

### 5.4 Setup Cron Job
- ⬜ SSH to server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- ⬜ Edit crontab: `crontab -e`
- ⬜ Add line: `0 3 * * 0 cd /opt/ai-admin && node scripts/calculate-service-averages.js >> logs/service-averages.log 2>&1`
- ⬜ Save and exit
- ⬜ Verify: `crontab -l`

### 5.5 Local Testing
- ⬜ Test: `node src/workers/reactivation-worker.js`
- ⬜ Monitor: `tail -f logs/reactivation-out.log`
- ⬜ Verify: No errors, service starts
- ⬜ Stop: Ctrl+C, verify graceful shutdown
- ⬜ Test: `node scripts/calculate-service-averages.js`
- ⬜ Verify: Service averages calculated and saved

### 5.6 Git Commit
- ⬜ Stage files: `git add .`
- ⬜ Commit: `git commit -m "feat: Add client reactivation service with Redis integration

- 3-level interval selection (service/industry/universal)
- AI message generation via Gemini
- Redis context integration for AI Admin response handling
- Conversion tracking end-to-end
- PM2 worker for daily campaigns"`
- ⬜ Push: `git push origin main`

### 5.7 Production Deployment
- ⬜ SSH to server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- ⬜ Pull latest: `cd /opt/ai-admin && git pull origin main`
- ⬜ Run migrations: `psql $DATABASE_URL -f migrations/20251112_reactivation_mvp_schema.sql`
- ⬜ Check migrations: `psql $DATABASE_URL -c "\dt" | grep reactivation`
- ⬜ Install dependencies (if any): `npm install`
- ⬜ Start PM2 worker: `pm2 start ecosystem.config.js --only ai-admin-reactivation`
- ⬜ Save PM2 config: `pm2 save`
- ⬜ Check status: `pm2 status`
- ⬜ Monitor logs: `pm2 logs ai-admin-reactivation --lines 100`

### 5.8 Production Validation
- ⬜ Wait for first campaign run (or trigger manually)
- ⬜ Check logs: No errors
- ⬜ Check database: Records in client_reactivation_history
- ⬜ Check Redis: pendingAction set for contacted clients
- ⬜ Send test reactivation: To 89686484488
- ⬜ Respond: "Да, хочу записаться"
- ⬜ Verify: AI Admin detected and responded
- ⬜ Complete booking: Full flow
- ⬜ Check: booking_created = TRUE in database

### 5.9 Monitoring Setup
- ⬜ Create dashboard: Track daily messages sent
- ⬜ Create alert: PM2 restart count > 5
- ⬜ Create alert: Error rate > 10%
- ⬜ Document: Monitoring queries in docs

**Day 4 Acceptance Criteria:**
- [ ] PM2 worker starts successfully
- [ ] Worker runs without crashes for 24 hours
- [ ] Logs are clean (no errors)
- [ ] First campaign run completes successfully
- [ ] Test reactivation sent to 89686484488
- [ ] Test response detected by AI Admin
- [ ] Test booking created and tracked

---

## 📝 WEEK 2: Documentation & Stabilization (2 hours)

### Documentation
- ⬜ Create: `docs/features/CLIENT_REACTIVATION_SERVICE.md`
  - ⬜ Section: Overview (3-level waterfall)
  - ⬜ Section: How It Works
  - ⬜ Section: Configuration (env vars)
  - ⬜ Section: Monitoring (queries, logs)
  - ⬜ Section: Troubleshooting (common issues)
- ⬜ Update: `CLAUDE.md`
  - ⬜ Add: Client Reactivation Service section
  - ⬜ Add: New tables documentation
  - ⬜ Add: PM2 monitoring commands
  - ⬜ Add: Redis context structure
- ⬜ Create: `docs/03-development-diary/2025-11-12-client-reactivation-mvp.md`
  - ⬜ Section: Why 3-level not 4-level
  - ⬜ Section: Redis integration importance
  - ⬜ Section: Implementation timeline
  - ⬜ Section: Results after Week 1

### Stabilization
- ⬜ Monitor: Conversion rates for 7 days
- ⬜ Tune: AI prompts based on actual responses
- ⬜ Add: Opt-out mechanism for "stop", "отписаться"
- ⬜ Fix: Any bugs found in production
- ⬜ Optimize: Query performance if needed

---

## 🎯 MONTH 2: Optional Enhancement (⏸️ Deferred)

### Add Level 1 (Personalized Intervals)
- ⏸️ Decision: Add only if conversion rate > 15% AND ROI justifies
- ⏸️ Write SQL: Populate client_personalized_intervals table
- ⏸️ Add method: `tryPersonalizedInterval()` to IntervalSelector
- ⏸️ Update: Waterfall to check Level 1 first
- ⏸️ Test: With 10-20 clients
- ⏸️ A/B test: Level 1 vs Level 2-4
- ⏸️ Deploy: If results > 5% better than Level 2

**Timeline:** +2-3 days (if approved)

---

## ✅ FINAL CHECKLIST (Before Merge)

### Code Quality
- ⬜ All files follow project code style
- ⬜ No console.log (use logger)
- ⬜ ESLint passes: `npm run lint`
- ⬜ All TODOs resolved
- ⬜ No hardcoded values (use env vars or config)

### Testing
- ⬜ All unit tests passing: `npm test`
- ⬜ Integration test passing (full flow with 89686484488)
- ⬜ Manual production test successful
- ⬜ No errors in PM2 logs for 24 hours

### Documentation
- ⬜ Feature docs complete
- ⬜ CLAUDE.md updated
- ⬜ Development diary created
- ⬜ Code comments added where needed

### Database
- ⬜ All migrations applied to production
- ⬜ All indexes created and working
- ⬜ Seed data loaded (15+ industry standards)
- ⬜ Query performance verified (< 100ms)

### Production
- ⬜ PM2 worker running stable
- ⬜ First campaign completed successfully
- ⬜ Redis integration working (pendingAction saved/read)
- ⬜ AI Admin detecting reactivation responses
- ⬜ Conversions tracked end-to-end
- ⬜ No crashes in 24 hours

### Security & Privacy
- ⬜ Multi-tenant isolation verified (company_id in all queries)
- ⬜ No data leakage between companies
- ⬜ Blacklisted clients excluded
- ⬜ Test phone (89686484488) used for testing only

### Monitoring
- ⬜ Logging working correctly
- ⬜ Sentry error tracking configured
- ⬜ PM2 monitoring active
- ⬜ Database metrics tracked

---

## 📊 Progress Tracking

### Phase Completion
- [ ] Day 1: Database Foundation (0/45 tasks)
- [ ] Day 2: Core Logic (0/18 tasks)
- [ ] Day 3: Service Integration (0/10 tasks)
- [ ] Day 3.5: AI Admin Integration (0/9 tasks)
- [ ] Day 4: PM2 Worker & Deployment (0/28 tasks)
- [ ] Week 2: Documentation (0/11 tasks)

### Overall Progress
**0% Complete** (0/121 MVP tasks)

---

**Task Status:** 📋 Ready to Begin
**Next Task:** Day 1 - Verify appointments_cache table
**Timeline:** 4 days (3.5 days + 0.5 buffer)

---

**Last Updated:** 2025-11-12
**Version:** 2.0 (Redis Integration)
