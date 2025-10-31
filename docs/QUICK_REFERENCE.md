# 🚀 AI Admin - Краткая шпаргалка

## 📊 Мониторинг

### Быстрая проверка статуса
```bash
# Локально
curl localhost:3000/health | jq

# С другого компьютера
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "./recovery.sh status"
```

### Проверка конкретной компании
```bash
curl localhost:3000/health/company/962302
```

## 🔧 Восстановление

### При проблемах с WhatsApp
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "./recovery.sh whatsapp"
# Затем проверьте QR-код в логах если нужна авторизация
```

### При высокой нагрузке или зависании
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "./recovery.sh soft"
```

### При серьёзных проблемах
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "./recovery.sh full"
```

### Восстановление конкретной компании
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "./recovery.sh company 962302"
```

## 📱 Отправка тестового сообщения

```bash
# Через MCP в Claude Code
@whatsapp send_message phone:79686484488 message:"Тест"

# Или через скрипт
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node test-direct-webhook.js"
```

## 📝 Просмотр логов

### Последние ошибки
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50"
```

### Логи конкретного сервиса
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 100"
```

### Поиск в логах
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "grep -r 'ERROR' /opt/ai-admin/logs/*.log | tail -20"
```

## 🚀 Деплой изменений

```bash
# 1. Коммит локально
git add -A && git commit -m "fix: описание изменений"

# 2. Отправка на GitHub
git push origin feature/redis-context-cache

# 3. Обновление на сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart all"

# 4. Проверка
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
```

## 🆕 Подключение новой компании

### 1. Добавить в базу данных
- Зайти в Supabase
- Добавить запись в таблицу `companies`

### 2. Синхронизировать данные из YClients
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/manual-sync.js"
```

### 3. Проверить статус
```bash
curl localhost:3000/health/company/NEW_COMPANY_ID
```

### 4. Настроить WhatsApp
- Потребуется QR-код авторизации
- Смотреть логи: `pm2 logs ai-admin-api`

## 🔔 Telegram уведомления

### Что приходит автоматически:
- 🚨 Критические ошибки (API не отвечает, Redis упал)
- 📱 Проблемы с WhatsApp (отключение, нужен QR-код)
- ⚠️ Предупреждения (память >500MB, очередь >10)
- ✅ Успешные восстановления

### Ручная отправка
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 'cd /opt/ai-admin && node -e "
const n = require(\"./src/services/telegram-notifier\");
n.send(\"Ваше сообщение\").then(() => process.exit(0));
"'
```

## ⚡ Экстренные команды

### Полный рестарт системы
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 restart all"
```

### Очистка Redis (осторожно!)
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "redis-cli --no-auth-warning -a '70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg=' flushdb"
```

### Проверка дискового пространства
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "df -h"
```

### Проверка процессов
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "htop"
```

## 📈 Метрики для отслеживания

### Здоровые показатели:
- Память: < 300MB на процесс
- Очередь: < 5 сообщений
- Время ответа AI: < 10 секунд
- Рестарты: < 5 за день

### Когда беспокоиться:
- Память: > 500MB
- Очередь: > 20 сообщений
- Время ответа: > 30 секунд
- Рестарты: > 10 за час

## 🆘 Контакты для экстренных случаев

1. Проверить Telegram - должны прийти уведомления
2. Запустить: `./recovery.sh full`
3. Проверить статус: `./recovery.sh status`
4. Если не помогло - смотреть логи ошибок

---

**Помните**: Система настроена на автоматическое восстановление от большинства проблем.
Telegram уведомления придут, если что-то требует вашего внимания.