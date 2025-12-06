# Salon Onboarding Flow - Context

**Last Updated:** 2025-12-05
**Current Phase:** Phase 0 - Feature Flag Setup
**Session:** 4 - Third Review Complete
**Review Grade:** A+ (95+/100) ✅ Bulletproof - ready for implementation

---

## Project Overview

Полный флоу подключения салона от YClients Marketplace до работающего AI-администратора.

**Путь клиента:**
```
YClients "Подключить" → Оплата → Выбор каналов → WhatsApp/Telegram → Готово!
```

---

## Key Decisions (From User)

| Решение | Выбор |
|---------|-------|
| Trial период | Нет, сразу оплата |
| Тарифы | 19,990₽/мес или 49,990₽/3 мес |
| Каналы | Любые: WhatsApp, Telegram, или оба |
| Источник клиентов | Только YClients Marketplace |
| Telegram Premium | **Обязательно** (Business Bot требует Premium) |

---

## Review Findings (2025-12-05)

### Critical Issues (All Addressed ✅)

| # | Issue | Solution | Status |
|---|-------|----------|--------|
| 1 | Redirect flow conflict | Feature flag `ENABLE_PAID_ONBOARDING` | ✅ Added |
| 2 | Missing `yclients_payment_id` | Added column to `robokassa_payments` | ✅ Added |
| 3 | Payment-to-onboarding race condition | Payment status polling page | ✅ Added |
| 4 | JWT payload undefined | 3 token types defined (checkout/onboarding/resume) | ✅ Added |

### Missing Features (All Added ✅)

| Feature | Solution | Status |
|---------|----------|--------|
| Onboarding resume | Magic link via email (7-day expiry) | ✅ Added |
| Subscription expiration | Phase 7: cron + notifications + grace period | ✅ Added |
| Telegram verification | Confirmation button + verify on first message | ✅ Added |
| Concurrent sessions | Unique index on pending statuses | ✅ Added |

### Security Improvements (All Added ✅)

| Issue | Solution | Status |
|-------|----------|--------|
| Server-side pricing | `src/config/pricing.js` - never trust client | ✅ Added |
| Rate limiting | Per-endpoint limits (5-30 req/min) | ✅ Added |
| Short-lived URL tokens | 5-min exchange tokens | ✅ Added |

---

## Existing Infrastructure

### Ready to Use (100%)

| Компонент | Файл | Статус |
|-----------|------|--------|
| YClients Marketplace Client | `src/integrations/yclients/marketplace-client.js` | ✅ 13/13 endpoints |
| WhatsApp QR Generation | `src/api/routes/yclients-marketplace.js` | ✅ `/marketplace/api/qr` |
| WhatsApp Status Check | `src/api/routes/yclients-marketplace.js` | ✅ `/marketplace/api/status/:id` |
| Telegram Manager | `src/integrations/telegram/telegram-manager.js` | ✅ Business Bot ready |
| Company Repository | `src/repositories/CompanyRepository.js` | ✅ All methods |
| Marketplace Events | `src/repositories/MarketplaceEventsRepository.js` | ✅ For logging |

### Robokassa Integration (92%)

| Компонент | Файл | Статус |
|-----------|------|--------|
| Payment Service | `src/services/payment/robokassa-service.js` | ✅ Ready |
| Webhook Handler | `src/api/webhooks/robokassa.js` | ✅ Ready |
| API Routes | `src/api/routes/robokassa.js` | ✅ Ready |
| Repository | `src/repositories/RobokassaPaymentRepository.js` | ✅ Ready |
| Success/Fail Pages | `public/payment/success.html`, `fail.html` | ✅ Ready |

**Missing in Robokassa:**
- YClients notifyPayment() call after success
- plan_type parameter
- yclients_payment_id storage
- Redirect to onboarding after payment

---

## What We're Building

### New Backend Files

| File | Purpose |
|------|---------|
| `src/config/pricing.js` | Server-side pricing (security!) |
| `src/api/controllers/OnboardingController.js` | Extends BaseController |
| `src/api/routes/onboarding.js` | All onboarding endpoints + rate limiting |
| `src/services/onboarding/onboarding-service.js` | Business logic |
| `src/cron/subscription-monitor.js` | Expiration notifications |

