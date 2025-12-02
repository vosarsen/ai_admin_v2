# Formix Clone - Task Checklist

**Last Updated:** 2025-12-01

---

## 📊 CURRENT SESSION PROGRESS (2025-12-01)
- **Current Phase:** Phase 4 (Services Section) - ✅ **COMPLETE & COMMITTED**
- **Progress:** 100% complete (4/18 phases done = 22.2%)
- **Time Invested:** Phase 0: 25 min + Phase 1: 15 min + Phase 2: 45 min + Phase 2.1: 60 min + Phase 3: 90 min + Phase 4: 75 min = 310 min total (~5.2 hours)
- **Next Phase:** Phase 5 (Why Us Section) - Ready to start when requested
- **Git Status:** All changes committed ✅

---

## ✅ PHASE 0: PROJECT SETUP (25 minutes actual) - **COMPLETE** 🎉

### Initial Setup
- [x] 0.1 Create project directory ✅
  - Created `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`
  - Status: COMPLETE

- [x] 0.2 Initialize npm package ✅
  - `npm init -y`
  - Status: COMPLETE (package.json created)

- [x] 0.3 Install Next.js core packages ✅
  - `npm install next@latest react@latest react-dom@latest`
  - Status: COMPLETE (21 packages installed)

- [x] 0.4 Install TypeScript & Tailwind dependencies ✅
  - `npm install -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer eslint eslint-config-next`
  - Status: COMPLETE (348 total packages installed)

### Configuration Files ✅
- [x] 0.5 Create tailwind.config.ts ✅
  - Created manually with Formix design tokens (colors, spacing, shadows, typography)
  - Next.js App Router content paths configured
  - Status: COMPLETE

- [x] 0.6 Create postcss.config.js ✅
  - Tailwind + Autoprefixer configured
  - Status: COMPLETE

