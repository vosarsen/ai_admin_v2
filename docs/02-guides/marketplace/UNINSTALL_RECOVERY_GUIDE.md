# YClients Uninstall/Freeze Recovery Guide

**Last Updated:** 2025-12-04
**Purpose:** Manual recovery procedures when uninstall/freeze doesn't complete fully

---

## Quick Diagnostics

### 1. Check Company Status

```sql
-- Подключение к Timeweb PostgreSQL
psql 'postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require'

-- Проверить статус компании по salon_id
SELECT id, yclients_id, title, integration_status, whatsapp_connected,
       api_key IS NOT NULL as has_api_key, disconnected_at
FROM companies
WHERE yclients_id = YOUR_SALON_ID;
```

### 2. Check Credentials Exist

```sql
-- WhatsApp Auth (основные credentials)
SELECT company_id, created_at, updated_at
FROM whatsapp_auth
WHERE company_id = YOUR_COMPANY_ID;

-- WhatsApp Keys (сессионные ключи)
SELECT company_id, key_type, COUNT(*) as key_count
FROM whatsapp_keys
WHERE company_id = YOUR_COMPANY_ID
GROUP BY company_id, key_type;
```

### 3. Check Audit Log

```sql
-- Последние события для компании
SELECT id, event_type, event_data, created_at
FROM marketplace_events
WHERE company_id = YOUR_COMPANY_ID
ORDER BY created_at DESC
LIMIT 10;
```

---

## Expected States

### After Successful Uninstall

| Table | Expected State |
|-------|---------------|
| companies.integration_status | `'uninstalled'` |
| companies.whatsapp_connected | `false` |
| companies.api_key | `NULL` |
| companies.disconnected_at | Timestamp |
| whatsapp_auth | **Row deleted** |
| whatsapp_keys | **All rows deleted** |
| marketplace_events | Event with `event_type='uninstalled'` |

### After Successful Freeze

| Table | Expected State |
|-------|---------------|
| companies.integration_status | `'frozen'` |
| companies.whatsapp_connected | `false` |
| companies.api_key | **Preserved (NOT null)** |
| companies.disconnected_at | Not changed |
| whatsapp_auth | **Row preserved** |
| whatsapp_keys | **All rows preserved** |
| marketplace_events | Event with `event_type='frozen'` |

---

## Recovery Procedures

### Scenario 1: Uninstall Partial Failure

**Симптомы:**
- `integration_status` всё ещё `'active'`
- Но credentials удалены (whatsapp_auth пустой)

**Причина:** Database update failed после cleanup credentials

**Исправление:**
```sql
-- 1. Обновить статус вручную
UPDATE companies
SET integration_status = 'uninstalled',
    whatsapp_connected = false,
    api_key = NULL,
    disconnected_at = NOW()
WHERE id = YOUR_COMPANY_ID;

-- 2. Добавить событие в audit log
INSERT INTO marketplace_events (company_id, salon_id, event_type, event_data, created_at)
VALUES (YOUR_COMPANY_ID, YOUR_SALON_ID, 'uninstalled',
        '{"source": "manual_recovery", "reason": "partial_failure_fix"}', NOW());
```

### Scenario 2: Orphaned Credentials

**Симптомы:**
- `integration_status = 'uninstalled'`
- Но whatsapp_auth всё ещё содержит данные

**Причина:** removeTimewebAuthState failed

**Исправление:**
```sql
-- 1. Удалить orphaned auth
DELETE FROM whatsapp_auth WHERE company_id = YOUR_COMPANY_ID;

-- 2. Удалить orphaned keys
DELETE FROM whatsapp_keys WHERE company_id = YOUR_COMPANY_ID;

-- 3. Логировать очистку
INSERT INTO marketplace_events (company_id, salon_id, event_type, event_data, created_at)
VALUES (YOUR_COMPANY_ID, YOUR_SALON_ID, 'credentials_cleanup',
        '{"source": "manual_recovery", "reason": "orphaned_credentials"}', NOW());
```

### Scenario 3: Freeze Accidentally Deleted Credentials

**Симптомы:**
- `integration_status = 'frozen'`
- Но whatsapp_auth пустой (должен был сохраниться!)

**Причина:** Bug в коде или неправильный webhook processing

**Исправление:**
```
К сожалению, credentials нельзя восстановить.
Клиенту нужно будет:
1. Оплатить подписку
2. Перепривязать WhatsApp (новый QR-код)
```

