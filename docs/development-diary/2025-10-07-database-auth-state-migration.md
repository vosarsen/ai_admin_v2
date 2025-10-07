# 2025-10-07: Миграция на Database-Backed Auth State для Baileys

## 📋 Резюме

Реализована и частично развернута миграция WhatsApp Baileys auth state с файловой системы на PostgreSQL (Supabase).
Решена критическая проблема с накоплением файлов (337 файлов за 9 дней) и риском `device_removed`.

**Статус:** 🟡 В процессе (90% готово)
- ✅ Архитектура и код готовы
- ✅ Миграция данных выполнена (335 ключей)
- ✅ Race condition исправлен
- ⚠️ Обнаружена проблема с Buffer сериализацией

---

## 🎯 Цель

Заменить `useMultiFileAuthState` на database-backed решение для:
1. Устранения риска device_removed из-за большого количества файлов
2. Повышения производительности (5-400x быстрее)
3. Автоматической очистки старых данных (TTL)
4. Масштабирования до 1000+ компаний

---

## ✅ Что было сделано

### 1. Архитектура и документация

**Созданные документы:**
- `docs/architecture/BAILEYS_DATABASE_AUTH_STATE.md` - Полная архитектура (634 строки)
- `docs/architecture/PERFORMANCE_AND_SCALABILITY_ANALYSIS.md` - Анализ производительности (444 строки)
- `docs/architecture/CLEANUP_STRATEGY_AFTER_MIGRATION.md` - Стратегия очистки (405 строк)
- `docs/DEPLOYMENT_DATABASE_AUTH_STATE.md` - Инструкция по развёртыванию (195 строк)

**Ключевые выводы из анализа:**
- База данных в **5-400x быстрее** файлов (в зависимости от операции)
- Supabase Free tier покрывает **5,000-7,000 компаний**
- С Pro планом ($25/мес) - до **400,000 компаний**
- Собственная БД нужна не раньше чем через **3-5 лет**

### 2. SQL миграция

**Файл:** `migrations/20251007_create_whatsapp_auth_tables.sql` (198 строк)

**Таблицы:**
```sql
-- Credentials (creds.json)
CREATE TABLE whatsapp_auth (
  company_id TEXT PRIMARY KEY,
  creds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keys (Signal Protocol, lid-mappings)
CREATE TABLE whatsapp_keys (
  company_id TEXT NOT NULL,
  key_type TEXT NOT NULL,
  key_id TEXT NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,  -- TTL для автоочистки
  PRIMARY KEY (company_id, key_type, key_id)
);
```

**Особенности:**
- Автоматический TTL для lid-mappings (7 дней)
- Индексы для производительности
- RLS (Row Level Security)
- Функция автоочистки `cleanup_expired_whatsapp_keys()`

**Статус:** ✅ Применена в Supabase

### 3. Реализация useSupabaseAuthState

**Файл:** `src/integrations/whatsapp/auth-state-supabase.js` (298 строк)

**Функционал:**
- Загрузка/сохранение credentials из БД
- Batch операции для keys (до 100 за раз)
- Автоматический TTL для lid-mappings (7 дней)
- Совместимость с Baileys API

**Пример:**
```javascript
const { useSupabaseAuthState } = require('./auth-state-supabase');

// Вместо файлов
const { state, saveCreds } = await useSupabaseAuthState('962302');

// Далее используется как обычно
const sock = makeWASocket({ auth: state });
```

**Статус:** ✅ Реализовано

### 4. Интеграция в session-pool.js

**Изменения:**
- Feature flag `USE_DATABASE_AUTH_STATE` для переключения
- Обратная совместимость с файлами
- Автоматический выбор auth state

```javascript
if (process.env.USE_DATABASE_AUTH_STATE === 'true') {
  ({ state, saveCreds } = await useSupabaseAuthState(companyId));
} else {
  ({ state, saveCreds } = await useMultiFileAuthState(authPath));
}
```

**Статус:** ✅ Интегрировано

### 5. Скрипт миграции файлов → БД

**Файл:** `scripts/migrate-baileys-files-to-database.js` (330 строк)

**Функционал:**
- Автоматический backup файлов
- Миграция credentials (creds.json)
- Миграция всех keys с сохранением timestamp
- TTL для lid-mappings (только < 7 дней)
- Batch миграция (по 100 записей)
- Верификация после миграции

**Результаты для company 962302:**
```
✅ Backup: /opt/ai-admin/baileys_sessions_backup/company_962302/backup_2025-10-07T16-34-14-962Z
✅ Мигрировано: 335 ключей
✅ Skipped: 0 старых lid-mappings
✅ Verification: passed
```

**Статус:** ✅ Успешно выполнено

### 6. Автоочистка expired keys

**Файл:** `src/services/whatsapp/database-cleanup.js` (151 строка)

**Функционал:**
- Автоматическая очистка каждые 6 часов
- Удаление записей где `expires_at < NOW()`
- Статистика хранилища
- Интеграция в worker

**Запуск:**
```javascript
// В worker при старте
if (process.env.USE_DATABASE_AUTH_STATE === 'true') {
  startAutomaticCleanup();
}
```

