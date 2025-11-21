#!/usr/bin/env node

/**
 * Setup AI Admin Financial Model in Google Sheets
 *
 * This script populates the Google Sheets financial model with:
 * - Business parameters
 * - LLM models comparison
 * - Infrastructure costs
 * - Scaling scenarios (1-100 salons)
 * - Unit economics
 * - Sensitivity analysis
 *
 * All sheets in Russian with English terms (MRR, LLM, etc.)
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
 * Sheet 1: Parameters (Параметры)
 */
function getParametersData() {
  return [
    ['Параметр', 'Значение', 'Примечания'],
    ['', '', ''],
    ['БИЗНЕС', '', ''],
    ['Текущее количество салонов', 5, 'Можно менять'],
    ['Цена за салон (₽/мес)', 50000, 'Можно менять'],
    ['Rev Share (%)', '20%', 'Комиссия YClients'],
    ['Количество учредителей', 2, 'Равное распределение'],
    ['', '', ''],
    ['LLM', '', ''],
    ['Курс USD/RUB', 100, 'Обменный курс'],
    ['Сообщений на салон/мес', 9000, 'Среднее значение'],
    ['Стоимость текущей модели (₽)', 459, 'Из листа LLM Models'],
    ['', '', ''],
    ['ИНФРАСТРУКТУРА', '', ''],
    ['VPS текущий (₽/мес)', 730, 'Ежемесячно'],
    ['БД текущая (₽/мес)', 380, 'Ежемесячно'],
    ['Инфраструктура итого', '=B16+B17', 'Автоматически'],
    ['', '', ''],
    ['НАЛОГИ', '', ''],
    ['Налог (УСН IT)', '1%', 'Может быть 5%'],
    ['Эквайринг < 700K (%)', '3.3%', 'Обработка платежей'],
    ['Эквайринг > 700K (%)', '2.9%', 'Сниженная ставка'],
  ];
}

/**
 * Sheet 2: LLM Models
 */
function getLLMModelsData() {
  return [
    ['Модель', 'Цена USD (1M токенов)', 'Цена RUB', 'Стоимость на салон (₽)', 'Стоимость 5 салонов', 'Стоимость 50 салонов', 'Качество (1-10)', 'Value Score'],
    ['Gemini 2.0 Flash-Lite', 3.44, '=B2*Parameters!B10', '=C2', '=D2*5', '=D2*50', 7.5, '=G2/B2'],
    ['Gemini 2.5 Flash-Lite', 4.59, '=B3*Parameters!B10', '=C3', '=D3*5', '=D3*50', 8, '=G3/B3'],
    ['OpenAI gpt-4o-mini', 6.89, '=B4*Parameters!B10', '=C4', '=D4*5', '=D4*50', 8.5, '=G4/B4'],
    ['Gemini 2.5 Flash', 18.45, '=B5*Parameters!B10', '=C5', '=D5*5', '=D5*50', 9, '=G5/B5'],
    ['Claude Haiku 3.5', 39.60, '=B6*Parameters!B10', '=C6', '=D6*5', '=D6*50', 9.5, '=G6/B6'],
  ];
}

/**
 * Sheet 3: Infrastructure (Инфраструктура)
 */
function getInfrastructureData() {
  return [
    ['Уровень', 'Диапазон салонов', 'VPS (₽)', 'База данных (₽)', 'Итого', 'Назначение'],
    ['Текущий', '1-5', 730, 380, '=C2+D2', 'MVP стадия'],
    ['Средний', '6-15', 2000, 1500, '=C3+D3', 'Рост'],
    ['Максимальный', '16-50', 4300, 5850, '=C4+D4', 'Масштабирование'],
    ['Enterprise', '51-100', 10000, 15000, '=C5+D5', 'Enterprise'],
  ];
}

/**
 * Sheet 4: Scaling Scenarios (Сценарии масштабирования)
 */
