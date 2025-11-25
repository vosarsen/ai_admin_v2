# End-to-End Test: Reminder Confirmation

## Дата теста: 23 октября 2025

## Шаги теста:

### 1. Создание записи
**Действие:** Отправить сообщение боту через WhatsApp с телефона 89686484488

**Сообщение:**
```
Запиши меня на стрижку завтра в 14:00 к Бари
```

**Ожидаемый результат:**
- Бот создаст запись
- Получим recordId

### 2. Создание контекста напоминания
**Действие:** Создать контекст в Redis с полученным recordId

```bash
ssh root@46.149.70.219 "cd /opt/ai-admin && node -e \"
const ReminderContextTracker = require('./src/services/reminder/reminder-context-tracker');
const tracker = new ReminderContextTracker();

(async () => {
  await tracker.saveReminderContext('79686484488', {
    record_id: RECORD_ID_HERE,
    datetime: '2025-10-24T14:00:00+03:00',
    service_name: 'МУЖСКАЯ СТРИЖКА',
    staff_name: 'Бари'
  }, 'day_before');

  console.log('✅ Context created');
  process.exit(0);
})();
\""
```

### 3. Отправка подтверждения
**Действие:** Отправить подтверждающее сообщение с того же номера

**Сообщение:**
```
Да, приду!
```

**Ожидаемый результат:**
- Бот отправит реакцию ❤️
- Бот ответит: "❤️ Отлично! Ждём вас!"
- В логах: "✅ Booking XXXXX confirmed in YClients"

### 4. Проверка в YClients
**Действие:** Проверить attendance записи через API

```bash
curl -X GET "https://api.yclients.com/api/v1/record/962302/RECORD_ID_HERE" \
  -H "Authorization: Bearer cfjbs9dpuseefh8ed5cp, User 16e0dffa0d71350dcb83381e03e7af29" \
  -H "X-Partner-Id: 8444" \
  -H "Accept: application/vnd.yclients.v2+json"
```

**Ожидаемый результат:**
- `attendance: 2` (подтверждён)

## Результаты

### Создание записи
- [ ] Запись создана
- [ ] RecordId получен: _____________

### Контекст напоминания
- [ ] Контекст создан в Redis
- [ ] Контекст содержит правильный recordId

### Подтверждение
- [ ] Реакция ❤️ отправлена
- [ ] Короткий ответ получен
- [ ] attendance = 2 в YClients

### Логи
```
Вставить релевантные логи сюда
```

## Выводы
_Заполнить после теста_
