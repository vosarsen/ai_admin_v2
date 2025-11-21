# 📊 AI Admin Financial Model in Notion - Implementation Plan

**Last Updated:** 2025-11-21
**Project:** AI Admin v2 Financial Planning System
**Status:** Planning
**Priority:** High
**Estimated Duration:** 4-6 hours

---

## 📋 Executive Summary

Create a comprehensive, interactive financial model for AI Admin v2 directly in Notion using MCP (Model Context Protocol) integration. This will provide a centralized, visually appealing dashboard for financial planning, unit economics analysis, and scaling scenarios - all within the existing Notion workspace.

**Key Goals:**
- ✅ Centralized financial dashboard in Notion workspace
- ✅ Interactive databases for unit economics and scaling scenarios
- ✅ Real-time calculations using Notion formulas
- ✅ Beautiful visualizations for investor presentations
- ✅ Automatic synchronization with project management

**Why Notion over Google Sheets:**
- Already using Notion for all project documentation
- Better visual presentation for stakeholders
- Integrated with existing workflow
- MCP API enables automated creation
- Team collaboration in one place

---

## 🔍 Current State Analysis

### Existing Assets
1. **Comprehensive financial data:**
   - `AI_Admin_Financial_Model.md` (354 lines) - Complete 6-sheet model structure
   - `Financial_Model_QuickStart.md` (297 lines) - Quick start guide
   - `Inputs_Template.csv` - Business parameters and pricing
   - `Scaling_Template.csv` - Growth scenarios

2. **Notion Workspace:**
   - Active workspace: "Arsen Voskanyan's Notion"
   - Main page: "AI Admin" (ID: 1e00a520-3786-8028-bddf-ea03101cc4b9)
   - Existing databases: Projects, Tasks, Knowledge Base
   - MCP integration active and tested

3. **Business Metrics (Current):**
   - Price: 50,000₽/month per salon
   - Current clients: 5 salons
   - MRR: 250,000₽
   - Net profit: 185,956₽/month (74.4% margin)
   - LLM model: Gemini 2.5 Flash-Lite (459₽/salon/month)

### Limitations of Current Approach
- ❌ Financial data scattered across multiple markdown files
- ❌ No interactive dashboard for quick scenario analysis
- ❌ Manual calculations required for "what-if" scenarios
- ❌ Separate from project management workflow
- ❌ Not presentation-ready for investors

### Opportunity
Create automated Notion database structure using MCP that:
- Integrates financial planning with existing workspace
- Enables real-time scenario analysis
- Provides beautiful visualizations
- Syncs with project databases
- Ready for investor presentations

---

## 🎯 Proposed Future State

### Notion Database Structure

#### 1. 📊 **Financial Dashboard** (Main Page)
**Purpose:** Executive summary with key metrics
**Type:** Page with embedded databases
**Location:** Sub-page of "AI Admin" main page

**Components:**
- Hero metrics (current clients, MRR, profit, margin)
- LLM cost comparison chart
- Growth trajectory graph
- Quick links to detailed databases

#### 2. 💰 **Business Parameters** (Database)
**Purpose:** Centralized input variables
**Type:** Table database
**Properties:**
- Parameter (Title) - Name of variable
- Value (Number) - Current value
- Unit (Select) - ₽, %, USD, etc.
- Category (Select) - Business, LLM, Infrastructure, Taxes
- Editable (Checkbox) - Can users modify
- Notes (Text) - Description/explanation

**Initial Records:**
- Current salons: 5
- Price per salon: 50,000₽
- Rev share: 20%
- Founders: 2
- USD/RUB: 100
- Messages/salon/month: 9,000
- And 20+ more parameters

#### 3. 🤖 **LLM Models** (Database)
**Purpose:** Compare AI model costs and quality
**Type:** Table database with formulas
**Properties:**
- Model (Title) - Model name
- Price USD (Number) - Cost per 1M tokens
- Price RUB (Formula) - USD × exchange rate
- Cost per Salon (Formula) - Based on 9K messages
- Cost for 5 Salons (Formula)
- Cost for 50 Salons (Formula)
- Quality Score (Number) - 1-10 rating
- Value Score (Formula) - Quality / Price
- Current (Checkbox) - Active model

