# Datacenter Migration Plan: Moscow → St. Petersburg (Timeweb)
**Last Updated: 2025-11-05**

---

## Executive Summary

### Objective
Migrate AI Admin v2 production infrastructure from **Timeweb Moscow datacenter** to **Timeweb St. Petersburg datacenter** to enable internal network connectivity between application server and managed PostgreSQL database via "Cute Crossbill" private network.

**Current Situation**: Application server in Timeweb Moscow, PostgreSQL database in Timeweb St. Petersburg → accessing database via SSH tunnel (slow, 20-50ms latency).

**Target Situation**: Both application server and PostgreSQL in Timeweb St. Petersburg → direct internal network access (<1ms latency, 20-50x faster).

### Approach
**Two-Stage Migration**:
1. **Stage 1 (Phase 0)**: Database Migration (Supabase → Timeweb PostgreSQL) - FIRST
2. **Stage 2 (Phases 1-6)**: Server Migration (Moscow → St. Petersburg) - SECOND

This approach tests database migration separately before moving the server, significantly reducing risk.

### Timeline
**~17-24 days total** (in two stages with mandatory testing periods)
- **Stage 1**: 7-14 days (DB migration + 7 days stability testing)
- **Stage 2**: ~10 days (server migration with 48h parallel + 7 days monitoring)

### Downtime
**Total: ~2.5-4.25 hours** (across two maintenance windows)
- **Stage 1**: 10-15 minutes (database switchover)
- **Stage 2**: 2-4 hours (server migration)

### Success Criteria
- ✅ All 8 PM2 services running stable
- ✅ WhatsApp bot responding to messages
- ✅ PostgreSQL accessible via internal network (<1ms latency)
- ✅ Gemini AI responses working via VPN
- ✅ Zero data loss (Baileys sessions intact)
- ✅ 7 days continuous operation without critical errors

---

## Current State Analysis

### Infrastructure Overview

**Current Production Server**
- **Location**: Timeweb Moscow datacenter
- **IP**: 46.149.70.219
- **SSH Key**: `~/.ssh/id_ed25519_ai_admin`
- **Specs**: 8 vCPU, 16GB RAM, 160GB storage
- **OS**: Ubuntu 22.04 LTS
- **Path**: `/opt/ai-admin`

**Database**
- **Provider**: Timeweb Managed PostgreSQL
- **Location**: St. Petersburg (already there!)
- **Internal IP**: 192.168.0.4:5432
- **Private Network**: "Cute Crossbill"
- **Database**: default_db
- **User**: gen_user
- **Current Access**: Via SSH tunnel (not ideal)

**Critical Services (8 PM2 processes)**

| Service | Purpose | Critical Level |
|---------|---------|----------------|
| ai-admin-api | Express API server (Port 3000) | HIGH |
| ai-admin-worker-v2 | Message processing (Gemini AI) | CRITICAL |
| ai-admin-batch-processor | Batch operations | MEDIUM |
| whatsapp-backup-service | Automated backups (6h) | HIGH |
| whatsapp-safe-monitor | Health monitoring | MEDIUM |
| ai-admin-booking-monitor | Appointment reminders | HIGH |
| ai-admin-telegram-bot | Admin notifications | MEDIUM |
| baileys-whatsapp-service | WhatsApp connection | CRITICAL |

**Critical Data Assets**

1. **Environment Variables** (.env file) - **CRITICAL**
   - All API keys: Gemini, YClients, Telegram
   - Secrets: JWT_SECRET, MASTER_KEY
   - Database credentials (PostgreSQL, Supabase)
   - Redis password
   - Risk: Losing = service cannot start

2. **Xray VPN Configuration** (Required for Gemini API)
   - Config: `/usr/local/etc/xray/config.json`
   - Server: USA (us.cdn.stun.su)
   - Purpose: Bypass Google Gemini geo-blocking
   - Port: SOCKS5 proxy localhost:1080

**Data NOT Requiring Transfer (Already in Cloud):**

3. **Baileys WhatsApp Sessions** - ✅ Already in Supabase
   - Storage: `whatsapp_auth` and `whatsapp_keys` tables in Supabase
   - Status: `USE_DATABASE_AUTH_STATE=true` (migrated 2025-10-07)
   - Data: 335 keys migrated to PostgreSQL
   - Benefit: **No file transfer needed** - new server connects to same database
   - Risk: **VERY LOW** - centralized storage, not tied to specific server

**External Integrations**
- YClients API (salon management)
- Telegram Bot (admin notifications)
- Google Gemini API (AI processing via VPN)
- WhatsApp Business API (via Baileys)

**Current Limitations**
- ❌ PostgreSQL access via SSH tunnel (high latency ~20-50ms)
- ❌ No internal network between app server and database
- ❌ Server and database in different Timeweb datacenters (Moscow ≠ St. Petersburg)
- ❌ Cannot use "Cute Crossbill" private network from Moscow datacenter
- ❌ Potential network instability due to inter-datacenter routing

---

## Proposed Future State

### New Infrastructure Architecture

**New Production Server**
- **Location**: St. Petersburg Timeweb datacenter
- **Specs**: 8 vCPU, 16GB RAM, 160GB NVMe SSD
- **OS**: Ubuntu 22.04 LTS (fresh install)
- **Private Network**: "Cute Crossbill" (same as PostgreSQL)
- **Internal Network IP**: TBD (assigned by Timeweb)

**Database Connection**
- **Access Method**: Direct internal network (NOT SSH tunnel)
- **Expected Latency**: <1ms (vs current ~20-50ms)
- **Connection String**: `postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db`
- **Network Type**: Timeweb private network (low latency, secure)

**Improved Architecture Benefits**

1. **Performance**
   - Database queries: <1ms latency (20-50x faster)
   - Reduced network overhead
   - No SSH tunnel bottleneck

2. **Reliability**
   - Direct internal network (no internet routing)
   - Same datacenter = no geographic dependencies
   - Private network isolation (more secure)

3. **Maintainability**
   - Simpler network configuration
   - No tunnel maintenance required
   - Easier troubleshooting

4. **Cost**
   - No additional VPS for tunnel management
   - Reduced bandwidth costs
   - Better resource utilization

---

## Implementation Phases

**Overview**: Migration in two major stages:
1. **Stage 1 (Phase 0)**: Database Migration from Supabase to Timeweb PostgreSQL - FIRST
2. **Stage 2 (Phases 1-6)**: Server Migration from Moscow to St. Petersburg - SECOND

This approach minimizes risk by testing database migration separately before moving the server.

---

### Phase 0: Database Migration (Supabase → Timeweb PostgreSQL)

**Timeline**: Day -7 to Day 0 (7 days preparation + switchover)
**Total Duration**: ~8-12 hours preparation work + 10-15 min downtime for switchover
**Critical**: This must be completed and tested BEFORE server migration

**Goals:**
- Migrate all data from Supabase to Timeweb PostgreSQL
- **CRITICAL**: Migrate Baileys WhatsApp sessions (whatsapp_auth, whatsapp_keys tables)
- Test database connectivity and application functionality
- Minimize downtime for switchover (<15 minutes)

---

#### 0.1 Prepare Timeweb PostgreSQL (Day -7, ~2 hours)

**Verify Timeweb PostgreSQL Setup:**

```bash
# Connection details (from TIMEWEB_POSTGRES_SUMMARY.md)
Host: 192.168.0.4 (internal) or via SSH tunnel for now
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0
Connection: postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db (via tunnel)
```

**Setup SSH Tunnel from Current Server:**

```bash
# On current Moscow server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Create tunnel to Timeweb PostgreSQL
ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &

# Verify tunnel
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" -c "SELECT NOW();"
# Expected: Returns current timestamp
```

**Checklist:**
- [ ] Timeweb PostgreSQL accessible via tunnel
- [ ] Can execute queries successfully
- [ ] Database `default_db` exists
- [ ] User `gen_user` has full permissions

---

#### 0.2 Migrate Database Schema (Day -7, ~2 hours)

**Export Schema from Supabase:**

```bash
# Get Supabase connection details from .env
SUPABASE_URL="<from .env>"
SUPABASE_KEY="<from .env>"

# Use Supabase CLI or pg_dump equivalent
# Export schema for all tables including Baileys tables
```

**Apply Schema to Timeweb PostgreSQL:**

```bash
# Use existing migration scripts
cd /opt/ai-admin

# Apply schema migration
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" \
  -f migrations/20251007_create_whatsapp_auth_tables.sql

# Apply any other schema migrations
ls migrations/*.sql | while read migration; do
  echo "Applying $migration..."
  psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@localhost:5433/default_db" -f "$migration"
done
```

**Verify Schema:**

```bash
# Check tables exist
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" -c "\dt"

# Expected tables:
# - whatsapp_auth (Baileys credentials)
# - whatsapp_keys (Baileys Signal Protocol keys)
# - [other application tables]

# Verify whatsapp_auth structure
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "\d whatsapp_auth"

# Verify whatsapp_keys structure
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "\d whatsapp_keys"
```

**Checklist:**
- [ ] All tables created successfully
- [ ] whatsapp_auth table exists with correct structure
- [ ] whatsapp_keys table exists with correct structure
- [ ] Indexes created
- [ ] Constraints in place

---

#### 0.3 Migrate Data (Day -6 to -2, ~4-6 hours)

**⚠️ MOST CRITICAL: Baileys Sessions Migration**

This is the most critical part - migrating WhatsApp Baileys sessions from Supabase to Timeweb PostgreSQL.

**Create Migration Script:**

```javascript
// scripts/migrate-supabase-to-timeweb.js
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const timeweb = new Pool({
  host: 'localhost',
  port: 5433, // SSH tunnel
  database: 'default_db',
  user: 'gen_user',
  password: process.env.TIMEWEB_POSTGRES_PASSWORD
});

async function migrateBaileysAuth() {
  console.log('🔄 Migrating Baileys credentials (whatsapp_auth)...');

  // Export from Supabase
  const { data: authData, error } = await supabase
    .from('whatsapp_auth')
    .select('*');

  if (error) throw error;

  console.log(`Found ${authData.length} auth records`);

  // Import to Timeweb
  for (const record of authData) {
    await timeweb.query(
      `INSERT INTO whatsapp_auth (company_id, creds, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id) DO UPDATE
       SET creds = EXCLUDED.creds, updated_at = EXCLUDED.updated_at`,
      [record.company_id, record.creds, record.created_at, record.updated_at]
    );
  }

  console.log('✅ whatsapp_auth migrated');
}

async function migrateBaileysKeys() {
  console.log('🔄 Migrating Baileys keys (whatsapp_keys)...');

  // Export from Supabase
  const { data: keysData, error } = await supabase
    .from('whatsapp_keys')
    .select('*');

  if (error) throw error;

  console.log(`Found ${keysData.length} key records`);

  // Import to Timeweb in batches of 100
  const batchSize = 100;
  for (let i = 0; i < keysData.length; i += batchSize) {
    const batch = keysData.slice(i, i + batchSize);

    for (const record of batch) {
      await timeweb.query(
        `INSERT INTO whatsapp_keys (company_id, key_type, key_id, value, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, key_type, key_id) DO UPDATE
         SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
        [record.company_id, record.key_type, record.key_id, record.value, record.expires_at]
      );
    }

    console.log(`Migrated ${Math.min(i + batchSize, keysData.length)}/${keysData.length} keys`);
  }

  console.log('✅ whatsapp_keys migrated');
}

async function migrateOtherTables() {
  console.log('🔄 Migrating other application tables...');
  // Add migration logic for other tables if needed
  console.log('✅ Other tables migrated');
}

async function main() {
  try {
    await migrateBaileysAuth();
    await migrateBaileysKeys();
    await migrateOtherTables();

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await timeweb.end();
  }
}

main();
```

**Run Migration:**

```bash
cd /opt/ai-admin

# Set environment variables
export TIMEWEB_POSTGRES_PASSWORD='}X|oM595A<7n?0'

# Run migration script
node scripts/migrate-supabase-to-timeweb.js

# Expected output:
# 🔄 Migrating Baileys credentials (whatsapp_auth)...
# Found 1 auth records
# ✅ whatsapp_auth migrated
# 🔄 Migrating Baileys keys (whatsapp_keys)...
# Found 335 key records
# Migrated 100/335 keys
# Migrated 200/335 keys
# Migrated 335/335 keys
# ✅ whatsapp_keys migrated
# 🔄 Migrating other application tables...
# ✅ Other tables migrated
# 🎉 Migration completed successfully!
```

**Checklist:**
- [ ] Migration script created
- [ ] Test run on subset of data successful
- [ ] Full migration completed without errors
- [ ] All Baileys auth records migrated (1 record for company_962302)
- [ ] All Baileys keys migrated (335 keys expected)

---

#### 0.4 Verification (Day -2 to -1, ~2 hours)

**Verify Data Integrity:**

```bash
# Check record counts match
echo "Checking whatsapp_auth..."
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "SELECT COUNT(*) FROM whatsapp_auth;"
# Expected: 1 (company_962302)

echo "Checking whatsapp_keys..."
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "SELECT COUNT(*) FROM whatsapp_keys WHERE company_id = '962302';"
# Expected: 335

# Verify creds structure
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "SELECT company_id, jsonb_typeof(creds) as creds_type FROM whatsapp_auth;"
# Expected: company_id='962302', creds_type='object'

# Verify keys have correct types
psql "postgresql://gen_user:PASSWORD@localhost:5433/default_db" \
  -c "SELECT DISTINCT key_type FROM whatsapp_keys WHERE company_id = '962302';"
# Expected: app-state-sync-key, pre-key, sender-key, session, etc.
```

**Test Application Connectivity (Test Environment):**

Create test configuration to verify Timeweb PostgreSQL works:

```bash
# Create test .env file
cp .env .env.test

