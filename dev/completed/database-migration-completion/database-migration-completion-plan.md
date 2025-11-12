# Database Migration Completion Plan (Simplified)
**Last Updated: 2025-11-07**

---

## 📋 Executive Summary

**Mission:** Complete the interrupted Phase 0 database migration and execute full migration from Supabase to Timeweb PostgreSQL.

**Critical Issue:** Phase 0 was marked "complete" but Baileys WhatsApp still reads from Supabase due to hardcoded imports. Migrated data in Timeweb is unused. Additional business tables (clients: 1,299, services: 63, staff: 12, bookings: 38) remain unmigrated.

**Strategy:** Simplified direct replacement approach
- **Phase 0.7** (1-2 days): Fix Baileys to use Timeweb
- **Phase 1** (3-4 days): Direct replacement of all 51 files (Supabase → Timeweb)
- **Phase 2** (1 day): Production cutover with data migration

**Timeline:** 7 days total (1 week)
**Downtime:** 4-6 hours (Sunday 02:00-08:00)
**Risk Level:** MEDIUM (mitigated with rollback plans)

**Why Simplified:** No abstraction layer needed because:
- ✅ Permanent move to Timeweb (152-ФЗ compliance)
- ✅ No plans to use Supabase again
- ✅ Direct replacement is simpler and faster
- ✅ Less code = fewer bugs

---

## 🔍 Current State Analysis

### Architecture Problem

```
┌─────────────────────────────────────────┐
│ EXPECTED (after Phase 0):               │
│ App → Timeweb PostgreSQL (all data)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ACTUAL (now - 2025-11-07):              │
│ App → Supabase (ALL data)               │
│ Timeweb PostgreSQL (unused data)        │
└─────────────────────────────────────────┘
```

### Root Cause

**File:** `src/integrations/whatsapp/auth-state-supabase.js:11`

```javascript
const { supabase } = require('../../database/supabase');  // ❌ HARDCODED

async function useSupabaseAuthState(companyId) {
  // Directly queries Supabase - ignores USE_LEGACY_SUPABASE flag
  const { data, error } = await supabase
    .from('whatsapp_auth')  // ❌ Reading from Supabase
    .select('creds')
  // ...
}
```

**Why `USE_LEGACY_SUPABASE` doesn't work:**
- Flag only controls `src/database/postgres.js` initialization
- Baileys has direct Supabase import (bypasses flag)
- 51 other files also have hardcoded Supabase imports

### Data Inventory

**✅ Migrated to Timeweb (UNUSED):**
- whatsapp_auth: 1 record
- whatsapp_keys: 728 records

**❌ Still in Supabase (ACTIVE USE):**
- companies: 1 record
- clients: 1,299 records
- services: 63 records
- staff: 12 records
- staff_schedules: 56+ records
- bookings: 38 records
- appointments_cache: ? records
- dialog_contexts: 21 records
- reminders: ? records
- sync_status: ? records
- messages: ? records (partitioned)

### Code Impact Analysis

**Files with hardcoded Supabase:** 51 files

**Critical modules:**
1. **Baileys Auth State** (1 file) - `src/integrations/whatsapp/auth-state-supabase.js`
2. **Sync Scripts** (11 files) - `src/sync/*.js`
3. **Data Layer** (1 file) - `src/integrations/yclients/data/supabase-data-layer.js` (977 lines)
4. **Services** (6+ files) - AI Admin v2, Booking Monitor, etc.
5. **API Routes** (4+ files) - Health, webhooks, marketplace
6. **Workers** (2 files) - Message worker, error logger

---

## 🎯 Proposed Future State

### Target Architecture (Simple)

```
Application Layer
       ↓
Direct PostgreSQL Queries (src/database/postgres.js)
       ↓
Timeweb PostgreSQL
```

**No abstraction layer, no dynamic switching, just direct PostgreSQL.**

### Code Transformation Pattern

```javascript
// BEFORE (Supabase):
const { supabase } = require('../../database/supabase');

const { data, error } = await supabase
  .from('clients')
  .select('*')
  .eq('id', clientId)
  .single();

// AFTER (Timeweb):
const postgres = require('../../database/postgres');

const result = await postgres.query(
  'SELECT * FROM clients WHERE id = $1',
  [clientId]
);
const data = result.rows[0] || null;
```

### Success State

**After Phase 0.7:**
- ✅ Baileys reads from Timeweb PostgreSQL
- ✅ whatsapp_auth + whatsapp_keys used from Timeweb
- ✅ WhatsApp messages send/receive working
- ✅ Zero Supabase queries in Baileys logs
- ✅ 24 hours stable operation

**After Phase 1:**
- ✅ All 51 files updated to use Timeweb directly
- ✅ Code compiles and tests pass
- ✅ Ready for production cutover

**After Phase 2:**
- ✅ All tables migrated to Timeweb (100% records)
- ✅ Zero Supabase queries across entire application
- ✅ Services start in <5 minutes
- ✅ E2E tests pass 100%
- ✅ 7 days stable operation
- ✅ Supabase decommissioned (cost savings)

---

## 📅 Implementation Phases

### Phase 0.7: Emergency Baileys Fix (1-2 days) - URGENT

**Goal:** Switch Baileys WhatsApp to read from Timeweb PostgreSQL

**Timeline:** Days 1-2
**Risk:** MEDIUM
**Downtime:** 5-10 minutes (service restart)

**Tasks:**
1. Create `src/integrations/whatsapp/auth-state-timeweb.js`
2. Update `src/integrations/whatsapp/session-pool.js` (direct import)
3. Remove `auth-state-supabase.js` dependency
4. Unit tests (local)
5. Integration test (VPS)
6. E2E test (test phone 89686484488)
7. Monitor 24 hours

