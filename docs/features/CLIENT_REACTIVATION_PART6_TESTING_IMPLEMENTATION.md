# Client Reactivation System - Part 6: Testing & Implementation Guide

## 🧪 Testing Strategy

### Unit Tests

#### 1. Preference Analyzer Tests

```javascript
// tests/services/client-reactivation/preference-analyzer.test.js

const PreferenceAnalyzer = require('../../../src/services/client-reactivation/detectors/preference-analyzer');

describe('PreferenceAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PreferenceAnalyzer();
  });

  describe('analyzeTimePreferences', () => {
    it('should detect morning preference', () => {
      const history = [
        { datetime: '2025-10-01T10:00:00Z' },
        { datetime: '2025-10-08T10:30:00Z' },
        { datetime: '2025-10-15T11:00:00Z' },
        { datetime: '2025-10-22T10:15:00Z' }
      ];

      const result = analyzer.analyzeTimePreferences(history);

      expect(result.preferred).toBe('morning');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect mixed preferences', () => {
      const history = [
        { datetime: '2025-10-01T10:00:00Z' },  // Morning
        { datetime: '2025-10-08T14:00:00Z' },  // Afternoon
        { datetime: '2025-10-15T18:00:00Z' }   // Evening
      ];

      const result = analyzer.analyzeTimePreferences(history);

      expect(result.preferred).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('analyzeStaffPreferences', () => {
    it('should identify favorite staff', () => {
      const history = [
        { staff_id: 1, staff_name: 'Иван' },
        { staff_id: 1, staff_name: 'Иван' },
        { staff_id: 1, staff_name: 'Иван' },
        { staff_id: 2, staff_name: 'Мария' }
      ];

      const result = analyzer.analyzeStaffPreferences(history);

      expect(result.favoriteStaffId).toBe(1);
      expect(result.favoriteStaffName).toBe('Иван');
      expect(result.percentage).toBe(75);
    });
  });
});
```

#### 2. Slot Finder Tests

```javascript
// tests/services/client-reactivation/slot-finder.test.js

const SlotFinder = require('../../../src/services/client-reactivation/generators/slot-finder');

describe('SlotFinder', () => {
  let finder;

  beforeEach(() => {
    finder = new SlotFinder();
  });

  describe('rankSlots', () => {
    it('should prioritize favorite staff', () => {
      const slots = [
        {
          datetime: new Date('2025-10-22T14:00:00Z'),
          staffId: 1,
          staffName: 'Иван'
        },
        {
          datetime: new Date('2025-10-22T10:00:00Z'),
          staffId: 2,
          staffName: 'Мария'
        }
      ];

      const preferences = {
        staffPreferences: {
          favoriteStaffId: 1,
          confidence: 0.9
        },
        timePreferences: {
          preferred: 'morning',
          confidence: 0.7
        }
      };

      const ranked = finder.rankSlots(slots, preferences);

      // Любимый мастер должен быть первым, даже если время неподходящее
      expect(ranked[0].staffId).toBe(1);
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/reactivation-flow.test.js

describe('Reactivation Flow', () => {
  it('should complete full reactivation cycle', async () => {
    // 1. Setup: Create test client with history
    const client = await createTestClient({
      phone: '79001234567',
      visitCount: 5,
      lastVisit: '2025-09-01',  // 50 days ago
      loyaltyLevel: 'Silver'
    });

    // 2. Create service rule
    await createServiceRule({
      serviceId: 123,
      intervalDays: 30,
      discountProgression: [10, 15]
    });

    // 3. Run detector
    const detector = new InactivityDetector();
    const eligible = await detector.findEligibleClients();

    expect(eligible).toContainEqual(
      expect.objectContaining({ phone: client.phone })
    );

    // 4. Run campaign manager
    const manager = new CampaignManager();
    const result = await manager.processClient(eligible[0]);

    expect(result.success).toBe(true);
    expect(result.campaignId).toBeDefined();

    // 5. Verify campaign saved
    const { data: campaign } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .eq('id', result.campaignId)
      .single();

    expect(campaign).toBeDefined();
    expect(campaign.discount_offered).toBe(10);
    expect(campaign.message_text).toBeTruthy();

    // 6. Verify context updated
    const context = await contextService.getContext(client.phone);

    expect(context.lastSystemAction.type).toBe('reactivation');
    expect(context.expectingResponse).toBe(true);

    // 7. Simulate positive response
    await responseTracker.trackResponse(
      client.phone,
      'Да, записать',
      { bookingCreated: false }
    );

    // 8. Verify campaign updated
    const { data: updatedCampaign } = await supabase
      .from('reactivation_campaigns')
      .select('*')
      .eq('id', result.campaignId)
      .single();

    expect(updatedCampaign.response_type).toBe('positive');
  });
});
```

