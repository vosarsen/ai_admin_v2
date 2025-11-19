# Анализ проблемы с удалением записи в YClients API

## Проблема
При попытке удалить запись через YClients API получаем ошибку:
- **Запрос**: `DELETE /record/962302/{record_id}`
- **Ошибка**: 400 "Недопустимый формат запроса"

## Анализ документации YClients API

### 1. Основной метод удаления записи (для администратора)
Согласно документации (строка 10978 в YCLIENTS_API.md):

```
DELETE /record/{company_id}/{record_id}
https://api.yclients.com/api/v1/record/{company_id}/{record_id}
```

**Параметры:**
- `company_id` (required, number) - ID компании
- `record_id` (required, number) - ID записи

**Query параметры (опциональные):**
- `include_consumables` (number) - Example: 0
- `include_finance_transactions` (number) - Example: 0

**Headers:**
- `Accept`: `application/vnd.yclients.v2+json`
- `Content-Type`: `application/json`
- `Authorization`: `Bearer partner_token, User user_token`

**Ответ:** 204 No Content

### 2. Альтернативный метод удаления (для пользователя)
Согласно документации (строка 3264):

```
DELETE /user/records/{record_id}/{record_hash}
https://api.yclients.com/api/v1/user/records/{record_id}/{record_hash}
```

**Параметры:**
- `record_id` (required, number) - ID записи
- `record_hash` (required, string) - HASH записи (обязателен если пользователь не авторизован)

### 3. Изменение статуса записи (альтернативный способ отмены)
Можно использовать `PUT /record/{company_id}/{record_id}` с параметром:
- `attendance: -1` - пользователь не пришел на визит (фактически отмена)

## Возможные причины ошибки 400

1. **Неправильный формат ID записи**
   - ID должен быть числом (number), не строкой
   - Возможно, ID содержит нечисловые символы

2. **Отсутствие обязательных заголовков**
   - Требуется заголовок `Accept: application/vnd.yclients.v2+json`
   - Без этого заголовка API может не понять формат запроса

3. **Проблемы с авторизацией**
   - Неправильный формат токена авторизации
   - Недостаточно прав для удаления записи

4. **Ограничения компании**
   - Параметры `allow_delete_record` и `allow_delete_record_delay_step` могут запрещать удаление

## Текущая реализация

В файле `src/integrations/yclients/client.js`:

```javascript
async deleteRecord(companyId, recordId) {
  const result = await this.request(
    'DELETE',
    `record/${companyId}/${recordId}`,
    null,
    {
      include_consumables: 0,
      include_finance_transactions: 0
    }
  );
}
```

## Рекомендации по исправлению

1. **Проверить формат record_id**
   - Убедиться, что ID передается как число
   - Проверить, что ID не содержит пробелов или других символов

2. **Добавить обязательный заголовок Accept**
   - В методе `_createAxiosInstance()` добавить заголовок Accept

3. **Логирование для отладки**
   - Добавить логирование полного URL запроса
   - Логировать все заголовки
   - Логировать точный формат record_id

4. **Альтернативные решения**
   - Использовать PUT метод с `attendance: -1` для отмены
   - Попробовать user endpoint если есть record_hash

## Примеры из документации

### Пример record_id в ответах API:
```json
{
  "record_id": 2820023,
  "record_hash": "567df655304da9b98487769426d4e76e"
}
```

### Пример использования visit_id (альтернативный идентификатор):
```json
{
  "visit_id": 8262996,
  "record_id": 0
}
```

## Дополнительные проверки

1. **Формат ID в базе данных**
   - Поле `yclients_record_id` в таблице `bookings` имеет тип `bigint`
   - Нужно убедиться, что при передаче в API оно корректно преобразуется

2. **Права доступа API ключа**
   - Проверить параметр `delete_records_access` в правах пользователя
   - Проверить `delete_customer_came_records_access` и `delete_paid_records_access`

3. **Статус записи**
   - Некоторые записи могут быть защищены от удаления (оплаченные, подтвержденные и т.д.)