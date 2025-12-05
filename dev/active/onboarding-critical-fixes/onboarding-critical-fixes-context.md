# Onboarding Critical Fixes - Context

**Last Updated:** 2025-12-05 11:20 MSK
**Status:** ✅ PROJECT COMPLETE - All 5 phases done + Full E2E Test passed!
**Code Review Grade:** A (96/100) - improved from A- (92/100)

---

## PROJECT COMPLETE - FINAL STATUS

### All Phases Completed:

| Phase | Description | Commit | Grade |
|-------|-------------|--------|-------|
| 1 | LID Phone Fix | `14a222a` | A (88/100) |
| 2 | Company ID Unification | `74b4ce8` | A- (86/100) |
| 3 | WebSocket via Redis Pub/Sub | `7c7297a`, `187bf5e` | A (88/100) |
| 4 | Debug Logging Cleanup | `b16d00e` | A+ (100/100) |
| 5 | **Post-Review Improvements** | `d788eaa` | A (95/100) |

---

## SESSION 3 SUMMARY (2025-12-04 21:45-22:00 MSK)

### Phase 5: Post-Review Improvements (ALL DONE)

Based on code-architecture-reviewer agent recommendations:

1. **5.1 Transaction Wrapper** ✅
   - File: `migrations/20251204_unify_company_id.sql`
   - Added: BEGIN/COMMIT, auto-backup, RAISE EXCEPTION on failure

2. **5.2 Health Check Endpoints** ✅
   - File: `src/api/routes/health.js`
   - `/health/pubsub` - Full ping/pong test with baileys-service
   - `/health/pubsub/simple` - Basic Redis pub/sub test

3. **5.3 Integration Tests** ✅
   - File: `tests/integration/redis-pubsub.test.js` (410 lines, 13 tests)
   - Mock Redis client for isolated testing
   - Event validation, phone format handling tests

4. **5.4 Retry Logic** ✅
   - File: `src/utils/redis-pubsub.js` (NEW - 220 lines)
   - `publishWithRetry()` with exponential backoff
   - Updated `scripts/baileys-service.js` to use retry

### E2E Testing Results (Production)

| Test | Result | Details |
|------|--------|---------|
| `/health/pubsub/simple` | ✅ | latency: 8ms |
| `/health/pubsub` (ping/pong) | ✅ | latency: 7-13ms |
| Redis Pub/Sub flow | ✅ | `📤 Published` → `📥 Received` |
| WhatsApp send message | ✅ | `messageId: 3EB0E60788B4A2A3026E59` |
| Health checks | ✅ | Redis ✓ WhatsApp ✓ PostgreSQL ✓ |

### Verified Logs

```
baileys-service:
📤 Published connected event to Redis {"companyId":"company_962302"}

ai-admin-api:
📥 Received Redis event: {"type":"connected","companyId":"company_962302"}
```

---

## FINAL ARCHITECTURE

```
┌─────────────────────────┐          ┌─────────────────────────┐
│  baileys-service        │ PUBLISH  │  ai-admin-api           │
│  (PM2 process)          │ ───────► │  (PM2 process)          │
│                         │  Redis   │                         │
│  pool.on('connected')   │ channel: │  subscriber.on('message')│
│  ↓                      │ whatsapp │  ↓                      │
│  publishConnectedEvent  │ :events  │  marketplaceSocket      │
│  (with retry!)          │          │  .broadcastConnected()  │
└─────────────────────────┘          └─────────────────────────┘
                                              ↓
                                     WebSocket emit to client
                                     'whatsapp-connected' event
```

**New in Phase 5:**
- `redisSubscriber` in baileys-service listens for `ping` events
- Responds with `pong` on `whatsapp:health` channel
- Health endpoint verifies full flow: api → baileys → api

---

## KEY FILES CHANGED (Phase 5)

1. `migrations/20251204_unify_company_id.sql` - Transaction wrapper
2. `src/api/routes/health.js` - Health endpoints (+200 lines)
3. `src/utils/redis-pubsub.js` - NEW retry utility
4. `scripts/baileys-service.js` - Subscriber + retry usage
5. `tests/integration/redis-pubsub.test.js` - NEW integration tests

---

## COMMITS HISTORY

| Commit | Description |
|--------|-------------|
| `14a222a` | Phase 1: LID phone fix |
| `74b4ce8` | Phase 2: Company ID unification |
| `7c7297a` | Phase 3: Redis Pub/Sub initial |
| `187bf5e` | Phase 3: Redis auth fix |
| `b16d00e` | Phase 4: Console.log cleanup |
| `d245acd` | Docs: project complete |
| `d788eaa` | **Phase 5: Post-review improvements** |

---

## CODE REVIEW DOCUMENTS

- Initial review: `onboarding-critical-fixes-code-review.md` (A- 92/100)
- Final review: `onboarding-critical-fixes-final-review.md` (A 96/100)

---

## QUICK COMMANDS

