# Robokassa Integration - Context

**Last Updated:** 2025-12-04 (Updated after Plan Review)
**Current Phase:** Planning Complete, Ready for Implementation
**Review Status:** ✅ APPROVED WITH REQUIRED CHANGES
**Session:** 1

---

## Plan Review Results

План прошёл ревью агентом `plan-reviewer` и получил статус **APPROVED WITH REQUIRED CHANGES**.

### Критические проблемы (ИСПРАВЛЕНЫ)

| # | Проблема | Статус |
|---|----------|--------|
| 1 | Webhook отвечал `OK` до верификации | ✅ Исправлено: отвечать ПОСЛЕ проверки |
| 2 | Не было проверки суммы OutSum | ✅ Добавлено: сравнивать с amount в БД |
| 3 | Дубликаты не обрабатывались | ✅ Добавлено: idempotency check |
| 4 | Нет middleware для form data | ✅ Добавлено: `express.urlencoded()` |

### Предупреждения (УЧТЕНЫ)

| # | Предупреждение | Решение |
|---|----------------|---------|
| 1 | MD5 case-sensitive | `toUpperCase()` для сравнения |
| 2 | Invoice ID overflow | 16-digit max (timestamp + 3 random) |
| 3 | Нет rate limiting | 10 req/min на Result URL |
| 4 | Нет Content-Type | `text/plain` обязательно |
| 5 | Нет timeout | 25s wrapper (Robokassa limit: 30s) |
| 6 | Нет транзакций | SELECT FOR UPDATE в processPayment |

---

## Current State

### Implementation Progress
- ✅ Requirements gathered from user
- ✅ Codebase explored for patterns
- ✅ Existing robokassa-config.js reviewed
- ✅ Plan created and documented
- ✅ Plan reviewed by plan-reviewer agent
- ✅ Critical fixes incorporated
- ✅ Database migration created
- ⬜ Implementation not started

### User Requirements (Confirmed)
1. **Payment source:** Напрямую от салонов (NOT through YClients)
2. **Credentials:** Нужно добавить в .env (пароли есть в панели Robokassa)
3. **Frontend:** Нужны отдельные красивые страницы Success/Fail
4. **Mode:** Начать с тестового режима

### Robokassa Panel Status
- **Магазин:** AdminAI
- **Алгоритм хеша:** MD5
- **Пароли #1 и #2:** Сгенерированы (показано "Пароль задан")
- **URLs:** Пока стоят http://adminai.tech/ - нужно обновить на:
  - Result: `https://adminai.tech/api/payments/robokassa/result`
  - Success: `https://adminai.tech/payment/success`
  - Fail: `https://adminai.tech/payment/fail`

---

## Key Files

### Existing (Reference)

| File | Purpose | Lines |
|------|---------|-------|
| `src/config/robokassa-config.js` | Полная конфигурация, fiscal settings | 180 |
| `src/api/webhooks/yclients.js` | Паттерн webhook (signature, fast response) | 211 |
| `src/repositories/BaseRepository.js` | Base class для repositories | ~200 |
| `src/services/marketplace/marketplace-service.js` | Паттерн сервиса с Sentry | 600+ |
| `src/api/routes/yclients-marketplace.js` | Паттерн API routes с adminAuth | 2200+ |

### Created

| File | Purpose | Status |
|------|---------|--------|
| `migrations/20251204_create_robokassa_payments.sql` | DB schema | ✅ Created |

### To Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/repositories/RobokassaPaymentRepository.js` | Data access | ~150 |
| `src/services/payment/robokassa-service.js` | Business logic | ~350 |
| `src/api/webhooks/robokassa.js` | Result URL handler | ~250 |
| `src/api/routes/robokassa.js` | API endpoints | ~250 |
| `public/payment/success.html` | Success page | ~150 |
| `public/payment/fail.html` | Fail page | ~150 |

---

## Key Decisions

### 1. Signature Algorithm: MD5
**Decision:** Использовать MD5 (настроено в панели Robokassa)
**Rationale:** Robokassa поддерживает MD5, SHA1, SHA256. MD5 уже настроен.
**IMPORTANT:** Всегда использовать `toUpperCase()` для сравнения!

### 2. Invoice ID Generation (UPDATED!)
**Decision:** Timestamp-based + 3-digit random (16 digits max)
**Rationale:** 18 digits может превысить JS MAX_SAFE_INTEGER
**Format:** `Date.now() + 3-digit-random` → например `1733323456789123`

### 3. YClients Notification
**Decision:** Опционально - можно включить позже
**Rationale:** Сейчас платежи напрямую, но marketplace integration уже готов

### 4. Test Mode First
**Decision:** Начинаем с `ROBOKASSA_TEST_MODE=true`
**Rationale:** Безопасное тестирование без реальных денег

### 5. Webhook Response Pattern (CRITICAL!)
**Decision:** Отвечать `OK{InvId}` только ПОСЛЕ полной верификации
**Rationale:** Ответ до верификации = подтверждение мошеннических платежей

### 6. Transaction Usage (NEW!)
**Decision:** Использовать транзакции + SELECT FOR UPDATE в processPayment
**Rationale:** Предотвращает race conditions при concurrent callbacks

---

## Architecture Notes

### ✅ CORRECT Webhook Pattern (from Plan Review)

