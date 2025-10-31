# Baileys Migration Guide - Server Deployment

## 📋 Обзор миграции

Переход с **Venom Bot** на **Baileys** для улучшения производительности и поддержки multi-tenant архитектуры.

### ✅ Преимущества Baileys:
- **Меньше памяти**: 50-100MB vs 500MB+ (Venom)  
- **Multi-tenant**: Поддержка множества компаний из коробки
- **Быстрее**: Прямое API без браузера
- **Надежнее**: Автоматическое восстановление сессий

## 🚀 Быстрый старт

### Автоматическое развертывание

```bash
# Запустить скрипт развертывания
./scripts/deploy-baileys.sh
```

## 📝 Пошаговая инструкция

### Шаг 1: Локальная подготовка

```bash
# Коммит изменений
git add -A
git commit -m "feat: migrate to Baileys WhatsApp provider"
git push origin feature/redis-context-cache
```

### Шаг 2: Подключение к серверу

```bash
ssh root@46.149.70.219
cd /opt/ai-admin
```

### Шаг 3: Обновление кода

```bash
# Получить последние изменения
git pull origin feature/redis-context-cache

# Установить зависимости Baileys
npm install @whiskeysockets/baileys pino qrcode-terminal
```

### Шаг 4: Конфигурация

```bash
# Бэкап текущего .env
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

# Добавить в .env:
cat >> .env << 'EOF'

# Baileys WhatsApp Provider
WHATSAPP_PROVIDER=baileys
WHATSAPP_MULTI_TENANT=true
WHATSAPP_SESSIONS_PATH=/opt/ai-admin/sessions
EOF
```

### Шаг 5: Создание директории сессий

```bash
# Создать директорию для сессий
mkdir -p /opt/ai-admin/sessions
chmod 700 /opt/ai-admin/sessions

# Добавить в .gitignore
echo "*" > /opt/ai-admin/sessions/.gitignore
echo "!.gitignore" >> /opt/ai-admin/sessions/.gitignore
```

### Шаг 6: Перезапуск сервисов

```bash
# Перезапустить worker
pm2 restart ai-admin-worker-v2

# Проверить статус
pm2 status
```

### Шаг 7: Аутентификация WhatsApp

```bash
# Запустить тест Baileys
node tests/test-baileys.js

# Появится QR код - отсканировать в WhatsApp
# После сканирования сессия сохранится автоматически
```

### Шаг 8: Проверка

```bash
# Проверить логи
pm2 logs ai-admin-worker-v2 --lines 50

# Проверить здоровье API
curl http://localhost:3000/health

# Проверить сессии
ls -la /opt/ai-admin/sessions/

# Отправить тестовое сообщение
node tests/manual/test-baileys-direct.js 79686484488 "Тест Baileys"
```

## 🔍 Мониторинг

### Логи Baileys

```bash
# Все логи WhatsApp
pm2 logs ai-admin-worker-v2 | grep -i whatsapp

# События сессий
pm2 logs ai-admin-worker-v2 | grep -i session

# Ошибки подключения
pm2 logs ai-admin-worker-v2 | grep -i disconnect
```

### API эндпоинты

```bash
# Статус сессий
curl http://localhost:3000/webhook/whatsapp/baileys/sessions

# Статус конкретной компании
curl http://localhost:3000/webhook/whatsapp/baileys/status/962302

# QR код для компании
curl http://localhost:3000/webhook/whatsapp/baileys/qr/962302
```

## 🛠️ Решение проблем

### QR код не появляется

```bash
# Удалить старую сессию
rm -rf /opt/ai-admin/sessions/company_*

# Запустить заново
node tests/test-baileys.js
```

### Сессия отключается

```bash
# Проверить логи
pm2 logs ai-admin-worker-v2 --lines 100 | grep -i error

# Переподключить
node tests/test-baileys.js
```

### Сообщения не отправляются

```bash
# Проверить статус
curl http://localhost:3000/health

# Проверить Redis
redis-cli ping

# Перезапустить все сервисы
pm2 restart all
```

## 🔄 Откат (если нужно)

### Вернуться на Venom

```bash
# Восстановить .env
cp .env.backup-* .env

# Изменить провайдер
sed -i 's/WHATSAPP_PROVIDER=baileys/WHATSAPP_PROVIDER=venom/' .env

# Перезапустить
pm2 restart ai-admin-worker-v2
```

## 📊 Проверочный чек-лист

- [ ] Код обновлен на сервере
- [ ] Зависимости установлены
- [ ] .env настроен для Baileys
- [ ] Директория sessions создана
- [ ] QR код отсканирован
- [ ] Сессия сохранена
- [ ] Тестовое сообщение отправлено
- [ ] Логи без ошибок
- [ ] Health check проходит

## 🎯 Multi-tenant настройка

Для каждой компании:

```bash
# Инициализировать сессию компании
curl -X POST http://localhost:3000/webhook/whatsapp/baileys/init/962302

# Получить QR код
curl http://localhost:3000/webhook/whatsapp/baileys/qr/962302

# Отправить сообщение от компании
curl -X POST http://localhost:3000/webhook/whatsapp/baileys/send \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "962302",
    "phone": "79686484488",
    "message": "Привет от компании!"
  }'
```

## 📞 Поддержка

При проблемах:

1. Проверить логи: `pm2 logs ai-admin-worker-v2`
2. Проверить сессии: `ls -la /opt/ai-admin/sessions/`
3. Запустить диагностику: `node tests/test-baileys.js`
4. Проверить конфигурацию: `grep WHATSAPP .env`

## ✅ Готово!

После успешной миграции система будет использовать Baileys для всех WhatsApp коммуникаций с улучшенной производительностью и поддержкой multi-tenant.