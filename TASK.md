# AI Admin v2 - Task Tracker

## 📅 Last Updated: August 22, 2025

## 🎯 Current Sprint - System Security and Full Migration

### ✅ Completed - Full Security Migration and Sync Fixes (August 22, 2025)
- [x] **Исправлены все критические проблемы безопасности Supabase**
  - [x] Включен Row Level Security на 14 таблицах
  - [x] Созданы политики для service_role (полный доступ для backend)
  - [x] Удалены 2 проблемных SECURITY DEFINER views
  - [x] Установлен search_path для 10 функций
  - [x] Результат: 0 ошибок и предупреждений безопасности
- [x] **Выполнена миграция с anon на service_role ключ**
  - [x] Обновлен SUPABASE_KEY в production окружении
  - [x] Создан автоматический скрипт миграции
  - [x] Обновлена документация MCP конфигурации
  - [x] Протестирована работа с новым ключом
- [x] **Исправлена синхронизация расписаний**
  - [x] Проблема: YClients возвращал массив строк, код ожидал объекты
  - [x] Обновлен метод saveSchedules для работы со строками
  - [x] Результат: 81 расписание синхронизировано без ошибок
- [x] **Исправлены мелкие баги синхронизации**
  - [x] BOOKINGS_BATCH_SIZE undefined - добавлена конфигурация
  - [x] null dates в расписаниях - добавлена валидация
  - [x] company_id undefined - добавлено значение по умолчанию
- [x] **Оптимизирована производительность базы данных**
  - [x] Добавлен отсутствующий индекс idx_visits_client_id
  - [x] Проанализированы 49 неиспользуемых индексов (оставлены для будущего роста)
- [x] **Создана полная документация**
  - [x] 10+ SQL скриптов для всех исправлений
  - [x] Руководства по безопасности, миграции и синхронизации
  - [x] Записи в дневнике разработки
  - [x] Обновлены CONTEXT.md, TASK.md и RECOMMENDATIONS.md

### ✅ Completed - Context and Response Fixes (August 5, 2025)
- [x] **Исправлено сохранение контекста в Redis**
  - [x] Обнаружена проблема: phone становился null при сохранении
  - [x] Исправлено: добавлено поле phone в cached-data-loader.js
  - [x] Исправлена нормализация телефона в command-executor.js
  - [x] Контекст теперь сохраняется корректно
  - [x] Документация: `docs/development-diary/2025-08-05-ai-context-fixes.md`
- [x] **Исправлены технические ошибки после команд**
  - [x] Проблема: "Извините, произошла техническая ошибка" после успешных команд
  - [x] Исправлена проверка в response-processor.js
  - [x] Ошибки теперь появляются только при реальных проблемах
- [x] **Реализовано сохранение истории сообщений**
  - [x] Сообщения сохраняются в Redis после каждого взаимодействия
  - [x] История загружается корректно из Redis
  - [x] Ключ: `context:962302:+79686484488:messages`
- [x] **Частично исправлены приветствия**
  - [x] Добавлены проверки истории в промпт
  - [x] Фразы "Проверяю..." больше не появляются
  - [ ] AI всё ещё здоровается в каждом сообщении (требует доработки)

### ✅ Completed - AI Provider System (August 4, 2025)
- [x] **Создана унифицированная система AI провайдеров**
  - [x] Provider Factory для управления DeepSeek, Qwen Plus, Qwen 72B
  - [x] Убраны сложные обёртки (index-qwen-simple.js)
  - [x] Единый интерфейс для всех провайдеров
  - [x] Легкое переключение через переменную окружения
  - [x] Документация: `docs/ai-provider-system.md`
- [x] **Реализована система управления промптами**
  - [x] Prompt Manager с поддержкой A/B тестирования
  - [x] Создано 3 версии: base, enhanced, strict
  - [x] Автоматический сбор статистики эффективности
  - [x] API endpoints для управления промптами
  - [x] Документация: `docs/development-diary/2025-08-04-ai-provider-system.md`
