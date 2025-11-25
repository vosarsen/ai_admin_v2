# Task 3.1: In-Memory Credentials Cache - Test Plan

**Status:** Ready for Execution
**Risk Level:** LOW (read-only verification, simulated outage)
**Estimated Duration:** 15-20 minutes
**Target:** Verify 5-minute cache grace period during PostgreSQL outage

---

## 🎯 Test Objectives

1. Verify credentials cache is populated after normal load
2. Confirm cache fallback works during PostgreSQL failures
3. Validate 5-minute TTL (cache expiry)
4. Verify Sentry alerts fire when using cache
5. Confirm no PostgreSQL saves during cache mode
6. Test cache cleanup on PostgreSQL restoration

---

## ⚠️ Safety Measures

### Pre-requisites
- [ ] Code deployed to server (commit 8f9eb9f)
- [ ] WhatsApp connected and operational
- [ ] Test executed during low-traffic hours
- [ ] Backup plan ready (can restore PostgreSQL quickly)

### Rollback Strategy
If anything goes wrong:
1. **Immediate:** Restore PostgreSQL connection (revert .env change)
2. **Service restart:** `pm2 restart baileys-whatsapp-service`
3. **Verify:** WhatsApp reconnection within 30 seconds
4. **Alert team:** Via Telegram if issues persist

---

## 📋 Phase 0: Pre-Test Verification

### 0.1 Deploy Code to Server

```bash
# Local: Push to remote
git push origin main

# Server: Pull and restart
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin main
pm2 restart baileys-whatsapp-service

# Wait 10 seconds for startup
sleep 10

# Verify service online
pm2 status | grep baileys
```

**Expected:** Service online, no errors

**Record:**
- Deployment time: _______
- Service status: _______
- Git commit: 8f9eb9f

### 0.2 Verify Current System State

```bash
# Check WhatsApp connection
pm2 logs baileys-whatsapp-service --lines 50 --nostream | grep -i "connected\|whatsapp"

# Check PostgreSQL connection
cd /opt/ai-admin
node -e "
const postgres = require('./src/database/postgres');
(async () => {
  try {
    const result = await postgres.query('SELECT COUNT(*) FROM whatsapp_auth');
    console.log('✅ PostgreSQL connected:', result.rows[0].count, 'auth records');
  } catch (error) {
    console.error('❌ PostgreSQL error:', error.message);
  } finally {
    await postgres.end();
  }
})();
"
```

**Expected:**
- WhatsApp: Connected
- PostgreSQL: 1 auth record

**Record:**
- WhatsApp status: _______
- Auth records: _______
- Session keys: _______

### 0.3 Baseline: Verify Normal Operation

```bash
# Send test message (normal operation)
# From local machine:
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test 1: Normal operation (before cache test)"
```

**Wait 5 seconds, then check response:**
```
@whatsapp get_last_response phone:89686484488
```

**Expected:** Bot responds normally

**Record:**
- Test message sent: _______
- Response received: _______
- Response time: _______

---

## 📋 Phase 1: Cache Population Test

**Objective:** Verify cache is populated during normal operation

### 1.1 Restart Service to Trigger Fresh Load

```bash
# Server
pm2 restart baileys-whatsapp-service

# Monitor logs for cache activity
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -i "cache\|credentials"
```

**Expected logs:**
```
✅ Loaded existing credentials for 962302
💾 Updated credentials cache for 962302
```

**Record:**
- Cache populated: ☐ YES ☐ NO
- Timestamp: _______

---

## 📋 Phase 2: Simulated PostgreSQL Outage (3 minutes)

**Objective:** Verify cache fallback works during database failure

### 2.1 Simulate PostgreSQL Failure

**⚠️ IMPORTANT:** This does NOT actually break PostgreSQL, just makes it unreachable from the app

```bash
# Server: Backup current .env
cp /opt/ai-admin/.env /opt/ai-admin/.env.backup-cache-test

# Change PostgreSQL host to invalid (simulates network failure)
cd /opt/ai-admin
sed -i 's/a84c973324fdaccfc68d929d\.twc1\.net/invalid-postgres-host\.twc1\.net/g' .env

# Verify change
grep POSTGRES_CONNECTION_STRING .env | head -1

# Expected: Should show invalid-postgres-host.twc1.net
```

