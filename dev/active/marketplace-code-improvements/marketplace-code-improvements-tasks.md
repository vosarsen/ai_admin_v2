# YClients Marketplace Code Improvements - Tasks

**Last Updated:** 2025-12-02
**Status:** READY TO START

---

## Phase 1: Critical Fixes (5h)

### Task 1.1: Transaction Rollback for Activation Flow
**Priority:** CRITICAL | **Time:** 2h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:500-664`

**Problem:** API key может утечь при ошибке YClients API

**Subtasks:**
- [ ] Изучить текущий activation flow (lines 500-664)
- [ ] Создать withTransaction wrapper для activation
- [ ] Перенести все DB операции внутрь транзакции
- [ ] Добавить SELECT FOR UPDATE для company record
- [ ] Тест: Simulate YClients API failure → verify rollback
- [ ] Тест: Verify api_key NOT saved on failure
- [ ] Update Sentry tags for transaction errors
- [ ] Deploy and verify in production logs

**Code Location:**
```javascript
// Current (line 540-548): Save API key BEFORE YClients call
await companyRepository.update(company_id, {
  api_key: apiKey,  // ❌ Saved even if YClients fails!
  integration_status: 'activating'
});

// Target: Wrap in transaction
await companyRepository.withTransaction(async (txClient) => {
  // All operations atomic
});
```

---

### Task 1.2: Concurrent Activation Protection
**Priority:** HIGH | **Time:** 1h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:500-664`

**Problem:** Race condition при параллельных активациях

**Subtasks:**
- [ ] Добавить SELECT FOR UPDATE в начало транзакции
- [ ] Handle deadlock scenario (NOWAIT option)
- [ ] Return 409 Conflict для concurrent requests
- [ ] Log concurrent activation attempts to Sentry
- [ ] Integration test: Send 2 parallel requests
- [ ] Verify: One succeeds, one fails with 409

**Code Location:**
```javascript
// Add inside transaction (Task 1.1)
await txClient.query(
  'SELECT id FROM companies WHERE id = $1 FOR UPDATE NOWAIT',
  [company_id]
);
// If another transaction holds lock → throws error
```

---

### Task 1.3: QR Generation Circuit Breaker
**Priority:** MEDIUM-HIGH | **Time:** 2h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:391-433`

**Problem:** 38 секунд блокировки если Baileys недоступен

**Subtasks:**
- [ ] Создать class QRCircuitBreaker
- [ ] Implement states: CLOSED, OPEN, HALF_OPEN
- [ ] Configure: 5 failures → OPEN, 60s cooldown
- [ ] Wrap QR generation в circuit breaker
- [ ] Return 503 with retry_after когда OPEN
- [ ] Add Sentry alert при переходе в OPEN
- [ ] Manual test: Stop Baileys, verify fast fail
- [ ] Add health check endpoint for circuit state

**Code Location:**
```javascript
// New file: src/utils/circuit-breaker.js
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.cooldownPeriodMs = options.cooldownPeriodMs || 60000;
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    // Check state, execute, track failures
  }
}

// Usage in yclients-marketplace.js
const qrCircuitBreaker = new CircuitBreaker({ name: 'QR Generation' });

router.post('/marketplace/api/qr', async (req, res) => {
  await qrCircuitBreaker.execute(async () => {
    // ... QR generation logic ...
  });
});
```

---

## Phase 2: Important Improvements (6h)

### Task 2.1: Admin Audit Trail
**Priority:** MEDIUM | **Time:** 3h | **Status:** ⬜ Not Started

**Files:** routes, new migration

**Problem:** Admin действия не сохраняются в БД

**Subtasks:**
- [ ] Create migration: admin_audit_log table
- [ ] Add indexes: admin_id, created_at, action
- [ ] Create helper: logAdminAction(req, res, action, ...)
- [ ] Add to admin routes: disconnect, payment_link, channel_update
- [ ] Sanitize request body before logging (remove secrets)
- [ ] Add endpoint: GET /admin/audit-log (admin only)
- [ ] Test: Verify logs appear for all admin actions
- [ ] Add retention policy (90 days auto-cleanup)

**Schema:**
```sql
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

CREATE INDEX idx_admin_audit_admin_id ON admin_audit_log (admin_id);
CREATE INDEX idx_admin_audit_created_at ON admin_audit_log (created_at);
CREATE INDEX idx_admin_audit_action ON admin_audit_log (action);
```

---

### Task 2.2: Webhook Idempotency
**Priority:** MEDIUM | **Time:** 2h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:763-836`

**Problem:** Duplicate webhooks обрабатываются дважды

**Subtasks:**
- [ ] Generate webhook_id from event data + timestamp
- [ ] Store in Redis with TTL 1 hour
- [ ] Check before processing (NX flag)
- [ ] Skip duplicates with logging
- [ ] On error: Remove key (allow retry)
- [ ] Integration test: Send same webhook twice
- [ ] Verify: Only one event processed
- [ ] Add metrics: duplicate_webhooks_count