**Acceptance Criteria:**
- [ ] Baileys connects using Timeweb credentials
- [ ] Messages send successfully
- [ ] Messages receive successfully
- [ ] No "whatsapp_auth" queries to Supabase in logs
- [ ] 24 hours without errors

---

### Phase 1: Direct Code Replacement (3-4 days)

**Goal:** Replace all Supabase imports with direct Timeweb PostgreSQL queries

**Timeline:** Days 3-6
**Risk:** MEDIUM
**Downtime:** None (development only)

#### Phase 1.1: Update Data Layer (Day 3)

**File:** `src/integrations/yclients/data/supabase-data-layer.js` (977 lines)

**Task:** Rename to `timeweb-data-layer.js` and replace all queries

**Transformation:**
```javascript
// BEFORE:
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('company_id', companyId);

// AFTER:
const { rows: data } = await postgres.query(
  'SELECT * FROM clients WHERE company_id = $1',
  [companyId]
);
```

**Estimate:** 6-8 hours (977 lines of query transformations)

---

#### Phase 1.2: Update Sync Scripts (Day 4)

**Files (11 total):**
- `src/sync/clients-sync.js`
- `src/sync/services-sync.js`
- `src/sync/staff-sync.js`
- `src/sync/schedules-sync.js`
- `src/sync/bookings-sync.js`
- `src/sync/client-records-sync.js`
- `src/sync/company-info-sync.js`
- `src/sync/goods-transactions-sync.js`
- `src/sync/visits-sync.js`
- `src/sync/clients-sync-optimized.js`
- `src/sync/sync-manager.js`

**Pattern:**
```javascript
// BEFORE:
const { supabase } = require('../database/supabase');

// Upsert operation
await supabase
  .from('clients')
  .upsert(records, { onConflict: 'id' });

// AFTER:
const postgres = require('../database/postgres');

// Upsert with ON CONFLICT
await postgres.query(
  `INSERT INTO clients (id, name, phone, ...)
   VALUES ($1, $2, $3, ...)
   ON CONFLICT (id) DO UPDATE SET
     name = EXCLUDED.name,
     phone = EXCLUDED.phone,
     ...`,
  [record.id, record.name, record.phone, ...]
);
```

**Estimate:** 6-8 hours (11 files, similar patterns)

---

#### Phase 1.3: Update Services (Day 5)

**Files (6 total):**
- `src/services/ai-admin-v2/index.js`
- `src/services/ai-admin-v2/modules/command-handler.js`
- `src/services/ai-admin-v2/modules/data-loader.js`
- `src/services/booking-monitor/index.js`
- `src/services/webhook-processor/index.js`
- `src/services/marketplace/marketplace-service.js`

**Pattern:** Same as above - direct replacement

**Estimate:** 4-6 hours

---

#### Phase 1.4: Update API Routes + Workers (Day 6)

**API Routes (4 files):**
- `src/api/routes/health.js`
- `src/api/routes/yclients-marketplace.js`
- `src/api/webhooks/yclients.js`
- `src/api/websocket/marketplace-socket.js`

**Workers (2 files):**
- `src/workers/message-worker-v2.js`
- `src/utils/critical-error-logger.js`

**Other (1 file):**
- `src/services/whatsapp/database-cleanup.js`

**Estimate:** 3-4 hours

---

#### Phase 1.5: Testing & Validation (Day 6 evening)

**Tasks:**
1. Unit tests for critical modules
2. Integration tests
3. Compile checks (no TypeScript/syntax errors)
4. Dependency checks (no missing imports)

**Estimate:** 2-3 hours

**Acceptance Criteria:**
- [ ] All 51 files updated
- [ ] No Supabase imports remaining
- [ ] Code compiles successfully
- [ ] Unit tests pass
- [ ] Integration tests pass

---

### Phase 2: Production Cutover (1 day)

**Goal:** Migrate all data and switch production to Timeweb

**Timeline:** Day 7 (Sunday)
**Risk:** HIGH
**Downtime:** 4-6 hours (02:00-08:00)

#### Phase 2.1: Preparation (Day 6 evening)

**Tasks:**
1. Create migration script: `scripts/migrate-all-tables-timeweb.js`
2. Test migration locally (with SSH tunnel)
3. Dry-run on production (read-only)
4. Verify rollback procedure
5. Notify stakeholders (48h advance)

**Estimate:** 4-6 hours

---

#### Phase 2.2: Execution (Sunday 02:00-08:00)

**Detailed Runbook:**

