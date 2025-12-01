# Telegram Company Linking - Task Tracker

**Last Updated:** 2025-12-01 14:45 UTC
**Status:** ✅ DEPLOYED TO PRODUCTION
**Estimated:** 14 hours (Deep Link approach)
**Actual:** ~4.5 hours (68% faster!)
**Progress:** 18/18 tasks (100%)
**Code Review:** A- (92/100)

## Approach: Deep Links + Inline Buttons

Instead of manual `/link ABC-123` codes, we use Telegram deep links:
- Admin generates: `https://t.me/AdmiAI_bot?start=link_Ab3kL9mX2p`
- Owner clicks → Telegram opens → presses START → confirms with button
- Better UX, no typing errors, code hidden in URL

---

## Phase 1: Database & Repository (3h) ✅ COMPLETE

### Task 1.1: Create Migration File [S - 30min] ✅
- [x] Create `migrations/20251201_create_telegram_linking_tables.sql`
- [x] Define `telegram_linking_codes` table (audit)
- [x] Define `telegram_user_company_links` table (permanent)
- [x] Add indexes
- [x] Apply migration to production ✅

### Task 1.2: Create TelegramLinkingRepository [M - 2h] ✅
- [x] Create `src/repositories/TelegramLinkingRepository.js`
- [x] Implement `generateCode(companyId, companyName, createdBy)` - crypto.randomBytes → base64url
- [x] Implement `getCodeData(code)` - Redis lookup
- [x] Implement `consumeCode(code, telegramUserId, username)` - Redis DEL + DB update
- [x] Implement `createLink(telegramUserId, username, companyId, code)` - permanent link
- [x] Implement `findLinkByTelegramUser(telegramUserId)` - lookup company
- [x] Implement `deactivateLinkForCompany(companyId)` - for re-linking
- [x] Implement `revokeCode(code)` - revoke unused code
- [x] Add Sentry error tracking
- [x] Add JSDoc documentation

### Task 1.3: Register Repository [S - 15min] ✅
- [x] Export from `src/repositories/index.js`
- [x] Verify import works

### Task 1.4: Setup Redis Key Pattern [S - 15min] ✅
- [x] Document key format: `telegram_linking:{code}`
- [x] TTL: 900 seconds (15 min)
- [x] Uses existing Redis connection via redis-factory.js

---

## Phase 2: Bot Commands (3h) ✅ COMPLETE

### Task 2.1: Handle Deep Link in /start [M - 1.5h] ✅
- [x] Modify `/start` handler in `telegram-bot.js`
- [x] Parse `link_CODE` from start arguments
- [x] Validate code exists in Redis
- [x] Show confirmation message with company name
- [x] Add inline buttons: [✅ Подтвердить] [❌ Отмена]
- [x] Handle expired/invalid codes gracefully

### Task 2.2: Handle Inline Button Callbacks [M - 1h] ✅
- [x] Add `callback_query:data` handler via `setupCallbackHandlers()`
- [x] Handle `link_confirm_{code}` - complete linking
- [x] Handle `link_cancel` - cancel and edit message
- [x] Create permanent link in DB
- [x] Consume code (single-use)
- [x] Emit `user_linked` event for manager cache invalidation
- [x] Show success message with next steps

### Task 2.3: Add /status Command [S - 30min] ✅
- [x] Add `/status` command handler
- [x] Show linked salon name
- [x] Show business connection status
- [x] Handle not-linked case

---

## Phase 3: Manager Integration (2h) ✅ COMPLETE

### Task 3.1: Add resolveCompanyId Method [M - 1h] ✅
- [x] Add `resolveCompanyId(telegramUserId)` to TelegramManager class
- [x] Check user link cache first (5 min TTL)
- [x] Lookup in `telegram_user_company_links` table
- [x] Fallback to `config.telegram.defaultCompanyId` (backward compatibility)
- [x] Return null if no link and no fallback

