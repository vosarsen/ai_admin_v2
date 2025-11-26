# YClients Marketplace Integration - Context

**Last Updated:** 2025-11-26 (API Analysis Complete)

---

## ✅ STATUS: Phase 0 Complete

### Supabase Migration Fixed

Project `dev/completed/supabase-broken-references-fix/` полностью исправил проблему.

**Files migrated:**
| File | Supabase Calls | Status |
|------|----------------|--------|
| `marketplace-service.js` | 7 calls | ✅ Migrated to CompanyRepository |
| `yclients-marketplace.js` | 12 calls | ✅ Migrated to CompanyRepository + MarketplaceEventsRepository |
| `webhook-processor/index.js` | 9 calls | ✅ Migrated to 5 repositories |
| `webhooks/yclients.js` | 2 calls | ✅ Migrated to WebhookEventsRepository |
| `booking-ownership.js` | 1 call | ✅ Migrated to AppointmentsCacheRepository |

**Code Review:** Grade A+ (98/100)
**Production:** Deployed and working

---

## Key Files

### Существующие (модифицированы в Phase 0)

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `src/api/routes/yclients-marketplace.js` | REST routes для marketplace | ~720 | ✅ Migrated |
| `src/services/marketplace/marketplace-service.js` | Бизнес-логика marketplace | ~380 | ✅ Migrated |
| `src/integrations/yclients/client.js` | Общий YClients API client | ~1115 | OK |
| `mcp/mcp-yclients/server.js` | MCP server для Claude | ~697 | OK |
| `.mcp.json` | MCP конфигурация | ~54 | OK |

### Созданные в Phase 0

| File | Purpose | Status |
|------|---------|--------|
| `src/repositories/MarketplaceEventsRepository.js` | Repository for marketplace_events | ✅ Created |
| `src/repositories/WebhookEventsRepository.js` | Repository for webhook_events | ✅ Created |
| `src/repositories/AppointmentsCacheRepository.js` | Repository for appointments_cache | ✅ Created |
| `src/repositories/MessageRepository.js` | Repository for messages | ✅ Created |

### Новые (для создания в Phase 1)

| File | Purpose | Phase |
|------|---------|-------|
| `src/integrations/yclients/marketplace-client.js` | Выделенный Marketplace API client | Phase 1 |

### Расширенные репозитории (Phase 0)

| File | Methods Added |
|------|---------------|
| `src/repositories/CompanyRepository.js` | +7: `findByYclientsId()`, `updateByYclientsId()`, `upsertByYclientsId()`, `create()`, `update()`, `countConnected()`, `countTotal()` |

### Документация (референс)

| File | Purpose |
|------|---------|
| `docs/01-architecture/integrations/YCLIENTS_API.md` | Полная документация YClients API (1.2MB) |
| `docs/02-guides/marketplace/` | Guides по marketplace интеграции |

---

## API Documentation Reference

### Marketplace API Base URL
```
https://api.yclients.com/marketplace
```

### Authorization Header
```
Authorization: Bearer {PARTNER_TOKEN}
```

### Endpoints Summary

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | `/partner/callback/redirect` | Редирект после регистрации |
| 2 | POST | `/partner/callback` | Установка без редиректа |
| 3 | POST | `/partner/payment` | Уведомление об оплате |
| 4 | POST | `/partner/short_names` | SMS sender names |
| 5 | POST | `/partner/payment/refund/{id}` | Возврат платежа |
| 6 | GET | `/salon/{id}/application/{id}` | Статус подключения |
| 7 | GET | `/application/{id}/salons` | Список салонов |
| 8 | POST | `/salon/{id}/application/{id}/uninstall` | Отключение |
| 9 | GET | `/application/payment_link` | Ссылка на оплату |
| 10 | GET | `/application/{id}/tariffs` | Тарифы |
| 11 | POST | `/application/add_discount` | Скидки |
| 12 | POST | `/application/update_channel` | Каналы sms/whatsapp |
| 13 | POST | `/marketplace_webhook` | Входящий webhook |

