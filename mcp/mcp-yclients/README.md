# YClients MCP Server

MCP сервер для прямого доступа к YClients API из Claude для отладки и тестирования.

## Установка

```bash
cd mcp-yclients
npm install
```

## Настройка

Требуются переменные окружения:
- `YCLIENTS_API_KEY` - API ключ YClients (из вашего .env файла)
- `YCLIENTS_USER_TOKEN` - токен пользователя (опционально)

## Доступные команды

### 1. Получение услуг
```bash
@yclients get_services company_id=962302 staff_id=2895125
```

### 2. Проверка доступных слотов
```bash
@yclients get_available_slots company_id=962302 date="2024-07-20" service_ids=[15031280]
```

### 3. Создание тестовой записи
```bash
@yclients create_test_booking phone="79001234567" appointments=[{"id": 0, "services": [15031280], "staff_id": 2895125, "datetime": "2024-07-20T15:00:00"}]
```

### 4. Получение информации о записи
```bash
@yclients get_booking booking_id=12345
```

### 5. Отмена записи
```bash
@yclients cancel_booking record_id=12345
```

### 6. Получение списка сотрудников
```bash
@yclients get_staff company_id=962302
```

### 7. Расписание сотрудника
```bash
@yclients get_staff_schedule staff_id=2895125 date="2024-07-20"
```

### 8. Поиск клиентов
```bash
@yclients search_clients search="79001234567"
```

### 9. История визитов клиента
```bash
@yclients get_client_visits client_id=12345
```

## Использование для отладки

Этот MCP полезен для:
- Проверки доступности слотов при проблемах с записью
- Отладки ошибок создания записей
- Проверки расписания мастеров
- Поиска информации о клиентах
- Тестирования API без написания скриптов