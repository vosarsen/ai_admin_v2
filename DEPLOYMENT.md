# Инструкция по развертыванию AI Admin v2

## Текущий статус на сервере

✅ **AI Admin v2 успешно развернут и работает!**

### Активные процессы:
- `ai-admin-api` - API сервер (порт 3000)
- `ai-admin-worker-v2` - Новый AI Admin v2 worker
- `venom-bot` - WhatsApp интеграция (порт 3001)

## Команды управления

### Проверка статуса:
```bash
ssh root@46.149.70.219 "pm2 list"
```

### Просмотр логов AI Admin v2:
```bash
ssh root@46.149.70.219 "pm2 logs ai-admin-worker-v2"
```

### Переключение между версиями:

#### Использовать новую версию (AI Admin v2):
```bash
ssh root@46.149.70.219 "cd /opt/ai-admin && pm2 stop ai-admin-worker && pm2 start ai-admin-worker-v2"
```

#### Вернуться к старой версии:
```bash
ssh root@46.149.70.219 "cd /opt/ai-admin && pm2 stop ai-admin-worker-v2 && pm2 start ai-admin-worker"
```

### Перезапуск воркера:
```bash
ssh root@46.149.70.219 "pm2 restart ai-admin-worker-v2"
```