- [x] **Добавлены удобные скрипты**
  - [x] `switch-ai-provider.js` - переключение между провайдерами
  - [x] `manage-prompts.js` - управление промптами и статистика
  - [x] Тестирование промптов без запуска бота
  - [x] Просмотр статистики в табличном формате
- [x] **Обновлена архитектура AI Admin v2**
  - [x] Интеграция с новой системой провайдеров
  - [x] Сбор статистики в processMessage
  - [x] Поддержка контекста в callAI
  - [x] Обновлен CLAUDE.md с новой информацией

### ✅ Completed - Redis Configuration Centralization & AI Improvements (August 2, 2025)
- [x] **Централизована конфигурация Redis**
  - [x] Создан `src/config/redis-config.js` с единой конфигурацией
  - [x] Исправлено 7 файлов для использования централизованной конфигурации
  - [x] Добавлена функция `getBullMQRedisConfig()` для BullMQ
  - [x] Исправлены NOAUTH ошибки аутентификации
  - [x] Документация: `docs/development-diary/2025-08-02-redis-config-fixes.md`
- [x] **Добавлено приветствие в первое сообщение**
  - [x] Добавлено правило #12 в AI промпт
  - [x] Различает приветствие для известных и новых клиентов
  - [x] Успешно протестировано в production
- [x] **Работа над устранением дублирования**
  - [x] Добавлено правило #13 против дублирования информации
  - [x] Требует дополнительного тестирования
- [x] **Улучшена обработка занятых слотов**
  - [x] Расширена логика определения ошибок доступности
  - [x] Добавлены новые паттерны распознавания

### ✅ Completed - Staff Schedule Display Fix (August 1, 2025)
- [x] **Исправлено отображение расписания мастеров**
  - [x] Бот говорил "Бари не работает завтра" хотя мастер был в расписании
  - [x] Добавлена фильтрация по флагам is_working и has_booking_slots
  - [x] Исправлены методы formatStaffSchedules и formatTodayStaff
  - [x] Теперь показываются только мастера с доступными слотами
  - [x] Создана документация: docs/development-diary/2025-08-01-staff-schedule-display-fix.md

### ✅ Completed - Critical Fixes After Testing (July 30, 2025)
- [x] **Исправлен алгоритм ServiceMatcher**
  - [x] Точное совпадение теперь дает 1000 баллов (максимальный приоритет)
  - [x] Добавлено правило all_words_match (500 баллов) для составных услуг
  - [x] "воск комплекс" теперь правильно выбирает "ВОСК КОМПЛЕКС"
- [x] **Исправлено сохранение записей в БД**
  - [x] Таблица bookings не существовала в Supabase
  - [x] Переключились на существующую таблицу appointments_cache
  - [x] Добавлен поиск service_id и staff_id по названиям
  - [x] История записей теперь сохраняется корректно
- [x] **Исправлена команда CHECK_STAFF_SCHEDULE**
  - [x] AI неправильно определял работающих мастеров на указанную дату
  - [x] Исправлена логика проверки расписания
  - [x] Теперь правильно определяет доступность мастеров

### ✅ Completed - UX Improvements and Time Context Fix (July 29, 2025, Part 3)
- [x] **Исправлена критическая ошибка с контекстом времени**
  - [x] AI не передавал time при CREATE_BOOKING когда клиент менял дату
  - [x] Добавлено правило сохранения времени из предыдущих сообщений
  - [x] Добавлена валидация параметра time в command-handler
  - [x] Протестировано - AI успешно создает запись с временем из контекста
- [x] **Улучшен UX при недоступности мастера**
  - [x] AI сразу предлагает 3-4 ближайших дня работы мастера
  - [x] Убрано дублирование информации о недоступности
  - [x] Убраны лишние фразы "проверяю свободное время"
  - [x] Автоматическое создание записи с временем из контекста
