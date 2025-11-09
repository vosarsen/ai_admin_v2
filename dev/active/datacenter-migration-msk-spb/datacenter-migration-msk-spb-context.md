# Datacenter Migration Context
**Last Updated: 2025-11-09**

---

## 🔄 CURRENT SESSION UPDATE (2025-11-09)

**Session Context:**
- User requested dev-docs update for datacenter migration task
- Current status review and documentation refresh needed
- No code changes in this session - documentation only

**Current State Summary:**
- ✅ Phase 0 (Database Migration): COMPLETE (Baileys → Timeweb PostgreSQL)
- ✅ Phase 0.7: COMPLETE (25+ hours stable operation)
- ⚠️ Phase 1: ON HOLD pending prerequisites
- 📋 Plan Reviewed: 2025-11-08 by plan-reviewer agent
- 🎯 Next Phase: 0.8 (Schema Migration) - NOT STARTED

**Key Context:**
- All plan-reviewer recommendations accepted
- Timeline revised from 3-4 days → 5-6 weeks (realistic)
- Four critical prerequisites identified before Phase 1 can begin
- Repository Pattern decision: Thin abstraction layer (NOT full ORM)
- Feature flags approach selected for gradual rollout

**Session Status:** Documentation updated, ready for Phase 0.8 planning

---

## 📋 PLAN REVIEW RESULTS (2025-11-08)

### Reviewer: plan-reviewer agent (Claude Code)

**Overall Assessment:** ⚠️ **MAJOR REVISIONS REQUIRED**

**Status:** All recommendations accepted and incorporated into updated plan

---

### Key Findings

**1. Critical Issue: Missing Database Schema** (3-4 days work, NOT 2-4 hours)
- Must create 12+ tables in Timeweb BEFORE Phase 1
- Partitioned messages table = high complexity
- **NEW: Phase 0.8 prerequisite (MANDATORY)**

**2. Critical Issue: Query Complexity Underestimated**
- Simple examples shown, production has complex JOINs
- Supabase fluent API → PostgreSQL SQL = 60-80% error probability
- **NEW: Phase 0.9 Query Pattern Library prerequisite (CRITICAL)**

**3. Important: Timeline Unrealistic**
- Plan: 3-4 days
- Reality: 5-6 weeks (26-30 days)
- Breakdown: 11-15 days prerequisites + 15 days Phase 1

**4. Important: "No Abstraction Layer" Decision Questioned**
- Testing difficulty without abstraction
- Maintenance burden (500+ postgres.query() calls)
- **Decision: Add thin Repository Pattern** (+2-3 days, huge long-term value)

**5. Missing: Data Migration Strategy**
- Phase 1 = code migration, but when does data migrate?
- Need clear strategy defined

---

### Risk Re-Assessment

| Risk Level | Before Review | After All Recommendations |
|------------|---------------|---------------------------|
| Overall | MEDIUM (plan claim) | HIGH (70-80%) → LOW-MEDIUM (25-35%) |
| Query errors | 30-35% | 60-80% → 25-35% with Phase 0.9 |
| Schema errors | Not mentioned | 40-50% → 5-10% with Phase 0.8 |
| Timeline miss | Not mentioned | 100% (impossible) → 10% (realistic) |

---

### Recommendations Accepted

**Minimum Viable (MUST DO):**
1. ✅ Phase 0.8: Schema Migration (3-4 days)
2. ✅ Phase 0.9: Query Pattern Library (4-5 days)
3. ✅ Fix timeline: 5-6 weeks instead of 3-4 days
4. ✅ Test rollback procedure in staging
5. ✅ Define data migration strategy

**Strongly Recommended (WILL DO):**
6. ✅ Repository Pattern: Thin abstraction layer (+2-3 days)
7. ✅ Performance Baseline: Measure Supabase before migration (+1-2 days)
8. ✅ Feature Flags: Gradual rollout capability (+1 day)
9. ✅ Comprehensive Testing: Unit + integration + load tests (+3-4 days)
10. ✅ Enhanced Monitoring: Structured logging, metrics, dashboards (+1-2 days)

---

### Revised Timeline

**TOTAL: 5-6 weeks (conservative estimate)**

```
Prerequisites (2-3 weeks):
├── Phase 0.8: Schema Migration          3-4 days (26h)
├── Phase 0.9: Query Pattern Library     4-5 days (32h)
├── Phase 0.95: Risk Mitigation Setup    2-3 days (16-24h)
└── Phase 0.97: Testing Infrastructure   2-3 days (16-24h)

Phase 1 (3 weeks):
├── Week 1: Data Layer + Initial Syncs   5 days
├── Week 2: Remaining Syncs + Services   5 days
└── Week 3: Routes + Workers + Testing   5 days

Alternative: Strangler Fig (4 months, lower risk)
├── Month 1: Clients Module
├── Month 2: Bookings Module
├── Month 3: Services + Staff Modules
└── Month 4: Cleanup + Decommission Supabase
```

