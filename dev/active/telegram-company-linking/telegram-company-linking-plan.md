# Telegram Company Linking - Implementation Plan

**Last Updated:** 2025-11-30

## Executive Summary

Реализация механизма связывания Telegram аккаунта владельца салона с `company_id` в системе AI Admin. Это позволит поддерживать множество салонов (multi-tenant) через один Telegram бот `@AdmiAI_bot`.

**Problem:** Текущая реализация использует hardcoded `TELEGRAM_DEFAULT_COMPANY_ID` (строка 134 в `telegram-manager.js`), что ограничивает систему одним салоном.

**Solution:** Deep Link система - админ генерирует ссылку, владелец кликает → подтверждает в боте.

---

## Current State Analysis

### Что уже есть:
- **Telegram Bot** (`telegram-bot.js`) - работающий grammY клиент
- **Telegram Manager** (`telegram-manager.js`) - оркестратор с кэшированием
- **TelegramConnectionRepository** - CRUD для `telegram_business_connections`
- **API Routes** (`telegram-management.js`) - 7 endpoints управления
- **Database** - таблица `telegram_business_connections` с `company_id`

### Проблема в коде:
```javascript
// telegram-manager.js:134
const companyId = config.telegram.defaultCompanyId;  // HARDCODED!
```

Когда Telegram присылает `business_connection` event, мы не знаем какому салону он принадлежит.

---

## Proposed Future State

### User Flow (Deep Link):
```
1. Админ → POST /api/telegram/linking-codes { companyId: 962302 }
   → Получает deep link: https://t.me/AdmiAI_bot?start=link_Ab3kL9mX2p

2. Админ отправляет ссылку владельцу салона (WhatsApp/email/Telegram)

3. Владелец кликает ссылку → Telegram открывается → нажимает START

4. Бот показывает:
   "Привязать аккаунт к салону 'Студия Красоты'?"
   [✅ Подтвердить] [❌ Отмена]

5. Владелец нажимает "Подтвердить" → Линк создан

6. Владелец подключает бота через Telegram Business Settings

7. Telegram → business_connection event
   → Manager смотрит telegram_user_company_links по user_id
   → Находит company_id = 962302
```

### Architecture:
```
┌─────────────────┐     ┌──────────────────────┐
│  Admin API      │────▶│ TelegramLinking      │
│  /linking-codes │     │ Repository           │
└─────────────────┘     └──────────┬───────────┘
                                   │
                                   ▼
┌─────────────────┐     ┌──────────────────────┐
│  Salon Owner    │     │ telegram_linking_    │
│  clicks deep    │────▶│ codes (Redis/DB)     │
│  link + confirm │     └──────────┬───────────┘
└─────────────────┘                │ consume
                                   ▼
┌─────────────────┐     ┌──────────────────────┐
│  Telegram Bot   │────▶│ telegram_user_       │
│  business_conn  │     │ company_links        │
└─────────────────┘     └──────────────────────┘
```

### Deep Link Format:
```
https://t.me/AdmiAI_bot?start=link_<base64url_code>

Example: https://t.me/AdmiAI_bot?start=link_Ab3kL9mX2p4K5m
```

### Why Deep Links (not manual codes):
| Aspect | Deep Link | Manual /link ABC-123 |
|--------|-----------|---------------------|
| UX | 1 клик + START + Confirm | Копировать → вставить → отправить |
| Безопасность | Код скрыт в URL | Код виден в чате |
| Ошибки ввода | Невозможны | Возможны |
| Rate limiting | Только на генерацию | Нужен ещё на ввод |

---

## Implementation Phases

### Phase 1: Database & Repository (3h)
Create database schema, Redis storage, and data access layer.

### Phase 2: Bot Commands (3h)
Handle `/start link_CODE` deep links and inline confirmation buttons.

### Phase 3: Manager Integration (2h)
Modify telegram-manager.js to use linking for company resolution.

### Phase 4: Admin API (2h)
Add endpoints for deep link generation and management.

### Phase 5: Testing (3h)
Unit, integration, and E2E tests.

