# 📱 Система обработки подтверждений напоминаний

## 📋 Оглавление
- [Обзор](#обзор)
- [Архитектура](#архитектура)
- [Компоненты системы](#компоненты-системы)
- [API Reference](#api-reference)
- [Настройка и конфигурация](#настройка-и-конфигурация)
- [Использование](#использование)
- [Тестирование](#тестирование)
- [Troubleshooting](#troubleshooting)

## 🎯 Обзор

### Проблема
После отправки напоминаний о предстоящих записях клиенты часто отвечают простыми подтверждениями ("ок", "спасибо", "буду"). Ранее система AI Admin не понимала контекст этих ответов и начинала новый диалог с вопросом "Чем могу помочь?", что раздражало клиентов.

### Решение
Система автоматически:
1. **Распознает** ответы на напоминания как подтверждения
2. **Отправляет** визуальное подтверждение (реакция ❤️)
3. **Обновляет** статус записи в YClients на "подтвержден" (attendance=2)
4. **НЕ запускает** AI обработку для таких сообщений

### Преимущества
- ✅ Улучшенный пользовательский опыт
- ✅ Автоматизация обновления статусов
- ✅ Экономия ресурсов AI
- ✅ Снижение нагрузки на систему

## 🏗️ Архитектура

```mermaid
graph TD
    A[Booking Monitor] -->|Отправляет напоминание| B[WhatsApp Client]
    A -->|Сохраняет контекст| C[Redis: reminder_context]
    
    D[Клиент] -->|Отвечает ок/спасибо| E[Webhook]
    E --> F[Message Worker v2]
    
    F -->|Проверяет| G[ReminderContextTracker]
    G -->|Читает контекст| C
    
    G -->|Если подтверждение| H[Обработчик подтверждений]
    H -->|1. Реакция ❤️| B
    H -->|2. Обновить статус| I[YClients API]
    H -->|3. Очистить контекст| C
    
    G -->|Если НЕ подтверждение| J[AI Admin v2]
```

## 📦 Компоненты системы

### 1. ReminderContextTracker
**Путь**: `src/services/reminder/reminder-context-tracker.js`

Основной модуль для управления контекстом напоминаний.

#### Ключевые методы:
- `saveReminderContext(phone, bookingData, reminderType)` - сохранение контекста
- `getReminderContext(phone)` - получение контекста
- `shouldHandleAsReminderResponse(phone, message)` - проверка, является ли сообщение ответом
- `markAsConfirmed(phone)` - пометка как подтвержденное
- `isConfirmationMessage(message)` - проверка паттернов подтверждения

### 2. Интеграция в Booking Monitor
**Путь**: `src/services/booking-monitor/index.js`

При отправке напоминания:
```javascript
await reminderContextTracker.saveReminderContext(phone, {
  record_id: record.id,
  datetime: record.datetime,
  service_name: services,
  staff_name: staff
}, reminderType);
```

### 3. Обработка в Message Worker
**Путь**: `src/workers/message-worker-v2.js`

Перехват подтверждений до AI:
```javascript
if (await reminderContextTracker.shouldHandleAsReminderResponse(from, message)) {
  // Отправить реакцию
  await whatsappClient.sendReaction(from, '❤️');
  
  // Обновить статус в YClients
  await yclientsClient.updateBookingStatus(recordId, 2);
  
  // Пометить как подтвержденное
  await reminderContextTracker.markAsConfirmed(from);
  
  return; // НЕ отправлять в AI
}
```

### 4. Расширения API

#### WhatsApp Client
**Новый метод**: `sendReaction(phone, emoji)`
```javascript
// Отправляет реакцию на последнее сообщение
await whatsappClient.sendReaction('79001234567', '❤️');
```

#### YClients Client  
**Новый метод**: `updateBookingStatus(recordId, attendance)`
```javascript
// Обновляет статус записи
// attendance: 2=подтвержден, 1=пришел, 0=ожидание, -1=не пришел
await yclientsClient.updateBookingStatus(123456, 2);
```

## 📚 API Reference

### ReminderContextTracker API

#### saveReminderContext
```javascript
/**
 * Сохранить контекст напоминания
 * @param {string} phone - Номер телефона (без @c.us)
 * @param {Object} bookingData - Данные записи
 * @param {string} reminderType - Тип напоминания ('day_before'|'2hours')
 * @returns {Promise<boolean>} - Успех операции
 */
await reminderContextTracker.saveReminderContext(
  '79001234567',
  {
    record_id: 123456,
    datetime: '2025-08-30T15:00:00',
    service_name: 'Стрижка',
    staff_name: 'Мастер Иван'
  },
  'day_before'
);
```

#### shouldHandleAsReminderResponse
```javascript
/**
 * Проверить, является ли сообщение ответом на напоминание
 * @param {string} phone - Номер телефона
 * @param {string} message - Текст сообщения
 * @returns {Promise<boolean>} - true если это подтверждение
 */
const isConfirmation = await reminderContextTracker.shouldHandleAsReminderResponse(
  '79001234567',
  'Ок, спасибо!'
);
```

### Redis структура данных

```json
{
  "key": "reminder_context:79001234567",
  "ttl": 86400,
  "value": {
    "type": "day_before",
    "sentAt": "2025-08-29T15:00:00.000Z",
    "booking": {
      "recordId": 123456,
      "datetime": "2025-08-30T15:00:00.000Z",
      "serviceName": "Стрижка",
      "staffName": "Мастер Иван"
    },
    "awaitingConfirmation": true,
    "confirmedAt": null
  }
}
```

## ⚙️ Настройка и конфигурация

### Переменные окружения
```bash
# Redis конфигурация
REDIS_URL=redis://default:password@localhost:6379/0

# YClients API
YCLIENTS_API_KEY=your_api_key
YCLIENTS_USER_TOKEN=your_user_token
YCLIENTS_COMPANY_ID=962302

# WhatsApp
WHATSAPP_PROVIDER=venom
VENOM_BOT_URL=http://localhost:3001
```

### Параметры системы
```javascript
// src/services/reminder/reminder-context-tracker.js
class ReminderContextTracker {
  constructor() {
    this.ttl = 24 * 60 * 60; // TTL контекста в Redis (24 часа)
    this.confirmationWindow = 30; // Окно для подтверждения (30 минут)
    this.staleThreshold = 12; // Порог устаревания (12 часов)
  }
}
```

## 📖 Использование

### Распознаваемые паттерны подтверждения

#### Короткие ответы
- ок, ok
- да, yes  
- хорошо
- конечно
- договорились

#### Подтверждения намерения
- буду, будем
- приду, придем
- подтверждаю
- согласен, согласна

#### Благодарности
- спасибо
- благодарю

#### Эмодзи
- 👍, 👌, ✅, 💯
- +, ++

### Временные окна

1. **Окно подтверждения**: 30 минут после отправки напоминания
2. **TTL контекста**: 24 часа (после этого контекст удаляется)
3. **Актуальность для ожидания**: 12 часов

### Примеры диалогов

#### Успешное подтверждение
```
Бот: 📅 Напоминаем! Завтра в 15:00 вас ждет мастер Иван на стрижку
Клиент: Ок
Бот: ❤️
[Статус в YClients обновлен на "подтвержден"]
```

#### Обычное сообщение (не подтверждение)
```
Бот: 📅 Напоминаем! Завтра в 15:00 вас ждет мастер Иван на стрижку
Клиент: А можно перенести на 16:00?
Бот: Конечно! Давайте посмотрим доступное время...
[Запускается обычная AI обработка]
```

## 🧪 Тестирование

### Запуск тестов

#### Локально (требует SSH туннель для Redis)
```bash
# Запустить SSH туннель
./scripts/maintain-redis-tunnel.sh start

# Запустить тесты
node test-reminder-confirmation.js
```

#### На сервере
```bash
# Использует правильные настройки Redis для сервера
./test-reminder-on-server.sh
```

### Структура тестов

1. **Тест сохранения контекста** - проверка записи/чтения из Redis
2. **Тест распознавания паттернов** - 15 тестовых сообщений
3. **Тест обработки подтверждения** - полный цикл обработки
4. **Тест webhook интеграции** - end-to-end тест (опционально)

### Ожидаемые результаты
```
✅ saveContext: PASSED
✅ detection: PASSED  
✅ handling: PASSED
⏭️ webhook: SKIPPED (требует запущенный API)
```

## 🔧 Troubleshooting

### Проблема: Подтверждения не распознаются

**Возможные причины:**
1. Контекст напоминания не сохранен в Redis
2. Прошло больше 30 минут с момента отправки
3. Сообщение не соответствует паттернам

**Решение:**
```bash
# Проверить Redis контекст
redis-cli get "reminder_context:79001234567"

# Проверить логи
pm2 logs ai-admin-worker-v2 --lines 100 | grep "reminder"
```

### Проблема: Реакция не отправляется

**Возможные причины:**
1. WhatsApp клиент не подключен
2. Venom bot не поддерживает реакции (отправляется как сообщение)

**Решение:**
```bash
# Проверить статус Venom bot
pm2 status venom-bot

# Проверить логи WhatsApp клиента
pm2 logs ai-admin-worker-v2 | grep "sendReaction"
```

### Проблема: Статус в YClients не обновляется

**Возможные причины:**
1. Неверный record_id
2. Нет прав на обновление записи
3. YClients API недоступен

**Решение:**
```bash
# Проверить логи обновления статуса
pm2 logs ai-admin-worker-v2 | grep "updateBookingStatus"

# Тестировать API напрямую
curl -X PUT "https://api.yclients.com/api/v1/record/{company_id}/{record_id}" \
  -H "Authorization: Bearer {token}" \
  -d '{"attendance": 2}'
```

## 📊 Метрики и мониторинг

### Ключевые метрики
- Количество отправленных напоминаний
- Процент подтвержденных записей
- Время обработки подтверждений
- Количество сэкономленных AI вызовов

### Логирование
Все события логируются с префиксами:
- `📝` - сохранение контекста
- `✅` - успешная обработка
- `❤️` - отправка реакции
- `🔄` - обновление статуса

### Мониторинг через PM2
```bash
# Общий статус
pm2 status

# Логи в реальном времени
pm2 logs ai-admin-worker-v2 --lines 100

# Метрики
pm2 monit
```

## 🚀 Развертывание

### Checklist для production
- [ ] Redis доступен и настроен
- [ ] Переменные окружения установлены
- [ ] SSH туннель настроен (если нужен)
- [ ] Тесты пройдены успешно
- [ ] Логирование настроено
- [ ] Мониторинг включен

### Команды развертывания
```bash
# Обновить код
git pull origin feature/redis-context-cache

# Перезапустить сервисы
pm2 restart ai-admin-worker-v2
pm2 restart ai-admin-booking-monitor

# Проверить логи
pm2 logs --lines 50
```

## 📝 Changelog

### v1.0.0 (29.08.2025)
- Первая версия системы обработки подтверждений
- Поддержка 15+ паттернов подтверждения
- Интеграция с YClients API
- Автоматические реакции в WhatsApp
- Полное тестовое покрытие

## 👥 Контакты и поддержка

При возникновении вопросов или проблем:
1. Проверьте раздел Troubleshooting
2. Посмотрите логи через PM2
3. Запустите тесты для диагностики
4. Обратитесь к команде разработки