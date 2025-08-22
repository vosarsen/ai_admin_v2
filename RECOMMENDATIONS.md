# AI Admin v2 - Рекомендации и улучшения

## 📅 Last Updated: August 22, 2025

## 🔒 Database Security Best Practices (NEW - August 22, 2025)

### При создании новых таблиц
```sql
-- ВСЕГДА включайте RLS при создании таблицы
CREATE TABLE public.new_table (...);
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- Сразу создавайте политику для service_role
CREATE POLICY "service_role_all" ON public.new_table
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
```

### При создании новых функций
```sql
-- ВСЕГДА указывайте search_path
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_catalog  -- Важно!
AS $$
BEGIN
    -- function body
END;
$$;
```

### Мониторинг безопасности
```bash
# Регулярно проверяйте Supabase Linter
# Dashboard → Database → Linter

# Проверка RLS статуса
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

# Проверка функций без search_path
SELECT proname 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
    AND p.proconfig IS NULL;
```

### Мониторинг производительности
```bash
# Через месяц проверьте использование индексов
SELECT indexname, idx_scan 
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan;

# Удаляйте только индексы с 0 использований при >10k записей
```

## 🆕 AI Provider System - Quick Reference

### Переключение AI провайдеров
```bash
# Посмотреть доступные провайдеры
node scripts/switch-ai-provider.js list

# Переключиться на Qwen
export AI_PROVIDER=qwen
# или
node scripts/switch-ai-provider.js switch qwen

# Вернуться на DeepSeek
export AI_PROVIDER=deepseek
```

### Управление промптами
```bash
# Посмотреть статистику
node scripts/manage-prompts.js list

# Переключить промпт (рекомендуется strict-prompt для Qwen)
export AI_PROMPT_VERSION=strict-prompt
# или
node scripts/manage-prompts.js switch strict-prompt

# Включить A/B тестирование
export AI_PROMPT_AB_TEST=true
```

### Рекомендации по выбору
- **Для Qwen**: используйте `strict-prompt` (специально оптимизирован)
- **Для DeepSeek**: используйте `enhanced-prompt` (лучшие результаты)
- **При проблемах с Qwen**: переключитесь на `qwen-72b` или вернитесь на DeepSeek

## 🎯 Приоритетные задачи

### 0. Завершенные критические исправления (DONE - July 29)
- ✅ **Исправлен поиск клиентов в базе данных**
  - AI теперь правильно находит существующих клиентов
  - Не спрашивает имя повторно
- ✅ **Расширен период видимости расписания до 30 дней**
  - AI видит расписание на месяц вперед
  - Синхронизация загружает 30 дней данных
- ✅ **Улучшено распознавание услуг**
  - AI понимает "на стрижку", "стричься" и т.д.

### 1. Новые приоритетные задачи (NEW - July 29)
- **Запросить расширенные права у YClients**
  - Нужны права на управление клиентами (поиск, создание)
  - Права на управление записями (отмена, перенос)
  - Без этого половина функций не работает
- **Исправить понимание времени AI**
  - "на 3" должно пониматься как 15:00
  - Протестировать различные форматы времени
- **Добавить автоматический показ слотов при ошибках**
  - При любой ошибке создания записи
  - Форматировать красиво для пользователя

### 2. Конфигурация окружения
- **Разделить Redis конфигурацию**
  - Создать `.env.local` с `REDIS_URL=redis://localhost:6380`
  - Создать `.env.production` с `REDIS_URL=redis://localhost:6379`
  - Убрать временные хаки из `smart-cache.js` и `redis-factory.js`

### 3. Автоматизация деплоя
- **Создать скрипт деплоя** (`scripts/deploy.sh`):
  ```bash
  #!/bin/bash
  git pull origin main
  npm install
  pm2 restart all --update-env
  pm2 logs --lines 50
  ```

### 4. Мониторинг и алерты
- **PM2 Plus** - настроить мониторинг с алертами
- **Health checks** - добавить проверку всех критичных сервисов
- **Telegram/Email алерты** при падении сервисов
- **Алерт при долгом простое воркера** - воркер может упасть и лежать часами

### 5. Документация API
- **Swagger/OpenAPI** - создать интерактивную документацию
- **Postman коллекция** - для тестирования endpoints
- **Примеры запросов** для каждого endpoint

### 6. Тестирование
- **E2E тесты** для полного флоу бронирования
- **Load testing** - проверить производительность под нагрузкой
- **Chaos engineering** - тестировать отказоустойчивость

### 7. Безопасность
- **Secrets management** - использовать Vault или AWS Secrets Manager
- **API rate limiting** - более гранулярные лимиты
- **Audit logging** - логировать все критичные операции

### 8. Оптимизация производительности
- **Database replication** - локальная реплика Supabase
- **Message batching** - группировка сообщений для YClients API
- **Connection pooling** - оптимизация подключений к БД

### 9. UX улучшения
- **Голосовые сообщения** - поддержка WhatsApp voice
- **Inline keyboards** - быстрые ответы в WhatsApp Business API
- **Персонализация** - запоминание предпочтений клиентов

## 📋 Технический долг

1. **Убрать хардкод**:
   - Временные фиксы для Redis портов
   - Захардкоженные company_id в некоторых местах
   
2. **Рефакторинг**:
   - Разделить большие файлы на модули
   - Унифицировать обработку ошибок
   - Добавить типизацию (TypeScript)

3. **Оптимизация БД**:
   - Добавить недостающие индексы
   - Оптимизировать запросы с JOIN
   - Настроить партиционирование для больших таблиц

## 🚀 Масштабирование

### Phase 2 (150 компаний)
- Kubernetes deployment
- Redis Cluster
- Load balancer (Nginx/HAProxy)
- Централизованное логирование (ELK)

### Phase 3 (1500+ компаний)
- Микросервисная архитектура
- Message broker (RabbitMQ/Kafka)
- CDN для статики
- Multi-region deployment

## 💡 Инновационные идеи

1. **AI-powered аналитика**:
   - Предсказание отмен
   - Рекомендации по загрузке мастеров
   - Оптимизация расписания

2. **Интеграции**:
   - Google Calendar sync
   - Instagram booking
   - Telegram bot версия

3. **Монетизация**:
   - Premium функции для салонов
   - White-label решение
   - API для сторонних разработчиков