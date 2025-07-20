# Development Diary - 20 июля 2024

## Исправление проблемы с отображением номера записи

### Проблема
После создания записи через WhatsApp клиенты видели "Номер записи: undefined", хотя запись создавалась успешно.

### Анализ
1. В логах было видно, что YClients API возвращает запись с номером:
   ```json
   {
     "data": [{
       "id": 1,
       "record_hash": "9c45a2f4482368ef3dc0d22c06f10faa",
       "record_id": 1194918747
     }],
     "meta": [],
     "success": true
   }
   ```

2. Но в форматтере приходил пустой объект:
   ```
   resultData: {}
   hasId: false
   hasRecordId: false
   ```

### Причина
YClients API возвращает вложенную структуру данных:
```javascript
{
  success: true,
  data: {
    data: [{ id: 1, record_id: 1194929772, record_hash: "..." }],
    meta: [],
    success: true
  },
  status: 201,
  attempt: 0
}
```

Код пытался извлечь данные из `result.data`, но нужно было из `result.data.data`.

### Решение
В файле `src/services/ai-admin-v2/modules/command-handler.js` изменили логику извлечения данных:

```javascript
// Было:
const bookingRecord = Array.isArray(result.data) ? result.data[0] : result.data;

// Стало:
const responseData = result.data?.data || result.data || [];
const bookingRecord = Array.isArray(responseData) ? responseData[0] : responseData;
```

### Результат
Теперь клиенты видят корректный номер записи:
```
✅ Запись создана! Номер записи: 1194929772
```

### Выводы
1. Всегда внимательно изучать структуру ответов от внешних API
2. Добавлять детальное логирование для отладки
3. Использовать optional chaining (?.) для безопасного доступа к вложенным свойствам

### Связанные файлы
- `src/services/ai-admin-v2/modules/command-handler.js` - основное исправление
- `src/services/ai-admin-v2/index.js` - добавлено логирование для отладки
- `docs/TROUBLESHOOTING.md` - добавлена документация по проблеме