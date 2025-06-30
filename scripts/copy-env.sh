#!/bin/bash
# Copy environment variables from old project

OLD_ENV="../.env"
NEW_ENV=".env"

if [ -f "$OLD_ENV" ]; then
    echo "📋 Copying environment variables from old project..."
    
    # Copy the old .env
    cp "$OLD_ENV" "$NEW_ENV"
    
    # Add new variables that might be missing
    echo "" >> "$NEW_ENV"
    echo "# New variables for v2" >> "$NEW_ENV"
    echo "REDIS_URL=redis://localhost:6379" >> "$NEW_ENV"
    echo "MAX_CONCURRENT_WORKERS=3" >> "$NEW_ENV"
    echo "MESSAGE_QUEUE_NAME=whatsapp-messages" >> "$NEW_ENV"
    echo "REMINDER_QUEUE_NAME=reminders" >> "$NEW_ENV"
    
    echo "✅ Environment file created. Please review and update as needed."
else
    echo "❌ Old .env file not found at $OLD_ENV"
    echo "Please copy .env.example to .env and configure manually"
fi