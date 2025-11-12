# Руководство по настройке системы напоминаний

## Быстрый старт

### 1. Проверка готовности системы

```bash
# Проверить Redis
redis-cli ping

# Проверить PM2
pm2 status

# Проверить WhatsApp
curl http://localhost:3001/status
```

### 2. Запуск reminder worker

```bash
# Запустить через PM2 (рекомендуется)
pm2 start ecosystem.config.js --only ai-admin-reminder

# Или запустить напрямую
node src/workers/index-reminder.js
```

### 3. Проверка работы

```bash
# Посмотреть логи
pm2 logs ai-admin-reminder

# Запустить тест
node test-reminder.js
```

## Пошаговая настройка

### Шаг 1: Установка зависимостей

```bash
cd /opt/ai-admin
npm install
```

### Шаг 2: Настройка Redis

Убедитесь, что Redis запущен:
```bash
systemctl status redis
# Если не запущен:
systemctl start redis
systemctl enable redis
```

### Шаг 3: Проверка конфигурации

Проверьте файл `.env`:
```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Queue settings
QUEUE_REMINDER_NAME=reminders
QUEUE_RETRY_ATTEMPTS=3
QUEUE_RETRY_DELAY=2000
```

### Шаг 4: Добавление в PM2

Если reminder worker не добавлен в PM2:
```bash
pm2 start src/workers/index-reminder.js --name ai-admin-reminder
pm2 save
pm2 startup
```

### Шаг 5: Планирование для существующих записей

Если у вас уже есть записи в системе:
```bash
node scripts/schedule-existing-reminders.js
```

## Настройка времени напоминаний

### Изменение времени напоминания за день

Отредактируйте `src/workers/message-worker-v2.js`:

```javascript
// Текущая настройка: 19:00-21:00
const randomHour = 19 + Math.floor(Math.random() * 2);

// Изменить на 18:00-22:00:
const randomHour = 18 + Math.floor(Math.random() * 4);

// Фиксированное время 20:00:
const randomHour = 20;
const randomMinute = 0;
```

### Изменение времени напоминания за N часов

```javascript
// Текущая настройка: за 2 часа
const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);

// Изменить на 3 часа:
const threeHoursBefore = new Date(bookingTime.getTime() - 3 * 60 * 60 * 1000);
```

## Настройка текста сообщений

### Изменение шаблонов

Отредактируйте `src/workers/reminder-worker.js`:

```javascript
_generateDayBeforeReminder(booking) {
  // Ваш текст
  return `Здравствуйте! 

Завтра вас ждут:
🏢 ${booking.company_name || 'Наш салон'}
📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName}
👤 ${staffName}

📍 Адрес: ${booking.address || 'уточните у администратора'}

Ждём вас!`;
}
```

### Добавление персонализации

```javascript
// Добавить имя клиента
const clientName = booking.client_name || 'Уважаемый клиент';
return `${clientName}, добрый вечер! 🌙\n\n...`;
```

## Мониторинг и отладка

### Команды для мониторинга

```bash
# Статус всех процессов
pm2 status

# Детальный мониторинг
pm2 monit

# Логи в реальном времени
pm2 logs ai-admin-reminder --lines 100

# Поиск ошибок
pm2 logs ai-admin-reminder | grep -i error

# Статистика очереди
redis-cli
> INFO keyspace
> KEYS bull:reminders:*
```

### Проверка отправленных напоминаний

```sql
-- В Supabase SQL Editor
SELECT 
  user_id,
  record_id,
  appointment_datetime,
  day_before_sent,
  day_before_sent_at,
  hour_before_sent,
  hour_before_sent_at
FROM bookings
WHERE appointment_datetime > NOW()
ORDER BY appointment_datetime;
```

## Решение проблем

### Напоминания не отправляются

1. **Проверьте reminder worker:**
   ```bash
   pm2 status ai-admin-reminder
   # Должен быть в статусе "online"
   ```

2. **Проверьте Redis:**
   ```bash
   redis-cli ping
   # Должен вернуть PONG
   ```

3. **Проверьте логи на ошибки:**
   ```bash
   pm2 logs ai-admin-reminder --err
   ```

### Дублирование напоминаний

1. Проверьте флаги в БД:
   ```sql
   SELECT * FROM bookings 
   WHERE record_id = 'ID_ЗАПИСИ';
   ```

2. Очистите очередь если нужно:
   ```bash
   redis-cli
   > FLUSHDB  # Осторожно! Удалит все данные
   ```

### Напоминания приходят в неправильное время

1. Проверьте часовой пояс сервера:
   ```bash
   date
   timedatectl
   ```

2. Установите правильный часовой пояс:
   ```bash
   timedatectl set-timezone Europe/Moscow
   ```

## Тестирование

### Тест с коротким интервалом

Создайте файл `test-reminder-quick.js`:
```javascript
// Напоминание через 30 секунд
const testTime = new Date(Date.now() + 30 * 1000);
await messageQueue.addReminder({
  type: 'day_before',
  booking: testBooking,
  phone: testPhone
}, testTime);
```

### Тест с реальными данными

```javascript
// Используйте реальный номер записи
const booking = {
  record_id: '1203614616',
  datetime: '2025-07-25 15:00:00',
  service_name: 'Мужская стрижка',
  staff_name: 'Сергей'
};
```

## Отключение напоминаний

### Временное отключение

```bash
# Остановить worker
pm2 stop ai-admin-reminder
```

### Отключение для конкретного клиента

Добавьте проверку в `scheduleReminders()`:
```javascript
// Список телефонов без напоминаний
const blacklist = ['79001234567'];
if (blacklist.includes(phone.replace('@c.us', ''))) {
  logger.info('Reminders disabled for this phone');
  return;
}
```

## Обновление системы

При обновлении кода:
```bash
# Обновить код
git pull

# Перезапустить worker
pm2 restart ai-admin-reminder

# Проверить логи
pm2 logs ai-admin-reminder --lines 50
```

## Бэкап и восстановление

### Бэкап задач из очереди

```bash
# Экспорт данных Redis
redis-cli --rdb /backup/redis-reminders.rdb
```

### Восстановление

```bash
# Остановить Redis
systemctl stop redis

# Восстановить данные
cp /backup/redis-reminders.rdb /var/lib/redis/dump.rdb

# Запустить Redis
systemctl start redis
```