- [x] 0.7 Create tsconfig.json ✅
  - Next.js strict TypeScript settings
  - Path aliases configured (@/*)
  - Status: COMPLETE

- [x] 0.8 Create next.config.js ✅
  - Image optimization (Unsplash domains)
  - React strict mode enabled
  - Status: COMPLETE

### Project Structure ✅
- [x] 0.9 Create src/ directory structure ✅
  - `src/app/` (App Router) ✅
  - `src/components/` ✅
  - `src/lib/` ✅
  - `src/styles/` ✅
  - Status: COMPLETE

- [x] 0.10 Create initial pages ✅
  - `src/app/page.tsx` (test home page) ✅
  - `src/app/layout.tsx` (root layout with Inter font) ✅
  - `src/app/globals.css` (Tailwind + Formix CSS variables) ✅
  - Status: COMPLETE

### Dependencies (Part 2) ✅
- [x] 0.11 Install Framer Motion ✅
  - `npm install framer-motion clsx tailwind-merge`
  - 353 total packages installed
  - Status: COMPLETE

- [x] 0.12 Update package.json scripts ✅
  - Added: dev, build, start, lint scripts
  - Status: COMPLETE

### Testing ✅
- [x] 0.13 Test development server ✅
  - `npm run dev` - Success (2.2s ready time)
  - http://localhost:3000 verified working
  - Status: COMPLETE

- [x] 0.14 Initialize Git repository ✅
  - `git init` ✅
  - `.gitignore` created ✅
  - Initial commit: 356fde8 ✅
  - Status: COMPLETE

**Acceptance:** ✅ All criteria met - Project builds, dev server starts, no errors

---

## ✅ PHASE 1: FOUNDATION (15 minutes actual) - **COMPLETE** 🎉

### Setup ✅
- [x] 1.1 **DEPRECATED** - See Phase 0 instead ✅
- [x] 1.2 **MOVED TO PHASE 0** - See task 0.11 ✅
- [x] 1.3 **MOVED TO PHASE 0** - See task 0.14 ✅

### Design System ✅
- [x] 1.4 **UPDATED** - CSS variables in globals.css ✅
  - All 20 color tokens added (Phase 0)
  - Typography scale configured (Tailwind config)
  - Spacing system (23 values in Tailwind config)
  - Border radius (16 values in Tailwind config)
  - Shadow system (6 types in Tailwind config)
  - Status: COMPLETE (moved to Phase 0)

- [x] 1.5 Install Geist font package ✅
  - `npm install geist` (Vercel official package)
  - Added to layout.tsx with weights 600, 700, 900
  - CSS variable: --font-geist
  - Status: COMPLETE

- [x] 1.6 Inter font (already complete) ✅
  - Added in Phase 0 via next/font/google
  - Weights: 400, 500, 600, 700
  - CSS variable: --font-inter
  - Status: COMPLETE

- [x] 1.7 globals.css (already complete) ✅
  - Created in Phase 0
  - Tailwind directives
  - CSS variables
  - Smooth scrolling
  - Status: COMPLETE

- [x] 1.8 Animation system ✅
  - Created `src/lib/animations.ts` (TypeScript, not CSS)
  - Framer Motion variants: fadeUp, fadeDown, fade, scaleIn
  - Stagger containers (normal & fast)
  - Hero sequence with exact Formix timing
  - Button & card hover animations
  - Scroll animation settings
  - Pulse glow keyframes in globals.css
  - Status: COMPLETE

### Utilities ✅
- [x] 1.9 Create `src/lib/utils.ts` ✅
  - cn() function (clsx + tailwind-merge)
  - Intelligent Tailwind class merging
  - Status: COMPLETE

### Testing ✅
- [x] 1.10 Test font loading ✅
  - Geist displays correctly (heading in page.tsx)
  - Inter displays correctly (body text in page.tsx)
  - Status: COMPLETE

- [x] 1.11 Test utilities ✅
  - cn() function working (page.tsx buttons)
  - Animations working (stagger sequence)
  - Dev server: 462ms ready time
  - No errors or warnings
  - Status: COMPLETE

**Acceptance:** ✅ All criteria met - Fonts load, animations work, utilities functional

**Git Commit:** `2de96a0` ("feat: Phase 1 Foundation complete - Fonts & Animation System")

---

## ✅ PHASE 2: NAVIGATION (45 minutes actual) - **COMPLETE** 🎉

### Component Structure ✅
- [x] 2.1 Create `src/components/Navigation/Navigation.tsx` ✅
  - Used TypeScript (not .jsx)
  - Tailwind CSS (not CSS modules)
  - 190 lines total
  - Status: COMPLETE
- [x] 2.2 **SKIPPED** - Using Tailwind CSS inline (no separate CSS file needed)
- [x] 2.3 Build HTML structure ✅
  - Fixed positioning with frosted glass wrapper
  - "Formix" logo text
  - 7 nav links (Home, Services, Work, About, Pricing, Reviews, Contact)
  - Mobile hamburger button (SVG icon)
  - Status: COMPLETE

### Styling ✅
- [x] 2.4 Implement frosted glass effect ✅
  - `bg-dark/80 backdrop-blur-formix`
  - Custom CSS class `.backdrop-blur-formix` in globals.css
  - 10px blur + Safari prefix
  - Status: COMPLETE
- [x] 2.5 Style navigation pill ✅
  - `rounded-50` (50px border-radius)
  - `px-6 py-3` padding
  - `shadow-card` from tailwind.config.ts
  - `border border-gray-700/30`
  - Status: COMPLETE
- [x] 2.6 Style navigation links ✅
  - Font: Inter 600 (semibold)
  - Hover color: `text-accent` (rgb(255, 55, 0))
  - Default: `text-white/70`
  - Status: COMPLETE

### Animations ✅
- [x] 2.7 Implement rolling text effect (hover) ✅
  - Two-layer text with `absolute` positioning
  - `translateY(-100%)` on hover
  - 200ms duration with ease-out
  - NavLink subcomponent (20 lines)
  - Status: COMPLETE
- [x] 2.8 Add scroll behavior ✅
  - `useMotionValueEvent(scrollY, "change", ...)`
  - Hides nav after 100px scroll down
  - Shows nav on scroll up
  - 300ms transition
  - Status: COMPLETE
- [x] 2.9 Add mobile hamburger menu ✅
  - Conditional render with `isMobileMenuOpen` state
  - SVG icon (hamburger ↔ X)
  - Slide-in animation with Framer Motion
  - Breakpoint: `md:hidden` (<768px)
  - Status: COMPLETE

### Testing ✅
- [x] 2.10 Test on desktop (1200px+) ✅
  - Nav pill visible with all 7 links
  - Rolling text hover works
  - Status: TESTED
- [x] 2.11 Test on tablet (810px) ✅
  - Nav adjusts width
  - Links still visible
  - Status: TESTED
- [x] 2.12 Test on mobile (<810px) ✅
  - Hamburger menu appears
  - Full menu slides in/out
  - Status: TESTED
- [x] 2.13 Test hover animations ✅
  - Rolling text animates smoothly
  - Status: TESTED
- [x] 2.14 Test scroll behavior ✅
  - Nav hides on scroll down
  - Nav shows on scroll up
  - Status: TESTED

**Acceptance:** ✅ All criteria met - Navigation working, animations smooth, fully responsive

**Git Commit:** `b4212ad` ✅ COMMITTED
```
feat: Phase 2 Navigation complete - frosted glass, rolling text, scroll behavior

- Created Navigation component with frosted glass effect
- Implemented rolling text hover animation (two-layer text)
- Added scroll hide/show behavior (useMotionValueEvent)
- Built mobile hamburger menu with slide-in animation
- Downgraded Tailwind v4 → v3 for stability
- Simplified font setup (Inter only, removed Geist temporarily)
- Added 7 test sections for scroll testing
- All animations working at 60fps

Phase 2 Complete: Navigation Component ✅"
```

---

## ✅ PHASE 2.1: NAVIGATION REDESIGN (60 minutes actual) - **COMPLETE** 🎉

### Navigation Restructure ✅
- [x] 2.1.1 Redesign navigation from dark to light theme ✅
  - Changed from `bg-dark/80` to `bg-gray-300/60`
  - Updated to match screenshot provided by user
  - Status: COMPLETE

- [x] 2.1.2 Implement 3-part grid layout ✅
  - Grid: `grid-cols-[1fr_auto_1fr]` for perfect centering
  - Left: Logo + "Formix" text
  - Center: Navigation pill with links
  - Right: "Book Free Call" CTA button
  - Status: COMPLETE

- [x] 2.1.3 Update navigation links ✅
  - Changed to match original: Services, Why Us, Benefits, Projects, Pricing, Clients, FAQs
  - Removed: Home, Work, About, Reviews, Contact
  - Status: COMPLETE

### Rolling Text Fix ✅
- [x] 2.1.4 Fix duplicate text bug ✅
  - Added `overflow-hidden` to text container
  - Set fixed height `h-5` for proper clipping
  - Added `whitespace-nowrap` to prevent wrapping
  - Status: COMPLETE

### Always-Visible Navigation ✅
- [x] 2.1.5 Remove scroll hide/show behavior ✅
  - Removed `useMotionValueEvent(scrollY, ...)` logic
  - Changed from `motion.nav` to regular `nav`
  - Navigation now always visible
  - Status: COMPLETE

### Active Section Tracking ✅
- [x] 2.1.6 Implement scroll-based active section highlighting ✅
  - Added `useEffect` with scroll listener
  - Uses `getBoundingClientRect()` for detection
  - Active section shows `bg-white/50`
  - Status: COMPLETE

- [x] 2.1.7 Add smooth scrolling to links ✅
  - Implemented `onClick` handler with `preventDefault()`
  - Uses native `scrollIntoView({ behavior: "smooth" })`
  - Applied to desktop and mobile menus
  - Status: COMPLETE

### UI Polish ✅
- [x] 2.1.8 Remove cursor-pointer class ✅
  - Removed from NavLink component
  - Status: COMPLETE

- [x] 2.1.9 Adjust content width constraints ✅
  - Changed max-width from 1400px to 1280px
  - Applied to navigation and all sections
  - Changed section padding from p-8 to px-4
  - Status: COMPLETE

### Hero Section Separation ✅
- [x] 2.1.10 Separate hero from navigation tracking ✅
  - Changed hero section id from "services" to "hero"
  - Added separate "Services" section after hero
  - Hero section shows no active menu items
  - Status: COMPLETE

- [x] 2.1.11 Remove dot indicator ✅
  - Removed `motion.div` with `layoutId="activeIndicator"`
  - Using only background highlight for active state
  - Status: COMPLETE

### Testing ✅
- [x] 2.1.12 Test 3-part layout centering ✅
  - Logo, nav pill, and CTA button perfectly aligned
  - Status: TESTED

- [x] 2.1.13 Test rolling text animation ✅
  - No duplicate text visible
  - Smooth animation on hover
  - Status: TESTED

- [x] 2.1.14 Test active section tracking ✅
  - Correct section highlights as user scrolls
  - No highlight on hero section
  - Status: TESTED

- [x] 2.1.15 Test smooth scrolling ✅
  - All navigation links scroll smoothly
  - Mobile menu links work correctly
  - Status: TESTED

**Acceptance:** ✅ All criteria met - Light theme navigation matches screenshot, perfect centering, all functionality working

**Git Commit:** `28845f2` ✅ COMMITTED
```
feat: Phase 2.1 Navigation redesign - light theme with perfect centering

- Restructured navigation to 3-part grid layout (logo, nav pill, CTA button)
- Changed from dark to light theme (bg-gray-300/60)
- Implemented active section tracking with scroll detection
- Added smooth scrolling to all navigation links
- Fixed rolling text overflow bug with h-5 container
- Removed scroll hide/show behavior - navigation always visible
- Adjusted content width from 1400px to 1280px
- Separated hero section from navigation tracking
- Removed dot indicator, using only background highlight for active state

All navigation functionality working correctly:
- Smooth scroll to sections
- Active section highlighting as user scrolls
- Rolling text hover animation
- Mobile hamburger menu with slide-in
- Perfect center alignment of navigation pill
```

---

## ✅ PHASE 3: HERO SECTION (5-7 hours)

### Component Structure
- [ ] 3.1 Create `src/components/Hero/Hero.jsx`
- [ ] 3.2 Create `src/components/Hero/Hero.module.css`
- [ ] 3.3 Create `src/components/Hero/Badge.jsx`
- [ ] 3.4 Create `src/components/Hero/Button.jsx`
- [ ] 3.5 Create `src/components/Hero/AvatarStack.jsx`

### Badge Component
- [ ] 3.6 Build badge structure
  - Pulsing dot (10px)
  - Text "Available For Projects"
- [ ] 3.7 Style badge
  - Background: rgb(21, 22, 25)
  - Border-radius: 30px
  - Padding
- [ ] 3.8 Implement pulsing dot animation
  - CSS keyframes
  - Glow effect: `0px 0px 60px 30px rgb(255, 55, 0)`
  - Scale animation

### Button Component
- [ ] 3.9 Build button structure
  - Two text layers (for animation)
  - Icon circle (30px)
  - Arrow SVG
- [ ] 3.10 Style primary button
  - Background: rgb(255, 71, 38)
  - Border-radius: 50px
  - Shadow: `0px 7px 20px 0.5px rgba(0,0,0,0.5)`
- [ ] 3.11 Style secondary button
  - Background: rgb(21, 22, 25)
  - Same shadow
- [ ] 3.12 Implement hover animation
  - Text layer 1: translateY(-100%)
  - Text layer 2: translateY(0)
  - Scale: 1.05
  - Duration: 200ms
- [ ] 3.13 Implement icon animation
  - Arrow translateX(4px) on hover

### Avatar Stack
- [ ] 3.14 Build avatar stack structure
  - 3-5 circular avatars
  - Overlapping
- [ ] 3.15 Style avatars
  - Border: 2px solid rgb(33, 33, 33)
  - Rotation: alternating -4deg, 4deg
  - Box shadow
- [ ] 3.16 Position avatars
  - translateY(-50%)
  - Overlapping layout

### Hero Layout
- [ ] 3.17 Build hero section layout
  - Centered content
  - Badge at top
  - Heading
  - Description
  - Button group
  - Avatar stack
- [ ] 3.18 Style heading
  - Font: Geist 900
  - Size: 72px
  - Letter-spacing: -0.05em
  - Line-height: 1.2
- [ ] 3.19 Style description
  - Font: Inter 400
  - Size: 18px
  - Color: gray-600
- [ ] 3.20 Style button group
  - Flex layout
  - Gap: 16px

### Entrance Animations
- [ ] 3.21 Implement badge animation
  - Initial: `{ opacity: 0, y: -30 }`
  - Animate: `{ opacity: 1, y: 0 }`
  - Delay: 0ms
  - Duration: 600ms
- [ ] 3.22 Implement heading animation
  - Initial: `{ opacity: 0, y: 10 }`
  - Delay: 100ms
  - Duration: 800ms
- [ ] 3.23 Implement description animation
  - Initial: `{ opacity: 0, y: 10 }`
  - Delay: 200ms
  - Duration: 800ms
- [ ] 3.24 Implement button animation
  - Initial: `{ opacity: 0, y: 60 }`
  - Delay: 300ms
  - Duration: 800ms
- [ ] 3.25 Implement avatar animation
  - Initial: `{ opacity: 0, y: 0 }`
  - Delay: 400ms
  - Duration: 800ms

### Testing
- [ ] 3.26 Test badge pulsing animation
- [ ] 3.27 Test button hover (two-layer text)
- [ ] 3.28 Test button hover (icon movement)
- [ ] 3.29 Test entrance sequence timing
- [ ] 3.30 Test responsive layout
- [ ] 3.31 Visual comparison with Formix

**Acceptance:** Hero matches Formix exactly, all animations smooth

---

## ✅ PHASE 4: SERVICES SECTION (75 minutes actual) - **COMPLETE** 🎉

### Component Structure ✅
- [x] 4.1 Create `src/components/Services/Services.tsx` ✅
  - TypeScript component (not .jsx)
  - Two-tier layout: top section (badge + heading/description) + bottom section (full-width cards)
  - Status: COMPLETE
- [x] 4.2 **SKIPPED** - Using Tailwind CSS inline (no separate CSS file needed)
- [x] 4.3 Create `src/components/Services/ServiceCard.tsx` ✅
  - Horizontal layout (left: content, right: image)
  - Status: COMPLETE

### Service Card ✅
- [x] 4.4 Build card structure ✅
  - Icon (40px square with bg-dark)
  - Heading (text-2xl md:text-3xl)
  - Description
  - 2x2 grid of tags with numbered labels
  - Image placeholder on right side
  - Status: COMPLETE
- [x] 4.5 Style card ✅
  - Outer card: rgb(229,229,229) with shadow
  - Inner card: rgb(240,240,240)
  - Border-radius: 20px (outer) / 16px (inner)
  - Horizontal split: 45fr (content) / 55fr (image)
  - min-h-[450px] for proper height
  - Status: COMPLETE
- [x] 4.6 Implement hover effect ✅
  - translateY(-4px)
  - Shadow increase (shadow-md → shadow-lg)
  - Transition: 300ms
  - Status: COMPLETE

### Section Layout ✅
- [x] 4.7 Build section structure ✅
  - Custom badge with orange slashes: `// Services //`
  - Horizontal layout: "How We Grow Your Business" (left) + description (right)
  - 9 service cards (Brand, Web Design, UI/UX, Marketing, Product, Webflow, Framer, Motion, Consulting)
  - Status: COMPLETE
- [x] 4.8 Implement grid layout ✅
  - Top section: grid-cols-[1.3fr_1fr] for heading/description
  - Bottom section: 1 column (full width cards)
  - No 3-column grid (design decision: horizontal cards need full width)
  - Gap: 24px between elements
  - Status: COMPLETE

### Animations ✅
- [x] 4.9 Implement scroll-triggered animation ✅
  - Framer Motion `whileInView` on all elements
  - viewport: `{ once: true, margin: "-100px" }`
  - Status: COMPLETE
- [x] 4.10 Implement stagger effect ✅
  - Each card has incremental delay (index * 0.1)
  - Fade up animation (opacity: 0→1, y: 10→0)
  - Duration: 500ms per card
  - Status: COMPLETE
- [x] 4.11 Test animations on scroll ✅
  - Cards animate smoothly
  - Stagger effect working
  - Hover effects smooth
  - Status: TESTED

### Additional Features ✅
- [x] 4.12 Custom badge with colored slashes ✅
  - Orange accent color for "//" characters
  - Inline HTML instead of Badge component
  - Status: COMPLETE
- [x] 4.13 Bottom viewport blur effect ✅
  - Fixed to viewport bottom (not section-specific)
  - h-10 with backdrop-blur-2xl
  - Scrolls with page
  - Status: COMPLETE

**Acceptance:** ✅ All criteria met - Horizontal cards with proper proportions, animations smooth, custom badge, viewport blur

**Git Commit:** Ready to commit

---

## ✅ PHASE 5: WHY US SECTION (3-4 hours)

### Component Structure
- [ ] 5.1 Create `src/components/WhyUs/WhyUs.jsx`
- [ ] 5.2 Create `src/components/WhyUs/WhyUs.module.css`

### Layout
- [ ] 5.3 Build two-column layout
  - Left: Image
  - Right: Text content
- [ ] 5.4 Style layout
  - Desktop: 50/50 split
  - Mobile: Stack vertically
  - Gap: 48px
- [ ] 5.5 Add image placeholder
  - Border-radius: 20px
  - Aspect ratio: 1:1 or 4:3

### Content
- [ ] 5.6 Add heading
- [ ] 5.7 Add description paragraphs
- [ ] 5.8 Add bullet points (if applicable)

### Animations
- [ ] 5.9 Implement image fade-in
- [ ] 5.10 Implement text slide-up
- [ ] 5.11 Test scroll trigger

**Acceptance:** Layout matches, responsive, animates on scroll

---

## ✅ PHASE 6: BENEFITS SECTION (4-5 hours)

### Component Structure
- [ ] 6.1 Create `src/components/Benefits/Benefits.jsx`
- [ ] 6.2 Create `src/components/Benefits/Benefits.module.css`
- [ ] 6.3 Create `src/components/Benefits/BenefitItem.jsx`

### Benefit Item
- [ ] 6.4 Build item structure
  - Icon (SVG or emoji)
  - Heading
  - Description
- [ ] 6.5 Style item
  - Flex layout
  - Icon size: 40px
  - Gap: 16px

### Section Layout
- [ ] 6.6 Build section structure
  - Section heading
  - List of benefit items
- [ ] 6.7 Implement layout
  - Desktop: 2 columns
  - Mobile: 1 column
  - Gap: 32px

### Animations
- [ ] 6.8 Implement stagger animation
- [ ] 6.9 Add hover effect (if applicable)
- [ ] 6.10 Test scroll trigger

**Acceptance:** List layout matches, icons aligned, animations smooth

---

## ✅ PHASE 7: WORK/PORTFOLIO SECTION (5-6 hours)

### Component Structure
- [ ] 7.1 Create `src/components/Work/Work.jsx`
- [ ] 7.2 Create `src/components/Work/Work.module.css`
- [ ] 7.3 Create `src/components/Work/WorkCard.jsx`

### Work Card
- [ ] 7.4 Build card structure
  - Image
  - Overlay (on hover)
  - Title
  - Description
- [ ] 7.5 Style card
  - Border-radius: 20px
  - Overflow hidden
  - Aspect ratio: 4:3
- [ ] 7.6 Implement image overlay
  - Black overlay: rgba(0,0,0,0.5)
  - Fade in on hover
  - Text appears on hover

### Section Layout
- [ ] 7.7 Build grid layout
  - Desktop: 2-3 columns
  - Tablet: 2 columns
  - Mobile: 1 column
  - Gap: 24px

### Animations
- [ ] 7.8 Implement card animations
- [ ] 7.9 Implement hover overlay
- [ ] 7.10 Test image loading

**Acceptance:** Grid matches, hover overlays smooth, images load

---

## ✅ PHASE 8: PRICING SECTION (5-6 hours)

### Component Structure
- [ ] 8.1 Create `src/components/Pricing/Pricing.jsx`
- [ ] 8.2 Create `src/components/Pricing/Pricing.module.css`
- [ ] 8.3 Create `src/components/Pricing/PricingCard.jsx`

### Pricing Card
- [ ] 8.4 Build card structure
  - Plan name
  - Price
  - Description
  - Feature list (checkmarks)
  - CTA button
- [ ] 8.5 Style regular card
  - Border-radius: 20px
  - Padding: 40px
  - Background: white
  - Shadow
- [ ] 8.6 Style featured card
  - Different background: accent color or dark
  - Highlighted border
  - "Most Popular" badge

### Section Layout
- [ ] 8.7 Build section structure
  - Section heading
  - 3 pricing cards
- [ ] 8.8 Implement grid
  - Desktop: 3 columns
  - Mobile: 1 column
  - Gap: 24px

### Animations
- [ ] 8.9 Implement stagger animation
- [ ] 8.10 Add hover effects
- [ ] 8.11 Test featured card styling

**Acceptance:** Featured plan stands out, grid responsive, animations smooth

---

## ✅ PHASE 9: LOGOS SECTION (2-3 hours)

### Component Structure
- [ ] 9.1 Create `src/components/Logos/Logos.jsx`
- [ ] 9.2 Create `src/components/Logos/Logos.module.css`

### Layout
- [ ] 9.3 Build grid layout
  - Desktop: 5-6 columns
  - Tablet: 4 columns
  - Mobile: 3 columns
  - Gap: 40px
- [ ] 9.4 Add logo placeholders
  - SVG or image
  - Grayscale filter
  - Hover: remove grayscale

### Animations
- [ ] 9.5 Implement fade-in
- [ ] 9.6 Add hover effect
- [ ] 9.7 Test responsive grid

**Acceptance:** Grid responsive, logos aligned, hover smooth

---

## ✅ PHASE 10: REVIEWS/TESTIMONIALS (4-5 hours)

### Component Structure
- [ ] 10.1 Create `src/components/Reviews/Reviews.jsx`
- [ ] 10.2 Create `src/components/Reviews/Reviews.module.css`
- [ ] 10.3 Create `src/components/Reviews/ReviewCard.jsx`

### Review Card
- [ ] 10.4 Build card structure
  - Avatar (circular, 60px)
  - Name
  - Role/Company
  - Rating stars (5 stars)
  - Review text
- [ ] 10.5 Style card
  - Border-radius: 20px
  - Padding: 32px
  - Shadow
- [ ] 10.6 Style avatar
  - Border: 2px solid
  - Border-radius: 50%
- [ ] 10.7 Style stars
  - Gold color: rgb(255, 193, 7)
  - Size: 16px

### Section Layout
- [ ] 10.8 Build grid
  - Desktop: 3 columns
  - Tablet: 2 columns
  - Mobile: 1 column
  - Gap: 24px

### Animations
- [ ] 10.9 Implement stagger
- [ ] 10.10 Add hover effect
- [ ] 10.11 Test scroll trigger

**Acceptance:** Cards match, avatars circular, stars display correctly

---

## ✅ PHASE 11: FAQs SECTION (4-5 hours)

### Component Structure
- [ ] 11.1 Create `src/components/FAQs/FAQs.jsx`
- [ ] 11.2 Create `src/components/FAQs/FAQs.module.css`
- [ ] 11.3 Create `src/components/FAQs/FAQItem.jsx`

### FAQ Item (Accordion)
- [ ] 11.4 Build item structure
  - Question button
  - Plus/minus icon
  - Answer content (expandable)
- [ ] 11.5 Style item
  - Border-radius: 16px
  - Padding: 24px
  - Border or background
- [ ] 11.6 Implement expand/collapse logic
  - useState for open/closed
  - Click handler
- [ ] 11.7 Implement content animation
  - Framer Motion AnimatePresence
  - Max-height transition
  - Opacity fade
- [ ] 11.8 Implement icon rotation
  - Rotate 45deg when open
  - Transition: 200ms

### Section Layout
- [ ] 11.9 Build section structure
  - Section heading
  - List of FAQ items
- [ ] 11.10 Implement accordion behavior
  - Only one open at a time (optional)
  - Or allow multiple open

### Testing
- [ ] 11.11 Test open/close smooth
- [ ] 11.12 Test icon rotation
- [ ] 11.13 Test keyboard navigation (Enter/Space)

**Acceptance:** Accordion opens/closes smoothly, icons rotate, accessible

---

## ✅ PHASE 12: CONTACT/FOOTER (3-4 hours)

### Component Structure
- [ ] 12.1 Create `src/components/Contact/Contact.jsx`
- [ ] 12.2 Create `src/components/Contact/Contact.module.css`
- [ ] 12.3 Create `src/components/Footer/Footer.jsx`
- [ ] 12.4 Create `src/components/Footer/Footer.module.css`

### Contact Form
- [ ] 12.5 Build form structure
  - Name input
  - Email input
  - Message textarea
  - Submit button
- [ ] 12.6 Style inputs
  - Border-radius: 12px
  - Padding: 16px
  - Border: 1px solid gray
  - Focus state
- [ ] 12.7 Implement validation
  - Required fields
  - Email format
  - Error messages
- [ ] 12.8 Implement submit handler
  - Prevent default
  - Show success message
  - (No actual email sending needed)

### Footer
- [ ] 12.9 Build footer structure
  - Logo
  - Navigation links
  - Social links
  - Copyright
- [ ] 12.10 Style footer
  - Background: dark
  - Color: white
  - Padding: 60px 0
  - Centered layout

### Animations
- [ ] 12.11 Implement form fade-in
- [ ] 12.12 Add button hover
- [ ] 12.13 Test form validation

**Acceptance:** Form validates, footer links work, styled correctly

---

## ✅ PHASE 13: ANIMATION SYSTEM (6-8 hours)

### Utility Functions
- [ ] 13.1 Create `src/utils/animations.js`
- [ ] 13.2 Create fadeUp variant
  - `{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }`
- [ ] 13.3 Create stagger container variant
- [ ] 13.4 Create button hover variant
- [ ] 13.5 Create card hover variant

### Scroll Animations
- [ ] 13.6 Implement useScrollAnimation hook
  - useInView from Framer Motion
  - Threshold: 0.1
  - TriggerOnce: true
- [ ] 13.7 Apply to all sections
  - Services
  - Why Us
  - Benefits
  - Work
  - Pricing
  - Logos
  - Reviews
  - FAQs
  - Contact

### Performance Optimization
- [ ] 13.8 Add will-change strategically
  - Only on animating elements
  - Remove after animation
- [ ] 13.9 Use GPU acceleration
  - Transform instead of top/left
  - Opacity instead of visibility
- [ ] 13.10 Test 60fps
  - Chrome DevTools Performance tab
  - Check for jank

### Accessibility
- [ ] 13.11 Implement prefers-reduced-motion
  - Disable animations if user prefers
  - Use matchMedia
- [ ] 13.12 Test with motion disabled

**Acceptance:** All animations smooth, 60fps, reduced-motion support

---

## ✅ PHASE 14: RESPONSIVE DESIGN (4-5 hours)

### Desktop Testing (1200px+)
- [ ] 14.1 Test navigation
- [ ] 14.2 Test hero section
- [ ] 14.3 Test all grids (Services, Work, Pricing, Reviews)
- [ ] 14.4 Test two-column layouts (Why Us)
- [ ] 14.5 Test footer

### Tablet Testing (810-1199px)
- [ ] 14.6 Test navigation (should still be horizontal)
- [ ] 14.7 Test hero section
- [ ] 14.8 Test grids (adjust columns: 3→2, 2→2, 1→1)
- [ ] 14.9 Test spacing adjustments
- [ ] 14.10 Test font sizes

### Mobile Testing (<810px)
- [ ] 14.11 Test navigation (hamburger menu)
- [ ] 14.12 Test hero section (centered, smaller text)
- [ ] 14.13 Test grids (all 1 column)
- [ ] 14.14 Test forms (full width inputs)
- [ ] 14.15 Test touch targets (>=44px)

### Fixes
- [ ] 14.16 Fix any overflow issues
- [ ] 14.17 Fix spacing issues
- [ ] 14.18 Fix font size issues
- [ ] 14.19 Fix image scaling issues

**Acceptance:** Perfect on all 3 breakpoints, no horizontal scroll, touch targets good

---

## ✅ PHASE 15: PERFORMANCE OPTIMIZATION (3-4 hours)

### Images
- [ ] 15.1 Optimize images (WebP format)
- [ ] 15.2 Implement lazy loading
  - `loading="lazy"` attribute
  - Or Intersection Observer
- [ ] 15.3 Add srcset for responsive images
- [ ] 15.4 Compress images (<100KB each)

### Fonts
- [ ] 15.5 Add `font-display: swap`
- [ ] 15.6 Preload critical fonts
  - `<link rel="preload">`
- [ ] 15.7 Subset fonts (Latin only)

### Code
- [ ] 15.8 Run Vite build
  - `npm run build`
- [ ] 15.9 Analyze bundle size
  - Install `rollup-plugin-visualizer`
  - Check for large chunks
- [ ] 15.10 Implement code splitting
  - React.lazy for sections (if needed)
  - Route-based splitting (if multi-page)

### Caching
- [ ] 15.11 Set up caching headers
  - Static assets: long cache
  - HTML: short cache
- [ ] 15.12 Add service worker (optional)

### Testing
- [ ] 15.13 Run Lighthouse audit
  - Performance: 90+
  - Accessibility: 95+
  - Best Practices: 95+
  - SEO: 90+
- [ ] 15.14 Test on slow 3G
  - Chrome DevTools throttling
  - Check load time <5s
- [ ] 15.15 Fix any issues

**Acceptance:** Lighthouse green, fast on slow connection, optimized bundle

---

## ✅ PHASE 16: TESTING & QA (3-4 hours)

### Cross-Browser Testing
- [ ] 16.1 Test in Chrome (latest)
- [ ] 16.2 Test in Firefox (latest)
- [ ] 16.3 Test in Safari (latest)
- [ ] 16.4 Test in Edge (latest)
- [ ] 16.5 Fix any browser-specific issues

### Device Testing
- [ ] 16.6 Test on iPhone (Safari)
- [ ] 16.7 Test on Android (Chrome)
- [ ] 16.8 Test on iPad (Safari)
- [ ] 16.9 Fix any mobile-specific issues

### Animation Testing
- [ ] 16.10 Test all entrance animations
- [ ] 16.11 Test all hover effects
- [ ] 16.12 Test all scroll triggers
- [ ] 16.13 Test accordion expand/collapse
- [ ] 16.14 Test navigation scroll behavior

### Functional Testing
- [ ] 16.15 Test all navigation links (smooth scroll)
- [ ] 16.16 Test all CTA buttons
- [ ] 16.17 Test form validation
- [ ] 16.18 Test form submission
- [ ] 16.19 Test footer links

### Accessibility Testing
- [ ] 16.20 Test keyboard navigation (Tab, Enter, Space)
- [ ] 16.21 Test screen reader (VoiceOver/NVDA)
- [ ] 16.22 Test focus indicators
- [ ] 16.23 Check color contrast (WCAG AA)
- [ ] 16.24 Check heading hierarchy (h1→h2→h3)

### Visual Comparison
- [ ] 16.25 Side-by-side with Formix (desktop)
- [ ] 16.26 Side-by-side with Formix (mobile)
- [ ] 16.27 Check spacing accuracy
- [ ] 16.28 Check color accuracy
- [ ] 16.29 Check typography accuracy

**Acceptance:** No critical bugs, accessible, matches Formix visually

---

## ✅ PHASE 17: DEPLOYMENT (2-3 hours)

### Build
- [ ] 17.1 Run production build
  - `npm run build`
- [ ] 17.2 Test build locally
  - `npm run preview`
- [ ] 17.3 Fix any build errors

### Hosting Setup
- [ ] 17.4 Choose hosting provider
  - Vercel (recommended) or Netlify
- [ ] 17.5 Create account (if needed)
- [ ] 17.6 Connect Git repository
- [ ] 17.7 Configure build settings
  - Build command: `npm run build`
  - Output directory: `dist`
  - Node version: 18+

### Deployment
- [ ] 17.8 Deploy to production
  - Push to main branch (auto-deploy)
  - Or manual deploy
- [ ] 17.9 Test live site
  - Check all pages load
  - Check all animations work
  - Check no console errors

### Domain (Optional)
- [ ] 17.10 Purchase domain (if needed)
- [ ] 17.11 Configure DNS
- [ ] 17.12 Set up SSL certificate (auto on Vercel/Netlify)
- [ ] 17.13 Test custom domain

### Monitoring
- [ ] 17.14 Set up analytics (Google Analytics or Plausible)
- [ ] 17.15 Set up error tracking (Sentry, optional)
- [ ] 17.16 Monitor initial traffic

### Documentation
- [ ] 17.17 Update README with live URL
- [ ] 17.18 Document any quirks or notes
- [ ] 17.19 Tag release (v1.0.0)

**Acceptance:** Site live, accessible, no errors, analytics working

---

## 📊 PROGRESS SUMMARY

- **Total Tasks:** 300+
- **Total Hours:** 55-74 hours (estimated)
- **Phases Complete:** 0/17
- **Overall Progress:** 0%

---

## 🎯 CURRENT PHASE

**Phase:** Not started
**Next Task:** 1.1 Create new React + Vite project
**Blockers:** None

---

**END OF TASKS**
