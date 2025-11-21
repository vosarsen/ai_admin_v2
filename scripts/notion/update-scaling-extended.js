#!/usr/bin/env node

/**
 * Update Scaling table with:
 * 1. LLM Cost in USD column (for card balance planning)
 * 2. Extended scenarios up to 10,000 salons
 * 3. Update Sensitivity with realistic Rev Share range (15-20%)
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
 * Generate extended Scaling scenarios (1 to 10,000 salons)
 */
function getExtendedScalingData() {
  const headers = [
    'Салоны',
    'MRR (₽)',
    'Rev Share (₽)',
    'LLM Cost (₽)',
    'LLM Cost (USD)', // NEW COLUMN
    'Эквайринг (₽)',
    'Variable costs',
    'Инфраструктура',
    'Fixed Costs',
    'Прибыль до налога',
    'Налог (1%)',
    'Чистая прибыль',
    'Маржа',
    'Прибыль/салон',
    'Прибыль/учредитель'
  ];

  // Extended scenarios: 1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000
  const scenarios = [1, 5, 10, 15, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

  const dataRows = scenarios.map((salons, idx) => {
    const rowNum = idx + 2; // Starting from row 2 (after header)

    return [
      salons,
      `=A${rowNum}*Parameters!B5`, // MRR
      `=B${rowNum}*0,2`, // Rev Share (20%)
      `=A${rowNum}*LLM_Models!D3`, // LLM Cost (RUB)
      `=D${rowNum}/Parameters!B10`, // LLM Cost (USD) = RUB cost / exchange rate
      `=B${rowNum}*0,033`, // Эквайринг
      `=C${rowNum}+D${rowNum}+F${rowNum}`, // Variable costs
      // Infrastructure tiering (updated for larger scale)
      `=IF(A${rowNum}<=5;Infrastructure!E2;IF(A${rowNum}<=15;Infrastructure!E3;IF(A${rowNum}<=50;Infrastructure!E4;IF(A${rowNum}<=100;Infrastructure!E5;IF(A${rowNum}<=500;50000;IF(A${rowNum}<=1000;100000;IF(A${rowNum}<=5000;300000;500000)))))))`,
      `=H${rowNum}`, // Fixed = Infrastructure
      `=B${rowNum}-G${rowNum}-I${rowNum}`, // Profit before tax
      `=J${rowNum}*0,01`, // Tax (1%)
      `=J${rowNum}-K${rowNum}`, // Net profit
      `=L${rowNum}/B${rowNum}`, // Margin %
      `=L${rowNum}/A${rowNum}`, // Profit per salon
      `=L${rowNum}/2`, // Profit per founder (2 founders)
    ];
  });

  return [headers, ...dataRows];
}

/**
 * Generate updated Sensitivity analysis
 * Rev Share range: 15-20% (realistic negotiation with YClients)
 */
function getUpdatedSensitivityData() {
  return [
    ['Переменная', 'Базовое значение', '-30%', '-15%', 'База', '+15%', '+30%', 'Диапазон влияния'],
    ['', '', '', '', '', '', '', ''],
    ['Цена за салон (₽)', 50000, 35000, 42500, 50000, 57500, 65000, 'Влияние на чистую прибыль'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!L3', '=(C3/E3)*Scaling!B3*0,738', '=(D3/E3)*Scaling!B3*0,738', '=Scaling!L3', '=(F3/E3)*Scaling!B3*0,738', '=(G3/E3)*Scaling!B3*0,738', 'Диапазон прибыли'],
    ['', '', '', '', '', '', '', ''],
    ['Rev Share % (диапазон 15-20%)', '20%', '15%', '17%', '20%', '22%', '25%', 'Влияние на чистую прибыль (переговоры с YClients)'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!L3', '=Scaling!L3+(Scaling!B3*(0,20-0,15))', '=Scaling!L3+(Scaling!B3*(0,20-0,17))', '=Scaling!L3', '=Scaling!L3-(Scaling!B3*(0,22-0,20))', '=Scaling!L3-(Scaling!B3*(0,25-0,20))', 'Диапазон прибыли'],
    ['', '', '', '', '', '', '', ''],
    ['LLM модель (выбрать)', 'Flash-Lite', '2.0 Lite', '2.5 Lite', '2.5 Lite', '2.5 Flash', 'Haiku 3.5', 'Влияние на чистую прибыль'],
    ['Стоимость модели (₽)', 459, 344, 459, 459, 1845, 3960, 'Стоимость на салон'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!L3', '=Scaling!L3+(5*(459-344))', '=Scaling!L3', '=Scaling!L3', '=Scaling!L3-(5*(1845-459))', '=Scaling!L3-(5*(3960-459))', 'Диапазон прибыли'],
  ];
}

async function updateTables() {
  console.log('🚀 Updating Scaling and Sensitivity tables...\n');

  try {
    const sheets = await getSheets();

    // Update Scaling table
    console.log('📊 Updating Scaling table...');
    console.log('   - Adding LLM Cost (USD) column');
    console.log('   - Extending to 10,000 salons (13 scenarios)');
    console.log('   - Adding infrastructure tiers for large scale\n');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Scaling!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: getExtendedScalingData(),
      },
    });

    console.log('   ✅ Scaling updated (13 rows + header)\n');

    // Update Sensitivity table
    console.log('📈 Updating Sensitivity table...');
    console.log('   - Rev Share range: 15-20% (realistic negotiation)');
    console.log('   - Note: 20% is maximum, target 15% after 6 months\n');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sensitivity!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: getUpdatedSensitivityData(),
      },
    });

    console.log('   ✅ Sensitivity updated\n');

    console.log('🎉 SUCCESS! Tables updated!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📋 What was updated:');
    console.log('   1. Scaling table:');
    console.log('      - New column: LLM Cost (USD) - for card balance planning');
    console.log('      - Extended scenarios: 1, 5, 10, 15, 20, 50, 100, 200, 500, 1K, 2K, 5K, 10K salons');
    console.log('      - Infrastructure scaling up to 500K₽/month for 10K salons');
    console.log('');
    console.log('   2. Sensitivity table:');
    console.log('      - Rev Share range: 15-20% (current max: 20%)');
    console.log('      - Expected negotiation: 15% after 6 months growth');
    console.log('      - Impact: +12.5K₽ profit per 5 salons (20% → 15%)');
    console.log('');
    console.log('💡 Key insights:');
    console.log('   - @ 10,000 salons:');
    console.log('     - MRR: 500M₽ (~$6.2M)');
    console.log('     - LLM Cost: ~$45K/month (need to plan card balance)');
    console.log('     - Infrastructure: ~500K₽/month (enterprise scale)');
    console.log('     - Expected net profit: ~373M₽/month (74.6% margin)');
    console.log('     - Per founder: ~186M₽/month 💰');
    console.log('');

  } catch (error) {
    console.error('❌ Error updating tables:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  updateTables();
}

module.exports = { updateTables };
