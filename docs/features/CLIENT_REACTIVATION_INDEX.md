# Client Reactivation System - Complete Documentation

## 📚 Навигация по Документации

Полная техническая спецификация системы проактивной реактивации клиентов разбита на следующие части:

---

### **Part 1: [System Overview & Database](./CLIENT_REACTIVATION_SYSTEM.md)**

**Содержание:**
- 📖 Общее описание системы
- 🏗️ Архитектура высокого уровня
- 🗄️ Полная схема базы данных
  - `service_reactivation_rules` - правила реактивации по услугам
  - `reactivation_campaigns` - история кампаний
  - `whatsapp_account_health` - мониторинг WhatsApp
  - `reactivation_settings` - настройки компании
- 🔧 Компоненты системы:
  - Scheduler
  - Inactivity Detector

**Ключевые концепции:**
- Реактивация на уровне услуги (service-based)
- Адаптивные интервалы (manual → historical → AI → default)
- Приоритизация клиентов (VIP → Regular → New)

---

### **Part 2: [Components Details](./CLIENT_REACTIVATION_PART2_COMPONENTS.md)**

**Содержание:**
- 📊 Preference Analyzer - анализ предпочтений клиентов
  - Предпочитаемое время дня (утро/день/вечер)
  - Предпочитаемые дни недели
  - Любимые мастера
  - Любимые услуги
  - Паттерны визитов

- 📅 Slot Finder - поиск подходящих слотов
  - Фильтрация по предпочтениям
  - Ранжирование слотов (мастер > время > день)
  - Интеграция с YClients API

**Ключевые алгоритмы:**
- Scoring system для слотов (60% мастер, 40% время)
- Анализ регулярности визитов
- Расчет уверенности в предпочтениях

---

### **Part 3: [AI Generation & Campaign Management](./CLIENT_REACTIVATION_PART3_AI_AND_CAMPAIGNS.md)**

**Содержание:**
- 🤖 AI Message Generator
  - Построение промптов для Gemini
  - Персонализация сообщений
  - Fallback templates
  - Интеграция с прокси для Gemini

- 📤 Campaign Manager
  - Обработка батчей клиентов
  - Управление попытками
  - Интеграция с WhatsApp queue
  - Обновление контекста в Redis

- 🚦 Limit Manager
  - Проверка дневных/часовых лимитов
  - Контроль времени и дней отправки
  - Spam score мониторинг

**Ключевые функции:**
- Динамическая генерация через AI
- Прогрессивные скидки
- Безопасные лимиты WhatsApp

---

### **Part 4: [Response Tracking & Edge Cases](./CLIENT_REACTIVATION_PART4_TRACKING_AND_EDGE_CASES.md)**

**Содержание:**
- 📥 Response Tracker
  - Отслеживание ответов клиентов
  - Классификация ответов (positive/negative/neutral)
  - Обработка конверсии
  - Opt-out management
  - Планирование следующих попыток

- 🎯 Edge Cases (7 сценариев)
  1. Клиент просит другую услугу
  2. Клиент хочет другого мастера
  3. Временная недоступность (отпуск)
  4. Клиент уже записался напрямую
  5. Множественные активные кампании
  6. WhatsApp аккаунт забанен
  7. Изменение предпочтений в процессе диалога

**Ключевые механизмы:**
- Динамическое обновление предпочтений
- Attribution записей к кампаниям
- Graceful degradation при ошибках

---

### **Part 5: [API, Configuration & Monitoring](./CLIENT_REACTIVATION_PART5_API_CONFIG_MONITORING.md)**

**Содержание:**
- 📡 API Endpoints (15+ endpoints)
  - Settings management
  - Service rules CRUD
  - Statistics & analytics
  - Campaign management
  - WhatsApp health monitoring

- ⚙️ Configuration
  - Полный конфиг файл
  - Environment variables
  - Дефолтные значения по типам бизнеса

