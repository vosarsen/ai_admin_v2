#!/bin/bash
# Setup SSH tunnel to Timeweb PostgreSQL
# Usage: ./scripts/setup-timeweb-tunnel.sh [start|stop|status]

set -e

TUNNEL_PID_FILE="/tmp/timeweb-postgres-tunnel.pid"
SSH_KEY="$HOME/.ssh/id_ed25519_ai_admin"
SERVER="46.149.70.219"
LOCAL_PORT=5433
REMOTE_HOST="192.168.0.4"
REMOTE_PORT=5432

function start_tunnel() {
  # Check if tunnel already running
  if [ -f "$TUNNEL_PID_FILE" ]; then
    PID=$(cat "$TUNNEL_PID_FILE")
    if ps -p $PID > /dev/null 2>&1; then
      echo "✅ SSH tunnel already running (PID: $PID)"
      echo "   Local:  localhost:$LOCAL_PORT"
      echo "   Remote: $REMOTE_HOST:$REMOTE_PORT (via $SERVER)"
      return 0
    else
      echo "⚠️  Stale PID file found, cleaning up..."
      rm -f "$TUNNEL_PID_FILE"
    fi
  fi

  echo "🔌 Starting SSH tunnel to Timeweb PostgreSQL..."
  echo "   Local:  localhost:$LOCAL_PORT"
  echo "   Remote: $REMOTE_HOST:$REMOTE_PORT (via $SERVER)"
  echo ""

  # Start tunnel in background
  ssh -i "$SSH_KEY" \
    -L ${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} \
    -N \
    -o ServerAliveInterval=60 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    root@${SERVER} &

  TUNNEL_PID=$!
  echo $TUNNEL_PID > "$TUNNEL_PID_FILE"

  # Wait a bit and verify tunnel is working
  sleep 2

  if ps -p $TUNNEL_PID > /dev/null 2>&1; then
    echo "✅ SSH tunnel started successfully (PID: $TUNNEL_PID)"
    echo ""
    echo "📋 Connection details:"
    echo "   Host: localhost"
    echo "   Port: $LOCAL_PORT"
    echo "   Connection string: postgresql://gen_user:PASSWORD@localhost:$LOCAL_PORT/default_db"
    echo ""
    echo "💡 To stop tunnel: $0 stop"
  else
    echo "❌ Failed to start SSH tunnel"
    rm -f "$TUNNEL_PID_FILE"
    exit 1
  fi
}

function stop_tunnel() {
  if [ ! -f "$TUNNEL_PID_FILE" ]; then
    echo "⚠️  No tunnel PID file found"
    return 0
  fi

  PID=$(cat "$TUNNEL_PID_FILE")

  if ps -p $PID > /dev/null 2>&1; then
    echo "🛑 Stopping SSH tunnel (PID: $PID)..."
    kill $PID
    rm -f "$TUNNEL_PID_FILE"
    echo "✅ SSH tunnel stopped"
  else
    echo "⚠️  SSH tunnel not running (stale PID file)"
    rm -f "$TUNNEL_PID_FILE"
  fi
}

function status_tunnel() {
  if [ ! -f "$TUNNEL_PID_FILE" ]; then
    echo "❌ SSH tunnel is NOT running"
    return 1
  fi

  PID=$(cat "$TUNNEL_PID_FILE")

  if ps -p $PID > /dev/null 2>&1; then
    echo "✅ SSH tunnel is running (PID: $PID)"
    echo "   Local:  localhost:$LOCAL_PORT"
    echo "   Remote: $REMOTE_HOST:$REMOTE_PORT (via $SERVER)"

    # Test connection if psql is available
    if command -v psql > /dev/null 2>&1; then
      echo ""
      echo "🔍 Testing connection..."
      if psql "postgresql://gen_user:${POSTGRES_PASSWORD:-PASSWORD}@localhost:$LOCAL_PORT/default_db" \
           -c "SELECT 'Tunnel OK' as status;" 2>/dev/null | grep -q "Tunnel OK"; then
        echo "✅ Tunnel is working, database accessible"
      else
        echo "⚠️  Tunnel running but database not accessible (check password?)"
      fi
    fi
    return 0
  else
    echo "❌ SSH tunnel is NOT running (stale PID file)"
    rm -f "$TUNNEL_PID_FILE"
    return 1
  fi
}

# Main
case "${1:-start}" in
  start)
    start_tunnel
    ;;
  stop)
    stop_tunnel
    ;;
  status)
    status_tunnel
    ;;
  restart)
    stop_tunnel
    sleep 1
    start_tunnel
    ;;
  *)
    echo "Usage: $0 {start|stop|status|restart}"
    exit 1
    ;;
esac
