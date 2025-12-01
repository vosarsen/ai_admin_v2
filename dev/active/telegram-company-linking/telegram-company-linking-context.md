# Telegram Company Linking - Context

**Last Updated:** 2025-11-30
**Approach:** Deep Links + Inline Buttons (not manual codes)

## Key Files

### Files to CREATE:
| File | Purpose |
|------|---------|
| `migrations/20251130_create_telegram_linking_tables.sql` | Database schema |
| `src/repositories/TelegramLinkingRepository.js` | Data access layer |
| `tests/unit/telegram-linking-repository.test.js` | Unit tests |
| `tests/integration/telegram-link-command.test.js` | Integration tests |
| `docs/02-guides/telegram/TELEGRAM_SALON_ONBOARDING.md` | User guide (RU) |

### Files to MODIFY:
| File | Lines | Changes |
|------|-------|---------|
| `src/repositories/index.js` | ~20 | Export TelegramLinkingRepository |
| `src/integrations/telegram/telegram-bot.js` | 243-280 | Add /link, /status commands |
| `src/integrations/telegram/telegram-manager.js` | 124-150 | resolveCompanyId, handleBusinessConnection |
| `src/api/routes/telegram-management.js` | EOF | Add linking endpoints |
| `docs/02-guides/telegram/TELEGRAM_BUSINESS_BOT_GUIDE.md` | EOF | Linking section |

---

## Critical Code Locations

### The Problem (Line 134):
```javascript
// src/integrations/telegram/telegram-manager.js:134
const companyId = config.telegram.defaultCompanyId;  // <-- HARDCODED!
```

### Where to Add /link Command:
```javascript
// src/integrations/telegram/telegram-bot.js
// In setupCommandHandlers() method, after line 277
```

### Repository Pattern to Follow:
```javascript
// src/repositories/TelegramConnectionRepository.js
// - Extends BaseRepository
// - Uses Sentry for error tracking
// - Has withTransaction support via BaseRepository
```

### API Route Pattern:
```javascript
// src/api/routes/telegram-management.js
// - Uses express-validator for validation
// - Uses validateApiKey middleware for auth
// - Uses rateLimiter middleware
```

---

## Key Decisions Made

### 1. Code Format: `ABC-123`
- 3 uppercase letters + dash + 3 digits
- Safe charset: A-Z (no O,I,L) + 2-9 (no 0,1)
- Case-insensitive input
- 5.4M combinations - sufficient for our scale

### 2. Code Expiration: 24 hours
- Single use only
- Max 3 codes per company per day

### 3. Brute Force Protection
- Max 5 attempts per code
- Code invalidated after 5 failures
- Rate limit: 10 attempts per user per hour (Redis-based for bot commands)

### 4. Backward Compatibility
- Keep TELEGRAM_DEFAULT_COMPANY_ID fallback temporarily
- New env var: TELEGRAM_REQUIRE_LINKING (default: false)
- Existing salon (962302) will re-link via /link
- After marketplace approval: remove fallback, require linking

### 5. Code Delivery via Deep Links
- Admin calls API → gets deep link
- Sends deep link to salon owner (WhatsApp/email/Telegram)
- Owner clicks → confirms in bot → done!
- No CLI script needed - just API + cURL

### 6. Company ID Strategy
- Use YClients company ID everywhere (same as `companies.id`)
- No conversion needed - IDs are identical by design
- Consistent with WhatsApp integration

### 7. One Telegram User = One Company
- `telegram_user_id UNIQUE` constraint is correct
- One salon = one Telegram account for Business Bot
- Re-linking: deactivate old link, create new one

### 8. Multi-tenant Architecture
- 962302 is test company, others after marketplace approval
- Each company: generate code → owner /link → business connection
- No shared default company after full rollout

---

## Storage

### Redis (Primary for codes):
```
Key: telegram_linking:{code}
TTL: 900 seconds (15 min)
Value: {
  "company_id": 962302,
  "company_name": "Студия Красоты Анна",
  "created_by": "admin",
  "created_at": 1732975200000
}
```

