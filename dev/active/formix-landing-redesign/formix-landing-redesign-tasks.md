# Formix Landing Redesign - Task Checklist

**Last Updated:** 2025-11-28 23:50 UTC
**Progress:** 14/71 tasks completed (20%) - Phase 1 COMPLETE ✅

---

## Phase 1: Foundation & Setup (14/14 tasks) ✅ COMPLETE

### 1.1 Project Initialization (4/4 tasks) ✅
- [x] Create `public/landing-formix/` directory structure
- [x] Set up Git branch: `feature/formix-redesign`
- [x] Initialize base HTML template with meta tags
- [x] Add favicon and social meta tags

### 1.2 Font Integration (3/3 tasks) ✅
- [x] Download Geist font (weights: 600, 700, 900) from Vercel
- [x] Download Inter font (weights: 400, 500, 600, 700) from Google Fonts
- [x] Create `@font-face` declarations with preload hints

### 1.3 CSS Architecture (4/4 tasks) ✅
- [x] Create `css/reset.css` (normalize browser styles)
- [x] Build `css/variables.css` with complete design token system
- [x] Set up `css/base.css` (html, body, global typography)
- [x] Create modular CSS structure (components, utilities)

### 1.4 Layout System (3/3 tasks) ✅
- [x] Create container system (max-width 1270px, centered)
- [x] Build responsive grid and flexbox utilities
- [x] Add spacing scale utilities and visibility classes

---

## Phase 2: Core Components (0/15 tasks)

### 2.1 Navigation Header (0/8 tasks)
- [ ] Create fixed header with backdrop-filter blur
- [ ] Build logo component and link
- [ ] Implement horizontal navigation menu
- [ ] Add hover states with smooth transitions
- [ ] Create `.isCurrent` active state styling
- [ ] Build mobile hamburger toggle animation
- [ ] Implement mobile menu dropdown
- [ ] Add scroll-based header shadow effect

### 2.2 Button System (0/4 tasks)
- [ ] Create primary button style (with accent color)
- [ ] Create secondary button style (outline variant)
- [ ] Add icon button variants (21-24px icons)
- [ ] Implement hover/active/focus states with accessibility

### 2.3 Card Components (0/3 tasks)
- [ ] Create base card component with hover effects
- [ ] Implement icon masking system (`-webkit-mask`)
- [ ] Build responsive card grid layout (3 col → 1 col)

---

## Phase 3: Animations & Interactions (0/12 tasks)

### 3.1 Scroll Animations (0/5 tasks)
- [ ] Set up Intersection Observer API
- [ ] Create fade-in animation on scroll
- [ ] Build slide-up animation with delay
- [ ] Implement staggered animations for lists
- [ ] Add `will-change` optimization for performance

### 3.2 Custom Cursor (0/4 tasks)
- [ ] Create custom cursor HTML element
- [ ] Track mouse position with requestAnimationFrame
- [ ] Implement cursor variants (pointer, grab, grabbing)
- [ ] Add blend modes and disable on touch devices

### 3.3 Transition System (0/3 tasks)
- [ ] Create transition utility classes
- [ ] Implement cubic-bezier easing functions
- [ ] Add transform-based hover effects (scale, translate)

---

## Phase 4: Content Sections (0/10 tasks)

### 4.1 Hero Section (0/4 tasks)
- [ ] Create hero layout with centered content
- [ ] Add main heading (Geist 900, responsive sizing, -0.05em tracking)
- [ ] Build subheading (Inter 400, secondary color)
- [ ] Implement CTA button group

### 4.2 Features Section (0/3 tasks)
- [ ] Build features grid (3 columns desktop, 1 column mobile)
- [ ] Create feature cards with icons and descriptions
- [ ] Implement staggered entrance animation (100ms delay)

### 4.3 FAQ Accordion (0/3 tasks)
- [ ] Port existing FAQ content from current site
- [ ] Update styling to match Formix design (light theme)
- [ ] Ensure Grid-based animation works smoothly

---

## Phase 5: Responsiveness & Polish (0/12 tasks)

### 5.1 Responsive Testing (0/5 tasks)
- [ ] Test on 320px viewport (iPhone SE)
- [ ] Test on 375px viewport (iPhone 12/13)
- [ ] Test on 810px viewport (tablet breakpoint)
- [ ] Test on 1200px viewport (desktop breakpoint)
- [ ] Test on 1920px+ viewport (large desktop)

