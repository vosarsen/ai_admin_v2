# Система напоминаний AI Admin v2

**Статус**: ✅ Работает в production
**Последнее обновление**: 23 сентября 2025
**Сервис**: booking-monitor

## 📋 Обзор

Система автоматических напоминаний о записях работает через единый сервис `booking-monitor`, который:
- Отслеживает все записи в YClients
- Отправляет напоминания за день и за 2 часа
- Использует правильные склонения услуг и имён мастеров
- Выбирает из 40 разнообразных шаблонов

## 🏗️ Архитектура

```
YClients API
     ↓
booking-monitor (проверка каждую минуту)
     ↓
Анализ записей на завтра и сегодня
     ↓
Проверка времени и условий
     ├── 19:00-21:00 предыдущего дня → Напоминание за день
     └── За 2 часа до записи → Напоминание за 2 часа
           ↓
     Выбор случайного шаблона
           ↓
     Применение склонений
           ↓
     WhatsApp (Baileys)
           ↓
     booking_notifications (БД)
```

## ⚙️ Конфигурация

### Переменные окружения
```bash
# Включение/выключение напоминаний (часть booking-monitor)
BOOKING_MONITOR_ENABLED=true

# Интервал проверки записей (мс)
BOOKING_MONITOR_INTERVAL=60000  # 1 минута

# WhatsApp сервис
BAILEYS_SERVICE_URL=http://localhost:3003
```

### PM2 процесс
```javascript
{
  name: 'ai-admin-booking-monitor',
  script: './src/workers/booking-monitor-worker.js',
  instances: 1,
  exec_mode: 'fork'
}
```

## 📝 Типы напоминаний

### 1. Напоминание за день (day_before)

**Когда отправляется**:
- Вечером накануне дня записи
- Случайное время между 19:00 и 21:00
- Только если до записи больше 24 часов

**Примеры шаблонов**:
```
Добрый вечер, {name}! Напоминаем о записи на {service} завтра в {time} ✨
Приветствую, {name}! Завтра в {time} ждём вас на {service} 🌟
{name}, здравствуйте! Всё в силе на завтра? {service} в {time} 🤝
```

### 2. Напоминание за 2 часа (reminder_2hours)

**Когда отправляется**:
- Ровно за 2 часа до времени записи
- Только в день записи
- Более формальный тон

**Примеры шаблонов**:
```
Напоминаем: сегодня в {time} у вас запись на {service}.
Здравствуйте, {name}! Через 2 часа {staff} будет ждать Вас на {service}.
Добрый день! Осталось 2 часа до записи на {service} в {time}.
```

## 🔤 Система склонений

### Структура склонений в БД

Каждая услуга и мастер имеют поле `declensions` в формате JSON:

```json
{
  "nominative": "мужская стрижка",        // что?
  "genitive": "мужской стрижки",          // чего?
  "dative": "мужской стрижке",            // чему?
  "accusative": "мужскую стрижку",        // что?
  "instrumental": "мужской стрижкой",     // чем?
  "prepositional": "мужской стрижке",     // о чём?
  "prepositional_na": "мужскую стрижку",  // на что?
  "prepositional_u": "у Сергея"           // у кого? (для мастеров)
}
```

### Применение склонений

Система автоматически выбирает нужный падеж:

| Контекст | Падеж | Пример |
|----------|-------|--------|
| на {service} | prepositional_na | на мужскую стрижку |
| про {service} | accusative | про мужскую стрижку |
| до {service} | genitive | до мужской стрижки |
| у {staff} | prepositional_u | у Сергея |
| Мастер {staff} | nominative | мастер Сергей |

## 💾 База данных

### Таблица booking_notifications

