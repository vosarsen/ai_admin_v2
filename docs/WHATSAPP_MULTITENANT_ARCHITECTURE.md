# WhatsApp Multi-Tenant Architecture with Pairing Code

## 📐 Архитектура решения

### Обзор
Полноценная multi-tenant система для управления WhatsApp подключениями с поддержкой Pairing Code для каждой компании изолированно.

### Ключевые компоненты

```
┌─────────────────────────────────────────────────────┐
│                   Web Interface                      │
│         (Unique URL per company with auth)          │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  API Layer                          │
│   /api/whatsapp/sessions/{companyId}/pairing-code  │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│           Session Manager (Singleton)               │
│         Manages all company sessions                │
└──────┬─────────────┬────────────────┬──────────────┘
       │             │                │
┌──────▼──────┐ ┌───▼────────┐ ┌────▼──────────┐
│   Baileys   │ │  Pairing   │ │    Health     │
│  Provider   │ │   Code     │ │   Monitor     │
│             │ │  Manager   │ │               │
└─────────────┘ └────────────┘ └───────────────┘
       │             │                │
┌──────▼─────────────▼────────────────▼──────────────┐
│              Data Layer                            │
│  ┌──────────┐  ┌─────────┐  ┌──────────────┐     │
│  │ Supabase │  │  Redis  │  │ File System  │     │
│  │   (DB)   │  │ (Cache) │  │  (Sessions)  │     │
│  └──────────┘  └─────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────┘
```

## 🔐 Изоляция данных

### 1. Уровень сессий
Каждая компания имеет изолированную сессию WhatsApp:
- Отдельная папка для auth данных: `/sessions/company_{companyId}/`
- Независимое управление подключением
- Изолированные обработчики сообщений

### 2. Уровень базы данных
```sql
-- Все таблицы имеют company_id для изоляции
whatsapp_pairing_codes   -- История кодов сопряжения
whatsapp_events          -- События по компаниям
whatsapp_rate_limits     -- Лимиты для каждой компании
whatsapp_session_health  -- Здоровье сессий
```

### 3. Уровень кеша (Redis)
```
whatsapp:qr_count:{companyId}        -- Счетчик QR попыток
whatsapp:pairing:{companyId}         -- Активный pairing code
whatsapp:session:{companyId}         -- Состояние сессии
whatsapp:rate_limit:{companyId}      -- Rate limiting
```

## 🚀 Процесс подключения компании

### Шаг 1: Компания открывает свою страницу
```
https://ai-admin.com/whatsapp-pairing.html?company=962302
```

### Шаг 2: Выбор метода подключения
- **QR Code** (по умолчанию, до 3 попыток)
- **Pairing Code** (при блокировке или по выбору)

### Шаг 3: Генерация Pairing Code
```javascript
// API запрос
POST /api/whatsapp/sessions/962302/pairing-code
{
  "phoneNumber": "79001234567"
}

// Ответ
{
  "success": true,
  "companyId": "962302",
  "pairingCode": "ABCD-EFGH",
  "expiresIn": "60 seconds"
}
```

### Шаг 4: Автоматическое переключение
Если QR код заблокирован после 3 попыток, система автоматически:
1. Определяет превышение лимита
2. Получает номер телефона компании из БД
3. Переключается на Pairing Code
4. Уведомляет администратора компании

## 📊 Rate Limiting для каждой компании

### Конфигурация
```javascript
{
  maxQRAttempts: 3,           // До переключения на pairing
  maxPairingPerHour: 5,       // Pairing codes в час
  cooldownMinutes: 30,        // Cooldown после лимита
  codeValiditySeconds: 60     // Время жизни кода
}
```

### Проверка лимитов
```javascript
// Проверка перед генерацией
const canGenerate = pairingCodeManager.canGenerateCode(companyId);
if (!canGenerate) {
  throw new Error(`Wait ${canGenerate.minutesLeft} minutes`);
}
```

## 🔔 Система уведомлений

### Email уведомления
При генерации pairing code отправляется email:
- Администратору компании
- На notification_email из настроек

### SMS уведомления (опционально)
Если включено в whatsapp_config компании:
```json
{
  "smsNotifications": true,
  "smsProvider": "twilio"
}
```

