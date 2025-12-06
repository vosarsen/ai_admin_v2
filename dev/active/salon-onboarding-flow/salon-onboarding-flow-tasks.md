# Salon Onboarding Flow - Tasks

**Last Updated:** 2025-12-05
**Overall Progress:** 0/89 tasks (0%)
**Current Phase:** Phase 0 - Feature Flag Setup
**Review Status:** Third review complete - A+ ready (95+/100) ✅

---

## Phase 0: Feature Flag Setup (0/3) ⬜ CURRENT

> **Purpose:** Enable gradual rollout without breaking existing free flow

- [ ] 0.1 Add `ENABLE_PAID_ONBOARDING=false` to `.env` on server
- [ ] 0.2 Add feature flag check in `yclients-marketplace.js` redirect handler
- [ ] 0.3 Test: flag=false → old flow works, flag=true → redirects to checkout

---

## Phase 1: Database & Repository (0/12) ⬜ PENDING

### Companies Table
- [ ] 1.1 Create migration file `20251205_add_onboarding_fields.sql`
- [ ] 1.2 Add `selected_channels TEXT[]`, `subscription_plan`, `subscription_expires_at`
- [ ] 1.3 Add `telegram_pending_verification BOOLEAN`, `whatsapp_phone VARCHAR(20)`
- [ ] 1.4 Add `telegram_verified BOOLEAN`, `telegram_business_id VARCHAR(100)` ← from review #2
- [ ] 1.5 Add indexes: `idx_companies_subscription_expires`, `idx_companies_active_expiring`
- [ ] 1.6 Cleanup any orphaned pending records before unique index ← **NEW from review #3**
- [ ] 1.7 Add unique index `idx_companies_pending_onboarding` (prevents concurrent attempts)

### Robokassa Payments Table
- [ ] 1.8 Add `plan_type`, `subscription_period_days`, **`yclients_payment_id`** columns

### CompanyRepository Extensions ← **NEW from review #3**
- [ ] 1.9 Add `findExpiringBetween(startDate, endDate)` method for subscription cron
- [ ] 1.10 Add `findExpiredWithGrace(graceDays)` method for freeze logic

### Apply Migration
- [ ] 1.11 Apply migration on production server
- [ ] 1.12 Verify repository methods work with new columns

---

## Phase 2: Backend Onboarding Routes (0/24) ⬜ PENDING

### Configuration
- [ ] 2.1 Create `src/config/pricing.js` with server-side pricing (SECURITY!)
  ```javascript
  PRICING = { monthly: { amount: 19990, period_days: 30 }, quarterly: { amount: 49990, period_days: 90 } }
  ```

### Controller & Service
- [ ] 2.2 Create `src/api/controllers/OnboardingController.js` (extends BaseController)
- [ ] 2.3 Create `src/services/onboarding/onboarding-service.js`

### JWT Token Generation
- [ ] 2.4 Implement `generatePaymentCheckoutToken()` (1h expiry)
- [ ] 2.5 Implement `generateOnboardingToken()` (24h expiry, payment_verified)
- [ ] 2.6 Implement `generateResumeToken()` (7 day expiry)
- [ ] 2.7 Implement JWT validation middleware for different token types
- [ ] 2.7.1 Create `exchangeToken()` endpoint: URL token → HttpOnly session cookie ← **NEW from review #3**

### Routes File
- [ ] 2.8 Create `src/api/routes/onboarding.js` with rate limiting
- [ ] 2.9 Implement `POST /api/onboarding/create-payment` (server-side pricing!)
- [ ] 2.10 Implement `GET /api/onboarding/payment-status` with crypto token (not raw invoice_id!) ← **UPDATED from review #3**
- [ ] 2.10.1 Generate short-lived crypto token for payment-status polling (security) ← **NEW from review #3**
- [ ] 2.11 Implement `POST /api/onboarding/select-channels`
- [ ] 2.12 Implement `GET /api/onboarding/status`
- [ ] 2.13 Implement `GET /api/onboarding/whatsapp/qr` (proxy to existing)
- [ ] 2.14 Implement `GET /api/onboarding/whatsapp/status`
- [ ] 2.14.1 Use existing `getSessionStatus().phoneNumber` from session-pool.js:572 ← **CLARIFIED from review #3**
- [ ] 2.15 Implement `POST /api/onboarding/telegram/confirm` (not verify!)
- [ ] 2.16 Implement `POST /api/onboarding/complete`

