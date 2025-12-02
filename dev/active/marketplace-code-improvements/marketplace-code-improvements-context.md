# YClients Marketplace Code Improvements - Context (REVISED)

**Last Updated:** 2025-12-02
**Status:** READY TO START (после модерации)
**Current Phase:** Pre-implementation
**Review Status:** APPROVED WITH CHANGES (applied)

---

## Current Situation

### Code Review Completed
- **Grade:** B+ (87/100) → Target: A (95/100)
- **Reviewer:** Claude Code Architecture Reviewer
- **Files Reviewed:** ~2,100 lines across 4 main files
- **Full Report:** `dev/active/marketplace-code-review/marketplace-code-review.md`

### Plan Review Completed
- **Verdict:** APPROVE WITH CHANGES
- **Reviewer:** Plan Reviewer Agent
- **Key Findings:** 5 critical issues, several optimizations
- **Estimated Savings:** 4-6 hours + potential production incident

### Parallel Work: YClients Moderation
- **Status:** IN PROGRESS (blocking HMAC algorithm unknown)
- **Docs:** `dev/active/marketplace-security-fixes/`
- **Moderator:** Филипп Щигарцов (f.schigartcov@yclients.tech)
- **Test Salon:** ID 997441

---

## Key Findings from Plan Review

### Critical Issues Found (MUST FIX)

| # | Issue | Impact | Resolution |
|---|-------|--------|------------|
| 1 | **CircuitBreaker already exists** | Waste 2h building duplicate | Reuse `src/utils/circuit-breaker.js` |
| 2 | **Variable scope bug** | Production crash in catch block | Declare at function scope |
| 3 | **FOR UPDATE locks wrong key** | Concurrent protection ineffective | Use advisory locks by salon_id |
| 4 | **Timestamp in idempotency hash** | Duplicates still processed | Remove timestamp |
| 5 | **Event logging in transaction** | Activation fails on log error | Move outside transaction |

### Revised Estimates

| Task | Original | Revised | Delta |
|------|----------|---------|-------|
| 1.1 Transaction | 2h | 3-4h | +1-2h (scope fix) |
| 1.3 Circuit Breaker | 2h | 30min | -1.5h (reuse) |
| **Total** | 16-20h | 15-18h | -2h |

---

## Architecture Decisions (UPDATED)

### Decision 1: Database Lock Method
**Question:** FOR UPDATE или Advisory Locks?

**Chosen:** PostgreSQL Advisory Locks
**Rationale:**
- Не требует существующей записи в БД
- Блокировка по salon_id (integer) напрямую
- Явное намерение (locking, не reading)
- Меньше риск deadlock

**Implementation:**
```javascript
const lockResult = await txClient.query(
  'SELECT pg_try_advisory_xact_lock($1)',
  [parseInt(salon_id)]
);
```

### Decision 2: Circuit Breaker
**Question:** Создать новый или использовать существующий?

**Chosen:** Reuse existing `src/utils/circuit-breaker.js`
**Rationale:**
- Уже production-ready
- Поддерживает все нужные features
- Singleton factory для переиспользования
- Экономия 1.5 часов разработки

### Decision 3: Idempotency Hash
**Question:** Включать timestamp или нет?

**Chosen:** БЕЗ timestamp
**Rationale:**
- С timestamp: два одинаковых webhook 1ms apart → разные ID → оба обработаны
- Без timestamp: идентичные webhooks → один ID → второй skipped

### Decision 4: Event Logging
**Question:** Внутри или вне транзакции?

**Chosen:** ВНЕ транзакции
**Rationale:**
- Event logging некритичен
- Если logging падает, не должен отменять успешную активацию
- YClients API call уже произошел - его не откатишь

---

## Technical Context

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/api/routes/yclients-marketplace.js` | Main marketplace routes | ~1350 |
| `src/utils/circuit-breaker.js` | **EXISTING** Circuit Breaker | ~292 |
| `src/repositories/BaseRepository.js` | withTransaction method | ~150 |
| `src/services/marketplace/marketplace-service.js` | Business logic | ~785 |

### Existing Patterns to Reuse

**1. CircuitBreaker (existing):**
```javascript
const { getCircuitBreaker } = require('../../utils/circuit-breaker');

