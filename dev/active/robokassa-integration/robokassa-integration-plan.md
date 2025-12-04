# Robokassa Payment Integration Plan

**Last Updated:** 2025-12-04 (Updated after Plan Review)
**Status:** Planning Complete, Ready for Implementation
**Priority:** High
**Estimated Effort:** ~14 hours (updated after review)
**Review Status:** ✅ APPROVED WITH REQUIRED CHANGES

---

## Plan Review Summary

План прошёл ревью и получил статус **APPROVED WITH REQUIRED CHANGES**.

### Критические проблемы (исправлены в плане)

| # | Проблема | Решение |
|---|----------|---------|
| 1 | Webhook отвечал ДО верификации | ✅ Отвечать `OK{InvId}` только ПОСЛЕ проверки |
| 2 | Не было проверки суммы | ✅ Добавлена верификация OutSum vs DB amount |
| 3 | Дубликаты не обрабатывались | ✅ Добавлен idempotency check |
| 4 | Нет middleware для form data | ✅ Добавлен `express.urlencoded()` |

### Предупреждения (учтены)

- MD5 signature case-sensitive → toUpperCase() обязательно
- Invoice ID формат → использовать 13-digit (timestamp + 3 random)
- Rate limiting на Result URL → добавлено
- Content-Type: text/plain → обязательно
- Timeout handling (30 сек) → добавлено
- Транзакции в processPayment → обязательно

---

## Executive Summary

Интеграция платежного шлюза Robokassa для приёма прямых платежей от салонов красоты за подписку Admin AI. Проект включает создание webhook handler для приёма уведомлений о платежах, сервис для генерации ссылок на оплату, фронтенд страницы успеха/ошибки, и систему хранения платежей в PostgreSQL.

### Ключевые решения
- **Источник платежей:** Напрямую от салонов (не через YClients Marketplace)
- **Режим:** Тестовый → затем боевой
- **Алгоритм хеша:** MD5 (настроено в панели Robokassa)
- **Фискализация:** 54-ФЗ (УСН Доходы)

---

## Current State Analysis

### Существующая инфраструктура

| Компонент | Статус | Файл |
|-----------|--------|------|
| Robokassa Config | ✅ Готов | `src/config/robokassa-config.js` (180 строк) |
| Webhook patterns | ✅ Есть примеры | `src/api/webhooks/yclients.js`, `telegram.js` |
| Repository pattern | ✅ Используется | `src/repositories/BaseRepository.js` |
| PostgreSQL | ✅ Активен | Timeweb PostgreSQL (миграция Nov 2025) |
| Sentry tracking | ✅ Интегрирован | 50+ мест в коде |
| YClients payment notify | ✅ Работает | `src/services/marketplace/marketplace-service.js` |
| DB Migration | ✅ Создан | `migrations/20251204_create_robokassa_payments.sql` |

### Что отсутствует
- ❌ Webhook handler для Robokassa Result URL
- ❌ Сервис генерации платёжных ссылок
- ❌ Страницы Success/Fail
- ❌ Environment variables для паролей

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Payment Flow (CORRECTED)                     │
└─────────────────────────────────────────────────────────────────┘

Admin Panel                    Robokassa                   AI Admin
    │                              │                           │
    │  1. Generate Payment Link    │                           │
    │ ─────────────────────────────────────────────────────────>│
    │                              │                           │
    │  2. Redirect to Robokassa   │                           │
    │<─────────────────────────────│                           │
    │                              │                           │
    │  3. User completes payment   │                           │
    │ ─────────────────────────────>│                           │
    │                              │                           │
    │                              │  4. Result URL (POST)     │
    │                              │ ─────────────────────────>│
    │                              │     OutSum, InvId,        │
    │                              │     SignatureValue        │
    │                              │                           │
    │                              │  ┌─────────────────────┐  │
    │                              │  │ 1. Verify signature │  │
    │                              │  │ 2. Check amount     │  │
    │                              │  │ 3. Check duplicate  │  │
    │                              │  │ 4. Update DB        │  │
    │                              │  │ 5. Respond OK{InvId}│  │
    │                              │  └─────────────────────┘  │
    │                              │                           │
    │                              │  5. "OK12345" (text/plain)│
    │                              │<─────────────────────────│
    │                              │                           │
    │  6. Redirect Success/Fail    │                           │
    │<─────────────────────────────│                           │


