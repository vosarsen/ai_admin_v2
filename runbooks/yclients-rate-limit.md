# YClients API Rate Limit - Runbook

**Pattern:** `(rate.*limit|too.*many.*requests|429|YClients.*limit|API.*quota)`
**Severity:** Medium
**MTTR Target:** 2-5 minutes
**Last Updated:** 2025-11-24

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `Rate limit exceeded`, `Too many requests`, `HTTP 429`
- Stack trace shows: `yclients-api.js`, `YClientsService`, API request methods
- Component tags: `yclients`, `api`, `rate-limit`
- Typically occurs: During sync operations, batch requests, or peak hours
- **Impact:** Bookings, services, and schedule sync temporarily paused

**Examples:**
```
Error: YClients API rate limit exceeded: 429 Too Many Requests
  at yclients-api.js:123
  at YClientsService.getBookings
  Retry-After: 60
```

---

## 🔍 Diagnosis

**Root Cause:**
Exceeded YClients API rate limits (1000 requests/hour per company).

**How to verify:**
```bash
# Step 1: Check recent API requests in logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100 | grep -i 'yclients\|429\|rate.*limit'"

# Step 2: Count recent API calls (if logging enabled)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 500 | grep 'YClients API' | wc -l"

# Step 3: Check schedules sync status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs schedules-sync-service --lines 50 | grep -i 'sync\|error'"
```

**Common Triggers:**
1. Full sync triggered (syncs 30 days = 60+ API calls)
2. Multiple services making concurrent requests
3. Manual API testing without rate limit handling
4. Hourly TODAY-ONLY sync overlapping with full sync
5. Client making rapid repeated requests

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: Wait for rate limit to reset (check Retry-After header)
# Usually 60 seconds, max 1 hour

# Step 2: Check current time and sync schedule
date
# If within sync window (8-23h), temporarily stop schedules sync:
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 stop schedules-sync-service"

# Step 3: Wait 5 minutes for rate limit to reset
sleep 300

# Step 4: Restart schedules sync
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart schedules-sync-service"
```

**Verification:**
```bash
# Check if sync resumed successfully
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs schedules-sync-service --lines 30 | grep -i 'success\|complete'"

# Verify no more 429 errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 --err | grep 429"
```

**Expected Result:**
- Schedules sync completes successfully
- No 429 errors in logs
- Bot responds to booking requests normally

**Rollback Plan (if fix fails):**
```bash
# If rate limit persists:

# 1. Check YClients API status
# Visit: https://status.yclients.com

# 2. Verify YCLIENTS_PARTNER_TOKEN is correct
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && grep YCLIENTS_PARTNER_TOKEN .env.production"

# 3. Contact YClients support to request rate limit increase
# Email: support@yclients.com
# Mention: Marketplace partner token, need higher limits
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] Implement exponential backoff in API client
  - File: `src/integrations/yclients-api.js`
  - Add: `retryAfter = response.headers['retry-after']`
  - Wait: `Math.max(60, retryAfter * 1000)` before retry
- [ ] Add request rate limiting
  - Use `bottleneck` library: `npm install bottleneck`
  - Limit: 900 requests/hour (buffer below 1000 limit)
- [ ] Cache API responses
  - Services list: 1 hour TTL
  - Staff list: 1 hour TTL
  - Schedules: 15 minutes TTL (current)

**Monitoring:**
- Add alert for: API request rate >800/hour
- Threshold: `requests_last_hour > 800`
- Action: Send Telegram warning "Approaching YClients rate limit"

**Code Changes:**
- [ ] Implement request queue with rate limiting
  ```javascript
  const limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 4000 // 900 req/hour = ~1 per 4 seconds
  });
  ```
- [ ] Add retry logic with exponential backoff
  ```javascript
  const response = await limiter.schedule(() =>
    axios.get(url).catch(err => {
      if (err.response?.status === 429) {
        const retryAfter = err.response.headers['retry-after'] || 60;
        throw new RateLimitError(retryAfter);
      }
      throw err;
    })
  );
  ```
- [ ] Batch API requests where possible
  - Use bulk endpoints: `/api/v1/records/{company_id}` (get multiple)
  - Avoid N+1 queries (get all services in 1 request, not 1 per service)

**Documentation:**
- [ ] Update docs at: `docs/02-guides/marketplace/YCLIENTS_API_LIMITS.md`
- [ ] Add test case: Simulate rate limit (send 1000 requests rapidly)
- [ ] Document rate limiting strategy in code comments

---

## 📊 History

**Occurrences:**
- 2025-10-23 - During hybrid schedules sync implementation, hit limit during testing
- 2025-09-15 - Full sync + hourly sync overlapped, exceeded limit

**Related Issues:**
- GlitchTip #[pending] - YClients rate limit during sync
- GitHub PR - Hybrid schedules sync (reduced API calls by 90%)

**Improvements Made:**
- 2025-10-23 - Implemented hybrid sync (FULL 30d daily, TODAY-ONLY hourly)
  - Reduced: 60 calls/hour → 6 calls/hour (90% reduction)
- 2025-09-20 - Added caching for services and staff (1 hour TTL)
- 2025-09-01 - Migrated to YClients Marketplace API (partner token)

---

## 🔗 Related Resources

**Internal Docs:**
- `docs/03-development-diary/2025-10-23-hybrid-schedules-sync.md` - Hybrid sync implementation
- `docs/SYNC_SYSTEM.md` - YClients sync architecture
- `docs/02-guides/marketplace/AUTHORIZATION_QUICK_REFERENCE.md` - API authentication
- `src/sync/schedules-sync.js` - Sync service code

**External Resources:**
- [YClients API Documentation](https://yclients.docs.apiary.io/)
- [YClients Marketplace API](https://developers.yclients.com)
- [YClients Rate Limits](https://yclients.docs.apiary.io/#introduction/rate-limiting)

**Team Contacts:**
- Primary: Backend Developer (API integration owner)
- Backup: YClients Account Manager
- Escalation: YClients Support (support@yclients.com)

---

**Runbook Version:** 1.0
**Author:** Claude Code
**Reviewed By:** [Pending]
**Next Review:** 2025-12-24
