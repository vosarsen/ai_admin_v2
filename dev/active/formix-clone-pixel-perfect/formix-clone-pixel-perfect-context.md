# Formix Clone - Context & Key Decisions

**Last Updated:** 2025-12-01 (Session: Phase 4 Complete - Services Section with Horizontal Cards)

---

## 🔥 CRITICAL SESSION STATE (Updated: 2025-12-01 - Phase 4 Services Complete)

### Current Implementation Status
- **Phase:** Phase 4 (Services Section) - ✅ **COMPLETE & COMMITTED**
- **Progress:** 4/18 phases complete (22.2% overall progress)
- **Status:** ✅ **ALL CHANGES COMMITTED** - Ready for next phase
- **Latest Commit:** 82fc34c ("feat: Phase 4 Services Section complete")
- **Next Immediate Step:** Phase 5 (Why Us Section)
- **Dev Server:** Running at http://localhost:3000
- **Branch:** main (formix-landing-nextjs)
- **Project Location:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

### What Just Happened (This Session - Phase 4 Services Section)

**Session Duration:** ~75 minutes
**Date:** December 1, 2025 (continued from previous context)

This session focused on implementing the **Services Section** with horizontal card layout based on the original Formix design. Multiple iterations were made to match exact proportions, colors, and styling.

#### Phase 4 Implementation Summary:

1. **Component Structure**
   - Created `Services.tsx` with two-tier layout
   - Created `ServiceCard.tsx` with horizontal split
   - Created `index.ts` barrel export

2. **Layout Design**
   - Top section: Badge + horizontal heading/description (1.3fr/1fr grid)
   - Bottom section: Full-width service cards (single column)
   - Card split: 45fr (content) / 55fr (image placeholder)

3. **Service Cards (9 total)**
   - Icon (40px square, bg-dark, rounded-xl)
   - Title (text-2xl md:text-3xl, bold)
   - Description (text-base, text-dark/70)
   - 2x2 tags grid with numbered labels (01-04)
   - Image placeholder with fallback SVG icon
   - min-h-[450px] for consistent height

4. **Custom Badge**
   - Replaced Badge component with inline HTML
   - Added orange slashes: `<span className="text-accent">//</span> Services <span className="text-accent">//</span>`

5. **Animations**
   - Framer Motion `whileInView` on all elements
   - Stagger effect: delay: index * 0.1
   - Hover: translateY(-4px) + shadow increase

6. **Bottom Blur Effect**
   - Fixed to viewport bottom (not section-specific)
   - h-10 with backdrop-blur-2xl
   - Scrolls with page content

**Key Changes Made:**
- Changed from vertical to horizontal card layout
- Adjusted grid proportions from default to [45fr_55fr]
- Increased heading size to text-6xl
- Changed description color from text-dark/50 to text-dark/60
- Removed white background to show grid lines
- Added bottom viewport blur effect

**Acceptance Criteria Met:** ✅
- Horizontal cards with proper proportions
- Smooth animations on scroll
- Custom badge with colored slashes
- Viewport blur effect at bottom

---

### Previous Session (Phase 3 Continuation - Button/Navigation Refinements)

**Session Duration:** ~2-3 hours
**Date:** December 1, 2025

This session involved **extensive iterative refinements** to buttons, navigation, and layout based on detailed user feedback. Multiple changes were made, tested, and sometimes reverted based on visual feedback.

#### Major Changes Overview:

1. **Button Redesign (Multiple Iterations)**
   - Removed "View Pricing" button from Hero initially
   - Removed "Book Free Call" button from navigation
   - Re-added "Book Free Call" to navigation with new design
   - Added "Оставить заявку" button to Hero section
   - Multiple size adjustments to match exact specifications

2. **Badge Updates**
   - Reduced glow animation intensity (smaller box-shadow)
   - Changed text from "Available For Projects" to "Уже доступно"

3. **Typography Changes**
   - Changed heading font-weight from `font-black` to `font-bold` (900 → 700)
   - Added selective gray coloring to words "понимает" and "клиентов" (`text-gray-500`)
   - Adjusted gray from `text-gray-400` to `text-gray-500` for better contrast