### New Frontend Pages (all in `/public/onboarding/`)

| Page | Purpose |
|------|---------|
| `checkout.html` | Plan selection + pay button |
| `payment-success.html` | Payment verification polling |
| `channels.html` | WhatsApp/Telegram selection |
| `whatsapp.html` | QR code + status polling |
| `telegram.html` | Instructions + confirmation |
| `complete.html` | Success + summary |

### Modifications

| File | Change |
|------|--------|
| `yclients-marketplace.js` | Feature flag check, new redirect |
| `robokassa.js` | YClients notifyPayment, yclients_payment_id |
| `robokassa-service.js` | plan_type handling |

---

## JWT Token Types

### 1. Payment Checkout (1 hour)
```javascript
{ type: 'payment_checkout', company_id, salon_id, user_email, exp: 1h }
```

### 2. Onboarding (24 hours)
```javascript
{ type: 'onboarding', company_id, salon_id, payment_verified: true, invoice_id, exp: 24h }
```

### 3. Resume (7 days)
```javascript
{ type: 'onboarding_resume', company_id, salon_id, current_step, exp: 7d }
```

---

## Company Status Flow

```
pending_payment → pending_channels → pending_whatsapp → pending_telegram → active
                                  ↘                  ↗
                                    → active (skip) →
```

---

## Environment Variables

```bash
# Existing
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_APP_ID=18289
ROBOKASSA_MERCHANT_LOGIN=AdminAI
ROBOKASSA_TEST_MODE=true
BASE_URL=https://adminai.tech

# NEW - Feature Flag
ENABLE_PAID_ONBOARDING=false  # Start with false, enable when ready
```

---

## Critical Integration Points

### 1. YClients Payment Notification
```javascript
// After Robokassa confirms payment
const paymentResult = await marketplaceClient.notifyPayment(salon_id, {...});
// CRITICAL: Save yclients_payment_id for refunds!
await robokassaPaymentRepository.update(payment.id, {
  yclients_payment_id: paymentResult.id
});
```

### 2. Payment Status Polling
```javascript
// GET /api/onboarding/payment-status?inv=XXX
// Returns { status: 'pending'|'success'|'failed', redirect_url }
// Success page polls this until payment confirmed
```

### 3. YClients Activation Callback
```javascript
// After onboarding complete
await marketplaceClient.callbackWithRedirect(salon_id, {
  api_key: company.api_key,
  webhook_urls: { records: '...', clients: '...' }
});
```

---

## File Locations

### Backend
```
src/
├── config/
│   └── pricing.js               ← NEW (security!)
├── api/
│   ├── controllers/
│   │   └── OnboardingController.js  ← NEW
│   ├── routes/
│   │   ├── onboarding.js        ← NEW
│   │   ├── robokassa.js         ← MODIFY
│   │   └── yclients-marketplace.js ← MODIFY
│   └── webhooks/
│       └── robokassa.js         ← MODIFY
├── services/
│   ├── onboarding/
│   │   └── onboarding-service.js  ← NEW
│   └── payment/
│       └── robokassa-service.js   ← MODIFY
└── cron/
    └── subscription-monitor.js    ← NEW
```

### Frontend
```
public/
└── onboarding/
    ├── checkout.html              ← NEW
    ├── payment-success.html       ← NEW
    ├── channels.html              ← NEW
    ├── whatsapp.html              ← NEW
    ├── telegram.html              ← NEW
    ├── complete.html              ← NEW
    ├── css/
    │   └── onboarding.css         ← NEW
    └── js/
        └── onboarding.js          ← NEW
```

### Migrations
```
migrations/
└── 20251205_add_onboarding_fields.sql  ← NEW
```

---

## Session Notes

### Session 1 (2025-12-05)

**What was done:**
- Created project structure
- Wrote comprehensive plan based on plan mode discussion
- Documented all decisions from user

### Session 2 (2025-12-05) - Post-Review

**What was done:**
- Received detailed review (B+ grade, 82/100)
- Addressed all 4 critical issues
- Added 4 missing features (resume, subscription lifecycle, telegram verification, concurrent protection)
- Added 3 security improvements (pricing, rate limiting, short tokens)
- Updated plan from 56 to 68 tasks
- Updated timeline from 14-19h to 18-24h
- Added Phase 0 (feature flag) and Phase 7 (subscription lifecycle)

