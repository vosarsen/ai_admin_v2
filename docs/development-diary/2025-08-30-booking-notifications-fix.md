# Исправление системы уведомлений о создании записи и склонений

**Дата**: 30 августа 2025
**Автор**: AI Admin Team

## Контекст

Пользователь создал запись на стрижку бороды и усов на 31 августа в 21:00, но столкнулся с двумя проблемами:
1. Не пришло уведомление о создании записи сразу после создания
2. В напоминании за день была ошибка склонения: "Напоминаем о записи на стрижке бороды и усов" вместо "на стрижку бороды и усов"

## Анализ проблем

### Проблема 1: Отсутствие уведомления о создании
При анализе логов обнаружено:
```
📝 New booking 1250977044 created externally, sending confirmation
❌ Error processing booking 1250977044: this.sendBookingConfirmation is not a function
```

Метод `sendBookingConfirmation` не существовал в коде booking-monitor.

### Проблема 2: Неправильное склонение
В базе данных для услуги "СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)" в поле `prepositional_na` было значение "стрижке бороды и усов" (предложный падеж), хотя должен быть винительный падеж "стрижку бороды и усов" для конструкции "записаться на что?".

## Решение

### 1. Добавлен метод sendBookingConfirmation

В файл `src/services/booking-monitor/index.js` добавлен новый метод:

```javascript
async sendBookingConfirmation(record) {
  try {
    const phone = this.formatPhoneNumber(record.client?.phone || record.phone || '');
    if (!phone) {
      logger.warn(`⚠️ No phone number for booking ${record.id}`);
      return;
    }

    // Форматируем сообщение
    const date = formatDate(new Date(record.datetime));
    const time = formatTime(new Date(record.datetime));
    const services = record.services?.map(s => s.title || s.name).join(', ') || 'Услуга';
    const staff = record.staff?.name || 'Специалист';
    const price = record.services?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;
    
    // Получаем адрес компании
    const { data: company } = await supabase
      .from('companies')
      .select('address')
      .eq('id', record.company_id || config.yclients.companyId)
      .single();
      
    const address = company?.address || 'Малаховка, Южная улица, 38';

    const message = `✅ Ваша запись успешно создана!

📅 ${date} в ${time}
💇 ${services}
👤 Мастер: ${staff}
${price > 0 ? `💰 Стоимость: ${price} руб.\n` : ''}
📍 Адрес: ${address}

До встречи! Если планы изменятся, пожалуйста, предупредите нас заранее.`;

    // Отправляем сообщение
    await this.whatsappClient.sendMessage(phone, message);

    // Сохраняем информацию об отправке
    await supabase
      .from('booking_notifications')
      .insert({
        yclients_record_id: parseInt(record.id),
        phone: phone,
        notification_type: 'booking_created',
        message: message,
        sent_at: new Date().toISOString(),
        company_id: record.company_id || config.yclients.companyId
      });

    logger.info(`✅ booking_created notification sent for booking ${record.id} to ${phone}`);
    
  } catch (error) {
    logger.error(`❌ Error sending booking confirmation for ${record.id}:`, error);
  }
}
```

### 2. Исправлены склонения в базе данных

Создан скрипт `scripts/fix-beard-declension.js` для исправления склонений:

```javascript
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function fixDeclension() {
  // Получаем текущие склонения
  const { data: service, error: fetchError } = await supabase
    .from('services')
    .select('id, title, declensions')
    .eq('title', 'СТРИЖКА БОРОДЫ И УСОВ (ДО 6ММ)')
    .single();
  
  // Исправляем prepositional_na на винительный падеж
  const updatedDeclensions = {
    ...service.declensions,
    prepositional_na: 'стрижку бороды и усов' // Винительный падеж для "на что?"
  };
  
  // Обновляем в базе
  const { error: updateError } = await supabase
    .from('services')
    .update({ declensions: updatedDeclensions })
    .eq('id', service.id);
    
  if (updateError) {
    console.error('Error updating declensions:', updateError);
  } else {
    console.log('✅ Successfully updated declensions for "СТРИЖКА БОРОДЫ И УСОВ"');
    console.log('New prepositional_na:', updatedDeclensions.prepositional_na);
  }
}

fixDeclension();
```

### 3. Исправлены другие ошибки

Также были исправлены:
- Дублирование переменной `tomorrow` → `tomorrowDateCheck`
- Использование правильной таблицы `bookings` вместо несуществующей `booking_states`
- Исправлены названия полей для совместимости с таблицей bookings (`visit_attendance` вместо `attendance`, `cost` вместо `price`)

## Результаты

После внесения исправлений:
1. ✅ Уведомления о создании записи отправляются корректно для новых записей со статусом attendance = 0
2. ✅ Склонения в напоминаниях теперь правильные: "Напоминаем о записи на стрижку бороды и усов"
3. ✅ Система различает статусы записей:
   - attendance = 0 (ожидается) → отправляет уведомление о создании
   - attendance = 1 (пришел) → не отправляет уведомления
   - attendance = 2 (подтвержден) → не отправляет уведомления
   - attendance = -1 (отменен) → отправляет уведомление об отмене

## Технические детали

### Измененные файлы:
- `src/services/booking-monitor/index.js` - добавлен метод sendBookingConfirmation, исправлены ошибки
- `scripts/fix-beard-declension.js` - скрипт для исправления склонений в БД
- `scripts/delete-booking.js` - вспомогательный скрипт для тестирования

### Коммиты:
- `fix: исправлена синтаксическая ошибка с двойным объявлением tomorrow`
- `fix: исправлена логика отправки уведомлений при создании и отмене записей`
- `fix: исправлен booking-monitor для использования таблицы bookings вместо несуществующей booking_states`
- `fix: добавлен метод sendBookingConfirmation и исправлено склонение для стрижки бороды`
- `fix: исправлена переменная окружения в скрипте fix-beard-declension`

## Уроки на будущее

1. **Тестирование склонений**: При добавлении новых услуг важно проверять корректность всех падежей, особенно `prepositional_na` (винительный падеж для "на что?")

2. **Консистентность методов**: При вызове несуществующих методов нужно сразу их создавать или использовать существующие

3. **Логирование**: Детальное логирование помогло быстро найти проблему с отсутствующим методом

4. **Статусы записей в YClients**:
   - 0 = ожидается (отправляем уведомление о создании)
   - 1 = пришел (не отправляем)
   - 2 = подтвержден (не отправляем)
   - -1 = отменен (отправляем уведомление об отмене)