4. **Icon Animations**
   - Added horizontal rolling animation to arrow icon in Hero button
   - Added horizontal rolling animation to phone icon in navigation button
   - Both use two-layer approach with translateX(-200%)

5. **Animation Speed**
   - Slowed down photo gallery infinite scroll from 45s to 60s

6. **Large Screen Adaptation (Later Reverted)**
   - Initially added 2xl breakpoint (1536px+) styling to scale all elements
   - User requested revert - removed all 2xl classes
   - Gallery positioning experiments to fix it on larger screens
   - Final state: Back to original without 2xl classes

#### Detailed File Changes:

**1. `src/components/Navigation/Navigation.tsx` (373 lines)**

Key changes:
- CTAButton component redesigned multiple times
- Phone icon with animated pulsing rings (2 rings with staggered delays)
- Horizontal rolling animation for phone icon (two-layer approach)
- Icon color changed from black to gray-900 to match heading
- Button sizing adjusted to exact specifications (52px height total)
- Multiple iterations on padding, circle size, icon size

Final button structure:
```typescript
<button className="pl-6 pr-[6px] py-[6px] bg-black rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
  <div className="relative overflow-hidden h-6 mr-4"> {/* Rolling text */}
    <motion.span animate={{ y: isHovered ? "-100%" : "0%" }}>Book Free Call</motion.span>
    <motion.span className="absolute top-full" animate={{ y: isHovered ? "-100%" : "0%" }}>Book Free Call</motion.span>
  </div>
  <div className="w-[40px] h-[40px] rounded-full bg-[#ff3700]">
    {/* 2 animated pulsing rings */}
    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }} />
    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }} delay={0.5} />
    {/* Phone icon with horizontal animation */}
    <div className="relative w-[18px] h-[18px]">
      <motion.svg animate={{ x: isHovered ? "-200%" : "0%" }} className="text-gray-900" />
      <motion.svg className="absolute left-[200%]" animate={{ x: isHovered ? "-200%" : "0%" }} />
    </div>
  </div>
</button>
```

**2. `src/components/Hero/Hero.tsx` (127 lines)**

Key changes:
- Badge text: "Available For Projects" → "Уже доступно"
- Heading font-weight: `font-black` → `font-bold`
- Added `<span className="text-gray-500">` to "понимает" and "клиентов"
- Changed gray color from 400 to 500
- Added "Оставить заявку" button with primary variant
- Multiple experiments with gallery positioning (all reverted)

Final heading structure:
```tsx
<h1 className="font-geist font-bold text-5xl md:text-6xl lg:text-[72px] leading-[1.1] tracking-tight">
  WhatsApp бот который{" "}
  <span className="text-gray-500">понимает</span> ваших{" "}
  <span className="text-gray-500">клиентов</span>
</h1>
```

**3. `src/components/Hero/Button.tsx` (160 lines)**

Key changes:
- Created complete button component with multiple variants
- Primary variant: `bg-[#ff4726]` (orange) with black text
- Secondary variant: `bg-dark` (black) with white text
- Phone variant: `bg-[#2d2d2d]` with gray phone icon
- Two-layer rolling text animation (vertical translateY)
- Two-layer rolling arrow animation (horizontal translateX)
- Exact sizing: `pl-6 pr-[6px] py-[6px]` with 40px circle
- Arrow icon from lucide-react with `strokeWidth={2.5}`

Button animation structure:
```typescript
// Text animation (vertical)
<div className="relative overflow-hidden h-6 mr-4">
  <motion.span animate={{ y: isHovered ? "-100%" : "0%" }}>{children}</motion.span>
  <motion.span className="absolute top-full" animate={{ y: isHovered ? "-100%" : "0%" }}>{children}</motion.span>
</div>

// Arrow animation (horizontal)
<div className="relative w-4 h-4">
  <motion.div animate={{ x: isHovered ? "-200%" : "0%" }}>
    <ArrowRight className="w-4 h-4 text-white" />
  </motion.div>
  <motion.div className="absolute left-[200%]" animate={{ x: isHovered ? "-200%" : "0%" }}>
    <ArrowRight className="w-4 h-4 text-white" />
  </motion.div>
</div>
```

**4. `src/components/Hero/Badge.tsx` (34 lines)**

