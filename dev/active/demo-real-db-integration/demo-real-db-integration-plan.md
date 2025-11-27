# Demo Real DB Integration - Comprehensive Strategic Plan

**Last Updated**: 2025-11-27

## Executive Summary

### Objective
Replace the current mock data implementation in the demo chat with real database integration using Timeweb PostgreSQL, while maintaining strict read-only guarantees and preventing any real bookings from being created.

### Business Value
- **Showcase Real Capabilities**: Demonstrate actual AI Admin v2 system instead of simplified mock version
- **Better Conversion**: Prospects see the real system working with authentic data
- **Easier Maintenance**: Data managed in database, not hardcoded
- **Realistic Experience**: Shows real schedules, services, staff profiles

### Key Constraints (From User Requirements)
- ✅ **Read-Only Demo**: No real bookings created, only showcase bot responses
- ✅ **Ephemeral Sessions**: No persistent history after session ends
- ✅ **Anonymous UUID**: No phone number collection required
- ✅ **Combined Rate Limits**: Protection against abuse (time + action limits)

### Strategic Approach
**Hybrid Real Database + Read-Only Demo Company**

Use actual Timeweb PostgreSQL database with dedicated demo company (ID: 999999) containing curated realistic data, but block all booking creation commands at multiple layers.

### Timeline
**Estimated Total**: 6-9 hours across 5 phases (Analytics phase excluded per user request)

---

## Current State Analysis

### Existing Demo Implementation

**File**: `src/api/routes/demo-chat.js`
- **Status**: Functional with hardcoded mock data
- **Company ID**: 999999 (special demo ID)
- **Mock Data**: 4 services + 2 staff members hardcoded in `DEMO_COMPANY_DATA`
- **AI Provider**: DeepSeek (temporary - Gemini has SOCKS proxy SSL issues)
- **Session Management**:
  - UUID-based anonymous sessions
  - Redis-backed rate limiting (10 msg/session, 100 msg/IP daily)
  - 1-hour session TTL in Redis
- **Analytics**: Full event logging via `DemoChatAnalyticsRepository`
- **Integration**: Calls `aiAdminV2.processMessage()` with `isDemoMode: true` flag

**Current Mock Data**:
```javascript
const DEMO_COMPANY_DATA = {
  name: "Demo Beauty Salon",
  services: [
    { id: 1, title: "Стрижка", price: 1500 },
    { id: 2, title: "Окрашивание", price: 3000 },
    { id: 3, title: "Маникюр", price: 1200 },
    { id: 4, title: "Педикюр", price: 1500 }
  ],
  staff: [
    { id: 1, name: "Анна Мастер" },
    { id: 2, name: "Ольга Стилист" }
  ]
};
```

### AI Admin v2 Architecture

**File**: `src/services/ai-admin-v2/index.js`

**Processing Flow**:
1. **Context Loading**: `contextManager.loadFullContext(phone, companyId)`
2. **Two-Stage Processing**:
   - Stage 1: Extract commands from user message (JSON format)
   - Stage 2: Execute commands → Generate human response
3. **Command Execution**: `command-handler.js` processes SEARCH_SLOTS, CREATE_BOOKING, etc.
4. **Response Generation**: `two-stage-response-prompt.js` formats AI response

**Database Integration**:
- **DB**: Timeweb PostgreSQL (production, migrated from Supabase Nov 2025)
- **Repository Pattern**: Available via `CompanyRepository`, `ServiceRepository`, etc.
- **Feature Flags**: `USE_REPOSITORY_PATTERN`, `USE_LEGACY_SUPABASE`
- **Data Sync**: YClients sync services for companies, services, staff, schedules

### Demo Mode Handling (Current Gaps)

**What Works**:
- ✅ `createDemoContext()` method creates mock context structure
- ✅ Phone validation accepts `demo_` prefix
- ✅ Prompt includes demo-specific instructions
- ✅ Analytics tracking for demo sessions

**Critical Gaps**:
- ❌ **No CREATE_BOOKING blocking** in `command-handler.js` - commands execute normally
- ❌ **Mock data only** - doesn't use real database
- ❌ **No demo company** in Timeweb PostgreSQL
- ❌ **Inefficient context loading** - `createDemoContext()` bypasses real context manager
- ❌ **No client creation prevention** - demo sessions could create client records

---