### E2E Tests (With MCP Servers)

```javascript
// tests/e2e/reactivation-e2e.test.js

describe('Reactivation E2E', () => {
  const TEST_PHONE = '89686484488';  // Тестовый номер

  beforeEach(async () => {
    // Очистить тестовые данные
    await mcp.whatsapp.clear_test_data({ phone: TEST_PHONE });
    await mcp.redis.clear_context({ phone: TEST_PHONE });
  });

  it('should send reactivation and handle booking', async () => {
    // 1. Симулировать неактивного клиента
    await setupInactiveClient(TEST_PHONE, {
      lastVisit: '2025-08-15',
      service: 'Стрижка'
    });

    // 2. Запустить реактивацию вручную
    const response = await fetch('http://localhost:3000/api/reactivation/campaigns/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 962302,
        client_phone: TEST_PHONE,
        service_id: 123
      })
    });

    const result = await response.json();
    expect(result.success).toBe(true);

    // 3. Проверить что сообщение отправлено
    const conversation = await mcp.whatsapp.get_conversation({
      phone: TEST_PHONE,
      last_messages: 1
    });

    expect(conversation.messages[0].from).toBe('bot');
    expect(conversation.messages[0].text).toContain('дней');  // Упоминание времени

    // 4. Клиент отвечает
    await mcp.whatsapp.send_message({
      phone: TEST_PHONE,
      message: 'Да, записать'
    });

    // 5. Ждем ответа AI
    await sleep(10000);  // 10 секунд на обработку

    const lastResponse = await mcp.whatsapp.get_last_response({
      phone: TEST_PHONE
    });

    expect(lastResponse).toContain('какую услугу' | 'какое время');

    // 6. Завершить запись
    await mcp.whatsapp.send_message({
      phone: TEST_PHONE,
      message: 'Стрижка завтра в 14:00'
    });

    await sleep(10000);

    // 7. Проверить что запись создана
    const bookings = await mcp.supabase.query_table({
      table: 'bookings',
      filters: { client_phone: TEST_PHONE },
      orderBy: { column: 'created_at', ascending: false },
      limit: 1
    });

    expect(bookings.length).toBeGreaterThan(0);

    // 8. Проверить что кампания помечена как converted
    const campaigns = await mcp.supabase.query_table({
      table: 'reactivation_campaigns',
      filters: { client_phone: TEST_PHONE },
      orderBy: { column: 'sent_at', ascending: false },
      limit: 1
    });

    expect(campaigns[0].booking_created).toBe(true);
    expect(campaigns[0].response_type).toBe('booking_created');
  });

  it('should handle opt-out', async () => {
    // Setup
    await setupInactiveClient(TEST_PHONE);

    // Send reactivation
    await sendReactivation(TEST_PHONE);

    // Client opts out
    await mcp.whatsapp.send_message({
      phone: TEST_PHONE,
      message: 'Не надо мне писать'
    });

    await sleep(5000);

    // Verify client marked as opt-out
    const client = await mcp.supabase.query_table({
      table: 'clients',
      filters: { phone: TEST_PHONE },
      limit: 1
    });

    expect(client[0].reactivation_opt_out).toBe(true);
  });
});
```

---

## 📋 Implementation Checklist

### Phase 1: Foundation (Week 1)

- [ ] **Database Migration**
  - [ ] Create `service_reactivation_rules` table
  - [ ] Create `reactivation_campaigns` table
  - [ ] Create `whatsapp_account_health` table
  - [ ] Create `reactivation_settings` table
  - [ ] Add columns to `clients` table
  - [ ] Create indexes
  - [ ] Create SQL functions (increment_whatsapp_counters)
  - [ ] Run migration on production