Key changes:
- Reduced pulse glow intensity in animation
- Text prop used for customization
- Simple component, no major structural changes

**5. `src/app/globals.css`**

Key changes to animations:
```css
/* Reduced glow intensity */
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 20px 10px rgb(255, 55, 0); }  /* Was 40px 20px */
  50% { box-shadow: 0 0 30px 15px rgb(255, 55, 0); }       /* Was 60px 30px */
}

/* Slowed scroll animation */
.animate-scroll-down { animation: scroll-down 60s linear infinite; }  /* Was 45s */
.animate-scroll-up { animation: scroll-up 60s linear infinite; }      /* Was 45s */
```

#### User Feedback Timeline (Chronological):

1. "давай дальше работать над dev/active/formix-clone-pixel-perfect"
2. "Давай уберем эту кнопку вообще. Вместо этой сделаем вот такую..." (with images)
3. "ты убрал не ту кнопку" ← Removed wrong button
4. "Верни кнопку в хедере. В hero убери убе кнопки"
5. "Сделай цвет серый, как и цвет шрифт 'WhatsApp бот который понимает ваших клиентов'"
6. "Теперь добавь еще анимацию к иконке телефона, чтобы он так же горизотально анимировался"
7. "Оцентруй текст с круглым элементом" (with image)
8. "Сделай серый цвет еще более темным, как тут на сайте https://formix.framer.website/#header. Верни дизайн той кнопки из хедера, что ты убрал"
9. "Сделай цвет серый, как и цвет шрифт 'WhatsApp бот который понимает ваших клиентов'"
10. "Уменьши это свечение. Напиши там текст 'Уже доступно'. В херо после текста вставь вот такой вот кнопку..." (with images)
11. "Слова 'понимает' и 'клиентов' сделай светло серыми" (with image)
12. "Кружок со стрелкой сделай больше, как тут" (with image)
13. "Сделай этот текст пенее жирным. Уменьши саму пилюлю, чтобы она была по высоте как вот эта" (with images)
14. "Какие размеры у этой кнопки?" ← Asked for exact dimensions
15. "Сделай такой же размер У этой кнопки" (with image)
16. "Добавь еще анимацию к иконке стрелки, чтобы она так же горизотально переходила"
17. "Сделай светлый серый более темным"
18. "Теперь уменьши еще скорость Анимации фотографий"
19. "Адаптируй на большие экраны этот дизайн" ← Added 2xl breakpoints
20. "Верни, как было" ← Reverted all 2xl changes
21. "Положение фотографий закрепи, чтобы оно не менялось при больших экранах" ← Experimented with positioning
22. "Сделай - absolute right-[96px] -top-[14px]" ← Requested specific positioning
23. "Зафиксируй ее не меняя absolute right -[96px]" ← Tried calc() approach
24. "Верни, как было" ← Final revert to original

#### Issues Resolved:

1. **Button centering** - Added `justify-center` and `flex items-center`
2. **Gray color too light** - Changed from text-gray-400 to text-gray-500
3. **Button size mismatch** - Adjusted padding from `px-8 py-3` to `pl-6 pr-[6px] py-[6px]`
4. **Circle size mismatch** - Reduced from 48px to 40px
5. **Arrow size mismatch** - Reduced from w-6 to w-4
6. **Icon color mismatch** - Changed phone icon from black to gray-900
7. **Large screen adaptation** - Multiple attempts, ultimately reverted to original

#### Critical Technical Patterns Discovered:

**1. Two-Layer Rolling Animation (Horizontal)**
```typescript
// For horizontal icon rolling (like phone or arrow)
<div className="relative w-4 h-4">
  {/* Layer 1: Visible, moves left */}
  <motion.div
    animate={{ x: isHovered ? "-200%" : "0%" }}
    transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
    className="absolute"
  >
    <Icon className="w-4 h-4" />
  </motion.div>

  {/* Layer 2: Starts off-screen right, rolls in */}
  <motion.div
    animate={{ x: isHovered ? "-200%" : "0%" }}
    transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
    className="absolute left-[200%]"
  >
    <Icon className="w-4 h-4" />
  </motion.div>
</div>
```