### Resume Mechanism
- [ ] 2.17 Implement `POST /api/onboarding/send-resume-link` (Telegram fallback, email Phase 2)
- [ ] 2.18 Implement `GET /api/onboarding/resume?token=XXX` (redirect to current step)

### Register Routes
- [ ] 2.19 Register onboarding routes in `src/api/index.js`

---

## Phase 3: Modify YClients Marketplace Route (0/7) ⬜ PENDING

- [ ] 3.1 Find `/auth/yclients/redirect` handler in `yclients-marketplace.js`
- [ ] 3.2 Add feature flag check: `process.env.ENABLE_PAID_ONBOARDING === 'true'`
- [ ] 3.3 If flag=true: status → `pending_payment`, redirect to `/onboarding/checkout`
- [ ] 3.4 If flag=false: keep existing behavior (`pending_whatsapp`, `/marketplace/onboarding`)
- [ ] 3.5 Handle unique constraint violation (pending onboarding exists) ← **NEW from review #3**
  - Show user-friendly error: "Вы уже начали подключение. Проверьте email для ссылки продолжения"
- [ ] 3.6 Test both flows work correctly
- [ ] 3.7 Test reconnection attempt while pending (constraint violation handling)

---

## Phase 4: Robokassa Integration (0/17) ⬜ PENDING

### Modify Payment Creation
- [ ] 4.1 Add `plan_type` parameter to payment creation
- [ ] 4.2 Use server-side pricing from `config/pricing.js`
- [ ] 4.3 Store `plan_type` and `subscription_period_days` in payment record

### Modify Webhook Handler ← **CLARIFIED from review #3**
- [ ] 4.4 Modify `RobokassaService.processPayment()` (lines 286-341) to accept onSuccess callback
- [ ] 4.4.1 OR create new `processOnboardingPayment()` method that chains YClients notification
- [ ] 4.5 **CRITICAL:** Save `yclients_payment_id` in `robokassa_payments` table
- [ ] 4.5.1 Add idempotency check: skip notifyPayment if `yclients_payment_id` already exists
- [ ] 4.6 Update company `integration_status` to `pending_channels`
- [ ] 4.7 Update company `subscription_plan` and `subscription_expires_at`

### Error Handling & Retry Queue ← **CLARIFIED from review #3**
- [ ] 4.8 Create `src/queue/yclients-notification-queue.js` following `message-queue.js` singleton pattern
- [ ] 4.9 Implement retry with exponential backoff (5 attempts: 5s, 10s, 20s, 40s, 80s)
- [ ] 4.10 Add Sentry alert when retry queue exhausted
- [ ] 4.10.1 Define manual resolution procedure: admin endpoint to retry + Telegram alert ← **NEW from review #3**
- [ ] 4.11 Log all payment events to `marketplace_events` for audit

### Test Mode Handling
- [ ] 4.12 Skip YClients API calls when `ROBOKASSA_TEST_MODE=true`
- [ ] 4.13 Still update local company status in test mode (for testing flow)
- [ ] 4.14 Document test company cleanup procedure ← **NEW from review #3**

---

## Phase 5: Frontend Pages (0/28) ⬜ PENDING

### Checkout Page
- [ ] 5.1 Create `public/onboarding/checkout.html`
- [ ] 5.2 Design plan selection (monthly/quarterly radio buttons)
- [ ] 5.3 Show plan benefits list
- [ ] 5.4 Add "Оплатить" button that calls `/api/onboarding/create-payment`
- [ ] 5.4.1 For frozen companies: show "Продлить подписку" instead ← **NEW from review #3**

### Payment Success Page (handles webhook race condition)
- [ ] 5.5 Create `public/onboarding/payment-success.html`
- [ ] 5.6 Show "Проверяем оплату..." spinner
- [ ] 5.7 Implement polling to `GET /api/onboarding/payment-status` with crypto token
- [ ] 5.8 Auto-redirect to `/onboarding/channels` when status=success

