# Salon Onboarding Flow - Complete Integration Plan

**Last Updated:** 2025-12-05
**Status:** Planning Complete, Ready for Implementation
**Priority:** High
**Estimated Effort:** 28-35 hours (updated after third review)
**Dependencies:** `robokassa-integration` (92% complete)
**Review Grade:** A+ (95+/100) ✅ Third review complete - bulletproof

---

## Executive Summary

Полный флоу подключения салона от нажатия "Подключить" в YClients Marketplace до активации WhatsApp/Telegram. Проект объединяет существующую Robokassa интеграцию с новыми страницами онбординга и интеграцией с YClients Marketplace API.

### Ключевые решения (от пользователя)

| Вопрос | Ответ |
|--------|-------|
| **Trial период?** | Нет, сразу оплата |
| **Тарифы?** | 19,990₽/мес ИЛИ 49,990₽/3 месяца |
| **Каналы?** | WhatsApp, Telegram, или оба - всё включено в цену |
| **Landing Page?** | Только через YClients Marketplace |

---

## Current State Analysis

### Что уже есть (✅)

| Компонент | Статус | Файлы |
|-----------|--------|-------|
| **YClients Marketplace API** | 100% готов | `marketplace-client.js` (13/13 endpoints) |
| **Robokassa Integration** | 92% готов | `robokassa-service.js`, `robokassa.js` |
| **WhatsApp QR** | 100% готов | `yclients-marketplace.js` (существующий `/marketplace/api/qr`) |
| **Telegram Bot** | 100% готов | `telegram-manager.js`, `@AdmiAI_bot` |
| **База данных** | 90% готов | `companies`, `robokassa_payments`, `marketplace_events` |
| **MCP tools** | 100% готов | 7 marketplace tools в `mcp-yclients` |

### Что нужно добавить (🔧)

1. **Feature Flag** `ENABLE_PAID_ONBOARDING` - для градуального rollout
2. **Страница оплаты** (`/onboarding/checkout`) - выбор тарифа, кнопка "Оплатить"
3. **Страница выбора каналов** (`/onboarding/channels`) - WhatsApp / Telegram / Оба
4. **Onboarding страницы** - QR WhatsApp, инструкция Telegram, финальная
5. **Изменение redirect** в `/auth/yclients/redirect` → `/onboarding/checkout`
6. **Интеграция Robokassa → YClients** - POST /partner/payment после оплаты
7. **JWT Token Structure** - разные payload для разных стадий
8. **Onboarding Resume** - механизм возобновления прерванного онбординга
9. **Subscription Lifecycle** - истечение подписки, уведомления

---

## Full Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  ЕДИНСТВЕННЫЙ ПУТЬ: Через YClients Marketplace                     │
│  (все клиенты приходят из YClients)                                │
└─────────────────────────────────────────────────────────────────────┘

[YClients Marketplace]
       │
       ▼ Нажимает "Подключить"
       │
[1. /auth/yclients/redirect?salon_id=XXX&user_data=...&signature=...]
       │
       ├─→ Валидация HMAC-SHA256 подписи
       ├─→ Check: ENABLE_PAID_ONBOARDING=true?
       │   ├─→ true: integration_status='pending_payment'
       │   └─→ false: старый флоу (pending_whatsapp)
       ├─→ Создание/обновление Company
       ├─→ Генерация JWT токена (type: 'payment_checkout', exp: 1h)
       │
       ▼
[2. /onboarding/checkout?token=JWT]  ← НОВАЯ СТРАНИЦА
       │
       │   ┌─────────────────────────────────────────┐
       │   │  Выберите тариф:                       │
       │   │                                         │
       │   │  ○ Месячный      19 990 ₽/мес          │
       │   │  ● 3 месяца      49 990 ₽  (скидка!)   │
       │   │                                         │
       │   │  Что входит:                            │
       │   │  ✓ AI-администратор 24/7               │
       │   │  ✓ WhatsApp + Telegram                 │
       │   │  ✓ Запись клиентов                     │
       │   │  ✓ Напоминания                         │
       │   │                                         │
       │   │  [Оплатить через Robokassa]            │
       │   └─────────────────────────────────────────┘
       │
       ├─→ POST /api/onboarding/create-payment { plan_type: 'monthly'|'quarterly' }
       │   └─→ SERVER-SIDE pricing (не доверяем frontend!)
       │   └─→ Генерация InvoiceId, MD5 подпись
       │   └─→ Сохранить invoice_id в сессию
       │   └─→ Return Robokassa URL
       │
       ▼