# Modify .env.test to use Timeweb PostgreSQL
nano .env.test
# Update:
# USE_DATABASE_AUTH_STATE=true
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5433  # Via tunnel
# POSTGRES_DATABASE=default_db
# POSTGRES_USER=gen_user
# POSTGRES_PASSWORD=}X|oM595A<7n?0

# Test database connection from application
node -e "
require('dotenv').config({ path: '.env.test' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connection successful:', res.rows[0]);
  }
  pool.end();
});
"
```

**Test Baileys Session Loading:**

```bash
# Test loading Baileys sessions from Timeweb PostgreSQL
node -e "
require('dotenv').config({ path: '.env.test' });
const { useSupabaseAuthState } = require('./src/integrations/whatsapp/auth-state-supabase');
// Note: Будет нужно адаптировать для работы с Timeweb PostgreSQL

// Or test direct query
const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'default_db',
  user: 'gen_user',
  password: '}X|oM595A<7n?0'
});

pool.query('SELECT company_id FROM whatsapp_auth WHERE company_id = \$1', ['962302'])
  .then(res => {
    if (res.rows.length > 0) {
      console.log('✅ Baileys auth record found for company_962302');
    } else {
      console.error('❌ Baileys auth record NOT found!');
    }
    pool.end();
  });
"
```

**Checklist:**
- [ ] All record counts match between Supabase and Timeweb
- [ ] Data types correct (JSONB for creds and value)
- [ ] Application can connect to Timeweb PostgreSQL
- [ ] Can query whatsapp_auth and whatsapp_keys tables
- [ ] No data corruption detected

---

#### 0.5 Database Switchover (Day 0, ~10-15 minutes downtime)

**⚠️ MAINTENANCE WINDOW - Notify clients 24 hours in advance**

**Client Notification (Day -1):**
```
📢 Уважаемые клиенты!

Завтра [ДАТА] с [ВРЕМЯ] до [ВРЕМЯ] (10-15 минут)
WhatsApp бот будет недоступен из-за технического обслуживания базы данных.

Это короткое обслуживание для повышения надежности системы.

Приносим извинения за временные неудобства.
```

**Switchover Procedure:**

```bash
# Step 1: Stop all PM2 services (5 minutes before)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
pm2 stop all
pm2 status  # Verify all stopped

# Step 2: Final sync (if any new data since last migration)
# Run migration script one more time to catch any updates
node scripts/migrate-supabase-to-timeweb.js

# Step 3: Update .env to use Timeweb PostgreSQL
cd /opt/ai-admin
nano .env

# Change from Supabase:
# OLD:
# SUPABASE_URL=https://...
# SUPABASE_KEY=...

# NEW (Timeweb PostgreSQL):
USE_LEGACY_SUPABASE=false
POSTGRES_HOST=localhost  # Via tunnel for now (will be 192.168.0.4 after server migration)
POSTGRES_PORT=5433       # Via tunnel (will be 5432 after server migration)
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
USE_DATABASE_AUTH_STATE=true  # Keep using database-backed auth state

# Step 4: Verify .env changes
grep -E "POSTGRES_HOST|POSTGRES_PORT|USE_LEGACY_SUPABASE" .env

# Step 5: Restart all services
pm2 start all

# Step 6: Wait 30 seconds for stabilization
sleep 30

# Step 7: Verify all services online
pm2 status
# Expected: All 8 services "online"

# Step 8: Check for errors
pm2 logs --err --lines 50
# Expected: No critical errors

# Step 9: Verify WhatsApp connection
pm2 logs baileys-whatsapp-service --lines 50 | grep -i connection
# Expected: "connection: open" or "Connected"
```

**Smoke Tests:**

```bash
# Test 1: API Health
curl http://46.149.70.219:3000/health
# Expected: {"status":"ok"}

# Test 2: Database query
curl http://46.149.70.219:3000/api/health/database
# Expected: {"status":"ok"}

# Test 3: Send test message
# From test number 89686484488: "Тест после миграции БД"
# Expected: Bot responds within 15 seconds

# Test 4: Verify Baileys loaded from Timeweb
pm2 logs baileys-whatsapp-service --lines 100 | grep -i "database\|loaded\|auth"
# Should see logs indicating database connection
```

**⚠️ CRITICAL GO/NO-GO CHECKPOINT:**

**GO Criteria:**
- [ ] All services online
- [ ] WhatsApp connected
- [ ] Database queries successful
- [ ] Test message processed
- [ ] No critical errors

**NO-GO → Rollback to Supabase:**
```bash
# Immediate rollback if issues
pm2 stop all

# Revert .env to Supabase
nano .env
# Change back to:
# SUPABASE_URL=https://...
# SUPABASE_KEY=...
# Comment out POSTGRES_* variables

pm2 start all

# Verify rollback successful
curl http://46.149.70.219:3000/health
```

**Checklist:**
- [ ] Services stopped cleanly
- [ ] Final data sync completed
- [ ] .env updated to Timeweb PostgreSQL
- [ ] Services restarted successfully
- [ ] All smoke tests passed
- [ ] WhatsApp connected
- [ ] Total downtime: _____ minutes (target: <15 min)

---

#### 0.6 Post-Switchover Testing (Day 0-7, continuous)

**Immediate Testing (Day 0, first 2 hours):**

```bash
# Monitor logs continuously
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
pm2 logs --timestamp

# Every 15 minutes for first 2 hours:
pm2 status           # All should stay online
pm2 logs --err       # Check for new errors
# Send test message  # Verify bot responds
```

**Daily Testing (Day 0-7):**

**Day 0 Evening:**
- [ ] All services still online
- [ ] WhatsApp still connected
- [ ] Test messages processed successfully (10+ messages)
- [ ] No database connection errors
- [ ] No Baileys session issues

**Day 1:**
- [ ] 24-hour uptime check
- [ ] Review all error logs
- [ ] Database performance check (query times)
- [ ] WhatsApp session stable
- [ ] Client messages processed normally

**Day 2-6:**
- [ ] Daily health check
- [ ] Monitor for any Baileys issues
- [ ] Check database performance
- [ ] Review Telegram alerts
- [ ] Ensure no degradation

**Day 7 - Ready for Server Migration:**
- [ ] 7 days stable operation on Timeweb PostgreSQL
- [ ] Zero critical incidents
- [ ] WhatsApp stable
- [ ] Database performance good (even through tunnel)
- [ ] Ready to proceed with server migration (Phase 1-6)

**Metrics to Track:**

| Metric | Target | Day 0 | Day 1 | Day 3 | Day 7 |
|--------|--------|-------|-------|-------|-------|
| Uptime % | >99% | ___% | ___% | ___% | ___% |
| WhatsApp Status | Connected | ___ | ___ | ___ | ___ |
| DB Query Time | <50ms | ___ms | ___ms | ___ms | ___ms |
| Message Success Rate | >98% | ___% | ___% | ___% | ___% |
| Critical Errors | 0 | ___ | ___ | ___ | ___ |

**Success Criteria for Phase 0:**
- ✅ All data migrated successfully (including 335 Baileys keys)
- ✅ Application running on Timeweb PostgreSQL
- ✅ WhatsApp connected and stable for 7 days
- ✅ No critical errors
- ✅ Performance acceptable (even via tunnel from Moscow)
- ✅ Ready to proceed with server migration

**Acceptance Criteria Phase 0:**
- ✅ Database migration completed with zero data loss
- ✅ Baileys sessions (whatsapp_auth, whatsapp_keys) fully functional
- ✅ Switchover downtime <15 minutes
- ✅ 7 days stable operation
- ✅ Total preparation time: ~8-12 hours over 7 days
- ✅ **READY FOR PHASE 1 (Server Migration)**

---

### Phase 1: Server Migration Preparation (Day 7) ⏱️ ~2 hours

**Note**: After Phase 0 success, we now migrate the server to benefit from internal network to Timeweb PostgreSQL.

**Goals:**
- Complete backup of all critical configuration (Baileys already in Timeweb PostgreSQL!)
- Document current configuration
- Create new VPS with correct network setup

**Key Activities:**

#### 1.1 Create Comprehensive Backups

```bash
# Create backup directory with timestamp
mkdir -p ./migration-backups/$(date +%Y%m%d)
cd ./migration-backups/$(date +%Y%m%d)

# Backup configuration files (CRITICAL!)
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/opt/ai-admin/.env ./

scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/opt/ai-admin/ecosystem.config.js ./

# Backup Xray VPN config
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/usr/local/etc/xray/config.json ./xray-config.json

# Backup recent logs (for debugging - optional)
scp -i ~/.ssh/id_ed25519_ai_admin -r \
  root@46.149.70.219:/opt/ai-admin/logs ./logs-backup

# Verify .env file integrity
cat .env | grep -E "POSTGRES_HOST|REDIS_PASSWORD|GEMINI_API_KEY|SUPABASE_URL" && \
  echo "✅ .env contains critical variables" || \
  echo "❌ ERROR: .env missing critical variables!"
```

**Note about Baileys Sessions:**
✅ **No backup needed** - Baileys sessions already stored in Supabase PostgreSQL.
- Database tables: `whatsapp_auth`, `whatsapp_keys`
- New server will connect to same database
- No file transfer required

**Verification Checklist:**
- [ ] .env file backed up and readable
- [ ] Critical env variables present
- [ ] ecosystem.config.js backed up
- [ ] Xray config backed up
- [ ] Logs backed up (optional)
- [ ] Total backup size: ~10-50MB (much smaller without Baileys files!)

#### 1.2 Document Current Configuration

```bash
# Save current PM2 state
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 status" > pm2-status.txt

# Save environment variables for each process
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 env 0" > pm2-env-api.txt

# Save network configuration
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "netstat -tulpn | grep -E ':(3000|6379|1080)'" > ports.txt

# Save current package versions
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && npm list --depth=0" > npm-packages.txt

# Save system info
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "uname -a && node -v && npm -v && pm2 -v" > system-info.txt
```

**Documentation Checklist:**
- [ ] PM2 process list documented
- [ ] Environment variables documented
- [ ] Open ports documented
- [ ] Package versions documented
- [ ] System versions documented

#### 1.3 Create New VPS in Timeweb

**Via Timeweb Control Panel:**

1. **Navigate to**: VPS → Create New Server
2. **Configuration**:
   - Region: **St. Petersburg**
   - OS: **Ubuntu 22.04 LTS**
   - Plan: **8 vCPU, 16GB RAM, 160GB NVMe SSD**
   - Hostname: `ai-admin-v2-spb` (or similar)
3. **⚠️ CRITICAL**: Under "Network Settings":
   - ✅ Enable Private Network
   - ✅ Select network: **"Cute Crossbill"**
   - ⚠️ DO NOT SKIP THIS STEP!
4. **SSH Access**: Add your public key
5. **Create** and wait for provisioning (~5 minutes)

**Post-Creation Verification:**
- [ ] VPS created and accessible
- [ ] SSH key works
- [ ] Private network "Cute Crossbill" attached
- [ ] New VPS IP address noted: `____________`

**Acceptance Criteria Phase 1:**
- ✅ All critical data backed up (3 locations: local, old server, external)
- ✅ Current configuration fully documented
- ✅ New VPS created with private network attached
- ✅ SSH access to new VPS working
- ✅ ~2 hours total time

---

### Phase 2: New Server Setup (Day 1-2) ⏱️ ~3-4 hours

**Goals:**
- Verify internal network connectivity to PostgreSQL
- Install all required software
- Configure VPN for Gemini API access

**Key Activities:**

#### 2.1 Verify Internal Network Connectivity (FIRST PRIORITY!)

```bash
# SSH to new VPS
ssh root@<NEW_VPS_IP>

# Check private network interface
ip addr show
# Look for interface with 192.168.0.x address

# Example expected output:
# eth1: <BROADCAST,MULTICAST,UP,LOWER_UP>
#     inet 192.168.0.X/24 brd 192.168.0.255 scope global eth1

# Test PostgreSQL host reachability
ping -c 4 192.168.0.4
# Expected: 0% packet loss, <1ms latency

# Test PostgreSQL port
telnet 192.168.0.4 5432
# Expected: Connected to 192.168.0.4

# Install PostgreSQL client
apt update
apt install -y postgresql-client

# Test database connection
psql "postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db" \
  -c "SELECT NOW() as current_time, version();"
# Expected: Returns current timestamp and PostgreSQL version
```

**⚠️ CRITICAL CHECKPOINT:**

If PostgreSQL connection fails:
1. STOP immediately
2. Check Timeweb panel: Is "Cute Crossbill" network attached?
3. Check PostgreSQL firewall rules in Timeweb panel
4. Contact Timeweb support if needed
5. DO NOT PROCEED until database is accessible

**Network Verification Checklist:**
- [ ] Private network interface exists (eth1 or similar)
- [ ] Private IP assigned (192.168.0.x)
- [ ] Ping to 192.168.0.4 successful (<1ms)
- [ ] Telnet to port 5432 successful
- [ ] psql connection successful
- [ ] Database query returns results

#### 2.2 Install Base Software Stack

```bash
# Update system packages
apt update && apt upgrade -y

# Install build essentials
apt install -y build-essential curl wget git htop nano jq

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify Node.js installation
node --version  # Expected: v20.x.x
npm --version   # Expected: v10.x.x

# Install PM2 globally
npm install -g pm2

# Verify PM2 installation
pm2 --version  # Expected: v5.x.x

# Install Redis server (local cache)
apt install -y redis-server

# Start Redis and enable on boot
systemctl enable redis-server
systemctl start redis-server

# Verify Redis running
redis-cli ping  # Expected: PONG

# Set Redis password
REDIS_PASSWORD="<generate_secure_password>"
redis-cli CONFIG SET requirepass "$REDIS_PASSWORD"
redis-cli CONFIG REWRITE

# Test Redis authentication
redis-cli -a "$REDIS_PASSWORD" ping  # Expected: PONG