**Records:**
- Gemini 2.0 Flash-Lite ($3.44, 7.5/10)
- Gemini 2.5 Flash-Lite ($4.59, 8.0/10) ← Current
- OpenAI gpt-4o-mini ($6.89, 8.5/10)
- Gemini 2.5 Flash ($18.45, 9.0/10)
- Claude Haiku 3.5 ($39.60, 9.5/10)

#### 4. 📈 **Scaling Scenarios** (Database)
**Purpose:** Growth projections (1-100 salons)
**Type:** Table database with comprehensive formulas
**Properties:**
- Salons (Title/Number) - Number of clients
- MRR (Formula) - Monthly recurring revenue
- Rev Share Cost (Formula) - 20% to YClients
- LLM Cost (Formula) - Based on selected model
- Acquiring Cost (Formula) - Payment processing
- Variable Costs (Formula) - Total variable
- Infrastructure Cost (Formula) - VPS + DB (tiered)
- Team Cost (Number) - Salaries (when applicable)
- Fixed Costs (Formula) - Total fixed
- Profit Before Tax (Formula)
- Tax 1% (Formula) - IT льгота УСН
- Net Profit (Formula)
- Margin % (Formula)
- Profit per Salon (Formula)
- Profit per Founder (Formula)
- Infrastructure Tier (Select) - Current/Medium/Max/Enterprise

**Scenarios:**
- 1 salon (current state)
- 5 salons (current target)
- 15 salons (6-month goal)
- 50 salons (12-month goal)
- 100 salons (24-month vision)

#### 5. 📊 **Unit Economics** (Database)
**Purpose:** Detailed breakdown for 1 salon
**Type:** Table database
**Properties:**
- Line Item (Title) - Revenue/expense category
- Amount (Formula/Number) - Value in ₽
- Percentage (Formula) - % of revenue
- Category (Select) - Revenue/Variable/Fixed/Tax
- Description (Text) - Explanation

**Records:**
- Revenue: 50,000₽ (100%)
- Rev Share: -10,000₽ (-20%)
- LLM: -459₽ (-0.9%)
- Acquiring: -1,650₽ (-3.3%)
- Variable Total: -12,109₽ (-24.2%)
- Contribution Margin: 37,891₽ (75.8%)
- Infrastructure: -999₽ (-2%)
- Fixed Total: -999₽ (-2%)
- EBITDA: 36,892₽ (73.8%)
- Tax: -500₽ (-1%)
- Net Profit: 36,392₽ (72.8%)

#### 6. 📉 **Sensitivity Analysis** (Database)
**Purpose:** "What-if" scenarios
**Type:** Table database
**Properties:**
- Variable (Title) - What changes
- Scenario (Text) - Description
- Base Value (Number) - Current
- Test Value (Number) - New value
- Impact on Profit (Formula) - Change in ₽
- Impact % (Formula) - % change
- Category (Select) - Price/Costs/Growth

**Scenarios:**
- Price variation (30K-70K)
- Rev share variation (10%-30%)
- LLM model changes
- Growth rate impact

---

## 🔧 Implementation Phases

### Phase 1: Database Structure Setup (2 hours)

#### Task 1.1: Create Main Financial Dashboard Page
**Effort:** S (30 min)
**Dependencies:** None
**Acceptance Criteria:**
- [ ] New page created under "AI Admin" main page
- [ ] Title: "💰 Financial Model & Unit Economics"
- [ ] Icon and cover image set
- [ ] Description section explaining purpose
- [ ] Placeholder sections for embedded databases

**Implementation:**
```javascript
// MCP API call
mcp__notion__API-post-page({
  parent: { page_id: "1e00a520-3786-8028-bddf-ea03101cc4b9" },
  properties: {
    title: [{ text: { content: "💰 Financial Model & Unit Economics" }}]
  },
  icon: { emoji: "💰" }
})
```

#### Task 1.2: Create Business Parameters Database
**Effort:** M (45 min)
**Dependencies:** Task 1.1
**Acceptance Criteria:**
- [ ] Database created with 7 properties
- [ ] 25+ parameter records populated
- [ ] All formulas working
- [ ] Categories properly assigned
- [ ] Table and gallery views created

**Schema:**
| Property | Type | Formula/Config |
|----------|------|----------------|
| Parameter | Title | - |
| Value | Number | - |
| Unit | Select | ₽, %, USD, Number |
| Category | Select | Business, LLM, Infrastructure, Taxes |
| Editable | Checkbox | - |
| Used By | Relation | → Scaling Scenarios |
| Notes | Rich Text | - |