---

### Success Probability

- With original plan: 20-30%
- With minimum changes: 50-60%
- **With all recommendations: 75-85%** ✅
- With Strangler Fig: 85-95%

---

### Key Decisions (Updated 2025-11-08)

**1. Migration Approach: Direct PostgreSQL + Repository Pattern**

**Modified Decision:**
- ✅ Thin Repository Pattern (NOT full ORM)
- Simple repository classes per table
- Business logic stays in services
- Easy to test, maintain
- Additional time: +2-3 days (acceptable)

**Why Modified:**
- Testing difficulty without abstraction
- 500+ postgres.query() calls hard to maintain
- Future database changes easier with repositories
- Industry best practice

**2. Timeline: 5-6 Weeks (Revised from 3-4 Days)**

**Breakdown:**
- Prerequisites: 11-15 days
- Phase 1 Code Migration: 15 days
- Total: 26-30 days

**Rationale:**
- Original 3-4 days was 100-200% underestimate
- Complex query transformations need time
- Proper testing cannot be rushed
- Schema migration is 3-4 days alone

**3. New Prerequisites Added (MANDATORY before Phase 1)**

**Phase 0.8: Schema Migration** - CRITICAL
- Cannot migrate code without tables existing
- 12+ tables to create
- Partitioned messages table
- Indexes and constraints

**Phase 0.9: Query Pattern Library** - CRITICAL
- 60-80% query error probability without this
- Test suite for query transformations
- Document all edge cases

**Phase 0.95 & 0.97:** Risk mitigation and testing setup

**4. Strangler Fig Alternative Available**

**If time allows / risk tolerance low:**
- Module-by-module migration (4 months)
- Month 1: Clients
- Month 2: Bookings
- Month 3: Services + Staff
- Month 4: Cleanup + decommission Supabase
- Risk: 15-25% per module (vs 70-80% big bang)
- Success: 85-95%

**5. Feature Flags for Gradual Rollout**

**Approach:**
- Per-module flags (POSTGRES_CLIENTS=true/false)
- Percentage-based rollout (10% → 50% → 100%)
- Instant rollback without deployment

**6. Data Migration Strategy Clarified**

**Phases:**
- Phase 1: Code migration only (USE_LEGACY_SUPABASE=true)
- Phase 2: Data migration + dual write
- Phase 3: Cutover to Timeweb (USE_LEGACY_SUPABASE=false)
- Phase 4: Decommission Supabase (after 30 days)

---

**Full Review Report:** `plan-review-2025-11-08.md`

---

## 🚨 CRITICAL DISCOVERY - Phase 0 INCOMPLETE (2025-11-06 22:00)

**STATUS:** ⚠️ **PARTIAL MIGRATION - BAILEYS STILL USING SUPABASE**

### What We Discovered After Phase 0

**The Problem:**
- ✅ Data migrated to Timeweb: whatsapp_auth (1), whatsapp_keys (728)
- ❌ **Baileys STILL READS FROM SUPABASE** (not from Timeweb!)
- ❌ Other tables NOT migrated: clients (1,299), services (63), staff (12), bookings (38)

**Root Cause:**
```javascript
// src/integrations/whatsapp/auth-state-supabase.js
const { supabase } = require('../../database/supabase');  // ❌ Hardcoded

// This file connects DIRECTLY to Supabase, ignoring USE_LEGACY_SUPABASE flag
```

**Architecture Issues:**
- `USE_LEGACY_SUPABASE=false` only affects `src/database/postgres.js`
- Baileys auth state uses separate `auth-state-supabase.js` module
- 59 files in codebase reference Supabase directly
- 11 sync scripts write to Supabase
- Business data (clients/services/staff) in Supabase, used by app

**User Decision:** Migrate EVERYTHING (Variant B)
- Timeline: Conservative (3 weeks)
- Downtime: 4-6 hours (full migration)
- Testing: Production (off-peak)
- Priority: Baileys + Business data + Active bookings

**Next Phase:** Create complete migration plan for ALL tables

---

## 🎉 Phase 0 EXECUTION COMPLETE - 2025-11-06 16:58 UTC
**NOTE:** Data migrated but NOT being used yet - need Phase 0.7 to fix

**Status:** ✅ **SUCCESSFULLY EXECUTED - ALL SERVICES ONLINE**
**Execution Date:** 2025-11-06 (13:56-16:58 Moscow Time)
**Duration:** ~30 minutes total (10-15 min downtime during switchover)
**Developer:** Claude Code

