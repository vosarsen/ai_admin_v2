# Booking Monitor - Руководство

## 📋 Описание

Booking Monitor - это сервис автоматического мониторинга новых записей в YClients и отправки WhatsApp уведомлений клиентам о подтверждении их записи.

## 🎯 Основные функции

1. **Мониторинг новых записей** - проверка новых записей каждую минуту
2. **Автоматические уведомления** - отправка подтверждений через WhatsApp
3. **Защита от дубликатов** - каждая запись обрабатывается только один раз
4. **Фильтрация записей** - обработка только актуальных записей

## 🏗️ Архитектура

### Компоненты
- `src/services/booking-monitor/index.js` - основной сервис
- `src/workers/booking-monitor-worker.js` - PM2 worker
- `booking_notifications` таблица в Supabase - хранение истории уведомлений

### Процесс работы
1. Каждую минуту запрашивает записи на сегодня и завтра из YClients
2. Фильтрует записи по следующим критериям:
   - Не обработанные ранее (проверка по `yclients_record_id` в БД)
   - Записи на будущее время (не прошедшие)
   - Созданные не более 30 минут назад
3. Отправляет WhatsApp уведомление клиенту
4. Сохраняет информацию об отправке в БД

## 🔧 Конфигурация

### Переменные окружения
```bash
# YClients API
YCLIENTS_API_KEY=your_api_key
YCLIENTS_USER_TOKEN=your_user_token
YCLIENTS_COMPANY_ID=962302

# WhatsApp
WHATSAPP_PROVIDER=venom
VENOM_BOT_URL=http://localhost:3001

# База данных
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### PM2 конфигурация (ecosystem.config.js)
```javascript
{
  name: 'ai-admin-booking-monitor',
  script: './src/workers/booking-monitor-worker.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production'
  },
  error_file: './logs/booking-monitor-error.log',
  out_file: './logs/booking-monitor-out.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_memory_restart: '200M',
  kill_timeout: 5000,
  autorestart: true
}
```

## 📊 База данных

### Таблица `booking_notifications`
```sql
CREATE TABLE booking_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yclients_record_id TEXT,  -- ID записи в YClients
  phone TEXT,                -- Телефон клиента
  notification_type TEXT,     -- Тип уведомления (booking_confirmed)
  message TEXT,              -- Текст отправленного сообщения
  whatsapp_message_id TEXT,  -- ID сообщения в WhatsApp
  sent_at TIMESTAMP,         -- Время отправки
  delivered_at TIMESTAMP,    -- Время доставки
  read_at TIMESTAMP,         -- Время прочтения
  error TEXT,                -- Ошибка если была
  company_id INTEGER,        -- ID компании
  created_at TIMESTAMP DEFAULT now()
);

-- Индекс для быстрого поиска по yclients_record_id
CREATE INDEX idx_booking_notifications_yclients_id 
ON booking_notifications(yclients_record_id);
```

## 🚀 Управление

### Запуск
```bash
pm2 start ecosystem.config.js --only ai-admin-booking-monitor
```

### Остановка
```bash
pm2 stop ai-admin-booking-monitor
```

### Перезапуск
```bash
pm2 restart ai-admin-booking-monitor
```

### Просмотр логов
```bash
pm2 logs ai-admin-booking-monitor
```

## 🛡️ Защита от проблем

### Предотвращение дубликатов
1. **Проверка по ID записи** - каждая запись проверяется по `yclients_record_id` в БД
2. **Фильтрация по времени** - не обрабатываются записи старше 30 минут
3. **Пропуск прошедших** - не обрабатываются записи на прошедшее время

### Обработка ошибок
- Все ошибки логируются
- При ошибке отправки уведомление не помечается как отправленное
- Сервис продолжает работу при единичных ошибках

## 📝 Формат уведомления

```
✅ *Ваша запись подтверждена!*

📋 *Детали записи:*
🏢 [Название салона]
📅 [Дата]
🕐 [Время]
💇 [Услуга]
👤 [Мастер]
💰 Стоимость: [Сумма] руб.
📍 [Адрес]

💬 _Ждём вас! Если планы изменятся, пожалуйста, предупредите заранее._

🤖 _Это автоматическое уведомление от AI Ассистента_
```

## ⚠️ Известные ограничения

1. **Только новые записи** - обрабатываются только записи созданные в последние 30 минут
2. **Только будущие записи** - не отправляются уведомления для прошедших записей
3. **Интервал проверки** - фиксированный интервал 1 минута

## 🐛 Устранение неполадок

### Дублирующие уведомления
**Проблема**: Клиенты получают одинаковые уведомления каждую минуту

**Решение**: 
1. Проверить что `yclients_record_id` сохраняется в БД
2. Убедиться что используется правильная проверка типов (toString())
3. Проверить логи на наличие ошибок при сохранении в БД

### Не отправляются уведомления
**Проблема**: Новые записи не получают уведомлений

**Решение**:
1. Проверить что запись создана менее 30 минут назад
2. Проверить что время записи в будущем
3. Проверить подключение к WhatsApp (Venom Bot)
4. Проверить наличие номера телефона у клиента

### Ошибки в логах
```bash
# Просмотр последних ошибок
pm2 logs ai-admin-booking-monitor --err --lines 50

# Проверка статуса
pm2 status ai-admin-booking-monitor
```

## 📈 Мониторинг

### Метрики для отслеживания
- Количество обработанных записей в час
- Количество отправленных уведомлений
- Процент успешных отправок
- Среднее время обработки записи

### SQL запросы для статистики
```sql
-- Количество уведомлений за сегодня
SELECT COUNT(*) 
FROM booking_notifications 
WHERE DATE(created_at) = CURRENT_DATE;

-- Записи без уведомлений
SELECT * 
FROM booking_notifications 
WHERE yclients_record_id IS NULL 
ORDER BY created_at DESC;

-- Статистика по типам уведомлений
SELECT notification_type, COUNT(*) 
FROM booking_notifications 
GROUP BY notification_type;
```

## 🔄 История изменений

### v2.0 (12 августа 2025)
- Полная переработка логики фильтрации
- Исправлена обработка вложенной структуры YClients API
- Добавлена проверка по `yclients_record_id`
- Добавлена фильтрация старых и прошедших записей
- Исправлено несоответствие типов при проверке дубликатов

### v1.0 (25 июля 2025)
- Первая версия booking-monitor
- Базовая функциональность отправки уведомлений