```bash
# SSH
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Deploy
cd /opt/ai-admin && git pull && pm2 restart ai-admin-api baileys-whatsapp-service

# Test health endpoints
curl http://localhost:3000/health/pubsub/simple | jq .
curl http://localhost:3000/health/pubsub | jq .

# Run integration tests
npm test -- tests/integration/redis-pubsub.test.js

# Monitor Redis
redis-cli MONITOR | grep whatsapp

# Logs
pm2 logs baileys-whatsapp-service --lines 30
pm2 logs ai-admin-api --lines 30 | grep -i redis
```

---

## NEXT STEPS (Optional - LOW Priority)

From final code review:
1. Swagger docs for health endpoints (1h)
2. Prometheus metrics for pub/sub (2h)
3. Architecture diagram (30min)

---

## GIT STATUS

All changes committed and pushed to `main`.
Production deployed and tested.
No uncommitted changes.

---

## SESSION 4 SUMMARY (2025-12-05 08:00-11:20 MSK)

### ПОЛНЫЙ E2E ТЕСТ ONBOARDING FLOW ✅

Протестирован весь путь нового салона от подключения до работающего бота:

#### Шаги теста:

1. **Полная очистка данных салона 962302:**
   - Удалено из `companies` (1 запись)
   - Удалено из `whatsapp_auth` (1 запись)
   - Удалено из `whatsapp_keys` (222 ключа → 39 после reconnect)
   - Очищено 95 ключей из Redis
   - Остановлен baileys-whatsapp-service

2. **OAuth подключение:**
   - Пользователь нажал "Продолжить" на странице YClients OAuth
   - Company создана: `id=22, yclients_id=962302`

3. **QR-код сканирование:**
   - QR-код отображён на странице онбординга
   - Пользователь отсканировал QR телефоном салона
   - WhatsApp подключился: `phone: 79686484488:32`

4. **Credentials сохранены:**
   - `whatsapp_auth`: 1 запись
   - `whatsapp_keys`: 39 ключей

5. **Baileys service запущен:**
   ```json
   {
     "status": "connected",
     "connected": true,
     "phoneNumber": "79686484488:32",
     "messagesSent": 3,
     "errors": 0
   }
   ```

6. **Тест сообщений:**
   - Отправлено: "привет! во сколько сегодня можно постричься?"
   - AI обработка: 8.3 секунды
   - Команда: `SEARCH_SLOTS` → найдены слоты у мастера Бари
   - Ответ бота (3 сообщения):
     1. "Здравствуйте! Сегодня есть свободное время на мужскую стрижку у Бари:"
     2. "14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30, 18:00, 18:30, 19:00"
     3. "На какое время вас записать?"

### Проблема найдена и исправлена

**Проблема:** После сканирования QR-кода страница онбординга показывала "Ошибка активации интеграции" вместо перехода на следующий шаг.

**Причина:** YClients API возвращает `400 "Агрегатор не найден"` при callback, потому что приложение не опубликовано в маркетплейсе. Функция `activateIntegration()` бросала ошибку, которая блокировала вызов `handleWhatsAppConnected()`.

**Решение:** Обернули вызов `activateIntegration()` в try-catch, чтобы ошибка не блокировала переход:

```javascript
// public/marketplace/onboarding.html (строки 550-557, 583-588)
try {
    await activateIntegration();
} catch (error) {
    console.warn('YClients activation failed (non-blocking):', error.message);
}
handleWhatsAppConnected();
```

**Коммит:** `a5fb7f4` - `fix(onboarding): don't block on YClients activation error`

### Итоговый статус

| Компонент | Статус |
|-----------|--------|
| OAuth → Company creation | ✅ |
| QR-код генерация | ✅ |
| QR-код сканирование | ✅ |
| WhatsApp подключение | ✅ |
| Credentials сохранение | ✅ |
| Baileys service | ✅ |
| AI обработка сообщений | ✅ |
| UI переход на "Готово" | ✅ (после фикса) |

---

## COMMITS (Обновлено)

| Commit | Description |
|--------|-------------|
| `14a222a` | Phase 1: LID phone fix |
| `74b4ce8` | Phase 2: Company ID unification |
| `7c7297a` | Phase 3: Redis Pub/Sub initial |
| `187bf5e` | Phase 3: Redis auth fix |
| `b16d00e` | Phase 4: Console.log cleanup |
| `d245acd` | Docs: project complete |
| `d788eaa` | Phase 5: Post-review improvements |
| `0ee71a5` | Docs: E2E test results |
| **`a5fb7f4`** | **fix(onboarding): don't block on YClients activation error** |

---

---

## SESSION 5 SUMMARY (2025-12-05 12:00-12:50 MSK)

### Баг найден и исправлен: Преждевременный переход на "Готово"

**Проблема:** При тестировании Pairing Code, UI страницы онбординга перепрыгивал на шаг 3 "Готово" сразу после получения кода, **до того как пользователь ввёл код в WhatsApp**.