### 5.2 Performance Optimization (0/4 tasks)
- [ ] Optimize images (WebP format, lazy loading)
- [ ] Minify CSS and JavaScript files
- [ ] Add resource hints (preload fonts, prefetch)
- [ ] Run Lighthouse audit (target: 90+ score)

### 5.3 Cross-Browser Testing (0/3 tasks)
- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest, including iOS)

---

## Phase 6: Integration & Deployment (0/8 tasks)

### 6.1 Nginx Configuration (0/3 tasks)
- [ ] Create location block for `/landing-formix/` in Nginx config
- [ ] Add cache headers for static assets (1 year)
- [ ] Test static file serving and gzip compression

### 6.2 Production Deployment (0/3 tasks)
- [ ] Commit all changes to feature branch
- [ ] Create pull request and code review
- [ ] Merge to main and deploy to production server

### 6.3 Documentation (0/2 tasks)
- [ ] Document design system in README
- [ ] Create component usage guide and maintenance notes

---

## Detailed Task Breakdown

### Phase 1 Details

#### Task 1.1.1: Create Directory Structure
```bash
mkdir -p public/landing-formix/{css/components,js,fonts/{geist,inter},assets/icons}
```

**Files to create:**
- `public/landing-formix/index.html`
- `public/landing-formix/css/reset.css`
- `public/landing-formix/css/variables.css`
- `public/landing-formix/css/base.css`
- `public/landing-formix/css/layout.css`
- `public/landing-formix/css/animations.css`
- `public/landing-formix/css/utilities.css`
- `public/landing-formix/css/components/navigation.css`
- `public/landing-formix/css/components/hero.css`
- `public/landing-formix/css/components/buttons.css`
- `public/landing-formix/css/components/cards.css`
- `public/landing-formix/css/components/faq.css`
- `public/landing-formix/js/main.js`
- `public/landing-formix/js/animations.js`
- `public/landing-formix/js/cursor.js`
- `public/landing-formix/js/navigation.js`

#### Task 1.1.2: Git Branch Setup
```bash
git checkout -b feature/formix-redesign
git push -u origin feature/formix-redesign
```

#### Task 1.1.3: Base HTML Template
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Admin AI - Умный WhatsApp бот для салонов красоты">
    <title>Admin AI beta - Умный WhatsApp бот для салонов красоты</title>

    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/vite.svg">

    <!-- Preload critical fonts -->
    <link rel="preload" href="fonts/geist/Geist-Black.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="fonts/inter/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin>

    <!-- Stylesheets (order matters!) -->
    <link rel="stylesheet" href="css/reset.css">
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/base.css">
    <link rel="stylesheet" href="css/layout.css">
    <link rel="stylesheet" href="css/components/navigation.css">
    <link rel="stylesheet" href="css/components/hero.css">
    <link rel="stylesheet" href="css/components/buttons.css">
    <link rel="stylesheet" href="css/components/cards.css">
    <link rel="stylesheet" href="css/components/faq.css">
    <link rel="stylesheet" href="css/animations.css">
    <link rel="stylesheet" href="css/utilities.css">
</head>
<body>
    <!-- Content will go here -->

    <!-- Scripts (defer for performance) -->
    <script src="js/main.js" defer></script>
    <script src="js/animations.js" defer></script>
    <script src="js/cursor.js" defer></script>
    <script src="js/navigation.js" defer></script>
</body>
</html>
```

#### Task 1.2.1: Download Fonts
**Geist:**
- Source: https://vercel.com/font
- Weights needed: 600 (SemiBold), 700 (Bold), 900 (Black)
- Format: WOFF2 only for modern browsers

**Inter:**
- Source: https://fonts.google.com/specimen/Inter
- Download: https://fonts.google.com/download?family=Inter
- Weights needed: 400, 500, 600, 700, 800, 900
- Format: WOFF2

**Font Subsetting (Optional):**
```bash
# If fonts are too large, subset to Latin characters only
pyftsubset Inter-Regular.ttf \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153" \
  --output-file=Inter-Regular-subset.woff2 \
  --flavor=woff2
