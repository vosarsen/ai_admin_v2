# YClients Marketplace Integration Guide

## Форма регистрации в маркетплейсе YClients

### URLs для заполнения формы:

1. **Webhook URL**
   ```
   http://46.149.70.219:3000/webhook/yclients
   ```
   Получает уведомления от YClients о событиях (новые записи, изменения)

2. **Callback URL**
   ```
   http://46.149.70.219:3000/callback/yclients
   ```
   Используется для OAuth авторизации при подключении интеграции

3. **Registration Redirect URL**
   ```
   http://46.149.70.219:3000/auth/yclients/redirect
   ```
   Куда YClients перенаправит после регистрации пользователя

### Важные замечания:

1. **Используйте HTTP вместо HTTPS** - на сервере пока нет SSL сертификата
2. **Порт 3000** должен быть доступен извне (проверьте firewall)
3. **IP адрес 46.149.70.219** - публичный IP сервера

### Настройки чекбоксов:

- [ ] **Открывать форму регистрации в iframe** - НЕ отмечать (лучше в новом окне)
- [x] **Передавать данные пользователя при подключении интеграции** - ОТМЕТИТЬ
- [x] **Разрешить добавлять приложение в несколько филиалов** - ОТМЕТИТЬ

### Проверка работоспособности:

После создания endpoints можно проверить их доступность:

```bash
# Проверка тестового endpoint
curl http://46.149.70.219:3000/yclients/test

# Должен вернуть:
{
  "status": "ok",
  "endpoints": {
    "webhook": "/webhook/yclients",
    "callback": "/callback/yclients",
    "redirect": "/auth/yclients/redirect"
  },
  "message": "YClients integration endpoints are ready"
}
```

### Следующие шаги после заполнения формы:

1. **Дождитесь одобрения** от YClients (обычно 1-3 дня)
2. **Получите API credentials** (client_id, client_secret)
3. **Реализуйте OAuth flow** для авторизации пользователей
4. **Настройте обработку webhook событий**

### Текущий статус реализации:

- ✅ Webhook endpoint создан (базовая реализация)
- ✅ Callback endpoint создан (базовая реализация)
- ✅ Registration redirect создан (базовая реализация)
- ✅ HTML страницы для успеха/ошибок
- ⏳ OAuth авторизация (требует client_id/secret от YClients)
- ⏳ Обработка событий webhook
- ⏳ Сохранение токенов в БД

### Файлы реализации:

- `/src/api/routes/yclients-integration.js` - основные endpoints
- `/public/integration-success.html` - страница успеха
- `/public/integration-error.html` - страница ошибки
- `/public/setup-instructions.html` - инструкции для пользователя