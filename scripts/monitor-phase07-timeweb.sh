#!/bin/bash
#
# Phase 0.7 Monitoring Script - Timeweb PostgreSQL Migration
# Monitors Baileys WhatsApp stability after switching from Supabase to Timeweb
#
# Usage: ./scripts/monitor-phase07-timeweb.sh
# Cron:  0 */4 * * * /opt/ai-admin/scripts/monitor-phase07-timeweb.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/ai-admin/phase07-monitor.log"
ALERT_THRESHOLD_MEMORY=150  # MB
ALERT_THRESHOLD_RESTARTS=2
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo -e "${TIMESTAMP} $1" | tee -a "$LOG_FILE"
}

log_success() {
    log "${GREEN}✅ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    log "${RED}❌ $1${NC}"
}

# Telegram notification function
send_telegram_alert() {
    local message="$1"

    if [[ -n "$TELEGRAM_BOT_TOKEN" ]] && [[ -n "$TELEGRAM_CHAT_ID" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="🚨 Phase 0.7 Alert: $message" \
            -d parse_mode="Markdown" > /dev/null 2>&1 || true
    fi
}

# ============================================================================
# 1. Check Baileys Service Status
# ============================================================================

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 Phase 0.7 Monitoring Check"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get PM2 status
PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="baileys-whatsapp-service")')

if [[ -z "$PM2_STATUS" ]]; then
    log_error "Baileys service not found in PM2!"
    send_telegram_alert "Baileys service not found in PM2"
    exit 1
fi

# Extract status info
SERVICE_STATUS=$(echo "$PM2_STATUS" | jq -r '.pm2_env.status')
SERVICE_PID=$(echo "$PM2_STATUS" | jq -r '.pid')
SERVICE_UPTIME=$(echo "$PM2_STATUS" | jq -r '.pm2_env.pm_uptime')
SERVICE_RESTARTS=$(echo "$PM2_STATUS" | jq -r '.pm2_env.restart_time')
MEMORY_MB=$(echo "$PM2_STATUS" | jq -r '.monit.memory / 1024 / 1024 | floor')

log "1️⃣ Service Status:"
log "   Status: $SERVICE_STATUS"
log "   PID: $SERVICE_PID"
log "   Restarts: $SERVICE_RESTARTS"
log "   Memory: ${MEMORY_MB} MB"

# Check if online
if [[ "$SERVICE_STATUS" != "online" ]]; then
    log_error "Service is not online! Status: $SERVICE_STATUS"
    send_telegram_alert "Baileys service is $SERVICE_STATUS"
    exit 1
else
    log_success "Service is online"
fi

# Check restart count
if [[ "$SERVICE_RESTARTS" -gt "$ALERT_THRESHOLD_RESTARTS" ]]; then
    log_warning "Service has restarted $SERVICE_RESTARTS times (threshold: $ALERT_THRESHOLD_RESTARTS)"
    send_telegram_alert "Baileys restarted $SERVICE_RESTARTS times"
fi

# Check memory usage
if [[ "$MEMORY_MB" -gt "$ALERT_THRESHOLD_MEMORY" ]]; then
    log_warning "Memory usage is high: ${MEMORY_MB} MB (threshold: ${ALERT_THRESHOLD_MEMORY} MB)"
    send_telegram_alert "Baileys memory usage: ${MEMORY_MB} MB"
else
    log_success "Memory usage is normal: ${MEMORY_MB} MB"
fi

# ============================================================================
# 2. Check WhatsApp Connection
# ============================================================================

log ""
log "2️⃣ WhatsApp Connection:"

# Get recent logs directly from log files (PM2 buffer is limited)
LOG_FILE_OUT="/opt/ai-admin/logs/baileys-service-out-8.log"
LOG_FILE_ERR="/opt/ai-admin/logs/baileys-service-error-8.log"

if [[ -f "$LOG_FILE_OUT" ]]; then
    # Read last 10K lines to catch restart messages (log file can be huge)
    # Remove ANSI color codes: perl is more reliable than sed for this
    RECENT_LOGS=$(tail -10000 "$LOG_FILE_OUT" 2>/dev/null | perl -pe 's/\e\[[0-9;]*m//g' || echo "")
else
    RECENT_LOGS=$(pm2 logs baileys-whatsapp-service --nostream --lines 200 --raw 2>/dev/null || echo "")
fi

# Check for connection status
if echo "$RECENT_LOGS" | grep -q "WhatsApp connected for company 962302"; then
    LAST_CONNECTION=$(echo "$RECENT_LOGS" | grep "WhatsApp connected for company 962302" | tail -1)
    log_success "WhatsApp is connected"
    log "   Last connection: $(echo "$LAST_CONNECTION" | grep -oP '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' || echo 'timestamp not found')"
else
    log_error "No recent WhatsApp connection found!"
    send_telegram_alert "No WhatsApp connection detected"
fi

# Check for disconnections
DISCONNECT_COUNT=$(echo "$RECENT_LOGS" | grep -c "Connection closed for company 962302" 2>/dev/null || echo "0")
DISCONNECT_COUNT=$(echo "$DISCONNECT_COUNT" | tr -d '\n' | tr -d ' ')
if [[ "$DISCONNECT_COUNT" =~ ^[0-9]+$ ]] && [[ "$DISCONNECT_COUNT" -gt 0 ]]; then
    log_warning "Found $DISCONNECT_COUNT disconnection(s) in recent logs"
fi

# ============================================================================
# 3. Check Timeweb PostgreSQL
# ============================================================================

log ""
log "3️⃣ Timeweb PostgreSQL:"

# Check if using Timeweb
if echo "$RECENT_LOGS" | grep -q "Using Timeweb PostgreSQL auth state"; then
    log_success "Baileys is using Timeweb PostgreSQL"
else
    log_error "Baileys is NOT using Timeweb PostgreSQL!"
    send_telegram_alert "Baileys not using Timeweb - possible rollback?"
fi

# Check for PostgreSQL errors in error log file
if [[ -f "$LOG_FILE_ERR" ]]; then
    PG_ERRORS=$(tail -10000 "$LOG_FILE_ERR" 2>/dev/null | perl -pe 's/\e\[[0-9;]*m//g' | grep -ai "postgres\|timeweb" | grep -ai "error" || echo "")
else
    PG_ERRORS=$(pm2 logs baileys-whatsapp-service --err --nostream --lines 100 2>/dev/null | grep -i "postgres\|timeweb" | grep -i "error" || echo "")
fi
if [[ -n "$PG_ERRORS" ]]; then
    ERROR_COUNT=$(echo "$PG_ERRORS" | wc -l)
    log_error "Found $ERROR_COUNT PostgreSQL error(s) in logs!"
    send_telegram_alert "PostgreSQL errors detected: $ERROR_COUNT errors"
    echo "$PG_ERRORS" | head -5 >> "$LOG_FILE"
else
    log_success "No PostgreSQL errors found"
fi

# ============================================================================
# 4. Check Message Processing
# ============================================================================

log ""
log "4️⃣ Message Processing:"

# Get AI worker logs
WORKER_LOGS=$(pm2 logs ai-admin-worker-v2 --nostream --lines 50 2>/dev/null || echo "")

# Check for recent message processing
RECENT_MESSAGES=$(echo "$WORKER_LOGS" | grep "Message sent successfully" | wc -l)
log "   Recent messages sent: $RECENT_MESSAGES (last 50 log lines)"

# Check for AI errors
AI_ERRORS=$(pm2 logs ai-admin-worker-v2 --err --nostream --lines 50 2>/dev/null | grep -i "error" || echo "")
if [[ -n "$AI_ERRORS" ]]; then
    AI_ERROR_COUNT=$(echo "$AI_ERRORS" | wc -l)
    log_warning "Found $AI_ERROR_COUNT AI worker error(s)"
else
    log_success "No AI worker errors found"
fi

# ============================================================================
# 5. Check Database Operations
# ============================================================================

log ""
log "5️⃣ Database Operations:"

# Check for credential saves
CREDS_SAVED=$(echo "$RECENT_LOGS" | grep -c "Credentials saved for 962302" || echo "0")
log "   Credentials saved: $CREDS_SAVED times (recent logs)"

# Check for key operations
KEYS_LOADED=$(echo "$RECENT_LOGS" | grep -c "Loaded .* keys of type" || echo "0")
KEYS_UPSERTED=$(echo "$RECENT_LOGS" | grep -c "Upserted .* keys" || echo "0")
log "   Keys loaded: $KEYS_LOADED operations"
log "   Keys upserted: $KEYS_UPSERTED operations"

if [[ "$KEYS_LOADED" -eq 0 ]] && [[ "$KEYS_UPSERTED" -eq 0 ]]; then
    log_warning "No key operations detected in recent logs"
fi

# ============================================================================
# 6. Overall Health Status
# ============================================================================

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Calculate overall health score
HEALTH_SCORE=100

if [[ "$SERVICE_STATUS" != "online" ]]; then
    HEALTH_SCORE=$((HEALTH_SCORE - 50))
fi

if [[ "$SERVICE_RESTARTS" -gt "$ALERT_THRESHOLD_RESTARTS" ]]; then
    HEALTH_SCORE=$((HEALTH_SCORE - 20))
fi

if [[ "$MEMORY_MB" -gt "$ALERT_THRESHOLD_MEMORY" ]]; then
    HEALTH_SCORE=$((HEALTH_SCORE - 10))
fi

if [[ -n "$PG_ERRORS" ]]; then
    HEALTH_SCORE=$((HEALTH_SCORE - 30))
fi

if ! echo "$RECENT_LOGS" | grep -q "WhatsApp connected"; then
    HEALTH_SCORE=$((HEALTH_SCORE - 20))
fi

# Display health status
if [[ "$HEALTH_SCORE" -ge 80 ]]; then
    log_success "Overall Health: ${HEALTH_SCORE}% - EXCELLENT"
elif [[ "$HEALTH_SCORE" -ge 60 ]]; then
    log_warning "Overall Health: ${HEALTH_SCORE}% - GOOD (minor issues)"
elif [[ "$HEALTH_SCORE" -ge 40 ]]; then
    log_warning "Overall Health: ${HEALTH_SCORE}% - FAIR (needs attention)"
    send_telegram_alert "Health score dropped to ${HEALTH_SCORE}%"
else
    log_error "Overall Health: ${HEALTH_SCORE}% - CRITICAL"
    send_telegram_alert "CRITICAL: Health score ${HEALTH_SCORE}%"
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# ============================================================================
# 7. Export Metrics (for future analysis)
# ============================================================================

METRICS_FILE="/var/log/ai-admin/phase07-metrics.json"
cat > "$METRICS_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "service_status": "$SERVICE_STATUS",
  "service_pid": $SERVICE_PID,
  "service_restarts": $SERVICE_RESTARTS,
  "memory_mb": $MEMORY_MB,
  "health_score": $HEALTH_SCORE,
  "whatsapp_connected": $(echo "$RECENT_LOGS" | grep -q "WhatsApp connected" && echo "true" || echo "false"),
  "using_timeweb": $(echo "$RECENT_LOGS" | grep -q "Using Timeweb PostgreSQL" && echo "true" || echo "false"),
  "postgres_errors": $(echo "$PG_ERRORS" | wc -l || echo "0"),
  "recent_messages": $RECENT_MESSAGES
}
EOF

log_success "Metrics exported to $METRICS_FILE"

# Exit with appropriate code
if [[ "$HEALTH_SCORE" -lt 40 ]]; then
    exit 1
else
    exit 0
fi
