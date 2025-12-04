# Robokassa Payment Integration Plan

**Last Updated:** 2025-12-04
**Status:** Planning Complete, Ready for Implementation
**Priority:** High
**Estimated Effort:** ~12 hours

---

## Executive Summary

Интеграция платежного шлюза Robokassa для приёма прямых платежей от салонов красоты за подписку Admin AI. Проект включает создание webhook handler для приёма уведомлений о платежах, сервис для генерации ссылок на оплату, фронтенд страницы успеха/ошибки, и систему хранения платежей в PostgreSQL.

### Ключевые решения
- **Источник платежей:** Напрямую от салонов (не через YClients Marketplace)
- **Режим:** Тестовый → затем боевой
- **Алгоритм хеша:** MD5 (настроено в панели Robokassa)
- **Фискализация:** 54-ФЗ (УСН Доходы)

---

## Current State Analysis

### Существующая инфраструктура

| Компонент | Статус | Файл |
|-----------|--------|------|
| Robokassa Config | ✅ Готов | `src/config/robokassa-config.js` (180 строк) |
| Webhook patterns | ✅ Есть примеры | `src/api/webhooks/yclients.js`, `telegram.js` |
| Repository pattern | ✅ Используется | `src/repositories/BaseRepository.js` |
| PostgreSQL | ✅ Активен | Timeweb PostgreSQL (миграция Nov 2025) |
| Sentry tracking | ✅ Интегрирован | 50+ мест в коде |
| YClients payment notify | ✅ Работает | `src/services/marketplace/marketplace-service.js` |

### Что отсутствует
- ❌ Webhook handler для Robokassa Result URL
- ❌ Сервис генерации платёжных ссылок
- ❌ Таблица `robokassa_payments` в БД
- ❌ Страницы Success/Fail
- ❌ Environment variables для паролей

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Payment Flow                                 │
└─────────────────────────────────────────────────────────────────┘

Admin Panel                    Robokassa                   AI Admin
    │                              │                           │
    │  1. Generate Payment Link    │                           │
    │ ─────────────────────────────────────────────────────────>│
    │                              │                           │
    │  2. Redirect to Robokassa   │                           │
    │<─────────────────────────────│                           │
    │                              │                           │
    │  3. User completes payment   │                           │
    │ ─────────────────────────────>│                           │
    │                              │                           │
    │                              │  4. Result URL callback   │
    │                              │ ─────────────────────────>│
    │                              │                           │
    │                              │  5. Response "OK{InvId}"  │
    │                              │<─────────────────────────│
    │                              │                           │
    │  6. Redirect Success/Fail    │                           │
    │<─────────────────────────────│                           │


┌─────────────────────────────────────────────────────────────────┐
│                     System Components                            │
└─────────────────────────────────────────────────────────────────┘

src/api/webhooks/robokassa.js    ──►  Result URL Handler
        │
        ▼
src/services/payment/robokassa-service.js  ──►  Business Logic
        │
        ▼
src/repositories/RobokassaPaymentRepository.js  ──►  Data Access
        │
        ▼
