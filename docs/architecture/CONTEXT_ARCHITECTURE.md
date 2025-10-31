# Context System Architecture Diagrams

## Обзор архитектуры

### Общая архитектура системы контекста

```mermaid
graph TB
    subgraph "Client Layer"
        WA[WhatsApp Client]
        API[REST API]
    end
    
    subgraph "Processing Layer"
        MW[Message Worker v2]
        AI[AI Admin v2]
        TSP[Two-Stage Processor]
        RP[ReAct Processor]
    end
    
    subgraph "Context Management"
        CM[ContextManagerV2]
        CS[ContextServiceV2]
        IC[IntermediateContext]
    end
    
    subgraph "Caching Layer"
        MC[Memory Cache<br/>LRU]
        RC[Redis Cache]
    end
    
    subgraph "Storage Layer"
        RD[(Redis)]
        DB[(Supabase)]
    end
    
    WA --> MW
    API --> MW
    MW --> AI
    AI --> TSP
    AI --> RP
    AI --> CM
    CM --> CS
    CM --> IC
    CM --> MC
    CS --> RC
    RC --> RD
    CM --> DB
    
    style CM fill:#f9f,stroke:#333,stroke-width:4px
    style CS fill:#bbf,stroke:#333,stroke-width:2px
```

## Поток обработки сообщения

### Последовательность обработки с контекстом

```mermaid
sequenceDiagram
    participant U as User
    participant W as WhatsApp
    participant MW as MessageWorker
    participant AI as AIAdminV2
    participant CM as ContextManager
    participant MC as MemoryCache
    participant RC as RedisCache
    participant DB as Database
    
    U->>W: Отправляет сообщение
    W->>MW: Webhook с сообщением
    MW->>AI: processMessage(msg, phone, companyId)
    
    Note over AI,CM: Загрузка контекста
    AI->>CM: loadFullContext(phone, companyId)
    CM->>MC: Проверка Memory Cache
    alt Cache Hit
        MC-->>CM: Возврат контекста
    else Cache Miss
        CM->>RC: Проверка Redis Cache
        alt Redis Hit
            RC-->>CM: Возврат контекста
        else Redis Miss
            CM->>DB: Загрузка из БД
            DB-->>CM: Данные
            CM->>RC: Сохранение в Redis
            CM->>MC: Сохранение в Memory
        end
    end
    CM-->>AI: Полный контекст
    
    Note over AI: Обработка с AI
    AI->>AI: Two-Stage/ReAct обработка
    
    Note over AI,CM: Сохранение контекста
    AI->>CM: saveContext(phone, companyId, updates)
    CM->>RC: Атомарное сохранение
    CM->>MC: Инвалидация кэша
    
    AI-->>MW: Ответ
    MW-->>W: Отправка ответа
    W-->>U: Получает ответ
```

## Структура данных контекста

### Иерархия хранения данных

```mermaid
graph LR
    subgraph "Redis Namespaces"
        subgraph "Dialog Context"
            DC[context:companyId:phone:dialog<br/>TTL: 2 hours]
            DC --> SEL[selection<br/>- service<br/>- staff<br/>- date<br/>- time]
            DC --> ST[state<br/>- active<br/>- pending<br/>- completed]
        end
        
        subgraph "Client Data"
            CD[context:companyId:phone:client<br/>TTL: 24 hours]
            CD --> CI[Client Info<br/>- name<br/>- phone<br/>- favorites]
        end
        
        subgraph "Messages"
            MSG[context:companyId:phone:messages<br/>TTL: 24 hours]
            MSG --> ML[Message List<br/>- sender<br/>- text<br/>- timestamp]
        end
        
        subgraph "Preferences"
            PR[context:companyId:phone:preferences<br/>TTL: 30 days]
            PR --> PD[Preference Data<br/>- favoriteServiceId<br/>- favoriteStaffId<br/>- preferredTime]
        end
    end
```

## Механизм кэширования

### Multi-Level Cache Strategy