#### Task 1.3: Create LLM Models Database
**Effort:** M (30 min)
**Dependencies:** Task 1.2
**Acceptance Criteria:**
- [ ] Database created with 10 properties
- [ ] 5 LLM models populated
- [ ] Formulas calculate costs correctly
- [ ] Value score formula working
- [ ] Current model marked

**Key Formulas:**
```javascript
// Price RUB
prop("Price USD") * [USD/RUB from Parameters]

// Cost per Salon (9000 messages)
prop("Price RUB")

// Value Score
prop("Quality Score") / prop("Price USD") * 10
```

#### Task 1.4: Create Scaling Scenarios Database
**Effort:** L (45 min)
**Dependencies:** Tasks 1.2, 1.3
**Acceptance Criteria:**
- [ ] Database created with 15+ properties
- [ ] 5 scenarios (1, 5, 15, 50, 100 salons)
- [ ] All revenue formulas working
- [ ] All cost formulas working
- [ ] Profit calculations accurate
- [ ] Infrastructure tier auto-selection

**Complex Formulas:**
```javascript
// MRR
prop("Salons") * [Price from Parameters]

// LLM Cost
prop("Salons") * [Selected LLM Cost per Salon]

// Infrastructure Cost
if(prop("Salons") <= 5,
  999,  // Current tier
  if(prop("Salons") <= 15,
    3150,  // Medium tier
    if(prop("Salons") <= 50,
      9135,  // Max tier
      22500   // Enterprise tier
    )
  )
)

// Net Profit
prop("MRR") - prop("Variable Costs") - prop("Fixed Costs") - prop("Tax")
```

---

### Phase 2: Data Population & Formulas (1.5 hours)

#### Task 2.1: Populate Business Parameters
**Effort:** S (20 min)
**Dependencies:** Task 1.2
**Acceptance Criteria:**
- [ ] All 25+ parameters entered
- [ ] Values match `Inputs_Template.csv`
- [ ] Categories assigned
- [ ] Notes added for complex parameters

**Parameters to Add:**
- Business: Price (50K), Rev Share (20%), Founders (2)
- LLM: USD/RUB (100), Messages (9K)
- Infrastructure: VPS tiers, DB tiers, Discounts
- Taxes: УСН IT (1%), УСН Regular (5%), Acquiring rates

#### Task 2.2: Test and Validate Formulas
**Effort:** M (40 min)
**Dependencies:** All Phase 1 tasks
**Acceptance Criteria:**
- [ ] All formulas return expected values
- [ ] No circular dependencies
- [ ] Edge cases handled (0 salons, 1000 salons)
- [ ] Formulas match Excel/Sheets calculations
- [ ] Documentation of formula logic

**Validation Tests:**
| Scenario | Expected Result | Actual | Status |
|----------|----------------|--------|--------|
| 5 salons MRR | 250,000₽ | | |
| 5 salons net profit | 185,956₽ | | |
| 5 salons margin | 74.4% | | |
| LLM Flash-Lite cost/salon | 459₽ | | |
| Break-even | 1 salon | | |

#### Task 2.3: Create Unit Economics Database
**Effort:** M (30 min)
**Dependencies:** Task 2.2
**Acceptance Criteria:**
- [ ] All line items from Excel model
- [ ] Formulas pulling from Parameters
- [ ] Percentages calculating correctly
- [ ] Categories assigned
- [ ] Table view sorted by category

---

### Phase 3: Visualization & UX (1.5 hours)

#### Task 3.1: Design Dashboard Layout
**Effort:** M (30 min)
**Dependencies:** All Phase 2 tasks
**Acceptance Criteria:**
- [ ] Hero section with 4 key metrics
- [ ] Database embeds configured
- [ ] Toggle sections for detailed views
- [ ] Color-coded callouts
- [ ] Mobile-responsive layout

**Dashboard Structure:**
```markdown
# 💰 Financial Model & Unit Economics

> Last updated: {date}
> Current clients: 5 | MRR: 250,000₽ | Margin: 74.4%

## 📊 At a Glance
[Callout boxes with key metrics]

## 🎯 Scaling Scenarios
[Embed: Scaling Scenarios database - Gallery view]

## 🤖 LLM Cost Comparison
[Embed: LLM Models database - Table view]

## 📉 Unit Economics
[Embed: Unit Economics database - Board view by category]

## ⚙️ Parameters
[Embed: Business Parameters - Table view]
```

