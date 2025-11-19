# Venom Bot Setup и Конфигурация

## Обзор

Venom Bot - это WhatsApp интеграция для AI Admin v2, которая обеспечивает прием и отправку сообщений через WhatsApp Web API.

## Расположение и структура

- **Основная папка**: `/opt/venom-bot/`
- **Главный файл**: `/opt/venom-bot/index.js`
- **Логи**: `/opt/venom-bot/logs/`
- **Токены сессии**: `/opt/venom-bot/tokens/`

## PM2 конфигурация

Venom Bot интегрирован в `ecosystem.config.js` и управляется через PM2:

```javascript
{
  name: 'venom-bot',
  script: '/opt/venom-bot/index.js',
  instances: 1,
  exec_mode: 'fork',
  cwd: '/opt/venom-bot',
  env: {
    NODE_ENV: 'production',
    PORT: 3001
  },
  error_file: '/opt/venom-bot/logs/error.log',
  out_file: '/opt/venom-bot/logs/out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_memory_restart: '500M',
  autorestart: true,
  watch: false
}
```

## Управление через PM2

### Основные команды

```bash
# Проверить статус
pm2 status

# Посмотреть логи
pm2 logs venom-bot

# Перезапустить
pm2 restart venom-bot

# Остановить
pm2 stop venom-bot

# Запустить
pm2 start venom-bot

# Удалить из PM2
pm2 delete venom-bot

# Сохранить конфигурацию
pm2 save
```

### Запуск с ecosystem.config.js

```bash
# Запустить только Venom Bot
cd /opt/ai-admin
pm2 start ecosystem.config.js --only venom-bot

# Запустить все сервисы
pm2 start ecosystem.config.js
```

## Архитектура взаимодействия

```
WhatsApp User
    ↓
Venom Bot (port 3001)
    ↓
Webhook с подписью → AI Admin API (port 3000)
    ↓
Message Queue (BullMQ)
    ↓
Worker v2 → AI Admin v2
    ↓
WhatsApp Client → Venom Bot
    ↓
WhatsApp User
```

## Конфигурация в AI Admin

В `.env` файле:
```
VENOM_SERVER_URL=http://localhost:3001
VENOM_API_KEY=sk_venom_webhook_3553
VENOM_SECRET_KEY=sk_venom_webhook_3553
```

В `src/config/index.js`:
```javascript
whatsapp: {
  venomServerUrl: process.env.VENOM_SERVER_URL || 'http://localhost:3001',
  apiKey: getConfig('VENOM_API_KEY'),
  secretKey: getConfig('VENOM_SECRET_KEY'),
  // ...
}
```

## API endpoints Venom Bot

- `GET /health` - проверка статуса
- `GET /status` - статус подключения к WhatsApp
- `POST /send-message` - отправка сообщения

## Устранение неполадок

### Venom Bot не запускается

1. Проверьте логи:
```bash
pm2 logs venom-bot --lines 100
```

2. Проверьте порт 3001:
```bash
ss -tlnp | grep 3001
```

3. Проверьте токены сессии:
```bash
ls -la /opt/venom-bot/tokens/ai-admin-session/
```

### Сообщения не отправляются

1. Проверьте статус подключения:
```bash
curl http://localhost:3001/status
```

2. Проверьте логи воркера на ошибки ECONNREFUSED:
```bash
pm2 logs ai-admin-worker-v2 | grep ECONNREFUSED
```

### Переподключение к WhatsApp

Если сессия потеряна, может потребоваться повторное сканирование QR-кода:

1. Остановите Venom Bot:
```bash
pm2 stop venom-bot
```

2. Удалите старую сессию:
```bash
rm -rf /opt/venom-bot/tokens/ai-admin-session
```

3. Запустите заново:
```bash
pm2 start venom-bot
```

4. Посмотрите QR-код в логах:
```bash
pm2 logs venom-bot
```

## Безопасность

- Webhook использует HMAC-SHA256 подпись для аутентификации
- Секретный ключ хранится в переменных окружения
- Venom Bot слушает только на localhost (не доступен извне)

## Мониторинг

Venom Bot автоматически перезапускается при:
- Падении процесса (autorestart: true)
- Превышении лимита памяти (500MB)
- Перезагрузке сервера (если настроен pm2 startup)

Для настройки автозапуска при перезагрузке:
```bash
pm2 startup
pm2 save
```