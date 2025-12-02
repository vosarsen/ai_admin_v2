# Formix Landing Redesign - Project Overview

**Status:** 📋 Planning Complete | 🔨 Ready to Build
**Timeline:** 12-16 hours estimated
**Target:** Create pixel-perfect Formix-inspired landing in separate directory

---

## 📁 Project Files

- **`formix-landing-redesign-plan.md`** - Comprehensive 6-phase strategic plan (32 pages)
- **`formix-landing-redesign-context.md`** - Key decisions, dependencies, technical details
- **`formix-landing-redesign-tasks.md`** - Detailed task checklist with 71 trackable items
- **`README.md`** - This file (quick reference)

---

## 🎯 Quick Start

### 1. Read the Plan
```bash
open dev/active/formix-landing-redesign/formix-landing-redesign-plan.md
```

Key sections:
- **Executive Summary** - Project goals and success criteria
- **Phase 1-6** - Step-by-step implementation guide
- **Design System** - Complete color/typography/spacing tokens
- **Timeline** - 4-5 day schedule

### 2. Understand the Context
```bash
open dev/active/formix-landing-redesign/formix-landing-redesign-context.md
```

Important notes:
- **Why separate directory?** Safe experimentation, A/B testing
- **Technical decisions** - Vanilla JS, modular CSS, self-hosted fonts
- **Performance targets** - Lighthouse 90+, <1.5s FCP
- **Rollback strategy** - If things go wrong

### 3. Track Progress
```bash
open dev/active/formix-landing-redesign/formix-landing-redesign-tasks.md
```

- [x] = Done
- [ ] = To do
- Current progress: 0/71 tasks (0%)

---

## 🚀 Implementation Phases

### Phase 1: Foundation (2-3 hours)
Create project structure, integrate fonts, set up CSS architecture

### Phase 2: Core Components (3-4 hours)
Build navigation, buttons, cards

### Phase 3: Animations (3-4 hours)
Implement scroll animations, custom cursor, transitions

### Phase 4: Content (2-3 hours)
Build hero, features, FAQ sections

### Phase 5: Polish (2-3 hours)
Responsive testing, performance optimization, cross-browser

### Phase 6: Deploy (1-2 hours)
Nginx config, Git workflow, documentation

---

## 📊 Key Metrics

### Design System
- **Colors:** Light neutral (#f0f0f0) with orange accent (#ff3700)
- **Fonts:** Geist (headings) + Inter (body)
- **Layout:** 1270px max-width, 810px/1200px breakpoints
- **Spacing:** 10/20/35/50/80px scale

### Performance Targets
- Lighthouse Score: ≥90
- First Contentful Paint: ≤1.5s
- Time to Interactive: ≤3s
- Total Bundle: <900KB

### Quality Standards
- 100% responsive (320px - 2560px)
- WCAG 2.1 AA accessibility
- Cross-browser (Chrome, Firefox, Safari, Edge)
- Zero console errors

---

## 🛠️ Development Workflow

### 1. Create Branch
```bash
git checkout -b feature/formix-redesign
```

### 2. Build Incrementally
Follow phases 1-6, mark tasks as complete

### 3. Test Frequently
```bash
# Run local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/public/landing-formix/
```

### 4. Deploy
```bash
# Commit changes
git add public/landing-formix/
git commit -m "feat: implement phase X"

# Push and create PR
git push origin feature/formix-redesign

# After merge, deploy to server
ssh -i ~/.ssh/id_ed25519_ai_admin root@46.149.70.219 \
  "cd /opt/ai-admin && git pull origin main"
```

---

## 📚 Reference Links

- **Formix Original:** https://formix.framer.website
- **Plan Document:** `formix-landing-redesign-plan.md`
- **Context Document:** `formix-landing-redesign-context.md`
- **Tasks Checklist:** `formix-landing-redesign-tasks.md`

---

## ✅ Before Starting Checklist

- [ ] Read full plan document
- [ ] Understand technical decisions in context doc
- [ ] Download Geist and Inter fonts
- [ ] Create Git branch
- [ ] Set up local development environment
- [ ] Take Formix screenshots (all breakpoints) for reference

---

## 🎨 Design Tokens Reference

```css
/* Quick reference - Full tokens in plan document */

/* Colors */
--color-bg-primary: #f0f0f0;
--color-text-primary: #151619;
--color-accent: #ff3700;

/* Typography */
--font-heading: 'Geist', sans-serif;
--font-body: 'Inter', sans-serif;

/* Spacing */
--space-sm: 20px;
--space-md: 35px;
--space-lg: 50px;

/* Breakpoints */
--breakpoint-mobile: 810px;
--breakpoint-desktop: 1200px;
```

---

## 📞 Need Help?

- Check `formix-landing-redesign-context.md` for technical decisions
- Review `formix-landing-redesign-tasks.md` for detailed steps
- Refer to `formix-landing-redesign-plan.md` for comprehensive guidance

---

**Created:** 2025-11-28
**Status:** Ready to Execute
**Next Action:** Create Git branch and begin Phase 1
