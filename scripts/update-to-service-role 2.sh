#!/bin/bash

# Script to update Supabase key from anon to service_role
# Usage: ./update-to-service-role.sh <service_role_key>

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide the service_role key as an argument"
    echo "Usage: $0 <service_role_key>"
    echo ""
    echo "To get the service_role key:"
    echo "1. Go to https://app.supabase.com"
    echo "2. Select your project"
    echo "3. Go to Settings → API"
    echo "4. Copy the 'service_role' key (NOT the anon key)"
    exit 1
fi

SERVICE_ROLE_KEY=$1
SSH_KEY="$HOME/.ssh/id_ed25519_ai_admin"
SERVER="root@46.149.70.219"

echo "🔄 Updating Supabase key to service_role..."

# Backup current .env
echo "📦 Creating backup of current .env..."
ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && cp .env .env.backup.$(date +%Y%m%d_%H%M%S)"

# Update the SUPABASE_KEY
echo "✏️ Updating SUPABASE_KEY in .env..."
ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && sed -i.bak 's/^SUPABASE_KEY=.*/SUPABASE_KEY=$SERVICE_ROLE_KEY/' .env"

# Verify the update
echo "✅ Verifying update..."
ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && grep '^SUPABASE_KEY=' .env | head -1"

# Restart services
echo "🔄 Restarting services..."
ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && pm2 restart all"

# Test the connection
echo "🧪 Testing database connection..."
ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && node -e \"
const { supabase } = require('./src/database/supabase.js');
supabase.from('companies').select('count', {count: 'exact'})
  .then(r => {
    if (r.error) {
      console.log('❌ Error:', r.error.message);
      process.exit(1);
    } else {
      console.log('✅ Connection successful! Tables accessible with service_role key.');
      process.exit(0);
    }
  });
\""

if [ $? -eq 0 ]; then
    echo "✅ Successfully updated to service_role key!"
    echo ""
    echo "Next steps:"
    echo "1. Test synchronization: cd /opt/ai-admin && node scripts/manual-sync.js services"
    echo "2. Test bot: Send a message to WhatsApp"
    echo "3. If issues occur, restore backup: cd /opt/ai-admin && mv .env.backup.<timestamp> .env && pm2 restart all"
else
    echo "❌ Connection test failed. Rolling back..."
    ssh -i "$SSH_KEY" "$SERVER" "cd /opt/ai-admin && mv .env.bak .env && pm2 restart all"
    echo "Rolled back to previous configuration."
    exit 1
fi