## Proposed Future State

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Demo Chat Frontend                        │
│              (public/landing/index.html)                     │
│                                                              │
│  UUID Session → POST /api/demo-chat                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│            Demo Chat Route (src/api/routes/demo-chat.js)    │
│                                                              │
│  • Rate Limiting (10 msg/session, 100 msg/IP)              │
│  • Session Validation (UUID v4)                             │
│  • Analytics Logging                                        │
│  • isDemoMode: true flag                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         AI Admin v2 (src/services/ai-admin-v2/index.js)     │
│                                                              │
│  processMessage(message, phone, 999999, {isDemoMode:true})  │
│                                                              │
│  1. Context Loading                                         │
│     ├─ loadFullContext(demo_UUID, 999999)                   │
│     ├─ FROM: Timeweb PostgreSQL (Real Data!)               │
│     └─ Set: context.isDemo = true                           │
│                                                              │
│  2. Two-Stage Processing                                    │
│     ├─ Stage 1: Extract Commands (SEARCH_SLOTS, etc.)      │
│     ├─ Stage 2: Execute Commands (with blocking!)          │
│     └─ Stage 3: Generate Response                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│    Command Handler (modules/command-handler.js)             │
│                                                              │
│  executeCommands() {                                        │
│    if (context.isDemo && cmd === 'CREATE_BOOKING') {       │
│      return { blocked: true, message: 'Demo mode' }        │
│    }                                                         │
│    // Execute other commands normally                       │
│  }                                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│           Timeweb PostgreSQL Database                        │
│                                                              │
│  Demo Company (ID: 999999):                                 │
│    • 6 realistic services with descriptions                 │
│    • 3 staff members with ratings/specializations          │
│    • 30-day static schedules (realistic availability)       │
│    • Settings: {"demo_mode": true, "allow_bookings": false}│
│    • Subscription: "demo" (isolated from real companies)    │
│                                                              │
│  Data Isolation:                                            │
│    • No client records created (demo sessions)              │
│    • No booking records created (blocked at handler level)  │
│    • Separate Redis namespace: demo:session:*              │
└─────────────────────────────────────────────────────────────┘
```

### Key Improvements

1. **Real Database Integration**
   - Demo company stored in Timeweb PostgreSQL
   - Real repository pattern usage
   - Authentic service catalog with descriptions
   - Realistic staff profiles with ratings
   - Static schedules (no YClients sync needed)

2. **Multi-Layer Blocking**
   - **Layer 1**: Command handler blocks CREATE_BOOKING before execution
   - **Layer 2**: Two-stage processor filters CREATE_BOOKING after parsing
   - **Layer 3**: AI prompt explicitly instructs not to create bookings

3. **Data Isolation**
   - Dedicated company ID: 999999 (reserved range)
   - Settings flag: `demo_mode: true`
   - Subscription status: "demo"
   - Client creation disabled for demo sessions
   - Separate Redis namespace

4. **Enhanced Demo Experience**
   - Realistic service catalog (6 services vs 4)
   - Staff specializations and ratings
   - 30-day forward schedules with realistic patterns
   - Detailed service descriptions for EXPLAIN_SERVICE
   - Better AI responses with real context

---

## Implementation Phases

### Phase 1: Database Setup (Demo Company Creation)
**Estimated Time**: 2-3 hours
**Priority**: Critical (Foundation)

#### Section 1.1: Create Demo Company Record
**File**: `migrations/20251127_create_demo_company.sql`

**Tasks**:
1. ✅ Create demo company with ID 999999
2. ✅ Set demo_mode flag in settings JSON
3. ✅ Configure subscription status as "demo"
4. ✅ Add Moscow timezone
5. ✅ Set contact information (demo email/phone)

**SQL**:
```sql
INSERT INTO companies (
  id,
  name,
  yclients_company_id,
  phone,
  email,
  timezone,
  settings,
  is_active,
  subscription_status,
  created_at,
  updated_at
) VALUES (
  999999,
  'Demo Beauty Salon',
  999999,
  '+79001234567',
  'demo@admin-ai.ru',
  'Europe/Moscow',
  '{"demo_mode": true, "allow_bookings": false}'::jsonb,
  true,
  'demo',
  NOW(),
  NOW()
);
```

**Acceptance Criteria**:
- [ ] Company record created with ID 999999
- [ ] Settings contain `demo_mode: true`
- [ ] Can query: `SELECT * FROM companies WHERE id = 999999`
- [ ] Subscription status is "demo"

#### Section 1.2: Seed Demo Services (Realistic Beauty Salon)
**File**: `migrations/20251127_seed_demo_services.sql`

**Tasks**:
1. ✅ Create 6 diverse services across categories
2. ✅ Add realistic pricing (Moscow market rates)
3. ✅ Include detailed descriptions for EXPLAIN_SERVICE
4. ✅ Set appropriate durations
5. ✅ Assign to relevant categories

**Services**:
| Service | Category | Price | Duration | Description |
|---------|----------|-------|----------|-------------|
| Женская стрижка | Парикмахерские услуги | 1500₽ | 60 мин | Стрижка любой сложности + укладка |
| Окрашивание волос | Парикмахерские услуги | 3000-5000₽ | 180 мин | Окрашивание качественными красителями. Цена зависит от длины волос |
| Маникюр | Ногтевой сервис | 1200₽ | 60 мин | Аппаратный маникюр с покрытием гель-лак |
| Педикюр | Ногтевой сервис | 1500₽ | 90 мин | Аппаратный педикюр с покрытием |
| Укладка | Парикмахерские услуги | 800₽ | 45 мин | Укладка на любое событие |
| Ботокс для волос | Уход за волосами | 4000₽ | 120 мин | Восстановление и разглаживание волос |

**SQL**:
```sql
INSERT INTO services (
  company_id,
  yclients_service_id,
  title,
  category_name,
  price_min,
  price_max,
  duration,
  comment,
  is_active,
  created_at,
  updated_at
) VALUES
  (999999, 1, 'Женская стрижка', 'Парикмахерские услуги', 1500, 1500, 60, 'Стрижка любой сложности + укладка', true, NOW(), NOW()),
  (999999, 2, 'Окрашивание волос', 'Парикмахерские услуги', 3000, 5000, 180, 'Окрашивание качественными красителями. Цена зависит от длины волос', true, NOW(), NOW()),
  (999999, 3, 'Маникюр', 'Ногтевой сервис', 1200, 1200, 60, 'Аппаратный маникюр с покрытием гель-лак', true, NOW(), NOW()),
  (999999, 4, 'Педикюр', 'Ногтевой сервис', 1500, 1500, 90, 'Аппаратный педикюр с покрытием', true, NOW(), NOW()),
  (999999, 5, 'Укладка', 'Парикмахерские услуги', 800, 800, 45, 'Укладка на любое событие', true, NOW(), NOW()),
  (999999, 6, 'Ботокс для волос', 'Уход за волосами', 4000, 4000, 120, 'Восстановление и разглаживание волос', true, NOW(), NOW());