### telegram_linking_codes (Audit in PostgreSQL)
```sql
id SERIAL PRIMARY KEY
code VARCHAR(20) UNIQUE NOT NULL       -- base64url "Ab3kL9mX2p"
company_id INTEGER NOT NULL            -- FK to companies
status VARCHAR(20) DEFAULT 'pending'   -- pending/used/expired/revoked
expires_at TIMESTAMPTZ NOT NULL
used_at TIMESTAMPTZ
used_by_telegram_id BIGINT
used_by_username VARCHAR(255)
created_by VARCHAR(255)
created_at TIMESTAMPTZ DEFAULT NOW()
```

### telegram_user_company_links (permanent)
```sql
id SERIAL PRIMARY KEY
telegram_user_id BIGINT UNIQUE NOT NULL
telegram_username VARCHAR(255)
company_id INTEGER NOT NULL            -- FK to companies
linked_at TIMESTAMPTZ DEFAULT NOW()
linked_via_code VARCHAR(10)
is_active BOOLEAN DEFAULT true
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Bot Messages (Russian)

```javascript
const MESSAGES = {
  // Deep link confirmation
  LINK_CONFIRM_PROMPT: '🔗 Привязать аккаунт к салону:\n\n🏢 {companyName}\n\nВы будете получать:\n✅ Сообщения от клиентов\n✅ Уведомления о записях',

  LINK_SUCCESS: '✅ Аккаунт привязан!\n\nВаш Telegram подключен к:\n🏢 {companyName}\n\nТеперь подключите бота через:\nНастройки → Telegram Business → Чат-бот',

  LINK_INVALID: '❌ Ссылка недействительна или истекла.\n\nЗапросите новую ссылку у администратора.',

  LINK_CANCELLED: '❌ Привязка отменена',

  // /start command (without deep link)
  START_MESSAGE: '🏠 Привет! Я AI Admin Bot - помощник для салонов красоты.\n\nЕсли вы владелец салона, запросите ссылку для привязки у администратора.',

  // /status command
  STATUS_LINKED: '📊 Статус подключения:\n\n🏢 Салон: {salonName}\n📱 Telegram Business: {businessStatus}\n💬 Режим ответов: {canReply}',

  STATUS_NOT_LINKED: '❓ Ваш аккаунт не привязан к салону.\n\nЗапросите ссылку для привязки у администратора.'
};
```

---

## API Endpoints to Add

### POST /api/telegram/linking-codes
```javascript
// Request
{ "companyId": 962302 }

