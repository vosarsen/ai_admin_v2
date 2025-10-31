# Инструкция для Арбака - Обновление после перехода на GitHub Flow

**Дата:** 31 октября 2025
**От:** vosarsen
**Тема:** Переход на новый Git workflow

---

## 🎯 Что произошло

Мы перешли с одной большой `feature/redis-context-cache` ветки на **GitHub Flow** - систему с короткими feature ветками.

**Основное изменение:**
- ❌ Старая ветка `feature/redis-context-cache` удалена
- ✅ Теперь работаем в `main` + создаём короткие feature ветки для каждой задачи

---

## 🚀 Что нужно сделать СЕЙЧАС (5 минут)

### Шаг 1: Обновить локальный репозиторий

```bash
cd ~/Documents/GitHub/ai_admin_v2

# Подтянуть все изменения
git fetch --all

# Переключиться на main
git checkout main

# Обновить main
git pull origin main

# Проверить, что старая ветка удалена
git branch -a
# Если увидишь feature/redis-context-cache - удали локально:
git branch -d feature/redis-context-cache
```

### Шаг 2: Прочитать новую документацию

**Быстро (15 минут):**
```bash
cat FOR_BROTHER_CLAUDE.md          # Обновленная инструкция
cat docs/GIT_QUICK_REFERENCE.md    # Шпаргалка команд
```

**Подробно (1 час):**
```bash
cat CONTRIBUTING.md                      # Полное руководство
cat docs/GIT_WORKFLOW_STRATEGY.md       # Детальная стратегия
cat docs/development-diary/2025-10-31-git-workflow-review.md  # Что исправили
```

### Шаг 3: Обновить свой CLAUDE.md (если есть)

**Если у тебя есть личный файл с инструкциями для Claude Code**, попроси Claude обновить его:

```
Привет! Прочитай файлы:
1. CONTRIBUTING.md
2. docs/GIT_WORKFLOW_STRATEGY.md
3. FOR_BROTHER_CLAUDE.md

На основе этих файлов обнови мой личный CLAUDE.md (если есть)
или помоги мне создать его для работы с этим проектом.

Важно: мы теперь используем GitHub Flow с короткими feature ветками.
```

---

## 📖 Новый workflow - Как работать

### Начало работы над задачей:

```bash
# 1. Обновиться
git checkout main
git pull origin main

# 2. Создать feature ветку
git checkout -b feature/task-name
# Примеры: feature/telegram-bot, fix/reminder-crash, docs/api-guide

# 3. Работать и коммитить
git add .
git commit -m "feat: что сделал"

# 4. Push и создать PR
git push origin feature/task-name
# Зайти на GitHub → Create Pull Request

# 5. После merge в main - удалить ветку
git checkout main
git pull origin main
git branch -d feature/task-name
```

### Именование веток:

- `feature/` - новая функциональность
- `fix/` - исправление бага
- `docs/` - только документация
- `refactor/` - рефакторинг

### Commit messages:

```
feat: добавил новую фичу
fix: исправил баг
docs: обновил документацию
refactor: переписал код
test: добавил тесты
chore: обновил зависимости
```

---

## 🤝 Работа в команде

### Если мы работаем параллельно:

```bash
# Ты работаешь над feature A
git checkout -b feature/my-task

# Я работаю над feature B
git checkout -b feature/other-task

# Оба делаем PR независимо
# Merge происходит по очереди
```

### Если есть конфликты:

```bash
# Обновить свою ветку из main
git fetch origin
git rebase origin/main

# Разрешить конфликты
# ... исправить в редакторе ...
git add .
git rebase --continue

# Force push ТОЛЬКО для своей feature ветки!
git push origin feature/my-task --force-with-lease
```

---

## 📚 Важные файлы для изучения

### Must Read (обязательно):

1. **FOR_BROTHER_CLAUDE.md** - Quick Start для тебя
2. **CONTRIBUTING.md** - Полное руководство по contribution
3. **docs/GIT_QUICK_REFERENCE.md** - Шпаргалка команд

