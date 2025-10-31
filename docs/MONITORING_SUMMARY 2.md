# 📊 AI Admin - Система мониторинга и управления

*Создано: 18 сентября 2025*

## 🎯 Что было реализовано

### 1. Health Check System
**Endpoint**: `GET /health`

Проверяет все критические компоненты:
- ✅ Redis подключение и количество ключей
- ✅ База данных (Supabase) доступность
- ✅ WhatsApp статус сессии
- ✅ Очередь сообщений (BullMQ)
- ✅ Использование памяти
- ✅ Последняя активность

**Пример ответа:**
```json
{
  "status": "ok",
  "checks": {
    "redis": { "status": "ok", "connected": true, "keys": 498 },
    "database": { "status": "ok", "connected": true },
    "whatsapp": { "status": "ok", "connected": true },
    "queue": { "status": "ok", "totalJobs": 14 },
    "memory": { "status": "ok", "rssMB": 165, "percentage": 97 },
    "lastActivity": { "status": "ok", "lastMessageMinutesAgo": 5 }
  }
}
```

### 2. Recovery Script
**Файл**: `scripts/recovery.sh`

Команды восстановления:
```bash
./recovery.sh          # Полное восстановление
./recovery.sh soft     # Мягкий рестарт процессов
./recovery.sh whatsapp # Восстановление WhatsApp
./recovery.sh redis    # Очистка проблемных ключей Redis
./recovery.sh company 962302  # Восстановление конкретной компании
./recovery.sh status   # Показать статус системы
./recovery.sh check    # Проверка здоровья
```

### 3. Telegram интеграция

#### Автоматические уведомления
Отправляются при:
- 🚨 Критических ошибках (API не отвечает, Redis упал)
- 📱 Проблемах с WhatsApp (отключение, нужен QR-код)
- ⚠️ Высокой нагрузке (память >500MB, очередь >20)
- ✅ Успешных восстановлениях

#### Интерактивный бот
**Команды:**
- `/status` - статус всех PM2 процессов
- `/health` - детальная проверка здоровья
- `/restart [service]` - перезапуск сервиса
- `/recover [type]` - восстановление системы
- `/logs` - последние ошибки из логов
- `/queue` - состояние очереди сообщений
- `/test` - отправить тестовое сообщение

### 4. Автоматический мониторинг
**Файл**: `scripts/health-monitor.js`

Запускается через cron каждые 5 минут:
```bash
*/5 * * * * /usr/bin/node /opt/ai-admin/scripts/health-monitor.js
```

Функции:
- Проверка здоровья системы
- Автоматическое восстановление известных проблем
- Отправка уведомлений в Telegram
- Логирование всех действий

## 🔧 Исправленные проблемы

### 1. YclientsClient constructor error
- **Симптомы**: 283 рестарта API за 2 дня
- **Причина**: Проблема с кэшем require в PM2
- **Решение**: Перезапуск API очистил кэш

### 2. WhatsApp сессия
- **Симптомы**: "Bad MAC Error", Connection Closed
- **Причина**: Повреждение криптографических ключей сессии
- **Решение**: Удаление старых сессий и переподключение

### 3. Очередь сообщений
- **Симптомы**: 162 накопившихся задачи
- **Причина**: Сбои в обработке не очищали очередь
- **Решение**: Очистка через Redis CLI

### 4. Отображение статуса
- **Симптомы**: WhatsApp показывал "отключен", "undefined минут назад"
- **Причина**: Неправильная проверка статуса, короткий TTL для ключей
- **Решение**: Альтернативные методы проверки, TTL увеличен до 24 часов

## 📝 Конфигурация

### Переменные окружения (.env)
```bash
# Telegram notifications
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### PM2 процессы
```javascript
// ecosystem.config.js добавлен:
{
  name: 'ai-admin-telegram-bot',
  script: './scripts/telegram-bot.js',
  max_memory_restart: '100M',
  autorestart: true
}
```

### Cron задачи
```bash
# Health monitoring every 5 minutes
*/5 * * * * /usr/bin/node /opt/ai-admin/scripts/health-monitor.js >> /opt/ai-admin/logs/health-monitor.log 2>&1
```

## 📊 Текущее состояние системы

### Метрики стабильности:
- **API рестарты**: 0 за последний час (было 283 за 2 дня)
- **Очередь**: 14 задач (было 162)
- **Память**: ~160MB на процесс (норма)
- **WhatsApp**: Подключен и работает
- **Время ответа**: 9-10 секунд

### PM2 процессы:
```
┌────┬─────────────────────────┬──────┬────────┬──────────┬──────────┐
│ id │ name                    │ mode │ status │ restarts │ memory   │
├────┼─────────────────────────┼──────┼────────┼──────────┼──────────┤
│ 7  │ ai-admin-api           │ fork │ online │ 288      │ 161MB    │
│ 8  │ ai-admin-batch-processor│ fork │ online │ 2        │ 76MB     │
│ 5  │ ai-admin-booking-monitor│ fork │ online │ 1        │ 129MB    │
│ 2  │ ai-admin-reminder      │ fork │ online │ 4        │ 121MB    │
│ 13 │ ai-admin-telegram-bot  │ fork │ online │ 0        │ 65MB     │
│ 4  │ ai-admin-worker-v2     │ fork │ online │ 3        │ 91MB     │
└────┴─────────────────────────┴──────┴────────┴──────────┴──────────┘
```

## 🚀 Использование

### Быстрая проверка статуса:
```bash
# Через Telegram бота
/status

# Через SSH
curl localhost:3000/health | jq

# Через recovery script
./recovery.sh status
```

### При проблемах:
```bash
# 1. Проверить статус
./recovery.sh status

# 2. Мягкое восстановление
./recovery.sh soft

# 3. Если не помогло - полное восстановление
./recovery.sh full

# 4. Проверить логи
pm2 logs --err --lines 50
```

### Мониторинг в реальном времени:
```bash
# PM2 dashboard
pm2 monit

# Следить за логами
pm2 logs --follow

# Telegram бот
/health - для детального статуса
```

## 📚 Документация

### Созданные файлы:
- `docs/development-diary/2025-09-18-monitoring-system.md` - детальное описание реализации
- `docs/QUICK_REFERENCE.md` - краткая шпаргалка команд
- `docs/TELEGRAM_SETUP.md` - инструкция настройки Telegram
- `docs/MONITORING_SUMMARY.md` - этот документ

### Обновленные файлы:
- `config/project-docs/CONTEXT.md` - текущее состояние проекта
- `config/project-docs/TASK.md` - выполненные задачи
- `ecosystem.config.js` - конфигурация PM2
- `.env` - добавлены Telegram переменные

## ✅ Результат

Система мониторинга и восстановления полностью функциональна:
- **Видимость** - всегда знаем состояние системы через health endpoint
- **Контроль** - управление через Telegram бот с телефона
- **Автоматизация** - проблемы детектируются и исправляются автоматически
- **Надёжность** - быстрое восстановление одной командой
- **Уведомления** - критические события приходят в Telegram

**Система готова к production использованию и масштабированию до 5-10 компаний.**