### ✅ Phase 0.1: Timeweb PostgreSQL Access (COMPLETE)
- SSL certificate installed: `/root/.cloud-certs/root.crt` (1.7KB)
- Downloaded from: `https://st.timeweb.com/cloud-static/ca.crt`
- Connection verified: PostgreSQL 18.0
- **Host:** `a84c973324fdaccfc68d929d.twc1.net:5432` (external endpoint with SSL)
- **Critical Discovery:** Internal IP 192.168.0.4 is NOT accessible from Moscow datacenter (different locations)
- **Solution:** Using external SSL endpoint until server migration to SPb

### ✅ Phase 0.2: Database Schema Applied (COMPLETE)
- `whatsapp_auth` table created ✅
- `whatsapp_keys` table created ✅
- Applied migrations:
  - `migrations/20251007_create_whatsapp_auth_tables.sql`
  - `migrations/20251008_optimize_whatsapp_keys.sql`
- **Issue Fixed:** Dropped problematic index `idx_whatsapp_keys_company_type_id` (included large JSONB causing "index row requires 112KB > 8KB limit" error)

### ✅ Phase 0.3: Data Migration (COMPLETE)
- **Migrated:** 1 auth record + **728 keys** (not 335 as expected - data grew)
- Method: Node.js script with SSL support
- Batch size: 100 records
- Duration: ~20 seconds
- Script location: `/opt/ai-admin/migrate-now.js`
- **New module installed:** `pg@8.x` (was missing, installed during migration)

### ✅ Phase 0.4: Verification (COMPLETE)
```
Supabase (source):  1 auth + 728 keys
Timeweb (target):   1 auth + 728 keys
Status: ✅ PERFECT MATCH
```

### ✅ Phase 0.5: Database Switchover (COMPLETE - 10-15 min downtime)
**Timestamp:** 2025-11-06 16:56:38 Moscow Time

**Actions Performed:**
1. All 7 PM2 services stopped
2. `.env` backup created: `.env.backup.before-timeweb-20251106_165638`
3. `.env` updated with:
   - `USE_LEGACY_SUPABASE=false` (switched from Supabase)
   - `POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net` (external SSL endpoint)
   - `POSTGRES_PORT=5432`
   - `POSTGRES_DATABASE=default_db`
   - `POSTGRES_USER=gen_user`
   - `POSTGRES_PASSWORD=}X|oM595A<7n?0`
   - `PGSSLROOTCERT=/root/.cloud-certs/root.crt`
4. All services restarted successfully

**Downtime:** Approximately 10-15 minutes

### ✅ Phase 0.6: Post-Switchover Verification (COMPLETE)

**All Services Status (as of 16:57:00):**
- ✅ ai-admin-api: **online** (uptime: 56s)
- ✅ ai-admin-worker-v2: **online** (uptime: 56s)
- ✅ baileys-whatsapp-service: **online** (uptime: 56s)
- ✅ whatsapp-backup-service: **online** (uptime: 56s)
- ✅ ai-admin-batch-processor: **online** (uptime: 56s)
- ✅ ai-admin-booking-monitor: **online** (uptime: 56s)
- ✅ ai-admin-telegram-bot: **online** (uptime: 56s)

**Health Checks Passed:**
- ✅ WhatsApp connected: company 962302 (79936363848)
- ✅ Database auth state: "🗄️ Using database auth state for company 962302"
- ✅ Baileys keys loaded: 728 keys from Timeweb
- ✅ Expired keys: 0
- ✅ Redis: All roles connected
- ✅ Test message sent successfully via MCP
- ✅ Worker processing queue: "company-962302-messages"
- ✅ Automatic cleanup service: Active (runs every 6 hours)

**No Errors After Switchover:** All errors in logs are from BEFORE 16:56:38 (pre-switchover)

---

## 🎯 CURRENT STATE (Post-Phase 0)

**Database:** ✅ **Timeweb PostgreSQL** (a84c973324fdaccfc68d929d.twc1.net)
**Baileys Data:** 1 company, 728 keys (all in Timeweb)
**WhatsApp:** ✅ Connected and responding
**Services:** ✅ All 7 services online and healthy
**Supabase:** Still available (for rollback if needed)

---

## 📋 NEXT STEPS

### Immediate (Next 24 Hours)
1. Monitor PM2 status every 2-4 hours
2. Check logs for database connection errors
3. Test WhatsApp message sending/receiving
4. Verify booking creation works
5. Monitor Sentry for new errors

### Days 1-7 (Stability Period)
- **Daily checks:** PM2 status, error logs, database performance
- **Track metrics:** Response times, error rates, uptime %
- **Test features:** Bookings, reminders, message processing
- **Goal:** 7 days continuous operation without critical issues

