# Исправление логики webhook уведомлений

**Дата**: 07.08.2025  
**Автор**: AI Admin Development Team  
**Проблема**: Некорректные уведомления при изменении статуса записи  
**Статус**: ✅ Решено

## Контекст проблемы

Были обнаружены две критические проблемы с webhook уведомлениями от YClients:

### Проблема 1: Лишние уведомления при статусе "пришел"
- **Сценарий**: Клиент записался и пришел в барбершоп. Администратор отметил статус "пришел"
- **Ошибка**: Клиенту приходило уведомление "Ваша запись изменена"
- **Ожидание**: Уведомление НЕ должно отправляться при изменении статуса на "пришел"

### Проблема 2: Неверный текст при отмене записи
- **Сценарий**: Клиент отменяет запись через бота
- **Ошибка**: Приходило уведомление "Ваша запись изменена" 
- **Ожидание**: Должно приходить "Ваша запись отменена"

## Анализ причины

Webhook processor не различал типы изменений записи:
1. Не проверял поле `attendance` / `visit_attendance` для определения статуса визита
2. Не обрабатывал отмену записи (attendance = -1) как удаление
3. Отправлял уведомления при любом изменении записи

## Решение

### 1. Добавлена проверка статуса визита

```javascript
// ВАЖНО: Игнорируем изменения статуса "пришел" (attendance = 1)
if (recordData.attendance === 1 || recordData.visit_attendance === 1 || 
    recordData.attendance === '1' || recordData.visit_attendance === '1') {
  logger.info('✅ Client marked as arrived, skipping notification');
  return;
}
```

### 2. Обработка отмены как удаления

```javascript
// Проверяем, не является ли это отменой записи (attendance = -1)
if (recordData.attendance === -1 || recordData.visit_attendance === -1 ||
    recordData.attendance === '-1' || recordData.visit_attendance === '-1' ||
    recordData.deleted === true || recordData.is_deleted === true) {
  logger.info('❌ Record marked as cancelled, handling as deletion');
  return await this.handleRecordDeleted(recordData, companyId);
}
```

### 3. Добавлен метод проверки изменений

```javascript
isOnlyAttendanceChange(changes, oldRecord, newRecord) {
  // Если есть другие изменения кроме attendance - это не только attendance
  if (Object.keys(changes).length > 0) {
    return false;
  }
  
  // Проверяем изменилась ли посещаемость
  if (oldRecord) {
    const oldAttendance = oldRecord.attendance || oldRecord.visit_attendance;
    const newAttendance = newRecord.attendance || newRecord.visit_attendance;
    
    // Если изменилась посещаемость но нет других изменений
    if (oldAttendance !== newAttendance) {
      return true;
    }
  }
  
  return false;
}
```

### 4. Улучшен формат сообщения об отмене

```javascript
formatCancellationMessage(record, companyInfo) {
  let message = `❌ *Ваша запись отменена*\n\n`;
  message += `Была: ${dateStr} в ${timeStr}\n`;
  
  if (services && services !== 'Услуга') {
    message += `Услуга: ${services}\n`;
  }
  
  if (record.staff?.name) {
    message += `Мастер: ${record.staff.name}\n`;
  }
  
  message += `\nХотите записаться на другое время? Напишите мне!`;
  
  return message;
}
```

## Файлы изменены

1. `/src/services/webhook-processor/index.js` - основная логика обработки webhook

## Результаты

### ✅ Исправлено:
1. **Статус "пришел"** - уведомления больше не отправляются
2. **Отмена записи** - отправляется корректное сообщение "Запись отменена"
3. **Логирование** - добавлено детальное логирование для отладки

### 📊 Логика уведомлений теперь:
- **Создание записи** → "Вы записаны!" ✅
- **Изменение времени/услуги/мастера** → "Ваша запись изменена" ✅
- **Статус "пришел"** → Без уведомления ✅
- **Отмена записи** → "Ваша запись отменена" ✅

## Технические детали

### Статусы YClients API:
- `attendance = 0` - не отмечен
- `attendance = 1` - пришел
- `attendance = -1` - не пришел/отменен
- `deleted = true` - запись удалена

### Webhook события:
- `record.created` - новая запись
- `record.updated` - изменение записи (включая статусы)
- `record.deleted` - удаление записи

## Уроки и рекомендации

1. **Важность понимания API**: Необходимо детально изучать структуру данных webhook
2. **Фильтрация событий**: Не все изменения требуют уведомления клиента
3. **Ясность сообщений**: Разные события требуют разных формулировок
4. **Тестирование webhook**: Нужно тестировать все возможные сценарии изменения записи

## Заключение

Проблемы с некорректными уведомлениями успешно решены. Система теперь корректно обрабатывает все типы изменений записи и отправляет уведомления только когда это действительно необходимо клиенту.