#!/usr/bin/env node

/**
 * Test Phase 0.8 Schema with Sample Data
 * Date: 2025-11-09
 * Purpose: Insert sample data and verify schema integrity
 */

require('dotenv').config();
const postgres = require('../src/database/postgres');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  header: (msg) => console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => {
    console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}`);
    console.log(colors.blue + '-'.repeat(60) + colors.reset);
  },
};

// Sample data
const sampleData = {
  company: {
    id: 1,
    name: 'Test Salon "Beauty"',
    yclients_company_id: 962302,
    phone: '79936363848',
    timezone: 'Europe/Moscow',
  },

  clients: [
    {
      phone: '79001234567',
      name: 'Иван Петров',
      sex: 'male',
      visits_count: 5,
    },
    {
      phone: '79009876543',
      name: 'Мария Иванова',
      sex: 'female',
      visits_count: 12,
    },
    {
      phone: '89686484488',
      name: 'Test Client',
      sex: 'male',
      visits_count: 0,
    },
  ],

  services: [
    {
      title: 'Стрижка мужская',
      duration: 30,
      price_min: 800,
      price_max: 1200,
    },
    {
      title: 'Стрижка женская',
      duration: 60,
      price_min: 1500,
      price_max: 2500,
    },
    {
      title: 'Маникюр',
      duration: 90,
      price_min: 1200,
      price_max: 1800,
    },
  ],

  staff: [
    {
      name: 'Анна Смирнова',
      specialization: 'Парикмахер',
      rating: 4.8,
    },
    {
      name: 'Елена Волкова',
      specialization: 'Мастер маникюра',
      rating: 4.9,
    },
  ],
};

async function testConnection() {
  log.section('Testing Database Connection');

  try {
    const result = await postgres.query('SELECT NOW(), VERSION()');
    log.success('Connected to PostgreSQL');
    log.info(`Server time: ${result.rows[0].now}`);
    log.info(`PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
    return true;
  } catch (error) {
    log.error(`Connection failed: ${error.message}`);
    return false;
  }
}

async function clearSampleData() {
  log.section('Clearing Previous Sample Data');

  try {
    // Delete in reverse dependency order
    await postgres.query('DELETE FROM bookings WHERE company_id = $1', [sampleData.company.id]);
    await postgres.query('DELETE FROM staff_schedules WHERE company_id = $1', [sampleData.company.id]);
    await postgres.query('DELETE FROM staff WHERE company_id = $1', [sampleData.company.id]);
    await postgres.query('DELETE FROM services WHERE company_id = $1', [sampleData.company.id]);
    await postgres.query('DELETE FROM clients WHERE company_id = $1', [sampleData.company.id]);
    await postgres.query('DELETE FROM companies WHERE id = $1', [sampleData.company.id]);

    log.success('Previous sample data cleared');
  } catch (error) {
    log.warning(`Clear failed (may be first run): ${error.message}`);
  }
}

async function insertCompany() {
  log.section('Inserting Sample Company');

  const sql = `
    INSERT INTO companies (id, name, yclients_company_id, phone, timezone)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        phone = EXCLUDED.phone
    RETURNING id, name;
  `;

  const values = [
    sampleData.company.id,
    sampleData.company.name,
    sampleData.company.yclients_company_id,
    sampleData.company.phone,
    sampleData.company.timezone,
  ];

  try {
    const result = await postgres.query(sql, values);
    log.success(`Company inserted: ${result.rows[0].name} (ID: ${result.rows[0].id})`);
    return result.rows[0].id;
  } catch (error) {
    log.error(`Failed to insert company: ${error.message}`);
    throw error;
  }
}

async function insertClients(companyId) {
  log.section('Inserting Sample Clients');

  const sql = `
    INSERT INTO clients (company_id, phone, name, sex, visits_count)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, phone;
  `;

  const clientIds = [];

  for (const client of sampleData.clients) {
    try {
      const result = await postgres.query(sql, [
        companyId,
        client.phone,
        client.name,
        client.sex,
        client.visits_count,
      ]);

      log.success(`Client: ${result.rows[0].name} (${result.rows[0].phone})`);
      clientIds.push(result.rows[0].id);
    } catch (error) {
      log.error(`Failed to insert client ${client.name}: ${error.message}`);
    }
  }

  return clientIds;
}

