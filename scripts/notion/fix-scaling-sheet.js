#!/usr/bin/env node

/**
 * Fix Scaling sheet - correct formulas for proper profit calculation
 *
 * Current issues:
 * 1. LLM Cost column shows wrong values (₽ vs $)
 * 2. Net Profit is way too low (should be ~74% margin, not 0.4%)
 * 3. Duplicate Fixed Costs columns
 * 4. Empty rows with #DIV/0! errors
 *
 * Correct structure:
 * A: Салоны
 * B: MRR (₽)
 * C: MRR (USD)
 * D: Rev Share (₽)
 * E: LLM Cost (₽)
 * F: LLM Cost (USD)
 * G: Эквайринг (₽)
 * H: Variable Costs (total)
 * I: Infrastructure (₽)
 * J: Profit Before Tax
 * K: Tax (1%)
 * L: Net Profit (₽)
 * M: Net Profit (USD)
 * N: Margin %
 * O: Profit per Salon
 * P: Profit per Founder
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

/**
 * Generate corrected Scaling data with proper formulas
 */
function getCorrectedScalingData() {
  const headers = [
    'Салоны',
    'MRR (₽)',
    'MRR (USD)',
    'Rev Share (₽)',
    'LLM Cost (₽)',
    'LLM Cost (USD)',
    'Эквайринг (₽)',
    'Variable Costs',
    'Infrastructure (₽)',
    'Profit Before Tax',
    'Tax (1%)',
    'Net Profit (₽)',
    'Net Profit (USD)',
    'Margin %',
    'Profit/Salon',
    'Profit/Founder'
  ];

  // Scenarios: 1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000
  const scenarios = [1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

  const dataRows = scenarios.map((salons, idx) => {
    const r = idx + 2; // Row number (starts from 2 after header)

    return [
      salons,
      // B: MRR (₽) = Салоны × Цена
      `=A${r}*Parameters!$B$5`,
      // C: MRR (USD) = MRR / курс
      `=B${r}/Parameters!$B$10`,
      // D: Rev Share (₽) = MRR × 20% (use comma for Russian locale)
      `=B${r}*0,2`,
      // E: LLM Cost (₽) = Салоны × стоимость модели (из LLM_Models D3 = Gemini 2.5 Flash-Lite)
      `=A${r}*LLM_Models!$D$3`,
      // F: LLM Cost (USD) = LLM Cost ₽ / курс
      `=E${r}/Parameters!$B$10`,
      // G: Эквайринг (₽) = MRR × 3.3% (use comma for Russian locale)
      `=B${r}*0,033`,
      // H: Variable Costs = Rev Share + LLM + Эквайринг
      `=D${r}+E${r}+G${r}`,
      // I: Infrastructure - tiered based on salon count (use ; for Russian locale)
      `=IF(A${r}<=5;Infrastructure!$E$2;IF(A${r}<=15;Infrastructure!$E$3;IF(A${r}<=50;Infrastructure!$E$4;IF(A${r}<=100;Infrastructure!$E$5;IF(A${r}<=500;50000;IF(A${r}<=1000;100000;IF(A${r}<=5000;300000;500000)))))))`,
      // J: Profit Before Tax = MRR - Variable Costs - Infrastructure
      `=B${r}-H${r}-I${r}`,
      // K: Tax (1%) = Profit Before Tax × 1% (use comma for Russian locale)
      `=J${r}*0,01`,
      // L: Net Profit (₽) = Profit Before Tax - Tax
      `=J${r}-K${r}`,
      // M: Net Profit (USD) = Net Profit ₽ / курс
      `=L${r}/Parameters!$B$10`,
      // N: Margin % = Net Profit / MRR
      `=L${r}/B${r}`,
      // O: Profit per Salon = Net Profit / Салоны
      `=L${r}/A${r}`,
      // P: Profit per Founder = Net Profit / 2
      `=L${r}/Parameters!$B$7`
    ];
  });

  return [headers, ...dataRows];
}

async function fixScalingSheet() {
  console.log('🔧 Fixing Scaling sheet...\n');

  try {
    const sheets = await getSheets();

    // First, clear the entire Scaling sheet to remove old data
    console.log('   Clearing old data...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Scaling!A:Z',
    });

    // Write corrected data
    console.log('   Writing corrected formulas...');
    const scalingData = getCorrectedScalingData();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Scaling!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: scalingData,
      },
    });

    console.log(`   ✅ Scaling sheet fixed (${scalingData.length} rows)\n`);

    // Read back to verify
    console.log('📊 Verifying results...\n');
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Scaling!A1:P14',
    });

    const rows = result.data.values;
    console.log('   Headers:', rows[0].slice(0, 8).join(' | '));
    console.log('   ─'.repeat(50));

    // Show first few scenarios
    for (let i = 1; i <= 4; i++) {
      if (rows[i]) {
        const salons = rows[i][0];
        const mrr = rows[i][1];
        const netProfit = rows[i][11];
        const margin = rows[i][13];
        console.log(`   ${salons} salons: MRR=${mrr}, Net Profit=${netProfit}, Margin=${margin}`);
      }
    }

    console.log('\n🎉 SUCCESS! Scaling sheet fixed!\n');
    console.log('📊 View: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID + '/edit#gid=1837193220\n');

    console.log('📋 Expected values at 5 salons:');
    console.log('   MRR: 250,000₽');
    console.log('   Variable Costs: ~60,085₽ (Rev Share 50K + LLM 1.8K + Эквайринг 8.25K)');
    console.log('   Infrastructure: 1,110₽');
    console.log('   Net Profit: ~186,000₽');
    console.log('   Margin: ~74%');

  } catch (error) {
    console.error('❌ Error fixing sheet:', error.message);
    if (error.response) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  fixScalingSheet();
}

module.exports = { fixScalingSheet };
