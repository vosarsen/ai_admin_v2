# 🚀 Phase 0 Quick Start: Database Migration (Supabase → Timeweb PostgreSQL)

**Last Updated:** 2025-11-06
**Status:** Ready to execute
**Duration:** ~10-12 hours work over 7 days + 10-15 min downtime

---

## ⚠️ Critical Information

**What:** Migrate Baileys WhatsApp sessions from Supabase to Timeweb PostgreSQL
**Why:** Prepare for server migration (Phase 1-6) by migrating database first
**Risk:** CRITICAL - Losing Baileys sessions = WhatsApp disconnection = downtime

**Critical Tables:**
- `whatsapp_auth` - Baileys credentials (1 record: company_962302)
- `whatsapp_keys` - Signal Protocol keys (335 records)

**Downtime:** 10-15 minutes during Phase 0.5 (database switchover)

---

## 📋 Prerequisites

- [ ] SSH access to production server: `ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219`
- [ ] `.env` file contains:
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `POSTGRES_PASSWORD=}X|oM595A<7n?0`
- [ ] Node.js packages installed:
  ```bash
  npm install @supabase/supabase-js pg dotenv
  ```
- [ ] PostgreSQL client installed:
  ```bash
  # Ubuntu/Debian
  sudo apt install postgresql-client

  # macOS
  brew install postgresql
  ```

---

## 🎯 Phase 0.1: Prepare Timeweb PostgreSQL (~2 hours)

### Step 1: Setup SSH Tunnel

**From your local machine:**

```bash
# Start tunnel
./scripts/setup-timeweb-tunnel.sh start

# Verify tunnel is working
./scripts/setup-timeweb-tunnel.sh status

# Expected output:
# ✅ SSH tunnel is running (PID: 12345)
#    Local:  localhost:5433
#    Remote: 192.168.0.4:5432 (via 46.149.70.219)
# ✅ Tunnel is working, database accessible
```

**Alternatively, from production server:**

```bash
# SSH to production server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# No tunnel needed - direct internal network access
export POSTGRES_HOST=192.168.0.4
export POSTGRES_PORT=5432
```

### Step 2: Test Timeweb PostgreSQL Connection

```bash
# Test connection
./scripts/test-timeweb-connection.sh

# Expected output:
# ✅ Connection successful!
# ✅ CREATE/INSERT/SELECT test passed
# ✅ All tests passed! Timeweb PostgreSQL is ready for migration.
```

**Troubleshooting:**
- ❌ Connection failed → Check tunnel is running: `./scripts/setup-timeweb-tunnel.sh status`
- ❌ Password incorrect → Verify `POSTGRES_PASSWORD` in `.env`
- ❌ Database not found → Contact Timeweb support

---

## 🎯 Phase 0.2: Migrate Database Schema (~2 hours)

### Step 1: Apply Schema to Timeweb PostgreSQL

```bash
# Apply all migrations
./scripts/apply-schema-timeweb.sh

# Expected output:
# ✅ Base schema applied
# ✅ 20251007_create_whatsapp_auth_tables.sql applied successfully
# ✅ 20251008_optimize_whatsapp_keys.sql applied successfully
# ✅ Schema applied successfully to Timeweb PostgreSQL!
```

### Step 2: Verify Tables Created

```bash
# Check tables exist
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" -c "\dt"

# Expected tables:
#  whatsapp_auth
#  whatsapp_keys
#  [other application tables...]
```

### Step 3: Verify Table Structures

```bash
# Check whatsapp_auth structure
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" -c "\d whatsapp_auth"

# Expected columns:
#  company_id (TEXT, PRIMARY KEY)
#  creds (JSONB)
#  created_at (TIMESTAMPTZ)
#  updated_at (TIMESTAMPTZ)

# Check whatsapp_keys structure
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" -c "\d whatsapp_keys"

# Expected columns:
#  company_id (TEXT)
#  key_type (TEXT)
#  key_id (TEXT)
#  value (JSONB)
#  created_at, updated_at, expires_at
#  PRIMARY KEY (company_id, key_type, key_id)
```

**✅ Checkpoint:** Tables created successfully with correct structures

---

## 🎯 Phase 0.3: Migrate Data (~4-6 hours)

### Step 1: Verify Pre-Migration Counts

```bash
# Check counts (verify-only mode)
node scripts/migrate-supabase-to-timeweb.js --verify-only

# Expected output:
# ✅ whatsapp_auth:
#    Supabase: 1
#    Timeweb:  0
#    Status:   MISMATCH (expected before migration)
#
# ✅ whatsapp_keys:
#    Supabase: 335
#    Timeweb:  0
#    Status:   MISMATCH (expected before migration)
```

### Step 2: Test Migration (Dry Run)

```bash
# Dry run - no actual data written
node scripts/migrate-supabase-to-timeweb.js --dry-run

# Expected output:
# 🔍 DRY RUN - Would migrate:
#    whatsapp_auth: 1 record(s)
#    whatsapp_keys: 335 keys
```

### Step 3: Run Full Migration

**⚠️ WARNING:** This will write data to Timeweb PostgreSQL