**Code Location:**
```javascript
// In webhook handler
const webhookId = crypto.createHash('sha256')
  .update(`${eventType}:${salon_id}:${JSON.stringify(data)}`)
  .digest('hex').substring(0, 16);

const isNew = await redis.set(`webhook:processed:${webhookId}`, '1', 'EX', 3600, 'NX');
if (!isNew) {
  logger.info('Duplicate webhook skipped', { webhookId });
  return;
}
```

---

### Task 2.3: Input Validation Warnings
**Priority:** LOW-MEDIUM | **Time:** 1h | **Status:** ⬜ Not Started

**File:** `src/utils/validators.js:70-83`

**Problem:** Silent truncation может потерять данные

**Subtasks:**
- [ ] Add options parameter to sanitizeString
- [ ] Implement logWarning option (default true)
- [ ] Log truncation with original/max length
- [ ] Update usages in marketplace routes
- [ ] Test: Long string → verify warning logged
- [ ] Backward compatibility: existing calls work

**Code:**
```javascript
function sanitizeString(input, maxLength = 255, options = {}) {
  const { logWarning = true, throwOnOverflow = false } = options;

  // ... sanitization ...

  if (clean.length > maxLength) {
    if (throwOnOverflow) {
      throw new Error(`String exceeds ${maxLength} chars`);
    }
    if (logWarning) {
      logger.warn('String truncated', {
        original: clean.length,
        max: maxLength
      });
    }
    return clean.substring(0, maxLength);
  }
  return clean;
}
```

---

## Phase 3: Nice to Have (5h)

### Task 3.1: Enhanced Health Check
**Priority:** LOW | **Time:** 1h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:842-881`

**Subtasks:**
- [ ] Add PostgreSQL connection test
- [ ] Add Redis ping test
- [ ] Add Baileys session pool status
- [ ] Return 503 if any service unhealthy
- [ ] Include latency metrics
- [ ] Add circuit breaker state

---

### Task 3.2: Standardized Error Handling
**Priority:** LOW | **Time:** 2h | **Status:** ⬜ Not Started

**File:** `src/services/marketplace/marketplace-service.js`

**Subtasks:**
- [ ] Define Result type: { success, data, error, code }
- [ ] Update all service methods
- [ ] Update route handlers to use Result
- [ ] Document error codes
- [ ] Test edge cases

---

### Task 3.3: Redis-based Rate Limiter
**Priority:** LOW | **Time:** 1h | **Status:** ⬜ Not Started

**File:** `src/api/routes/yclients-marketplace.js:44-95`

**Subtasks:**
- [ ] Replace in-memory Map with Redis
- [ ] Add per-salon rate limiting for webhooks
- [ ] Survive server restarts
- [ ] Work across multiple Node processes

---

### Task 3.4: Integration Tests
**Priority:** LOW | **Time:** 4h | **Status:** ⬜ Not Started

**File:** `tests/integration/marketplace/`

**Subtasks:**
- [ ] Test: Full activation flow (happy path)
- [ ] Test: Activation rollback on YClients failure
- [ ] Test: Concurrent activation (409 response)
- [ ] Test: Webhook idempotency
- [ ] Test: Circuit breaker open/close cycle
- [ ] Test: Admin audit logging

---

## Progress Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 (Critical) | 3 | 0 | ⬜ Not Started |
| Phase 2 (Important) | 3 | 0 | ⬜ Not Started |
| Phase 3 (Nice to Have) | 4 | 0 | ⬜ Not Started |
| **Total** | **10** | **0** | **0%** |

---

## Deployment Checklist

### Phase 1 Deployment
- [ ] All Phase 1 tasks completed
- [ ] Unit tests passing
- [ ] Manual testing in staging
- [ ] Code review approved
- [ ] Commit with descriptive message
- [ ] Deploy: `ssh ... && git pull && pm2 restart ai-admin-api`
- [ ] Verify: Health check passes
- [ ] Verify: No errors in Sentry
- [ ] Monitor: 30 min production observation

### Phase 2 Deployment
- [ ] All Phase 2 tasks completed
- [ ] Migration for admin_audit_log applied
- [ ] Test admin endpoints logging
- [ ] Deploy and verify

---

## Testing Commands

```bash
# Local testing
npm run test:marketplace

# Production health check
curl https://adminai.tech/marketplace/health | jq .

# Check logs
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-api --lines 50 --nostream | grep -E 'circuit|transaction|rollback'"

# Check Sentry
open https://glitchtip.adminai.tech
```

---

## Notes

- Начинаем после прохождения YClients модерации
- Phase 1 критичен для production stability
- Circuit breaker особенно важен (38s → instant fail)
- Audit trail нужен для compliance
