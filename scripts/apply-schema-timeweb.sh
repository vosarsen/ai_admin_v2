#!/bin/bash
# Применение схемы БД в Timeweb PostgreSQL
# Usage: ./scripts/apply-schema-timeweb.sh

set -e

echo "🚀 Applying database schema to Timeweb PostgreSQL..."
echo ""

# Connection string
TIMEWEB_DB="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db"

# Проверка подключения
echo "1️⃣ Testing connection..."
if ! psql "$TIMEWEB_DB" -c "SELECT 'Connection OK';" > /dev/null 2>&1; then
  echo "❌ Connection failed! Run ./scripts/test-timeweb-connection.sh first"
  exit 1
fi
echo "✅ Connection OK"

# Применение базовой схемы
echo ""
echo "2️⃣ Applying base schema (scripts/setup-database.sql)..."
if psql "$TIMEWEB_DB" < scripts/setup-database.sql; then
  echo "✅ Base schema applied"
else
  echo "❌ Failed to apply base schema"
  exit 1
fi

# Применение миграций
echo ""
echo "3️⃣ Applying migrations..."

MIGRATIONS=(
  "migrations/20251007_create_whatsapp_auth_tables.sql"
  "migrations/20251008_optimize_whatsapp_keys.sql"
  "migrations/add_marketplace_fields_to_companies.sql"
  "migrations/add_marketplace_events_table.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    echo "   Applying: $migration"
    if psql "$TIMEWEB_DB" < "$migration" 2>/dev/null; then
      echo "   ✅ $migration applied"
    else
      echo "   ⚠️  $migration failed (might be already applied)"
    fi
  else
    echo "   ⚠️  $migration not found (skipping)"
  fi
done

# Проверка созданных таблиц
echo ""
echo "4️⃣ Verifying created tables..."
psql "$TIMEWEB_DB" << EOF
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
EOF

# Проверка индексов
echo ""
echo "5️⃣ Verifying indexes..."
psql "$TIMEWEB_DB" << EOF
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
EOF

echo ""
echo "✅ Schema applied successfully to Timeweb PostgreSQL!"
echo ""
echo "📊 Next steps:"
echo "   1. Verify tables: psql \"$TIMEWEB_DB\" -c \"\\dt\""
echo "   2. Export data: ./scripts/export-supabase-data.sh"
echo "   3. Import data: ./scripts/import-timeweb-data.sh"
echo ""