### Channels Selection Page
- [ ] 5.9 Create `public/onboarding/channels.html`
- [ ] 5.10 Design checkboxes for WhatsApp and Telegram
- [ ] 5.11 Add "Продолжить" button

### WhatsApp Page
- [ ] 5.12 Create `public/onboarding/whatsapp.html`
- [ ] 5.13 Add QR code display area
- [ ] 5.14 Implement polling for connection status
- [ ] 5.14.1 Show "Подключен как +X" with "Это не мой номер" option ← **NEW from review #3**
- [ ] 5.15 Auto-redirect when connected

### Telegram Page
- [ ] 5.16 Create `public/onboarding/telegram.html`
- [ ] 5.17 Add step-by-step instructions (with Telegram Premium requirement!)
- [ ] 5.17.1 Add "Скопировать ссылку для продолжения" button (email fallback) ← **NEW from review #3**
- [ ] 5.18 Add "Я подключил бота ✓" confirmation button (not API verify)
- [ ] 5.18.1 Add FAQ link for "Бот не отвечает?" with Premium troubleshooting ← **NEW from review #3**
- [ ] 5.19 Add "Пропустить →" button

### Complete Page
- [ ] 5.20 Create `public/onboarding/complete.html`
- [ ] 5.21 Show connected channels summary (WhatsApp phone from session)
- [ ] 5.22 Show "Telegram: ожидает первое сообщение" if pending verification
- [ ] 5.23 Add "Вернуться в YClients" button

### Shared Assets
- [ ] 5.24 Create `public/onboarding/css/onboarding.css`
- [ ] 5.25 Create `public/onboarding/js/onboarding.js` (JWT handling, polling, API calls)
- [ ] 5.25.1 Add JWT expiration detection with user-friendly message ← **NEW from review #3**
- [ ] 5.25.2 Call exchangeToken() on page load, clear URL params (security) ← **NEW from review #3**

---

## Phase 6: Testing (0/22) ⬜ PENDING

### Unit Tests ← **NEW from review #3**
- [ ] 6.0.1 Create unit tests for `onboarding-service.js` (mocked dependencies)
- [ ] 6.0.2 Create unit tests for JWT token generation/validation
- [ ] 6.0.3 Create unit tests for pricing calculation

### Feature Flag Testing
- [ ] 6.1 Test with `ENABLE_PAID_ONBOARDING=false` → old flow works
- [ ] 6.2 Test with `ENABLE_PAID_ONBOARDING=true` → new flow works

### Payment Flow Testing
- [ ] 6.3 Test redirect from YClients → Checkout page
- [ ] 6.4 Test plan selection and payment creation (server-side pricing)
- [ ] 6.5 Complete test payment in Robokassa
- [ ] 6.6 Verify payment-success polling works correctly
- [ ] 6.7 Verify `yclients_payment_id` is saved to `robokassa_payments`
- [ ] 6.8 Verify YClients notifyPayment() called (or skipped in test mode)

### Channel Connection Testing
- [ ] 6.9 Test channel selection page
- [ ] 6.10 Test WhatsApp QR code generation and connection
- [ ] 6.11 Test Telegram confirmation button

### Completion Testing
- [ ] 6.12 Test completion and YClients callback
- [ ] 6.13 Verify YClients shows "Интеграция активна"
- [ ] 6.14 Test resume mechanism (abandon flow, use resume link)

### Failure Scenario Tests ← **NEW from review #3**
- [ ] 6.15 Test network failure during YClients notification (verify retry queue)
- [ ] 6.16 Test expired JWT at each step (verify user-friendly error)
- [ ] 6.17 Test duplicate Robokassa webhook (verify idempotency)
- [ ] 6.18 Test unique constraint violation (concurrent onboarding attempt)

### Load Testing ← **NEW from review #3**
- [ ] 6.19 Load test concurrent onboarding flows (5-10 simultaneous)

---

## Phase 7: Subscription Lifecycle & Operations (0/14) ⬜ PENDING

### Cron Infrastructure ← **NEW from review #3**
- [ ] 7.0 Create `src/cron/` directory structure
- [ ] 7.0.1 Create `src/cron/index.js` to register all cron jobs

