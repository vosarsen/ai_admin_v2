# 🚀 Gemini Integration Guide для AI Admin v2

*Дата: 19 октября 2025*

## ✅ Что уже сделано

1. ✅ Добавлен Gemini provider в `src/services/ai/provider-factory.js`
2. ✅ Обновлена конфигурация в `src/config/index.js`
3. ✅ Обновлен `.env.example` с настройками Gemini
4. ✅ Создан тестовый скрипт `scripts/test-gemini-api.js`
5. ✅ Получен API ключ: `AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU`

## 🎯 Следующие шаги

### 1. Локальное тестирование (СНАЧАЛА!)

**Важно:** Сначала тестируем локально, потом на проде!

```bash
# 1. Добавь API ключ в .env
cd /Users/vosarsen/Documents/GitHub/ai_admin_v2
echo "GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU" >> .env

# 2. Запусти тестовый скрипт
node scripts/test-gemini-api.js
```

**Что проверяет тест:**
- ✅ Базовая работа API
- ✅ Понимание русского языка
- ✅ Structured JSON output
- ✅ Извлечение команд (Two-Stage Stage 1)
- ✅ Генерация ответов (Two-Stage Stage 2)

### 2. Если тесты прошли успешно

**Добавь переключатель провайдера в .env:**

```bash
# Вариант A: Полный переход на Gemini
AI_PROVIDER=gemini-flash

# Вариант B: A/B тестирование (50/50)
AI_PROVIDER=deepseek  # пока оставим DeepSeek как основной
# Потом создадим A/B логику
```

### 3. Коммит изменений

```bash
git add -A
git commit -m "feat: add Google Gemini integration

- Add Gemini provider to provider-factory.js
- Support gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite
- Add GEMINI_API_KEY config
- Create test script for Gemini API
- Update .env.example with Gemini settings"
```

### 4. Развёртывание на сервер

**ВАРИАНТ A: Осторожный (рекомендую для начала)**

```bash
# 1. Залей код на сервер
git push origin feature/redis-context-cache

# 2. SSH на сервер
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219

# 3. Обнови код
cd /opt/ai-admin
git pull

# 4. Добавь API ключ в .env
echo "GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU" >> .env

# 5. Запусти тест НА СЕРВЕРЕ
node scripts/test-gemini-api.js

# 6. Если тесты OK - можно включать
# Пока оставь AI_PROVIDER=deepseek (не меняй)
```

**ВАРИАНТ B: Полный переход на Gemini**

```bash
# ТОЛЬКО если локальные и серверные тесты прошли успешно!

ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin

# Переключи на Gemini
nano .env
# Измени: AI_PROVIDER=gemini-flash

# Перезапусти воркеры
pm2 restart ai-admin-worker-v2

# Смотри логи
pm2 logs ai-admin-worker-v2 --lines 50
```

---

## 📊 Мониторинг после запуска

### Что проверять:

1. **Логи ошибок:**
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50"
```

2. **Скорость ответов:**
```bash
# Смотри в логах строки типа:
# ⏱️ Stage 1 (command extraction): XXXms
# ⏱️ Stage 2 (response generation): XXXms
```

**Ожидаемая скорость с Gemini:**
- Stage 1: ~300-500ms (vs 8000ms у DeepSeek)
- Stage 2: ~300-500ms (vs 5000ms у DeepSeek)
- **Итого: ~0.7 сек vs 13 сек у DeepSeek** 🚀

3. **Качество ответов:**
```bash
# Протестируй руками через WhatsApp:
# - "Запиши на маникюр завтра в 15:00"
# - "Какое время свободно на стрижку?"
# - "Покажи цены"
```

---

## 🔧 Настройка A/B тестирования (опционально)

Если хочешь тестировать 50/50 Gemini vs DeepSeek:

### Создай файл `src/services/ai/ab-test-provider.js`:

```javascript
const providerFactory = require('./provider-factory');

/**
 * A/B тестирование провайдеров
 * 50% запросов идут на Gemini, 50% на DeepSeek
 */
class ABTestProvider {
  constructor() {
    this.providers = {
      gemini: 'gemini-flash',
      deepseek: 'deepseek'
    };
  }