```bash
# Run migration
node scripts/migrate-supabase-to-timeweb.js

# You'll be asked for confirmation:
# ⚠️  WARNING: This will write data to Timeweb PostgreSQL
# ⚠️  Existing records with same keys will be UPDATED
#
# Do you want to proceed with migration? (yes/no):

# Type "yes" to continue

# Expected output:
# ✅ whatsapp_auth migration complete: 1/1 records
# ✅ whatsapp_keys migration complete: 335/335 records
# ✅ Verification: All record counts match!
#
# Duration: ~15-30 seconds
```

**✅ Checkpoint:** All data migrated successfully, counts match

---

## 🎯 Phase 0.4: Verification (~2 hours)

### Step 1: Verify Data Integrity

```bash
# Check record counts
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" << EOF
SELECT 'whatsapp_auth' as table, COUNT(*) as count FROM whatsapp_auth
UNION ALL
SELECT 'whatsapp_keys', COUNT(*) FROM whatsapp_keys;
EOF

# Expected:
#  whatsapp_auth |   1
#  whatsapp_keys | 335
```

### Step 2: Test Application Connection

**Create test .env file:**

```bash
# Copy .env to .env.test
cp .env .env.test

# Edit .env.test - set:
USE_LEGACY_SUPABASE=false
POSTGRES_HOST=localhost  # or 192.168.0.4 if on VPS
POSTGRES_PORT=5433       # or 5432 if on VPS
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
```

**Test with Node.js:**

```bash
# Test database connection
node -e "
require('dotenv').config({ path: '.env.test' });
const postgres = require('./src/database/postgres');
postgres.query('SELECT NOW()').then(r => {
  console.log('✅ Connection OK:', r.rows[0]);
  process.exit(0);
}).catch(e => {
  console.error('❌ Connection failed:', e.message);
  process.exit(1);
});
"
```

### Step 3: Test Baileys Session Loading

```bash
# Test loading Baileys credentials
node -e "
require('dotenv').config({ path: '.env.test' });
const { useDatabaseAuthState } = require('./src/integrations/whatsapp/database-auth-state');

(async () => {
  try {
    const { state, saveCreds } = await useDatabaseAuthState('962302');
    console.log('✅ Baileys state loaded successfully');
    console.log('   Credentials:', state.creds ? 'Present' : 'Missing');
    console.log('   Keys count:', Object.keys(state.keys || {}).length);
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to load Baileys state:', error.message);
    process.exit(1);
  }
})();
"
```

**✅ Checkpoint:** Application can read Baileys sessions from Timeweb PostgreSQL

---

## 🎯 Phase 0.5: Database Switchover (~10-15 minutes)

**⚠️ MAINTENANCE WINDOW - THIS WILL CAUSE DOWNTIME**

### Pre-Switchover Checklist

- [ ] Notify users 24 hours in advance
- [ ] Backup current `.env` file
- [ ] All Phase 0.1-0.4 tasks completed successfully
- [ ] Final data sync completed
- [ ] Team ready to rollback if needed

### Switchover Procedure

**Step 1: Stop All Services**

```bash
# SSH to production server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# Stop all PM2 services
pm2 stop all

# Verify all stopped
pm2 status
# All services should show "stopped"
```

**Step 2: Final Data Sync**

```bash
# Run migration one more time to capture any last changes
node scripts/migrate-supabase-to-timeweb.js

# Verify counts match
node scripts/migrate-supabase-to-timeweb.js --verify-only
```

**Step 3: Update .env**

```bash
# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update .env - change these lines:
nano .env
```

**Change in .env:**

```bash
# OLD (Supabase):
USE_LEGACY_SUPABASE=true
# SUPABASE_URL=...
# SUPABASE_KEY=...

# NEW (Timeweb PostgreSQL):
USE_LEGACY_SUPABASE=false
POSTGRES_HOST=192.168.0.4
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
```

**Step 4: Restart Services**

```bash
# Start all services
pm2 start all

# Wait 10 seconds for startup
sleep 10

# Check status
pm2 status

# Expected: All services "online"
```

**Step 5: Verify Services**

```bash
# Check logs for errors
pm2 logs --lines 50 --nostream

# Look for:
# ✅ "Database connected" or similar
# ✅ "WhatsApp connected"
# ❌ NO database connection errors
# ❌ NO "Baileys auth failed" errors
```

### GO/NO-GO Decision

**✅ GO - Switchover successful:**
- All PM2 services "online"
- WhatsApp connected (check in PM2 logs)
- Database queries work
- Test message processed successfully

**❌ NO-GO - Rollback to Supabase:**

```bash
# Stop services
pm2 stop all

# Restore .env
cp .env.backup.* .env

# Change back to Supabase:
# USE_LEGACY_SUPABASE=true

# Restart services
pm2 start all

# Verify rollback successful
pm2 logs --lines 50
```

**✅ Checkpoint:** Database switched to Timeweb PostgreSQL, all services online

---

## 🎯 Phase 0.6: Post-Switchover Testing (7 days)

### Day 0: Intensive Monitoring (2 hours)

