# Telegram Company Linking - Context

**Last Updated:** 2025-11-29
**Current Phase:** Planning
**Session:** 1 (initial planning)

---

## Quick Summary

Реализация multi-tenant режима для Telegram Business Bot через систему кодов подключения. Салон получает код в админке, вводит его в Telegram — и бот связывается с его company_id.

---

## Key Decisions

### 1. Почему код, а не username?
- Username может измениться
- Не у всех есть username
- Код — явное действие подтверждения

### 2. Почему 6 символов?
- Легко вводить
- 36^6 = 2.2 млрд комбинаций
- С TTL 10-30 мин — брутфорс нереален

### 3. Почему pending status?
- Business connection приходит до того как пользователь может ввести код
- Нужно сохранить connection чтобы потом связать

### 4. Где вводится код?
- В **личных сообщениях боту**, не в business chat
- Потому что owner подключает бота → получает business_connection → потом пишет боту напрямую

---

## Important Files

| File | Purpose | Status |
|------|---------|--------|
| `src/integrations/telegram/telegram-bot.js` | grammY client | To modify |
| `src/integrations/telegram/telegram-manager.js` | Business logic | To modify |
| `src/repositories/TelegramConnectionRepository.js` | DB access | To modify |
| `migrations/20251129_create_telegram_tables.sql` | Existing schema | Reference |

---

## Current Limitation

```javascript
// telegram-manager.js:134
const companyId = config.telegram.defaultCompanyId;  // Костыль!
```

Это работает только для одного салона (962302).

---

## Technical Notes

### Business Connection Flow

```
1. Салон в Telegram: Settings → Business → Chatbot → Connect @AdmiAI_bot
2. Telegram отправляет нам business_connection event:
   {
     id: "conn-abc123",
     user: { id: 123456, username: "salon_owner" },
     can_reply: true,
     is_enabled: true
   }
3. Мы НЕ знаем company_id!
```

### Два типа сообщений

1. **Business Message** — клиент пишет салону (business_message event)
2. **Direct Message** — кто-то пишет боту напрямую (message event)

Для ввода кода используем Direct Message от owner'а.

---

## Questions to Resolve

1. ~~Как связать Telegram с company_id?~~ → Код подключения
2. [ ] Что если owner не вводит код 24+ часа?
3. [ ] Нужна ли возможность перепривязки?
4. [ ] Показывать ли код в business chat как fallback?

---

## Session Log

### Session 1 (2025-11-29)
- Создан план интеграции
- Определена архитектура с кодами подключения
- Создана структура dev-docs
- **Следующий шаг:** Начать с Phase 1 (Database)

---

## Handoff Notes

### Для продолжения работы:

1. Читать `telegram-company-linking-plan.md` для полного понимания
2. Начать с Phase 1: создать миграцию
3. Потом Phase 2: API endpoints
4. Потом Phase 3: Bot logic
5. Потом Phase 4: Manager multi-tenant

### Ключевые точки:
- `defaultCompanyId` — костыль который нужно убрать
- `pending` status — новое состояние для connections
- Direct message от owner — где вводится код
