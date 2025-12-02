# Formix Clone - Context & Key Decisions

**Last Updated:** 2025-12-02 (Session: Hero Gallery Positioning Fix)

---

## 🔥 CRITICAL SESSION STATE (Updated: 2025-12-02 - HERO GALLERY POSITIONING)

### Current Implementation Status
- **Phase:** Phase 5 (Why Us Section) - ✅ COMPLETE
- **Progress:** 5/18 phases complete (27.8% overall progress)
- **Status:** ✅ **CLEAN STATE** - All changes committed
- **Last Commit:** 26babdd ("fix(hero): adjust gallery positioning to -top-[175px]")
- **Next Immediate Step:** Begin Phase 6 (Benefits, Projects, Pricing, Clients, or FAQs)
- **Dev Server:** Running at http://localhost:3000 (multiple instances may be running)
- **Branch:** main (formix-landing-nextjs)
- **Project Location:** `/Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs/`

### ✅ CURRENT WORKING STATE

**Git Status:** Clean - no uncommitted changes

**Recent Commits:**
1. `26babdd` - Hero gallery positioning fix (⚠️ CRITICAL VALUE - DO NOT CHANGE)
2. `225e455` - Content localization (Russian navigation)
3. `6e9e9d4` - Why Us section implementation
4. `1f22422` - Viewport blur and typography
5. `c7489b9` - Color system updates

---

## 📋 LATEST SESSION WORK (2025-12-02 - Hero Gallery Positioning)

### Session Duration
**Start:** ~18:30
**End:** ~19:30 (60 minutes)
**Focus:** Fine-tuning Hero section gallery positioning

### Session Goals
✅ Fixed Hero gallery positioning after user feedback
✅ Found optimal value through iterative testing
✅ Committed final value with warning not to change
✅ Updated documentation

### Changes Made This Session

#### 1. Hero Gallery Positioning (CRITICAL)

**File:** `src/components/Hero/Hero.tsx`

**Final Values (DO NOT CHANGE):**
```tsx
// Line 36: Gallery container positioning
className="hidden lg:block w-[584px] h-[849px] absolute -right-[12px] -top-[175px] overflow-hidden"

// Line 38: Inner grid positioning
<div className="grid grid-cols-2 gap-0 relative -top-[144px]">
```

**Evolution of Values:**
- Original: `-top-[160px]` (container)
- After +6px: `-top-[166px]`
- After +4px: `-top-[170px]`
- **Final:** `-top-[175px]` ⚠️ **LOCKED VALUE**

**Inner grid remained:** `-top-[144px]` (was `-top-32` = 128px, adjusted +16px earlier)

**User Instruction:** "Сохрани это значение! Никогда его не меняй"

**Commit Message Notes:**
```
This value was found through iterative refinement and should NOT be changed.
```

---

## 🎯 CRITICAL VALUES TO PRESERVE

### Hero Gallery Positioning
⚠️ **NEVER CHANGE THESE VALUES:**
- Gallery container: `-top-[175px]` (line 36 in Hero.tsx)
- Inner grid: `-top-[144px]` (line 38 in Hero.tsx)
- Gallery right position: `-right-[12px]`
- Gallery dimensions: `w-[584px] h-[849px]`

**Rationale:** Found through extensive user testing and iterative refinement over multiple sessions. User explicitly requested these values be locked.

### Other Locked Values
- Why Us padding: `22px` (found after 9 iterations - see previous sessions)
- Max width: `1280px` (all sections)
- Viewport blur: REMOVED (user preference)

---

## 💡 PATTERNS DISCOVERED (Updated)

### Positioning Iteration Pattern
When user requests positioning adjustments:
1. Start with small increments (4-6px)
2. Test each change immediately
3. User will request multiple adjustments
4. Final value will be explicitly confirmed ("Сохрани это значение!")
5. Commit immediately with warning comment
6. Document in context as "DO NOT CHANGE"

### Gallery Positioning Architecture
```
Parent Container (motion.div)
├─ Position: absolute
├─ Top: -175px (LOCKED)
├─ Right: -12px
└─ Child Grid (div)
   ├─ Position: relative
   └─ Top: -144px (LOCKED)
```

Both values work together - changing one without the other breaks alignment.

### Content Localization Pattern
When localizing content:
1. **Navigation first** - Sets the tone for the entire site
2. **Section badges match navigation** - Consistent terminology
3. **Hero messaging** - Most critical, should be platform-agnostic
4. **Gradual rollout** - Don't localize everything at once, risk inconsistency

### Gray Accent Consistency
All gray accent text should use `text-dark/50` not `text-gray-500`:
- Provides consistent opacity across the site
- Matches color system in tailwind.config.ts
- Example: Hero heading, Why Us heading (both use text-dark/50)

### Professional Tone Markers
Avoid these terms in user-facing content:
- "Beta" (implies unstable)
- Platform names in primary heading (too limiting)
- "24/7" (use "круглосуточно" instead for Russian audience)
- Problem-focused language (use solution language)

---

## 🎯 USER PREFERENCES CAPTURED (Updated)

1. **Prefers tight line spacing** for descriptions (0.85-0.9 range)
2. **Wants 5 words per line max** in descriptions
3. **Softer black** (34,34,34) instead of pure black
4. **Orange accents** for interactive elements (arrows)
5. **Balanced spacing** between top and bottom card content
6. **Iterative refinement workflow** - prefers seeing changes and adjusting incrementally
7. **Subtle effects** - viewport blur should be "barely noticeable" (or removed)
8. **Precise padding** - went through 9 iterations to find perfect 22px value
9. **Russian-first navigation** - Primary nav items should be in Russian
10. **Platform-agnostic messaging** - Don't mention WhatsApp in hero heading
11. **Professional tone** - Avoid "beta" and other disclaimers
12. **Action-focused copy** - Lead with what product does, not what it is
13. **Locks values after finding right one** - Explicitly requests "никогда не меняй"

