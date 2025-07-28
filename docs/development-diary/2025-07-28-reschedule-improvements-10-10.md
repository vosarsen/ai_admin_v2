# Улучшение функции переноса записи до 10/10

## Дата: 28 июля 2025 (вечер)

## Контекст
После базовой реализации функции переноса записи требовалось довести её до идеального состояния (10/10), устранив все недостатки и добавив важные функции.

## Что было сделано

### 1. ✅ Добавлена проверка доступности времени перед переносом

**Файл**: `src/services/ai-admin-v2/modules/command-handler.js`

Теперь перед переносом система проверяет, доступно ли новое время:

```javascript
// Проверяем доступность нового времени
const staffId = bookingToReschedule.staff?.id || bookingToReschedule.staff_id;
const serviceIds = bookingToReschedule.services?.map(s => s.id) || [];

// Получаем доступные слоты
const slotsResult = await yclientsClient.getAvailableSlots(
  staffId,
  targetDate,
  { service_ids: serviceIds },
  companyId
);

if (slotsResult.success && Array.isArray(slotsResult.data)) {
  // Проверяем, есть ли нужное время в доступных слотах
  const slotAvailable = slotsResult.data.some(slot => {
    const slotTime = slot.time || slot;
    return slotTime === requestedTime || slotTime === `${requestedTime}:00`;
  });
  
  if (!slotAvailable) {
    // Находим ближайшие доступные слоты
    const nearbySlots = slotsResult.data
      .map(slot => slot.time || slot)
      .filter(time => {
        const slotHour = parseInt(time.split(':')[0]);
        const requestedHour = parseInt(requestedTime.split(':')[0]);
        return Math.abs(slotHour - requestedHour) <= 2; // В пределах 2 часов
      })
      .slice(0, 3);
    
    return {
      success: false,
      slotNotAvailable: true,
      requestedTime: requestedTime,
      nearbySlots: nearbySlots,
      message: `К сожалению, время ${requestedTime} уже занято.`,
      suggestions: nearbySlots.length > 0 
        ? `Доступное время поблизости: ${nearbySlots.join(', ')}`
        : 'В этот день нет доступного времени рядом с желаемым.'
    };
  }
}
```

### 2. ✅ Реализован выбор конкретной записи из нескольких

**Файл**: `src/services/ai-admin-v2/modules/command-handler.js`

При наличии нескольких активных записей система показывает их список:

```javascript
// Если у клиента несколько записей, показываем их список
if (futureBookings.length > 1) {
  const bookingsList = futureBookings.map((booking, index) => {
    const date = new Date(booking.datetime);
    const dateStr = formatter.formatDate(date);
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const serviceName = booking.services?.[0]?.title || booking.services?.[0]?.name || 'Услуга';
    const staffName = booking.staff?.name || 'Мастер';
    return `${index + 1}. ${dateStr} в ${timeStr} - ${serviceName} (${staffName})`;
  }).join('\n');
  
  return {
    success: false,
    needsDateTime: true,
    multipleBookings: true,
    bookings: futureBookings,
    message: `У вас есть несколько записей:\n\n${bookingsList}\n\nКакую запись хотите перенести? Укажите номер и новые дату/время.`
  };
}
```

### 3. ✅ Улучшено распознавание команды переноса в AI промпте

**Файл**: `src/services/ai-admin-v2/index.js`

Добавлены дополнительные фразы и приоритет для команды RESCHEDULE_BOOKING:

```javascript
// В разделе АНАЛИЗ НАМЕРЕНИЯ КЛИЕНТА
🔴 ПРИОРИТЕТ #1 - ПЕРЕНОС ЗАПИСИ:
Если клиент упоминает слова: "перенести", "изменить время", "другое время", "другой день", "не подходит время"
→ СРАЗУ используй [RESCHEDULE_BOOKING], НЕ CHECK_STAFF_SCHEDULE!

// В описании команды
10. ПЕРЕНОС ЗАПИСИ - используй [RESCHEDULE_BOOKING] когда клиент:
   - "перенести запись", "перенести визит", "изменить время"
   - "можно перенести на", "давайте перенесем"
   - "хочу изменить дату", "нужно другое время"
   - "перенесите", "измените время", "поменять время"
   - "можно в другое время", "есть ли другое время"
   - "не подходит время", "давайте в другой день"
   - "хочу записаться на другое время/день" (если у клиента УЖЕ ЕСТЬ запись)
   ВАЖНО: если клиент говорит "не смогу прийти" и НЕ просит перенос - используй CANCEL_BOOKING
   КРИТИЧНО: При переносе НЕ ИСПОЛЬЗУЙ CHECK_STAFF_SCHEDULE! Сразу используй RESCHEDULE_BOOKING!
```