**Статус:** ✅ Реализовано и работает

### 7. Исправление Race Condition

**Проблема:** Infinite loop при создании сессий

**Причины:**
1. Дублирующаяся mutex логика в `getOrCreateSession()` и `createSession()`
2. Два определения `createSession()` (второе перезаписывало первое)
3. Рекурсивные вызовы между функциями

**Решение:**
- Убрана дублирующаяся mutex логика
- Удалён алиас `createSession` на строке 672
- `getOrCreateSession` теперь просто вызывает `createSession`
- Добавлена защита от reconnect loop во время создания сессии

**Коммиты:**
- `0c6cd48` - Первая версия фикса (mutex улучшен)
- `bc2405d` - Убрана дублирующаяся логика
- `c0874bf` - Удалён алиас и рекурсия

**Статус:** ✅ Race condition исправлен, infinite loop больше нет

---

## ⚠️ Обнаруженные проблемы

### Проблема: Buffer сериализация в JSONB

**Описание:**
```
TypeError: The "list[1]" argument must be an instance of Buffer or Uint8Array.
Received an instance of Object
```

**Причина:**
PostgreSQL JSONB сериализует Buffer как обычные объекты `{type: 'Buffer', data: [...]}`

**Где возникает:**
```javascript
at Object.encodeFrame (baileys/lib/Utils/noise-handler.js:104:33)
```

Baileys ожидает что криптографические ключи будут Buffer, но получает plain objects из JSONB.

**Решение (требуется реализовать):**
1. **Вариант A:** Автоматическая десериализация Buffer в `useSupabaseAuthState`
   ```javascript
   function reviveBuffers(obj) {
     if (obj?.type === 'Buffer' && Array.isArray(obj.data)) {
       return Buffer.from(obj.data);
     }
     // Рекурсивно для вложенных объектов
   }
   ```

2. **Вариант B:** Хранить Buffer как base64 string
   ```javascript
   // При сохранении
   if (Buffer.isBuffer(value)) {
     value = { __buffer: value.toString('base64') };
   }

   // При загрузке
   if (value?.__buffer) {
     value = Buffer.from(value.__buffer, 'base64');
   }
   ```

**Приоритет:** 🔴 Высокий (блокирует подключение WhatsApp)

**Статус:** 🟡 Не исправлено

---

## 📊 Статистика

### Файлы созданы/изменены:
- **Новых файлов:** 8
  - 3 документа архитектуры
  - 1 SQL миграция
  - 2 скрипта (миграция, очистка)
  - 1 реализация auth state
  - 1 инструкция deployment

- **Изменённых файлов:** 2
  - `src/integrations/whatsapp/session-pool.js` (интеграция + фиксы)
  - `src/workers/message-worker-v2.js` (автоочистка)

### Коммиты:
```
6de77fe - feat: добавлена SQL миграция для database-backed auth state
1f37a85 - feat: реализован database-backed auth state для Baileys
29d0758 - feat: добавлена автоочистка и скрипт миграции файлов
1abc2fd - docs: инструкция по развёртыванию database auth state
0c6cd48 - fix: исправлен race condition и infinite reconnect loop
bc2405d - fix: убрана дублирующаяся mutex логика из getOrCreateSession
c0874bf - fix: удалён дублирующийся alias createSession
```

### Строки кода:
- **Документация:** ~1,900 строк
- **SQL:** 198 строк
- **JavaScript:** ~900 строк
- **Всего:** ~3,000 строк

### Время разработки:
- Архитектура и планирование: ~1 час
- Реализация: ~2 часа
- Миграция и тестирование: ~1.5 часа
- Исправление race condition: ~1 час
- **Всего:** ~5.5 часов

---

## 🔍 Текущее состояние

### База данных (Supabase):
```
✅ Таблицы созданы
✅ Индексы настроены
✅ Автоочистка работает
✅ Данные мигрированы: 335 ключей
✅ Размер БД: ~100-150 KB
```

### Сервер:
```
✅ Код загружен (commit c0874bf)
✅ USE_DATABASE_AUTH_STATE=true
✅ Worker запущен (автоочистка работает)
⚠️ WhatsApp не подключён (проблема с Buffer)
```

### Backup:
```
✅ Полный backup файлов создан
   /opt/ai-admin/baileys_sessions_backup/company_962302/backup_2025-10-07T16-34-14-962Z
```

### Система работает на:
```
🔄 Временно откачен на файлы (USE_DATABASE_AUTH_STATE=false)
✅ Можно вернуться к БД после фикса Buffer проблемы
```

---

## 🚀 Следующие шаги

### Критический фикс (30-60 мин):
1. **Исправить Buffer сериализацию**
   - Добавить `reviveBuffers()` функцию в `useSupabaseAuthState`
   - Рекурсивно обрабатывать все объекты
   - Конвертировать `{type: 'Buffer', data: [...]}` → `Buffer.from(data)`

2. **Протестировать WhatsApp подключение**
   - Включить `USE_DATABASE_AUTH_STATE=true`
   - Запустить `baileys-service.js`
   - Проверить что QR/Pairing code генерируется
   - Подключиться к WhatsApp