```

**Acceptance Criteria**:
- [ ] 6 services created for company 999999
- [ ] All services have detailed descriptions
- [ ] Price ranges realistic for Moscow
- [ ] Can query: `SELECT * FROM services WHERE company_id = 999999`

#### Section 1.3: Create Demo Staff Profiles
**File**: `migrations/20251127_seed_demo_staff.sql`

**Tasks**:
1. ✅ Create 3 staff members with distinct specializations
2. ✅ Add realistic ratings (4.7-4.9 range)
3. ✅ Set varied specializations
4. ✅ Mark all as active

**Staff**:
| Name | Specialization | Rating | YClients ID |
|------|----------------|--------|-------------|
| Анна Мастер | Топ-стилист | 4.9 | 1 |
| Ольга Колорист | Колорист | 4.8 | 2 |
| Мария Нэйл-мастер | Мастер маникюра | 4.7 | 3 |

**SQL**:
```sql
INSERT INTO staff (
  company_id,
  yclients_staff_id,
  name,
  specialization,
  rating,
  is_active,
  created_at,
  updated_at
) VALUES
  (999999, 1, 'Анна Мастер', 'Топ-стилист', 4.9, true, NOW(), NOW()),
  (999999, 2, 'Ольга Колорист', 'Колорист', 4.8, true, NOW(), NOW()),
  (999999, 3, 'Мария Нэйл-мастер', 'Мастер маникюра', 4.7, true, NOW(), NOW());
```

**Acceptance Criteria**:
- [ ] 3 staff members created for company 999999
- [ ] All have realistic ratings
- [ ] Can query: `SELECT * FROM staff WHERE company_id = 999999`

#### Section 1.4: Generate Static Schedules (30 Days)
**File**: `scripts/generate-demo-schedules.js`

**Tasks**:
1. ✅ Create Node.js script to generate 30-day schedules
2. ✅ Implement realistic patterns:
   - Mon-Sat: 10:00-20:00 (varied start times per staff)
   - Sunday: Every other Sunday closed
   - 30-minute slot intervals
3. ✅ Insert into staff_schedules table
4. ✅ Verify data via query

**Schedule Pattern**:
- **Анна Мастер**: Mon-Sat 10:00-20:00, every other Sunday off
- **Ольга Колорист**: Mon-Sat 11:00-20:00, every other Sunday off
- **Мария Нэйл-мастер**: Mon-Sat 11:00-20:00, every other Sunday off

**Script**:
```javascript
const postgres = require('../src/database/postgres');

async function generateDemoSchedules() {
  const schedules = [];
  const today = new Date();

  for (let day = 0; day < 30; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];

    const isSunday = date.getDay() === 0;
    const workingSunday = day % 14 !== 0; // Every other Sunday off

    for (const staffId of [1, 2, 3]) {
      if (isSunday && !workingSunday) {
        schedules.push({
          company_id: 999999,
          staff_yclients_id: staffId,
          date: dateStr,
          is_working: false,
          is_day_off: true
        });
      } else {
        const startTime = staffId === 1 ? '10:00' : '11:00';
        const endTime = '20:00';

        schedules.push({
          company_id: 999999,
          staff_yclients_id: staffId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_working: true,
          is_day_off: false
        });
      }
    }
  }

  // Bulk insert
  for (const schedule of schedules) {
    await postgres.query(
      `INSERT INTO staff_schedules
       (company_id, staff_yclients_id, date, start_time, end_time, is_working, is_day_off, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (company_id, staff_yclients_id, date) DO NOTHING`,
      [schedule.company_id, schedule.staff_yclients_id, schedule.date,
       schedule.start_time, schedule.end_time, schedule.is_working, schedule.is_day_off]
    );
  }

  console.log(`✅ Generated ${schedules.length} schedule records`);
}

generateDemoSchedules().catch(console.error);
```

**Acceptance Criteria**:
- [ ] Script generates 90 schedule records (3 staff × 30 days)
- [ ] Schedules show realistic patterns (varied start times, Sundays off)
- [ ] Can query: `SELECT * FROM staff_schedules WHERE company_id = 999999 ORDER BY date`
- [ ] Dates cover next 30 days from today

---

### Phase 2: Demo Mode Enforcement (Read-Only Protection)
**Estimated Time**: 1-2 hours
**Priority**: Critical (Security)

#### Section 2.1: Block CREATE_BOOKING in Command Handler
**File**: `src/services/ai-admin-v2/modules/command-handler.js`

**Tasks**:
1. ✅ Add demo mode check at start of `executeCommands()` method
2. ✅ Block CREATE_BOOKING command when `context.isDemo === true`
3. ✅ Return friendly error message
4. ✅ Log blocking event
5. ✅ Add unit test for blocking logic

**Implementation**:
```javascript
// In executeCommands() method, line ~157
for (const cmd of commands) {
  // DEMO MODE PROTECTION: Block booking creation
  if (context.isDemo && cmd.command === 'CREATE_BOOKING') {
    logger.warn('🚫 CREATE_BOOKING blocked in demo mode');
    results.push({
      type: 'booking_blocked',
      command: cmd.command,
      success: false,
      error: 'demo_mode',
      message: 'Это демо-версия. Для реальной записи свяжитесь с нами через форму на сайте.'
    });
    continue; // Skip to next command
  }

  // ... existing validation and execution code
}
```

**Acceptance Criteria**:
- [ ] CREATE_BOOKING command is blocked when `context.isDemo = true`
- [ ] Returns `success: false` with demo_mode error
- [ ] Logs warning: "CREATE_BOOKING blocked in demo mode"
- [ ] Other commands (SEARCH_SLOTS, SHOW_PRICES) execute normally
- [ ] Test: Unit test verifies blocking with demo context

#### Section 2.2: Filter CREATE_BOOKING in Two-Stage Processor
**File**: `src/services/ai-admin-v2/modules/two-stage-processor.js`

**Tasks**:
1. ✅ Add command filtering after Stage 1 (command extraction)
2. ✅ Remove CREATE_BOOKING from command list in demo mode
3. ✅ Log filtered commands

**Implementation** (if two-stage-processor.js exists):
```javascript
// After command parsing (Stage 1)
if (context.isDemo && commands.length > 0) {
  const originalCount = commands.length;
  commands = commands.filter(cmd => {
    if (cmd.name === 'CREATE_BOOKING') {
      logger.warn('🚫 CREATE_BOOKING filtered out in demo mode (Stage 1)');
      return false;
    }
    return true;
  });

  if (commands.length < originalCount) {
    logger.info(`Filtered ${originalCount - commands.length} demo-restricted commands`);
  }
}
```

**Acceptance Criteria**:
- [ ] CREATE_BOOKING not present in commands array before execution
- [ ] Logs warning when filtering occurs
- [ ] Other commands pass through unchanged

#### Section 2.3: Remove Mock Data from Demo Chat Route
**File**: `src/api/routes/demo-chat.js`

**Tasks**:
1. ✅ Remove `DEMO_COMPANY_DATA` constant definition
2. ✅ Remove `demoCompanyData` from options passed to `processMessage()`
3. ✅ Keep `isDemoMode: true` flag
4. ✅ Update comments to reflect database usage

**Changes**:
```javascript
// REMOVE these lines:
const DEMO_COMPANY_DATA = { ... };