```

#### Task 1.3.2: Design Tokens (variables.css)
```css
:root {
  /* === COLORS === */
  /* Backgrounds */
  --color-bg-primary: #f0f0f0;
  --color-bg-secondary: #ebeced;

  /* Text */
  --color-text-primary: #151619;
  --color-text-secondary: #4f4f4f;
  --color-text-muted: #707070;

  /* Accent */
  --color-accent: #ff3700;
  --color-accent-hover: #e63300;

  /* Borders */
  --color-border: #e5e5e5;

  /* Overlays */
  --overlay-light: rgba(255, 255, 255, 0.08);
  --overlay-dark: rgba(0, 0, 0, 0.26);

  /* === TYPOGRAPHY === */
  /* Fonts */
  --font-heading: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;

  /* Weights */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-extrabold: 800;
  --weight-black: 900;

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-normal: 1.3;
  --leading-relaxed: 1.5;

  /* Letter Spacing */
  --tracking-tight: -0.05em;
  --tracking-normal: -0.035em;

  /* === SPACING === */
  --space-xs: 0.625rem;   /* 10px */
  --space-sm: 1.25rem;    /* 20px */
  --space-md: 2.188rem;   /* 35px */
  --space-lg: 3.125rem;   /* 50px */
  --space-xl: 5rem;       /* 80px */

  /* === LAYOUT === */
  --container-max-width: 1270px;
  --header-height: 80px;

  /* === ANIMATIONS === */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* === BREAKPOINTS === */
  --breakpoint-mobile: 810px;
  --breakpoint-desktop: 1200px;
}
```

### Phase 2 Details

#### Task 2.1.1: Fixed Header Structure
```html
<header class="header" id="header">
  <div class="header__container">
    <a href="/" class="header__logo">
      <span class="logo__text">Admin AI</span>
    </a>

    <nav class="header__nav" id="nav">
      <a href="#features" class="nav__link">Возможности</a>
      <a href="#pricing" class="nav__link">Цены</a>
      <a href="#faq" class="nav__link">FAQ</a>
    </nav>

    <div class="header__cta">
      <a href="#demo" class="btn btn--primary">Попробовать</a>
    </div>

    <button class="header__toggle" id="menuToggle" aria-label="Toggle menu">
      <span class="toggle__line"></span>
      <span class="toggle__line"></span>
      <span class="toggle__line"></span>
    </button>
  </div>
</header>
```

```css
/* navigation.css */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(240, 240, 240, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
  transition: box-shadow var(--duration-normal) var(--ease-out);
}

.header--scrolled {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header__container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--space-sm) var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
}

@media (min-width: 1200px) {
  .header__container {
    padding: var(--space-sm) var(--space-xl);
  }
}
```

### Phase 3 Details

#### Task 3.1: Intersection Observer Setup
```javascript
// animations.js

/**
 * Scroll Animation Controller
 * Uses Intersection Observer for performant scroll-triggered animations
 */

class ScrollAnimations {
  constructor() {
    this.elements = document.querySelectorAll('[data-animate]');
    this.observer = null;
    this.init();
  }

  init() {
    // Create observer
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        threshold: 0.2,
        rootMargin: '0px 0px -100px 0px' // Trigger before element enters
      }
    );

    // Observe all animated elements
    this.elements.forEach(el => this.observer.observe(el));
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.dataset.animateDelay || 0;

        setTimeout(() => {
          entry.target.classList.add('animate-in');
          // Unobserve after animation (one-time trigger)
          this.observer.unobserve(entry.target);
        }, delay);
      }
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ScrollAnimations();
  });
} else {
  new ScrollAnimations();
}
```

```css
/* animations.css */

/* Fade In Animation */
[data-animate="fade-in"] {
  opacity: 0;
  transition: opacity var(--duration-slow) var(--ease-out);
}

[data-animate="fade-in"].animate-in {
  opacity: 1;
}

/* Slide Up Animation */
[data-animate="slide-up"] {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}

