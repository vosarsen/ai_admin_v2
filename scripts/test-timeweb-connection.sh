#!/bin/bash
# Тест подключения к Timeweb PostgreSQL
# Usage: ./scripts/test-timeweb-connection.sh

set -e

echo "🔍 Testing Timeweb PostgreSQL connection..."
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
echo "   Host: $POSTGRES_HOST:$POSTGRES_PORT"
echo "   Database: $POSTGRES_DATABASE"
echo "   User: $POSTGRES_USER"
echo ""

if psql "$TIMEWEB_DB" -c "SELECT 'Connection OK' as status;" > /dev/null 2>&1; then
  echo "✅ Connection successful!"
else
  echo "❌ Connection failed!"
  echo ""
  echo "💡 Troubleshooting:"
  echo "   1. Make sure you're running this from VPS or through SSH tunnel"
  echo "   2. If local, create SSH tunnel first:"
  echo "      ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &"
  echo "   3. Then set: POSTGRES_HOST=localhost POSTGRES_PORT=5433"
  echo "   4. Check your credentials in .env"
  exit 1
fi

echo ""
echo "2️⃣ Checking PostgreSQL version..."
psql "$TIMEWEB_DB" -c "SELECT version();"

echo ""
echo "3️⃣ Checking database size..."
psql "$TIMEWEB_DB" -c "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DATABASE')) as db_size;"

echo ""
echo "4️⃣ Checking max_connections..."
psql "$TIMEWEB_DB" -c "SHOW max_connections;"

echo ""
echo "5️⃣ Testing CREATE/INSERT/SELECT..."
psql "$TIMEWEB_DB" << EOF
-- Create test table
DROP TABLE IF EXISTS test_migration;
CREATE TABLE test_migration (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert test data
INSERT INTO test_migration (data) VALUES ('Test from migration script');

-- Select test data
SELECT * FROM test_migration;

-- Cleanup
DROP TABLE test_migration;

SELECT '✅ CREATE/INSERT/SELECT test passed' as result;
EOF

echo ""
echo "✅ All tests passed! Timeweb PostgreSQL is ready for migration."
echo ""