// UPDATE processMessage call (line ~325):
const result = await aiAdminV2.processMessage(
  message,
  demoPhone,
  DEMO_COMPANY_ID, // 999999 - now loads from database!
  {
    isDemoMode: true, // Flag for command blocking and prompt modification
    aiProvider: 'deepseek' // Temporary (SOCKS proxy issue with Gemini)
  }
);
```

**Acceptance Criteria**:
- [ ] DEMO_COMPANY_DATA constant removed
- [ ] No mock data passed to processMessage()
- [ ] isDemoMode flag still present
- [ ] Demo chat still works (loads from DB)

---

### Phase 3: Context Loading Optimization
**Estimated Time**: 1 hour
**Priority**: Medium (Performance)

#### Section 3.1: Use Real Context Manager for Demo
**File**: `src/services/ai-admin-v2/index.js`

**Tasks**:
1. ✅ Replace `createDemoContext()` call with `loadFullContext()`
2. ✅ Add `isDemo` flag to loaded context
3. ✅ Remove special demo context handling
4. ✅ Verify performance (should be similar to production)

**Implementation**:
```javascript
// In processMessage() method
async processMessage(message, phone, companyId, options = {}) {
  const { isDemoMode, aiProvider } = options;

  let context;

  if (isDemoMode) {
    logger.info('📊 Demo mode enabled, loading from database');
    // Load real context from database (company 999999)
    context = await this.contextManager.loadFullContext(phone, companyId);
    // Mark as demo for command blocking and prompt modification
    context.isDemo = true;
  } else {
    // Production flow
    context = await this.contextManager.loadFullContext(phone, companyId);
  }

  // ... continue with two-stage processing
}
```

**Acceptance Criteria**:
- [ ] Demo mode uses same context loading as production
- [ ] Context contains real services/staff/schedules from DB
- [ ] `context.isDemo = true` flag is set
- [ ] No special `createDemoContext()` call
- [ ] Response time similar (<10s)

#### Section 3.2: Prevent Client Record Creation for Demo
**File**: `src/services/context/context-manager-v2.js`

**Tasks**:
1. ✅ Check for demo mode before creating client records
2. ✅ Return temporary client object for demo sessions
3. ✅ Mark demo client with special flag

**Implementation**:
```javascript
// In loadFullContext() or loadClientContext()
async loadClientContext(phone, companyId) {
  // Check if this is a demo session (phone starts with "demo_")
  const isDemo = phone.startsWith('demo_');

  if (isDemo) {
    logger.info('📊 Demo session - not creating client record');
    return {
      name: null,
      phone: phone,
      isNew: true,
      fromDemo: true, // Flag for analytics
      // ... minimal client structure
    };
  }

  // Normal production flow - load or create client
  // ...
}
```

**Acceptance Criteria**:
- [ ] Demo sessions don't create records in `clients` table
- [ ] Temporary client object returned for demo
- [ ] `fromDemo: true` flag set for tracking
- [ ] Production clients still created normally
- [ ] Test: Verify no new clients after 10 demo messages

---

### Phase 4: AI Prompt Refinement
**Estimated Time**: 30 minutes
**Priority**: Medium (UX)

#### Section 4.1: Update Demo Prompt Instructions
**File**: `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`

**Tasks**:
1. ✅ Add comprehensive demo mode section to prompt
2. ✅ Provide clear "what to do" and "what not to do" instructions
3. ✅ Include conversion-focused final message template
4. ✅ Ensure natural conversation flow

**Implementation**:
```javascript
// In getPrompt() method, after base prompt setup
if (context.isDemo) {
  basePrompt += `

⚠️ ДЕМО-РЕЖИМ: Это демонстрационная версия на сайте

ПРАВИЛА РАБОТЫ В ДЕМО:

1. ✅ ЧТО ДЕЛАТЬ:
   - Показывай свободные слоты командой SEARCH_SLOTS
   - Рассказывай о ценах через SHOW_PRICES
   - Объясняй услуги через EXPLAIN_SERVICE
   - Проверяй расписание мастеров через CHECK_STAFF_SCHEDULE
   - Веди естественный диалог о записи
   - Собирай информацию (услуга, дата, время, мастер)

2. ❌ ЧЕГО НЕ ДЕЛАТЬ:
   - НЕ используй команду CREATE_BOOKING (запись не создается в демо)
   - НЕ говори "Я записал вас" или "Запись подтверждена"
   - НЕ спрашивай подтверждение записи

3. 🎯 ФИНАЛЬНЫЙ ОТВЕТ (когда клиент выбрал всё: услугу, дату, время):

   "Отлично! Я вижу все нужные данные для записи:

   • Услуга: [название услуги]
   • Дата: [дата]
   • Время: [время]
   • Мастер: [имя мастера]

   📌 Это демонстрационная версия бота. Чтобы записаться по-настоящему,
   свяжитесь с нами через форму на сайте или позвоните по телефону.

   Хотите узнать о других услугах или попробовать другой сценарий бронирования?"

ЦЕЛЬ: Показать как работает AI-администратор, но не создавать реальных записей.
`;
}
```

**Acceptance Criteria**:
- [ ] Demo prompt clearly explains demo limitations
- [ ] Provides natural conversation flow
- [ ] Final message includes call-to-action (contact form/phone)
- [ ] AI doesn't say "I booked you" in demo mode
- [ ] Test: Demo conversation feels natural, not restrictive

---

### Phase 5: Testing & Validation
**Estimated Time**: 2-3 hours
**Priority**: Critical (Quality)

#### Section 5.1: Integration Tests
**File**: `tests/integration/demo-chat.integration.test.js`

**Tasks**:
1. ✅ Create integration test suite for demo chat
2. ✅ Test all critical flows
3. ✅ Verify database isolation
4. ✅ Run tests in CI/CD pipeline

**Test Cases**:
```javascript
describe('Demo Chat Integration', () => {
  let sessionId;

  beforeEach(() => {
    sessionId = uuidv4();
  });

  test('Should load real services from database', async () => {
    const response = await request(app)
      .post('/api/demo-chat')
      .send({ sessionId, message: 'Покажите цены' });

    expect(response.body.success).toBe(true);
    expect(response.body.response).toContain('Женская стрижка');
    expect(response.body.response).toContain('1500');
    expect(response.body.response).toContain('Маникюр');
  });

  test('Should show realistic available slots', async () => {
    const response = await request(app)
      .post('/api/demo-chat')
      .send({ sessionId, message: 'Свободное время на завтра' });

    expect(response.body.success).toBe(true);
    // Should show time slots (not mock data like 14:00, 16:30)
    expect(response.body.response).toMatch(/\d{2}:\d{2}/);
  });

  test('Should block CREATE_BOOKING command', async () => {
    // Attempt to create booking through full conversation
    await request(app).post('/api/demo-chat').send({ sessionId, message: 'Хочу записаться на стрижку' });
    await request(app).post('/api/demo-chat').send({ sessionId, message: 'На завтра' });
    const response = await request(app).post('/api/demo-chat').send({ sessionId, message: 'В 14:00' });

    expect(response.body.success).toBe(true);
    expect(response.body.response).not.toContain('Я записал вас');
    expect(response.body.response).toContain('демо');
  });

  test('Should not create client records', async () => {
    const beforeCount = await postgres.query('SELECT COUNT(*) FROM clients WHERE phone LIKE $1', ['demo_%']);

    await request(app).post('/api/demo-chat').send({ sessionId, message: 'Привет' });

    const afterCount = await postgres.query('SELECT COUNT(*) FROM clients WHERE phone LIKE $1', ['demo_%']);

    expect(afterCount.rows[0].count).toBe(beforeCount.rows[0].count); // No new clients
  });

  test('Should enforce rate limiting (10 msg/session)', async () => {
    // Send 10 messages
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/demo-chat').send({ sessionId, message: `Message ${i}` });
    }

    // 11th message should be rate limited
    const response = await request(app).post('/api/demo-chat').send({ sessionId, message: 'Too many' });

    expect(response.status).toBe(429);
    expect(response.body.error).toBe('demo_limit_reached');
  });

  test('Should log analytics events', async () => {
    await request(app).post('/api/demo-chat').send({ sessionId, message: 'Test message' });

    const events = await postgres.query(
      'SELECT * FROM demo_chat_events WHERE session_id = $1',
      [sessionId]
    );

    expect(events.rows.length).toBeGreaterThan(0);
    expect(events.rows[0].event_type).toBe('message_sent');
  });
});
```

**Acceptance Criteria**:
- [ ] All 6 integration tests pass
- [ ] Tests run in <30 seconds
- [ ] Database isolation verified (no demo data pollution)
- [ ] Rate limiting works correctly
- [ ] Analytics logging functional

#### Section 5.2: Manual QA Checklist
**File**: `docs/QA_DEMO_CHAT_MANUAL.md`

**Tasks**:
1. ✅ Create manual QA checklist document
2. ✅ Perform manual testing
3. ✅ Document any issues found
4. ✅ Verify fixes

**Manual Test Scenarios**:

**Scenario 1: View Services**
- [ ] Start demo chat on https://www.ai-admin.app
- [ ] Ask: "Какие у вас услуги?"
- [ ] ✅ Expected: Bot shows 6 services with prices
- [ ] ✅ Verify: Services match database (Женская стрижка, Окрашивание, etc.)

**Scenario 2: Check Available Slots**
- [ ] Ask: "Свободное время на завтра на стрижку"
- [ ] ✅ Expected: Bot shows realistic time slots (10:00-20:00 range)
- [ ] ✅ Verify: Slots are not past times
- [ ] ✅ Verify: Matches database schedules for demo company

**Scenario 3: Attempt to Book (Demo Limitation)**
- [ ] Continue conversation: "Хочу записаться"
- [ ] Specify: "На завтра в 14:00 к Анне"
- [ ] ✅ Expected: Bot collects information but doesn't say "I booked you"
- [ ] ✅ Expected: Bot explains this is demo and provides contact form CTA
- [ ] ✅ Verify: No booking record created in database

**Scenario 4: Service Explanation**
- [ ] Ask: "Расскажите про ботокс для волос"
- [ ] ✅ Expected: Bot provides detailed description (from database)
- [ ] ✅ Verify: Description matches: "Восстановление и разглаживание волос"

**Scenario 5: Staff Schedule Check**
- [ ] Ask: "Завтра Ольга работает?"
- [ ] ✅ Expected: Bot checks and confirms schedule
- [ ] ✅ Verify: Information matches database schedule

**Scenario 6: Rate Limit**
- [ ] Send 10 messages in same session
- [ ] ✅ Expected: All 10 work normally
- [ ] Send 11th message
- [ ] ✅ Expected: 429 error with "demo_limit_reached"

**Scenario 7: Database Isolation Check**
- [ ] Run SQL: `SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'`
- [ ] Note count before testing
- [ ] Complete Scenarios 1-5
- [ ] Run SQL again
- [ ] ✅ Expected: Count unchanged (no new clients)

