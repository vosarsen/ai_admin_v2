# YClients Marketplace Integration - Context

**Last Updated:** 2025-11-26 (Phase 0 Complete)

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

### Blocker: YCLIENTS_APP_ID
- Нужно получить ID приложения из YClients Developer Portal
- Без него не будут работать методы с `application_id`

### Note: Rate Limiting
- Marketplace API имеет те же лимиты: 200 req/min
- Использовать Bottleneck как в основном клиенте

### Note: Webhook Events
- YClients может добавить новые события в будущем
- Логировать неизвестные события для мониторинга

### Note: Sentry Error Tracking
- After Supabase removal project, all repositories have Sentry
- Marketplace files MUST also have Sentry integration
- Follow pattern from BaseRepository.js

---

## Broken Code Details (Phase 0 Reference)

### marketplace-service.js

```javascript
// Line 15 - Constructor assigns undefined supabase
this.supabase = supabase;  // supabase is not imported!

// Line 49-52 - Select companies
const { data: companies, error: fetchError } = await this.supabase
  .from('companies')
  .select('*')
  .eq('yclients_id', validSalonId);

// Line 91-95 - Insert company
const { data: createdCompany, error: createError } = await this.supabase
  .from('companies')
  .insert([sanitizedData])
  .select()
  .single();

// Line 239-243 - Get company by ID
const { data, error } = await this.supabase
  .from('companies')
  .select('*')
  .eq('id', companyId)
  .single();

// Line 327-330 - Update WhatsApp status
const { error } = await this.supabase
  .from('companies')
  .update(updateData)
  .eq('id', validCompanyId);

// Line 350-353 - Get connected companies
const { data: connectedCompanies, error: connectedError } = await this.supabase
  .from('companies')
  .select('id')
  .eq('whatsapp_connected', true);

// Line 360-362 - Count total companies
const { count: totalCount, error: totalError } = await this.supabase
  .from('companies')
  .select('*', { count: 'exact', head: true });
```

### yclients-marketplace.js

```javascript
// Line 79-100 - Upsert company
const { data: company, error: dbError } = await supabase
  .from('companies')
  .upsert({...}, { onConflict: 'yclients_id', returning: 'representation' })
  .select()
  .single();

// Line 131-143 - Insert marketplace event
await supabase
  .from('marketplace_events')
  .insert({...});

// Line 332-338 - Select registration event
const { data: events, error: eventError } = await supabase
  .from('marketplace_events')
  .select('*')
  .eq('salon_id', salon_id)
  .eq('event_type', 'registration_started')
  .order('created_at', { ascending: false })
  .limit(1);

// Line 361-369 - Update company with API key
const { error: updateError } = await supabase
  .from('companies')
  .update({...})
  .eq('id', company_id);

// Line 422-429 - Update integration status to active
await supabase
  .from('companies')
  .update({...})
  .eq('id', company_id);

// Line 432-442 - Insert activation event
await supabase
  .from('marketplace_events')
  .insert({...});

// Line 459-465 - Update status on activation failure
await supabase
  .from('companies')
  .update({...})
  .eq('id', error.decoded.company_id);

// Line 525, 530 - Health check references
supabase: !!supabase,  // undefined
database_connected: !!supabase,  // undefined

// Line 603-610 - Handle uninstall
await supabase
  .from('companies')
  .update({...})
  .eq('yclients_id', parseInt(salonId));

// Line 621-627 - Handle freeze
await supabase
  .from('companies')
  .update({...})
  .eq('yclients_id', parseInt(salonId));

// Line 638-645 - Handle payment
await supabase
  .from('companies')
  .update({...})
  .eq('yclients_id', parseInt(salonId));
```

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
