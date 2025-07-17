#!/bin/bash

# Скрипт для настройки автоматического SSH туннеля

echo "🚀 Redis Tunnel Setup"
echo "===================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_FILE="$SCRIPT_DIR/com.aiadmin.redis-tunnel.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/com.aiadmin.redis-tunnel.plist"

case "$1" in
    install)
        echo "📦 Installing Redis tunnel service..."
        
        # Создаем директорию если её нет
        mkdir -p "$LAUNCH_AGENTS_DIR"
        
        # Копируем plist файл
        cp "$PLIST_FILE" "$INSTALLED_PLIST"
        
        # Загружаем службу
        launchctl load "$INSTALLED_PLIST"
        
        echo "✅ Service installed and started"
        echo ""
        echo "📌 The tunnel will:"
        echo "   - Start automatically on system boot"
        echo "   - Restart automatically if connection drops"
        echo "   - Check connection every 30 seconds"
        echo ""
        echo "📋 Useful commands:"
        echo "   Check status:  $SCRIPT_DIR/scripts/maintain-redis-tunnel.sh status"
        echo "   View logs:     tail -f ~/.redis-tunnel.log"
        echo "   Uninstall:     $0 uninstall"
        ;;
        
    uninstall)
        echo "🗑️  Uninstalling Redis tunnel service..."
        
        if [ -f "$INSTALLED_PLIST" ]; then
            launchctl unload "$INSTALLED_PLIST"
            rm "$INSTALLED_PLIST"
            echo "✅ Service uninstalled"
        else
            echo "❌ Service not found"
        fi
        
        # Останавливаем туннель
        "$SCRIPT_DIR/scripts/maintain-redis-tunnel.sh" stop
        ;;
        
    quick)
        echo "⚡ Quick start (without auto-restart)..."
        "$SCRIPT_DIR/scripts/maintain-redis-tunnel.sh" start
        echo ""
        echo "✅ Tunnel started on port 6380"
        echo "⚠️  Note: This will not auto-restart on failure"
        echo "   For auto-restart run: $0 install"
        ;;
        
    *)
        echo "Usage: $0 {install|uninstall|quick}"
        echo ""
        echo "Options:"
        echo "  install    - Install as system service (auto-start, auto-restart)"
        echo "  uninstall  - Remove system service"
        echo "  quick      - Just start tunnel now (no auto-restart)"
        echo ""
        echo "Current status:"
        "$SCRIPT_DIR/scripts/maintain-redis-tunnel.sh" status
        ;;
esac