**Scenario 8: Analytics Logging**
- [ ] Complete Scenario 1
- [ ] Run SQL: `SELECT * FROM demo_chat_events WHERE session_id = '[your-session-id]' ORDER BY created_at DESC LIMIT 5`
- [ ] ✅ Expected: Events logged (message_sent, message_received)

**Acceptance Criteria**:
- [ ] All 8 manual scenarios pass
- [ ] No unexpected errors in console
- [ ] Database remains clean (no demo pollution)
- [ ] User experience feels natural

---

## Data Isolation Strategy

### Multi-Layer Isolation

#### Layer 1: Database Level
```sql
-- Company Isolation
- Company ID: 999999 (reserved range, never syncs with YClients)
- Subscription Status: "demo" (filterable in queries)
- Settings: {"demo_mode": true, "allow_bookings": false}

-- Query Example (exclude demo from production reports):
SELECT * FROM companies WHERE subscription_status != 'demo'
```

#### Layer 2: Application Level
```javascript
// Context Flag
context.isDemo = true

// Phone Prefix
phone.startsWith('demo_') // e.g., demo_550e8400-e29b-41d4-a716-446655440000

// Client Creation Prevention
if (isDemo) {
  return tempClient; // Don't INSERT into clients table
}

// Booking Blocking
if (context.isDemo && cmd === 'CREATE_BOOKING') {
  return { blocked: true };
}
```