**2. Animated Pulsing Rings**
```typescript
// For phone icon rings (2 rings with staggered timing)
<motion.div
  animate={{
    scale: [1, 1.4, 1],
    opacity: [0.6, 0, 0.6],
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "easeOut",
  }}
  className="absolute inset-0 rounded-full border-2 border-gray-900/30"
/>
<motion.div
  animate={{
    scale: [1, 1.4, 1],
    opacity: [0.6, 0, 0.6],
  }}
  transition={{
    duration: 2,
    repeat: Infinity,
    ease: "easeOut",
    delay: 0.5,  // Stagger second ring
  }}
  className="absolute inset-0 rounded-full border-2 border-gray-900/30"
/>
```

**3. Selective Text Coloring**
```tsx
<h1>
  WhatsApp бот который{" "}
  <span className="text-gray-500">понимает</span> ваших{" "}
  <span className="text-gray-500">клиентов</span>
</h1>
```

**4. Button Size Calculations**
```
Total height: 52px
= py-[6px] (top)    = 6px
+ h-6 (content)     = 24px  (text container)
+ h-[40px] (circle) = 40px  (icon circle, overlaps)
+ py-[6px] (bottom) = 6px

Horizontal padding:
- Left: pl-6 = 24px (text padding)
- Right: pr-[6px] = 6px (minimal, creates toggle look)
```

---

## 📂 KEY FILES & LOCATIONS

### Project Location
**Main Directory:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

### Modified Files (This Session - Phase 3 Continuation)

1. **`src/components/Navigation/Navigation.tsx`** (373 lines)
   - CTAButton with phone icon and pulsing rings
   - Horizontal rolling animation for phone icon
   - Multiple sizing iterations

2. **`src/components/Hero/Hero.tsx`** (127 lines)
   - Badge text change
   - Heading font-weight and selective gray coloring
   - Added "Оставить заявку" button
   - Gallery positioning experiments (all reverted)

3. **`src/components/Hero/Button.tsx`** (160 lines)
   - Complete button component with variants
   - Two-layer rolling animations (text + icon)
   - Exact sizing specifications

4. **`src/components/Hero/Badge.tsx`** (34 lines)
   - Reduced glow animation intensity

5. **`src/app/globals.css`**
   - Reduced pulse glow box-shadow values
   - Slowed infinite scroll from 45s to 60s

### Files Read from formix-landing-nextjs (Different Repo)
During this session, the assistant mistakenly read files from a different repository:
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/app/globals.css`
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Hero/Hero.tsx`
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Hero/Button.tsx`
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Navigation/Navigation.tsx`

**⚠️ CRITICAL NOTE:** This session worked on files in `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`, NOT the ai_admin_v2 repo. The project is actually located at the formix-landing-nextjs path.

---

## 🎯 CRITICAL DESIGN SPECIFICATIONS (Updated)

### Button Specifications (Hero & Navigation)

**Hero Button ("Оставить заявку"):**
- Variant: primary
- Background: `#ff4726` (orange)
- Text: Black, Inter 600 semibold, 15px
- Height: 52px total (`py-[6px]` + 40px content + `py-[6px]`)
- Padding: `pl-6 pr-[6px] py-[6px]`
- Icon circle: 40px diameter, black background
- Arrow icon: White, w-4 h-4, strokeWidth 2.5
- Shadow: `shadow-button-strong`
- Hover: `scale-105`

**Navigation Button ("Book Free Call"):**
- Background: `bg-black` (pure black)
- Text: White, Inter 600 semibold, 15px
- Height: 52px (matches navigation pill)
- Padding: `pl-6 pr-[6px] py-[6px]`
- Icon circle: 40px diameter, `#ff3700` (Formix orange)
- Phone icon: Gray-900 (text-gray-900), w-4 h-4, strokeWidth 2.5
- Pulsing rings: 2 rings, border-2, border-gray-900/30, staggered 0.5s
- Shadow: `shadow-[0_8px_24px_rgba(0,0,0,0.4)]`
- Hover: `scale-105`

### Badge Specifications

**Hero Badge:**
- Text: "Уже доступно" (was "Available For Projects")
- Background: Dark with transparency
- Pulsing red dot animation (reduced intensity)
- Box-shadow: `0 0 20px 10px rgb(255, 55, 0)` (was 40px 20px)