---

## 📊 PROJECT PROGRESS

**Completed Phases:**
- ✅ Phase 0: Project Setup
- ✅ Phase 1: Foundation (fonts, animations)
- ✅ Phase 2: Navigation (frosted glass, rolling text)
- ✅ Phase 2.1: Navigation Redesign (light theme, active tracking)
- ✅ Phase 3: Hero Section (with carousel gallery)
- ✅ Phase 4: Services Section (horizontal cards)
- ✅ Phase 5: Why Us Section (animated counters)

**Content Updates:**
- ✅ Hero heading and description (Russian, professional)
- ✅ Navigation localization (partial - 2/7 links: Кейсы, Преимущества)
- ✅ Section badges (Services: "Кейсы", Why Us: "Преимущества")
- ✅ Hero gallery positioning (LOCKED VALUES)
- ⬜ Remaining sections (Benefits, Projects, Pricing, Clients, FAQs)

**Remaining Phases:** 13/18 (72.2%)

**Next Focus:**
- Choose Phase 6 section to implement (Benefits, Projects, Pricing, Clients, or FAQs)

---

## 🐛 SESSION ISSUES & RESOLUTIONS

### Issue 1: Multiple Background Dev Servers
**Problem:** Many bash background processes running dev server from previous sessions
**Impact:** Potential port conflicts, resource usage
**Solution:** `killall node` before starting new server
**Status:** ONGOING - Clean up recommended before next phase

### Issue 2: Initial Confusion About Which Section
**Problem:** Started modifying Services section when Hero was intended
**Impact:** Had to revert changes, wasted ~5 minutes
**Solution:** Always confirm which section user is referring to
**Status:** RESOLVED - Clarified and reverted changes

### Issue 3: Gallery Positioning Iterations
**Problem:** Took 5 iterations to find correct positioning
**Impact:** Required careful tracking of each value change
**Solution:** User tested each change visually, confirmed final value
**Status:** RESOLVED - Final value committed and documented

---

## 📂 FILE MODIFICATIONS SUMMARY (Current Session)

| File | Change | Status |
|------|--------|--------|
| `Hero.tsx` | Gallery positioning: `-top-[175px]` (line 36) | ✅ COMMITTED |
| `ServiceCard.tsx` | Reverted experimental changes | ✅ CLEAN |

**Total:** 1 file modified, committed in `26babdd`

---

## 🔄 NEXT IMMEDIATE STEPS

1. **Clean Up Background Processes**
   ```bash
   killall node
   cd /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs
   npm run dev
   ```

2. **Choose Next Phase** (User decision)
   Options:
   - Phase 6a: Benefits Section (4-5 hours)
   - Phase 6b: Projects/Portfolio Section (5-6 hours)
   - Phase 6c: Pricing Section (5-6 hours)
   - Phase 6d: Clients/Logos Section (2-3 hours)
   - Phase 6e: FAQs Section (4-5 hours)

3. **Before Starting Next Phase:**
   - Verify dev server is running clean
   - Check git status (should be clean)
   - Review task checklist for chosen phase
   - Read relevant SESSION_SUMMARY files for patterns

---

## 📝 HANDOFF NOTES FOR NEXT SESSION

### Exact State
- ✅ All code committed
- ✅ Dev server may need restart (multiple instances)
- ✅ Hero gallery positioning FINALIZED (do not touch)
- ✅ Ready to start Phase 6

### Commands to Run First
```bash
# 1. Check git status
cd /Users/arbakvoskanyan/Documents/GitHub/formix-landing-nextjs
git status

# 2. Kill old dev servers
killall node

# 3. Start clean dev server
npm run dev

# 4. Verify in browser
open http://localhost:3000
```

### What's Working
- Navigation with Russian labels
- Hero section with properly positioned gallery
- Services section with horizontal cards
- Why Us section with animated counters
- All animations and transitions

### What's Next
- Implement one of the remaining sections (Benefits, Projects, Pricing, Clients, FAQs)
- Continue content localization if needed
- Test responsive behavior on all sections

### Known State
- No build errors
- No TypeScript errors
- Dev server compiling successfully
- All animations working
- Responsive layout intact

---

## 📚 REFERENCE DOCUMENTATION

**Key Files to Review Before Next Phase:**
- `formix-clone-pixel-perfect-plan.md` - Overall project plan (863 lines)
- `formix-clone-pixel-perfect-tasks.md` - Detailed task breakdown (1,218 lines)
- `SESSION_SUMMARY_2025-12-01_PHASE*.md` - Lessons from completed phases
- `FORMIX_COMPLETE_ANALYSIS.md` - Original Formix analysis (37k lines)

**Session Summaries Available:**
- Phase 0: Project Setup (25 min)
- Phase 1: Foundation (15 min)
- Phase 2: Navigation (45 min + 60 min redesign)
- Phase 3: Hero Section (multiple sessions)
- Phase 4: Services Section (75 min + 45 min refinements)
- Phase 5: Why Us Section (45 min)

---

**Last Context Update:** 2025-12-02 ~19:30
**Session State:** Clean - All work committed
**Dev Server:** Running (may need restart)
**Working Directory:** Clean (no uncommitted changes)
**Next Action:** Choose and implement Phase 6 section
