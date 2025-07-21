# AI Admin v2 - Краткий справочник

## 🚀 Быстрый старт разработки

```bash
# 1. Получить статус проекта
./start-work.sh

# 2. Запустить Redis туннель (обязательно для MCP)
./scripts/maintain-redis-tunnel.sh start

# 3. Отправить тестовое сообщение
node test-webhook.js "текст сообщения"

# 4. Проверить логи на сервере
ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 50"
```

## 📋 Основные команды

### Синхронизация и деплой
```bash
# Синхронизировать расписание мастеров
node scripts/sync-staff-schedules.js

# Отправить изменения на сервер
git add -A && git commit -m "описание" && git push
ssh ai-admin-server "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"
```

### Тестирование через MCP
```bash
# В Claude Code используйте команды:
@whatsapp send_message phone:79001234567 message:"текст"
@redis clear_context phone:79001234567
@logs logs_tail lines:50
```

## 🔧 Конфигурация

### Переменные окружения
- `YCLIENTS_COMPANY_ID` - ID компании в YClients (962302)
- `REDIS_URL` - подключение к Redis
- `SUPABASE_URL` и `SUPABASE_KEY` - база данных
- `DEEPSEEK_API_KEY` - AI провайдер

### Важные пути
- Локальный проект: `/Users/vosarsen/Documents/GitHub/ai_admin_v2`
- Сервер: `root@46.149.70.219:/opt/ai-admin`
- SSH ключ: `~/.ssh/id_ed25519_ai_admin`

## 📊 Мониторинг

### Проверка здоровья системы
```bash
# Health check API
curl http://46.149.70.219:3000/health | jq .

# Статус синхронизации
curl http://46.149.70.219:3000/api/sync/status | jq .

# PM2 статус
ssh ai-admin-server "pm2 status"
```

### Логи и отладка
```bash
# Живые логи
ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 100"

# Поиск в логах
ssh ai-admin-server "grep 'pattern' /root/.pm2/logs/ai-admin-worker-v2-out.log"

# Ошибки за последние 30 минут
node scripts/check-errors.js --minutes 30
```

## 🎯 Частые задачи

### 1. Добавить новую команду AI
1. Обновить prompt в `src/services/ai-admin-v2/index.js`
2. Добавить regex в `extractCommands()`
3. Реализовать обработчик в `executeCommands()`

### 2. Изменить расписание синхронизации
Отредактировать `src/sync/sync-manager.js`:
```javascript
// Найти строку
if (minute === 0 || minute === 30) {
// Изменить на нужный интервал
```

### 3. Настроить фильтрацию слотов
Отредактировать `src/services/ai-admin-v2/modules/formatter.js`:
```javascript
const minGap = 1.0; // Изменить минимальный промежуток
const maxCount = 3; // Изменить количество слотов на период
```

## 🐛 Решение проблем

### Redis туннель не работает
```bash
# Проверить статус
./scripts/maintain-redis-tunnel.sh status

# Перезапустить
./scripts/maintain-redis-tunnel.sh stop
./scripts/maintain-redis-tunnel.sh start
```

### Бот не отвечает
1. Проверить логи: `ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 100"`
2. Проверить Venom-bot: `ssh ai-admin-server "pm2 logs venom-bot"`
3. Перезапустить: `ssh ai-admin-server "pm2 restart all"`

### Устаревшие данные расписания
```bash
# Ручная синхронизация
curl -X POST http://46.149.70.219:3000/api/sync/schedules \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## 📝 Чек-лист перед коммитом

- [ ] Код протестирован локально
- [ ] Логи не содержат конфиденциальной информации
- [ ] README/документация обновлены при необходимости
- [ ] Нет хардкода (все через конфигурацию)
- [ ] Добавлены необходимые проверки ошибок

## 🔗 Полезные ссылки

- [Полная документация](../README.md)
- [История изменений](../updates/)
- [Troubleshooting](../TROUBLESHOOTING.md)
- [YClients API](../../YCLIENTS_API.md)

---

*Последнее обновление: 21 июля 2024*