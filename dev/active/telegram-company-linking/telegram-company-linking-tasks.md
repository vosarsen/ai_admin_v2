# Telegram Company Linking - Tasks

**Project:** AI Admin v2 - Multi-tenant Telegram
**Last Updated:** 2025-11-29

---

## Phase 1: Database Schema (1h)

### 1.1 Create telegram_connection_codes table
- [ ] Create migration file `migrations/20251130_telegram_connection_codes.sql`
- [ ] Add table `telegram_connection_codes`:
  - id SERIAL PRIMARY KEY
  - company_id INTEGER NOT NULL REFERENCES companies(id)
  - code VARCHAR(10) UNIQUE NOT NULL
  - expires_at TIMESTAMP NOT NULL
  - used_at TIMESTAMP
  - used_by_telegram_user_id BIGINT
  - created_by VARCHAR(255)
  - created_at TIMESTAMP DEFAULT NOW()
- [ ] Add indexes (company_id, code, expires_at)
- [ ] Run migration on local

### 1.2 Update telegram_business_connections table
- [ ] Add `status` column with CHECK constraint
  - Values: 'pending', 'active', 'expired', 'disconnected'
  - Default: 'active' (for backward compatibility)
- [ ] Add `linked_at` timestamp (when code was entered)
- [ ] Run migration on local

---

## Phase 2: Connection Code API (2h)

### 2.1 Create TelegramConnectionCodeRepository
- [ ] Create `src/repositories/TelegramConnectionCodeRepository.js`
- [ ] Implement `create(companyId, createdBy)` - generate code
- [ ] Implement `findByCode(code)` - find valid (not expired, not used)
- [ ] Implement `markUsed(code, telegramUserId)` - mark as used
- [ ] Implement `findActiveByCompanyId(companyId)` - list active codes
- [ ] Implement `deleteExpired()` - cleanup job
- [ ] Register in `src/repositories/index.js`

### 2.2 Create API Routes
- [ ] Create `src/api/routes/telegram-connection-codes.js`
- [ ] POST `/api/telegram/connection-codes` - generate code
  - Input: { companyId }
  - Output: { code, expiresAt }
  - Validation: companyId exists
- [ ] GET `/api/telegram/connection-codes/:companyId` - list codes
  - Output: { codes: [...], activeConnection: {...} }
- [ ] DELETE `/api/telegram/connection-codes/:code` - cancel code
- [ ] Register routes in `src/api/index.js`
- [ ] Add rate limiting (max 5 codes per company per hour)

### 2.3 Code Generation Logic
- [ ] Generate 6-character alphanumeric code (uppercase)
- [ ] Exclude confusing characters (0, O, I, L)
- [ ] Set expiry to 30 minutes
- [ ] Ensure uniqueness (retry if collision)

---

## Phase 3: Bot Logic Update (3h)

### 3.1 Handle Pending Connections
- [ ] Update `telegram-bot.js` - business_connection handler
- [ ] When `is_enabled: true`:
  - Save connection with status='pending' (no company_id yet)
  - Send direct message to user asking for code
- [ ] When `is_enabled: false`:
  - Update status to 'disconnected'

### 3.2 Code Verification Flow
- [ ] Add handler for direct messages (not business_message)
- [ ] Check if sender has pending connection
- [ ] If pending:
  - Validate code format (6 chars, alphanumeric)
  - Lookup code in database
  - If valid: activate connection, mark code used
  - If invalid: reply with error, allow retry
- [ ] If no pending:
  - Show help message or /start info

### 3.3 User Messages
- [ ] "Для завершения подключения введите код из админ-панели:"
- [ ] "✅ Подключено! Бот теперь будет отвечать вашим клиентам."
- [ ] "❌ Неверный или истёкший код. Попробуйте ещё раз или получите новый код."
- [ ] "ℹ️ У вас нет ожидающих подключений."

---

## Phase 4: Manager Multi-tenant (2h)

### 4.1 Remove defaultCompanyId dependency
- [ ] Update `telegram-manager.js` - handleBusinessConnection
- [ ] Remove `config.telegram.defaultCompanyId` usage
- [ ] Call savePendingConnection instead of saveConnection

### 4.2 Add Pending Connection Logic
- [ ] Implement `savePendingConnection(data)` in manager
- [ ] Implement `activateConnection(businessConnectionId, companyId)`
- [ ] Update cache after activation

### 4.3 Update resolveConnection
- [ ] Handle pending connections (return null, don't route messages)
- [ ] Log warning for messages to pending connections
- [ ] Consider fallback behavior

### 4.4 Update TelegramConnectionRepository
- [ ] Add `savePending(data)` - save without company_id
- [ ] Add `activate(businessConnectionId, companyId)` - set company + status
- [ ] Add `findPendingByTelegramUserId(userId)` - for code verification
- [ ] Update `findByBusinessConnectionId` to filter by status

---

## Phase 5: Testing & Documentation (2h)

### 5.1 Unit Tests
- [ ] Test code generation (format, uniqueness)
- [ ] Test code validation (expiry, used check)
- [ ] Test pending connection flow
- [ ] Test activation flow

### 5.2 Integration Tests
- [ ] Test full flow: generate code → business_connection → enter code → active
- [ ] Test expired code rejection
- [ ] Test invalid code rejection
- [ ] Test multiple salons (multi-tenant)

### 5.3 Documentation
- [ ] Update `TELEGRAM_SALON_SETUP_RU.md` with new flow
- [ ] Update `TELEGRAM_BUSINESS_BOT_GUIDE.md`
- [ ] Add admin guide for code generation
- [ ] Update `CLAUDE.md` if needed

---

## Phase 6: Deployment (1h)

### 6.1 Database Migration
- [ ] Run migration on production
- [ ] Verify tables created

### 6.2 Deploy Code
- [ ] Push to main
- [ ] Deploy to production
- [ ] Restart services

### 6.3 Verification
- [ ] Generate test code
- [ ] Connect test Telegram account
- [ ] Verify end-to-end flow

---

## Progress Tracking

| Phase | Status | Progress | Hours Spent | Hours Estimated |
|-------|--------|----------|-------------|-----------------|
| 1. Database | ⬜ Pending | 0/4 | 0 | 1 |
| 2. API | ⬜ Pending | 0/9 | 0 | 2 |
| 3. Bot Logic | ⬜ Pending | 0/8 | 0 | 3 |
| 4. Manager | ⬜ Pending | 0/10 | 0 | 2 |
| 5. Testing | ⬜ Pending | 0/8 | 0 | 2 |
| 6. Deploy | ⬜ Pending | 0/5 | 0 | 1 |
| **TOTAL** | ⬜ | **0/44** | **0** | **11** |

---

## Notes

- Backward compatibility: existing connection (962302) should keep working
- Consider: auto-expire pending connections after 24h
- Consider: notification to admin when connection activated