#### Layer 3: Redis Namespace
```javascript
// Demo sessions use separate Redis keys
const key = `demo:session:${sessionId}:count`; // Not: session:${phone}:count

// Cleanup (optional, as sessions expire automatically)
redis.keys('demo:session:*').forEach(key => redis.del(key));
```

### Cleanup Strategy

**No cleanup needed** because:
1. ✅ No client records created (prevented at context loading)
2. ✅ No booking records created (blocked at command handler)
3. ✅ Redis keys auto-expire (1 hour TTL)
4. ✅ Analytics stored in dedicated `demo_chat_events` table (intentional)

**Optional Cleanup** (if ever needed):
```sql
-- Clear demo analytics older than 90 days
DELETE FROM demo_chat_events WHERE created_at < NOW() - INTERVAL '90 days';

-- Verify no demo data leaked
SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'; -- Should be 0
SELECT COUNT(*) FROM bookings WHERE company_id = 999999; -- Should be 0
```

---

## Performance Considerations

### Response Time Analysis

**Current Demo (Mock Data)**:
- AI Processing (DeepSeek Two-Stage): ~9 seconds
- Context Creation (mock): <10ms
- **Total**: ~9 seconds

**Expected Demo (Real DB)**:
- AI Processing (DeepSeek Two-Stage): ~9 seconds
- Database Queries:
  - Company lookup: ~5ms
  - Services load: ~10ms
  - Staff load: ~5ms
  - Schedules load (30 days): ~20ms
- Context assembly: ~10ms
- **Total**: ~9.05 seconds

**Impact**: Negligible (+50ms, <1% increase)

### Caching Strategy

```javascript
// Static Demo Data Caching (24-hour TTL)
const DEMO_CACHE_TTL = 86400; // 24 hours

// Cache keys
- demo:company:999999 → Company data (name, settings)
- demo:services:999999 → All 6 services with descriptions
- demo:staff:999999 → All 3 staff members with ratings

// Implementation
async loadDemoCompany(companyId) {
  const cached = await redis.get(`demo:company:${companyId}`);
  if (cached) return JSON.parse(cached);

  const company = await CompanyRepository.findById(companyId);
  await redis.setex(`demo:company:${companyId}`, DEMO_CACHE_TTL, JSON.stringify(company));
  return company;
}
```

**Benefits**:
- Reduces DB queries from 4 to 0 (after first request)
- Effective response time: ~9 seconds (no DB queries)

### Rate Limiting (Abuse Prevention)

**Current Limits**:
- 10 messages per session (UUID)
- 100 messages per IP daily
- 1-hour session TTL

**Recommendation**: Keep as-is (proven effective)

---

## Security Considerations

### Prevent Data Pollution

**Checklist**:
- ✅ No client records created (prevented in context manager)
- ✅ No booking records created (blocked in command handler)
- ✅ Demo sessions isolated in Redis (`demo:session:*`)
- ✅ Company ID 999999 never syncs with YClients (no sync service)

### Input Validation

**Existing Protections** (already in demo-chat.js):
```javascript
// Session ID validation
body('sessionId')
  .trim()
  .notEmpty()
  .isUUID(4) // Strict UUID v4 format

// Message validation
body('message')
  .trim()
  .notEmpty()
  .isLength({ max: 500 }) // Prevents abuse
```

**No Additional Changes Needed**: Current validation is sufficient

### PII Protection

**Current State**:
- ✅ Demo sessions are anonymous (UUID-based, no phone collection)
- ✅ No PII collected (name, email, etc.)
- ✅ Analytics logs IP addresses (could be hashed if needed)

**Optional Enhancement**:
```javascript
// Hash IP before logging
const hashedIp = crypto.createHash('sha256').update(req.ip).digest('hex').substring(0, 16);

analyticsRepo.logEvent({
  session_id: sessionId,
  user_ip: hashedIp, // Hashed instead of raw IP
  // ...
});
```

