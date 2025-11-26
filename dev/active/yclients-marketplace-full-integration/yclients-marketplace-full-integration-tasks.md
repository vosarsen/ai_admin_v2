# YClients Marketplace Integration - Tasks

**Last Updated:** 2025-11-26 (Phase 0 Complete)
**Progress:** 12/35 tasks (34%) - Phase 0 complete

---

## Phase 0: Fix Broken Marketplace Code ✅ COMPLETE
**Effort:** L (6 hours estimated, ~1 hour actual) | **Status:** ✅ COMPLETE | **Priority:** Done

> Completed via separate project: `dev/completed/supabase-broken-references-fix/`
> Code Review: Grade A+ (98/100)

### 0.1 Create MarketplaceEventsRepository ✅
- [x] Create `src/repositories/MarketplaceEventsRepository.js`
- [x] Extend BaseRepository with `constructor(db) { super(db); }`
- [x] Implement `insert(eventData)` method
- [x] Implement `findBySalonId(salonId, options)` method
- [x] Implement `findLatestByType(salonId, eventType)` method
- [x] Add Sentry error tracking
- [x] Export from `src/repositories/index.js`
- [x] Add JSDoc @throws annotations
- [x] Create integration tests

### 0.2 Extend CompanyRepository ✅
- [x] Add `findByYclientsId(yclientsId)` method
- [x] Add `updateByYclientsId(yclientsId, data)` method
- [x] Add `upsertByYclientsId(data)` method (handles onConflict)
- [x] Add `create(data)` method
- [x] Add `update(id, data)` method
- [x] Add `countConnected()` method
- [x] Add `countTotal()` method
- [x] Sentry error tracking

### 0.3 Migrate marketplace-service.js ✅
- [x] Remove `this.supabase = supabase`
- [x] Import CompanyRepository
- [x] Initialize companyRepository in constructor
- [x] Replace all 7 supabase calls → repository methods
- [x] Add Sentry error tracking

### 0.4 Migrate yclients-marketplace.js ✅
- [x] Import CompanyRepository, MarketplaceEventsRepository
- [x] Initialize repositories at top of file
- [x] Replace all 12 supabase calls → repository methods
- [x] Fix health check → `postgres: true`
- [x] Add Sentry error tracking

### 0.5 Additional Repositories Created ✅
- [x] `WebhookEventsRepository` (3 methods + tests)
- [x] `AppointmentsCacheRepository` (7 methods + tests)
- [x] `MessageRepository` (2 methods + tests)

### 0.6 Testing Phase 0 ✅
- [x] All marketplace routes work
- [x] Health check returns correct status
- [x] No `supabase is undefined` errors
- [x] Deployed to production (commit `1db4dc4`)

---

## Phase 1: YclientsMarketplaceClient (Core) ⏳ NEXT
**Effort:** L (3-4 hours) | **Status:** Ready to Start | **Dependencies:** Phase 0 ✅

> **ВАЖНО:** `application_id` (18289) передаётся в constructor.
> Все методы автоматически добавляют `application_id` в request body.

### 1.1 Create marketplace-client.js file
- [ ] Create `src/integrations/yclients/marketplace-client.js`
- [ ] Setup class with constructor(partnerToken, applicationId)
- [ ] Configure MARKETPLACE_BASE = 'https://api.yclients.com/marketplace'
- [ ] Implement `_buildAuthHeader()` → `Bearer {PARTNER_TOKEN}`
- [ ] Add `_makeRequest(method, endpoint, data)` wrapper
- [ ] Add error handling with Sentry
- [ ] Add rate limiting with Bottleneck (200 req/min)
- [ ] Add retry logic for 429/502/503

**Acceptance Criteria:**
- Constructor accepts `partnerToken` and `applicationId`
- All requests include `application_id` automatically
- Rate limiting prevents 429 errors

### 1.2 Implement Callback Methods (МЫ → YClients)
- [ ] `callbackWithRedirect(salonId, apiKey, webhookUrls)` - POST /partner/callback/redirect
- [ ] `callbackInstall(salonId, apiKey, webhookUrls, channels)` - POST /partner/callback
  - channels: ['sms', 'whatsapp']

**Request body:**
```javascript
{ salon_id, application_id, api_key, webhook_urls, channels? }
```

### 1.3 Implement Payment Methods (ИСХОДЯЩИЕ: МЫ → YClients)
- [ ] `notifyPayment(salonId, paymentData)` - POST /partner/payment
  - paymentData: { payment_sum, currency_iso, payment_date, period_from, period_to }
  - **⚠️ Response: { id: 123 } — СОХРАНИТЬ payment_id для refund!**
- [ ] `notifyRefund(paymentId)` - POST /partner/payment/refund/{payment_id}
- [ ] `generatePaymentLink(salonId, discount = null)` - GET /application/payment_link

