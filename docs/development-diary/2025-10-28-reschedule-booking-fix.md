# Исправление переноса записей (RESCHEDULE_BOOKING)

**Дата:** 28 октября 2025
**Автор:** Claude Code
**Статус:** ✅ Реализовано и задеплоено

## Проблема

Клиент Иван пытался перенести свою запись с 20:00 на 19:30, но система ответила:
> "Иван, к сожалению, не удалось проверить доступность времени на 19:30"

### Причина проблемы

При анализе логов были обнаружены **две критические проблемы**:

#### 1. AI не распознавал запросы на перенос

Когда Иван написал **"А могу я перезаписать я на 19.30?"**, система распознала это как `CREATE_BOOKING` вместо `RESCHEDULE_BOOKING`.

**Корневая причина:** В промпте `two-stage-command-prompt.js` команда `RESCHEDULE_BOOKING` упоминалась только в правилах (строки 138, 185), но **не была описана в разделе "ДОСТУПНЫЕ КОМАНДЫ"** (строки 84-111).

#### 2. Slot validator отклонил время из-за конфликта с собственной записью

Даже если бы система правильно распознала запрос, возникла бы вторая проблема. Из логов:

```
Slot 19:30 has insufficient time before next booking:
  availableMinutes: 30
  requiredMinutes: 90 (СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ)
  nextBookingTime: 20:00  ← ЭТО ЕГО ЖЕ ЗАПИСЬ!
```

**Корневая причина:** При переносе slot-validator проверял доступность времени 19:30, но **не исключал текущую запись клиента на 20:00** из проверки конфликтов.

**Логика конфликта:**
- Слот 19:30 + услуга 90 мин = окончание в 21:00
- Следующая запись: 20:00 (его же запись!)
- Доступное время до следующей записи: 30 мин < 90 мин требуется
- Результат: ❌ Слот отклонен

## Решение

### 1. Добавлена команда RESCHEDULE_BOOKING в промпт

**Файл:** `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js`

**Изменения (строки 100-116):**

```javascript
4. RESCHEDULE_BOOKING - перенос существующей записи
   Параметры: date (новая дата), time (новое время)
   Когда: клиент хочет ПЕРЕНЕСТИ/ПЕРЕЗАПИСАТЬ/ИЗМЕНИТЬ время существующей записи
   Ключевые слова: "перезаписать", "перенести", "изменить время", "поменять время", "другое время", "можно перенести"
   ВАЖНО: Используй эту команду, когда у клиента УЖЕ ЕСТЬ запись и он хочет её перенести
```

**Обновлены правила выбора команд (строки 118-127):**

```javascript
ПРАВИЛА ВЫБОРА КОМАНД:
- Без конкретного времени → SEARCH_SLOTS
- С конкретным временем + НЕТ записи → CREATE_BOOKING
- С конкретным временем + ЕСТЬ запись + хочет изменить → RESCHEDULE_BOOKING
- Проверка доступности → SEARCH_SLOTS
- Вопрос о мастере → CHECK_STAFF_SCHEDULE
- Вопросы о ценах/услугах/прайсе → SHOW_PRICES
- Вопросы "что это?", "что такое?" про услугу → EXPLAIN_SERVICE
- Отмена → CANCEL_BOOKING
- Перенос/перезапись → RESCHEDULE_BOOKING
```

**Добавлены примеры (строки 192-196):**

```javascript
6. Перенос записи (RESCHEDULE_BOOKING)
   "Могу я перезаписать на 19:30?" → {"commands": [{"name": "RESCHEDULE_BOOKING", "params": {"date": "сегодня", "time": "19:30"}}]}
   "Можно перенести на завтра в 15:00?" → {"commands": [{"name": "RESCHEDULE_BOOKING", "params": {"date": "завтра", "time": "15:00"}}]}
   "Давайте изменим время на 14:00" → {"commands": [{"name": "RESCHEDULE_BOOKING", "params": {"date": "сегодня", "time": "14:00"}}]}
```

### 2. Slot-validator теперь исключает текущую запись

**Файл:** `src/services/booking/slot-validator.js`

**Изменения в validateSlots() (строки 14-27):**

```javascript
validateSlots(slots, existingBookings = [], serviceDuration = null, workingHours = null, excludeRecordId = null) {
  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  // Если передан excludeRecordId, фильтруем записи
  if (excludeRecordId) {
    logger.info(`Excluding record ID ${excludeRecordId} from validation (rescheduling)`);
    existingBookings = existingBookings.filter(booking =>
      booking.id !== excludeRecordId &&
      booking.record_id !== excludeRecordId &&
      booking.yclients_id !== excludeRecordId
    );
  }

  logger.info(`Validating ${slots.length} slots against ${existingBookings.length} existing bookings`);
  // ...
}
```