[3. Robokassa - клиент оплачивает]
       │
       ▼
[4. POST /api/payments/robokassa/result]  ← Server-to-server Callback
       │
       ├─→ Валидация MD5 подписи
       ├─→ robokassa_payments.status = 'success'
       ├─→ Уведомление YClients: POST /partner/payment
       │   └─→ Сохранить yclients_payment_id в robokassa_payments!
       ├─→ Company:
       │   └─→ integration_status = 'pending_channels'
       │   └─→ subscription_plan = 'monthly'|'quarterly'
       │   └─→ subscription_expires_at = NOW() + period
       │
       ▼ (параллельно)
[5. User redirect: Robokassa Success URL → /onboarding/payment-success?inv=XXX]
       │
       │   ┌─────────────────────────────────────────┐
       │   │  ⏳ Проверяем оплату...                 │
       │   │                                         │
       │   │  (polling GET /api/onboarding/payment-status?inv=XXX)
       │   │                                         │
       │   │  → status: 'success' → auto-redirect   │
       │   └─────────────────────────────────────────┘
       │
       ├─→ Generate NEW JWT (type: 'onboarding', payment_verified: true, exp: 24h)
       │
       ▼
[6. /onboarding/channels?token=NEW_JWT]
       │
       │   ┌─────────────────────────────────────────┐
       │   │  🎉 Оплата прошла!                      │
       │   │                                         │
       │   │  Выберите каналы для вашего салона:    │
       │   │                                         │
       │   │  ☑ WhatsApp                            │
       │   │    Клиенты пишут на номер салона       │
       │   │                                         │
       │   │  ☑ Telegram                            │
       │   │    Подключите @AdmiAI_bot              │
       │   │                                         │
       │   │  [Продолжить]                          │
       │   └─────────────────────────────────────────┘
       │
       ├─→ POST /api/onboarding/select-channels
       │   └─→ selected_channels = ['whatsapp', 'telegram']
       │   └─→ Rate limiting: 10 req/min per company
       │
       ▼
[7. /onboarding/whatsapp?token=JWT]  (если выбран WhatsApp)
       │
       │   ┌─────────────────────────────────────────┐
       │   │  Подключите WhatsApp                   │
       │   │                                         │
       │   │  1. Откройте WhatsApp на телефоне      │
       │   │  2. Настройки → Связанные устройства   │
       │   │  3. Отсканируйте QR-код:               │
       │   │                                         │
       │   │         ▓▓▓▓▓▓▓▓▓▓▓▓                   │
       │   │         ▓▓ QR CODE ▓▓                   │
       │   │         ▓▓▓▓▓▓▓▓▓▓▓▓                   │
       │   │                                         │
       │   │  Статус: Ожидание... ⏳                │
       │   └─────────────────────────────────────────┘
       │
       ├─→ POST /marketplace/api/qr → QR код (СУЩЕСТВУЮЩИЙ)
       ├─→ Polling GET /marketplace/api/status/:sessionId
       ├─→ Клиент сканирует → status = 'connected'
       │   └─→ Сохраняем WhatsApp phone number
       │
       ▼
[8. /onboarding/telegram?token=JWT]  (если выбран Telegram)
       │
       │   ┌─────────────────────────────────────────┐
       │   │  Подключите Telegram Business          │
       │   │                                         │
       │   │  ⚠️ Требуется Telegram Premium         │
       │   │                                         │
       │   │  1. Telegram → Настройки → Бизнес      │
       │   │  2. Включите "Чат-бот"                 │
       │   │  3. Добавьте @AdmiAI_bot               │
       │   │                                         │
       │   │  [Я подключил бота ✓]                  │  ← Confirmation, not API verify
       │   │  [Пропустить →]                        │
       │   └─────────────────────────────────────────┘
       │
       ├─→ POST /api/onboarding/telegram/confirm
       │   └─→ telegram_pending_verification = true
       │   └─→ Actual verification: first message from business
       │
       ▼