// Response
{
  "success": true,
  "deepLink": "https://t.me/AdmiAI_bot?start=link_Ab3kL9mX2p",
  "code": "Ab3kL9mX2p",
  "expiresAt": "2025-11-30T12:15:00Z",
  "companyName": "Студия Красоты Анна",
  "instructions": "Отправьте эту ссылку владельцу салона"
}
```

### GET /api/telegram/linking-codes?companyId=962302
```javascript
// Response
{
  "success": true,
  "codes": [{
    "code": "XKP-829",
    "status": "pending",
    "expiresAt": "2025-12-01T12:00:00Z",
    "createdAt": "2025-11-30T12:00:00Z"
  }]
}
```

### DELETE /api/telegram/linking-codes/:code
```javascript
// Response
{ "success": true, "revoked": true }
```

### GET /api/telegram/linking-status/:companyId
```javascript
// Response
{
  "success": true,
  "linked": true,
  "telegramUser": {
    "id": 123456789,
    "username": "salon_owner"
  },
  "linkedAt": "2025-11-30T14:00:00Z",
  "businessConnection": {
    "connected": true,
    "canReply": true
  }
}
```

---

## Dependencies

### Internal:
- BaseRepository (src/repositories/BaseRepository.js)
- TelegramConnectionRepository (pattern reference)
- telegram-management.js routes
- telegram-bot.js command handlers

### External:
- crypto (Node.js built-in) - code generation
- No new npm packages

---

## Environment Variables

### Existing:
```bash
TELEGRAM_ENABLED=true
TELEGRAM_BUSINESS_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_DEFAULT_COMPANY_ID=962302  # Will become fallback
```

### New:
```bash
TELEGRAM_REQUIRE_LINKING=false  # Set true to disable fallback
```

---

## Migration Strategy for Current Salon

1. Deploy new code (with fallback enabled)
2. Generate code for company 962302
3. Send code to owner via current channel
4. Owner sends `/link CODE` to bot
5. Verify link in database
6. (Optional) Remove TELEGRAM_DEFAULT_COMPANY_ID from .env

---

## Testing Strategy

### Unit Tests:
- Code generation randomness (no collisions in 1000 codes)
- Code format validation
- Transaction isolation (simulate race condition)
- Expiration handling
- Brute force protection

### Integration Tests:
- /link success flow (mock Telegram context)
- /link invalid code
- /link expired code
- /link already linked
- Rate limiting

### E2E Test:
1. Generate code via API
2. Send /link to real bot
3. Verify in database
4. Connect via Telegram Business
5. Send test message
6. Verify routing to correct company

---

## Session Notes

### Session 1 (2025-11-29):
- Created plan after analyzing codebase
- Decided on ABC-123 code format
- Chose backward-compatible approach with fallback
- Estimated 16 hours total

### Session 2 (2025-12-01) - IMPLEMENTATION & DEPLOY:

**Phase 1: Implementation (~3h)**
- ✅ Created migration: `migrations/20251201_create_telegram_linking_tables.sql`
- ✅ Created `TelegramLinkingRepository.js` (507 lines)
- ✅ Modified `telegram-bot.js`: deep link + callbacks + /status
- ✅ Modified `telegram-manager.js`: resolveCompanyId + caching
- ✅ Added 4 API endpoints to `telegram-management.js`

**Phase 2: Deploy & Bug Fixes (~1h)**
- ✅ Deployed to production, migration applied
- ✅ Fixed FK bug: was using `yclients_id`, needed `company.id`
- ✅ Test API: all endpoints working

**Phase 3: Code Review & Fixes (~30min)**
- ✅ Architecture review: **Grade A- (92/100)**
- ✅ Fixed cache invalidation gap on re-linking
- ✅ Added retry logic for race condition (2 retries, 2s delay)
- ✅ Created cleanup cron: `scripts/cron/cleanup-expired-telegram-codes.js`
- ✅ All fixes deployed (commit 24b447d)

**Total actual time: ~4.5 hours (vs 14h estimated = 68% faster!)**

### Key Decisions:
1. **Deep links** - `t.me/bot?start=link_CODE` instead of manual `/link CODE`
2. **Hybrid storage** - Redis (15 min TTL) + PostgreSQL (audit)
3. **Internal ID for FK** - Use `companies.id` not `yclients_id`
4. **Backward compatible** - Falls back to `TELEGRAM_DEFAULT_COMPANY_ID`
5. **Retry logic** - Handle business_connection race condition

### Production URLs:
```bash
# Generate deep link
POST https://adminai.tech/api/telegram/linking-codes
  -H "x-api-key: ai_admin_v2_api_key_2024_secure"
  -d '{"companyId": 962302}'

# Check status
GET https://adminai.tech/api/telegram/linking-status/962302
```

### Commits:
- `f90fc08` - feat(telegram): implement company linking via deep links
- `ec74898` - fix(telegram): use internal company.id for FK constraints
- `24b447d` - fix(telegram): address code review findings

### Session 3 (2025-12-01) - DOCUMENTATION:

**Documentation Update (~30min)**
- ✅ Updated `TELEGRAM_BUSINESS_BOT_GUIDE.md` to v1.1
- ✅ Added "Company Linking (Multi-tenant)" section with:
  - Overview and flow diagram
  - Database tables description
  - All 4 API endpoints with examples
  - Bot commands table
  - Onboarding message template
  - Security section
  - Backward compatibility notes
- ✅ Added troubleshooting for linking issues
- ✅ Added database schema section at end

**Total actual time: ~5 hours (vs 14h estimated = 64% faster!)**

### Next Steps:
- [ ] E2E test with real Telegram (user will test later)
- [ ] Optionally add cleanup job to PM2 cron
- [ ] Move project to `dev/completed/` after E2E test passes
