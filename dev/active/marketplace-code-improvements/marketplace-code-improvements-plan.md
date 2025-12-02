# YClients Marketplace Code Improvements - Plan (REVISED)

**Created:** 2025-12-02
**Revised:** 2025-12-02 (after plan review)
**Priority:** HIGH - Post-moderation improvements
**Source:** Code review by Claude Code Architecture Reviewer
**Review Status:** APPROVED WITH CHANGES
**Overall Grade:** B+ (87/100) → Target: A (95/100)
**Estimated Time:** 15-18 hours total (revised from 16-20h)

---

## Executive Summary

После успешного прохождения модерации YClients Marketplace, необходимо исправить найденные проблемы для повышения надежности и безопасности системы.

**Revision Notes (from plan review):**
- ✅ CircuitBreaker уже существует в `src/utils/circuit-breaker.js` - REUSE
- ✅ Variable scope bug найден в activation catch block - MUST FIX
- ✅ Advisory locks лучше чем FOR UPDATE для concurrent protection
- ✅ Timestamp в idempotency hash - нужно убрать
- ✅ Event logging должен быть ПОСЛЕ транзакции

---

## Phase 1: Critical Fixes (Must Fix) - 5h

### Task 1.1: Transaction Rollback for Activation Flow
**Priority:** CRITICAL | **Time:** 3-4h | **File:** `yclients-marketplace.js:500-664`

**Problem:**
1. API key может утечь при ошибке YClients API
2. **[NEW]** Variable scope bug: `company_id` и `salon_id` undefined в catch block

**Solution:**

**Step 1: Fix variable scope**
```javascript
router.post('/marketplace/activate', async (req, res) => {
  let salon_id, company_id;  // Declare at function scope!

  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    salon_id = decoded.salon_id;      // Assign after verification
    company_id = decoded.company_id;

    // ... rest of activation flow ...

  } catch (error) {
    // Now safe to use company_id and salon_id
    if (company_id) {
      // Rollback logic
    }
  }
});
```

**Step 2: Wrap in transaction**
```javascript
await companyRepository.withTransaction(async (txClient) => {
  // 1. Lock by yclients_id (advisory lock - see Task 1.2)
  // 2. Save API key with status='activating'
  // 3. Call YClients API
  // 4. Update status to 'active'
  // If ANY step fails → automatic rollback
});

// Event logging AFTER transaction (non-critical)
try {
  await marketplaceEventsRepository.insert({ ... });
} catch (eventError) {
  logger.error('Failed to log event:', eventError);
  Sentry.captureException(eventError);
  // Don't fail - activation was successful
}
```

**Acceptance Criteria:**
- [ ] Variables declared at function scope
- [ ] Activation flow uses withTransaction
- [ ] API key NOT saved if YClients API fails
- [ ] Event logging is OUTSIDE transaction
- [ ] Feature flag: `USE_TRANSACTION_ACTIVATION`
- [ ] Unit test for rollback scenario

---

### Task 1.2: Concurrent Activation Protection (Advisory Locks)
**Priority:** HIGH | **Time:** 1h | **File:** `yclients-marketplace.js:500-664`

**Problem:** Race condition при параллельных активациях

**Solution (REVISED):** Использовать PostgreSQL Advisory Locks вместо FOR UPDATE

```javascript
// Inside transaction, BEFORE any DB operations
const lockResult = await txClient.query(
  'SELECT pg_try_advisory_xact_lock($1)',
  [parseInt(salon_id)]  // Use salon_id as lock key
);

if (!lockResult.rows[0].pg_try_advisory_xact_lock) {
  // Another activation in progress for this salon
  return res.status(409).json({
    error: 'Activation already in progress',
    code: 'CONCURRENT_ACTIVATION',
    retry_after: 5
  });
}

// Lock acquired - proceed with activation
// Lock automatically released on transaction COMMIT or ROLLBACK
```

**Why Advisory Locks > FOR UPDATE:**
| Feature | FOR UPDATE | Advisory Lock |
|---------|------------|---------------|
| Requires existing row | Yes | No |
| Lock by salon_id | Need WHERE yclients_id | Direct integer key |
| Explicit intent | No | Yes (clear locking) |
| Deadlock risk | Higher | Lower |

**Acceptance Criteria:**
- [ ] Advisory lock acquired by salon_id
- [ ] Return 409 if lock not available
- [ ] Lock released on transaction end
- [ ] Integration test: 2 parallel requests → one 409

