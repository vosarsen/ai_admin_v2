# Formix Complete Layout Structure
## Extracted from RTF Code + Screenshots Analysis

Based on analysis of original Formix code (`Код Formix.rtf`) and screenshots.

---

## 📐 Complete Section Breakdown

### 1. Hero Section

**TWO VARIANTS EXIST:**

#### Variant A - Centered Hero (Screenshot 1)
**Layout:** Centered, single column
- **Badge:** "Available For Projects" with pulsing red dot (centered)
- **Heading:** "Creative Design & Development" (centered, large)
- **Description:** 2 lines of text (centered)
- **Buttons:** 2 CTAs in row - "Get in Touch" (primary), "View Work" (secondary)
- **Avatar Stack:** 3 overlapping avatars + "Trusted by 100+ clients" text
- **Background:** Light gray (`rgb(229, 229, 229)`)
- **Animations:** Staggered fade-in from top (opacity + translateY)

#### Variant B - Split Hero with Bento Grid (Screenshot 2)
**Layout:** Two-column (40/60 split)

**Left Column (Text Content):**
- **Badge:** "Available For Projects" with pulsing red dot
- **Heading:** "World-Class Design Partner For AI Startups" (left-aligned, very large)
- **Description:** "Fast, reliable, and scalable design solutions..."
- **Buttons:** 2 CTAs stacked OR in row
  - "View Pricing" (primary, orange)
  - "Book Free Call" (secondary, dark)
- **Trust badge:** Avatar row + "Trusted by 50+ Businesses" with 5 stars
- **Alignment:** Left-aligned

**Right Column (Bento Grid Images):**
- **Grid layout:** Masonry/Bento box grid
- **Images:** 6-8 project previews in different sizes
  - Some 1x1 (square)
  - Some 1x2 (portrait)
  - Some 2x1 (landscape)
- **Rounded corners:** 12-16px
- **Gap:** 12-16px between images
- **Images show:** Phone mockups, cards, design work, green textures
- **Top-right badge:** "Buy Template" button (small, floating)
- **Bottom-right badge:** "Made in Framer" watermark

**Background:** White or very light gray
**Animations:** Images slide in from right with stagger

---

### 2. Services Section (id="services")
**Layout:** Two-column grid with service cards

#### Left Column (Text Content):
- **Badge:** "// Services //" (dark pill with orange slashes)
- **Heading:** "How We Grow Your Business"
  - "Your Business" in gray color
- **Description:** "We combine strategy, speed, and skill..."
- **Alignment:** Left-aligned

#### Right Column (Service Cards Grid):
**Grid:** 3 columns x 3 rows = 9 service cards

**Each Card Structure:**
- **Background:** Light gray (`rgb(229, 229, 229)`)
- **Inner card:** Lighter gray (`rgb(240, 240, 240)`)
- **Border radius:** 20px outer, 16px inner
- **Shadow:** Soft shadow (0px 0.6px...10px)
- **Content:**
  - Icon (dark circle, 8px radius, white icon inside)
  - Heading (H3 - "Brand identity", etc.)
  - Description text
  - Tags row (3-4 small pills with icons + text)
- **Image carousel:** Draggable horizontal image slider below card

**9 Services:**
1. Brand identity
2. Web design
3. UI/UX Design
4. Marketing Design
5. Product Design
6. Webflow Development
7. Framer Development
8. Motion Design
9. Consulting

**Animations:**
- Stagger animation (each card fades in sequentially)
- Cards: `opacity:0;transform:translateY(10px)` → visible
- Image carousel: drag-to-scroll with smooth momentum

---

### 3. Why Us Section (id="why-us")
**Layout:** Two-column (50/50 split)

#### Left Column:
- Large image/visual with rounded corners
- **Image might be:** Bento grid of smaller images OR single hero image

#### Right Column (Text):
- **Badge:** "// Why Us //"
- **Heading:** Large heading (H2)
- **Description:** Multiple paragraphs
- **List:** Checkmark bullets with benefits
- **CTA Button:** Primary button at bottom
- **Alignment:** Left-aligned

**Background:** White or light gray
**Spacing:** Large gap between columns (~60-80px)

---

### 4. Benefits Section (id="benefits")
**Layout:** Single column, vertical list

- **Badge:** "// Benefits //"
- **Heading:** Centered or left
- **Benefits List:** 6-8 benefit items, each with:
  - Icon (left side, in colored circle)
  - Title (bold)
  - Description text (2-3 lines)
- **Layout:** Vertical stack with consistent spacing

**Alignment:** Centered content, left-aligned text within items
**Background:** Contrasting section (dark or colored)

---

### 5. Work/Portfolio Section (id="work")
**Layout:** Masonry grid OR regular 2-column grid

Based on screenshot #2:
- **Grid of project cards** with images
- **Bento box layout:** Mixed sizes (some 1x1, some 2x1)
- **Images:** Product shots, mockups, brand work
- **Hover effect:** Scale up slightly, show overlay with project name
- **Gap:** Consistent spacing between cards (~20-30px)

**Structure per card:**
- Image (full card background)
- Optional: Overlay with project title on hover
- Border radius: ~17px

**Background:** Light gray or white
**Grid:** 2-3 columns responsive