const cb = getCircuitBreaker('qr-generation', {
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 30000
});

await cb.execute(async () => { /* operation */ });
```

**2. Transaction Pattern (existing in BaseRepository):**
```javascript
await repository.withTransaction(async (txClient) => {
  await txClient.query('SELECT ... FOR UPDATE');
  await txClient.query('UPDATE ...');
  // Auto-commit on success, auto-rollback on error
});
```

**3. Advisory Lock Pattern:**
```javascript
const lockResult = await txClient.query(
  'SELECT pg_try_advisory_xact_lock($1)',
  [lockId]
);
if (!lockResult.rows[0].pg_try_advisory_xact_lock) {
  return res.status(409).json({ error: 'Already in progress' });
}
```

---

## Variable Scope Bug Details

**Current Code (buggy):**
```javascript
router.post('/marketplace/activate', async (req, res) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { salon_id, company_id } = decoded;  // ❌ Scope limited to try
    // ...
  } catch (error) {
    if (company_id) {  // ❌ ReferenceError: company_id is not defined!
      await companyRepository.update(company_id, {...});
    }
  }
});
```

**Why it's dangerous:**
1. Если `jwt.verify` выбрасывает ошибку (expired, invalid)
2. Попадаем в catch block
3. `company_id` не определена → ReferenceError
4. Весь error handler падает
5. Пользователь видит 500 вместо нормального сообщения

**Fix:**
```javascript
router.post('/marketplace/activate', async (req, res) => {
  let salon_id, company_id;  // ✅ Function scope

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    salon_id = decoded.salon_id;
    company_id = decoded.company_id;
    // ...
  } catch (error) {
    if (company_id) {  // ✅ Safe - either undefined or valid
      await companyRepository.update(company_id, {...});
    }
  }
});
```

---

## Deployment Strategy

### Feature Flag Approach
```javascript
const USE_TRANSACTION_ACTIVATION = process.env.USE_TRANSACTION_ACTIVATION === 'true';

if (USE_TRANSACTION_ACTIVATION) {
  // New transaction-based code
} else {
  // Old code (fallback)
}
```

### Staged Rollout
1. Deploy with `USE_TRANSACTION_ACTIVATION=false`
2. Enable for test salon 997441
3. Monitor 24 hours
4. Enable globally
5. Monitor 24 hours
6. Remove feature flag (optional)

### Rollback Triggers
- 3+ activation failures in 1 hour
- Connection pool >80%
- ROLLBACK errors in Sentry

---

## Session Log

### Session 1 (2025-12-02)
- Code review agent: Grade B+ (87/100)
- 10 issues found (3 critical, 3 important, 4 minor)
- Created dev-docs

### Session 2 (2025-12-02)
- Plan review agent: APPROVE WITH CHANGES
- Found 5 critical issues in plan
- Discovered existing CircuitBreaker
- Updated all docs with revisions

---

## Blockers

1. **YClients Moderation** - Нужно дождаться прохождения модерации
2. **HMAC Algorithm** - Неизвестен алгоритм подписи (блокирует модерацию)

---

## Related Documentation

- **Code Review:** `dev/active/marketplace-code-review/marketplace-code-review.md`
- **Security Fixes:** `dev/active/marketplace-security-fixes/`
- **CircuitBreaker:** `src/utils/circuit-breaker.js`
- **BaseRepository:** `src/repositories/BaseRepository.js`

---

## Next Steps

1. [ ] Дождаться ответа от модератора по HMAC
2. [ ] После модерации: начать Phase 1 (Critical Fixes)
3. [ ] Task 1.1: Fix variable scope + Transaction
4. [ ] Task 1.2: Advisory locks
5. [ ] Task 1.3: Circuit breaker integration
6. [ ] Deploy with feature flag
7. [ ] Staged rollout