- [x] **Улучшена обработка занятого времени**
  - [x] При занятом времени предлагаются 3 ближайших слота
  - [x] Вместо всех слотов - фокус на релевантных вариантах

### ✅ Completed - Message Formatting and Booking Flow (July 29, 2025, Part 2)
- [x] **Полностью переработан процесс создания записи**
  - [x] AI больше не сообщает о проверке расписания
  - [x] Проверка выполняется молча в фоне
  - [x] Используется имя клиента из базы данных
  - [x] Все команды выполняются в одном ответе
- [x] **Улучшено форматирование сообщений**
  - [x] Убраны размышления AI из ответов
  - [x] Убрано форматирование WhatsApp (* и _)
  - [x] Реализовано разделение на отдельные сообщения
  - [x] Подтверждение записи отправляется отдельно
- [x] **Успешно протестированы функции**
  - [x] Создание записи с правильным форматированием
  - [x] Перенос записи с разделением сообщений
  - [x] Ссылка на календарь отправляется отдельно

## 🚀 Current Tasks

### ✅ DONE (05.08.2025) - Fixed AI Greeting Issue
- [x] **Исправить повторяющиеся приветствия**
  - [x] Проверить передачу conversation в buildSmartPrompt
  - [x] Убедиться что история диалога попадает в промпт
  - [x] Добавить правило в промпт против повторных приветствий
  - [x] Исправить загрузку conversation в cached-data-loader
- [x] **Исправить двойную пунктуацию в приветствии**
- [x] **Исправить показ неработающих мастеров**
- [x] **Исправить определение типа бизнеса для барбершопа**

### ✅ Completed - Two-Stage Processor (August 12, 2025)
- [x] **Реализован двухэтапный процессор**
  - [x] Создан two-stage-processor.js
  - [x] Промпт для извлечения команд (JSON)
  - [x] Промпт для генерации ответа
  - [x] Интеграция в index.js
  - [x] Локальное тестирование
  - [ ] Развертывание на сервере

### 🔴 High Priority - Testing Required (August 12, 2025)
- [ ] **Протестировать альтернативы при отсутствии слотов**
  - [ ] Запросить занятое время
  - [ ] Проверить что AI предлагает 3-4 альтернативы
  - [ ] Убедиться в правильном форматировании
- [ ] **Проверить отсутствие дублирования информации**
  - [ ] Запросить запись с конкретным мастером
  - [ ] Убедиться что информация появляется только один раз
  - [ ] Проверить чистоту форматирования

### 🔄 In Progress - AI Provider Testing
- [ ] **Тестирование новой системы провайдеров**
  - [ ] Развернуть на сервере и протестировать с реальными сообщениями
  - [ ] Сравнить эффективность Qwen со strict-prompt vs DeepSeek
  - [ ] Собрать статистику за 24 часа работы
  - [ ] Принять решение о дефолтном провайдере

### 📋 Backlog - Next Improvements
- [ ] **Автоматический fallback между провайдерами**
  - [ ] Если Qwen не выполнил команду, переключиться на DeepSeek
  - [ ] Логирование причин переключения
  - [ ] Настраиваемые правила fallback
- [ ] **Динамический выбор модели Qwen**
  - [ ] Qwen Plus для простых запросов
  - [ ] Qwen 72B для сложных диалогов
  - [ ] Анализ сложности на основе assessComplexity
- [ ] **Персонализация промптов**
  - [ ] Разные промпты для разных типов бизнеса
  - [ ] Промпты для разных этапов диалога
  - [ ] A/B тестирование по сегментам пользователей

## ⚠️ Known Issues

### 🐛 Critical Issue
1. **AI здоровается в каждом сообщении**
   - История диалога сохраняется и загружается из Redis
   - Но AI игнорирует её при генерации ответа
   - Возможная причина: conversation не передаётся в промпт
   - Статус: 🔴 Требует срочного исправления