---

### 6. Pricing Section (id="pricing")
**Layout:** 3-column grid (3 pricing tiers)

**Each Pricing Card:**
- **Card structure:**
  - Badge/label at top ("Most Popular" for middle)
  - Plan name (H3)
  - Price (large text with currency)
  - Billing period
  - Description
  - Feature list (checkmarks)
  - CTA button (primary for middle, secondary for others)
- **Border radius:** 20px
- **Shadow:** Card shadow
- **Background:** White cards on gray background
- **Middle card:** Highlighted/elevated (larger, different color/border)

**Animations:** Hover effects (slight scale, shadow increase)

---

### 7. Logos Section (id="logos")
**Layout:** Infinite horizontal marquee (3 rows)

**Structure:**
- 3 horizontal rows of logos
- Each row: Infinite loop scroll (left to right OR alternating)
- **Logos:** Client/partner logos in grayscale
- **Animation:** Continuous smooth scroll
- **Mask:** Gradient fade on left/right edges
  - `mask-image: linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 12.5%, rgba(0,0,0,1) 87.5%, rgba(0,0,0,0) 100%)`

**Speed:** Slow, smooth (different speeds per row for visual interest)
**Background:** Dark or contrasting color

---

### 8. Reviews/Testimonials Section (id="reviews")
**Layout:** Horizontal scrolling cards OR 3-column grid

**Each Review Card:**
- **Quote text** (larger, emphasized)
- **Rating:** 5 stars (visual)
- **Author info:**
  - Avatar (circular, left or top)
  - Name
  - Title/Company
- **Card style:**
  - White background
  - Border radius: 16-20px
  - Soft shadow
  - Padding: generous

**Layout:** Horizontal scroll on mobile, grid on desktop
**Background:** Light gray or white

---

### 9. FAQs Section (id="faqs")
**Layout:** Single column accordion

**Structure:**
- **Heading:** "Frequently Asked Questions" (centered)
- **Accordion items:** 6-10 FAQ items
  - **Closed state:** Question + chevron down icon
  - **Open state:** Question + answer text + chevron up icon
  - **Divider:** Line between items
  - **Border radius:** 12-16px per item
  - **Background:** Light background

**Animation:**
- Smooth expand/collapse (height animation)
- Chevron rotation (180deg)
- One item open at a time OR multiple open

**Spacing:** Consistent gaps between items

---

### 10. Contact/Footer Section (id="contact")
**Layout:** Two-column OR single centered column

#### Contact Form (if present):
- **Form fields:**
  - Name
  - Email
  - Message (textarea)
- **Submit button:** Primary CTA
- **Form style:** Clean, minimal, rounded inputs

#### Footer:
- **Logo**
- **Navigation links** (same as header)
- **Social icons**
- **Copyright text**
- **Layout:** Multi-column OR single row

**Background:** Dark color (`rgb(21, 22, 25)`)
**Text color:** White

---

## 🎨 Global Design Patterns

### Spacing System
- **Section padding:** 80-120px vertical
- **Container max-width:** 1350px
- **Container padding:** 80px desktop, 50px tablet, 10px mobile
- **Element gaps:** 20px, 30px, 60px

### Typography
- **Headings:** Geist font, weights 600-900
- **Body:** Inter font, weights 400-600
- **Sizes:** 14px (small) → 72px (hero)

### Colors
- **Primary:** `rgb(21, 22, 25)` (dark)
- **Accent:** `rgb(255, 71, 38)` (orange-red)
- **Background:** `rgb(229, 229, 229)` (light gray)
- **Cards:** `rgb(240, 240, 240)` (lighter gray)
- **Text:** Dark on light, white on dark

### Border Radius
- **Large cards:** 20px
- **Medium cards:** 16px
- **Small elements:** 8-12px
- **Pills/badges:** 25px (full round)

### Shadows
- **Cards:** Multi-layer shadows (0.6px, 2.28px, 10px)
- **Buttons:** Strong shadow (0px 7px 20px 0.5px)
- **Hover:** Increased shadow intensity

### Animations
- **Entry animations:** Stagger pattern (0.1s delay between items)
- **Transform:** `translateY(10px)` → `translateY(0)`
- **Opacity:** `0` → `1`
- **Duration:** 0.6-0.8s
- **Easing:** Cubic bezier `[0, 0, 0.2, 1]`
- **Hover:** Scale 1.05, shadow increase

---

## 📱 Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 809px) {
  /* Single column layouts */
  /* Reduced padding */
  /* Smaller typography */
}

/* Tablet */
@media (min-width: 810px) and (max-width: 1199px) {
  /* 2 columns for grids */
  /* Medium padding */
}

/* Desktop */
@media (min-width: 1200px) {
  /* 3 columns for grids */
  /* Full padding */
  /* Largest typography */
}
```

---

## 🎯 Implementation Priority

1. ✅ Hero (DONE)
2. ⏭️ Services (9 cards + carousel)
3. Why Us (2-column)
4. Benefits (vertical list)
5. Work (masonry grid)
6. Pricing (3 cards)
7. Logos (marquee)
8. Reviews (card grid)
9. FAQs (accordion)
10. Contact + Footer

**Estimated time:** 40-50 hours remaining