**Изменения в validateSlotsWithBookings() (строка 425):**

```javascript
async validateSlotsWithBookings(slots, yclientsClient, companyId, staffId, date, serviceDuration = null, workingHours = null, service = null, excludeRecordId = null) {
  // Получаем существующие записи
  const existingBookings = await this.getStaffBookings(
    yclientsClient,
    companyId,
    staffId,
    date
  );

  // Валидируем слоты с учетом длительности услуги и рабочих часов
  let validSlots = this.validateSlots(slots, existingBookings, serviceDuration, workingHours, excludeRecordId);
  // ...
}
```

### 3. BookingService передает excludeRecordId

**Файл:** `src/services/booking/index.js`

**Изменения в getAvailableSlots() (строки 132-178):**

```javascript
async getAvailableSlots(staffId, date, serviceId, companyId = config.yclients.companyId, validateSlots = false, serviceDuration = null, service = null, excludeRecordId = null) {
  try {
    // Слоты всегда получаем из YClients (они динамические)
    const result = await this.getYclientsClient().getAvailableSlots(staffId, date, { service_id: serviceId }, companyId);

    // Если нужна валидация и запрос успешен
    if (validateSlots && result.success && result.data) {
      const slots = Array.isArray(result.data) ? result.data :
                   (result.data.data ? result.data.data : []);

      if (slots.length > 0) {
        logger.info(`Validating ${slots.length} slots for staff ${staffId} on ${date}`);

        if (excludeRecordId) {
          logger.info(`Excluding record ID ${excludeRecordId} from validation (rescheduling)`);
        }

        // ... получение workingHours и serviceData ...

        // Валидируем слоты с учетом существующих записей, длительности услуги и рабочих часов
        const validSlots = await slotValidator.validateSlotsWithBookings(
          slots,
          this.getYclientsClient(),
          companyId,
          staffId,
          date,
          serviceDuration,
          workingHours,
          serviceData,  // Передаем данные услуги для проверки временных ограничений
          excludeRecordId  // Исключаем текущую запись при переносе
        );
        // ...
      }
    }
    // ...
  }
}
```

### 4. Доработан rescheduleBooking()

**Файл:** `src/services/ai-admin-v2/modules/command-handler.js`

**Изменения (строки 2197-2269):**

```javascript
// Проверяем доступность нового времени
const staffId = bookingToReschedule.staff?.id || bookingToReschedule.staff_id;
const serviceId = bookingToReschedule.services?.[0]?.id || null;

logger.info('🔍 Checking slot availability for reschedule', {
  staffId,
  date: targetDate,
  time: time,
  serviceId,
  excludeRecordId: recordId
});

// Получаем длительность услуги для валидации
let serviceDuration = null;
if (serviceId) {
  try {
    const servicesResult = await bookingService.getServices({ service_id: serviceId }, companyId);
    if (servicesResult.success && servicesResult.data && servicesResult.data.length > 0) {
      serviceDuration = servicesResult.data[0].seance_length;
      logger.info(`Service duration for validation: ${serviceDuration / 60} minutes`);
    }
  } catch (err) {
    logger.warn('Could not get service duration for validation:', err.message);
  }
}

// Получаем доступные слоты с валидацией, ИСКЛЮЧАЯ текущую запись клиента
const slotsResult = await bookingService.getAvailableSlots(
  staffId,
  targetDate,
  serviceId,
  companyId,
  true, // validateSlots = true
  serviceDuration,
  null, // service object
  recordId // excludeRecordId - исключаем текущую запись!
);

if (slotsResult.success) {
  const slots = Array.isArray(slotsResult.data) ? slotsResult.data :
               (slotsResult.data.data ? slotsResult.data.data : []);

  // Проверяем, есть ли нужное время в доступных слотах
  const requestedTime = time;
  const slotAvailable = slots.some(slot => {
    const slotTime = slot.time || slot;
    return slotTime === requestedTime || slotTime === `${requestedTime}:00`;
  });

  if (!slotAvailable) {
    // Находим ближайшие доступные слоты
    const nearbySlots = slots
      .map(slot => slot.time || slot)
      .filter(slotTime => {
        const slotHour = parseInt(slotTime.split(':')[0]);
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

## Как это работает

### До исправления:

1. Клиент: "Могу я перезаписать на 19:30?"
2. AI: Распознал как `CREATE_BOOKING`
3. Система: Проверяет 19:30
4. Slot-validator: Видит запись на 20:00 (не знает, что это запись клиента)
5. Slot-validator: 19:30-21:00 конфликтует с 20:00-21:30 ❌
6. Результат: "Время недоступно"

### После исправления:

1. Клиент: "Могу я перезаписать на 19:30?"
2. AI: Распознал как `RESCHEDULE_BOOKING` ✅
3. Система: Находит текущую запись клиента (ID = 12345, время 20:00)
4. Система: Проверяет 19:30, передав `excludeRecordId: 12345`
5. Slot-validator: Исключает запись 12345 из проверки
6. Slot-validator: 19:30-21:00 свободно! ✅
7. Система: Переносит запись с 20:00 на 19:30
8. Результат: "Записал вас на 19:30"

## Пример из реальной жизни

**Ситуация Ивана:**
- Текущая запись: 28 октября, 20:00, СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ (90 мин)
- Запрос: "А могу я перезаписать я на 19.30?"

**Без исправления:**
```
YClients API возвращает слоты: [17:30, 18:00, 19:30, 21:30]

