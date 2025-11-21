#!/usr/bin/env node

/**
 * Create Dashboard sheet in Google Sheets
 *
 * Includes:
 * 1. Hero metrics (current state)
 * 2. Prepared data for charts (manual chart creation required)
 * 3. Key insights and milestones
 * 4. Instructions for creating charts
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
 * Generate Dashboard content
 */
function getDashboardData() {
  return [
    // Section 1: Title
    ['💰 FINANCIAL DASHBOARD - AI Admin v2'],
    [''],
    [''],

    // Section 2: Hero Metrics (Current State @ 5 salons)
    ['📊 ТЕКУЩИЕ ПОКАЗАТЕЛИ (5 салонов)', '', '', '', '', '', ''],
    [''],
    ['Метрика', 'Значение', 'USD', '%', 'На учредителя'],
    ['MRR (Monthly Recurring Revenue)', '=Scaling!B3', '=Scaling!C3', '', ''],
    ['Net Profit', '=Scaling!P3', '=Scaling!Q3', '=Scaling!M3', '=Scaling!O3'],
    ['LLM Cost', '=Scaling!E3', '=Scaling!F3', '=Scaling!E3/Scaling!B3', ''],
    ['Infrastructure', '=Scaling!I3', '', '=Scaling!I3/Scaling!B3', ''],
    [''],
    [''],

    // Section 3: Growth Milestones
    ['🎯 КЛЮЧЕВЫЕ ВЕХИ РОСТА', '', '', '', '', '', ''],
    [''],
    ['Салонов', 'MRR (₽)', 'MRR (USD)', 'Net Profit (₽)', 'Net Profit (USD)', 'Маржа', 'На учредителя (USD)'],
    ['Сейчас → 5', '=Scaling!B3', '=Scaling!C3', '=Scaling!P3', '=Scaling!Q3', '=Scaling!M3', '=Scaling!Q3/2'],
    ['PMF → 50', '=Scaling!B7', '=Scaling!C7', '=Scaling!P7', '=Scaling!Q7', '=Scaling!M7', '=Scaling!Q7/2'],
    ['Scale → 100', '=Scaling!B8', '=Scaling!C8', '=Scaling!P8', '=Scaling!Q8', '=Scaling!M8', '=Scaling!Q8/2'],
    ['Regional → 500', '=Scaling!B10', '=Scaling!C10', '=Scaling!P10', '=Scaling!Q10', '=Scaling!M10', '=Scaling!Q10/2'],
    ['National → 1000', '=Scaling!B11', '=Scaling!C11', '=Scaling!P11', '=Scaling!Q11', '=Scaling!M11', '=Scaling!Q11/2'],
    ['Unicorn → 10000', '=Scaling!B14', '=Scaling!C14', '=Scaling!P14', '=Scaling!Q14', '=Scaling!M14', '=Scaling!Q14/2'],
    [''],
    [''],

    // Section 4: Chart Data - Revenue Growth
    ['📈 ДАННЫЕ ДЛЯ ГРАФИКА: Revenue Growth', '', '', '', '', '', ''],
    ['→ Создайте Line Chart: Insert → Chart → Line chart'],
    ['→ X-axis: Салонов | Y-axis: MRR (USD) и Net Profit (USD)'],
    [''],
    ['Салонов', 'MRR (USD)', 'Net Profit (USD)', 'LLM Cost (USD)'],
    ['=Scaling!A2', '=Scaling!C2', '=Scaling!Q2', '=Scaling!F2'],
    ['=Scaling!A3', '=Scaling!C3', '=Scaling!Q3', '=Scaling!F3'],
    ['=Scaling!A4', '=Scaling!C4', '=Scaling!Q4', '=Scaling!F4'],
    ['=Scaling!A5', '=Scaling!C5', '=Scaling!Q5', '=Scaling!F5'],
    ['=Scaling!A6', '=Scaling!C6', '=Scaling!Q6', '=Scaling!F6'],
    ['=Scaling!A7', '=Scaling!C7', '=Scaling!Q7', '=Scaling!F7'],
    ['=Scaling!A8', '=Scaling!C8', '=Scaling!Q8', '=Scaling!F8'],
    ['=Scaling!A9', '=Scaling!C9', '=Scaling!Q9', '=Scaling!F9'],
    ['=Scaling!A10', '=Scaling!C10', '=Scaling!Q10', '=Scaling!F10'],
    ['=Scaling!A11', '=Scaling!C11', '=Scaling!Q11', '=Scaling!F11'],
    ['=Scaling!A12', '=Scaling!C12', '=Scaling!Q12', '=Scaling!F12'],
    ['=Scaling!A13', '=Scaling!C13', '=Scaling!Q13', '=Scaling!F13'],
    ['=Scaling!A14', '=Scaling!C14', '=Scaling!Q14', '=Scaling!F14'],
    [''],
    [''],

    // Section 5: Chart Data - Profit Margin
    ['📊 ДАННЫЕ ДЛЯ ГРАФИКА: Profit Margin by Scale', '', '', '', '', '', ''],
    ['→ Создайте Combo Chart: Line (Margin) + Column (Net Profit)'],
    [''],
    ['Салонов', 'Маржа (%)', 'Net Profit (₽)'],
    ['=Scaling!A2', '=Scaling!M2', '=Scaling!P2'],
    ['=Scaling!A3', '=Scaling!M3', '=Scaling!P3'],
    ['=Scaling!A4', '=Scaling!M4', '=Scaling!P4'],
    ['=Scaling!A5', '=Scaling!M5', '=Scaling!P5'],
    ['=Scaling!A6', '=Scaling!M6', '=Scaling!P6'],
    ['=Scaling!A7', '=Scaling!M7', '=Scaling!P7'],
    ['=Scaling!A8', '=Scaling!M8', '=Scaling!P8'],
    ['=Scaling!A9', '=Scaling!M9', '=Scaling!P9'],
    ['=Scaling!A10', '=Scaling!M10', '=Scaling!P10'],
    ['=Scaling!A11', '=Scaling!M11', '=Scaling!P11'],
    ['=Scaling!A12', '=Scaling!M12', '=Scaling!P12'],
    ['=Scaling!A13', '=Scaling!M13', '=Scaling!P13'],
    ['=Scaling!A14', '=Scaling!M14', '=Scaling!P14'],
    [''],
    [''],

    // Section 6: Chart Data - LLM Models Comparison
    ['🤖 ДАННЫЕ ДЛЯ ГРАФИКА: LLM Models Comparison', '', '', '', '', '', ''],
    ['→ Создайте Bar Chart: Cost vs Quality'],
    [''],
    ['Модель', 'Cost (₽/салон)', 'Качество (1-10)', 'Value Score'],
    ['=LLM_Models!A2', '=LLM_Models!D2', '=LLM_Models!G2', '=LLM_Models!H2'],
    ['=LLM_Models!A3', '=LLM_Models!D3', '=LLM_Models!G3', '=LLM_Models!H3'],
    ['=LLM_Models!A4', '=LLM_Models!D4', '=LLM_Models!G4', '=LLM_Models!H4'],
    ['=LLM_Models!A5', '=LLM_Models!D5', '=LLM_Models!G5', '=LLM_Models!H5'],
    ['=LLM_Models!A6', '=LLM_Models!D6', '=LLM_Models!G6', '=LLM_Models!H6'],
    [''],
    [''],

    // Section 7: Chart Data - Unit Economics Waterfall
    ['💰 ДАННЫЕ ДЛЯ ГРАФИКА: Unit Economics (1 салон)', '', '', '', '', '', ''],
    ['→ Создайте Waterfall Chart или Column Chart'],
    [''],
    ['Статья', 'Сумма (₽)', '% от выручки'],
    ['Revenue', '=Unit_Economics!B3', '=Unit_Economics!C3'],
    ['Rev Share', '=Unit_Economics!B4', '=Unit_Economics!C4'],
    ['LLM Cost', '=Unit_Economics!B5', '=Unit_Economics!C5'],
    ['Эквайринг', '=Unit_Economics!B6', '=Unit_Economics!C6'],
    ['Variable Costs', '=Unit_Economics!B7', '=Unit_Economics!C7'],
    ['Contribution Margin', '=Unit_Economics!B8', '=Unit_Economics!C8'],
    ['Infrastructure', '=Unit_Economics!B10', '=Unit_Economics!C10'],
    ['Fixed Costs', '=Unit_Economics!B11', '=Unit_Economics!C11'],
    ['EBITDA', '=Unit_Economics!B13', '=Unit_Economics!C13'],
    ['Tax', '=Unit_Economics!B14', '=Unit_Economics!C14'],
    ['NET PROFIT', '=Unit_Economics!B16', '=Unit_Economics!C16'],
    [''],
    [''],

    // Section 8: Chart Data - Sensitivity Analysis
    ['📉 ДАННЫЕ ДЛЯ ГРАФИКА: Sensitivity Analysis (@ 5 салонов)', '', '', '', '', '', ''],
    ['→ Создайте Tornado Chart (Horizontal Bar)'],
    [''],
    ['Переменная', 'Базовое значение', 'Min Impact', 'Max Impact', 'Range'],
    ['Цена за салон', '=Sensitivity!E3', '=Sensitivity!C4', '=Sensitivity!G4', '=G4-C4'],
    ['Rev Share %', '=Sensitivity!E6', '=Sensitivity!G7', '=Sensitivity!C7', '=C7-G7'],
    ['LLM модель', '=Sensitivity!E9', '=Sensitivity!G11', '=Sensitivity!C11', '=C11-G11'],
    [''],
    [''],

    // Section 9: Key Insights
    ['💡 КЛЮЧЕВЫЕ ИНСАЙТЫ', '', '', '', '', '', ''],
    [''],
    ['1. Маржинальность стабильна на уровне 74-75% на всех масштабах'],
    ['2. LLM cost минимален (<1% от выручки) - не критичная переменная'],
    ['3. Rev Share (20% → 15%) даст +5% к марже = критично для переговоров'],
    ['4. При 10K салонов нужно $45.9K USD/месяц на карте для LLM'],
    ['5. Infrastructure costs растут медленнее выручки (эффект масштаба)'],
    ['6. Profit per salon стабилен ~37K₽ независимо от масштаба'],
    [''],
    [''],

    // Section 10: Instructions
    ['📋 ИНСТРУКЦИИ ПО СОЗДАНИЮ ГРАФИКОВ', '', '', '', '', '', ''],
    [''],
    ['Для каждого раздела "ДАННЫЕ ДЛЯ ГРАФИКА":'],
    ['1. Выделите таблицу с данными (включая заголовки)'],
    ['2. Insert → Chart'],
    ['3. Выберите тип графика (указан в инструкции)'],
    ['4. Настройте оси и легенду'],
    ['5. Разместите график рядом с таблицей'],
    [''],
    ['Рекомендуемые графики:'],
    ['- Revenue Growth: Line chart (логарифмическая шкала для Y)'],
    ['- Profit Margin: Combo chart (линия + колонки)'],
    ['- LLM Comparison: Horizontal bar chart'],
    ['- Unit Economics: Waterfall или Column chart'],
    ['- Sensitivity: Tornado chart (horizontal bar)'],
    [''],
    ['Время создания: ~10 минут для всех графиков'],
  ];
}