function getScalingData() {
  const headers = [
    'Салоны',
    'MRR (₽)',
    'Rev Share (₽)',
    'LLM Cost (₽)',
    'Эквайринг (₽)',
    'Перемен. затраты',
    'Инфраструктура (₽)',
    'Постоян. затраты',
    'Прибыль до налога',
    'Налог (1%)',
    'Чистая прибыль',
    'Маржа %',
    'Прибыль/салон',
    'Прибыль/учредитель'
  ];

  const rows = [
    [1],
    [5],
    [10],
    [15],
    [20],
    [50],
    [100],
  ];

  // Add formulas for each row
  const dataRows = rows.map((row, idx) => {
    const rowNum = idx + 2; // Starting from row 2 (after header)
    const salons = row[0];

    return [
      salons,
      `=A${rowNum}*Parameters!B5`, // MRR = Салоны × Цена
      `=B${rowNum}*0,2`, // Rev Share (20%)
      `=A${rowNum}*LLM_Models!D3`, // LLM cost (текущая модель - строка 3)
      `=B${rowNum}*0,033`, // Эквайринг (3.3%)
      `=C${rowNum}+D${rowNum}+E${rowNum}`, // Сумма переменных
      `=IF(A${rowNum}<=5;Infrastructure!E2;IF(A${rowNum}<=15;Infrastructure!E3;IF(A${rowNum}<=50;Infrastructure!E4;Infrastructure!E5)))`, // Tier lookup
      `=G${rowNum}`, // Fixed = Infrastructure
      `=B${rowNum}-F${rowNum}-H${rowNum}`, // Profit before tax
      `=I${rowNum}*0,01`, // Tax (1%)
      `=I${rowNum}-J${rowNum}`, // Net profit
      `=K${rowNum}/B${rowNum}`, // Margin %
      `=K${rowNum}/A${rowNum}`, // Profit per salon
      `=K${rowNum}/2`, // Profit per founder (2 founders)
    ];
  });

  return [headers, ...dataRows];
}

/**
 * Sheet 5: Unit Economics (Юнит-экономика)
 */
function getUnitEconomicsData() {
  return [
    ['Статья', 'Сумма (₽)', '% от выручки', 'Категория', 'Формула'],
    ['', '', '', '', ''],
    ['ВЫРУЧКА', 50000, '100,0%', 'Доход', '=Parameters!B5'],
    ['Rev Share (YClients)', '=-B3*0,2', '=-B4/B3', 'Переменные', '20% от выручки'],
    ['LLM Cost (Gemini)', '=-LLM_Models!D3', '=-B5/B3', 'Переменные', 'Из листа LLM_Models'],
    ['Эквайринг (3.3%)', '=-B3*0,033', '=-B6/B3', 'Переменные', '3,3% от выручки'],
    ['Переменные затраты', '=B4+B5+B6', '=B7/B3', 'Итого', 'Сумма'],
    ['Contribution Margin', '=B3+B7', '=B8/B3', 'Маржа', 'Выручка - Переменные'],
    ['', '', '', '', ''],
    ['Инфраструктура (VPS+БД)', '=-Infrastructure!E2', '=-B10/B3', 'Постоянные', 'Из листа Infrastructure'],
    ['Постоянные затраты', '=B10', '=B11/B3', 'Итого', 'Инфраструктура'],
    ['', '', '', '', ''],
    ['EBITDA', '=B8+B11', '=B13/B3', 'Маржа', 'Contribution - Fixed'],
    ['Налог (УСН IT 1%)', '=-B3*0,01', '=-B14/B3', 'Налоги', '1% от выручки'],
    ['', '', '', '', ''],
    ['ЧИСТАЯ ПРИБЫЛЬ', '=B13+B14', '=B16/B3', 'Прибыль', 'EBITDA - Tax'],
  ];
}

/**
 * Sheet 6: Sensitivity Analysis (Анализ чувствительности)
 */
