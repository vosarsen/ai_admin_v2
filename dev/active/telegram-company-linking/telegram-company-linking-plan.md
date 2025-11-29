# Telegram Company Linking - Implementation Plan

**Project:** AI Admin v2 - Multi-tenant Telegram Business Connection
**Status:** Planning
**Created:** 2025-11-29
**Last Updated:** 2025-11-29
**Estimated:** 8-12 hours

---

## Executive Summary

Реализация связки Telegram Business Connection с Company ID через систему кодов подключения. Это позволит масштабировать Telegram интеграцию с одного салона (MVP) на множество салонов (multi-tenant).

### Проблема

Сейчас при подключении Telegram Business Bot мы не знаем какому салону (company_id) принадлежит подключение. Используется костыль `TELEGRAM_DEFAULT_COMPANY_ID`.

### Решение

Система кодов подключения:
1. Админ генерирует уникальный код для салона (например: `ABC123`)
2. Салон подключает бота в Telegram Settings
3. Бот просит ввести код
4. Код связывает `business_connection_id` → `company_id`

---

## Current State Analysis

### Текущий flow (MVP - один салон)

```
1. Салон подключает @AdmiAI_bot в Telegram Business Settings
2. Telegram отправляет business_connection event
3. telegram-manager.js использует config.telegram.defaultCompanyId (962302)
4. Все подключения идут к одному салону
```

### Проблемные места в коде

```javascript
// telegram-manager.js:134
const companyId = config.telegram.defaultCompanyId;

if (!companyId) {
  logger.error('TELEGRAM_DEFAULT_COMPANY_ID not configured');
  return;
}
```

### Существующие таблицы

- `telegram_business_connections` - уже создана, содержит `company_id`
- `companies` - содержит `telegram_enabled`, `telegram_premium_until`

---

## Proposed Future State

### Новый flow (Multi-tenant)

```
1. Админ в нашей админке создаёт "код подключения" для салона
2. Код: ABC123 (6 символов, expires in 10 min)
3. Салон подключает бота в Telegram Business Settings
4. Бот получает business_connection event
5. Бот определяет что это новое подключение без company_id
6. Бот сохраняет telegram_user_id + business_connection_id как "pending"
7. Когда пользователь пишет боту напрямую (не через business) — просим код
8. Пользователь вводит ABC123
9. Система связывает business_connection_id → company_id
10. Подключение активировано!
```

### Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                     АДМИНКА (наша)                               │
│                                                                  │
│   POST /api/telegram/generate-code                              │
│   { companyId: 962302 }                                          │
│   → { code: "ABC123", expiresAt: "..." }                        │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     БАЗА ДАННЫХ                                  │
│                                                                  │
│   telegram_connection_codes:                                     │
│   - company_id: 962302                                          │
│   - code: "ABC123"                                              │
│   - expires_at: NOW() + 10 min                                  │
│   - used_at: NULL                                               │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TELEGRAM BOT                                 │
│                                                                  │
│   1. business_connection event                                   │
│      → сохраняем как pending (telegram_user_id)                 │
│                                                                  │
│   2. /start или direct message от owner                         │
│      → "Введите код подключения"                                │
│                                                                  │
│   3. Получаем "ABC123"                                          │
│      → ищем в telegram_connection_codes                         │
│      → находим company_id = 962302                              │
│      → обновляем telegram_business_connections                  │
│      → "✅ Подключено!"                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database Schema (1h)
- Создать таблицу `telegram_connection_codes`
- Добавить поле `status` в `telegram_business_connections`

### Phase 2: Connection Code API (2h)
- POST `/api/telegram/connection-codes` - генерация кода
- GET `/api/telegram/connection-codes/:companyId` - активные коды
- DELETE `/api/telegram/connection-codes/:code` - отмена кода

### Phase 3: Bot Logic Update (3h)
- Обработка business_connection как "pending"
- Команда /start для ввода кода
- Валидация и активация кода
- Сообщения пользователю

### Phase 4: Manager Multi-tenant (2h)
- Удалить зависимость от defaultCompanyId
- Обновить resolveConnection для pending connections
- Добавить activateConnection метод

### Phase 5: Testing & Documentation (2h)
- Unit тесты для кодов
- Integration тест для flow
- Обновить документацию

---

## Database Schema

### New Table: telegram_connection_codes

