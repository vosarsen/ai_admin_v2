# Изменение статуса записи на "не пришел" в YClients API

## Обзор

В YClients API есть два способа изменить статус записи на "не пришел" (attendance = -1):

1. **PUT /record/{company_id}/{record_id}** - изменение записи
2. **PUT /visits/{visit_id}/{record_id}** - изменение визита

## 1. Изменение через PUT /record

### Endpoint
```
PUT https://api.yclients.com/api/v1/record/{company_id}/{record_id}
```

### Важные особенности
- **ВСЕ поля в Request Body являются ОПЦИОНАЛЬНЫМИ**
- Можно отправить только `attendance` и `comment`
- При изменении записи в групповом событии параметр `activity_id` становится обязательным

### Параметры attendance
- `2` - Пользователь подтвердил запись
- `1` - Пользователь пришел, услуги оказаны
- `0` - Ожидание пользователя (значение по умолчанию)
- `-1` - Пользователь не пришел на визит

### Минимальный запрос для изменения статуса
```json
{
  "attendance": -1,
  "comment": "Клиент не пришел"
}
```

### Полный пример запроса
```json
{
  "staff_id": 8886,
  "services": [
    {
      "id": 331,
      "first_cost": 9000,
      "discount": 50,
      "cost": 4500
    }
  ],
  "client": {
    "phone": "79169999900",
    "name": "Дмитрий",
    "email": "d@yclients.com"
  },
  "datetime": "2019-01-01 17:00:00",
  "seance_length": 3600,
  "comment": "тестовая запись!",
  "attendance": -1,
  "send_sms": true,
  "sms_remain_hours": 6,
  "email_remain_hours": 24,
  "api_id": "777",
  "custom_color": "f44336",
  "record_labels": ["67345", "104474"]
}
```

### Headers
```
Accept: application/vnd.yclients.v2+json
Content-Type: application/json
Authorization: Bearer partner_token, User user_token
```

## 2. Изменение через PUT /visits

### Endpoint
```
PUT https://api.yclients.com/api/v1/visits/{visit_id}/{record_id}
```

### Важные особенности
- Поля `attendance` и `comment` являются **ОБЯЗАТЕЛЬНЫМИ** (required)
- Минимальный набор полей для запроса

### Минимальный запрос
```json
{
  "attendance": -1,
  "comment": "Клиент не пришел"
}
```

### Расширенный запрос с дополнительными полями
```json
{
  "attendance": -1,
  "comment": "Клиент не пришел",
  "new_transactions": [],
  "deleted_transaction_ids": [],
  "goods_transactions": [],
  "services": [],
  "fast_payment": null
}
```

## Рекомендации по использованию

### Для изменения только статуса записи:

1. **Используйте PUT /record**, если:
   - У вас есть только record_id
   - Вы хотите изменить другие параметры записи
   - Нужна гибкость в выборе полей для обновления

2. **Используйте PUT /visits**, если:
   - У вас есть visit_id и record_id
   - Вам нужно изменить только статус посещения
   - Вы работаете с визитами напрямую

### Пример использования в коде

```javascript
// Изменение через PUT /record
async function updateRecordAttendance(companyId, recordId, attendance, comment) {
  const response = await fetch(
    `https://api.yclients.com/api/v1/record/${companyId}/${recordId}`,
    {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.yclients.v2+json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${partnerToken}, User ${userToken}`
      },
      body: JSON.stringify({
        attendance: attendance,
        comment: comment
      })
    }
  );
  
  return response.json();
}

// Пример вызова
const result = await updateRecordAttendance(
  962302,  // company_id
  123456,  // record_id
  -1,      // attendance (не пришел)
  "Клиент не пришел, не предупредил"
);
```

## Важные замечания

1. **Авторизация**: Оба метода требуют двойную авторизацию - partner_token и user_token
2. **Права доступа**: Убедитесь, что у пользователя есть права на изменение записей
3. **Валидация**: API может отклонить запрос, если:
   - Запись уже удалена
   - Визит уже состоялся и закрыт
   - У пользователя нет прав на изменение
4. **История изменений**: Все изменения логируются в системе YClients

## Ошибки

При неудачном запросе API вернет соответствующий HTTP статус и описание ошибки в теле ответа.

Типичные ошибки:
- 401 - Ошибка авторизации
- 404 - Запись не найдена
- 422 - Некорректные параметры записи