┌─────────────────────────────────────────────────────────────────┐
│                     System Components                            │
└─────────────────────────────────────────────────────────────────┘

src/api/webhooks/robokassa.js
    │
    │  express.urlencoded() middleware
    │  Rate limiter (10 req/min)
    │
    ├──► Verify MD5 signature (FIRST!)
    ├──► Check amount matches DB
    ├──► Idempotency check
    │
    ▼
src/services/payment/robokassa-service.js
    │
    ├──► processPayment() with TRANSACTION
    ├──► 25s timeout (Robokassa limit: 30s)
    │
    ▼
src/repositories/RobokassaPaymentRepository.js
    │
    ├──► SELECT FOR UPDATE (lock row)
    │
    ▼
PostgreSQL: robokassa_payments table
```

---

## Implementation Phases

### Phase 1: Database Schema ✅ DONE
**Effort:** S (1 hour)
**Status:** COMPLETED

Миграция создана: `migrations/20251204_create_robokassa_payments.sql`

### Phase 2: Repository Layer
**Effort:** M (1.5 hours)
**Dependencies:** Phase 1

Создание repository для работы с платежами по паттерну BaseRepository.

**Deliverables:**
- `src/repositories/RobokassaPaymentRepository.js` (~150 lines)
- Export в `src/repositories/index.js`

### Phase 3: Service Layer
**Effort:** L (3 hours) ⬆️ increased
**Dependencies:** Phase 2

Бизнес-логика: генерация ссылок, проверка подписей, обработка платежей.
**ВАЖНО:** Использовать транзакции и SELECT FOR UPDATE.

**Deliverables:**
- `src/services/payment/robokassa-service.js` (~350 lines)
- MD5 signature with toUpperCase()
- Amount verification
- Transaction-based processing
- 25s timeout wrapper

### Phase 4: Webhook Handler
**Effort:** M (2.5 hours) ⬆️ increased
**Dependencies:** Phase 3

**КРИТИЧНО:** Правильный порядок обработки:
1. Parse form data (urlencoded)
2. Verify signature FIRST
3. Check amount matches DB
4. Check idempotency (already processed?)
5. Process payment
6. ONLY THEN respond OK{InvId}

**Deliverables:**
- `src/api/webhooks/robokassa.js` (~250 lines)
- express.urlencoded() middleware
- Rate limiter
- Correct response format (text/plain)

### Phase 5: API Routes
**Effort:** M (2 hours)
**Dependencies:** Phase 4

**Deliverables:**
- `src/api/routes/robokassa.js` (~250 lines)
- Success/Fail page serving with signature verification
- Admin endpoints for payment management

### Phase 6: Frontend Pages
**Effort:** M (2 hours)
**Dependencies:** None (parallel)

**ВАЖНО:** Success page должна верифицировать signature из query params!

**Deliverables:**
- `public/payment/success.html` (~150 lines)
- `public/payment/fail.html` (~150 lines)

### Phase 7: Environment & Config
**Effort:** S (0.5 hours)
**Dependencies:** FIRST! (before testing)

**Deliverables:**
- `.env` variables on server
- Documentation update

### Phase 8: Robokassa Panel Configuration
**Effort:** S (0.5 hours)
**Dependencies:** Phase 7

**Deliverables:**
- Result URL configured
- Success/Fail URLs configured
- Test mode enabled

---

## Detailed Tasks (Updated with Review Fixes)

### Phase 1: Database Schema ✅ COMPLETED

| # | Task | Status |
|---|------|--------|
| 1.1 | Create migration file | ✅ Done |
| 1.2 | Define table schema | ✅ Done |
| 1.3 | Add indexes | ✅ Done |
| 1.4 | Run migration on server | ⬜ Pending |

### Phase 2: Repository Layer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 2.1 | Create RobokassaPaymentRepository class | M | Extends BaseRepository |
| 2.2 | Implement insert() method | S | Creates payment record |
| 2.3 | Implement findByInvoiceId() method | S | Returns payment by InvId |
| 2.4 | Implement findByInvoiceIdForUpdate() | S | **NEW:** SELECT FOR UPDATE |
| 2.5 | Implement updateStatus() method | S | Updates status with metadata |
| 2.6 | Implement getNextInvoiceId() method | S | **FIX:** 13-digit format |
| 2.7 | Implement findBySalonId() method | S | Returns payment history |
| 2.8 | Export from repositories/index.js | S | Import works |

### Phase 3: Service Layer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 3.1 | Create RobokassaService class | M | Basic structure with config |
| 3.2 | Implement buildPaymentSignature() | S | MD5 with toUpperCase() |
| 3.3 | Implement verifyResultSignature() | S | MD5 with toUpperCase() comparison |
| 3.4 | Implement generatePaymentUrl() | M | Returns full payment URL |
| 3.5 | Implement processPayment() | L | **FIX:** With TRANSACTION |
| 3.6 | **NEW:** Implement verifyAmount() | S | Compare OutSum vs DB |
| 3.7 | **NEW:** Implement withTimeout() | S | 25s timeout wrapper |
| 3.8 | Implement buildReceipt() | S | 54-FZ compliant receipt |
| 3.9 | Add Sentry error tracking | S | All errors captured |
| 3.10 | **NEW:** Add test mode warning | S | Log warning if test mode in prod |

### Phase 4: Webhook Handler (CRITICAL FIXES)

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 4.1 | Create router with urlencoded middleware | S | **FIX:** express.urlencoded() |
| 4.2 | **NEW:** Add rate limiter | S | 10 req/min per IP |
| 4.3 | Implement /result POST endpoint | M | Handles form data |
| 4.4 | Implement /result GET endpoint | S | Fallback for edge cases |
| 4.5 | **CRITICAL:** Verify signature FIRST | M | Before any processing |
| 4.6 | **CRITICAL:** Verify amount matches DB | M | Prevent fraud |
| 4.7 | **CRITICAL:** Check idempotency | M | Already processed? Return OK |
| 4.8 | Call processPayment service | S | Within timeout |
| 4.9 | Return "OK{InvId}" with text/plain | S | **FIX:** Correct Content-Type |
| 4.10 | Add health check with config validation | S | Check passwords set |
| 4.11 | Register router in src/index.js | S | Route accessible |

### Phase 5: API Routes

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 5.1 | Implement POST /api/payments/robokassa/create | M | Generates payment link |
| 5.2 | Implement GET /api/payments/robokassa/status/:id | S | Returns payment status |
| 5.3 | Implement GET /api/payments/robokassa/history/:salonId | S | Returns payment list |
| 5.4 | Serve success.html at /payment/success | S | Page renders |
| 5.5 | **NEW:** Verify signature on success page | M | Prevent XSS/fraud |
| 5.6 | Serve fail.html at /payment/fail | S | Page renders |
| 5.7 | Add adminAuth middleware | S | Endpoints protected |

### Phase 6: Frontend Pages

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 6.1 | Create public/payment/ directory | S | Directory exists |
| 6.2 | Design success page HTML/CSS | M | Branded, responsive |
| 6.3 | Add payment details display | S | Shows InvId, amount |
| 6.4 | Design fail page HTML/CSS | M | User-friendly error |
| 6.5 | Add retry/support links | S | Actionable options |

### Phase 7: Environment & Config

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 7.1 | Get passwords from Robokassa panel | S | Passwords copied |
| 7.2 | Add ROBOKASSA_* vars to server .env | S | Vars set |
| 7.3 | Set ROBOKASSA_TEST_MODE=true | S | Test mode active |
| 7.4 | Restart PM2 services | S | Config loaded |

### Phase 8: Robokassa Panel Configuration

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 8.1 | Set Result URL | S | `https://adminai.tech/api/payments/robokassa/result` |
| 8.2 | Set Success URL | S | `https://adminai.tech/payment/success` |
| 8.3 | Set Fail URL | S | `https://adminai.tech/payment/fail` |
| 8.4 | Verify MD5 algorithm | S | MD5 selected |
| 8.5 | Enable test mode | S | Test payments work |

