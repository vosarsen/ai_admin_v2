#!/usr/bin/env node

/**
 * Read data from Google Sheets to understand the current structure
 */

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

async function readAllSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get spreadsheet metadata
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log('📊 Spreadsheet:', spreadsheet.data.properties.title);
    console.log('🔗 URL:', `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    const sheetTitles = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log('📋 Sheets found:', sheetTitles.join(', '), '\n');

    // Read data from each sheet
    for (const title of sheetTitles) {
      if (title === 'Лист1') continue; // Skip default sheet

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📄 SHEET: ${title}`);
      console.log('='.repeat(80));

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${title}!A1:Z100`, // Read first 100 rows, all columns
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('   (empty sheet)');
        continue;
      }

      // Print first 20 rows
      const displayRows = rows.slice(0, 20);
      displayRows.forEach((row, idx) => {
        const rowNum = idx + 1;
        const rowStr = row.map(cell => String(cell || '').substring(0, 30)).join(' | ');
        console.log(`   ${String(rowNum).padStart(3)}: ${rowStr}`);
      });

      if (rows.length > 20) {
        console.log(`   ... (${rows.length - 20} more rows)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Done reading sheets');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error reading sheets:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  readAllSheets();
}

module.exports = { readAllSheets };
