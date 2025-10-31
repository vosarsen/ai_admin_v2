#!/bin/bash

# scripts/deploy-baileys.sh
# Deployment script for Baileys migration on server

set -e  # Exit on error

echo "🚀 Baileys WhatsApp Provider - Server Deployment"
echo "================================================"

# Configuration
SERVER="root@46.149.70.219"
SERVER_PATH="/opt/ai-admin"
LOCAL_PATH="/Users/vosarsen/Documents/GitHub/ai_admin_v2"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment to server...${NC}"

# Step 1: Commit local changes
echo -e "\n${YELLOW}Step 1: Committing local changes${NC}"
cd $LOCAL_PATH
git add -A
git commit -m "feat: migrate from Venom to Baileys WhatsApp provider

- Implemented Baileys provider with multi-tenant support
- Created session manager for company routing
- Added compatibility layer for smooth migration
- Updated configuration and documentation"

# Step 2: Push to GitHub
echo -e "\n${YELLOW}Step 2: Pushing to GitHub${NC}"
git push origin feature/redis-context-cache

# Step 3: Connect to server and deploy
echo -e "\n${YELLOW}Step 3: Deploying on server${NC}"

ssh $SERVER << 'ENDSSH'
set -e
cd /opt/ai-admin

echo "📦 Pulling latest changes..."
git pull origin feature/redis-context-cache

echo "📦 Installing new dependencies..."
npm install @whiskeysockets/baileys pino qrcode-terminal

echo "🔧 Backing up current .env..."
cp .env .env.backup-$(date +%Y%m%d-%H%M%S)

echo "🔧 Updating .env for Baileys..."
# Check if Baileys config already exists
if ! grep -q "WHATSAPP_PROVIDER" .env; then
    echo "" >> .env
    echo "# Baileys WhatsApp Provider" >> .env
    echo "WHATSAPP_PROVIDER=baileys" >> .env
    echo "WHATSAPP_MULTI_TENANT=true" >> .env
    echo "WHATSAPP_SESSIONS_PATH=/opt/ai-admin/sessions" >> .env
else
    # Update existing values
    sed -i 's/WHATSAPP_PROVIDER=.*/WHATSAPP_PROVIDER=baileys/' .env
    sed -i 's/WHATSAPP_MULTI_TENANT=.*/WHATSAPP_MULTI_TENANT=true/' .env
fi

echo "📁 Creating sessions directory..."
mkdir -p /opt/ai-admin/sessions
chmod 700 /opt/ai-admin/sessions

echo "📁 Creating sessions .gitignore..."
echo "*" > /opt/ai-admin/sessions/.gitignore
echo "!.gitignore" >> /opt/ai-admin/sessions/.gitignore

echo "🔄 Restarting services..."
pm2 restart ai-admin-worker-v2

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test Baileys connection: node tests/test-baileys.js"
echo "2. Scan QR code to authenticate"
echo "3. Monitor logs: pm2 logs ai-admin-worker-v2"
echo "4. Check health: curl http://localhost:3000/health"

ENDSSH

echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo "📋 Post-deployment checklist:"
echo "  1. SSH to server: ssh root@46.149.70.219"
echo "  2. Test Baileys: cd /opt/ai-admin && node tests/test-baileys.js"
echo "  3. Monitor logs: pm2 logs ai-admin-worker-v2"
echo "  4. Check sessions: ls -la /opt/ai-admin/sessions/"
echo ""
echo "🔐 For QR authentication:"
echo "  ssh root@46.149.70.219"
echo "  cd /opt/ai-admin"
echo "  node tests/test-baileys.js"
echo "  (Scan QR code with WhatsApp)"