- 📊 Monitoring & Analytics
  - Conversion Analyzer
  - Best times analysis
  - ROI calculation
  - Revenue tracking

**Ключевые метрики:**
- Conversion Rate (target: > 15%)
- Response Rate (target: > 30%)
- ROI (target: > 3x)
- Opt-out Rate (target: < 5%)

---

### **Part 6: [Testing & Implementation](./CLIENT_REACTIVATION_PART6_TESTING_IMPLEMENTATION.md)**

**Содержание:**
- 🧪 Testing Strategy
  - Unit tests
  - Integration tests
  - E2E tests с MCP servers

- 📋 Implementation Checklist (6 недель)
  - Phase 1: Foundation
  - Phase 2: Core Functionality
  - Phase 3: Integration
  - Phase 4: API & UI
  - Phase 5: Analytics
  - Phase 6: Testing & Deployment

- 🚀 Deployment Guide
  - Пошаговые инструкции
  - Миграция БД
  - Мониторинг

- 🎓 User Guide
  - Настройка для клиентов
  - Оптимизация конверсии

- 🔧 Troubleshooting
  - Частые проблемы и решения

---

## 🎯 Quick Start

### Для Разработчиков

**1. Изучите архитектуру:**
```
Part 1 (Overview) → Part 2 (Components) → Part 3 (AI & Campaigns)
```

**2. Начните имплементацию:**
```
Part 6 (Implementation Checklist) → Phase 1 (Database)
```

**3. Тестирование:**
```
Part 6 (Testing Strategy) → Unit Tests → Integration Tests
```

### Для Менеджеров Проекта

**Оценка времени:** 6 недель (1 разработчик full-time)

**Этапы:**
- Week 1-2: Foundation & Core (40%)
- Week 3-4: Integration & API (30%)
- Week 5: Analytics & Optimization (15%)
- Week 6: Testing & Deployment (15%)

**Риски:**
- AI генерация может требовать доработки промптов
- Интеграция с YClients API (зависимость от их uptime)
- WhatsApp ban риски (mitigation: adaptive limits)

### Для Бизнеса

**ROI Прогноз:**
- Cost per campaign: ~5₽ (AI call + server)
- Expected conversion: 15%
- Average booking value: 1500₽
- ROI: ~45x (на каждый рубль вложений)

**Benefits:**
- Автоматическая реактивация без участия админа
- Персонализированные сообщения для каждого клиента
- Детальная аналитика и оптимизация
- Увеличение retention на 20-30%

---

## 📊 System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  DAILY SCHEDULER (10:00)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  INACTIVITY DETECTOR                                            │
│  • Query inactive clients                                       │
│  • Apply filters (opt-out, recent attempts)                     │
│  • Prioritize (VIP → Regular → New)                            │
│  • Apply daily limits                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PREFERENCE ANALYZER                                            │
│  • Analyze time preferences (morning/afternoon/evening)         │
│  • Analyze favorite staff                                       │
│  • Analyze visit patterns                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  SLOT FINDER                                                    │
│  • Get available slots from YClients                            │
│  • Filter by preferences                                        │
│  • Rank (60% staff + 40% time)                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI MESSAGE GENERATOR (Gemini)                                  │
│  • Build context                                                │
│  • Generate personalized message                                │
│  • Apply business tone                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LIMIT MANAGER                                                  │
│  • Check WhatsApp health                                        │
│  • Verify daily/hourly limits                                   │
│  • Check time window                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Queue → Client                                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   POSITIVE          NO RESPONSE         NEGATIVE
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  RESPONSE TRACKER                                               │
│  • Track response type                                          │
│  • Update campaign                                              │
│  • Schedule next attempt or complete                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  CONVERSION ANALYZER                                            │
│  • Calculate metrics                                            │
│  • Analyze best times                                           │
│  • Generate insights                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Decisions Made

### 1. Service-Level Reactivation
**Decision:** Правила реактивации на уровне услуги, а не клиента.

