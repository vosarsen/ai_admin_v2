# Client Reactivation Service - Task Checklist (MVP)

**Last Updated:** 2025-01-08 (Revised for 3-level waterfall)
**Status:** 📋 Ready to Start
**Timeline:** 3 days + 0.5 buffer = 3.5 days
**Progress:** 0% (0/35 tasks completed)

---

## ✅ Task Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ⏸️ Deferred to Month 2
- ❌ Cancelled

---

## 📦 Day 1: Database Foundation (8 hours)

### Database Migrations
- ⬜ Create `migrations/20250108_reactivation_mvp_schema.sql`
  - ⬜ Table: `service_reactivation_intervals`
  - ⬜ Table: `industry_standard_intervals`
  - ⬜ Table: `client_reactivation_history`
  - ⬜ Table: `client_personalized_intervals` (schema only, not populated)

### Indexes
- ⬜ Add performance indexes
  - ⬜ Index: `idx_clients_last_visit` on `clients(company_id, last_visit_date)`
  - ⬜ Index: `idx_service_intervals` on `service_reactivation_intervals(company_id, service_id, is_active)`
  - ⬜ Index: `idx_industry_standards` on `industry_standard_intervals USING GIN(keywords)`
  - ⬜ Index: `idx_reactivation_history_recent` on `client_reactivation_history(client_id, message_sent_at)`

### Seed Data (Industry Standards)
- ⬜ Create 15+ industry standard entries
  - ⬜ Haircut (Male): 28 days, keywords: ['стрижка', 'мужская']
  - ⬜ Haircut (Female): 40 days, keywords: ['стрижка', 'женская']
  - ⬜ Coloring: 50 days, keywords: ['окрашивание', 'цвет']
  - ⬜ Manicure (Gel): 21 days, keywords: ['маникюр', 'гель']
  - ⬜ Manicure (Regular): 14 days, keywords: ['маникюр', 'обычный']
  - ⬜ Pedicure: 30 days, keywords: ['педикюр']
  - ⬜ Beard: 21 days, keywords: ['борода', 'борд']
  - ⬜ Facial: 28 days, keywords: ['чистка', 'лицо']
  - ⬜ Massage (Face): 14 days, keywords: ['массаж', 'лица']
  - ⬜ Peeling: 21 days, keywords: ['пилинг']
  - ⬜ Epilation (Legs): 35 days, keywords: ['эпиляция', 'ноги']
  - ⬜ Epilation (Bikini): 28 days, keywords: ['эпиляция', 'бикини']
  - ⬜ Epilation (Underarms): 21 days, keywords: ['эпиляция', 'подмышки']
  - ⬜ Balayage: 90 days, keywords: ['балаяж']
  - ⬜ Hair Extensions: 60 days, keywords: ['наращивание', 'волос']

### SQL Functions
- ⬜ Create `calculate_service_averages(p_company_id BIGINT)` function
  - ⬜ WITH clause: service_intervals (unnest service_ids, LEAD for next_visit)
  - ⬜ SELECT: service_id, title, PERCENTILE_CONT for median
  - ⬜ HAVING: COUNT(*) >= 10 (minimum sample size)
  - ⬜ Test with company 962302

### Testing
- ⬜ Create `scripts/test-reactivation-schema.js`
  - ⬜ Test: All 4 tables exist
  - ⬜ Test: Indexes created successfully
  - ⬜ Test: Seed data loaded (15+ records)
  - ⬜ Test: SQL function returns results
- ⬜ Apply migrations to local database
- ⬜ Apply migrations to production (Timeweb PostgreSQL)

**Day 1 Acceptance Criteria:**
- [ ] All 4 tables created
- [ ] 15+ industry standards seeded
- [ ] SQL function works correctly
- [ ] Query performance < 100ms

---

## 🧠 Day 2: Core Logic (8 hours)

### IntervalSelector (3-Level Waterfall)
- ⬜ Create `src/services/client-reactivation/interval-selector.js`
  - ⬜ Class: `IntervalSelector`
  - ⬜ Method: `selectOptimalInterval(client, lastService)` - Main waterfall
  - ⬜ Method: `tryServiceAverageInterval(client, lastService)` - Level 2
  - ⬜ Method: `tryIndustryStandardInterval(lastService)` - Level 3
  - ⬜ Method: `getUniversalFallback(client, lastService)` - Level 4
  - ⬜ Helper: `matchServiceToIndustry(serviceTitle)` - Keyword matching