---

## Success Metrics

### Functional Requirements

- [ ] **Real Data Loading**: Demo chat loads services, staff, schedules from Timeweb PostgreSQL
- [ ] **SEARCH_SLOTS Accuracy**: Shows realistic slots matching database schedules
- [ ] **SHOW_PRICES Completeness**: Displays all 6 demo services with correct prices
- [ ] **CREATE_BOOKING Blocking**: Command blocked with friendly error message
- [ ] **Data Isolation**: No client/booking records created during demo sessions
- [ ] **Analytics Logging**: All interactions tracked in demo_chat_events table
- [ ] **Rate Limiting**: 10 msg/session and 100 msg/IP limits enforced

### Performance Requirements

- [ ] **Response Time**: <10 seconds average (currently ~9s)
- [ ] **Database Queries**: <50ms total for context loading
- [ ] **Memory Usage**: No memory leaks (Redis sessions cleaned up)
- [ ] **Caching Effectiveness**: 90%+ cache hit rate after warmup

### User Experience

- [ ] **Natural Conversation**: Demo flows feel realistic, not restrictive
- [ ] **Clear Limitations**: Users understand this is demo, not real booking
- [ ] **Conversion CTA**: Final message includes call-to-action (contact form/phone)
- [ ] **Error Handling**: Graceful degradation if DB unavailable (fallback to mock?)

### Business Metrics (Post-Launch)

- [ ] **Demo Engagement**: Track % of visitors who try demo
- [ ] **Conversion Rate**: Demo users → contact form submissions
- [ ] **Popular Scenarios**: Identify most-asked questions in demo
- [ ] **Drop-off Points**: Where users abandon demo conversation

---

## Risk Assessment & Mitigation

### Risk 1: Database Performance Impact
**Severity**: Low
**Probability**: Low
**Impact**: Demo queries could slow production if not cached

**Mitigation**:
- Implement 24-hour caching for demo company data
- Use read replica if available
- Monitor query performance with logging

**Rollback**: Disable caching, revert to mock data if needed

### Risk 2: Data Pollution (Client/Booking Records)
**Severity**: High
**Probability**: Low (multi-layer blocking)
**Impact**: Demo data mixed with production

**Mitigation**:
- Multi-layer blocking (context manager + command handler)
- Integration tests verify isolation
- Daily SQL audit: `SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'`

**Rollback**: SQL cleanup script available

### Risk 3: Rate Limiting Bypass
**Severity**: Medium
**Probability**: Low
**Impact**: Abuse of demo chat (spam, load)

**Mitigation**:
- Combined limits (session + IP)
- Redis-backed enforcement (atomic operations)
- Monitor Redis keys count: `redis.keys('demo:session:*').length`

**Rollback**: Reduce limits (10 → 5 msg/session) if abused

### Risk 4: AI Provider Downtime (DeepSeek)
**Severity**: Medium
**Probability**: Low
**Impact**: Demo chat non-functional

**Mitigation**:
- Retry logic (3 attempts with exponential backoff)
- Fallback to cached responses for common queries?
- Monitor uptime via health checks

**Rollback**: Switch to Gemini (if SOCKS proxy fixed) or disable demo temporarily

### Risk 5: Migration Script Failures
**Severity**: Medium
**Probability**: Low
**Impact**: Incomplete demo data setup

**Mitigation**:
- Test migrations on staging database first
- Use transactions (ROLLBACK on error)
- Idempotent scripts (can re-run safely)

**Rollback**: Drop demo company: `DELETE FROM companies WHERE id = 999999`

---

## Rollback Plan

### Immediate Rollback (< 5 minutes)

**Scenario**: Demo chat breaks after deployment

**Steps**:
1. Revert code changes:
   ```bash
   git revert <commit-hash>
   git push origin main
   ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-api"
   ```

2. Re-enable mock data (if needed):
   ```javascript
   // In demo-chat.js, uncomment:
   const DEMO_COMPANY_DATA = { /* ... */ };

   // Add to processMessage options:
   demoCompanyData: DEMO_COMPANY_DATA
   ```

### Database Rollback (< 10 minutes)

**Scenario**: Need to remove demo company data

**SQL Script**:
```sql
-- Delete all demo company data (CASCADE removes related records)
DELETE FROM companies WHERE id = 999999;

-- Verify cleanup
SELECT COUNT(*) FROM services WHERE company_id = 999999; -- Should be 0
SELECT COUNT(*) FROM staff WHERE company_id = 999999; -- Should be 0
SELECT COUNT(*) FROM staff_schedules WHERE company_id = 999999; -- Should be 0
```

### Feature Flag Rollback (Future Enhancement)

**Add Feature Flag**:
```javascript
// config/demo-flags.js
module.exports = {
  USE_REAL_DB_FOR_DEMO: process.env.USE_REAL_DB_FOR_DEMO === 'true' // Default: false
};

// In demo-chat.js
const { USE_REAL_DB_FOR_DEMO } = require('../../config/demo-flags');

if (USE_REAL_DB_FOR_DEMO) {
  // Load from database
} else {
  // Use mock data (fallback)
}
```

**Toggle**:
```bash
# Disable real DB (revert to mock)
export USE_REAL_DB_FOR_DEMO=false
pm2 restart ai-admin-api
```

---

## Timeline & Effort Estimation

| Phase | Tasks | Effort | Priority | Dependencies |
|-------|-------|--------|----------|--------------|
| **Phase 1: Database Setup** | 4 sections | 2-3 hours | Critical | PostgreSQL access |
| **Phase 2: Demo Enforcement** | 3 sections | 1-2 hours | Critical | Phase 1 complete |
| **Phase 3: Optimization** | 2 sections | 1 hour | Medium | Phase 2 complete |
| **Phase 4: Prompt Refinement** | 1 section | 30 min | Medium | Phase 2 complete |
| **Phase 5: Testing** | 2 sections | 2-3 hours | Critical | Phases 1-4 complete |
| **TOTAL** | **12 sections** | **6-9 hours** | | |