**Key Changes:**
1. **Feature Flag** - `ENABLE_PAID_ONBOARDING` for gradual rollout
2. **Payment Success Page** - Polling to handle webhook race condition
3. **JWT Types** - 3 different token types for different stages
4. **Telegram** - Confirmation button, not API verification
5. **Resume** - 7-day magic link via email
6. **Subscriptions** - Cron for 7/3/1 day warnings + 3-day grace period

**Next steps:**
1. Phase 0: Add feature flag to .env and yclients-marketplace.js
2. Phase 1: Create and apply database migration
3. Phase 2: Create backend onboarding routes

### Session 3 (2025-12-05) - Second Review ← **CURRENT**

**What was done:**
- Received second review via plan-reviewer agent (A- grade, 88/100)
- Added all missing issues from review:
  1. YClients notification retry queue (BullMQ, 5 attempts)
  2. Idempotency check for notifyPayment
  3. Telegram columns (`telegram_verified`, `telegram_business_id`)
  4. WhatsApp phone extraction from Baileys session
  5. Robokassa test mode handling
  6. Email service deferral documentation
  7. Renewal flow clarification
- Updated timeline from 18-24h to 22-28h
- Total tasks increased from 68 to 75

**Key Additions:**
1. **Retry Queue** - `src/queue/yclients-notification-queue.js` with BullMQ
2. **Idempotency** - Check `yclients_payment_id` before calling notifyPayment
3. **Test Mode** - Skip YClients API when `ROBOKASSA_TEST_MODE=true`
4. **WhatsApp Phone** - Extract from `sock.user.id` after connection

**Deferred Items:**
- **Email Service** - Deferred to Phase 2 of project. For now, use "copy link" instead of email
- **Renewal Flow** - Uses same `/onboarding/checkout` flow (frozen company → show "Продлить")

**Next steps:**
1. Start implementation with Phase 0 (feature flag)
2. Continue through phases in order
3. Email service can be added later (Phase 2 project)

### Session 4 (2025-12-05) - Third Review ← **CURRENT**

**What was done:**
- Received third review via plan-reviewer agent (A+ grade, 95+/100)
- Added all remaining issues for bulletproof implementation:
  1. Missing repository methods (`findExpiringBetween`, `findExpiredWithGrace`)
  2. Orphaned pending records cleanup before unique index
  3. Unique constraint violation handling with user-friendly error
  4. RobokassaService modification location clarified
  5. Queue pattern clarified (follow message-queue.js)
  6. Manual resolution for failed YClients notifications
  7. Copy-link fallback for resume (no email dependency)
  8. Crypto token for payment-status endpoint (security)
  9. Token exchange endpoint (URL → HttpOnly cookie)
  10. Unit tests for onboarding service
  11. Failure scenario tests (network, JWT expiry, duplicates)
  12. Load testing (5-10 concurrent)
  13. Cron directory infrastructure
  14. Admin runbook
  15. Monitoring metrics in GlitchTip
- Updated timeline from 22-28h to 28-35h
- Total tasks increased from 75 to 89

**Key Improvements:**
1. **Repository Methods** - `findExpiringBetween()`, `findExpiredWithGrace()` for subscription cron
2. **Security** - Crypto token for payment-status, token exchange for URL params
3. **Error Handling** - Constraint violation, manual resolution endpoint
4. **Testing** - Unit tests, failure scenarios, load testing
5. **Operations** - Cron infrastructure, admin runbook, monitoring

**Plan is now bulletproof for production!**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Redirect conflict breaks old flow | Feature flag allows gradual rollout |
| Payment webhook race | Success page polls payment status |
| User abandons mid-flow | Resume mechanism via email |
| YClients API fails | Retry queue + manual admin fallback |
| Concurrent onboarding | Unique index prevents duplicates |

---

## Related Documentation

- Plan: `salon-onboarding-flow-plan.md` (updated with review fixes)
- Tasks: `salon-onboarding-flow-tasks.md` (updated with new tasks)
- Robokassa: `dev/active/robokassa-integration/`
- Marketplace API: `docs/02-guides/marketplace/AUTHORIZATION_QUICK_REFERENCE.md`
