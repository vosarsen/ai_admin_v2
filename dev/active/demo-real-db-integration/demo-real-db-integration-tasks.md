# Demo Real DB Integration - Task Checklist

**Last Updated**: 2025-11-27

## Overview

**Estimated Total Time**: 6-9 hours
**Priority**: High
**Target Completion**: 2-day sprint
**Note**: Analytics phase (Phase 5 in original plan) excluded per user request

---

## Phase 1: Database Setup (Demo Company Creation)
**Estimated Time**: 2-3 hours | **Priority**: Critical

### Section 1.1: Create Demo Company Record
**File**: `migrations/20251127_create_demo_company.sql`
**Effort**: S (Small - 15 min)

- [ ] Create SQL migration file
- [ ] Write INSERT statement for demo company (ID: 999999)
- [ ] Set `demo_mode: true` in settings JSON
- [ ] Configure subscription status as "demo"
- [ ] Set Moscow timezone
- [ ] Test migration on local/staging database
- [ ] Execute migration on production
- [ ] Verify: `SELECT * FROM companies WHERE id = 999999`

**Acceptance Criteria**:
- Company record created with ID 999999
- Settings contain `{"demo_mode": true, "allow_bookings": false}`
- Subscription status is "demo"
- Can query company successfully

**Dependencies**: PostgreSQL write access

---

### Section 1.2: Seed Demo Services (Realistic Beauty Salon)
**File**: `migrations/20251127_seed_demo_services.sql`
**Effort**: M (Medium - 30 min)

- [ ] Create SQL migration file
- [ ] Define 6 realistic services:
  - [ ] Женская стрижка (1500₽, 60 min)
  - [ ] Окрашивание волос (3000-5000₽, 180 min)
  - [ ] Маникюр (1200₽, 60 min)
  - [ ] Педикюр (1500₽, 90 min)
  - [ ] Укладка (800₽, 45 min)
  - [ ] Ботокс для волос (4000₽, 120 min)
- [ ] Add detailed descriptions for each service
- [ ] Assign appropriate categories
- [ ] Test migration on local/staging
- [ ] Execute migration on production
- [ ] Verify: `SELECT * FROM services WHERE company_id = 999999`

**Acceptance Criteria**:
- 6 services created for company 999999
- All services have detailed descriptions (for EXPLAIN_SERVICE)
- Pricing realistic for Moscow market
- Durations appropriate for service types

**Dependencies**: Section 1.1 complete (company must exist)

---

### Section 1.3: Create Demo Staff Profiles
**File**: `migrations/20251127_seed_demo_staff.sql`
**Effort**: S (Small - 15 min)

- [ ] Create SQL migration file
- [ ] Define 3 staff members:
  - [ ] Анна Мастер (Топ-стилист, rating 4.9)
  - [ ] Ольга Колорист (Колорист, rating 4.8)
  - [ ] Мария Нэйл-мастер (Мастер маникюра, rating 4.7)
- [ ] Set realistic specializations
- [ ] Mark all as active
- [ ] Test migration on local/staging
- [ ] Execute migration on production
- [ ] Verify: `SELECT * FROM staff WHERE company_id = 999999`

**Acceptance Criteria**:
- 3 staff members created for company 999999
- All have realistic ratings (4.7-4.9 range)
- Specializations match service types
- All marked as active

**Dependencies**: Section 1.1 complete

---

### Section 1.4: Generate Static Schedules (30 Days)
**File**: `scripts/generate-demo-schedules.js`
**Effort**: M (Medium - 45 min)

- [ ] Create Node.js script for schedule generation
- [ ] Implement date range logic (today + 30 days)
- [ ] Implement realistic patterns:
  - [ ] Mon-Sat: 10:00-20:00 (varied start times per staff)
  - [ ] Анна: starts 10:00
  - [ ] Ольга: starts 11:00
  - [ ] Мария: starts 11:00
  - [ ] Sunday: Every other Sunday off
- [ ] Bulk insert into staff_schedules table
- [ ] Test script locally (verify output)
- [ ] Execute script on production
- [ ] Verify: `SELECT COUNT(*) FROM staff_schedules WHERE company_id = 999999`
  - Expected: 90 records (3 staff × 30 days)

**Acceptance Criteria**:
- Script generates 90 schedule records
- Schedules show realistic patterns
- Dates cover next 30 days from execution
- All staff have consistent work patterns

**Dependencies**: Section 1.3 complete (staff must exist)

---