[9. /onboarding/complete]
       │
       ├─→ Company.integration_status = 'active'
       ├─→ Callback в YClients: POST /partner/callback/redirect
       │   └─→ activation_status: "success"
       │
       │   ┌─────────────────────────────────────────┐
       │   │  🎉 Всё готово!                        │
       │   │                                         │
       │   │  Ваш AI-администратор подключен:       │
       │   │                                         │
       │   │  ✅ WhatsApp: +7 900 123-45-67         │  ← from Baileys session
       │   │  ✅ Telegram: ожидает первое сообщение │
       │   │                                         │
       │   │  Теперь клиенты могут:                 │
       │   │  • Записываться 24/7                   │
       │   │  • Получать напоминания                │
       │   │  • Переносить записи                   │
       │   │                                         │
       │   │  [Вернуться в YClients]                │
       │   └─────────────────────────────────────────┘
       │
       ▼
[YClients показывает: "Интеграция активна ✅"]
```

---

## JWT Token Structure

### Stage 1: Payment Checkout (1 hour expiry)
```javascript
{
  type: 'payment_checkout',
  company_id: 123,
  salon_id: 962302,
  user_email: 'salon@example.com',
  iat: 1733400000,
  exp: 1733403600  // +1 hour
}
```

### Stage 2: Onboarding Flow (24 hour expiry)
```javascript
{
  type: 'onboarding',
  company_id: 123,
  salon_id: 962302,
  payment_verified: true,
  invoice_id: 'INV-123456',
  iat: 1733403600,
  exp: 1733490000  // +24 hours
}
```

### Stage 3: Resume Token (7 day expiry)
```javascript
{
  type: 'onboarding_resume',
  company_id: 123,
  salon_id: 962302,
  current_step: 'pending_channels',  // or 'pending_whatsapp', 'pending_telegram'
  iat: 1733400000,
  exp: 1734004800  // +7 days
}
```

---

## Pricing Configuration (Server-Side Only!)

```javascript
// src/config/pricing.js
const PRICING = {
  monthly: {
    amount: 19990,
    period_days: 30,
    description: 'AI Администратор - Месячный'
  },
  quarterly: {
    amount: 49990,
    period_days: 90,
    description: 'AI Администратор - Квартальный'
  }
};

// NEVER trust client-provided amounts!
function getPricing(plan_type) {
  const plan = PRICING[plan_type];
  if (!plan) throw new Error(`Invalid plan type: ${plan_type}`);
  return plan;
}
```

---

## Database Changes

### 1. New columns in `companies`

```sql
-- migrations/20251205_add_onboarding_fields.sql

-- Выбранные каналы
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  selected_channels TEXT[] DEFAULT '{}';

-- Тарифный план
ALTER TABLE companies ADD COLUMN IF NOT EXISTS
  subscription_plan VARCHAR(20);

-- Дата окончания подписки
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