### After 7 Days Stability
- **Decision point:** Phase 0 success confirmed
- **Next:** Ready for Phase 1 (Server Migration Moscow → St. Petersburg)

---

## 🚨 ROLLBACK PROCEDURE (If Needed)

**Emergency Rollback to Supabase (<5 minutes):**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
pm2 stop all
cp .env.backup.before-timeweb-20251106_165638 .env
sed -i 's/USE_LEGACY_SUPABASE=false/USE_LEGACY_SUPABASE=true/' .env
pm2 start all
pm2 logs --lines 50
```

**Rollback Risk:** Zero data loss (Supabase still has all data, unchanged)

---

## 🔍 CRITICAL DISCOVERIES & DECISIONS

### Discovery 1: Private Network Not Accessible
**Issue:** Moscow VPS (46.149.70.219) cannot reach PostgreSQL internal IP (192.168.0.4)
**Reason:** VPS in Moscow datacenter, PostgreSQL in St. Petersburg datacenter
**Solution:** Using external SSL endpoint (a84c973324fdaccfc68d929d.twc1.net)
**Impact:** Latency still ~20-50ms until server migration (Phase 1-6)
**Future:** After Phase 1-6, server will be in SPb → can use internal network

### Discovery 2: Index Size Limit Hit
**Error:** "index row requires 112440 bytes, maximum size is 8191"
**Cause:** Index `idx_whatsapp_keys_company_type_id` included large JSONB `value` column
**Fix:** Dropped problematic index
**Impact:** Slightly slower queries on whatsapp_keys (acceptable)
**Location:** Line in migration script where error occurred

### Discovery 3: Data Growth
**Expected:** 335 keys
**Actual:** 728 keys (2.17x more)
**Reason:** Baileys added more keys since last check
**Impact:** None (migration handled it fine)

### Discovery 4: Missing Node Module
**Issue:** `pg` module not installed on VPS
**Fix:** `npm install pg --save` (added 13 packages)
**Impact:** Migration script required this to connect to PostgreSQL

---

## 📂 MODIFIED FILES THIS SESSION

### Scripts Created/Modified:
1. `scripts/migrate-supabase-to-timeweb.js` - Created migration script with SSL
2. `scripts/setup-timeweb-tunnel.sh` - Updated with credentials
3. `scripts/test-timeweb-connection.sh` - Updated with credentials
4. `scripts/apply-schema-timeweb.sh` - Updated with credentials
5. `/opt/ai-admin/migrate-now.js` - Temporary migration script (on VPS)
6. `/opt/ai-admin/check-supabase.js` - Temporary verification script (on VPS)

### Configuration Files:
7. `/opt/ai-admin/.env` - **CRITICAL CHANGE:**
   - Added: `USE_LEGACY_SUPABASE=false`
   - Added: `POSTGRES_HOST=a84c973324fdaccfc68d929d.twc1.net`
   - Added: `PGSSLROOTCERT=/root/.cloud-certs/root.crt`
   - Backup: `.env.backup.before-timeweb-20251106_165638`

### Database Changes:
8. Timeweb PostgreSQL:
   - Created tables: `whatsapp_auth`, `whatsapp_keys`
   - Dropped index: `idx_whatsapp_keys_company_type_id`
   - Loaded data: 1 auth + 728 keys

### System Files:
9. `/root/.cloud-certs/root.crt` - SSL certificate for Timeweb PostgreSQL

---

## ⚙️ TECHNICAL DETAILS

### Connection Details:
```bash
# External SSL Endpoint (current)
Host: a84c973324fdaccfc68d929d.twc1.net
Port: 5432
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0
SSL: Required (verify-full)
SSL Cert: /root/.cloud-certs/root.crt

# Connection String
postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full

# Environment Variables
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
```

### Table Structures:
```sql
-- whatsapp_auth (1 record)
company_id | creds (JSONB) | created_at | updated_at

-- whatsapp_keys (728 records)
company_id | key_type | key_id | value (JSONB) | created_at | updated_at | expires_at
PRIMARY KEY (company_id, key_type, key_id)
```

### Monitoring Commands:
```bash
# Check services
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"

# Check logs
pm2 logs --lines 100 --nostream

# Check database
export PGSSLROOTCERT=/root/.cloud-certs/root.crt
psql 'postgresql://gen_user:PASSWORD@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full' -c "SELECT COUNT(*) FROM whatsapp_keys;"

