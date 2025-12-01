#!/usr/bin/env node
/**
 * Database Schema Verification Script
 * Phase 0.5 of Database Code Review
 *
 * Purpose: Dump and verify actual production schema against documented schema
 *
 * Usage:
 *   node scripts/verify-db-schema.js              # Run verification
 *   node scripts/verify-db-schema.js --dump       # Dump schema to file
 *   node scripts/verify-db-schema.js --compare    # Compare with documented schema
 */

const Sentry = require('@sentry/node');
const path = require('path');
const fs = require('fs');

// Initialize Sentry first (as per backend-dev-guidelines)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
  });
}

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const postgres = require('../src/database/postgres');
const logger = require('../src/utils/logger');

// Expected schema from plan documentation
const EXPECTED_SCHEMA = {
  staff_schedules: {
    columns: [
      'id', 'yclients_staff_id', 'staff_name', 'date', 'is_working',
      'work_start', 'work_end', 'working_hours', 'last_updated',
      'has_booking_slots', 'company_id'
    ],
    criticalColumns: ['yclients_staff_id', 'company_id', 'date']
  },
  staff: {
    columns: [
      'id', 'yclients_id', 'company_id', 'name', 'specialization',
      'position', 'is_active', 'is_bookable', 'rating', 'declensions'
    ],
    criticalColumns: ['yclients_id', 'company_id', 'name']
  },
  bookings: {
    columns: [
      'id', 'yclients_record_id', 'company_id', 'client_phone',
      'client_yclients_id', 'staff_id', 'staff_name', 'services', 'datetime'
    ],
    criticalColumns: ['yclients_record_id', 'company_id', 'staff_id']
  },
  clients: {
    columns: [
      'id', 'yclients_id', 'company_id', 'phone', 'raw_phone',
      'name', 'favorite_staff_ids'
    ],
    criticalColumns: ['yclients_id', 'company_id', 'phone']
  },
  services: {
    columns: [
      'id', 'yclients_id', 'company_id', 'title', 'category_id', 'category_title'
    ],
    criticalColumns: ['yclients_id', 'company_id', 'title']
  },
  companies: {
    columns: [
      'id', 'yclients_id', 'company_id', 'title', 'phone', 'address'
    ],
    criticalColumns: ['yclients_id', 'company_id']
  }
};

/**
 * Get all tables in the database
 */
async function getAllTables() {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const result = await postgres.query(query);
  return result.rows.map(row => row.table_name);
}

/**
 * Get columns for a specific table
 */
async function getTableColumns(tableName) {
  const query = `
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `;

  const result = await postgres.query(query, [tableName]);
  return result.rows;
}

/**
 * Get indexes for a specific table
 */
async function getTableIndexes(tableName) {
  const query = `
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = $1
    ORDER BY indexname;
  `;

  const result = await postgres.query(query, [tableName]);
  return result.rows;
}

/**
 * Dump full schema to object
 */
async function dumpSchema() {
  const schema = {
    timestamp: new Date().toISOString(),
    database: process.env.POSTGRES_DATABASE || 'default_db',
    tables: {}
  };

  const tables = await getAllTables();
  logger.info(`Found ${tables.length} tables`);

  for (const tableName of tables) {
    const columns = await getTableColumns(tableName);
    const indexes = await getTableIndexes(tableName);

    schema.tables[tableName] = {
      columns: columns.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
        maxLength: col.character_maximum_length
      })),
      indexes: indexes.map(idx => ({
        name: idx.indexname,
        definition: idx.indexdef
      })),
      columnNames: columns.map(col => col.column_name)
    };
  }

  return schema;
}

/**
 * Compare actual schema with expected schema
 */
function compareSchema(actualSchema) {
  const report = {
    timestamp: new Date().toISOString(),
    status: 'PASS',
    tablesFound: Object.keys(actualSchema.tables).length,
    issues: [],
    warnings: [],
    verified: []
  };

  // Check each expected table
  for (const [tableName, expected] of Object.entries(EXPECTED_SCHEMA)) {
    const actual = actualSchema.tables[tableName];

    if (!actual) {
      report.issues.push({
        type: 'MISSING_TABLE',
        table: tableName,
        message: `Expected table '${tableName}' not found in database`
      });
      report.status = 'FAIL';
      continue;
    }

    const actualColumnNames = actual.columnNames;

    // Check critical columns
    for (const criticalCol of expected.criticalColumns) {
      if (!actualColumnNames.includes(criticalCol)) {
        report.issues.push({
          type: 'MISSING_CRITICAL_COLUMN',
          table: tableName,
          column: criticalCol,
          message: `Critical column '${criticalCol}' missing in table '${tableName}'`
        });
        report.status = 'FAIL';
      } else {
        report.verified.push({
          table: tableName,
          column: criticalCol,
          status: 'OK'
        });
      }
    }

    // Check for commonly confused column names
    const confusedColumns = {
      'staff_id': 'yclients_staff_id',
      'client_id': 'yclients_id',
      'service_id': 'yclients_id',
      'booking_id': 'yclients_record_id',
      'record_id': 'yclients_record_id'
    };

    for (const [wrongName, correctName] of Object.entries(confusedColumns)) {
      if (actualColumnNames.includes(wrongName) && !expected.columns.includes(wrongName)) {
        report.warnings.push({
          type: 'POTENTIALLY_CONFUSED_COLUMN',
          table: tableName,
          column: wrongName,
          suggestion: correctName,
          message: `Column '${wrongName}' exists - ensure code uses correct name (might be '${correctName}')`
        });
      }
    }
  }

  return report;
}