### 🐛 Minor Issues
2. **Дублирование информации в ответах**
   - Иногда AI повторяет информацию о доступности мастера
   - Добавлено правило #13, требует тестирования
   - Статус: 🟡 Требует проверки

3. **Альтернативы при отсутствии слотов**
   - Не проверено, предлагает ли AI альтернативы
   - Требует тестирования с занятыми слотами
   - Статус: 🟡 Требует тестирования

### ✅ Completed - AI and Schedule Improvements (July 29, 2025, Part 1)
- [x] **Исправлен поиск клиентов в базе данных**
  - [x] Изменен поиск с raw_phone на phone поле
  - [x] AI теперь правильно находит существующих клиентов
- [x] **Расширен период расписания до 30 дней**
  - [x] Увеличена загрузка с 7 до 30 дней
  - [x] Увеличено отображение с 3 до 30 дней
  - [x] Синхронизация YClients теперь на 30 дней
- [x] **Улучшены промпты AI**
  - [x] Добавлены правила проверки загруженного расписания
  - [x] Добавлено распознавание услуг
  - [x] AI не использует лишние команды

### ✅ Completed - Critical Fixes (July 24, 2025 Evening)
- [x] **Исправлен импорт Supabase в command-handler.js**
  - [x] Ошибка: supabase.from is not a function
  - [x] Решение: деструктурированный импорт { supabase }
- [x] **Исправлена отправка внутренних размышлений AI**
  - [x] Добавлены четкие инструкции в промпт
  - [x] AI больше не добавляет свой анализ в ответы
- [x] **Исправлена ошибка targetDate is not defined**
  - [x] Добавлено определение переменной в checkStaffSchedule
  - [x] Воркер теперь работает стабильно

### ✅ Completed - CHECK_STAFF_SCHEDULE Added (July 24, 2025 Morning)
- [x] **Добавлена команда CHECK_STAFF_SCHEDULE**
  - [x] Быстрая проверка расписания через БД
  - [x] Обработка результатов в processAIResponse
  - [x] Обновлен промпт AI
- [x] **Исправлен показ слотов при конкретном времени**
  - [x] Усилены правила в промпте
  - [x] AI не показывает слоты когда клиент указал время

### ✅ Completed - Rapid-Fire Protection Fixed (July 23, 2025)
- [x] **Redis-based батчинг для rapid-fire protection**
  - [x] Создан RedisBatchService
  - [x] Batch Processor worker
  - [x] Новый webhook endpoint /webhook/whatsapp/batched
  - [x] Тесты и документация
  - [x] Сообщения теперь корректно объединяются!

### ✅ Completed - YClients API Permissions Fixed (July 28, 2025)
- [x] **РЕШЕНА проблема с правами доступа к YClients API**
  - [x] Добавлен обязательный заголовок `X-Partner-Id: 8444`
  - [x] Все endpoints теперь работают с правильными токенами
  - [x] Поиск клиентов (`POST /company/962302/clients/search`) - ✅ РАБОТАЕТ
  - [x] Получение записей (`GET /records/962302`) - ✅ РАБОТАЕТ
  - [x] Ошибка 403 "Нет прав на управление компанией" - ИСПРАВЛЕНА

### ✅ COMPLETED - Database Saving Fixed (July 30, 2025)
- [x] **Исправлена ошибка "Failed to save booking to database"**
  - [x] Обнаружено что таблица bookings не существует
  - [x] Переключились на существующую таблицу appointments_cache
  - [x] Исправлено сохранение с правильными полями
  - [x] Записи теперь успешно сохраняются в БД

