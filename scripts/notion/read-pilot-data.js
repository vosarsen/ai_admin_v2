#!/usr/bin/env node

/**
 * Read Pilot Program sheet data in detail
 */

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function readPilotData() {
  console.log('📊 Reading Pilot_Program sheet...\n');

  try {
    const sheets = await getSheets();

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A1:G80',
    });

    const rows = result.data.values;

    if (!rows || rows.length === 0) {
      console.log('No data found.');
      return;
    }

    // Print all rows with line numbers
    rows.forEach((row, idx) => {
      const lineNum = String(idx + 1).padStart(3, ' ');
      const cells = row.map(cell => String(cell || '').padEnd(20, ' ')).join(' | ');
      console.log(`${lineNum}: ${cells}`);
    });

    console.log('\n✅ Done reading\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

readPilotData();
