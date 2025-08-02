#!/bin/bash

# Script to switch AI Admin v2 to use Qwen

echo "🚀 Switching AI Admin v2 to Qwen..."

# Add USE_QWEN to .env if not exists
if ! grep -q "USE_QWEN" .env; then
    echo "USE_QWEN=true" >> .env
    echo "✅ Added USE_QWEN=true to .env"
else
    # Update existing value
    sed -i 's/USE_QWEN=.*/USE_QWEN=true/' .env
    echo "✅ Updated USE_QWEN=true in .env"
fi

# Check if DASHSCOPE_API_KEY exists
if ! grep -q "DASHSCOPE_API_KEY" .env; then
    echo "❌ ERROR: DASHSCOPE_API_KEY not found in .env"
    echo "Please add: DASHSCOPE_API_KEY=your-api-key"
    exit 1
fi

echo "✅ Qwen configuration enabled"
echo ""
echo "To activate Qwen in production:"
echo "1. pm2 stop ai-admin-worker-v2"
echo "2. pm2 start ecosystem.config.js --only ai-admin-worker-v2"
echo ""
echo "To test locally:"
echo "USE_QWEN=true node src/workers/index-v2-qwen.js"