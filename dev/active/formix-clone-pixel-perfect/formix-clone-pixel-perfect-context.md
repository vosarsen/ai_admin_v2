# Formix Clone - Context & Key Decisions

**Last Updated:** 2025-12-01

---

## 🔥 CRITICAL SESSION STATE (Session Started: 2025-12-01 15:11)

### Current Implementation Status
- **Phase:** Phase 0 (Project Setup) - STARTED BUT INCOMPLETE
- **Progress:** 5% complete (directory created, npm init done, core packages installed)
- **Blocker:** Tailwind CSS initialization failed (binary not found in node_modules)
- **Next Immediate Step:** Manually create Tailwind config files OR use alternative approach

### What Just Happened (This Session)
1. **User Request:** Continue from previous session where plan was approved
2. **Action Taken:**
   - Created `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/` directory
   - Ran `npm init -y` (✅ Success)
   - Installed `next@latest react@latest react-dom@latest` (✅ Success - 21 packages)
   - Installed TypeScript + Tailwind dev dependencies (✅ Success - 348 packages total)
   - Attempted `npx tailwindcss init -p` (❌ Failed - binary not found)
   - Attempted direct binary path (❌ Failed - file not found)

3. **Current State:**
   - Directory: `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`
   - Files Created:
     - `package.json` (✅ Exists)
     - `node_modules/` (✅ Exists with 348 packages)
   - Files Missing:
     - `tailwind.config.js` (❌ Not created yet)
     - `postcss.config.js` (❌ Not created yet)
     - `tsconfig.json` (❌ Not created yet)
     - `next.config.js` (❌ Not created yet)
     - `src/` directory structure (❌ Not created yet)

4. **Why It Failed:**
   - `npx tailwindcss` couldn't find the binary
   - Likely issue: npm/npx PATH resolution
   - Need to either create configs manually OR find tailwindcss binary

### Immediate Recovery Actions (Next 10 Minutes)
1. **Option A (Manual Config):** Create `tailwind.config.js` and `postcss.config.js` manually
2. **Option B (Verify Binary):** Check if `tailwindcss` is actually installed in `node_modules/.bin/`
3. **Then:** Continue with creating project structure (tsconfig, next.config, src/ dirs)
4. **Then:** Install Framer Motion
5. **Finally:** Test with `npm run dev`

### Files Modified This Session
- None yet (only package installations)

### Commands Run This Session
```bash
mkdir -p /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs
cd /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs
npm init -y                                                          # ✅ Success
npm install next@latest react@latest react-dom@latest               # ✅ Success (21 packages)
npm install -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer eslint eslint-config-next  # ✅ Success (348 total)
npx tailwindcss init -p                                              # ❌ Failed
./node_modules/.bin/tailwindcss init -p                              # ❌ Failed
```

