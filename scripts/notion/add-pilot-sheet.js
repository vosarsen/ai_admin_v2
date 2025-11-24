#!/usr/bin/env node

/**
 * Add Pilot Program sheet to AI Admin Financial Model
 *
 * Pilot offer: 14,990₽ for 3 months (30 companies)
 * Calculates economics for pilot program
 */

const { google } = require('googleapis');
const path = require('path');

// Configuration
const SPREADSHEET_ID = '1c3TSGl9It3byKuH1RCKU1ijVV3soPLLefC36Y82rlGg';
const KEY_FILE = path.join(__dirname, '../../config/google-service-account.json');

// Initialize Google Sheets API
async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Pilot Program Sheet Data
 */
function getPilotProgramData() {
  return [
    ['🚀 PILOT PROGRAM - 30 КОМПАНИЙ', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['📋 УСЛОВИЯ ПИЛОТА', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Параметр', 'Значение', 'Примечания', '', '', '', ''],
    ['Количество компаний', 30, 'Пилотная группа', '', '', '', ''],
    ['Цена пилота (₽)', 14990, 'За 3 месяца', '', '', '', ''],
    ['Длительность (месяцев)', 3, 'Пилотный период', '', '', '', ''],
    ['Цена в месяц (₽)', '=B7/B8', 'Эквивалент', '', '', '', ''],
    ['Rev Share (%)', '20%', 'YClients комиссия', '', '', '', ''],
    ['Налог (УСН IT)', '1%', 'УСН для IT', '', '', '', ''],
    ['Эквайринг (%)', '3,3%', 'До 700K оборот', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['💰 REVENUE (3 месяца)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Статья', 'Формула', 'Месяц 1', 'Месяц 2', 'Месяц 3', 'ИТОГО 3 мес', 'Средн/мес'],
    ['Общая выручка (₽)', '=Компании × Цена', '=B6*B7', '=C17', '=C17', '=C17+D17+E17', '=F17/3'],
    ['MRR эквивалент', '=Компании × Месячная цена', '=B6*B9', '=C18', '=C18', '=C18+D18+E18', '=F18/3'],
    ['', '', '', '', '', '', ''],
    ['💸 VARIABLE COSTS (3 месяца)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Статья', '% от выручки', 'Месяц 1', 'Месяц 2', 'Месяц 3', 'ИТОГО 3 мес', 'Средн/мес'],
    ['Rev Share (YClients)', '20%', '=C17*0,2', '=D17*0,2', '=E17*0,2', '=C23+D23+E23', '=F23/3'],
    ['LLM Cost (Gemini 2.5 Flash-Lite)', 'Из Parameters', '=B6*Parameters!B12', '=C24', '=C24', '=C24+D24+E24', '=F24/3'],
    ['Эквайринг', '3,3%', '=C17*0,033', '=D17*0,033', '=E17*0,033', '=C25+D25+E25', '=F25/3'],
    ['ИТОГО Variable Costs', '', '=C23+C24+C25', '=D23+D24+D25', '=E23+E24+E25', '=C26+D26+E26', '=F26/3'],
    ['', '', '', '', '', '', ''],
    ['🏢 FIXED COSTS (3 месяца)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Статья', 'Ставка', 'Месяц 1', 'Месяц 2', 'Месяц 3', 'ИТОГО 3 мес', 'Средн/мес'],
    ['VPS (30 компаний = Mid tier)', '₽/мес', '=Infrastructure!C3', '=C31', '=C31', '=C31+D31+E31', '=F31/3'],
    ['База данных (Mid tier)', '₽/мес', '=Infrastructure!D3', '=C32', '=C32', '=C32+D32+E32', '=F32/3'],
    ['ИТОГО Fixed Costs', '', '=C31+C32', '=D31+D32', '=E31+E32', '=C33+D33+E33', '=F33/3'],
    ['', '', '', '', '', '', ''],
    ['📊 PROFITABILITY (3 месяца)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Метрика', '', 'Месяц 1', 'Месяц 2', 'Месяц 3', 'ИТОГО 3 мес', 'Средн/мес'],
    ['Contribution Margin', '', '=C17-C26', '=D17-D26', '=E17-E26', '=C38+D38+E38', '=F38/3'],
    ['Contribution Margin %', '', '=C38/C17', '=D38/D17', '=E38/E17', '=F38/F17', '=G38'],
    ['', '', '', '', '', '', ''],
    ['EBITDA', '', '=C38-C33', '=D38-D33', '=E38-E33', '=C41+D41+E41', '=F41/3'],
    ['EBITDA %', '', '=C41/C17', '=D41/D17', '=E41/E17', '=F41/F17', '=G41'],
    ['', '', '', '', '', '', ''],
    ['Налог (1%)', '', '=C17*0,01', '=D17*0,01', '=E17*0,01', '=C44+D44+E44', '=F44/3'],
    ['', '', '', '', '', '', ''],
    ['NET PROFIT (Чистая прибыль)', '', '=C41-C44', '=D41-D44', '=E41-E44', '=C46+D46+E46', '=F46/3'],
    ['NET MARGIN %', '', '=C46/C17', '=D46/D17', '=E46/E17', '=F46/F17', '=G46'],
    ['', '', '', '', '', '', ''],
    ['Прибыль на учредителя', '', '=C46/Parameters!B7', '=D46/Parameters!B7', '=E46/Parameters!B7', '=F46/Parameters!B7', '=G46/Parameters!B7'],
    ['', '', '', '', '', '', ''],
    ['📈 UNIT ECONOMICS (на 1 компанию)', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Метрика', '', 'За 3 месяца', 'В месяц', '', '', ''],
    ['Revenue на компанию', '', '=B7', '=B9', '', '', ''],
    ['Variable costs на компанию', '', '=F26/B6', '=G26/B6', '', '', ''],
    ['Fixed costs на компанию', '', '=F33/B6', '=G33/B6', '', '', ''],
    ['Contribution Margin на компанию', '', '=C54-C55', '=D54-D55', '', '', ''],
    ['EBITDA на компанию', '', '=C57-C56', '=D57-D56', '', '', ''],
    ['NET PROFIT на компанию', '', '=F46/B6', '=G46/B6', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['🎯 KEY INSIGHTS', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Инсайт', 'Значение', 'Сравнение с базой', '', '', '', ''],
    ['Цена пилота vs обычная (месяц)', '=B9', '=B9/Parameters!B5', 'от обычной цены', '', '', ''],
    ['Маржа пилота vs обычная', '=TEXT(G47;"0,0%")', '=G47/Scaling!L3', 'от обычной маржи', '', '', ''],
    ['MRR пилота (30 компаний)', '=G18', '=G18/Scaling!B6', 'от цели в 50 салонов', '', '', ''],
    ['Прибыль пилота vs 5 салонов', '=G46', '=G46/Scaling!K3', 'от текущей прибыли', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['💡 СТРАТЕГИЧЕСКАЯ ЦЕННОСТЬ', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Показатель', 'Описание', '', '', '', '', ''],
    ['Validation скорость', '30 компаний за 3 месяца = быстрый PMF тест', '', '', '', '', ''],
    ['Conversion потенциал', 'При 50% конверсии в полную цену: 15 × 50K = 750K MRR', '', '', '', '', ''],
    ['Learning возможность', 'Собрать feedback от 30 клиентов для улучшения продукта', '', '', '', '', ''],
    ['Testimonials база', '30 компаний = мощная социальная валидация для Scale этапа', '', '', '', '', ''],
    ['Cash flow', 'Immediate revenue для покрытия costs во время пилота', '', '', '', '', ''],
  ];
}

/**
 * Main function to add Pilot Program sheet
 */
async function addPilotSheet() {
  console.log('🚀 Adding Pilot Program sheet...\n');

  try {
    const sheets = await getSheets();

    // Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log('📊 Spreadsheet:', spreadsheet.data.properties.title);
    console.log('🔗 URL:', `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log('📋 Existing sheets:', existingSheets.join(', '));

    // Check if Pilot_Program sheet already exists
    if (existingSheets.includes('Pilot_Program')) {
      console.log('\n⚠️  Pilot_Program sheet already exists. Updating data...\n');
    } else {
      console.log('\n➕ Creating Pilot_Program sheet...');

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Pilot_Program',
                gridProperties: {
                  frozenRowCount: 1,
                },
              }
            }
          }]
        },
      });

      console.log('✅ Sheet created successfully\n');
    }

    // Populate data
    console.log('📝 Populating Pilot_Program with data...');

    const pilotData = getPilotProgramData();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pilot_Program!A1',
      valueInputOption: 'USER_ENTERED', // Parse formulas
      resource: {
        values: pilotData,
      },
    });

    console.log(`✅ Pilot_Program populated (${pilotData.length} rows)\n`);

    // Format the sheet (bold headers, colors)
    console.log('🎨 Applying formatting...');

    const sheetId = (await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    })).data.sheets.find(s => s.properties.title === 'Pilot_Program').properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          // Bold title row
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
          // Bold section headers
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 12 },
                  backgroundColor: { red: 1.0, green: 0.9, blue: 0.6 },
                }
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)'
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
                startIndex: 1,
                endIndex: 7,
              },
              properties: { pixelSize: 140 },
              fields: 'pixelSize'
            }
          },
        ]
      },
    });

    console.log('✅ Formatting applied\n');

    console.log('🎉 SUCCESS! Pilot Program sheet added!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
    console.log('✨ Sheet includes:');
    console.log('   ✅ Pilot conditions (30 companies, 14,990₽, 3 months)');
    console.log('   ✅ Revenue breakdown (monthly + total)');
    console.log('   ✅ Variable costs (Rev Share, LLM, Acquiring)');
    console.log('   ✅ Fixed costs (VPS, Database)');
    console.log('   ✅ Profitability (Contribution Margin, EBITDA, Net Profit)');
    console.log('   ✅ Unit economics (per company)');
    console.log('   ✅ Key insights (vs base price, margins)');
    console.log('   ✅ Strategic value (validation, conversion, learning)\n');

  } catch (error) {
    console.error('❌ Error adding Pilot sheet:', error.message);

    if (error.code === 403) {
      console.error('\n⚠️  Permission denied. Make sure:');
      console.error('   1. Service account email is shared with the spreadsheet');
      console.error('   2. Email:', 'ai-admin-financial-sync@gen-lang-client-0505009940.iam.gserviceaccount.com');
      console.error('   3. Permission level: Editor or Owner\n');
    }

    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  addPilotSheet();
}

module.exports = { addPilotSheet };