**Record:**
- .env backed up: _______
- Host changed to: invalid-postgres-host.twc1.net
- Time: _______

### 2.2 Restart Service to Trigger Cache Fallback

```bash
# Server
pm2 restart baileys-whatsapp-service

# Wait 5 seconds
sleep 5

# Check logs for cache fallback
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -E "cache|PostgreSQL|fail"
```

**Expected logs:**
```
❌ Failed to load credentials for 962302: <error>
⚠️ PostgreSQL unavailable, using cached credentials for 962302 (age: Xs)
✅ WhatsApp connected for company 962302
```

**Record:**
- Cache fallback triggered: ☐ YES ☐ NO
- Cache age at fallback: _______ seconds
- WhatsApp reconnected: ☐ YES ☐ NO
- Time: _______

### 2.3 Verify WhatsApp Functionality During Outage

```bash
# From local machine - send test message
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test 2: During PostgreSQL outage (using cache)"
```

**Wait 5 seconds:**
```
@whatsapp get_last_response phone:89686484488
```

**Expected:** Bot responds normally (WhatsApp still working!)

**Record:**
- Message sent: _______
- Response received: ☐ YES ☐ NO
- Time during outage: _______

### 2.4 Wait 2 Minutes (Verify Cache Holds)

```bash
# Wait 2 minutes total (already waited ~30s)
sleep 90

# Send another test message
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test 3: 2 minutes into outage (cache still valid)"
```

**Wait 5 seconds:**
```
@whatsapp get_last_response phone:89686484488
```

**Expected:** Bot still responds (cache valid <5 min)

**Record:**
- Cache age: ~2 minutes
- Message sent: _______
- Response received: ☐ YES ☐ NO
- Time: _______

### 2.5 Check Logs for "No Save" Behavior

```bash
# Server: Check that saves are being skipped
pm2 logs baileys-whatsapp-service --lines 200 --nostream | grep -i "skip.*save\|using cache"
```

**Expected logs:**
```
⚠️ Skipping credentials save to PostgreSQL for 962302 (using cache mode)
```

**Record:**
- Save skipped during cache mode: ☐ YES ☐ NO
- Count of skipped saves: _______

---

## 📋 Phase 3: Restore PostgreSQL Connection

**Objective:** Verify cache is cleared and normal operation resumes

### 3.1 Restore PostgreSQL Connection

```bash
# Server: Restore original .env
cp /opt/ai-admin/.env.backup-cache-test /opt/ai-admin/.env

# Verify restoration
grep POSTGRES_CONNECTION_STRING .env | head -1

# Expected: Should show a84c973324fdaccfc68d929d.twc1.net
```

**Record:**
- .env restored: _______
- Host: a84c973324fdaccfc68d929d.twc1.net
- Time: _______

### 3.2 Restart Service (Resume Normal Operation)

```bash
# Server
pm2 restart baileys-whatsapp-service

# Wait 5 seconds
sleep 5

# Check logs for normal operation
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -E "PostgreSQL|credentials|cache"
```

**Expected logs:**
```
🗄️ Using Timeweb PostgreSQL auth state for company 962302
✅ Loaded existing credentials for 962302
💾 Updated credentials cache for 962302
✅ WhatsApp connected for company 962302
```

**Record:**
- PostgreSQL reconnected: ☐ YES ☐ NO
- Cache updated: ☐ YES ☐ NO
- WhatsApp reconnected: ☐ YES ☐ NO
- Time: _______

### 3.3 Verify Normal Saves Resume

```bash
# From local machine - trigger a credential update
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test 4: After PostgreSQL restored (normal operation)"
```

**Server logs:**
```bash
pm2 logs baileys-whatsapp-service --lines 100 --nostream | grep -i "save"
```

**Expected logs:**
```
💾 Credentials saved for 962302
💾 Updated credentials cache after save for 962302
```

**Record:**
- Saves to PostgreSQL resumed: ☐ YES ☐ NO
- Cache updated after save: ☐ YES ☐ NO
- Time: _______

---

## 📋 Phase 4: Cache Expiry Test (Optional - 5+ minutes)

**Objective:** Verify cache expires after 5 minutes TTL

**⚠️ Note:** This test takes 5+ minutes. Can skip if time limited.

### 4.1 Simulate PostgreSQL Failure Again

