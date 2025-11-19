# YClients API Quick Reference

Это индексный файл для быстрого поиска в YCLIENTS_API.md (35k строк).

## Основные разделы

### 1. Авторизация
- `Авторизовать пользователя` - POST /api/v1/auth
- `Авторизовать пользователя онлайн-записи` - POST /api/v1/book_user_auth

### 2. Онлайн-запись (главное для AI Admin)
- `Получить список услуг` - GET /api/v1/book_services/{company_id}
- `Получить список сотрудников` - GET /api/v1/book_staff/{company_id}  
- `Получить список сеансов` - GET /api/v1/book_times/{company_id}
- `Создать запись на сеанс` - POST /api/v1/book_record/{company_id}
- `Проверить параметры записи` - POST /api/v1/book_check/{company_id}

### 3. Управление записями
- `Получить записи пользователя` - GET /api/v1/user/records
- `Удалить запись пользователя` - DELETE /api/v1/user/records/{record_id}
- `Перенести запись на сеанс` - PUT /api/v1/book_record/{company_id}/{record_id}

### 4. Компании и филиалы
- `Получить список компаний` - GET /api/v1/companies
- `Получить компанию` - GET /api/v1/company/{company_id}

### 5. Услуги
- `Получить список услуг` - GET /api/v1/services/{company_id}
- `Получить категории услуг` - GET /api/v1/service_categories/{company_id}

### 6. Сотрудники
- `Получить список сотрудников` - GET /api/v1/staff/{company_id}

### 7. Клиенты
- `Получить список клиентов` - GET /api/v1/company/{company_id}/clients/search
- `Создать клиента` - POST /api/v1/clients/{company_id}

## Поиск в документации

### По типу запроса:
```bash
# Найти все POST endpoints
grep "^post/" YCLIENTS_API.md

# Найти все GET endpoints  
grep "^get/" YCLIENTS_API.md
```

### По ключевым словам:
```bash
# Поиск всего про booking
grep -i "book" YCLIENTS_API.md

# Поиск параметров для создания записи
grep -A 50 "Создать запись на сеанс" YCLIENTS_API.md
```

## Важные параметры для AI Admin

### Создание записи (book_record)
- **phone** (обязательный) - формат: 79161502239
- **fullname** (обязательный)
- **email** (обязательный)
- **appointments** - массив с:
  - **services** - ID услуг
  - **staff_id** - ID мастера (0 = любой)
  - **datetime** - ISO8601 формат

### Получение слотов (book_times)
Параметры:
- **staff_id** - фильтр по мастеру
- **service_ids** - фильтр по услугам (через запятую)
- **date** - дата в формате YYYY-MM-DD
- **date_from/date_to** - диапазон дат

### Авторизация
Заголовки:
- `Authorization: Bearer {partner_token}`
- `Accept: application/vnd.yclients.v2+json`
- `Content-Type: application/json`

## Лимиты API
- 200 запросов в минуту
- 5 запросов в секунду
- На один IP-адрес