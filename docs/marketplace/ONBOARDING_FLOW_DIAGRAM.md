# 📊 YClients Marketplace Onboarding Flow Diagram

## 🔄 Полный процесс подключения

```mermaid
graph TD
    Start([Клиент в YClients Marketplace]) --> A[Находит AI Admin в каталоге]
    A --> B[Нажимает кнопку Подключить]

    B --> C{YClients проверяет права}
    C -->|Есть права| D[YClients дает разрешение]
    C -->|Нет прав| E[Показать ошибку]

    D --> F[Редирект на ai-admin.app с salon_id]
    F --> G[ai-admin.app/marketplace/register?salon_id=962302]

    G --> H[Получаем данные салона через API]
    H --> I[Показываем страницу подключения]

    I --> J[Генерация QR-кода WhatsApp]
    J --> K[Клиент сканирует QR]

    K --> L{WhatsApp подключен?}
    L -->|Нет| M[Обновить QR]
    M --> K
    L -->|Да| N[Сохранить сессию WhatsApp]

    N --> O[Отправить callback в YClients]
    O --> P[POST /marketplace/partner/callback/redirect]

    P --> Q{Callback успешен?}
    Q -->|Нет| R[Повторить callback]
    Q -->|Да| S[Интеграция активна]

    S --> T[Синхронизация данных]
    T --> U[Услуги, Мастера, Расписание]

    U --> V[Отправить приветственное сообщение]
    V --> End([Бот готов к работе])

    style Start fill:#e1f5fe
    style End fill:#c8e6c9
    style E fill:#ffcdd2
    style S fill:#a5d6a7
```

## 🔐 Авторизация и доступ к API

```mermaid
sequenceDiagram
    participant Client as Клиент
    participant YC as YClients
    participant App as AI Admin
    participant API as YClients API

    Client->>YC: Нажимает "Подключить"
    YC->>YC: Проверяет права пользователя
    YC->>App: Редирект с salon_id=962302

    Note over App: Используем ТОЛЬКО Partner Token!

    App->>API: GET /company/{salon_id}
    API-->>App: Данные салона (с Partner Token)

    App->>Client: Показываем QR для WhatsApp
    Client->>App: Сканирует QR
    App->>App: Сохраняет WhatsApp сессию

    App->>API: POST /marketplace/partner/callback/redirect
    Note over App,API: salon_id + application_id + webhook_urls
    API-->>App: 301 Redirect (успех)

    Note over App,API: Теперь Partner Token + salon_id<br/>дает полный доступ к API салона!

    App->>API: GET /records/{salon_id}
    API-->>App: ✅ Записи салона

    App->>API: POST /records/{salon_id}
    API-->>App: ✅ Создана новая запись

    App->>API: GET /clients/{salon_id}
    API-->>App: ✅ Клиенты салона
```

## 🚫 Что НЕ происходит (распространенные заблуждения)

```mermaid
graph LR
    subgraph "❌ НЕПРАВИЛЬНО"
        A1[Клиент подключает] --> B1[Запрос логина/пароля]
        B1 --> C1[POST /auth]
        C1 --> D1[Получение User Token]
        D1 --> E1[Использование User Token]
    end

    subgraph "✅ ПРАВИЛЬНО"
        A2[Клиент подключает] --> B2[Редирект с salon_id]
        B2 --> C2[Callback в YClients]
        C2 --> D2[Partner Token + salon_id]
        D2 --> E2[Полный доступ к API]
    end

    style A1 fill:#ffcdd2
    style B1 fill:#ffcdd2
    style C1 fill:#ffcdd2
    style D1 fill:#ffcdd2
    style E1 fill:#ffcdd2

    style A2 fill:#c8e6c9
    style B2 fill:#c8e6c9
    style C2 fill:#c8e6c9
    style D2 fill:#c8e6c9
    style E2 fill:#c8e6c9
```

## 📱 WhatsApp подключение детально

```mermaid
stateDiagram-v2
    [*] --> ShowQR: Генерация QR
    ShowQR --> WaitingScan: Показать QR клиенту

    WaitingScan --> QRExpired: 20 секунд
    WaitingScan --> Connecting: QR отсканирован

    QRExpired --> ShowQR: Обновить QR

    Connecting --> Connected: Успешное подключение
    Connecting --> Failed: Ошибка подключения

    Failed --> ShowQR: Повторить

    Connected --> SaveSession: Сохранить сессию
    SaveSession --> SendCallback: Отправить callback
    SendCallback --> [*]: Интеграция активна

    note right of Connected
        После подключения WhatsApp
        отправляем callback в YClients
        для активации интеграции
    end note
```

## 🔄 Жизненный цикл интеграции

```mermaid
graph TB
    subgraph "Установка"
        I1[Подключение через маркетплейс]
        I2[Настройка WhatsApp]
        I3[Callback активация]
    end

    subgraph "Активная работа"
        W1[Обработка сообщений]
        W2[Создание записей]
        W3[Напоминания]
        W4[Синхронизация]
    end

    subgraph "События от YClients"
        E1[Webhook: record_created]
        E2[Webhook: record_updated]
        E3[Webhook: record_deleted]
    end

    subgraph "Отключение"
        U1[Клиент отключает в YClients]
        U2[Webhook: uninstall]
        U3[Очистка данных]
        U4[Остановка WhatsApp сессии]
    end

    I1 --> I2 --> I3 --> W1
    W1 --> W2
    W1 --> W3
    W1 --> W4

    E1 --> W3
    E2 --> W3
    E3 --> W4

    U1 --> U2 --> U3 --> U4

    style I3 fill:#a5d6a7
    style W1 fill:#81c784
    style U2 fill:#ff9800
```

## 📈 Метрики и конверсия

```mermaid
pie title Конверсия онбординга
    "Начали подключение" : 100
    "Подключили WhatsApp" : 85
    "Отправили callback" : 80
    "Активно используют" : 70
    "Отвалились на QR" : 15
    "Не завершили настройку" : 10
```

## 🎯 Ключевые точки оптимизации

```mermaid
graph LR
    subgraph "Проблемные места"
        P1[QR-код пугает]
        P2[Долгая синхронизация]
        P3[Непонятные ошибки]
    end

    subgraph "Решения"
        S1[Pairing Code вместо QR]
        S2[Прогресс-бар синхронизации]
        S3[Понятные сообщения об ошибках]
    end

    P1 --> S1
    P2 --> S2
    P3 --> S3

    style P1 fill:#ffcdd2
    style P2 fill:#ffcdd2
    style P3 fill:#ffcdd2

    style S1 fill:#c8e6c9
    style S2 fill:#c8e6c9
    style S3 fill:#c8e6c9
```

---

*Создано: 02.10.2025*
*Версия: 1.0*