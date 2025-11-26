# YClients Marketplace Integration - Tasks

**Last Updated:** 2025-11-26 (Revised after Supabase Removal)
**Progress:** 0/43 tasks (0%)

---

## Phase 0: Fix Broken Marketplace Code (CRITICAL)
**Effort:** L (6 hours) | **Status:** Not Started | **Priority:** CRITICAL

> **WARNING:** This phase MUST be completed before any other work.
> Existing marketplace code is BROKEN after Supabase removal.

### 0.1 Create MarketplaceEventsRepository
- [ ] Create `src/repositories/MarketplaceEventsRepository.js`
- [ ] Extend BaseRepository
- [ ] Implement `insert(eventData)` method
- [ ] Implement `findByCompanyId(companyId, options)` method
- [ ] Implement `findBySalonId(salonId, options)` method
- [ ] Implement `findLatestByType(salonId, eventType)` method
- [ ] Add Sentry error tracking
- [ ] Export from `src/repositories/index.js`

**Acceptance Criteria:**
- All methods work with Timeweb PostgreSQL
- Sentry captures errors
- Follows BaseRepository patterns

### 0.2 Extend CompanyRepository
- [ ] Add `findByYclientsId(yclientsId)` method
- [ ] Add `updateByYclientsId(yclientsId, data)` method
- [ ] Add `upsertByYclientsId(data)` method (handles onConflict)
- [ ] Add `countConnected()` method (count where whatsapp_connected=true)
- [ ] Add `countTotal()` method

**Acceptance Criteria:**
- All new methods follow existing patterns
- Parameterized queries (no SQL injection)
- Sentry error tracking

### 0.3 Migrate marketplace-service.js
- [ ] Remove `this.supabase = supabase` (line 15)
- [ ] Import CompanyRepository
- [ ] Initialize companyRepository in constructor
- [ ] Replace line 49-52: `this.supabase.from('companies').select()` → `companyRepository.findByYclientsId()`
- [ ] Replace line 91-95: `this.supabase.from('companies').insert()` → `companyRepository.create()`
- [ ] Replace line 239-243: `this.supabase.from('companies').select().eq('id')` → `companyRepository.findById()`
- [ ] Replace line 327-330: `this.supabase.from('companies').update()` → `companyRepository.updateByYclientsId()`
- [ ] Replace line 350-353: `this.supabase.from('companies').select().eq('whatsapp_connected')` → use countConnected()
- [ ] Replace line 360-362: `this.supabase.from('companies').select(count)` → use countTotal()
- [ ] Add Sentry error tracking to all methods
- [ ] Test all methods work

**Acceptance Criteria:**
- Zero references to `supabase` in file
- All CRUD operations use Repository Pattern
- Sentry captures errors

### 0.4 Migrate yclients-marketplace.js
- [ ] Import CompanyRepository, MarketplaceEventsRepository
- [ ] Initialize repositories at top of file
- [ ] Replace line 79-100: `supabase.from('companies').upsert()` → `companyRepository.upsertByYclientsId()`
- [ ] Replace line 131-143: `supabase.from('marketplace_events').insert()` → `marketplaceEventsRepository.insert()`
- [ ] Replace line 332-338: `supabase.from('marketplace_events').select()` → `marketplaceEventsRepository.findLatestByType()`
- [ ] Replace line 361-369: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Replace line 422-429: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Replace line 432-442: `supabase.from('marketplace_events').insert()` → `marketplaceEventsRepository.insert()`
- [ ] Replace line 459-465: `supabase.from('companies').update()` → `companyRepository.update()`
- [ ] Fix line 525: health check `supabase: !!supabase` → `postgres: true`
- [ ] Fix line 530: health check `database_connected: !!supabase` → `database_connected: true`
- [ ] Replace line 603-610: handleUninstall → `companyRepository.updateByYclientsId()`
- [ ] Replace line 621-627: handleFreeze → `companyRepository.updateByYclientsId()`
- [ ] Replace line 638-645: handlePayment → `companyRepository.updateByYclientsId()`
- [ ] Add Sentry error tracking to all routes and handlers
- [ ] Test all routes work