```sql
CREATE TABLE telegram_connection_codes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  code VARCHAR(10) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by_telegram_user_id BIGINT,
  created_by VARCHAR(255),  -- admin username
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tg_codes_company ON telegram_connection_codes(company_id);
CREATE INDEX idx_tg_codes_code ON telegram_connection_codes(code);
CREATE INDEX idx_tg_codes_expires ON telegram_connection_codes(expires_at);
```

### Modified: telegram_business_connections

```sql
ALTER TABLE telegram_business_connections
ADD COLUMN status VARCHAR(20) DEFAULT 'active'
CHECK (status IN ('pending', 'active', 'expired', 'disconnected'));

-- pending = business_connection получен, но код ещё не введён
-- active = полноценное подключение
-- expired = pending истёк (24h)
-- disconnected = салон отключил бота
```

---

## API Endpoints

### POST /api/telegram/connection-codes

```javascript
// Request
{
  "companyId": 962302
}

// Response
{
  "success": true,
  "code": "ABC123",
  "expiresAt": "2025-11-29T12:10:00Z",
  "expiresInMinutes": 10
}
```

### GET /api/telegram/connection-codes/:companyId

```javascript
// Response
{
  "success": true,
  "codes": [
    {
      "code": "ABC123",
      "expiresAt": "2025-11-29T12:10:00Z",
      "used": false
    }
  ],
  "activeConnection": {
    "telegramUsername": "@salon_owner",
    "connectedAt": "2025-11-28T10:00:00Z"
  }
}
```

---

## Bot Flow Changes

### Current Flow

```javascript
bot.on('business_connection', async (ctx) => {
  // Сразу сохраняем с defaultCompanyId
  await saveConnection(defaultCompanyId, data);
});
```

### New Flow

```javascript
bot.on('business_connection', async (ctx) => {
  if (data.isEnabled) {
    // 1. Сохраняем как pending (без company_id)
    await savePendingConnection(data);

    // 2. Отправляем сообщение напрямую пользователю
    await ctx.api.sendMessage(data.userId,
      'Для завершения подключения введите код из админ-панели AI Admin:'
    );
  }
});

bot.on('message:text', async (ctx) => {
  // Проверяем, есть ли pending connection для этого user
  const pending = await getPendingConnection(ctx.from.id);

  if (pending) {
    const code = ctx.message.text.trim().toUpperCase();
    const connectionCode = await validateCode(code);

    if (connectionCode) {
      // Активируем подключение!
      await activateConnection(pending.businessConnectionId, connectionCode.companyId);
      await ctx.reply('✅ Подключено! Бот теперь будет отвечать вашим клиентам.');
    } else {
      await ctx.reply('❌ Неверный или истёкший код. Попробуйте ещё раз.');
    }
  }
});
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Код истёк до ввода | Medium | Low | Увеличить TTL до 30 минут |
| Салон не понимает что делать | Medium | Medium | Подробные инструкции в UI |
| Business connection без direct message | Low | High | Fallback: показать код в business chat |
| Брутфорс кодов | Low | Medium | Rate limit + 6+ символов + expiry |

---

## Success Metrics

1. **Функциональные:**
   - [ ] Код генерируется и истекает корректно
   - [ ] Business connection сохраняется как pending
   - [ ] Код активирует подключение
   - [ ] Multi-tenant работает (разные салоны)

2. **Нефункциональные:**
   - [ ] Активация < 5 секунд
   - [ ] 0% потерянных business_connection
   - [ ] Логи достаточны для дебага

---

## Dependencies

- Существующая Telegram интеграция (Phase 1-3 complete)
- Таблица `telegram_business_connections`
- Таблица `companies`
- grammY библиотека

---

## Timeline

| Phase | Estimated | Description |
|-------|-----------|-------------|
| Phase 1 | 1h | Database migration |
| Phase 2 | 2h | API endpoints |
| Phase 3 | 3h | Bot logic |
| Phase 4 | 2h | Manager update |
| Phase 5 | 2h | Testing & docs |
| **Total** | **10h** | |

---

## Files to Create/Modify

### Create:
- `migrations/20251130_telegram_connection_codes.sql`
- `src/repositories/TelegramConnectionCodeRepository.js`
- `src/api/routes/telegram-connection-codes.js`

### Modify:
- `src/integrations/telegram/telegram-bot.js` - add code verification
- `src/integrations/telegram/telegram-manager.js` - multi-tenant logic
- `src/repositories/TelegramConnectionRepository.js` - add status field
- `docs/02-guides/telegram/TELEGRAM_SALON_SETUP_RU.md` - update instructions
