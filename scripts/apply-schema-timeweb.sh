#!/bin/bash
# Применение схемы БД в Timeweb PostgreSQL
# Usage: ./scripts/apply-schema-timeweb.sh

set -e

echo "🚀 Applying database schema to Timeweb PostgreSQL..."
echo ""

# Connection string из переменных окружения или .env
if [ -z "$POSTGRES_CONNECTION_STRING" ]; then
  # Пробуем загрузить из .env
  if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -E '^POSTGRES_' | xargs)
  fi

  # Строим connection string
  POSTGRES_HOST="${POSTGRES_HOST:-192.168.0.4}"
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  POSTGRES_DATABASE="${POSTGRES_DATABASE:-default_db}"
  POSTGRES_USER="${POSTGRES_USER:-gen_user}"
  # ⚠️ Default password - override via .env for security
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-\}X|oM595A<7n?0}"

  if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD not set!"
    echo ""
    echo "Set it via environment variable or .env file:"
    echo "  export POSTGRES_PASSWORD='}X|oM595A<7n?0'"
    echo "  or add to .env: POSTGRES_PASSWORD=}X|oM595A<7n?0"
    exit 1
  fi

  # URL-encode password for connection string
  POSTGRES_PASSWORD_ENCODED=$(node -e "console.log(encodeURIComponent('$POSTGRES_PASSWORD'))")

  TIMEWEB_DB="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD_ENCODED}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}"
else
  TIMEWEB_DB="$POSTGRES_CONNECTION_STRING"
fi

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
if psql "$TIMEWEB_DB" < scripts/setup-database.sql 2>&1 | tee /tmp/schema-base.log; then
  echo "✅ Base schema applied"
else
  if grep -q "already exists" /tmp/schema-base.log; then
    echo "⚠️  Base schema already applied (skipping)"
  else
    echo "❌ Failed to apply base schema"
    cat /tmp/schema-base.log
    exit 1
  fi
fi

# Применение миграций (автоматический поиск)
echo ""
echo "3️⃣ Applying migrations..."

# Найти все SQL файлы в migrations/ и отсортировать
MIGRATIONS=($(find migrations -name '*.sql' -type f | sort))

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "⚠️  No migrations found in migrations/ directory"
else
  echo "   Found ${#MIGRATIONS[@]} migration(s)"

  for migration in "${MIGRATIONS[@]}"; do
    echo ""
    echo "   📄 Applying: $migration"

    if psql "$TIMEWEB_DB" < "$migration" 2>&1 | tee /tmp/migration.log; then
      echo "   ✅ $migration applied successfully"
    else
      # Проверяем тип ошибки
      if grep -qi "already exists\|duplicate" /tmp/migration.log; then
        echo "   ⚠️  $migration already applied (skipping)"
      else
        echo "   ❌ $migration failed!"
        echo "   Error details:"
        cat /tmp/migration.log
        echo ""
        echo "   Do you want to continue with other migrations? (y/n)"
        read -r continue_migration
        if [ "$continue_migration" != "y" ]; then
          exit 1
        fi
      fi
    fi
  done
fi

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
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
EOF

echo ""
echo "✅ Schema applied successfully to Timeweb PostgreSQL!"
echo ""
echo "📊 Next steps:"
echo "   1. Verify tables: psql \"\$TIMEWEB_DB\" -c \"\\dt\""
echo "   2. Export data from Supabase (TODO: create export script)"
echo "   3. Import data to Timeweb (TODO: create import script)"
echo ""