---

## Critical Implementation Patterns

### ✅ CORRECT Webhook Handler Pattern

```javascript
const express = require('express');
const router = express.Router();

// IMPORTANT: Parse form data, NOT JSON
router.use(express.urlencoded({ extended: true }));

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 60000, max: 10 });

router.post('/result', limiter, async (req, res) => {
  const { OutSum, InvId, SignatureValue } = req.body;

  // 1. FIRST: Verify signature (BEFORE any DB operations)
  const isValid = robokassaService.verifyResultSignature(OutSum, InvId, SignatureValue);
  if (!isValid) {
    logger.error('Invalid Robokassa signature', { invId: InvId });
    Sentry.captureMessage('Invalid Robokassa signature', { level: 'warning' });
    return res.status(400).send('bad sign');
  }

  // 2. SECOND: Find payment and verify amount
  const payment = await repository.findByInvoiceId(InvId);
  if (!payment) {
    logger.error('Payment not found', { invId: InvId });
    return res.status(400).send('bad sign');
  }

  // 3. THIRD: Verify amount matches (prevent fraud!)
  if (Math.abs(payment.amount - parseFloat(OutSum)) > 0.01) {
    logger.error('Amount mismatch', { expected: payment.amount, received: OutSum });
    Sentry.captureMessage('Payment amount mismatch - potential fraud');
    return res.status(400).send('bad sign');
  }

  // 4. FOURTH: Check if already processed (idempotency)
  if (payment.status === 'success') {
    // Already processed - return OK to stop retries
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`OK${InvId}`);
  }

  // 5. FIFTH: Process payment (with timeout)
  try {
    await robokassaService.processPaymentWithTimeout(InvId, OutSum, SignatureValue);
  } catch (error) {
    if (error.message === 'Processing timeout') {
      logger.error('Payment processing timeout', { invId: InvId });
      // Don't return OK - Robokassa will retry
      return res.status(500).send('timeout');
    }
    throw error;
  }

  // 6. LAST: Return OK only after successful processing
  res.setHeader('Content-Type', 'text/plain');
  res.send(`OK${InvId}`);
});
```