# Check WhatsApp connection
pm2 logs baileys-whatsapp-service --lines 50
```

---

## 🎓 LESSONS LEARNED

1. **Always check datacenter locations** - Internal networks don't span datacenters
2. **Index JSONB carefully** - Large JSONB values can exceed index size limits
3. **Verify modules before execution** - `pg` module was missing, caught during migration
4. **Data can grow** - 335 keys became 728 (always expect more)
5. **SSL certificates required** - Timeweb PostgreSQL enforces SSL verification
6. **Test before downtime** - All prep work (0.1-0.4) done without affecting production

---

## 📞 CONTACTS & RESOURCES

**VPS SSH:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
```

**Timeweb Control Panel:** (user has access)
**SSL Cert Source:** https://st.timeweb.com/cloud-static/ca.crt

**Test Phone:** 89686484488 (for testing - use ONLY this number!)

---

**Implementation Scripts:** Ready for Execution
**Next Phase:** Phase 0 execution following `PHASE_0_QUICK_START.md`

---

## 🏆 SUCCESS METRICS

**Achieved:**
- ✅ Zero data loss
- ✅ All 728 keys migrated
- ✅ <15 min downtime
- ✅ All services online
- ✅ WhatsApp reconnected
- ✅ Database working
- ✅ Rollback available

**Phase 0 Status:** **✅ COMPLETE AND SUCCESSFUL**

---

## Quick Reference

**Migration Strategy**: Two-Stage Approach
1. **Stage 1 (Phase 0)**: Database Migration (Supabase → Timeweb PostgreSQL) - FIRST
2. **Stage 2 (Phases 1-6)**: Server Migration (Moscow → St. Petersburg) - SECOND

**Current State**:
- **Server**: 46.149.70.219 (Timeweb Moscow)
- **Database**: Supabase PostgreSQL (cloud) - contains Baileys sessions
- **Timeweb PostgreSQL**: 192.168.0.4:5432 (St. Petersburg, waiting for data)

**Target State After Stage 1** (Day 0):
- **Server**: Still in Moscow (no change yet)
- **Database**: Timeweb PostgreSQL 192.168.0.4 (via tunnel from Moscow)
- **Baileys**: Migrated to Timeweb PostgreSQL

**Target State After Stage 2** (Day 17):
- **Server**: NEW VPS in Timeweb St. Petersburg
- **Database**: Timeweb PostgreSQL 192.168.0.4 (internal network <1ms)
- **Network**: "Cute Crossbill" private network

**Timeline**:
- **Stage 1**: Day -7 to Day 7 (~14 days, 15 min downtime)
- **Stage 2**: Day 7 to Day 17 (~10 days, 2-4 hr downtime)
- **Total**: ~24 days from start to completion

---

## Current Infrastructure State

### Production Server (Old)
```
IP: 46.149.70.219
Location: Timeweb Moscow datacenter
Provider: Timeweb
OS: Ubuntu 22.04 LTS
Specs: 8 vCPU, 16GB RAM, 160GB storage
Path: /opt/ai-admin
SSH Key: ~/.ssh/id_ed25519_ai_admin
Current Network: NOT on "Cute Crossbill" private network
```

### Database (Managed PostgreSQL)
```
Provider: Timeweb Managed PostgreSQL
Location: St. Petersburg (ALREADY THERE)
Internal IP: 192.168.0.4:5432
Private Network: "Cute Crossbill"
Database: default_db
User: gen_user
Password: }X|oM595A<7n?0
Connection String: postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db

Current Access Method: SSH tunnel (suboptimal)
Target Access Method: Direct internal network
```

### PM2 Services (8 Total)

| ID | Service Name | Purpose | Critical Level |
|----|--------------|---------|----------------|
| 0 | ai-admin-api | Express API server (Port 3000) | HIGH |
| 1 | ai-admin-worker-v2 | Message processing (Gemini AI) | CRITICAL |
| 2 | ai-admin-batch-processor | Batch operations | MEDIUM |
| 3 | whatsapp-backup-service | Automated backups (6h intervals) | HIGH |
| 4 | whatsapp-safe-monitor | Health monitoring | MEDIUM |
| 5 | ai-admin-booking-monitor | Appointment reminders | HIGH |
| 6 | ai-admin-telegram-bot | Admin notifications | MEDIUM |
| 7 | baileys-whatsapp-service | WhatsApp connection | CRITICAL |

### Critical Data Locations

**Environment Configuration** (MOST CRITICAL!)
```
Path: /opt/ai-admin/.env
Contains: All API keys, secrets, credentials
Size: ~2-3KB
Critical Variables:
- SUPABASE_URL, SUPABASE_KEY (for Baileys sessions)
- POSTGRES_HOST, POSTGRES_PASSWORD (for Timeweb PostgreSQL)
- GEMINI_API_KEY, YCLIENTS_BEARER_TOKEN
- JWT_SECRET, MASTER_KEY
Risk: Loss = Service cannot start
```