# Install additional utilities
apt install -y htop iotop net-tools dnsutils
```

**Base Software Checklist:**
- [ ] Node.js 20.x installed and verified
- [ ] npm working correctly
- [ ] PM2 installed globally
- [ ] Redis server running
- [ ] Redis password set and tested
- [ ] All utilities installed

#### 2.3 Install and Configure Xray VPN

**Purpose**: Required for Google Gemini API access (geo-blocking bypass)

```bash
# Install Xray using official script
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# Verify installation
xray version  # Expected: Xray x.x.x

# Copy configuration from backup
# (On local machine)
scp ./migration-backups/<date>/xray-config.json \
  root@<NEW_VPS_IP>:/usr/local/etc/xray/config.json

# Back on VPS: Verify config syntax
xray run -test -config /usr/local/etc/xray/config.json
# Expected: Configuration OK

# Enable Xray service
systemctl enable xray

# Start Xray service
systemctl start xray

# Check Xray status
systemctl status xray
# Expected: active (running)

# Test VPN connection
curl -x socks5://127.0.0.1:1080 https://ipinfo.io/json
# Expected output should show:
# {
#   "ip": "<USA_IP_ADDRESS>",
#   "city": "<USA_CITY>",
#   "region": "<USA_STATE>",
#   "country": "US",
#   ...
# }

# Test Gemini API accessibility through VPN
curl -x socks5://127.0.0.1:1080 \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=<GEMINI_API_KEY>"
# Expected: JSON response with generated content
```

**⚠️ CRITICAL CHECKPOINT:**

If VPN test shows non-USA IP or Gemini API fails:
1. Check Xray logs: `journalctl -u xray -n 50`
2. Verify config.json matches backup exactly
3. Test SOCKS5 proxy: `curl -v -x socks5://127.0.0.1:1080 https://google.com`
4. DO NOT PROCEED until VPN shows USA location

**VPN Configuration Checklist:**
- [ ] Xray installed successfully
- [ ] Config copied from backup
- [ ] Config syntax validated
- [ ] Xray service running (no errors)
- [ ] SOCKS5 proxy responding on localhost:1080
- [ ] VPN shows USA IP address
- [ ] Gemini API accessible through proxy

**Acceptance Criteria Phase 2:**
- ✅ PostgreSQL accessible via internal network (<1ms latency)
- ✅ Node.js 20.x + PM2 installed
- ✅ Redis server running with authentication
- ✅ Xray VPN working (USA location confirmed)
- ✅ Gemini API accessible through VPN
- ✅ ~3-4 hours total time

---

### Phase 3: Application Deployment (Day 2) ⏱️ ~2-3 hours

**Goals:**
- Deploy AI Admin v2 codebase
- Transfer critical Baileys sessions
- Configure environment for new infrastructure

**Key Activities:**

#### 3.1 Clone Repository

```bash
# Navigate to /opt directory
cd /opt

# Clone repository
git clone https://github.com/vosarsen/ai_admin_v2.git ai-admin

# Navigate to project
cd ai-admin

# Checkout main branch (production)
git checkout main

# Pull latest changes
git pull origin main

# Verify repository state
git status
git log -1 --oneline

# Check project structure
ls -la
```

**Repository Checklist:**
- [ ] Repository cloned to /opt/ai-admin
- [ ] On main branch
- [ ] Latest commit matches GitHub
- [ ] All directories present (src/, scripts/, etc.)

#### 3.2 Verify Baileys Sessions Access

**✅ NO FILE TRANSFER NEEDED!**

Baileys sessions are already stored in **Supabase PostgreSQL** (migrated 2025-10-07).

```bash
# On NEW server - verify Supabase access
ssh root@<NEW_VPS_IP>

# Check .env contains Supabase credentials
cd /opt/ai-admin
grep -E "SUPABASE_URL|SUPABASE_KEY|USE_DATABASE_AUTH_STATE" .env

# Expected output:
# SUPABASE_URL=https://...
# SUPABASE_KEY=eyJ...
# USE_DATABASE_AUTH_STATE=true

# Quick test: query Baileys data from Supabase
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
supabase.from('whatsapp_auth').select('company_id').then(r => console.log('✅ Baileys data accessible:', r.data));
"
```

**What happens automatically:**
- New server connects to same Supabase database
- WhatsApp service loads sessions from `whatsapp_auth` and `whatsapp_keys` tables
- No files to transfer, no data loss risk
- Instant switchover

**Verification Checklist:**
- [ ] Supabase credentials present in .env
- [ ] `USE_DATABASE_AUTH_STATE=true` confirmed
- [ ] Can query `whatsapp_auth` table successfully
- [ ] No file system dependencies

**Checkpoint**: Baileys sessions accessible from new server via Supabase

#### 3.3 Configure Environment Variables

```bash
# On NEW server
cd /opt/ai-admin

# Copy .env from backup (on local machine)
scp ./migration-backups/<date>/.env root@<NEW_VPS_IP>:/opt/ai-admin/.env

# On NEW server: Edit .env to update for new infrastructure
nano .env
```

**Critical .env Changes:**

```bash
# ============================================
# DATABASE - UPDATED FOR INTERNAL NETWORK
# ============================================
POSTGRES_HOST=192.168.0.4          # Internal network (was localhost via tunnel)
POSTGRES_PORT=5432
POSTGRES_DATABASE=default_db
POSTGRES_USER=gen_user
POSTGRES_PASSWORD=}X|oM595A<7n?0
USE_LEGACY_SUPABASE=false          # Use Timeweb PostgreSQL

# ============================================
# REDIS - LOCAL INSTANCE
# ============================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<NEW_REDIS_PASSWORD>  # UPDATE with password from Phase 2.2

# ============================================
# XRAY VPN - LOCAL PROXY
# ============================================
SOCKS_PROXY=socks5://127.0.0.1:1080

# ============================================
# API ENDPOINTS - UPDATED TO NEW VPS IP
# ============================================
AI_ADMIN_API_URL=http://<NEW_VPS_IP>:3000              # UPDATE IP!
WEBHOOK_URL=http://<NEW_VPS_IP>:3000/webhook/whatsapp/batched  # UPDATE IP!

# ============================================
# AI PROVIDER - NO CHANGES
# ============================================
AI_PROVIDER=gemini-flash
GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU
USE_TWO_STAGE=true
AI_PROMPT_VERSION=two-stage

# ============================================
# YCLIENTS - NO CHANGES
# ============================================
YCLIENTS_BEARER_TOKEN=<same as old server>
YCLIENTS_USER_TOKEN=<same as old server>
YCLIENTS_COMPANY_ID=962302

# ============================================
# WHATSAPP - NO CHANGES
# ============================================
WHATSAPP_PHONE=79936363848
BAILEYS_STANDALONE=true

# ============================================
# TELEGRAM - NO CHANGES
# ============================================
TELEGRAM_BOT_TOKEN=<same as old server>
TELEGRAM_CHAT_ID=<same as old server>

# ============================================
# SECURITY - NO CHANGES
# ============================================
JWT_SECRET=<same as old server>
MASTER_KEY=<same as old server>
NODE_ENV=production
```

**Verification Script:**

```bash
# Create .env validation script
cat > /opt/ai-admin/scripts/validate-env.sh << 'EOF'
#!/bin/bash
source .env

echo "🔍 Validating .env configuration..."

# Check critical variables
[ -n "$POSTGRES_HOST" ] && echo "✅ POSTGRES_HOST set" || echo "❌ POSTGRES_HOST missing"
[ -n "$REDIS_PASSWORD" ] && echo "✅ REDIS_PASSWORD set" || echo "❌ REDIS_PASSWORD missing"
[ -n "$GEMINI_API_KEY" ] && echo "✅ GEMINI_API_KEY set" || echo "❌ GEMINI_API_KEY missing"
[ -n "$BAILEYS_STANDALONE" ] && echo "✅ BAILEYS_STANDALONE set" || echo "❌ BAILEYS_STANDALONE missing"

# Test database connection
echo "🔍 Testing PostgreSQL connection..."
psql "postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DATABASE" \
  -c "SELECT 1;" > /dev/null 2>&1 && \
  echo "✅ PostgreSQL connection OK" || echo "❌ PostgreSQL connection FAILED"

# Test Redis connection
echo "🔍 Testing Redis connection..."
redis-cli -a "$REDIS_PASSWORD" ping > /dev/null 2>&1 && \
  echo "✅ Redis connection OK" || echo "❌ Redis connection FAILED"

echo "✅ Validation complete"
EOF

chmod +x /opt/ai-admin/scripts/validate-env.sh
./scripts/validate-env.sh
```

**Environment Configuration Checklist:**
- [ ] .env file copied from backup
- [ ] POSTGRES_HOST updated to 192.168.0.4
- [ ] REDIS_PASSWORD updated
- [ ] API URLs updated to new VPS IP
- [ ] All other variables preserved from backup
- [ ] Validation script passes all checks

#### 3.4 Install Dependencies

```bash
cd /opt/ai-admin

# Install production dependencies only
npm install --production

# Verify critical packages installed
npm ls | grep -E "(express|bullmq|ioredis|baileys|@google)"
# Expected: All packages shown as installed

# Check for vulnerabilities (informational only)
npm audit

# If high/critical vulnerabilities, run (optional):
# npm audit fix --production

# Verify package.json scripts
npm run | grep -E "(start|dev)"
```

**Dependencies Checklist:**
- [ ] npm install completed without errors
- [ ] node_modules directory created
- [ ] Critical packages verified installed
- [ ] No blocking errors in npm audit
- [ ] ~2GB node_modules size

**Acceptance Criteria Phase 3:**
- ✅ Repository cloned and on main branch
- ✅ Baileys sessions accessible via Supabase (verified connectivity)
- ✅ .env configured for new infrastructure
- ✅ Database (Timeweb PostgreSQL + Supabase) connections validated
- ✅ Dependencies installed successfully
- ✅ ~1-2 hours total time (faster without file transfers!)

---

### Phase 4: Testing and Validation (Day 2-3) ⏱️ ~6 hours + 48h parallel

**Goals:**
- Start all PM2 services
- Validate core functionality
- Perform comprehensive testing
- Run in parallel with old server for 48 hours

**Key Activities:**

#### 4.1 Start PM2 Services

```bash
cd /opt/ai-admin

# Verify ecosystem.config.js
cat ecosystem.config.js

# Start all services using PM2
pm2 start ecosystem.config.js

# Check status immediately
pm2 status
# Expected: All 8 services should be "online"

# If any service fails, check logs
pm2 logs --err --lines 50

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Execute the command that PM2 outputs

# Monitor logs in real-time
pm2 logs --timestamp
```

**Expected PM2 Output:**

```
┌────┬───────────────────────────────┬─────────┬─────────┬──────────┬────────┐
│ id │ name                          │ mode    │ status  │ restart  │ uptime │
├────┼───────────────────────────────┼─────────┼─────────┼──────────┼────────┤
│ 0  │ ai-admin-api                  │ fork    │ online  │ 0        │ 2m     │
│ 1  │ ai-admin-worker-v2            │ fork    │ online  │ 0        │ 2m     │
│ 2  │ ai-admin-batch-processor      │ fork    │ online  │ 0        │ 2m     │
│ 3  │ whatsapp-backup-service       │ fork    │ online  │ 0        │ 2m     │
│ 4  │ whatsapp-safe-monitor         │ fork    │ online  │ 0        │ 2m     │
│ 5  │ ai-admin-booking-monitor      │ fork    │ online  │ 0        │ 2m     │
│ 6  │ ai-admin-telegram-bot         │ fork    │ online  │ 0        │ 2m     │
│ 7  │ baileys-whatsapp-service      │ fork    │ online  │ 0        │ 2m     │
└────┴───────────────────────────────┴─────────┴─────────┴──────────┴────────┘
```

**PM2 Services Checklist:**
- [ ] All 8 services show "online" status
- [ ] No services in "errored" or "stopped" state
- [ ] Restart count is 0 for all services
- [ ] pm2 save successful
- [ ] pm2 startup configured

#### 4.2 Validate Core Services

**API Server Health Check:**

```bash
# Test health endpoint
curl http://<NEW_VPS_IP>:3000/health
# Expected: {"status":"ok","timestamp":"2025-11-05T..."}

# Test with verbose output
curl -v http://<NEW_VPS_IP>:3000/health
# Expected: HTTP/1.1 200 OK

# Check API logs
pm2 logs ai-admin-api --lines 50
# Look for: "API server listening on port 3000"
```

**Database Connectivity:**

```bash
# Check API database connection
pm2 logs ai-admin-api --lines 100 | grep -i postgres
# Expected: No connection errors

# Test database query through API
curl http://<NEW_VPS_IP>:3000/api/health/database
# Expected: {"status":"ok","latency":"<1ms"}

# Check for any PostgreSQL errors
pm2 logs --err --lines 100 | grep -i postgres
# Expected: No errors
```

**Redis Connectivity:**

```bash
# Check Redis connection in logs
pm2 logs --lines 100 | grep -i redis
# Expected: "Redis connected" or similar

# Test Redis through API
curl http://<NEW_VPS_IP>:3000/api/health/redis
# Expected: {"status":"ok","latency":"<1ms"}
```

**Gemini AI via VPN:**

```bash
# Check worker logs for Gemini
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i gemini
# Expected: No connection errors

# Check VPN proxy usage
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i socks5
# Expected: Messages showing proxy usage

# Send test message to trigger AI processing
# (Will be done in functional testing)
```

**WhatsApp Connection:**

```bash
# Check Baileys service logs
pm2 logs baileys-whatsapp-service --lines 100

# Look for connection status
pm2 logs baileys-whatsapp-service --lines 100 | grep -i "connection\|status\|qr"
# Expected: "connection: open" or "Connected"

# Should NOT see:
# - QR code generation (means session lost)
# - "Connection closed"
# - Authentication errors
```

**⚠️ CRITICAL CHECKPOINT:**

