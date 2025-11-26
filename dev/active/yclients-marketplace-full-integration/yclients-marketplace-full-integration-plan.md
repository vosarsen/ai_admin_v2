# YClients Marketplace API Full Integration Plan

**Last Updated:** 2025-11-26
**Status:** Planning Complete (Revised after Supabase Removal)
**Estimated Effort:** 17 hours (+6h for Phase 0)
**Priority:** High

---

## Executive Summary

Интеграция всех 13 эндпоинтов YClients Marketplace API для полного управления подключениями салонов, платежами, тарифами и каналами уведомлений.

**Текущее состояние:** 1.5 из 13 эндпоинтов реализовано (12%)
**Целевое состояние:** 13 из 13 эндпоинтов (100%)

---

## CRITICAL: Post-Supabase Removal Update

### Problem Discovered

После завершения `dev/completed/supabase-full-removal/` (2025-11-26) было обнаружено:

1. **marketplace-service.js** - Удалён только импорт `supabase`, но **7 вызовов `this.supabase.*` остались**
2. **yclients-marketplace.js** - Удалён только импорт, но **12+ вызовов `supabase.*` остались**

**Результат:** Код СЛОМАН - `supabase is undefined` при любом вызове marketplace функций.

### Root Cause

В `supabase-full-removal-plan.md` (Phase 4) указано:
```
- marketplace-service.js - removed dead import
- yclients-marketplace.js - removed dead import
```

Но удалены были только `require` statements, а не фактические вызовы базы данных.

### Solution: Add Phase 0

**Phase 0 должна быть выполнена ПЕРВОЙ** - миграция существующего кода на Repository Pattern.

---

## Current State Analysis

### Реализованные эндпоинты

| Endpoint | Статус | Файл | DB Status |
|----------|--------|------|-----------|
| `POST /marketplace/partner/callback/redirect` | ✅ | `yclients-marketplace.js:394-406` | BROKEN |
| `POST /webhook/yclients` (uninstall, freeze) | ⚠️ Частично | `yclients-marketplace.js:479-505` | BROKEN |

### Broken Supabase Calls (MUST FIX)

**marketplace-service.js (7 calls):**
| Line | Call | Repository Needed |
|------|------|-------------------|
| 15 | `this.supabase = supabase` | Remove |
| 49 | `this.supabase.from('companies').select()` | CompanyRepository |
| 91 | `this.supabase.from('companies').insert()` | CompanyRepository |
| 239 | `this.supabase.from('companies').select()` | CompanyRepository |
| 327 | `this.supabase.from('companies').update()` | CompanyRepository |
| 350 | `this.supabase.from('companies').select()` | CompanyRepository |
| 360 | `this.supabase.from('companies').select()` | CompanyRepository |

**yclients-marketplace.js (12+ calls):**
| Line | Call | Repository Needed |
|------|------|-------------------|
| 79 | `supabase.from('companies').upsert()` | CompanyRepository |
| 131 | `supabase.from('marketplace_events').insert()` | MarketplaceEventsRepository (NEW) |
| 332 | `supabase.from('marketplace_events').select()` | MarketplaceEventsRepository |
| 361 | `supabase.from('companies').update()` | CompanyRepository |
| 422 | `supabase.from('companies').update()` | CompanyRepository |
| 432 | `supabase.from('marketplace_events').insert()` | MarketplaceEventsRepository |
| 459 | `supabase.from('companies').update()` | CompanyRepository |
| 525 | `supabase` (health check) | Remove |
| 530 | `supabase` (health check) | Remove |
| 603 | `supabase.from('companies').update()` | CompanyRepository |
| 621 | `supabase.from('companies').update()` | CompanyRepository |
| 638 | `supabase.from('companies').update()` | CompanyRepository |

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

### Phase 0: Fix Broken Marketplace Code (CRITICAL)
**Effort:** L (6 hours)
**Dependencies:** None (MUST BE DONE FIRST)
**Status:** NOT STARTED

Миграция существующего кода с Supabase на Repository Pattern.

**Sub-tasks:**
1. Create `MarketplaceEventsRepository.js`
2. Extend `CompanyRepository.js` with required methods
3. Migrate `marketplace-service.js` to Repository Pattern
4. Migrate `yclients-marketplace.js` to Repository Pattern
5. Add Sentry error tracking
6. Test existing functionality works

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
Phase 0: Fix Broken Code (CRITICAL PATH - 6h)
    │
    ├──► Phase 1: MarketplaceClient (3h)
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

### Phase 0: Fix Broken Marketplace Code

**0.1 Create MarketplaceEventsRepository.js**

**File:** `src/repositories/MarketplaceEventsRepository.js`

```javascript
const BaseRepository = require('./BaseRepository');

class MarketplaceEventsRepository extends BaseRepository {
  constructor() {
    super('marketplace_events');
  }

  async insert(eventData) {
    return this.create(eventData);
  }

  async findByCompanyId(companyId, options = {}) {
    return this.findMany({ company_id: companyId }, options);
  }

  async findBySalonId(salonId, options = {}) {
    return this.findMany({ salon_id: salonId }, options);
  }

  async findLatestByType(salonId, eventType) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE salon_id = $1 AND event_type = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.query(query, [salonId, eventType]);
    return result.rows[0] || null;
  }
}

module.exports = MarketplaceEventsRepository;
```

**0.2 Extend CompanyRepository.js**