### Task 3.2: Modify handleBusinessConnection [M - 45min] ✅
- [x] Replace hardcoded companyId with `resolveCompanyId(data.userId)`
- [x] Handle no-company case (log warning, don't save connection)
- [x] Update connection cache on resolution
- [x] Backward compatibility via defaultCompanyId fallback

### Task 3.3: Add Cache Invalidation Method [S - 15min] ✅
- [x] Add `invalidateUserCache(telegramUserId)` method
- [x] Add `userLinkCache` Map with 5 min TTL
- [x] Subscribe to `user_linked` event from bot

---

## Phase 4: Admin API (2h) ✅ COMPLETE

### Task 4.1: POST /api/telegram/linking-codes [M - 1h] ✅
- [x] Add route to `telegram-management.js`
- [x] Require API key authentication (`validateApiKey`)
- [x] Validate companyId exists via `CompanyRepository.findById()`
- [x] Get company name from DB
- [x] Rate limit: max 10 codes/company/day
- [x] Generate code via `TelegramLinkingRepository.generateCode()`
- [x] Store in Redis (15 min TTL) and DB (audit)
- [x] Return deep link + instructions

### Task 4.2: GET /api/telegram/linking-status/:companyId [S - 30min] ✅
- [x] Add route to check status
- [x] Return linked Telegram user info
- [x] Return business connection status
- [x] Handle not-linked case

### Task 4.3: DELETE /api/telegram/linking-codes/:code [S - 30min] ✅
- [x] Add route to revoke code
- [x] Delete from Redis
- [x] Update DB status to 'revoked'

### Task 4.4: GET /api/telegram/linking-codes [S - 15min] ✅
- [x] Add route to list pending codes for company
- [x] Query param: `?companyId=123`

---

## Phase 5: Testing (3h) ⏸️ DEFERRED

### Task 5.1: Unit Tests for Repository [M - 1.5h] ⏸️
- [ ] Create `tests/unit/telegram-linking-repository.test.js`
- [ ] Test code generation (format, uniqueness)
- [ ] Test Redis storage/retrieval
- [ ] Test code consumption (single-use)
- [ ] Test link creation

### Task 5.2: Integration Tests for Deep Link Flow [M - 1h] ⏸️
- [ ] Create `tests/integration/telegram-deep-link.test.js`
- [ ] Test /start with link_ parameter
- [ ] Test callback confirmation
- [ ] Test expired code handling
- [ ] Mock grammY context

### Task 5.3: E2E Test on Production [S - 30min] ⏳ Pending User Test
- [x] Generate code via API ✅ (working)
- [ ] Click deep link on phone (user will test later)
- [ ] Confirm in bot
- [ ] Verify in database

---

## Phase 6: Documentation (1h) 📅 PENDING

### Task 6.1: Update TELEGRAM_BUSINESS_BOT_GUIDE.md [S - 30min]
- [ ] Add company linking section
- [ ] Document API endpoints
- [ ] Add troubleshooting

### Task 6.2: Create Onboarding Message Template [S - 30min]
- [x] Template added below (can be sent via WhatsApp/email)

---

## Phase 7: Code Review Fixes ✅ COMPLETE

### Task 7.1: Fix Cache Invalidation Gap [S - 15min] ✅
- [x] Invalidate `connectionCache` when user re-links to different company
- [x] Prevents routing to wrong company for 5 minutes

### Task 7.2: Add Retry Logic for Race Condition [S - 15min] ✅
- [x] 2 retries with 2s delay in `handleBusinessConnection`
- [x] Handles case when business_connection arrives before linking completes

### Task 7.3: Add Cleanup Cron Job [S - 10min] ✅
- [x] Created `scripts/cron/cleanup-expired-telegram-codes.js`
- [x] Updates expired codes from 'pending' to 'expired' in PostgreSQL

---

## Quick Commands

```bash
# Apply migration
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && psql \$DATABASE_URL -f migrations/20251130_create_telegram_linking_tables.sql"

# Generate deep link (after API ready)
curl -X POST https://adminai.tech/api/telegram/linking-codes \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"companyId": 962302}'

# Check link status
curl https://adminai.tech/api/telegram/linking-status/962302 \
  -H "x-api-key: $API_KEY"

# Run tests
npm test -- --grep "TelegramLinking"
```

---

## Onboarding Message Template

```
🎉 Привяжите Telegram к AI Admin!

Нажмите на ссылку и подтвердите привязку:
👉 {DEEP_LINK}

После привязки:
1. Откройте Настройки в Telegram
2. Перейдите в Telegram Business
3. Выберите Чат-бот → @AdmiAI_bot

Готово! Бот будет отвечать вашим клиентам.

Вопросы? support@adminai.tech
```

---

## Notes

- **Blocking issue:** None
- **Decisions made:** Deep links instead of manual codes
- **Time saved:** ~6 hours (no bot rate limiting, simpler flow)
