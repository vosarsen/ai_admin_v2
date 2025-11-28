# Интеграция с Robokassa

**Дата создания:** 2025-11-28
**Статус:** Подготовка к интеграции
**Провайдер:** Robokassa (https://robokassa.ru)

---

## Информация о продавце (Merchant)

### Юридическое лицо

- **Форма:** ИП ВОСКАНЯН АРСЕН ВАЛЕРИЕВИЧ
- **ИНН:** 502717663760
- **ОГРН:** 325508100473782
- **Система налогообложения:** УСН Доходы

### Контактные данные

- **Email для уведомлений:** payments@adminai.tech
- **Email для чеков:** support@adminai.tech
- **Сайт:** https://adminai.tech

---

## Конфигурация

### Файлы конфигурации

1. **Environment variables** (`.env`)
   - `ROBOKASSA_MERCHANT_LOGIN` - логин магазина в Robokassa
   - `ROBOKASSA_PASSWORD_1` - пароль #1 (для формирования подписи)
   - `ROBOKASSA_PASSWORD_2` - пароль #2 (для проверки подписи от Robokassa)
   - `ROBOKASSA_TEST_MODE` - режим тестирования (true/false)

2. **Configuration file** (`src/config/robokassa-config.js`)
   - Содержит всю информацию о продавце
   - URL для callback'ов
   - Настройки фискализации
   - Тарифные планы

### Callback URLs

Robokassa будет отправлять уведомления на следующие URL:

| URL Type | Адрес | Описание |
|----------|-------|----------|
| Result URL | `https://adminai.tech/api/payments/robokassa/result` | Технический URL для получения результата оплаты (обязательно HTTPS) |
| Success URL | `https://adminai.tech/payment/success` | Страница успешной оплаты (куда перенаправляется клиент) |
| Fail URL | `https://adminai.tech/payment/fail` | Страница отмененной/неуспешной оплаты |

**ВАЖНО:** Result URL должен быть доступен через HTTPS и отвечать в течение 30 секунд.

---

## Тарифы Robokassa

На основе исследования [PAYMENT_PROCESSING_RESEARCH_2025.md](../reference/payment-processing/PAYMENT_PROCESSING_RESEARCH_2025.md):

| Тариф | Оборот | Комиссия |
|-------|--------|----------|
| **Стартовый** | от 0 ₽/мес | 3.9-10% |
| **Легкий** | от 300k ₽/мес | 3.3-10% |
| **Оптимальный** | от 700k ₽/мес | 2.9-10% |
| **Продвинутый** | от 3 млн ₽/мес | 2.7-10% |

**Примечание:** Комиссия зависит от способа оплаты. Для подписочной модели (recurring payments) Robokassa предлагает:
- ✅ Поддержка рекуррентных платежей
- ✅ Тестовые периоды подписок
- ✅ Динамические суммы
- ✅ Отправка чеков включена в тариф

---

## Фискализация (54-ФЗ)

### Настройки для УСН Доходы

```javascript
{
  taxSystem: 'usn_income',      // УСН Доходы
  vat: 'none',                  // Без НДС
  paymentMethod: 'full_prepayment',  // Полная предоплата
  paymentObject: 'service',     // Услуга
}
```

### Данные для чека

- **Наименование:** ИП ВОСКАНЯН АРСЕН ВАЛЕРИЕВИЧ
- **ИНН:** 502717663760
- **Email для чеков:** support@adminai.tech

---

## План подключения

### Этап 1: Регистрация в Robokassa (1-2 дня)

**Задачи:**
- [ ] Зарегистрироваться на https://robokassa.ru
- [ ] Заполнить данные о компании (ИП)
  - Название: ИП ВОСКАНЯН АРСЕН ВАЛЕРИЕВИЧ
  - ИНН: 502717663760
  - ОГРН: 325508100473782
- [ ] Загрузить документы:
  - Свидетельство о регистрации ИП
  - Паспорт предпринимателя
  - Банковские реквизиты для вывода средств
- [ ] Дождаться подтверждения от Robokassa (обычно 1-2 рабочих дня)

### Этап 2: Настройка магазина (1 день)

**Задачи:**
- [ ] Создать магазин в личном кабинете Robokassa
- [ ] Настроить параметры:
  - Result URL: `https://adminai.tech/api/payments/robokassa/result`
  - Success URL: `https://adminai.tech/payment/success`
  - Fail URL: `https://adminai.tech/payment/fail`
- [ ] Получить данные для интеграции:
  - Merchant Login
  - Password #1 (для формирования подписи)
  - Password #2 (для проверки результатов)
- [ ] Добавить данные в `.env`:
  ```bash
  ROBOKASSA_MERCHANT_LOGIN=ваш_логин
  ROBOKASSA_PASSWORD_1=ваш_пароль_1
  ROBOKASSA_PASSWORD_2=ваш_пароль_2
  ROBOKASSA_TEST_MODE=true  # для тестирования
  ```

### Этап 3: Разработка интеграции (1-2 недели)

**Компоненты для разработки:**

1. **Payment Service** (`src/services/payments/robokassa-service.js`)
   - Генерация ссылки на оплату
   - Проверка подписи от Robokassa
   - Обработка уведомлений о платежах
   - Формирование данных для чека

2. **API Routes** (`src/api/routes/payments.js`)
   - `POST /api/payments/robokassa/create` - создание платежа
   - `POST /api/payments/robokassa/result` - прием результата от Robokassa
   - `GET /api/payments/:id/status` - проверка статуса платежа

3. **Database Schema** (расширение существующей схемы)
   - Таблица `payments` для хранения информации о платежах
   - Поля: id, user_id, amount, status, robokassa_inv_id, created_at, paid_at

4. **Frontend Pages**
   - Страница выбора подписки
   - Страница успешной оплаты (`/payment/success`)
   - Страница неуспешной оплаты (`/payment/fail`)

### Этап 4: Тестирование (1 неделя)

**Задачи:**
- [ ] Включить тестовый режим (`ROBOKASSA_TEST_MODE=true`)
- [ ] Провести тестовые платежи:
  - Успешная оплата банковской картой
  - Отмена оплаты
  - Проверка callback на Result URL
  - Проверка формирования чека
- [ ] Нагрузочное тестирование
- [ ] Проверка обработки ошибок

### Этап 5: Запуск в production (1 день)

**Задачи:**
- [ ] Перевести магазин в Robokassa в режим Production
- [ ] Обновить `.env`:
  ```bash
  ROBOKASSA_TEST_MODE=false
  ```
- [ ] Провести первые реальные транзакции с минимальными суммами
- [ ] Настроить мониторинг платежей
- [ ] Настроить алерты на ошибки

---

## API Reference

### Создание платежа

**Endpoint:** `POST /api/payments/robokassa/create`

**Request:**
```json
{
  "userId": "123",
  "planId": "pilot",
  "amount": 10000,
  "description": "Подписка на тариф 'Пилот (10 мест)' на 1 месяц",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_456",
  "paymentUrl": "https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=...&OutSum=10000&InvId=456&...",
  "amount": 10000,
  "currency": "RUB"
}
```

### Обработка Result callback

**Endpoint:** `POST /api/payments/robokassa/result`

**Параметры от Robokassa:**
- `OutSum` - сумма платежа
- `InvId` - номер счета
- `SignatureValue` - контрольная подпись
- `PaymentMethod` - способ оплаты
- ... и другие

**Response:**
```
OK123456  # где 123456 - InvId платежа
```

**ВАЖНО:** Необходимо обязательно проверять подпись (SignatureValue) для защиты от мошенничества.

---

## Безопасность

### Проверка подписи

Robokassa отправляет контрольную подпись (SignatureValue), которую необходимо проверять:

```javascript
const crypto = require('crypto');

function generateSignature(outSum, invId, password) {
  const string = `${outSum}:${invId}:${password}`;
  return crypto.createHash('md5').update(string).digest('hex').toUpperCase();
}

function verifySignature(outSum, invId, signatureValue, password) {
  const expectedSignature = generateSignature(outSum, invId, password);
  return expectedSignature === signatureValue.toUpperCase();
}
```

### Защита от повторных уведомлений

- Проверять, что платеж с данным `InvId` еще не обработан
- Сохранять статус платежа в базе данных
- Использовать транзакции для атомарности операций

---

## Recurring Payments (Подписки)

Robokassa поддерживает рекуррентные платежи для подписочной модели.

### Настройка recurring payments

1. **При создании первого платежа** указать параметр `Recurring=true`
2. **Robokassa сохранит токен карты** клиента
3. **Последующие списания** можно делать через API без участия клиента

### Отмена подписки

Клиент может отменить подписку в любой момент через личный кабинет или через ваш интерфейс.

---

## Мониторинг и отчетность

### Ключевые метрики

- Общее количество платежей
- Сумма успешных платежей
- Процент успешных/неуспешных платежей
- Средний чек
- Самые популярные способы оплаты

### Алерты

Настроить уведомления в Telegram/Email при:
- Неуспешной проверке подписи
- Ошибках при обработке callback
- Долгом отсутствии платежей (возможная проблема с интеграцией)

---

## Полезные ссылки

### Документация Robokassa

- **Главная:** https://robokassa.ru/
- **Документация API:** https://docs.robokassa.ru/
- **Техподдержка:** https://robokassa.ru/support/
- **Тестовая среда:** https://auth.robokassa.ru/Merchant/WebService/Service.asmx

### Внутренние документы

- [PAYMENT_PROCESSING_RESEARCH_2025.md](../reference/payment-processing/PAYMENT_PROCESSING_RESEARCH_2025.md) - исследование платежных систем
- [FISCALIZATION_ACQUIRING_RESEARCH_2025.md](../reference/payment-services/FISCALIZATION_ACQUIRING_RESEARCH_2025.md) - анализ фискализации и эквайринга

---

## Контакты для вопросов

- **Техническая поддержка Robokassa:** support@robokassa.ru
- **Внутренний ответственный:** payments@adminai.tech

---

**Дата последнего обновления:** 2025-11-28
**Версия документа:** 1.0
**Статус:** Черновик - готово к началу регистрации
