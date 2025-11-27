#!/usr/bin/env node
/**
 * Generate Demo Schedules Script
 * Date: 2025-11-27
 * Purpose: Generate 30-day static schedules for demo company (ID 999999)
 */

const postgres = require('../src/database/postgres');

async function generateDemoSchedules() {
  const schedules = [];
  const today = new Date();
  const DEMO_COMPANY_ID = 999999;

  console.log('📅 Generating demo schedules for 30 days...');
  console.log(`Starting from: ${today.toISOString().split('T')[0]}`);

  for (let day = 0; day < 30; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];

    const isSunday = date.getDay() === 0;
    // Every other Sunday is off (day % 14 === 0)
    const workingSunday = day % 14 !== 0;

    for (const staffId of [1, 2, 3]) {
      if (isSunday && !workingSunday) {
        // Day off
        schedules.push({
          company_id: DEMO_COMPANY_ID,
          staff_yclients_id: staffId,
          date: dateStr,
          is_working: false,
          is_day_off: true,
          start_time: null,
          end_time: null
        });
      } else {
        // Working day
        // Анна (staff 1) starts at 10:00, others at 11:00
        const startTime = staffId === 1 ? '10:00' : '11:00';
        const endTime = '20:00';

        schedules.push({
          company_id: DEMO_COMPANY_ID,
          staff_yclients_id: staffId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_working: true,
          is_day_off: false
        });
      }
    }
  }

  console.log(`✅ Generated ${schedules.length} schedule records`);
  console.log('📝 Inserting into database...');

  // Bulk insert with ON CONFLICT handling
  let inserted = 0;
  let updated = 0;

  for (const schedule of schedules) {
    try {
      const result = await postgres.query(
        `INSERT INTO staff_schedules
         (company_id, staff_yclients_id, date, start_time, end_time, is_working, is_day_off, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (company_id, staff_yclients_id, date)
         DO UPDATE SET
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           is_working = EXCLUDED.is_working,
           is_day_off = EXCLUDED.is_day_off,
           updated_at = NOW()`,
        [
          schedule.company_id,
          schedule.staff_yclients_id,
          schedule.date,
          schedule.start_time,
          schedule.end_time,
          schedule.is_working,
          schedule.is_day_off
        ]
      );

      if (result.rowCount === 1) {
        inserted++;
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`❌ Error inserting schedule for staff ${schedule.staff_yclients_id} on ${schedule.date}:`, error.message);
    }
  }

  console.log(`✅ Inserted: ${inserted} new records`);
  if (updated > 0) {
    console.log(`🔄 Updated: ${updated} existing records`);
  }

  // Verify
  console.log('\n📊 Verification:');
  const verification = await postgres.query(
    `SELECT
       staff_yclients_id,
       COUNT(*) as total_days,
       SUM(CASE WHEN is_working THEN 1 ELSE 0 END) as working_days,
       SUM(CASE WHEN is_day_off THEN 1 ELSE 0 END) as days_off
     FROM staff_schedules
     WHERE company_id = $1
     GROUP BY staff_yclients_id
     ORDER BY staff_yclients_id`,
    [DEMO_COMPANY_ID]
  );

  console.table(verification.rows);

  console.log('\n✅ Demo schedules generation complete!');
  process.exit(0);
}

// Run script
generateDemoSchedules().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