Slot-validator проверяет 19:30:
  - Начало: 19:30
  - Окончание: 21:00 (19:30 + 90 мин)
  - Следующая запись: 20:00 (запись Ивана!)
  - Доступное время: 30 мин
  - Требуется: 90 мин
  - Результат: ❌ ОТКЛОНЕН

Ответ бота: "К сожалению, не удалось проверить доступность времени"
```

**С исправлением:**
```
YClients API возвращает слоты: [17:30, 18:00, 19:30, 21:30]

Slot-validator проверяет 19:30 с excludeRecordId=12345:
  - Исключает запись 12345 из проверки
  - Начало: 19:30
  - Окончание: 21:00 (19:30 + 90 мин)
  - Следующая запись: нет (запись на 20:00 исключена)
  - Результат: ✅ ДОСТУПЕН

API YClients: Перенос записи 12345 с 20:00 на 19:30 → Успешно
Ответ бота: "Иван, записал вас на 19:30"
```

## Тестирование

### Сценарий теста:

1. Создать запись на сегодня 20:00 к Сергею (СТРИЖКА + МОДЕЛИРОВАНИЕ БОРОДЫ)
2. Написать: "Могу я перезаписать на 19:30?"
3. Ожидаемый результат: Успешный перенос

### Проверки:

- ✅ AI распознает как `RESCHEDULE_BOOKING`
- ✅ Система находит текущую запись
- ✅ Slot-validator исключает текущую запись из проверки
- ✅ 19:30 определяется как доступное время
- ✅ Запись успешно переносится

## Файлы изменений

1. `src/services/ai-admin-v2/prompts/two-stage-command-prompt.js` - Добавлена команда RESCHEDULE_BOOKING
2. `src/services/booking/slot-validator.js` - Добавлен excludeRecordId
3. `src/services/booking/index.js` - Передача excludeRecordId
4. `src/services/ai-admin-v2/modules/command-handler.js` - Использование excludeRecordId в rescheduleBooking

## Коммиты

- `0f91694` - fix: улучшена обработка переноса записей через RESCHEDULE_BOOKING
- `40b84a9` - fix: исправлена дублирующаяся декларация recordId в rescheduleBooking

## Развертывание

**Дата деплоя:** 28 октября 2025, 17:32 UTC
**Сервер:** 46.149.70.219
**Статус:** ✅ Успешно развернуто

```bash
cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2
```

## Влияние на другие функции

**Положительное:**
- Улучшена обработка всех запросов на перенос записей
- Более точное распознавание намерений клиента
- Уменьшение ложных отказов при переносе

**Риски:**
- Минимальные, т.к. добавлен новый параметр с дефолтным значением `null`
- Обратная совместимость сохранена

## Метрики успеха

**До исправления:**
- Успешность переноса записей: ~70% (оценка)
- Частые жалобы на "время недоступно"

**После исправления (ожидается):**
- Успешность переноса записей: ~95%
- Снижение жалоб на недоступность времени

## Связанные документы

- `docs/investigation/bashir_no_slots_incident_2025-10-28.md` - Полное расследование инцидента
- `docs/investigation/bashir_incident_solution.md` - Детальное описание решения
- `docs/features/REMINDER_VISIT_CONFIRMATION.md` - Связанная функциональность подтверждения визитов

## Заметки для будущего

1. **Мониторинг:** Отслеживать успешность RESCHEDULE_BOOKING в логах
2. **Улучшения:** Рассмотреть автоматическое предложение альтернативных слотов при конфликте
3. **UX:** Добавить проактивное уведомление о возможности переноса при изменении планов

## Выводы

Исправление решает критическую проблему с переносом записей, когда система отклоняла доступное время из-за конфликта с собственной записью клиента. Теперь клиенты могут свободно переносить свои записи без технических ограничений.

---

**Статус:** ✅ Завершено
**Версия:** 2.0.0
**Автор:** Claude Code
**Дата:** 28.10.2025