**Xray VPN Configuration** (Required for Gemini API)
```
Path: /usr/local/etc/xray/config.json
Purpose: Bypass Google Gemini geo-blocking
Server: USA (us.cdn.stun.su)
Proxy: SOCKS5 on localhost:1080
```

**Baileys WhatsApp Sessions** - ✅ Already in Cloud (NO TRANSFER NEEDED)
```
Storage: Supabase PostgreSQL
Tables: whatsapp_auth (credentials), whatsapp_keys (Signal Protocol keys)
Status: USE_DATABASE_AUTH_STATE=true (migrated 2025-10-07)
Data: 335 keys migrated and verified
Benefit: New server connects to same database = instant session access
Risk: VERY LOW - centralized, not tied to specific server
```

### External Integrations

1. **YClients API**
   - Purpose: Salon management system integration
   - Auth: Bearer token + User token
   - No changes required during migration

2. **Google Gemini API**
   - Purpose: AI message processing
   - Access: Via Xray VPN (SOCKS5 proxy)
   - Provider: Gemini 2.5 Flash
   - Requires: VPN setup on new server

3. **Telegram Bot**
   - Purpose: Admin notifications and monitoring
   - Token: From .env file
   - No changes required

4. **WhatsApp (Baileys)**
   - Phone: 79936363848
   - Sessions: Must be transferred
   - Critical: creds.json integrity

---

## Key Files and Directories

### Must Transfer (Critical)
```
/opt/ai-admin/.env                      # Environment variables (CRITICAL!)
/usr/local/etc/xray/config.json         # VPN config (HIGH)
```

### Will Clone Fresh
```
/opt/ai-admin/                          # Application code (from git)
/opt/ai-admin/src/                      # Source code
/opt/ai-admin/node_modules/             # Dependencies (npm install)
/opt/ai-admin/ecosystem.config.js       # PM2 config (in git)
```

### Already in Cloud (No Transfer)
```
Baileys sessions                        # Supabase PostgreSQL (whatsapp_auth, whatsapp_keys)
```

### Can Regenerate
```
/opt/ai-admin/logs/                     # Application logs
Redis data                              # Ephemeral, TTL-based
Context cache                           # Regenerates on use
BullMQ jobs                             # Can re-enqueue
```

---

## Migration Decisions

### Chosen Approach: Fresh Setup + Data Transfer
**Rationale:**
- ✅ Clean environment (no legacy issues)
- ✅ Latest packages and dependencies
- ✅ Easy rollback (old server stays running)
- ✅ Lower risk than full server migration
- ✅ Opportunity to validate everything from scratch

**Rejected: Full Server Migration (rsync)**
- ❌ Risk of transferring legacy issues
- ❌ Dependency version conflicts
- ❌ Network configuration mismatches
- ❌ Harder to troubleshoot
- ❌ No clean testing environment

### Downtime Tolerance: 2-4 hours
**Rationale:**
- Client notification 24 hours in advance
- Maintenance window: 02:00-06:00 (low traffic)
- Buffer for unexpected issues
- Acceptable business impact

**Rejected: Zero-downtime migration**
- Complex (requires load balancer, DNS switching)
- Higher risk of dual-write conflicts
- Not justified for client base size

### Old Server Retention: 7-30 days
**Rationale:**
- Immediate rollback capability
- Confidence building period
- Safety net for unforeseen issues
- Cost acceptable for peace of mind

**Decommission after:**
- 7 days stable operation (minimum)
- All metrics within acceptable ranges
- Team consensus to proceed
- 30 days absolute maximum

---

## Technical Constraints

### Network Requirements (CRITICAL!)

**New VPS MUST:**
1. Be in **St. Petersburg datacenter** (same as PostgreSQL)
2. Be added to **"Cute Crossbill" private network**
3. Have direct access to **192.168.0.4:5432**

**Verification:**
```bash
# First thing after VPS creation:
ip addr show                              # Check private network interface
ping 192.168.0.4                          # Must succeed
telnet 192.168.0.4 5432                   # Must connect
psql "postgresql://..." -c "SELECT NOW();" # Must query
```

**If network verification fails → STOP migration immediately**

### Software Versions (Must Match)

```
Node.js: 20.x LTS (critical)
PM2: 5.x (latest)
Redis: Latest stable
PostgreSQL Client: 14+ (for psql commands)
Xray: Latest release
OS: Ubuntu 22.04 LTS (same as old)
```

### Environment Changes Required

