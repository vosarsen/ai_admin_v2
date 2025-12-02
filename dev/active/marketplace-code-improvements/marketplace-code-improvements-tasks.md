# YClients Marketplace Code Improvements - Tasks (REVISED)

**Last Updated:** 2025-12-02
**Status:** PHASE 1 + PHASE 2 COMPLETE
**Review Status:** APPROVED WITH CHANGES (applied)

---

## Phase 1: Critical Fixes (5h)

### Task 1.1: Transaction Rollback for Activation Flow
**Priority:** CRITICAL | **Time:** 3-4h | **Status:** ✅ COMPLETE

**File:** `src/api/routes/yclients-marketplace.js:500-664`

**Problems:**
1. API key может утечь при ошибке YClients API
2. **[NEW]** Variable scope bug: `company_id` и `salon_id` могут быть undefined в catch block

**Subtasks:**

**Step 1: Fix variable scope (30min)**
- [ ] Объявить `let salon_id, company_id;` в начале функции
- [ ] Присваивать после jwt.verify: `salon_id = decoded.salon_id;`
- [ ] Проверить все места где используются в catch block

**Step 2: Wrap in transaction (1.5h)**
- [ ] Импортировать `companyRepository.withTransaction`
- [ ] Обернуть весь activation flow в транзакцию
- [ ] Использовать `txClient.query()` для всех DB операций внутри
- [ ] Добавить advisory lock (Task 1.2) внутрь транзакции

**Step 3: Move event logging outside (30min)**
- [ ] Вынести `marketplaceEventsRepository.insert()` ПОСЛЕ транзакции
- [ ] Обернуть в try-catch (non-critical)
- [ ] Логировать ошибку в Sentry но не падать

**Step 4: Add feature flag (15min)**
- [ ] Добавить `USE_TRANSACTION_ACTIVATION` в .env
- [ ] Реализовать if/else для старого и нового кода
- [ ] Документировать в .env.example

**Step 5: Write unit test (45min)**
- [ ] Тест: YClients API возвращает ошибку → API key НЕ сохранен
- [ ] Тест: DB rollback срабатывает корректно
- [ ] Тест: Event logging падает → активация все равно успешна

**Code Location:**
```javascript
// Current (buggy):
router.post('/marketplace/activate', async (req, res) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { salon_id, company_id } = decoded;  // ❌ Scope limited to try block
    // ...
  } catch (error) {
    if (company_id) {  // ❌ company_id undefined here!
      // ...
    }
  }
});

// Fixed:
router.post('/marketplace/activate', async (req, res) => {
  let salon_id, company_id;  // ✅ Function scope

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    salon_id = decoded.salon_id;      // ✅ Assign after verification
    company_id = decoded.company_id;
    // ...
  } catch (error) {
    if (company_id) {  // ✅ Now accessible
      // ...
    }
  }
});
```

---

### Task 1.2: Concurrent Activation Protection (Advisory Locks)
**Priority:** HIGH | **Time:** 1h | **Status:** ✅ COMPLETE (merged with 1.1)

**File:** `src/api/routes/yclients-marketplace.js:500-664`

**Problem:** Race condition при параллельных активациях одного salon_id

**Subtasks:**

**Step 1: Add advisory lock (15min)**
- [ ] Добавить внутрь транзакции (после BEGIN):
```javascript
const lockResult = await txClient.query(
  'SELECT pg_try_advisory_xact_lock($1)',
  [parseInt(salon_id)]
);
```
- [ ] Lock автоматически освобождается при COMMIT/ROLLBACK

**Step 2: Handle lock failure (15min)**
- [ ] Проверить результат: `lockResult.rows[0].pg_try_advisory_xact_lock`
- [ ] Если false → return 409 Conflict
- [ ] Добавить retry_after: 5 секунд
- [ ] Логировать в Sentry как warning (не error)

**Step 3: Integration test (30min)**
- [ ] Создать тест с двумя параллельными запросами
- [ ] Проверить: один 200 OK, один 409 Conflict
- [ ] Проверить: API key сохранен только один раз

**Code:**
```javascript
// Inside transaction, FIRST operation
const lockResult = await txClient.query(
  'SELECT pg_try_advisory_xact_lock($1)',
  [parseInt(salon_id)]
);

if (!lockResult.rows[0].pg_try_advisory_xact_lock) {
  logger.warn('Concurrent activation attempt blocked', { salon_id });
  return res.status(409).json({
    error: 'Activation already in progress',
    code: 'CONCURRENT_ACTIVATION',
    retry_after: 5
  });
}
```

---

### Task 1.3: QR Generation Circuit Breaker (REUSE EXISTING)
**Priority:** MEDIUM-HIGH | **Time:** 30min | **Status:** ✅ COMPLETE

**File:** `src/api/routes/yclients-marketplace.js:391-433`

**Problem:** 38 секунд блокировки если Baileys недоступен

**ВАЖНО:** CircuitBreaker УЖЕ СУЩЕСТВУЕТ в `src/utils/circuit-breaker.js`!

