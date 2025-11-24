# Redis Connection Refused - Runbook

**Pattern:** `(ECONNREFUSED.*redis|redis.*connection.*refused|Redis.*error|connect.*6379.*fail)`
**Severity:** High
**MTTR Target:** 3-5 minutes
**Last Updated:** 2025-11-24

---

## 📋 Symptoms

**How to identify this error:**

- Error message contains: `ECONNREFUSED`, `Redis connection refused`, `connect ECONNREFUSED 127.0.0.1:6379`
- Stack trace shows: `redis-client.js`, `ioredis`, `ContextService`
- Component tags: `redis`, `cache`, `context`
- Typically occurs: After server restart, Redis crash, or network issues
- **Impact:** Bot cannot retrieve conversation context, behaves as if all conversations are new

**Examples:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:16)
  at ContextService.getContext (context-service.js:45)
```

---

## 🔍 Diagnosis

**Root Cause:**
Redis service is down, not responding, or connection configuration is incorrect.

**How to verify:**
```bash
# Step 1: Check Redis service status
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl status redis-server"

# Step 2: Test Redis connection directly
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "redis-cli ping"
# Expected: PONG

# Step 3: Check Redis logs for errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "tail -100 /var/log/redis/redis-server.log | grep -i error"

# Step 4: Check if Redis is listening on correct port
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "netstat -tulpn | grep 6379"
```

**Common Triggers:**
1. Redis service crashed (OOM, bug, config error)
2. Server rebooted (Redis not configured to auto-start)
3. Redis maxmemory reached (eviction policy issue)
4. Port conflict (another service using 6379)
5. Connection configuration mismatch (wrong host/port in .env)

---

## 🛠️ Fix

**Immediate Actions:**
```bash
# Step 1: Start Redis service
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl start redis-server"

# Step 2: Verify Redis is running
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl status redis-server"

# Step 3: Test connection
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "redis-cli ping"

# Step 4: Restart dependent services
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart ai-admin-worker-v2 ai-admin-api"
```

**Verification:**
```bash
# Step 1: Check if services reconnected to Redis
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50 | grep -i 'redis\|connect'"

# Step 2: Test context retrieval (send message to bot)
# Send: "тест" to +79936363848
# Bot should remember previous conversation

# Step 3: Verify no more ECONNREFUSED errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50 | grep ECONNREFUSED"
```

**Expected Result:**
- Redis service status: active (running)
- redis-cli ping returns: PONG
- PM2 services connected to Redis
- Bot remembers conversation context

**Rollback Plan (if fix fails):**
```bash
# If Redis won't start:

# 1. Check Redis configuration
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cat /etc/redis/redis.conf | grep -v '^#' | grep -v '^$'"

# 2. Check for port conflicts
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "lsof -i :6379"

# 3. Try manual start to see errors
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "redis-server /etc/redis/redis.conf"

# 4. If corrupted, clear Redis data (WARNING: loses all cache)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "systemctl stop redis-server && rm -f /var/lib/redis/dump.rdb && systemctl start redis-server"
```

---

## 🚫 Prevention

**Configuration Changes:**
- [ ] Enable Redis auto-start on boot
  ```bash
  systemctl enable redis-server
  ```
- [ ] Configure Redis maxmemory policy
  - File: `/etc/redis/redis.conf`
  - Set: `maxmemory 512mb` (adjust based on server RAM)
  - Set: `maxmemory-policy allkeys-lru` (evict least recently used)
- [ ] Enable Redis persistence (if not enabled)
  - RDB snapshots: `save 900 1` (every 15 min if ≥1 key changed)
  - AOF: `appendonly yes` (for better durability)

**Monitoring:**
- Add alert for: Redis service down
- Check: `systemctl is-active redis-server` every 5 minutes
- Action: Auto-restart + Telegram alert

**Code Changes:**
- [ ] Add Redis reconnection logic with exponential backoff
  ```javascript
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
  });
  ```
- [ ] Add Redis health check endpoint
  ```javascript
  app.get('/health/redis', async (req, res) => {
    try {
      await redis.ping();
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'error', message: err.message });
    }
  });
  ```
- [ ] Add graceful degradation (bot works without context if Redis down)
  ```javascript
  async getContext(phone) {
    try {
      return await redis.get(`context:${phone}`);
    } catch (err) {
      logger.warn('Redis unavailable, using empty context');
      return null; // Bot continues without context
    }
  }
  ```

**Documentation:**
- [ ] Update docs at: `docs/TROUBLESHOOTING.md` (add Redis section)
- [ ] Add test case: Kill Redis, verify service recovery
- [ ] Document Redis backup/restore procedure

---

## 📊 History

**Occurrences:**
- 2025-11-10 - After server reboot, Redis didn't auto-start (fixed with systemctl enable)
- 2025-10-05 - Redis maxmemory reached, evicted all keys (fixed with allkeys-lru policy)
- 2025-09-01 - Port 6379 conflict with old Redis instance (fixed by killing old process)

**Related Issues:**
- GlitchTip #[pending] - Redis connection refused after reboot
- GitHub Issue - Add Redis monitoring and auto-recovery

**Improvements Made:**
- 2025-11-10 - Enabled Redis auto-start (`systemctl enable redis-server`)
- 2025-10-05 - Configured maxmemory policy (512mb, allkeys-lru)
- 2025-09-15 - Added Redis connection retry logic in code

---

## 🔗 Related Resources

**Internal Docs:**
- `docs/TROUBLESHOOTING.md` - Common Redis issues
- `src/services/context/redis-client.js` - Redis client configuration
- `CLAUDE.md` - Redis ports and tunnel info

**External Resources:**
- [Redis Quick Start](https://redis.io/docs/getting-started/)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Redis Configuration](https://redis.io/docs/management/config/)
- [ioredis Documentation](https://github.com/luin/ioredis)

**Team Contacts:**
- Primary: Backend Developer (Redis integration owner)
- Backup: DevOps Engineer (system services)
- Escalation: None (self-service)

---

**Runbook Version:** 1.0
**Author:** Claude Code
**Reviewed By:** [Pending]
**Next Review:** 2025-12-24
