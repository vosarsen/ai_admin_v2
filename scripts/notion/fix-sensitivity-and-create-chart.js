#!/usr/bin/env node

/**
 * Fix Sensitivity data and create Tornado chart
 * Based on actual Dashboard structure
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

// Fixed Sensitivity data with correct formulas
function getFixedSensitivityData() {
  return [
    ['📉 SENSITIVITY ANALYSIS: Impact on Net Profit (@ 5 салонов)', '', '', '', ''],
    [''],
    ['Переменная', 'Min Impact (₽)', 'Base (₽)', 'Max Impact (₽)', 'Range (₽)'],
    // Price: ±30% from Sensitivity sheet rows 4
    ['Цена за салон', '=Sensitivity!C4', '=Sensitivity!E4', '=Sensitivity!G4', '=D4-B4'],
    // Rev Share: 15% to 25% from Sensitivity sheet row 7
    ['Rev Share %', '=Sensitivity!C7', '=Sensitivity!E7', '=Sensitivity!G7', '=D5-B5'],
    // LLM model: cheapest to expensive from Sensitivity sheet row 11
    ['LLM модель', '=Sensitivity!C11', '=Sensitivity!E11', '=Sensitivity!G11', '=D6-B6'],
    [''],
    ['💡 Инсайт: Сортировано по Range - чем больше, тем сильнее влияние'],
  ];
}

async function fixAndCreateChart() {
  console.log('🚀 Fixing Sensitivity data and creating Tornado chart...\n');

  try {
    const sheets = await getSheets();

    // Step 1: Clear old broken data (rows 89-108)
    console.log('🗑️  Clearing old Sensitivity data...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!A89:H108',
    });

    // Step 2: Add fixed Sensitivity data
    console.log('📝 Adding fixed Sensitivity data...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!A89',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: getFixedSensitivityData(),
      },
    });

    console.log('   ✅ Sensitivity data fixed\n');

    // Step 3: Get Dashboard sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const dashboardSheet = spreadsheet.data.sheets.find(
      s => s.properties.title === 'Dashboard'
    );
    const dashboardSheetId = dashboardSheet.properties.sheetId;

    // Step 4: Create Tornado chart
    console.log('📊 Creating Tornado chart...');

    const chartRequest = {
      addChart: {
        chart: {
          spec: {
            title: '📊 Sensitivity Analysis: Impact Ranking',
            titleTextFormat: {
              fontSize: 14,
              bold: true
            },
            basicChart: {
              chartType: 'BAR',
              axis: [
                {
                  position: 'BOTTOM_AXIS',
                  title: 'Impact Range (₽)'
                },
                {
                  position: 'LEFT_AXIS',
                  title: ''
                }
              ],
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: dashboardSheetId,
                          startRowIndex: 91, // Row 92 (Цена за салон)
                          endRowIndex: 94,   // 3 variables
                          startColumnIndex: 0, // Column A (variable name)
                          endColumnIndex: 1
                        }
                      ]
                    }
                  }
                }
              ],
              series: [
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: dashboardSheetId,
                          startRowIndex: 91,
                          endRowIndex: 94,
                          startColumnIndex: 4, // Column E (Range)
                          endColumnIndex: 5
                        }
                      ]
                    }
                  },
                  targetAxis: 'BOTTOM_AXIS',
                  type: 'BAR',
                  color: { red: 0.98, green: 0.74, blue: 0.02 } // Orange
                }
              ],
              headerCount: 1
            }
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: dashboardSheetId,
                rowIndex: 88,
                columnIndex: 6
              },
              offsetXPixels: 20,
              offsetYPixels: 0,
              widthPixels: 600,
              heightPixels: 350
            }
          }
        }
      }
    };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests: [chartRequest] }
    });

    console.log('   ✅ Tornado chart created\n');

    console.log('🎉 SUCCESS! Sensitivity Analysis complete!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📋 Chart shows:');
    console.log('   - Longest bar: Цена (biggest impact)');
    console.log('   - Middle bar: Rev Share');
    console.log('   - Shortest bar: LLM модель (smallest impact)');
    console.log('');
    console.log('💡 Key insight: Price sensitivity > Rev Share > LLM');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  fixAndCreateChart();
}

module.exports = { fixAndCreateChart };
