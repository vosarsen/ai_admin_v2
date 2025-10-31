#!/bin/bash

# Скрипт для создания таблицы visits в Supabase
# Использует Supabase CLI или можно выполнить через Dashboard

echo "📋 Creating visits table in Supabase..."
echo ""
echo "Option 1: Execute via Supabase Dashboard"
echo "----------------------------------------"
echo "1. Go to: https://supabase.com/dashboard/project/wyfbwjqnkkjeldhnmnpb/editor"
echo "2. Open SQL Editor"
echo "3. Copy and paste content from: scripts/database/create-visits-table.sql"
echo "4. Click 'Run'"
echo ""
echo "Option 2: Execute via psql (if you have direct access)"
echo "-------------------------------------------------------"
echo "Run this command:"
echo ""
cat << 'EOF'
psql "postgresql://postgres.wyfbwjqnkkjeldhnmnpb:ai-admin-supabase-2025@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" < scripts/database/create-visits-table.sql
EOF
echo ""
echo "Option 3: Execute via Supabase CLI"
echo "----------------------------------"
echo "Run this command:"
echo ""
echo "supabase db execute -f scripts/database/create-visits-table.sql"
echo ""
echo "After creating the table, test the sync with:"
echo "node scripts/sync-visits.js --limit 5"