### Phase 6: Documentation (1h)
Update guides and create onboarding docs.

**Total: 14 hours** (reduced from 20h due to simpler deep link approach)

---

## Phase 1: Database & Repository

### Task 1.1: Create Migration File (S - 30min)
**File:** `migrations/20251130_create_telegram_linking_tables.sql`

```sql
-- Linking codes (audit table - primary storage is Redis)
CREATE TABLE telegram_linking_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,  -- base64url (14 chars)
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, used, expired, revoked
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_telegram_id BIGINT,
  used_by_username VARCHAR(255),
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-to-company links (permanent)
CREATE TABLE telegram_user_company_links (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(255),
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_via_code VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_linking_codes_code ON telegram_linking_codes(code);
CREATE INDEX idx_linking_codes_company_pending ON telegram_linking_codes(company_id) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_user_links_telegram_id ON telegram_user_company_links(telegram_user_id);
CREATE INDEX idx_user_links_company ON telegram_user_company_links(company_id);
```

### Redis Storage (Primary):
```
Key: telegram_linking:{code}
TTL: 900 seconds (15 minutes)
Value: {
  "company_id": 962302,
  "company_name": "Студия Красоты Анна",
  "created_by": "admin",
  "created_at": 1732975200000
}
```

**Acceptance Criteria:**
- [ ] Migration file created
- [ ] Tables created on production
- [ ] Redis key pattern documented
- [ ] Indexes verified

### Task 1.2: Create TelegramLinkingRepository (M - 2h)
**File:** `src/repositories/TelegramLinkingRepository.js`

**Methods:**
- `generateCode(companyId, companyName, createdBy)` - crypto.randomBytes → base64url
- `getCodeData(code)` - Redis lookup with fallback to DB
- `consumeCode(code, telegramUserId, username)` - atomic Redis DEL + DB update
- `findLinkByTelegramUser(telegramUserId)` - поиск company по telegram user
- `createLink(telegramUserId, username, companyId, code)` - create permanent link
- `deactivateLinkForCompany(companyId)` - for re-linking
- `revokeCode(code)` - отзыв кода

**Acceptance Criteria:**
- [ ] Extends BaseRepository
- [ ] Uses withTransaction for atomic operations
- [ ] Sentry error tracking
- [ ] JSDoc documentation
- [ ] Code generation uses crypto.randomBytes

### Task 1.3: Register Repository in index.js (S - 15min)
**File:** `src/repositories/index.js`

**Acceptance Criteria:**
- [ ] TelegramLinkingRepository exported
- [ ] Can be imported throughout codebase

---

## Phase 2: Bot Commands (Deep Link + Inline Buttons)

### Task 2.1: Handle Deep Link in /start (M - 1.5h)
**File:** `src/integrations/telegram/telegram-bot.js`
**Location:** `setupCommandHandlers()` method (~line 243)

```javascript
// Modify existing /start handler
this.bot.command('start', async (ctx) => {
  const args = ctx.message.text.split(' ')[1]; // "link_Ab3kL9mX2p"

  if (args?.startsWith('link_')) {
    const code = args.replace('link_', '');
    await this.handleLinkingRequest(ctx, code);
    return;
  }

  // Default /start message
  await ctx.reply('🏠 Привет! Я AI Admin Bot...');
});

async handleLinkingRequest(ctx, code) {
  const data = await linkingRepository.getCodeData(code);

  if (!data) {
    return ctx.reply('❌ Ссылка недействительна или истекла.\n\nЗапросите новую ссылку у администратора.');
  }

  // Show confirmation with inline buttons
  await ctx.reply(
    `🔗 Привязать аккаунт к салону:\n\n` +
    `🏢 ${data.company_name}\n\n` +
    `Вы будете получать:\n` +
    `✅ Сообщения от клиентов\n` +
    `✅ Уведомления о записях`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `link_confirm_${code}` },
          { text: '❌ Отмена', callback_data: 'link_cancel' }
        ]]
      }
    }
  );
}
```