### ✅ COMPLETED - Redis Context Caching (July 31, 2025)
- [x] **Реализовано Redis кеширование полного контекста**
  - [x] Заменен in-memory Map кеш на Redis с TTL 12 часов
  - [x] Единый кеш для всех воркеров
  - [x] Добавлена инвалидация при создании/отмене записей
  - [x] Производительность: загрузка из кеша в 3 раза быстрее
  - [x] Исправлена проблема с Redis proxy (двойной префикс)
  - [x] Настроена конфигурация портов (6380 для dev, 6379 для prod)
  - [x] Создана полная документация и development diary


### 🟡 Medium Priority - Testing Required
- [x] **Тестирование некорректных вводов**
  - [x] Опечатки и сокращения в командах ✅
  - [x] Неполная информация от пользователя ✅
  - [x] Противоречивые запросы ✅
  - [x] Спам и повторяющиеся сообщения ✅ (решено через батчинг)
- [ ] **Тестирование граничных случаев**
  - [ ] Запись на прошедшее время
  - [ ] Запись на нерабочие часы
  - [ ] Запись слишком далеко в будущее
  - [ ] Обработка неверных форматов дат
- [ ] **Тестирование надежности**
  - [ ] Потеря и восстановление контекста
  - [ ] Недоступность YClients API
  - [ ] Таймауты и сетевые ошибки
  - [ ] Параллельные запросы от одного пользователя
- [x] **Исправление известных проблем**
  - [x] Fix Redis configuration (убрать временные хаки) ✅ FIXED August 2, 2025

### 🟡 Medium Priority - Phase 4: Продвинутые функции
- [x] Автоматические напоминания (за день, за 2 часа) ✅ (July 24, 2025)
- [ ] Webhook интеграция с YClients для real-time обновлений
- [ ] Redis кеширование для доступности слотов
- [ ] Показ портфолио [SHOW_PORTFOLIO]
- [ ] Create integration tests for booking flow
- [ ] Add monitoring dashboard improvements

### 🟢 Low Priority - Phase 5 & 6: Масштабирование и дополнительные возможности
- [ ] Локальная репликация критичных данных
- [ ] Batch обработка синхронизации с YClients
- [ ] Мультиязычная поддержка
- [ ] Обработка голосовых сообщений
- [ ] Программа лояльности
- [ ] API для внешних интеграций
- [ ] Продвинутая аналитика и дашборды
- [ ] Add more business types to `business-types.js`
- [ ] Create admin panel for configuration

## ✅ Completed Tasks

### Migration v1 → v2 (July 2024)
- [x] Implement AI Admin v2 architecture
- [x] Replace 5-step pipeline with single AI call
- [x] Add command-based approach
- [x] Implement business type detection
- [x] Add 5-minute context caching
- [x] Update PM2 configuration to use v2 worker

### Bug Fixes
- [x] Fixed `context is not defined` error
- [x] Fixed `query.from is not a function`
- [x] Fixed table name: schedules → staff_schedules
- [x] Fixed missing clients handling with maybeSingle()
- [x] Fixed undefined checks in sortServicesForClient
- [x] Fixed `AIService.generateResponse is not a function` - using `_callAI` instead (July 18, 2024)
- [x] Fixed Redis port 6380 issues - temporary override to 6379 (July 18, 2024)
- [x] Fixed git merge conflicts on server deployment (July 18, 2024)
- [x] Fixed "no working masters" issue - removed company_id filter from staff_schedules (July 19, 2024)
- [x] Fixed incorrect working hours (21:00 → 22:00) (July 19, 2024)

### Optimizations
- [x] Created database indexes for performance
- [x] Added MCP Supabase integration
- [x] Optimized YClients API documentation access
- [x] Implemented Context Engineering structure
- [x] Increased schedule sync frequency from 2x to 48x daily (July 21, 2024)
- [x] Implemented smart slot filtering with 1-hour intervals (July 21, 2024)

