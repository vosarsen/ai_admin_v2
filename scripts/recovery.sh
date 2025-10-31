#!/bin/bash

# recovery.sh - Скрипт быстрого восстановления AI Admin
# Использование:
#   ./recovery.sh          - полное восстановление
#   ./recovery.sh soft     - мягкое восстановление (без удаления сессий)
#   ./recovery.sh whatsapp - только WhatsApp
#   ./recovery.sh redis    - только Redis
#   ./recovery.sh company 962302 - восстановление конкретной компании

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
REDIS_PASSWORD="70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg="
API_URL="http://localhost:3000"
LOG_DIR="/opt/ai-admin/logs"

# Функция для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Проверка здоровья системы
check_health() {
    log "Проверка состояния системы..."

    # Проверка API
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        log "✅ API отвечает"
    else
        error "API не отвечает"
        return 1
    fi

    # Проверка Redis
    if redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
        log "✅ Redis работает"
    else
        error "Redis не отвечает"
        return 1
    fi

    # Проверка PM2 процессов
    PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); print(len([p for p in data if p['pm2_env']['status'] == 'online']))")
    log "✅ PM2 процессов онлайн: $PM2_STATUS"

    return 0
}

# Мягкий рестарт (только перезапуск процессов)
soft_recovery() {
    log "🔄 Выполняется мягкое восстановление..."

    log "Перезапуск PM2 процессов..."
    pm2 restart ai-admin-api
    sleep 2
    pm2 restart ai-admin-worker-v2
    sleep 2
    pm2 restart ai-admin-batch-processor

    log "✅ Мягкое восстановление завершено"
}

# Восстановление WhatsApp
recover_whatsapp() {
    log "📱 Восстановление WhatsApp..."

    # Останавливаем API чтобы безопасно удалить сессии
    log "Остановка API..."
    pm2 stop ai-admin-api

    # Удаляем сессии
    log "Удаление старых сессий..."
    rm -rf /opt/ai-admin/sessions/company_*

    # Запускаем API
    log "Запуск API..."
    pm2 start ai-admin-api

    sleep 5

    # Проверяем статус
    if curl -s "$API_URL/health" | grep -q '"whatsapp"'; then
        log "✅ WhatsApp восстановлен (потребуется QR-код для авторизации)"
    else
        error "Проблема с восстановлением WhatsApp"
    fi
}

# Восстановление Redis
recover_redis() {
    log "🗄️ Очистка проблемных ключей Redis..."

    # Удаляем зависшие батчи
    log "Удаление зависших rapid-fire ключей..."
    redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "rapid-fire:*" | xargs -r redis-cli --no-auth-warning -a "$REDIS_PASSWORD" del

    # Удаляем старые last-msg ключи
    log "Удаление устаревших last-msg ключей..."
    redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "last-msg:*" | xargs -r redis-cli --no-auth-warning -a "$REDIS_PASSWORD" del

    # Показываем статистику
    KEYS_COUNT=$(redis-cli --no-auth-warning -a "$REDIS_PASSWORD" dbsize | cut -d' ' -f2)
    log "✅ Redis очищен. Всего ключей: $KEYS_COUNT"
}

# Восстановление конкретной компании
recover_company() {
    COMPANY_ID=$1
    log "🏢 Восстановление компании $COMPANY_ID..."

    # Удаляем сессию WhatsApp компании
    log "Удаление WhatsApp сессии..."
    rm -rf "/opt/ai-admin/sessions/company_$COMPANY_ID"

    # Очищаем очередь сообщений компании
    log "Очистка очереди сообщений..."
    redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "bull:company-$COMPANY_ID-messages:*" | xargs -r redis-cli --no-auth-warning -a "$REDIS_PASSWORD" del

    # Очищаем контекст
    log "Очистка контекста диалогов..."
    redis-cli --no-auth-warning -a "$REDIS_PASSWORD" --scan --pattern "context:$COMPANY_ID:*" | xargs -r redis-cli --no-auth-warning -a "$REDIS_PASSWORD" del

    # Перезапускаем API для применения изменений
    pm2 restart ai-admin-api

    log "✅ Компания $COMPANY_ID восстановлена"
}

# Полное восстановление
full_recovery() {
    log "🚨 ПОЛНОЕ ВОССТАНОВЛЕНИЕ СИСТЕМЫ"
    warning "Это удалит все сессии WhatsApp и очистит проблемные данные!"

    read -p "Вы уверены? (yes/no): " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log "Отменено пользователем"
        exit 0
    fi

    log "Остановка всех процессов..."
    pm2 stop all

    log "Очистка WhatsApp сессий..."
    rm -rf /opt/ai-admin/sessions/company_*

    log "Очистка проблемных Redis ключей..."
    recover_redis

    log "Запуск всех процессов..."
    pm2 start all

    sleep 5

    # Финальная проверка
    if check_health; then
        log "✅ СИСТЕМА ПОЛНОСТЬЮ ВОССТАНОВЛЕНА"
    else
        error "Система восстановлена, но требует внимания"
    fi
}

# Показать статус
show_status() {
    log "📊 СТАТУС СИСТЕМЫ"
    echo "-------------------"

    # PM2 статус
    pm2 status

    echo "-------------------"

    # Health check
    curl -s "$API_URL/health" | python3 -m json.tool || error "Не удалось получить health status"

    echo "-------------------"

    # Последние ошибки
    log "Последние ошибки:"
    tail -n 20 "$LOG_DIR/worker-v2-error-16.log" | grep -i error || log "Ошибок не найдено"
}

# Главное меню
case "${1:-full}" in
    soft)
        soft_recovery
        ;;
    whatsapp)
        recover_whatsapp
        ;;
    redis)
        recover_redis
        ;;
    company)
        if [ -z "$2" ]; then
            error "Укажите ID компании: ./recovery.sh company 962302"
            exit 1
        fi
        recover_company "$2"
        ;;
    status)
        show_status
        ;;
    check)
        check_health
        ;;
    full)
        full_recovery
        ;;
    *)
        echo "Использование:"
        echo "  ./recovery.sh          - полное восстановление"
        echo "  ./recovery.sh soft     - мягкое восстановление"
        echo "  ./recovery.sh whatsapp - восстановление WhatsApp"
        echo "  ./recovery.sh redis    - очистка Redis"
        echo "  ./recovery.sh company ID - восстановление компании"
        echo "  ./recovery.sh status   - показать статус"
        echo "  ./recovery.sh check    - проверить здоровье"
        exit 1
        ;;
esac

log "Готово! Используйте './recovery.sh status' для проверки"