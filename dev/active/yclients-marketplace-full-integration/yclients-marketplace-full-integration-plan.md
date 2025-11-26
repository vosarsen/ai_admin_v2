# YClients Marketplace API Full Integration Plan

**Last Updated:** 2025-11-26
**Status:** Phase 0 COMPLETE ✅ | Phase 1 Ready to Start
**Estimated Effort:** 11 hours (Phase 0 complete: -6h)
**Priority:** High

---

## Executive Summary

Интеграция всех 13 эндпоинтов YClients Marketplace API для полного управления подключениями салонов, платежами, тарифами и каналами уведомлений.

**Текущее состояние:** 1.5 из 13 эндпоинтов реализовано (12%)
**Целевое состояние:** 13 из 13 эндпоинтов (100%)

---

## ✅ Phase 0 COMPLETE: Supabase Removal Fixed

### Problem Was
После `dev/completed/supabase-full-removal/` код marketplace был сломан - удалены только импорты, но не вызовы.

### Solution Applied
Проект `dev/completed/supabase-broken-references-fix/` полностью исправил проблему:

| Компонент | Статус | Детали |
|-----------|--------|--------|
| `MarketplaceEventsRepository` | ✅ Created | 3 метода, Sentry, тесты |
| `AppointmentsCacheRepository` | ✅ Created | 7 методов, Sentry, тесты |
| `WebhookEventsRepository` | ✅ Created | 3 метода, Sentry, тесты |
| `MessageRepository` | ✅ Created | 2 метода, Sentry, тесты |
| `CompanyRepository` | ✅ Extended | +7 методов |
| `marketplace-service.js` | ✅ Migrated | 7 supabase → repository |
| `yclients-marketplace.js` | ✅ Migrated | 12 supabase → repository |
| `webhook-processor/index.js` | ✅ Migrated | 9 supabase → repository |
| `webhooks/yclients.js` | ✅ Migrated | 2 supabase → repository |

**Code Review Grade:** A (94/100) → A+ (98/100) after fixes
**Commit:** `1db4dc4` (main branch)

### Ready for Phase 1
Marketplace код работает, можно продолжать с Phase 1: YclientsMarketplaceClient.

---

## Current State Analysis

### Реализованные эндпоинты

| Endpoint | Статус | Файл | DB Status |
|----------|--------|------|-----------|
| `POST /marketplace/partner/callback/redirect` | ✅ | `yclients-marketplace.js` | ✅ Works |
| `POST /webhook/yclients` (uninstall, freeze) | ✅ | `yclients-marketplace.js` | ✅ Works |

### ✅ Supabase Migration Complete

Все 31 вызов Supabase мигрированы на Repository Pattern:
- **marketplace-service.js:** 7 вызовов → CompanyRepository ✅
- **yclients-marketplace.js:** 12 вызовов → CompanyRepository + MarketplaceEventsRepository ✅
- **webhook-processor/index.js:** 9 вызовов → 5 repositories ✅
- **webhooks/yclients.js:** 2 вызова → WebhookEventsRepository ✅
- **booking-ownership.js:** 1 вызов → AppointmentsCacheRepository ✅

Подробности: `dev/completed/supabase-broken-references-fix/`

### Нереализованные эндпоинты (11 шт.)

1. `POST /marketplace/partner/callback` - Установка без редиректа
2. `POST /marketplace/partner/payment` - Уведомление об оплате
3. `POST /marketplace/partner/short_names` - SMS sender names
4. `POST /marketplace/partner/payment/refund/{id}` - Возврат платежа
5. `GET /marketplace/salon/{id}/application/{id}` - Статус подключения
6. `GET /marketplace/application/{id}/salons` - Список салонов
7. `POST /marketplace/salon/{id}/application/{id}/uninstall` - Отключение
8. `GET /marketplace/application/payment_link` - Ссылка на оплату
9. `GET /marketplace/application/{id}/tariffs` - Тарифы
10. `POST /marketplace/application/add_discount` - Скидки
11. `POST /marketplace/application/update_channel` - Каналы sms/whatsapp

### Текущая архитектура

```
src/
├── api/routes/yclients-marketplace.js    # REST routes (BROKEN - needs migration)
├── services/marketplace/
│   └── marketplace-service.js            # Business logic (BROKEN - needs migration)
├── integrations/yclients/
│   └── client.js                         # General YClients client
└── api/webhooks/yclients.js              # Webhook handler

mcp/mcp-yclients/server.js                # MCP server (без marketplace)
```

---

## Proposed Future State

### Новая архитектура