**Acceptance Criteria:**
- notifyPayment returns payment_id from response
- generatePaymentLink includes discount in query params

### 1.4 Implement Management Methods
- [ ] `getIntegrationStatus(salonId)` - GET /salon/{salonId}/application/{appId}
  - Returns: { logs, payments, connection_status }
- [ ] `getConnectedSalons(page = 1, count = 100)` - GET /application/{appId}/salons
  - **count <= 1000** (API limit)
- [ ] `uninstallFromSalon(salonId)` - POST /salon/{salonId}/application/{appId}/uninstall

**Acceptance Criteria:**
- Pagination respects max 1000 limit
- Status includes full logs and payments history

### 1.5 Implement Tariffs & Discounts Methods
- [ ] `getTariffs()` - GET /application/{appId}/tariffs
- [ ] `addDiscount(salonIds, discountPercent)` - POST /application/add_discount
  - **salonIds is ARRAY** of salon IDs

**Request body for addDiscount:**
```javascript
{ salon_ids: [123, 456], application_id, discount: 15.5 }
```

### 1.6 Implement Channel Methods
- [ ] `updateChannel(salonId, channelSlug, isAvailable)` - POST /application/update_channel
  - channelSlug: 'sms' | 'whatsapp'
- [ ] `setShortNames(salonId, shortNames)` - POST /partner/short_names
  - shortNames: ['NAME1', 'NAME2']

**Acceptance Criteria:**
- Channel slug validated to 'sms' or 'whatsapp'
- Short names accepts array of strings

---

## Phase 2: MarketplaceService Extension
**Effort:** M (2-2.5 hours) | **Status:** Not Started | **Dependencies:** Phase 0 ✅, Phase 1

### 2.1 Add MarketplaceClient integration
- [ ] Import YclientsMarketplaceClient
- [ ] Initialize in constructor with `YCLIENTS_PARTNER_TOKEN` and `YCLIENTS_APP_ID`
- [ ] Inject MarketplaceEventsRepository for logging

### 2.2 Implement Payment Methods (ИСХОДЯЩИЕ)
- [ ] `notifyYclientsAboutPayment(salonId, paymentData)` - уведомить YClients о платеже
  - **⚠️ Сохранить payment_id в marketplace_events** (event_type: 'payment_notified')
  - Обновить `last_payment_date` в companies
- [ ] `notifyYclientsAboutRefund(paymentId, reason)` - уведомить о возврате

### 2.3 Implement Connection Management
- [ ] `checkIntegrationHealth(salonId)` - status check + Telegram alert if issues
- [ ] `getActiveConnections(page = 1, limit = 100)` - paginated list (max 1000)
- [ ] `disconnectSalon(salonId, reason)` - cleanup WhatsApp session + update status

### 2.4 Implement Channel Management
- [ ] `updateNotificationChannel(salonId, channel, enabled)` - toggle WhatsApp/SMS
  - channel: 'whatsapp' | 'sms'

**Acceptance Criteria:**
- Payment notification saves `payment_id` for future refunds
- All methods log to `marketplace_events` table
- Disconnect properly cleans up WhatsApp session

---

## Phase 3: API Routes
**Effort:** M (2 hours) | **Status:** Not Started | **Dependencies:** Phase 2

### 3.1 Salon Management Routes
- [ ] `GET /marketplace/admin/salons` - list connected salons
- [ ] `GET /marketplace/admin/salon/:salonId/status` - detailed status
- [ ] `POST /marketplace/admin/salon/:salonId/disconnect` - disconnect salon

### 3.2 Payment Routes
- [ ] `GET /marketplace/admin/salon/:salonId/payment-link` - generate link
- [ ] `POST /marketplace/admin/payment/notify` - notify payment
- [ ] `POST /marketplace/admin/payment/:id/refund` - refund

### 3.3 Tariffs & Discounts Routes
- [ ] `GET /marketplace/admin/tariffs` - list tariffs
- [ ] `POST /marketplace/admin/discounts` - add discounts

### 3.4 Channel Routes
- [ ] `POST /marketplace/admin/salon/:salonId/channels` - toggle channel
- [ ] `POST /marketplace/admin/salon/:salonId/sms-names` - set SMS names

**Acceptance Criteria:**
- All routes require admin auth (или JWT validation)
- Proper error responses with status codes

---

## Phase 4: Webhook Extensions (ВХОДЯЩИЕ от YClients)
**Effort:** S (1-1.5 hours) | **Status:** Not Started | **Dependencies:** Phase 3

> **NOTE:** Только 2 события поддерживаются YClients: `uninstall` и `freeze`.
> `payment` как ВХОДЯЩИЙ webhook НЕ существует.

### 4.1 Add Webhook Validation
- [ ] Validate `partner_token` from webhook body matches `YCLIENTS_PARTNER_TOKEN`
- [ ] Return 401 if token invalid
- [ ] Log validation failures to Sentry