### Webhook уведомления
```javascript
// Событие генерации кода
emit('pairing-code', {
  companyId: '962302',
  code: 'ABCD-EFGH',
  phoneNumber: '79001234567'
});
```

## 🛡️ Безопасность

### 1. Аутентификация компаний
- Каждая компания имеет уникальный токен
- Проверка прав доступа к сессии
- Логирование всех действий

### 2. Изоляция сессий
- Невозможно получить доступ к чужой сессии
- Отдельные обработчики сообщений
- Изолированные auth данные

### 3. Защита от злоупотреблений
- Rate limiting на уровне компании
- Автоматическая блокировка при превышении
- Cooldown периоды

## 🔧 Администрирование

### Мониторинг всех компаний
```sql
-- Dashboard view
SELECT * FROM whatsapp_connection_status;
```

### Управление конкретной компанией
```bash
# Проверить статус
curl /api/whatsapp/sessions/962302/status

# Принудительное переподключение
curl -X POST /api/whatsapp/sessions/962302/reconnect

# Очистка сессии
curl -X POST /api/whatsapp/sessions/962302/cleanup
```

### Массовые операции
```javascript
// Переподключить все отключенные компании
for (const company of disconnectedCompanies) {
  await sessionManager.initializeCompanySession(company.id, {
    usePairingCode: true,
    phoneNumber: company.whatsapp_phone
  });
}
```

## 📈 Масштабирование

### Горизонтальное масштабирование
```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Worker 1  │     │  Worker 2  │     │  Worker 3  │
│ Companies  │     │ Companies  │     │ Companies  │
│   1-1000   │     │ 1001-2000 │     │ 2001-3000 │
└────────────┘     └────────────┘     └────────────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                         │
                    ┌────▼────┐
                    │  Redis  │
                    │ PubSub  │
                    └─────────┘
```

### Вертикальное масштабирование
- Увеличение ресурсов для обработки большего числа сессий
- Оптимизация памяти через периодическую очистку

## 🚦 Статусы и мониторинг

### Статусы сессий
- `connecting` - Подключение в процессе
- `connected` - Активная сессия
- `disconnected` - Отключено
- `error` - Ошибка подключения
- `blocked` - Заблокировано из-за rate limit

### Метрики для мониторинга
```javascript
{
  totalCompanies: 100,
  connectedSessions: 85,
  pendingPairingCodes: 3,
  blockedCompanies: 2,
  averageReconnectTime: '45s',
  qrToParingRatio: '30:70'
}
```

## 🔄 Миграция существующих компаний

### Автоматическая миграция
При запуске системы:
1. Загружаются все компании с `whatsapp_enabled = true`
2. Проверяется наличие существующих сессий
3. Для отключенных инициируется подключение

### Ручная миграция
```javascript
// Скрипт миграции
const companies = await getCompaniesWithWhatsApp();
for (const company of companies) {
  if (!company.whatsapp_phone) {
    // Запросить номер у администратора
    await notifyAdminToAddPhone(company.id);
  } else {
    // Инициализировать с pairing code
    await sessionManager.initializeCompanySession(company.id, {
      usePairingCode: true,
      phoneNumber: company.whatsapp_phone
    });
  }
}
```

## 📝 Checklist для внедрения

- [x] Создать pairing-code-manager.js
- [x] Обновить baileys-provider.js
- [x] Добавить API endpoints
- [x] Создать веб-интерфейс
- [x] Добавить SQL миграции
- [x] Интегрировать с session-manager
- [ ] Развернуть на сервере
- [ ] Протестировать с реальными компаниями
- [ ] Настроить email уведомления
- [ ] Добавить метрики в мониторинг

## 🎯 Результат

Полноценная multi-tenant система, где:
- ✅ Каждая компания управляет своим WhatsApp изолированно
- ✅ Автоматическое переключение QR → Pairing Code при блокировке
- ✅ Rate limiting и защита от злоупотреблений
- ✅ Полная изоляция данных между компаниями
- ✅ Масштабируемость до 10,000+ компаний

---

*Система готова к развертыванию и тестированию на реальных компаниях*