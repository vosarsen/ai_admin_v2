# Git Quick Reference - Шпаргалка для команды

## 🚀 Ежедневный workflow

### Начало дня:
```bash
git checkout main
git pull origin main
git checkout -b feature/my-new-feature
```

### Работа:
```bash
# Делаем изменения...
git add .
git commit -m "feat: описание изменения"
```

### Конец дня:
```bash
git push origin feature/my-new-feature
# Создать PR на GitHub
```

---

## 📝 Именование веток

| Тип | Префикс | Пример |
|-----|---------|--------|
| Новая фича | `feature/` | `feature/telegram-bot` |
| Исправление бага | `fix/` | `fix/reminder-crash` |
| Документация | `docs/` | `docs/api-reference` |
| Рефакторинг | `refactor/` | `refactor/context-service` |

---

## 💬 Commit messages

```bash
feat: добавлена новая функция
fix: исправлен баг с уведомлениями
docs: обновлена документация
refactor: переписан сервис контекста
test: добавлены unit тесты
chore: обновление зависимостей
```

---

## 🔄 Синхронизация

### Обновить свою ветку из main:
```bash
git checkout feature/my-feature
git fetch origin
git rebase origin/main
```

### Если конфликты:
```bash
# Разрешить конфликты в редакторе
git add .
git rebase --continue
git push origin feature/my-feature --force-with-lease
```

---

## 🚨 Частые проблемы

### Забыл pull перед началом работы:
```bash
git stash
git pull origin main
git stash pop
```

### Нужно переключиться, но есть незакоммиченные изменения:
```bash
git stash
git checkout other-branch
# После работы:
git checkout my-branch
git stash pop
```

### Случайно коммитнул в main:
```bash
# Создать feature ветку из текущего состояния
git checkout -b feature/my-fix
git push origin feature/my-fix

# Откатить main
git checkout main
git reset --hard origin/main
```

---

## 📊 Полезные команды

### Посмотреть статус:
```bash
git status
git log --oneline --graph -10
```

### Посмотреть изменения:
```bash
git diff                    # Незакоммиченные изменения
git diff main..my-branch    # Разница между ветками
```

### Удалить ветку:
```bash
git branch -d feature/old-branch           # Локально
git push origin --delete feature/old-branch # Удаленно
```

---

## 🎯 Для проекта AI Admin v2

### Deploy на сервер:
```bash
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 "cd /opt/ai-admin && git pull origin main && pm2 restart all"
```

### Тестирование локально:
```bash
# Запустить тесты
npm test

# Запустить worker
npm run worker:v2

# Проверить линтинг
npm run lint
```

---

**Полная документация:** `docs/GIT_WORKFLOW_STRATEGY.md`
