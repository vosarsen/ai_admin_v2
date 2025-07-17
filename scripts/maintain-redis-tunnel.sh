#!/bin/bash

# Скрипт для поддержания SSH туннеля к Redis
# Автоматически перезапускает туннель при разрыве соединения

REMOTE_HOST="root@46.149.70.219"
LOCAL_PORT=6380
REMOTE_PORT=6379
LOG_FILE="$HOME/.redis-tunnel.log"
PID_FILE="$HOME/.redis-tunnel.pid"

# Функция для логирования
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Функция для проверки туннеля
check_tunnel() {
    if lsof -i:$LOCAL_PORT >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Функция для остановки туннеля
stop_tunnel() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            log "Stopping existing tunnel (PID: $PID)"
            kill "$PID"
            sleep 1
        fi
        rm -f "$PID_FILE"
    fi
    
    # Убиваем любые оставшиеся процессы на порту
    lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true
}

# Функция для запуска туннеля
start_tunnel() {
    log "Starting SSH tunnel..."
    
    # Используем autossh если установлен, иначе обычный ssh
    if command -v autossh >/dev/null 2>&1; then
        log "Using autossh for automatic reconnection"
        AUTOSSH_GATETIME=0 AUTOSSH_PORT=0 autossh -M 0 -f -N \
            -o "ServerAliveInterval=10" \
            -o "ServerAliveCountMax=3" \
            -o "ExitOnForwardFailure=yes" \
            -o "StrictHostKeyChecking=no" \
            -o "UserKnownHostsFile=/dev/null" \
            -L $LOCAL_PORT:localhost:$REMOTE_PORT \
            $REMOTE_HOST
    else
        ssh -f -N \
            -o "ServerAliveInterval=10" \
            -o "ServerAliveCountMax=3" \
            -o "ExitOnForwardFailure=yes" \
            -o "StrictHostKeyChecking=no" \
            -o "UserKnownHostsFile=/dev/null" \
            -L $LOCAL_PORT:localhost:$REMOTE_PORT \
            $REMOTE_HOST
    fi
    
    # Сохраняем PID
    sleep 2
    PID=$(lsof -ti:$LOCAL_PORT | head -1)
    if [ -n "$PID" ]; then
        echo "$PID" > "$PID_FILE"
        log "Tunnel started successfully (PID: $PID)"
        return 0
    else
        log "Failed to start tunnel"
        return 1
    fi
}

# Основной цикл
main() {
    case "${1:-}" in
        start)
            if check_tunnel; then
                log "Tunnel is already running"
                exit 0
            fi
            start_tunnel
            ;;
        
        stop)
            stop_tunnel
            log "Tunnel stopped"
            ;;
        
        restart)
            stop_tunnel
            sleep 1
            start_tunnel
            ;;
        
        status)
            if check_tunnel; then
                echo "✅ Redis tunnel is running on port $LOCAL_PORT"
                if [ -f "$PID_FILE" ]; then
                    echo "   PID: $(cat $PID_FILE)"
                fi
            else
                echo "❌ Redis tunnel is not running"
            fi
            ;;
        
        monitor)
            log "Starting tunnel monitor mode..."
            
            # Бесконечный цикл для мониторинга
            while true; do
                if ! check_tunnel; then
                    log "Tunnel is down, restarting..."
                    stop_tunnel
                    start_tunnel
                fi
                sleep 30
            done
            ;;
        
        install-autossh)
            echo "Installing autossh for better tunnel stability..."
            if [[ "$OSTYPE" == "darwin"* ]]; then
                brew install autossh
            else
                echo "Please install autossh manually for your system"
            fi
            ;;
        
        *)
            echo "Usage: $0 {start|stop|restart|status|monitor|install-autossh}"
            echo ""
            echo "Commands:"
            echo "  start    - Start the SSH tunnel"
            echo "  stop     - Stop the SSH tunnel"
            echo "  restart  - Restart the SSH tunnel"
            echo "  status   - Check tunnel status"
            echo "  monitor  - Run in monitor mode (auto-restart on failure)"
            echo "  install-autossh - Install autossh for better stability"
            exit 1
            ;;
    esac
}

main "$@"