### Recommended Schedule (2-Day Sprint)

**Day 1 (4-5 hours)**:
- Morning: Phase 1 (Database Setup) - 2.5 hours
- Afternoon: Phase 2 (Demo Enforcement) - 1.5 hours
- Evening: Phase 3 (Optimization) - 1 hour

**Day 2 (2-4 hours)**:
- Morning: Phase 4 (Prompt Refinement) - 30 min
- Midday: Phase 5 (Testing) - 2.5 hours

---

## Required Resources & Dependencies

### Technical Resources

**Database Access**:
- Timeweb PostgreSQL credentials
- Migration script execution permissions
- Ability to create tables/insert data

**Server Access**:
- SSH access: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- PM2 restart permissions
- Git push access to repository

**Development Tools**:
- Node.js (v18+)
- PostgreSQL client (psql or GUI)
- Redis CLI (for debugging sessions)
- Code editor with ESLint

### Team Dependencies

**Roles Needed**:
- **Backend Developer**: Code changes (Phases 2-4)
- **Database Administrator**: Migration scripts (Phase 1)
- **QA Engineer**: Testing (Phase 6)
- **Product Owner**: UX review (Phase 4)

**External Dependencies**:
- None (all work internal)

### Knowledge Requirements

**Must Know**:
- Node.js/Express
- PostgreSQL/SQL
- Repository pattern
- Redis basics
- Git workflow

**Nice to Have**:
- AI prompt engineering
- Rate limiting strategies
- Integration testing (Jest/Supertest)

---

## Post-Implementation Monitoring

### Week 1: Intensive Monitoring

**Daily Checks**:
```bash
# 1. Check for demo data pollution
ssh root@46.149.70.219 "cd /opt/ai-admin && psql -U gen_user -d default_db -c \"SELECT COUNT(*) FROM clients WHERE phone LIKE 'demo_%'\""
# Expected: 0

# 2. Monitor Redis session count
ssh root@46.149.70.219 "redis-cli KEYS 'demo:session:*' | wc -l"
# Expected: <50 (depends on traffic)

# 3. Check analytics events
ssh root@46.149.70.219 "cd /opt/ai-admin && psql -U gen_user -d default_db -c \"SELECT COUNT(*), MAX(created_at) FROM demo_chat_events WHERE created_at > NOW() - INTERVAL '24 hours'\""
# Expected: Matches demo traffic

# 4. Response time check
# Monitor PM2 logs for "Demo chat response sent" with duration
ssh root@46.149.70.219 "pm2 logs ai-admin-api --lines 100 | grep 'Demo chat response sent'"
# Expected: <10 seconds avg
```

### Week 2-4: Regular Monitoring

**Weekly Checks**:
- Run integration test suite: `npm run test:demo`
- Review analytics dashboard: GET `/api/demo-chat/analytics?period=week`
- Check conversion rate: Demo sessions → contact form submissions

### Alerts Setup (Optional)

**Glitchtip/Sentry Alerts**:
```javascript
// In demo-chat.js
if (duration > 15000) {
  Sentry.captureMessage('Demo chat slow response', {
    level: 'warning',
    extra: { duration, sessionId }
  });
}

if (error.message.includes('database')) {
  Sentry.captureException(error, {
    level: 'error',
    tags: { component: 'demo-chat' }
  });
}
```

---

## Future Enhancements (Post-Launch)

### Enhancement 1: Multi-Industry Demos
**Effort**: 3-4 hours
**Value**: High (appeal to different verticals)

Create multiple demo companies:
- 999998: Demo Barber Shop (men's grooming)
- 999997: Demo Spa & Wellness (massage, wellness)
- 999996: Demo Beauty Studio (makeup, lashes)

**Implementation**:
```javascript
// Demo selector on landing page
<select id="demoType">
  <option value="999999">Beauty Salon</option>
  <option value="999998">Barber Shop</option>
  <option value="999997">Spa & Wellness</option>
</select>

// Pass selected company ID to demo-chat API
const DEMO_COMPANY_ID = parseInt(demoType);
```

### Enhancement 2: Voice Message Support
**Effort**: 8-10 hours
**Value**: Medium (showcase full capabilities)

Add voice message demo:
- Record audio via browser
- Send to WhatsApp voice transcription API
- Process as text message
- Return voice response

### Enhancement 3: A/B Testing
**Effort**: 2-3 hours
**Value**: Medium (data-driven optimization)

Compare real DB vs mock data:
- 50% users → Real DB demo
- 50% users → Mock data demo
- Track: Engagement time, conversion rate, questions asked

### Enhancement 4: Personalized Demo
**Effort**: 4-5 hours
**Value**: Low (privacy concerns)

Remember returning users via cookie:
- Store session history (last 7 days)
- Greet: "Welcome back! Last time you asked about [service]"
- Suggest: "Want to try booking for [staff]?"

**Privacy Note**: Requires cookie consent banner

---

## Conclusion

This comprehensive plan provides a **complete roadmap** for integrating real AI Admin v2 with a demo salon on the website. The hybrid approach (real database + read-only demo company) offers the best balance of:

✅ **Authenticity**: Showcases real system capabilities
✅ **Safety**: Multi-layer blocking prevents real bookings
✅ **Performance**: Minimal impact (~50ms overhead)
✅ **Isolation**: Zero risk of data pollution
✅ **Maintainability**: Data in DB, not hardcoded

**Estimated Completion**: 6-9 hours (2-day sprint)
**Risk Level**: Low (comprehensive rollback plan)
**Business Value**: High (better conversion, realistic demo)

Ready to begin implementation with **Phase 1: Database Setup**! 🚀
