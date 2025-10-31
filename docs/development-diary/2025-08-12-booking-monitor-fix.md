# Development Diary: Исправление Booking Monitor - Дублирующие Уведомления

**Дата**: 12 августа 2025 (вечер)  
**Автор**: AI Admin Team  
**Задача**: Исправить критический баг с дублирующими уведомлениями в booking-monitor

## 🔴 Проблема

Клиенты получали множественные одинаковые уведомления "Ваша запись подтверждена!" каждую минуту. Booking monitor отправлял уведомления для одних и тех же записей снова и снова.

### Симптомы:
- Каждую минуту отправлялись уведомления для 12 записей
- Клиенты получали до 10+ одинаковых сообщений
- В логах: "Found 12 new bookings to process" каждую минуту

## 🔍 Анализ

### Найденные проблемы:

1. **Неправильная обработка структуры YClients API**
   - API возвращает вложенную структуру: `{ data: { data: [...] } }`
   - Код ожидал простую структуру: `{ data: [...] }`

2. **Отсутствие сохранения yclients_record_id**
   - Поле `yclients_record_id` всегда было NULL в БД
   - Невозможно было отследить обработанные записи

3. **Несоответствие типов при проверке дубликатов**
   - В БД: `yclients_record_id` хранится как число
   - В коде: сравнение со строкой
   - Результат: проверка всегда возвращала false

4. **Отсутствие фильтрации старых записей**
   - Обрабатывались все записи, включая прошедшие
   - Обрабатывались записи созданные давно

## ✅ Решение

### 1. Исправление обработки структуры API
```javascript
// Было:
if (result.success && result.data) {
  return { data: result.data };
}

// Стало:
const records = result.data?.data || result.data || [];
if (result.success && records) {
  return { data: Array.isArray(records) ? records : [] };
}
```

### 2. Правильное сохранение yclients_record_id
```javascript
// Было:
.insert({
  yclients_record_id: record.id,
  booking_data: record  // несуществующее поле
})

// Стало:
.insert({
  yclients_record_id: record.id.toString(),
  notification_type: 'booking_confirmed',
  message: message,
  company_id: record.company_id || config.yclients.companyId
})
```

### 3. Исправление проверки типов
```javascript
// Было:
const processedIds = new Set(processedRecords?.map(r => r.yclients_record_id) || []);

// Стало:
const processedIds = new Set(processedRecords?.map(r => r.yclients_record_id.toString()) || []);
```

### 4. Добавление фильтрации записей
```javascript
const now = new Date();
const newRecords = records.data.filter(record => {
  // Пропускаем уже обработанные
  if (processedIds.has(record.id.toString())) {
    return false;
  }
  
  // Пропускаем записи на прошедшее время
  const recordDate = new Date(record.datetime);
  if (recordDate < now) {
    logger.debug(`⏭️ Skipping past booking ${record.id}`);
    return false;
  }
  
  // Пропускаем записи созданные более 30 минут назад
  const createdAt = new Date(record.created || record.datetime);
  const timeSinceCreation = now - createdAt;
  const maxAge = 30 * 60 * 1000; // 30 минут
  if (timeSinceCreation > maxAge) {
    logger.debug(`⏭️ Skipping old booking ${record.id}`);
    return false;
  }
  
  return true;
});
```

## 📊 Результаты

### До исправления:
- ❌ Каждую минуту: "Found 12 new bookings to process"
- ❌ Дублирующие уведомления каждую минуту
- ❌ `yclients_record_id` = NULL в БД
- ❌ Недовольные клиенты от спама

### После исправления:
- ✅ Первый запуск: "Found 6 new bookings to process" (остальные 6 уже в БД)
- ✅ Последующие запуски: "No new bookings found"
- ✅ `yclients_record_id` корректно сохраняется
- ✅ Каждая запись обрабатывается только один раз
- ✅ Фильтруются старые и прошедшие записи

## 📚 Уроки

1. **Всегда проверяйте структуру API ответа** - не полагайтесь на предположения
2. **Типы данных критичны** - number !== string при сравнении в JavaScript
3. **Логирование спасает** - детальные логи помогли быстро найти проблему
4. **Фильтрация важна** - не все записи нужно обрабатывать
5. **Тестируйте дедупликацию** - проверяйте что механизм защиты от дубликатов работает

## 🛠️ Технические детали

### Файлы изменены:
- `src/services/booking-monitor/index.js` - основная логика
- `src/integrations/yclients/client.js` - обработка API ответа
- `ecosystem.config.js` - временное отключение/включение сервиса

### Коммиты:
```bash
0a1c9c3 - fix: исправлена обработка вложенной структуры данных YClients API
2a49803 - fix: временно отключен booking-monitor
d6c1a5d - fix: полностью исправлена логика booking-monitor
a7fcd42 - fix: исправлено несоответствие типов при проверке дубликатов
0c95614 - fix: добавлена фильтрация старых и прошедших записей
```

## 🔄 Следующие шаги

1. ✅ Мониторить работу в production
2. ⏳ Добавить метрики для отслеживания
3. ⏳ Рассмотреть возможность настраиваемого интервала проверки
4. ⏳ Добавить поддержку разных типов уведомлений (напоминания, изменения)

## 📝 Заметки

- Booking monitor теперь стабилен и готов к production использованию
- Важно следить за логами при добавлении новых компаний
- Система защиты от дубликатов работает на уровне БД и кода