- [ ] **Configuration**
  - [ ] Create `config/reactivation-config.js`
  - [ ] Add environment variables to `.env`
  - [ ] Set up default values for all companies
  - [ ] Initialize WhatsApp health for all companies

- [ ] **Core Services - Basic Structure**
  - [ ] Create directory structure
  - [ ] Implement `scheduler.js`
  - [ ] Implement `InactivityDetector`
  - [ ] Implement `PreferenceAnalyzer`
  - [ ] Add unit tests for each component

### Phase 2: Core Functionality (Week 2)

- [ ] **Slot Finding & AI Generation**
  - [ ] Implement `SlotFinder`
  - [ ] Implement `AIMessageGenerator`
  - [ ] Test AI prompt with real data
  - [ ] Optimize prompt for best results
  - [ ] Implement fallback templates

- [ ] **Campaign Management**
  - [ ] Implement `CampaignManager`
  - [ ] Implement `LimitManager`
  - [ ] Test full campaign flow
  - [ ] Add error handling

- [ ] **Response Tracking**
  - [ ] Implement `ResponseTracker`
  - [ ] Integrate with AI Admin message handler
  - [ ] Test response classification
  - [ ] Test opt-out handling

### Phase 3: Integration (Week 3)

- [ ] **Context Integration**
  - [ ] Update Redis context on campaign send
  - [ ] Add reactivation info to AI prompts
  - [ ] Handle preference changes during dialog
  - [ ] Test long-term memory

- [ ] **Booking Monitor Integration**
  - [ ] Detect bookings created after reactivation
  - [ ] Attribute bookings to campaigns
  - [ ] Calculate conversion metrics

- [ ] **WhatsApp Safety**
  - [ ] Implement health monitoring
  - [ ] Implement limit checking
  - [ ] Add ban detection
  - [ ] Add alerts for issues

### Phase 4: API & UI (Week 4)

- [ ] **API Endpoints**
  - [ ] Settings CRUD
  - [ ] Service rules CRUD
  - [ ] Stats & analytics
  - [ ] Campaign management
  - [ ] WhatsApp health

- [ ] **Frontend (Optional)**
  - [ ] Settings page
  - [ ] Service rules editor
  - [ ] Dashboard with stats
  - [ ] Campaign list

### Phase 5: Analytics & Optimization (Week 5)

- [ ] **Conversion Analyzer**
  - [ ] Implement all metrics
  - [ ] Best times analysis
  - [ ] ROI calculation
  - [ ] Reports generation

- [ ] **Interval Calculator**
  - [ ] Calculate optimal intervals from history
  - [ ] AI suggestions for intervals
  - [ ] Auto-optimization

- [ ] **A/B Testing Framework**
  - [ ] Test different discount progressions
  - [ ] Test different messages tones
  - [ ] Test different slot offerings

### Phase 6: Testing & Deployment (Week 6)

- [ ] **Testing**
  - [ ] Unit tests (80%+ coverage)
  - [ ] Integration tests
  - [ ] E2E tests with test phone
  - [ ] Load testing

- [ ] **Documentation**
  - [ ] User guide for clients
  - [ ] Admin guide
  - [ ] API documentation
  - [ ] Troubleshooting guide

- [ ] **Deployment**
  - [ ] Deploy to staging
  - [ ] Test with real data (1-2 companies)
  - [ ] Monitor for 1 week
  - [ ] Fix issues
  - [ ] Gradual rollout to all companies

---

## 🚀 Deployment Steps

### 1. Preparation

```bash
# 1. Backup database
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
pg_dump -U postgres ai_admin_v2 > backup_before_reactivation.sql

# 2. Pull latest code
git pull origin feature/client-reactivation

# 3. Install dependencies
npm install
```

### 2. Database Migration

```bash
# Run migrations
npm run migrate:reactivation

# Verify tables created
psql -U postgres -d ai_admin_v2 -c "\dt reactivation*"

# Initialize data
npm run init:reactivation-data
```

### 3. Configuration

