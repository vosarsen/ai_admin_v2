#!/bin/bash

# 🚀 Deploy Gemini Integration Script
# Автоматическое развёртывание Gemini на сервер

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying Gemini Integration to AI Admin v2"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVER="root@46.149.70.219"
SSH_KEY="~/.ssh/id_ed25519_ai_admin"
GEMINI_API_KEY="***REMOVED***"

echo ""
echo "📦 Step 1/6: Pulling latest code on server..."
ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && git pull"

echo ""
echo "🔑 Step 2/6: Adding GEMINI_API_KEY to .env..."
ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && grep -q 'GEMINI_API_KEY' .env || echo 'GEMINI_API_KEY=$GEMINI_API_KEY' >> .env"

echo ""
echo "📊 Step 3/6: Verifying .env configuration..."
ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && cat .env | grep -E '(AI_PROVIDER|GEMINI_API_KEY|DEEPSEEK_API_KEY)'"

echo ""
echo "🧪 Step 4/6: Running Gemini tests on server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && node scripts/test-gemini-api.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Tests completed!"
echo ""
read -p "📝 Did all tests pass? Switch to Gemini? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "🔄 Step 5/6: Switching to Gemini provider..."
    ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=gemini-flash/' .env"

    echo ""
    echo "🔄 Step 6/6: Restarting PM2 workers..."
    ssh -i $SSH_KEY $SERVER "cd /opt/ai-admin && pm2 restart ai-admin-worker-v2"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 Gemini is now LIVE!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Expected improvements:"
    echo "  - Speed: 18x faster (0.7s vs 13s)"
    echo "  - Cost: 73% cheaper ($29/mo vs $106/mo)"
    echo ""
    echo "📝 Monitoring commands:"
    echo "  - View logs: ssh -i $SSH_KEY $SERVER 'pm2 logs ai-admin-worker-v2 --lines 50'"
    echo "  - View errors: ssh -i $SSH_KEY $SERVER 'pm2 logs --err --lines 50'"
    echo "  - PM2 status: ssh -i $SSH_KEY $SERVER 'pm2 status'"
    echo ""
    echo "⚠️  If something goes wrong, rollback with:"
    echo "  ssh -i $SSH_KEY $SERVER \"cd /opt/ai-admin && sed -i 's/AI_PROVIDER=.*/AI_PROVIDER=deepseek/' .env && pm2 restart ai-admin-worker-v2\""
    echo ""
else
    echo ""
    echo "⏸️  Deployment paused. Staying on DeepSeek."
    echo "   Fix any issues and re-run this script when ready."
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment script completed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
