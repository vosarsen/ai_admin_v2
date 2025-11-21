# 📋 Financial Model Implementation - Task Checklist v2.0

**Project:** AI Admin v2 Financial Model (Google Sheets + Notion)
**Last Updated:** 2025-11-21
**Status:** Ready for Implementation
**Approach:** Hybrid (Sheets for calculations, Notion for visualization)

---

## 📊 Progress Overview

**Overall Progress:** 0/15 tasks (0%)

| Phase | Tasks | Completed | Time Estimate | Time Actual |
|-------|-------|-----------|---------------|-------------|
| Phase 1: Google Sheets | 6 | 0/6 | 3h | - |
| Phase 2: Notion Dashboard | 3 | 0/3 | 1h | - |
| Phase 3: Sync Service | 3 | 0/3 | 2h | - |
| Phase 4: Testing & Docs | 2 | 0/2 | 0.5h | - |
| **TOTAL** | **15** | **0/15** | **6.5h** | **-** |

---

## 🎯 Phase 1: Google Sheets Setup (3 hours)

### ✅ Task 1.1: Create Sheets File & Structure
**Status:** ⬜ Not Started
**Effort:** S (30 min)
**Dependencies:** None
**Priority:** P0 (Critical)

**Description:**
Create new Google Sheets file and set up basic structure with 6 sheets.

**Steps:**
- [ ] Go to Google Sheets: sheets.google.com
- [ ] Create new spreadsheet: "AI Admin Financial Model"
- [ ] Create 6 sheets (rename Sheet1):
  - [ ] 1. Business Parameters (blue tab)
  - [ ] 2. LLM Models (blue tab)
  - [ ] 3. Infrastructure Costs (blue tab)
  - [ ] 4. Scaling Scenarios (green tab)
  - [ ] 5. Unit Economics (green tab)
  - [ ] 6. Sensitivity Analysis (red tab)
- [ ] Share settings:
  - [ ] "Anyone with link can view"
  - [ ] Add specific editors (your email)
- [ ] Copy Sheet ID from URL
- [ ] Save Sheet ID to context.md

**Acceptance Criteria:**
- ✅ All 6 sheets created with proper names
- ✅ Tabs color-coded correctly
- ✅ Share link works
- ✅ Sheet ID recorded

**Sheet ID:** `_________________` (fill in after creation)

---

### ✅ Task 1.2: Build Business Parameters Sheet
**Status:** ⬜ Not Started
**Effort:** S (15 min)
**Dependencies:** Task 1.1
**Priority:** P0 (Critical)

**Description:**
Populate all business parameters from existing data.

**Data Entry:**
Create table with columns: Parameter | Value | Unit | Category | Notes

| Parameter | Value | Unit | Category | Notes |
|-----------|-------|------|----------|-------|
| Current Salons | 5 | # | Business | Active clients |
| Price per Salon | 50,000 | ₽ | Business | Monthly subscription |
| Rev Share % | 20% | % | Costs | YClients marketplace fee |
| USD/RUB | 100 | rate | Finance | Exchange rate |
| Messages/Salon/Month | 9,000 | # | Usage | Average monthly |
| Founders | 2 | # | Team | Equal split |
| Tax Rate (IT) | 1% | % | Legal | УСН IT льгота |
| Acquiring <700K | 3.3% | % | Costs | Payment processing |
| Acquiring >700K | 2.9% | % | Costs | Volume discount |
| VPS Current | 999 | ₽ | Infrastructure | Annual discount |
| VPS Medium | 1,350 | ₽ | Infrastructure | 6-15 salons |
| DB Medium | 1,800 | ₽ | Infrastructure | 6-15 salons |
| VPS Max | 4,635 | ₽ | Infrastructure | 16-50 salons |
| DB Max | 4,500 | ₽ | Infrastructure | 16-50 salons |
| VPS Enterprise | 9,000 | ₽ | Infrastructure | 51-100 salons |
| DB Enterprise | 13,500 | ₽ | Infrastructure | 51-100 salons |

**Steps:**
- [ ] Create header row (bold, freeze)
- [ ] Enter all 25+ parameters
- [ ] Add data validation where needed (percentages 0-100%)
- [ ] Protect header row
- [ ] Add notes for complex parameters

**Acceptance Criteria:**
- ✅ 25+ parameters entered
- ✅ All values correct
- ✅ Clear labels and units
- ✅ Notes explanatory

**Data Source:** `Inputs_Template.csv`, `AI_Admin_Financial_Model.md`

---