### Features Added (July 20-22, 2025)
- [x] ServiceMatcher scoring algorithm with penalties for complex services
- [x] Relative date parsing ("завтра", "послезавтра", days of week)
- [x] Automatic booking creation without confirmation when specific time provided
- [x] Fixed booking number display (correct extraction from YClients response)
- [x] Price list improvements - filtering, sorting, compact format
- [x] Staff availability sync script (sync-staff-schedules.js)
- [x] API endpoints for manual sync control
- [x] Smart slot filtering - 3 slots per time period with 1-hour gaps
- [x] Fixed unnecessary slots display when booking specific time (July 22, 2025)
- [x] CREATE_BOOKING now supports service_name parameter (July 22, 2025)
- [x] Automatic staff selection if not specified (July 22, 2025)
- [x] Automatic alternative slots display on booking errors (July 22, 2025)
- [x] Fixed YClients detailed error messages extraction (July 22, 2025)
- [x] Added error handling logging in processAIResponse (July 22, 2025)
- [x] Implemented CANCEL_BOOKING command with direct ID support (July 22, 2025)
- [x] Added CONFIRM_BOOKING command for booking confirmation (July 22, 2025)
- [x] Added MARK_NO_SHOW command for no-show marking (July 22, 2025)
- [x] Researched all YClients API methods for record management (July 22, 2025)
- [x] Created BACKLOG.md for post-MVP features (July 22, 2025)
- [x] Updated documentation with API limitations (July 22, 2025)
- [x] Implemented RESCHEDULE_BOOKING command (July 23, 2025)
- [x] Completed Phase 3 testing - all modification features ready (July 23, 2025)

### Features Added (July 25, 2025)
- [x] Booking Monitor - система мониторинга новых записей
  - [x] Автоматическое отслеживание записей администратора
  - [x] WhatsApp уведомления клиентам о новых записях
  - [x] Polling каждую минуту с 30-секундной задержкой
  - [x] PM2 процесс развернут в production
  - [x] Полная документация и troubleshooting
  - [ ] Ожидает расширенных прав API для работы

### Features Added (July 24, 2025)
- [x] Implemented automatic reminder system
  - [x] Day-before reminders (19:00-21:00 random time)
  - [x] 2-hour before reminders
  - [x] Automatic scheduling on booking creation
  - [x] Duplicate protection via database flags
  - [x] Separate PM2 process for reminder worker
  - [x] Full WhatsApp integration
  - [x] Comprehensive logging and monitoring
- [x] Fixed automatic reminder scheduling bug
  - [x] Fixed executedCommands/commands compatibility
  - [x] Added results passing from AI Admin v2
  - [x] Added detailed logging for debugging
- [x] Removed booking ID from client messages (stored in DB instead)

### Features Added (July 22, 2025)
- [x] ServiceMatcher scoring algorithm with penalties for complex services
- [x] Relative date parsing ("завтра", "послезавтра", days of week)
- [x] Automatic booking creation without confirmation when specific time provided
- [x] Fixed booking number display (correct extraction from YClients response)
- [x] Price list improvements - filtering, sorting, compact format
- [x] Staff availability sync script (sync-staff-schedules.js)
- [x] API endpoints for manual sync control
- [x] Smart slot filtering - 3 slots per time period with 1-hour gaps
- [x] Fixed unnecessary slots display when booking specific time (July 22, 2025)
- [x] CREATE_BOOKING now supports service_name parameter (July 22, 2025)
- [x] Automatic staff selection if not specified (July 22, 2025)
- [x] Automatic alternative slots display on booking errors (July 22, 2025)
- [x] Fixed YClients detailed error messages extraction (July 22, 2025)
- [x] Added error handling logging in processAIResponse (July 22, 2025)

### Features
- [x] Implemented automatic company data parsing from YClients API (July 19, 2024)
- [x] Added business type auto-detection based on company description
- [x] Made system scalable - new companies auto-configure from YClients
- [x] Implemented relative date parsing ("завтра" → "2025-07-21") (July 20, 2024)
- [x] Added improved service matching algorithm with penalties for complex services (July 20, 2024)