**Профилактика:** Эта ситуация не должна случаться с исправленным кодом (commit 49d00dd).

### Scenario 4: Duplicate Uninstall Events

**Симптомы:**
- Несколько записей 'uninstalled' в marketplace_events
- Возможные ошибки в логах

**Причина:** YClients отправил webhook несколько раз

**Действие:** Это нормально благодаря idempotency check. Никаких действий не требуется.

---

## Verification Queries

### Full Health Check for Company

```sql
-- Полная проверка состояния компании
WITH company_info AS (
  SELECT id, yclients_id, title, integration_status,
         whatsapp_connected, api_key IS NOT NULL as has_api_key,
         disconnected_at
  FROM companies WHERE yclients_id = YOUR_SALON_ID
),
auth_info AS (
  SELECT company_id, 'exists' as auth_status
  FROM whatsapp_auth
  WHERE company_id = (SELECT id FROM company_info)
),
keys_info AS (
  SELECT company_id, COUNT(*) as keys_count
  FROM whatsapp_keys
  WHERE company_id = (SELECT id FROM company_info)
  GROUP BY company_id
),
events_info AS (
  SELECT company_id, event_type, created_at as last_event_at
  FROM marketplace_events
  WHERE company_id = (SELECT id FROM company_info)
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  c.*,
  COALESCE(a.auth_status, 'missing') as whatsapp_auth,
  COALESCE(k.keys_count, 0) as whatsapp_keys_count,
  e.event_type as last_event,
  e.last_event_at
FROM company_info c
LEFT JOIN auth_info a ON c.id = a.company_id
LEFT JOIN keys_info k ON c.id = k.company_id
LEFT JOIN events_info e ON c.id = e.company_id;
```

### Check for Inconsistent States

```sql
-- Найти компании с несогласованным состоянием
SELECT c.id, c.yclients_id, c.title, c.integration_status,
       c.whatsapp_connected,
       c.api_key IS NOT NULL as has_api_key,
       wa.company_id IS NOT NULL as has_credentials
FROM companies c
LEFT JOIN whatsapp_auth wa ON c.id = wa.company_id
WHERE
  -- Uninstalled но есть credentials
  (c.integration_status = 'uninstalled' AND wa.company_id IS NOT NULL)
  OR
  -- Frozen но нет credentials (проблема!)
  (c.integration_status = 'frozen' AND wa.company_id IS NULL AND c.whatsapp_connected = true)
  OR
  -- Active но нет credentials
  (c.integration_status = 'active' AND wa.company_id IS NULL AND c.whatsapp_connected = true);
```

---

## Monitoring

### GlitchTip Alerts

Ошибки uninstall/freeze отправляются в Sentry с тегами:
- `component: marketplace`
- `operation: handleUninstall` или `handleFreeze`
- `backend: yclients-marketplace`

### Log Patterns to Watch

```bash
# На сервере - проверить логи
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "grep -a 'handleUninstall\|handleFreeze' /root/.pm2/logs/ai-admin-api-out.log | tail -20"
```

**Успешный uninstall:**
```
🗑️ Handling uninstall for salon XXXXX
✅ WhatsApp session removed
✅ WhatsApp credentials removed from database
✅ Credentials cache cleared
✅ Company XXXXX (salon XXXXX) fully uninstalled
```

**Успешный freeze:**
```
❄️ Handling freeze for salon XXXXX
✅ WhatsApp session stopped (frozen)
✅ Company XXXXX (salon XXXXX) frozen
```

**Warning (не критично):**
```
⚠️ Failed to remove WhatsApp session: Session not found
```

**Error (требует внимания):**
```
❌ Failed to handle uninstall: [error details]
```

---

## Contacts

**Support Escalation:**
1. Проверить GlitchTip на ошибки
2. Выполнить диагностику из этого документа
3. При необходимости - ручное исправление

**Code Location:**
- `src/api/routes/yclients-marketplace.js:1469-1614` - handleUninstall/handleFreeze
- `src/integrations/whatsapp/auth-state-timeweb.js:819-847` - removeTimewebAuthState

---

## Related Documentation

- [AUTHORIZATION_QUICK_REFERENCE.md](./AUTHORIZATION_QUICK_REFERENCE.md) - YClients авторизация
- [MARKETPLACE_API.md](./MARKETPLACE_API.md) - API reference
- `tests/integration/yclients-uninstall.test.js` - Integration tests

---

**Version:** 1.0
**Author:** Claude Code
**Status:** Production Ready