```mermaid
graph TD
    subgraph "Request Flow"
        REQ[Context Request]
        REQ --> L1{Memory<br/>Cache?}
        L1 -->|Hit| RET1[Return<br/><1ms]
        L1 -->|Miss| L2{Redis<br/>Cache?}
        L2 -->|Hit| UPDATE1[Update Memory]
        UPDATE1 --> RET2[Return<br/>1-5ms]
        L2 -->|Miss| L3[Database<br/>Query]
        L3 --> UPDATE2[Update Redis]
        UPDATE2 --> UPDATE3[Update Memory]
        UPDATE3 --> RET3[Return<br/>150-200ms]
    end
    
    subgraph "Cache Stats"
        STATS[Memory: 50 entries, 5min TTL<br/>Redis: Per namespace TTL<br/>Hit Rate Target: >70%]
    end
```

## Атомарные операции

### Процесс атомарного сохранения

```mermaid
flowchart LR
    subgraph "Old Approach - Problems"
        O1[updateContext 1] --> ODB1[(Redis)]
        O2[updateContext 2] --> ODB2[(Redis)]
        O3[setContext] --> ODB3[(Redis)]
        
        style O1 fill:#faa
        style O2 fill:#faa
        style O3 fill:#faa
        
        Note1[Race Conditions!<br/>Data Overwrites!]
    end
    
    subgraph "New Approach - Atomic"
        N1[Collect All Updates] --> N2[Single saveContext] --> NDB[(Redis Transaction)]
        
        style N1 fill:#afa
        style N2 fill:#afa
        style NDB fill:#afa
        
        Note2[Atomic Operation<br/>No Data Loss]
    end
```

## Date Context Flow

### Сохранение и использование контекста даты

```mermaid
flowchart TB
    subgraph "Message 1: User asks about tomorrow"
        U1[User: Когда завтра свободно?]
        AI1[AI: SEARCH_SLOTS date=завтра]
        SAVE1[Save: lastDate=завтра]
        R1[Response: Завтра свободно в 15:00, 16:00...]
    end
    
    subgraph "Context State"
        CTX[lastDate: завтра<br/>lastService: стрижка<br/>lastStaff: Бари]
    end
    
    subgraph "Message 2: User specifies time"
        U2[User: Запиши на 15:00]
        CHECK[Check Context: lastDate exists?]
        CHECK -->|Yes| USE[Use lastDate=завтра]
        AI2[AI: CREATE_BOOKING<br/>date=завтра<br/>time=15:00]
        R2[Response: ✅ Записал на завтра 15:00]
    end
    
    U1 --> AI1 --> SAVE1 --> R1
    SAVE1 --> CTX
    U2 --> CHECK
    USE --> AI2 --> R2
    
    style CTX fill:#bbf
    style USE fill:#afa
```

## Two-Stage Processing с контекстом

### Двухэтапная обработка

```mermaid
graph TB
    subgraph "Stage 1: Command Extraction"
        MSG1[User Message]
        CTX1[Load Context]
        PROMPT1[Build Command Prompt<br/>with context]
        AI1[AI Call 1]
        JSON[JSON Commands]
        
        MSG1 --> PROMPT1
        CTX1 --> PROMPT1
        PROMPT1 --> AI1
        AI1 --> JSON
    end
    
    subgraph "Command Execution"
        JSON --> EXEC[Execute Commands<br/>Parallel where possible]
        EXEC --> RES[Command Results]
    end
    
    subgraph "Stage 2: Response Generation"
        RES --> PROMPT2[Build Response Prompt<br/>with results]
        CTX2[Context + Results]
        AI2[AI Call 2]
        RESP[Natural Response]
        
        CTX2 --> PROMPT2
        PROMPT2 --> AI2
        AI2 --> RESP
    end
    
    subgraph "Context Save"
        RESP --> SAVE[Save Context<br/>- selection<br/>- messages<br/>- preferences]
    end
    
    style AI1 fill:#faa
    style AI2 fill:#faa
    style EXEC fill:#afa
    style SAVE fill:#bbf
```

