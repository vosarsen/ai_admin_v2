# RESCHEDULE_BOOKING Bug Fix - Tasks

**Last Updated:** 2025-11-28
**Version:** 2.0 (Updated after plan review)

## Phase 1: Primary Fix (CRITICAL) - Estimated: 30 min

### 1.1 Add RESCHEDULE_BOOKING case handler
- [ ] Open `src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`
- [ ] Find line ~216 (after CHECK_STAFF_SCHEDULE, before default)
- [ ] Add date formatting helper `formatDT()`
- [ ] Add case for RESCHEDULE_BOOKING with ALL 8 result types:
  - [ ] Case 1: `success: true` (перенос успешен)
  - [ ] Case 2: `slotNotAvailable: true` (слот занят) ← ТЕКУЩИЙ БАГ
  - [ ] Case 3: `permissionError: true` (ошибка 403)
  - [ ] Case 4: `needsDateTime: true` (нужна дата/время)
  - [ ] Case 5: `error: 'У вас нет активных записей'`
  - [ ] Case 6: `error: 'У вас нет предстоящих записей'`
  - [ ] Case 7-8: generic error / exception

### 1.2 Verify syntax
- [ ] Run: `node -c src/services/ai-admin-v2/prompts/two-stage-response-prompt.js`
- [ ] Убедиться что нет syntax errors

## Phase 2: Secondary Fix - ❌ ОТКЛОНЕНО

~~Fix success flag in two-stage-processor.js~~

**Причина отклонения:** Plan review показал что это изменение сломает 5 из 6 существующих команд. Откладываем на отдельный рефакторинг.

## Phase 3: Deploy - Estimated: 10 min

### 3.1 Commit changes
- [ ] `git add -A`
- [ ] `git commit -m "fix: handle RESCHEDULE_BOOKING slotNotAvailable in formatCommandResults"`

### 3.2 Push and deploy
- [ ] `git push origin main`
- [ ] SSH: `cd /opt/ai-admin && git pull origin main`
- [ ] Restart: `pm2 restart ai-admin-worker-v2`
- [ ] Check status: `pm2 status`

## Phase 4: Testing - Estimated: 20 min

### 4.1 Test Case 2: Slot Unavailable (CURRENT BUG)
- [ ] Найти занятый слот на завтра
- [ ] Создать тестовую запись на тестовом номере 89686484488
- [ ] Попросить перенести на занятый слот
- [ ] **VERIFY:** AI НЕ говорит "перенёс"
- [ ] **VERIFY:** AI предлагает альтернативы из nearbySlots

### 4.2 Test Case 1: Successful Reschedule
- [ ] Попросить перенести на свободный слот
- [ ] **VERIFY:** AI подтверждает новое время
- [ ] **VERIFY:** Запись реально перенесена в YClients

### 4.3 Test Case 5: No Active Bookings
- [ ] Отменить все записи на тестовом номере
- [ ] Попросить перенести запись
- [ ] **VERIFY:** AI говорит что нет записей

### 4.4 Test Existing Commands (Regression)
- [ ] Test CREATE_BOOKING - записать клиента
- [ ] Test CANCEL_BOOKING - отменить запись
- [ ] Test SEARCH_SLOTS - найти свободное время
- [ ] **VERIFY:** Все работают без регрессий

### 4.5 Monitor logs
- [ ] `pm2 logs ai-admin-worker-v2 --lines 100`
- [ ] Проверить нет ли ошибок
- [ ] Искать: `RESCHEDULE_BOOKING` в логах

## Phase 5: Client Communication - Estimated: 5 min

### 5.1 Notify Vladimir
- [ ] Отправить сообщение на +7 985 460-61-56:
  ```
  Владимир, уточнение по записи: вы записаны на 29 ноября в 14:30 к Бари
  (14:00 было занято). Ждём вас!
  ```

## Phase 6: Documentation - Estimated: 10 min

### 6.1 Create development diary entry
- [ ] Create `docs/03-development-diary/2025-11-28-reschedule-slotNotAvailable-fix.md`
- [ ] Document: incident, root cause, fix, lessons learned

### 6.2 Move to completed
- [ ] Move `dev/active/reschedule-booking-bug-fix/` to `dev/completed/`

## Phase 7: Follow-up Task - Estimated: 15 min

### 7.1 Create task for other missing commands
- [ ] Create `dev/active/missing-command-handlers/`
- [ ] Document 6 commands without case handlers:
  - CONFIRM_BOOKING (HIGH priority)
  - SHOW_BOOKINGS (HIGH priority)
  - SHOWBOOKINGS
  - SAVE_CLIENT_NAME
  - MARK_NO_SHOW (LOW priority)
  - SHOW_PORTFOLIO (LOW priority)

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Primary Fix | ⬜ Pending | All 8 error types |
| Phase 2: Secondary Fix | ❌ Rejected | Too risky |
| Phase 3: Deploy | ⬜ Pending | |
| Phase 4: Testing | ⬜ Pending | 4 test scenarios + regression |
| Phase 5: Client Communication | ⬜ Pending | Notify Vladimir |
| Phase 6: Documentation | ⬜ Pending | |
| Phase 7: Follow-up Task | ⬜ Pending | 6 other commands |

**Total Estimated Time:** ~1.5 hours
