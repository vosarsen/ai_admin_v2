# Contributing to AI Admin v2

Спасибо за интерес к проекту! Эта документация описывает процесс совместной разработки.

## 🌊 Git Workflow (GitHub Flow)

Мы используем **GitHub Flow** - простую стратегию для команды из 2+ человек.

### Основные правила:

1. **`main` - единственная долгоживущая ветка** (production-ready)
2. **Короткие feature ветки** - живут 1-7 дней макс
3. **Pull Requests** для всех изменений
4. **Code Review** обязателен перед merge
5. **Deploy из main** - сервер всегда синхронизирован с main

---

## 📝 Ежедневный workflow

### 1. Начало работы над новой задачей:

```bash
# Синхронизация с main
git checkout main
git pull origin main

# Создание feature ветки
git checkout -b feature/task-name
```

### 2. Работа и коммиты:

```bash
# Сделали изменения...
git add .
git commit -m "feat: описание изменения"

# Еще изменения...
git commit -m "fix: исправление бага"
```

### 3. Push и создание PR:

```bash
# Push ветки
git push origin feature/task-name

# Создать Pull Request на GitHub
# Назначить reviewer (брат или коллега)
```

### 4. Code Review:

- Reviewer проверяет код
- Оставляет комментарии если нужны правки
- Approve если всё ОК

### 5. Merge и cleanup:

```bash
# После merge PR удалить локальную ветку
git checkout main
git pull origin main
git branch -d feature/task-name
```

---

## 🏷️ Именование веток

Используйте префиксы для типа изменений:

| Префикс | Назначение | Пример |
|---------|------------|--------|
| `feature/` | Новая функциональность | `feature/telegram-notifications` |
| `fix/` | Исправление бага | `fix/reminder-crash` |
| `docs/` | Только документация | `docs/api-reference` |
| `refactor/` | Рефакторинг кода | `refactor/context-service` |
| `test/` | Добавление тестов | `test/booking-unit-tests` |

**Примеры хороших имен:**
- `feature/whatsapp-reactions`
- `fix/reminder-pluralization`
- `docs/git-workflow`
- `refactor/simplify-context-loading`

**Плохие имена:**
- `my-branch` (неинформативно)
- `feature/redis-context-cache-and-booking-and-reminders` (слишком много задач)
- `test` (без контекста)

---

## 💬 Commit Messages (Conventional Commits)

Используйте формат: `<type>: <description>`

### Типы коммитов:

- `feat:` - новая функциональность
- `fix:` - исправление бага
- `docs:` - только документация
- `refactor:` - рефакторинг без изменения функциональности
- `test:` - добавление/изменение тестов
- `chore:` - рутинные задачи (обновление зависимостей и т.д.)
- `perf:` - улучшение производительности
- `style:` - форматирование кода

### Примеры:

```
✅ ХОРОШО:
feat: добавлена обработка реакций на напоминания
fix: исправлено склонение существительных в уведомлениях
docs: обновлена документация Git workflow
refactor: упрощен сервис загрузки контекста
test: добавлены unit тесты для booking service

❌ ПЛОХО:
update
fixed bug
WIP
changes
asdf
```

### Детали коммита (опционально):

```bash
git commit -m "feat: добавлена обработка реакций

- Реакции на напоминания за день
- Реакции на напоминания за 2 часа
- Сохранение статуса подтверждения в БД
- Отправка благодарности клиенту"
```

---

## 🔄 Code Review Guidelines

### Для автора PR:

1. **Маленькие PR** - до 500 строк кода (легче ревьюить)
2. **Понятное описание** - что сделано и зачем
3. **Самопроверка** - прочитайте свой код перед созданием PR
4. **Тесты** - добавьте/обновите тесты если нужно
5. **Документация** - обновите если изменилось API

### Для reviewer:

1. **Быстрый ответ** - в течение дня
2. **Конструктивная критика** - объясняйте почему
3. **Хвалите хорошее** - отмечайте классные решения
4. **Не блокируйте по мелочам** - форматирование можно исправить позже

### Что проверять:

