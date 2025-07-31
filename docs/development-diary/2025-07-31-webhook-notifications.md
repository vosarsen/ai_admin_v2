# Development Diary: 2025-07-31 - Webhook Notification System

## Context
Реализована система webhook уведомлений для отправки WhatsApp сообщений клиентам о записях, созданных вне бота (через администратора, по телефону, офлайн).

## What Was Done

### 1. Folder Organization (Morning Session)
Организована структура проекта для улучшения навигации:
- Создана структура тестовых директорий: `tests/manual/{booking,context,redis,whatsapp,yclients,misc}`
- Перемещено 56 тестовых файлов из корня в соответствующие поддиректории
- Обновлен `.gitignore` с временными файлами и артефактами разработки
- Полностью переписан `README.md` с актуальной структурой проекта

### 2. Webhook System Implementation
Реализована полноценная система webhook уведомлений:

#### Архитектура:
```
YClients → Webhook → AI Admin → WhatsApp Client
```

#### Ключевые компоненты:
1. **Webhook Endpoint** (`/webhook/yclients/events`)
   - Принимает события от YClients
   - Поддерживает проверку подписи
   - Дедупликация событий
   - Асинхронная обработка

2. **Webhook Processor** (`src/services/webhook-processor/`)
   - Обработка событий: record.created, record.updated, record.deleted
   - Умная логика для избежания дублирования (проверка комментариев, активности клиента)
   - Форматирование сообщений для WhatsApp
   - Сохранение истории уведомлений

3. **Database Schema**
   - `webhook_events` - история всех webhook событий
   - `booking_notifications` - история отправленных уведомлений
   - Дополнительные поля в `appointments_cache` для отслеживания источника

### 3. YClients Integration Update
Обнаружен реальный формат webhook от YClients:
```json
{
  "resource": "record",
  "status": "create/update/delete",
  "data": { ... }
}
```

Обновлен процессор для поддержки этого формата вместо ожидаемого `event: "record.created"`.

## Technical Details

### Webhook Security
- HMAC-SHA256 проверка подписи (опциональная)
- Дедупликация по event_id
- Быстрый ответ 200 OK для предотвращения повторов

### Smart Notification Logic
```javascript
// Проверка создания записи ботом
if (recordData.comment.includes('AI Admin') || 
    recordData.comment.includes('WhatsApp')) {
  return; // Не отправляем уведомление
}

// Проверка недавней активности клиента
const recentActivity = await checkRecentClientActivity(phone);
if (recentActivity) {
  return; // Клиент недавно был в боте
}
```

### Message Templates
- **Новая запись**: Подтверждение с деталями
- **Изменение**: Что именно изменилось (время, мастер, услуга)
- **Отмена**: Предложение записаться на другое время

## Problems & Solutions

### Problem 1: Module Path Error
После реорганизации файлов возникли ошибки путей:
```
Cannot find module '../../universal-yclients-sync'
```
**Solution**: Обновлены пути импорта в `sync-manager.js`

### Problem 2: YClients Webhook Format
YClients отправляет другой формат событий, чем документирован.
**Solution**: Добавлена логика преобразования формата в webhook endpoint.

### Problem 3: NOT NULL Constraint
Ошибка при сохранении webhook событий из-за отсутствия event_type.
**Solution**: Правильное извлечение типа события из resource/status.

## Testing Results

### Successful Tests:
1. ✅ Test webhook endpoint работает
2. ✅ WhatsApp уведомления отправляются
3. ✅ История сохраняется в `booking_notifications`
4. ✅ Реальные webhook от YClients принимаются

### Known Issues:
1. ⚠️ Foreign key constraint при сохранении в appointments_cache (клиент с ID=1 не существует)
2. ⚠️ Финансовые операции (`finances_operation`) пока игнорируются

## Lessons Learned

1. **Webhook Documentation vs Reality**: Реальный формат webhook может отличаться от документации. Важно логировать входящие события для анализа.

2. **Async Processing**: Критически важно быстро отвечать 200 OK на webhook, чтобы избежать повторных отправок.

3. **Deduplication Strategy**: Многоуровневая проверка (event_id, комментарий, активность клиента) помогает избежать дублирования уведомлений.

4. **Error Handling**: Нужна graceful обработка ошибок, чтобы один сбой не блокировал обработку других событий.

## Next Steps

1. [ ] Настроить реальные webhook в YClients Marketplace
2. [ ] Добавить мониторинг и алерты для webhook событий
3. [ ] Реализовать retry механизм для неудачных отправок
4. [ ] Добавить поддержку других типов событий (смена статуса визита, оплата)
5. [ ] Создать дашборд для просмотра статистики уведомлений

## Configuration Reference

### YClients Webhook URL
```
https://46.149.70.219/webhook/yclients/events
```

### Environment Variables
```bash
YCLIENTS_WEBHOOK_SECRET=your_secret  # Для проверки подписи
WEBHOOK_NOTIFICATION_ENABLED=true    # Включить систему
```

### Database Views for Monitoring
```sql
-- Статистика за 24 часа
SELECT * FROM webhook_stats_24h;
SELECT * FROM notification_stats_24h;
```

## Conclusion

Система webhook уведомлений успешно реализована и протестирована. Она позволяет централизовать всю коммуникацию с клиентами в WhatsApp, независимо от способа создания записи. Это улучшает клиентский опыт и повышает вовлеченность.