**Webhook payload:**
```javascript
{ salon_id, application_id, event: 'uninstall'|'freeze', partner_token }
```

### 4.2 Extend handleWebhookEvent
- [ ] `uninstall` - ✅ Already exists, verify it works
- [ ] `freeze` - ✅ Already exists, verify it works
- [ ] Log unknown events for monitoring (don't throw)

**Acceptance Criteria:**
- Webhook validates `partner_token` before processing
- Unknown events logged but return 200 OK
- No `payment` event handling (doesn't exist)

---

## Phase 5: Database Migration
**Effort:** S (1-1.5 hours) | **Status:** Not Started | **Dependencies:** Phase 0 ✅

> **Verified:** `yclients_id` column exists and is correct.
> **For payment_id storage:** Use `marketplace_events` table (event_type: 'payment_notified')

### 5.1 Create migration file
- [ ] Create migration: `20251127_add_marketplace_columns.sql`
- [ ] Add `subscription_expires_at TIMESTAMPTZ`
- [ ] Add `whatsapp_channel_enabled BOOLEAN DEFAULT TRUE`
- [ ] Add `sms_channel_enabled BOOLEAN DEFAULT FALSE`
- [ ] Add `sms_short_names TEXT[]`

### 5.2 Extend CompanyRepository (if needed)
- [ ] Add `updateSubscriptionExpiry(yclientsId, expiresAt)` method
- [ ] Add `updateChannelStatus(yclientsId, whatsappEnabled, smsEnabled)` method

### 5.3 Run migration
- [ ] Test migration locally
- [ ] Apply to production (Timeweb PostgreSQL)
- [ ] Verify new columns exist

**Acceptance Criteria:**
- Migration is idempotent (IF NOT EXISTS)
- No data loss
- CompanyRepository has methods for new columns

---

## Phase 6: MCP Server Extension
**Effort:** M (2 hours) | **Status:** Not Started | **Dependencies:** Phase 1

> `YCLIENTS_APP_ID=18289` уже подтверждён и должен быть в .mcp.json

### 6.1 Add Marketplace Helper Function
- [ ] Create `makeMarketplaceRequest()` with base URL `https://api.yclients.com/marketplace`
- [ ] Add `YCLIENTS_APP_ID` to environment in `.mcp.json`
- [ ] All requests auto-include `application_id`

### 6.2 Implement Tools

| Tool | Params | Returns |
|------|--------|---------|
| `marketplace_get_status` | `salon_id` | logs, payments, status |
| `marketplace_get_salons` | `page?`, `count?` | list of salons (max 1000) |
| `marketplace_payment_link` | `salon_id`, `discount?` | payment URL |
| `marketplace_get_tariffs` | - | tariff options |
| `marketplace_update_channel` | `salon_id`, `channel`, `enabled` | success/error |
| `marketplace_uninstall` | `salon_id` | ⚠️ Dangerous! |
| `marketplace_add_discount` | `salon_ids[]`, `discount` | success/error |

- [ ] Implement all 7 tools
- [ ] Add confirmation warning for `marketplace_uninstall`

### 6.3 Update Configuration
- [ ] Add `YCLIENTS_APP_ID=18289` to `.mcp.json`

**Acceptance Criteria:**
- All tools return formatted human-readable output
- `marketplace_uninstall` shows warning message
- Error messages are clear and actionable

---

## Completion Checklist

### Documentation
- [ ] Update CLAUDE.md with new MCP tools
- [ ] Update marketplace docs if needed

### Testing
- [ ] Test all MCP tools manually
- [ ] Test API routes with curl/Postman
- [ ] Test webhook handling (uninstall, freeze only)
- [ ] Test webhook validation (partner_token)

### Deployment
- [ ] Verify `YCLIENTS_APP_ID=18289` in production .env ✅ Already exists
- [ ] Deploy to server
- [ ] Verify MCP tools work in production

> **Note:** No sandbox environment — all tests run against production API

---

## Progress Summary

| Phase | Tasks | Done | Progress |
|-------|-------|------|----------|
| **Phase 0** | 12 | 12 | ✅ 100% |
| Phase 1 ⏳ | 6 | 0 | 0% |
| Phase 2 | 4 | 0 | 0% |
| Phase 3 | 4 | 0 | 0% |
| Phase 4 | 1 | 0 | 0% |
| Phase 5 | 2 | 0 | 0% |
| Phase 6 | 3 | 0 | 0% |
| Completion | 3 | 0 | 0% |
| **Total** | **35** | **12** | **34%** |

---

## Notes

### Blockers
- Need YCLIENTS_APP_ID from Developer Portal

### Questions
- None currently

### Discoveries
- (будут заполняться по мере работы)
