# Реализация функции отмены записи

**Дата**: 22 июля 2025  
**Автор**: AI Admin v2 Team

## Описание

Реализована функция отмены записи через WhatsApp бота. Клиент может отправить сообщение "отменить запись" и получить список своих активных записей для выбора.

## Реализованные изменения

### 1. Добавлены методы в YClients client (`src/integrations/yclients/client.js`)
- `getRecords(companyId, params)` - получение списка записей с фильтрацией
- `deleteRecord(companyId, recordId)` - удаление записи по ID

### 2. Добавлены методы в BookingService (`src/services/booking/index.js`)
- `getClientBookings(phone, companyId)` - получение активных записей клиента
- `cancelBooking(recordId, companyId)` - отмена записи

### 3. Добавлена команда CANCEL_BOOKING в AI Admin v2
- Обновлен промпт с описанием команды
- Добавлена команда в regex для извлечения
- Реализован обработчик `cancelBooking` в command-handler
- Добавлена обработка результата `booking_list`

### 4. Реализован двухэтапный процесс отмены
- При команде CANCEL_BOOKING показывается список записей
- Состояние сохраняется в Redis как `pendingCancellation`
- При получении номера записи выполняется отмена
- После отмены состояние очищается

## Особенности реализации

### Форматирование списка записей
```javascript
const formattedBookings = bookingsResult.bookings.map((booking, index) => {
  const date = new Date(booking.datetime);
  const dateStr = date.toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long',
    weekday: 'short'
  });
  const timeStr = date.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return {
    index: index + 1,
    id: booking.id,
    date: dateStr,
    time: timeStr,
    services: booking.services.map(s => s.title).join(', '),
    staff: booking.staff ? booking.staff.name : 'Любой мастер',
    price: booking.price_min || 0
  };
});
```

### Обработка выбора номера
```javascript
if (redisContext?.pendingCancellation) {
  const selectedNumber = parseInt(message.trim());
  
  if (!isNaN(selectedNumber) && selectedNumber > 0 && selectedNumber <= redisContext.pendingCancellation.length) {
    const selectedBooking = redisContext.pendingCancellation[selectedNumber - 1];
    const cancelResult = await bookingService.cancelBooking(selectedBooking.id, companyId);
    
    delete redisContext.pendingCancellation;
    await contextService.setContext(phone.replace('@c.us', ''), redisContext);
    
    if (cancelResult.success) {
      return `✅ Запись успешно отменена!...`;
    }
  }
}
```

## Проблемы и решения

### Проблема 1: Ошибка с this.api
**Симптом**: `Cannot read properties of undefined (reading 'get')`  
**Причина**: Использовался `this.api.get` вместо `this.axiosInstance.get`  
**Решение**: Заменили на использование метода `this.request()`

### Проблема 2: Ошибка с results.length
**Симптом**: `Cannot read properties of undefined (reading 'length')`  
**Причина**: Отсутствовала проверка на существование данных  
**Решение**: Добавили проверку `result.data && result.data.bookings && result.data.bookings.length > 0`

### Проблема 3: Ошибка в методе request
**Симптом**: `(config.method || this.defaults.method || "get").toLowerCase is not a function`  
**Причина**: Неправильная передача параметров в метод request  
**Решение**: Исправили передачу параметров согласно ожидаемому формату

## Тестирование

### Успешный сценарий:
1. Клиент: "Хочу записаться на стрижку завтра в 14:00"
2. Бот: Показывает слоты, клиент выбирает время
3. Клиент: "Запишите на 14:00"
4. Бот: "✅ Запись создана! Номер записи: 1199065365"
5. Клиент: "Хочу отменить запись"
6. Бот: Показывает список записей
7. Клиент: "1"
8. Бот: "✅ Запись успешно отменена!"

### Граничные случаи:
- Клиент без записей получает сообщение "У вас нет активных записей"
- Неправильный номер записи сбрасывает состояние и обрабатывается как обычное сообщение
- Ошибки API корректно обрабатываются и показываются клиенту

## Следующие шаги

1. ✅ Отмена записи - реализовано
2. ⏳ Перенос записи - следующая задача
3. Добавить уведомления об отмене в YClients
4. Добавить подтверждение перед отменой
5. Логирование отмен для аналитики

## Код для дальнейшего использования

### Создание тестовой записи через MCP:
```javascript
mcp__yclients__create_test_booking({
  phone: "79001234567",
  appointments: [{
    id: 0,
    services: [18356344],
    staff_id: 3820250,
    datetime: "2025-07-23T14:00:00"
  }],
  fullname: "Test Client",
  comment: "Test booking"
})
```

### Отмена записи через MCP:
```javascript
mcp__yclients__cancel_booking({
  record_id: 1199065365
})
```