```bash
# ============================================================================
# PHASE 2.2.1: PREPARATION (02:00-02:30) - 30 minutes
# ============================================================================

# 1. Backup everything
ssh root@46.149.70.219
cd /opt/ai-admin

# Backup Supabase
node scripts/backup-supabase.js > backups/supabase_$(date +%Y%m%d_%H%M%S).sql

# Backup Timeweb
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
pg_dump 'postgresql://gen_user:PASSWORD@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full' \
  > backups/timeweb_before_$(date +%Y%m%d_%H%M%S).sql

# Backup .env
cp .env .env.backup.before-migration-$(date +%Y%m%d_%H%M%S)

# 2. Stop all services
pm2 stop all

# 3. Enable maintenance mode
echo "MAINTENANCE=true" >> .env

# 4. Verify no active connections
pm2 status  # All должно быть stopped

# ============================================================================
# PHASE 2.2.2: DATA MIGRATION (02:30-05:30) - 2-3 hours
# ============================================================================

# 5. Run migration script
node scripts/migrate-all-tables-timeweb.js --verify

# Expected output:
#   ✅ companies: 1/1 migrated
#   ✅ clients: 1,299/1,299 migrated
#   ✅ services: 63/63 migrated
#   ✅ staff: 12/12 migrated
#   ✅ staff_schedules: 56/56 migrated
#   ✅ bookings: 38/38 migrated
#   ✅ appointments_cache: X/X migrated
#   ✅ dialog_contexts: 21/21 migrated
#   ✅ reminders: X/X migrated
#   ✅ sync_status: X/X migrated
#   ✅ messages: X/X migrated

# 6. Verify data integrity
node scripts/verify-migration.js

# Должно показать:
#   ✅ All record counts match
#   ✅ All checksums verified
#   ✅ All foreign keys valid

# ============================================================================
# PHASE 2.2.3: CODE DEPLOYMENT (05:30-05:45) - 15 minutes
# ============================================================================

# 7. Deploy new code
git fetch origin
git checkout feature/timeweb-migration
git pull origin feature/timeweb-migration

# 8. Install dependencies (if changed)
npm install

# 9. Verify no Supabase imports remain
grep -r "require.*database/supabase" src/
# Output должен быть пустым!

# ============================================================================
# PHASE 2.2.4: CONFIGURATION UPDATE (05:45-05:50) - 5 minutes
# ============================================================================

# 10. Update .env
nano .env

# Убедиться что:
# - USE_LEGACY_SUPABASE=false (already set)
# - POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net
# - POSTGRES_PORT=5432
# - POSTGRES_DATABASE=default_db
# - POSTGRES_USER=gen_user
# - POSTGRES_PASSWORD=}X|oM595A<7n?0
# - PGSSLROOTCERT=/root/.cloud-certs/root.crt
# - MAINTENANCE=false (remove)

# Или просто:
sed -i 's/MAINTENANCE=true//' .env

# ============================================================================
# PHASE 2.2.5: SERVICE RESTART (05:50-06:30) - 40 minutes
# ============================================================================

# 11. Start services один за другим (staged restart)

# Start Baileys first (critical)
pm2 start ecosystem.config.js --only baileys-whatsapp-service
sleep 60
pm2 logs baileys-whatsapp-service --lines 30
# Ожидаем: ✅ WhatsApp connected (from Timeweb)

# Start worker (critical)
pm2 start ecosystem.config.js --only ai-admin-worker-v2
sleep 30
pm2 logs ai-admin-worker-v2 --lines 30
# Ожидаем: ✅ Worker started, no errors

# Start booking monitor
pm2 start ecosystem.config.js --only ai-admin-booking-monitor
sleep 20
pm2 logs ai-admin-booking-monitor --lines 20

# Start API
pm2 start ecosystem.config.js --only ai-admin-api
sleep 20
curl http://localhost:3000/health
# Ожидаем: {"status":"ok"}

# Start remaining services
pm2 start ecosystem.config.js --only whatsapp-backup-service
pm2 start ecosystem.config.js --only ai-admin-batch-processor
pm2 start ecosystem.config.js --only ai-admin-telegram-bot

# 12. Verify all services online
pm2 status
# All должны быть "online"

# ============================================================================
# PHASE 2.2.6: VERIFICATION (06:30-07:30) - 1 hour
# ============================================================================

# 13. E2E tests
@whatsapp send_message phone:89686484488 message:"Migration test - full system"
sleep 5
@whatsapp get_last_response phone:89686484488
# Ожидаем: AI ответил корректно

# 14. Check database queries
# Timeweb should have recent activity
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
psql 'postgresql://gen_user:PASSWORD@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full' \
  -c "SELECT schemaname, tablename, n_tup_ins, n_tup_upd FROM pg_stat_user_tables ORDER BY n_tup_ins DESC LIMIT 20;"
# Должны видеть недавние INSERT/UPDATE

# Supabase should be IDLE (check dashboard - no new queries)

# 15. Monitor for anomalies
pm2 logs --lines 100 | grep -i error
# Не должно быть критических ошибок

pm2 logs --lines 100 | grep -i supabase
# Не должно быть упоминаний Supabase

# 16. Test critical paths
# - Send/receive WhatsApp message ✅
# - Create booking (if possible)
# - Check schedules load
# - Verify client search works

# ============================================================================
# PHASE 2.2.7: FINAL CHECKS (07:30-08:00) - 30 minutes
# ============================================================================

# 17. Final smoke tests
curl http://localhost:3000/health
curl http://localhost:3000/api/yclients/clients?company_id=962302

# 18. Check PM2 status
pm2 status
pm2 logs --lines 50 --nostream

# 19. Verify Timeweb connection
@logs logs_tail service:ai-admin-worker-v2 lines:50 | grep -i "database\|postgres\|timeweb"

# 20. Confirm success
echo "Migration complete!" | tee migration-success-$(date +%Y%m%d_%H%M%S).log

# ============================================================================
# SUCCESS CRITERIA
# ============================================================================

# ✅ All 8 PM2 services online
# ✅ WhatsApp connected and working
# ✅ Test message sent/received
# ✅ Timeweb queries visible in logs
# ✅ Zero Supabase queries in logs
# ✅ No critical errors
# ✅ All smoke tests passed
```

---

#### Phase 2.3: Post-Migration Monitoring (Days 8-14)

**Daily Monitoring:**
- Day 8 (Mon): Check every 2 hours
- Day 9-10: Check every 6 hours
- Day 11-14: Check every 12 hours