## Phase 2: Demo Mode Enforcement (Read-Only Protection)
**Estimated Time**: 1-2 hours | **Priority**: Critical

### Section 2.1: Block CREATE_BOOKING in Command Handler
**File**: `src/services/ai-admin-v2/modules/command-handler.js`
**Effort**: S (Small - 20 min)

- [ ] Open command-handler.js
- [ ] Locate `executeCommands()` method (line ~157)
- [ ] Add demo mode check before command execution:
  ```javascript
  if (context.isDemo && cmd.command === 'CREATE_BOOKING') {
    logger.warn('🚫 CREATE_BOOKING blocked in demo mode');
    results.push({
      type: 'booking_blocked',
      command: cmd.command,
      success: false,
      error: 'demo_mode',
      message: 'Это демо-версия. Для реальной записи свяжитесь с нами.'
    });
    continue;
  }
  ```
- [ ] Test locally with demo context
- [ ] Commit changes
- [ ] Deploy to production

**Acceptance Criteria**:
- CREATE_BOOKING blocked when `context.isDemo = true`
- Returns `success: false` with friendly message
- Logs warning to console
- Other commands execute normally

**Dependencies**: None

---

### Section 2.2: Filter CREATE_BOOKING in Two-Stage Processor (Optional)
**File**: `src/services/ai-admin-v2/modules/two-stage-processor.js`
**Effort**: S (Small - 15 min)

- [ ] Check if two-stage-processor.js exists
- [ ] If exists, add command filtering after Stage 1
- [ ] Filter out CREATE_BOOKING from command array:
  ```javascript
  if (context.isDemo && commands.length > 0) {
    commands = commands.filter(cmd => {
      if (cmd.name === 'CREATE_BOOKING') {
        logger.warn('🚫 CREATE_BOOKING filtered (Stage 1)');
        return false;
      }
      return true;
    });
  }
  ```
- [ ] Test locally
- [ ] Commit changes

**Acceptance Criteria**:
- CREATE_BOOKING removed from commands array before execution
- Logs warning when filtering occurs
- Other commands pass through

**Dependencies**: Section 2.1 complete (redundant layer)

---

### Section 2.3: Remove Mock Data from Demo Chat Route
**File**: `src/api/routes/demo-chat.js`
**Effort**: S (Small - 10 min)

- [ ] Open demo-chat.js
- [ ] Remove `DEMO_COMPANY_DATA` constant (lines 12-25)
- [ ] Remove `demoCompanyData` from `processMessage()` options (line ~332)
- [ ] Keep `isDemoMode: true` flag
- [ ] Update comments to reflect database usage
- [ ] Test demo chat locally
- [ ] Commit changes

**Acceptance Criteria**:
- DEMO_COMPANY_DATA constant removed
- No mock data passed to processMessage()
- isDemoMode flag still present
- Demo chat loads from database

**Dependencies**: Phase 1 complete (database must have demo company)

---

## Phase 3: Context Loading Optimization
**Estimated Time**: 1 hour | **Priority**: Medium

### Section 3.1: Use Real Context Manager for Demo
**File**: `src/services/ai-admin-v2/index.js`
**Effort**: M (Medium - 30 min)

- [ ] Open index.js
- [ ] Locate `processMessage()` method
- [ ] Replace `createDemoContext()` call with:
  ```javascript
  if (options.isDemoMode) {
    logger.info('📊 Demo mode, loading from database');
    context = await this.contextManager.loadFullContext(phone, companyId);
    context.isDemo = true;
  }
  ```
- [ ] Test locally (verify context has real services/staff)
- [ ] Verify response time (<10s)
- [ ] Commit changes

**Acceptance Criteria**:
- Demo mode uses `loadFullContext()` (not `createDemoContext()`)
- Context contains real database data
- `context.isDemo = true` flag set
- Response time similar to current (~9s)

**Dependencies**: Phase 1 complete

---

### Section 3.2: Prevent Client Record Creation for Demo
**File**: `src/services/context/context-manager-v2.js`
**Effort**: M (Medium - 30 min)

- [ ] Open context-manager-v2.js
- [ ] Locate client loading logic (e.g., `loadClientContext()`)
- [ ] Add demo check before creating client:
  ```javascript
  const isDemo = phone.startsWith('demo_');
  if (isDemo) {
    logger.info('📊 Demo session - not creating client');
    return {
      name: null,
      phone: phone,
      isNew: true,
      fromDemo: true
    };
  }
  ```