---

## Key Decisions

### 1. Phase 0: Fix Broken Code FIRST ✅ COMPLETE
**Decision:** Add Phase 0 before any new development
**Outcome:** Completed via `supabase-broken-references-fix` project
- All code migrated to Repository Pattern
- Sentry error tracking added (100% coverage)
- Integration tests created (4 files, 1,625 lines)
- Code review: Grade A+ (98/100)

### 2. Create MarketplaceEventsRepository ✅ DONE
**Decision:** Create new repository for `marketplace_events` table
**Outcome:** Created with 3 methods + Sentry + tests

### 3. Extend CompanyRepository ✅ DONE
**Decision:** Add methods to CompanyRepository
**Outcome:** Added 7 new methods (was 4 planned)

### 4. Архитектура клиента
**Decision:** Создать отдельный `marketplace-client.js` вместо расширения `client.js`
**Rationale:**
- Разные base URL (`/api/v1` vs `/marketplace`)
- Разные заголовки авторизации
- Чёткое разделение ответственности
- Легче тестировать изолированно

### 5. База данных
**Decision:** Минимальные миграции - только расширение `companies`
**Rationale:**
- Платежи логируются в `marketplace_events` (уже есть)
- Не нужна отдельная таблица платежей
- Простота миграции

### 6. MCP Server
**Decision:** Расширить существующий `mcp-yclients/server.js`
**Rationale:**
- Один MCP server для всего YClients
- Удобнее для Claude (@yclients для всего)
- Меньше конфигурации

---

## Dependencies

### Phase Dependencies

```
Phase 0: Fix Broken Code (CRITICAL PATH)
    │
    ├──► Phase 1: MarketplaceClient
    │         │
    │         └──► Phase 2: MarketplaceService
    │                    │
    │                    └──► Phase 3: API Routes
    │                              │
    │                              └──► Phase 4: Webhooks
    │
    ├──► Phase 5: DB Migration ───► Phase 2
    │
    └──► Phase 6: MCP Server ◄─── Phase 1
```

### Внутренние

```
MarketplaceEventsRepository (new - Phase 0)
    ↓
CompanyRepository (extended - Phase 0)
    ↓
YclientsMarketplaceClient (new - Phase 1)
    ↓
MarketplaceService (migrated + extended - Phase 0, 2)
    ↓
API Routes (migrated + extended - Phase 0, 3)
    ↓
MCP Server (extended - Phase 6)
```

### Внешние

- YClients Marketplace API (production)
- YCLIENTS_APP_ID - нужно получить из YClients Developer Portal

---

## Environment Setup

### Текущие переменные (уже есть)
```bash
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_API_KEY=xxx
YCLIENTS_USER_TOKEN=xxx
```

### Нужно добавить
```bash
YCLIENTS_APP_ID=xxx  # ID приложения в маркетплейсе
```

### Где получить YCLIENTS_APP_ID
1. Зайти в YClients Developer Portal
2. Раздел "Мои приложения"
3. Скопировать ID приложения

---

## Testing Strategy

### Phase 0 Testing
- Test that existing marketplace pages load without errors
- Test QR code generation works
- Test webhook handling works
- Verify no `supabase is undefined` errors in logs

### Unit Tests
- `marketplace-client.js` - mock API responses
- `marketplace-service.js` - mock client and repositories

### Integration Tests
- MCP tools с реальным API (test salon)
- Webhook обработка с mock requests

### Manual Testing via MCP
```bash
@yclients marketplace_get_salons
@yclients marketplace_get_status salon_id:962302
@yclients marketplace_get_tariffs
```

---

## Blockers & Notes

### ✅ RESOLVED: YCLIENTS_APP_ID
- **Подтверждено:** `YCLIENTS_APP_ID=18289`
- Уже есть в production .env

### ✅ RESOLVED: Database Schema
- **Проверено в production:** колонка `yclients_id` (не `yclients_company_id`)
- CompanyRepository использует правильное имя