### Typography Specifications

**Hero Heading:**
- Font: Geist Bold (700, not 900)
- Size: 72px on lg screens
- Leading: 1.1
- Tracking: tight
- Colors: Black + gray-500 for "понимает" and "клиентов"

### Animation Specifications

**Infinite Scroll:**
- Duration: 60s (was 45s)
- Easing: linear
- Direction: Column 1 up, Column 2 down

**Horizontal Rolling (Icons):**
- Duration: 0.2s
- Easing: [0, 0, 0.2, 1]
- Transform: translateX(-200%)

**Pulsing Rings:**
- Duration: 2s
- Repeat: Infinity
- Easing: easeOut
- Scale: 1 → 1.4 → 1
- Opacity: 0.6 → 0 → 0.6
- Delay: Second ring +0.5s

---

## ⚠️ CRITICAL TECHNICAL DECISIONS

### 1. Large Screen Adaptation - Reverted
**Attempted:** Added 2xl breakpoint (1536px+) with scaled typography, spacing, and component sizes
**Decision:** User requested revert - removed all 2xl classes
**Result:** Design remains at original breakpoint structure (sm/md/lg only)
**Reasoning:** User preferred consistent sizing across all large screens

### 2. Gallery Positioning Experiments
**Attempts Made:**
1. Using `calc(50vw - 544px)` for right positioning
2. Moving gallery outside container to position relative to viewport
3. Changing from relative to absolute positioning within section

**Final Decision:** Reverted to original `absolute right-[96px] -top-[14px]`
**Reasoning:** Original positioning works correctly, experiments introduced complications

### 3. Icon Color Consistency
**Decision:** Use `text-gray-900` for phone icon to match heading text color
**Previous:** Used `text-black`
**Reasoning:** User specifically requested icon color to match heading typography

### 4. Font Weight Reduction
**Decision:** Changed heading from `font-black` (900) to `font-bold` (700)
**Reasoning:** User requested "less bold" text for better readability

### 5. Animation Speed Reduction
**Decision:** Slowed infinite scroll from 45s to 60s (33% slower)
**Reasoning:** User found animation too fast, requested slower speed

---

## 🚀 NEXT STEPS

### Immediate Actions (When Resuming)

1. **⚠️ COMMIT ALL CHANGES**
   ```bash
   cd /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs
   git add -A
   git status  # Verify what's being committed

   git commit -m "feat(phase3): Extensive button/navigation refinements

   Button Updates:
   - Added 'Оставить заявку' button to Hero with orange primary variant
   - Redesigned 'Book Free Call' navigation button with phone icon
   - Added horizontal rolling animations to arrow and phone icons
   - Implemented pulsing rings around phone icon (2 rings, staggered)
   - Adjusted all button sizing to exact specifications (52px height)

   Typography & Content:
   - Changed heading font-weight from black (900) to bold (700)
   - Added selective gray coloring to 'понимает' and 'клиентов'
   - Adjusted gray from 400 to 500 for better contrast
   - Changed badge text to 'Уже доступно'

   Animations:
   - Reduced badge glow intensity (smaller box-shadow)
   - Slowed photo gallery infinite scroll from 45s to 60s
   - Added two-layer horizontal rolling for icons

   All changes based on detailed user feedback and visual refinements"
   ```

2. **Verify Dev Server**
   - Ensure http://localhost:3000 still running
   - Test all button hover animations
   - Verify infinite scroll speed
   - Check badge glow intensity

3. **Start Phase 4: Services Section** (when user requests)
   - Create Services component structure
   - Implement ServiceCard component
   - Build responsive grid layout (3 columns desktop)
   - Add scroll-triggered animations
   - Implement stagger effect

### Dev Server Status
- **Running:** Yes (shell ID: 3f20fe)
- **URL:** http://localhost:3000
- **Status:** Clean build, all animations working
- **Branch:** feature/formix-redesign
- **Location:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

---

## 📊 PROGRESS TRACKING

### Completed Phases
- ✅ Phase 0: Project Setup (25 min)
- ✅ Phase 1: Foundation (15 min)
- ✅ Phase 2: Navigation Initial (45 min)
- ✅ Phase 2.1: Navigation Redesign (60 min)
- ✅ Phase 3: Hero Section Initial (~90 min)
- ✅ Phase 3 Continuation: Button/Nav Refinements (~2-3 hours)

