# Formix Landing - Pricing Section Implementation

## Current State (Last Updated: 2025-12-05)

**Repository:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs`
**Working Directory:** Different from AI Admin v2 - this is a separate Next.js landing page project
**Branch:** Not tracked (likely main or similar)

## Session Summary

Implementing a pixel-perfect pricing section for the Formix landing page with three card types:
1. **Subscribe card** - Visual process explanation (3 steps)
2. **Design Retainer card** - $5K/month plan with features
3. **Single Project card** - $10K starting price (dark theme variant)

## Key Implementation Details

### Component Structure

**Files Modified:**
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Pricing/PricingCard.tsx` (main component)
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Pricing/Pricing.tsx` (grid layout)
- `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/package.json` (Turbopack fix)

### Architecture Pattern

**Two-Card Nesting System:**
```
Outer Card (bg-[rgb(229,229,229)] or bg-black)
└─ padding: 7px
   └─ Inner Card (bg-[rgb(240,240,240)] or bg-dark)
      ├─ Icon (absolute, top-left corner)
      ├─ Title + Price
      ├─ Description
      └─ Development Toggle (if applicable)
   └─ Features List (outside inner card)
   └─ CTA Button (outside inner card)
```

**Critical Design Decision:** Inner card ENDS at Development toggle. Features and button are outside inner card but inside outer card.

### Typography Specifications

- **Card Titles:** `font-geist font-bold text-[20px] tracking-tighter`
- **Matched to Benefits section:** Cross-referenced with `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/src/components/Benefits/Benefits.tsx` for consistency
- **Price formatting:**
  - Main price: `text-xl font-bold`
  - Period (/mo, Start): `text-sm` aligned with `flex items-start`

### Spacing System

**Icon Positioning:**
- Absolute position: `top-[20px] left-[20px]` from inner card
- Icon box: `p-3 rounded-xl`
- Matches Development toggle positioning pattern

**Card Heights:**
- Subscribe card inner: `h-[240px]`
- Retainer/Project card inner: `h-[252px]` (5% taller)
- Ensures alignment across all three cards

**Card Gap:**
- Grid gap: `gap-[7px]` (matches outer/inner card padding for visual consistency)
- Previously was `gap-6` (24px) - reduced to increase card width

**Development Toggle Block:**
- Internal padding: `px-[20px] py-[20px]`
- External margins: **REMOVED** (was `mt-[5px] mx-[20px] mb-[20px]`)
- **Latest change:** Set margins to match icon positioning (20px from inner card edges via inner card's p-[20px])
- Positioning relies on inner card's padding instead of explicit margins

### Visual Effects

**Shadows:**
- Inner cards: `shadow-md`
- Buttons: Inherited from Button component
- Development toggle: `shadow-sm`

**Icon Styling:**
- Lightning bolt (Retainer): SVG path
- Monitor (Project): SVG with play button
- Both icons: `width="24" height="24" strokeWidth="2.5"`
- Container: Inverted colors (dark background in light card, white in dark card)

## Critical Bugs Fixed

### 1. Localhost Crashing (Turbopack Issue)
**Problem:** After every change, localhost crashed with "FATAL: An unexpected Turbopack error occurred"

**Solution:** Disabled Turbopack in package.json:
```json
"dev": "TURBOPACK=0 next dev"
```

**File:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/package.json:7`

### 2. Icon Positioning Confusion
**Problem:** User wanted icon in top-left corner of INNER card, not outer card

**Initial attempt:** Reduced padding/gap (wrong approach)

**Solution:** Used absolute positioning:
```tsx
<div className="absolute top-[20px] left-[20px]">
```

**Lesson learned:** Always clarify which container the user is referring to when dealing with nested structures.

### 3. Development Block Not Lowering
**Problem:** Adding `mt-[5px]` didn't work due to `gap-4` on parent flex container

**Attempts:**
1. Added `mt-[5px]` - didn't work
2. Tried `-mt-[-5px]` - invalid syntax
3. Added `mb-[5px]` to previous element + `mt-[5px]` - worked