### MessageGenerator (AI-Powered)
- ⬜ Create `src/services/client-reactivation/message-generator.js`
  - ⬜ Class: `ReactivationMessageGenerator`
  - ⬜ Method: `generateReactivationMessage(clientData)`
  - ⬜ Prompts: 3 types (gentle, offer, win_back)
  - ⬜ Gemini integration: `createProvider('gemini-flash')`
  - ⬜ Error handling: Try-catch with fallback
  - ⬜ Rate limiting: 4 second delay between calls

### Fallback Templates
- ⬜ Create `src/services/client-reactivation/templates.js`
  - ⬜ Template: `gentle` (30 days) - "Привет, ${name}! Давно не виделись 😊"
  - ⬜ Template: `offer` (60 days) - "${name}, у нас для тебя скидка 10%!"
  - ⬜ Template: `win_back` (90 days) - "${name}, мы очень ценим тебя. 20% скидка!"

### Unit Tests
- ⬜ Create `src/services/client-reactivation/__tests__/interval-selector.test.js`
  - ⬜ Test: Service with 10+ bookings → Returns service average
  - ⬜ Test: Service with < 10 bookings → Falls to industry standard
  - ⬜ Test: Service "Стрижка мужская" → Matches "haircut_male"
  - ⬜ Test: No match → Returns universal (30/60/90)
  - ⬜ Test: Confidence scores correct
  - ⬜ Test: Never returns null

- ⬜ Create `src/services/client-reactivation/__tests__/message-generator.test.js`
  - ⬜ Test: Generates unique messages for different clients
  - ⬜ Test: Falls back to template when AI fails
  - ⬜ Test: Message length < 250 characters
  - ⬜ Test: No placeholders in output (e.g., `{clientName}`)

**Day 2 Acceptance Criteria:**
- [ ] IntervalSelector returns interval for 100% of clients
- [ ] AI generates personalized messages
- [ ] Fallback templates work when AI unavailable
- [ ] All unit tests pass

---

## 🚀 Day 3: Service Integration & Deployment (8 hours)

### ClientReactivationService
- ⬜ Create `src/services/client-reactivation/index.js`
  - ⬜ Class: `ClientReactivationService`
  - ⬜ Constructor: Initialize IntervalSelector, MessageGenerator, WhatsAppManager
  - ⬜ Method: `start()` - Start interval checking (immediate + setInterval)
  - ⬜ Method: `stop()` - Stop interval (clearInterval)
  - ⬜ Method: `runReactivationCampaign()` - Main orchestrator
  - ⬜ Method: `findInactiveClients()` - SQL query (30/60/90 days)
  - ⬜ Method: `processInactiveClient(client)` - Process one client
  - ⬜ Deduplication: Check `client_reactivation_history` for today
  - ⬜ Error handling: Try-catch per client (continue on error)
  - ⬜ Logging: Log every action with context
  - ⬜ Singleton export: `module.exports = new ClientReactivationService()`

### Worker & PM2
- ⬜ Create `src/workers/reactivation-worker.js`
  - ⬜ Import: ClientReactivationService
  - ⬜ Function: `startReactivationWorker()`
  - ⬜ Call: `service.start()`
  - ⬜ Handler: SIGTERM for graceful shutdown

- ⬜ Modify `ecosystem.config.js`
  - ⬜ Add app: `ai-admin-client-reactivation`
  - ⬜ Set script: `./src/workers/reactivation-worker.js`
  - ⬜ Set instances: 1
  - ⬜ Set env: `CHECK_INTERVAL: 86400000` (24 hours)
  - ⬜ Set logs: `./logs/reactivation-*.log`
  - ⬜ Set memory: `max_memory_restart: 200M`

### Testing
- ⬜ Small batch test (5-10 clients)
  - ⬜ Select test clients manually (inactive 35+ days)
  - ⬜ Run reactivation service locally
  - ⬜ Verify WhatsApp messages delivered
  - ⬜ Check records in `client_reactivation_history`
  - ⬜ Verify no duplicate messages

- ⬜ Performance test (100+ clients)
  - ⬜ Run with full inactive client list
  - ⬜ Measure total execution time
  - ⬜ Verify no crashes
  - ⬜ Check Gemini API rate limits respected

- ⬜ Edge case testing
  - ⬜ Test: Client contacted yesterday → Skipped
  - ⬜ Test: Client with upcoming booking → Skipped
  - ⬜ Test: Service with no average → Falls to industry standard
  - ⬜ Test: Service with no industry match → Falls to universal

### Deployment
- ⬜ Local PM2 test
  - ⬜ Start: `pm2 start ecosystem.config.js --only ai-admin-client-reactivation`
  - ⬜ Logs: `pm2 logs ai-admin-client-reactivation`
  - ⬜ Stop: `pm2 stop ai-admin-client-reactivation`

