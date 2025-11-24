#!/usr/bin/env node

/**
 * Debug #ERROR! issues in Pilot_Program sheet
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

async function debugErrors() {
  console.log('🔍 Debugging #ERROR! issues...\n');

  try {
    const sheets = await getSheets();

    // Get cell formulas (not calculated values)
    const result = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ['Pilot_Program!A1:G80'],
      includeGridData: true,
    });

    const sheet = result.data.sheets[0];
    const rows = sheet.data[0].rowData;

    console.log('Analyzing cells with issues:\n');

    rows.forEach((row, rowIdx) => {
      if (!row.values) return;

      row.values.forEach((cell, colIdx) => {
        const cellValue = cell.effectiveValue;
        const formula = cell.userEnteredValue?.formulaValue;
        const formattedValue = cell.formattedValue;

        // Check for errors or interesting formulas
        if (formattedValue?.includes('#ERROR') || formattedValue?.includes('#DIV/0') ||
            (formula && (colIdx === 1 || colIdx === 6))) { // Column B (1) and G (6)

          const cellAddress = `${String.fromCharCode(65 + colIdx)}${rowIdx + 1}`;
          console.log(`📍 Cell ${cellAddress} (Row ${rowIdx + 1}):`);
          console.log(`   Formula: ${formula || 'N/A'}`);
          console.log(`   Formatted: ${formattedValue}`);
          console.log(`   Error: ${cell.effectiveValue?.errorValue?.type || 'N/A'}`);
          console.log('');
        }
      });
    });

    console.log('\n✅ Analysis complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugErrors();
