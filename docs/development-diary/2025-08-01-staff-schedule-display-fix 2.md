# Staff Schedule Display Fix - August 1, 2025

## Context
При анализе диалога с клиентом Геннадием (+7 988 075-77-77) была обнаружена критическая ошибка: бот сообщил "Бари не работает завтра", хотя мастер был в расписании и имел доступные слоты.

## Problem Analysis

### Root Cause
Метод `formatStaffSchedules` в `formatter.js` отображал всех мастеров из расписания без проверки полей:
- `is_working` - работает ли мастер в этот день
- `has_booking_slots` - есть ли у мастера доступные слоты

Это приводило к тому, что AI видел мастера в списке "не работающих", если у него не было свободных слотов.

### Impact
- Клиенты получали неверную информацию о доступности мастеров
- Администратору приходилось вручную исправлять ошибки бота
- Снижалось доверие к системе

## Solution

### Code Changes

#### 1. `formatStaffSchedules` method
```javascript
// Before:
const staffNames = this.getStaffNames(
  daySchedule.map(s => s.staff_id), 
  staffList
);

// After:
const workingStaff = daySchedule.filter(s => s.is_working && s.has_booking_slots);
if (workingStaff.length === 0) {
  return `${this.formatDateForDisplay(date)}: никто не работает`;
}
const staffNames = this.getStaffNames(
  workingStaff.map(s => s.staff_id), 
  staffList
);
```

#### 2. `formatTodayStaff` method
```javascript
// Added filtering:
const workingSchedules = todaySchedule.filter(s => s.is_working && s.has_booking_slots);

if (workingSchedules.length === 0) {
  logger.warn(`No staff with available slots today (${today})`);
  return "Сегодня никто не работает";
}
```

### Files Modified
- `/src/services/ai-admin-v2/modules/formatter.js`

## Technical Details

### Database Schema
Таблица `staff_schedules` содержит поля:
- `staff_id` - ID мастера
- `date` - дата расписания
- `is_working` - boolean, работает ли мастер
- `has_booking_slots` - boolean, есть ли доступные слоты
- `start_time`, `end_time` - время работы

### Data Flow
1. `loadFullContext` загружает расписание из БД
2. `formatStaffSchedules` форматирует для AI промпта
3. AI использует эту информацию для ответов клиентам

## Testing

### Test Scenarios
1. ✅ Мастер работает и имеет слоты → отображается в расписании
2. ✅ Мастер работает, но нет слотов → НЕ отображается
3. ✅ Мастер не работает → НЕ отображается
4. ✅ Никто не работает → "никто не работает"

### Verification Commands
```bash
# Check logs for formatting
@logs logs_search pattern:"formatStaffSchedules" service:ai-admin-worker-v2

# Test with Redis context
@redis get_context phone:79880757777

# Send test message
@whatsapp send_message phone:79001234567 message:"Кто работает завтра?"
```

## Lessons Learned

1. **Always validate business logic** - не все поля в БД означают то, что кажется
2. **Check all boolean flags** - `is_working` недостаточно, нужен и `has_booking_slots`
3. **Test edge cases** - мастер может быть в расписании, но без слотов
4. **Log thoroughly** - подробные логи помогли быстро найти проблему

## Related Issues
- Похожая проблема может быть в команде `CHECK_STAFF_SCHEDULE`
- Нужно проверить другие места использования расписания

## Deployment
```bash
# Committed
git add -A && git commit -m "fix: исправлено отображение расписания мастеров - учитываются флаги is_working и has_booking_slots"

# Deployed
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull && pm2 restart ai-admin-worker-v2"
```

## Result
Теперь бот корректно показывает только тех мастеров, которые:
1. Работают в указанный день (`is_working = true`)
2. Имеют доступные для записи слоты (`has_booking_slots = true`)

Это исключает ситуации, когда клиент видит мастера в списке работающих, но не может к нему записаться.