- ✅ Код работает и решает задачу
- ✅ Нет очевидных багов
- ✅ Код понятен и читаем
- ✅ Нет дублирования
- ✅ Тесты проходят
- ✅ Документация обновлена

---

## 🚨 Что делать с конфликтами

Если ваша ветка отстала от main и есть конфликты:

```bash
# 1. Обновить main
git checkout main
git pull origin main

# 2. Rebase своей ветки
git checkout feature/my-branch
git rebase main

# 3. Разрешить конфликты
# ... исправьте конфликты в редакторе ...
git add .
git rebase --continue

# 4. Force push (ТОЛЬКО для своей feature ветки!)
git push origin feature/my-branch --force-with-lease
```

⚠️ **НИКОГДА** не делайте `--force` в `main`!

---

## 🧪 Перед созданием PR

Проверьте локально:

```bash
# Линтинг
npm run lint

# Тесты
npm test

# Билд (если есть)
npm run build
```

---

## 🚀 Deploy Process

### После merge в main:

```bash
# На сервере (или через CI/CD в будущем)
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219
cd /opt/ai-admin
git pull origin main
npm install  # если были изменения в package.json
pm2 restart all

# Проверить логи
pm2 logs --lines 50
```

### Тестирование:

```bash
# Через MCP серверы (локально)
@whatsapp send_message phone:89686484488 message:"Тест после деплоя"
@logs logs_tail service:ai-admin-worker-v2 lines:50
```

---

## 📊 Параллельная работа

Если два человека работают одновременно:

```bash
# vosarsen:
git checkout -b feature/reminder-system
# ... работа ...
git push origin feature/reminder-system
# Create PR #1

# Arbak:
git checkout -b feature/new-design
# ... работа ...
git push origin feature/new-design
# Create PR #2

# Оба PR могут быть merged независимо
# Первый merged → второй rebase при конфликтах
```

---

## 📚 Дополнительные ресурсы

- [docs/GIT_WORKFLOW_STRATEGY.md](docs/GIT_WORKFLOW_STRATEGY.md) - Полная стратегия с примерами
- [docs/GIT_QUICK_REFERENCE.md](docs/GIT_QUICK_REFERENCE.md) - Краткая шпаргалка
- [CLAUDE.md](CLAUDE.md) - Quick reference для Claude Code
- [FOR_BROTHER_CLAUDE.md](FOR_BROTHER_CLAUDE.md) - Инструкция для новых разработчиков

---

## ❓ FAQ

**Q: Можно ли коммитить прямо в main?**
A: Технически да, но **не рекомендуется**. Лучше через PR для code review.

**Q: Как долго должна жить feature ветка?**
A: Максимум 1 неделю, идеально 1-3 дня. Длинные ветки = сложные конфликты.

**Q: Что делать если забыл создать feature ветку?**
A:
```bash
# Если еще не закоммитили:
git stash
git checkout -b feature/my-fix
git stash pop

# Если уже закоммитили в main:
git checkout -b feature/my-fix
git checkout main
git reset --hard origin/main
```

**Q: Как откатить изменения после deploy?**
A:
```bash
# Вариант 1: Revert коммита (создает новый коммит)
git revert <bad-commit-hash>
git push origin main

# Вариант 2: Откат к предыдущему коммиту (опасно!)
git reset --hard <good-commit-hash>
git push origin main --force  # ТОЛЬКО в экстренных случаях!
```

**Q: Нужно ли удалять merged ветки?**
A: **Да!** Это держит репозиторий чистым.
```bash
git branch -d feature/old-branch
git push origin --delete feature/old-branch
```

---

## 🎯 Чек-лист перед PR

- [ ] Код работает локально
- [ ] Тесты проходят (`npm test`)
- [ ] Линтинг OK (`npm run lint`)
- [ ] Commit messages следуют Conventional Commits
- [ ] Добавлена/обновлена документация
- [ ] PR description понятное
- [ ] Ветка rebased на latest main (нет конфликтов)

---

**Последнее обновление:** 31 октября 2025
**Версия:** 1.0
**Команда:** vosarsen, Arbak3553

Спасибо за вклад в проект! 🚀