/**
 * Generate SQL dump file
 */
async function generateSqlDump(schema) {
  let sql = `-- Database Schema Dump
-- Generated: ${schema.timestamp}
-- Database: ${schema.database}
-- Purpose: Phase 0.5 Schema Verification for Database Code Review

`;

  for (const [tableName, tableInfo] of Object.entries(schema.tables)) {
    sql += `-- ============================================\n`;
    sql += `-- Table: ${tableName}\n`;
    sql += `-- ============================================\n\n`;

    sql += `-- Columns:\n`;
    for (const col of tableInfo.columns) {
      const nullable = col.nullable ? 'NULL' : 'NOT NULL';
      const defaultVal = col.default ? ` DEFAULT ${col.default}` : '';
      sql += `--   ${col.name.padEnd(30)} ${col.type.padEnd(20)} ${nullable}${defaultVal}\n`;
    }
    sql += `\n`;

    if (tableInfo.indexes.length > 0) {
      sql += `-- Indexes:\n`;
      for (const idx of tableInfo.indexes) {
        sql += `--   ${idx.name}\n`;
      }
      sql += `\n`;
    }
  }

  // Add column name quick reference
  sql += `\n-- ============================================\n`;
  sql += `-- QUICK REFERENCE: Column Names for Code Review\n`;
  sql += `-- ============================================\n\n`;

  const criticalTables = ['staff_schedules', 'staff', 'bookings', 'clients', 'services', 'companies'];
  for (const tableName of criticalTables) {
    const tableInfo = schema.tables[tableName];
    if (tableInfo) {
      sql += `-- ${tableName}: ${tableInfo.columnNames.join(', ')}\n`;
    }
  }

  return sql;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const shouldDump = args.includes('--dump');
  const shouldCompare = args.includes('--compare') || args.length === 0;

  console.log('');
  console.log('='.repeat(60));
  console.log('DATABASE SCHEMA VERIFICATION - Phase 0.5');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Dump schema
    logger.info('Fetching database schema...');
    const schema = await dumpSchema();

    console.log(`\nFound ${Object.keys(schema.tables).length} tables:`);
    for (const tableName of Object.keys(schema.tables).sort()) {
      const colCount = schema.tables[tableName].columns.length;
      console.log(`  - ${tableName} (${colCount} columns)`);
    }

    // Save dump if requested
    if (shouldDump) {
      const docsDir = path.join(__dirname, '..', 'docs', 'database');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      const date = new Date().toISOString().split('T')[0];
      const sqlPath = path.join(docsDir, `schema-snapshot-${date}.sql`);
      const jsonPath = path.join(docsDir, `schema-snapshot-${date}.json`);

      const sqlDump = await generateSqlDump(schema);
      fs.writeFileSync(sqlPath, sqlDump);
      fs.writeFileSync(jsonPath, JSON.stringify(schema, null, 2));

      console.log(`\n✅ Schema dump saved to:`);
      console.log(`   - ${sqlPath}`);
      console.log(`   - ${jsonPath}`);
    }

    // Compare with expected schema
    if (shouldCompare) {
      console.log('\n' + '-'.repeat(60));
      console.log('SCHEMA COMPARISON');
      console.log('-'.repeat(60));

      const report = compareSchema(schema);

      // Print verified columns
      console.log(`\n✅ VERIFIED COLUMNS (${report.verified.length}):`);
      const verifiedByTable = {};
      for (const v of report.verified) {
        if (!verifiedByTable[v.table]) verifiedByTable[v.table] = [];
        verifiedByTable[v.table].push(v.column);
      }
      for (const [table, columns] of Object.entries(verifiedByTable)) {
        console.log(`   ${table}: ${columns.join(', ')}`);
      }

      // Print warnings
      if (report.warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${report.warnings.length}):`);
        for (const w of report.warnings) {
          console.log(`   [${w.table}] ${w.message}`);
        }
      }

      // Print issues
      if (report.issues.length > 0) {
        console.log(`\n❌ ISSUES (${report.issues.length}):`);
        for (const issue of report.issues) {
          console.log(`   [${issue.type}] ${issue.message}`);
        }
      }

      // Final status
      console.log('\n' + '='.repeat(60));
      if (report.status === 'PASS') {
        console.log('✅ SCHEMA VERIFICATION: PASS');
        console.log('   All critical columns verified. Ready for Phase 1.');
      } else {
        console.log('❌ SCHEMA VERIFICATION: FAIL');
        console.log('   Fix issues before proceeding with code review.');
        Sentry.captureMessage('Schema verification failed', {
          level: 'error',
          tags: { component: 'database', operation: 'schema_verification' },
          extra: { report }
        });
      }
      console.log('='.repeat(60));

      // Save report
      if (shouldDump) {
        const reportPath = path.join(__dirname, '..', 'docs', 'database', `schema-verification-report-${new Date().toISOString().split('T')[0]}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nReport saved to: ${reportPath}`);
      }

      return report.status === 'PASS' ? 0 : 1;
    }

    return 0;

  } catch (error) {
    logger.error('Schema verification failed:', error);
    Sentry.captureException(error, {
      tags: { component: 'database', operation: 'schema_verification' }
    });
    console.error('\n❌ ERROR:', error.message);
    return 1;
  } finally {
    // Close database connection
    if (postgres.pool) {
      await postgres.pool.end();
    }
  }
}

// Run
main()
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