### ✅ Task 1.3: Build LLM Models Sheet
**Status:** ⬜ Not Started
**Effort:** M (30 min)
**Dependencies:** Task 1.2
**Priority:** P0 (Critical)

**Description:**
Create LLM cost comparison table with dynamic formulas.

**Table Structure:**

| Model | Price USD | Price RUB | Cost/Salon | Cost 5 Salons | Cost 50 Salons | Quality | Value Score | Current |
|-------|-----------|-----------|------------|---------------|----------------|---------|-------------|---------|
| Gemini 2.0 Flash-Lite | 3.44 | =B2*Parameters!$B$4 | =C2 | =D2*5 | =D2*50 | 7.5 | =G2/B2 | ❌ |
| Gemini 2.5 Flash-Lite | 4.59 | =B3*Parameters!$B$4 | =C3 | =D3*5 | =D3*50 | 8.0 | =G3/B3 | ✅ |
| OpenAI gpt-4o-mini | 6.89 | =B4*Parameters!$B$4 | =C4 | =D4*5 | =D4*50 | 8.5 | =G4/B4 | ❌ |
| Gemini 2.5 Flash | 18.45 | =B5*Parameters!$B$4 | =C5 | =D5*5 | =D5*50 | 9.0 | =G5/B5 | ❌ |
| Claude Haiku 3.5 | 39.60 | =B6*Parameters!$B$4 | =C6 | =D6*5 | =D6*50 | 9.5 | =G6/B6 | ❌ |

**Steps:**
- [ ] Create headers
- [ ] Enter 5 models with USD pricing
- [ ] Add formulas:
  - [ ] Price RUB = USD × Exchange Rate (from Parameters!B4)
  - [ ] Cost per Salon (already in RUB from pricing)
  - [ ] Cost 5/50 Salons = Cost/Salon × count
  - [ ] Value Score = Quality / Price USD
- [ ] Create named range: "CurrentLLMCost" = D3 (Gemini 2.5 FL cost)
- [ ] Conditional formatting:
  - [ ] Current model row (green background)
  - [ ] Value Score: >15 green, 10-15 yellow, <10 red

**Acceptance Criteria:**
- ✅ All 5 models entered
- ✅ Formulas calculate correctly
- ✅ Current model shows 459₽/salon
- ✅ Named range created
- ✅ Conditional formatting applied

**Validation:**
- Gemini 2.5 Flash-Lite: 459₽ per salon ✓

---

### ✅ Task 1.4: Build Scaling Scenarios Sheet
**Status:** ⬜ Not Started
**Effort:** L (60 min)
**Dependencies:** Tasks 1.2, 1.3
**Priority:** P0 (Critical)

**Description:**
Create main financial model with 5 scaling scenarios.

**Columns:**
Salons | MRR | Rev Share | LLM Cost | Acquiring | Variable Total | Infrastructure | Fixed Total | PBT | Tax | Net Profit | Margin % | Profit/Salon | Profit/Founder

**Formulas (for row 2, 1 salon):**
- A2: `1` (manual)
- B2: `=A2*Parameters!$B$2` (Salons × Price)
- C2: `=B2*Parameters!$B$3` (MRR × 20%)
- D2: `=A2*LLM!CurrentLLMCost` (Salons × 459₽)
- E2: `=B2*0.033` (MRR × 3.3% acquiring)
- F2: `=SUM(C2:E2)` (Variable costs total)
- G2: `=IF(A2<=5,999,IF(A2<=15,3150,IF(A2<=50,9135,22500)))` (Tiered infra)
- H2: `=G2` (Fixed costs = Infrastructure only for now)
- I2: `=B2-F2-H2` (Profit before tax)
- J2: `=B2*0.01` (Tax = MRR × 1%)
- K2: `=I2-J2` (Net profit)
- L2: `=K2/B2` (Margin % - format as percentage)
- M2: `=K2/A2` (Profit per salon)
- N2: `=K2/Parameters!$B$6` (Profit per founder, divide by 2)

**Scenarios (manual entry in column A):**
- Row 2: 1 salon
- Row 3: 5 salons
- Row 4: 15 salons
- Row 5: 50 salons
- Row 6: 100 salons

**Steps:**
- [ ] Create headers
- [ ] Enter formulas in row 2
- [ ] Copy formulas down to rows 3-6
- [ ] Enter salon counts (1, 5, 15, 50, 100)
- [ ] Format currency columns (₽)
- [ ] Format percentage column (%)
- [ ] Conditional formatting:
  - [ ] Positive numbers (profits) = green text
  - [ ] Negative numbers (costs) = red text
  - [ ] Margin % color scale (red→yellow→green)
