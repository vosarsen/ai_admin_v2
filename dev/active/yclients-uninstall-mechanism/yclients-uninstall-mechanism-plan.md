# YClients Uninstall/Freeze Mechanism - Complete Plan

**Last Updated:** 2025-12-04 (v2 - after code review)
**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** ~50 minutes
**Code Review:** Passed (plan-reviewer agent)

---

## Executive Summary

Когда пользователь отключает интеграцию в YClients, система получает webhook `uninstall`, но текущая реализация неполная:
- Credentials остаются в БД (security risk)
- API key не очищается
- Нет аудит-лога событий
- Нет транзакционности

Требуется доработать `handleUninstall()` и `handleFreeze()` для полной очистки при отключении.

---

## Current State Analysis

### Что работает

```
YClients → POST /marketplace/webhook/yclients → handleUninstall(salonId)
                                                     │
                                                     ├─ ✅ sessionPool.removeSession()
                                                     └─ ✅ updateByYclientsId(status='uninstalled')
```

### Что НЕ работает (проблемы)

| Проблема | Риск | Последствия |
|----------|------|-------------|
| Credentials в БД остаются | HIGH | Старые ключи накапливаются, потенциальная утечка |
| API key не очищается | MEDIUM | Старый ключ может быть использован |
| Нет логирования | LOW | Нет audit trail для отладки |
| Нет транзакции | LOW | При ошибке - частичное состояние |

### Текущий код (src/api/routes/yclients-marketplace.js:1467-1486)

```javascript
async function handleUninstall(salonId) {
  logger.info(`🗑️ Handling uninstall for salon ${salonId}`);

  const sessionId = `company_${salonId}`;  // BUG: должен быть company.id, не salonId!
  try {
    await sessionPool.removeSession(sessionId);
    logger.info('✅ WhatsApp session removed');
  } catch (error) {
    logger.error('❌ Failed to remove WhatsApp session:', error);
  }

  await companyRepository.updateByYclientsId(parseInt(salonId), {
    integration_status: 'uninstalled',
    whatsapp_connected: false
  });

  logger.info('✅ Company marked as uninstalled');
}
```

**Bugs найдены:**
1. `sessionId = company_${salonId}` - неверно! Должен быть `company.id`, не `salonId`

---

## Proposed Future State

### Архитектура

```
YClients → POST /marketplace/webhook/yclients → handleUninstall(salonId)
                                                     │
                                                     ├─ 1. companyRepository.findByYclientsId()
                                                     ├─ 2. sessionPool.removeSession(companyId)
                                                     ├─ 3. removeTimewebAuthState(companyId) ← NEW
                                                     ├─ 4. sessionPool.clearCachedCredentials() ← NEW
                                                     ├─ 5. companyRepository.update(status, disconnected_at)
                                                     └─ 6. marketplaceEventsRepository.insert() ← NEW
```

### Логика событий

| Событие | WhatsApp Session | Credentials (БД) | Cache | Статус | Восстановление |
|---------|-----------------|-----------------|-------|--------|----------------|
| `uninstall` | ❌ Удалить | ❌ Удалить | ❌ Очистить | `uninstalled` | Новый QR-код |
| `freeze` | ❌ Остановить | ✅ Оставить | ✅ Оставить | `frozen` | Авто после оплаты |

---

## Implementation Phases

### Phase 1: Code Changes (30 min)

**Файл:** `src/api/routes/yclients-marketplace.js`

#### Task 1.1: Add Import (S - 2 min)
- После строки 10 добавить:
```javascript
const { removeTimewebAuthState } = require('../../integrations/whatsapp/auth-state-timeweb');
```

#### Task 1.2: Rewrite handleUninstall() (M - 15 min)
- Заменить строки 1467-1486 на новую реализацию
- Ключевые изменения:
  - Найти company по yclientsId
  - Использовать company.id для removeSession (не salonId!)
  - Добавить removeTimewebAuthState()
  - Добавить clearCachedCredentials()
  - Добавить disconnected_at timestamp
  - Добавить логирование в marketplace_events
  - Добавить Sentry error tracking

