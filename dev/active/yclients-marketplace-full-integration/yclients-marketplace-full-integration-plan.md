# YClients Marketplace API Full Integration Plan

**Last Updated:** 2025-11-26
**Status:** Planning Complete
**Estimated Effort:** 11 hours
**Priority:** High

---

## Executive Summary

Интеграция всех 13 эндпоинтов YClients Marketplace API для полного управления подключениями салонов, платежами, тарифами и каналами уведомлений.

**Текущее состояние:** 1.5 из 13 эндпоинтов реализовано (12%)
**Целевое состояние:** 13 из 13 эндпоинтов (100%)

---

## Current State Analysis

### Реализованные эндпоинты

| Endpoint | Статус | Файл |
|----------|--------|------|
| `POST /marketplace/partner/callback/redirect` | ✅ | `yclients-marketplace.js:394-406` |
| `POST /webhook/yclients` (uninstall, freeze) | ⚠️ Частично | `yclients-marketplace.js:479-505` |

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
├── api/routes/yclients-marketplace.js    # REST routes (частично)
├── services/marketplace/
│   └── marketplace-service.js            # Business logic
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
├── api/routes/yclients-marketplace.js    # REST routes (полные)
├── services/marketplace/
│   └── marketplace-service.js            # Business logic (расширенный)
├── integrations/yclients/
│   ├── client.js                         # General YClients client
│   └── marketplace-client.js             # NEW: Marketplace API client
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

### Phase 1: YclientsMarketplaceClient (Core)
**Effort:** L (3 hours)
**Dependencies:** None

Создание выделенного клиента для Marketplace API с отдельным base URL.

### Phase 2: MarketplaceService Extension
**Effort:** M (2 hours)
**Dependencies:** Phase 1

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
**Dependencies:** None (можно параллельно)

Минимальное расширение схемы БД.

### Phase 6: MCP Server Extension
**Effort:** M (2 hours)
**Dependencies:** Phase 1

Добавление tools для Claude Code.

---

## Detailed Implementation

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

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| YClients API изменения | High | Low | Версионирование, мониторинг |
| Rate limiting | Medium | Medium | Bottleneck limiter в client |
| Некорректные webhook | Medium | Low | Валидация partner_token |
| Ошибки в платежах | High | Low | Логирование, транзакции |

---

## Success Metrics

- [ ] 13/13 эндпоинтов реализовано
- [ ] Все MCP tools работают
- [ ] Тесты покрывают основные сценарии
- [ ] Документация обновлена

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

## Timeline Estimates

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. MarketplaceClient | 3h | 3h |
| 2. MarketplaceService | 2h | 5h |
| 3. API Routes | 2h | 7h |
| 4. Webhooks | 1h | 8h |
| 5. DB Migration | 1h | 9h |
| 6. MCP Server | 2h | 11h |

**Общая оценка: 11 часов**