Add methods:
- `findByYclientsId(yclientsId)`
- `updateByYclientsId(yclientsId, data)`
- `upsertByYclientsId(data)` - for onConflict handling
- `countConnected()` - for stats

**0.3 Migrate marketplace-service.js**

Replace all `this.supabase.*` calls with Repository Pattern:
- Import CompanyRepository
- Replace `this.supabase.from('companies').select()` → `companyRepository.findByYclientsId()`
- Replace `this.supabase.from('companies').insert()` → `companyRepository.create()`
- Replace `this.supabase.from('companies').update()` → `companyRepository.updateByYclientsId()`

**0.4 Migrate yclients-marketplace.js**

Replace all `supabase.*` calls:
- Import CompanyRepository, MarketplaceEventsRepository
- Update health check to use PostgreSQL directly
- Add Sentry error tracking

### Phase 1: YclientsMarketplaceClient

**Файл:** `src/integrations/yclients/marketplace-client.js`

```javascript
const MARKETPLACE_BASE = 'https://api.yclients.com/marketplace';

class YclientsMarketplaceClient {
  constructor(partnerToken, applicationId) {
    this.partnerToken = partnerToken;
    this.applicationId = applicationId;
  }

  // === CALLBACKS (исходящие) ===
  async callbackWithRedirect(salonId, apiKey, webhookUrls)
  async callbackInstall(salonId, apiKey, webhookUrls, channels)

  // === ПЛАТЕЖИ ===
  async notifyPayment(salonId, paymentData)
  async notifyRefund(paymentId)
  async generatePaymentLink(salonId, discount = null)

  // === УПРАВЛЕНИЕ ===
  async getIntegrationStatus(salonId)
  async getConnectedSalons(page = 1, count = 100)
  async uninstallFromSalon(salonId)

  // === ТАРИФЫ И СКИДКИ ===
  async getTariffs()
  async addDiscount(salonIds, discountPercent)

  // === КАНАЛЫ ===
  async updateChannel(salonId, channelSlug, isAvailable)
  async setShortNames(salonId, shortNames)
}
```

### Phase 2: MarketplaceService Extension

**Файл:** `src/services/marketplace/marketplace-service.js`

Новые методы:
- `processPayment(salonId, paymentData)` - обработка и логирование платежа
- `processRefund(salonId, paymentId, reason)` - обработка возврата
- `checkIntegrationHealth(salonId)` - проверка статуса + уведомление
- `getActiveConnections(page, limit)` - список с пагинацией
- `disconnectSalon(salonId, reason)` - отключение + cleanup WhatsApp сессии
- `enableWhatsAppChannel(salonId)` / `disableWhatsAppChannel(salonId)`

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

Расширить `handleWebhookEvent()`:
```javascript
switch (eventType) {
  case 'uninstall': // ✅ Есть
  case 'freeze':    // ✅ Есть
  case 'payment':   // ❌ Добавить
  // Возможные будущие события
}
```

### Phase 5: Database Migration

```sql
-- Минимальное расширение companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_channel_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_channel_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sms_short_names TEXT[];
```

### Phase 6: MCP Server Extension

**Файл:** `mcp/mcp-yclients/server.js`

7 новых tools:
1. `marketplace_get_status` - статус интеграции
2. `marketplace_get_salons` - список подключенных салонов
3. `marketplace_payment_link` - генерация ссылки на оплату
4. `marketplace_get_tariffs` - тарифы приложения
5. `marketplace_update_channel` - управление каналами
6. `marketplace_uninstall` - отключение от салона
7. `marketplace_add_discount` - установка скидок

---

## Risk Assessment (Updated)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Existing code broken** | **CRITICAL** | **100%** | Phase 0 fixes immediately |
| Repository Pattern unfamiliar | Medium | Low | Follow existing patterns |
| Missing database columns | Low | Low | Migration already defined |
| YClients API changes | High | Low | Версионирование, мониторинг |
| Rate limiting | Medium | Medium | Bottleneck limiter в client |
| Некорректные webhook | Medium | Low | Валидация partner_token |
| Ошибки в платежах | High | Low | Логирование, транзакции |

---

## Success Metrics

- [ ] **Phase 0:** Existing marketplace code works (0 Supabase references)
- [ ] 13/13 эндпоинтов реализовано
- [ ] Все MCP tools работают
- [ ] Тесты покрывают основные сценарии
- [ ] Документация обновлена
- [ ] Sentry error tracking in all marketplace code

---

## Required Resources

### Environment Variables

```bash
# Уже есть:
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_API_KEY=xxx

# Нужно добавить:
YCLIENTS_APP_ID=xxx  # ID приложения в маркетплейсе
```

### Зависимости

Все необходимые пакеты уже установлены:
- axios
- bottleneck
- jsonwebtoken
- zod (для MCP)

---

## Timeline Estimates (Updated)

| Phase | Duration | Cumulative | Notes |
|-------|----------|------------|-------|
| **0. Fix Broken Code** | **6h** | **6h** | **CRITICAL - Must do first** |
| 1. MarketplaceClient | 3h | 9h | |
| 2. MarketplaceService | 2h | 11h | |
| 3. API Routes | 2h | 13h | |
| 4. Webhooks | 1h | 14h | |
| 5. DB Migration | 1h | 15h | Can parallel with Phase 1 |
| 6. MCP Server | 2h | 17h | |

**Original estimate:** 11 hours
**Revised estimate:** 17 hours (+55%)
**Reason:** Supabase removal left broken code that needs migration first
