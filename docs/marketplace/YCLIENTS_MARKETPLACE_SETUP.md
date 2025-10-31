# 📝 Инструкция по настройке YClients Marketplace

## 🎯 Что нужно указать в настройках YClients Marketplace

### 1. Callback URL
```
https://46.149.70.219/callback/yclients
```
или после настройки домена:
```
https://ai-admin.app/callback/yclients
```

**Для чего:** Получение webhook событий от YClients (новые записи, отмены, изменения)

### 2. Registration Redirect URL
```
https://46.149.70.219/auth/yclients/redirect
```
или после настройки домена:
```
https://ai-admin.app/auth/yclients/redirect
```

**Для чего:** Куда YClients перенаправит пользователя после нажатия "Подключить"

### 3. Флажки настроек

✅ **Передавать данные пользователя при подключении интеграции**
- ОБЯЗАТЕЛЬНО включить
- Позволит получить данные о пользователе (имя, телефон, email)

✅ **Разрешить добавлять приложение в несколько филиалов**
- РЕКОМЕНДУЕТСЯ включить
- Позволит сетям салонов подключать бота для всех филиалов

❌ **Открывать форму регистрации в iframe**
- НЕ включать (лучше в новом окне/вкладке)
- QR-код WhatsApp лучше показывать на отдельной странице

## 📋 Полный процесс подключения

### Шаг 1: Регистрация в маркетплейсе YClients

1. Зайдите на https://yclients.com/appstore/developers
2. Зарегистрируйтесь как разработчик
3. Создайте новое приложение "AI Admin"
4. Получите:
   - **Partner Token** (API ключ партнера)
   - **Application ID** (ID вашего приложения)

### Шаг 2: Настройка переменных окружения

Добавьте в файл `.env` на сервере:

```bash
# YClients Marketplace
YCLIENTS_PARTNER_TOKEN=ваш_partner_token
YCLIENTS_APP_ID=ваш_application_id

# JWT для безопасности
JWT_SECRET=сгенерируйте_случайную_строку_32_символа

# Домен (когда настроите)
APP_DOMAIN=ai-admin.app
```

### Шаг 3: Применение миграции БД

Выполните SQL миграцию через Supabase UI или psql:

```bash
psql -U postgres -d your_database -f migrations/add_marketplace_fields_to_companies.sql
```

### Шаг 4: Деплой на сервер

```bash
# Копируем файлы на сервер
scp -r src/api/routes/yclients-marketplace.js root@46.149.70.219:/opt/ai-admin/src/api/routes/
scp -r src/api/websocket/marketplace-ws.js root@46.149.70.219:/opt/ai-admin/src/api/websocket/
scp -r public/marketplace/ root@46.149.70.219:/opt/ai-admin/public/

# Подключаемся к серверу
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Обновляем зависимости
cd /opt/ai-admin
npm install jsonwebtoken socket.io qrcode

# Перезапускаем сервисы
pm2 restart ai-admin-api
pm2 logs ai-admin-api --lines 50
```

### Шаг 5: Тестирование

1. Откройте маркетплейс YClients в тестовом салоне
2. Найдите ваше приложение
3. Нажмите "Подключить"
4. Проверьте, что:
   - Произошел редирект на вашу страницу
   - Отображается QR-код WhatsApp
   - После сканирования WhatsApp подключается
   - Callback в YClients отправляется успешно

## 🔧 Технические детали

### Endpoints

| URL | Метод | Описание |
|-----|-------|----------|
| `/auth/yclients/redirect` | GET | Прием пользователя от YClients |
| `/callback/yclients` | POST | Webhook события от YClients |
| `/marketplace/onboarding` | GET | Страница с QR-кодом |
| `/marketplace/api/qr` | POST | API для получения QR |
| `/marketplace/api/status/:sessionId` | GET | Проверка статуса WhatsApp |
| `/marketplace/api/activate` | POST | Активация интеграции |

### WebSocket события

Namespace: `/marketplace`

| Событие | Направление | Описание |
|---------|-------------|----------|
| `qr` | Server → Client | Новый QR-код |
| `status` | Server → Client | Статус подключения |
| `connected` | Server → Client | WhatsApp подключен |
| `error` | Server → Client | Ошибка |
| `request-qr` | Client → Server | Запрос QR |
| `check-status` | Client → Server | Проверка статуса |

### Структура БД

**Таблица `companies`** - новые поля:
- `integration_status` - статус интеграции
- `marketplace_user_*` - данные пользователя из YClients
- `whatsapp_*` - данные WhatsApp подключения
- `api_key` - внутренний ключ для webhook
- `webhook_secret` - секрет для проверки подписи

**Таблица `marketplace_events`** - логирование:
- История всех событий от YClients
- Типы: uninstall, freeze, payment, record_*

**Таблица `marketplace_tokens`** - токены:
- Хранение токенов доступа (если понадобятся)

## 🐛 Возможные проблемы

### "Не открывается страница после редиректа"
- Проверьте доступность сервера из интернета
- Проверьте правильность URL в настройках
- Убедитесь, что порт 443 (HTTPS) или 80 (HTTP) открыт

### "QR-код не отображается"
- Проверьте логи: `pm2 logs ai-admin-api`
- Убедитесь, что Baileys установлен: `npm list @whiskeysockets/baileys`
- Проверьте WebSocket соединение в консоли браузера

### "WhatsApp не подключается"
- Убедитесь, что используете бизнес WhatsApp
- Проверьте, что номер не привязан к другим устройствам
- Попробуйте отключить все устройства и подключить заново

### "Callback в YClients не работает"
- Проверьте YCLIENTS_PARTNER_TOKEN в .env
- Убедитесь, что YCLIENTS_APP_ID правильный
- Смотрите логи ответа от YClients

## 📊 Мониторинг

```bash
# Проверка статуса
pm2 status

# Логи API
pm2 logs ai-admin-api --lines 100

# Логи только ошибок
pm2 logs ai-admin-api --err

# Мониторинг в реальном времени
pm2 monit
```

## 🔒 Безопасность

1. **Всегда используйте HTTPS** в production
2. **Генерируйте сильный JWT_SECRET**:
   ```bash
   openssl rand -base64 32
   ```
3. **Ограничьте CORS** для WebSocket в production
4. **Шифруйте данные сессий** WhatsApp в БД
5. **Регулярно ротируйте** API ключи

## 📞 Поддержка

- Email: support@ai-admin.app
- Telegram: @ai_admin_support
- YClients поддержка: support@yclients.com

---

*Последнее обновление: 02.10.2025*