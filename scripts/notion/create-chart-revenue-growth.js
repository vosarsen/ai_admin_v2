#!/usr/bin/env node

/**
 * Create Revenue Growth chart via Google Sheets API
 *
 * This is a proof of concept - creating charts via API is complex
 * but doable. If this works well, we'll create the remaining charts.
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

async function createRevenueGrowthChart() {
  console.log('🚀 Creating Revenue Growth chart via API...\n');

  try {
    const sheets = await getSheets();

    // First, get spreadsheet metadata to find Dashboard sheet ID
    console.log('📊 Getting spreadsheet metadata...');
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const dashboardSheet = spreadsheet.data.sheets.find(
      s => s.properties.title === 'Dashboard'
    );

    if (!dashboardSheet) {
      throw new Error('Dashboard sheet not found! Run create-dashboard.js first.');
    }

    const dashboardSheetId = dashboardSheet.properties.sheetId;
    console.log(`   ✅ Dashboard sheet ID: ${dashboardSheetId}\n`);

    // Create the chart
    console.log('📈 Creating Line Chart: Revenue Growth...');
    console.log('   Chart data: Rows 28-40 (13 scenarios)');
    console.log('   Series: MRR (USD), Net Profit (USD), LLM Cost (USD)\n');

    const chartRequest = {
      addChart: {
        chart: {
          spec: {
            title: '📈 Revenue Growth: MRR, Net Profit & LLM Cost (USD)',
            titleTextFormat: {
              fontSize: 14,
              bold: true
            },
            basicChart: {
              chartType: 'LINE',
              legendPosition: 'RIGHT_LEGEND',
              axis: [
                {
                  position: 'BOTTOM_AXIS',
                  title: 'Количество салонов'
                },
                {
                  position: 'LEFT_AXIS',
                  title: 'USD'
                }
              ],
              domains: [
                {
                  domain: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: dashboardSheetId,
                          startRowIndex: 28, // Row 29 (0-indexed)
                          endRowIndex: 41,   // Row 41 (13 data points)
                          startColumnIndex: 0, // Column A (Салонов)
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
                          startRowIndex: 28,
                          endRowIndex: 41,
                          startColumnIndex: 1, // Column B (MRR USD)
                          endColumnIndex: 2
                        }
                      ]
                    }
                  },
                  targetAxis: 'LEFT_AXIS',
                  type: 'LINE',
                  lineStyle: {
                    width: 3
                  },
                  color: {
                    red: 0.26,
                    green: 0.56,
                    blue: 0.95
                  }
                },
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: dashboardSheetId,
                          startRowIndex: 28,
                          endRowIndex: 41,
                          startColumnIndex: 2, // Column C (Net Profit USD)
                          endColumnIndex: 3
                        }
                      ]
                    }
                  },
                  targetAxis: 'LEFT_AXIS',
                  type: 'LINE',
                  lineStyle: {
                    width: 3
                  },
                  color: {
                    red: 0.22,
                    green: 0.73,
                    blue: 0.39
                  }
                },
                {
                  series: {
                    sourceRange: {
                      sources: [
                        {
                          sheetId: dashboardSheetId,
                          startRowIndex: 28,
                          endRowIndex: 41,
                          startColumnIndex: 3, // Column D (LLM Cost USD)
                          endColumnIndex: 4
                        }
                      ]
                    }
                  },
                  targetAxis: 'LEFT_AXIS',
                  type: 'LINE',
                  lineStyle: {
                    width: 2,
                    type: 'LONG_DASHED'
                  },
                  color: {
                    red: 0.95,
                    green: 0.53,
                    blue: 0.22
                  }
                }
              ],
              headerCount: 1,
              interpolateNulls: false
            }
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: dashboardSheetId,
                rowIndex: 26, // Place chart at row 27
                columnIndex: 5  // Column F (next to data)
              },
              offsetXPixels: 20,
              offsetYPixels: 0,
              widthPixels: 700,
              heightPixels: 400
            }
          }
        }
      }
    };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [chartRequest]
      }
    });

    console.log('   ✅ Chart created successfully!\n');

    console.log('🎉 SUCCESS! Revenue Growth chart added to Dashboard!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📈 Chart details:');
    console.log('   - Type: Line chart');
    console.log('   - Location: Dashboard sheet, next to data table (row 27, column F)');
    console.log('   - Series:');
    console.log('     • MRR (USD) - Blue line (thick)');
    console.log('     • Net Profit (USD) - Green line (thick)');
    console.log('     • LLM Cost (USD) - Orange dashed line');
    console.log('   - X-axis: Number of salons (1 to 10,000)');
    console.log('   - Y-axis: USD (formatted with $ and commas)');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Open the Dashboard sheet');
    console.log('   2. Review the chart');
    console.log('   3. If it looks good, I can create the remaining 4 charts!');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating chart:', error.message);
    if (error.response) {
      console.error('API Error details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  createRevenueGrowthChart();
}

module.exports = { createRevenueGrowthChart };
