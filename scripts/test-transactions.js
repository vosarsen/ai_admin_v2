#!/usr/bin/env node
/**
 * Test script for transaction support in BaseRepository
 *
 * Tests:
 * 1. Successful transaction (commit)
 * 2. Failed transaction (rollback)
 * 3. Transaction with helper methods
 *
 * Usage:
 *   node scripts/test-transactions.js
 */

require('dotenv').config();
const postgres = require('../src/database/postgres');
const BaseRepository = require('../src/repositories/BaseRepository');

async function main() {
  console.log('\n🧪 Testing Transaction Support\n');

  // Create repository instance
  const repo = new BaseRepository(postgres);

  // Test 1: Successful transaction
  console.log('Test 1: Successful Transaction (Commit)');
  try {
    const result = await repo.withTransaction(async (client) => {
      // Insert test client (without ON CONFLICT for now - will just insert)
      const clientResult = await client.query(
        `INSERT INTO clients (yclients_id, name, phone, company_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, name, phone`,
        [99999, 'Тестовый Клиент', '79999999999', 962302]
      );

      console.log('  ✅ Client created/updated:', clientResult.rows[0]);

      // Simulate more operations in same transaction
      await client.query(
        'UPDATE clients SET updated_at = NOW() WHERE id = $1',
        [clientResult.rows[0].id]
      );

      console.log('  ✅ Client updated');

      return clientResult.rows[0];
    });

    console.log('  ✅ Transaction committed successfully');
    console.log('  Result:', result);
  } catch (error) {
    console.error('  ❌ Test 1 failed:', error.message);
  }

  console.log('');

  // Test 2: Failed transaction (rollback)
  console.log('Test 2: Failed Transaction (Rollback)');
  try {
    await repo.withTransaction(async (client) => {
      // Insert test client
      await client.query(
        `INSERT INTO clients (yclients_id, name, phone, company_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [88888, 'Будет откачено', '79888888888', 962302]
      );

      console.log('  ✅ Client inserted');

      // Force an error to trigger rollback
      throw new Error('Simulated error - transaction should rollback');
    });
  } catch (error) {
    console.log('  ✅ Transaction rolled back as expected');
    console.log('  Error:', error.message);
  }

  // Verify rollback worked - client should NOT exist
  try {
    const checkResult = await postgres.query(
      'SELECT * FROM clients WHERE phone = $1 AND company_id = $2',
      ['79888888888', 962302]
    );

    if (checkResult.rows.length === 0) {
      console.log('  ✅ Rollback verified - record not found (correct)');
    } else {
      console.log('  ❌ Rollback failed - record still exists');
    }
  } catch (error) {
    console.error('  ❌ Verification failed:', error.message);
  }

  console.log('');

  // Test 3: Using helper methods
  console.log('Test 3: Transaction with Helper Methods');
  try {
    const result = await repo.withTransaction(async (client) => {
      // Use _findOneInTransaction
      const existing = await repo._findOneInTransaction(client, 'clients', {
        phone: '79999999999',
        company_id: 962302
      });

      console.log('  ✅ _findOneInTransaction:', existing ? 'Found' : 'Not found');

      // Use _upsertInTransaction (use yclients_id as unique key)
      const upserted = await repo._upsertInTransaction(
        client,
        'clients',
        {
          yclients_id: existing ? existing.yclients_id : 99999,
          name: 'Обновлённый через Helper',
          phone: '79999999999',
          company_id: 962302,
          updated_at: new Date().toISOString()
        },
        ['yclients_id', 'company_id']
      );

      console.log('  ✅ _upsertInTransaction:', upserted.name);

      return upserted;
    });

    console.log('  ✅ Helper methods work correctly');
  } catch (error) {
    console.error('  ❌ Test 3 failed:', error.message);
  }

  console.log('');
  console.log('🎉 Transaction tests complete!\n');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