### 4. ✅ Добавлено автоматическое обновление напоминаний

**Файл**: `src/services/ai-admin-v2/modules/command-handler.js`

При успешном переносе автоматически обновляются напоминания:

```javascript
// Обновляем напоминания для новой даты
try {
  const reminderService = require('../../reminders/scheduler');
  const phone = context.phone.replace('@c.us', '');
  
  // Отменяем старые напоминания
  await reminderService.cancelRemindersForBooking(recordId);
  
  // Планируем новые напоминания
  await reminderService.scheduleBookingReminders({
    bookingId: recordId,
    bookingDate: isoDateTime,
    clientPhone: phone,
    clientName: context.client?.name || bookingToReschedule.client?.name || 'Клиент',
    serviceName: bookingToReschedule.services?.[0]?.title || 'услуга',
    staffName: bookingToReschedule.staff?.name || 'мастер',
    companyId: companyId
  });
  
  logger.info('✅ Reminders rescheduled for booking', { recordId });
} catch (reminderError) {
  logger.error('Failed to reschedule reminders:', reminderError);
  // Не блокируем основной процесс из-за ошибки с напоминаниями
}
```

### 5. ✅ Обновлена обработка результатов в AI Admin v2

**Файл**: `src/services/ai-admin-v2/index.js`

Добавлена обработка случая, когда время занято:

```javascript
} else if (result.data && result.data.slotNotAvailable) {
  // Время занято, предлагаем альтернативы
  finalResponse += '\n\n' + result.data.message;
  if (result.data.suggestions) {
    finalResponse += '\n\n' + result.data.suggestions;
  }
}
```

### 6. ✅ Исправлена проблема с поиском будущих записей

**Файл**: `src/services/booking/index.js`

Расширен диапазон поиска записей:

```javascript
// Ищем записи за последние 7 дней и на 30 дней вперед, чтобы не пропустить недавно созданные записи
const bookings = await this.getYclientsClient().getRecords(companyId, {
  client_phone: phone,
  start_date: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
  end_date: format(addDays(new Date(), 30), 'yyyy-MM-dd')
});
```

## Технические детали реализации

### Архитектура улучшений:
1. **Двухуровневая проверка доступности** - сначала проверяем доступность времени, потом пытаемся перенести
2. **Интеллектуальные предложения** - если время занято, предлагаем ближайшие доступные слоты
3. **Приоритетная обработка в AI** - перенос записи имеет высший приоритет в анализе намерений
4. **Асинхронное обновление напоминаний** - не блокирует основной процесс

### Результаты тестирования:
- ✅ AI правильно распознает команду переноса (RESCHEDULE_BOOKING)
- ✅ Проверка доступности работает корректно
- ✅ Показ списка записей при множественном выборе работает
- ✅ Напоминания обновляются автоматически
- ⚠️ Обнаружена проблема с кэшированием записей в YClientsClient

## Оставшиеся задачи

1. **Исправить кэширование** - новые записи не видны из-за кэша в YClientsClient
2. **Добавить уведомление мастера** - отправка SMS/push при переносе
3. **Реализовать историю переносов** - логирование всех изменений

## Оценка функционала

### Было (7/10):
- ✅ Базовый перенос записи
- ✅ Fallback на полное обновление
- ❌ Нет проверки доступности
- ❌ Нет выбора из нескольких записей
- ❌ Плохое распознавание команды
- ❌ Напоминания не обновляются

### Стало (9/10):
- ✅ Проверка доступности времени
- ✅ Предложение альтернативных слотов
- ✅ Выбор из нескольких записей
- ✅ Улучшенное распознавание команды
- ✅ Автоматическое обновление напоминаний
- ✅ Приоритетная обработка переноса
- ❌ Проблема с кэшированием (требует исправления)

## Выводы

Функция переноса записи значительно улучшена и теперь предоставляет полноценный пользовательский опыт. Основные улучшения касаются проверки доступности времени, возможности выбора из нескольких записей и автоматического обновления напоминаний. 

Для достижения полных 10/10 необходимо исправить проблему с кэшированием и добавить уведомление мастера о переносе.