- [ ] Test locally (verify no client records created)
- [ ] Run query: `SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'`
  - Expected: 0
- [ ] Commit changes

**Acceptance Criteria**:
- Demo sessions don't create records in `clients` table
- Temporary client object returned
- `fromDemo: true` flag set
- Production clients still created normally

**Dependencies**: None

---

## Phase 4: AI Prompt Refinement
**Estimated Time**: 30 minutes | **Priority**: Medium

### Section 4.1: Update Demo Prompt Instructions
**File**: `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`
**Effort**: M (Medium - 30 min)

- [ ] Open two-stage-response-prompt.js
- [ ] Locate `getPrompt()` method
- [ ] Add demo mode section after base prompt:
  ```javascript
  if (context.isDemo) {
    basePrompt += `

  ⚠️ ДЕМО-РЕЖИМ: Это демонстрационная версия

  ПРАВИЛА:
  1. ✅ Показывай слоты, цены, объясняй услуги
  2. ❌ НЕ используй CREATE_BOOKING
  3. 🎯 Финальный ответ: "Отлично! Вот данные:
     • Услуга: [название]
     • Дата: [дата]
     • Время: [время]

     📌 Это демо. Для записи свяжитесь с нами."
    `;
  }
  ```
- [ ] Test locally (verify AI follows instructions)
- [ ] Check AI doesn't say "Я записал вас"
- [ ] Verify call-to-action included
- [ ] Commit changes

**Acceptance Criteria**:
- Demo prompt clearly explains limitations
- AI provides natural conversation flow
- Final message includes CTA (contact form)
- AI doesn't claim booking created

**Dependencies**: Section 2.1 complete

---

## Phase 5: Testing & Validation
**Estimated Time**: 2-3 hours | **Priority**: Critical

### Section 5.1: Integration Tests
**File**: `tests/integration/demo-chat.integration.test.js`
**Effort**: L (Large - 1.5 hours)

- [ ] Create integration test file
- [ ] Write test: "Should load real services from database"
- [ ] Write test: "Should show realistic available slots"
- [ ] Write test: "Should block CREATE_BOOKING command"
- [ ] Write test: "Should not create client records"
- [ ] Write test: "Should enforce rate limiting (10 msg/session)"
- [ ] Write test: "Should log analytics events"
- [ ] Run all tests locally: `npm run test:demo`
- [ ] Verify all 6 tests pass
- [ ] Commit test file

**Acceptance Criteria**:
- All 6 integration tests pass
- Tests run in <30 seconds
- Database isolation verified
- Rate limiting works correctly

**Dependencies**: Phases 1-4 complete

---

### Section 5.2: Manual QA Checklist
**File**: `docs/QA_DEMO_CHAT_MANUAL.md`
**Effort**: L (Large - 1.5 hours)

- [ ] Create manual QA document
- [ ] **Scenario 1**: View Services
  - [ ] Ask: "Какие у вас услуги?"
  - [ ] Verify: Shows 6 services with prices
- [ ] **Scenario 2**: Check Available Slots
  - [ ] Ask: "Свободное время на завтра на стрижку"
  - [ ] Verify: Shows realistic time slots (10:00-20:00 range)
- [ ] **Scenario 3**: Attempt to Book
  - [ ] Ask: "Хочу записаться на завтра в 14:00 к Анне"
  - [ ] Verify: Bot explains demo limitation, doesn't say "I booked you"
- [ ] **Scenario 4**: Service Explanation
  - [ ] Ask: "Расскажите про ботокс для волос"
  - [ ] Verify: Detailed description from database
- [ ] **Scenario 5**: Staff Schedule Check
  - [ ] Ask: "Завтра Ольга работает?"
  - [ ] Verify: Correct schedule information
- [ ] **Scenario 6**: Rate Limit
  - [ ] Send 11 messages in same session
  - [ ] Verify: 11th message returns 429 error
- [ ] **Scenario 7**: Database Isolation
  - [ ] Query: `SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'`
  - [ ] Verify: Count = 0 (no demo clients created)
- [ ] **Scenario 8**: Analytics Logging
  - [ ] Query: `SELECT * FROM demo_chat_events WHERE session_id = '{sessionId}'`
  - [ ] Verify: Events logged correctly

**Acceptance Criteria**:
- All 8 manual scenarios pass
- No unexpected errors
- Database remains clean
- User experience feels natural

**Dependencies**: Phases 1-4 deployed to production

---

## Post-Implementation Tasks