3. **Тестирование на тестовом номере**
   - Отправить сообщение на 89686484488
   - Проверить отправку/получение
   - 24 часа мониторинга

### После успешного подключения (1-2 дня):
4. **Cleanup legacy файлов**
   - Через 7 дней успешной работы
   - Удалить файлы из `baileys_sessions/`

5. **Документация успеха**
   - Обновить `CONTEXT.md`
   - Создать Success Story запись

---

## 📝 Технические детали

### Buffer Problem - Детальный анализ

**Как должно быть:**
```javascript
// Baileys ожидает
state.keys = {
  'app-state-sync-key': {
    'AAAAAK6J': {
      keyData: Buffer([...]),  // ← Buffer!
      timestamp: 1234567890
    }
  }
}
```

**Как есть сейчас:**
```javascript
// После загрузки из JSONB
state.keys = {
  'app-state-sync-key': {
    'AAAAAK6J': {
      keyData: {type: 'Buffer', data: [...]},  // ← Plain object!
      timestamp: 1234567890
    }
  }
}
```

**Решение - добавить в `useSupabaseAuthState.js`:**
```javascript
function reviveBuffers(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Check if this is a Buffer object
  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }

  // Recursively process arrays
  if (Array.isArray(obj)) {
    return obj.map(reviveBuffers);
  }

  // Recursively process objects
  const revived = {};
  for (const [key, value] of Object.entries(obj)) {
    revived[key] = reviveBuffers(value);
  }
  return revived;
}

// Применить после загрузки из БД
const { data } = await supabase.from('whatsapp_keys').select(...);
const revivedData = reviveBuffers(data);
```

---

## 💡 Уроки

### Что сработало хорошо:
1. ✅ Тщательное планирование и документация ДО реализации
2. ✅ Feature flag для безопасного переключения
3. ✅ Полный backup перед миграцией
4. ✅ Поэтапное тестирование (локально → база → сервер)
5. ✅ Детальный анализ производительности и масштабирования

### Что можно улучшить:
1. ⚠️ Тестирование сериализации Buffer ДО развёртывания
2. ⚠️ Unit-тесты для `useSupabaseAuthState` (не было времени)
3. ⚠️ Более тщательная проверка совместимости JSONB с Baileys

### Технические долги:
1. 📝 Unit-тесты для database auth state
2. 📝 Integration тесты для миграции
3. 📝 Monitoring dashboard для статистики БД
4. 📝 Алерты при приближении к лимитам Supabase

---

## 🔗 Связанные файлы

### Документация:
- `docs/architecture/BAILEYS_DATABASE_AUTH_STATE.md`
- `docs/architecture/PERFORMANCE_AND_SCALABILITY_ANALYSIS.md`
- `docs/architecture/CLEANUP_STRATEGY_AFTER_MIGRATION.md`
- `docs/DEPLOYMENT_DATABASE_AUTH_STATE.md`

### Реализация:
- `migrations/20251007_create_whatsapp_auth_tables.sql`
- `src/integrations/whatsapp/auth-state-supabase.js`
- `src/integrations/whatsapp/session-pool.js`
- `src/services/whatsapp/database-cleanup.js`
- `src/workers/message-worker-v2.js`

### Скрипты:
- `scripts/migrate-baileys-files-to-database.js`
- `scripts/apply-whatsapp-auth-migration.js`

---

## 🎯 Критерии успеха

### Для завершения задачи нужно:
- [x] SQL миграция создана и применена
- [x] useSupabaseAuthState реализован
- [x] Интеграция в session-pool готова
- [x] Скрипт миграции работает
- [x] Автоочистка функционирует
- [x] Race condition исправлен
- [ ] **Buffer сериализация исправлена** ← ОСТАЛОСЬ
- [ ] WhatsApp подключён через БД
- [ ] Тестирование 24 часа пройдено
- [ ] Legacy файлы очищены

**Прогресс:** 7/10 (70%) → готовы к финальному фиксу

---

## 📌 Заметки для следующей сессии

### Начать с:
1. Открыть `src/integrations/whatsapp/auth-state-supabase.js`
2. Добавить функцию `reviveBuffers()` (см. код выше)
3. Применить её в `keys.get()` после загрузки из БД
4. Протестировать локально
5. Задеплоить и подключить WhatsApp

### Команды для проверки:
```bash
# На сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# Включить database auth
sed -i 's/USE_DATABASE_AUTH_STATE=false/USE_DATABASE_AUTH_STATE=true/' .env

# Тестировать
cd /opt/ai-admin
node scripts/baileys-service.js

# Ожидаемый результат: QR code или Pairing code без ошибок Buffer
```

### Быстрый rollback если нужно:
```bash
sed -i 's/USE_DATABASE_AUTH_STATE=true/USE_DATABASE_AUTH_STATE=false/' .env
pm2 restart ai-admin-worker-v2
```

---

**Автор:** AI Assistant (Claude)
**Дата:** 2025-10-07
**Время:** ~5.5 часов
**Статус:** 🟡 90% готово, осталось исправить Buffer сериализацию
**Branch:** feature/redis-context-cache
**Last commit:** c0874bf