-- Индекс для быстрого поиска истекающих подписок
CREATE INDEX IF NOT EXISTS idx_companies_subscription_expires
  ON companies(subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

-- Composite index for active expiring (for subscription cron)
CREATE INDEX IF NOT EXISTS idx_companies_active_expiring
  ON companies(subscription_expires_at, integration_status)
  WHERE integration_status = 'active';

-- Prevent concurrent onboarding attempts
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_pending_onboarding
  ON companies(yclients_id)
  WHERE integration_status IN ('pending_payment', 'pending_channels');
```

### 2. Updates to `robokassa_payments`

```sql
-- Добавить план подписки к платежу
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  plan_type VARCHAR(20);

-- Добавить период подписки в днях
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  subscription_period_days INTEGER;

-- КРИТИЧНО: YClients payment ID для refunds!
ALTER TABLE robokassa_payments ADD COLUMN IF NOT EXISTS
  yclients_payment_id INTEGER;
```

---

## Company Status Flow

| Статус | Описание | Следующий шаг |
|--------|----------|---------------|
| `pending_payment` | Пришёл из YClients, ожидает оплаты | → `pending_channels` |
| `pending_channels` | Оплачено, выбирает каналы | → `pending_whatsapp` / `pending_telegram` / `active` |
| `pending_whatsapp` | Ожидает подключения WhatsApp QR | → `pending_telegram` / `active` |
| `pending_telegram` | Ожидает подключения Telegram | → `active` |
| `active` | Полностью работает | → `frozen` / `uninstalled` |
| `frozen` | Заморожено (webhook freeze от YClients) | → `active` (после оплаты) |
| `uninstalled` | Удалено (webhook uninstall от YClients) | ✗ (финальный) |

---

## Feature Flag: Gradual Rollout

```bash
# .env
ENABLE_PAID_ONBOARDING=false  # Start with false (old flow)
```

```javascript
// In yclients-marketplace.js redirect handler
const enablePaidOnboarding = process.env.ENABLE_PAID_ONBOARDING === 'true';

if (enablePaidOnboarding) {
  // New paid flow
  await companyRepository.updateByYclientsId(salon_id, {
    integration_status: 'pending_payment'
  });
  const token = generateJWT({ type: 'payment_checkout', company_id, salon_id });
  return res.redirect(`/onboarding/checkout?token=${token}`);
} else {
  // Old free flow (existing behavior)
  await companyRepository.updateByYclientsId(salon_id, {
    integration_status: 'pending_whatsapp'
  });
  return res.redirect(`/marketplace/onboarding?token=${token}`);
}
```

---

## Onboarding Resume Mechanism

### Problem
User closes browser during onboarding. How to resume?

### Solution
1. **Magic Link via Email** - Send resume link after payment
2. **Resume Endpoint** - `GET /api/onboarding/resume?email=X`

```javascript
// POST /api/onboarding/send-resume-link
// Sends email with resume token (7-day expiry)

// GET /api/onboarding/resume?token=RESUME_TOKEN
// Validates token, checks company status, redirects to appropriate step
async function resumeOnboarding(resumeToken) {
  const payload = jwt.verify(resumeToken, JWT_SECRET);
  const company = await companyRepository.findById(payload.company_id);

  // Generate fresh onboarding token
  const newToken = generateJWT({
    type: 'onboarding',
    company_id: company.id,
    salon_id: company.yclients_id,
    payment_verified: true
  });

  // Redirect based on current status
  switch (company.integration_status) {
    case 'pending_channels':
      return `/onboarding/channels?token=${newToken}`;
    case 'pending_whatsapp':
      return `/onboarding/whatsapp?token=${newToken}`;
    case 'pending_telegram':
      return `/onboarding/telegram?token=${newToken}`;
    case 'active':
      return `/onboarding/complete?token=${newToken}`;
    default:
      throw new Error('Invalid onboarding state');
  }
}
```

---

## Subscription Lifecycle (Phase 7)

### Expiration Monitoring Cron
```javascript
// src/cron/subscription-monitor.js
// Runs daily at 09:00 Moscow time

async function checkExpiringSubscriptions() {
  const now = new Date();

  // 7 days warning
  const sevenDays = await companyRepository.findExpiringBetween(
    addDays(now, 6), addDays(now, 7)
  );
  for (const company of sevenDays) {
    await sendExpirationReminder(company, 7);
  }

  // 3 days warning
  const threeDays = await companyRepository.findExpiringBetween(
    addDays(now, 2), addDays(now, 3)
  );
  for (const company of threeDays) {
    await sendExpirationReminder(company, 3);
  }

  // 1 day warning
  const oneDay = await companyRepository.findExpiringBetween(
    addDays(now, 0), addDays(now, 1)
  );
  for (const company of oneDay) {
    await sendExpirationReminder(company, 1);
  }

  // Expired + 3 day grace period → freeze
  const expired = await companyRepository.findExpiredWithGrace(3);
  for (const company of expired) {
    await freezeCompany(company, 'subscription_expired');
    await sendExpiredNotification(company);
  }
}
```

### Grace Period: 3 Days
- After expiration: 3 days to renew without losing setup
- After grace: status → 'frozen', stops processing messages
- Renewal during grace: instant reactivation

---

## WhatsApp Phone Number Extraction (NEW from second review)

**Problem:** Need to display WhatsApp phone number on completion page.

**Solution:** Extract from Baileys session after QR scan:

```javascript
// In session-pool.js or whatsapp status handler
// After QR scan success
sock.ev.on('connection.update', async (update) => {
  if (update.connection === 'open') {
    // Phone number in format: 79001234567@s.whatsapp.net
    const phoneNumber = sock.user.id.split('@')[0];

    await companyRepository.updateByYclientsId(salonId, {
      whatsapp_phone: phoneNumber,
      whatsapp_connected: true
    });
  }
});
```

**Display:** On completion page show formatted: "+7 900 123-45-67"

---

## Telegram Verification Approach

### Problem
No API to verify if `@AdmiAI_bot` is connected as Telegram Business Bot.

### Solution
"Trust but verify" approach:

1. **User Confirmation** - Button "Я подключил бота ✓"
2. **Set Flag** - `telegram_pending_verification = true`
3. **Actual Verification** - On first message from business account:
   ```javascript
   // In telegram-manager.js message handler
   if (business_connection && !company.telegram_verified) {
     await companyRepository.update(company.id, {
       telegram_verified: true,
       telegram_pending_verification: false,
       telegram_business_id: business_connection.id
     });
   }
   ```
4. **UI State** - Show "Ожидает первое сообщение" until verified

---

## Security Measures

### 1. Server-Side Pricing
```javascript
// NEVER trust client
const { amount } = PRICING[plan_type];  // From server config
```

### 2. Rate Limiting
```javascript
// src/api/routes/onboarding.js
const rateLimit = require('express-rate-limit');

const onboardingLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute
  keyGenerator: (req) => req.company_id || req.ip,
  message: { error: 'Too many requests, please try again later' }
});