### Week 1: Intensive Monitoring
**Effort**: Ongoing

- [ ] **Day 1**: Check database isolation
  - [ ] Query: `SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'`
  - [ ] Expected: 0
- [ ] **Day 2**: Monitor Redis session count
  - [ ] Command: `redis-cli KEYS 'demo:session:*' | wc -l`
  - [ ] Expected: <50 (depends on traffic)
- [ ] **Day 3**: Review analytics events
  - [ ] Query: `SELECT COUNT(*) FROM demo_chat_events WHERE created_at > NOW() - INTERVAL '24 hours'`
- [ ] **Day 4**: Check response times
  - [ ] Review PM2 logs for "Demo chat response sent"
  - [ ] Expected: <10 seconds average
- [ ] **Day 5**: Database query performance
  - [ ] Query: `SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10`
  - [ ] Verify demo queries <50ms
- [ ] **Day 6**: Rate limiting effectiveness
  - [ ] Review logs for "demo_limit_reached" events
- [ ] **Day 7**: Weekly analytics review
  - [ ] GET `/api/demo-chat/analytics?period=week`

---

### Week 2-4: Regular Monitoring
**Effort**: Weekly

- [ ] **Weekly**: Run integration test suite
  - [ ] Command: `npm run test:demo`
  - [ ] Expected: All tests pass
- [ ] **Weekly**: Review analytics dashboard
  - [ ] GET `/api/demo-chat/analytics?period=week`
  - [ ] Track conversion rate trend
- [ ] **Weekly**: Database audit
  - [ ] Verify no demo pollution (clients, bookings)

---

## Rollback Procedures

### Immediate Rollback (<5 min)
**If demo chat breaks**

- [ ] Revert code changes:
  ```bash
  git revert <commit-hash>
  git push origin main
  ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-api"
  ```
- [ ] Re-enable mock data (if needed):
  - [ ] Uncomment `DEMO_COMPANY_DATA` in demo-chat.js
  - [ ] Add `demoCompanyData` to processMessage options

### Database Rollback (<10 min)
**If need to remove demo company**

- [ ] Execute cleanup SQL:
  ```sql
  DELETE FROM companies WHERE id = 999999;
  -- CASCADE removes all related records (services, staff, schedules)
  ```
- [ ] Verify cleanup:
  ```sql
  SELECT COUNT(*) FROM services WHERE company_id = 999999; -- 0
  SELECT COUNT(*) FROM staff WHERE company_id = 999999; -- 0
  ```

---

## Success Criteria Summary

**Functional Requirements**:
- [x] Demo chat loads services, staff, schedules from Timeweb PostgreSQL
- [x] SEARCH_SLOTS shows realistic slots matching database
- [x] SHOW_PRICES displays all 6 demo services correctly
- [x] CREATE_BOOKING blocked with friendly message
- [x] No client/booking records created during demo
- [x] Analytics logs all interactions
- [x] Rate limiting enforced (10 msg/session, 100 msg/IP)

**Performance Requirements**:
- [x] Response time <10 seconds average
- [x] Database queries <50ms total
- [x] No memory leaks (Redis sessions cleaned)

**User Experience**:
- [x] Natural conversation flow
- [x] Clear demo limitations communicated
- [x] Call-to-action included in final message

---

## Task Completion Tracking

### Overall Progress

**Phase 1**: ⬜⬜⬜⬜ (0/4 sections complete)
**Phase 2**: ⬜⬜⬜ (0/3 sections complete)
**Phase 3**: ⬜⬜ (0/2 sections complete)
**Phase 4**: ⬜ (0/1 section complete)
**Phase 5**: ⬜⬜ (0/2 sections complete)

**Total Progress**: 0% (0/12 sections)

---

## Notes & Decisions Made

### [Date: 2025-11-27]
**Decision**: Use real database with demo company ID 999999
**Rationale**: Better showcases actual system capabilities vs mock data

### [Date: 2025-11-27]
**Decision**: Exclude Phase 5 (Analytics & Monitoring - Enhanced Demo Analytics)
**Rationale**: User request - basic analytics via existing DemoChatAnalyticsRepository sufficient
**Note**: Existing analytics still functional (message_sent, message_received events logged)

### [Date: TBD]
**Blocker**: [Describe any blockers encountered]
**Resolution**: [How blocker was resolved]

---

**End of Task Checklist**

**Ready to Start**: Phase 1, Section 1.1 (Create Demo Company)
**Next Action**: Create migration file and execute on database