- [ ] Bold row 3 (current state: 5 salons)

**Acceptance Criteria:**
- ✅ All 5 scenarios created
- ✅ All formulas working correctly
- ✅ Validation passed (see below)
- ✅ Formatting applied

**Validation (5 salons, row 3):**
- [ ] MRR = 250,000₽
- [ ] Variable Costs = 60,545₽
- [ ] Fixed Costs = 999₽
- [ ] Net Profit = 185,956₽
- [ ] Margin = 74.4%

---

### ✅ Task 1.5: Build Unit Economics Sheet
**Status:** ⬜ Not Started
**Effort:** M (30 min)
**Dependencies:** Task 1.4
**Priority:** P1 (High)

**Description:**
Create detailed P&L breakdown for 1 salon.

**Table Structure:**

| Line Item | Amount (₽) | % of Revenue | Category | Formula |
|-----------|------------|--------------|----------|---------|
| **REVENUE** | =Parameters!$B$2 | =B2/B2 | Revenue | Base price |
| Rev Share | =B2*Parameters!$B$3 | =B3/B2 | Variable | 20% to YClients |
| LLM Cost | =LLM!CurrentLLMCost | =B4/B2 | Variable | Current model |
| Acquiring | =B2*0.033 | =B5/B2 | Variable | 3.3% payment |
| **Variable Total** | =SUM(B3:B5) | =B6/B2 | Variable | Sum |
| **Contribution Margin** | =B2+B6 | =B7/B2 | Margin | Revenue - Variable |
| Infrastructure | =999 | =B8/B2 | Fixed | VPS+DB |
| **Fixed Total** | =B8 | =B9/B2 | Fixed | Sum |
| **EBITDA** | =B7+B9 | =B10/B2 | Margin | Before tax |
| Tax | =B2*0.01 | =B11/B2 | Tax | 1% УСН IT |
| **NET PROFIT** | =B10+B11 | =B12/B2 | Profit | Final |

**Steps:**
- [ ] Create table with 5 columns
- [ ] Enter line items in column A
- [ ] Add formulas in column B (Amount)
- [ ] Add formulas in column C (Percentage)
- [ ] Enter categories in column D
- [ ] Add explanations in column E
- [ ] Format:
  - [ ] Bold totals/margins
  - [ ] Negative numbers in parentheses
  - [ ] Percentages formatted
- [ ] Conditional formatting:
  - [ ] Revenue/Profit = green
  - [ ] Costs = red

**Acceptance Criteria:**
- ✅ All line items present
- ✅ Formulas calculate correctly
- ✅ Matches Scaling Scenarios (1 salon row)
- ✅ Percentages sum to 100%

**Validation:**
- Net Profit = 36,392₽ (72.8% margin) ✓

---

### ✅ Task 1.6: Build Sensitivity Analysis Sheet
**Status:** ⬜ Not Started
**Effort:** M (30 min)
**Dependencies:** Task 1.4
**Priority:** P2 (Medium)

**Description:**
Create "what-if" scenarios using Data Tables.

**Analysis 1: Price Sensitivity**

| Price Scenario | Price (₽) | Net Profit @ 5 Salons | Δ vs Base |
|----------------|-----------|----------------------|-----------|
| -30% | 35,000 | [Data Table] | [Formula] |
| -15% | 42,500 | [Data Table] | [Formula] |
| Base | 50,000 | 185,956 | 0 |
| +15% | 57,500 | [Data Table] | [Formula] |
| +30% | 65,000 | [Data Table] | [Formula] |

**Analysis 2: Rev Share Sensitivity**

Similar structure for Rev Share: 14%, 17%, 20%, 23%, 26%

**Analysis 3: LLM Model Comparison**

| Model | Cost/Salon | Net Profit @ 5 Salons | Δ vs Current |
|-------|------------|----------------------|--------------|
| Gemini 2.0 FL | 344 | [Lookup] | [Formula] |
| Gemini 2.5 FL | 459 | 185,956 | 0 |
| gpt-4o-mini | 689 | [Lookup] | [Formula] |
| Gemini 2.5 Flash | 1,845 | [Lookup] | [Formula] |
| Claude Haiku | 3,960 | [Lookup] | [Formula] |

**Steps:**
- [ ] Create 3 analysis tables
- [ ] Use Data Tables feature for automatic calculation
- [ ] Add charts:
  - [ ] Tornado diagram (impact range)
  - [ ] Line chart (price vs profit)