If WhatsApp shows QR code or authentication errors:
1. STOP all services immediately: `pm2 stop baileys-whatsapp-service`
2. Verify Baileys sessions were transferred correctly
3. Check creds.json integrity
4. Restore from backup if needed
5. DO NOT PROCEED until WhatsApp connects successfully

**Core Services Checklist:**
- [ ] API health endpoint returns 200 OK
- [ ] PostgreSQL connected (<1ms latency confirmed)
- [ ] Redis connected and responding
- [ ] Gemini AI accessible via VPN proxy
- [ ] WhatsApp connection status: "open" or "Connected"
- [ ] No critical errors in any logs

#### 4.3 Functional Testing

**Test 1: Simple Message Processing**

```bash
# Send test message from test number
# Test Number: 89686484488
# Message: "Привет"

# Expected behavior:
# 1. Message received by Baileys
# 2. Queued in Redis (BullMQ)
# 3. Processed by AI worker
# 4. Response sent back to WhatsApp

# Monitor logs during test
pm2 logs --timestamp

# Check for message flow:
pm2 logs baileys-whatsapp-service | grep -A 5 "Received message"
pm2 logs ai-admin-worker-v2 | grep -A 10 "Processing message"
pm2 logs baileys-whatsapp-service | grep "Sent message"

# Verify response received on WhatsApp
# Expected: Bot replies with greeting
```

**Test 2: Database Query (Schedules)**

```bash
# Message: "Какие есть свободные слоты на завтра?"

# Expected behavior:
# 1. AI worker queries PostgreSQL for schedules
# 2. Response includes available time slots
# 3. Latency should be <1ms for DB query

# Check database queries in logs
pm2 logs --timestamp | grep -A 5 "SELECT.*schedules"

# Verify response time
# Should see log like: "Query executed in 0.8ms"
```

**Test 3: Context Persistence (Redis)**

```bash
# Message 1: "Хочу записаться на маникюр"
# Message 2: "На завтра"

# Expected behavior:
# 1. First message saves context in Redis
# 2. Second message retrieves context
# 3. Bot remembers "маникюр" and asks about time

# Check Redis context storage
ssh root@<NEW_VPS_IP>
redis-cli -a "$REDIS_PASSWORD"
KEYS context:*
GET context:79686484488  # Test number
# Should show conversation context JSON

# Check logs for context retrieval
pm2 logs ai-admin-worker-v2 | grep "Retrieved context"
```

**Test 4: AI Processing (Gemini via VPN)**

```bash
# Message: "Расскажи подробнее об услуге маникюр"

# Expected behavior:
# 1. Worker sends request through SOCKS5 proxy
# 2. Gemini API returns detailed response
# 3. Response contains service description

# Check VPN usage
pm2 logs ai-admin-worker-v2 | grep -E "proxy|socks5"

# Check Gemini API calls
pm2 logs ai-admin-worker-v2 | grep -A 10 "Gemini API request"

# Verify response quality
# Should be detailed, contextual response
```

**Test 5: Booking Creation**

```bash
# Message: "Записать меня на маникюр завтра в 14:00"

# Expected behavior:
# 1. AI extracts booking details
# 2. Creates record in PostgreSQL bookings table
# 3. Sends confirmation to client
# 4. Updates schedule availability

# Check booking creation logs
pm2 logs ai-admin-worker-v2 | grep -A 10 "Creating booking"

# Verify in database
ssh root@<NEW_VPS_IP>
psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" \
  -c "SELECT * FROM bookings ORDER BY created_at DESC LIMIT 1;"

# Should see newly created booking
```

**Test 6: Telegram Notifications**

```bash
# Trigger an event that sends Telegram notification
# (e.g., new booking, error, system alert)

# Check Telegram bot logs
pm2 logs ai-admin-telegram-bot --lines 50

# Expected: "Telegram message sent successfully"
# Verify notification received in Telegram admin chat
```

**Test 7: Automated Services**

```bash
# Test booking monitor (runs every N minutes)
pm2 logs ai-admin-booking-monitor --lines 100

# Expected: Reminder checks running on schedule
# No errors processing reminders

# Test WhatsApp backup service (runs every 6 hours)
pm2 logs whatsapp-backup-service --lines 50

# Expected: Backup creation logs
# Verify backup file created
ls -lh /opt/ai-admin/baileys_sessions/backups/
```

**Functional Testing Checklist:**
- [ ] Test 1: Simple message ✅ Bot responds
- [ ] Test 2: Database query ✅ Schedules retrieved (<1ms)
- [ ] Test 3: Context ✅ Redis saves/retrieves
- [ ] Test 4: AI processing ✅ Gemini via VPN works
- [ ] Test 5: Booking creation ✅ Record in database
- [ ] Test 6: Telegram ✅ Notification sent
- [ ] Test 7: Automated services ✅ Running on schedule

#### 4.4 Performance Validation

**Database Latency Test:**

```bash
# Run 100 sequential queries and measure latency
for i in {1..100}; do
  time psql "postgresql://gen_user:PASSWORD@192.168.0.4:5432/default_db" \
    -c "SELECT NOW();" > /dev/null 2>&1
done

# Expected average: <10ms (mostly connection overhead)
# Direct query latency should be <1ms

# Test from application
curl http://<NEW_VPS_IP>:3000/api/performance/database-latency
# Expected: {"avgLatency":"<1ms","samples":100}
```

**Redis Latency Test:**

```bash
# Use redis-cli latency test
redis-cli -a "$REDIS_PASSWORD" --latency
# Expected: avg <1ms, max <5ms

# Test from application
curl http://<NEW_VPS_IP>:3000/api/performance/redis-latency
# Expected: {"avgLatency":"<1ms","samples":100}
```

**AI Response Time:**

```bash
# Send 10 test messages and measure end-to-end time
# From message received to response sent

# Check logs for timing
pm2 logs ai-admin-worker-v2 | grep "Processing time"
# Expected: 9-15 seconds total (Gemini two-stage)
# - Stage 1 (extraction): ~5 seconds
# - Execution: ~0.01 seconds
# - Stage 2 (response): ~4 seconds
```

**Performance Validation Checklist:**
- [ ] PostgreSQL latency <1ms (vs old ~20-50ms)
- [ ] Redis latency <1ms
- [ ] AI response time ~9-15 seconds (acceptable)
- [ ] No performance degradation under load
- [ ] 20-50x improvement in database queries ✅

#### 4.5 Parallel Run (48 Hours)

**Configuration:**

```bash
# OLD server (46.149.70.219): Continues serving production traffic
# NEW server (<NEW_VPS_IP>): Serves only test number 89686484488

# On OLD server: No changes needed, continues normal operation

# On NEW server: Configure to only respond to test number
# (If needed, add filter in application logic)
```

**Monitoring Schedule:**

| Time | Check | Action |
|------|-------|--------|
| Every 2 hours | `pm2 status` on new server | Verify all services online |
| Every 4 hours | Review error logs | Investigate any errors |
| Every 8 hours | Send test messages | Validate full flow |
| Every 12 hours | Check resource usage | CPU, memory, disk |
| Every 24 hours | Check Baileys file count | Should stay ~162-200 files |

**Monitoring Commands:**

```bash
# Service status
ssh root@<NEW_VPS_IP> "pm2 status"

# Error logs
ssh root@<NEW_VPS_IP> "pm2 logs --err --lines 100"

# Resource usage
ssh root@<NEW_VPS_IP> "pm2 monit"

# Baileys file count
ssh root@<NEW_VPS_IP> "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l"

# Check for restart loops
ssh root@<NEW_VPS_IP> "pm2 status | grep -v ' 0 '"
# Should not show any services with >0 restarts

# Database connection
ssh root@<NEW_VPS_IP> "pm2 logs ai-admin-api --lines 50 | grep -i postgres"
# Should show no errors

# WhatsApp connection
ssh root@<NEW_VPS_IP> "pm2 logs baileys-whatsapp-service --lines 50 | grep -i connection"
# Should show "connection: open"
```

**Issues to Watch For:**

| Issue | Symptom | Action |
|-------|---------|--------|
| Service crashes | Restart count >0 | Investigate logs, may need rollback |
| Memory leak | Memory usage increasing | Monitor, may need service restart |
| Database disconnect | PostgreSQL errors | Check network, verify "Cute Crossbill" |
| WhatsApp disconnect | Connection closed | Check Baileys files, verify creds.json |
| VPN failure | Gemini API errors | Check Xray status, test SOCKS5 proxy |

**Success Criteria for Parallel Run:**
- [ ] All services online for 48 consecutive hours
- [ ] Zero critical errors
- [ ] Test messages processed successfully (>95% success rate)
- [ ] No service restarts due to crashes
- [ ] Resource usage stable (no memory leaks)
- [ ] Baileys file count stable (162-200 range)
- [ ] Database latency consistently <1ms
- [ ] AI responses consistently 9-15 seconds

**⚠️ GO/NO-GO Decision Point:**

After 48 hours, evaluate:
- ✅ GO: All success criteria met → Proceed to Phase 5 (Migration)
- ❌ NO-GO: Any critical issues → Investigate and fix before proceeding

**Acceptance Criteria Phase 4:**
- ✅ All PM2 services running stable
- ✅ All functional tests passed
- ✅ Performance validation shows 20-50x improvement
- ✅ 48 hours parallel run successful
- ✅ Go/No-Go decision: GO
- ✅ ~6 hours testing + 48 hours monitoring

---

### Phase 5: Production Migration (Day 4) ⏱️ Downtime: 2-4 hours

**Goals:**
- Migrate production traffic to new server
- Minimize downtime to 2-4 hours
- Ensure zero data loss

**Key Activities:**

#### 5.1 Pre-Migration Preparation (Day 3)

**Client Notification:**

```bash
# Compose notification message
MESSAGE="🔧 Уважаемые клиенты!

$(date -d '+1 day' '+%d.%m.%Y') с 02:00 до 06:00 (2-4 часа)
WhatsApp бот будет недоступен из-за технического обслуживания.

Проводится улучшение инфраструктуры для повышения скорости и надежности сервиса.

Приносим извинения за временные неудобства.
После обслуживания бот будет работать еще быстрее!

С уважением,
Команда AI Admin"

# Send via Telegram to admin group
# Or post in status channel if available
```

**Final Backup:**

```bash
# On OLD server, create final backup
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Stop services to ensure clean backup
pm2 stop all

# Create final comprehensive backup
tar -czf /root/final-backup-$(date +%Y%m%d-%H%M).tar.gz \
  /opt/ai-admin/baileys_sessions \
  /opt/ai-admin/.env \
  /opt/ai-admin/logs

# Restart services immediately
pm2 start all

# Download final backup to local machine
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/root/final-backup-*.tar.gz \
  ./migration-backups/final-backup/
```

**Pre-Migration Checklist:**
- [ ] Client notification sent 24 hours in advance
- [ ] Final backup created and downloaded
- [ ] New server validated and ready
- [ ] Rollback plan documented and tested
- [ ] Team on standby during maintenance window

#### 5.2 Migration Window: 02:00 - 06:00 (4 hours)

**Timeline:**

| Time | Duration | Activity | Status |
|------|----------|----------|--------|
| 02:00 | 5 min | Stop old server | Downtime starts |
| 02:05 | 10 min | Final data sync | Downtime |
| 02:15 | 5 min | Restart new server | Downtime |
| 02:20 | 10 min | Smoke tests | Downtime |
| 02:30 | 30 min | Intensive monitoring | Service restored |
| 03:00 | 180 min | Extended monitoring | Fully operational |
| 06:00 | - | Migration complete | Success |

**02:00 - Stop Old Server (5 minutes)**

```bash
# SSH to old server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Check current PM2 status
pm2 status
pm2 logs --lines 50

# Stop all PM2 processes
pm2 stop all

# Verify all stopped
pm2 status
# Expected: All services should show "stopped"

# Record exact stop time
date +"%Y-%m-%d %H:%M:%S" > /root/migration-stop-time.txt

echo "✅ Old server stopped at $(cat /root/migration-stop-time.txt)"
```

**02:05 - Verification Check (2 minutes)**

```bash
# Verify Baileys sessions accessible from Supabase
ssh root@<NEW_VPS_IP>

cd /opt/ai-admin

# Quick verification that Supabase connection works
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
supabase.from('whatsapp_auth')
  .select('company_id')
  .eq('company_id', '962302')
  .then(r => {
    if (r.data && r.data.length > 0) {
      console.log('✅ Baileys sessions accessible from new server');
    } else {
      console.error('❌ ERROR: Cannot access Baileys sessions!');
      process.exit(1);
    }
  });
"

# No file sync needed - Baileys data already in Supabase
echo "✅ Verification complete - ready to restart services"
```

**Note:** No Baileys file transfer needed - sessions stored in centralized Supabase database.

**02:15 - Restart New Server (5 minutes)**

```bash
# SSH to new server
ssh root@<NEW_VPS_IP>

cd /opt/ai-admin

# Restart all services
pm2 restart all

# Wait 30 seconds for stabilization
sleep 30

# Check status
pm2 status
# Expected: All 8 services "online", restart count 1

# Check for immediate errors
pm2 logs --err --lines 50
# Expected: No critical errors

# Verify WhatsApp connection
pm2 logs baileys-whatsapp-service --lines 50 | grep -i connection
# Expected: "connection: open" or "Connected"

echo "✅ New server restarted"
```

**02:20 - Smoke Tests (10 minutes)**

```bash
# Test 1: API Health
curl http://<NEW_VPS_IP>:3000/health
# Expected: {"status":"ok"}

# Test 2: Database connection
curl http://<NEW_VPS_IP>:3000/api/health/database
# Expected: {"status":"ok","latency":"<1ms"}

# Test 3: Redis connection
curl http://<NEW_VPS_IP>:3000/api/health/redis
# Expected: {"status":"ok"}

# Test 4: Send test message from test number (89686484488)
# Message: "Тест после миграции"
# Expected: Bot responds within 15 seconds

# Test 5: Check logs for errors
ssh root@<NEW_VPS_IP> "pm2 logs --err --lines 100"
# Expected: No critical errors

# Test 6: Verify all services stable
ssh root@<NEW_VPS_IP> "pm2 status"
# Expected: All online, no restarts beyond initial restart

echo "✅ Smoke tests passed"
```

