#!/usr/bin/env node

/**
 * Add Sensitivity Analysis data to Dashboard
 * For Tornado diagram showing impact ranking
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

function getSensitivityTornadoData() {
  return [
    ['📉 ДАННЫЕ ДЛЯ ГРАФИКА: Sensitivity Analysis (Tornado @ 5 салонов)', '', '', '', '', '', ''],
    ['→ Создайте Horizontal Bar Chart: Impact Range'],
    [''],
    ['Переменная', 'Min Impact (₽)', 'Base (₽)', 'Max Impact (₽)', 'Range (₽)', 'Description'],
    // Price sensitivity: ±30% = biggest impact
    ['Цена за салон', '=Sensitivity!C4', '=Sensitivity!E4', '=Sensitivity!G4', '=E92-C92', '±30% price change'],
    // Rev Share: 15-25% range (from 20% base)
    ['Rev Share %', '=Sensitivity!G7', '=Sensitivity!E7', '=Sensitivity!C7', '=E93-C93', '15% to 25% range'],
    // LLM model: cheapest to most expensive
    ['LLM модель', '=Sensitivity!G11', '=Sensitivity!E11', '=Sensitivity!C11', '=E94-C94', 'Flash-Lite to Haiku 3.5'],
    [''],
    ['💡 Инсайт: Цена влияет больше всего, LLM - меньше всего'],
    [''],
  ];
}

async function addSensitivityData() {
  console.log('🚀 Adding Sensitivity Analysis data to Dashboard...\n');

  try {
    const sheets = await getSheets();

    // Add sensitivity data after existing content (around row 85)
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!A85',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: getSensitivityTornadoData(),
      },
    });

    console.log('   ✅ Sensitivity data added to Dashboard\n');

    console.log('🎉 SUCCESS! Data ready for Tornado chart!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📋 Next step: Create Tornado chart manually');
    console.log('   1. Go to Dashboard sheet');
    console.log('   2. Find "📉 ДАННЫЕ ДЛЯ ГРАФИКА: Sensitivity Analysis"');
    console.log('   3. Select data table (rows with Цена, Rev Share, LLM)');
    console.log('   4. Insert → Chart → Bar chart (horizontal)');
    console.log('   5. X-axis: Range (₽) - Column E');
    console.log('   6. Y-axis: Переменная - Column A');
    console.log('');
    console.log('💡 Chart will show: Price has biggest impact, LLM smallest');
    console.log('');

  } catch (error) {
    console.error('❌ Error adding sensitivity data:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  addSensitivityData();
}

module.exports = { addSensitivityData };