## 🚀 Status by Phases

### ✅ Phase 1: Базовая функциональность (ЗАВЕРШЕНА)
- [x] Миграция v1 → v2 архитектуры
- [x] Базовое понимание текста
- [x] Определение типа бизнеса
- [x] Поиск слотов [SEARCH_SLOTS]
- [x] Создание записи [CREATE_BOOKING]
- [x] Контекст и rapid-fire защита

### ✅ Phase 2: Расширенная функциональность (ЗАВЕРШЕНА)
- [x] Показ прайс-листа [SHOW_PRICES]
- [x] Отмена записи [CANCEL_BOOKING] - требует права API
- [x] Перенос записи [RESCHEDULE_BOOKING] - требует права API
- [x] Подтверждение/неявка - требует права API
- [ ] Показ портфолио [SHOW_PORTFOLIO] - не реализовано

### 🔄 Phase 3: Edge Cases и надежность (ТЕКУЩАЯ)
- См. раздел "Current Sprint" выше

### 📋 Phase 4: Продвинутые функции
- См. раздел "Medium Priority" выше

### 🚀 Phase 5 & 6: Масштабирование и дополнительные возможности
- См. раздел "Low Priority" выше

## 📝 Technical Debt

1. **Database**
   - Missing foreign key constraints
   - No cascade delete rules
   - Incomplete migration scripts

2. **Code**
   - Some services exceed 500 lines
   - Inconsistent error handling
   - Mixed async/callback patterns

3. **Testing**
   - Low test coverage (~40%)
   - Missing integration tests
   - No performance tests

4. **Documentation**
   - API documentation incomplete
   - Missing deployment guide
   - No troubleshooting guide

## 🐛 Known Issues

1. **ServiceMatcher** (✅ FIXED July 30, 2025)
   - ✅ FIXED: Точное совпадение теперь имеет максимальный приоритет (1000 баллов)
   - ✅ FIXED: Добавлено правило all_words_match для составных услуг
   - ✅ FIXED: "воск комплекс" теперь правильно выбирает "ВОСК КОМПЛЕКС"

2. **Booking Flow** (Updated July 23, 2025)
   - ❌ **CRITICAL**: Missing staff_id when creating booking
   - ❌ AI uses `staff_id: "last"` but code doesn't handle it
   - ❌ No automatic alternative slots shown on booking errors
   - ✅ FIXED: Wrong parameter order in getAvailableSlots
   - Ошибка "Сотрудник не оказывает выбранную услугу"
   - lastSearch сохраняет несовместимую пару service_id + staff_id

3. **Rapid-Fire Batching** (Critical - July 23, 2025)
   - ❌ **CRITICAL**: Батчи исчезают после таймаута без обработки
   - ❌ Сообщения пользователей теряются
   - ❌ TTL конфликт между временем жизни и таймаутом обработки
   - 🔄 В процессе отладки, добавлено детальное логирование
   - Нет проверки совместимости услуга-мастер перед созданием записи

3. **Performance**
   - High latency to Supabase from Russia (150-200ms)
   - Context loading can be slow for busy salons
   - No connection pooling

4. **Configuration** (✅ FIXED August 2, 2025)
   - ✅ Redis port hardcoded with temporary hacks - FIXED with centralized config
   - ✅ All Redis clients now use centralized configuration

   - Need separate configs for local vs production

5. **Client Search Issue** (✅ FIXED July 29, 2025)
   - ✅ **ПРОБЛЕМА РЕШЕНА** - изменен поиск с raw_phone на phone
   - ✅ AI теперь правильно находит существующих клиентов
   - ✅ Не спрашивает имя повторно у существующих клиентов

6. **Schedule Visibility Issue** (✅ FIXED July 29, 2025)
   - ✅ **ПРОБЛЕМА РЕШЕНА** - увеличен период до 30 дней
   - ✅ AI теперь видит расписание на месяц вперед
   - ✅ Синхронизация обновлена для загрузки 30 дней

