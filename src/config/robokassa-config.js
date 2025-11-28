/**
 * Robokassa Payment Gateway Configuration
 *
 * Конфигурация для интеграции с платежной системой Robokassa
 * Документация: https://docs.robokassa.ru/
 */

module.exports = {
  // Merchant Information / Информация о продавце
  merchant: {
    // Юридическая информация (ИП)
    legalInfo: {
      name: 'ИП ВОСКАНЯН АРСЕН ВАЛЕРИЕВИЧ',
      inn: '502717663760',
      ogrn: '325508100473782',
      taxSystem: 'УСН Доходы',
    },

    // Robokassa Merchant Login (заполнить после регистрации)
    login: process.env.ROBOKASSA_MERCHANT_LOGIN || '',

    // Пароли из личного кабинета Robokassa
    passwords: {
      // Пароль #1 для формирования подписи (MD5)
      password1: process.env.ROBOKASSA_PASSWORD_1 || '',
      // Пароль #2 для проверки подписи от Robokassa
      password2: process.env.ROBOKASSA_PASSWORD_2 || '',
    },
  },

  // API Endpoints / Конечные точки API
  apiUrls: {
    // Тестовый режим (для разработки)
    test: {
      payment: 'https://auth.robokassa.ru/Merchant/Index.aspx',
      interface: 'https://auth.robokassa.ru/Merchant/WebService/Service.asmx',
    },
    // Боевой режим (для production)
    production: {
      payment: 'https://auth.robokassa.ru/Merchant/Index.aspx',
      interface: 'https://auth.robokassa.ru/Merchant/WebService/Service.asmx',
    },
  },

  // Callback URLs / URL для уведомлений
  callbacks: {
    // Result URL - технический URL для получения результата оплаты (обязательно HTTPS)
    resultUrl: process.env.ROBOKASSA_RESULT_URL || 'https://adminai.tech/api/payments/robokassa/result',

    // Success URL - страница успешной оплаты (куда перенаправляется клиент)
    successUrl: process.env.ROBOKASSA_SUCCESS_URL || 'https://adminai.tech/payment/success',

    // Fail URL - страница неуспешной оплаты
    failUrl: process.env.ROBOKASSA_FAIL_URL || 'https://adminai.tech/payment/fail',
  },

  // Settings / Настройки
  settings: {
    // Тестовый режим (true = тестовые платежи, false = реальные платежи)
    isTestMode: process.env.ROBOKASSA_TEST_MODE === 'true',

    // Язык интерфейса оплаты (ru, en)
    defaultLanguage: 'ru',

    // Валюта по умолчанию (согласно ISO 4217)
    defaultCurrency: 'RUB',

    // Кодировка
    encoding: 'utf-8',

    // Таймаут для запросов к API (мс)
    requestTimeout: 30000,

    // Включить логирование (для отладки)
    enableLogging: process.env.NODE_ENV !== 'production',
  },

  // Tariffs / Тарифы Robokassa (для справки)
  tariffs: {
    // На основе исследования в PAYMENT_PROCESSING_RESEARCH_2025.md
    current: 'Стартовый', // или 'Легкий', 'Оптимальный', 'Продвинутый'
    commission: {
      startovyy: '3.9-10%',    // от 0 ₽/мес
      legkiy: '3.3-10%',       // от 300k ₽/мес
      optimalnyy: '2.9-10%',   // от 700k ₽/мес
      prodvinutyy: '2.7-10%',  // от 3 млн ₽/мес
    },
    note: 'Комиссия зависит от способа оплаты и выбранного тарифа. См. PAYMENT_PROCESSING_RESEARCH_2025.md',
  },

  // Subscription Plans / Планы подписок для Admin AI
  subscriptionPlans: {
    pilot: {
      name: 'Пилот (10 мест)',
      price: 10000, // в рублях (100 ₽ за место × 10)
      period: 'monthly',
      description: 'Пилотный тариф для тестирования сервиса',
    },
    // Можно добавить другие тарифы
  },

  // Payment Methods / Способы оплаты
  paymentMethods: {
    // Robokassa поддерживает множество способов оплаты
    supported: [
      'BankCard',      // Банковские карты (Visa, MasterCard, Мир)
      'SBP',           // Система быстрых платежей
      'YandexMoney',   // ЮMoney
      'Qiwi',          // QIWI кошелек
      'WebMoney',      // WebMoney
      'AlfaClick',     // Альфа-Клик
      'PromSvyazBank', // Промсвязьбанк
      'Sberbank',      // Сбербанк Онлайн
      // ... и другие
    ],
    // Предпочтительный способ оплаты по умолчанию
    default: 'BankCard',
  },

  // Fiscal Settings / Настройки фискализации (54-ФЗ)
  fiscal: {
    // Включена ли фискализация
    enabled: true,

    // Система налогообложения
    taxSystem: 'usn_income', // УСН Доходы

    // НДС (для УСН Доходы обычно "none")
    vat: 'none',

    // Тип оплаты (полная предоплата для подписок)
    paymentMethod: 'full_prepayment',

    // Тип предмета расчета (услуга)
    paymentObject: 'service',

    // Данные для чека
    receipt: {
      // Наименование организации
      companyName: 'ИП ВОСКАНЯН АРСЕН ВАЛЕРИЕВИЧ',
      // ИНН
      inn: '502717663760',
      // Email для отправки чеков
      email: process.env.ROBOKASSA_RECEIPT_EMAIL || 'support@adminai.tech',
      // Телефон для отправки чеков (опционально)
      phone: process.env.ROBOKASSA_RECEIPT_PHONE || '',
    },
  },

  // Validation / Валидация
  validation: {
    // Минимальная сумма платежа (в рублях)
    minAmount: 100,
    // Максимальная сумма платежа (в рублях)
    maxAmount: 1000000,
    // Допустимые валюты
    allowedCurrencies: ['RUB'],
  },

  // Notification Settings / Настройки уведомлений
  notifications: {
    // Отправлять email уведомления о платежах
    emailEnabled: true,
    // Email для уведомлений
    notificationEmail: process.env.PAYMENT_NOTIFICATION_EMAIL || 'payments@adminai.tech',

    // Webhook для внутренних уведомлений (например, для Telegram)
    webhookUrl: process.env.PAYMENT_WEBHOOK_URL || '',
  },

  // Error Handling / Обработка ошибок
  errors: {
    // Повторять неудачные запросы к API
    retryEnabled: true,
    // Количество попыток
    maxRetries: 3,
    // Задержка между попытками (мс)
    retryDelay: 1000,
  },
};