---

### Task 1.3: QR Generation Circuit Breaker (REUSE EXISTING)
**Priority:** MEDIUM-HIGH | **Time:** 30min | **File:** `yclients-marketplace.js:391-433`

**Problem:** 38 секунд блокировки если Baileys недоступен

**Solution (REVISED):** Использовать СУЩЕСТВУЮЩИЙ CircuitBreaker из `src/utils/circuit-breaker.js`

```javascript
// At top of yclients-marketplace.js
const { getCircuitBreaker } = require('../../utils/circuit-breaker');

// Create circuit breaker for QR generation
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,      // 60s cooldown
  timeout: 30000,           // 30s operation timeout
  successThreshold: 2       // 2 successes to close
});

// In QR generation route
router.post('/marketplace/api/qr', async (req, res) => {
  try {
    const result = await qrCircuitBreaker.execute(async () => {
      // Existing QR generation logic
      await sessionPool.createSession(sessionId, { company_id, salon_id });

      let attempts = 0;
      while (attempts < 5) {  // Reduced from 10
        const qr = await sessionPool.getQR(sessionId);
        if (qr) return { qr, session_id: sessionId };
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      throw new Error('QR generation timeout');
    });

    res.json({ success: true, ...result });

  } catch (error) {
    if (error.code === 'CIRCUIT_OPEN') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'QR generation service is experiencing issues. Please try again in a few minutes.',
        code: 'SERVICE_UNAVAILABLE',
        retry_after: 60
      });
    }
    // ... rest of error handling ...
  }
});
```

**Existing CircuitBreaker Features:**
- ✅ States: CLOSED, OPEN, HALF_OPEN
- ✅ Configurable thresholds
- ✅ Built-in timeout
- ✅ Statistics tracking
- ✅ Event emission
- ✅ Singleton factory

**Acceptance Criteria:**
- [ ] Import existing CircuitBreaker
- [ ] Configure for QR generation
- [ ] Return 503 when OPEN
- [ ] Add circuit state to health check
- [ ] Sentry alert on state change (via logger)

---

## Phase 2: Important Improvements - 7h

### Task 2.1: Admin Audit Trail
**Priority:** MEDIUM | **Time:** 4h | **Files:** routes, migration

**Problem:** Admin действия не сохраняются в БД

**Solution:**

**Step 1: Create migration file**
```sql
-- migrations/003_admin_audit_log.sql
CREATE TABLE admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255),
  admin_role VARCHAR(50),
  admin_email VARCHAR(255),
  auth_method VARCHAR(20),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_path VARCHAR(500),
  request_method VARCHAR(10),
  request_body JSONB,
  response_status INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for common queries
CREATE INDEX idx_admin_audit_lookup
  ON admin_audit_log (admin_id, action, created_at DESC);

-- For cleanup job
CREATE INDEX idx_admin_audit_cleanup
  ON admin_audit_log (created_at);

-- Rollback SQL (keep in comments)
-- DROP TABLE IF EXISTS admin_audit_log;
```

