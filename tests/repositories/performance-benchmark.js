#!/usr/bin/env node
/**
 * Performance Benchmark: Single Backend
 *
 * Tests response latency for common data access patterns.
 * Run with USE_REPOSITORY_PATTERN and USE_LEGACY_SUPABASE env vars.
 *
 * Usage:
 *   USE_LEGACY_SUPABASE=true node performance-benchmark.js
 *   USE_REPOSITORY_PATTERN=true node performance-benchmark.js
 */

require('dotenv').config();
const { SupabaseDataLayer } = require('../../src/integrations/yclients/data/supabase-data-layer');
const flags = require('../../config/database-flags');

const COMPANY_ID = 962302;
const TEST_PHONE = '79686484488';

// Benchmark configuration
const ITERATIONS = 10;
const WARMUP_ITERATIONS = 2;

const results = {};

async function measureLatency(fn, label) {
  const times = [];

  // Warmup runs (not counted)
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    await fn();
  }

  // Measured runs
  for (let i = 0; i < ITERATIONS; i++) {
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    times.push(duration);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

  return { label, avg, min, max, median, times };
}

async function runBenchmark() {
  const backend = flags.useRepositoryPattern ? 'Timeweb' : 'Supabase';
  console.log(`\n🔍 Benchmarking ${backend}...\n`);

  const dataLayer = new SupabaseDataLayer(COMPANY_ID);

  // Test 1: Get client by phone
  results.getClientByPhone = await measureLatency(
    async () => await dataLayer.getClientByPhone(TEST_PHONE),
    'getClientByPhone'
  );

  // Test 2: Get company
  results.getCompany = await measureLatency(
    async () => await dataLayer.getCompany(),
    'getCompany'
  );

  // Test 3: Get services (all)
  results.getServices = await measureLatency(
    async () => await dataLayer.getServices(),
    'getServices'
  );

  // Test 4: Get staff
  results.getStaff = await measureLatency(
    async () => await dataLayer.getStaff(),
    'getStaff'
  );

  // Test 5: Get dialog context
  results.getDialogContext = await measureLatency(
    async () => await dataLayer.getDialogContext(TEST_PHONE),
    'getDialogContext'
  );

  printResults(backend, results);

  // Output as JSON for comparison script
  console.log('\n---JSON-START---');
  console.log(JSON.stringify({ backend, results }));
  console.log('---JSON-END---\n');
}

function printResults(backend, data) {
  console.log(`\n📊 ${backend} Results (${ITERATIONS} iterations):\n`);
  console.log('─'.repeat(70));
  console.log('Method                    | Avg (ms) | Min | Max | Median');
  console.log('─'.repeat(70));

  for (const [key, result] of Object.entries(data)) {
    const { label, avg, min, max, median } = result;
    console.log(
      `${label.padEnd(25)} | ${avg.toFixed(2).padStart(8)} | ${min.toString().padStart(3)} | ${max.toString().padStart(3)} | ${median.toString().padStart(6)}`
    );
  }

  console.log('─'.repeat(70));

  // Calculate average
  const total = Object.values(data).reduce((sum, r) => sum + r.avg, 0);
  const overallAvg = total / Object.keys(data).length;
  console.log(`\n📈 Overall Average: ${overallAvg.toFixed(2)} ms\n`);
}

async function benchmark() {
  console.log('\n🚀 Performance Benchmark\n');
  console.log(`Configuration:`);
  console.log(`  - Backend: ${flags.useRepositoryPattern ? 'Timeweb PostgreSQL' : 'Supabase'}`);
  console.log(`  - Iterations: ${ITERATIONS}`);
  console.log(`  - Warmup: ${WARMUP_ITERATIONS}`);
  console.log(`  - Company ID: ${COMPANY_ID}`);
  console.log(`  - Test Phone: ${TEST_PHONE}`);

  try {
    await runBenchmark();
    console.log('\n✅ Benchmark complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

benchmark();
