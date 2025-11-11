#!/usr/bin/env node
/**
 * Cleanup Test Data Script
 *
 * Safely removes test data from database after integration tests.
 * Only deletes records marked as test data (see TEST_MARKERS in db-helper.js)
 *
 * Usage:
 *   node scripts/cleanup-test-data.js           # Execute cleanup
 *   node scripts/cleanup-test-data.js --dry-run # Preview what would be deleted
 */

require('dotenv').config();
const { cleanupTestData, getDatabaseStats } = require('../tests/helpers/db-helper');
const logger = require('../src/utils/logger');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n🧹 Test Data Cleanup Script\n');

  // Show current stats
  console.log('📊 Database Statistics Before Cleanup:');
  const statsBefore = await getDatabaseStats();
  console.log(`  Total clients: ${statsBefore.total_clients}`);
  console.log(`  Test clients: ${statsBefore.test_clients}`);
  console.log(`  Total bookings: ${statsBefore.total_bookings}`);
  console.log(`  Total contexts: ${statsBefore.total_contexts}`);
  console.log(`  Test contexts: ${statsBefore.test_contexts}`);
  console.log('');

  if (statsBefore.test_clients === 0 && statsBefore.test_contexts === 0) {
    console.log('✅ No test data found - nothing to clean up');
    process.exit(0);
  }

  // Run cleanup
  const results = await cleanupTestData({
    tables: ['bookings', 'dialog_contexts', 'clients'], // Order matters (foreign keys)
    dryRun: isDryRun
  });

  // Show results
  console.log('\n📋 Cleanup Results:');
  for (const [table, result] of Object.entries(results)) {
    if (result.dryRun) {
      console.log(`  ${table}: would delete ${result.wouldDelete} records`);
    } else {
      console.log(`  ${table}: deleted ${result.deleted} records`);
    }
  }

  if (!isDryRun) {
    // Show updated stats
    console.log('\n📊 Database Statistics After Cleanup:');
    const statsAfter = await getDatabaseStats();
    console.log(`  Total clients: ${statsAfter.total_clients} (${statsAfter.total_clients - statsBefore.total_clients} change)`);
    console.log(`  Test clients: ${statsAfter.test_clients}`);
    console.log(`  Total contexts: ${statsAfter.total_contexts} (${statsAfter.total_contexts - statsBefore.total_contexts} change)`);
    console.log(`  Test contexts: ${statsAfter.test_contexts}`);
    console.log('\n✅ Cleanup completed successfully');
  } else {
    console.log('\n[DRY RUN] No data was deleted. Run without --dry-run to execute cleanup.');
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });
}

module.exports = { main };