### Note: Rate Limiting
- Marketplace API имеет те же лимиты: 200 req/min
- Использовать Bottleneck как в основном клиенте

### Note: Webhook Events
- **Только 2 события:** `uninstall` и `freeze`
- `payment` как входящий webhook НЕ существует
- Логировать неизвестные события для мониторинга

### Note: Webhook Validation
- Входящий webhook содержит `partner_token`
- **ОБЯЗАТЕЛЬНО** проверять: `body.partner_token === YCLIENTS_PARTNER_TOKEN`

### Note: Sandbox
- **Тестовой среды НЕТ** для Marketplace API
- Все тесты идут на production

### Note: Payment Endpoint Direction
- `POST /marketplace/partner/payment` — это **ИСХОДЯЩИЙ** endpoint
- МЫ отправляем в YClients когда клиент оплатил у НАС
- Response содержит `{ id: 123 }` — **сохранить для refund!**

### Note: Sentry Error Tracking
- After Supabase removal project, all repositories have Sentry
- Marketplace files MUST also have Sentry integration
- Follow pattern from BaseRepository.js

---

## ✅ Phase 0 Complete - Broken Code Fixed

**Детали миграции:** `dev/completed/supabase-broken-references-fix/`
**Code Review:** Grade A+ (98/100)

---

## Session Notes

### Session 1 (2025-11-26)
- Изучена документация YCLIENTS_API.md (раздел Marketplace, строки 32354-33577)
- Проанализированы существующие файлы
- Создан план интеграции
- Решения: все 13 эндпоинтов, минимальная БД, MCP server

### Session 2 (2025-11-26) - Plan Review
- Discovered broken code after Supabase removal
- Added Phase 0: Fix Broken Marketplace Code
- Updated timeline: 11h → 17h (+55%)
- Updated dependencies diagram
- Added detailed broken code reference
- Plan reviewed by plan-reviewer agent

### Session 3 (2025-11-26) - Phase 0 COMPLETE ✅
- Phase 0 completed via separate project: `supabase-broken-references-fix`
- Created 4 new repositories:
  - `MarketplaceEventsRepository` (3 methods)
  - `WebhookEventsRepository` (3 methods)
  - `AppointmentsCacheRepository` (7 methods)
  - `MessageRepository` (2 methods)
- Extended `CompanyRepository` (+7 methods)
- Migrated 5 files (31 supabase calls → repository pattern)
- Added Sentry error tracking (100% coverage)
- Added JSDoc @throws annotations
- Created integration tests (4 files, 1,625 lines)
- Code review by `code-architecture-reviewer`: Grade A+ (98/100)
- Deployed to production: commit `1db4dc4`
- **Actual time:** ~1 hour (vs 6h estimated = 93% faster!)
- **Project status:** Phase 0 complete, ready for Phase 1

### Session 4 (2025-11-26) - API Documentation Analysis & Plan Review
- **Plan Review** by `plan-reviewer` agent: Score 7.5/10
- **Full API analysis** of Marketplace section (lines 32354-33577)
- **Key discoveries:**
  - `YCLIENTS_APP_ID=18289` confirmed
  - DB column `yclients_id` verified (not `yclients_company_id`)
  - Payment endpoint is **OUTBOUND** (we → YClients), not inbound
  - Only 2 webhook events: `uninstall`, `freeze` (no `payment` webhook)
  - No sandbox environment for Marketplace API
  - `partner_token` validation required for webhooks
  - `application_id` required in ALL request bodies
  - Payment response returns `id` — must save for refund
- **Plan corrections applied:**
  - Updated method signatures with `application_id` in constructor
  - Clarified payment endpoint direction
  - Added webhook validation requirement
  - Updated Phase 4 to remove non-existent `payment` webhook
  - Added API documentation summary section
- **Blockers resolved:** YCLIENTS_APP_ID, DB schema verified
- **Project status:** Ready for Phase 1 implementation
