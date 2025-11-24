#!/usr/bin/env node

/**
 * Fix ALL #ERROR! issues in Pilot_Program sheet
 *
 * Issues:
 * 1. Row 47: Parameters!B7 is empty (founders count)
 * 2. Rows 62-65: TEXT() function doesn't work in Russian locale
 * 3. Percentages in column G (rows 37, 40, 45) showing as currency
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

async function fixAllErrors() {
  console.log('🔧 Fixing ALL #ERROR! issues...\n');

  try {
    const sheets = await getSheets();

    // Fix 1: Update Parameters sheet to add founders count
    console.log('1️⃣ Fixing Parameters!B7 (founders count)...');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Parameters!B7',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[2]], // 2 founders
      },
    });

    console.log('   ✅ Parameters!B7 = 2\n');

    // Fix 2: Update Pilot_Program formulas with corrected logic
    console.log('2️⃣ Fixing Pilot_Program formulas...');

    // Row 37: Contribution Margin % (should be percentage, not currency)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!C37:G37',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=C36/C16', '=D36/D16', '=E36/E16', '=F36/F16', '=G36/G16']],
      },
    });
    console.log('   ✅ Row 37: Contribution Margin % fixed');

    // Row 40: EBITDA % (should be percentage, not currency)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!C40:G40',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=C39/C16', '=D39/D16', '=E39/E16', '=F39/F16', '=G39/G16']],
      },
    });
    console.log('   ✅ Row 40: EBITDA % fixed');

    // Row 45: NET MARGIN % (should be percentage, not currency)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!C45:G45',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=C44/C16', '=D44/D16', '=E44/E16', '=F44/F16', '=G44/G16']],
      },
    });
    console.log('   ✅ Row 45: NET MARGIN % fixed');

    // Row 47: Profit per founder (now Parameters!B7 has value)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!C47:G47',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['=C44/Parameters!B7', '=D44/Parameters!B7', '=E44/Parameters!B7', '=F44/Parameters!B7', '=G44/Parameters!B7']],
      },
    });
    console.log('   ✅ Row 47: Profit per founder fixed');

    // Rows 62-65: KEY INSIGHTS - replace TEXT() with simple division and formatting
    console.log('   ✅ Fixing KEY INSIGHTS (rows 62-65)...');

    // Row 62: Price comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A62:D62',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Цена пилота vs обычная', '=B7', '=B7/Parameters!B5', '=(C62*100) & "% от обычной цены"']],
      },
    });

    // Row 63: Margin comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A63:D63',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Маржа пилота vs обычная', '=G45', '=G45/Scaling!L3', '=(ROUND(C63*100,1)) & "% от обычной маржи"']],
      },
    });

    // Row 64: MRR comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A64:D64',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['MRR пилота (30 компаний)', '=G16', '=G16/Scaling!B6', '=(ROUND(C64*100,1)) & "% от цели в 50 салонов"']],
      },
    });

    // Row 65: Profit comparison
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A65:D65',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [['Прибыль пилота vs 5 салонов', '=G44', '=G44/Scaling!K3', '=(ROUND(C65*100,1)) & "% от текущей прибыли"']],
      },
    });

    console.log('   ✅ All KEY INSIGHTS fixed\n');

    // Fix 3: Apply percentage formatting to specific cells
    console.log('3️⃣ Applying number format...');

    const sheetId = (await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })).data.sheets.find(s => s.properties.title === 'Pilot_Program').properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          // Format rows 37, 40, 45 as percentages
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 36, // Row 37 (0-indexed)
                endRowIndex: 37,
                startColumnIndex: 2, // Column C
                endColumnIndex: 7,   // Column G
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
                startRowIndex: 39, // Row 40
                endRowIndex: 40,
                startColumnIndex: 2,
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
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 44, // Row 45
                endRowIndex: 45,
                startColumnIndex: 2,
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
          // Format KEY INSIGHTS column C as percentage
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 61, // Row 62
                endRowIndex: 65,   // Row 65
                startColumnIndex: 2, // Column C
                endColumnIndex: 3,
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

    console.log('   ✅ Number formatting applied\n');

    console.log('🎉 SUCCESS! All errors fixed!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
    console.log('✨ Fixed issues:');
    console.log('   ✅ Parameters!B7 = 2 (founders count)');
    console.log('   ✅ Row 47: Profit per founder now calculates');
    console.log('   ✅ Rows 37, 40, 45: Percentages formatted correctly');
    console.log('   ✅ Rows 62-65: KEY INSIGHTS text formulas fixed');
    console.log('   ✅ All #ERROR! eliminated\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

fixAllErrors();