### Subscription Monitor Cron
- [ ] 7.1 Create `src/cron/subscription-monitor.js`
- [ ] 7.2 Add PM2 cron entry (daily at 09:00 Moscow time)

### Expiration Notifications (via Telegram, email Phase 2)
- [ ] 7.3 Implement 7-day warning notification (Telegram to salon owner)
- [ ] 7.4 Implement 3-day warning notification
- [ ] 7.5 Implement 1-day warning notification

### Grace Period Handling
- [ ] 7.6 Implement 3-day grace period after expiration
- [ ] 7.7 Implement company freeze (status → 'frozen') after grace period
- [ ] 7.8 Implement instant reactivation on renewal during grace

### Admin Operations ← **NEW from review #3**
- [ ] 7.9 Create admin runbook: `docs/02-guides/onboarding/ADMIN_RUNBOOK.md`
  - Failed YClients notification recovery
  - Stuck onboarding (pending >24h)
  - Refund processing
- [ ] 7.10 Add onboarding metrics to GlitchTip:
  - `onboarding.started`, `onboarding.payment_completed`
  - `onboarding.channels_selected`, `onboarding.completed`
  - `onboarding.abandoned`

---

## Summary

| Phase | Tasks | Done | Status |
|-------|-------|------|--------|
| 0. Feature Flag | 3 | 0 | ⬜ CURRENT |
| 1. Database & Repository | 12 | 0 | ⬜ Pending |
| 2. Backend Routes | 24 | 0 | ⬜ Pending |
| 3. Marketplace Redirect | 7 | 0 | ⬜ Pending |
| 4. Robokassa Integration | 17 | 0 | ⬜ Pending |
| 5. Frontend Pages | 28 | 0 | ⬜ Pending |
| 6. Testing | 22 | 0 | ⬜ Pending |
| 7. Subscription & Operations | 14 | 0 | ⬜ Pending |
| **TOTAL** | **89** | **0** | **0%** |

---

## Review Issues Addressed

### First Review (B+ 82/100)
| Issue | Task(s) |
|-------|---------|
| Feature flag for rollout | 0.1, 0.2, 0.3, 3.2-3.4 |
| `yclients_payment_id` storage | 1.7, 4.5, 6.7 |
| Payment-to-onboarding handoff | 2.10, 5.5-5.8 |
| JWT token structure | 2.4, 2.5, 2.6, 2.7 |
| Onboarding resume | 2.17, 2.18, 6.14 |
| Subscription lifecycle | Phase 7 (all) |
| Telegram confirmation | 5.18, 6.11 |
| Server-side pricing | 2.1, 4.2 |
| Rate limiting | 2.8 |
| Concurrent protection | 1.6 |

### Second Review (A- 88/100)
| Issue | Task(s) |
|-------|---------|
| YClients notification retry queue | 4.8, 4.9, 4.10 |
| Idempotency for notifyPayment | 4.5.1 |
| Telegram verified/business_id columns | 1.4 |
| WhatsApp phone extraction | 2.14.1 |
| Robokassa test mode handling | 4.12, 4.13 |
| Email service deferral | Documented (Phase 2 defer) |
| Renewal flow clarification | Documented (same checkout flow) |

### Third Review (A+ 95+/100) ← **NEW**
| Issue | Task(s) |
|-------|---------|
| Missing `findExpiringBetween()` method | 1.9 |
| Missing `findExpiredWithGrace()` method | 1.10 |
| Orphaned pending records cleanup | 1.6 |
| Unique constraint violation handling | 3.5, 3.7 |
| RobokassaService modification location | 4.4, 4.4.1 (clarified) |
| Queue pattern (follow message-queue.js) | 4.8 (clarified) |
| Manual resolution for failed notifications | 4.10.1 |
| Test company cleanup documentation | 4.14 |
| Frozen company renewal UI | 5.4.1 |
| WhatsApp phone mismatch handling | 5.14.1 |
| Copy-link fallback for resume | 5.17.1 |
| Telegram Premium troubleshooting FAQ | 5.18.1 |
| JWT expiration user-friendly handling | 5.25.1, 5.25.2 |
| Crypto token for payment-status | 2.10, 2.10.1 |
| Token exchange (URL → cookie) | 2.7.1 |
| Unit tests for onboarding service | 6.0.1, 6.0.2, 6.0.3 |
| Failure scenario tests | 6.15, 6.16, 6.17, 6.18 |
| Load testing | 6.19 |
| Cron directory infrastructure | 7.0, 7.0.1 |
| Admin runbook | 7.9 |
| Monitoring metrics | 7.10 |