**Acceptance Criteria:**
- Zero references to `supabase` in file
- All database operations use Repository Pattern
- Health check shows correct status
- Sentry captures errors

### 0.5 Testing Phase 0
- [ ] Test GET /auth/yclients/redirect loads without error
- [ ] Test GET /marketplace/onboarding loads without error
- [ ] Test POST /marketplace/api/qr works
- [ ] Test GET /marketplace/api/status/:sessionId works
- [ ] Test POST /marketplace/activate works
- [ ] Test POST /webhook/yclients works
- [ ] Test GET /marketplace/health returns correct status
- [ ] Verify no `supabase is undefined` errors in logs

**Acceptance Criteria:**
- All existing functionality works
- No runtime errors
- Health check shows all green

---

## Phase 1: YclientsMarketplaceClient (Core)
**Effort:** L (3 hours) | **Status:** Not Started | **Dependencies:** Phase 0

### 1.1 Create marketplace-client.js file
- [ ] Create `src/integrations/yclients/marketplace-client.js`
- [ ] Setup class structure with constructor
- [ ] Configure MARKETPLACE_BASE URL
- [ ] Implement authorization header builder
- [ ] Add error handling wrapper
- [ ] Add logging integration
- [ ] Add rate limiting with Bottleneck

**Acceptance Criteria:**
- File created with proper class structure
- Authorization works with PARTNER_TOKEN

### 1.2 Implement Callback Methods
- [ ] `callbackWithRedirect(salonId, apiKey, webhookUrls)` - POST /partner/callback/redirect
- [ ] `callbackInstall(salonId, apiKey, webhookUrls, channels)` - POST /partner/callback

**Acceptance Criteria:**
- Both methods follow API spec
- Proper error handling

### 1.3 Implement Payment Methods
- [ ] `notifyPayment(salonId, paymentData)` - POST /partner/payment
- [ ] `notifyRefund(paymentId)` - POST /partner/payment/refund/{id}
- [ ] `generatePaymentLink(salonId, discount)` - GET /application/payment_link

**Acceptance Criteria:**
- Payment notification includes all required fields
- Payment link generation supports optional discount

### 1.4 Implement Management Methods
- [ ] `getIntegrationStatus(salonId)` - GET /salon/{id}/application/{id}
- [ ] `getConnectedSalons(page, count)` - GET /application/{id}/salons
- [ ] `uninstallFromSalon(salonId)` - POST /salon/{id}/application/{id}/uninstall

**Acceptance Criteria:**
- Pagination works correctly
- Status includes logs and payments history

### 1.5 Implement Tariffs & Discounts Methods
- [ ] `getTariffs()` - GET /application/{id}/tariffs
- [ ] `addDiscount(salonIds, discountPercent)` - POST /application/add_discount

**Acceptance Criteria:**
- Tariffs return full structure with options
- Discount can be applied to multiple salons

### 1.6 Implement Channel Methods
- [ ] `updateChannel(salonId, channelSlug, isAvailable)` - POST /application/update_channel
- [ ] `setShortNames(salonId, shortNames)` - POST /partner/short_names

**Acceptance Criteria:**
- Channels: 'sms' | 'whatsapp'
- Short names accepts array of strings

---

## Phase 2: MarketplaceService Extension
**Effort:** M (2 hours) | **Status:** Not Started | **Dependencies:** Phase 0, Phase 1

### 2.1 Add MarketplaceClient integration
- [ ] Import YclientsMarketplaceClient
- [ ] Initialize in constructor
- [ ] Add APP_ID configuration

### 2.2 Implement Payment Methods
- [ ] `processPayment(salonId, paymentData)` - with logging to marketplace_events
- [ ] `processRefund(salonId, paymentId, reason)` - with status update