```javascript
router.post('/result', limiter, async (req, res) => {
  const { OutSum, InvId, SignatureValue } = req.body;

  // 1. FIRST: Verify signature
  if (!verifySignature(OutSum, InvId, SignatureValue)) {
    return res.status(400).send('bad sign');
  }

  // 2. SECOND: Find payment and verify amount
  const payment = await repository.findByInvoiceId(InvId);
  if (!payment) return res.status(400).send('bad sign');

  // 3. THIRD: Verify amount matches
  if (Math.abs(payment.amount - parseFloat(OutSum)) > 0.01) {
    return res.status(400).send('bad sign');
  }

  // 4. FOURTH: Idempotency check
  if (payment.status === 'success') {
    res.setHeader('Content-Type', 'text/plain');
    return res.send(`OK${InvId}`);
  }

  // 5. FIFTH: Process with timeout
  await processPaymentWithTimeout(InvId, OutSum, SignatureValue);

  // 6. LAST: Return OK
  res.setHeader('Content-Type', 'text/plain');
  res.send(`OK${InvId}`);
});
```

### ❌ WRONG Pattern (was in original plan)

```javascript
// DON'T DO THIS!
res.status(200).json({ success: true }); // Responds BEFORE verification!
setImmediate(() => verify()); // Too late!
```

### Transaction in processPayment

```javascript
async processPayment(invId, outSum, signatureValue) {
  return this.repository.withTransaction(async (client) => {
    // Lock row
    const payment = await client.query(
      'SELECT * FROM robokassa_payments WHERE invoice_id = $1 FOR UPDATE',
      [invId]
    );

    if (payment.rows[0].status === 'success') {
      return { success: true, alreadyProcessed: true };
    }

    await client.query(
      'UPDATE robokassa_payments SET status = $1, processed_at = NOW() WHERE invoice_id = $2',
      ['success', invId]
    );

    return { success: true };
  });
}
```

---

## Integration Points

### 1. src/index.js
Нужно зарегистрировать новые роуты:
```javascript
const robokassaWebhook = require('./api/webhooks/robokassa');
const robokassaRoutes = require('./api/routes/robokassa');

app.use('/api/payments/robokassa', robokassaWebhook);
app.use('/api/payments', robokassaRoutes);
app.use('/payment', robokassaRoutes); // for success/fail pages
```

### 2. src/repositories/index.js
Добавить export:
```javascript
const RobokassaPaymentRepository = require('./RobokassaPaymentRepository');
module.exports = { ..., RobokassaPaymentRepository };
```

### 3. Middleware Requirements
```javascript
// MUST use urlencoded for Robokassa form data
router.use(express.urlencoded({ extended: true }));

// Rate limiter
const limiter = rateLimit({ windowMs: 60000, max: 10 });
```

---

## Blockers & Issues

*None currently - ready to implement*

---

## Testing Strategy

### Unit Tests
1. `verifyResultSignature()` - correct/incorrect signatures with case handling
2. `buildPaymentSignature()` - matches expected format
3. `buildReceipt()` - 54-FZ compliant structure
4. `verifyAmount()` - exact match, tolerance, mismatch

### Integration Tests
1. Generate payment URL → validate format
2. Simulate Result URL callback → check DB update
3. Check Success/Fail pages render

### Security Tests (NEW!)
1. Invalid signature → 400 "bad sign"
2. Amount mismatch → 400 "bad sign"
3. Duplicate callback → OK without re-processing
4. Timeout → no OK response

### Manual Test Flow
```bash
# 1. Create payment
curl -X POST https://adminai.tech/api/payments/robokassa/create \
  -H "Authorization: Bearer <token>" \
  -d '{"salon_id": 962302, "amount": 100}'

# 2. Open payment_url in browser
# 3. Use test card: 4111111111111111
# 4. Verify webhook received
# 5. Check database record
```

---

## Environment Variables Needed

```bash
# Required
ROBOKASSA_MERCHANT_LOGIN=AdminAI
ROBOKASSA_PASSWORD_1=<from_robokassa_panel>
ROBOKASSA_PASSWORD_2=<from_robokassa_panel>
ROBOKASSA_TEST_MODE=true

# Optional (have defaults in config)
ROBOKASSA_RESULT_URL=https://adminai.tech/api/payments/robokassa/result
ROBOKASSA_SUCCESS_URL=https://adminai.tech/payment/success
ROBOKASSA_FAIL_URL=https://adminai.tech/payment/fail
```

---

## Session Log

### Session 1 (2025-12-04)

**Actions:**
- Reviewed screenshot of Robokassa panel
- Explored codebase for patterns
- Found existing `robokassa-config.js`
- Clarified requirements with user
- Created comprehensive plan
- Created dev docs structure
- Ran plan-reviewer agent
- Incorporated critical fixes from review
- Created database migration

**Key Findings from Review:**
- Original webhook pattern was WRONG (responded before verification)
- Missing amount verification (fraud risk)
- Missing idempotency handling
- Missing urlencoded middleware
- Invoice ID format could overflow

**Next Steps:**
1. Get Robokassa passwords and add to .env
2. Run database migration
3. Implement repository layer
4. Implement service layer
5. Implement webhook handler (with critical fixes!)

---

## Quick Reference

### Robokassa URLs
- **Panel:** https://partner.robokassa.ru/
- **Test Payment:** https://auth.robokassa.ru/Merchant/Index.aspx (isTest=1)
- **Docs:** https://docs.robokassa.ru/

### Test Card
- Number: `4111111111111111`
- Expiry: Any future date
- CVV: Any 3 digits

### Signature Formulas (with toUpperCase!)
```javascript
// Payment Form:
MD5(Login:Sum:InvId:Pass1).toUpperCase()

// Result URL:
MD5(Sum:InvId:Pass2).toUpperCase()
```

### Response Format
```
Content-Type: text/plain
Body: OK{InvId}
Example: OK1733323456789123
```
