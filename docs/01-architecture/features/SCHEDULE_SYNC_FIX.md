# Исправление синхронизации расписаний

## Проблема
При синхронизации расписаний из YClients возникала ошибка:
```
Failed to save schedule for Бари on undefined
Error: null value in column "date" of relation "staff_schedules" violates not-null constraint
```

## Причина
YClients API endpoint `/api/v1/book_dates/{company_id}` возвращает массив строк с датами:
```json
["2025-08-22", "2025-08-24", "2025-08-25"]
```

Но код ожидал массив объектов с полем `date`:
```javascript
// Неправильное ожидание
schedule.date // undefined
schedule.is_working // undefined
```

## Решение
Обновлен метод `saveSchedules` в файле `src/sync/schedules-sync.js`:

### Было:
```javascript
for (const schedule of schedules) {
  const scheduleData = {
    date: schedule.date, // schedule - это строка, а не объект!
    is_working: schedule.is_working || false,
    // ...
  };
}
```

### Стало:
```javascript
for (const dateString of schedules) {
  // Валидация даты
  if (!dateString || typeof dateString !== 'string') {
    logger.warn(`Invalid date for ${staffMember.name}: ${dateString}`);
    errors++;
    continue;
  }

  const scheduleData = {
    date: dateString, // Используем дату напрямую как строку
    is_working: true, // Если дата есть в списке - мастер работает
    has_booking_slots: true, // Если дата есть - есть слоты
    // ...
  };
}
```

## Результаты
После исправления синхронизация работает корректно:
- ✅ 81 расписание синхронизировано
- ✅ 0 ошибок
- ✅ Данные сохраняются в таблице `staff_schedules`

## Тестирование
```bash
# Ручная синхронизация расписаний
node scripts/manual-sync.js schedules

# Проверка данных в БД
node -e "
const { supabase } = require('./src/database/supabase.js');
supabase.from('staff_schedules')
  .select('*')
  .gte('date', '2025-08-22')
  .limit(5)
  .then(r => console.log(r.data));
"
```

## Важные замечания
1. Endpoint `/api/v1/book_dates` возвращает только даты, когда мастер доступен
2. Детальная информация о часах работы недоступна через этот endpoint
3. Для получения детальных слотов используется `/api/v1/book_times`