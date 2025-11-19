# Emergency Recovery Runbook

**Version:** 1.0
**Last Updated:** November 19, 2025
**Owner:** DevOps Team
**Severity:** CRITICAL

---

## Table of Contents

- [Overview](#overview)
- [Emergency Contacts](#emergency-contacts)
- [Decision Tree](#decision-tree)
- [Required Access & Credentials](#required-access--credentials)
- [Scenario 1: PostgreSQL Unreachable](#scenario-1-postgresql-unreachable)
- [Scenario 2: Corrupted Session Data](#scenario-2-corrupted-session-data)
- [Scenario 3: Accidental Data Deletion](#scenario-3-accidental-data-deletion)
- [Scenario 4: Complete Database Loss](#scenario-4-complete-database-loss)
- [Post-Recovery Tasks](#post-recovery-tasks)
- [Testing & Validation](#testing--validation)

---

## Overview

This runbook provides step-by-step procedures for recovering WhatsApp sessions during PostgreSQL failures or data corruption incidents.

**When to Use:**
- PostgreSQL becomes unreachable (connection errors, timeouts)
- Session data is corrupted or invalid
- Accidental deletion of critical session data
- Complete database failure or datacenter loss

**RTO (Recovery Time Objective):** <10 minutes
**RPO (Recovery Point Objective):** <1 hour

**Emergency Tag:** `emergency-file-fallback-v1` (git tag pointing to last file-based code)

---

## Emergency Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| **Primary On-Call** | @vosarsen | Telegram: @vosarsen | 24/7 |
| **Backup On-Call** | Support Team | Email: support@adminai.tech | 24/7 |
| **DevOps Lead** | @vosarsen | Telegram: @vosarsen | Business hours |
| **Database Admin** | @vosarsen | Telegram: @vosarsen, Email: support@adminai.tech | Business hours |

**Escalation Path:**
1. Primary On-Call (0-5 min)
2. Backup On-Call (5-15 min)
3. DevOps Lead (15-30 min)
4. Management (30+ min)

---

## Decision Tree

```
┌─────────────────────────────────────┐
│  WhatsApp Service Failure Detected  │
└──────────────┬──────────────────────┘
               │
               ├─ Can connect to PostgreSQL?
               │  │
               │  ├─ YES → Scenario 2 (Corrupted Data)
               │  │
               │  └─ NO  → Check network/DNS/firewall
               │           │
               │           ├─ Network OK → Scenario 1 (PostgreSQL Unreachable)
               │           │
               │           └─ Network DOWN → Fix network first
               │
               ├─ Session data missing?
               │  │
               │  ├─ Partial → Scenario 3 (Accidental Deletion)
               │  │
               │  └─ Complete → Scenario 4 (Complete Loss)
               │
               └─ Data exists but invalid?
                  │
                  └─ Scenario 2 (Corrupted Data)
```

**Quick Decision Helper:**

| Symptom | Likely Scenario | Recommended Action |
|---------|----------------|-------------------|
| `connection refused` | Scenario 1 | Emergency file restore |
| `SSL certificate error` | Scenario 1 | Check SSL config, then file restore |
| `no rows returned` | Scenario 3 | Restore from backup |
| `JSON parse error` | Scenario 2 | Validate data, restore from backup |
| `entire database gone` | Scenario 4 | Full disaster recovery |
| `connection timeout` | Scenario 1 | Check network, then file restore |

---

## Required Access & Credentials

**Before Starting Emergency Recovery:**

Ensure you have access to:

### 1. Server Access
```bash
# SSH to production server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Server path
cd /opt/ai-admin
```

### 2. PostgreSQL Access
```bash
# Connection String (from .env)
DATABASE_URL="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full"

# SSL Certificate
/root/.cloud-certs/root.crt
```

### 3. PM2 Process Manager
```bash
# Check services
pm2 status

# Restart service
pm2 restart baileys-whatsapp-service

# View logs
pm2 logs baileys-whatsapp-service --lines 50
```

### 4. Git Repository
```bash
# Emergency rollback tag
git tag -l emergency-file-fallback-v1

# Verify tag exists
git log emergency-file-fallback-v1 -1
```

### 5. Environment Variables
```bash
# .env file location
/opt/ai-admin/.env

# Critical variables
USE_REPOSITORY_PATTERN=true  # PostgreSQL mode
USE_REPOSITORY_PATTERN=false # File-based mode
```

---

## Scenario 1: PostgreSQL Unreachable

**Symptoms:**
- WhatsApp service logs show: `connection refused`, `ECONNREFUSED`, `timeout`
- PM2 status: service running but WhatsApp not connected
- PostgreSQL health check fails: `psql: could not connect to server`

**Impact:**
- WhatsApp disconnected from all companies
- No new messages received
- No messages can be sent
- Existing connections lost

**Estimated Downtime:** 5-10 minutes (with emergency restore)

---

### Detection

**Automated Alerts:**
- Sentry: `Database connection failed`
- Telegram: `PostgreSQL unreachable`
- PM2: Service restart loop

**Manual Verification:**
```bash
# 1. SSH to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 2. Check Baileys service logs
pm2 logs baileys-whatsapp-service --lines 20 --err

# Look for:
# - "connection refused"
# - "ECONNREFUSED"
# - "timeout"

# 3. Test PostgreSQL connection
psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=verify-full -c "SELECT 1"

# Expected: "could not connect" or timeout
```

---

### Impact Assessment

**Severity:** CRITICAL

**Affected Services:**
- ✅ Baileys WhatsApp Service (running but disconnected)
- ✅ AI Admin Worker v2 (degraded, can't send messages)
- ✅ AI Admin API (read-only mode)

**User Impact:**
- ❌ No new WhatsApp messages processed
- ❌ No automated booking confirmations sent
- ❌ No reminders delivered

**Data Loss Risk:**
- ✅ LOW if restore completed within 5 minutes
- ⚠️  MEDIUM if restore takes >30 minutes (missed messages)

---

### Step-by-Step Recovery

**⏱️ Expected Time:** 5-10 minutes
**👤 Required Role:** DevOps Engineer

#### Step 1: Verify Emergency (1 minute)

```bash
# 1. Confirm PostgreSQL is actually unreachable
psql $DATABASE_URL -c "SELECT 1"

# Expected output:
# psql: error: connection to server failed

# 2. Check network connectivity
ping a84c973324fdaccfc68d929d.twc1.net

# If ping fails, it's a network issue (not database)
# → Fix network first, then retest

# 3. Check if issue is temporary
# Wait 30 seconds, retry connection
sleep 30
psql $DATABASE_URL -c "SELECT 1"

# If connection succeeds now → No action needed
# If still fails → Proceed with emergency restore
```

#### Step 2: Execute Emergency Restore (5 minutes)

```bash
# Navigate to project directory
cd /opt/ai-admin

# Run emergency restore script (DRY RUN first)
node scripts/emergency/restore-file-sessions.js --dry-run

# Review output:
# ✓ PostgreSQL export (will fail, that's OK)
# ✓ Git checkout emergency-file-fallback-v1
# ✓ Update .env: USE_REPOSITORY_PATTERN=false
# ✓ Restart PM2 service

# If dry-run looks good, execute for real
node scripts/emergency/restore-file-sessions.js

# Confirm when prompted:
# "Proceed with emergency restore? (yes/no): yes"

# Script will:
# 1. Skip PostgreSQL export (unavailable)
# 2. Checkout emergency git tag
# 3. Update .env
# 4. Restart service
# 5. Verify connection

# Expected output:
# ✓ EMERGENCY RESTORE SUCCESSFUL
# ✓ Total time: <10 minutes
```

#### Step 3: Monitor Service Recovery (2 minutes)

```bash
# 1. Watch PM2 logs for successful connection
pm2 logs baileys-whatsapp-service --lines 50 | grep -i "connection"

# Expected logs:
# connection.update { connection: 'open' }
# ✓ Connected to WhatsApp

# 2. Verify WhatsApp is online
pm2 logs baileys-whatsapp-service --lines 10 | grep -i "online"

# 3. Check service status
pm2 status

# Expected:
# baileys-whatsapp-service │ online │ 0 │ 96 MB
```

#### Step 4: Test Message Flow (2 minutes)

```bash
# Send test message via API
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "89686484488",
    "message": "Emergency restore test - WhatsApp connection verified"
  }'

# Expected response:
# { "success": true, "messageId": "..." }

# Verify message received on test phone: 89686484488
```

---

### Verification Procedures

**Success Criteria:**
- [x] PM2 service status: `online`
- [x] WhatsApp connection status: `connection.update { connection: 'open' }`
- [x] Test message sent and received successfully
- [x] No error logs in last 5 minutes
- [x] RTO <10 minutes achieved

**Verification Checklist:**
```bash
# ✓ Service online
pm2 status | grep baileys-whatsapp-service | grep online

# ✓ No errors in last 5 minutes
pm2 logs baileys-whatsapp-service --lines 100 --err --nostream | grep -i error | tail -20

# ✓ WhatsApp connected
pm2 logs baileys-whatsapp-service --lines 50 | grep "connection.update"

# ✓ File-based mode active
cat .env | grep USE_REPOSITORY_PATTERN
# Expected: USE_REPOSITORY_PATTERN=false

# ✓ Git tag checked out
git log -1 --oneline
# Expected: <commit> from emergency-file-fallback-v1
```

---

### Post-Recovery Tasks

**Immediate (within 1 hour):**
1. **Notify stakeholders** - Send status update:
   - Incident detected: [timestamp]
   - Recovery completed: [timestamp]
   - Total downtime: [X] minutes
   - Root cause: PostgreSQL unreachable
   - Current status: File-based fallback mode

2. **Document incident** - Create post-mortem:
   - Timeline of events
   - Actions taken
   - What worked well
   - What needs improvement

3. **Monitor stability** - Watch for 1 hour:
   - Check logs every 10 minutes
   - Verify message flow continues
   - No new errors

**Within 24 hours:**
1. **Investigate PostgreSQL failure**
   - Contact database provider (Timeweb)
   - Review database logs
   - Identify root cause

2. **Plan return to PostgreSQL**
   - Once PostgreSQL is stable
   - Follow rollback procedure below

3. **Update on-call documentation**
   - Add lessons learned
   - Update contact information
   - Improve runbook if needed

---

### Rollback to PostgreSQL

**When PostgreSQL is restored and stable:**

```bash
# 1. Export current file-based session data to PostgreSQL
node scripts/migration/export-files-to-postgres.js

# Expected output:
# ✓ Exported 1 auth record
# ✓ Exported 1,313 session keys

# 2. Checkout main branch
git checkout main

# 3. Update .env to use PostgreSQL
sed -i 's/USE_REPOSITORY_PATTERN=false/USE_REPOSITORY_PATTERN=true/' .env

# 4. Restart service
pm2 restart baileys-whatsapp-service

# 5. Verify PostgreSQL connection
pm2 logs baileys-whatsapp-service --lines 50 | grep -i "database"

# Expected:
# ✓ Using Timeweb PostgreSQL auth state
# ✓ Database connection successful

# 6. Test message flow
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "89686484488", "message": "Back to PostgreSQL mode"}'

# 7. Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_keys"

# Expected: 1313+ rows
```

---

## Scenario 2: Corrupted Session Data

**Symptoms:**
- WhatsApp logs show: `JSON parse error`, `invalid credentials`, `decrypt failed`
- Session connects but immediately disconnects
- PM2 service running but WhatsApp repeatedly reconnecting

**Impact:**
- WhatsApp authentication failing
- Connection unstable (connect → disconnect loop)
- Messages may not be delivered

**Estimated Downtime:** 10-15 minutes (with backup restore)

---

### Detection

```bash
# 1. Check for JSON/decryption errors
pm2 logs baileys-whatsapp-service --lines 100 --err | grep -i "parse\|decrypt\|invalid"

# Look for:
# - "JSON parse error"
# - "decrypt failed"
# - "invalid credentials"

# 2. Check connection stability
pm2 logs baileys-whatsapp-service --lines 100 | grep "connection.update"

# Symptom: Rapid open → close cycles
# connection.update { connection: 'open' }
# connection.update { connection: 'close' }
# connection.update { connection: 'open' }  # <-- loop

# 3. Verify data in PostgreSQL
psql $DATABASE_URL -c "SELECT company_id, creds::text FROM whatsapp_auth LIMIT 1"

# Check if creds JSON is valid:
# - Should start with { and end with }
# - Should have proper structure
```

---

### Step-by-Step Recovery

**⏱️ Expected Time:** 10-15 minutes

#### Step 1: Identify Corrupted Data (2 minutes)

```bash
# 1. Validate creds JSON structure
psql $DATABASE_URL <<EOF
SELECT
  company_id,
  CASE
    WHEN creds IS NULL THEN 'NULL'
    WHEN creds::text = '{}' THEN 'EMPTY'
    WHEN creds::text LIKE '{%}' THEN 'VALID'
    ELSE 'INVALID'
  END as creds_status
FROM whatsapp_auth;
EOF

# Expected output:
# company_id | creds_status
# -----------+-------------
# 962302     | INVALID     <-- Problem found

# 2. Check session keys
psql $DATABASE_URL <<EOF
SELECT COUNT(*) as total_keys,
       COUNT(CASE WHEN key_data IS NULL THEN 1 END) as null_keys,
       COUNT(CASE WHEN key_data::text = '{}' THEN 1 END) as empty_keys
FROM whatsapp_keys;
EOF
```

#### Step 2: Restore from Backup (8 minutes)

**Option A: Restore from Last Known Good Backup**

```bash
# 1. List available backups
ls -lh /backups/baileys/ | tail -10

# Example output:
# baileys_20251119_0300.sql  (today 3am - CORRUPTED)
# baileys_20251118_0300.sql  (yesterday - GOOD)

# 2. Restore from good backup
psql $DATABASE_URL < /backups/baileys/baileys_20251118_0300.sql

# 3. Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_auth"
# Expected: 1 row

psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_keys"
# Expected: 1313+ rows
```

**Option B: Recreate Session (if no backup available)**

```bash
# WARNING: This will require re-pairing WhatsApp (QR code or phone number)

# 1. Delete corrupted data
psql $DATABASE_URL <<EOF
DELETE FROM whatsapp_keys WHERE company_id = 962302;
DELETE FROM whatsapp_auth WHERE company_id = 962302;
EOF

# 2. Restart Baileys service to trigger re-initialization
pm2 restart baileys-whatsapp-service

# 3. Follow QR code pairing process (see WHATSAPP_PAIRING_GUIDE.md)
# OR use phone number pairing
pm2 logs baileys-whatsapp-service --lines 50

# Look for pairing code in logs
```

#### Step 3: Verify Recovery (2 minutes)

```bash
# 1. Check connection status
pm2 logs baileys-whatsapp-service --lines 50 | grep "connection.update"

# Expected: ONE stable connection
# connection.update { connection: 'open' }

# 2. Test message sending
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "89686484488", "message": "Corruption resolved"}'

# 3. Monitor for 5 minutes - no reconnects
pm2 logs baileys-whatsapp-service --lines 0 --raw | grep "connection.update"

# Should see NO new connection updates (stable)
```

---

## Scenario 3: Accidental Data Deletion

**Symptoms:**
- Session data partially or completely missing from database
- Recent queries show: `0 rows affected`
- WhatsApp fails to connect: `no credentials found`

**Impact:**
- WhatsApp cannot authenticate
- All messages stopped
- Requires re-pairing if no backup

**Estimated Downtime:** 15-30 minutes (depending on backup availability)

---

### Detection

```bash
# 1. Check for missing auth data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_auth WHERE company_id = 962302"

# Expected: 1 row
# Actual: 0 rows <-- PROBLEM

# 2. Check session keys count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_keys WHERE company_id = 962302"

# Expected: 1313+ rows
# Actual: 0-100 rows <-- PARTIAL DELETION

# 3. Review audit logs (if available)
psql $DATABASE_URL -c "SELECT * FROM audit_log WHERE table_name IN ('whatsapp_auth', 'whatsapp_keys') ORDER BY created_at DESC LIMIT 20"

# Look for DELETE operations
```

---

### Step-by-Step Recovery

**⏱️ Expected Time:** 15-30 minutes

#### Step 1: Confirm Deletion Scope (3 minutes)

```bash
# 1. Check all companies (if multi-tenant)
psql $DATABASE_URL -c "SELECT company_id, COUNT(*) as auth_count FROM whatsapp_auth GROUP BY company_id"

# 2. Check when data was last present
psql $DATABASE_URL <<EOF
SELECT
  table_name,
  MAX(updated_at) as last_update
FROM (
  SELECT 'auth' as table_name, updated_at FROM whatsapp_auth
  UNION ALL
  SELECT 'keys' as table_name, updated_at FROM whatsapp_keys
) t
GROUP BY table_name;
EOF

# 3. Estimate data age
# If last_update < 1 hour ago → Recent backup should be good
# If last_update > 24 hours ago → May need older backup
```

#### Step 2: Restore from Point-in-Time Backup (10 minutes)

**Option A: Restore from Hourly WAL Backup (Best)**

```bash
# 1. List available WAL backups
ls -lh /backups/baileys/wal/ | tail -20

# 2. Identify backup closest to deletion time
# Example: Deletion at 14:30, use backup from 14:00

# 3. Create temporary restoration database
psql $DATABASE_URL -c "CREATE DATABASE restore_test"

# 4. Restore base backup + WAL
pg_restore -d restore_test /backups/baileys/daily/baileys_20251119_0300.sql
pg_receivewal -d restore_test --stop-at "2025-11-19 14:25:00" /backups/baileys/wal/

# 5. Extract data from restoration database
pg_dump restore_test \
  --table=whatsapp_auth \
  --table=whatsapp_keys \
  --data-only \
  > /tmp/recovered_data.sql

# 6. Import to production
psql $DATABASE_URL < /tmp/recovered_data.sql

# 7. Cleanup
psql $DATABASE_URL -c "DROP DATABASE restore_test"
rm /tmp/recovered_data.sql
```

**Option B: Restore from Daily Backup (Good)**

```bash
# 1. Find most recent daily backup
ls -lh /backups/baileys/daily/ | tail -5

# 2. Restore directly
psql $DATABASE_URL < /backups/baileys/daily/baileys_20251119_0300.sql

# Note: May lose data between backup (3am) and deletion (e.g., 2pm)
# Data loss: up to 11 hours
```

**Option C: Emergency File Restore (Last Resort)**

```bash
# If PostgreSQL backups unavailable, use file-based fallback

# 1. Check if file-based sessions exist
ls -lh baileys_sessions/company_962302/

# If files exist:
# 2. Switch to file-based mode
node scripts/emergency/restore-file-sessions.js --skip-export

# 3. After WhatsApp reconnects, migrate files back to database
node scripts/migration/export-files-to-postgres.js

# 4. Return to PostgreSQL mode (see Scenario 1 rollback)
```

#### Step 3: Verify Data Integrity (5 minutes)

```bash
# 1. Verify row counts
psql $DATABASE_URL <<EOF
SELECT
  (SELECT COUNT(*) FROM whatsapp_auth WHERE company_id = 962302) as auth_count,
  (SELECT COUNT(*) FROM whatsapp_keys WHERE company_id = 962302) as keys_count;
EOF

# Expected:
# auth_count | keys_count
# -----------+-----------
# 1          | 1313+

# 2. Verify creds structure
psql $DATABASE_URL -c "SELECT creds::text FROM whatsapp_auth WHERE company_id = 962302" | head -5

# Should see valid JSON starting with {"me":...

# 3. Test connection
pm2 restart baileys-whatsapp-service
pm2 logs baileys-whatsapp-service --lines 50 | grep -i "connection"

# Expected: connection.update { connection: 'open' }
```

---

### Post-Recovery Tasks

1. **Identify deletion cause**
   - Review application logs
   - Check recent deployments
   - Review database access logs
   - Identify who/what deleted data

2. **Prevent future deletions**
   - Implement soft deletes (archive instead of DELETE)
   - Add database triggers to prevent accidental deletes
   - Restrict DELETE permissions
   - Require confirmation for destructive operations

3. **Improve backup strategy**
   - Increase backup frequency (every 6 hours → every 1 hour)
   - Test restoration procedure monthly
   - Automate restoration testing

---

## Scenario 4: Complete Database Loss

**Symptoms:**
- Entire database unavailable or destroyed
- All data gone (not just WhatsApp sessions)
- Datacenter failure, hardware failure, or catastrophic corruption

**Impact:**
- ALL services down
- Complete data loss if no backups
- Extended recovery time (hours, not minutes)

**Estimated Downtime:** 30 minutes - 4 hours (depending on backup availability)

---

### Step-by-Step Recovery

**⏱️ Expected Time:** 30 minutes - 4 hours

#### Phase 1: Assess Damage (5 minutes)

```bash
# 1. Attempt connection to database
psql $DATABASE_URL -c "SELECT 1"

# If complete failure:
# psql: error: connection to server failed
# psql: error: FATAL: database does not exist

# 2. Check if it's a connection issue or actual loss
ping a84c973324fdaccfc68d929d.twc1.net

# 3. Contact database provider (Timeweb)
# - Open support ticket
# - Request server status
# - Ask about backups

# 4. Gather information
# - When was last successful connection?
# - When did failure occur?
# - Is data recoverable by provider?
```

#### Phase 2: Initiate Disaster Recovery (10-15 minutes)

**Option A: Provider Restoration (Best - if available)**

```bash
# 1. Work with Timeweb support to restore database
# - They may have automated backups
# - Restoration time: 30 min - 2 hours
# - Data loss: 0-24 hours (depends on backup frequency)

# 2. Wait for restoration confirmation

# 3. Verify database accessible
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_auth"

# 4. If successful, proceed to Phase 3: Verification
```

**Option B: Self-Service Restoration from Multi-Region Backups**

```bash
# 1. Retrieve backups from S3 (Moscow region)
aws s3 ls s3://backups-moscow/baileys/daily/ | tail -10

# 2. Download most recent backup
aws s3 cp s3://backups-moscow/baileys/daily/baileys_20251119_0300.sql /tmp/

# 3. If Moscow backup unavailable, try EU replica
aws s3 cp s3://backups-eu/baileys/daily/baileys_20251119_0300.sql /tmp/

# 4. Create new database instance
# (This requires Timeweb admin panel or API)
# - Provision new PostgreSQL instance
# - Get connection string

# 5. Restore backup to new database
NEW_DB_URL="<new connection string>"
psql $NEW_DB_URL < /tmp/baileys_20251119_0300.sql

# 6. Update .env with new database URL
sed -i "s|DATABASE_URL=.*|DATABASE_URL=$NEW_DB_URL|" /opt/ai-admin/.env

# 7. Restart services
pm2 restart all
```

**Option C: Emergency File-Based Fallback (Temporary)**

```bash
# If database cannot be restored quickly:

# 1. Switch to file-based mode (no PostgreSQL)
node scripts/emergency/restore-file-sessions.js --skip-export

# 2. This gives temporary operation while database is restored

# 3. Data loss considerations:
# - Recent session updates lost (since last file export)
# - May require WhatsApp re-pairing
# - Messages sent during outage may be lost

# 4. Once database restored, migrate back
# (See Scenario 1 rollback procedure)
```

#### Phase 3: Verification & Recovery (10-20 minutes)

```bash
# 1. Verify all tables exist
psql $DATABASE_URL <<EOF
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('whatsapp_auth', 'whatsapp_keys', 'companies', 'clients', 'bookings');
EOF

# Expected: All tables listed

# 2. Verify row counts
psql $DATABASE_URL <<EOF
SELECT
  (SELECT COUNT(*) FROM companies) as companies,
  (SELECT COUNT(*) FROM clients) as clients,
  (SELECT COUNT(*) FROM bookings) as bookings,
  (SELECT COUNT(*) FROM whatsapp_auth) as auth,
  (SELECT COUNT(*) FROM whatsapp_keys) as keys;
EOF

# Compare to expected counts (from monitoring dashboards)

# 3. Restart ALL services
pm2 restart all

# 4. Verify each service
pm2 status

# Expected: All services "online"

# 5. Test WhatsApp functionality
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "89686484488", "message": "Disaster recovery test"}'

# 6. Test AI booking flow (end-to-end)
# Send WhatsApp message: "Хочу записаться на стрижку"
# Verify bot responds correctly
```

#### Phase 4: Post-Recovery (30-60 minutes)

```bash
# 1. Assess data loss
# - Compare restored data with last known good state
# - Identify missing records (created between backup and failure)
# - Document data loss scope

# 2. Notify stakeholders
# - Send detailed incident report
# - Explain what was lost
# - Provide timeline for full recovery

# 3. Manual data recovery (if needed)
# - Recreate missing bookings from external sources (YClients API)
# - Restore missing client data
# - Reconcile any discrepancies

# 4. Implement preventive measures
# - Increase backup frequency
# - Set up multi-region backups (if not already done)
# - Test disaster recovery monthly
# - Document lessons learned
```

---

## Post-Recovery Tasks

**ALL Scenarios - Complete These After Recovery:**

### 1. Incident Report (within 1 hour)

Create `/docs/05-reports/incidents/INCIDENT_<DATE>.md`:

```markdown
# Incident Report: [Brief Title]

**Date:** 2025-XX-XX
**Duration:** XX minutes
**Severity:** CRITICAL/HIGH/MEDIUM
**Status:** RESOLVED

## Summary
[What happened in 2-3 sentences]

## Timeline
- XX:XX - Incident detected
- XX:XX - Emergency response initiated
- XX:XX - Recovery completed
- XX:XX - Service verified stable

## Root Cause
[Why did this happen?]

## Impact
- Users affected: [number]
- Messages lost: [number]
- Data loss: [hours/none]

## Actions Taken
1. [Step 1]
2. [Step 2]
...

## Prevention
[What will we do to prevent this in the future?]

## Lessons Learned
- What worked well
- What needs improvement
- Action items
```

### 2. Monitoring & Verification (24 hours)

```bash
# Hour 1: Check every 10 minutes
pm2 logs baileys-whatsapp-service --lines 20 --err

# Hour 2-4: Check every 30 minutes
pm2 status
pm2 logs --lines 50 --err

# Hour 5-24: Check every 2 hours
pm2 monit  # Real-time monitoring
```

### 3. Stakeholder Communication

**Notify:**
- Product owner
- Development team
- Support team
- End users (if customer-facing)

**Template:**
```
Subject: WhatsApp Service Restored - Incident Report

Hi team,

WhatsApp service experienced an outage from XX:XX to XX:XX (XX minutes).

Root cause: [Brief explanation]
Impact: [User impact]
Resolution: [How we fixed it]

Current status: ✅ STABLE

No action required from you. We'll continue monitoring for the next 24 hours.

Detailed incident report: [link]

Questions? Reply to this email.

- DevOps Team
```

### 4. Runbook Updates (within 48 hours)

```bash
# Update this runbook if:
# - New scenario discovered
# - Recovery steps changed
# - New tools/scripts used
# - Contact information changed

# Example updates:
# - Add new scenario: "Scenario 5: SSL Certificate Expiration"
# - Update timing estimates based on actual recovery
# - Add new verification steps discovered during incident
```

### 5. Testing & Validation (within 1 week)

```bash
# Schedule disaster recovery drill
# - Simulate PostgreSQL outage in staging
# - Practice emergency restore
# - Time each step
# - Update runbook with actual timings

# Create calendar reminder:
# - Monthly: Test backup restoration
# - Quarterly: Full disaster recovery simulation
# - Annually: Multi-region failover test
```

---

## Testing & Validation

### Monthly Backup Restoration Test

**Purpose:** Verify backups are valid and can be restored

**Procedure:**
```bash
# 1. Create test restoration database
psql $DATABASE_URL -c "CREATE DATABASE backup_test_$(date +%Y%m%d)"

# 2. Download latest backup
BACKUP_FILE="/backups/baileys/daily/$(ls -t /backups/baileys/daily/ | head -1)"

# 3. Restore backup
psql backup_test_$(date +%Y%m%d) < $BACKUP_FILE

# 4. Verify data
psql backup_test_$(date +%Y%m%d) -c "SELECT COUNT(*) FROM whatsapp_auth"

# Expected: 1+ rows

# 5. Cleanup
psql $DATABASE_URL -c "DROP DATABASE backup_test_$(date +%Y%m%d)"

# 6. Document results
echo "$(date): Backup restoration test PASSED" >> /var/log/backup-tests.log
```

**Schedule:** 1st of every month, 3:00 AM UTC

---

### Quarterly Disaster Recovery Drill

**Purpose:** Practice full disaster recovery in staging

**Procedure:**
```bash
# 1. Staging environment setup
# - Mirror production configuration
# - Use separate database

# 2. Simulate failure
# - Stop PostgreSQL service
# - OR corrupt session data
# - OR delete data

# 3. Execute recovery
# - Follow this runbook step-by-step
# - Time each phase
# - Document any issues

# 4. Verify recovery
# - All checks pass
# - Services online
# - Data intact

# 5. Update runbook
# - Fix any outdated steps
# - Update timing estimates
# - Add new learnings
```

**Schedule:** Every 3 months (March, June, Sept, Dec)

---

## Appendix A: Emergency Contacts

**Database Provider (Timeweb):**
- Support Portal: https://timeweb.cloud/
- Email: support@timeweb.ru
- Phone: +7 (495) 123-45-67
- Emergency Hotline: TBD

**Cloud Provider (for backups):**
- S3 Support: TBD
- Emergency Access: TBD

**Internal Escalation:**
1. On-Call Engineer (Slack: @oncall, Phone: TBD)
2. DevOps Lead (Slack: @devops-lead, Phone: TBD)
3. CTO (Slack: @cto, Phone: TBD)

---

## Appendix B: Quick Reference

**Emergency Restore (PostgreSQL Unreachable):**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
node scripts/emergency/restore-file-sessions.js
```

**Rollback to PostgreSQL:**
```bash
git checkout main
sed -i 's/USE_REPOSITORY_PATTERN=false/USE_REPOSITORY_PATTERN=true/' .env
pm2 restart baileys-whatsapp-service
```

**Test Message Send:**
```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "89686484488", "message": "Test"}'
```

**Check Service Status:**
```bash
pm2 status
pm2 logs baileys-whatsapp-service --lines 50
```

**Database Connection Test:**
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM whatsapp_auth"
```

---

**Last Updated:** November 19, 2025
**Next Review:** December 19, 2025
**Version:** 1.0