7. **YClients API Permissions** (✅ FIXED July 28, 2025)
   - ✅ **ПРОБЛЕМА РЕШЕНА** - добавлен заголовок `X-Partner-Id: 8444`
   - ✅ Поиск клиента по телефону (`POST company/962302/clients/search`) - РАБОТАЕТ
   - ✅ Получение списка записей (`GET records/962302`) - РАБОТАЕТ
   - ⏳ Требует тестирования:
     - Создание нового клиента (`POST clients/962302`)
     - Удаление записи (`DELETE record/962302/{id}`)
     - Получение информации о записи (`GET record/962302/{id}`)
     - Изменение записи (`PUT record/962302/{id}`)
     - Изменение статуса визита (`PUT visits/{visit_id}/{record_id}`)
   - **Решение**: Использовать заголовки:
     ```
     Authorization: Bearer cfjbs9dpuseefh8ed5cp, User 16e0dffa0d71350dcb83381e03e7af29
     X-Partner-Id: 8444
     ```

8. **Reliability**
   - WhatsApp session can expire
   - No automatic reconnection
   - Queue can get stuck on errors

9. **UX**
   - Error messages not user-friendly
   - No typing indicators
   - Limited formatting options
   - Prices not showing correctly (format issues)

## 📊 Metrics to Track

- Average response time
- Daily active users
- Booking conversion rate
- Error rate by type
- Cache hit ratio
- Worker memory usage

## 📊 Redis Context Storage Details

### TTL (Time To Live) настройки:
- **Контекст диалога**: 30 дней (`contextTTL = 30 * 24 * 60 * 60`)
- **Временные данные**: 24 часа (`shortTTL = 24 * 60 * 60`)
- **Предпочтения клиента**: 1 год (`preferenceTTL = 365 * 24 * 60 * 60`)
- **Максимум сообщений**: 50 последних (`maxMessages = 50`)

### Что сохраняется в Redis:
```javascript
{
  lastCommand: "CREATE_BOOKING",        // Последняя выполненная команда
  lastService: "стрижка",              // Последняя услуга
  lastStaff: "Рамзан",                 // Последний мастер
  lastMessageTime: "2025-07-30T12:42:19.000Z",
  recentMessages: [...],               // Последние 5 сообщений
  clientName: "Наталия"                // Имя клиента
}
```

### Ограничения Redis:
1. **Память**: Redis хранит все данные в RAM, поэтому важен размер
2. **Размер ключа**: Максимум 512 MB на ключ (у нас ~1-2 KB)
3. **Истечение**: После 30 дней контекст автоматически удаляется
4. **Структура**: Используем hash для эффективного хранения

## 🔄 Update History

- **2025-08-02**: Centralized Redis configuration, added greeting rule, improved error handling
- **2025-08-01**: Fixed staff schedule display - now properly filters by is_working and has_booking_slots flags
- **2025-07-30**: Fixed ServiceMatcher exact match priority, database saving to appointments_cache, CHECK_STAFF_SCHEDULE logic
- **2025-07-30**: Fixed context loss, name extraction, reminders for close bookings
- **2025-07-29**: Fixed time context issue, improved UX for master unavailability, removed duplicate info
- **2025-07-28**: Fixed YClients API permissions, implemented booking cancellation
- **2025-07-24**: Added CHECK_STAFF_SCHEDULE, fixed AI internal thoughts
- **2025-07-23**: Implemented Redis batching for rapid-fire messages
- **2024-07-20**: Added relative date parsing, improved ServiceMatcher (issues remain)
- **2024-07-19**: Implemented auto-parsing from YClients, fixed working hours
- **2024-07-16**: Added Context Engineering structure
- **2024-07-13**: Completed v1 → v2 migration
- **2024-07-11**: Fixed database sync issues
- **2024-07-10**: Initial v2 architecture implementation