PostgreSQL: robokassa_payments table  ──►  Persistence
```

---

## Implementation Phases

### Phase 1: Database Schema
**Effort:** S (1 hour)
**Dependencies:** None

Создание таблицы `robokassa_payments` для хранения транзакций.

**Deliverables:**
- Migration script `migrations/20251204_create_robokassa_payments.sql`
- Table with indexes
- Auto-update trigger for `updated_at`

### Phase 2: Repository Layer
**Effort:** M (1.5 hours)
**Dependencies:** Phase 1

Создание repository для работы с платежами по паттерну BaseRepository.

**Deliverables:**
- `src/repositories/RobokassaPaymentRepository.js` (~150 lines)
- Export в `src/repositories/index.js`

### Phase 3: Service Layer
**Effort:** L (2.5 hours)
**Dependencies:** Phase 2

Бизнес-логика: генерация ссылок, проверка подписей, обработка платежей.

**Deliverables:**
- `src/services/payment/robokassa-service.js` (~300 lines)
- MD5 signature generation/verification
- Receipt builder for 54-FZ

### Phase 4: Webhook Handler
**Effort:** M (2 hours)
**Dependencies:** Phase 3

Обработчик Result URL для получения уведомлений о платежах.

**Deliverables:**
- `src/api/webhooks/robokassa.js` (~200 lines)
- Signature verification
- "OK{InvId}" response format

### Phase 5: API Routes
**Effort:** M (2 hours)
**Dependencies:** Phase 4

API endpoints для генерации ссылок и получения статуса платежей.

**Deliverables:**
- `src/api/routes/robokassa.js` (~250 lines)
- Success/Fail page serving
- Admin endpoints for payment management

### Phase 6: Frontend Pages
**Effort:** M (2 hours)
**Dependencies:** None (parallel)

Красивые страницы успеха и ошибки платежа.

**Deliverables:**
- `public/payment/success.html` (~150 lines)
- `public/payment/fail.html` (~150 lines)

### Phase 7: Environment & Config
**Effort:** S (0.5 hours)
**Dependencies:** Phase 4

Настройка переменных окружения на сервере.

**Deliverables:**
- `.env` variables on server
- Documentation update

### Phase 8: Robokassa Panel Configuration
**Effort:** S (0.5 hours)
**Dependencies:** Phase 7

Настройка URLs в панели Robokassa.

**Deliverables:**
- Result URL configured
- Success/Fail URLs configured
- Test mode enabled

---

## Detailed Tasks

### Phase 1: Database Schema

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 1.1 | Create migration file | S | File exists at `migrations/20251204_create_robokassa_payments.sql` |
| 1.2 | Define table schema | S | All columns defined per spec |
| 1.3 | Add indexes | S | Indexes on `salon_id`, `status`, `invoice_id` |
| 1.4 | Run migration on server | S | Table created in Timeweb PostgreSQL |

### Phase 2: Repository Layer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 2.1 | Create RobokassaPaymentRepository class | M | Extends BaseRepository |
| 2.2 | Implement insert() method | S | Creates payment record |
| 2.3 | Implement findByInvoiceId() method | S | Returns payment by InvId |
| 2.4 | Implement updateStatus() method | S | Updates status with metadata |
| 2.5 | Implement getNextInvoiceId() method | S | Generates unique InvId |
| 2.6 | Implement findBySalonId() method | S | Returns payment history |
| 2.7 | Export from repositories/index.js | S | Import works |

### Phase 3: Service Layer

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 3.1 | Create RobokassaService class | M | Basic structure with config |
| 3.2 | Implement buildPaymentSignature() | S | MD5(Login:Sum:InvId:Pass1) |
| 3.3 | Implement verifyResultSignature() | S | MD5(Sum:InvId:Pass2) |
| 3.4 | Implement generatePaymentUrl() | M | Returns full payment URL |
| 3.5 | Implement processPayment() | M | Updates DB, returns result |
| 3.6 | Implement buildReceipt() | S | 54-FZ compliant receipt |
| 3.7 | Add Sentry error tracking | S | All errors captured |

### Phase 4: Webhook Handler

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 4.1 | Create router for /api/payments/robokassa | S | Basic Express router |
| 4.2 | Implement /result endpoint | M | Handles GET and POST |
| 4.3 | Add parameter validation | S | Required params checked |
| 4.4 | Add signature verification | M | Invalid signatures rejected |
| 4.5 | Call processPayment service | S | Service called correctly |
| 4.6 | Return "OK{InvId}" response | S | Exact format required |
| 4.7 | Add health check endpoint | S | /health returns OK |
| 4.8 | Register router in src/index.js | S | Route accessible |

### Phase 5: API Routes

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 5.1 | Implement POST /api/payments/robokassa/create | M | Generates payment link |
| 5.2 | Implement GET /api/payments/robokassa/status/:id | S | Returns payment status |
| 5.3 | Implement GET /api/payments/robokassa/history/:salonId | S | Returns payment list |
| 5.4 | Serve success.html at /payment/success | S | Page renders |
| 5.5 | Serve fail.html at /payment/fail | S | Page renders |
| 5.6 | Add adminAuth middleware | S | Endpoints protected |

### Phase 6: Frontend Pages

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 6.1 | Create public/payment/ directory | S | Directory exists |
| 6.2 | Design success page HTML/CSS | M | Branded, responsive |
| 6.3 | Add payment details display | S | Shows InvId, amount |
| 6.4 | Design fail page HTML/CSS | M | User-friendly error |
| 6.5 | Add retry/support links | S | Actionable options |

### Phase 7: Environment & Config

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 7.1 | Get passwords from Robokassa panel | S | Passwords copied |
| 7.2 | Add ROBOKASSA_* vars to server .env | S | Vars set |
| 7.3 | Set ROBOKASSA_TEST_MODE=true | S | Test mode active |
| 7.4 | Restart PM2 services | S | Config loaded |

### Phase 8: Robokassa Panel Configuration

| # | Task | Effort | Acceptance Criteria |
|---|------|--------|---------------------|
| 8.1 | Set Result URL | S | `https://adminai.tech/api/payments/robokassa/result` |
| 8.2 | Set Success URL | S | `https://adminai.tech/payment/success` |
| 8.3 | Set Fail URL | S | `https://adminai.tech/payment/fail` |
| 8.4 | Verify MD5 algorithm | S | MD5 selected |
| 8.5 | Enable test mode | S | Test payments work |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Invalid signature attacks | High | Medium | Strict MD5 verification, log all failures to Sentry |
| Amount manipulation | High | Low | Verify OutSum matches original payment record |
| Duplicate payments | Medium | Medium | UNIQUE constraint on invoice_id, idempotency checks |
| Robokassa downtime | Medium | Low | Graceful error handling, retry capability |
| Test mode in production | High | Low | Clear environment variable documentation |
| 54-FZ compliance issues | High | Low | Use config from existing robokassa-config.js |

