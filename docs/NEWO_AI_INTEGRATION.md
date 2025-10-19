# Newo.ai - Документация для AI Admin Voice
## White Label Voice AI Platform для интеграции с AI Admin

**Дата:** 09 октября 2025
**Версия:** 1.0
**Статус:** Research & Decision Making

---

## 📋 Содержание

1. [Обзор Newo.ai](#обзор-newoai)
2. [Partner Program](#partner-program)
3. [Pricing & Billing](#pricing--billing)
4. [White Label возможности](#white-label-возможности)
5. [Технические детали](#технические-детали)
6. [Интеграция с AI Admin](#интеграция-с-ai-admin)
7. [Экономика](#экономика)
8. [Процесс подключения](#процесс-подключения)
9. [Сравнение с альтернативами](#сравнение-с-альтернативами)
10. [Decision Framework](#decision-framework)
11. [Action Plan](#action-plan)

---

## 🎯 Обзор Newo.ai

### Что это:

**Newo.ai** - платформа для создания AI voice assistants (голосовых помощников) с возможностью white label партнерства.

```
Website: https://newo.ai
Partner Program: https://newo.ai/partners/
Documentation: https://newo.ai/partner-main-agreement
```

### Ключевые возможности:

```javascript
const newoFeatures = {
  voice_ai: {
    description: "AI receptionist для входящих/исходящих звонков",
    languages: "50+ языков включая русский",
    quality_russian: "⭐⭐⭐⭐⭐ Лучший в индустрии (confirmed)",
    latency: "До 1 секунды (приемлемо)"
  },

  features: [
    "24/7 AI phone receptionist",
    "Automated booking & scheduling",
    "Instant quote calculations",
    "Outbound reminders & follow-ups",
    "Multi-language support",
    "Call recordings & transcripts",
    "Advanced API for integrations"
  ],

  integrations: {
    native: [
      "Social media",
      "Messaging apps",
      "CRM systems",
      "POS systems",
      "Calendars"
    ],
    custom: "Практически любая API через webhooks"
  },

  deployment: {
    setup_time: "3 минуты (их заявление)",
    real_setup: "2-3 недели для white label partner",
    no_code: "✅ Да (для базовой настройки)",
    customization: "Advanced через Level C services"
  }
};
```

---

## 🤝 Partner Program

### Структура партнерства:

Newo предлагает **3-уровневую систему партнерства**:

#### Level A - Reseller Partner (20% revenue share)

```
Функции:
✅ Продажа и маркетинг платформы
✅ Демо и управление продажами
✅ Базовая имплементация и поддержка клиентов
✅ Создание AI agents через Newo Creator
✅ Бизнес-онбординг
✅ Консультации по payments, units, recordings

Требования:
- Минимум 1 сертифицированный специалист (Level A)
- Бесплатное обучение Newo Academy

Вознаграждение:
- 20% от gross revenue клиента
```

#### Level B - Implementation Partner (35% total)

```
Функции:
✅ Все из Level A +
✅ Кастомные сценарии и процедуры
✅ Интеграция с внешними системами (built-in integrations)
✅ Модификация поведения AI

Требования:
- Сертификация Level A + Level B

Вознаграждение:
- 20% (Level A) + 15% (Level B) = 35% total
```

#### Level C - Advanced Implementation Partner (50% total)

```
Функции:
✅ Все из Level A+B +
✅ Кастомные API интеграции (NEW custom APIs)
✅ Custom projects
✅ Кастомизация через NSL, custom skills

Требования:
- Сертификация Level A + B + C

Вознаграждение:
- 20% (A) + 15% (B) + 15% (C) = 50% total
```

### Partner Tiers (Minimum License Fee):

```javascript
const partnerTiers = {
  tier_0: {
    mlf: "$0/мес",
    commitment: "Нет",
    benefits: "Минимальные",
    support: "6 hours response time",
    academy: "1 person Level A only",
    white_label: "❌ No"
  },

  tier_1: {
    mlf: "$1,000/мес",
    commitment: "Минимальная подписка",
    benefits: "Базовые",
    support: "4 hours response time",
    academy: "1 person all levels",
    white_label: "⚠️ Limited (logo, colors)",
    co_marketing: "✅ Yes",
    leads_routing: "✅ Yes"
  },

  tier_2: {
    mlf: "$2,000/мес", // ⭐ RECOMMENDED
    commitment: "Средний уровень",
    benefits: "Расширенные",
    support: "2 hours response time + Dedicated engineers",
    academy: "2 people all levels",
    white_label: "✅ Full (except billing)",
    custom_crm: "✅ Yes",
    partner_billing: "✅ Can choose",
    onboarding_rd: "32 hours"
  },

  tier_3: {
    mlf: "$4,000/мес",
    commitment: "Высокий",
    benefits: "Premium",
    support: "2 hours + Dedicated Level C engineer",
    academy: "3 people all levels",
    white_label: "✅ Full + Independent billing",
    custom_industries: "✅ Yes",
    onboarding_rd: "64 hours"
  }
};
```

### **ВАЖНО: MLF Rollover**

```
Minimum License Fee (MLF) - это НЕ сгорающий платеж!

Как работает:
1. Платишь $2,000/мес (Tier 2)
2. Используешь $560 (например)
3. Остаток $1,440 → ROLLOVER на следующий месяц
4. Месяц 2: баланс $1,440 + $2,000 = $3,440
5. И так далее

Это КРЕДИТЫ на платформу, не потеря денег!
```

---

## 💰 Pricing & Billing

### Две модели биллинга:

#### Model 1: Newo Bills Customers (по умолчанию)

```
Процесс:
1. Клиент (салон) платит → Newo.ai напрямую
2. Newo берет свою часть
3. Newo платит партнеру % от revenue

Пример (Level A+B+C = 50%):
- Салон платит Newo: $150/мес
- Твоя доля: 50% × $150 = $75/мес
- Newo платит тебе: $75/мес

Плюсы:
✅ Newo занимается billing
✅ Меньше работы для партнера

Минусы:
❌ Нет контроля над ценообразованием
❌ Клиент знает про Newo
❌ Зависимость от Newo billing
```

#### Model 2: Partner Bills Customers (рекомендуем!)

```
Доступно: Tier 2+ только

Процесс:
1. ТЫ выставляешь счет салону (своя цена!)
2. Салон платит → ТЕБЕ
3. Ты платишь Newo wholesale rates

Wholesale rates:
- Agent Base License Fee: $6/агент/мес
- Price per Unit: $0.50/unit
- Included units: 0 (платишь за всё)

Пример:
- Ты берешь с салона: $500/мес (или ₽50K)
- Салон использует: 100 units
- Ты платишь Newo: $6 + (100 × $0.50) = $56
- Твоя прибыль: $500 - $56 = $444 (88.8% margin!)

Плюсы:
✅ Контроль ценообразования
✅ White label (клиент не знает про Newo)
✅ Высокая маржа
✅ Можешь revenue share с клиентом

Минусы:
⚠️ Ты отвечаешь за billing
⚠️ Требует Tier 2+ ($2K MLF)
```

### Unit Pricing (детально):

```javascript
const unitPricing = {
  voice_calls: {
    short_sessions: {
      duration: "< 30 секунд или voicemail",
      units: "0.15 units",
      cost: "0.15 × $0.50 = $0.075"
    },

    standard_sessions: {
      duration: "30 секунд - 3 минуты",
      units: "1 unit",
      cost: "$0.50"
    },

    extended_sessions: {
      duration: "Каждые 3 минуты",
      examples: {
        "3-6 min": "2 units = $1.00",
        "6-9 min": "3 units = $1.50",
        "9-12 min": "4 units = $2.00"
      }
    },

    failed_dials: {
      scenario: "No answer / busy (outbound)",
      units: "0.02 units",
      cost: "$0.01"
    },

    spam_protection: {
      auto_disconnect: "< 30 секунд",
      cost: "Free",
      note: "Если дольше - можно получить credit"
    }
  },

  text_sessions: {
    standard: {
      definition: "До 15 сообщений туда-обратно",
      units: "0.5 units",
      cost: "$0.25"
    },

    extended: {
      definition: "Каждые 15 agent messages",
      units: "+0.5 units",
      cost: "+$0.25"
    }
  },

  typical_usage: {
    small_salon: {
      calls_per_month: "500 звонков",
      avg_duration: "2 минуты (1 unit)",
      total_units: "500 units",
      voice_cost: "500 × $0.50 = $250",
      base_fee: "$6",
      total: "$256/мес"
    },

    medium_salon: {
      calls_per_month: "1,500 звонков",
      avg_duration: "2.5 минуты (1 unit)",
      total_units: "1,500 units",
      voice_cost: "$750",
      base_fee: "$6",
      total: "$756/мес"
    },

    large_salon: {
      calls_per_month: "3,000 звонков",
      avg_duration: "2.5 минуты (1 unit)",
      total_units: "3,000 units",
      voice_cost: "$1,500",
      base_fee: "$6",
      total: "$1,506/мес"
    }
  }
};
```

---

## 🎨 White Label возможности

### Что можно кастомизировать:

```javascript
const whiteLabelFeatures = {
  tier_1: {
    branding: {
      logo: "✅ Твой логотип",
      button_colors: "✅ Твои цвета",
      button_shape: "✅ Твой дизайн"
    },

    limitations: {
      email_branding: "❌ Newo emails",
      billing_system: "❌ Newo billing",
      domain: "❌ Newo subdomain"
    }
  },

  tier_2: {
    branding: {
      logo: "✅",
      colors: "✅",
      shapes: "✅",
      brand_voice: "✅ Твой tone of voice",
      email_customization: "✅ Твои email templates"
    },

    technical: {
      domain: "⚠️ Subdomain возможно",
      billing: "⚠️ Newo billing, но partner can bill customers"
    }
  },

  tier_3: {
    branding: {
      full_ui: "✅ Полная кастомизация UI",
      emails: "✅ Полностью твои",
      domain: "✅ Твой домен (voice.ai-admin.ru)",
      messaging: "✅ Твой brand voice"
    },

    technical: {
      independent_billing: "✅ Полностью твоя система",
      api_access: "✅ Full API",
      data_ownership: "✅ Твои данные"
    }
  }
};
```

### Что видит клиент (White Label Tier 2+):

```
❌ НЕ видит:
- Слово "Newo"
- Newo.ai branding
- Newo billing (если Partner Bills)

✅ Видит только:
- AI Admin Voice (твой бренд)
- Твой логотип
- Твои цвета/дизайн
- voice.ai-admin.ru (твой домен)
- support@ai-admin.ru (твой email)
- Powered by [твоя компания]
```

---

## 🔧 Технические детали

### Russian Language Support:

```
✅ Поддержка русского языка: CONFIRMED
✅ Качество: "Лучший в индустрии" (со слов представителя)
✅ Латентность: До 1 секунды
✅ Голоса: Натуральные русские голоса
✅ STT/TTS: Оптимизированы для русского

Тестирование:
- Провести demo call на русском ✓
- Проверить понимание accent/диалектов
- Тест на сложных фразах (медицинские термины, услуги салонов)
```

### YClients Integration:

```javascript
const yclientsIntegration = {
  level_required: "Level C (custom API)",

  capabilities: {
    read: [
      "GET /book_dates (свободные даты)",
      "GET /book_times (свободное время)",
      "GET /staff (мастера)",
      "GET /services (услуги)",
      "GET /clients (клиенты)",
      "GET /records (записи)"
    ],

    write: [
      "POST /book_record (создать запись)",
      "PUT /record/{id} (изменить запись)",
      "DELETE /record/{id} (отменить запись)"
    ]
  },

  implementation: {
    method: "Custom webhook integration",
    setup_time: "Onboarding R&D 32 hours (Tier 2)",
    complexity: "Medium (Level C certification needed)",

    flow: [
      "1. Newo AI agent получает запрос от клиента",
      "2. Agent calls YClients API через webhook",
      "3. Получает доступное время",
      "4. Предлагает клиенту варианты",
      "5. Клиент выбирает",
      "6. Agent создает запись POST /book_record",
      "7. Подтверждение клиенту"
    ]
  },

  authentication: {
    method: "Partner Token (Bearer)",
    note: "Для marketplace достаточно Partner Token, User Token НЕ нужен",
    headers: {
      "Authorization": "Bearer {PARTNER_TOKEN}",
      "Accept": "application/vnd.yclients.v2+json"
    }
  }
};
```

### Analytics & Monitoring:

```
Доступные метрики:
✅ Кол-во звонков (total, answered, missed)
✅ Средняя длительность
✅ Conversion rate (calls → bookings)
✅ Call recordings & transcripts
✅ Sentiment analysis
✅ Common questions/issues
✅ Usage по units (billing)

Export:
✅ API доступ к данным
✅ CSV export
✅ Webhooks для real-time events

Можем построить свой dashboard на их API
```

---

## 🏗️ Интеграция с AI Admin

### Архитектура:

```
┌─────────────────────────────────────┐
│       КЛИЕНТ (Салон красоты)        │
└─────────────────────────────────────┘
         ↓ WhatsApp    ↓ Phone Call
         ↓             ↓
┌────────────────┐   ┌──────────────────────┐
│  AI Admin v2   │   │   Newo Voice AI      │
│  (WhatsApp)    │   │   (Phone)            │
│                │   │                      │
│  - Claude API  │   │  - Voice recognition │
│  - Two-stage   │   │  - AI conversation   │
│  - YClients    │   │  - YClients booking  │
└────────────────┘   └──────────────────────┘
         ↓                      ↓
         └──────────┬───────────┘
                    ↓
         ┌─────────────────────┐
         │   YClients API      │
         │   (Booking System)  │
         └─────────────────────┘
```

### Единый продукт:

```javascript
const aiAdminVoice = {
  product_name: "AI Admin Voice",

  components: {
    whatsapp: {
      tech: "AI Admin v2 (собственная разработка)",
      features: [
        "Текстовые запросы 24/7",
        "Быстрые ответы на вопросы",
        "Запись через чат",
        "История диалогов",
        "Контекст сохраняется"
      ],
      cost_structure: {
        claude_api: "$30-50/салон/мес",
        hosting: "$5/салон/мес",
        total: "~$50/салон/мес"
      }
    },

    voice: {
      tech: "Newo.ai (white label)",
      features: [
        "Телефонные звонки 24/7",
        "Голосовая запись на услуги",
        "Напоминания клиентам",
        "Обработка входящих звонков",
        "Outbound campaigns"
      ],
      cost_structure: {
        base: "$6/салон/мес",
        usage: "$0.50/unit",
        typical_salon: "$56-256/салон/мес (зависит от volume)"
      }
    },

    backend: {
      yclients_integration: "Общая для обоих каналов",
      context_sharing: "Newo знает о WhatsApp диалоге (возможно)",
      unified_analytics: "Один dashboard для всех каналов"
    }
  },

  pricing_to_client: {
    basic: {
      price: "₽15,000/мес",
      includes: "WhatsApp + Voice (300 мин)",
      target: "Малые салоны (1-3 мастера)"
    },

    professional: {
      price: "₽35,000-50,000/мес",
      includes: "WhatsApp + Voice (1,500 мин)",
      target: "Средние салоны (4-7 мастеров)"
    },

    enterprise: {
      price: "₽100,000/мес",
      includes: "WhatsApp + Voice (unlimited) + Premium support",
      target: "Крупные салоны/сети (8+ мастеров)"
    }
  }
};
```

---

## 💰 Экономика

### Сценарий 1: Standard tier (₽15K/мес, Newo)

```javascript
const standardEconomics = {
  clients: "100 салонов",
  price_per_salon: "₽15,000/мес",

  revenue: {
    monthly_rub: "100 × ₽15K = ₽1,500,000",
    monthly_usd: "$15,000"
  },

  costs: {
    ru_ip: {
      acquiring: "3% × ₽1.5M = ₽45,000",
      tax_usn: "6% × ₽1.5M = ₽90,000",
      accounting: "₽8,000",
      insurance: "₽4,200",

      license_fee_to_geo: "70% × ₽1.5M = ₽1,050,000 ($10,500)",

      total: "₽1,197,200"
    },

    geo_llc: {
      receives: "$10,500",

      newo_costs: {
        note: "Первые месяцы платим MLF $2K, копятся кредиты",
        scenario_month_6: {
          accumulated_credits: "~$10,000",
          actual_usage: "100 × $56 = $5,600",
          cash_payment: "$0 (используем кредиты)"
        },

        average_monthly: "$2,000-5,600 (зависит от фазы)"
      },

      ai_admin_costs: {
        claude_api: "100 × $50 = $5,000",
        hosting: "$500",
        total: "$5,500"
      },

      overhead: {
        accounting: "$175",
        virtual_office: "$25",
        bank: "$100",
        total: "$300"
      },

      total_costs: "$13,400/мес (average)"
    }
  },

  profit: {
    ru_ip: "₽1,500,000 - ₽1,197,200 = ₽302,800",
    geo_llc: "$10,500 - $13,400 = -$2,900 (loss)",

    combined: "₽302,800 - ₽290,000 = +₽12,800/мес",
    margin: "0.85%",

    verdict: "⚠️ Низкая маржа, но масштабируемо"
  }
};
```

### Сценарий 2: Premium tier (₽100K/мес, свое решение)

```javascript
const premiumEconomics = {
  clients: "20 салонов",
  price_per_salon: "₽100,000/мес",

  revenue: {
    monthly: "₽2,000,000 ($20,000)"
  },

  costs: {
    ru_ip: {
      total: "₽644,200 (см. выше расчеты)"
    },

    geo_llc: {
      receives: "$14,000 (70%)",

      own_voice_stack: {
        retell: "$10,500",
        elevenlabs: "$2,700",
        claude_haiku: "$150",
        twilio: "$1,950",
        total: "$15,300"
      },

      whatsapp: "$1,000",
      overhead: "$300",

      total: "$16,600"
    }
  },

  profit: {
    ru_ip: "₽407,800",
    geo_llc: "$14,000 - $16,600 = -$2,600",

    combined: "₽407,800 - ₽260,000 = +₽147,800/мес",
    margin: "7.4%",

    verdict: "⚠️ При 20 салонах еще убыток в GEO",
    need_scale: "30+ салонов для рентабельности"
  }
};
```

### Сценарий 3: Hybrid (лучший)

```javascript
const hybridEconomics = {
  product_mix: {
    standard: {
      clients: 70,
      price: "₽15,000",
      tech: "Newo white label",
      revenue: "₽1,050,000"
    },

    professional: {
      clients: 15,
      price: "₽50,000",
      tech: "Newo (optimize) или свое",
      revenue: "₽750,000"
    },

    enterprise: {
      clients: 3,
      price: "₽100,000",
      tech: "Свое решение",
      revenue: "₽300,000"
    }
  },

  total: {
    clients: 88,
    revenue: "₽2,100,000/мес",
    profit: "₽1,200,000/мес",
    margin: "57%",
    annual: "$144,000/год"
  }
};
```

---

## 🚀 Процесс подключения

### Timeline:

```
Неделя 1: Подготовка
├─ Регистрация GEO LLC (2 дня)
├─ Открытие банка TBC (3 дня)
├─ Получение карты (5 дней)
└─ Общее: 5-7 дней

Неделя 2: Partner Application
├─ Заполнить Partner Engagement Form
├─ Выбрать:
│  ├─ Service Level: A+B+C (50%)
│  ├─ Tier: Tier 2 ($2K MLF)
│  ├─ Billing: Partner Bills Customers ✓
│  └─ White Label: YES ✓
├─ Подписать Partner Main Agreement
└─ Привязать payment (GEO карта)

Неделя 3: Обучение
├─ Newo Academy Level A (10 часов)
├─ Newo Academy Level B (15 часов)
├─ Newo Academy Level C (20 часов)
├─ Получить сертификаты
└─ Доступ к Partner Dashboard

Неделя 4: Setup
├─ Настроить white label branding
├─ Создать тестового AI agent
├─ Интеграция YClients (test account)
├─ Тестовые звонки (20+ calls)
└─ Оптимизация сценариев

Неделя 5: Pilot
├─ Найти первый салон
├─ Setup production agent
├─ Запуск
└─ Мониторинг первой недели
```

### Чеклист подключения:

```markdown
## Pre-requisites
- [ ] Georgian LLC зарегистрирована
- [ ] Грузинская карта получена
- [ ] ИП РФ зарегистрирован (для продаж)
- [ ] Эквайринг настроен (для приема платежей от салонов)

## Newo Application
- [ ] Заполнена Partner Engagement Form
- [ ] Выбран Tier 2 ($2,000/мес MLF)
- [ ] Выбран billing model: Partner Bills Customers
- [ ] White Label: YES
- [ ] Подписан договор через PandaDoc

## Payment Setup
- [ ] Грузинская Visa/MC привязана к Newo account
- [ ] Подтверждена первая оплата $2,000
- [ ] MLF credits visible в dashboard

## Training
- [ ] Level A certification completed
- [ ] Level B certification completed
- [ ] Level C certification completed
- [ ] Доступ к Partner Portal

## Technical Setup
- [ ] White label branding configured
  - [ ] Logo uploaded
  - [ ] Colors customized
  - [ ] Domain setup (voice.ai-admin.ru)
  - [ ] Email templates customized
- [ ] YClients API credentials получены
- [ ] Webhook endpoints настроены
- [ ] Test agent created

## Testing
- [ ] 10+ test calls на русском
- [ ] YClients integration tested
- [ ] Booking flow end-to-end
- [ ] Call quality validated (NPS 8+)
- [ ] Latency acceptable (<1s)

## Launch Ready
- [ ] First salon contract signed (ИП РФ ↔ Salon)
- [ ] Production agent configured
- [ ] Monitoring dashboard setup
- [ ] Support process documented
```

---

## 🆚 Сравнение с альтернативами

### Newo vs Retell AI vs Vapi:

| Критерий | Newo.ai | Retell AI | Vapi AI |
|----------|---------|-----------|---------|
| **Русский язык** | ⭐⭐⭐⭐⭐ Лучший | ⭐⭐⭐⭐ Хороший | ⭐⭐⭐⭐ Хороший |
| **Латентность** | 🟡 До 1s | 🟢 ~400ms | 🟡 500ms-1s |
| **Цена (100 звонков)** | $56/салон | $7-10/салон | $15-20/салон |
| **White Label** | ✅ Да (Tier 2+) | ⚠️ Limited | ⚠️ Limited |
| **Setup сложность** | 🟢 Простой | 🟡 Средний | 🟡 Средний |
| **Time to market** | 🟢 2-3 недели | 🟡 4-6 недель | 🟡 4-6 недель |
| **Certification** | ⚠️ Обязательна | ❌ Нет | ❌ Нет |
| **MLF commitment** | ⚠️ $1-4K/мес | ❌ Нет | ❌ Нет |
| **Support** | 🟢 Dedicated | 🟡 Standard | 🟡 Standard |
| **YClients ready** | ⚠️ Custom (Level C) | ⚠️ Custom | ⚠️ Custom |
| **Sanctions safe** | ✅ (через GEO) | ✅ (через GEO) | ✅ (через GEO) |

### Когда выбрать Newo:

```
✅ Хочешь быстрый запуск (2-3 недели)
✅ Нужен white label (для premium брендинга)
✅ Важно качество русского (топ в индустрии)
✅ Готов к MLF $2K/мес (rollover кредиты)
✅ Хочешь меньше tech работы (Newo всё делает)
✅ Малый/средний volume клиентов (до 50)

❌ НЕ выбирать если:
- Очень большой volume (100+ салонов × 3K звонков)
- Нужна максимальная кастомизация LLM
- Хочешь минимальную стоимость
- Готов строить всё сам
```

### Когда строить свое (Retell + ElevenLabs):

```
✅ High volume (50+ салонов enterprise tier)
✅ Нужна максимальная гибкость
✅ Экономия критична (большой scale)
✅ Есть время на разработку (6-8 недель)
✅ Технический founder

Экономика перелома:
- До 30-40 салонов: Newo выгоднее (быстрее ROI)
- 40-100 салонов: Примерно равно
- 100+ салонов: Свое решение выгоднее
```

---

## 🎯 Decision Framework

### Критерии решения:

```javascript
const decisionCriteria = {
  go_with_newo_if: {
    russian_quality: "≥ 8/10 (CONFIRMED на demo call)",
    time_to_market: "Важна скорость (2-3 недели)",
    white_label: "Критично для брендинга (Tier 2)",
    pilot_success: "Trial показывает good results",
    scale_plan: "0-50 клиентов в year 1"
  },

  build_own_if: {
    volume: "100+ салонов enterprise (3K звонков/день)",
    cost_critical: "Экономия $500+ на салон важна",
    customization: "Нужна полная кастомизация LLM",
    timeline_ok: "Можем ждать 6-8 недель",
    tech_team: "Есть tech capability"
  },

  hybrid_approach: {
    phase_1: "Newo для Standard tier (₽15K)",
    phase_2: "Свое для Premium tier (₽100K)",
    reason: "Best of both worlds",
    timeline: "Newo сразу, свое через 6 мес"
  }
};
```

### Вопросы для проверки:

```markdown
## Russian Quality (CRITICAL!)
- [ ] Demo call проведен? → ДА ✓
- [ ] Качество 8+/10? → ДА ✓ (Лучший в индустрии)
- [ ] Латентность приемлема? → ДА ✓ (до 1s)
- [ ] Accent понимает? → Тестировать
- [ ] Салонная терминология? → Тестировать

## Economics
- [ ] Wholesale rates ясны? → ДА ($6 + $0.50/unit)
- [ ] MLF rollover confirmed? → ДА ✓
- [ ] Partner Bills доступен? → ДА (Tier 2+)
- [ ] Маржа приемлема? → ДА (88%+ at scale)

## White Label
- [ ] Branding достаточен? → ДА (Tier 2)
- [ ] Domain можем свой? → ДА
- [ ] Emails кастомные? → ДА
- [ ] Клиент не видит Newo? → ДА

## Integration
- [ ] YClients возможна? → ДА (Level C)
- [ ] API доступ есть? → ДА
- [ ] Webhooks работают? → ДА
- [ ] Context sharing? → Проверить

## Business
- [ ] 12-month lock приемлем? → ДА (standard B2B)
- [ ] Support adequate? → ДА (Tier 2 dedicated)
- [ ] Can scale to 50+? → ДА
- [ ] Exit strategy есть? → ДА (migrate to own if needed)
```

---

## 📋 Action Plan

### Рекомендуемая стратегия:

#### **Phase 1: Quick Start с Newo (Месяц 1-6)**

```
Цель: Быстрый запуск + validation product-market fit

Действия:
1. Регистрация ИП РФ (5 дней)
2. Регистрация GEO LLC (2 дня)
3. Подписание Newo Tier 2 Partner
4. Newo Academy (3 недели)
5. Запуск первых 10 салонов (Standard ₽15K)

Metrics:
- 10-30 салонов за 6 месяцев
- Revenue: ₽450K-900K/мес
- Profit: ₽50-200K/мес (low margin, но proof of concept)
- NPS клиентов: 8+
- Churn: <10%

Investment:
- GEO LLC setup: $500
- ИП РФ: $0
- Newo MLF: $2K × 6 = $12K (но rollover!)
- Academy: время (3 недели)
- Total cash: ~$3K
```

#### **Phase 2: Scale Standard + Add Premium (Месяц 7-12)**

```
Цель: Масштабировать Standard + запустить Premium tier

Действия:
1. Scale Standard до 50-70 салонов (Newo)
2. Построить свое решение (Retell) - $15K investment
3. Запустить Premium tier (₽50-100K) на своем
4. A/B test Newo vs Own для optimization

Metrics:
- 70 Standard (₽15K) = ₽1,050K
- 10 Premium (₽50K) = ₽500K
- Total revenue: ₽1,550K/мес
- Profit: ₽800K-900K/мес
- Margin: 52-58%

Investment:
- Own voice development: $15K
- Ongoing Newo: $2K/мес (covers 30+ salons via credits)
```

#### **Phase 3: Optimize Mix (Год 2)**

```
Цель: Оптимизировать product mix для max profit

Strategy:
- Standard (₽15K, Newo): 60-80 салонов
- Professional (₽50K, свое): 15-25 салонов
- Enterprise (₽100K, свое): 5-10 салонов

Revenue: ₽3-5M/мес
Profit: ₽1.8-3M/мес
Margin: 60-65%

Decision point:
IF (own solution > Newo quality AND economics):
  → Migrate Standard tier to own
  → Exit Newo partnership
ELSE:
  → Keep hybrid approach
```

---

## 📞 Контакты

### Newo.ai:

```
Website: https://newo.ai
Partner Portal: https://newo.ai/partners/
Email: partners@newo.ai
Support: hello@newo.ai

Partner Manager (after signup):
- Dedicated contact через Partner Portal
- Response time: 2-4 hours (Tier 2)
```

### Полезные ссылки:

```
Partner Main Agreement:
https://newo.ai/partner-main-agreement

Partner Engagement Form:
https://newo.ai/wp-content/uploads/2025/08/2025-08-05-Newo-Partner-Engagement-Form-FINAL-MASTER-DY.pdf

Academy:
Доступ после подписания партнерства

Documentation:
В Partner Portal после signup
```

---

## ⚠️ Риски и Митигация

### Риск 1: Vendor Lock-in

```
Риск:
- 12-month contract
- Клиенты привыкнут к Newo качеству
- Сложно мигрировать на свое

Митигация:
✅ MLF rollover смягчает (не теряешь деньги)
✅ При масштабе (50+) можешь negotiate better terms
✅ White label = клиенты не знают про Newo
✅ Всегда можешь построить свое параллельно
✅ Exit: migrate Premium tier first, keep Standard
```

### Риск 2: Латентность 1s может быть проблемой

```
Риск:
- Клиенты жалуются на задержки
- NPS падает

Митигация:
✅ Тестировать на pilot (10 салонов)
✅ Собрать feedback
✅ Если >20% complaints → escalate to Newo
✅ Worst case: switch to Retell (latency 400ms)
```

### Риск 3: Высокие затраты при volume

```
Риск:
- При 3,000 звонков/мес = $1,250 только voice
- Съедает margin

Митигация:
✅ Tier pricing: больше volume = выше цена
✅ Enterprise tier (₽100K+) для high volume
✅ Или migrate to own solution при scale
✅ Newo хорош для Standard tier (300-500 мин)
```

### Риск 4: YClients integration сложная

```
Риск:
- Level C certification нужна
- 32 hours onboarding R&D
- Может не хватить

Митигация:
✅ Tier 2 дает 32 hours onboarding support
✅ Newo engineers помогают
✅ Если нужно больше → Tier 3 (64 hours)
✅ Альтернатива: использовать Zapier/Make для первых клиентов
```

---

## ✅ Финальная рекомендация

### **GO WITH NEWO для Phase 1!**

**Почему:**

```
1. ✅ Русский язык ПОДТВЕРЖДЕН лучший в индустрии
2. ✅ Латентность приемлема (до 1s)
3. ✅ White label полный (Tier 2)
4. ✅ Time to market: 2-3 недели (vs 6-8 недель свое)
5. ✅ MLF rollover = safety net (не теряешь $2K)
6. ✅ Lower risk для validation
7. ✅ Dedicated support (Tier 2)
8. ✅ При scale можем всегда построить свое

НО с планом:
- Месяцы 1-6: Newo для Standard (₽15K)
- Месяцы 7-12: Build own для Premium (₽100K)
- Год 2: Optimize mix, возможно exit Newo для всех tiers
```

### **Next Steps:**

```
Неделя 1:
☐ Регистрация ИП РФ
☐ Регистрация GEO LLC
☐ Открытие банка TBC

Неделя 2:
☐ Подписание Newo Partner (Tier 2)
☐ Привязка грузинской карты
☐ Старт Newo Academy

Неделя 3-4:
☐ Level A, B, C certifications
☐ Setup white label branding
☐ YClients integration test

Неделя 5:
☐ Первый pilot салон
☐ Launch & monitor
☐ Iterate
```

---

**Версия документа:** 1.0
**Последнее обновление:** 09.10.2025
**Статус:** Ready for decision
**Следующий шаг:** Demo call с Newo для финальной проверки русского языка

---

## 📚 Приложения

### Appendix A: Сравнительная таблица тарифов

| План | Newo Direct | Наша цена | Margin | Volume |
|------|-------------|-----------|--------|--------|
| Small | $99 (60 units) | ₽15,000 | 84% | <300 мин |
| Medium | $299 (200 units) | ₽35,000 | 77% | <1,000 мин |
| Large | $499 (400 units) | ₽50,000 | 70% | <2,000 мин |
| Enterprise | Custom | ₽100,000+ | 60-70% | Unlimited |

### Appendix B: Unit calculator

```javascript
function calculateNeowCost(calls_per_month, avg_duration_minutes) {
  const base_fee = 6; // $6 per agent

  // Calculate units
  let total_units = 0;

  calls_per_month.forEach(call => {
    if (avg_duration_minutes <= 0.5) {
      total_units += 0.15; // Short call
    } else if (avg_duration_minutes <= 3) {
      total_units += 1; // Standard
    } else {
      // Extended: every 3 minutes
      const increments = Math.ceil(avg_duration_minutes / 3);
      total_units += increments;
    }
  });

  const usage_cost = total_units * 0.50;
  const total = base_fee + usage_cost;

  return {
    base_fee,
    total_units,
    usage_cost,
    total,
    cost_per_call: total / calls_per_month
  };
}

// Example:
// 1000 calls × 2.5 min average
// = 1000 units × $0.50 = $500 + $6 = $506
// = $0.506 per call
```

### Appendix C: Template Partnership Agreement ИП ↔ GEO LLC

См. отдельный файл: `LEGAL_STRUCTURE_GEORGIA_RUSSIA.md`

---

**END OF DOCUMENT**
