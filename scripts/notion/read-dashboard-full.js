#!/usr/bin/env node

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

async function readDashboard() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Dashboard!A1:H150',
  });

  const rows = response.data.values || [];

  console.log(`Dashboard has ${rows.length} rows\n`);

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const rowStr = row.map(cell => String(cell || '').substring(0, 40)).join(' | ');
    console.log(`${String(rowNum).padStart(4)}: ${rowStr}`);
  });
}

readDashboard();
