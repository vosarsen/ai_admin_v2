# Robokassa Integration - Context

**Last Updated:** 2025-12-04
**Current Phase:** Planning Complete, Ready for Implementation
**Session:** 1

---

## Current State

### Implementation Progress
- ✅ Requirements gathered from user
- ✅ Codebase explored for patterns
- ✅ Existing robokassa-config.js reviewed
- ✅ Plan created and documented
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
- **URLs:** Пока стоят http://adminai.tech/ - нужно обновить

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

### To Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `migrations/20251204_create_robokassa_payments.sql` | DB schema | ~60 |
| `src/repositories/RobokassaPaymentRepository.js` | Data access | ~150 |
| `src/services/payment/robokassa-service.js` | Business logic | ~300 |
| `src/api/webhooks/robokassa.js` | Result URL handler | ~200 |
| `src/api/routes/robokassa.js` | API endpoints | ~250 |
| `public/payment/success.html` | Success page | ~150 |
| `public/payment/fail.html` | Fail page | ~150 |

---

## Key Decisions

### 1. Signature Algorithm: MD5
**Decision:** Использовать MD5 (настроено в панели Robokassa)
**Rationale:** Robokassa поддерживает MD5, SHA1, SHA256. MD5 уже настроен.
**Trade-offs:** MD5 криптографически слабее, но для подписи платежей достаточно + Robokassa требует.

### 2. Invoice ID Generation
**Decision:** Timestamp-based + random suffix
**Rationale:** Гарантирует уникальность, легко отлаживать по времени
**Format:** `YYYYMMDDHHMMSS{4-digit-random}` → например `202512041530001234`

### 3. YClients Notification
**Decision:** Опционально - можно включить позже
**Rationale:** Сейчас платежи напрямую, но marketplace integration уже готов
**Implementation:** Метод `markYClientsNotified()` в repository

### 4. Test Mode First
**Decision:** Начинаем с `ROBOKASSA_TEST_MODE=true`
**Rationale:** Безопасное тестирование без реальных денег
**Switch to Production:** Изменить env var + сгенерировать новые пароли

---

## Architecture Notes

### Webhook Pattern (from yclients.js)
```javascript
// 1. Fast response (acknowledge receipt immediately)
res.status(200).json({ success: true });

// 2. Signature verification
if (!verifySignature(payload)) return;

// 3. Idempotency check (Redis, optional for Robokassa)
// 4. Async processing
setImmediate(async () => {
  await processPayment(data);
});
```

### Robokassa Specifics
- Result URL response MUST be exactly `OK{InvId}` (no JSON!)
- Signature is case-insensitive (но лучше UPPERCASE для сравнения)
- Test payments use same URLs, just different test credentials

### Database Pattern
- Extends `BaseRepository` for consistency
- Uses `postgres` module (not Supabase)
- Transactions available via `withTransaction()`

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

### 3. Admin Auth (optional)
Можно переиспользовать из `yclients-marketplace.js`:
```javascript
const { adminAuth } = require('./yclients-marketplace');
```

---

## Blockers & Issues

*None currently - ready to implement*

---

## Testing Strategy

### Unit Tests
1. `verifyResultSignature()` - correct/incorrect signatures
2. `buildPaymentSignature()` - matches expected format
3. `buildReceipt()` - 54-FZ compliant structure

### Integration Tests
1. Generate payment URL → validate format
2. Simulate Result URL callback → check DB update
3. Check Success/Fail pages render

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
- Reviewed screenshot of Robokassa panel
- Explored codebase for patterns
- Found existing `robokassa-config.js`
- Clarified requirements with user
- Created comprehensive plan
- Created dev docs structure

**Next Steps:**
1. Create database migration
2. Implement repository
3. Implement service
4. Create webhook handler

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

### Signature Formulas
```
Payment Form:  MD5(Login:Sum:InvId:Pass1)
Result URL:    MD5(Sum:InvId:Pass2)
```