### ❌ WRONG Pattern (was in original plan)

```javascript
// DON'T DO THIS!
router.post('/result', async (req, res) => {
  res.status(200).json({ success: true }); // WRONG: Responds before verification!
  // ... then verifies
});
```

### Signature Verification with Case Handling

```javascript
verifyResultSignature(outSum, invId, signatureValue) {
  const expected = crypto
    .createHash('md5')
    .update(`${outSum}:${invId}:${this.config.merchant.passwords.password2}`)
    .digest('hex')
    .toUpperCase(); // Always uppercase!

  return signatureValue.toUpperCase() === expected;
}
```

### Invoice ID Format (Fixed)

```javascript
// OLD (could exceed JS MAX_SAFE_INTEGER):
// YYYYMMDDHHMMSS{4-digit} = 18 digits

// NEW (safe):
// timestamp_ms + 3 random = 13-16 digits
getNextInvoiceId() {
  const timestamp = Date.now(); // 13 digits
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${timestamp}${random}`; // 16 digits max, safe
}
```

### Transaction in processPayment

```javascript
async processPayment(invId, outSum, signatureValue) {
  return this.repository.withTransaction(async (client) => {
    // Lock the row to prevent concurrent processing
    const payment = await client.query(
      'SELECT * FROM robokassa_payments WHERE invoice_id = $1 FOR UPDATE',
      [invId]
    );

    if (payment.rows[0].status === 'success') {
      return { success: true, alreadyProcessed: true };
    }

    // Update to success
    await client.query(`
      UPDATE robokassa_payments
      SET status = 'success',
          processed_at = NOW(),
          signature_value = $2,
          raw_response = $3
      WHERE invoice_id = $1
    `, [invId, signatureValue, JSON.stringify({ outSum, invId })]);

    return { success: true };
  });
}
```

---

## Risk Assessment (Updated)

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Invalid signature attacks | High | Medium | ✅ Verify FIRST, before any processing |
| Amount manipulation | High | Low | ✅ Compare OutSum vs DB amount |
| Duplicate payments | Medium | Medium | ✅ Idempotency check + SELECT FOR UPDATE |
| Response before verification | High | N/A | ✅ Fixed in plan |
| Timeout causing retries | Medium | Medium | ✅ 25s timeout + proper error handling |
| Test mode in production | High | Low | ✅ Startup warning |
| Invoice ID overflow | Medium | Low | ✅ Fixed to 16-digit format |

---

## Success Metrics

1. **Functional:** Test payment completes end-to-end
2. **Technical:** Result URL responds "OK{InvId}" within 5 seconds
3. **Security:** Invalid signatures rejected with Sentry alert
4. **Security:** Amount mismatches rejected with Sentry alert
5. **Reliability:** Duplicate callbacks return OK without re-processing
6. **Database:** Payment record created with correct status

---

## Timeline (Updated)

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Phase 7 (Env), Phase 1.4 (Run migration), Phase 2 | 3h |
| 2 | Phase 3 (Service with fixes) | 3h |
| 3 | Phase 4 (Webhook with critical fixes) | 2.5h |
| 4 | Phase 5 (API Routes), Phase 6 (Frontend) | 4h |
| 5 | Phase 8 (Robokassa Panel), Testing | 1.5h |

**Total: ~14 hours across 5 days**

---

## Technical Specifications

### Robokassa Signature Algorithms

**For Payment Form (Password1):**
```javascript
MD5(MerchantLogin:OutSum:InvId:Password1).toUpperCase()
```

**For Result URL Verification (Password2):**
```javascript
MD5(OutSum:InvId:Password2).toUpperCase()
```

### Required Response Format

Result URL MUST respond with:
- Content-Type: `text/plain`
- Body: `OK{InvId}` (example: `OK1733323456789123`)
- No JSON, no quotes, no whitespace

### Database Schema

```sql
robokassa_payments (
  id SERIAL PRIMARY KEY,
  invoice_id BIGINT UNIQUE NOT NULL,  -- 16-digit max
  salon_id INTEGER NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  description TEXT,
  period_from DATE,
  period_to DATE,
  status VARCHAR(20) DEFAULT 'pending',
  signature_value VARCHAR(64),
  payment_method VARCHAR(50),
  yclients_notified BOOLEAN DEFAULT FALSE,
  yclients_payment_id INTEGER,
  client_email VARCHAR(255),
  receipt_data JSONB,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
)
```

### Environment Variables

```bash
ROBOKASSA_MERCHANT_LOGIN=AdminAI
ROBOKASSA_PASSWORD_1=<from_panel>
ROBOKASSA_PASSWORD_2=<from_panel>
ROBOKASSA_TEST_MODE=true
```

---

## Future Considerations (Not in Scope)

Следующие пункты отмечены, но не входят в текущий scope:

1. **Refund handling** - обработка возвратов через Robokassa API
2. **Payment expiration** - автоматическая отмена неоплаченных платежей
3. **Recurring payments** - рекуррентные платежи
4. **Shp_ parameters** - кастомные параметры в подписи

Эти функции могут быть добавлены в следующих итерациях.

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/config/robokassa-config.js` | Конфигурация (готово) |
| `src/api/webhooks/yclients.js` | Паттерн webhook handler |
| `src/repositories/BaseRepository.js` | Базовый класс repository |
| `src/services/marketplace/marketplace-service.js` | Паттерн сервиса |
| `src/api/routes/yclients-marketplace.js` | Паттерн API routes |
| `migrations/20251204_create_robokassa_payments.sql` | Миграция БД (создана) |

---

## Post-Implementation

### Переход в боевой режим
1. Отключить тестовый режим: `ROBOKASSA_TEST_MODE=false`
2. Сгенерировать новые боевые пароли в Robokassa
3. Обновить пароли в .env
4. Провести тестовый платёж на минимальную сумму

### Мониторинг
- Sentry: отслеживать ошибки webhook
- Sentry: алерты на invalid signatures и amount mismatch
- Логи: проверять успешные платежи
- БД: периодический audit платежей

### Документация
- Обновить CLAUDE.md с командами платежей
- Добавить в troubleshooting guide