#### Task 1.3: Rewrite handleFreeze() (M - 10 min)
- Заменить строки 1491-1499 на новую реализацию
- Ключевые отличия от uninstall:
  - НЕ удалять credentials (для восстановления после оплаты)
  - НЕ очищать cache
  - Логировать с reason='payment_overdue'

### Phase 2: Testing (15 min)

#### Task 2.1: Unit Test (S - 5 min)
- Проверить что функции не throw при отсутствии company

#### Task 2.2: Integration Test (M - 10 min)
- Симулировать webhook uninstall
- Проверить что credentials удалены из БД
- Проверить marketplace_events

### Phase 3: Deployment (5 min)

#### Task 3.1: Deploy to Production (S - 5 min)
```bash
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && pm2 restart all"
```

---

## Detailed Code Changes

### handleUninstall() - New Implementation

```javascript
async function handleUninstall(salonId) {
  logger.info(`🗑️ Handling uninstall for salon ${salonId}`);

  try {
    // 1. Найти company по YClients ID
    const company = await companyRepository.findByYclientsId(parseInt(salonId));

    if (!company) {
      logger.warn(`Company not found for salon ${salonId}`);
      return;
    }

    // 2. Idempotency check - не обрабатывать дубликаты
    if (company.integration_status === 'uninstalled') {
      logger.info(`Company ${company.id} already uninstalled, skipping`);
      return;
    }

    const companyId = company.id;

    // 3. Удалить in-memory сессию WhatsApp
    try {
      await sessionPool.removeSession(companyId);
      logger.info('✅ WhatsApp session removed');
    } catch (error) {
      logger.warn('⚠️ Failed to remove WhatsApp session:', error.message);
    }

    // 4. Удалить credentials из БД (whatsapp_auth, whatsapp_keys)
    try {
      await removeTimewebAuthState(companyId);
      logger.info('✅ WhatsApp credentials removed from database');
    } catch (error) {
      logger.warn('⚠️ Failed to remove credentials:', error.message);
    }

    // 5. Очистить credentials cache
    try {
      if (sessionPool.clearCachedCredentials) {
        sessionPool.clearCachedCredentials(companyId);
        logger.info('✅ Credentials cache cleared');
      }
    } catch (error) {
      logger.warn('⚠️ Failed to clear credentials cache:', error.message);
    }

    // 6. Обновить статус компании в БД + очистить API key
    await companyRepository.update(companyId, {
      integration_status: 'uninstalled',
      whatsapp_connected: false,
      disconnected_at: new Date().toISOString(),
      api_key: null
    });

    // 7. Залогировать событие в marketplace_events
    try {
      await marketplaceEventsRepository.insert({
        company_id: companyId,
        salon_id: parseInt(salonId),
        event_type: 'uninstalled',
        event_data: { source: 'yclients_webhook' }
      });
    } catch (error) {
      logger.warn('⚠️ Failed to log marketplace event:', error.message);
    }

    logger.info(`✅ Company ${companyId} (salon ${salonId}) fully uninstalled`);

  } catch (error) {
    logger.error('❌ Failed to handle uninstall:', error);
    Sentry.captureException(error, {
      tags: { component: 'marketplace', operation: 'handleUninstall' },
      extra: { salonId }
    });
  }
}
```

### handleFreeze() - New Implementation