**Metrics to Monitor:**
- PM2 service status (all online)
- Error rates (<5%)
- Message success rate (>98%)
- Database query performance
- Timeweb connection stability
- Memory/CPU usage

**Acceptance Criteria:**
- [ ] 7 days continuous operation
- [ ] Zero Supabase queries
- [ ] Error rate <5%
- [ ] No critical incidents
- [ ] Performance acceptable

---

#### Phase 2.4: Decommission Supabase (Day 14)

**After 7 days stable:**

1. Final verification
   - Confirm zero Supabase queries (7 days)
   - Check all services healthy
   - Verify no hidden dependencies

2. Final backup
   ```bash
   node scripts/backup-supabase.js > backups/supabase_final_$(date +%Y%m%d).sql
   ```

3. Remove credentials
   ```bash
   # Remove from .env
   sed -i '/SUPABASE_URL/d' .env
   sed -i '/SUPABASE_KEY/d' .env
   ```

4. Cancel subscription
   - Log in to Supabase dashboard
   - Cancel project subscription
   - Download final backup

5. Update documentation
   - Remove Supabase references
   - Update architecture docs
   - Update CLAUDE.md

**Acceptance Criteria:**
- [ ] Supabase credentials removed
- [ ] Subscription canceled
- [ ] Final backup stored safely
- [ ] Documentation updated

---

## 📝 Detailed Task Breakdown

### Phase 0.7 Tasks

#### Task 0.7.1: Create auth-state-timeweb.js (3 hours)

**File:** `src/integrations/whatsapp/auth-state-timeweb.js` (NEW)

**Implementation:**
1. Copy structure from `auth-state-supabase.js`
2. Replace imports:
   ```javascript
   // BEFORE:
   const { supabase } = require('../../database/supabase');

   // AFTER:
   const postgres = require('../../database/postgres');
   ```

3. Transform credential loading:
   ```javascript
   // BEFORE:
   const { data: authData, error: authError } = await supabase
     .from('whatsapp_auth')
     .select('creds')
     .eq('company_id', companyId)
     .maybeSingle();

   // AFTER:
   const result = await postgres.query(
     'SELECT creds FROM whatsapp_auth WHERE company_id = $1',
     [companyId]
   );
   const authData = result.rows[0] || null;
   const authError = result.rows.length === 0 ? new Error('Not found') : null;
   ```