```bash
# Monitor logs continuously
pm2 logs --lines 100

# Check every 15 minutes:
# ✅ No database errors
# ✅ WhatsApp responding to messages
# ✅ Bookings being created successfully
# ✅ No Sentry errors related to database
```

**Test Checklist:**

```bash
# Test 1: Send WhatsApp message
# From phone: Send "привет" to +79936363848
# Expected: Bot responds

# Test 2: Check database queries
psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" -c "
SELECT NOW() as time,
       (SELECT COUNT(*) FROM whatsapp_auth) as auth_count,
       (SELECT COUNT(*) FROM whatsapp_keys) as keys_count;
"

# Test 3: Check PM2 status
pm2 status
# All services should be "online"

# Test 4: Check error rate
pm2 logs --err --lines 50
# Should have minimal/no errors
```

### Day 1-7: Daily Checks

**Daily checklist:**

```bash
# 1. Check uptime
pm2 status

# 2. Check for errors
pm2 logs --err --lines 100 --nostream

# 3. Check database performance
psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" -c "
SELECT
  NOW() as check_time,
  pg_size_pretty(pg_database_size('default_db')) as db_size,
  (SELECT COUNT(*) FROM whatsapp_auth) as auth_records,
  (SELECT COUNT(*) FROM whatsapp_keys) as key_records;
"

# 4. Test message processing
# Send test message via WhatsApp
```

**Track Metrics:**

| Day | Uptime % | WhatsApp Status | DB Query Time | Errors | Notes |
|-----|----------|-----------------|---------------|--------|-------|
| 0   | ____%    | ___             | ___ms         | ___    | ___ |
| 1   | ____%    | ___             | ___ms         | ___    | ___ |
| 2   | ____%    | ___             | ___ms         | ___    | ___ |
| 3   | ____%    | ___             | ___ms         | ___    | ___ |
| 4   | ____%    | ___             | ___ms         | ___    | ___ |
| 5   | ____%    | ___             | ___ms         | ___    | ___ |
| 6   | ____%    | ___             | ___ms         | ___    | ___ |
| 7   | ____%    | ___             | ___ms         | ___    | ___ |

**Success Criteria for Day 7:**

- [ ] 99%+ uptime
- [ ] WhatsApp connected and responding
- [ ] No critical database errors
- [ ] Average response time <100ms
- [ ] All services running stable

**✅ Checkpoint:** 7 days stable operation confirmed

---

## ✅ Phase 0 Complete! Ready for Phase 1 (Server Migration)

Once Phase 0.6 is complete with 7 days of stable operation, you're ready to proceed with Phase 1-6 (Server Migration).

**What we accomplished:**

- ✅ Migrated Baileys sessions from Supabase to Timeweb PostgreSQL
- ✅ Verified data integrity (1 auth record, 335 keys)
- ✅ Switched production to use Timeweb PostgreSQL
- ✅ Confirmed 7 days of stable operation

**Next Phase:** Phase 1 - Server Migration Preparation (see `datacenter-migration-msk-spb-plan.md`)

---

## 🚨 Troubleshooting

### Issue: Migration script fails with "connection refused"

**Solution:**
```bash
# Check tunnel is running
./scripts/setup-timeweb-tunnel.sh status

# If not running, start it
./scripts/setup-timeweb-tunnel.sh start
```

### Issue: "password authentication failed"

**Solution:**
```bash
# Verify password in .env
grep POSTGRES_PASSWORD .env

# Should be: POSTGRES_PASSWORD=}X|oM595A<7n?0
```

### Issue: Services won't start after switchover

**Solution:**
```bash
# Check .env is correct
grep USE_LEGACY_SUPABASE .env
# Should be: USE_LEGACY_SUPABASE=false

# Check logs for specific error
pm2 logs --lines 100 --nostream
```

### Issue: WhatsApp disconnected after switchover

**Solution:**
```bash
# Verify Baileys data migrated correctly
psql "postgresql://..." -c "
SELECT company_id,
       created_at,
       updated_at,
       jsonb_typeof(creds) as creds_type
FROM whatsapp_auth;
"

# If data missing → Rollback to Supabase immediately
```

---

## 📞 Emergency Rollback

**If critical issues occur during/after switchover:**

```bash
# 1. Stop all services
pm2 stop all

# 2. Restore .env backup
cp .env.backup.YYYYMMDD_HHMMSS .env

# 3. Ensure USE_LEGACY_SUPABASE=true
nano .env

# 4. Restart services
pm2 start all

# 5. Verify rollback
pm2 status && pm2 logs --lines 50
```

**Rollback time:** <5 minutes
**Data loss risk:** None (Supabase still has all data)

---

## 📋 Files Created

- ✅ `scripts/migrate-supabase-to-timeweb.js` - Main migration script
- ✅ `scripts/setup-timeweb-tunnel.sh` - SSH tunnel manager
- ✅ `PHASE_0_QUICK_START.md` - This guide

---

**Last Updated:** 2025-11-06
**Status:** Ready for execution
**Estimated Total Time:** 7-14 days (including 7-day stability testing)

🚀 Good luck with Phase 0! Remember: Test thoroughly, verify everything, and don't rush the 7-day stability period.