router.use(onboardingLimiter);
```

### 3. Short-Lived URL Tokens
```javascript
// Instead of JWT in URL, use short-lived exchange tokens
const urlToken = generateShortToken({
  company_id,
  exp: Date.now() + 5 * 60 * 1000  // 5 minutes
});
// On page load, exchange for session cookie
```

### 4. CSRF Protection
```javascript
// All state-changing operations require Authorization header
// No cookie-based auth for onboarding endpoints
```

---

## Files to Create/Modify

### Backend (src/)

| Файл | Описание | Действие |
|------|----------|----------|
| `src/config/pricing.js` | Server-side pricing config | **CREATE** |
| `src/api/routes/onboarding.js` | Новые endpoints онбординга | **CREATE** |
| `src/api/controllers/OnboardingController.js` | Controller (extends BaseController) | **CREATE** |
| `src/services/onboarding/onboarding-service.js` | Бизнес-логика онбординга | **CREATE** |
| `src/cron/subscription-monitor.js` | Subscription expiration cron | **CREATE** |
| `src/api/routes/yclients-marketplace.js` | Изменить redirect после /auth | **MODIFY** |
| `src/api/webhooks/robokassa.js` | Добавить вызов YClients API | **MODIFY** |
| `src/services/payment/robokassa-service.js` | Добавить plan_type | **MODIFY** |

### Frontend (public/)

| Файл | Описание |
|------|----------|
| `public/onboarding/checkout.html` | Страница выбора тарифа и оплаты |
| `public/onboarding/payment-success.html` | Payment verification polling |
| `public/onboarding/channels.html` | Выбор каналов после оплаты |
| `public/onboarding/whatsapp.html` | QR-код для WhatsApp |
| `public/onboarding/telegram.html` | Инструкция Telegram Business |
| `public/onboarding/complete.html` | Успешное завершение |
| `public/css/onboarding.css` | Общие стили |
| `public/js/onboarding.js` | Логика polling и проверок |

### Migrations

| Файл | Описание |
|------|---------|
| `migrations/20251205_add_onboarding_fields.sql` | Колонки для онбординга |

---

## New API Endpoints

### Onboarding Routes (`/api/onboarding/`)

| Method | Path | Описание | Auth | Rate Limit |
|--------|------|----------|------|------------|
| POST | `/create-payment` | Create Robokassa payment | JWT (payment_checkout) | 5/min |
| GET | `/payment-status` | Check payment status by invoice_id | None (public) | 30/min |
| POST | `/select-channels` | Сохранить выбранные каналы | JWT (onboarding) | 10/min |
| GET | `/status` | Получить текущий статус онбординга | JWT (onboarding) | 30/min |
| GET | `/whatsapp/qr` | Получить QR-код (proxy to existing) | JWT (onboarding) | 10/min |
| GET | `/whatsapp/status` | Статус подключения WhatsApp | JWT (onboarding) | 30/min |
| POST | `/telegram/confirm` | Подтвердить подключение Telegram | JWT (onboarding) | 10/min |
| POST | `/complete` | Завершить онбординг, callback в YClients | JWT (onboarding) | 5/min |
| POST | `/send-resume-link` | Send resume email | JWT (onboarding) | 3/hour |
| GET | `/resume` | Resume onboarding from email link | Token in query | 10/min |

### Payment Routes (modifications)

| Method | Path | Изменение |
|--------|------|-----------|
| POST | `/api/payments/robokassa/result` | Add YClients notifyPayment(), save yclients_payment_id |

---

## Critical Integrations

### 1. After successful payment → Notify YClients

```javascript
// В robokassa.js после processPayment()
const { YclientsMarketplaceClient } = require('../../integrations/yclients/marketplace-client');

