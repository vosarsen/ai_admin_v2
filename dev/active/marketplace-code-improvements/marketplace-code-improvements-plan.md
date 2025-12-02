# YClients Marketplace Code Improvements - Plan

**Created:** 2025-12-02
**Priority:** HIGH - Post-moderation improvements
**Source:** Code review by Claude Code Architecture Reviewer
**Overall Grade:** B+ (87/100) → Target: A (95/100)
**Estimated Time:** 16-20 hours total

---

## Executive Summary

После успешного прохождения модерации YClients Marketplace, необходимо исправить найденные проблемы для повышения надежности и безопасности системы.

**Текущее состояние:**
- Модерация в процессе (блокер: HMAC алгоритм неизвестен)
- Базовая безопасность реализована (санитизация, валидация)
- Collector endpoint работает
- Критические уязвимости закрыты, но архитектурные проблемы остаются

**Целевое состояние:**
- Атомарные транзакции для всех критических операций
- Защита от race conditions
- Circuit breaker для внешних сервисов
- Полный audit trail для админ-действий
- Idempotent webhook обработка

---

## Phase 1: Critical Fixes (Must Fix) - 5h

### Task 1.1: Transaction Rollback for Activation Flow
**Priority:** CRITICAL | **Time:** 2h | **File:** `yclients-marketplace.js:500-664`

**Problem:**
Если YClients API вызов падает ПОСЛЕ сохранения API key в БД, rollback может не сработать корректно. API key остается в базе - security leak.

**Solution:**
Обернуть весь activation flow в PostgreSQL транзакцию. При любой ошибке - полный откат.

**Key Changes:**
```javascript
await companyRepository.withTransaction(async (txClient) => {
  // 1. Save API key (in transaction)
  // 2. Call YClients API
  // 3. Finalize activation
  // If ANY step fails → automatic rollback
});
```

**Acceptance Criteria:**
- [ ] Activation flow использует withTransaction
- [ ] API key не сохраняется если YClients API падает
- [ ] Status корректно откатывается при ошибке
- [ ] Event логируется в marketplace_events
- [ ] Unit test для rollback сценария

---

### Task 1.2: Concurrent Activation Protection
**Priority:** HIGH | **Time:** 1h | **File:** `yclients-marketplace.js:500-664`

**Problem:**
Нет защиты от параллельных активаций одного salon_id. Race condition может привести к:
- Двум API ключам в YClients
- Inconsistent state в БД

**Solution:**
Использовать SELECT FOR UPDATE в транзакции для блокировки записи компании.

**Key Changes:**
```javascript
await txClient.query(
  'SELECT id FROM companies WHERE id = $1 FOR UPDATE',
  [company_id]
);
```

**Alternative (Redis lock):**
```javascript
const lockKey = `marketplace:activation:lock:${salonId}`;
await redis.set(lockKey, lockValue, 'PX', 30000, 'NX');
```

**Acceptance Criteria:**
- [ ] Concurrent requests для одного salon_id сериализуются
- [ ] Второй запрос получает 409 Conflict или ждет первый
- [ ] Lock автоматически освобождается через timeout
- [ ] Integration test для concurrent scenario

---

### Task 1.3: QR Generation Circuit Breaker
**Priority:** MEDIUM-HIGH | **Time:** 2h | **File:** `yclients-marketplace.js:391-433`

**Problem:**
Если Baileys сервис недоступен, каждый запрос на QR будет ждать до 38 секунд (10 retry × backoff). Это блокирует Node.js workers.

**Solution:**
Circuit Breaker pattern - после N failures, сразу возвращать 503 без ожидания.

**Key Changes:**
```javascript
class QRCircuitBreaker {
  state = 'CLOSED';  // CLOSED, OPEN, HALF_OPEN
  failureThreshold = 5;
  cooldownPeriodMs = 60000;

  async execute(fn) {
    if (this.state === 'OPEN' && !this.cooldownExpired()) {
      throw new Error('Circuit breaker OPEN');
    }
    // ... execute with tracking
  }
}
```

**Acceptance Criteria:**
- [ ] Circuit breaker class реализован
- [ ] После 5 failures → state = OPEN
- [ ] OPEN state возвращает 503 мгновенно
- [ ] После 60s cooldown → state = HALF_OPEN (retry one)
- [ ] Sentry alert при открытии circuit breaker
- [ ] Manual test: остановить Baileys, проверить поведение

---

## Phase 2: Important Improvements - 6h

### Task 2.1: Admin Audit Trail
**Priority:** MEDIUM | **Time:** 3h | **Files:** routes, new table

**Problem:**
Admin действия логируются в console но не сохраняются в БД. Невозможно провести forensics при инцидентах.

**Solution:**
Создать таблицу `admin_audit_log` и middleware для автоматического логирования.

**Key Changes:**
1. Migration: CREATE TABLE admin_audit_log
2. Middleware: logAdminAction(req, res, action, resourceType, resourceId)
3. Apply to all admin routes