async function insertServices(companyId) {
  log.section('Inserting Sample Services');

  const sql = `
    INSERT INTO services (company_id, title, duration, price_min, price_max)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, duration;
  `;

  const serviceIds = [];

  for (const service of sampleData.services) {
    try {
      const result = await postgres.query(sql, [
        companyId,
        service.title,
        service.duration,
        service.price_min,
        service.price_max,
      ]);

      log.success(`Service: ${result.rows[0].title} (${result.rows[0].duration} min)`);
      serviceIds.push(result.rows[0].id);
    } catch (error) {
      log.error(`Failed to insert service ${service.title}: ${error.message}`);
    }
  }

  return serviceIds;
}

async function insertStaff(companyId) {
  log.section('Inserting Sample Staff');

  const sql = `
    INSERT INTO staff (company_id, name, specialization, rating)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, specialization;
  `;

  const staffIds = [];

  for (const staff of sampleData.staff) {
    try {
      const result = await postgres.query(sql, [
        companyId,
        staff.name,
        staff.specialization,
        staff.rating,
      ]);

      log.success(`Staff: ${result.rows[0].name} (${result.rows[0].specialization})`);
      staffIds.push(result.rows[0].id);
    } catch (error) {
      log.error(`Failed to insert staff ${staff.name}: ${error.message}`);
    }
  }

  return staffIds;
}

async function insertSchedules(companyId, staffIds) {
  log.section('Inserting Sample Staff Schedules');

  const sql = `
    INSERT INTO staff_schedules (company_id, staff_id, date, start_time, end_time, is_working)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING staff_id, date;
  `;

  const today = new Date();
  let count = 0;

  for (const staffId of staffIds) {
    // Insert schedules for next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      try {
        await postgres.query(sql, [
          companyId,
          staffId,
          dateStr,
          '09:00:00',
          '18:00:00',
          true,
        ]);
        count++;
      } catch (error) {
        log.warning(`Schedule already exists for staff ${staffId} on ${dateStr}`);
      }
    }
  }

  log.success(`Inserted ${count} schedule entries`);
}

async function insertBookings(companyId, clientIds, serviceIds, staffIds) {
  log.section('Inserting Sample Bookings');

  const sql = `
    INSERT INTO bookings (
      company_id, client_id, service_id, staff_id,
      datetime, duration, cost, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, datetime, status;
  `;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  try {
    const result = await postgres.query(sql, [
      companyId,
      clientIds[0],
      serviceIds[0],
      staffIds[0],
      tomorrow.toISOString(),
      30,
      1000,
      'confirmed',
    ]);

    log.success(`Booking created: ID ${result.rows[0].id}, ${result.rows[0].datetime}`);
  } catch (error) {
    log.error(`Failed to insert booking: ${error.message}`);
  }
}

async function insertMessages(companyId) {
  log.section('Inserting Sample Messages');

  const sql = `
    INSERT INTO messages (company_id, phone, message, direction, from_me)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at;
  `;

  const messages = [
    { phone: '79001234567', message: 'Привет!', direction: 'inbound', from_me: false },
    { phone: '79001234567', message: 'Здравствуйте! Чем могу помочь?', direction: 'outbound', from_me: true },
    { phone: '79001234567', message: 'Хочу записаться на стрижку', direction: 'inbound', from_me: false },
  ];

  let count = 0;

  for (const msg of messages) {
    try {
      const result = await postgres.query(sql, [
        companyId,
        msg.phone,
        msg.message,
        msg.direction,
        msg.from_me,
      ]);
      count++;
    } catch (error) {
      log.error(`Failed to insert message: ${error.message}`);
    }
  }

  log.success(`Inserted ${count} messages`);
}