  async getProvider() {
    // Случайный выбор провайдера (50/50)
    const useGemini = Math.random() < 0.5;
    const providerName = useGemini ? this.providers.gemini : this.providers.deepseek;

    console.log(`🎲 A/B Test: Selected ${providerName}`);

    return await providerFactory.getProvider(providerName);
  }
}

module.exports = new ABTestProvider();
```

### Используй в two-stage-processor.js:

```javascript
// Вместо:
// const provider = await providerFactory.getProvider();

// Используй:
const abTestProvider = require('../ai/ab-test-provider');
const provider = await abTestProvider.getProvider();
```

---

## 💰 Ожидаемая экономия

При переходе на Gemini 2.5 Flash:

**Текущие затраты (DeepSeek):**
- ~10,000 запросов/день
- $106/месяц

**С Gemini 2.5 Flash:**
- ~10,000 запросов/день
- **$29/месяц**
- **Экономия: $77/месяц (73%)** 🎉

**Бонус:**
- Скорость: в 18 раз быстрее
- UX: ответы за 0.7 сек вместо 13 сек

---

## ⚠️ Что может пойти не так

### 1. Русский язык хуже чем у DeepSeek

**Симптомы:**
- Неестественные ответы
- Плохое извлечение команд
- Ошибки в падежах

**Решение:**
- Вернись на DeepSeek: `AI_PROVIDER=deepseek`
- Попробуй Gemini Pro (медленнее, но лучше): `AI_PROVIDER=gemini-pro`

### 2. Превышен rate limit (15 RPM на бесплатном tier)

**Симптомы:**
- Ошибки 429 в логах
- "Resource has been exhausted"

**Решение:**
```bash
# На сервере включи billing в Google Cloud
# Тогда лимиты станут:
# - Gemini Flash: 1000 RPM
# - Gemini Pro: 360 RPM
```

### 3. API ключ не работает

**Симптомы:**
- Ошибки 401/403
- "Invalid API key"

**Решение:**
```bash
# Проверь что ключ в .env правильный
cat .env | grep GEMINI_API_KEY

# Должно быть:
# GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU
```

---

## 📈 Метрики для отслеживания

После запуска собирай данные:

1. **Скорость:**
   - Среднее время ответа
   - P95, P99 латентность

2. **Качество:**
   - % правильно извлечённых команд
   - % естественных ответов
   - Отзывы клиентов

3. **Стоимость:**
   - Количество запросов/день
   - Затраты в $ (смотри в Google Cloud Console)

4. **Ошибки:**
   - Rate limit errors
   - API errors
   - Parsing errors

---

## 🎯 Критерии успеха

Gemini считается успешным если:

✅ **Скорость:** < 1 секунды на диалог (vs 13 сек у DeepSeek)
✅ **Качество:** >= 95% правильно извлечённых команд
✅ **Русский язык:** Естественные ответы, правильные падежи
✅ **Стабильность:** < 1% ошибок API
✅ **Стоимость:** < $50/месяц при 10K запросов/день

---

## 📞 Быстрые команды

### Тестирование:
```bash
# Локально
node scripts/test-gemini-api.js

# На сервере
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/test-gemini-api.js"
```

### Переключение провайдера:
```bash
# На Gemini
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=gemini-flash/' .env && pm2 restart ai-admin-worker-v2"

# На DeepSeek
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=deepseek/' .env && pm2 restart ai-admin-worker-v2"
```

### Мониторинг:
```bash
# Логи
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"

# Ошибки
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50"

# Статус
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
```

---

## 🎉 Следующие шаги после успешного запуска

1. **Собрать метрики** (1-2 дня)
2. **Сравнить с DeepSeek** (скорость, качество, стоимость)
3. **Принять решение:**
   - Если OK → Полный переход на Gemini
   - Если проблемы → Остаться на DeepSeek или искать альтернативы

4. **Документировать результаты** в `docs/development-diary/`

---

**Готово!** Интеграция Gemini завершена. Запускай тесты и смотри результаты! 🚀

---

*Создано: 19 октября 2025*
*API ключ: AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU*
*Версия: 1.0*
