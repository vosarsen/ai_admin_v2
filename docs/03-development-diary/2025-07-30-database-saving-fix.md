# Database Saving Fix - Исправление сохранения записей

## Дата: 30 июля 2025

## Контекст

После каждого создания записи в логах появлялась ошибка "Failed to save booking to database", хотя сама запись в YClients создавалась успешно.

## Проблема

Код пытался сохранить данные в таблицу `bookings` с неправильными названиями полей. 

### Что код пытался сохранить:
```javascript
{
  user_id: '79686484488',           // нет такого поля
  record_id: 1212499274,             // должно быть yclients_record_id
  appointment_datetime: '2025-07-30 19:30:00',  // должно быть scheduled_at
  metadata: { ... }                  // нет такого поля
}
```

### Схема таблицы bookings:
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    company_id INTEGER,
    client_id INTEGER,
    yclients_record_id VARCHAR(50),
    service_name VARCHAR(255),
    staff_name VARCHAR(255),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    price DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'confirmed',
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Решение

Исправлен код в `src/services/ai-admin-v2/index.js`:

1. **Добавлен поиск client_id** через таблицу clients по номеру телефона
2. **Исправлены названия полей**:
   - `user_id` → поиск `client_id` через таблицу clients
   - `record_id` → `yclients_record_id`
   - `appointment_datetime` → `scheduled_at`
   - Убрано поле `metadata`
   - Добавлено `company_id` на верхний уровень

3. **Улучшено логирование ошибок** для более детальной диагностики

### Новый код:
```javascript
// Находим клиента по телефону
const phone = context.phone.replace('@c.us', '');
const { data: clientData } = await supabase
  .from('clients')
  .select('id')
  .eq('phone', phone)
  .eq('company_id', context.company.company_id)
  .maybeSingle();

const bookingData = {
  company_id: context.company.company_id,
  client_id: clientData?.id || null,
  yclients_record_id: String(result.data.record_id),
  service_name: result.data.service_name || null,
  staff_name: result.data.staff_name || null,
  scheduled_at: result.data.datetime || null,
  status: 'confirmed'
};
```

## Результат

Теперь записи должны успешно сохраняться в таблицу bookings без ошибок. Это позволит:
- Вести историю всех записей в нашей БД
- Использовать эти данные для аналитики
- Отслеживать статусы записей
- Управлять напоминаниями

## Уроки

1. Всегда проверяйте схему БД перед попыткой вставки данных
2. Используйте правильные названия полей согласно схеме
3. Добавляйте детальное логирование ошибок БД для быстрой диагностики
4. Не забывайте про связи между таблицами (client_id)