**⚠️ CRITICAL GO/NO-GO CHECKPOINT:**

**GO Criteria (Continue with new server):**
- ✅ All 8 services online
- ✅ WhatsApp connected
- ✅ API health check passes
- ✅ Database queries successful
- ✅ Test message processed successfully
- ✅ No critical errors in logs

**NO-GO Criteria (Rollback to old server):**
- ❌ Any service failing to start
- ❌ WhatsApp not connecting
- ❌ Database connection errors
- ❌ Critical errors in logs
- ❌ Test message not processed

**If NO-GO → Execute Rollback (see Phase 5.6)**

**02:30 - Intensive Monitoring (30 minutes)**

```bash
# Monitor logs in real-time
ssh root@<NEW_VPS_IP> "pm2 logs --timestamp"

# Every 5 minutes, check:

# 1. Service status
pm2 status
# All should remain "online", restart count unchanged

# 2. Error logs
pm2 logs --err --lines 50
# Should be minimal or no errors

# 3. WhatsApp connection
pm2 logs baileys-whatsapp-service --lines 10 | grep -i connection
# Should remain "open"

# 4. Send test message every 10 minutes
# Verify bot responds correctly

# 5. Check resource usage
pm2 monit
# CPU: <50%, Memory: <8GB (of 16GB)

# 6. Database latency
curl http://<NEW_VPS_IP>:3000/api/performance/database-latency
# Should remain <1ms

echo "✅ 30 minutes monitoring complete - system stable"
```

**03:00 - Extended Monitoring (3 hours)**

```bash
# Monitor every 15 minutes:

# Check PM2 status
ssh root@<NEW_VPS_IP> "pm2 status"

# Review recent errors (if any)
ssh root@<NEW_VPS_IP> "pm2 logs --err --lines 50"

# Check Baileys file count (should not grow excessively)
ssh root@<NEW_VPS_IP> \
  "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l"
# Expected: 162-200 files

# Send periodic test messages
# Verify bot functionality remains consistent

# Monitor Telegram alerts
# Check for any automated alerts from monitoring services

# Check disk usage
ssh root@<NEW_VPS_IP> "df -h"
# /opt/ai-admin should have >50GB free

# Check memory usage
ssh root@<NEW_VPS_IP> "free -h"
# Available memory should be >8GB

# Every hour, generate status report:
cat > migration-status-$(date +%H%M).txt << EOF
Migration Status Report - $(date)
=====================================

PM2 Services:
$(ssh root@<NEW_VPS_IP> "pm2 status")

Recent Errors (last 50 lines):
$(ssh root@<NEW_VPS_IP> "pm2 logs --err --lines 50")

Resource Usage:
$(ssh root@<NEW_VPS_IP> "free -h && df -h")

Baileys File Count:
$(ssh root@<NEW_VPS_IP> "ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l")

Test Message Results:
[Record test message results here]

Overall Status: ✅ OPERATIONAL / ⚠️ ISSUES / ❌ CRITICAL
EOF

echo "✅ Status report generated"
```

**06:00 - Migration Complete**

```bash
# Generate final migration report
cat > migration-completion-report.txt << EOF
==============================================
AI Admin v2 Datacenter Migration Report
==============================================
Date: $(date)
Migration: Moscow → St. Petersburg (Timeweb)

MIGRATION SUMMARY
-----------------
Start Time: 02:00 (Old server stopped)
End Time: 06:00 (Migration complete)
Total Downtime: [Calculate actual downtime]
Status: ✅ SUCCESS

SERVICES STATUS
---------------
$(ssh root@<NEW_VPS_IP> "pm2 status")

All 8 services: ONLINE
Restarts since migration: [Check restart count]
WhatsApp connection: CONNECTED

PERFORMANCE METRICS
-------------------
Database Latency: <1ms (20-50x improvement)
Redis Latency: <1ms
AI Response Time: 9-15 seconds (consistent)

TEST RESULTS
------------
Total test messages: [Count]
Successful responses: [Count] ([Calculate]% success rate)
Failed messages: [Count]

ISSUES ENCOUNTERED
------------------
[List any issues and how they were resolved]
[If none: "No issues encountered"]

POST-MIGRATION ACTIONS
----------------------
- [ ] Continue monitoring for 7 days
- [ ] Keep old server in standby for 7 days
- [ ] Update documentation with new infrastructure
- [ ] Notify team of successful migration
- [ ] Schedule old server decommission (Day 7)

ROLLBACK PLAN
-------------
Rollback to old server possible within 5 minutes if needed.
Old server status: STANDBY
Rollback tested: YES

NEXT STEPS
----------
1. Monitor new server for 7 days
2. Optimize performance if needed
3. Decommission old server after 7 days stable operation
4. Archive migration documentation

==============================================
Migration completed by: [Your name/team]
Report generated: $(date)
==============================================
EOF

echo "✅ Migration complete!"
echo "📊 Report saved to migration-completion-report.txt"

# Send completion notification
# Via Telegram or email to team
```

**Migration Completion Checklist:**
- [ ] Old server stopped cleanly
- [ ] Final data sync completed
- [ ] New server restarted successfully
- [ ] All smoke tests passed
- [ ] 4 hours monitoring completed without critical issues
- [ ] Migration report generated
- [ ] Team notified of successful migration
- [ ] Total downtime: ____ hours (____ minutes)

#### 5.3 Post-Migration Announcement

**Client Notification:**

```
✅ Техническое обслуживание завершено!

WhatsApp бот снова доступен и работает еще быстрее благодаря обновленной инфраструктуре.

Теперь бот отвечает быстрее и стабильнее.
Спасибо за терпение!

Если у вас возникнут любые вопросы, бот всегда готов помочь. 💬

С уважением,
Команда AI Admin
```

**Team Notification:**

```
🎉 MIGRATION SUCCESS!

AI Admin v2 has been successfully migrated to St. Petersburg datacenter.

Key Improvements:
✅ Database latency: <1ms (20-50x faster)
✅ Internal network connectivity
✅ Improved infrastructure reliability
✅ All services operational

Total Downtime: [X hours Y minutes]
Status: OPERATIONAL

Next Steps:
- Continue monitoring for 7 days
- Old server on standby as fallback
- Performance optimization if needed

Great work team! 🚀
```

**Acceptance Criteria Phase 5:**
- ✅ Migration completed within 2-4 hour window
- ✅ All services operational on new server
- ✅ Zero data loss (Baileys sessions intact)
- ✅ All smoke tests passed
- ✅ No critical errors during migration
- ✅ Clients notified of completion
- ✅ Team updated with success report

---

### Phase 6: Post-Migration (Day 4-30)

**Goals:**
- Ensure long-term stability
- Optimize performance
- Decommission old infrastructure safely

**Key Activities:**

#### 6.1 Extended Monitoring (Day 4-7)

**Daily Health Checks:**

```bash
# Create monitoring script
cat > /opt/ai-admin/scripts/daily-health-check.sh << 'EOF'
#!/bin/bash

echo "================================================"
echo "Daily Health Check - $(date)"
echo "================================================"

echo ""
echo "1. PM2 Services Status"
pm2 status

echo ""
echo "2. Service Restart Counts"
pm2 status | awk 'NR>3 {print $2, $8}' | grep -v "─"

echo ""
echo "3. Recent Errors (last 100 lines)"
pm2 logs --err --lines 100 --nostream

echo ""
echo "4. Resource Usage"
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h /opt/ai-admin

echo ""
echo "5. Baileys File Count"
ls -1 /opt/ai-admin/baileys_sessions/company_962302/ | wc -l

echo ""
echo "6. Database Latency Test"
time psql "$POSTGRES_CONNECTION_STRING" -c "SELECT NOW();" > /dev/null 2>&1

echo ""
echo "7. Redis Latency Test"
redis-cli -a "$REDIS_PASSWORD" --latency-history
# Run for 15 seconds, Ctrl+C to stop

echo ""
echo "8. WhatsApp Connection Status"
pm2 logs baileys-whatsapp-service --lines 20 --nostream | grep -i connection

echo ""
echo "================================================"
echo "Health check complete at $(date)"
echo "================================================"
EOF

chmod +x /opt/ai-admin/scripts/daily-health-check.sh

# Run daily at 09:00 via cron
(crontab -l 2>/dev/null; echo "0 9 * * * /opt/ai-admin/scripts/daily-health-check.sh >> /var/log/ai-admin-health.log 2>&1") | crontab -
```

**Daily Monitoring Checklist:**
- [ ] All 8 services online
- [ ] Restart count <3 per service per day (acceptable for maintenance)
- [ ] No critical errors in logs
- [ ] Memory usage <12GB (of 16GB)
- [ ] Disk usage <50% (80GB of 160GB)
- [ ] Baileys file count stable (162-220 range)
- [ ] Database latency <1ms
- [ ] WhatsApp connection stable
- [ ] Response to test messages successful

**Metrics to Track:**

| Metric | Target | Day 4 | Day 5 | Day 6 | Day 7 |
|--------|--------|-------|-------|-------|-------|
| Uptime % | >99.9% | ___% | ___% | ___% | ___% |
| Avg Response Time | <15s | ___s | ___s | ___s | ___s |
| DB Latency | <1ms | ___ms | ___ms | ___ms | ___ms |
| Message Success Rate | >98% | ___% | ___% | ___% | ___% |
| Service Restarts | <3/day | ___ | ___ | ___ | ___ |
| Memory Usage | <12GB | ___GB | ___GB | ___GB | ___GB |

**Issues Log Template:**

```markdown
## Day 4 - [Date]
**Issues:** [None / List issues]
**Actions Taken:** [Actions to resolve]
**Status:** [Resolved / Monitoring / Escalated]

## Day 5 - [Date]
**Issues:** [None / List issues]
**Actions Taken:** [Actions to resolve]
**Status:** [Resolved / Monitoring / Escalated]

[Continue for Day 6-7]
```

#### 6.2 Performance Optimization (Day 5-7)

**Database Query Optimization:**

```bash
# Enable PostgreSQL slow query logging
ssh root@<NEW_VPS_IP>

# Check for slow queries in application logs
pm2 logs --lines 1000 | grep -E "Query.*[0-9]{3,}ms"
# Any query >100ms should be investigated

# Analyze most frequent queries
pm2 logs ai-admin-api --lines 5000 | \
  grep "SELECT" | \
  sort | uniq -c | sort -rn | head -20

# Consider adding indexes if queries are slow
# (Consult with database team or dev team)
```

**Redis Cache Optimization:**

```bash
# Check Redis memory usage
redis-cli -a "$REDIS_PASSWORD" INFO memory

# Check cache hit rate
redis-cli -a "$REDIS_PASSWORD" INFO stats | grep -E "keyspace_hits|keyspace_misses"

# Calculate hit rate
# Hit Rate = hits / (hits + misses) * 100%
# Target: >80%

# If hit rate is low, review caching strategy
```

**PM2 Process Optimization:**

```bash
# Check if any process needs more memory
pm2 list

# If any process uses >2GB consistently, consider:
# 1. Increasing max_memory_restart in ecosystem.config.js
# 2. Investigating memory leaks
# 3. Optimizing application code

# Example: Update ecosystem.config.js
# max_memory_restart: '2G' → '3G' (if needed)
```

**Network Optimization:**

```bash
# Verify internal network latency
ping -c 100 192.168.0.4
# Should be <1ms average

# Test bandwidth to PostgreSQL
iperf3 -c 192.168.0.4 -p 5201
# (Requires iperf3 server on PostgreSQL side)

# Check for packet loss
ping -c 1000 192.168.0.4 | grep loss
# Should be 0% loss
```

**Performance Optimization Checklist:**
- [ ] Slow queries identified and optimized
- [ ] Redis cache hit rate >80%
- [ ] PM2 processes optimized for memory
- [ ] Network latency verified <1ms
- [ ] No performance degradation over 7 days

#### 6.3 Security Hardening (Day 7-10)

**Firewall Configuration:**

```bash
# Install UFW (Uncomplicated Firewall)
apt install -y ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL - do this first!)
ufw allow 22/tcp
ufw limit 22/tcp  # Rate limiting for SSH

# Allow API port (if external access needed)
# ufw allow 3000/tcp
# Consider restricting to specific IPs:
# ufw allow from <YOUR_IP> to any port 3000 proto tcp

# Enable firewall
ufw enable

# Check status
ufw status verbose

# Expected output:
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     LIMIT       Anywhere
```

**SSH Security:**

```bash
# Disable password authentication (use keys only)
nano /etc/ssh/sshd_config

# Set:
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin prohibit-password

# Restart SSH
systemctl restart sshd

# Verify configuration
sshd -T | grep -E "passwordauthentication|pubkeyauthentication|permitrootlogin"
```

**Automated Security Updates:**

```bash
# Install unattended-upgrades
apt install -y unattended-upgrades

# Configure automatic security updates
dpkg-reconfigure -plow unattended-upgrades
# Select "Yes"

# Verify configuration
cat /etc/apt/apt.conf.d/50unattended-upgrades

# Enable automatic reboot if required (optional)
nano /etc/apt/apt.conf.d/50unattended-upgrades
# Uncomment and set:
# Unattended-Upgrade::Automatic-Reboot "true";
# Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

**System Hardening:**

```bash
# Disable unused services
systemctl list-unit-files --state=enabled
# Review and disable any unnecessary services

# Set proper file permissions
chmod 600 /opt/ai-admin/.env
chmod 600 /opt/ai-admin/baileys_sessions/company_962302/creds.json
chmod 700 /opt/ai-admin/baileys_sessions/company_962302

# Enable fail2ban (optional, for SSH brute force protection)
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

