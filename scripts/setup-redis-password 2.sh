#!/bin/bash

# Script to set up Redis password authentication
# Run this on the production server

REDIS_PASSWORD="70GB32AhHvMisfK8LtluTbtkWTnTj5jSrOdQj7d1QMg="
REDIS_CONFIG="/etc/redis/redis.conf"

echo "🔒 Setting up Redis password authentication..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run as root (use sudo)"
   exit 1
fi

# Backup current config
echo "📦 Backing up current Redis config..."
cp $REDIS_CONFIG ${REDIS_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)

# Check if password is already set
if grep -q "^requirepass" $REDIS_CONFIG; then
    echo "⚠️  Password already configured in Redis, updating..."
    sed -i "s/^requirepass .*/requirepass $REDIS_PASSWORD/" $REDIS_CONFIG
else
    echo "✅ Adding password to Redis config..."
    echo "" >> $REDIS_CONFIG
    echo "# Authentication" >> $REDIS_CONFIG
    echo "requirepass $REDIS_PASSWORD" >> $REDIS_CONFIG
fi

# Also set masterauth for replication (if needed in future)
if ! grep -q "^masterauth" $REDIS_CONFIG; then
    echo "masterauth $REDIS_PASSWORD" >> $REDIS_CONFIG
fi

# Disable dangerous commands
echo "🛡️  Disabling dangerous commands..."
if ! grep -q "rename-command FLUSHDB" $REDIS_CONFIG; then
    echo "" >> $REDIS_CONFIG
    echo "# Security: Disable dangerous commands" >> $REDIS_CONFIG
    echo 'rename-command FLUSHDB ""' >> $REDIS_CONFIG
    echo 'rename-command FLUSHALL ""' >> $REDIS_CONFIG
    echo 'rename-command CONFIG "CONFIG_e8f9c3a5b2d8"' >> $REDIS_CONFIG
fi

# Set up proper bind address (only localhost)
echo "🌐 Configuring bind address..."
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' $REDIS_CONFIG

# Enable protected mode
sed -i 's/^protected-mode .*/protected-mode yes/' $REDIS_CONFIG

# Set up persistence
echo "💾 Configuring persistence..."
sed -i 's/^save ""/# save ""/' $REDIS_CONFIG
if ! grep -q "^save 900 1" $REDIS_CONFIG; then
    echo "save 900 1" >> $REDIS_CONFIG
    echo "save 300 10" >> $REDIS_CONFIG  
    echo "save 60 10000" >> $REDIS_CONFIG
fi

# Enable AOF for better durability
sed -i 's/^appendonly .*/appendonly yes/' $REDIS_CONFIG

# Restart Redis
echo "🔄 Restarting Redis..."
systemctl restart redis-server

# Wait for Redis to start
sleep 2

# Test authentication
echo "🧪 Testing Redis authentication..."
if redis-cli -a "$REDIS_PASSWORD" ping | grep -q PONG; then
    echo "✅ Redis authentication configured successfully!"
else
    echo "❌ Failed to authenticate with Redis"
    exit 1
fi

# Update systemd service file to include password
SYSTEMD_FILE="/etc/systemd/system/redis.service.d/override.conf"
if [ ! -d "/etc/systemd/system/redis.service.d" ]; then
    mkdir -p /etc/systemd/system/redis.service.d
fi

echo "[Service]" > $SYSTEMD_FILE
echo "Environment=\"REDIS_PASSWORD=$REDIS_PASSWORD\"" >> $SYSTEMD_FILE

systemctl daemon-reload

echo "📝 Redis security configuration complete!"
echo ""
echo "⚠️  IMPORTANT: Make sure to:"
echo "1. Update .env file with NODE_ENV=production"
echo "2. Set REDIS_PASSWORD=$REDIS_PASSWORD in .env"
echo "3. Restart all services: pm2 restart all"
echo ""
echo "Test command: redis-cli -a '$REDIS_PASSWORD' ping"