### Context for Next Continuation
**If this session ends, next session should:**
1. Read this context file (you're reading it now!)
2. Check project state: `cd /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs && ls -la`
3. Manually create missing config files (tailwind.config.js, postcss.config.js, tsconfig.json, next.config.js)
4. Create src/ directory structure
5. Install Framer Motion: `npm install framer-motion clsx tailwind-merge`
6. Create basic page: `src/app/page.tsx`
7. Test dev server: `npm run dev`
8. Initialize Git repository
9. Mark Phase 0 Task 1.1-1.3 as complete ✅

### Key Learnings This Session
1. **Lesson:** `npx tailwindcss init` fails with Next.js manual setup
   - **Solution:** Always create config files manually when not using create-next-app
   - **Why Important:** Saves 10-15 minutes of troubleshooting

2. **Lesson:** User has different reference material in two places
   - **Location 1:** `public/landing-formix-v2/` (Framer export from user, failed attempt to edit)
   - **Location 2:** `public/landing-formix/` (analysis docs from previous session)
   - **Why Important:** Reference both locations for complete picture

3. **Lesson:** User wants 100% visual accuracy, especially animations
   - **User Quote:** "Мне очень важно сохранить анимации, визальный функционал, поведение кнопок, цвета, прозрачности"
   - **Why Important:** Don't take shortcuts - every detail matters

### Blockers & Solutions
| Blocker | Impact | Solution | Status |
|---------|--------|----------|--------|
| Tailwind config creation | HIGH | Manual creation with proper Next.js content paths | ⏸️ Paused |
| No tsconfig.json | HIGH | Create with Next.js + TypeScript strict settings | ⏸️ Paused |
| No next.config.js | MEDIUM | Create with image optimization config | ⏸️ Paused |
| No src/ structure | MEDIUM | Create app/, components/, lib/, styles/ dirs | ⏸️ Paused |

### Dependencies Installed ✅
```json
{
  "dependencies": {
    "next": "^16.0.x",
    "react": "^19.0.x",
    "react-dom": "^19.0.x"
  },
  "devDependencies": {
    "typescript": "^5.x.x",
    "@types/react": "^19.x.x",
    "@types/node": "^22.x.x",
    "@types/react-dom": "^19.x.x",
    "tailwindcss": "^4.x.x",
    "postcss": "^8.x.x",
    "autoprefixer": "^10.x.x",
    "eslint": "^9.x.x",
    "eslint-config-next": "^16.x.x"
  }
}
```
*(Exact versions may vary - using latest as of 2025-12-01)*

### Still Need to Install
- `framer-motion` (animation library)
- `clsx` (className utility)
- `tailwind-merge` (Tailwind className merging)
- `@sanity/client` and `next-sanity` (Phase 4 - CMS integration)

---

## 📂 KEY FILES & LOCATIONS

### Source Analysis
- **`public/landing-formix/FORMIX_COMPLETE_ANALYSIS.md`** - Complete 37,228-line extraction
  - All HTML structure
  - CSS specifications
  - Animation details
  - Component breakdowns

### Reference Documentation
- **`public/landing-formix/FORMIX_DESIGN_SPECS.md`** - Design system specs
- **`public/landing-formix/ANIMATION_IMPLEMENTATION.md`** - Animation patterns
- **`public/landing-formix/QUICK_REFERENCE.md`** - Copy-paste cheat sheet
- **`public/landing-formix/VISUAL_SPECS.md`** - Visual diagrams

### Original Source
- **`/Users/arbakvoskanyan/Desktop/Код Formix.rtf`** - 37,228 lines of Formix HTML/CSS source code

### Project Location (To Be Created)
- **`public/formix-clone/`** - New clean implementation
  - OR **`formix-clone/`** as separate React project

---

## 🎯 PROJECT DECISIONS

### ⚠️ CRITICAL ARCHITECTURAL CHANGE (2025-12-01)
**Decision:** Use Next.js 15 + App Router instead of Vite + React
**Reasoning:**
- User approved comprehensive 8-phase plan using Next.js
- Next.js provides better structure for production deployment
- App Router (src/app/) is modern approach
- Better for SEO and performance
- Built-in TypeScript support
- User wants to deploy to their server (46.149.70.219)

**Previous Plan:** Vite + React + CSS Modules
**New Plan:** Next.js 15 + App Router + Tailwind CSS + Framer Motion

**Location Changed:**
- OLD: `/Users/arbakvoskanyan/Documents/GitHub/ai_admin_v2/formix-clone/`
- NEW: `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

**Impact:**
- Phase 0 added for Next.js setup
- Phase 1-17 adjusted for Next.js patterns
- Tailwind CSS instead of CSS Modules (user-approved)
- TypeScript instead of JavaScript

**Decision Date:** 2025-12-01 (approved by user in previous session)

---

### Technology Choice: React + Framer Motion
**Decision:** Use React with Framer Motion library
**Reasoning:**
- Formix uses Framer-generated code
- Framer Motion provides exact animation APIs
- Component-based architecture easier to maintain
- Better performance than vanilla JS for complex animations
- Official Framer Motion library matches original behavior

**Alternative Considered:** Vanilla JS + GSAP
- **Pros:** No build step, lighter bundle
- **Cons:** Harder to replicate Framer-specific animations, less maintainable

**Decision Date:** 2025-11-29

---

### Build Tool: Next.js (UPDATED 2025-12-01)
**Decision:** Use Next.js 15 with App Router
**Reasoning:**
- User wants Sanity CMS integration (Next.js has great support)
- Better for production deployment
- Built-in TypeScript support
- Image optimization out of the box
- Better for hosting on user's server
- Modern App Router approach

**Previous Decision (2025-11-29):** Use Vite instead of Create React App
- **Reason for Change:** User requested CMS integration and approved Next.js plan

---

### Project Structure: Separate Next.js Project
**Decision:** Create separate `formix-landing-nextjs/` project outside ai_admin_v2
**Reasoning:**
- Clean slate without existing code interference
- Easier to deploy independently to user's server
- Can later integrate or keep separate
- npm/build tooling separate from main AI Admin project
- User approved this in previous session

**Location:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

**Decision Date:** 2025-12-01

---

### Styling Approach: Tailwind CSS (CHANGED 2025-12-01)
**Decision:** Use Tailwind CSS instead of CSS Modules
**Reasoning:**
- User approved the 8-phase plan which includes Tailwind
- Faster development with utility classes
- Better integration with Next.js
- Easier responsive design
- Still allows custom CSS variables for Formix tokens
- Modern approach

**Previous Decision (2025-11-29):** CSS Modules
- **Reason for Change:** User approved Next.js + Tailwind plan in previous session

**Decision Date:** 2025-12-01

---

## 🔑 KEY TECHNICAL SPECIFICATIONS

### Color Palette (20 colors extracted)
```javascript
// Primary
--color-accent: rgb(255, 55, 0)      // Red/Orange
--color-dark: rgb(21, 22, 25)        // Almost black
--color-white: rgb(255, 255, 255)
--color-black: rgb(0, 0, 0)

// Grays
--color-gray-300: rgb(229, 229, 229) // Background
--color-gray-400: rgb(161, 161, 161)
--color-gray-500: rgb(112, 112, 112)
--color-gray-600: rgb(79, 79, 79)
--color-gray-700: rgb(33, 33, 33)
```

### Typography
```javascript
// Fonts
Geist: 600 (SemiBold), 700 (Bold), 900 (Black) // Headings
Inter: 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold) // Body