- [ ] Color-code results (best=green, worst=red)

**Acceptance Criteria:**
- ✅ 3 sensitivity analyses complete
- ✅ Data tables working
- ✅ Charts created
- ✅ Insights clear

**Optional:** Add sensitivity for growth rate, churn, etc.

---

## 🎨 Phase 2: Notion Dashboard Setup (1 hour)

### ✅ Task 2.1: Create Main Dashboard Page
**Status:** ⬜ Not Started
**Effort:** S (15 min)
**Dependencies:** Phase 1 complete
**Priority:** P1 (High)

**Description:**
Create beautiful financial dashboard page in Notion workspace.

**Steps:**
- [ ] Use MCP to create page:
```javascript
mcp__notion__API-post-page({
  parent: { page_id: "1e00a520-3786-8028-bddf-ea03101cc4b9" },
  properties: {
    title: [{ text: { content: "💰 Financial Model & Unit Economics" }}]
  },
  icon: { emoji: "💰" }
})
```
- [ ] Add cover image (financial theme)
- [ ] Add description:
```markdown
> Comprehensive financial model for AI Admin v2. Tracks unit economics,
> scaling scenarios, and profitability across 1-100 salon clients.
>
> **Data Source:** Google Sheets (live sync every 15 minutes)
> **Last Updated:** [Auto-updated by sync service]
```
- [ ] Create page sections (headers only):
  - [ ] 📊 Current Performance
  - [ ] 📈 Full Financial Model
  - [ ] 🎯 Scaling Scenarios
  - [ ] 🤖 LLM Cost Comparison
  - [ ] 💰 Unit Economics
  - [ ] 📉 Sensitivity Analysis
  - [ ] 📖 How to Use

**Acceptance Criteria:**
- ✅ Page created successfully
- ✅ Title and icon correct
- ✅ Description clear
- ✅ Structure defined

**Save:** Page ID to context.md

**Page ID:** `_________________` (fill in after creation)

---

### ✅ Task 2.2: Design Dashboard Layout
**Status:** ⬜ Not Started
**Effort:** M (30 min)
**Dependencies:** Task 2.1
**Priority:** P0 (Critical)

**Description:**
Add all content sections to dashboard with embedded Sheets.

**Section 1: Current Performance (Hero Metrics)**
Create 5 callout boxes in 2 rows:

Row 1:
- 💼 **Active Salons:** 5
- 💰 **Monthly Revenue:** 250,000₽
- 📈 **Net Profit:** 185,956₽

Row 2:
- 🎯 **Profit Margin:** 74.4%
- 👥 **Profit per Founder:** 92,978₽

**Section 2: Full Financial Model**
- [ ] Click "Embed" → "Google Sheets"
- [ ] Paste Sheets URL
- [ ] Set default view to "Scaling Scenarios" sheet
- [ ] Size: Full width

**Section 3: Scaling Scenarios Gallery**
Create inline table or cards:
```
1 Salon: 50K MRR, 36K profit (73% margin)
5 Salons: 250K MRR, 186K profit (74% margin)
15 Salons: 750K MRR, 552K profit (74% margin)
50 Salons: 2.5M MRR, 1.7M profit (68% margin)
100 Salons: 5M MRR, 3.2M profit (64% margin)
```

**Section 4: LLM Cost Comparison**
Create inline table from LLM Models sheet

**Section 5: Unit Economics**
Create waterfall diagram (text-based):
```
Revenue (50K)
  ↓ -Rev Share (10K)
  ↓ -LLM (459)
  ↓ -Acquiring (1,650)
  = Contribution Margin (37,891)
  ↓ -Infrastructure (999)
  = EBITDA (36,892)
  ↓ -Tax (500)
  = Net Profit (36,392) 💰
```

**Section 6: How to Use (Toggle)**
Collapsible section with quick guide

**Steps:**
- [ ] Create all 6 sections
- [ ] Add callout boxes
- [ ] Embed Google Sheets
- [ ] Add inline tables/cards
- [ ] Test on mobile (readable?)
- [ ] Add emojis for visual appeal

**Acceptance Criteria:**
- ✅ All sections created
- ✅ Sheets embedded correctly
- ✅ Mobile-responsive
- ✅ Visually appealing
- ✅ Load time < 3 seconds

---

### ✅ Task 2.3: Create Key Metrics Database (Optional)
**Status:** ⬜ Not Started
**Effort:** S (15 min)
**Dependencies:** Task 2.2
**Priority:** P2 (Low)