---

## Quick Commands

### Create Migration
```bash
cat > migrations/20251205_add_onboarding_fields.sql << 'EOF'
-- Salon Onboarding Flow - Database Changes
-- Created: 2025-12-05
-- Review: Second review complete (A- 88/100)

-- === COMPANIES TABLE ===

-- Selected channels (array of strings)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  selected_channels TEXT[] DEFAULT '{}';

-- Subscription plan type
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  subscription_plan VARCHAR(20);

-- Subscription expiration date
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  subscription_expires_at TIMESTAMPTZ;

-- Telegram pending verification flag
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  telegram_pending_verification BOOLEAN DEFAULT false;

-- Telegram verified status (NEW from second review)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  telegram_verified BOOLEAN DEFAULT false;

-- Telegram business connection ID (NEW from second review)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  telegram_business_id VARCHAR(100);

-- WhatsApp phone number (from Baileys session)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  whatsapp_phone VARCHAR(20);

-- Index for finding expiring subscriptions
CREATE INDEX IF NOT EXISTS idx_companies_subscription_expires
  ON companies(subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

-- Composite index for subscription cron
CREATE INDEX IF NOT EXISTS idx_companies_active_expiring
  ON companies(subscription_expires_at, integration_status)
  WHERE integration_status = 'active';

-- Prevent concurrent onboarding attempts
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_pending_onboarding
  ON companies(yclients_id)
  WHERE integration_status IN ('pending_payment', 'pending_channels');

-- === ROBOKASSA_PAYMENTS TABLE ===

-- Plan type
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  plan_type VARCHAR(20);

-- Subscription period in days
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  subscription_period_days INTEGER;

-- CRITICAL: YClients payment ID for refunds!
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  yclients_payment_id INTEGER;
EOF
```

### Apply Migration
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && \
  PGPASSWORD='}X|oM595A<7n?0' psql \
    -h a84c973324fdaccfc68d929d.twc1.net \
    -U gen_user \
    -d default_db \
    -f migrations/20251205_add_onboarding_fields.sql"
```

### Test Feature Flag
```bash
# Test with flag off
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "grep ENABLE_PAID_ONBOARDING /opt/ai-admin/.env"

# Toggle flag
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "sed -i 's/ENABLE_PAID_ONBOARDING=false/ENABLE_PAID_ONBOARDING=true/' /opt/ai-admin/.env && pm2 restart all"
```

### Test Endpoints
```bash
# Test payment status polling
curl -s "https://adminai.tech/api/onboarding/payment-status?inv=TEST123" | jq

# Test onboarding status (with JWT)
curl -s "https://adminai.tech/api/onboarding/status" \
  -H "Authorization: Bearer <JWT_TOKEN>" | jq
```

---

## Dependencies

This project depends on:
- `robokassa-integration` (92% complete) - Payment processing
- `yclients-marketplace-full-integration` (100% complete) - YClients API

---

## Estimated Timeline (Updated after third review - A+ ready)

| Phase | Hours | Notes |
|-------|-------|-------|
| Phase 0 | 0.5h | |
| Phase 1 | 2-3h | +repository methods |
| Phase 2 | 7-9h | +crypto token, token exchange |
| Phase 3 | 1.5-2h | +constraint handling |
| Phase 4 | 4-5h | +manual resolution, cleanup docs |
| Phase 5 | 5-6h | +renewal UI, mismatch handling, FAQ |
| Phase 6 | 5-6h | +unit tests, failure scenarios, load |
| Phase 7 | 3-4h | +cron infrastructure, runbook, metrics |
| **Total** | **28-35h** | ↑ from 22-28h (bulletproof A+) |