```bash
# Server: Same as Phase 2.1
sed -i 's/a84c973324fdaccfc68d929d\.twc1\.net/invalid-postgres-host\.twc1\.net/g' .env
pm2 restart baileys-whatsapp-service
```

### 4.2 Wait 6 Minutes

```bash
# Wait for cache to expire (5 min TTL + 1 min buffer)
sleep 360

# Check logs for cache expiry
pm2 logs baileys-whatsapp-service --lines 200 --nostream | grep -i "cache.*expir"
```

**Expected logs:**
```
⏱️ Cache expired for company 962302 (age: >300s)
```

**Record:**
- Cache expired: ☐ YES ☐ NO
- Age at expiry: _______ seconds
- Time: _______

### 4.3 Verify Connection Fails After Cache Expiry

```bash
# Try to send message
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test 5: After cache expired (should fail)"
```

**Expected:** Error (cache expired, PostgreSQL unavailable)

**Record:**
- Connection failed: ☐ YES ☐ NO (EXPECTED to fail)
- Error message: _______

### 4.4 Restore PostgreSQL

```bash
# Server: Restore connection
cp /opt/ai-admin/.env.backup-cache-test /opt/ai-admin/.env
pm2 restart baileys-whatsapp-service
```

**Record:**
- System restored: _______

---

## 📋 Phase 5: Sentry Alert Verification

**Objective:** Verify Sentry alerts were logged

### 5.1 Check Sentry Dashboard

**Access Sentry:**
1. Open https://sentry.io (or your Sentry instance)
2. Navigate to project: ai-admin
3. Filter by:
   - Component: `baileys_auth`
   - Operation: `load_credentials_from_cache`
   - Level: `warning`

**Expected alerts:**
- Warning: "Using cached credentials due to PostgreSQL failure"
- Tags:
  - component: baileys_auth
  - operation: load_credentials_from_cache
  - company_id: 962302
  - fallback: cache
- Extra data:
  - cacheAge: ~X seconds
  - originalError: connection error
  - postgresError: ENOTFOUND or similar

**Record:**
- Sentry alert found: ☐ YES ☐ NO
- Alert count: _______
- Alert details match: ☐ YES ☐ NO

---

## 📊 Test Results Summary

### Acceptance Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| Credentials cached after PostgreSQL load | ☐ PASS ☐ FAIL | ___ |
| Cache expires after 5 minutes | ☐ PASS ☐ FAIL | ___ |
| Fallback to cache during DB errors | ☐ PASS ☐ FAIL | ___ |
| Sentry warning logged when using cache | ☐ PASS ☐ FAIL | ___ |
| Cache cleared on successful reconnect | ☐ PASS ☐ FAIL | ___ |
| No credentials saved while using cache | ☐ PASS ☐ FAIL | ___ |
| WhatsApp stays connected during outage | ☐ PASS ☐ FAIL | ___ |

### Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cache population time | <1s | _____ s | ☐ PASS ☐ FAIL |
| Fallback to cache time | <1s | _____ s | ☐ PASS ☐ FAIL |
| WhatsApp uptime during outage (3min) | 100% | _____ % | ☐ PASS ☐ FAIL |
| Cache expiry accuracy | 5min ±10s | _____ s | ☐ PASS ☐ FAIL |

### Issues Encountered

| Issue | Severity | Resolution | Time Impact |
|-------|----------|------------|-------------|
|       |          |            |             |

---

## ✅ Post-Test Cleanup

```bash
# Server: Remove backup .env files
rm /opt/ai-admin/.env.backup-cache-test

# Verify system fully operational
pm2 status
pm2 logs baileys-whatsapp-service --lines 20 --nostream

# Send final test message
```

**MCP Command:**
```
@whatsapp send_message phone:89686484488 message:"Test complete - all systems normal"
```

**Checklist:**
- [ ] Backup .env removed
- [ ] PostgreSQL connected
- [ ] WhatsApp connected
- [ ] Test message delivered
- [ ] No errors in logs

---

## 📝 Next Steps

After successful testing:
1. Update `baileys-resilience-improvements-context.md` with results
2. Update `baileys-resilience-improvements-tasks.md` (mark Task 3.1 complete)
3. Commit test results
4. Proceed to Task 3.2: Automated Key Cleanup Job

**Test Plan Version:** 1.0
**Created:** 2025-11-19
**Author:** Claude Code
**Execution Date:** _______
