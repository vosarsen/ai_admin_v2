#!/usr/bin/env node

const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function fix() {
  console.log('🔧 Final fix for KEY INSIGHTS...\n');

  const sheets = await getSheets();

  // Use simple calculated text values instead of complex formulas
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pilot_Comparison!J52:J58',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [
        ['B дороже на 10pp (40% vs 30%)'],
        ['B маржа +0.9pp (72.8% vs 71.9%)'],
        ['+33% MRR (+150K ₽/мес)'],
        ['B лучше на +35% vs A'],
        ['+35% прибыли (+113K ₽/мес)'],
        ['+35% (+57K ₽/мес на учредителя)'],
        [''],
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Pilot_Comparison!J68',
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [['+35% (+341K ₽ за 3 мес)']],
    },
  });

  console.log('✅ KEY INSIGHTS fixed with readable values!\n');
  console.log('📊 View: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
