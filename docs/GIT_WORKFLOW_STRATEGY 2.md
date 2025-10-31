# Git Workflow Strategy для AI Admin v2

**Дата:** 31 октября 2025
**Авторы:** vosarsen, Arbak3553
**Статус:** Действующая стратегия

## 🔴 Текущая ситуация (Проблема)

### Что происходит сейчас:

```
main (3 коммита)
  └─ cf97255 (общий предок - 3 месяца назад)
       └─ feature/redis-context-cache (689 коммитов!)
```

**Проблемы:**
1. ✅ **Все 689 коммитов** делаются в `feature/redis-context-cache`
2. ✅ Ветка называется "redis-context-cache", но содержит:
   - Гибридную синхронизацию расписаний
   - Обработку реакций
   - Исправления RESCHEDULE_BOOKING
   - Презентации для Yandex Cloud
   - Документацию модерации YClients
   - И еще ~680 других изменений
3. ✅ `main` ветка почти не обновляется (последний merge был 3 месяца назад)
4. ✅ Новые фичи от Арбака попали в `main` напрямую, минуя feature ветку

### Почему это проблема:

❌ **Название ветки не отражает содержимое** - "redis-context-cache" давно перестала быть только про Redis
❌ **Невозможно откатить отдельные фичи** - всё в одной гигантской ветке
❌ **Сложно делать code review** - 689 коммитов в одном PR
❌ **Production и Development разошлись** - что развернуто на сервере?
❌ **Параллельная работа усложнена** - один работает в feature, другой в main

---

## ✅ Рекомендуемая стратегия (GitHub Flow + Feature Branches)

### Концепция:

```
main (production-ready)
 ├─ feature/new-design (Arbak)
 ├─ feature/reminder-pluralization (vosarsen)
 └─ feature/schedules-sync (vosarsen)
```

### Правила:

1. **`main` = Production** - всегда стабильная, развернутая версия
2. **Feature branches** - одна фича = одна ветка
3. **Pull Requests** - обязательно для всех изменений
4. **Короткий цикл** - ветка живет 1-7 дней, потом merge в main
5. **Deploy из main** - сервер всегда синхронизирован с main

---

## 📋 Предлагаемая стратегия для вашего проекта

### Вариант 1: "Soft Reset" (Рекомендуется)

**Идея:** Признать текущую ситуацию, исправить workflow для будущего

#### Шаг 1: Синхронизировать ветки

```bash
# 1. Переключиться на main
git checkout main
git pull origin main

# 2. Влить feature/redis-context-cache в main
git merge feature/redis-context-cache --no-ff -m "chore: merge 689 commits from feature/redis-context-cache"

# 3. Запушить в origin
git push origin main

# 4. Удалить старую feature ветку
git branch -d feature/redis-context-cache
git push origin --delete feature/redis-context-cache
```

#### Шаг 2: Новый workflow

**С этого момента:**
- ✅ `main` = единственная долгоживущая ветка
- ✅ Для каждой новой фичи создавать отдельную ветку
- ✅ Короткие циклы (1-7 дней)
- ✅ Pull Requests для review

```bash
# Пример: Новая фича
git checkout main
git pull origin main
git checkout -b feature/client-notifications

# ... работа ...
git add .
git commit -m "feat: добавлены уведомления клиентов"
git push origin feature/client-notifications

# Создать PR на GitHub
# После review и approval -> Merge в main
# Удалить feature ветку
```

---

### Вариант 2: "Hard Reset" (Радикальный)

**Идея:** Очистить историю, начать с чистого листа

⚠️ **Внимание:** Потеряется история коммитов! Используйте только если уверены.

```bash
# 1. Создать backup ветку
git checkout feature/redis-context-cache
git branch backup-before-cleanup

# 2. Squash все 689 коммитов в один
git checkout main
git merge --squash feature/redis-context-cache
git commit -m "feat: merge all development work (689 commits squashed)"

# 3. Force push (ОПАСНО!)
git push origin main --force

# 4. Удалить feature ветку
git branch -d feature/redis-context-cache
git push origin --delete feature/redis-context-cache
```

---

## 🎯 Рекомендованный workflow для команды

### Ежедневная работа:

```bash
# Утром: синхронизация
git checkout main
git pull origin main

# Новая задача
git checkout -b feature/task-name

# Работа + коммиты
git add .
git commit -m "feat: описание"

# Вечером: push и PR
git push origin feature/task-name
# Создать PR на GitHub
```

### Именование веток:

- `feature/` - новая функциональность
- `fix/` - исправление бага
- `docs/` - только документация
- `refactor/` - рефакторинг без новых фич
- `test/` - добавление тестов

**Примеры:**
- `feature/telegram-notifications`
- `fix/reminder-pluralization`
- `docs/git-workflow`
- `refactor/context-service`

### Commit messages:

Следуйте Conventional Commits:

```
feat: добавлена новая фича
fix: исправлен баг с напоминаниями
docs: обновлена документация
refactor: рефакторинг сервиса контекста
test: добавлены тесты для booking
chore: обновление зависимостей
```