**Subtasks:**

**Step 1: Import existing CircuitBreaker (5min)**
- [ ] Добавить import:
```javascript
const { getCircuitBreaker } = require('../../utils/circuit-breaker');
```
- [ ] Создать instance:
```javascript
const qrCircuitBreaker = getCircuitBreaker('qr-generation', {
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 30000,
  successThreshold: 2
});
```

**Step 2: Configure for QR generation (10min)**
- [ ] Обернуть QR логику в `qrCircuitBreaker.execute()`
- [ ] Уменьшить attempts с 10 до 5 (circuit breaker добавляет защиту)
- [ ] Обработать `error.code === 'CIRCUIT_OPEN'` → 503

**Step 3: Add to health check (15min)**
- [ ] Добавить в `/marketplace/health`:
```javascript
checks.circuitBreakers = {
  qrGeneration: qrCircuitBreaker.getState()
};
```
- [ ] Включить: state, failures, nextAttempt

**Existing CircuitBreaker API:**
```javascript
// Execute with protection
await circuitBreaker.execute(async () => { ... });

// Get current state
circuitBreaker.getState(); // { state, failures, successes, nextAttempt, lastError }

// Get statistics
circuitBreaker.getStats(); // { totalRequests, successRate, recentStateChanges }

// Manual reset
circuitBreaker.reset();

// Check availability
circuitBreaker.isAvailable(); // boolean
```

---

## Phase 2: Important Improvements (7h)

### Task 2.1: Admin Audit Trail
**Priority:** MEDIUM | **Time:** 4h | **Status:** ✅ COMPLETE

**Files:** routes, new migration

**Subtasks:**

**Step 1: Create migration (1h)**
- [ ] Создать файл `migrations/003_admin_audit_log.sql`
- [ ] Создать таблицу с колонками (см. план)
- [ ] Добавить composite index для lookup
- [ ] Добавить index для cleanup job
- [ ] Добавить rollback SQL в комментариях

**Step 2: Create helper function (1h)**
- [ ] Создать `logAdminAction(req, res, action, resourceType, resourceId)`
- [ ] Санитизировать request body (убрать password, token, api_key)
- [ ] Не падать если логирование не удалось
- [ ] Добавить в отдельный файл `src/utils/admin-audit.js`

**Step 3: Apply to admin routes (1h)**
- [ ] `/marketplace/admin/salon/:salonId/disconnect`
- [ ] `/marketplace/admin/salon/:salonId/payment-link`
- [ ] `/marketplace/admin/salon/:salonId/channel`
- [ ] Другие admin endpoints

**Step 4: Add view endpoint (30min)**
- [ ] `GET /marketplace/admin/audit-log`
- [ ] Фильтры: admin_id, action, date_from, date_to
- [ ] Пагинация: limit, offset
- [ ] Только для superadmin

**Step 5: Retention policy (30min)**
- [ ] Создать скрипт cleanup в `scripts/`
- [ ] Удалять записи старше 90 дней
- [ ] Добавить в PM2 cron (ежедневно в 4:00)

---

### Task 2.2: Webhook Idempotency (REVISED)
**Priority:** MEDIUM | **Time:** 2h | **Status:** ✅ COMPLETE

**File:** `src/api/routes/yclients-marketplace.js:763-836`

**ВАЖНО:** Убрать timestamp из hash!

**Subtasks:**

**Step 1: Generate deterministic webhook ID (30min)**
- [ ] Hash БЕЗ timestamp:
```javascript
const webhookId = crypto.createHash('sha256')
  .update(`${eventType}:${salon_id}:${JSON.stringify(data)}`)
  .digest('hex').substring(0, 16);
```
- [ ] Логировать webhookId для отладки

**Step 2: Implement Redis check (30min)**
- [ ] Получить Redis client
- [ ] `SET key 1 EX 3600 NX` для atomic check-and-set
- [ ] Если null → duplicate, skip processing
- [ ] Return 200 OK с `skipped: 'duplicate'`

**Step 3: Handle processing errors (30min)**
- [ ] Если обработка падает → удалить key из Redis
- [ ] Это позволит retry от YClients
- [ ] Логировать retry allowance

**Step 4: Test (30min)**
- [ ] Отправить webhook дважды
- [ ] Проверить: только один event в БД
- [ ] Проверить: Redis key существует 1 час

---

### Task 2.3: Input Validation Warnings
**Priority:** LOW-MEDIUM | **Time:** 1h | **Status:** ✅ COMPLETE

**File:** `src/utils/validators.js:70-83`

**Subtasks:**

**Step 1: Add options parameter (20min)**
- [ ] Изменить сигнатуру: `sanitizeString(input, maxLength = 255, options = {})`
- [ ] Добавить `{ logWarning = true, throwOnOverflow = false }`
- [ ] Backward compatible: старые вызовы работают

**Step 2: Implement warning logic (20min)**
- [ ] Проверять length ПОСЛЕ sanitization
- [ ] Если overflow и throwOnOverflow → throw Error
- [ ] Если overflow и logWarning → logger.warn