```
src/
├── api/routes/yclients-marketplace.js    # REST routes (MIGRATED to Repository)
├── services/marketplace/
│   └── marketplace-service.js            # Business logic (MIGRATED to Repository)
├── integrations/yclients/
│   ├── client.js                         # General YClients client
│   └── marketplace-client.js             # NEW: Marketplace API client
├── repositories/
│   ├── CompanyRepository.js              # EXTENDED with new methods
│   └── MarketplaceEventsRepository.js    # NEW: For marketplace_events table
└── api/webhooks/yclients.js              # Webhook handler (расширенный)

mcp/mcp-yclients/server.js                # MCP server (+ marketplace tools)
```

### Новые возможности

1. **Полное управление подключениями** - статус, список салонов, отключение
2. **Платежи** - уведомления, возвраты, ссылки на оплату
3. **Тарифы и скидки** - просмотр тарифов, установка скидок
4. **Каналы** - управление SMS/WhatsApp каналами
5. **MCP интеграция** - управление через Claude Code

---

## Implementation Phases

### Phase 0: Fix Broken Marketplace Code ✅ COMPLETE
**Effort:** L (6 hours estimated, ~1 hour actual)
**Dependencies:** None
**Status:** ✅ COMPLETE (via `supabase-broken-references-fix` project)

Миграция выполнена через отдельный проект с полным код-ревью.

**Completed:**
1. ✅ Created `MarketplaceEventsRepository.js` (3 methods, tests)
2. ✅ Created `AppointmentsCacheRepository.js` (7 methods, tests)
3. ✅ Created `WebhookEventsRepository.js` (3 methods, tests)
4. ✅ Created `MessageRepository.js` (2 methods, tests)
5. ✅ Extended `CompanyRepository.js` (+7 methods)
6. ✅ Migrated all 5 broken files (31 supabase calls)
7. ✅ Added Sentry error tracking (100% coverage)
8. ✅ Added JSDoc @throws annotations
9. ✅ Added integration tests (4 files, 1,625 lines)
10. ✅ Deployed to production

**Code Review:** Grade A+ (98/100)

### Phase 1: YclientsMarketplaceClient (Core)
**Effort:** L (3 hours)
**Dependencies:** Phase 0

Создание выделенного клиента для Marketplace API с отдельным base URL.

### Phase 2: MarketplaceService Extension
**Effort:** M (2 hours)
**Dependencies:** Phase 0, Phase 1

Расширение бизнес-логики для работы с новыми эндпоинтами.

### Phase 3: API Routes
**Effort:** M (2 hours)
**Dependencies:** Phase 2

Добавление админских REST endpoints.

### Phase 4: Webhook Extensions
**Effort:** S (1 hour)
**Dependencies:** Phase 3

Расширение обработки webhook событий.

### Phase 5: Database Migration
**Effort:** S (1 hour)
**Dependencies:** Phase 0 (для репозиториев)

Минимальное расширение схемы БД.

### Phase 6: MCP Server Extension
**Effort:** M (2 hours)
**Dependencies:** Phase 1

Добавление tools для Claude Code.

---

## Phase Dependencies (Updated)

```
Phase 0: Fix Broken Code ✅ COMPLETE (~1h actual)
    │
    ├──► Phase 1: MarketplaceClient (3h) ◄── NEXT
    │         │
    │         └──► Phase 2: MarketplaceService (2h)
    │                    │
    │                    └──► Phase 3: API Routes (2h)
    │                              │
    │                              └──► Phase 4: Webhooks (1h)
    │
    ├──► Phase 5: DB Migration (1h) ───► Phase 2 (columns needed)
    │
    └──► Phase 6: MCP Server (2h) ◄─── Phase 1 (client needed)
```

---

## Detailed Implementation

### Phase 0: ✅ COMPLETE
See `dev/completed/supabase-broken-references-fix/` for implementation details.

### Phase 1: YclientsMarketplaceClient

**Файл:** `src/integrations/yclients/marketplace-client.js`

> **ВАЖНО:** `application_id` передаётся в constructor и добавляется во все запросы автоматически.
> Все методы используют `this.applicationId` внутри.

