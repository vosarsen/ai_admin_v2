# Руководство по миграции базы данных

## Добавление company_id в таблицу staff_schedules

### Описание проблемы
Таблица `staff_schedules` не содержит колонку `company_id`, что делает невозможной фильтрацию расписания по компаниям в мультитенантной среде.

### Статус
- ❌ Миграция еще не выполнена
- 📍 SQL-скрипт готов: `scripts/database/add-company-id-to-staff-schedules-fixed.sql`
- 🔧 Временный фикс в коде: фильтрация по company_id закомментирована

### Инструкция по выполнению

#### Вариант 1: Через Supabase Dashboard (Рекомендуется)
1. Откройте [Supabase Dashboard](https://app.supabase.com)
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**
4. Откройте файл `scripts/database/add-company-id-to-staff-schedules-fixed.sql`
5. Скопируйте содержимое и вставьте в SQL Editor
6. Нажмите **Run** для выполнения

#### Вариант 2: Через командную строку на сервере
```bash
# Подключитесь к серверу
ssh ai-admin-server

# Перейдите в директорию проекта
cd /opt/ai-admin

# Выполните миграцию
psql $DATABASE_URL < scripts/database/add-company-id-to-staff-schedules-fixed.sql
```

#### Вариант 3: Через Supabase CLI (локально)
```bash
# Убедитесь, что Supabase CLI установлен и настроен
supabase db push < scripts/database/add-company-id-to-staff-schedules-fixed.sql
```

### Что делает миграция

1. **Добавляет колонку** `company_id` в таблицу `staff_schedules`
2. **Заполняет значения** из таблицы `staff`, связывая по `staff_id = yclients_id`
3. **Обрабатывает NULL значения**, устанавливая дефолтную компанию
4. **Создает индексы** для оптимизации запросов:
   - `idx_staff_schedules_lookup` - основной индекс поиска
   - `idx_staff_schedules_company_date` - индекс по компании и дате
5. **Делает колонку NOT NULL** после заполнения всех значений

### После выполнения миграции

1. **Раскомментируйте фильтрацию** в файле `src/services/ai-admin-v2/modules/data-loader.js`:
   ```javascript
   // Найдите строку:
   // .eq('company_id', companyId) // TODO: Раскомментировать после миграции
   
   // Замените на:
   .eq('company_id', companyId)
   ```

2. **Протестируйте**:
   ```bash
   # Отправьте тестовое сообщение
   node test-webhook.js "хочу записаться"
   
   # Проверьте логи
   ssh ai-admin-server "pm2 logs ai-admin-worker-v2 --lines 50"
   ```

3. **Закоммитьте изменения**:
   ```bash
   git add -A
   git commit -m "fix: включена фильтрация по company_id после миграции БД"
   git push
   ```

### Проверка успешности миграции

Выполните SQL-запрос для проверки:
```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'staff_schedules'
AND column_name = 'company_id';
```

Ожидаемый результат:
```
column_name | data_type | is_nullable
------------+-----------+-------------
company_id  | bigint    | NO
```

### Откат (если необходимо)

```sql
-- Удалить созданные индексы
DROP INDEX IF EXISTS idx_staff_schedules_lookup;
DROP INDEX IF EXISTS idx_staff_schedules_company_date;

-- Удалить колонку
ALTER TABLE staff_schedules DROP COLUMN IF EXISTS company_id;
```

### Контакты для помощи

Если возникли проблемы с миграцией, обратитесь к:
- Администратору БД
- Разработчику проекта
- Документации Supabase: https://supabase.com/docs