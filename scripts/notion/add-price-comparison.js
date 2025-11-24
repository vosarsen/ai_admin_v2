#!/usr/bin/env node

/**
 * Add price comparison to Pilot_Program sheet
 * Shows both 14,990₽ and 19,990₽ options side-by-side
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
 * Complete Pilot Program sheet with TWO price options side-by-side
 */
function getPilotComparisonData() {
  return [
    ['🚀 PILOT PROGRAM - 30 КОМПАНИЙ (2 ВАРИАНТА ЦЕНЫ)', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['', '', '', 'ВАРИАНТ A', '', '', 'ВАРИАНТ B', '', '', ''],
    ['', '', '', '💚 LOW BARRIER', '', '', '💎 PREMIUM', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['📋 УСЛОВИЯ ПИЛОТА', '', '', 'Вариант A', '', '', 'Вариант B', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Параметр', '', '', 'Значение A', 'Примечания', '', 'Значение B', 'Примечания', '', 'Δ (B vs A)'],
    ['Количество компаний', '', '', 30, 'Пилотная группа', '', 30, 'Пилотная группа', '', '=G9-D9'],
    ['Цена пилота (₽/мес)', '', '', 14990, 'Low barrier entry', '', 19990, 'Premium positioning', '', '=G10-D10'],
    ['% от базовой цены', '', '', '=D10/Parameters!B5', '30% от 50K', '', '=G10/Parameters!B5', '40% от 50K', '', '=G11-D11'],
    ['Длительность (месяцев)', '', '', 3, 'Пилотный период', '', 3, 'Пилотный период', '', '=G12-D12'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['💰 MONTHLY REVENUE & PROFITABILITY', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Метрика', '', '', 'Вариант A', '%', '', 'Вариант B', '%', '', 'Δ Разница'],
    ['MRR (месячная выручка)', '', '', '=D9*D10', '100%', '', '=G9*G10', '100%', '', '=G17-D17'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Variable Costs:', '', '', '', '', '', '', '', '', ''],
    ['  Rev Share (20%)', '', '', '=D17*0,2', '=D20/D17', '', '=G17*0,2', '=G20/G17', '', '=G20-D20'],
    ['  LLM Cost', '', '', '=D9*Parameters!B12', '=D21/D17', '', '=G9*Parameters!B12', '=G21/G17', '', '=G21-D21'],
    ['  Эквайринг (3.3%)', '', '', '=D17*0,033', '=D22/D17', '', '=G17*0,033', '=G22/G17', '', '=G22-D22'],
    ['ИТОГО Variable Costs', '', '', '=D20+D21+D22', '=D23/D17', '', '=G20+G21+G22', '=G23/G17', '', '=G23-D23'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Fixed Costs:', '', '', '', '', '', '', '', '', ''],
    ['  VPS (Mid tier)', '', '', '=Infrastructure!C3', '=D26/D17', '', '=Infrastructure!C3', '=G26/G17', '', '=G26-D26'],
    ['  База данных (Mid)', '', '', '=Infrastructure!D3', '=D27/D17', '', '=Infrastructure!D3', '=G27/G17', '', '=G27-D27'],
    ['ИТОГО Fixed Costs', '', '', '=D26+D27', '=D28/D17', '', '=G26+G27', '=G28/G17', '', '=G28-D28'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['📊 PROFITABILITY:', '', '', '', '', '', '', '', '', ''],
    ['Contribution Margin', '', '', '=D17-D23', '=D31/D17', '', '=G17-G23', '=G31/G17', '', '=G31-D31'],
    ['EBITDA', '', '', '=D31-D28', '=D32/D17', '', '=G31-G28', '=G32/G17', '', '=G32-D32'],
    ['Налог (1%)', '', '', '=D17*0,01', '=D33/D17', '', '=G17*0,01', '=G33/G17', '', '=G33-D33'],
    ['NET PROFIT (месяц)', '', '', '=D32-D33', '=D34/D17', '', '=G32-G33', '=G34/G17', '', '=G34-D34'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['NET PROFIT (3 месяца)', '', '', '=D34*3', '', '', '=G34*3', '', '', '=G36-D36'],
    ['Прибыль на учредителя (мес)', '', '', '=D34/Parameters!B7', '', '', '=G34/Parameters!B7', '', '', '=G37-D37'],
    ['Прибыль на учредителя (3 мес)', '', '', '=D36/Parameters!B7', '', '', '=G36/Parameters!B7', '', '', '=G38-D38'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['📈 UNIT ECONOMICS (на 1 компанию в месяц):', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Метрика', '', '', 'Вариант A', '', '', 'Вариант B', '', '', 'Δ'],
    ['Revenue на компанию', '', '', '=D10', '', '', '=G10', '', '', '=G43-D43'],
    ['Variable costs на компанию', '', '', '=D23/D9', '', '', '=G23/G9', '', '', '=G44-D44'],
    ['Fixed costs на компанию', '', '', '=D28/D9', '', '', '=G28/G9', '', '', '=G45-D45'],
    ['NET PROFIT на компанию', '', '', '=D34/D9', '', '', '=G34/G9', '', '', '=G46-D46'],
    ['NET MARGIN на компанию', '', '', '=D46/D43', '', '', '=G46/G43', '', '', '=G47-D47'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['🎯 KEY INSIGHTS & COMPARISON:', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Инсайт', '', '', 'Вариант A', '', '', 'Вариант B', '', '', 'Вывод'],
    ['Цена vs базовая (50K)', '', '', '=D10/Parameters!B5', '', '', '=G10/Parameters!B5', '', '', '=IF(G53>D53,"B дороже","A дороже")'],
    ['NET MARGIN %', '', '', '=D34/D17', '', '', '=G34/G17', '', '', '=IF(G54>D54,"B выгоднее","A выгоднее")'],
    ['MRR (30 компаний)', '', '', '=D17', '', '', '=G17', '', '', '=TEXT((G55-D55)/D55,"0%") & " больше"'],
    ['Прибыль vs 5 салонов', '', '', '=D34/Scaling!K3', '', '', '=G34/Scaling!K3', '', '', '=TEXT((G56-D56)/D56,"0%") & " больше"'],
    ['NET PROFIT (месяц)', '', '', '=D34', '', '', '=G34', '', '', '=TEXT((G57-D57)/D57,"0%") & " больше"'],
    ['Прибыль/учредитель (мес)', '', '', '=D37', '', '', '=G37', '', '', '=TEXT((G58-D58)/D58,"0%") & " больше"'],
    ['', '', '', '', '', '', '', '', '', ''],
    ['💡 СТРАТЕГИЧЕСКАЯ ЦЕННОСТЬ:', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Критерий', '', '', 'Вариант A (14,990₽)', '', '', 'Вариант B (19,990₽)', '', '', ''],
    ['🎯 Цель', '', '', 'Быстрая валидация', '', '', 'Валидация + Revenue', '', '', ''],
    ['👥 Целевая аудитория', '', '', 'Максимум салонов', '', '', 'Серьезные клиенты', '', '', ''],
    ['🚪 Барьер входа', '', '', '⭐⭐⭐⭐⭐ Очень низкий', '', '', '⭐⭐⭐⭐ Низкий', '', '', ''],
    ['💎 Value perception', '', '', '⚠️ Риск "слишком дешево"', '', '', '✅ Премиум позиционирование', '', '', ''],
    ['🔄 Конверсия в 50K', '', '', '❓ Сложнее (3.3x jump)', '', '', '✅ Проще (2.5x jump)', '', '', ''],
    ['📊 Qualification', '', '', '⚠️ Могут быть халявщики', '', '', '✅ Фильтр серьезности', '', '', ''],
    ['💰 Total Revenue (3 мес)', '', '', '=D36', '', '', '=G36', '', '', '=TEXT((G69-D69)/D69,"+0%")'],
    ['⏱️ Скорость набора', '', '', '⭐⭐⭐⭐⭐ Очень быстро', '', '', '⭐⭐⭐⭐ Быстро', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['🎓 RECOMMENDATION (на основе цифр):', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', ''],
    ['Критерий принятия решения', '', '', 'Выбирай A, если...', '', '', 'Выбирай B, если...', '', '', ''],
    ['Главная цель', '', '', 'Learning & быстрая валидация PMF', '', '', 'Revenue + серьезная валидация', '', '', ''],
    ['Приоритет', '', '', 'Скорость набора 30 компаний', '', '', 'Качество клиентов важнее', '', '', ''],
    ['Cash flow', '', '', 'Достаточно текущего', '', '', 'Хочешь больше заработать', '', '', ''],
    ['Brand positioning', '', '', 'Массовый доступ', '', '', 'Премиум решение', '', '', ''],
    ['Risk tolerance', '', '', 'Готов к "халявщикам"', '', '', 'Хочешь фильтровать серьезных', '', '', ''],
  ];
}

async function addPriceComparison() {
  console.log('🔧 Creating price comparison sheet...\n');

  try {
    const sheets = await getSheets();

    // Check if Pilot_Program_Compare exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

    if (existingSheets.includes('Pilot_Comparison')) {
      console.log('⚠️  Pilot_Comparison sheet exists. Updating...\n');
    } else {
      console.log('➕ Creating Pilot_Comparison sheet...');

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Pilot_Comparison',
                gridProperties: {
                  frozenRowCount: 1,
                  frozenColumnCount: 3,
                },
              }
            }
          }]
        },
      });

      console.log('✅ Sheet created\n');
    }

    // Populate data
    console.log('📝 Populating comparison data...');

    const comparisonData = getPilotComparisonData();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Comparison!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: comparisonData,
      },
    });

    console.log(`✅ Data populated (${comparisonData.length} rows)\n`);

    // Apply formatting
    console.log('🎨 Applying formatting...');

    const sheetId = (await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })).data.sheets.find(s => s.properties.title === 'Pilot_Comparison').properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          // Title row (row 1)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 14 },
                  backgroundColor: { red: 0.2, green: 0.6, blue: 1.0 },
                  horizontalAlignment: 'CENTER',
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
            }
          },
          // Variant headers (row 3-4)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 2,
                endRowIndex: 4,
                startColumnIndex: 3,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 12 },
                  backgroundColor: { red: 0.7, green: 0.95, blue: 0.7 },
                  horizontalAlignment: 'CENTER',
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 2,
                endRowIndex: 4,
                startColumnIndex: 6,
                endColumnIndex: 10,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 12 },
                  backgroundColor: { red: 0.85, green: 0.7, blue: 0.95 },
                  horizontalAlignment: 'CENTER',
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)'
            }
          },
          // Format percentages (columns E and H)
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 10,
                endRowIndex: 60,
                startColumnIndex: 4, // Column E
                endColumnIndex: 5,
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
                endRowIndex: 60,
                startColumnIndex: 7, // Column H
                endColumnIndex: 8,
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
          // Column widths
          {
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 1,
              },
              properties: { pixelSize: 250 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 3,
                endIndex: 10,
              },
              properties: { pixelSize: 150 },
              fields: 'pixelSize'
            }
          },
        ]
      },
    });

    console.log('✅ Formatting applied\n');

    console.log('🎉 SUCCESS! Price comparison created!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
    console.log('✨ New sheet includes:');
    console.log('   ✅ Side-by-side comparison: 14,990₽ vs 19,990₽');
    console.log('   ✅ Complete P&L for both variants');
    console.log('   ✅ Unit economics comparison');
    console.log('   ✅ Strategic value analysis');
    console.log('   ✅ Decision framework (когда выбирать A vs B)');
    console.log('   ✅ Delta calculations (разница между вариантами)\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

addPriceComparison();