4. Transform credential saving:
   ```javascript
   // BEFORE:
   const { error } = await supabase
     .from('whatsapp_auth')
     .upsert({
       company_id: companyId,
       creds: creds,
       updated_at: new Date().toISOString()
     }, {
       onConflict: 'company_id'
     });

   // AFTER:
   await postgres.query(
     `INSERT INTO whatsapp_auth (company_id, creds, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (company_id) DO UPDATE SET
        creds = EXCLUDED.creds,
        updated_at = EXCLUDED.updated_at`,
     [companyId, creds, new Date().toISOString()]
   );
   ```

5. Transform keys.get():
   ```javascript
   // BEFORE:
   const { data, error } = await supabase
     .from('whatsapp_keys')
     .select('key_id, value')
     .eq('company_id', companyId)
     .eq('key_type', type)
     .in('key_id', ids);

   // AFTER:
   const result = await postgres.query(
     'SELECT key_id, value FROM whatsapp_keys WHERE company_id = $1 AND key_type = $2 AND key_id = ANY($3)',
     [companyId, type, ids]
   );
   const data = result.rows;
   ```

6. Transform keys.set():
   ```javascript
   // BEFORE:
   await supabase
     .from('whatsapp_keys')
     .upsert(records, { onConflict: 'company_id,key_type,key_id' });

   // AFTER:
   for (const record of records) {
     await postgres.query(
       `INSERT INTO whatsapp_keys (company_id, key_type, key_id, value, updated_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (company_id, key_type, key_id) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at,
          expires_at = EXCLUDED.expires_at`,
       [record.company_id, record.key_type, record.key_id, record.value, record.updated_at, record.expires_at]
     );
   }
   ```

7. Keep Buffer serialization EXACTLY the same:
   ```javascript
   function reviveBuffers(obj) {
     // КОПИРОВАТЬ КАК ЕСТЬ ИЗ auth-state-supabase.js
   }
   ```

**Acceptance:**
- [ ] File created (~350 lines)
- [ ] All Supabase calls replaced with PostgreSQL
- [ ] Buffer serialization preserved
- [ ] Error handling updated
- [ ] Code compiles without errors

---

#### Task 0.7.2: Update session-pool.js (30 minutes)

**File:** `src/integrations/whatsapp/session-pool.js` (MODIFY)

**Changes:**
```diff
- const { useSupabaseAuthState } = require('./auth-state-supabase');
+ const { useTimewebAuthState } = require('./auth-state-timeweb');

  // В методе _createSessionWithMutex() (примерно строка 945):

  if (useDatabaseAuth) {
    logger.info(`🗄️ Using database auth state for company ${validatedId}`);
-   ({ state, saveCreds } = await useSupabaseAuthState(validatedId));
+   ({ state, saveCreds } = await useTimewebAuthState(validatedId));
  }
```

**Acceptance:**
- [ ] Import updated
- [ ] Function call updated
- [ ] Compiles successfully
- [ ] No other changes needed

---

#### Task 0.7.3: Unit Tests (1 hour)

**Create:** `test-auth-state-timeweb.js`

```javascript
require('dotenv').config();
const { useTimewebAuthState } = require('./src/integrations/whatsapp/auth-state-timeweb');

async function test() {
  console.log('🧪 Testing Timeweb auth state...\n');

  const testCompanyId = '962302';

  try {
    console.log('1️⃣ Loading credentials...');
    const { state, saveCreds } = await useTimewebAuthState(testCompanyId);

    if (!state || !state.creds) {
      throw new Error('Failed to load credentials');
    }
    console.log('✅ Credentials loaded:', {
      hasCreds: !!state.creds,
      hasKeys: !!state.keys,
      credsKeys: Object.keys(state.creds).slice(0, 5)
    });

    console.log('\n2️⃣ Testing credential save...');
    await saveCreds();
    console.log('✅ Credentials saved successfully');

    console.log('\n3️⃣ Testing keys.get()...');
    // Try to get some keys (they might not exist, that's ok)
    const keys = await state.keys.get('app-state-sync-key', ['test-key-1', 'test-key-2']);
    console.log('✅ Keys.get() works:', Object.keys(keys).length, 'keys found');

    console.log('\n4️⃣ Testing keys.set()...');
    await state.keys.set({
      'test-type': {
        'test-key-123': { testData: 'value' }
      }
    });
    console.log('✅ Keys.set() works');

    console.log('\n🎉 All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
```

**Run:**
```bash
node test-auth-state-timeweb.js
```

**Acceptance:**
- [ ] Credentials load successfully
- [ ] Credentials save successfully
- [ ] Keys get/set works
- [ ] Buffer objects preserved
- [ ] No errors

---

#### Task 0.7.4: Integration Test on VPS (1 hour)

**Steps:**
```bash
# 1. Deploy code
git add src/integrations/whatsapp/auth-state-timeweb.js
git add src/integrations/whatsapp/session-pool.js
git add test-auth-state-timeweb.js
git commit -m "feat: Phase 0.7 - Switch Baileys to Timeweb PostgreSQL"
git push origin main

# 2. SSH to VPS
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# 3. Backup sessions
cp -r baileys_sessions baileys_sessions.backup.$(date +%Y%m%d_%H%M%S)

# 4. Pull code
git pull origin main

# 5. Restart Baileys
pm2 restart baileys-whatsapp-service

# 6. Monitor logs (5 minutes)
pm2 logs baileys-whatsapp-service --lines 50

# Expected output:
#   🗄️ Using database auth state for company 962302
#   ✅ Loaded existing credentials for 962302
#   ✅ WhatsApp connected
```

**Acceptance:**
- [ ] Baileys service starts without errors
- [ ] Logs show "Loaded existing credentials"
- [ ] WhatsApp shows "Connected"
- [ ] No Supabase queries in logs
- [ ] Connection stable for 5 minutes

---

#### Task 0.7.5: E2E Test (30 minutes)

**Test via MCP:**
```bash
# 1. Send test message
@whatsapp send_message phone:89686484488 message:"Phase 0.7 test: Baileys теперь на Timeweb"

# 2. Check worker logs
@logs logs_tail service:ai-admin-worker-v2 lines:50

# 3. Verify response
@whatsapp get_last_response phone:89686484488

# 4. Check context saved
@redis get_context phone:89686484488
```

**Acceptance:**
- [ ] Message delivered successfully
- [ ] AI response generated
- [ ] Response sent back
- [ ] Context saved in Redis
- [ ] No errors in logs

---

#### Task 0.7.6: Monitor 24 Hours (1 day)

**Monitoring Script:** `scripts/monitor-phase-07.sh`

```bash
#!/bin/bash
# Run every 6 hours for 24 hours

echo "🔍 Phase 0.7 Monitoring - $(date)"

echo "\n1️⃣ PM2 Status:"
pm2 status | grep baileys

echo "\n2️⃣ Baileys Logs (last 30 lines):"
pm2 logs baileys-whatsapp-service --lines 30 --nostream | tail -20

echo "\n3️⃣ Check for Supabase queries:"
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -i supabase | wc -l
# Should be 0

echo "\n4️⃣ Check Timeweb queries:"
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -i "whatsapp_auth\|whatsapp_keys" | head -5

echo "\n5️⃣ Error count:"
pm2 logs baileys-whatsapp-service --err --lines 100 --nostream | wc -l

echo "\n6️⃣ Message flow:"
pm2 logs ai-admin-worker-v2 --lines 100 --nostream | grep "Emitting message event" | wc -l

echo "\n✅ Monitoring complete"
```

**Schedule:**
```bash
# Run 4 times (every 6 hours)
0 */6 * * * /opt/ai-admin/scripts/monitor-phase-07.sh >> /var/log/phase-07-monitoring.log 2>&1
```

**Acceptance:**
- [ ] Baileys connected 100% of time
- [ ] Messages sent/received successfully
- [ ] Zero Supabase queries in logs
- [ ] Timeweb queries visible in logs
- [ ] Error rate <5%
- [ ] 24 hours continuous operation

---

### Phase 1 File Update Matrix

| File | Lines | Category | Queries | Effort | Day |
|------|-------|----------|---------|--------|-----|
| `src/integrations/yclients/data/supabase-data-layer.js` | 977 | Data Layer | 50+ | 8h | Day 3 |
| `src/sync/clients-sync.js` | ~200 | Sync | 10+ | 1.5h | Day 4 |
| `src/sync/services-sync.js` | ~150 | Sync | 5+ | 1h | Day 4 |
| `src/sync/staff-sync.js` | ~150 | Sync | 5+ | 1h | Day 4 |
| `src/sync/schedules-sync.js` | ~200 | Sync | 10+ | 1.5h | Day 4 |
| `src/sync/bookings-sync.js` | ~200 | Sync | 10+ | 1.5h | Day 4 |
| `src/sync/client-records-sync.js` | ~150 | Sync | 5+ | 1h | Day 4 |
| `src/sync/company-info-sync.js` | ~100 | Sync | 3+ | 0.5h | Day 4 |
| `src/sync/goods-transactions-sync.js` | ~150 | Sync | 5+ | 1h | Day 4 |
| `src/sync/visits-sync.js` | ~150 | Sync | 5+ | 1h | Day 4 |
| `src/sync/clients-sync-optimized.js` | ~200 | Sync | 10+ | 1.5h | Day 4 |
| `src/sync/sync-manager.js` | ~100 | Sync | 3+ | 0.5h | Day 4 |
| `src/services/ai-admin-v2/index.js` | ~500 | Service | 15+ | 2h | Day 5 |
| `src/services/ai-admin-v2/modules/command-handler.js` | ~800 | Service | 20+ | 3h | Day 5 |
| `src/services/ai-admin-v2/modules/data-loader.js` | ~300 | Service | 10+ | 1.5h | Day 5 |
| `src/services/booking-monitor/index.js` | ~400 | Service | 10+ | 2h | Day 5 |
| `src/services/webhook-processor/index.js` | ~300 | Service | 5+ | 1h | Day 5 |
| `src/services/marketplace/marketplace-service.js` | ~400 | Service | 10+ | 2h | Day 5 |
| `src/api/routes/health.js` | ~50 | API | 2+ | 0.5h | Day 6 |
| `src/api/routes/yclients-marketplace.js` | ~200 | API | 5+ | 1h | Day 6 |
| `src/api/webhooks/yclients.js` | ~150 | API | 5+ | 1h | Day 6 |
| `src/api/websocket/marketplace-socket.js` | ~200 | API | 5+ | 1h | Day 6 |
| `src/workers/message-worker-v2.js` | ~400 | Worker | 5+ | 1.5h | Day 6 |
| `src/utils/critical-error-logger.js` | ~100 | Util | 3+ | 0.5h | Day 6 |
| `src/services/whatsapp/database-cleanup.js` | ~150 | Service | 5+ | 1h | Day 6 |

**Total:** 51 files, ~6,000 lines, ~200 queries, ~40 hours estimated

---

## ⚠️ Risk Assessment

### Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Baileys disconnection (Phase 0.7)** | 20-25% | HIGH | - Full backup before change<br>- Fast rollback (<2 min)<br>- Monitor continuously<br>- Test thoroughly before prod |
| **Query transformation errors** | 30-35% | MEDIUM | - Test each file after changes<br>- Unit tests for critical paths<br>- Code review before commit<br>- Staging environment tests |
| **Data loss during migration** | 5-10% | CRITICAL | - Multiple backups<br>- Checksum verification<br>- Keep Supabase for 7 days<br>- Transaction-based migration |
| **Extended downtime (>6 hours)** | 15-20% | HIGH | - Rehearse migration 2x<br>- Optimize batch sizes<br>- Parallel preparation<br>- Clear Go/No-Go criteria |
| **Performance degradation** | 20-25% | MEDIUM | - Benchmark queries<br>- Optimize indexes<br>- Connection pool tuning<br>- Monitor latency |
| **Production breaks after switch** | 15-20% | HIGH | - Gradual service startup<br>- Per-service monitoring<br>- Fast rollback capability<br>- E2E tests |

### Risk Mitigation Strategies

**Phase 0.7 Specific:**
1. Backup `baileys_sessions/` directory before any changes
2. Monitor logs continuously during test period
3. Rollback in <2 minutes if issues detected
4. Test with non-critical test phone number first

**Phase 1 Specific:**
1. Update files incrementally (not all at once)
2. Test each file after changes
3. Commit frequently (per-file or per-category)
4. Keep branches for rollback capability
5. Code review before merging

**Phase 2 Specific:**
1. Multiple backup layers (Supabase + Timeweb + file backups)
2. Transaction-based migration (atomic per table)
3. Checksum verification after each table
4. Keep Supabase read-only for 7 days (safety net)
5. Staged service restarts (one at a time, verify each)
6. Clear rollback procedures documented and tested

---

## 📊 Success Metrics

### Phase 0.7 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Baileys uptime | 100% | PM2 status + logs |
| Message success rate | >98% | Worker logs count |
| Supabase query rate (Baileys) | 0 queries | Log analysis |
| Timeweb query rate (Baileys) | >0 queries | Log analysis |
| Error rate | <5% | Error logs count |
| Connection stability | 24 hours | Uptime monitoring |

### Phase 1 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Files updated | 51/51 | Git diff |
| Supabase imports removed | 0 remaining | `grep -r "require.*supabase"` |
| Code compiles | No errors | `npm run build` (if applicable) |
| Unit tests pass | 100% | Test runner |
| Integration tests pass | 100% | Test runner |

### Phase 2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Data migration completeness | 100% | Record counts match |
| Data integrity | 100% | Checksum verification |
| Migration time | <3 hours | Execution logs |
| Service startup time | <5 minutes | PM2 timestamps |
| E2E test pass rate | 100% | Test results |
| Post-migration uptime | >99.9% (7 days) | PM2 monitoring |
| Performance vs baseline | Same or better | Response time logs |
| Supabase query rate | 0 queries | Log analysis |
| Rollback time (if needed) | <5 minutes | Procedure execution |

---

## 🔧 Required Resources

### Infrastructure

**Existing (no changes):**
- Production VPS: 46.149.70.219 (Timeweb Moscow)
- Timeweb PostgreSQL: a84c973324fdaccfc68d929d.twc1.net:5432
- Supabase PostgreSQL (legacy, will decommission after 7 days)
- Redis (for context cache)

**Access Required:**
- SSH access to VPS
- Timeweb PostgreSQL credentials (already configured)
- Supabase credentials (read/write during migration, read-only after)
- PM2 control
- Environment variables edit access

### Development Tools

**Required:**
- Node.js 20.x LTS
- PostgreSQL client (psql)
- Git
- PM2 CLI
- MCP servers (WhatsApp, Redis, Logs, Supabase)

### Team

**Roles:**
- **Developer**: Implement code changes (Phases 0.7 + 1)
- **DevOps**: Deploy, monitor, execute migration (Phase 2)
- **QA**: Test E2E scenarios, verify data integrity
- **On-Call** (Phase 2): 2 people during maintenance window

**Time Commitment:**
- Phase 0.7: 1-2 days (1 developer)
- Phase 1: 3-4 days (1 developer)
- Phase 2: 1 day prep + 6 hours execution (1-2 people on-call)

---

## 🗓️ Timeline Estimates

| Day | Phase | Hours | Tasks |
|-----|-------|-------|-------|
| **Mon (Day 1)** | Phase 0.7 | 8h | Create auth-state-timeweb.js, update session-pool.js, unit tests |
| **Tue (Day 2)** | Phase 0.7 | 2h + monitoring | Deploy, integration test, E2E test, start 24h monitoring |
| **Wed (Day 3)** | Phase 1.1 | 8h | Update data layer (977 lines) |
| **Thu (Day 4)** | Phase 1.2 | 8h | Update 11 sync scripts |
| **Fri (Day 5)** | Phase 1.3 | 8h | Update 6 services |
| **Sat (Day 6)** | Phase 1.4-1.5 | 8h | Update API routes/workers, testing |
| **Sun (Day 7)** | Phase 2 | 6h | Production cutover (02:00-08:00) |
| **Mon-Sun (Days 8-14)** | Phase 2.3 | monitoring | 7-day monitoring, then decommission Supabase |

**Total Calendar Time:** 7 days (+ 7 days monitoring)
**Total Development Time:** 48 hours
**Downtime:** 4-6 hours (Sunday early morning)

---

## 📂 Dependencies

### External Dependencies

**Services:**
- Timeweb PostgreSQL (must remain online)
- Supabase (must remain accessible during migration)
- Redis (for context cache)
- PM2 (process manager)
- WhatsApp Web (Baileys connection)

**APIs:**
- YClients API (booking system)
- Google Gemini API (AI provider)
- Telegram Bot API (notifications)

### Internal Dependencies

**Code Modules:**
- `src/database/postgres.js` (Timeweb connection)
- `src/integrations/whatsapp/auth-state-timeweb.js` (new Baileys auth)
- `src/config/index.js` (configuration)

**Data:**
- Baileys WhatsApp sessions (whatsapp_auth + whatsapp_keys)
- Business data (clients, services, staff, bookings)
- Historical data (appointments_cache, messages)
- Configuration (companies)

### Task Dependencies

**Critical Path:**
```
Phase 0.7 (Days 1-2) BLOCKS Phase 1
  ↓
Phase 1 (Days 3-6) BLOCKS Phase 2
  ↓
Phase 2 (Day 7) → Monitoring (Days 8-14)
```

**Phase 0.7 must complete first** because:
- Validates Timeweb PostgreSQL works for Baileys
- Tests connection stability
- Proves migration approach viable
- Unblocks code transformation work

---

## 🚨 Rollback Procedures

### Phase 0.7 Rollback (<2 minutes)

**Trigger:** Baileys disconnected >10 minutes OR error rate >20%

**Steps:**
```bash
# 1. SSH to VPS
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# 2. Checkout previous commit
git log --oneline -5  # Find commit before Phase 0.7
git checkout <previous-commit-hash>

# 3. Restart Baileys service
pm2 restart baileys-whatsapp-service

# 4. Verify connection
pm2 logs baileys-whatsapp-service --lines 20
# Expected: "Using Supabase auth state" + "WhatsApp connected"

# 5. Test message
@whatsapp send_message phone:89686484488 message:"Rollback test"

# 6. If needed, restore session files
rm -rf /opt/ai-admin/baileys_sessions
mv /opt/ai-admin/baileys_sessions.backup.* /opt/ai-admin/baileys_sessions
pm2 restart baileys-whatsapp-service
```

**Recovery Time:** 2 minutes
**Data Loss:** None (Supabase unchanged)

---

### Phase 1 Rollback (<5 minutes)

**Trigger:** Code doesn't compile OR tests failing

**Steps:**
```bash
# 1. Revert to previous commit
git log --oneline -10  # Find last working commit
git revert HEAD  # Or git reset --hard <commit-hash>
git push origin main --force

# 2. SSH to VPS
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin main --force

# 3. Restart services
pm2 restart all

# 4. Verify
pm2 status
pm2 logs --lines 50
```

**Recovery Time:** 5 minutes
**Data Loss:** None (code-only rollback)

---

### Phase 2 Rollback (<5 minutes)

**Trigger:**
- Data verification fails
- Services won't start
- Error rate >20%
- Any PRIMARY success criterion not met

**Steps:**
```bash
# 1. Stop new server (all services)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
pm2 stop all

# 2. Revert code
git checkout <commit-before-migration>

# 3. Restore .env to Supabase mode
cp /opt/ai-admin/.env.backup.before-migration .env

# 4. Restart all services
pm2 restart all

# 5. Verify all services online
pm2 status
# All должны быть "online"

# 6. Test critical paths
curl http://localhost:3000/health
@whatsapp send_message phone:89686484488 message:"Rollback test"

# 7. Monitor logs
pm2 logs --lines 100 | grep -i error
# Should see connections to Supabase (not Timeweb)

# 8. Notify team
echo "Rollback executed. Supabase operational. Timeweb migration postponed." | mail -s "Migration Rollback" team@example.com
```

**Recovery Time:** 5 minutes
**Data Loss:** None (Supabase was not modified during failed migration)

---

## 📞 Communication Plan

### Before Phase 0.7 (24 hours advance)

**To Team (internal):**
```
📋 Phase 0.7 Scheduled: Baileys Database Switch

Date: [DATE]
Time: [TIME] (estimated 2 hours)
Expected Impact: Brief service restart (5-10 minutes)

What: Switching Baileys WhatsApp to read from Timeweb PostgreSQL
Why: Complete interrupted Phase 0 migration
Risk: LOW (fast rollback available)

Monitoring: 24 hours after switch
Point of Contact: [DevOps Engineer]
```

---

### Before Phase 2 (48 hours advance)

**To Clients (via WhatsApp/Telegram):**
```
🔧 Уважаемые клиенты!

[DATE] с 02:00 до 08:00 (4-6 часов)
WhatsApp бот будет недоступен из-за технического обслуживания.

Проводится обновление инфраструктуры для повышения скорости и надежности сервиса.

Приносим извинения за временные неудобства.
После обслуживания бот будет работать еще быстрее!

С уважением,
Команда AI Admin
```

**To Team (internal):**
```
📋 Full Database Migration Scheduled

Date: [DATE]
Window: 02:00-08:00 (6 hours)
Expected Downtime: 4-6 hours

Runbook: dev/active/database-migration-completion/database-migration-completion-plan.md
Status Updates: Every 30 minutes during window

On-Call:
- Primary: [DevOps Engineer]
- Backup: [Backend Developer]

Rollback Plan: <5 minutes if needed
```

---

### During Migration (every 30 minutes)

**Status Update Format:**
```
🔄 Migration Status: [TIME]

Phase: [CURRENT PHASE]
Progress: [X/11 tables completed]
Duration: [HH:MM elapsed]
ETA: [HH:MM remaining]

Services: [online/stopped count]
Errors: [count if any]

Status: [ON TRACK / DELAYED / ISSUE]
```

---

### After Successful Migration

**To Clients:**
```
✅ Техническое обслуживание завершено!

WhatsApp бот снова доступен и работает еще быстрее благодаря обновленной инфраструктуре.

Спасибо за терпение!
С уважением,
Команда AI Admin
```

**To Team:**
```
🎉 DATABASE MIGRATION SUCCESS!

AI Admin v2 successfully migrated to Timeweb PostgreSQL.

Key Improvements:
✅ Database latency: <1ms (20-50x faster)
✅ All data migrated (100% verified)
✅ All services operational
✅ Zero errors after switchover
✅ 152-ФЗ compliance achieved

Total Downtime: [X hours Y minutes]
Status: OPERATIONAL

Next: 7-day monitoring period before Supabase decommission
```

---

## 📚 References

**Related Documentation:**
- `dev/active/datacenter-migration-msk-spb/CRITICAL_ISSUE_PHASE_0_INCOMPLETE.md` - Discovery of incomplete Phase 0
- `dev/active/datacenter-migration-msk-spb/datacenter-migration-msk-spb-context.md` - Original Phase 0 execution
- `docs/TIMEWEB_POSTGRES_SUMMARY.md` - Timeweb PostgreSQL setup
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- `CLAUDE.md` - Project quick reference

**Key Files:**
- `src/integrations/whatsapp/auth-state-supabase.js` - Current Baileys auth (hardcoded Supabase)
- `src/database/postgres.js` - Timeweb PostgreSQL connection pool
- `src/database/supabase.js` - Legacy Supabase client (will be removed)
- `src/config/index.js` - Configuration

**Scripts:**
- `scripts/migrate-supabase-to-timeweb.js` - Phase 0 migration (whatsapp tables only)
- `scripts/test-timeweb-connection.sh` - Connection test
- `scripts/apply-schema-timeweb.sh` - Schema application
- `scripts/migrate-all-tables-timeweb.js` - Full migration script (to be created)

---

## 🎯 Why This Approach Works

### Advantages of Direct Replacement

1. **Simpler Architecture**
   - No abstraction layer to maintain
   - Direct PostgreSQL queries (standard SQL)
   - Easier to understand and debug

2. **Faster Timeline**
   - 7 days instead of 24 days
   - Less code to write
   - Fewer moving parts

3. **Lower Risk**
   - Fewer integration points
   - Standard PostgreSQL patterns
   - Well-understood technology

4. **Better Performance**
   - No abstraction overhead
   - Direct connection pooling
   - Optimized queries

5. **Easier Maintenance**
   - Standard SQL queries
   - No custom query builder
   - Industry-standard patterns

### Why No Abstraction Layer

- **Permanent Migration:** Never going back to Supabase (152-ФЗ)
- **Single Database:** Only Timeweb going forward
- **Overengineering:** Abstraction adds complexity without benefit
- **Maintenance Cost:** More code = more bugs
- **Performance:** Direct queries are faster

---

**Created:** 2025-11-07
**Revised:** 2025-11-07 (simplified, removed abstraction layer)
**Status:** READY FOR EXECUTION
**Next Action:** Review plan → Confirm → Begin Phase 0.7 (Day 1)