---

## 👥 Работа в команде (vosarsen + Arbak)

### Параллельная разработка:

```bash
# vosarsen работает над Feature A
git checkout -b feature/reminder-system
# ... commits ...
git push origin feature/reminder-system

# Arbak работает над Feature B
git checkout -b feature/new-design
# ... commits ...
git push origin feature/new-design

# Оба создают PR независимо
# Merge в main по очереди после review
```

### Конфликты:

Если оба работаете над одним файлом:

```bash
# Перед merge, обновить свою ветку
git checkout feature/my-feature
git fetch origin
git rebase origin/main

# Разрешить конфликты если есть
# Продолжить rebase
git rebase --continue

# Force push (для своей feature ветки - безопасно)
git push origin feature/my-feature --force-with-lease
```

---

## 🚀 Deployment workflow

### Текущая ситуация на сервере:

```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git branch  # Какая ветка?
```

### Рекомендуемая стратегия деплоя:

**Вариант 1: Deploy из main (Рекомендуется)**

```bash
# На сервере всегда main ветка
cd /opt/ai-admin
git fetch origin
git checkout main
git pull origin main
pm2 restart all
```

**Вариант 2: Deploy из feature ветки (Staging)**

Если нужно протестировать feature до merge:

```bash
# На сервере временно переключиться
cd /opt/ai-admin
git fetch origin
git checkout feature/test-this
git pull origin feature/test-this
pm2 restart all

# После тестов вернуться на main
git checkout main
git pull origin main
pm2 restart all
```

---

## 📊 Сравнение стратегий

### GitHub Flow (Рекомендуется для вас)

✅ **Плюсы:**
- Простота - всего одна main ветка
- Быстрый deploy
- Подходит для continuous deployment
- Легко понять новичкам

❌ **Минусы:**
- Нет staging environment по умолчанию
- Все в production сразу

### Git Flow (Альтернатива)

```
main (production)
develop (integration)
  ├─ feature/a
  ├─ feature/b
  └─ release/v1.0
```

✅ **Плюсы:**
- Есть staging (develop)
- Четкие release версии
- Hotfixes отдельно

❌ **Минусы:**
- Сложнее для маленькой команды
- Больше веток для управления

**Вывод:** Для команды из 2х человек с continuous deployment → **GitHub Flow**

---

## 🛠️ Инструменты и автоматизация

### GitHub Actions (опционально)

Создать `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        run: |
          ssh -i ${{ secrets.SSH_KEY }} root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && pm2 restart all"
```

### Pre-commit hooks

Создать `.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint
npm test
```

---

## 📝 Action Plan (Что делать прямо сейчас)

### Шаг 1: Обсудите в команде (15 минут)

Вопросы для обсуждения:
1. Вариант 1 (Soft Reset) или Вариант 2 (Hard Reset)?
2. Кто будет делать code review PR?
3. Как часто мержить в main? (ежедневно/еженедельно)

### Шаг 2: Синхронизируйте ветки (30 минут)

Выполните один из вариантов выше.

### Шаг 3: Обновите документацию (15 минут)

```bash
# Обновить CLAUDE.md
# Обновить FOR_BROTHER_CLAUDE.md
# Обновить TEAM_SETUP.md
```

### Шаг 4: Договоритесь о правилах (10 минут)

Запишите в `CONTRIBUTING.md`:
- Именование веток
- Формат commit messages
- Когда создавать PR
- Кто делает review

---

## 🎓 Best Practices

### ✅ DO:

- Делать маленькие, атомарные коммиты
- Писать понятные commit messages
- Создавать PR для каждой фичи
- Удалять merged ветки
- Синхронизироваться с main ежедневно
- Тестировать перед merge

### ❌ DON'T:

- Коммитить всё в одну долгоживущую feature ветку
- Пушить прямо в main без PR
- Накапливать 689 коммитов в одной ветке
- Называть ветки не по содержимому
- Забывать pull перед началом работы
- Force push в main

---

## 📚 Дополнительные ресурсы

- [GitHub Flow Guide](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Best Practices](https://git-scm.com/book/en/v2/Distributed-Git-Contributing-to-a-Project)

---

## 🤔 FAQ

**Q: Что делать с текущей feature/redis-context-cache?**
A: Влить в main и удалить. Начать использовать короткие feature ветки.

**Q: Можно ли коммитить прямо в main?**
A: Технически да, но лучше через PR для code review.

**Q: Как долго должна жить feature ветка?**
A: Максимум 1 неделю. Лучше 1-3 дня.

**Q: Нужны ли release ветки?**
A: Для вашего проекта пока нет. Используйте теги для версий.

**Q: Как откатить deploy?**
A: `git revert` на проблемный коммит или `git checkout` на предыдущий коммит.

---

**Последнее обновление:** 31 октября 2025
**Следующий review:** После применения новой стратегии (через 2 недели)