**MUST UPDATE in .env:**
```bash
# Database connection
POSTGRES_HOST=192.168.0.4  # No change, but verify works via internal network

# Redis
REDIS_PASSWORD=<NEW_PASSWORD>  # Generate new password for new Redis instance

# API URLs
AI_ADMIN_API_URL=http://<NEW_VPS_IP>:3000
WEBHOOK_URL=http://<NEW_VPS_IP>:3000/webhook/whatsapp/batched
```

**NO CHANGES NEEDED:**
```bash
# All API keys, tokens, secrets remain the same:
GEMINI_API_KEY
YCLIENTS_BEARER_TOKEN
YCLIENTS_USER_TOKEN
TELEGRAM_BOT_TOKEN
JWT_SECRET
MASTER_KEY
WHATSAPP_PHONE
```

---

## Risk Register

### Critical Risks - Stage 1 (Phase 0: Database Migration)

0. **Database Migration Failure (Baileys)** - 🆕 NEW RISK
   - Impact: CRITICAL - WhatsApp disconnection
   - Probability: 20-25%
   - Phase: Phase 0 (Database Migration)
   - Mitigation: Test migration, 7-day stability period, fast rollback to Supabase
   - Status: Active during Stage 1

### Critical Risks - Stage 2 (Server Migration)

1. **Database Connection Failure**
   - Impact: Application non-functional
   - Probability: 20-25%
   - Phase: Phase 2.1
   - Mitigation: Early verification, STOP if fails
   - Status: Checkpoint established

2. **Internal Network Misconfiguration**
   - Impact: Cannot access PostgreSQL
   - Probability: 30-35%
   - Phase: Phase 1.3 & 2.1
   - Mitigation: Verify "Cute Crossbill" attachment, test BEFORE any other work
   - Status: Checkpoints established

### Low Risks

3. **WhatsApp Session Loss (Server Migration)** - ✅ **SIGNIFICANTLY REDUCED**
   - Impact: LOW (was CRITICAL)
   - Probability: <5%
   - **Why reduced**: After Phase 0 success, Baileys sessions in Timeweb PostgreSQL
   - Benefit: No file transfer during server migration = no corruption risk
   - Mitigation: Verify Timeweb PostgreSQL access from new server
   - Status: Low priority after Stage 1 complete

### High Risks (May require rollback)

4. **Gemini API VPN Failure**
   - Impact: AI responses fail
   - Probability: 10-15%
   - Mitigation: Test VPN immediately, fallback to DeepSeek
   - Status: Mitigated + Fallback

5. **Extended Downtime**
   - Impact: Client dissatisfaction
   - Probability: 25-30%
   - Mitigation: Parallel preparation, fast rollback (<5 min), clear Go/No-Go
   - Status: Mitigated

### Accepted Risks (By design)

6. **Redis Data Loss**
   - Impact: Temporary context loss
   - Probability: 60-70%
   - Mitigation: Accepted - data regenerates, ephemeral by design
   - Status: Accepted

---

## Success Criteria

### Phase Success Criteria

**Phase 1: Preparation**
- ✅ All backups created and verified
- ✅ New VPS created with "Cute Crossbill" network
- ✅ Configuration documented

**Phase 2: New Server Setup**
- ✅ PostgreSQL accessible via internal network (<1ms latency)
- ✅ All software installed (Node.js, PM2, Redis, Xray)
- ✅ Xray VPN working (USA location confirmed)

**Phase 3: Application Deployment**
- ✅ Repository cloned
- ✅ Baileys sessions transferred and verified (creds.json intact)
- ✅ .env configured correctly
- ✅ Dependencies installed

**Phase 4: Testing**
- ✅ All 8 PM2 services online
- ✅ WhatsApp connected
- ✅ Database queries <1ms
- ✅ Functional tests passed
- ✅ 48 hours parallel run successful

**Phase 5: Migration**
- ✅ Migration completed within 2-4 hour window
- ✅ All smoke tests passed
- ✅ Zero data loss
- ✅ Services operational

**Phase 6: Post-Migration**
- ✅ 7 days stable operation
- ✅ All metrics within acceptable ranges
- ✅ Old server decommissioned

### Overall Success Definition

**PRIMARY (Must achieve):**
- Database performance: <1ms latency (20-50x improvement)
- Zero data loss (Baileys sessions intact)
- Uptime: >99.9% (7 days post-migration)
- Message success rate: >98%
- Downtime: <4 hours

**SECONDARY (Should achieve):**
- AI response time: 9-15s (consistent)
- Service stability: <3 restarts/day
- Resource usage: <75% memory
- No rollback events

---

## Known Issues and Workarounds

