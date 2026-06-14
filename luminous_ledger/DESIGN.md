---
name: Luminous Ledger
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434656'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737688'
  outline-variant: '#c3c5d9'
  surface-tint: '#004dea'
  primary: '#0041c8'
  on-primary: '#ffffff'
  primary-container: '#0055ff'
  on-primary-container: '#e3e6ff'
  inverse-primary: '#b6c4ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#005c3e'
  on-tertiary: '#ffffff'
  tertiary-container: '#007751'
  on-tertiary-container: '#83ffc6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b3'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  margin-edge: 32px
---

## Brand & Style

This design system is engineered for a high-performance SaaS environment focusing on financial clarity and inventory precision. The brand personality is **authoritative yet frictionless**, positioning itself as a silent partner in the user's business growth. 

The aesthetic is **Modern Glassmorphism**, blending the systematic rigor of enterprise tools like Shopify with the refined visual polish of Stripe. We prioritize clarity through high-quality typography, subtle depth via translucency, and a focused color palette. 

**Core Design Principles:**
- **Clarity of Data:** Information density is balanced with generous whitespace to prevent cognitive overload.
- **Visual Tiering:** Use of background blurs and layered surfaces to establish a clear hierarchy of information.
- **Precision:** Every border, shadow, and radius is meticulously calculated to evoke a sense of professional craftsmanship and reliability.

## Colors

The palette is built on **Professional Blues** and **Slate Grays** to foster trust and long-term readability. 

- **Primary (#0055FF):** Used for primary actions, selection states, and brand-critical indicators.
- **Secondary (#6366F1):** An indigo accent used for secondary data points or subtle interactive elements.
- **Success/Tertiary (#10B981):** A crisp emerald for positive inventory status and successful billing cycles.
- **Neutral/Surface:** In light mode, we use "Slate 900" for text and "Slate 50" for subtle background layering.

**Glassmorphism Implementation:**
To achieve the glass effect, surfaces should use a semi-transparent white (or charcoal in dark mode) background with a `20px` to `40px` backdrop-filter blur. Borders on glass elements should be high-contrast (pure white at low opacity) to define the edge against varied backgrounds.

## Typography

We utilize **Inter** as the primary typeface for its exceptional legibility in data-dense interfaces and its neutral, professional character. For technical data and tabular inventory counts, we introduce **Geist** (or a similar high-precision mono-variant) to provide a distinct visual "click" for numerical values.

**Usage Guidelines:**
- **Headlines:** Use `Inter SemiBold` with slight negative letter-spacing to create a compact, modern feel.
- **Body:** Stick to `Inter Regular` for long-form descriptions or billing notes.
- **Tabular Data:** Use the `mono-data` role for SKUs, currency amounts, and tracking numbers to ensure vertical alignment of digits.

## Layout & Spacing

The layout follows a **12-column fluid grid** for the main content area, anchored by a fixed-width sidebar navigation.

- **Sidebar:** 260px wide, utilizing a glass background to show hints of the underlying background color or dashboard gradients.
- **Main Container:** Max-width of 1440px for desktop, centered with 32px side margins.
- **Spacing Rhythm:** We use a strict **4px baseline grid**. All margins and paddings must be multiples of 4 (e.g., 8, 16, 24).
- **Responsive Behavior:** 
    - **Desktop (>1024px):** Fixed sidebar, full 12-column grid.
    - **Tablet (768px - 1024px):** Sidebar collapses to icons only (64px) or a hidden drawer; 8-column grid.
    - **Mobile (<768px):** Single column, 16px horizontal margins, top navigation bar.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Luminous Depth**. Unlike traditional flat design, this system uses "Z-axis" stacking to separate controls from the canvas.

- **Level 0 (Canvas):** A subtle cool gray or off-white background (#F8FAFC).
- **Level 1 (Cards/Widgets):** Solid white with a very soft, 1px neutral border. No shadow or minimal 2px blur.
- **Level 2 (Glass Overlays):** Used for Search Bars and Modals. These utilize a 70% white fill with a 30px backdrop blur and a `1px` inner-glow border (pure white, 40% opacity).
- **Shadows:** Use "Ambient Shadows" — extremely diffused, light blue-tinted shadows (e.g., `0 8px 30px rgba(0, 85, 255, 0.04)`) to make elements feel like they are floating rather than sitting heavily on the page.

## Shapes

The shape language is **Rounded**, striking a balance between the "too-playful" look of fully pill-shaped buttons and the "too-rigid" feel of sharp corners.

- **Standard Elements:** 0.5rem (8px) for buttons, input fields, and small cards.
- **Large Elements:** 1rem (16px) for dashboard widgets and primary container cards.
- **Badges/Chips:** Full-round (pill) to distinguish them clearly from interactive buttons.
- **Interactions:** On hover, glass elements should slightly increase their background opacity (from 0.7 to 0.85) to provide tactile feedback.

## Components

### Sidebar Navigation
The sidebar should feel like a pane of glass. Use semi-transparent backgrounds with a vertical divider. Icons should be "Line" style with a 2px stroke. Active states are indicated by a 3px vertical "accent bar" on the left edge and a subtle background tint.

### Data Tables
Tables are the heart of the system. 
- **Header:** Sticky, with a subtle backdrop blur and 1px bottom border.
- **Rows:** 52px height for high density; 64px for standard. Zebra striping is replaced by a subtle hover-state background change.
- **Cells:** Use the `mono-data` typography for all numerical values.

### Glass Search Bar
The search bar should be a floating element with a `40px` blur. When focused, the border transitions from semi-transparent white to the Primary Blue, and the shadow expands slightly to suggest "lift."

### Status Badges
Status indicators (e.g., "Paid", "Low Stock", "Pending") use a soft-fill style: a low-opacity version of the status color (e.g., 10% Emerald) with high-contrast text of the same hue.

### Dashboard Widgets
Each widget is a card with an `8px` corner radius. Use a consistent padding of `24px`. Large-scale numbers (KPIs) should use `display-lg` sizing to ensure immediate visibility upon login.