async function createDashboard() {
  console.log('🚀 Creating Dashboard sheet...\n');

  try {
    const sheets = await getSheets();

    // Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

    // Create Dashboard sheet if doesn't exist
    if (!existingSheets.includes('Dashboard')) {
      console.log('➕ Creating Dashboard sheet...');
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Dashboard',
                index: 0, // Put it first
              }
            }
          }]
        },
      });
      console.log('   ✅ Dashboard sheet created\n');
    } else {
      console.log('📊 Dashboard sheet already exists, updating...\n');
    }

    // Populate Dashboard
    console.log('📝 Populating Dashboard with data and instructions...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dashboard!A1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: getDashboardData(),
      },
    });

    console.log('   ✅ Dashboard populated\n');

    console.log('🎉 SUCCESS! Dashboard created!\n');
    console.log('📊 View your spreadsheet:');
    console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}\n`);

    console.log('📋 What was created:');
    console.log('   ✅ Hero Metrics (current state @ 5 salons)');
    console.log('   ✅ Growth Milestones (5 → 10K salons)');
    console.log('   ✅ Prepared data for 5 charts:');
    console.log('      1. Revenue Growth (MRR + Net Profit + LLM Cost)');
    console.log('      2. Profit Margin by Scale');
    console.log('      3. LLM Models Comparison');
    console.log('      4. Unit Economics Waterfall');
    console.log('      5. Sensitivity Analysis Tornado');
    console.log('   ✅ Key Insights');
    console.log('   ✅ Step-by-step instructions for creating charts');
    console.log('');
    console.log('⏱️  Next step: Create charts manually (10 minutes)');
    console.log('   → Select data table');
    console.log('   → Insert → Chart');
    console.log('   → Follow instructions in Dashboard');
    console.log('');

  } catch (error) {
    console.error('❌ Error creating Dashboard:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  createDashboard();
}

module.exports = { createDashboard };