**Причина (Root Cause):**
- `getSessionStatus()` в `session-pool.js` возвращал `connected: !!session.user`
- Baileys устанавливает `session.user` из `state.creds.me` при создании сокета
- При pairing code flow, credentials сохраняют `me.id` **сразу при получении кода**, до реального подключения
- Polling на frontend проверял `data.connected` и переходил на "Готово"

**Решение:**
Добавлен `connectedSessions` Set для отслеживания **реальных** подключений:

```javascript
// src/integrations/whatsapp/session-pool.js

// Constructor:
this.connectedSessions = new Set(); // companyIds with actual open connection

// On connection open:
if (connection === 'open') {
    this.connectedSessions.add(companyId);
    // ...
}

// On connection close:
if (connection === 'close') {
    this.connectedSessions.delete(companyId);
    // ...
}

// getSessionStatus():
getSessionStatus(companyId) {
    const isActuallyConnected = this.connectedSessions.has(companyId);
    return {
        connected: isActuallyConnected,  // Was: !!session.user
        // ...
    };
}
```

**Коммит:** `1092809` - `fix(onboarding): prevent premature 'connected' status before WhatsApp link`

### Тестирование Pairing Code - В ПРОЦЕССЕ

После исправления, тестировали Pairing Code flow:
1. Очистка данных ✅
2. OAuth подключение ✅
3. Получение Pairing Code ✅ (код `SEPLKRND`)
4. Ввод кода в WhatsApp - **FAILED**

**Ошибка на телефоне:** "Couldn't link device. Something went wrong. Check your network connection and try again."

**Анализ:**
- `registered: false` в credentials - код не завершил регистрацию
- VPN/Xray работает нормально
- Baileys не использует прокси для WhatsApp соединений
- Возможная причина: datacenter IP блокируется WhatsApp
- **QR-код работал** в предыдущем тесте (Session 4)

### Текущее состояние БД

```sql
-- whatsapp_auth:
company_id: company_962302
registered: false
pairing_code: SEPLKRND
me_id: 79686484488@s.whatsapp.net
updated_at: 2025-12-05 12:41:56

-- Credentials были очищены для следующего теста
```

---

## KEY FILES CHANGED (Session 5)

1. **`src/integrations/whatsapp/session-pool.js`** - Добавлен `connectedSessions` Set
   - Строка 59: `this.connectedSessions = new Set();`
   - Строка 557: `this.connectedSessions.add(companyId);` в connection open
   - Строка 477: `this.connectedSessions.delete(companyId);` в connection close
   - Строка 714: `this.connectedSessions.delete(companyId);` в removeSession
   - Строки 973-979: `getSessionStatus()` использует `connectedSessions`
   - Строка 996: `getActiveSessions()` использует `connectedSessions`

---

## COMMITS (Обновлено Session 5)

| Commit | Description |
|--------|-------------|
| `14a222a` | Phase 1: LID phone fix |
| `74b4ce8` | Phase 2: Company ID unification |
| `7c7297a` | Phase 3: Redis Pub/Sub initial |
| `187bf5e` | Phase 3: Redis auth fix |
| `b16d00e` | Phase 4: Console.log cleanup |
| `d245acd` | Docs: project complete |
| `d788eaa` | Phase 5: Post-review improvements |
| `0ee71a5` | Docs: E2E test results |
| `a5fb7f4` | fix(onboarding): don't block on YClients activation error |
| **`1092809`** | **fix(onboarding): prevent premature 'connected' status before WhatsApp link** |

---

## NEXT SESSION: Продолжение тестирования

### Немедленно (при следующем запуске):

1. **Попробовать QR-код вместо Pairing Code**
   - QR работал в Session 4
   - Pairing Code может иметь проблемы с сетью/блокировкой

2. **Если QR не работает - проверить:**
   - `pm2 status` - baileys-whatsapp-service должен быть STOPPED
   - `pm2 logs ai-admin-api --lines 50` - ошибки при подключении
   - VPN статус: `systemctl status xray`

3. **Очистка перед тестом:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin && psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require' -c "
DELETE FROM whatsapp_keys WHERE company_id LIKE '%962302%';
DELETE FROM whatsapp_auth WHERE company_id LIKE '%962302%';
DELETE FROM companies WHERE yclients_id = '962302';
"
```

### Открытые вопросы:

1. **Pairing Code vs QR:** Почему QR работает, а Pairing Code нет?
2. **Proxy для Baileys:** Нужно ли добавить SOCKS5 proxy для Baileys?
3. **WhatsApp blocking:** Блокирует ли WhatsApp datacenter IP?

---

## GIT STATUS (Session 5 End)

```
Commit: 1092809 (HEAD -> main, origin/main)
Message: fix(onboarding): prevent premature 'connected' status before WhatsApp link
Status: Pushed and deployed to production
```

Нет незакоммиченных изменений.