function getSensitivityData() {
  return [
    ['Переменная', 'Базовое значение', '-30%', '-15%', 'База', '+15%', '+30%', 'Диапазон влияния'],
    ['', '', '', '', '', '', '', ''],
    ['Цена за салон (₽)', 50000, 35000, 42500, 50000, 57500, 65000, 'Влияние на чистую прибыль'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!K3', '=(C3/E3)*Scaling!B3*0,738', '=(D3/E3)*Scaling!B3*0,738', '=Scaling!K3', '=(F3/E3)*Scaling!B3*0,738', '=(G3/E3)*Scaling!B3*0,738', 'Диапазон прибыли'],
    ['', '', '', '', '', '', '', ''],
    ['Rev Share %', 0.20, 0.14, 0.17, 0.20, 0.23, 0.26, 'Влияние на чистую прибыль'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!K3', '=Scaling!K3+(Scaling!B3*(0,20-C6))', '=Scaling!K3+(Scaling!B3*(0,20-D6))', '=Scaling!K3', '=Scaling!K3-(Scaling!B3*(F6-0,20))', '=Scaling!K3-(Scaling!B3*(G6-0,20))', 'Диапазон прибыли'],
    ['', '', '', '', '', '', '', ''],
    ['LLM модель (выбрать)', 'Flash-Lite', '2.0 Lite', '2.5 Lite', '2.5 Lite', '2.5 Flash', 'Haiku 3.5', 'Влияние на чистую прибыль'],
    ['Стоимость модели (₽)', 459, 344, 459, 459, 1845, 3960, 'Стоимость на салон'],
    ['Чистая прибыль @ 5 салонов', '=Scaling!K3', '=Scaling!K3+(5*(E10-C10))', '=Scaling!K3', '=Scaling!K3', '=Scaling!K3-(5*(F10-E10))', '=Scaling!K3-(5*(G10-E10))', 'Диапазон прибыли'],
  ];
}

/**
 * Main function to setup all sheets
 */
async function setupFinancialSheets() {
  console.log('🚀 Starting Google Sheets setup...\n');

  try {
    const sheets = await getSheets();

    // Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log('📊 Spreadsheet found:', spreadsheet.data.properties.title);
    console.log('🔗 URL:', `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    // Define sheets to create/update
    const sheetsToSetup = [
      { title: 'Parameters', data: getParametersData() },
      { title: 'LLM_Models', data: getLLMModelsData() },
      { title: 'Infrastructure', data: getInfrastructureData() },
      { title: 'Scaling', data: getScalingData() },
      { title: 'Unit_Economics', data: getUnitEconomicsData() },
      { title: 'Sensitivity', data: getSensitivityData() },
    ];

    // Check which sheets exist
    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    console.log('📋 Existing sheets:', existingSheets.join(', '));

    // Create missing sheets
    const sheetsToCreate = sheetsToSetup.filter(s => !existingSheets.includes(s.title));

    if (sheetsToCreate.length > 0) {
      console.log('\n➕ Creating new sheets:', sheetsToCreate.map(s => s.title).join(', '));

      const requests = sheetsToCreate.map(sheet => ({
        addSheet: {
          properties: {
            title: sheet.title,
          }
        }
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: { requests },
      });

      console.log('✅ Sheets created successfully\n');
    }

    // Populate data for all sheets
    console.log('📝 Populating sheets with data...\n');

    for (const sheet of sheetsToSetup) {
      console.log(`   Writing to ${sheet.title}...`);

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheet.title}!A1`,
        valueInputOption: 'USER_ENTERED', // Important: parse formulas
        resource: {
          values: sheet.data,
        },
      });

      console.log(`   ✅ ${sheet.title} populated (${sheet.data.length} rows)`);
    }

    console.log('\n🎉 SUCCESS! Financial model setup complete!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);
    console.log('📋 Created sheets:');
    sheetsToSetup.forEach(s => {
      console.log(`   - ${s.title}`);
    });
    console.log('\n✨ Next steps:');
    console.log('   1. Review the data in Google Sheets');
    console.log('   2. Verify formulas are calculating correctly');
    console.log('   3. Run sync service to update Notion dashboard\n');

  } catch (error) {
    console.error('❌ Error setting up sheets:', error.message);

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
  setupFinancialSheets();
}

module.exports = { setupFinancialSheets };