```bash
# Add to .env
cat >> .env << 'EOF'
REACTIVATION_ENABLED=true
REACTIVATION_CRON="0 10 * * *"
REACTIVATION_DEBUG=false
EOF

# Restart services
pm2 restart all
```

### 4. Testing

```bash
# Test manual campaign
curl -X POST http://localhost:3000/api/reactivation/campaigns/manual \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 962302,
    "client_phone": "89686484488",
    "service_id": 123
  }'

# Check logs
pm2 logs ai-admin-worker-v2 --lines 100 | grep reactivation
```

### 5. Monitoring

```bash
# Watch scheduler
watch -n 60 "pm2 logs ai-admin-worker-v2 --lines 20 | grep 'reactivation check'"

# Check campaigns
curl http://localhost:3000/api/reactivation/stats/962302

# Monitor WhatsApp health
curl http://localhost:3000/api/reactivation/whatsapp-health/962302
```

---

## 🎓 Usage Guide for Clients

### Настройка Системы Реактивации

#### 1. Общие Настройки

В админ-панели перейдите в **Настройки → Реактивация клиентов**.

**Основные параметры:**
- **Включено**: Вкл/Выкл систему реактивации
- **Тон сообщений**: Дружелюбный / Профессиональный / Неформальный
- **Время отправки**: С 10:00 до 19:00 (рекомендуется)
- **Дни отправки**: Пн-Пт (можно изменить)

#### 2. Настройка Услуг

Для каждой услуги настройте:

**Стрижка:**
- Интервал реактивации: 28 дней
- Повторная попытка через: 14 дней
- Максимум попыток: 3
- Скидки: 10%, 15%, 20%

**Окрашивание:**
- Интервал: 45 дней
- Повторная попытка: 14 дней
- Максимум попыток: 2
- Скидки: 10%, 15%

**Как определить правильный интервал:**
1. Посмотрите статистику (кнопка "Анализ")
2. Система покажет средний интервал между визитами
3. Можете использовать AI-предложение (кнопка "Получить рекомендацию")
4. Или установите вручную

#### 3. Мониторинг

В разделе **Статистика → Реактивация** вы увидите:
- Сколько клиентов реактивировано
- Конверсия в записи
- ROI (возврат инвестиций)
- Лучшее время для отправки

**Рекомендации по оптимизации:**
- Если конверсия < 10% - увеличьте скидки или измените тон
- Если конверсия > 20% - можете уменьшить скидки
- Смотрите "Лучшее время" и настройте часы отправки

---

## 🔧 Troubleshooting

### Проблема: Сообщения не отправляются

**Проверка:**
```bash
# 1. Проверить статус scheduler
pm2 logs ai-admin-worker-v2 | grep "reactivation check"

# 2. Проверить лимиты
curl http://localhost:3000/api/reactivation/whatsapp-health/962302

# 3. Проверить eligible clients
# В логах должно быть: "Found X eligible clients"
```

**Возможные причины:**
- Все клиенты уже получили сообщения недавно
- Достигнут дневной лимит
- Неподходящее время отправки
- WhatsApp аккаунт заблокирован

### Проблема: Низкая конверсия

**Анализ:**
```bash
# Получить статистику
curl http://localhost:3000/api/reactivation/stats/962302?period=month
```

**Действия:**
1. Проверить примеры сообщений (слишком формально/неформально?)
2. Увеличить скидки
3. Предлагать больше слотов
4. Изменить время отправки на более конверсионное

### Проблема: AI генерирует плохие сообщения

**Решение:**
1. Проверить промпт в логах
2. Добавить примеры хороших сообщений в промпт
3. Изменить temperature (сейчас 0.7)
4. Использовать fallback templates

---

## 📈 Success Metrics

**KPI для мониторинга:**

1. **Conversion Rate**: > 15%
2. **Response Rate**: > 30%
3. **ROI**: > 3x
4. **Avg Response Time**: < 24 hours
5. **Opt-out Rate**: < 5%

**Формулы:**
```
Conversion Rate = Bookings Created / Messages Sent
Response Rate = Responses Received / Messages Sent
ROI = Revenue from Reactivation / Cost of Reactivation
Opt-out Rate = Opt-outs / Messages Sent
```

---

**Готово!** Система полностью описана и готова к имплементации! 🚀