```javascript
const MARKETPLACE_BASE = 'https://api.yclients.com/marketplace';

class YclientsMarketplaceClient {
  constructor(partnerToken, applicationId) {
    this.partnerToken = partnerToken;      // YCLIENTS_PARTNER_TOKEN
    this.applicationId = applicationId;    // YCLIENTS_APP_ID (18289)
    this.rateLimiter = new Bottleneck({...}); // 200 req/min
  }

  // === CALLBACKS (МЫ → YClients) ===
  // Уведомляем YClients о регистрации/установке
  async callbackWithRedirect(salonId, apiKey, webhookUrls)
  async callbackInstall(salonId, apiKey, webhookUrls, channels)

  // === ПЛАТЕЖИ (МЫ → YClients) ===
  // ИСХОДЯЩИЕ: уведомляем YClients когда клиент оплатил у НАС
  async notifyPayment(salonId, paymentData)
  // paymentData: { payment_sum, currency_iso, payment_date, period_from, period_to }
  // Возвращает: { id: 123 } - СОХРАНИТЬ payment_id для refund!

  async notifyRefund(paymentId)  // payment_id из notifyPayment response
  async generatePaymentLink(salonId, discount = null)

  // === УПРАВЛЕНИЕ ===
  async getIntegrationStatus(salonId)  // logs + payments + connection_status
  async getConnectedSalons(page = 1, count = 100)  // count <= 1000
  async uninstallFromSalon(salonId)

  // === ТАРИФЫ И СКИДКИ ===
  async getTariffs()  // tariff options с ценами
  async addDiscount(salonIds, discountPercent)  // массив salon_ids

  // === КАНАЛЫ ===
  async updateChannel(salonId, channelSlug, isAvailable)
  // channelSlug: 'sms' | 'whatsapp'
  async setShortNames(salonId, shortNames)  // массив имён отправителя SMS
}
```

**Request body structure (все методы):**
```javascript
{
  salon_id: salonId,
  application_id: this.applicationId,  // Добавляется автоматически
  ...otherFields
}
```

### Phase 2: MarketplaceService Extension

**Файл:** `src/services/marketplace/marketplace-service.js`

Новые методы:
- `notifyYclientsAboutPayment(salonId, paymentData)` - **ИСХОДЯЩИЙ**: сообщить YClients что клиент оплатил
  - Сохранить `payment_id` из response в `marketplace_events`
  - Обновить `last_payment_date` в `companies`
- `notifyYclientsAboutRefund(paymentId, reason)` - уведомить о возврате
- `checkIntegrationHealth(salonId)` - проверка статуса + уведомление
- `getActiveConnections(page, limit)` - список с пагинацией (max 1000)
- `disconnectSalon(salonId, reason)` - отключение + cleanup WhatsApp сессии
- `updateNotificationChannel(salonId, channel, enabled)` - WhatsApp/SMS toggle

### Phase 3: API Routes

**Файл:** `src/api/routes/yclients-marketplace.js`

```
// === УПРАВЛЕНИЕ САЛОНАМИ ===
GET  /marketplace/admin/salons
GET  /marketplace/admin/salon/:salonId/status
POST /marketplace/admin/salon/:salonId/disconnect

// === ПЛАТЕЖИ ===
GET  /marketplace/admin/salon/:salonId/payment-link
POST /marketplace/admin/payment/notify
POST /marketplace/admin/payment/:id/refund

// === ТАРИФЫ И СКИДКИ ===
GET  /marketplace/admin/tariffs
POST /marketplace/admin/discounts

// === КАНАЛЫ ===
POST /marketplace/admin/salon/:salonId/channels
POST /marketplace/admin/salon/:salonId/sms-names
```

### Phase 4: Webhook Extensions

**ВХОДЯЩИЕ webhooks от YClients** (только 2 события поддерживаются):
```javascript
// Webhook payload:
{
  salon_id: 123,
  application_id: 123,
  event: 'uninstall' | 'freeze',
  partner_token: 'xxx'  // ⚠️ ВАЛИДИРОВАТЬ!
}

switch (event) {
  case 'uninstall': // ✅ Есть - отключение приложения
  case 'freeze':    // ✅ Есть - заморозка при неоплате
  default:          // Логировать неизвестные события
}
```

**Добавить валидацию webhook:**
```javascript
// Проверить что partner_token совпадает с YCLIENTS_PARTNER_TOKEN
if (body.partner_token !== process.env.YCLIENTS_PARTNER_TOKEN) {
  throw new Error('Invalid partner_token');
}
```

> **NOTE:** `payment` как ВХОДЯЩИЙ webhook НЕ существует.
> Payment endpoint — это ИСХОДЯЩИЙ (мы отправляем в YClients).

### Phase 5: Database Migration

**Колонка `yclients_id` уже существует** (проверено в production):
```sql
yclients_id | integer  -- ✅ Правильное имя колонки
```

```sql
-- Минимальное расширение companies (колонки которых ЕЩЁ нет)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_channel_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_channel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_short_names TEXT[];

-- Для хранения payment_id из YClients (для refund)
-- Используем существующую таблицу marketplace_events
-- event_type = 'payment_notified', event_data = { payment_id: 123, ... }
```

### Phase 6: MCP Server Extension

**Файл:** `mcp/mcp-yclients/server.js`

7 новых tools (application_id берётся из env автоматически):

