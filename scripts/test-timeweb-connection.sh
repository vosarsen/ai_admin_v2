#!/bin/bash
# Тест подключения к Timeweb PostgreSQL
# Usage: ./scripts/test-timeweb-connection.sh

set -e

echo "🔍 Testing Timeweb PostgreSQL connection..."
echo ""

# Connection string
TIMEWEB_DB="postgresql://gen_user:%7DX%7CoM595A%3C7n%3F0@192.168.0.4:5432/default_db"

# Проверка подключения
echo "1️⃣ Testing connection..."
if psql "$TIMEWEB_DB" -c "SELECT 'Connection OK' as status;" > /dev/null 2>&1; then
  echo "✅ Connection successful!"
else
  echo "❌ Connection failed!"
  echo ""
  echo "💡 Make sure you're running this from VPS or through SSH tunnel:"
  echo "   ssh -L 5433:192.168.0.4:5432 root@46.149.70.219 -N &"
  echo "   Then use: postgresql://gen_user:...@localhost:5433/default_db"
  exit 1
fi

echo ""
echo "2️⃣ Checking PostgreSQL version..."
psql "$TIMEWEB_DB" -c "SELECT version();"

echo ""
echo "3️⃣ Checking database size..."
psql "$TIMEWEB_DB" -c "SELECT pg_size_pretty(pg_database_size('default_db')) as db_size;"

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
