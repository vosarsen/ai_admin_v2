#!/usr/bin/env node
/**
 * Manual staff sync script
 * Syncs staff from YClients to PostgreSQL
 */

require('dotenv').config();
const postgres = require('../src/database/postgres');
const axios = require('axios');

const COMPANY_ID = 962302;
const INTERNAL_COMPANY_ID = 15;

async function syncStaff() {
  console.log('🔄 Starting manual staff sync...');

  // Fetch from YClients (need BEARER_TOKEN + USER_TOKEN for staff endpoint)
  const bearerToken = process.env.YCLIENTS_BEARER_TOKEN || process.env.YCLIENTS_API_KEY;
  const userToken = process.env.YCLIENTS_USER_TOKEN;

  if (!bearerToken || !userToken) {
    console.error('❌ Missing YCLIENTS_BEARER_TOKEN or YCLIENTS_USER_TOKEN');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('YCLIENTS')));
    process.exit(1);
  }

  console.log(`Using bearer token: ${bearerToken.substring(0, 8)}...`);

  const response = await axios.get(
    `https://api.yclients.com/api/v1/company/${COMPANY_ID}/staff`,
    {
      headers: {
        'Authorization': `Bearer ${bearerToken}, User ${userToken}`,
        'Accept': 'application/vnd.yclients.v2+json'
      }
    }
  );

  const staff = response.data.data || [];
  console.log(`📋 Found ${staff.length} staff members in YClients`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of staff) {
    // Skip admin
    if (!s.name || s.name === 'Администратор') {
      skipped++;
      continue;
    }

    const data = {
      yclients_id: s.id,
      company_id: INTERNAL_COMPANY_ID,
      name: s.name,
      specialization: s.specialization || '',
      position: s.position?.title || '',
      is_active: true
    };

    try {
      // Check if exists
      const existing = await postgres.pool.query(
        'SELECT id FROM staff WHERE yclients_id = $1 AND company_id = $2',
        [s.id, INTERNAL_COMPANY_ID]
      );

      if (existing.rows.length > 0) {
        // Update
        await postgres.pool.query(
          `UPDATE staff SET
            name = $1,
            specialization = $2,
            position = $3,
            updated_at = NOW()
          WHERE yclients_id = $4 AND company_id = $5`,
          [data.name, data.specialization, data.position, s.id, INTERNAL_COMPANY_ID]
        );
        console.log(`✅ Updated: ${data.name}`);
        updated++;
      } else {
        // Insert
        await postgres.pool.query(
          `INSERT INTO staff (yclients_id, company_id, name, specialization, position, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [data.yclients_id, data.company_id, data.name, data.specialization, data.position, data.is_active]
        );
        console.log(`✅ Inserted: ${data.name}`);
        inserted++;
      }
    } catch (e) {
      console.error(`❌ Error with ${data.name}:`, e.message);
    }
  }

  console.log(`\n📊 Sync complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);

  // Show current staff
  const result = await postgres.pool.query(
    'SELECT name, specialization FROM staff WHERE company_id = $1 AND is_active = true',
    [INTERNAL_COMPANY_ID]
  );
  console.log('\n👥 Current staff in DB:');
  result.rows.forEach(r => console.log(`   - ${r.name} (${r.specialization})`));

  await postgres.pool.end();
  process.exit(0);
}

syncStaff().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
