# Datacenter Migration Context
**Last Updated: 2025-11-06**

---

## 🎯 Phase 0 Implementation Status

**Status:** ✅ **Implementation Complete - Ready for Execution**
**Date Completed:** 2025-11-06
**Developer:** Claude Code

### What Was Completed

**Scripts Created:**
- ✅ `scripts/migrate-supabase-to-timeweb.js` - Main data migration script
  - Migrates whatsapp_auth (1 record)
  - Migrates whatsapp_keys (335 records)
  - Supports dry-run and verify-only modes
  - Batch processing, progress tracking, error handling
- ✅ `scripts/setup-timeweb-tunnel.sh` - SSH tunnel manager
  - Start/stop/status/restart commands
  - PID management, connection testing

**Documentation Created:**
- ✅ `PHASE_0_QUICK_START.md` - Comprehensive execution guide (all 6 sub-phases)
- ✅ `dev/active/datacenter-migration-msk-spb/PHASE_0_README.md` - Implementation summary

**Next Step:** Execute Phase 0 following `PHASE_0_QUICK_START.md`

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