**Description:**
Create simple Notion database for synced metrics (prep for Phase 3).

**Database Schema:**
- Metric Name (Title)
- Value (Number)
- Unit (Select: ₽, %, #)
- Last Updated (Date)
- Category (Select: Business, Revenue, Profit, Efficiency)

**Initial Records:**
1. Active Salons | 5 | # | Business
2. MRR | 250,000 | ₽ | Revenue
3. Variable Costs | 60,545 | ₽ | Revenue
4. Fixed Costs | 999 | ₽ | Revenue
5. Net Profit | 185,956 | ₽ | Profit
6. Profit Margin | 74.4 | % | Efficiency
7. Profit per Salon | 37,191 | ₽ | Profit
8. Profit per Founder | 92,978 | ₽ | Profit
9. LLM Cost per Salon | 459 | ₽ | Revenue
10. Current LLM Model | Gemini 2.5 FL | - | Business

**Views:**
- Gallery view (big numbers for dashboard)
- Table view (for editing)

**Steps:**
- [ ] Create database with MCP
- [ ] Add 5 properties
- [ ] Create 10 records
- [ ] Configure Gallery view
- [ ] Embed in dashboard (top section)

**Acceptance Criteria:**
- ✅ Database created
- ✅ 10+ records populated
- ✅ Views configured
- ✅ Embedded in dashboard

**Note:** Will be auto-updated by sync service in Phase 3

**Database ID:** `_________________` (fill in after creation)

---

## 🔄 Phase 3: Sync Service Setup (2 hours)

### ✅ Task 3.1: Setup Google Sheets API
**Status:** ⬜ Not Started
**Effort:** M (45 min)
**Dependencies:** Phase 1 complete
**Priority:** P0 (Critical)

**Description:**
Configure Google Cloud project and Sheets API access.

**Steps:**

1. **Google Cloud Console:**
   - [ ] Go to console.cloud.google.com
   - [ ] Create new project: "AI Admin Financial Sync"
   - [ ] Enable APIs: Google Sheets API
   - [ ] Note project ID

2. **Service Account:**
   - [ ] IAM & Admin → Service Accounts
   - [ ] Create service account: "financial-sync-service"
   - [ ] Role: None (will use share-based access)
   - [ ] Create key (JSON)
   - [ ] Download JSON file
   - [ ] Save to: `config/google-service-account.json`
   - [ ] Add to `.gitignore`

3. **Share Sheets:**
   - [ ] Open Google Sheets
   - [ ] Share → Add people
   - [ ] Paste service account email (from JSON)
   - [ ] Access: Viewer
   - [ ] Uncheck "Notify people"

4. **Test Access:**
   - [ ] Create test script: `scripts/test-sheets-access.js`
   ```javascript
   const { google } = require('googleapis');
   const sheets = google.sheets('v4');

   // Test reading cell A1 from Parameters sheet
   // Should return "Parameter" (header)
   ```
   - [ ] Run: `node scripts/test-sheets-access.js`
   - [ ] Verify reads successfully

**Acceptance Criteria:**
- ✅ Google Cloud project created
- ✅ Service account created
- ✅ Credentials JSON saved securely
- ✅ Sheets shared with service account
- ✅ Test script reads successfully

**Environment Variables:**
```bash
GOOGLE_SHEETS_ID=<from-sheets-url>
GOOGLE_SERVICE_ACCOUNT_JSON=./config/google-service-account.json
```

**Save to `.env` file**

---

### ✅ Task 3.2: Build Sync Script
**Status:** ⬜ Not Started
**Effort:** L (60 min)
**Dependencies:** Tasks 3.1, 2.3
**Priority:** P0 (Critical)

**Description:**
Create Node.js script to sync Google Sheets → Notion.

**File:** `scripts/notion/sync-financial-metrics.js`

**Dependencies:**
```bash
npm install googleapis @notionhq/client dotenv
```

**Script Structure:**
```javascript
// 1. Imports
const { google } = require('googleapis');
const { Client } = require('@notionhq/client');
require('dotenv').config();

// 2. Initialize clients
const sheets = google.sheets('v4');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 3. Main functions
async function fetchSheetsData(sheetId, ranges) {
  // Read specific ranges from Sheets
  // Returns: { salons, mrr, profit, margin, ... }
}

async function transformData(sheetsData) {
  // Transform to Notion format
  // Returns: array of metric objects
}

async function updateNotionMetrics(databaseId, metricsData) {
  // Update or create records in Notion
  // Use upsert pattern (update if exists, create if not)
}

async function syncFinancialModel() {
  try {
    // 1. Fetch from Sheets (5 salons row)
    // 2. Transform data
    // 3. Update Notion
    // 4. Log success
  } catch (error) {
    // Log error
    // Send Telegram alert
    process.exit(1);
  }
}

// 4. Run
if (process.argv.includes('--dry-run')) {
  // Log data without writing
} else {
  syncFinancialModel();
}
```

**Data to Sync:**
From "Scaling Scenarios!A3:N3" (5 salons row):
- Column A: Salons (5)
- Column B: MRR (250,000)
- Column F: Variable Costs (60,545)
- Column H: Fixed Costs (999)
- Column K: Net Profit (185,956)
- Column L: Margin (0.744)
- Column N: Profit per Founder (92,978)

**Steps:**
- [ ] Create script file
- [ ] Install dependencies
- [ ] Implement `fetchSheetsData()`
- [ ] Implement `transformData()`
- [ ] Implement `updateNotionMetrics()`
- [ ] Implement `syncFinancialModel()`
- [ ] Add error handling:
  - [ ] Retry logic (3 attempts)
  - [ ] Detailed error logging
  - [ ] Telegram alert on failure
- [ ] Add `--dry-run` flag
- [ ] Test locally:
  - [ ] `node scripts/notion/sync-financial-metrics.js --dry-run`
  - [ ] `node scripts/notion/sync-financial-metrics.js`

**Acceptance Criteria:**
- ✅ Script fetches Sheets data
- ✅ Script updates Notion database
- ✅ Dry-run mode works
- ✅ Error handling robust
- ✅ Logging clear

**Validation:**
- [ ] Run dry-run: should log metrics without writing
- [ ] Run normally: should update Notion
- [ ] Check Notion: values match Sheets

---

### ✅ Task 3.3: Setup Automated Sync
**Status:** ⬜ Not Started
**Effort:** S (15 min)
**Dependencies:** Task 3.2
**Priority:** P1 (High)

**Description:**
Configure PM2 cron job for automatic syncing every 15 minutes.

**PM2 Config:**
Add to `ecosystem.config.js`:
```javascript
{
  name: "financial-sync",
  script: "scripts/notion/sync-financial-metrics.js",
  cron_restart: "*/15 8-23 * * *",  // Every 15 min, 8am-11pm
  autorestart: false,  // Cron handles scheduling
  error_file: "logs/financial-sync-error.log",
  out_file: "logs/financial-sync-out.log",
  time: true,  // Prefix logs with timestamp
  env: {
    NODE_ENV: "production"
  }
}
```

**Steps:**
- [ ] Update `ecosystem.config.js`
- [ ] SSH to server
- [ ] Deploy updated config
- [ ] Start PM2 service:
  ```bash
  pm2 start ecosystem.config.js --only financial-sync
  ```
- [ ] Verify cron schedule:
  ```bash
  pm2 info financial-sync
  ```
- [ ] Monitor first sync:
  ```bash
  pm2 logs financial-sync --lines 20
  ```
- [ ] Wait 15 minutes, check second sync
- [ ] Verify Notion updates

**Acceptance Criteria:**
- ✅ PM2 config updated
- ✅ Service running on server
- ✅ Cron schedule correct (*/15 8-23)
- ✅ Logs writing to files
- ✅ First 2 syncs successful

**Monitoring:**
- Check logs daily for first week
- Set up alert: if 3 consecutive failures, notify via Telegram

**Commands:**
```bash
# View logs
pm2 logs financial-sync --lines 50

# Check status
pm2 info financial-sync

# Restart if needed
pm2 restart financial-sync

# Stop
pm2 stop financial-sync
```

---

## ✅ Phase 4: Testing & Polish (30 min)

### ✅ Task 4.1: End-to-End Testing
**Status:** ⬜ Not Started
**Effort:** S (20 min)
**Dependencies:** All previous phases
**Priority:** P0 (Critical)

**Description:**
Comprehensive testing of entire system.

**Test Cases:**

**Test 1: Sheets → Notion Sync**
- [ ] Change price in Parameters: 50,000 → 55,000
- [ ] Note time of change
- [ ] Wait 15 minutes (or trigger sync manually)
- [ ] Check Notion dashboard
- [ ] Expected: MRR updated to 275,000₽ (55K × 5)
- [ ] Expected: All dependent metrics updated
- [ ] Result: ✅ / ❌

**Test 2: Formula Validation**
- [ ] Verify 5 salons scenario in Sheets:
  - [ ] MRR = 250,000₽ ✅ / ❌
  - [ ] Net Profit = 185,956₽ ✅ / ❌
  - [ ] Margin = 74.4% ✅ / ❌
- [ ] Compare to original Excel model
- [ ] All values match within ±1% ✅ / ❌

**Test 3: Edge Cases**
- [ ] Test 0 salons:
  - [ ] Should show negative profit (fixed costs only)
  - [ ] Infrastructure = 999₽ ✅ / ❌
- [ ] Test 1000 salons:
  - [ ] Formulas still calculate ✅ / ❌
  - [ ] No errors ✅ / ❌
- [ ] Test negative price (error handling):
  - [ ] Data validation prevents ✅ / ❌

**Test 4: Performance**
- [ ] Open Sheets:
  - [ ] Load time < 2 seconds ✅ / ❌
- [ ] Open Notion dashboard:
  - [ ] Load time < 3 seconds ✅ / ❌
- [ ] Run sync script:
  - [ ] Completion time < 10 seconds ✅ / ❌

**Test 5: Mobile View**
- [ ] Open Notion on mobile device
- [ ] Dashboard readable (no horizontal scroll) ✅ / ❌
- [ ] Callouts display correctly ✅ / ❌
- [ ] Embedded Sheets works ✅ / ❌

**Test 6: Error Recovery**
- [ ] Stop sync service
- [ ] Change value in Sheets
- [ ] Wait 30 minutes
- [ ] Restart sync service
- [ ] Notion updates within 15 min ✅ / ❌

**Acceptance Criteria:**
- ✅ All 6 test suites pass
- ✅ No critical bugs found
- ✅ Performance acceptable
- ✅ Mobile experience good

**Bug Log:**
If issues found, document in context.md and fix before marking complete.

---

### ✅ Task 4.2: Create User Guide
**Status:** ⬜ Not Started
**Effort:** S (10 min)
**Dependencies:** Task 4.1
**Priority:** P2 (Medium)

**Description:**
Write comprehensive guide for using the system.

**Location:** Add to Notion dashboard as collapsible toggle section

**Sections:**

**1. Overview**
```markdown
This financial model tracks AI Admin v2's unit economics and profitability
across different scales (1-100 salons). All calculations happen in Google
Sheets, with key metrics syncing to this Notion dashboard every 15 minutes.
```

**2. Quick Start (30 seconds)**
- Open dashboard (you're here!)
- View current metrics (top section)
- Click "Open in Sheets" to see full model

**3. Modifying Parameters**
- Open Google Sheets
- Go to "Business Parameters" tab
- Edit values (price, costs, etc.)
- Changes auto-sync to Notion within 15 minutes

**4. Adding Scenarios**
- Go to "Scaling Scenarios" tab
- Insert new row (e.g., 25 salons)
- Formulas auto-copy
- Manual: enter salon count in column A

**5. Interpreting Metrics**
- **MRR:** Monthly Recurring Revenue
- **Contribution Margin:** Revenue - Variable Costs
- **EBITDA:** Before tax profit
- **Margin %:** Net profit / Revenue

**6. Common Tasks**

*Change Pricing:*
1. Sheets → Business Parameters
2. Update "Price per Salon"
3. All scenarios recalculate automatically

*Compare LLM Models:*
1. Sheets → LLM Models tab
2. View cost per salon
3. Check Value Score (higher = better)
4. Update "Current" checkmark to change active model

*Export to PDF:*
1. Sheets → File → Download → PDF
2. Or: Notion → Export → PDF

**7. Troubleshooting**

*Notion not updating:*
- Check last updated time (should be < 15 min)
- Check sync service: `pm2 logs financial-sync`
- Manual trigger: `pm2 restart financial-sync`

*Formula errors:*
- Check cell references (cross-sheet links)
- Verify named ranges (CurrentLLMCost)
- Compare to backup

*Access issues:*
- Sheets: Check share settings
- Notion: Check page permissions

**8. Support**
Questions? Contact: [Your email/Telegram]

**Steps:**
- [ ] Write guide content
- [ ] Add to Notion as toggle section
- [ ] Format nicely (headings, bullets, code blocks)
- [ ] Add relevant links
- [ ] Test with team member (can they follow it?)

**Acceptance Criteria:**
- ✅ Guide complete (8 sections)
- ✅ Clear and concise
- ✅ All common questions answered
- ✅ Team member can use without help

---

## 🎉 Final Checklist

### Pre-Launch Verification
- [ ] All 15 tasks completed
- [ ] All formulas validated against original Excel model
- [ ] Sync running automatically (verified 3+ successful syncs)
- [ ] Team walkthrough completed
- [ ] Mobile view tested and working
- [ ] User guide written and accessible
- [ ] Backup of Sheets created (Download → .xlsx format)
- [ ] Documentation complete and up-to-date

### Post-Launch Monitoring (Week 1)
- [ ] Day 1: Check sync logs (every few hours)
- [ ] Day 2: Verify Notion dashboard accuracy
- [ ] Day 3: Collect team feedback
- [ ] Day 4-7: Monitor for errors
- [ ] End of week: Review success metrics

### Success Metrics
- [ ] Team uses dashboard daily
- [ ] Faster than opening Excel (< 3 sec load)
- [ ] Referenced in planning meetings
- [ ] Zero formula errors reported
- [ ] Stakeholders impressed with presentation

---

## 🚨 Known Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation | Status |
|------|-----------|--------|------------|--------|
| Google Sheets API limits (500 req/day) | Low | Medium | We use 96/day max (well within limit) | ✅ OK |
| Sync service fails | Medium | High | PM2 auto-restart + error alerts | 🔄 Monitored |
| Formula errors in Sheets | Medium | High | Validate against Excel before launch | ⬜ Pending |
| Team adoption resistance | Low | Medium | Beautiful UX + training | ⬜ Pending |
| Notion API rate limits (3 req/min) | Very Low | Low | We do 1 req/15min | ✅ OK |
| Data inconsistency | Low | High | Single source of truth (Sheets) | ✅ OK |

---

## 📝 Notes & Tips

### Implementation Best Practices

**Do:**
- ✅ Complete Phase 1 entirely before Phase 2
- ✅ Validate formulas early and often
- ✅ Test with `--dry-run` before live sync
- ✅ Take breaks between phases (3h of Sheets is intense!)
- ✅ Involve team early for feedback
- ✅ Document decisions in context.md

**Don't:**
- ❌ Skip formula validation
- ❌ Assume formulas work without testing edge cases
- ❌ Give edit access to Sheets to everyone
- ❌ Forget to save important IDs (Sheet, Page, Database)
- ❌ Deploy sync without testing locally first

### Common Pitfalls to Avoid
1. **Named ranges:** Don't forget to create "CurrentLLMCost" range
2. **Cell references:** Use absolute references ($B$2) for parameters
3. **Circular references:** Test each formula individually
4. **Tiered pricing:** IF statements must be nested correctly
5. **Sync timing:** Remember 15-min delay is intentional

### Time Saving Tips
- Use Sheets templates for similar formulas
- Copy-paste formulas down (adjust references)
- Test formulas in isolation first
- Keep Excel model open for validation
- Use ChatGPT/Claude for complex formulas

### Success Indicators
You'll know it's working when:
- ✅ Team opens Notion instead of Excel
- ✅ Dashboard loads instantly
- ✅ Metrics always current (< 15 min old)
- ✅ Used in stakeholder presentations
- ✅ Zero manual updates needed

---

## 📞 Emergency Contacts

**If sync breaks:**
1. Check PM2 logs: `pm2 logs financial-sync --err`
2. Manually trigger: `pm2 restart financial-sync`
3. Check Sheets API quota: Google Cloud Console
4. Contact: [Your contact info]

**If formulas break:**
1. Open backup Sheets (.xlsx file)
2. Compare formulas
3. Restore from backup if needed
4. Re-validate all scenarios

**For questions:**
- Documentation: `notion-financial-model-plan-v2.md`
- Context: `notion-financial-model-context.md`
- Critical review: `CRITICAL_REVIEW_REPORT.md`

---

## 🏆 Completion Celebration

When all tasks are done:
- [ ] Mark project as complete in dev/active/
- [ ] Move to dev/completed/ (optional)
- [ ] Share success with team
- [ ] Demo to stakeholders
- [ ] Write retrospective (what went well, what to improve)
- [ ] Deprecate old Excel model (archive, don't delete)

**Estimated Completion Date:** _______________

**Actual Completion Date:** _______________

**Total Time Spent:** _______________ hours

**Lessons Learned:** (Fill in after completion)
-
-
-

---

**Task Checklist Version:** 2.0
**Last Updated:** 2025-11-21
**Next Review:** After Phase 1 completion (or if blocked)

**Quick Stats:**
- Total Tasks: 15
- Completed: 0
- In Progress: 0
- Blocked: 0
- Remaining: 15

**Progress:** ⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ (0%)
