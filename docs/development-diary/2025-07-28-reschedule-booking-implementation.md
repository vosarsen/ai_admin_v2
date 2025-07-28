# Реализация функции переноса записи (RESCHEDULE_BOOKING)

## Дата: 28 июля 2025

## Контекст
После успешной реализации функции отмены записи, следующей задачей было добавить возможность переноса записи на другое время через WhatsApp бота.

## Что было сделано

### 1. Добавлен метод rescheduleRecord в YClientsClient

**Файл**: `src/integrations/yclients/client.js`

Добавлен новый метод для переноса записи через YClients API:

```javascript
async rescheduleRecord(companyId, recordId, datetime, comment = '') {
  try {
    logger.info(`📅 Rescheduling record ${recordId} to ${datetime}`, {
      companyId,
      recordId,
      datetime,
      comment
    });

    const result = await this.request(
      'PUT',
      `book_record/${companyId}/${recordId}`,
      {
        datetime,
        comment
      },
      {}
    );

    if (result.success) {
      logger.info(`✅ Successfully rescheduled record ${recordId} to ${datetime}`);
      return {
        success: true,
        data: result.data
      };
    }

    return {
      success: false,
      error: result.meta?.message || 'Failed to reschedule record'
    };
  } catch (error) {
    logger.error('❌ Error rescheduling record:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 2. Полная реализация rescheduleBooking в CommandHandler

**Файл**: `src/services/ai-admin-v2/modules/command-handler.js`

Заменена временная заглушка на полноценную реализацию:

```javascript
async rescheduleBooking(params, context) {
  const phone = context.phone.replace('@c.us', '');
  const companyId = context.company.yclients_id || context.company.company_id;
  
  try {
    // Получаем список записей клиента
    logger.info('📋 Getting bookings for reschedule', { phone, companyId });
    const bookingsResult = await bookingService.getClientBookings(phone, companyId);
    
    if (!bookingsResult.success || !bookingsResult.data || bookingsResult.data.length === 0) {
      return {
        success: false,
        error: 'У вас нет активных записей'
      };
    }
    
    // Фильтруем только будущие записи
    const now = new Date();
    const futureBookings = bookingsResult.data.filter(booking => {
      const bookingDate = new Date(booking.datetime);
      return bookingDate > now;
    });
    
    if (futureBookings.length === 0) {
      return {
        success: false,
        error: 'У вас нет предстоящих записей для переноса'
      };
    }
    
    // Если не указаны новые дата и время, запрашиваем их
    if (!params.date || !params.time) {
      return {
        success: false,
        needsDateTime: true,
        bookings: futureBookings,
        message: 'На какую дату и время вы хотите перенести запись?'
      };
    }
    
    // Берем последнюю запись для переноса
    const bookingToReschedule = futureBookings[0];
    const recordId = bookingToReschedule.id;
    
    // Парсим новую дату и время
    const targetDate = this.parseDate(params.date);
    const newDateTime = `${targetDate} ${params.time}:00`;
    const isoDateTime = new Date(newDateTime).toISOString();
    
    logger.info('📅 Attempting to reschedule booking', {
      recordId,
      currentDateTime: bookingToReschedule.datetime,
      newDateTime: isoDateTime,
      staffId: bookingToReschedule.staff?.id,
      services: bookingToReschedule.services
    });
    
    // Пытаемся перенести запись через простой API
    const rescheduleResult = await yclientsClient.rescheduleRecord(
      companyId,
      recordId,
      isoDateTime,
      `Перенос записи через WhatsApp бота`
    );
    
    if (rescheduleResult.success) {
      logger.info('✅ Successfully rescheduled booking', { recordId, newDateTime });
      return {
        success: true,
        oldDateTime: bookingToReschedule.datetime,
        newDateTime: isoDateTime,
        services: bookingToReschedule.services,
        staff: bookingToReschedule.staff
      };
    }
    
    // Если простой метод не сработал, пробуем через полное обновление
    logger.warn('Simple reschedule failed, trying full update', { error: rescheduleResult.error });
    
    const updateResult = await yclientsClient.updateRecord(
      companyId,
      recordId,
      {
        datetime: isoDateTime,
        staff_id: bookingToReschedule.staff?.id || bookingToReschedule.staff_id,
        services: bookingToReschedule.services?.map(s => ({
          id: s.id,
          cost: s.cost || s.price_min || 0,
          discount: s.discount || 0
        })) || [],
        client: {
          phone: phone,
          name: context.client?.name || bookingToReschedule.client?.name || '',
          email: bookingToReschedule.client?.email || ''
        },
        comment: `Перенос записи через WhatsApp бота с ${bookingToReschedule.datetime} на ${isoDateTime}`
      }
    );
    
    if (updateResult.success) {
      logger.info('✅ Successfully rescheduled booking via full update', { recordId, newDateTime });
      return {
        success: true,
        oldDateTime: bookingToReschedule.datetime,
        newDateTime: isoDateTime,
        services: bookingToReschedule.services,
        staff: bookingToReschedule.staff
      };
    }
    
    // Если ничего не сработало, возвращаем инструкции
    return {
      success: false,
      temporaryLimitation: true,
      error: updateResult.error || 'Не удалось перенести запись',
      message: 'К сожалению, не удалось перенести запись через бота.',
      instructions: [
        '📱 Перенесите запись через мобильное приложение YClients',
        '💻 Перенесите запись на сайте yclients.com',
        `📞 Позвоните администратору: ${context.company?.phones?.[0] || '+7 (XXX) XXX-XX-XX'}`
      ]
    };
    
  } catch (error) {
    logger.error('Error in rescheduleBooking:', error);
    return {
      success: false,
      error: error.message || 'Произошла ошибка при переносе записи'
    };
  }
}
```

### 3. Добавлено форматирование подтверждения переноса

**Файл**: `src/services/ai-admin-v2/modules/formatter.js`

Добавлен метод для красивого форматирования подтверждения:

```javascript
formatRescheduleConfirmation(data) {
  try {
    if (!data || !data.newDateTime) {
      return '';
    }

    const oldDate = new Date(data.oldDateTime);
    const newDate = new Date(data.newDateTime);
    
    // Форматируем даты
    const formatter = new Intl.DateTimeFormat('ru', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const oldFormatted = formatter.format(oldDate);
    const newFormatted = formatter.format(newDate);
    
    let response = `✅ ✅ Запись успешно перенесена!\n\n`;
    response += `📋 Детали переноса:\n`;
    response += `❌ Старое время: ${oldFormatted}\n`;
    response += `✅ Новое время: ${newFormatted}\n`;
    
    if (data.services && data.services.length > 0) {
      const serviceName = data.services[0].title || data.services[0].name || 'Услуга';
      response += `💇 Услуга: ${serviceName}\n`;
    }
    
    if (data.staff) {
      const staffName = data.staff.name || data.staff.title || 'Мастер';
      response += `👤 Мастер: ${staffName}\n`;
    }
    
    response += `\n💬 _Ждём вас в новое время! Если планы изменятся, пожалуйста, предупредите заранее._`;
    
    return response;
  } catch (error) {
    logger.error('Error formatting reschedule confirmation:', error);
    return '✅ Запись успешно перенесена!';
  }
}
```

### 4. Обновлена обработка результата в AI Admin v2

**Файл**: `src/services/ai-admin-v2/index.js`

Обновлена обработка результата команды RESCHEDULE_BOOKING:

```javascript
} else if (result.data && result.data.success) {
  // Успешный перенос
  const formatter = this.responseFormatter;
  const formattedResult = formatter.formatRescheduleConfirmation(result.data);
  if (formattedResult && formattedResult !== '') {
    finalResponse += '\n\n' + formattedResult;
  } else {
    finalResponse += '\n\n✅ Запись успешно перенесена!';
  }
} else if (result.data && result.data.needsDateTime) {
  // Запрашиваем дату и время
  finalResponse += '\n\n' + result.data.message;
```

## Технические детали

### Два метода переноса записи в YClients API:

1. **PUT /book_record/{company_id}/{record_id}** - простой метод
   - Требует только новые дату/время и комментарий
   - Быстрый и простой
   - Может не работать в некоторых случаях

2. **PUT /record/{company_id}/{record_id}** - полное обновление
   - Требует все данные записи (мастер, услуги, клиент)
   - Более надежный, но сложнее
   - Используется как fallback

### Логика работы:

1. Получаем все активные записи клиента
2. Фильтруем только будущие записи
3. Если не указаны новые дата/время - запрашиваем
4. Берем последнюю запись для переноса
5. Пробуем простой метод переноса
6. Если не получилось - пробуем полное обновление
7. Если ничего не сработало - показываем альтернативные способы

## Проблемы и решения

### Проблема 1: Синтаксические ошибки при деплое

После коммита на сервере появились синтаксические ошибки из-за неправильного мерджа кода.

**Решение**:
1. Удален дублированный код (строки 1123-1166)
2. Добавлена недостающая закрывающая скобка метода
3. Выполнена полная синхронизация с GitHub

### Проблема 2: AI не всегда распознает команду переноса

AI Admin v2 иногда не генерирует команду RESCHEDULE_BOOKING при запросе на перенос записи.

**Возможные решения** (требуют дальнейшей работы):
1. Улучшить промпт для AI с примерами
2. Добавить больше ключевых слов для распознавания
3. Реализовать двухэтапный процесс с явным подтверждением

## Результаты тестирования

### ✅ Успешно протестировано:
- Реализация метода rescheduleRecord в YClientsClient
- Логика получения активных записей
- Форматирование подтверждения переноса
- Fallback на полное обновление записи

### ⚠️ Требует доработки:
- Улучшение распознавания команды AI-ассистентом
- Тестирование с различными сценариями (разные услуги, мастера)
- Обработка edge cases (перенос на занятое время, нерабочие часы)

## Команды для тестирования

```bash
# Создать тестовую запись
"Запиши меня к Сергею на стрижку завтра в 15:00"

# Перенести запись
"Хочу перенести запись на послезавтра в 17:00"
"Перенесите мою запись на другое время"
"Можно изменить время записи?"
```

## Следующие шаги

1. Улучшить промпт AI для лучшего распознавания команды переноса
2. Добавить выбор конкретной записи при наличии нескольких
3. Реализовать проверку доступности нового времени перед переносом
4. Добавить уведомление мастера о переносе записи
5. Интегрировать с системой напоминаний для обновления времени

## Выводы

Функция переноса записи успешно реализована на техническом уровне. Используется двухуровневый подход с fallback механизмом для максимальной надежности. Основная проблема - в распознавании намерения пользователя AI-ассистентом, что требует дополнительной настройки промптов.