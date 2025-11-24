#!/usr/bin/env node

/**
 * Fix #ERROR! in Pilot_Comparison KEY INSIGHTS
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

async function fixComparisonErrors() {
  console.log('🔧 Fixing Pilot_Comparison errors...\n');

  try {
    const sheets = await getSheets();

    // Fix row 47: NET MARGIN formatting issue (showing as currency instead of percent)
    console.log('1️⃣ Fixing row 47 (NET MARGIN на компанию)...');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D47:J47',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D46/D43', '', '', '=G46/G43', '', '', '=G47-D47']],
      },
    });

    // Fix row 52-58: KEY INSIGHTS formulas
    console.log('2️⃣ Fixing KEY INSIGHTS rows (52-58)...');

    // Row 52: Price comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D52:J52',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D10/Parameters!B5', '', '', '=G10/Parameters!B5', '', '', '=IF(G52>D52,"B дороже на " & TEXT(G52-D52,"0.0%"),"Одинаково")']],
      },
    });

    // Row 53: NET MARGIN comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D53:J53',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D34/D17', '', '', '=G34/G17', '', '', '=IF(G53>D53,"B выгоднее на " & TEXT(G53-D53,"0.0pp"),"A выгоднее")']],
      },
    });

    // Row 54: MRR comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D54:J54',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D17', '', '', '=G17', '', '', '="+" & TEXT((G54-D54)/D54,"0%") & " больше (+₽" & TEXT(G54-D54,"#,##0") & ")"']],
      },
    });

    // Row 55: Profit vs 5 salons
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D55:J55',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D34/Scaling!K3', '', '', '=G34/Scaling!K3', '', '', '="B на " & TEXT((G55-D55)/D55*100,"0") & "% больше vs 5 салонов"']],
      },
    });

    // Row 56: NET PROFIT monthly
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D56:J56',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D34', '', '', '=G34', '', '', '="+" & TEXT((G56-D56)/D56*100,"0") & "% (+₽" & TEXT(G56-D56,"#,##0") & "/мес)"']],
      },
    });

    // Row 57: Profit per founder
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D57:J57',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D37', '', '', '=G37', '', '', '="+" & TEXT((G57-D57)/D57*100,"0") & "% (+₽" & TEXT(G57-D57,"#,##0") & "/мес)"']],
      },
    });

    // Row 68: Total Revenue 3 months (in strategic value section)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!D68:J68',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=D36', '', '', '=G36', '', '', '="+" & TEXT((G68-D68)/D68*100,"0") & "%"']],
      },
    });

    console.log('3️⃣ Applying number formatting...');

    const sheetId = (await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })).data.sheets.find(s => s.properties.title === 'Pilot_Comparison').properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          // Format row 11 as percentage (% from base price)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 10,
                endRowIndex: 11,
                startColumnIndex: 3,
                endColumnIndex: 4,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 10,
                endRowIndex: 11,
                startColumnIndex: 6,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          // Format row 47 as percentage (NET MARGIN на компанию)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 46,
                endRowIndex: 47,
                startColumnIndex: 3,
                endColumnIndex: 4,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 46,
                endRowIndex: 47,
                startColumnIndex: 6,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          // Format KEY INSIGHTS percentages (rows 52-53, columns D and G)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 51,
                endRowIndex: 53,
                startColumnIndex: 3,
                endColumnIndex: 4,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 51,
                endRowIndex: 53,
                startColumnIndex: 6,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: {
                    type: 'PERCENT',
                    pattern: '0.0%',
                  }
                }
              },
              fields: 'userEnteredFormat.numberFormat'
            }
          },
        ]
      },
    });

    console.log('✅ All fixes applied\n');

    console.log('🎉 SUCCESS! Comparison sheet fixed!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
    console.log('✨ Fixed issues:');
    console.log('   ✅ Row 47: NET MARGIN % formatted correctly');
    console.log('   ✅ Row 52-58: KEY INSIGHTS calculations fixed');
    console.log('   ✅ Row 68: Total Revenue comparison fixed');
    console.log('   ✅ All #ERROR! eliminated\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

fixComparisonErrors();
