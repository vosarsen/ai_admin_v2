# YClients Marketplace Integration - Context

**Last Updated:** 2025-11-26

---

## Key Files

### Существующие (для модификации)

| File | Purpose | Lines |
|------|---------|-------|
| `src/api/routes/yclients-marketplace.js` | REST routes для marketplace | ~720 |
| `src/services/marketplace/marketplace-service.js` | Бизнес-логика marketplace | ~380 |
| `src/integrations/yclients/client.js` | Общий YClients API client | ~1115 |
| `mcp/mcp-yclients/server.js` | MCP server для Claude | ~697 |
| `.mcp.json` | MCP конфигурация | ~54 |

### Новые (для создания)

| File | Purpose |
|------|---------|
| `src/integrations/yclients/marketplace-client.js` | Выделенный Marketplace API client |

### Документация (референс)

| File | Purpose |
|------|---------|
| `docs/01-architecture/integrations/YCLIENTS_API.md` | Полная документация YClients API (1.2MB) |
| `docs/02-guides/marketplace/` | Guides по marketplace интеграции |

---

## API Documentation Reference

### Marketplace API Base URL
```
https://api.yclients.com/marketplace
```

### Authorization Header
```
Authorization: Bearer {PARTNER_TOKEN}
```

### Endpoints Summary

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | `/partner/callback/redirect` | Редирект после регистрации |
| 2 | POST | `/partner/callback` | Установка без редиректа |
| 3 | POST | `/partner/payment` | Уведомление об оплате |
| 4 | POST | `/partner/short_names` | SMS sender names |
| 5 | POST | `/partner/payment/refund/{id}` | Возврат платежа |
| 6 | GET | `/salon/{id}/application/{id}` | Статус подключения |
| 7 | GET | `/application/{id}/salons` | Список салонов |
| 8 | POST | `/salon/{id}/application/{id}/uninstall` | Отключение |
| 9 | GET | `/application/payment_link` | Ссылка на оплату |
| 10 | GET | `/application/{id}/tariffs` | Тарифы |
| 11 | POST | `/application/add_discount` | Скидки |
| 12 | POST | `/application/update_channel` | Каналы sms/whatsapp |
| 13 | POST | `/marketplace_webhook` | Входящий webhook |

---

## Key Decisions

### 1. Архитектура клиента
**Decision:** Создать отдельный `marketplace-client.js` вместо расширения `client.js`
**Rationale:**
- Разные base URL (`/api/v1` vs `/marketplace`)
- Разные заголовки авторизации
- Чёткое разделение ответственности
- Легче тестировать изолированно

### 2. База данных
**Decision:** Минимальные миграции - только расширение `companies`
**Rationale:**
- Платежи логируются в `marketplace_events` (уже есть)
- Не нужна отдельная таблица платежей
- Простота миграции

### 3. MCP Server
**Decision:** Расширить существующий `mcp-yclients/server.js`
**Rationale:**
- Один MCP server для всего YClients
- Удобнее для Claude (@yclients для всего)
- Меньше конфигурации

---

## Dependencies

### Внутренние

```
YclientsMarketplaceClient (new)
    ↓
MarketplaceService (extended)
    ↓
API Routes (extended)
    ↓
MCP Server (extended)
```

### Внешние

- YClients Marketplace API (production)
- YCLIENTS_APP_ID - нужно получить из YClients Developer Portal

---

## Environment Setup

### Текущие переменные (уже есть)
```bash
YCLIENTS_PARTNER_TOKEN=xxx
YCLIENTS_API_KEY=xxx
YCLIENTS_USER_TOKEN=xxx
```

### Нужно добавить
```bash
YCLIENTS_APP_ID=xxx  # ID приложения в маркетплейсе
```

### Где получить YCLIENTS_APP_ID
1. Зайти в YClients Developer Portal
2. Раздел "Мои приложения"
3. Скопировать ID приложения

---

## Testing Strategy

### Unit Tests
- `marketplace-client.js` - mock API responses
- `marketplace-service.js` - mock client

### Integration Tests
- MCP tools с реальным API (test salon)
- Webhook обработка с mock requests

### Manual Testing via MCP
```bash
@yclients marketplace_get_salons
@yclients marketplace_get_status salon_id:962302
@yclients marketplace_get_tariffs
```

---

## Blockers & Notes

### Blocker: YCLIENTS_APP_ID
- Нужно получить ID приложения из YClients Developer Portal
- Без него не будут работать методы с `application_id`

### Note: Rate Limiting
- Marketplace API имеет те же лимиты: 200 req/min
- Использовать Bottleneck как в основном клиенте

### Note: Webhook Events
- YClients может добавить новые события в будущем
- Логировать неизвестные события для мониторинга

---

## Session Notes

### Session 1 (2025-11-26)
- Изучена документация YCLIENTS_API.md (раздел Marketplace, строки 32354-33577)
- Проанализированы существующие файлы
- Создан план интеграции
- Решения: все 13 эндпоинтов, минимальная БД, MCP server