**Schema:**
```sql
CREATE TABLE admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255),
  admin_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  request_body JSONB,
  response_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Acceptance Criteria:**
- [ ] Таблица создана с индексами
- [ ] Все admin routes логируют действия
- [ ] IP, user agent, request body сохраняются
- [ ] Query для просмотра recent actions

---

### Task 2.2: Webhook Idempotency
**Priority:** MEDIUM | **Time:** 2h | **File:** `yclients-marketplace.js:763-836`

**Problem:**
YClients может повторить webhook при timeout. Без idempotency check, один event может обработаться дважды.

**Solution:**
Генерировать webhook_id и проверять в Redis перед обработкой.

**Key Changes:**
```javascript
const webhookId = crypto.createHash('sha256')
  .update(`${eventType}:${salon_id}:${timestamp}`)
  .digest('hex').substring(0, 16);

const isNew = await redis.set(`webhook:${webhookId}`, '1', 'EX', 3600, 'NX');
if (!isNew) return { skipped: 'duplicate' };
```

**Acceptance Criteria:**
- [ ] Webhook ID генерируется для каждого события
- [ ] Duplicate webhooks игнорируются (logged)
- [ ] TTL 1 hour для Redis keys
- [ ] Integration test для duplicate scenario

---

### Task 2.3: Input Validation Warnings
**Priority:** LOW-MEDIUM | **Time:** 1h | **File:** `validators.js:70-83`

**Problem:**
`sanitizeString()` молча обрезает строки. Данные могут потеряться без уведомления.

**Solution:**
Добавить опцию `logWarning: true` для логирования truncation.

**Key Changes:**
```javascript
function sanitizeString(input, maxLength = 255, options = {}) {
  const { logWarning = true } = options;
  // ...
  if (clean.length > maxLength && logWarning) {
    logger.warn('String truncated', { original: clean.length, max: maxLength });
  }
}
```

**Acceptance Criteria:**
- [ ] sanitizeString принимает options object
- [ ] Truncation логируется если logWarning=true
- [ ] Backward compatible (default behavior сохранен)

---

## Phase 3: Nice to Have - 5h

### Task 3.1: Enhanced Health Check
**Priority:** LOW | **Time:** 1h | **File:** `yclients-marketplace.js:842-881`

**Problem:**
Health check проверяет только env variables, не тестирует реальные подключения.

**Solution:**
Добавить проверку PostgreSQL, Redis, Baileys connections.

---

### Task 3.2: Standardized Error Handling
**Priority:** LOW | **Time:** 2h | **File:** `marketplace-service.js`

**Problem:**
Методы сервиса по-разному обрабатывают ошибки (throw vs return null vs fallback).

**Solution:**
Стандартизировать: все service методы возвращают `{ success, data, error }`.

---

### Task 3.3: Rate Limiter per Salon
**Priority:** LOW | **Time:** 1h | **File:** routes

**Problem:**
Rate limiter только по IP. Один salon может флудить webhooks с разных IP.

**Solution:**
Добавить rate limit по salon_id для webhook endpoint.

---

### Task 3.4: Integration Tests
**Priority:** LOW | **Time:** 4h | **File:** tests/

**Problem:**
Нет integration tests для critical flows.

**Solution:**
- Test: Full activation flow
- Test: Concurrent activation
- Test: Webhook idempotency
- Test: Circuit breaker

---

## Implementation Order

```
Week 1 (Critical):
├── Day 1: Task 1.1 - Transaction Rollback (2h)
├── Day 1: Task 1.2 - Concurrent Protection (1h)
└── Day 2: Task 1.3 - Circuit Breaker (2h)

Week 2 (Important):
├── Day 3: Task 2.1 - Admin Audit Trail (3h)
├── Day 4: Task 2.2 - Webhook Idempotency (2h)
└── Day 4: Task 2.3 - Input Validation Warnings (1h)

Week 3 (Nice to Have):
├── Day 5: Task 3.1 - Health Check (1h)
├── Day 5: Task 3.2 - Error Handling (2h)
├── Day 6: Task 3.3 - Rate Limiter (1h)
└── Day 6: Task 3.4 - Integration Tests (4h)
```

---

## Risk Assessment

| Task | Risk | Mitigation |
|------|------|------------|
| 1.1 Transaction | Breaking activation flow | Extensive testing, feature flag |
| 1.2 Concurrent | Deadlock possible | Use FOR UPDATE NOWAIT with timeout |
| 1.3 Circuit Breaker | False positives | Conservative thresholds, monitoring |
| 2.1 Audit | Performance overhead | Async logging, batch inserts |
| 2.2 Idempotency | Redis failures | Graceful degradation (process anyway) |

---

## Success Metrics

**Before (Current):**
- Grade: B+ (87/100)
- Transaction safety: 60%
- Race condition protection: 0%
- Service resilience: 70%

**After (Target):**
- Grade: A (95/100)
- Transaction safety: 100%
- Race condition protection: 100%
- Service resilience: 95%

---

## Dependencies

1. **PostgreSQL** - withTransaction() support (already exists)
2. **Redis** - For locks and idempotency (already configured)
3. **Sentry** - For circuit breaker alerts (already integrated)
4. **Baileys** - For circuit breaker testing (manual test)

---

## Notes

- Модерация YClients блокирована неизвестным HMAC алгоритмом
- После прохождения модерации, сразу начинаем Phase 1
- Circuit breaker особенно важен для production stability
- Audit trail нужен для compliance

---

**Document Owner:** Claude Code
**Review Status:** Ready for implementation
