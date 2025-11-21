#!/usr/bin/env node

/**
 * Add USD columns to Scaling table:
 * 1. MRR (USD) - after MRR (₽)
 * 2. Net Profit (₽) - rename existing "Чистая прибыль"
 * 3. Net Profit (USD) - at the very end
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
 * Generate Scaling data with USD columns
 */
function getScalingWithUSD() {
  const headers = [
    'Салоны',
    'MRR (₽)',
    'MRR (USD)', // NEW - column 3
    'Rev Share (₽)',
    'LLM Cost (₽)',
    'LLM Cost (USD)',
    'Эквайринг (₽)',
    'Variable costs',
    'Инфраструктура',
    'Fixed Costs',
    'Прибыль до налога',
    'Налог (1%)',
    'Маржа',
    'Прибыль/салон',
    'Прибыль/учредитель',
    'Net Profit (₽)', // NEW - moved to end
    'Net Profit (USD)', // NEW - very last column
  ];

  // 13 scenarios: 1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000
  const scenarios = [1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

  const dataRows = scenarios.map((salons, idx) => {
    const rowNum = idx + 2; // Starting from row 2 (after header)

    return [
      salons,
      `=A${rowNum}*Parameters!B5`, // MRR (RUB)
      `=B${rowNum}/Parameters!B10`, // MRR (USD) = MRR (RUB) / exchange rate
      `=B${rowNum}*0,2`, // Rev Share (20%)
      `=A${rowNum}*LLM_Models!D3`, // LLM Cost (RUB)
      `=E${rowNum}/Parameters!B10`, // LLM Cost (USD)
      `=B${rowNum}*0,033`, // Эквайринг
      `=D${rowNum}+E${rowNum}+G${rowNum}`, // Variable costs
      // Infrastructure tiering
      `=IF(A${rowNum}<=5;Infrastructure!E2;IF(A${rowNum}<=15;Infrastructure!E3;IF(A${rowNum}<=50;Infrastructure!E4;IF(A${rowNum}<=100;Infrastructure!E5;IF(A${rowNum}<=500;50000;IF(A${rowNum}<=1000;100000;IF(A${rowNum}<=5000;300000;500000)))))))`,
      `=I${rowNum}`, // Fixed = Infrastructure
      `=B${rowNum}-H${rowNum}-J${rowNum}`, // Profit before tax
      `=K${rowNum}*0,01`, // Tax (1%)
      `=P${rowNum}/B${rowNum}`, // Margin % (references Net Profit column)
      `=P${rowNum}/A${rowNum}`, // Profit per salon
      `=P${rowNum}/2`, // Profit per founder (2 founders)
      `=K${rowNum}-L${rowNum}`, // Net Profit (RUB) = Profit before tax - Tax
      `=P${rowNum}/Parameters!B10`, // Net Profit (USD) = Net Profit (RUB) / exchange rate
    ];
  });

  return [headers, ...dataRows];
}

async function updateScaling() {
  console.log('🚀 Adding USD columns to Scaling table...\n');

  try {
    const sheets = await getSheets();

    console.log('📊 Updating Scaling table structure:');
    console.log('   - Adding MRR (USD) after MRR (₽)');
    console.log('   - Moving Net Profit (₽) to end');
    console.log('   - Adding Net Profit (USD) as last column\n');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Scaling!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: getScalingWithUSD(),
      },
    });

    console.log('   ✅ Scaling updated with USD columns\n');

    console.log('🎉 SUCCESS! Scaling table updated!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📋 New column structure:');
    console.log('   1. Салоны');
    console.log('   2. MRR (₽)');
    console.log('   3. MRR (USD) ← NEW');
    console.log('   4. Rev Share (₽)');
    console.log('   5. LLM Cost (₽)');
    console.log('   6. LLM Cost (USD)');
    console.log('   7. Эквайринг (₽)');
    console.log('   8. Variable costs');
    console.log('   9. Инфраструктура');
    console.log('   10. Fixed Costs');
    console.log('   11. Прибыль до налога');
    console.log('   12. Налог (1%)');
    console.log('   13. Маржа');
    console.log('   14. Прибыль/салон');
    console.log('   15. Прибыль/учредитель');
    console.log('   16. Net Profit (₽) ← Moved to end');
    console.log('   17. Net Profit (USD) ← NEW (last column)');
    console.log('');

    console.log('💡 Key metrics @ 10,000 salons:');
    console.log('   - MRR: 500M₽ (~$6.24M USD)');
    console.log('   - LLM Cost: ~$45.9K USD/month');
    console.log('   - Net Profit: ~375M₽ (~$4.69M USD/month)');
    console.log('   - Per founder: ~$2.34M USD/month 💰');
    console.log('');

  } catch (error) {
    console.error('❌ Error updating Scaling table:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  updateScaling();
}

module.exports = { updateScaling };