### Next Phase
- ⬜ Phase 4: Services Section (estimated 4-5 hours)

### Overall Progress
- **Phases Complete:** 3 / 18 (with extensive refinements)
- **Percentage:** 16.7%
- **Time Invested This Session:** ~2-3 hours
- **Total Time Invested:** ~6-7 hours
- **Estimated Remaining:** ~45-55 hours

---

## 🔑 KEY LEARNINGS & PATTERNS

### 1. Two-Layer Horizontal Rolling Animation
When animating icons horizontally (like arrows or phone icons):
- Container with `relative` and fixed dimensions
- First layer: `absolute` with translateX from 0% to -200%
- Second layer: `absolute left-[200%]` with same translateX animation
- Both layers move together, creating seamless rolling effect

### 2. Pulsing Ring Animation
For attention-grabbing phone/call button effects:
- Use multiple `motion.div` elements with `absolute inset-0`
- Animate scale (1 → 1.4 → 1) and opacity (0.6 → 0 → 0.6)
- Stagger second ring with `delay: 0.5`
- Use `repeat: Infinity` for continuous effect

### 3. Selective Text Coloring in Headings
To emphasize certain words without breaking text flow:
- Use `<span className="text-gray-500">` inline
- Maintain spacing with `{" "}` between elements
- Keeps semantic HTML (still one `<h1>`) while allowing visual variation

### 4. Iterative Design Process
This session demonstrated importance of:
- Quick iterations based on visual feedback
- Willingness to revert changes that don't work
- Testing multiple approaches when solution isn't obvious
- Exact measurements matter (52px vs 50px makes difference)

### 5. Repository Path Awareness
**CRITICAL:** Always verify which repository you're working in:
- This project is at `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`
- NOT in the ai_admin_v2 repository
- Check file paths carefully when reading/editing

---

## 🎨 DESIGN TOKENS (Final Values)

### Colors
```javascript
// Buttons
--button-primary-bg: #ff4726          // Orange (Hero button)
--button-primary-text: #000000        // Black
--button-secondary-bg: #000000        // Black (Nav button)
--button-secondary-text: #ffffff      // White
--button-circle-primary: #000000      // Black circle (Hero)
--button-circle-secondary: #ff3700    // Orange circle (Nav)

// Icons
--icon-arrow-color: #ffffff           // White arrow (Hero)
--icon-phone-color: rgb(17, 24, 39)   // Gray-900 phone (Nav)
--ring-color: rgba(17, 24, 39, 0.3)   // Gray-900 at 30% (rings)

// Typography
--heading-primary: #000000            // Black
--heading-accent: rgb(107, 114, 128)  // Gray-500
--text-dark: rgb(75, 85, 99)          // Gray-600

// Badge
--badge-glow-base: 0 0 20px 10px rgb(255, 55, 0)
--badge-glow-peak: 0 0 30px 15px rgb(255, 55, 0)
```

### Component Dimensions
```javascript
// Buttons (both Hero and Nav)
Height: 52px
Padding left: 24px (pl-6)
Padding right: 6px (pr-[6px])
Padding vertical: 6px (py-[6px])

// Icon Circles
Diameter: 40px
Margin from text: 16px (mr-4)

// Icons
Arrow size: 16px (w-4 h-4)
Phone size: 16px (w-4 h-4)
Stroke width: 2.5

// Text Container
Height: 24px (h-6)
Font size: 15px
Font weight: 600 (semibold)
Letter spacing: -0.025em (tracking-tight)
```

### Animation Timing
```javascript
// Hover Animations
Duration: 200ms (0.2s)
Easing: [0, 0, 0.2, 1] (custom cubic-bezier)

// Pulsing Rings
Duration: 2000ms (2s)
Delay (ring 2): 500ms (0.5s)
Repeat: infinite
Easing: easeOut

// Infinite Scroll
Duration: 60000ms (60s)
Easing: linear
Repeat: infinite

// Badge Glow
Duration: 2000ms (2s)
Easing: ease-in-out
Repeat: infinite
```

---

**END OF CONTEXT**