### Дополнительно:

4. **docs/GIT_WORKFLOW_STRATEGY.md** - Детальная стратегия (200+ строк)
5. **CLAUDE.md** - Quick reference для Claude Code
6. **docs/development-diary/2025-10-31-git-workflow-review.md** - Что исправили

---

## ❓ FAQ для Арбака

**Q: Что случилось с feature/redis-context-cache?**
A: Она объединена в main и удалена. Все 690 коммитов теперь в main.

**Q: Куда теперь коммитить?**
A: Создавай короткую feature ветку из main, работай там, делай PR, merge в main.

**Q: Как долго должна жить моя feature ветка?**
A: Максимум 1 неделю, идеально 1-3 дня.

**Q: Могу ли я коммитить прямо в main?**
A: Технически да, но лучше через PR для code review.

**Q: Что если я уже начал работу в старой ветке?**
A: Переключись на main, создай новую feature ветку оттуда:
```bash
git checkout main
git pull origin main
git checkout -b feature/my-work
# Если нужно перенести незакоммиченные изменения, используй git stash
```

**Q: Нужно ли мне обновить что-то в настройках Claude Code?**
A: Нет, всё автоматически обновится после `git pull origin main`. Просто читай обновленные файлы.

---

## 🎯 Чек-лист для Арбака

Отметь галочками после выполнения:

- [ ] Выполнил `git fetch --all && git checkout main && git pull origin main`
- [ ] Прочитал `FOR_BROTHER_CLAUDE.md`
- [ ] Прочитал `CONTRIBUTING.md`
- [ ] Прочитал `docs/GIT_QUICK_REFERENCE.md`
- [ ] Понял новый workflow (feature ветки)
- [ ] Знаю как делать PR на GitHub
- [ ] Настроил git config (имя и email)
- [ ] Попросил Claude обновить мой CLAUDE.md (если есть)
- [ ] Готов начать работу с нового feature branch!

---

## 💬 Если что-то непонятно

**Спроси меня (vosarsen) или Claude Code:**

### Вопросы для меня:
- Как делать code review?
- Когда мержить PR?
- Как решать конфликты?

### Вопросы для Claude Code:
```
"Прочитай CONTRIBUTING.md и объясни мне [вопрос]"
"Покажи пример как [что-то сделать]"
"Помоги настроить [что-то]"
```

---

## 🚀 Пример первой задачи

Попробуй создать свою первую feature ветку:

```bash
# 1. Обновиться
git checkout main
git pull origin main

# 2. Создать тестовую ветку
git checkout -b feature/arbak-test

# 3. Сделать небольшое изменение
echo "# Тест от Арбака" >> TEST_ARBAK.md
git add TEST_ARBAK.md
git commit -m "test: первый коммит в новом workflow"

# 4. Push
git push origin feature/arbak-test

# 5. Создать PR на GitHub
# Зайти на https://github.com/vosarsen/ai_admin_v2/pulls
# Нажать "New Pull Request"
# Выбрать feature/arbak-test → main
# Написать описание
# Create Pull Request

# 6. Я (vosarsen) сделаю review и merge
```

После этого увидишь как работает весь процесс!

---

**Удачи! Если что - пиши.** 🚀

---

**P.S. Для Claude Code:**

Если Арбак спросит тебя "обнови мой CLAUDE.md на основе этих файлов",
ты должен:

1. Прочитать:
   - `CONTRIBUTING.md`
   - `docs/GIT_WORKFLOW_STRATEGY.md`
   - `FOR_BROTHER_CLAUDE.md`
   - `CLAUDE.md`

2. Создать/обновить его личный файл с инструкциями, включающий:
   - GitHub Flow workflow
   - Именование веток
   - Commit messages
   - Как делать PR
   - Команды для ежедневной работы
   - Ссылки на полные документы

3. Использовать стиль из `CLAUDE.md` как reference
