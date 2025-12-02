# YClients Marketplace Security Fixes - Context

**Last Updated:** 2025-12-02 12:15 MSK
**Status:** IN PROGRESS - Модерация активна

---

## ТЕКУЩАЯ СИТУАЦИЯ

### Модератор
- **Имя:** Филипп Щигарцов (f.schigartcov@yclients.tech)
- **Тестовый салон:** ID 997441 ("Filipp Schigartsov (test!)")
- **User ID:** 6419632

### Что уже сделано сегодня

1. ✅ **Исправлен парсинг параметров** - `salon_ids[0]` и `user_data` base64
2. ✅ **Добавлена санитизация input** - все данные из user_data валидируются
3. ✅ **Исправлен database rollback** - API key очищается при ошибке
4. ✅ **QR retry с exponential backoff** - 1s → 5s max
5. ✅ **Webhook partner_token enforcement** - обязательная проверка
6. ⚠️ **HMAC верификация ОТКЛЮЧЕНА** - не знаем алгоритм YClients
7. ✅ **Создан collector endpoint** - `/webhook/yclients/collector`

### Текущая проблема

**HMAC подпись не совпадает!**
- YClients отправляет `user_data_sign`
- Мы пробовали `HMAC-SHA256(user_data, PARTNER_TOKEN)` - НЕ СОВПАДАЕТ
- Временно отключили проверку, добавили debug логирование
- **НУЖНО:** Спросить у модератора алгоритм подписи

---

## ENDPOINTS

### Основные (для модератора)

| Endpoint | Назначение |
|----------|------------|
| `POST /webhook/yclients/collector` | **НОВЫЙ!** Универсальный сборщик всех уведомлений |
| `GET /auth/yclients/redirect` | Registration redirect из маркетплейса |
| `POST /webhook/yclients` | Основной webhook (uninstall, freeze, records) |
| `GET /marketplace/onboarding` | Страница с QR-кодом |
| `POST /marketplace/activate` | Активация интеграции |

### Настройки в YClients Marketplace

**ВАЖНО:** Модератор должен указать наши URL:
- **Callback URL:** `https://adminai.tech/webhook/yclients`
- **Registration Redirect URL:** `https://adminai.tech/auth/yclients/redirect`
- **Collector (новый):** `https://adminai.tech/webhook/yclients/collector`

---

## ВОПРОСЫ К МОДЕРАТОРУ

1. **Алгоритм user_data_sign** - какой HMAC? SHA256? Какой ключ?
2. **Тип приложения** - нужно ли менять с "чат-бот" на что-то другое?
3. **Какие webhooks будут приходить?** - record_created, record_updated?

---

## ТЕСТОВЫЕ ДАННЫЕ

### URL от модератора (рабочий)
```
https://adminai.tech/auth/yclients/redirect?salon_id=997441&user_data=eyJpZCI6NjQxOTYzMiwibmFtZSI6ItCo0LjQs9Cw0YDRhtC-0LIg0KTQuNC70LjQv9C_IiwicGhvbmUiOiI3OTAwNjQ2NDI2MyIsImVtYWlsIjoiZi5zaGNoaWdhcnRzb3ZAeWNsaWVudHMudGVjaCIsImlzX2FwcHJvdmVkIjp0cnVlLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy55Y2xpZW50cy5jb20vZ2VuZXJhbC9iL2IwL2IwYTY4OTY0YWZiZTQwMV8yMDI0MDIyNTEzMzAwMy5wbmciLCJzYWxvbl9uYW1lIjoiRmlsaXBwIFNjaGlnYXJ0Y292ICh0ZXN0ISkifQ==&user_data_sign=bff620a90b29b491ca3f232103ae65ba2d0cf79b94932b6b2c61adfcd37d282a
```

### Decoded user_data
```json
{
  "id": 6419632,
  "name": "Шигарцов Филипп",
  "phone": "79006464263",
  "email": "f.schigartcov@yclients.tech",
  "is_approved": true,
  "avatar": "https://assets.yclients.com/...",
  "salon_name": "Filipp Schigartsov (test!)"
}
```

### Полученная подпись
```
user_data_sign: bff620a90b29b491ca3f232103ae65ba2d0cf79b94932b6b2c61adfcd37d282a
```

---

## КОММИТЫ СЕГОДНЯ

1. `fix(marketplace): parse salon_ids[] array and user_data from YClients redirect`
2. `fix(marketplace): critical security fixes for YClients moderation`
3. `fix(marketplace): temporarily disable HMAC verification for moderation`
4. `feat(marketplace): add universal webhook collector endpoint`

---

## КОД ФАЙЛЫ

| Файл | Что там |
|------|---------|
| `src/api/routes/yclients-marketplace.js` | Все endpoints (~1350 строк) |
| `src/utils/validators.js` | sanitizeString, validateEmail, normalizePhone |
| `src/repositories/MarketplaceEventsRepository.js` | Логирование событий |
| `src/repositories/CompanyRepository.js` | Работа с companies |

---

## СЛЕДУЮЩИЕ ШАГИ

1. [ ] Получить от модератора алгоритм HMAC подписи
2. [ ] Включить проверку подписи после уточнения
3. [ ] Протестировать полный flow регистрации
4. [ ] Протестировать webhooks через collector
5. [ ] Пройти модерацию

---

## DEBUG КОМАНДЫ

```bash
# Проверить логи регистрации
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-api --lines 50 --nostream | grep -E 'HMAC|signature|redirect|salon'"

# Проверить события в collector
curl -H "X-API-Key: $ADMIN_API_KEY" https://adminai.tech/webhook/yclients/collector/events?limit=10

# Health check
curl https://adminai.tech/marketplace/health
```