```javascript
async function handleFreeze(salonId) {
  logger.info(`❄️ Handling freeze for salon ${salonId}`);

  try {
    const company = await companyRepository.findByYclientsId(parseInt(salonId));

    if (!company) {
      logger.warn(`Company not found for salon ${salonId}`);
      return;
    }

    // Idempotency check
    if (company.integration_status === 'frozen') {
      logger.info(`Company ${company.id} already frozen, skipping`);
      return;
    }

    // При freeze - останавливаем сессию, но НЕ удаляем credentials
    // (чтобы можно было восстановить после оплаты)
    try {
      await sessionPool.removeSession(company.id);
      logger.info('✅ WhatsApp session stopped (frozen)');
    } catch (error) {
      logger.warn('⚠️ Failed to stop WhatsApp session:', error.message);
    }

    await companyRepository.update(company.id, {
      integration_status: 'frozen',
      whatsapp_connected: false
    });

    // Логируем событие
    try {
      await marketplaceEventsRepository.insert({
        company_id: company.id,
        salon_id: parseInt(salonId),
        event_type: 'frozen',
        event_data: { source: 'yclients_webhook', reason: 'payment_overdue' }
      });
    } catch (error) {
      logger.warn('⚠️ Failed to log marketplace event:', error.message);
    }

    logger.info(`✅ Company ${company.id} (salon ${salonId}) frozen`);

  } catch (error) {
    logger.error('❌ Failed to handle freeze:', error);
    Sentry.captureException(error, {
      tags: { component: 'marketplace', operation: 'handleFreeze' },
      extra: { salonId }
    });
  }
}
```

---

## Code Review Fixes Applied (v2)

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Missing `parseInt(salonId)` in marketplace_events | HIGH | ✅ Added `parseInt(salonId)` |
| No idempotency check for duplicates | MEDIUM | ✅ Added check for `integration_status === 'uninstalled'/'frozen'` |
| API key not cleared | MEDIUM | ✅ Added `api_key: null` in update |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Credentials deletion fails | Low | Medium | Graceful degradation (warn, continue) |
| Company not found | Low | Low | Early return with warning |
| Database connection error | Low | High | Sentry tracking, retry later |
| Session removal fails | Low | Low | Warn but continue with rest of cleanup |

---

## Success Metrics

1. ✅ При uninstall webhook credentials удаляются из `whatsapp_auth` и `whatsapp_keys`
2. ✅ При uninstall создаётся запись в `marketplace_events` с `event_type='uninstalled'`
3. ✅ При freeze credentials НЕ удаляются (можно восстановить)
4. ✅ При freeze создаётся запись с `event_type='frozen'`
5. ✅ Ошибки логируются в Sentry

---

## Required Dependencies (Already Available)

| Dependency | Location | Status |
|------------|----------|--------|
| `removeTimewebAuthState` | `src/integrations/whatsapp/auth-state-timeweb.js` | ✅ Exported |
| `sessionPool.clearCachedCredentials` | `src/integrations/whatsapp/session-pool.js` | ✅ Available |
| `marketplaceEventsRepository` | Already in file (line 228) | ✅ Instantiated |
| `companyRepository` | Already in file | ✅ Instantiated |
| `Sentry` | Already imported | ✅ Available |
| `disconnected_at` column | Migration exists | ✅ In production |

---

## Testing Commands

```bash
# 1. Симуляция uninstall webhook (ОСТОРОЖНО - НЕ на production company!)
curl -X POST https://adminai.tech/marketplace/webhook/yclients \
  -H "Content-Type: application/json" \
  -d '{
    "salon_id": 999999,
    "application_id": 18289,
    "event": "uninstall",
    "partner_token": "YOUR_PARTNER_TOKEN"
  }'

# 2. Проверить credentials (должны быть удалены)
ssh root@46.149.70.219 "psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c \"SELECT * FROM whatsapp_auth WHERE company_id = 1;\""

# 3. Проверить marketplace_events
ssh root@46.149.70.219 "psql postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@a84c973324fdaccfc68d929d.twc1.net:5432/default_db?sslmode=require -c \"SELECT * FROM marketplace_events ORDER BY created_at DESC LIMIT 5;\""
```

---

## Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Code Changes | 30 min | 30 min |
| Phase 2: Testing | 15 min | 45 min |
| Phase 3: Deployment | 5 min | 50 min |

**Total: ~50 minutes**