#### Task 3.2: Create Database Views
**Effort:** M (40 min)
**Dependencies:** Task 3.1
**Acceptance Criteria:**
- [ ] Scaling: Table, Gallery, Timeline views
- [ ] LLM: Table with conditional formatting
- [ ] Unit Economics: Board by category
- [ ] Parameters: Table + Gallery
- [ ] Filters and sorts configured

**View Configurations:**

**Scaling Scenarios:**
- Table: All columns, sorted by Salons ascending
- Gallery: Cards showing Salons, MRR, Net Profit, Margin
- Timeline: Growth trajectory by Salons

**LLM Models:**
- Table: All columns, conditional color by Value Score
  - Green: Value Score > 15
  - Yellow: Value Score 10-15
  - Red: Value Score < 10

#### Task 3.3: Add Conditional Formatting
**Effort:** S (20 min)
**Dependencies:** Task 3.2
**Acceptance Criteria:**
- [ ] Profit values color-coded
- [ ] Margin percentages highlighted
- [ ] Current selections marked
- [ ] Warnings for low margins

---

### Phase 4: Advanced Features (1 hour)

#### Task 4.1: Create Sensitivity Analysis
**Effort:** M (30 min)
**Dependencies:** Phase 3 complete
**Acceptance Criteria:**
- [ ] Database for "what-if" scenarios
- [ ] Price sensitivity (30K-70K)
- [ ] Rev share impact (10%-30%)
- [ ] LLM model comparison
- [ ] Growth rate scenarios

#### Task 4.2: Add Relations & Rollups
**Effort:** M (30 min)
**Dependencies:** Task 4.1
**Acceptance Criteria:**
- [ ] Parameters ↔ Scaling Scenarios relation
- [ ] LLM Models → Scaling Scenarios relation
- [ ] Rollups showing impact
- [ ] Bidirectional links working

---

### Phase 5: Testing & Documentation (30 min)

#### Task 5.1: Comprehensive Testing
**Effort:** S (15 min)
**Dependencies:** All previous phases
**Acceptance Criteria:**
- [ ] All formulas validated against Excel model
- [ ] Edge cases tested (0, 1, 1000 salons)
- [ ] Mobile view checked
- [ ] Load time acceptable (<3 sec)
- [ ] No broken links

**Test Cases:**
1. Change price from 50K to 60K → verify all scenarios update
2. Switch LLM model → verify costs recalculate
3. Add new scenario (e.g., 25 salons) → verify formulas work
4. Modify parameter → check all dependent databases
5. Export to PDF → verify formatting

#### Task 5.2: Create User Guide
**Effort:** S (15 min)
**Dependencies:** Task 5.1
**Acceptance Criteria:**
- [ ] Quick start instructions
- [ ] How to modify scenarios
- [ ] Formula explanations
- [ ] Common tasks documented
- [ ] Troubleshooting section

**Guide Sections:**
1. Overview & Navigation
2. How to Use Each Database
3. Modifying Parameters
4. Creating New Scenarios
5. Understanding Formulas
6. Exporting Data

---

## ⚠️ Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Notion formula limitations | Medium | High | Test complex formulas early; fallback to manual calculations |
| MCP API rate limits | Low | Medium | Batch create records; implement retries |
| Formula circular dependencies | Medium | High | Careful planning of calculation order |
| Performance with many records | Low | Low | Limit scenarios to essential ones |
| Lost formatting on mobile | Low | Low | Test mobile view regularly |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Team adoption resistance | Low | Medium | Create intuitive UX; provide training |
| Data accuracy concerns | Medium | High | Validate against Excel; document assumptions |
| Over-complexity | Medium | Medium | Start simple; add features incrementally |
| Maintenance burden | Low | Low | Clear documentation; simple formulas |

---

## 📊 Success Metrics

### Quantitative
- ✅ All formulas calculate correctly (100% accuracy vs Excel model)
- ✅ Page load time < 3 seconds
- ✅ 5 scaling scenarios created
- ✅ 25+ business parameters populated
- ✅ 5 LLM models compared
- ✅ Mobile-responsive (tested on phone/tablet)

### Qualitative
- ✅ Visually appealing dashboard
- ✅ Intuitive navigation
- ✅ Useful for decision-making
- ✅ Ready for investor presentations
- ✅ Team can use without training
- ✅ Integrated with existing workflow