## Обработка ошибок и восстановление

### Error Recovery Flow

```mermaid
flowchart TD
    subgraph "Error Detection"
        ERR1[Context Load Error]
        ERR2[Redis Connection Error]
        ERR3[Save Error]
    end
    
    subgraph "Fallback Strategy"
        ERR1 --> FB1[Load from DB directly]
        ERR2 --> FB2[Use memory cache only]
        ERR3 --> FB3[Retry with exponential backoff]
    end
    
    subgraph "Recovery"
        FB1 --> REC1[Continue processing]
        FB2 --> REC2[Degraded mode]
        FB3 --> REC3[Queue for retry]
    end
    
    subgraph "Monitoring"
        MON[Alert if error rate >5%<br/>Log all errors<br/>Track recovery success]
    end
    
    REC1 --> MON
    REC2 --> MON
    REC3 --> MON
```

## Performance Metrics

### Метрики производительности

```mermaid
graph LR
    subgraph "Load Times"
        LT[Memory: <1ms<br/>Redis: 1-5ms<br/>Full: 150-200ms]
    end
    
    subgraph "Save Times"
        ST[Atomic save: <50ms<br/>With invalidation: <70ms]
    end
    
    subgraph "Cache Rates"
        CR[Memory hit: 40-50%<br/>Redis hit: 30-40%<br/>Total hit: >70%]
    end
    
    subgraph "Throughput"
        TP[100-200 msg/min<br/>3 workers<br/><150MB per worker]
    end
```

## Масштабирование

### Scaling Architecture

```mermaid
graph TB
    subgraph "Current - Single Redis"
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
        
        W1 --> R1[Redis Master]
        W2 --> R1
        W3 --> R1
        
        R1 --> DB1[(Supabase)]
    end
    
    subgraph "Scaled - Redis Cluster"
        WS1[Workers 1-10]
        WS2[Workers 11-20]
        WS3[Workers 21-30]
        
        WS1 --> RC1[Redis Shard 1]
        WS2 --> RC2[Redis Shard 2]
        WS3 --> RC3[Redis Shard 3]
        
        RC1 --> DB2[(Supabase)]
        RC2 --> DB2
        RC3 --> DB2
    end
    
    subgraph "Future - Edge Caching"
        EDGE[CDN/Edge Cache]
        EDGE --> REGIONAL[Regional Redis]
        REGIONAL --> CENTRAL[Central Database]
    end
```

## Безопасность контекста

### Security Layers

```mermaid
graph TD
    subgraph "Access Control"
        REQ[Request]
        AUTH[HMAC Authentication]
        COMP[Company ID Validation]
        PHONE[Phone Normalization]
    end
    
    subgraph "Data Protection"
        ENC[Encryption at Rest<br/>AES-256]
        TTL[Auto-expiry with TTL]
        ISO[Company Isolation]
    end
    
    subgraph "Audit"
        LOG[Access Logging]
        MON[Anomaly Detection]
        ALERT[Security Alerts]
    end
    
    REQ --> AUTH
    AUTH --> COMP
    COMP --> PHONE
    PHONE --> ENC
    ENC --> ISO
    ISO --> LOG
    LOG --> MON
    MON --> ALERT
```

## Заключение

Эти диаграммы иллюстрируют:

1. **Общую архитектуру** системы контекста
2. **Поток обработки** сообщений с контекстом
3. **Структуру данных** и namespace'ы
4. **Механизм кэширования** с многоуровневой стратегией
5. **Атомарные операции** для предотвращения race conditions
6. **Сохранение контекста даты** между сообщениями
7. **Two-Stage обработку** с контекстом
8. **Обработку ошибок** и восстановление
9. **Метрики производительности**
10. **Масштабирование** системы
11. **Безопасность** контекста

Для просмотра диаграмм используйте любой Markdown viewer с поддержкой Mermaid или [Mermaid Live Editor](https://mermaid.live/).