**Security Hardening Checklist:**
- [ ] Firewall (UFW) enabled and configured
- [ ] SSH password authentication disabled
- [ ] Automated security updates enabled
- [ ] Critical files have proper permissions (600/700)
- [ ] Fail2ban installed and running
- [ ] No unnecessary services running

#### 6.4 Documentation Updates (Day 7-10)

**Update Project Documentation:**

```bash
# Update CLAUDE.md
nano /opt/ai-admin/CLAUDE.md

# Update sections:
# - Server IP: 46.149.70.219 → <NEW_VPS_IP>
# - Location: Moscow → St. Petersburg
# - PostgreSQL access: "via SSH tunnel" → "internal network"
# - Add migration date and notes

# Update docs/TIMEWEB_POSTGRES_SUMMARY.md
# - Confirm internal network details
# - Update connection examples with new server

# Create migration documentation
cat > docs/migrations/2025-11-05-datacenter-migration.md << 'EOF'
# Datacenter Migration: Moscow → St. Petersburg

**Date**: 2025-11-05
**Duration**: [X hours]
**Downtime**: [Y hours]
**Status**: ✅ SUCCESS

## Summary
Migrated AI Admin v2 from Moscow datacenter to St. Petersburg Timeweb datacenter to enable internal network connectivity with managed PostgreSQL.

## Changes
- **Old Server**: 46.149.70.219 (Moscow)
- **New Server**: <NEW_VPS_IP> (St. Petersburg)
- **Database Access**: SSH tunnel → Internal network ("Cute Crossbill")
- **Performance**: 20-50x improvement in database latency (<1ms)

## Architecture Improvements
- Direct internal network to PostgreSQL
- Same datacenter location
- Improved reliability and security
- Simplified network configuration

## Lessons Learned
[Document key learnings from migration]

## References
- Migration Plan: `dev/active/datacenter-migration-msk-spb/`
- Old Server Backup: `./migration-backups/final/`
- Old Server Decommission Date: [7 days after migration]
EOF
```

**Update Monitoring Scripts:**

```bash
# Update any hardcoded IPs in scripts
grep -r "46.149.70.219" /opt/ai-admin/scripts/
# Update to <NEW_VPS_IP>

# Update Redis tunnel scripts (if using)
# Should no longer be needed, but update for reference

# Update health check endpoints
# Verify all monitoring tools point to new IP
```

**Update External References:**

```bash
# Update any external services with new IP:

# 1. YClients Webhooks (if applicable)
# Check if YClients sends webhooks to old IP
# Update webhook URL in YClients dashboard

# 2. DNS records (if using domain names)
# Update A record to point to <NEW_VPS_IP>

# 3. Monitoring services (if using external monitoring)
# Update server IP in monitoring dashboards

# 4. Team documentation
# Update any team wikis, runbooks, or documentation
```

**Documentation Updates Checklist:**
- [ ] CLAUDE.md updated with new server details
- [ ] TIMEWEB_POSTGRES_SUMMARY.md updated
- [ ] Migration documentation created
- [ ] Scripts updated with new IP
- [ ] External services updated (webhooks, DNS, etc.)
- [ ] Team documentation updated

#### 6.5 Old Server Standby (Day 4-7)

**Keep Old Server Ready for Rollback:**

```bash
# Old server should remain accessible but stopped
# Do NOT delete or decommission yet

# Daily verification (Day 4-7):
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Check server is accessible
uptime

# Check PM2 services are stopped
pm2 status
# Expected: All stopped

# Verify backup is intact
ls -lh /root/final-backup-*.tar.gz
ls -lh /root/baileys-final-*.tar.gz

# Check disk space
df -h
# Should have backup files preserved

# DO NOT:
# - Delete any files
# - Stop the VPS
# - Cancel the VPS subscription
# - Make any changes
```

**Rollback Readiness Check:**

```bash
# If rollback is needed within 7 days:

# 1. Stop new server
ssh root@<NEW_VPS_IP> "pm2 stop all"

# 2. Start old server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 start all"

# 3. Verify old server operational
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
curl http://46.149.70.219:3000/health

# 4. Send test message to verify
# Message from 89686484488: "Rollback test"

# Expected rollback time: <5 minutes
```

**Old Server Standby Checklist:**
- [ ] Old server accessible via SSH
- [ ] PM2 services stopped but ready
- [ ] Backups preserved and verified
- [ ] Rollback procedure tested (dry run)
- [ ] Can rollback in <5 minutes if needed

#### 6.6 Decommission Old Server (Day 7+)

**Pre-Decommission Verification:**

```bash
# Verify new server stability for 7 consecutive days
cat > decommission-checklist.md << 'EOF'
# Old Server Decommission Checklist

## Prerequisites
- [ ] New server operational for 7 consecutive days
- [ ] Zero critical incidents in last 7 days
- [ ] All metrics within acceptable ranges
- [ ] Performance stable or improved
- [ ] No rollback needed in last 7 days
- [ ] Team consensus to proceed

## Metrics Review (Last 7 Days)
- [ ] Uptime: >99.9%
- [ ] Average response time: <15s
- [ ] Database latency: <1ms
- [ ] Message success rate: >98%
- [ ] Service restarts: <3 per day per service
- [ ] Memory usage: <12GB
- [ ] No unresolved issues

## Backup Verification
- [ ] All backups from old server downloaded locally
- [ ] Backup integrity verified
- [ ] Backups stored in 2+ locations
- [ ] Restoration tested successfully

## Final Decision
- [ ] All prerequisites met
- [ ] Team approval obtained
- [ ] Proceed with decommission: YES / NO

Date: _______________
Approved by: _______________
EOF

# Review checklist
cat decommission-checklist.md
```

**⚠️ GO/NO-GO Decision:**

**GO (Proceed with decommission):**
- ✅ All prerequisites met
- ✅ New server stable for 7+ days
- ✅ All backups verified
- ✅ Team approval obtained

**NO-GO (Keep old server longer):**
- ❌ Any critical issues in last 7 days
- ❌ Unstable metrics
- ❌ Recent rollback needed
- ❌ Team has concerns

**If GO → Proceed with decommission:**

```bash
# Day 7+ (Only if all prerequisites met)

# 1. Create final archive of old server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

tar -czf /root/old-server-final-archive-$(date +%Y%m%d).tar.gz \
  /opt/ai-admin \
  /etc/systemd/system/pm2-* \
  /usr/local/etc/xray \
  /var/log/pm2

# Download final archive
scp -i ~/.ssh/id_ed25519_ai_admin \
  root@46.149.70.219:/root/old-server-final-archive-*.tar.gz \
  ./migration-backups/old-server-archive/

# 2. Delete all PM2 processes
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 delete all"

# 3. Disable PM2 startup
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 unstartup"

# 4. Stop services
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl stop xray redis-server"

# 5. Document decommission
cat > decommission-report.txt << EOF
Old Server Decommission Report
==============================
Date: $(date)
Server: 46.149.70.219 (Moscow)

Status: DECOMMISSIONED
Reason: Migrated to St. Petersburg datacenter

Final Archive: old-server-final-archive-$(date +%Y%m%d).tar.gz
Archive Location: ./migration-backups/old-server-archive/
Archive Size: $(du -h ./migration-backups/old-server-archive/*.tar.gz | cut -f1)

Services Stopped:
- PM2 (all processes)
- Xray VPN
- Redis

VPS Status: Can be cancelled after 30 days
Retention Period: Keep archives for 1 year

Decommissioned by: [Your name]
Date: $(date)
EOF

# 6. Wait 30 days, then cancel VPS subscription
# DO NOT cancel immediately in case of issues
```

**After 30 Days Stable Operation:**

```bash
# Final VPS cancellation
# Via hosting provider control panel:
# 1. Navigate to VPS management
# 2. Select old server (46.149.70.219)
# 3. Cancel subscription
# 4. Confirm cancellation

# Document final cancellation
echo "Old server VPS cancelled on $(date)" >> decommission-report.txt
```

**Decommission Checklist:**
- [ ] Day 7: Pre-decommission verification complete
- [ ] Day 7: Go/No-Go decision: GO
- [ ] Day 7: Final archive created and downloaded
- [ ] Day 7: PM2 processes deleted
- [ ] Day 7: Services stopped
- [ ] Day 7: Decommission report created
- [ ] Day 30+: VPS subscription cancelled
- [ ] Day 30+: Final cancellation documented

**Acceptance Criteria Phase 6:**
- ✅ 7 days continuous stable operation
- ✅ All metrics within acceptable ranges
- ✅ Security hardening completed
- ✅ Documentation fully updated
- ✅ Old server decommissioned safely
- ✅ Archives preserved for 1 year

---

## Risk Assessment and Mitigation

### Critical Risks

#### Risk 0: Database Migration Failure (Baileys Sessions)
**Impact**: CRITICAL - WhatsApp disconnection
**Probability**: Medium (20-25%) - NEW RISK for Phase 0
**Impact Assessment**:
- Failure to migrate Baileys sessions from Supabase to Timeweb PostgreSQL
- WhatsApp requires re-authentication (QR code)
- Potential service disruption during database switchover
- Data corruption during migration

**Root Causes**:
- JSONB serialization issues (similar to original Supabase migration)
- Data type mismatches between Supabase and Timeweb PostgreSQL
- Incomplete data transfer (335 keys must ALL migrate)
- Network interruption during migration

**Mitigation Strategies**:
1. **Test Migration First**:
   ```bash
   # Day -6: Test migration with dry run
   # Verify all 335 keys transfer correctly
   # Check JSONB integrity
   ```

2. **Verification Before Switchover**:
   ```bash
   # Day -2: Comprehensive verification
   SELECT COUNT(*) FROM whatsapp_auth;  # Must be >= 1
   SELECT COUNT(*) FROM whatsapp_keys WHERE company_id = '962302';  # Must be 335
   ```

3. **Rollback Plan** (Fast rollback to Supabase):
   ```bash
   # If switchover fails, immediate rollback
   pm2 stop all
   # Revert .env to Supabase
   pm2 start all
   # <5 minutes rollback time
   ```

4. **7-Day Testing Period**:
   - Test Baileys loading from Timeweb PostgreSQL
   - Verify WhatsApp connects successfully
   - Monitor for any session issues
   - Don't proceed to server migration until stable

**Residual Risk**: Medium (10-15% after mitigation) - Until tested for 7 days

---

#### Risk 1: WhatsApp Session Loss (Server Migration)
**Impact**: LOW - Minor disruption
**Probability**: Very Low (<5%)
**Impact Assessment**:
- ✅ **Significantly reduced risk** after Phase 0 success
- Sessions stored in Timeweb PostgreSQL (centralized)
- New server connects to same database = instant session access
- No file transfer = no corruption risk during server migration

**Why Risk is NOW Very Low:**

1. **Centralized Storage (Supabase)**:
   - Baileys sessions in `whatsapp_auth` and `whatsapp_keys` tables
   - Not dependent on specific server
   - Database-level redundancy and backups
   - 335 keys migrated and verified (2025-10-07)

2. **No File Transfer Risk**:
   - No rsync corruption possible
   - No checksum verification needed
   - No permission issues
   - No incomplete transfers

3. **Instant Switchover**:
   - New server loads sessions from Supabase on startup
   - Same `SUPABASE_URL` and `SUPABASE_KEY` credentials
   - WhatsApp service automatically connects
   - Zero data migration required

**Remaining Mitigation**:
1. **Verify Supabase Access**:
   ```bash
   # Before migration, verify new server can access Supabase
   node -e "
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
   supabase.from('whatsapp_auth').select('company_id').eq('company_id', '962302')
     .then(r => console.log(r.data ? '✅ Access OK' : '❌ ERROR'));
   "
   ```

2. **Supabase Credentials in .env**:
   - Verify `SUPABASE_URL` present
   - Verify `SUPABASE_KEY` present
   - Verify `USE_DATABASE_AUTH_STATE=true`

**Residual Risk**: Very Low (<2%) - Only if Supabase itself is down (highly unlikely)

---

#### Risk 2: Database Connection Failure
**Impact**: CRITICAL - Application cannot function
**Probability**: Medium (20-25%)
**Impact Assessment**:
- All database queries fail
- Cannot retrieve schedules, bookings, client data
- Service completely non-functional

**Root Causes**:
- New VPS not added to "Cute Crossbill" private network
- Incorrect internal network IP in configuration
- PostgreSQL firewall rules blocking new IP
- Network misconfiguration in Timeweb

**Mitigation Strategies**:
1. **Early Verification** (Phase 2.1):
   ```bash
   # Test BEFORE any application deployment
   ping 192.168.0.4
   telnet 192.168.0.4 5432
   psql "postgresql://..." -c "SELECT NOW();"
   ```

2. **Checkpoint System**:
   - STOP migration if database not accessible
   - Contact Timeweb support immediately
   - Verify private network configuration in panel
   - Do not proceed until resolved

3. **Fallback Option**:
   ```bash
   # Temporarily use Supabase (legacy database)
   USE_LEGACY_SUPABASE=true
   # System remains functional while fixing Timeweb connection
   ```

4. **Timeweb Support Escalation**:
   - Have Timeweb support contact ready
   - Private network configuration assistance
   - Firewall rule verification

**Residual Risk**: Low (5-8% after mitigation)

---

#### Risk 3: Gemini API VPN Failure
**Impact**: HIGH - AI responses fail
**Probability**: Low (10-15%)
**Impact Assessment**:
- AI processing fails
- Bot cannot generate responses
- Service degradation (can receive but not respond)

**Root Causes**:
- Xray VPN misconfiguration
- SOCKS5 proxy not working
- USA server unreachable
- Gemini API rejects connection

**Mitigation Strategies**:
1. **Xray Configuration Validation** (Phase 2.3):
   ```bash
   # Test VPN immediately after installation
   xray run -test -config /usr/local/etc/xray/config.json
   curl -x socks5://127.0.0.1:1080 https://ipinfo.io/json
   # Must show USA IP
   ```