const marketplaceClient = new YclientsMarketplaceClient(
  process.env.YCLIENTS_PARTNER_TOKEN,
  process.env.YCLIENTS_APP_ID
);

// Рассчитать период подписки
const subscriptionStart = new Date();
const subscriptionEnd = new Date();
subscriptionEnd.setDate(subscriptionEnd.getDate() + (plan_type === 'quarterly' ? 90 : 30));

// Уведомить YClients о платеже
const paymentResult = await marketplaceClient.notifyPayment(salon_id, {
  payment_sum: amount,
  currency_iso: 'RUB',
  payment_date: subscriptionStart.toISOString().split('T')[0],
  period_from: subscriptionStart.toISOString().split('T')[0],
  period_to: subscriptionEnd.toISOString().split('T')[0]
});

// КРИТИЧНО: Сохранить yclients_payment_id для refunds!
await robokassaPaymentRepository.update(payment.id, {
  yclients_payment_id: paymentResult.id  // ← Store in robokassa_payments!
});

// Также в marketplace_events для аудита
await marketplaceEventsRepository.insert({
  company_id,
  salon_id,
  event_type: 'payment_notified',
  event_data: {
    robokassa_invoice_id: invoiceId,
    yclients_payment_id: paymentResult.id,
    amount,
    plan_type
  }
});

// Обновить компанию
await companyRepository.updateByYclientsId(salon_id, {
  integration_status: 'pending_channels',
  subscription_plan: plan_type,
  subscription_expires_at: subscriptionEnd.toISOString()
});
```

### 1.1 YClients Notification Retry Queue (NEW from second review)

```javascript
// src/queue/yclients-notification-queue.js
const { Queue, Worker } = require('bullmq');
const { YclientsMarketplaceClient } = require('../integrations/yclients/marketplace-client');
const Sentry = require('@sentry/node');