**Step 3: Update usages (20min)**
- [ ] Проверить все вызовы sanitizeString в codebase
- [ ] При необходимости добавить `{ logWarning: false }` где не нужно

---

## Phase 3: Nice to Have (6h)

### Task 3.1: Enhanced Health Check
**Priority:** LOW | **Time:** 1.5h | **Status:** ✅ COMPLETE

**Subtasks:**
- [x] Добавить timeout wrapper для всех проверок
- [x] PostgreSQL connection test с latency
- [x] Redis ping test с latency
- [x] Circuit breaker states
- [x] Return 503 если критические сервисы unhealthy

---

### Task 3.2: Standardized Error Handling
**Priority:** LOW | **Time:** 2h | **Status:** ✅ COMPLETE

**Subtasks:**
- [x] Определить Result type: `{ success, data, error, code }`
- [x] Создан `src/utils/result.js` с Rust-inspired Result pattern
- [x] ErrorCodes с HTTP status mapping
- [x] Документирован в JSDoc

---

### Task 3.3: Rate Limiter per Salon
**Priority:** LOW | **Time:** 1h | **Status:** ✅ COMPLETE

**Subtasks:**
- [x] Использовать существующий RateLimiter в `src/utils/rate-limiter.js`
- [x] Создать per-key limiter factory (getPerKeyLimiter)
- [x] Создать middleware factory (rateLimitMiddleware)
- [x] Применить к webhook endpoint (10 req/min per salon)

---

### Task 3.4: Integration Tests
**Priority:** LOW | **Time:** 1.5h | **Status:** ✅ COMPLETE

**Subtasks:**
- [x] Test: Result type (14 tests)
- [x] Test: ErrorCodes validation (2 tests)
- [x] Test: RateLimiter (5 tests)
- [x] Test: CircuitBreaker integration (2 tests)
- [x] Test: Webhook idempotency (3 tests)
- [x] Test: Admin audit (3 tests)
- [x] **Total: 30 tests passing**

---

## Progress Summary

| Phase | Tasks | Completed | Status |
|-------|-------|-----------|--------|
| Phase 1 (Critical) | 3 | 3 | ✅ COMPLETE |
| Phase 2 (Important) | 3 | 3 | ✅ COMPLETE |
| Phase 3 (Nice to Have) | 4 | 4 | ✅ COMPLETE |
| **Total** | **10** | **10** | **100%** |

---

## Deployment Checklist

### Phase 1 Pre-Deployment
- [ ] All Phase 1 subtasks completed
- [ ] Unit tests passing
- [ ] Feature flag `USE_TRANSACTION_ACTIVATION=false` in .env
- [ ] Code review approved
- [ ] Commit with descriptive message

### Phase 1 Deployment
- [ ] Deploy: `ssh ... && git pull && pm2 restart ai-admin-api`
- [ ] Verify: Health check passes
- [ ] Verify: No errors in Sentry (5 min observation)

### Phase 1 Staged Rollout
- [ ] Enable flag for test salon 997441 only
- [ ] Test activation flow manually
- [ ] Monitor 24 hours
- [ ] Enable globally: `USE_TRANSACTION_ACTIVATION=true`
- [ ] Monitor additional 24 hours

### Rollback Triggers
- [ ] More than 3 activation failures in 1 hour → disable flag
- [ ] Database connection pool >80% → disable flag
- [ ] Any ROLLBACK errors in Sentry → disable flag

---

## Testing Commands

```bash
# Local testing
npm run test:marketplace

# Production health check
curl https://adminai.tech/marketplace/health | jq .

# Check circuit breaker state
curl https://adminai.tech/marketplace/health | jq '.circuitBreakers'

# Check logs for transaction
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "pm2 logs ai-admin-api --lines 50 --nostream | grep -E 'transaction|advisory|ROLLBACK'"

# Test concurrent activation (run in two terminals)
curl -X POST https://adminai.tech/marketplace/activate -d '{"token":"..."}' &
curl -X POST https://adminai.tech/marketplace/activate -d '{"token":"..."}' &
# One should return 409

# Check Sentry
open https://glitchtip.adminai.tech
```

---

## Key Changes from Plan Review

| Original | Revised | Reason |
|----------|---------|--------|
| Create new CircuitBreaker | Reuse existing | Already exists in `src/utils/circuit-breaker.js` |
| FOR UPDATE NOWAIT | Advisory locks | No need for existing row, cleaner |
| Timestamp in webhook hash | No timestamp | Deterministic duplicate detection |
| Event logging in transaction | Outside transaction | Non-critical, shouldn't fail activation |
| Task 1.3: 2h | Task 1.3: 30min | Just integration, not building |
| Task 1.1: 2h | Task 1.1: 3-4h | Variable scope fix + testing |

---

## Notes

- Начинаем после прохождения YClients модерации
- Phase 1 критичен для production stability
- Feature flag обязателен для Task 1.1
- Staged rollout: test salon → all salons
- Circuit breaker уже production-ready, просто интегрируем