### Issue 1: Baileys File Count Growth
**Description**: WhatsApp session files can accumulate over time (>300 files = risk)
**Current Status**: ~162 files (healthy)
**Monitoring**: whatsapp-safe-monitor service tracks file count
**Thresholds**:
- ✅ <200 files: OK
- ⚠️ 200-250: WARNING (alert 1/hour)
- 🔴 250-300: CRITICAL (alert 1/30min)
- 🚨 >300: EMERGENCY (alert 1/15min)
**Mitigation**: Automated backup service runs every 6 hours, can cleanup if needed

### Issue 2: PostgreSQL Connection via SSH Tunnel (Current)
**Description**: Current database access uses SSH tunnel, adding latency
**Impact**: 20-50ms latency vs <1ms direct
**Resolution**: Migration to internal network will resolve this
**Temporary**: Works but suboptimal

### Issue 3: Gemini API Geo-Blocking
**Description**: Google Gemini blocks Russian IPs
**Current Solution**: Xray VPN to USA server (us.cdn.stun.su)
**Status**: Working, 108ms latency
**Fallback**: DeepSeek API (no VPN, slower: 24s vs 9s)
**Migration Note**: Must configure Xray on new server

### Issue 4: Redis Context TTL
**Description**: Conversation contexts expire after TTL
**Impact**: Clients may need to restart conversations
**Status**: By design, ephemeral data
**Migration Note**: Expect contexts to be lost during migration (acceptable)

---

## Communication Plan

### Before Migration (24 hours advance)

**To Clients (via WhatsApp/Telegram):**
```
🔧 Уважаемые клиенты!

[ДАТА] с 02:00 до 06:00 (2-4 часа)
WhatsApp бот будет недоступен из-за технического обслуживания.

Проводится улучшение инфраструктуры для повышения скорости и надежности сервиса.

Приносим извинения за временные неудобства.
После обслуживания бот будет работать еще быстрее!

С уважением,
Команда AI Admin
```

**To Team (internal):**
```
📋 Migration Scheduled

Date: [DATE]
Window: 02:00-06:00 (4 hours)
Expected Downtime: 2-3 hours

On-Call: [DevOps Engineer] + [Backend Developer]

Pre-Migration Checklist: dev/active/datacenter-migration-msk-spb/
Status Updates: Every 30 minutes during migration window

Rollback Plan: <5 minutes if needed
```

### During Migration

**Status Updates (Every 30 minutes):**
- PM2 service status
- Error logs summary
- Current phase progress
- ETA for completion

**Communication Channels:**
- Telegram admin group
- Status page (if available)
- Team chat

### After Migration

**To Clients:**
```
✅ Техническое обслуживание завершено!

WhatsApp бот снова доступен и работает еще быстрее благодаря обновленной инфраструктуре.

Теперь бот отвечает быстрее и стабильнее.
Спасибо за терпение!

С уважением,
Команда AI Admin
```

**To Team:**
```
🎉 MIGRATION SUCCESS!

AI Admin v2 successfully migrated to St. Petersburg datacenter.

Key Improvements:
✅ Database latency: <1ms (20-50x faster)
✅ Internal network connectivity
✅ All services operational

Total Downtime: [X hours Y minutes]
Status: OPERATIONAL

Next: 7-day monitoring period
```

---

## Rollback Procedure

### When to Rollback

**Immediate Rollback If:**
- WhatsApp session not connecting after 30 minutes
- Database connection failures
- Critical errors in >50% of messages
- Any PRIMARY success criteria not met

**Consider Rollback If:**
- Multiple services crashing repeatedly
- Performance degraded vs old server
- Unresolved errors after 2 hours

### Rollback Steps (<5 minutes)

```bash
# 1. Stop new server
ssh root@<NEW_VPS_IP> "pm2 stop all"

# 2. Start old server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 start all"

# 3. Verify old server operational
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
curl http://46.149.70.219:3000/health

# 4. Send test message
# Test Number: 89686484488
# Message: "Rollback test"
# Expected: Bot responds normally

# 5. Notify team
# "Rollback executed. Old server operational. New server will be debugged offline."
```

**Post-Rollback:**
- New server can be debugged without pressure
- Identify root cause
- Fix issues
- Retry migration when ready

---

## Next Steps After Context Review

1. **Review and confirm**:
   - All prerequisites met
   - Resources available
   - Timeline acceptable

2. **Begin Phase 1: Preparation**:
   - Create backups
   - Document configuration
   - Create new VPS

3. **Track progress**:
   - Use tasks checklist (datacenter-migration-msk-spb-tasks.md)
   - Update context with decisions and issues
   - Keep plan as reference

4. **Regular updates**:
   - Update this context file with actual IP addresses
   - Document any deviations from plan
   - Note lessons learned

---

**Last Updated**: 2025-11-05
**Current Phase**: Planning Complete
**Next Phase**: Phase 1 (Preparation)
**Status**: READY TO EXECUTE