```sql
CREATE TABLE booking_notifications (
  id UUID PRIMARY KEY,
  yclients_record_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  notification_type TEXT NOT NULL,  -- 'reminder_day_before', 'reminder_2hours'
  message TEXT,                      -- Полный текст отправленного сообщения
  sent_at TIMESTAMP NOT NULL,
  company_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Проверка дубликатов

```javascript
// Получаем напоминания за последние 24 часа
const { data: sentReminders } = await supabase
  .from('booking_notifications')
  .select('notification_type, sent_at')
  .eq('yclients_record_id', recordId)
  .in('notification_type', ['reminder_day_before', 'reminder_2hours'])
  .gte('sent_at', yesterday);
```

## 📊 Мониторинг

### Проверка статуса
```bash
# Статус сервиса
pm2 status ai-admin-booking-monitor

# Последние логи
pm2 logs ai-admin-booking-monitor --lines 100

# Только напоминания
pm2 logs ai-admin-booking-monitor | grep reminder
```

### Проверка в БД
```sql
-- Последние отправленные напоминания
SELECT
  notification_type,
  phone,
  sent_at,
  LEFT(message, 100) as message_preview
FROM booking_notifications
WHERE notification_type LIKE 'reminder%'
ORDER BY sent_at DESC
LIMIT 20;

-- Статистика по дням
SELECT
  DATE(sent_at) as date,
  notification_type,
  COUNT(*) as count
FROM booking_notifications
WHERE notification_type LIKE 'reminder%'
GROUP BY DATE(sent_at), notification_type
ORDER BY date DESC;
```

## 🐛 Решение проблем

### Напоминания не отправляются

1. **Проверить статус booking-monitor**:
   ```bash
   pm2 status ai-admin-booking-monitor
   ```

2. **Проверить подключение к WhatsApp**:
   ```bash
   pm2 logs ai-admin-booking-monitor | grep -E "(ECONNREFUSED|Circuit)"
   ```

3. **Проверить конфигурацию Baileys**:
   ```bash
   grep BAILEYS_SERVICE_URL /opt/ai-admin/.env
   ```

4. **Перезапустить сервис**:
   ```bash
   pm2 restart ai-admin-booking-monitor
   ```

### Дубликаты напоминаний

Система предотвращает дубликаты через:
1. Проверку `booking_notifications` за последние 24 часа
2. Уникальные условия времени (вечер для day_before, 2 часа для reminder_2hours)

Если дубликаты появляются:
```sql
-- Найти дубликаты
SELECT
  yclients_record_id,
  notification_type,
  COUNT(*) as count,
  MIN(sent_at) as first_sent,
  MAX(sent_at) as last_sent
FROM booking_notifications
WHERE sent_at > NOW() - INTERVAL '1 day'
GROUP BY yclients_record_id, notification_type
HAVING COUNT(*) > 1;
```

## 📚 Файлы системы

| Файл | Описание |
|------|----------|
| `src/services/booking-monitor/index.js` | Основной сервис мониторинга и отправки |
| `src/services/reminder/templates.js` | 40 шаблонов напоминаний |
| `src/workers/booking-monitor-worker.js` | PM2 воркер |
| `src/integrations/whatsapp/client.js` | Интеграция с Baileys |

## ✅ Преимущества текущей системы

1. **Единый сервис** - всё в одном месте, нет конфликтов
2. **Правильная грамматика** - склонения из БД
3. **Разнообразие** - 40 шаблонов, не надоедает
4. **История** - все напоминания сохраняются
5. **Надёжность** - проверка дубликатов, обработка ошибок
6. **Интеграция** - работает с Baileys из коробки

## 🚫 Что НЕ нужно делать

1. **НЕ запускать** старые reminder-worker или reminder-worker-v2
2. **НЕ создавать** новые системы напоминаний
3. **НЕ использовать** BullMQ очередь для напоминаний
4. **НЕ модифицировать** message-worker для планирования напоминаний

Вся логика напоминаний должна быть только в booking-monitor!

---

📌 **Важно**: Эта документация описывает текущую рабочую систему после консолидации 23.09.2025. Все старые системы напоминаний удалены.