**Rationale:**
- Разные услуги = разная частота (стрижка 28 дней, чистка зубов 180 дней)
- Клиент может пользоваться несколькими услугами
- Проще настройка для бизнеса

### 2. Adaptive Intervals
**Decision:** Приоритет источников: manual → historical → AI → default.

**Rationale:**
- Клиент знает свой бизнес лучше
- Исторические данные точнее AI
- AI лучше дефолтов
- Всегда есть fallback

### 3. Staff > Time Preference
**Decision:** Любимый мастер важнее времени (60% vs 40% в scoring).

**Rationale:**
- Клиенты чаще выбирают мастера, а не время
- Готовы подстроиться под мастера
- Подтверждено данными

### 4. AI Generation > Templates
**Decision:** Использовать AI для генерации с fallback на templates.

**Rationale:**
- Персонализация повышает конверсию
- Templates скучные и однообразные
- Fallback обеспечивает надежность

### 5. Adaptive WhatsApp Limits
**Decision:** Динамические лимиты на основе warmup level.

**Rationale:**
- Защита от банов
- Новые аккаунты = низкие лимиты
- Старые аккаунты = высокие лимиты
- Автоматическая адаптация

---

## 📈 Expected Results

### Метрики Успеха (через 3 месяца работы)

| Метрика | Цель | Объяснение |
|---------|------|------------|
| **Conversion Rate** | 15-20% | Процент реактивированных клиентов, создавших запись |
| **Response Rate** | 30-40% | Процент клиентов, ответивших на сообщение |
| **ROI** | 3-5x | Возврат инвестиций (revenue / cost) |
| **Opt-out Rate** | < 5% | Процент клиентов, попросивших не беспокоить |
| **Avg Response Time** | < 24h | Среднее время до ответа клиента |

### Бизнес-Эффект

**Для салона с 1000 активных клиентов:**
- Неактивных (60+ дней): ~200 клиентов
- Реактивировано (15%): 30 записей/месяц
- Средний чек: 1500₽
- Дополнительный revenue: 45,000₽/месяц
- Стоимость реактивации: ~1,000₽/месяц
- **Profit: 44,000₽/месяц** (528,000₽/год)

---

## 🎓 Learning Resources

### Для углубленного понимания:

1. **AI Prompt Engineering:**
   - Как писать эффективные промпты для Gemini
   - Персонализация vs Общие шаблоны
   - Part 3: AI Message Generator

2. **WhatsApp Business Policies:**
   - Ограничения на исходящие сообщения
   - Warmup стратегии
   - Part 5: WhatsApp Health Monitoring

3. **Conversion Optimization:**
   - A/B тестирование сообщений
   - Оптимальное время отправки
   - Part 5: Conversion Analyzer

4. **Customer Segmentation:**
   - Приоритизация клиентов
   - LTV calculation
   - Part 1: Inactivity Detector

---

## 🤝 Contributing

При внесении изменений в систему:

1. **Обновите документацию** в соответствующей части
2. **Добавьте тесты** для новой функциональности
3. **Обновите changelog** с описанием изменений
4. **Протестируйте** на тестовом номере перед продакшном

---

## 📞 Support

**Вопросы по системе:**
- Техническая документация: Parts 1-6
- Troubleshooting: Part 6
- API Reference: Part 5

**Контакты:**
- Technical Issues: создать issue в GitHub
- Business Questions: связаться с product manager

---

**Версия:** 1.0
**Дата:** October 21, 2025
**Статус:** ✅ Specification Complete, Ready for Implementation

---

## Next Steps

1. ✅ Ознакомиться с полной документацией (Parts 1-6)
2. ⏳ Утвердить техническое решение с командой
3. ⏳ Начать Phase 1 имплементации (Database Migration)
4. ⏳ Провести первые тесты на staging
5. ⏳ Gradual rollout на продакшн

**Good luck with implementation! 🚀**
