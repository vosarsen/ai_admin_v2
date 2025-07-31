# Настройка Webhook в YClients - Подробная инструкция

## ⚠️ Важное предупреждение

YClients **НЕ имеет стандартной поддержки webhooks** в обычном интерфейсе. Webhooks доступны только через:
1. YClients Marketplace (для приложений)
2. Партнерскую программу
3. Enterprise API

## 📋 Варианты настройки

### Вариант 1: YClients Marketplace (Рекомендуется)

#### Шаг 1: Регистрация приложения

1. Перейдите на [developers.yclients.com](https://developers.yclients.com/)
2. Зарегистрируйтесь как разработчик
3. Создайте новое приложение:
   - **Название**: AI Admin WhatsApp Notifications
   - **Категория**: Интеграции / Мессенджеры
   - **Описание**: Автоматические WhatsApp уведомления о записях

#### Шаг 2: Получение credentials

После одобрения приложения вы получите:
- `application_id` - ID вашего приложения
- `app_secret` - Секретный ключ

#### Шаг 3: Настройка webhook через API

```bash
# Получаем токен авторизации
curl -X POST https://api.yclients.com/api/v1/auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your_api_key}" \
  -d '{
    "login": "your_login",
    "password": "your_password"
  }'

# Настраиваем webhook
curl -X POST https://api.yclients.com/api/v1/company/{company_id}/settings/webhook \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": "{your_application_id}",
    "webhook_urls": ["https://your-domain.com/webhook/yclients"],
    "events": [
      "record.created",
      "record.updated", 
      "record.deleted"
    ]
  }'
```

### Вариант 2: Через партнерский аккаунт

1. Станьте партнером YClients
2. В партнерском кабинете перейдите в "API и интеграции"
3. Создайте webhook подписку
4. Укажите URL: `https://your-domain.com/webhook/yclients`

### Вариант 3: Альтернатива - Polling (Если webhooks недоступны)

Используйте существующий Booking Monitor:

```javascript
// В ecosystem.config.js уже настроен процесс
{
  name: 'ai-admin-booking-monitor',
  script: 'src/workers/booking-monitor-worker.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    BOOKING_MONITOR_ENABLED: true,
    BOOKING_MONITOR_INTERVAL: 60000, // 1 минута
    BOOKING_NOTIFICATION_DELAY: 30000 // 30 секунд
  }
}
```

## 🔧 Настройка на стороне AI Admin

### 1. Переменные окружения

Добавьте в `.env`:

```bash
# YClients Webhook
YCLIENTS_WEBHOOK_SECRET=your_webhook_secret_if_provided
YCLIENTS_APPLICATION_ID=your_application_id

# Для проверки подписи (если YClients отправляет)
WEBHOOK_SIGNATURE_HEADER=X-YClients-Signature
```

### 2. Nginx конфигурация

Убедитесь, что webhook endpoint доступен:

```nginx
location /webhook/yclients {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Важно для webhook
    proxy_read_timeout 30s;
    proxy_connect_timeout 30s;
}
```

### 3. SSL сертификат

YClients требует HTTPS. Настройте SSL:

```bash
# Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

## 📊 Формат webhook событий от YClients

### record.created (Новая запись)
```json
{
  "event": "record.created",
  "data": {
    "id": 123456,
    "company_id": 962302,
    "staff_id": 1,
    "services": [
      {
        "id": 45,
        "title": "Мужская стрижка",
        "cost": 1500,
        "cost_per_unit": 1500,
        "discount": 0,
        "first_cost": 1500,
        "amount": 1
      }
    ],
    "client": {
      "id": 789,
      "name": "Иван Иванов",
      "phone": "+79001234567",
      "email": "ivan@example.com"
    },
    "datetime": "2025-07-15 14:00:00",
    "seance_length": 3600,
    "sum": 1500,
    "comment": "Создано администратором",
    "attendance": 0,
    "confirmed": 1,
    "staff": {
      "id": 1,
      "name": "Александр"
    }
  },
  "created_at": "2025-07-31T10:30:00+03:00"
}
```

### record.updated (Изменение записи)
```json
{
  "event": "record.updated",
  "data": {
    "id": 123456,
    "changes": {
      "datetime": {
        "old": "2025-07-15 14:00:00",
        "new": "2025-07-16 15:00:00"
      },
      "staff_id": {
        "old": 1,
        "new": 2
      }
    },
    // ... остальные поля как в record.created
  }
}
```

### record.deleted (Отмена записи)
```json
{
  "event": "record.deleted",
  "data": {
    "id": 123456,
    "deleted_by": "admin",
    "reason": "Client cancelled"
    // ... минимальный набор данных
  }
}
```

## 🧪 Тестирование webhook

### 1. Проверка доступности endpoint

```bash
# Должен вернуть {"status":"ok"}
curl https://your-domain.com/yclients/test
```

### 2. Эмуляция webhook события

```bash
curl -X POST https://your-domain.com/webhook/yclients/test \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "79001234567",
    "eventType": "record.created",
    "service": "Стрижка",
    "master": "Александр"
  }'
```

### 3. Проверка в логах

```bash
# На сервере
pm2 logs ai-admin-api | grep webhook

# Или через SSH
ssh root@your-server "pm2 logs ai-admin-api --lines 100 | grep webhook"
```

## ❓ Частые вопросы

### Q: Как узнать, поддерживает ли мой аккаунт webhooks?
A: Проверьте в YClients API документации или обратитесь в поддержку. Обычно требуется:
- Партнерский статус
- Или зарегистрированное приложение
- Или Enterprise тариф

### Q: Что делать если webhooks недоступны?
A: Используйте Booking Monitor (polling). Он уже реализован и работает, просто менее эффективен.

### Q: Как проверить что webhook работает?
A: 
1. Создайте тестовую запись в YClients
2. Проверьте таблицу `webhook_events` в БД
3. Проверьте логи сервера
4. Убедитесь что клиент получил WhatsApp

### Q: Webhook приходят, но уведомления не отправляются
A: Проверьте:
1. Статус WhatsApp бота: `pm2 status venom-bot`
2. Есть ли телефон в данных webhook
3. Логи на ошибки: `pm2 logs ai-admin-api --err`

## 📚 Полезные ссылки

- [YClients API документация](https://developers.yclients.com/)
- [Статус API YClients](https://status.yclients.com/)
- [Форум разработчиков](https://developers.yclients.com/forum)

## 💡 Рекомендации

1. **Начните с polling** - это работает сразу без дополнительных настроек
2. **Параллельно** оформите заявку на webhook доступ
3. **Мониторьте** статистику через представления в БД
4. **Логируйте** все события для отладки