**Final solution:** Removed all external margins, relying on inner card's `p-[20px]` for consistent 20px spacing from edges

## Design Iteration Process

User made ~30+ adjustments following this pattern:
1. Icon positioning (corner → offset → rounded → sized → final 20px offset)
2. Typography sizing (matched to Benefits section "Умные диалоги")
3. Price formatting (superscript attempt → flex alignment)
4. Card widths (gap reduction from 24px → 7px)
5. Inner card heights (240px → 252px for retainer/project)
6. Shadow additions (inner cards, buttons, development toggle)
7. Development block positioning (multiple padding/margin adjustments)

**Key Pattern:** User provides visual references (screenshots) and precise measurements in pixels

## Current Status

**Completed:**
- ✅ Three-card layout with correct nesting
- ✅ Icon positioning in top-left corner (20px offset)
- ✅ Typography matching across sections
- ✅ Price formatting with proper alignment
- ✅ Card width optimization (reduced gap to 7px)
- ✅ Inner card height differentiation (240px vs 252px)
- ✅ Shadow additions across components
- ✅ Development toggle positioning (margins removed, using inner card padding)
- ✅ Turbopack crash fix

**In Progress:**
- Development toggle block positioning refinement
- User is verifying the latest change (margins removal)

## Next Steps

1. Wait for user verification of Development block positioning
2. Likely similar adjustments for the dark card (Single Project)
3. Possible fine-tuning of other spacing/typography

## Technical Notes

### Environment
- **Framework:** Next.js 16.0.6
- **React:** 19.2.0
- **TypeScript:** Yes
- **Styling:** Tailwind CSS with cn() utility (clsx + tailwind-merge)
- **Animation:** Framer Motion 12.23.25
- **Fonts:** Geist (headings), Inter (body)

### Dev Server
Multiple background bash processes detected (9 instances) - likely from previous crash recovery attempts. May need cleanup:
- Shell IDs: 523ec2, 28822c, e1f7b2, fdfb54, 83699a, 428c38, a62932, 8ab5b5, 130bfe

### Testing Approach
- Visual verification in browser (localhost:3000)
- User provides screenshots for comparison
- Iterative pixel-perfect adjustments

## Architectural Insights

**Why Two-Card System:**
- Outer card creates the "frame" effect (7px padding)
- Inner card contains the core information (fixed height)
- Features/button outside inner card allows variable content without breaking layout

**Why Absolute Positioning for Icon:**
- Allows precise corner placement independent of text flow
- Text can use `mt-[50px]` to clear the icon
- No flex/grid complexity needed

**Why Gap Reduction (24px → 7px):**
- Visual consistency: gap matches outer/inner card padding
- Increases card width without changing container max-width
- Creates tighter, more cohesive pricing section

## Memory for Next Session

**If continuing this work:**
1. Check if Development block positioning is satisfactory
2. Apply same positioning logic to dark card if needed
3. Verify all spacing matches between retainer and project cards
4. Consider cleaning up background bash processes
5. Test responsive behavior (mobile/tablet)

**If switching to new task:**
- This task is in formix-landing-nextjs repo, NOT ai_admin_v2
- No commits made yet - all changes are local
- User is actively reviewing each change - very iterative process
- Turbopack fix is critical - don't revert package.json change

## User Communication Style

- Russian language
- Visual learner (provides screenshots)
- Precise measurements (pixels, percentages)
- Iterative refinement approach
- References other sections for consistency ("как в секции 'возможности'")
- Uses imperative commands ("сделай", "убери", "увеличь")

## Lessons Learned

1. **Always clarify container references** - "card" can mean outer or inner in nested structures
2. **Check existing sections for consistency** - user wants typography to match across sections
3. **Turbopack can be unstable** - have fallback ready (TURBOPACK=0)
4. **Visual references are gold** - screenshots prevent miscommunication
5. **Margin vs padding matters** - especially in nested flex/grid layouts
6. **Absolute positioning for decorative elements** - simplifies layout logic
7. **User will iterate many times** - patience and precision matter

---

**Last command executed:** Removed external margins from Development toggle block
**Next expected:** User verification and possible further adjustments
