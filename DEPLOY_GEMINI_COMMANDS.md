# 🚀 Команды для развёртывания Gemini

Скопируй и выполни эти команды в своём терминале по порядку:

## ✅ Шаг 1: Деплой кода на сервер

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull"
```

## ✅ Шаг 2: Добавить GEMINI_API_KEY в .env

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && echo 'GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU' >> .env"
```

## ✅ Шаг 3: Проверить что ключ добавлен

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && cat .env | grep GEMINI_API_KEY"
```

Должно вывести:
```
GEMINI_API_KEY=AIzaSyD1Pnxdz8wZ6CsaDddUxxIG3fMg69kQkkU
```

## ✅ Шаг 4: Запустить тесты Gemini на сервере

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && node scripts/test-gemini-api.js"
```

**Важно:** Смотри на результаты тестов!

Ожидается:
- ✅ Тест 1: Простой русский текст - PASS
- ✅ Тест 2: Structured JSON - PASS
- ✅ Тест 3: Извлечение команд - PASS (4/4)
- ✅ Тест 4: Генерация ответа - PASS

## ✅ Шаг 5: Если все тесты прошли - переключить на Gemini

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=gemini-flash/' .env && pm2 restart ai-admin-worker-v2"
```

## ✅ Шаг 6: Проверить логи

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2 --lines 50"
```

Ищи строки:
- `✅ AI provider initialized: gemini-flash`
- `⏱️ Stage 1 (command extraction): XXXms` (должно быть ~300-500ms)
- `⏱️ Stage 2 (response generation): XXXms` (должно быть ~300-500ms)

---

## 🔄 Откат на DeepSeek (если что-то пошло не так)

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=deepseek/' .env && pm2 restart ai-admin-worker-v2"
```

---

## 📊 Мониторинг после запуска

### Смотреть логи в реальном времени:
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs ai-admin-worker-v2"
```

### Смотреть только ошибки:
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 logs --err --lines 50"
```

### Статус PM2:
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "pm2 status"
```

---

## 🎯 Что проверять после запуска:

1. **Нет ошибок в логах** (особенно 401, 429)
2. **Скорость улучшилась** (~0.7 сек вместо 13 сек)
3. **Качество русского языка** хорошее
4. **Команды извлекаются правильно**

---

## ✅ Критерии успеха:

- ✅ Все 4 теста прошли
- ✅ Логи без ошибок
- ✅ Скорость < 1 секунды
- ✅ Русский язык естественный
- ✅ Клиенты довольны ответами

---

**Готово!** Выполни команды по порядку и сообщи результаты! 🚀
