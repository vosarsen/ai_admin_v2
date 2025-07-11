# Company Sync Module

Модуль синхронизации данных компании из YClients API в локальную базу данных Supabase.

## Описание

Модуль `company-sync.js` предназначен для загрузки и синхронизации информации о компании из YClients API. Он автоматически обновляет данные компании в таблице `companies` базы данных Supabase.

## Функциональность

### Основные возможности:
- Загрузка данных компании через YClients API endpoint `/company/{id}/`
- Парсинг и преобразование данных в формат базы данных
- Сохранение полной информации о компании включая координаты и расписание
- Поддержка периодической синхронизации
- Детальное логирование процесса
- Обработка ошибок с повторными попытками

### Синхронизируемые поля:
- `title` - название компании
- `address` - адрес
- `phone` - телефон
- `email` - email
- `website` - сайт
- `timezone` - часовой пояс
- `working_hours` - расписание работы
- `coordinate_lat`, `coordinate_lon` - координаты
- `raw_data` - полный ответ API для будущего использования

## Использование

### Программное использование:

```javascript
const { syncCompany, companySync } = require('./src/sync/company-sync');

// Синхронизировать компанию по ID
const result = await syncCompany('962302');

// Или используя экземпляр класса
const info = await companySync.getLastSyncInfo('962302');
const result = await companySync.syncCompany('962302');
```

### Периодическая синхронизация:

```javascript
// Запустить синхронизацию каждые 60 минут
companySync.startPeriodicSync(60, '962302');

// Остановить периодическую синхронизацию
companySync.stopPeriodicSync();
```

### Тестирование:

```bash
# Синхронизировать компанию из переменной окружения
node scripts/test-company-sync.js

# Синхронизировать конкретную компанию
node scripts/test-company-sync.js 962302
```

## Интеграция с Sync Manager

Модуль интегрирован в общий менеджер синхронизации и выполняется:
- При полной синхронизации (`runFullSync()`)
- В рамках периодической синхронизации (2 раза в день в 4:00 и 14:00)
- При ручном вызове через API

## База данных

### Обновление структуры таблицы:

Перед первым использованием необходимо выполнить SQL скрипт для добавления новых полей:

```bash
psql -d your_database -f scripts/update-companies-table.sql
```

### Структура таблицы companies:

```sql
companies (
  id SERIAL PRIMARY KEY,
  yclients_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  timezone VARCHAR(50),
  working_hours JSONB,
  coordinate_lat DECIMAL(10, 8),
  coordinate_lon DECIMAL(11, 8),
  settings JSONB,
  raw_data JSONB,
  active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
```

## Конфигурация

Модуль использует следующие переменные окружения:
- `YCLIENTS_COMPANY_ID` - ID компании по умолчанию
- `YCLIENTS_BEARER_TOKEN` - токен авторизации
- `YCLIENTS_USER_TOKEN` - токен пользователя
- `YCLIENTS_PARTNER_ID` - ID партнера (опционально)

## Логирование

Все операции логируются с использованием Winston logger:
- `🏢` - начало синхронизации
- `📡` - запрос к API
- `📦` - подготовка данных
- `💾` - сохранение в БД
- `✅` - успешное завершение
- `❌` - ошибки

## Обработка ошибок

Модуль обрабатывает следующие типы ошибок:
- Сетевые ошибки при запросе к API
- Ошибки авторизации
- Ошибки валидации данных
- Ошибки базы данных при сохранении

При ошибках возвращается объект с полем `success: false` и описанием ошибки.

## Производительность

- Использует кэширование запросов к API (30 минут для данных компании)
- Rate limiting встроен в YClients клиент
- Оптимизированные запросы к базе данных с upsert