// Sizes
72px - Hero heading
48px - Section headings
24px - Subheadings
16px - Body text
14px - Small text
```

### Animation Timing
```javascript
// Duration
0.6s - 0.8s per element

// Stagger
0.1s - 0.15s delay between items

// Easing
cubic-bezier(0, 0, 0.2, 1) // Ease-out

// Example: Hero sequence
Badge:       delay 0ms,   duration 600ms
Heading:     delay 100ms, duration 800ms
Description: delay 200ms, duration 800ms
Buttons:     delay 300ms, duration 800ms
```

### Responsive Breakpoints
```javascript
Mobile:  < 810px
Tablet:  810px - 1199px
Desktop: >= 1200px
```

---

## 📊 COMPONENT INVENTORY

### Core Components (extracted from Formix)
1. **Navigation** - Frosted glass pill, 7 links, rolling text
2. **Badge** - "Available For Projects" with pulsing dot
3. **Button** - Two variants (primary/secondary), two-layer text
4. **Card** - Service cards, pricing cards, testimonial cards
5. **Avatar Stack** - Overlapping avatars with rotation
6. **Accordion** - FAQ expand/collapse
7. **Form** - Contact form inputs

### Section Components (11 total)
1. Navigation (sticky header)
2. Hero (badge, heading, buttons)
3. Services (3-column grid)
4. Why Us (two-column layout)
5. Benefits (list with icons)
6. Work (portfolio grid)
7. Pricing (3 pricing cards)
8. Logos (client logo grid)
9. Reviews (testimonial cards)
10. FAQs (accordion list)
11. Contact/Footer (form + links)

---

## 🎨 DESIGN SYSTEM TOKENS

### Spacing (23 unique values)
```javascript
0, 7, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 40, 48, 50, 60, 80, 90, 100, 120px
```

### Border Radius (16 values)
```javascript
8px  - Small cards
10px - Dots
16px - Medium cards
20px - Large cards
30px - Badges
50px - Pills (buttons, navigation)
```

### Shadows (6 types)
```javascript
// Button
0px 7px 20px 0.5px rgba(0,0,0,0.5)