2. **Gemini API Test**:
   ```bash
   # Test Gemini accessibility before migration
   curl -x socks5://127.0.0.1:1080 \
     "https://generativelanguage.googleapis.com/v1beta/models/..."
   # Must return valid response
   ```

3. **Fallback AI Provider**:
   ```bash
   # Temporarily switch to DeepSeek (no VPN required)
   AI_PROVIDER=deepseek
   DEEPSEEK_API_KEY=<key>
   # Slower (24s vs 9s) but functional
   ```

4. **Quick Fix Scripts**:
   ```bash
   # Restart Xray if issues
   systemctl restart xray
   sleep 5
   # Test again
   ```

**Residual Risk**: Very Low (2-3% after mitigation)

---

#### Risk 4: Extended Downtime
**Impact**: MEDIUM - Client dissatisfaction
**Probability**: Medium (25-30%)
**Impact Assessment**:
- WhatsApp bot offline >4 hours
- Clients unable to book appointments
- Potential reputation damage
- Lost revenue during downtime

**Root Causes**:
- Migration takes longer than expected
- Unexpected technical issues
- Troubleshooting delays
- Rollback required

**Mitigation Strategies**:
1. **Parallel Preparation**:
   - Complete all setup BEFORE migration window
   - New server fully configured and tested
   - Only data transfer during downtime

2. **Staged Migration**:
   ```
   Phase 1: Setup (0 downtime) - Days 1-3
   Phase 2: Testing (0 downtime) - Day 3-4
   Phase 3: Migration (2-4h downtime) - Day 4
   ```

3. **Fast Rollback**:
   ```bash
   # <5 minute rollback if issues
   ssh old-server "pm2 start all"
   # Immediately operational
   ```

4. **Maintenance Window**:
   - Schedule 02:00-06:00 (low traffic)
   - 4 hour buffer (expect 2 hours)
   - Client notification 24h advance

5. **Clear Go/No-Go Criteria**:
   - If smoke tests fail → immediate rollback
   - No extended troubleshooting during downtime
   - Fix issues on new server in parallel, retry later

**Residual Risk**: Low (5-10% after mitigation)

---

#### Risk 5: Redis Data Loss
**Impact**: MEDIUM - Temporary context loss
**Probability**: High (60-70%)
**Impact Assessment**:
- Lost conversation contexts
- Clients need to restart conversations
- Temporary inconvenience (no data loss)
- BullMQ jobs may need re-enqueuing

**Root Causes**:
- Redis data not transferred (by design - ephemeral)
- New Redis instance starts empty
- Context TTL expired during migration

**Mitigation Strategies**:
1. **Accept as Expected**:
   - Redis data is ephemeral (TTL-based)
   - Designed to regenerate
   - Not a critical failure

2. **Client Communication**:
   ```
   "Если разговор прервался, просто начните заново -
   бот сразу вас поймет!"
   ```

3. **Gradual Regeneration**:
   - Contexts regenerate as clients message
   - Within hours, most active conversations restored
   - No manual intervention needed

4. **Optional: Context Transfer** (If time permits):
   ```bash
   # Dump Redis from old server
   redis-cli -a "$OLD_REDIS_PASSWORD" --rdb /tmp/dump.rdb

   # Transfer to new server
   scp old-server:/tmp/dump.rdb new-server:/tmp/

   # Import to new Redis
   redis-cli -a "$NEW_REDIS_PASSWORD" < /tmp/dump.rdb
   ```
   Note: NOT recommended due to time constraints and low criticality

**Residual Risk**: Accepted (60-70% - by design)

---

#### Risk 6: Internal Network Misconfiguration
**Impact**: CRITICAL - Cannot access PostgreSQL
**Probability**: Medium-High (30-35%)
**Impact Assessment**:
- Same as Risk 2 (Database Connection Failure)
- Total application failure
- Migration cannot proceed

**Root Causes**:
- "Cute Crossbill" network not attached to new VPS
- Wrong network selected during VPS creation
- Timeweb panel configuration error
- Network routing issues

**Mitigation Strategies**:
1. **VPS Creation Checklist** (Phase 1.3):
   - ✅ Region: St. Petersburg (MANDATORY)
   - ✅ Private Network: "Cute Crossbill" (MANDATORY)
   - ✅ Screenshot configuration before creating
   - ✅ Verify network attached after creation

2. **Immediate Verification** (Phase 2.1 - FIRST PRIORITY):
   ```bash
   # Before any other setup
   ip addr show  # Look for private network interface
   ping 192.168.0.4  # Must succeed
   telnet 192.168.0.4 5432  # Must connect
   ```

3. **STOP If Fails**:
   - Do not proceed with any installation
   - Check Timeweb control panel
   - Verify "Cute Crossbill" shows new VPS
   - Contact Timeweb support if needed

4. **Timeweb Support Contact**:
   - Have support ticket ready
   - Private network configuration assistance
   - Priority support if available

**Residual Risk**: Low (5-10% with early verification)

---

### Medium Risks

#### Risk 7: Package Version Mismatches
**Impact**: MEDIUM
**Probability**: Low (10-15%)

**Mitigation**:
- Use same Node.js version (20.x)
- `npm install` with package-lock.json
- Verify critical packages match old server

#### Risk 8: Environment Variable Errors
**Impact**: MEDIUM
**Probability**: Medium (15-20%)

**Mitigation**:
- Copy .env from backup (not manual entry)
- Validation script to check all variables
- Test connections before starting services

#### Risk 9: PM2 Startup Issues
**Impact**: LOW-MEDIUM
**Probability**: Low (10%)

**Mitigation**:
- Use existing ecosystem.config.js
- Test PM2 startup before migration
- Have PM2 restart commands ready

#### Risk 10: Disk Space Exhaustion
**Impact**: MEDIUM
**Probability**: Very Low (<5%)

**Mitigation**:
- 160GB NVMe (same as old server)
- Monitor disk usage during migration
- Baileys files monitored (162-220 expected)

---

### Risk Matrix

**STAGE 1 (Phase 0): Database Migration Risks**

| Risk | Impact | Probability | Risk Level | Mitigation Priority |
|------|--------|-------------|------------|---------------------|
| **DB Migration Failure (Baileys)** | CRITICAL | Medium | **HIGH** | 1 (Highest) 🆕 |
| Database Connection (Supabase→Timeweb) | CRITICAL | Medium | HIGH | 1 (Highest) |
| Data Corruption During Migration | HIGH | Low-Medium | MEDIUM | 2 |

**STAGE 2 (Phases 1-6): Server Migration Risks**

| Risk | Impact | Probability | Risk Level | Mitigation Priority |
|------|--------|-------------|------------|---------------------|
| Network Misconfiguration (Cute Crossbill) | CRITICAL | Medium-High | HIGH | 1 (Highest) |
| WhatsApp Session Loss (Server) | LOW | Very Low | **VERY LOW** | 4 (Minimal) ✅ |
| Gemini VPN Failure | HIGH | Low | MEDIUM | 2 |
| Extended Downtime | MEDIUM | Medium | MEDIUM | 2 |
| Environment Errors | MEDIUM | Medium | MEDIUM | 2 |
| Redis Data Loss | MEDIUM | High | ACCEPTED | N/A |
| Package Mismatches | MEDIUM | Low | LOW | 3 |
| PM2 Startup Issues | LOW-MEDIUM | Low | LOW | 3 |
| Disk Space | MEDIUM | Very Low | LOW | 3 |

**Notes:**
- 🆕 **NEW Risk (Phase 0)**: Database Migration Failure - migrating Baileys from Supabase to Timeweb PostgreSQL is the new critical risk
- ✅ **Reduced Risk (Phase 1-6)**: WhatsApp Session Loss during server migration significantly reduced - sessions already in Timeweb PostgreSQL after Phase 0
- Two-stage approach isolates database risks from server risks

---

## Success Metrics

### Primary Metrics (Must Achieve)

1. **Service Availability**
   - **Target**: >99.9% uptime (7 days post-migration)
   - **Measurement**: PM2 status, monitoring logs
   - **Success Criteria**: <9 minutes total downtime per 7 days

2. **Database Performance**
   - **Target**: <1ms latency (vs old 20-50ms)
   - **Measurement**: API performance endpoint, logs
   - **Success Criteria**: 20-50x improvement confirmed

3. **Zero Data Loss**
   - **Target**: 100% data integrity
   - **Measurement**: Baileys session files, MD5 checksums
   - **Success Criteria**: creds.json intact, all sessions preserved

4. **Message Success Rate**
   - **Target**: >98% successful message processing
   - **Measurement**: Worker logs, Telegram alerts
   - **Success Criteria**: <2% failure rate

5. **Migration Downtime**
   - **Target**: <4 hours actual downtime
   - **Measurement**: Start/stop timestamps
   - **Success Criteria**: Within maintenance window (02:00-06:00)

---

### Secondary Metrics (Should Achieve)

6. **AI Response Time**
   - **Target**: 9-15 seconds (consistent with current)
   - **Measurement**: Worker processing logs
   - **Success Criteria**: No degradation from current performance

7. **Service Stability**
   - **Target**: <3 service restarts per day per service
   - **Measurement**: PM2 restart count
   - **Success Criteria**: No restart loops or crashes

8. **Resource Utilization**
   - **Target**: <75% memory usage (<12GB of 16GB)
   - **Measurement**: `free -h`, `pm2 monit`
   - **Success Criteria**: No memory leaks or exhaustion

9. **Disk Usage**
   - **Target**: <50% disk utilization (<80GB of 160GB)
   - **Measurement**: `df -h`
   - **Success Criteria**: Adequate space for logs and growth

10. **Baileys File Stability**
    - **Target**: 162-220 files (healthy range)
    - **Measurement**: File count in sessions directory
    - **Success Criteria**: No excessive file accumulation

---

### Operational Metrics (Monitor)

11. **Rollback Events**
    - **Target**: Zero rollbacks needed
    - **Measurement**: Migration log
    - **Success Criteria**: No return to old server

12. **Critical Errors**
    - **Target**: Zero critical errors (7 days)
    - **Measurement**: PM2 error logs, Telegram alerts
    - **Success Criteria**: No unresolved critical issues

13. **Client Satisfaction**
    - **Target**: No increase in complaints
    - **Measurement**: Telegram support messages
    - **Success Criteria**: Normal or improved sentiment

14. **Team Efficiency**
    - **Target**: Migration completed within timeline
    - **Measurement**: Phase completion dates
    - **Success Criteria**: 4-5 days total (vs 7 day estimate)

---

### Performance Comparison

| Metric | Before (Old) | After (New) | Improvement |
|--------|--------------|-------------|-------------|
| Database Latency | 20-50ms | <1ms | 20-50x |
| Network Type | SSH Tunnel | Internal Network | Direct |
| Connection Method | External | Private Network | Secure |
| Server Location | Moscow | St. Petersburg | Same as DB |
| Maintenance Window | N/A | 02:00-06:00 | Planned |
| Downtime | N/A | <4 hours | Acceptable |

---

### Success Definition

**Migration considered SUCCESSFUL if:**
- ✅ All Primary Metrics achieved
- ✅ At least 80% of Secondary Metrics achieved
- ✅ No Critical or HIGH risks materialized without resolution
- ✅ Old server decommissioned within 30 days
- ✅ No rollback events required

**Migration considered PARTIAL SUCCESS if:**
- ✅ All Primary Metrics achieved
- ⚠️ Some Secondary Metrics missed but improving
- ⚠️ Some Medium risks materialized but resolved
- ✅ System stable and operational

**Migration considered FAILURE if:**
- ❌ Any Primary Metric not achieved after 7 days
- ❌ Critical risks materialized and unresolved
- ❌ Rollback to old server required
- ❌ Extended downtime >6 hours

---

## Timeline Estimates

### Detailed Schedule

**STAGE 1: Database Migration (Supabase → Timeweb PostgreSQL)**

| Phase | Activity | Duration | Work Hours | Dependencies |
|-------|----------|----------|------------|--------------|
| **Day -7** | | | | |
| 0.1 | Prepare Timeweb PostgreSQL | 2 hr | 2 hr | Timeweb PostgreSQL created |
| 0.2 | Migrate database schema | 2 hr | 4 hr | SSH tunnel established |
| **Day -6 to -2** | | | | |
| 0.3 | Migrate data (Baileys + app data) | 4-6 hr | 8-10 hr | Schema applied |
| **Day -2 to -1** | | | | |
| 0.4 | Verification & testing | 2 hr | 10-12 hr | Data migrated |
| **Day 0** | | | | |
| 0.5 | **DATABASE SWITCHOVER** | **10-15 min** | **downtime** | **All tests pass** |
| **Day 0-7** | | | | |
| 0.6 | Post-switchover testing (7 days) | Continuous | Monitoring | Switchover complete |

**STAGE 2: Server Migration (Moscow → St. Petersburg)**

