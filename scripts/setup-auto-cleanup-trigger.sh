#!/bin/bash

# Setup auto cleanup trigger for Baileys
echo "========================================="
echo "🔧 Setting up Auto Cleanup Trigger"
echo "========================================="

# Configuration
TRIGGER_SCRIPT="/opt/ai-admin/scripts/baileys-auto-cleanup-trigger.js"
LOG_DIR="/opt/ai-admin/logs"
CRON_SCHEDULE="*/30 * * * *"  # Every 30 minutes

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "📋 Configuration:"
echo "  - Check interval: Every 30 minutes"
echo "  - Trigger threshold: 175 files"
echo "  - Emergency threshold: 185 files"
echo "  - Log file: $LOG_DIR/auto-cleanup-trigger.log"
echo ""

# Check if running locally or on server
if [ -f "$TRIGGER_SCRIPT" ]; then
    echo -e "${GREEN}✅ Running on server${NC}"
    LOCAL=false
else
    echo -e "${YELLOW}📍 Running locally - will configure remote server${NC}"
    LOCAL=true
    SERVER_IP="46.149.70.219"
    SSH_KEY="$HOME/.ssh/id_ed25519_ai_admin"
fi

# Function to execute commands
execute_cmd() {
    if [ "$LOCAL" = true ]; then
        ssh -i "$SSH_KEY" root@$SERVER_IP "$1"
    else
        eval "$1"
    fi
}

# Create logs directory
echo -n "Creating logs directory... "
execute_cmd "mkdir -p $LOG_DIR"
echo -e "${GREEN}✅${NC}"

# Check if trigger script exists
echo -n "Checking trigger script... "
if execute_cmd "test -f $TRIGGER_SCRIPT"; then
    echo -e "${GREEN}✅ Found${NC}"
else
    echo -e "${RED}❌ Not found${NC}"
    echo "Please ensure the script is deployed first:"
    echo "  git push && git pull on server"
    exit 1
fi

# Add to crontab
echo ""
echo "📝 Adding cron job..."

# Check if already exists
EXISTING=$(execute_cmd "crontab -l 2>/dev/null | grep 'baileys-auto-cleanup-trigger' || true")

if [ -n "$EXISTING" ]; then
    echo -e "${YELLOW}⚠️ Cron job already exists:${NC}"
    echo "$EXISTING"
    echo ""
    read -p "Replace existing job? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove old and add new
        execute_cmd "crontab -l 2>/dev/null | grep -v 'baileys-auto-cleanup-trigger' | { cat; echo '$CRON_SCHEDULE /usr/bin/node $TRIGGER_SCRIPT >> $LOG_DIR/auto-cleanup-trigger.log 2>&1'; } | crontab -"
        echo -e "${GREEN}✅ Cron job updated${NC}"
    else
        echo "Keeping existing cron job"
    fi
else
    # Add new cron job
    execute_cmd "(crontab -l 2>/dev/null; echo '$CRON_SCHEDULE /usr/bin/node $TRIGGER_SCRIPT >> $LOG_DIR/auto-cleanup-trigger.log 2>&1') | crontab -"
    echo -e "${GREEN}✅ Cron job added${NC}"
fi

# Show current cron jobs
echo ""
echo "📋 Current Baileys-related cron jobs:"
execute_cmd "crontab -l | grep baileys"

# Test run
echo ""
echo -e "${YELLOW}🧪 Would you like to run a test now? (dry-run mode) (y/n)${NC}"
read -p "" -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running test..."
    execute_cmd "DRY_RUN=true node $TRIGGER_SCRIPT"
fi

echo ""
echo "========================================="
echo -e "${GREEN}✅ Auto Cleanup Trigger configured!${NC}"
echo "========================================="
echo ""
echo "📊 How it works:"
echo "  1. Checks every 30 minutes"
echo "  2. If any company has 175+ files → runs cleanup"
echo "  3. If any company has 185+ files → emergency cleanup"
echo "  4. Sends notifications (if webhook configured)"
echo ""
echo "📝 Monitor logs:"
echo "  tail -f $LOG_DIR/auto-cleanup-trigger.log"
echo ""
echo "🔧 Manual trigger:"
echo "  node $TRIGGER_SCRIPT"
echo ""
echo "⚙️ Configure webhook for notifications:"
echo "  export NOTIFICATION_WEBHOOK='https://your-webhook-url'"