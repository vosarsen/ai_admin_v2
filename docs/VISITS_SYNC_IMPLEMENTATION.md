# 📊 Синхронизация истории визитов - Полная реализация

## 🎯 Цель
Реализовать полную синхронизацию истории визитов клиентов из YClients в Supabase для персонализации общения и умных рекомендаций.

## 🔍 Проблема которую мы решили

### До реализации:
- В таблице `clients` были только агрегированные данные (visit_count, total_spent)
- Поля `visit_history`, `last_services`, `favorite_staff_ids` всегда пустые
- Нет детальной информации о каждом визите
- Невозможно персонализировать общение на основе истории

### После реализации:
- Создана таблица `visits` для полной истории
- Синхронизация всех визитов с деталями услуг, мастеров, оплат
- Автоматическое обновление статистики клиентов
- Возможность анализа предпочтений и паттернов

## 📁 Созданные файлы

### 1. Схема базы данных
- `scripts/database/create-visits-table.sql` - Полная схема с триггерами
- `scripts/database/create-visits-table-simple.sql` - Упрощенная версия для Supabase

### 2. Модуль синхронизации
- `src/sync/visits-sync.js` - Основной модуль синхронизации визитов
  - Получение истории через YClients API endpoint `/company/{id}/clients/visits/search`
  - Пакетная обработка (50 визитов за раз)
  - Форматирование и сохранение в Supabase
  - Обработка услуг, продаж товаров, абонементов

### 3. Скрипты запуска
- `scripts/sync-visits.js` - Ручная синхронизация с опциями
- `test-visits-sync.js` - Тестовый скрипт с проверками
- `scripts/create-visits-table.js` - Попытка создать таблицу программно
- `scripts/execute-visits-table.sh` - Инструкции для создания таблицы

### 4. Документация
- `CREATE_VISITS_TABLE_INSTRUCTIONS.md` - Пошаговая инструкция
- `docs/VISITS_SYNC_IMPLEMENTATION.md` - Этот файл

## 🗄️ Структура таблицы visits

```sql
visits
├── id (UUID) - Primary Key
├── YClients идентификаторы
│   ├── yclients_visit_id
│   ├── yclients_record_id (UNIQUE with company_id)
│   └── company_id
├── Клиент
│   ├── client_id (FK → clients.id)
│   ├── client_phone
│   ├── client_name
│   └── client_yclients_id
├── Мастер
│   ├── staff_id
│   ├── staff_name
│   └── staff_yclients_id
├── Услуги
│   ├── services (JSONB) - [{id, name, cost, duration}]
│   ├── service_names (TEXT[])
│   ├── service_ids (INTEGER[])
│   └── services_cost
├── Время
│   ├── visit_date
│   ├── visit_time
│   ├── datetime
│   └── duration
├── Финансы
│   ├── total_cost
│   ├── paid_amount
│   ├── discount_amount
│   ├── tips_amount
│   ├── payment_status
│   └── payment_method
├── Статус
│   ├── attendance (-1/0/1/2)
│   ├── status (completed/cancelled/no_show)
│   └── is_online
└── Метаданные
    ├── created_at
    ├── updated_at
    └── synced_at
```

## 🔄 Процесс синхронизации

### 1. Получение данных из YClients
```javascript
POST /company/{company_id}/clients/visits/search
{
  client_id: 123,
  payment_statuses: [],
  attendance: 1 // Только где клиент пришел
}
```

### 2. Обработка данных
- Парсинг визитов и записей
- Извлечение информации об услугах
- Обработка продаж товаров
- Расчет финансовых показателей

### 3. Сохранение в Supabase
- Пакетная вставка (upsert) по 50 записей
- Предотвращение дублей через UNIQUE constraint
- Автоматическое обновление статистики клиентов

## 🚀 Использование

### Создание таблицы (ОБЯЗАТЕЛЬНО!)
1. Откройте: https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/sql/new
2. Скопируйте SQL из: `scripts/database/create-visits-table-simple.sql`
3. Выполните в SQL Editor

### Тестирование
```bash
# Проверка готовности
node test-visits-sync.js

# Тестовая синхронизация (3 клиента)
node scripts/sync-visits.js --limit 3

# VIP клиенты
node scripts/sync-visits.js --vip

# Клиенты с 10+ визитами
node scripts/sync-visits.js --min-visits 10 --limit 20
```

### Полная синхронизация
```bash
# Все клиенты
node scripts/sync-visits.js

# Примерное время: 1-2 минуты на 100 клиентов
```

## 📊 Интеграция в систему

### Автоматическая синхронизация
В `sync-manager.js` добавлено:
- Модуль `VisitsSync`
- Расписание: ежедневно в 04:00 МСК
- Синхронизация после клиентов (03:00)

### Использование данных
После синхронизации можно:
1. Анализировать историю визитов клиента
2. Определять любимые услуги
3. Находить предпочитаемых мастеров
4. Рекомендовать время на основе паттернов
5. Персонализировать приветствия

## ⚠️ Важные моменты

1. **Таблица должна быть создана вручную** через Supabase Dashboard
2. **Первая синхронизация займет время** (зависит от количества клиентов)
3. **Rate limits YClients API** - 500ms задержка между клиентами
4. **Максимум 100 визитов на клиента** для оптимизации

## 📈 Метрики успеха

После полной синхронизации:
- ✅ Таблица `visits` содержит историю визитов
- ✅ Поля `last_service_ids`, `favorite_staff_ids` заполнены
- ✅ Статистика клиентов обновляется автоматически
- ✅ Персонализация работает на основе истории

## 🔜 Следующие шаги

1. **Создать таблицу visits** в Supabase
2. **Запустить тестовую синхронизацию**
3. **Проверить данные**
4. **Запустить полную синхронизацию**
5. **Интегрировать в AI промпты**