| Phase | Activity | Duration | Work Hours | Dependencies |
|-------|----------|----------|------------|--------------|
| **Day 7** | | | | |
| 1.1 | Create backups (configs only) | 30 min | 30 min | Phase 0 success |
| 1.2 | Document configuration | 30 min | 1 hr | None |
| 1.3 | Create new VPS | 30 min | 1.5 hr | Timeweb account access |
| 2.1 | Verify internal network | 30 min | 2 hr | VPS created |
| 2.2 | Install base software | 1 hr | 3 hr | Network verified |
| 2.3 | Setup Xray VPN | 1 hr | 4 hr | Base software installed |
| **Day 8** | | | | |
| 3.1 | Clone repository | 15 min | 4.25 hr | VPS setup complete |
| 3.2 | Verify Timeweb PostgreSQL access | 10 min | 4.5 hr | Repository cloned |
| 3.3 | Configure .env | 30 min | 5 hr | PostgreSQL verified |
| 3.4 | Install dependencies | 45 min | 5.75 hr | .env configured |
| 4.1 | Start PM2 services | 15 min | 6 hr | Dependencies installed |
| 4.2 | Validate core services | 1 hr | 7 hr | Services started |
| 4.3 | Functional testing | 2 hr | 9 hr | Core services valid |
| 4.4 | Performance validation | 1 hr | 10 hr | Functional tests pass |
| **Day 8-10** | | | | |
| 4.5 | Parallel run (48h) | 48 hr | 58 hr | All tests passed |
| **Day 10** | | | | |
| 5.1 | Pre-migration prep | 2 hr | 60 hr | Parallel run successful |
| 5.2 | **SERVER MIGRATION** | **2-4 hr** | **62-64 hr** | **GO decision** |
| 5.3 | Post-migration announce | 30 min | 64.5 hr | Migration complete |
| **Day 10-17** | | | | |
| 6.1 | Extended monitoring | 7 days | 172 hr | Migration complete |
| 6.2 | Performance optimization | Ongoing | - | Monitoring data |
| 6.3 | Security hardening | 4 hr | 176 hr | Services stable |
| 6.4 | Documentation updates | 2 hr | 178 hr | Services stable |
| 6.5 | Old server standby | 7 days | 178 hr | Parallel with monitoring |
| **Day 17+** | | | | |
| 6.6 | Decommission old server | 1 hr | 179 hr | 7 days stable + approval |
| **Day 40+** | | | | |
| 6.6 | Cancel old VPS | 15 min | - | 30 days stable |

**Summary:**
- **Stage 1 (Database)**: Day -7 to Day 7 (~14 days total, 10-12 hours work, 15 min downtime)
- **Stage 2 (Server)**: Day 7 to Day 17 (~10 days, 10 hours work, 2-4 hours downtime)
- **Total**: ~24 days from start to server migration complete
- **Total Work Hours**: ~20-22 hours
- **Total Downtime**: ~2.5-4.25 hours (15 min DB + 2-4 hr server)

---

### Critical Path

**Sequential dependencies (cannot parallelize):**

**STAGE 1: Database Migration**

1. **Schema Migration** → **Data Migration** → **Verification**
   - Cannot migrate data until schema ready
   - Cannot verify until data migrated
   - Total: ~4-8 hours work over 5 days

2. **Verification** → **Switchover** → **Testing**
   - Cannot switchover until verification complete
   - Cannot proceed to server migration until 7 days stable
   - Total: 7 days mandatory wait

**STAGE 2: Server Migration**

3. **Database Migration Success** → **VPS Creation** → **Network Verification** → **Software Installation**
   - Cannot start server migration until database stable
   - Cannot install software until network verified
   - Cannot verify network until VPS created
   - Total: ~2 hours

4. **Software Installation** → **Application Deployment** → **Testing**
   - Cannot deploy until software ready
   - Cannot test until deployed
   - Total: ~4 hours

5. **Testing** → **Parallel Run** → **GO Decision** → **Server Migration**
   - Cannot migrate server until parallel run complete
   - Cannot start parallel run until testing passes
   - Total: 48+ hours

6. **Server Migration** → **Monitoring** → **Decommission**
   - Cannot decommission until 7+ days monitoring
   - Cannot monitor until migration complete
   - Total: 7+ days

**Total Critical Path**:
- **Stage 1**: 7-14 days (preparation + mandatory testing period)
- **Stage 2**: 10 days (including 48h parallel + 7 days monitoring)
- **TOTAL**: ~17-24 days from start to server migration complete

---

### Fast-Track Option (Aggressive Timeline)

If absolutely necessary (NOT RECOMMENDED):

| Phase | Duration | Notes |
|-------|----------|-------|
| Day 1 | 4 hours | Setup + VPN |
| Day 2 | 6 hours | Deploy + Test |
| Day 2 | 12 hours | Parallel run (reduced from 48h) |
| Day 3 | 4 hours | Migration |
| Day 3-5 | 3 days | Monitoring (reduced from 7 days) |
| **Total** | **3-5 days** | **Higher risk** |

**Risks of Fast-Track:**
- ⚠️ Less time to identify issues during parallel run
- ⚠️ Less confidence in stability before migration
- ⚠️ Higher probability of rollback needed
- ⚠️ Less time for team to prepare

**Only consider if:**
- Critical business need for immediate migration
- Experienced team with migration expertise
- Accept higher risk tolerance
- Have immediate rollback capability

---

## Required Resources and Dependencies

### Human Resources

**Required Roles:**

1. **DevOps Engineer / Systems Administrator** (Primary)
   - **Responsibilities**:
     - VPS creation and configuration
     - Network setup and verification
     - Software installation
     - Migration execution
   - **Time Commitment**: 20-30 hours over 7 days
   - **Critical Phases**: All phases, especially Phase 2 & 5

2. **Backend Developer** (Secondary)
   - **Responsibilities**:
     - Application configuration
     - .env setup and validation
     - PM2 configuration
     - Troubleshooting application issues
   - **Time Commitment**: 10-15 hours over 7 days
   - **Critical Phases**: Phase 3 & 4

3. **QA / Testing Specialist** (Optional but recommended)
   - **Responsibilities**:
     - Functional testing (Phase 4.3)
     - Performance validation (Phase 4.4)
     - Test message scenarios
   - **Time Commitment**: 5-10 hours over 3 days
   - **Critical Phases**: Phase 4

4. **Project Manager / Coordinator** (Recommended)
   - **Responsibilities**:
     - Timeline tracking
     - Stakeholder communication
     - Risk monitoring
     - Decision making for Go/No-Go
   - **Time Commitment**: 5 hours over 7 days
   - **Critical Phases**: Phase 4.5 & 5

**On-Call Requirements:**
- **Migration Window (Day 4, 02:00-06:00)**: DevOps Engineer + Backend Developer
- **Post-Migration (Day 4-7)**: DevOps Engineer (on-call, not dedicated)

---

### Technical Resources

**Infrastructure:**

1. **New VPS**
   - **Provider**: Timeweb
   - **Region**: St. Petersburg
   - **Specs**: 8 vCPU, 16GB RAM, 160GB NVMe SSD
   - **OS**: Ubuntu 22.04 LTS
   - **Private Network**: "Cute Crossbill" (MANDATORY)
   - **Cost**: ~₽2,000-3,000/month
   - **Provisioning Time**: ~5 minutes

2. **Existing PostgreSQL**
   - **Provider**: Timeweb Managed PostgreSQL
   - **Location**: St. Petersburg
   - **Internal IP**: 192.168.0.4:5432
   - **Private Network**: "Cute Crossbill"
   - **No changes required**

3. **Old VPS (Standby)**
   - **Current**: 46.149.70.219 (Moscow)
   - **Keep active**: 7-30 days post-migration
   - **Cost**: Keep existing subscription
   - **Purpose**: Rollback capability

**Software:**

1. **Node.js 20.x LTS** (Free)
2. **PM2** (Free)
3. **Redis** (Free - local instance)
4. **Xray VPN** (Free - USA server access)
5. **PostgreSQL Client** (Free)
6. **Git** (Free)

**External Services (No changes):**

1. **Google Gemini API**
   - Existing API key
   - Access via VPN (Xray)
   - No cost change

2. **YClients API**
   - Existing tokens
   - No configuration change

3. **Telegram Bot API**
   - Existing bot token
   - No configuration change

4. **WhatsApp (Baileys)**
   - Existing sessions
   - Transfer required

---

### Access Requirements

**Before Starting Migration:**

1. **Timeweb Control Panel**
   - ✅ Login credentials
   - ✅ Permission to create VPS
   - ✅ Access to private network management
   - ✅ Ability to view PostgreSQL configuration

2. **SSH Access**
   - ✅ Private key: `~/.ssh/id_ed25519_ai_admin`
   - ✅ Access to old server: 46.149.70.219
   - ✅ Ability to add new SSH keys for new VPS

3. **GitHub Repository**
   - ✅ Read access to: `https://github.com/vosarsen/ai_admin_v2.git`
   - ✅ Git credentials configured locally

4. **Environment Variables / Secrets**
   - ✅ .env file from old server
   - ✅ Gemini API key
   - ✅ YClients tokens
   - ✅ Telegram bot token
   - ✅ JWT secret
   - ✅ Master key

5. **MCP Servers (Optional - for testing)**
   - ✅ WhatsApp MCP configured
   - ✅ Redis MCP configured (if used)
   - ✅ Logs MCP configured

---

### Dependencies and Prerequisites

**Technical Prerequisites:**

1. **Stable Internet Connection**
   - For file transfers (Baileys sessions ~500MB-1GB)
   - For SSH sessions during migration

2. **Local Backup Storage**
   - ✅ ~2-3GB free space for backups
   - Location: `./migration-backups/`

3. **Timeweb Managed PostgreSQL**
   - ✅ Already created and operational
   - ✅ "Cute Crossbill" private network exists
   - ✅ Database credentials available

4. **Xray VPN Configuration**
   - ✅ config.json from old server
   - ✅ USA server still accessible

**Organizational Prerequisites:**

1. **Maintenance Window Approval**
   - ✅ Approved downtime: 02:00-06:00 (4 hours)
   - ✅ Stakeholder notification completed
   - ✅ Client notification prepared

2. **Budget Approval**
   - ✅ New VPS cost: ~₽2,000-3,000/month
   - ✅ Keep old VPS for 7-30 days: ~₽2,000-3,000/month (temporary)
   - **Total additional cost**: ~₽4,000-6,000/month (temporary, 30 days max)

3. **Team Availability**
   - ✅ DevOps Engineer available (20-30 hours)
   - ✅ Backend Developer available (10-15 hours)
   - ✅ On-call during migration window

4. **Go/No-Go Authority**
   - ✅ Designated decision maker for:
     - Proceeding with migration after parallel run
     - Rollback decision if issues arise
     - Old server decommission approval

---

### External Dependencies

**Timeweb Services:**

1. **VPS Provisioning**
   - Dependency: Timeweb platform availability
   - Risk: Platform maintenance during migration
   - Mitigation: Check Timeweb status page before starting

2. **Private Network Configuration**
   - Dependency: Timeweb network infrastructure
   - Risk: Network misconfiguration
   - Mitigation: Early verification (Phase 2.1)

3. **Managed PostgreSQL Availability**
   - Dependency: Timeweb database service uptime
   - Risk: Database downtime during migration
   - Mitigation: Check Timeweb service status, schedule during maintenance-free period

**Third-Party Services:**

1. **Google Gemini API**
   - Dependency: Gemini service availability + VPN
   - Risk: API outage or VPN issues
   - Mitigation: Fallback to DeepSeek

2. **YClients API**
   - Dependency: YClients platform availability
   - Risk: Cannot sync schedules/bookings during outage
   - Mitigation: Use cached data, retry mechanism

3. **Xray VPN / USA Server**
   - Dependency: USA proxy server availability
   - Risk: VPN server down
   - Mitigation: Test before migration, have alternative proxy

**Network Dependencies:**

1. **Internet Connectivity**
   - Dependency: Stable connection for SSH and file transfer
   - Risk: Connection drop during critical phase
   - Mitigation: Use tmux/screen for persistent sessions

2. **DNS Resolution**
   - Dependency: DNS servers for package downloads
   - Risk: Cannot install packages
   - Mitigation: Use multiple DNS servers (8.8.8.8, 1.1.1.1)

---

### Checklist: Resources Ready?

**Before starting Phase 1:**

- [ ] DevOps Engineer assigned and available
- [ ] Backend Developer on standby
- [ ] Timeweb control panel access verified
- [ ] SSH access to old server working
- [ ] GitHub repository access confirmed
- [ ] All secrets/credentials documented
- [ ] Local backup storage prepared (2-3GB free)
- [ ] Maintenance window approved
- [ ] Budget approved (new VPS + temporary old VPS)
- [ ] Team calendar blocked for critical phases
- [ ] Timeweb service status checked (no planned maintenance)
- [ ] Go/No-Go decision maker identified

**If any item unchecked → Resolve before proceeding**

---

## Conclusion

This migration plan provides a comprehensive, step-by-step approach to relocating AI Admin v2 from Moscow to St. Petersburg datacenter with minimal risk and downtime.

**Key Strengths of This Plan:**

1. **Robust Risk Mitigation**
   - Three-tier backup system for critical data
   - Multiple checkpoints with Go/No-Go decisions
   - Fast rollback capability (<5 minutes)
   - Parallel run to validate before cutover

2. **Minimal Downtime**
   - 2-4 hours planned downtime (vs days for other approaches)
   - Maintenance window during low-traffic hours
   - All preparation done beforehand (0 downtime)

3. **Clear Success Criteria**
   - Measurable metrics for each phase
   - Defined acceptance criteria
   - Performance improvements validated (20-50x)

4. **Comprehensive Documentation**
   - Detailed commands for each step
   - Checklists to prevent missed steps
   - Decision points clearly marked
   - Rollback procedures documented

5. **Staged Approach**
   - Can stop at any checkpoint if issues arise
   - No point of no return until smoke tests pass
   - Old server preserved as instant fallback

**This plan prioritizes:**
- ✅ Data integrity (zero data loss)
- ✅ Service availability (minimal downtime)
- ✅ Risk mitigation (multiple fallbacks)
- ✅ Performance improvement (20-50x database speed)
- ✅ Team clarity (step-by-step guidance)

**Upon completion:**
- 🚀 **20-50x faster database queries** (<1ms vs 20-50ms)
- 🔒 **Improved security** (internal network, no SSH tunnel)
- 💪 **Better reliability** (same datacenter as database)
- 📈 **Scalability** (cleaner architecture for future growth)

**Ready to proceed?**
- Review this plan with team
- Confirm all prerequisites met
- Schedule migration window
- Execute Phase 1 (Preparation)

---

**Last Updated**: 2025-11-05
**Document Version**: 1.0
**Status**: APPROVED - Ready for execution

