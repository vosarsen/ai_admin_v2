#!/bin/bash
# deploy.sh - Quick deployment script for AI Admin MVP

echo "🚀 AI Admin MVP Deployment Script"
echo "================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

# Load environment
export $(cat .env | grep -v '^#' | xargs)

echo "📦 Installing dependencies..."
npm ci --only=production

echo "🔧 Creating logs directory..."
mkdir -p logs

echo "💾 Caching initial data from YClients..."
node scripts/cache-initial-data.js

if [ $? -ne 0 ]; then
    echo "❌ Failed to cache initial data. Check your YClients credentials."
    exit 1
fi

echo "🛑 Stopping existing PM2 processes..."
pm2 stop ecosystem.config.js
pm2 delete ecosystem.config.js

echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js

echo "📊 Showing PM2 status..."
pm2 status

echo "✅ Deployment complete!"
echo ""
echo "Useful commands:"
echo "  pm2 logs          - View all logs"
echo "  pm2 logs ai-admin-api    - View API logs"
echo "  pm2 logs ai-admin-worker - View worker logs"
echo "  pm2 monit         - Monitor in real-time"
echo "  pm2 restart all   - Restart all processes"
echo ""
echo "API endpoints:"
echo "  GET  http://localhost:${PORT:-3000}/health"
echo "  POST http://localhost:${PORT:-3000}/webhook/whatsapp"
echo ""