| Tool | Параметры | Описание |
|------|-----------|----------|
| `marketplace_get_status` | `salon_id` | Статус интеграции + logs + payments |
| `marketplace_get_salons` | `page`, `count` | Список салонов (max 1000) |
| `marketplace_payment_link` | `salon_id`, `discount?` | Ссылка на оплату |
| `marketplace_get_tariffs` | - | Тарифы приложения |
| `marketplace_update_channel` | `salon_id`, `channel`, `enabled` | WhatsApp/SMS toggle |
| `marketplace_uninstall` | `salon_id` | ⚠️ Отключение (опасно!) |
| `marketplace_add_discount` | `salon_ids[]`, `discount` | Скидки для салонов |

---

## Risk Assessment (Updated)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ~~**Existing code broken**~~ | ~~**CRITICAL**~~ | ~~**100%**~~ | ✅ **FIXED** (Phase 0 complete) |
| Missing database columns | Low | Low | Migration already defined |
| YClients API changes | High | Low | Версионирование, мониторинг |
| Rate limiting | Medium | Medium | Bottleneck limiter в client |
| Некорректные webhook | Medium | Low | Валидация partner_token |
| Ошибки в платежах | High | Low | Логирование, транзакции |

---

## Success Metrics

- [x] **Phase 0:** Existing marketplace code works (0 Supabase references) ✅
- [x] **Sentry error tracking in all marketplace code** ✅
- [ ] 13/13 эндпоинтов реализовано (currently 2/13)
- [ ] Все MCP tools работают
- [ ] Тесты покрывают основные сценарии
- [ ] Документация обновлена

---

## API Documentation Summary

### Ключевые уточнения из анализа (2025-11-26):

| Аспект | Факт |
|--------|------|
| **Base URL** | `https://api.yclients.com/marketplace` |
| **Auth header** | `Authorization: Bearer {YCLIENTS_PARTNER_TOKEN}` |
| **application_id** | Обязателен во ВСЕХ request body |
| **Sandbox** | ❌ Нет тестовой среды |
| **Payment endpoint** | **ИСХОДЯЩИЙ** (мы → YClients), не входящий |
| **Входящие webhooks** | Только `uninstall` и `freeze` |
| **Webhook validation** | Проверять `partner_token` в body |
| **Pagination limit** | max 1000 для `/salons` endpoint |
| **Payment response** | Возвращает `{ id: 123 }` — сохранить для refund! |

### Все 13 эндпоинтов:

| # | Направление | Endpoint | Статус |
|---|-------------|----------|--------|
| 1 | МЫ→YC | `POST /partner/callback/redirect` | ✅ Есть |
| 2 | МЫ→YC | `POST /partner/callback` | Добавить |
| 3 | МЫ→YC | `POST /partner/payment` | Добавить |
| 4 | МЫ→YC | `POST /partner/short_names` | Добавить |
| 5 | МЫ→YC | `POST /partner/payment/refund/{id}` | Добавить |
| 6 | YC→МЫ | Webhook (uninstall/freeze) | ✅ Есть |
| 7 | GET | `/salon/{id}/application/{id}` | Добавить |
| 8 | GET | `/application/{id}/salons` | Добавить |
| 9 | POST | `/salon/{id}/application/{id}/uninstall` | Добавить |
| 10 | GET | `/application/payment_link` | Добавить |
| 11 | GET | `/application/{id}/tariffs` | Добавить |
| 12 | POST | `/application/add_discount` | Добавить |
| 13 | POST | `/application/update_channel` | Добавить |

---

## Required Resources

### Environment Variables

```bash
# Уже есть:
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_API_KEY=xxx

# ✅ Подтверждено:
YCLIENTS_APP_ID=18289  # ID приложения в маркетплейсе
```

### Зависимости

Все необходимые пакеты уже установлены:
- axios
- bottleneck
- jsonwebtoken
- zod (для MCP)

---

## Timeline Estimates (Updated)

| Phase | Duration | Cumulative | Status |
|-------|----------|------------|--------|
| **0. Fix Broken Code** | ~~6h~~ ~1h | ~1h | ✅ COMPLETE |
| 1. MarketplaceClient | 3h | 4h | ⏳ Next |
| 2. MarketplaceService | 2h | 6h | |
| 3. API Routes | 2h | 8h | |
| 4. Webhooks | 1h | 9h | |
| 5. DB Migration | 1h | 10h | Can parallel with Phase 1 |
| 6. MCP Server | 2h | 11h | |

**Original estimate:** 17 hours (with Phase 0)
**Current estimate:** 11 hours remaining (Phase 0 complete)
**Actual Phase 0:** ~1 hour (93% faster than estimated!)
