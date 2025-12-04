# YClients Uninstall/Freeze Mechanism - Tasks

**Last Updated:** 2025-12-04 (Session 2)
**Status:** ✅ ALL PHASES COMPLETE

---

## Phase 1: Code Changes ✅ COMPLETE

### 1.1 Add Import ✅
- [x] Добавить `const { removeTimewebAuthState } = require('../../integrations/whatsapp/auth-state-timeweb');` после строки 10

**File:** `src/api/routes/yclients-marketplace.js:11`
**Effort:** S (2 min)

### 1.2 Rewrite handleUninstall() ✅
- [x] Найти функцию handleUninstall (строки 1467-1486)
- [x] Добавить раннюю валидацию salonId
- [x] Добавить поиск company по yclientsId
- [x] Добавить idempotency check (already uninstalled)
- [x] Исправить bug: использовать company.id вместо salonId для sessionPool
- [x] Добавить вызов removeTimewebAuthState(companyId)
- [x] Добавить вызов sessionPool.clearCachedCredentials(companyId) с null-check
- [x] Добавить disconnected_at + api_key: null в update
- [x] Добавить логирование в marketplace_events с parseInt(salonId)
- [x] Добавить try-catch с Sentry tracking
- [x] Добавить graceful degradation (warn на ошибки, не throw)

**File:** `src/api/routes/yclients-marketplace.js:1469-1550`
**Effort:** M (15 min)

### 1.3 Rewrite handleFreeze() ✅
- [x] Найти функцию handleFreeze (строки 1491-1499)
- [x] Добавить раннюю валидацию salonId
- [x] Добавить поиск company по yclientsId
- [x] Добавить idempotency check (already frozen)
- [x] Исправить использование company.id для sessionPool
- [x] НЕ добавлять удаление credentials (сохранить для восстановления)
- [x] Добавить логирование в marketplace_events с reason='payment_overdue' и parseInt(salonId)
- [x] Добавить try-catch с Sentry tracking

**File:** `src/api/routes/yclients-marketplace.js:1552-1614`
**Effort:** M (10 min)

---

## Phase 2: Testing ✅ COMPLETE

### 2.1 Manual Smoke Test ✅
- [x] Проверить что сервер запускается без ошибок
- [x] Проверить что import работает

**Result:** API started successfully on port 3000

### 2.2 Test Uninstall Webhook ✅
- [x] Отправить тестовый webhook с fake salon_id (999999)
- [x] Проверить логи - должен быть "Company not found" warning
- [x] Проверить что нет exceptions в Sentry

**Log Output:**
```
🗑️ Handling uninstall for salon 999999
warn: Company not found for salon 999999
```
**Result:** Работает корректно - graceful handling для несуществующего салона

### 2.3 Test Freeze Webhook ✅
- [x] Отправить тестовый webhook с fake salon_id (999999)
- [x] Проверить логи

**Log Output:**
```
❄️ Handling freeze for salon 999999
```
**Result:** Работает корректно

### 2.4 Sentry Check ✅
- [x] Проверить GlitchTip на новые ошибки
- [x] Нет новых issues связанных с uninstall/freeze

---

## Phase 3: Deployment ✅ COMPLETE

### 3.1 Deploy to Production ✅
- [x] Git commit с описанием изменений
- [x] Git push to main
- [x] SSH deploy: `git pull && pm2 restart all`
- [x] Проверить логи на ошибки

**Commit:** `49d00dd` - feat(marketplace): complete uninstall/freeze cleanup with credentials removal
**Deploy Time:** 2025-12-04 15:06 UTC

---

## Summary

| Phase | Tasks | Status | Actual Time |
|-------|-------|--------|-------------|
| Phase 1: Code Changes | 3 tasks | ✅ COMPLETE | ~27 min |
| Phase 2: Testing | 4 tasks | ✅ COMPLETE | ~10 min |
| Phase 3: Deployment | 1 task | ✅ COMPLETE | ~5 min |
| **Total** | **8 tasks** | **✅ ALL DONE** | **~42 min** |

---

## Completion Checklist

- [x] All Phase 1 tasks complete
- [x] All Phase 2 tests pass
- [x] Deployed to production
- [x] No new errors in Sentry
- [x] Documentation updated (this file)

---

## What Was Implemented

### handleUninstall() - Full Cleanup
1. Early validation of salonId
2. Find company by yclientsId
3. Idempotency check (skip if already uninstalled)
4. **Remove WhatsApp credentials** via `removeTimewebAuthState(companyId)`
5. **Clear cached credentials** from sessionPool
6. Update company: `status='uninstalled'`, `disconnected_at=NOW()`, `api_key=null`
7. Log event to `marketplace_events` table
8. Sentry tracking for errors
9. Graceful degradation (warn on errors, don't throw)

### handleFreeze() - Temporary Suspension
1. Early validation of salonId
2. Find company by yclientsId
3. Idempotency check (skip if already frozen)
4. **Preserve credentials** for later restoration
5. Update company: `status='frozen'`
6. Log event with `reason='payment_overdue'`
7. Sentry tracking for errors

### Key Bug Fix
- **Fixed:** Was using `salonId` instead of `company.id` for sessionPool operations