### 2.3 Implement Connection Management
- [ ] `checkIntegrationHealth(salonId)` - status check + alert if issues
- [ ] `getActiveConnections(page, limit)` - paginated list with DB join
- [ ] `disconnectSalon(salonId, reason)` - cleanup WhatsApp session + update status

### 2.4 Implement Channel Management
- [ ] `enableWhatsAppChannel(salonId)`
- [ ] `disableWhatsAppChannel(salonId)`

**Acceptance Criteria:**
- All methods log to marketplace_events
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

## Phase 4: Webhook Extensions
**Effort:** S (1 hour) | **Status:** Not Started | **Dependencies:** Phase 3

### 4.1 Extend handleWebhookEvent
- [ ] Add 'payment' event handling
- [ ] Log unknown events for monitoring
- [ ] Validate partner_token from webhook body

**Acceptance Criteria:**
- Payment events update subscription_expires_at
- Unknown events logged but don't throw

---

## Phase 5: Database Migration
**Effort:** S (1 hour) | **Status:** Not Started | **Dependencies:** Phase 0

### 5.1 Create migration file
- [ ] Create migration: `XXX_add_marketplace_columns.sql`
- [ ] Add `subscription_expires_at TIMESTAMPTZ`
- [ ] Add `whatsapp_channel_enabled BOOLEAN DEFAULT TRUE`
- [ ] Add `sms_channel_enabled BOOLEAN DEFAULT FALSE`
- [ ] Add `sms_short_names TEXT[]`

### 5.2 Run migration
- [ ] Test migration locally
- [ ] Apply to production (Timeweb PostgreSQL)

**Acceptance Criteria:**
- Migration is idempotent (IF NOT EXISTS)
- No data loss

---

## Phase 6: MCP Server Extension
**Effort:** M (2 hours) | **Status:** Not Started | **Dependencies:** Phase 1

### 6.1 Add Marketplace Helper Function
- [ ] Create `makeMarketplaceRequest()` with different base URL
- [ ] Add APP_ID to environment

### 6.2 Implement Tools
- [ ] `marketplace_get_status` - salon integration status
- [ ] `marketplace_get_salons` - list connected salons
- [ ] `marketplace_payment_link` - generate payment link
- [ ] `marketplace_get_tariffs` - list tariffs
- [ ] `marketplace_update_channel` - toggle sms/whatsapp
- [ ] `marketplace_uninstall` - disconnect salon
- [ ] `marketplace_add_discount` - add discount

### 6.3 Update Configuration
- [ ] Add `YCLIENTS_APP_ID` to `.mcp.json`

**Acceptance Criteria:**
- All tools return formatted human-readable output
- Error messages are clear

---

## Completion Checklist

### Documentation
- [ ] Update CLAUDE.md with new MCP tools
- [ ] Update marketplace docs if needed

### Testing
- [ ] Test all MCP tools manually
- [ ] Test API routes with curl/Postman
- [ ] Test webhook handling

### Deployment
- [ ] Add YCLIENTS_APP_ID to production .env
- [ ] Deploy to server
- [ ] Verify MCP tools work in production

---

## Progress Summary

| Phase | Tasks | Done | Progress |
|-------|-------|------|----------|
| **Phase 0 (CRITICAL)** | 12 | 0 | 0% |
| Phase 1 | 6 | 0 | 0% |
| Phase 2 | 4 | 0 | 0% |
| Phase 3 | 4 | 0 | 0% |
| Phase 4 | 1 | 0 | 0% |
| Phase 5 | 2 | 0 | 0% |
| Phase 6 | 3 | 0 | 0% |
| Completion | 3 | 0 | 0% |
| **Total** | **35** | **0** | **0%** |

---

## Notes

### Blockers
- Need YCLIENTS_APP_ID from Developer Portal

### Questions
- None currently

### Discoveries
- (будут заполняться по мере работы)
