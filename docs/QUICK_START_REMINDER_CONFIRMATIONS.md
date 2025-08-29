# 🚀 Quick Start: Система подтверждений напоминаний

## За 2 минуты

### Что это?
Система автоматически обрабатывает ответы клиентов на напоминания о записи, отправляет реакцию ❤️ и обновляет статус в YClients.

### Что решает?
❌ **Было**: Клиент отвечает "ок" → Бот спрашивает "Чем могу помочь?" → Клиент раздражен  
✅ **Стало**: Клиент отвечает "ок" → Бот ставит ❤️ → Статус обновлен → Все довольны

### Как работает?
1. Booking Monitor отправляет напоминание
2. Сохраняется контекст в Redis на 24 часа
3. Клиент отвечает (в течение 30 минут)
4. Система распознает подтверждение
5. Отправляется реакция ❤️
6. Статус меняется на "подтвержден" в YClients
7. AI не вызывается вообще

## Распознаваемые паттерны

### ✅ Будут обработаны как подтверждения:
```
ок, ok, да, yes
буду, приду, придем
хорошо, конечно, обязательно
подтверждаю, согласен, договорились
спасибо, благодарю
👍, 👌, ✅, 💯, +, ++
```

### ❌ НЕ будут обработаны (пойдут в AI):
```
хочу записаться
можно перенести?
отменить запись
какие услуги есть?
сколько стоит?
```

## Быстрая проверка

### 1. Проверить работу системы
```bash
# На сервере
cd /opt/ai-admin
./test-reminder-on-server.sh
```

### 2. Посмотреть логи
```bash
# Логи обработки подтверждений
pm2 logs ai-admin-worker-v2 | grep -E "reminder|confirmation|❤️"

# Проверить контекст в Redis
redis-cli get "reminder_context:79001234567"
```

### 3. Мониторинг
```bash
# Сколько подтверждений обработано
pm2 logs ai-admin-worker-v2 | grep "Detected reminder confirmation" | wc -l

# Сколько статусов обновлено
pm2 logs ai-admin-worker-v2 | grep "Updated booking .* status to confirmed" | wc -l
```

## Конфигурация

### Основные параметры
```javascript
// src/services/reminder/reminder-context-tracker.js
this.ttl = 24 * 60 * 60;           // Хранение контекста: 24 часа
this.confirmationWindow = 30;       // Окно для ответа: 30 минут  
this.staleThreshold = 12;          // Устаревание: 12 часов
```

### Добавить новые паттерны
```javascript
// src/services/reminder/reminder-context-tracker.js
const confirmationPatterns = [
  'ок', 'ok', 'да', 'yes',
  // Добавьте свои паттерны здесь
];
```

## Статистика эффективности

### Что измерять:
- **Conversion Rate**: % подтвержденных от отправленных напоминаний
- **Response Time**: Среднее время ответа клиента
- **AI Savings**: Количество сэкономленных AI вызовов
- **Status Updates**: Количество автоматических обновлений статуса

### SQL запросы для аналитики:
```sql
-- Процент подтверждений за последние 7 дней
SELECT 
  COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as confirmation_rate
FROM booking_notifications
WHERE created_at > NOW() - INTERVAL '7 days'
  AND notification_type IN ('reminder_day_before', 'reminder_2hours');

-- Среднее время ответа
SELECT 
  AVG(EXTRACT(EPOCH FROM (confirmed_at - sent_at))/60) as avg_response_minutes
FROM booking_notifications
WHERE confirmed_at IS NOT NULL;
```

## Troubleshooting за 30 секунд

### Подтверждения не работают?

1. **Проверить Redis**
```bash
redis-cli ping
# Должен ответить PONG
```

2. **Проверить контекст**
```bash
redis-cli keys "reminder_context:*"
# Должны быть ключи для активных напоминаний
```

3. **Проверить логи**
```bash
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i error
```

4. **Перезапустить если нужно**
```bash
pm2 restart ai-admin-worker-v2
pm2 restart ai-admin-booking-monitor
```

## Полезные команды

```bash
# Очистить контекст для номера (для тестов)
redis-cli del "reminder_context:79001234567"

# Посмотреть все активные контексты
redis-cli keys "reminder_context:*" | xargs -I {} redis-cli get {}

# Проверить последние подтверждения
pm2 logs ai-admin-worker-v2 | grep "Detected reminder confirmation" | tail -10

# Статус обновлений в YClients
pm2 logs ai-admin-worker-v2 | grep "Updated booking" | tail -10
```

## FAQ

**Q: Можно отключить для определенных клиентов?**  
A: Пока нет, но можно добавить проверку по номеру телефона в `shouldHandleAsReminderResponse()`

**Q: Как изменить реакцию с ❤️ на другую?**  
A: В `src/workers/message-worker-v2.js` строка 111: `await whatsappClient.sendReaction(from, '👍');`

**Q: Можно отправлять текст вместо реакции?**  
A: Да, замените `sendReaction` на `sendMessage` с нужным текстом

**Q: Как долго хранится контекст?**  
A: 24 часа, настраивается в `reminder-context-tracker.js`

## Контакты

При проблемах:
1. Проверьте этот документ
2. Посмотрите полную документацию: `docs/features/REMINDER_CONFIRMATION_SYSTEM.md`
3. Проверьте логи через PM2
4. Запустите тесты для диагностики