- ⬜ Production deployment
  - ⬜ Push to server via git
  - ⬜ SSH to server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
  - ⬜ Pull latest: `cd /opt/ai-admin && git pull`
  - ⬜ Start worker: `pm2 start ecosystem.config.js --only ai-admin-client-reactivation --update-env`
  - ⬜ Monitor logs: `pm2 logs ai-admin-client-reactivation --lines 50`

**Day 3 Acceptance Criteria:**
- [ ] Processes 100+ clients without crashing
- [ ] Skips clients contacted in last 24h
- [ ] All messages delivered successfully
- [ ] First production run completes
- [ ] PM2 worker running stably

---

## 🔄 Week 2: Background Jobs (2 hours)

### Service Average Calculation Script
- ⬜ Create `scripts/calculate-service-averages.js`
  - ⬜ Function: `calculateServiceAverages(companyId)`
  - ⬜ Call SQL function: `calculate_service_averages(companyId)`
  - ⬜ Upsert results to `service_reactivation_intervals`
  - ⬜ Logging: Progress for each company

- ⬜ Create `scripts/update-all-companies.js`
  - ⬜ Get all company IDs from `clients` table (distinct)
  - ⬜ Loop: Call `calculateServiceAverages(companyId)` for each
  - ⬜ Delay: 5 seconds between companies (avoid DB overload)
  - ⬜ Telegram: Send summary notification

### Cron Schedule
- ⬜ Add weekly cron job (system cron or PM2 cron)
  - ⬜ Schedule: Sundays 3:00 AM
  - ⬜ Command: `node scripts/update-all-companies.js`

**Week 2 Acceptance Criteria:**
- [ ] Script updates all companies successfully
- [ ] Completes in < 30 minutes
- [ ] Telegram summary sent

---

## 📝 Documentation (0.5 days)

### Feature Documentation
- ⬜ Create `docs/features/CLIENT_REACTIVATION_SERVICE.md`
  - ⬜ Section: Overview (3-level waterfall)
  - ⬜ Section: How It Works
  - ⬜ Section: Configuration
  - ⬜ Section: Monitoring
  - ⬜ Section: Troubleshooting

### Development Diary
- ⬜ Create `docs/development-diary/2025-01-08-client-reactivation-mvp-launch.md`
  - ⬜ Section: Why 3-level instead of 4-level
  - ⬜ Section: Plan-reviewer insights
  - ⬜ Section: Implementation timeline
  - ⬜ Section: Results (after Week 1)

### Update Existing Docs
- ⬜ Modify `CLAUDE.md`
  - ⬜ Add: Client Reactivation Service section
  - ⬜ Add: New tables documentation
  - ⬜ Add: PM2 monitoring commands

---

## 🎯 Month 2: Optional Enhancement (⏸️ Deferred)

### Add Level 1 (Personalized)
- ⏸️ Write SQL to populate `client_personalized_intervals`
- ⏸️ Add `tryPersonalizedInterval()` to IntervalSelector
- ⏸️ Update waterfall to check Level 1 first
- ⏸️ Test with 10-20 clients
- ⏸️ Deploy if conversion rate improves by 5%+

**Timeline:** +2-3 days (if ROI justifies)

---

## 📊 Progress Tracking

### Phase Completion
- [ ] Day 1: Database Foundation (0/15 tasks)
- [ ] Day 2: Core Logic (0/13 tasks)
- [ ] Day 3: Integration & Deployment (0/25 tasks)
- [ ] Week 2: Background Jobs (0/5 tasks)
- [ ] Documentation (0/7 tasks)

### Overall Progress
**0% Complete** (0/65 MVP tasks)

---

## ✅ Final Checklist (Before Merge)

### Code Quality
- ⬜ All files follow project code style
- ⬜ No console.log (use logger)
- ⬜ ESLint passes
- ⬜ All TODOs resolved

### Testing
- ⬜ All unit tests passing
- ⬜ Integration test passing
- ⬜ Manual production test successful

### Documentation
- ⬜ Feature docs complete
- ⬜ CLAUDE.md updated
- ⬜ Development diary created

### Production
- ⬜ Database migrations applied
- ⬜ PM2 worker running
- ⬜ First campaign completed successfully
- ⬜ No crashes in 24 hours

### Code Review
- ⬜ Multi-tenant isolation verified (`company_id` in all queries)
- ⬜ Error handling reviewed (per-client try-catch)
- ⬜ Performance checked (indexes, query times)

---

**Task Status:** 📋 Ready to Begin
**Next Task:** Day 1 - Create database migrations
**Timeline:** 3.5 days (3 days + 0.5 buffer)