### Adoption
- ✅ Used weekly for planning
- ✅ Replaces Excel spreadsheet
- ✅ Shared with stakeholders
- ✅ Referenced in meetings

---

## 🛠️ Required Resources

### Technical
- ✅ Notion workspace (existing)
- ✅ MCP API access (configured)
- ✅ Claude Code with Notion MCP (ready)
- ⬜ Notion database templates
- ⬜ Formula reference guide

### Data Sources
- ✅ `Inputs_Template.csv` - Business parameters
- ✅ `Scaling_Template.csv` - Growth scenarios
- ✅ `AI_Admin_Financial_Model.md` - Formula logic
- ✅ LLM pricing data (already compiled)

### Human Resources
- Developer (you + Claude Code): 4-6 hours
- Review/Testing (Arsen + Arbak): 1 hour
- No external dependencies

---

## 📅 Timeline Estimates

### By Phase

| Phase | Estimated Time | Dependencies |
|-------|---------------|--------------|
| Phase 1: Database Structure | 2 hours | None |
| Phase 2: Data & Formulas | 1.5 hours | Phase 1 |
| Phase 3: Visualization | 1.5 hours | Phase 2 |
| Phase 4: Advanced Features | 1 hour | Phase 3 |
| Phase 5: Testing & Docs | 0.5 hours | Phase 4 |
| **Total** | **6.5 hours** | Sequential |

### By Task Size

| Size | Count | Total Time |
|------|-------|------------|
| S (Small: 15-30 min) | 6 tasks | 1.5 hours |
| M (Medium: 30-45 min) | 8 tasks | 5 hours |
| L (Large: 45-60 min) | 1 task | 1 hour |
| **Total** | **15 tasks** | **7.5 hours** |

### Realistic Schedule

**Option A: Single Session (Recommended)**
- Day 1 (6 hours): Complete all phases
- Benefit: Momentum, context retention
- Risk: Fatigue, rushing

**Option B: Spread Over 2 Days**
- Day 1 (3 hours): Phases 1-2 (Structure + Data)
- Day 2 (3 hours): Phases 3-5 (UX + Features + Testing)
- Benefit: Fresh perspective, time to think
- Risk: Context switching cost

**Option C: Iterative (3 Sessions)**
- Session 1 (2 hours): Phase 1 (MVP databases)
- Session 2 (2 hours): Phases 2-3 (Data + UX)
- Session 3 (2 hours): Phases 4-5 (Advanced + Polish)
- Benefit: Incremental value, feedback loops
- Risk: Longer calendar time

---

## 📦 Deliverables

### Primary
1. **Notion Financial Dashboard** - Main page with embedded databases
2. **5 Notion Databases:**
   - Business Parameters
   - LLM Models
   - Scaling Scenarios
   - Unit Economics
   - Sensitivity Analysis (optional)
3. **User Guide** - How to use the system
4. **Formula Documentation** - Logic and calculations

### Secondary
1. Migration guide from Excel/Sheets (if needed)
2. Templates for new scenarios
3. Integration with existing Project database
4. Export templates (PDF/CSV)

---

## 🔗 Dependencies

### External
- None (fully self-contained)

### Internal
- Notion workspace access ✅
- MCP integration configured ✅
- Financial data compiled ✅
- Business parameters defined ✅

### Blockers
- None identified

---

## 📝 Notes & Considerations

### Notion Formula Limitations
1. **No VLOOKUP/HLOOKUP:** Use relations + rollups instead
2. **Limited array operations:** Single-row formulas only
3. **No regex:** Text matching limited to contains/starts with
4. **Performance:** Complex formulas may slow page load

### Workarounds
- Use relations for cross-database lookups
- Break complex formulas into multiple properties
- Leverage rollups for aggregations
- Keep formula complexity reasonable

### Future Enhancements
1. **Integration with CRM:** Link to salon database
2. **Automated reports:** Weekly profit summaries
3. **Forecasting:** ML-based growth predictions
4. **API sync:** Update from actual billing data
5. **Team permissions:** Read-only for some users

---

## ✅ Checklist for Completion

- [ ] All 5 databases created in Notion
- [ ] Dashboard page designed and published
- [ ] Formulas validated against Excel model
- [ ] User guide written
- [ ] Mobile view tested
- [ ] Team walkthrough completed
- [ ] Excel/Sheets deprecated (if applicable)
- [ ] Backed up (Notion export)

---

**Ready to begin implementation!**
