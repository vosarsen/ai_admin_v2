#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const tables = ['companies', 'clients', 'services', 'staff', 'bookings', 'dialog_contexts'];

async function analyzeTable(table) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [table]);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TABLE: ${table.toUpperCase()}`);
  console.log('='.repeat(70));
  result.rows.forEach(r => {
    const nullable = r.is_nullable === 'NO' ? 'NOT NULL' : 'NULL    ';
    console.log(`${r.column_name.padEnd(35)} ${r.data_type.padEnd(30)} ${nullable}`);
  });
}

(async () => {
  console.log('\n🔍 TIMEWEB POSTGRESQL SCHEMA ANALYSIS\n');

  for (const table of tables) {
    await analyzeTable(table);
  }

  await pool.end();
  console.log('\n✅ Analysis complete\n');
})();
