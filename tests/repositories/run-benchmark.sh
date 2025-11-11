#!/bin/bash
# Performance Benchmark Runner
# Runs benchmarks for both Supabase and Timeweb separately

cd "$(dirname "$0")/../.."

echo ""
echo "🚀 Performance Benchmark: Supabase vs Timeweb PostgreSQL"
echo ""
echo "Configuration:"
echo "  - Iterations: 10"
echo "  - Warmup: 2"
echo "  - Company ID: 962302"
echo "  - Test Phone: 79686484488"

# Benchmark Supabase
echo ""
echo "==================================================================="
echo "🔵 PHASE 1: Benchmarking Supabase (Legacy)"
echo "==================================================================="
echo ""

USE_LEGACY_SUPABASE=true USE_REPOSITORY_PATTERN=false node tests/repositories/single-backend-benchmark.js supabase > /tmp/supabase-bench.txt 2>&1
SUPABASE_EXIT=$?

if [ $SUPABASE_EXIT -ne 0 ]; then
  echo "❌ Supabase benchmark failed!"
  cat /tmp/supabase-bench.txt
  exit 1
fi

cat /tmp/supabase-bench.txt

# Benchmark Timeweb
echo ""
echo "==================================================================="
echo "🟢 PHASE 2: Benchmarking Timeweb PostgreSQL (Repository Pattern)"
echo "==================================================================="
echo ""

USE_REPOSITORY_PATTERN=true USE_LEGACY_SUPABASE=false node tests/repositories/single-backend-benchmark.js timeweb > /tmp/timeweb-bench.txt 2>&1
TIMEWEB_EXIT=$?

if [ $TIMEWEB_EXIT -ne 0 ]; then
  echo "❌ Timeweb benchmark failed!"
  cat /tmp/timeweb-bench.txt
  exit 1
fi

cat /tmp/timeweb-bench.txt

# Compare results
echo ""
echo "==================================================================="
echo "🏆 COMPARISON: Supabase vs Timeweb"
echo "==================================================================="
echo ""

node tests/repositories/compare-benchmarks.js

echo ""
echo "✅ Benchmark complete!"
echo ""
