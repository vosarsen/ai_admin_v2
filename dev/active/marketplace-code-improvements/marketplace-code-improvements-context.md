# YClients Marketplace Code Improvements - Context

**Last Updated:** 2025-12-02
**Status:** READY TO START (после модерации)
**Current Phase:** Pre-implementation

---

## Current Situation

### Code Review Completed
- **Grade:** B+ (87/100)
- **Reviewer:** Claude Code Architecture Reviewer
- **Files Reviewed:** ~2,100 lines across 4 main files
- **Full Report:** `dev/active/marketplace-code-review/marketplace-code-review.md`

### Parallel Work: YClients Moderation
- **Status:** IN PROGRESS (blocking HMAC algorithm unknown)
- **Docs:** `dev/active/marketplace-security-fixes/`
- **Moderator:** Филипп Щигарцов (f.schigartcov@yclients.tech)
- **Test Salon:** ID 997441

---

## Key Findings from Code Review

### Critical Issues (3)

| # | Issue | File | Lines | Status |
|---|-------|------|-------|--------|
| 1 | Transaction Rollback Incomplete | yclients-marketplace.js | 630-657 | ⬜ TODO |
| 2 | Missing Concurrent Activation Protection | yclients-marketplace.js | 500-664 | ⬜ TODO |
| 3 | QR Generation Lacks Circuit Breaker | yclients-marketplace.js | 391-433 | ⬜ TODO |

### Important Issues (3)

| # | Issue | File | Status |
|---|-------|------|--------|
| 4 | Admin Authentication Lacks Audit Trail | routes | ⬜ TODO |
| 5 | Input Validation Silent Truncation | validators.js | ⬜ TODO |
| 6 | Webhook Handler Missing Idempotency | webhooks | ⬜ TODO |

### Minor Issues (4)

| # | Issue | Status |
|---|-------|--------|
| 7 | Rate Limiter In-Memory | ⬜ TODO |
| 8 | Health Check Incomplete | ⬜ TODO |
| 9 | Error Messages Leak Details | ⬜ TODO |
| 10 | Inconsistent Error Handling | ⬜ TODO |

---

## Architecture Decisions

### Decision 1: Database Lock vs Redis Lock
**Question:** Для concurrent activation protection использовать PostgreSQL FOR UPDATE или Redis distributed lock?

**Chosen:** PostgreSQL FOR UPDATE
**Rationale:**
- Уже используем transaction для activation
- Не добавляет новую зависимость
- Атомарно с остальными DB операциями
- Redis lock нужен только для multi-node deployment

### Decision 2: Circuit Breaker Implementation
**Question:** Использовать библиотеку (opossum) или custom implementation?

**Chosen:** Custom implementation
**Rationale:**
- Простая логика (CLOSED → OPEN → HALF_OPEN)
- Нет лишних зависимостей
- Легко настроить под наши нужды
- 50 lines of code vs npm dependency

### Decision 3: Audit Log Storage
**Question:** Хранить audit logs в PostgreSQL или отдельном сервисе?

**Chosen:** PostgreSQL
**Rationale:**
- Единая база данных
- Легко делать JOIN с companies/marketplace_events
- Compliance: данные в РФ (152-ФЗ)
- Retention policy через cron job

---

## Technical Context

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/api/routes/yclients-marketplace.js` | Main marketplace routes | ~1350 |
| `src/services/marketplace/marketplace-service.js` | Business logic | ~785 |
| `src/repositories/CompanyRepository.js` | Company DB operations | ~262 |
| `src/repositories/MarketplaceEventsRepository.js` | Event logging | ~119 |
| `src/utils/validators.js` | Input validation | ~150 |

### Existing Patterns to Follow

**Transaction Pattern:**
```javascript
// CompanyRepository.withTransaction() - уже существует
await companyRepository.withTransaction(async (txClient) => {
  await txClient.query('UPDATE...', [params]);
  await txClient.query('INSERT...', [params]);
  // Auto-commit on success, auto-rollback on error
});
```

**Sentry Integration:**
```javascript
Sentry.captureException(error, {
  tags: { component: 'marketplace', operation: 'activate' },
  extra: { salon_id, company_id }
});
```

**Logger Usage:**
```javascript
logger.info('✅ Operation success', { context });
logger.error('❌ Operation failed:', error);
logger.warn('⚠️ Warning:', { details });
```

---

## Environment

### Production Server
- **Host:** 46.149.70.219
- **Path:** /opt/ai-admin
- **PM2:** ai-admin-api
- **Deploy:** `git pull && pm2 restart ai-admin-api`

### Database
- **PostgreSQL:** Timeweb (a84c973324fdaccfc68d929d.twc1.net)
- **Redis:** localhost:6379 (для sessions, rate limiting)

### External Services
- **YClients API:** https://api.yclients.com
- **Baileys:** WhatsApp session pool
- **Sentry:** Error tracking

---

## Related Documentation

- **Code Review:** `dev/active/marketplace-code-review/marketplace-code-review.md`
- **Security Fixes:** `dev/active/marketplace-security-fixes/`
- **YClients API:** `docs/01-architecture/integrations/YCLIENTS_API.md`
- **Repository Pattern:** `docs/02-guides/repositories/`

---

## Session Log

### Session 1 (2025-12-02)
- Code review agent выполнил полный анализ
- Grade: B+ (87/100)
- Найдено 10 issues (3 critical, 3 important, 4 minor)
- Создан /dev-docs для планомерного исправления

---

## Blockers

1. **YClients Moderation** - Нужно дождаться прохождения модерации перед deployment
2. **HMAC Algorithm** - Неизвестен алгоритм подписи (блокирует модерацию)

---

## Next Steps

1. [ ] Дождаться ответа от модератора по HMAC
2. [ ] После модерации: начать Phase 1 (Critical Fixes)
3. [ ] Task 1.1: Transaction Rollback
4. [ ] Task 1.2: Concurrent Protection
5. [ ] Task 1.3: Circuit Breaker
