-- Временное решение: обновляем расписание Бари на сегодня
-- Бари не работает 21 июля 2025

UPDATE staff_schedules 
SET is_working = false,
    has_booking_slots = false,
    last_updated = NOW()
WHERE staff_id = 3413963 
  AND date = '2025-07-21';