[data-animate="slide-up"].animate-in {
  opacity: 1;
  transform: translateY(0);
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  [data-animate] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
```

---

## Progress Tracking

### Completed Phases
- [ ] Phase 1: Foundation & Setup (0/14 tasks)
- [ ] Phase 2: Core Components (0/15 tasks)
- [ ] Phase 3: Animations & Interactions (0/12 tasks)
- [ ] Phase 4: Content Sections (0/10 tasks)
- [ ] Phase 5: Responsiveness & Polish (0/12 tasks)
- [ ] Phase 6: Integration & Deployment (0/8 tasks)

### Overall Progress: 0/71 tasks (0%)

---

## Quality Checklist

### Before Marking Phase 1 Complete:
- [ ] All files created and in correct locations
- [ ] Fonts load without FOUT
- [ ] CSS validates without errors
- [ ] HTML validates with W3C validator
- [ ] Design tokens all defined correctly
- [ ] Layout system responsive at all breakpoints

### Before Marking Phase 2 Complete:
- [ ] Navigation header fixed and functional
- [ ] Mobile menu toggles smoothly
- [ ] All button variants styled correctly
- [ ] Cards display properly in grid
- [ ] Hover states work on all components
- [ ] Accessibility (ARIA, focus states) implemented

### Before Marking Phase 3 Complete:
- [ ] Scroll animations trigger correctly
- [ ] Animations perform at 60fps (no jank)
- [ ] Custom cursor follows mouse smoothly
- [ ] Touch devices don't show cursor
- [ ] Reduced motion preference respected
- [ ] All transitions use GPU-accelerated properties

### Before Marking Phase 4 Complete:
- [ ] All content sections built
- [ ] Typography matches design system
- [ ] Content hierarchy clear
- [ ] FAQ accordion functional
- [ ] Responsive at all breakpoints
- [ ] Content migrated from current site

### Before Marking Phase 5 Complete:
- [ ] Tested on all target devices
- [ ] Lighthouse score ≥90
- [ ] No console errors
- [ ] Cross-browser compatibility verified
- [ ] Images optimized (WebP, lazy loading)
- [ ] Bundle size within budget (<900KB)

### Before Marking Phase 6 Complete:
- [ ] Nginx config updated and tested
- [ ] Site accessible at https://adminai.tech/landing-formix/
- [ ] All changes committed to Git
- [ ] PR merged to main
- [ ] Live site verified
- [ ] Documentation complete

---

## Daily Standup Template

**Date:** _____
**Time Spent:** _____ hours
**Phase:** _____

**Completed Today:**
- [ ] Task X
- [ ] Task Y

**In Progress:**
- [ ] Task Z (50% done)

**Blockers:**
- None / [Describe blocker]

**Next Session:**
- [ ] Task A
- [ ] Task B

**Notes:**
- [Any important notes or decisions]

---

**Document Status:** Active
**Next Update:** After Phase 1 completion
**Last Updated:** 2025-11-28

---

## IMMEDIATE NEXT STEPS (Start Here After Context Reset)

### 🎯 You Are Here: Phase 2 - Core Components

**Current Status:** Phase 1 complete, ready to implement Phase 2

**Next 4 Tasks to Complete:**

1. **Implement Navigation CSS** (`css/components/navigation.css`)
   - Fixed header with backdrop-filter blur
   - Logo and nav links styling  
   - Mobile hamburger animation
   - Scroll-based shadow effect
   - **Estimated:** 45 minutes

2. **Implement Navigation JS** (`js/navigation.js`)
   - Mobile menu toggle
   - Scroll listener for header shadow
   - Click outside to close menu
   - **Estimated:** 30 minutes

3. **Implement Button Styles** (`css/components/buttons.css`)
   - Primary button (.btn--primary)
   - Secondary button (.btn--secondary)
   - Sizes and hover states
   - **Estimated:** 30 minutes

4. **Implement Hero Section** (`css/components/hero.css`)
   - Layout and spacing
   - Typography (Geist Black for title)
   - CTA button group
   - **Estimated:** 30 minutes

**After These 4 Tasks:**
- Test page in browser (start local server)
- Commit Phase 2.1-2.3 work
- Continue to Phase 3 (Animations)

---

## Quick Reference Commands

```bash
# Resume work
cd /Users/arbakvoskanyan/Documents/GitHub/ai_admin_v2
git checkout feature/formix-redesign

# Test locally
python3 -m http.server 8000
# Open: http://localhost:8000/public/landing-formix/

# When done with Phase 2
git add public/landing-formix/
git commit -m "feat(landing-formix): Phase 2 - Core Components complete"
git push origin feature/formix-redesign
```

---

**Last Session Summary:**
- Started: Planning
- Completed: Phase 1 (Foundation & Setup) in ~30 minutes
- Next: Phase 2 (Core Components - Navigation, Buttons, Hero)
- Git: Branch created, commit a30cfdb pushed to GitHub