---

## Success Metrics

1. **Functional:** Test payment completes end-to-end
2. **Technical:** Result URL responds "OK{InvId}" within 5 seconds
3. **Security:** Invalid signatures rejected with Sentry alert
4. **Database:** Payment record created with correct status
5. **Frontend:** Success page displays payment confirmation

---

## Required Resources

### Code Dependencies
- Existing: `robokassa-config.js`, `BaseRepository.js`, Sentry, Logger
- New: crypto (built-in Node.js), express router

### Infrastructure
- PostgreSQL: One new table
- Environment: 4 new variables
- Robokassa panel access

### External
- Robokassa test account (already exists: AdminAI)
- SSL certificate (adminai.tech - already active)

---

## Timeline

| Day | Tasks | Hours |
|-----|-------|-------|
| 1 | Phases 1-3 (DB, Repository, Service) | 5h |
| 2 | Phases 4-5 (Webhook, API Routes) | 4h |
| 3 | Phases 6-8 (Frontend, Config, Testing) | 3h |

**Total: ~12 hours across 3 days**

---

## Technical Specifications

### Robokassa Signature Algorithms

**For Payment Form (Password1):**
```javascript
MD5(MerchantLogin:OutSum:InvId:Password1)
```

**For Result URL Verification (Password2):**
```javascript
MD5(OutSum:InvId:Password2)
```

### Required Response Format

Result URL MUST respond with exactly:
```
OK{InvId}
```
No quotes, no extra whitespace. Example: `OK12345`

### Database Schema

```sql
robokassa_payments (
  id SERIAL PRIMARY KEY,
  invoice_id BIGINT UNIQUE NOT NULL,
  salon_id INTEGER NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'RUB',
  description TEXT,
  period_from DATE,
  period_to DATE,
  status VARCHAR(20) DEFAULT 'pending',
  signature_value VARCHAR(64),
  yclients_notified BOOLEAN DEFAULT FALSE,
  yclients_payment_id INTEGER,
  client_email VARCHAR(255),
  receipt_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
)
```

### Environment Variables

```bash
ROBOKASSA_MERCHANT_LOGIN=AdminAI
ROBOKASSA_PASSWORD_1=<from_panel>
ROBOKASSA_PASSWORD_2=<from_panel>
ROBOKASSA_TEST_MODE=true
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `src/config/robokassa-config.js` | Конфигурация (готово) |
| `src/api/webhooks/yclients.js` | Паттерн webhook handler |
| `src/repositories/BaseRepository.js` | Базовый класс repository |
| `src/services/marketplace/marketplace-service.js` | Паттерн сервиса |
| `src/api/routes/yclients-marketplace.js` | Паттерн API routes |

---

## Post-Implementation

### Переход в боевой режим
1. Отключить тестовый режим: `ROBOKASSA_TEST_MODE=false`
2. Сгенерировать новые боевые пароли в Robokassa
3. Обновить пароли в .env
4. Провести тестовый платёж на минимальную сумму

### Мониторинг
- Sentry: отслеживать ошибки webhook
- Логи: проверять успешные платежи
- БД: периодический audit платежей

### Документация
- Обновить CLAUDE.md с командами платежей
- Добавить в troubleshooting guide