**Acceptance Criteria:**
- [ ] Parses deep link code from /start
- [ ] Validates code in Redis
- [ ] Shows company name for confirmation
- [ ] Displays inline buttons
- [ ] Logs to Sentry on errors

### Task 2.2: Handle Inline Button Callbacks (M - 1h)
**File:** `src/integrations/telegram/telegram-bot.js`

```javascript
// Add callback query handler
this.bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('link_confirm_')) {
    const code = data.replace('link_confirm_', '');
    await this.completeLinking(ctx, code);
  }

  if (data === 'link_cancel') {
    await ctx.answerCbQuery('Отменено');
    await ctx.editMessageText('❌ Привязка отменена');
  }
});

async completeLinking(ctx, code) {
  const codeData = await linkingRepository.getCodeData(code);

  if (!codeData) {
    await ctx.answerCbQuery('❌ Ссылка истекла');
    return;
  }

  // Create permanent link
  await linkingRepository.createLink(
    ctx.from.id,
    ctx.from.username,
    codeData.company_id,
    code
  );

  // Consume code (delete from Redis, update DB)
  await linkingRepository.consumeCode(code, ctx.from.id, ctx.from.username);

  // Invalidate cache
  this.manager.invalidateUserCache(ctx.from.id);

  await ctx.answerCbQuery('✅ Успешно!');
  await ctx.editMessageText(
    `✅ Аккаунт привязан!\n\n` +
    `Ваш Telegram подключен к:\n` +
    `🏢 ${codeData.company_name}\n\n` +
    `Теперь подключите бота через:\n` +
    `Настройки → Telegram Business → Чат-бот`
  );
}
```

**Acceptance Criteria:**
- [ ] Handles confirm/cancel callbacks
- [ ] Creates permanent link in DB
- [ ] Consumes code (single-use)
- [ ] Invalidates cache
- [ ] Shows success message with next steps

### Task 2.3: Add /status Command (S - 30min)
**File:** `src/integrations/telegram/telegram-bot.js`

Show connection status for salon owner.

**Acceptance Criteria:**
- [ ] Shows linked salon name
- [ ] Shows business connection status
- [ ] Handle not-linked case

---

## Phase 3: Manager Integration

### Task 3.1: Add resolveCompanyId Method (M - 1h)
**File:** `src/integrations/telegram/telegram-manager.js`

```javascript
async resolveCompanyId(telegramUserId) {
  // 1. Check linking repository
  const link = await this.linkingRepository.findLinkByTelegramUser(telegramUserId);
  if (link?.company_id) return link.company_id;

  // 2. Fallback to default (backward compat)
  if (config.telegram.defaultCompanyId) {
    return config.telegram.defaultCompanyId;
  }

  return null;
}
```

**Acceptance Criteria:**
- [ ] Method added to TelegramManager
- [ ] Caching implemented (5 min TTL)
- [ ] Fallback to defaultCompanyId works
- [ ] Returns null if no link found

### Task 3.2: Modify handleBusinessConnection (M - 1h)
**File:** `src/integrations/telegram/telegram-manager.js`
**Location:** Line 124-150

Replace hardcoded `config.telegram.defaultCompanyId` with `resolveCompanyId()`.

**Acceptance Criteria:**
- [ ] Uses resolveCompanyId instead of hardcoded value
- [ ] Handles case when no company found (log warning)
- [ ] Updates connection cache on successful resolution
- [ ] Existing single-company setup still works

---

## Phase 4: Admin API

### Task 4.1: POST /api/telegram/linking-codes (M - 1h)
**File:** `src/api/routes/telegram-management.js`

Generate new linking code for company.

**Request:**
```json
{ "companyId": 962302, "expiresInHours": 24 }
```

**Response:**
```json
{
  "success": true,
  "code": "XKP-829",
  "expiresAt": "2025-12-01T12:00:00Z",
  "instructions": "Отправьте боту @AdmiAI_bot команду: /link XKP-829"
}
```

**Acceptance Criteria:**
- [ ] Requires API key authentication
- [ ] Validates companyId exists
- [ ] Rate limited (3 codes/company/day)
- [ ] Returns formatted instructions