**Step 2: Create helper function**
```javascript
async function logAdminAction(req, res, action, resourceType, resourceId, details = {}) {
  // Sanitize request body (remove sensitive fields)
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.token;
  delete sanitizedBody.api_key;

  try {
    await postgres.query(
      `INSERT INTO admin_audit_log (
        admin_id, admin_role, admin_email, auth_method,
        action, resource_type, resource_id,
        ip_address, user_agent, request_path, request_method,
        request_body, response_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        req.adminUser?.id || 'api_key',
        req.adminUser?.role || 'unknown',
        req.adminUser?.email || null,
        req.adminUser?.type || 'unknown',
        action,
        resourceType,
        resourceId,
        req.ip,
        req.headers['user-agent']?.substring(0, 500),
        req.path,
        req.method,
        JSON.stringify(sanitizedBody),
        res.statusCode
      ]
    );
  } catch (error) {
    logger.error('Failed to log admin action:', error);
    // Don't fail the request if audit log fails
  }
}
```

**Step 3: Add retention policy (cron)**
```javascript
// In a scheduled job (or PM2 cron)
async function cleanupAuditLog() {
  const result = await postgres.query(
    `DELETE FROM admin_audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  logger.info(`Cleaned up ${result.rowCount} old audit records`);
}
```

**Acceptance Criteria:**
- [ ] Migration file created with rollback SQL
- [ ] Helper function with body sanitization
- [ ] Applied to all admin routes
- [ ] GET endpoint for viewing logs (admin only)
- [ ] Retention policy (90 days)
- [ ] Test: Verify logs for disconnect action

---

### Task 2.2: Webhook Idempotency (REVISED)
**Priority:** MEDIUM | **Time:** 2h | **File:** `yclients-marketplace.js:763-836`

**Problem:** Duplicate webhooks обрабатываются дважды

**Solution (REVISED):** Remove timestamp from hash!

```javascript
// Generate deterministic webhook ID (NO TIMESTAMP!)
const webhookId = crypto.createHash('sha256')
  .update(`${eventType}:${salon_id}:${JSON.stringify(data)}`)
  .digest('hex').substring(0, 16);

// Check idempotency in Redis
const redis = await getRedisClient();
const isNew = await redis.set(
  `webhook:processed:${webhookId}`,
  '1',
  'EX', 3600,  // 1 hour TTL
  'NX'         // Only if not exists
);

if (!isNew) {
  logger.info('Duplicate webhook skipped', { webhookId, eventType, salon_id });
  return res.status(200).json({
    success: true,
    skipped: 'duplicate',
    webhook_id: webhookId
  });
}

// Process webhook...
try {
  await handleWebhookEvent(eventType, salon_id, data);
} catch (error) {
  // On processing error, remove key to allow retry
  await redis.del(`webhook:processed:${webhookId}`);
  throw error;
}
```

**Why No Timestamp:**
- With timestamp: Two identical webhooks 1ms apart → different IDs → both processed
- Without timestamp: Identical webhooks → same ID → second skipped

**Acceptance Criteria:**
- [ ] Hash without timestamp
- [ ] Redis NX for atomic check
- [ ] 1 hour TTL
- [ ] Remove key on error (allow retry)
- [ ] Test: Send same webhook twice → only one processed

---

### Task 2.3: Input Validation Warnings
**Priority:** LOW-MEDIUM | **Time:** 1h | **File:** `validators.js:70-83`

**Problem:** Silent truncation может потерять данные

**Solution:**
```javascript
function sanitizeString(input, maxLength = 255, options = {}) {
  const { logWarning = true, throwOnOverflow = false } = options;

  if (!input) return '';
  if (typeof input !== 'string') input = String(input);

  // Sanitize
  let clean = input
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  // Check length AFTER sanitization
  if (clean.length > maxLength) {
    if (throwOnOverflow) {
      throw new Error(`String exceeds ${maxLength} characters (got ${clean.length})`);
    }
    if (logWarning) {
      logger.warn('String truncated during sanitization', {
        originalLength: clean.length,
        maxLength,
        preview: clean.substring(0, 50) + '...'
      });
    }
    return clean.substring(0, maxLength);
  }

  return clean;
}
```

**Acceptance Criteria:**
- [ ] Options parameter added
- [ ] Truncation logged when logWarning=true
- [ ] Backward compatible
- [ ] Test: Long string → warning in logs

---

## Phase 3: Nice to Have - 6h

### Task 3.1: Enhanced Health Check
**Priority:** LOW | **Time:** 1.5h | **File:** `yclients-marketplace.js:842-881`

**Solution (REVISED):** Add timeouts and circuit breaker state

```javascript
router.get('/marketplace/health', async (req, res) => {
  const checks = { status: 'ok', timestamp: new Date().toISOString() };

  // Helper: Add timeout to promises
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);

  // PostgreSQL check
  try {
    const start = Date.now();
    await withTimeout(postgres.query('SELECT 1'), 5000);
    checks.database = { status: 'healthy', latency: Date.now() - start };
  } catch (error) {
    checks.database = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }

  // Redis check
  try {
    const service = await getMarketplaceService();
    if (service.redis) {
      const start = Date.now();
      await withTimeout(service.redis.ping(), 2000);
      checks.redis = { status: 'healthy', latency: Date.now() - start };
    } else {
      checks.redis = { status: 'not_initialized' };
    }
  } catch (error) {
    checks.redis = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }

  // Circuit breaker state
  checks.circuitBreakers = {
    qrGeneration: qrCircuitBreaker.getState()
  };

  const httpStatus = checks.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(checks);
});
```

---

### Task 3.2: Standardized Error Handling
**Priority:** LOW | **Time:** 2h | **File:** `marketplace-service.js`

**Pattern:** All service methods return `{ success, data, error, code }`

---

### Task 3.3: Rate Limiter per Salon (Using bottleneck)
**Priority:** LOW | **Time:** 1h | **File:** routes

**Solution:** Use existing `bottleneck` package from package.json

```javascript
const Bottleneck = require('bottleneck');

// Per-salon webhook rate limiter
const getWebhookLimiter = (salonId) => {
  return new Bottleneck({
    reservoir: 10,
    reservoirRefreshAmount: 10,
    reservoirRefreshInterval: 60 * 1000,
    id: `webhook-${salonId}`
  });
};
```

---

### Task 3.4: Integration Tests
**Priority:** LOW | **Time:** 4h | **File:** `tests/integration/marketplace/`

**Tests Needed:**
- [ ] Full activation flow (happy path)
- [ ] Activation rollback on YClients failure
- [ ] Concurrent activation (409 response)
- [ ] Webhook idempotency
- [ ] Circuit breaker open/close

---

## Implementation Order (REVISED)

```
Phase 1 (Critical) - 5h:
├── Task 1.1: Variable scope fix + Transaction (3-4h)
│   ├── Step 1: Fix variable scope (30min)
│   ├── Step 2: Wrap in transaction (1.5h)
│   ├── Step 3: Move event logging outside (30min)
│   ├── Step 4: Add feature flag (15min)
│   └── Step 5: Write unit test (45min)
├── Task 1.2: Advisory locks (1h)
│   ├── Step 1: Add lock query (15min)
│   ├── Step 2: Handle lock failure (15min)
│   └── Step 3: Integration test (30min)
└── Task 1.3: Circuit breaker integration (30min)
    ├── Step 1: Import existing CB (5min)
    ├── Step 2: Configure for QR (10min)
    └── Step 3: Add to health check (15min)

Phase 2 (Important) - 7h:
├── Task 2.1: Admin audit trail (4h)
├── Task 2.2: Webhook idempotency (2h)
└── Task 2.3: Validation warnings (1h)

Phase 3 (Nice to Have) - 6h:
├── Task 3.1: Health check (1.5h)
├── Task 3.2: Error handling (2h)
├── Task 3.3: Rate limiter (1h)
└── Task 3.4: Integration tests (1.5h)
```

---

## Deployment Strategy

### Phase 1 Deployment

**1. Feature Flag:**
```javascript
const USE_TRANSACTION_ACTIVATION = process.env.USE_TRANSACTION_ACTIVATION === 'true';
```

**2. Staged Rollout:**
- Deploy with flag OFF
- Enable for test salon 997441 first
- Monitor 24 hours
- Enable globally

**3. Rollback Triggers:**
- More than 3 activation failures in 1 hour
- Database connection pool exhaustion (>80%)
- Any `ROLLBACK` errors in Sentry

**4. Monitoring:**
- Watch Sentry for transaction errors
- Check PostgreSQL connection pool
- Monitor Telegram alerts

---

## Risk Assessment (REVISED)

| Task | Risk | Likelihood | Impact | Mitigation |
|------|------|------------|--------|------------|
| 1.1 Transaction | **HIGH** | Medium | Critical | Feature flag, staged rollout |
| 1.2 Advisory Locks | MEDIUM | Low | High | Proper error handling for lock failure |
| 1.3 Circuit Breaker | **LOW** | Low | Medium | Reusing tested implementation |
| 2.1 Audit Trail | MEDIUM | Low | Medium | Migration rollback SQL |
| 2.2 Idempotency | LOW | Low | Low | Test with simulated retries |

---

## Success Metrics

**Before:**
- Grade: B+ (87/100)
- Transaction safety: 60%
- Race condition protection: 0%
- Service resilience: 70%

**After:**
- Grade: A (95/100)
- Transaction safety: 100%
- Race condition protection: 100%
- Service resilience: 95%

---

## Key Decisions (from plan review)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Circuit Breaker | Reuse existing | Already production-ready in codebase |
| Locking | Advisory locks | No need for existing row, cleaner intent |
| Idempotency hash | No timestamp | Deterministic for duplicate detection |
| Event logging | Outside transaction | Non-critical, shouldn't fail activation |
| Rate limiter | bottleneck | Already in package.json |

---

**Plan Status:** APPROVED WITH CHANGES (applied)
**Ready for implementation:** YES
**Estimated savings from plan review:** 4-6 hours + potential production incident
