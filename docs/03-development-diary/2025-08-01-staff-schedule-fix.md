# Исправление отображения расписания мастеров - August 1, 2025

## Проблема
Бот неправильно сообщал о доступности мастеров. В конкретном случае сказал "Бари не работает завтра", хотя мастер был в расписании и имел доступные слоты для записи.

## Анализ проблемы

### Пример из логов
```
Клиент: "Можно на завтра к Бари?"
Бот: "Бари не работает завтра. Он работает в следующие дни: ..."
Администратор: "Бари работает завтра. Ошибка системы"
```

### Первопричина
Методы `formatStaffSchedules` и `formatTodayStaff` в модуле formatter отображали ВСЕХ мастеров из расписания без проверки их фактической доступности.

Проблемный код:
```javascript
// Старый код просто перечислял всех мастеров
const staffNames = daySchedule.map(s => {
  const staffInfo = staffList.find(staff => staff.id === s.staff_id);
  return staffInfo ? staffInfo.name : `Мастер ${s.staff_id}`;
});
```

### Важные поля в БД
В таблице `staff_schedules` есть два критических поля:
- `is_working` (boolean) - работает ли мастер в этот день
- `has_booking_slots` (boolean) - есть ли у мастера доступные слоты

## Решение

### Изменения в formatter.js

#### formatStaffSchedules (строки 358-386)
```javascript
formatStaffSchedules(scheduleByDate, staffList) {
  if (!scheduleByDate || Object.keys(scheduleByDate).length === 0) {
    return 'Расписание не загружено';
  }

  const lines = [];
  const dates = Object.keys(scheduleByDate).sort();
  
  dates.forEach(date => {
    const daySchedule = scheduleByDate[date];
    
    // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: фильтруем только работающих мастеров с доступными слотами
    const workingStaff = daySchedule.filter(s => s.is_working && s.has_booking_slots);
    
    if (workingStaff.length === 0) {
      lines.push(`${this.formatDateForDisplay(date)}: никто не работает`);
    } else {
      const staffNames = workingStaff.map(s => {
        const staffInfo = staffList.find(staff => staff.id === s.staff_id);
        return staffInfo ? staffInfo.name : `Мастер ${s.staff_id}`;
      });
      
      lines.push(`${this.formatDateForDisplay(date)}: ${staffNames.join(', ')}`);
    }
  });
  
  return lines.join('\n');
}
```

#### formatTodayStaff (строки 302-324)
```javascript
formatTodayStaff(todaySchedule, staffList) {
  if (!todaySchedule || todaySchedule.length === 0) {
    return 'Сегодня никто не работает';
  }

  // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: фильтруем только работающих мастеров с доступными слотами
  const workingToday = todaySchedule.filter(s => s.is_working && s.has_booking_slots);
  
  if (workingToday.length === 0) {
    return 'Сегодня никто не работает';
  }

  const staffInfo = workingToday.map(schedule => {
    const staff = staffList.find(s => s.id === schedule.staff_id);
    if (!staff) return `Мастер ${schedule.staff_id}`;
    
    const workTime = schedule.work_start && schedule.work_end
      ? ` (${schedule.work_start.substring(0, 5)}-${schedule.work_end.substring(0, 5)})`
      : '';
    
    return `${staff.name}${workTime}`;
  });

  return `Сегодня работают: ${staffInfo.join(', ')}`;
}
```

## Технические детали

### Структура данных staff_schedules
```javascript
{
  staff_id: 123,
  date: "2025-08-01",
  work_start: "09:00:00",
  work_end: "20:00:00",
  is_working: true,        // Работает ли в этот день
  has_booking_slots: true  // Есть ли доступные слоты
}
```

### Логика фильтрации
```javascript
// Мастер показывается в расписании только если:
s.is_working === true && s.has_booking_slots === true
```

## Результат

### До исправления
- Показывались все мастера из расписания
- Клиенты получали неверную информацию
- Требовалось вмешательство администратора

### После исправления
- Показываются только мастера, которые работают И имеют доступные слоты
- Информация всегда актуальная
- Нет противоречий между словами бота и реальностью

## Тестирование

### Сценарий 1: Мастер не работает
```
is_working: false, has_booking_slots: false
Результат: Мастер НЕ показывается в списке работающих ✅
```

### Сценарий 2: Мастер работает, но нет слотов
```
is_working: true, has_booking_slots: false
Результат: Мастер НЕ показывается (нет смысла предлагать) ✅
```

### Сценарий 3: Мастер работает и есть слоты
```
is_working: true, has_booking_slots: true
Результат: Мастер показывается в списке ✅
```

## Deployment

```bash
# Коммит
git add src/services/ai-admin-v2/modules/formatter.js
git commit -m "fix: исправлено отображение расписания мастеров - учитываются is_working и has_booking_slots"

# Деплой
git push origin main
ssh root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"
```

## Важные замечания

1. Поля `is_working` и `has_booking_slots` обновляются при синхронизации с YClients
2. Если мастер отменил все записи на день, `has_booking_slots` становится false
3. Логика работает для всех методов отображения расписания