### Task 4.2: GET /api/telegram/linking-codes (S - 30min)
List active codes for company.

**Acceptance Criteria:**
- [ ] Returns only pending codes
- [ ] Includes expiration time
- [ ] Admin only

### Task 4.3: DELETE /api/telegram/linking-codes/:code (S - 30min)
Revoke a code.

**Acceptance Criteria:**
- [ ] Marks code as revoked
- [ ] Returns success even if already used

### Task 4.4: GET /api/telegram/linking-status/:companyId (S - 30min)
Check if company has linked Telegram.

**Acceptance Criteria:**
- [ ] Returns linked user info
- [ ] Returns business connection status

---

## Phase 5: Testing

### Task 5.1: Unit Tests for TelegramLinkingRepository (M - 2h)
**File:** `tests/unit/telegram-linking-repository.test.js`

- Code generation randomness
- Code format validation
- Atomic consumption (race condition test)
- Expiration handling
- Brute force protection

**Acceptance Criteria:**
- [ ] 80%+ coverage
- [ ] Tests transaction isolation
- [ ] Tests edge cases

### Task 5.2: Integration Tests for /link Command (M - 1.5h)
**File:** `tests/integration/telegram-link-command.test.js`

- Success flow
- Invalid code
- Expired code
- Already linked user
- Rate limiting

**Acceptance Criteria:**
- [ ] All flows tested
- [ ] Mock Telegram context

### Task 5.3: E2E Test via Production (S - 30min)
Manual test on production:

1. Generate code via API
2. Send /link to bot
3. Verify in database

**Acceptance Criteria:**
- [ ] Full flow works
- [ ] Messages display correctly

---

## Phase 6: Documentation

### Task 6.1: Update TELEGRAM_BUSINESS_BOT_GUIDE.md (S - 30min)
Add company linking section.

**Acceptance Criteria:**
- [ ] Section on linking codes
- [ ] API endpoint documentation
- [ ] Troubleshooting tips

### Task 6.2: Create TELEGRAM_SALON_ONBOARDING.md (S - 30min)
Step-by-step guide for salon owners (Russian).

**Acceptance Criteria:**
- [ ] Clear instructions with screenshots descriptions
- [ ] FAQ section
- [ ] Support contact

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Code brute force | High | Low | Max 5 attempts per code |
| Race condition on code use | High | Low | Transaction с FOR UPDATE |
| Breaking existing salon | High | Medium | Backward compat fallback |
| Telegram API changes | Medium | Low | grammY abstraction |

---

## Success Metrics

- [ ] Multiple salons can connect independently
- [ ] No messages routed to wrong company
- [ ] Current salon continues working (backward compat)
- [ ] Code generation under 100ms
- [ ] Link resolution under 50ms (with cache)

---

## Required Resources

### Files to Create:
- `migrations/20251130_create_telegram_linking_tables.sql`
- `src/repositories/TelegramLinkingRepository.js`
- `tests/unit/telegram-linking-repository.test.js`
- `tests/integration/telegram-link-command.test.js`
- `docs/02-guides/telegram/TELEGRAM_SALON_ONBOARDING.md`

### Files to Modify:
- `src/repositories/index.js` - export new repository
- `src/integrations/telegram/telegram-bot.js` - add /link, /status commands
- `src/integrations/telegram/telegram-manager.js` - resolveCompanyId
- `src/api/routes/telegram-management.js` - linking endpoints
- `docs/02-guides/telegram/TELEGRAM_BUSINESS_BOT_GUIDE.md` - update docs

### Dependencies:
- crypto (Node.js built-in)
- No new npm packages needed

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database | 3h | None |
| Phase 2: Bot Commands | 3h | Phase 1 |
| Phase 3: Manager | 2h | Phase 1, 2 |
| Phase 4: Admin API | 3h | Phase 1 |
| Phase 5: Testing | 4h | Phase 1-4 |
| Phase 6: Docs | 1h | Phase 1-4 |
| **Total** | **16h** | |

**Estimated completion:** 2-3 days with buffer
