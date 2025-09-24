#!/bin/bash

# Setup script for Baileys cleanup cron job
# This script configures automatic cleanup to run daily at 3 AM

echo "========================================="
echo "🔧 Baileys Cleanup Cron Setup"
echo "========================================="

# Configuration
SERVER_IP="46.149.70.219"
SSH_KEY="$HOME/.ssh/id_ed25519_ai_admin"
SCRIPT_PATH="/opt/ai-admin/scripts/baileys-multitenancy-cleanup.js"
LOG_PATH="/opt/ai-admin/logs/baileys-cleanup.log"
LOG_DIR="/opt/ai-admin/logs"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to execute remote command
remote_exec() {
    ssh -i "$SSH_KEY" root@$SERVER_IP "$1"
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

echo "📋 Checking prerequisites..."

# 1. Check if cleanup script exists on server
echo -n "Checking if cleanup script exists on server... "
remote_exec "test -f $SCRIPT_PATH"
print_status $? "Script found at $SCRIPT_PATH"

# 2. Create logs directory if it doesn't exist
echo -n "Creating logs directory... "
remote_exec "mkdir -p $LOG_DIR"
print_status $? "Logs directory ready"

# 3. Test the script in dry-run mode
echo ""
echo -e "${YELLOW}🧪 Testing cleanup script in dry-run mode...${NC}"
echo "----------------------------------------"
remote_exec "cd /opt/ai-admin && node $SCRIPT_PATH --dry-run 2>&1 | head -20"
echo "----------------------------------------"

# 4. Ask for confirmation
echo ""
echo -e "${YELLOW}📌 The following cron job will be added:${NC}"
echo "0 3 * * * /usr/bin/node $SCRIPT_PATH >> $LOG_PATH 2>&1"
echo ""
echo "This will run the cleanup daily at 3:00 AM server time."
echo ""
read -p "Do you want to proceed? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Installation cancelled."
    exit 1
fi

# 5. Create cron job
echo ""
echo "🔧 Installing cron job..."

# Create a temporary cron file with the new job
CRON_CMD="0 3 * * * /usr/bin/node $SCRIPT_PATH >> $LOG_PATH 2>&1"

# Check if cron job already exists
EXISTING_CRON=$(remote_exec "crontab -l 2>/dev/null | grep 'baileys-multitenancy-cleanup' || true")

if [ -n "$EXISTING_CRON" ]; then
    echo -e "${YELLOW}⚠️ Cron job already exists:${NC}"
    echo "$EXISTING_CRON"
    read -p "Replace existing cron job? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Remove existing and add new
        remote_exec "crontab -l 2>/dev/null | grep -v 'baileys-multitenancy-cleanup' | { cat; echo '$CRON_CMD'; } | crontab -"
        print_status $? "Cron job updated"
    else
        echo "❌ Keeping existing cron job"
    fi
else
    # Add new cron job
    remote_exec "(crontab -l 2>/dev/null; echo '$CRON_CMD') | crontab -"
    print_status $? "Cron job installed"
fi

# 6. Verify installation
echo ""
echo "📋 Current cron jobs for Baileys cleanup:"
remote_exec "crontab -l | grep baileys || echo 'No Baileys cleanup jobs found'"

# 7. Optional: Setup PM2 for monitoring (alternative to cron)
echo ""
echo -e "${YELLOW}💡 Alternative: PM2 Cron Module${NC}"
echo "You can also use PM2 cron module for better monitoring:"
echo ""
echo "On server, run:"
echo "pm2 start $SCRIPT_PATH --name baileys-cleanup --cron '0 3 * * *'"
echo "pm2 save"
echo ""

# 8. Create monitoring script
echo "🔍 Creating cleanup monitoring script..."

cat << 'EOF' | remote_exec "cat > /opt/ai-admin/scripts/check-baileys-cleanup.sh && chmod +x /opt/ai-admin/scripts/check-baileys-cleanup.sh"
#!/bin/bash
# Check last cleanup run and results

LOG_FILE="/opt/ai-admin/logs/baileys-cleanup.log"

echo "========================================="
echo "📊 Baileys Cleanup Status"
echo "========================================="

if [ -f "$LOG_FILE" ]; then
    echo "📅 Last run:"
    tail -1000 "$LOG_FILE" | grep "Cleanup process completed" | tail -1

    echo ""
    echo "📈 Last results:"
    tail -1000 "$LOG_FILE" | grep -A 10 "CLEANUP SUMMARY" | tail -12

    echo ""
    echo "⚠️ Recent warnings:"
    tail -1000 "$LOG_FILE" | grep "WARNING\|CRITICAL\|EMERGENCY" | tail -5
else
    echo "❌ No cleanup log found"
fi

echo ""
echo "📁 Current file counts:"
for dir in /opt/ai-admin/baileys_sessions/company_*; do
    if [ -d "$dir" ]; then
        company=$(basename "$dir")
        count=$(ls -1 "$dir" | wc -l)

        if [ $count -gt 180 ]; then
            echo "  🔴 $company: $count files (EMERGENCY)"
        elif [ $count -gt 170 ]; then
            echo "  🟠 $company: $count files (CRITICAL)"
        elif [ $count -gt 150 ]; then
            echo "  ⚠️ $company: $count files (WARNING)"
        else
            echo "  ✅ $company: $count files"
        fi
    fi
done
EOF

print_status $? "Monitoring script created"

# 9. Final summary
echo ""
echo "========================================="
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo "========================================="
echo ""
echo "📋 Summary:"
echo "  ✅ Cleanup script: $SCRIPT_PATH"
echo "  ✅ Log file: $LOG_PATH"
echo "  ✅ Schedule: Daily at 3:00 AM"
echo "  ✅ Monitoring: /opt/ai-admin/scripts/check-baileys-cleanup.sh"
echo ""
echo "🔍 Useful commands:"
echo ""
echo "  # Check cleanup status:"
echo "  ssh -i $SSH_KEY root@$SERVER_IP '/opt/ai-admin/scripts/check-baileys-cleanup.sh'"
echo ""
echo "  # View recent logs:"
echo "  ssh -i $SSH_KEY root@$SERVER_IP 'tail -50 $LOG_PATH'"
echo ""
echo "  # Run cleanup manually (dry-run):"
echo "  ssh -i $SSH_KEY root@$SERVER_IP 'node $SCRIPT_PATH --dry-run'"
echo ""
echo "  # Run cleanup manually (real):"
echo "  ssh -i $SSH_KEY root@$SERVER_IP 'node $SCRIPT_PATH'"
echo ""
echo "  # Edit cron schedule:"
echo "  ssh -i $SSH_KEY root@$SERVER_IP 'crontab -e'"
echo ""
echo "🎉 Baileys cleanup automation is now active!"