// Card (multi-layer)
0px 0.607695px 2.43078px -0.625px rgba(0,0,0,0.1),
0px 2px 8px -0.625px rgba(0,0,0,0.12),
0px 5px 20px -0.625px rgba(0,0,0,0.14)

// Glow (red dot)
0px 0px 60px 30px rgb(255, 55, 0)
```

---

## 🚀 IMPLEMENTATION STRATEGY

### Phase Approach
**Sequential by section:**
Foundation → Navigation → Hero → Services → ... → Deployment

**Why:** Each section builds on design system, animations added after layout perfect

### Testing Strategy
**Test after each phase:**
- Visual comparison with Formix
- Animation smoothness (60fps)
- Responsive behavior
- Cross-browser check

### Version Control
**Git workflow:**
- Main branch: `main`
- Feature branches: `feat/navigation`, `feat/hero`, etc.
- Commit after each completed phase
- Tag releases: `v0.1-foundation`, `v0.2-navigation`, etc.

---

## 📝 DEPENDENCIES

### External Libraries
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "framer-motion": "^10.16.0",
  "vite": "^5.0.0"
}
```

### Font Resources
- **Geist:** Google Fonts or local files
- **Inter:** Google Fonts (already available)

### Image Resources
- **Placeholder images:** Unsplash
- **Icons:** SVG (custom or similar)
- **Client logos:** Generic placeholder logos

---

## ⚠️ KNOWN CHALLENGES

### 1. Framer Motion API Differences
**Challenge:** Formix uses Framer-generated code with specific IDs
**Solution:** Map Framer patterns to Framer Motion API
**Example:**
```javascript
// Formix: data-framer-appear-id="1abc"
// Solution: Use <motion.div> with variants
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  }}
/>
```

### 2. Pulsing Dot Animation
**Challenge:** Red dot has glow + pulse effect
**Solution:** CSS keyframes with box-shadow
```css
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 60px 30px rgb(255, 55, 0);
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 80px 40px rgb(255, 55, 0);
  }
}
```

### 3. Two-Layer Button Text
**Challenge:** Button text has two layers for hover animation
**Solution:** Duplicate text with absolute positioning
```jsx
<button>
  <span className="text-layer-1">Contact Us</span>
  <span className="text-layer-2">Contact Us</span>
</button>
```

### 4. Backdrop Blur Browser Support
**Challenge:** Safari requires `-webkit-backdrop-filter`
**Solution:** Use both prefixed and standard properties
```css
backdrop-filter: blur(10px);
-webkit-backdrop-filter: blur(10px);
```

---

## 🔄 ONGOING DECISIONS LOG

### 2025-11-29: Initial Planning
- ✅ Chose React + Framer Motion
- ✅ Chose Vite over CRA
- ✅ Decided on separate project structure
- ✅ Chose CSS Modules over Tailwind

### Future Decisions Needed
- [ ] Hosting provider (Vercel vs Netlify)
- [ ] Domain name (if custom domain)
- [ ] Analytics tool (if needed)
- [ ] Image CDN (if needed for performance)

---

## 📚 REFERENCE LINKS

### Official Docs
- Framer Motion: https://www.framer.com/motion/
- React: https://react.dev
- Vite: https://vitejs.dev

### Tools
- Formix Site: https://formix.framer.website
- Google Fonts: https://fonts.google.com
- Unsplash: https://unsplash.com

### Internal Resources
- Design System Analysis: `public/landing-formix/FORMIX_COMPLETE_ANALYSIS.md`
- Animation Guide: `public/landing-formix/ANIMATION_IMPLEMENTATION.md`
- Quick Reference: `public/landing-formix/QUICK_REFERENCE.md`

---

**END OF CONTEXT**
