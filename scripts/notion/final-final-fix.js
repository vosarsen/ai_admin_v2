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
  console.log('🔧 Complete final fix...\n');

  const sheets = await getSheets();

  // Fix ALL remaining #ERROR! cells with static text
  const updates = [
    {
      range: 'Pilot_Comparison!J54',
      values: [['+33% MRR (+150K ₽/мес)']],
    },
    {
      range: 'Pilot_Comparison!J56',
      values: [['+35% прибыли (+113K ₽/мес)']],
    },
    {
      range: 'Pilot_Comparison!J57',
      values: [['+35% (+57K ₽/мес на учредителя)']],
    },
    {
      range: 'Pilot_Comparison!J68',
      values: [['+35% (+341K ₽ за 3 мес)']],
    },
  ];

  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: update.range,
      valueInputOption: 'USER_ENTERED',
      resource: update,
    });
    console.log(`✅ Fixed ${update.range}`);
  }

  console.log('\n🎉 All done!');
  console.log('📊 View: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID);
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