const yclientsNotificationQueue = new Queue('yclients-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000  // 5s, 10s, 20s, 40s, 80s
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

// Job processor
const worker = new Worker('yclients-notifications', async (job) => {
  const { salonId, paymentData, invoiceId } = job.data;

  const marketplaceClient = new YclientsMarketplaceClient(
    process.env.YCLIENTS_PARTNER_TOKEN,
    process.env.YCLIENTS_APP_ID
  );

  const result = await marketplaceClient.notifyPayment(salonId, paymentData);

  if (!result.success) {
    throw new Error(result.error?.message || 'YClients notification failed');
  }

  // Save yclients_payment_id
  await robokassaPaymentRepository.updateByInvoiceId(invoiceId, {
    yclients_payment_id: result.data.id
  });

  return result;
}, { connection: redisConnection });

// Alert on final failure
worker.on('failed', (job, error) => {
  if (job.attemptsMade >= 5) {
    Sentry.captureException(error, {
      level: 'error',
      extra: {
        invoiceId: job.data.invoiceId,
        salonId: job.data.salonId,
        attempts: job.attemptsMade
      },
      tags: { queue: 'yclients-notifications' }
    });
  }
});
```

### 1.2 Idempotency Check (NEW from second review)

```javascript
// In Robokassa webhook, before calling notifyPayment
const payment = await robokassaPaymentRepository.findByInvoiceId(invoiceId);

// Idempotency: Skip if already notified YClients
if (payment.yclients_payment_id) {
  logger.info(`YClients already notified for invoice ${invoiceId}, skipping`);
  return { success: true, already_notified: true };
}

// Queue the notification instead of direct call
await yclientsNotificationQueue.add('notify-payment', {
  salonId: payment.salon_id,
  invoiceId: payment.invoice_id,
  paymentData: {
    payment_sum: payment.amount,
    currency_iso: 'RUB',
    payment_date: new Date().toISOString().split('T')[0],
    period_from: subscriptionStart.toISOString().split('T')[0],
    period_to: subscriptionEnd.toISOString().split('T')[0]
  }
});
```

### 1.3 Test Mode Handling (NEW from second review)

```javascript
// In Robokassa webhook, check test mode
const robokassaConfig = require('../config/robokassa');

if (robokassaConfig.settings.isTestMode) {
  logger.info('Robokassa TEST MODE: Skipping YClients notification');

  // Still update local status for testing the flow
  await companyRepository.updateByYclientsId(salon_id, {
    integration_status: 'pending_channels',
    subscription_plan: plan_type,
    subscription_expires_at: subscriptionEnd.toISOString()
  });

  // Skip YClients API call
  return { success: true, test_mode: true };
}

// Production: Queue the notification
await yclientsNotificationQueue.add('notify-payment', { ... });
```

### 2. Payment Status Polling (for Success Page)

```javascript
// GET /api/onboarding/payment-status?inv=XXX
// Public endpoint - no auth required (invoice_id is secret enough)

async function getPaymentStatus(invoiceId) {
  const payment = await robokassaPaymentRepository.findByInvoiceId(invoiceId);

  if (!payment) {
    return { status: 'not_found' };
  }

  if (payment.status === 'success') {
    // Generate new onboarding JWT
    const company = await companyRepository.findById(payment.company_id);
    const token = generateJWT({
      type: 'onboarding',
      company_id: company.id,
      salon_id: company.yclients_id,
      payment_verified: true,
      exp: Date.now() + 24 * 60 * 60 * 1000  // 24 hours
    });

    return {
      status: 'success',
      redirect_url: `/onboarding/channels?token=${token}`
    };
  }

  return { status: payment.status };  // 'pending', 'failed', etc.
}
```

### 3. After onboarding complete → Callback to YClients

```javascript
// В onboarding.js endpoint /complete
const marketplaceClient = new YclientsMarketplaceClient(...);

await marketplaceClient.callbackWithRedirect(salon_id, {
  api_key: company.api_key,
  webhook_urls: {
    records: `${process.env.BASE_URL}/webhook/yclients`,
    clients: `${process.env.BASE_URL}/webhook/yclients`
  }
});

// Обновить статус компании
await companyRepository.updateByYclientsId(salon_id, {
  integration_status: 'active'
});

// Send resume link email (for future reference)
await sendOnboardingCompleteEmail(company);
```

---

## Implementation Phases

### Phase 0: Feature Flag Setup (0.5 hours)
- Add `ENABLE_PAID_ONBOARDING=false` to .env
- Modify redirect handler to check flag
- Test both flows work

### Phase 1: Database (1-2 hours)
- Create migration `20251205_add_onboarding_fields.sql`
- Apply migration to production
- Update CompanyRepository with new methods
- Update RobokassaPaymentRepository with yclients_payment_id

### Phase 2: Backend Onboarding (5-6 hours)
- Create `src/config/pricing.js`
- Create `src/api/controllers/OnboardingController.js`
- Create `src/api/routes/onboarding.js` with rate limiting
- Create `src/services/onboarding/onboarding-service.js`
- Implement JWT generation for different stages
- Implement payment status polling endpoint
- Add resume mechanism

### Phase 3: Modify YClients Marketplace Route (1-2 hours)
- Modify `/auth/yclients/redirect` → feature flag check
- Generate payment_checkout JWT
- Test redirect flow with flag on/off

### Phase 4: Robokassa Integration (2-3 hours)
- Modify `robokassa.js` to call YClients notifyPayment()
- Store yclients_payment_id in robokassa_payments
- Add plan_type handling
- Handle YClients API failures (retry queue)

### Phase 5: Frontend Pages (4-5 hours)
- Create `checkout.html` - plan selection
- Create `payment-success.html` - payment verification with polling
- Create `channels.html` - channel selection
- Create `whatsapp.html` - QR code with polling
- Create `telegram.html` - instructions with confirmation
- Create `complete.html` - final page
- Create shared CSS and JS

### Phase 6: Testing (3-4 hours)
- Test full flow with test payment
- Test feature flag (both modes)
- Test WhatsApp connection
- Test Telegram confirmation
- Test YClients callback
- Test error handling
- Test resume mechanism

### Phase 7: Subscription Lifecycle (2-3 hours)
- Create `src/cron/subscription-monitor.js`
- Implement expiration notifications (7, 3, 1 day)
- Implement grace period handling
- Add PM2 cron job

---

## Timeline Estimate (Updated after third review - A+ ready)

| Phase | Time | Notes |
|-------|------|-------|
| Phase 0: Feature Flag | 0.5h | |
| Phase 1: Database & Repository | 2-3h | +repository methods |
| Phase 2: Backend | 7-9h | +crypto token, token exchange |
| Phase 3: Marketplace Redirect | 1.5-2h | +constraint handling |
| Phase 4: Robokassa | 4-5h | +manual resolution, cleanup docs |
| Phase 5: Frontend | 5-6h | +renewal UI, mismatch handling, FAQ |
| Phase 6: Testing | 5-6h | +unit tests, failure scenarios, load |
| Phase 7: Subscription & Operations | 3-4h | +cron infrastructure, runbook, metrics |
| **Total** | **28-35 hours** | ↑ from 22-28h (bulletproof A+) |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Robokassa payment fails | Low | High | Logging, retry UI, support contact |
| YClients notifyPayment fails | Medium | High | **Retry queue with backoff**, manual admin fallback |
| QR code generation fails | Medium | Medium | Circuit breaker (already exists) |
| Telegram connection not found | Medium | Low | Confirmation button, verify on first message |
| User abandons onboarding | Medium | Medium | **Resume mechanism via email** |
| Concurrent onboarding attempts | Low | Medium | **Unique index prevents duplicates** |
| JWT expires mid-onboarding | Medium | Medium | **24h expiry for onboarding, resume link** |
| Payment webhook race condition | Low | High | **Polling on success page handles this** |

---

## Success Metrics

1. **Functional:** Complete flow from "Подключить" to "Интеграция активна"
2. **Payment:** Robokassa payment processed, YClients notified
3. **Channels:** At least one channel (WhatsApp or Telegram) connected
4. **YClients:** Integration shows as "active" in marketplace
5. **Time:** Full onboarding < 5 minutes
6. **Resume:** User can resume from any step within 7 days
7. **Refunds:** yclients_payment_id stored for all payments

---

## Open Questions (Clarified)

| Question | Resolution |
|----------|------------|
| When to call `callbackWithRedirect()`? | After onboarding complete (not after payment, not after WhatsApp) |
| Telegram Premium required? | **Yes, required** for Business Bot (Premium = $4.99/month) |
| WhatsApp phone display | From Baileys session `sessionId` / `jid` |
| Existing free users? | Grandfathered - no migration needed (different integration_status) |
| Payment retry if YClients fails? | Retry queue with exponential backoff, manual admin fallback |

---

## Related Projects

- `dev/active/robokassa-integration/` - Payment handling (92% complete)
- `dev/completed/yclients-marketplace-full-integration/` - Marketplace API
- `dev/completed/marketplace-code-improvements/` - Security fixes
- `dev/active/onboarding-critical-fixes/` - Recent fixes

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/integrations/yclients/marketplace-client.js` | YClients Marketplace API |
| `src/api/routes/yclients-marketplace.js` | Existing marketplace routes |
| `src/services/payment/robokassa-service.js` | Payment processing |
| `src/api/webhooks/robokassa.js` | Payment webhook |
| `src/repositories/CompanyRepository.js` | Company data access |
| `src/repositories/RobokassaPaymentRepository.js` | Payment data access |