async function verifyData() {
  log.section('Verifying Inserted Data');

  const queries = [
    { name: 'Companies', sql: 'SELECT COUNT(*) as count FROM companies' },
    { name: 'Clients', sql: 'SELECT COUNT(*) as count FROM clients' },
    { name: 'Services', sql: 'SELECT COUNT(*) as count FROM services' },
    { name: 'Staff', sql: 'SELECT COUNT(*) as count FROM staff' },
    { name: 'Schedules', sql: 'SELECT COUNT(*) as count FROM staff_schedules' },
    { name: 'Bookings', sql: 'SELECT COUNT(*) as count FROM bookings' },
    { name: 'Messages', sql: 'SELECT COUNT(*) as count FROM messages' },
  ];

  for (const query of queries) {
    try {
      const result = await postgres.query(query.sql);
      const count = result.rows[0].count;
      log.info(`${query.name}: ${count} records`);
    } catch (error) {
      log.error(`Failed to count ${query.name}: ${error.message}`);
    }
  }
}

async function testComplexQueries() {
  log.section('Testing Complex Queries');

  // Test 1: JOIN query
  log.info('Test 1: Booking with client, service, and staff details');
  try {
    const result = await postgres.query(`
      SELECT
        b.id,
        b.datetime,
        c.name as client_name,
        s.title as service_title,
        st.name as staff_name
      FROM bookings b
      LEFT JOIN clients c ON b.client_id = c.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN staff st ON b.staff_id = st.id
      WHERE b.company_id = $1
      LIMIT 5;
    `, [sampleData.company.id]);

    if (result.rows.length > 0) {
      log.success(`JOIN query works: ${result.rows.length} bookings found`);
      console.log('  Sample:', result.rows[0]);
    } else {
      log.warning('No bookings found (expected if first run)');
    }
  } catch (error) {
    log.error(`JOIN query failed: ${error.message}`);
  }

  // Test 2: Aggregation query
  log.info('Test 2: Client visits summary');
  try {
    const result = await postgres.query(`
      SELECT
        name,
        phone,
        visits_count,
        last_visit_date
      FROM clients
      WHERE company_id = $1
      ORDER BY visits_count DESC;
    `, [sampleData.company.id]);

    log.success(`Aggregation query works: ${result.rows.length} clients`);
  } catch (error) {
    log.error(`Aggregation query failed: ${error.message}`);
  }

  // Test 3: Date range query
  log.info('Test 3: Upcoming bookings');
  try {
    const result = await postgres.query(`
      SELECT
        COUNT(*) as count
      FROM bookings
      WHERE company_id = $1
        AND datetime >= NOW()
        AND datetime <= NOW() + INTERVAL '7 days';
    `, [sampleData.company.id]);

    log.success(`Date range query works: ${result.rows[0].count} upcoming bookings`);
  } catch (error) {
    log.error(`Date range query failed: ${error.message}`);
  }
}

async function testPartitionedTable() {
  log.section('Testing Partitioned Messages Table');

  try {
    // Get partition stats
    const result = await postgres.query('SELECT * FROM get_messages_stats()');

    log.success('Partition stats retrieved:');
    for (const row of result.rows) {
      console.log(`  ${row.partition_name}: ${row.row_count} rows, ${row.table_size}`);
    }
  } catch (error) {
    log.error(`Failed to get partition stats: ${error.message}`);
  }
}

async function main() {
  log.header();
  console.log(`${colors.bright}${colors.blue}Phase 0.8 Schema Testing${colors.reset}`);
  log.header();

  try {
    // Step 1: Test connection
    if (!await testConnection()) {
      process.exit(1);
    }

    // Step 2: Clear previous sample data
    await clearSampleData();

    // Step 3: Insert sample data
    const companyId = await insertCompany();
    const clientIds = await insertClients(companyId);
    const serviceIds = await insertServices(companyId);
    const staffIds = await insertStaff(companyId);
    await insertSchedules(companyId, staffIds);
    await insertBookings(companyId, clientIds, serviceIds, staffIds);
    await insertMessages(companyId);

    // Step 4: Verify data
    await verifyData();

    // Step 5: Test complex queries
    await testComplexQueries();

    // Step 6: Test partitioned table
    await testPartitionedTable();

    // Summary
    log.header();
    log.success('Phase 0.8 Schema Testing Complete!');
    console.log('');
    log.info('Next steps:');
    console.log('  1. Review test results');
    console.log('  2. Begin Phase 0.9 (Query Pattern Library)');
    console.log('  3. Start migrating actual data from Supabase');
    console.log('');

    process.exit(0);
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = { testConnection, insertCompany, insertClients };
