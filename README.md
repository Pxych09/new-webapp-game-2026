# Design System Inspired by Fruit Game 2026

## 1. Visual Theme & Atmosphere

Fruit Game 2026 embodies a bold, retro-futuristic arcade aesthetic infused with modern dark-mode sensibilities. The design embraces a cyberpunk energy through a deep navy and charcoal foundation, punctuated by vibrant neon accents in magenta, cyan, and golden yellow. The grid-lined background and sharp-edged typography create a nostalgic yet contemporary gaming interface, evoking 80s arcade cabinets reimagined for 2026. The overall mood is playful yet sophisticated, balancing whimsy with precision—a design language that celebrates fun while maintaining a premium, polished presentation.

**Key Characteristics**
- Deep navy and charcoal dark mode foundation with high contrast
- Neon accent colors (magenta, cyan, gold) for vibrancy and energy
- Retro-arcade typography with modern geometric precision
- Layered shadows and elevation creating depth in a flat design
- Minimalist card-based component system with bold borders
- Golden yellow as a utility warning and highlight accent
- Accessible light text on dark backgrounds throughout

## 2. Color Palette & Roles

### Primary
- **Navy Surface** (`#1A1A2E`): Primary container and card backgrounds; establishes the dark foundation
- **Deep Navy** (`#0A0A12`): Darkest background layer; used for page-level backgrounds and deep depth
- **Ultra Dark Navy** (`#12121E`): Intermediate dark tone for subtle layering

### Accent Colors
- **Magenta** (`#FF4D6D`): High-energy accent for highlighting and emotional emphasis; used in button highlights and status indicators
- **Cyan** (`#00F5D4`): Bright, cool accent for secondary highlights and interactive elements; creates neon contrast

### Interactive
- **Primary Button** (`#FFFFFF`): Clean, accessible call-to-action surfaces; high contrast text overlay
- **Secondary Button Surface** (`#1A1A2E`): Dark button backgrounds with reduced prominence
- **Golden Yellow** (`#F7C948`): Warning, alert, and special action states; decorative accents and hover states

### Neutral Scale
- **Light Neutral** (`#E8E8F0`): Primary text color; high contrast for readability on dark backgrounds
- **Light Neutral Dark** (`#DDDDDD`): Secondary text, borders, and reduced-emphasis content
- **Charcoal** (`#1A1A1A`): Deep neutral for text on light backgrounds and semantic boundaries

### Surface & Borders
- **Card Border** (`#2E2E55`): Subtle border definition on card and container elements; creates visual separation without harshness
- **Muted Purple** (`#6C6C9A`): Tertiary surface tone used for buttons, pills, and secondary containers; softer than navy

### Semantic / Status
- **Warning / Alert** (`#F7C948`): Warnings, notifications, and special states; golden yellow communicates importance and urgency

## 3. Typography Rules

### Font Family
- **Primary Display**: Bungee Shade (https://fonts.googleapis.com/), fallback `Bungee, cursive`
- **Secondary Display**: Bungee (https://fonts.googleapis.com/), fallback `sans-serif`
- **Body & UI**: Space Mono (https://fonts.googleapis.com/), fallback `monospace`

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display / h1 | Bungee Shade | 30.8px | 700 | 30.8px | normal | Logo and page hero text; bold arcade presence |
| Heading / h2 | Bungee | 28px | 700 | normal | normal | Section headings; strong visual hierarchy |
| Subheading / h3 | Bungee | 16.8px | 700 | normal | normal | Card titles and mid-level headings |
| Button Text | Space Mono | 14px | 700 | normal | normal | Primary button labels; bold for emphasis |
| Button Small | Bungee | 10.5px | 400 | normal | normal | Compact pill buttons and secondary actions |
| Button Accent | Bungee | 12.6px | 400 | normal | normal | Warning and special action buttons |
| Body Text | Space Mono | 11.9px | 400 | 19.04px | normal | Primary content and descriptive text |
| Caption | Space Mono | 11.9px | 400 | 19.04px | normal | Helper text, metadata, and fine print |
| Hero Span | Space Mono | 49px | 400 | normal | normal | Extra-large accent text and massive numbers |

### Principles
- Typography favors bold, geometric sans-serifs for display and accent text; creates arcade arcade energy
- Body text uses monospace font for technical, gaming-focused personality
- Weight contrast is deliberate: bold headings + regular body text creates clarity
- Line heights are tight for display (1.0 ratio), generous for body (1.6 ratio) to aid readability
- All font families are Google Fonts for consistency and web performance

## 4. Component Stylings

### Buttons

#### Primary Button (Large CTA)
- **Background**: `#FFFFFF`
- **Text Color**: `#1A1A1A`
- **Font**: Space Mono, 14px, weight 700
- **Padding**: `14px 14px`
- **Border Radius**: `12px`
- **Border**: `2px solid #DDDDDD`
- **Height**: `53px`
- **Width**: `338px`
- **Box Shadow**: none
- **Hover State**: Background `#E8E8F0`, shadow `0 4px 12px rgba(247, 201, 72, 0.2)`
- **Active State**: Background `#DDDDDD`

#### Secondary Button (Small Pills)
- **Background**: `#1A1A2E`
- **Text Color**: `#E8E8F0`
- **Font**: Bungee, 10.5px, weight 400
- **Padding**: `6px 14px`
- **Border Radius**: `12px`
- **Border**: `2px solid #2E2E55`
- **Height**: auto
- **Box Shadow**: none
- **Hover State**: Border `2px solid #6C6C9A`, background `#2E2E55`
- **Active State**: Background `#6C6C9A`

#### Warning Button (Golden)
- **Background**: `#F7C948`
- **Text Color**: `#0A0A12`
- **Font**: Bungee, 12.6px, weight 400
- **Padding**: `10px 20px`
- **Border Radius**: `12px`
- **Border**: `2px solid #F7C948`
- **Height**: auto
- **Box Shadow**: `0 0 30px rgba(247, 201, 72, 0.35)`
- **Hover State**: Background `#E8B938`, box-shadow `0 0 40px rgba(247, 201, 72, 0.5)`
- **Active State**: Background `#D4A630`

#### Tertiary Button (Dark Secondary)
- **Background**: `#1A1A2E`
- **Text Color**: `#E8E8F0`
- **Font**: Bungee, 12.6px, weight 400
- **Padding**: `10px 20px`
- **Border Radius**: `12px`
- **Border**: `2px solid #2E2E55`
- **Height**: auto
- **Box Shadow**: none
- **Hover State**: Border `2px solid #6C6C9A`, background `#2E2E55`
- **Active State**: Background `#6C6C9A`, border `2px solid #6C6C9A`

### Cards & Containers

#### Primary Card (Elevated)
- **Background**: `#1A1A2E`
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 14px, weight 400
- **Padding**: `48px 40px`
- **Border Radius**: `24px`
- **Border**: `1px solid #2E2E55`
- **Height**: 333.48px (context-dependent)
- **Width**: 420px (context-dependent)
- **Box Shadow**: `rgba(247, 201, 72, 0.08) 0px 0px 60px 0px, rgba(0, 0, 0, 0.5) 0px 20px 60px 0px`
- **Hover State**: Shadow increases to `rgba(247, 201, 72, 0.15) 0px 0px 80px 0px, rgba(0, 0, 0, 0.7) 0px 30px 80px 0px`

#### Transparent Card (Overlay)
- **Background**: `transparent`
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 14px, weight 400
- **Padding**: `0px`
- **Border Radius**: `0px`
- **Border**: none
- **Box Shadow**: none
- **Use**: Modal overlays, transparent containers, content layering

#### Accent Card (Golden Border)
- **Background**: `#1A1A2E`
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 14px, weight 400
- **Padding**: `36px 24px`
- **Border Radius**: `20px`
- **Border**: `2px solid #F7C948`
- **Box Shadow**: `rgba(247, 201, 72, 0.15) 0px 0px 30px 0px, rgba(247, 201, 72, 0.04) 0px 0px 30px 0px inset`
- **Hover State**: Shadow `rgba(247, 201, 72, 0.25) 0px 0px 40px 0px, rgba(247, 201, 72, 0.08) 0px 0px 30px 0px inset`
- **Use**: Highlighted sections, special content, call-outs

### Inputs & Forms

#### Text Input
- **Background**: `#0A0A12`
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 11.9px, weight 400
- **Padding**: `12px 16px`
- **Border Radius**: `12px`
- **Border**: `2px solid #2E2E55`
- **Height**: 40px
- **Placeholder Color**: `#6C6C9A`
- **Focus State**: Border `2px solid #F7C948`, box-shadow `0 0 20px rgba(247, 201, 72, 0.2)`
- **Error State**: Border `2px solid #FF4D6D`, box-shadow `0 0 20px rgba(255, 77, 109, 0.2)`

#### Textarea
- **Background**: `#0A0A12`
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 11.9px, weight 400
- **Padding**: `12px 16px`
- **Border Radius**: `12px`
- **Border**: `2px solid #2E2E55`
- **Min Height**: 80px
- **Focus State**: Border `2px solid #F7C948`, box-shadow `0 0 20px rgba(247, 201, 72, 0.2)`

### Navigation

#### Primary Navigation Item
- **Background**: transparent
- **Text Color**: `#E8E8F0`
- **Font**: Space Mono, 12px, weight 400
- **Padding**: `8px 12px`
- **Border Radius**: `8px`
- **Hover State**: Background `rgba(247, 201, 72, 0.1)`, text `#F7C948`
- **Active State**: Text `#F7C948`, border-bottom `2px solid #F7C948`

#### Mobile Navigation Toggle
- **Background**: `#1A1A2E`
- **Width**: 44px
- **Height**: 44px
- **Border**: `2px solid #2E2E55`
- **Border Radius**: `12px`
- **Hover State**: Background `#2E2E55`

## 5. Layout Principles

### Spacing System
- **Base Unit**: 4px
- **Scale**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 36px, 40px, 48px, 60px
- **Usage Context**:
  - 4px–8px: Micro spacing within components (button text padding, icon gaps)
  - 12px–16px: Component padding and inline spacing (form inputs, pills)
  - 20px–24px: Section spacing and content gaps (between cards, list items)
  - 32px–40px: Medium container padding (card interiors, modal spacing)
  - 48px–60px: Macro spacing and full-width section separation (hero sections, page breaks)

### Grid & Container
- **Max Width**: 1200px for content-heavy layouts; adjust based on viewport
- **Column Strategy**: 12-column grid at desktop; collapses to single column on mobile
- **Container Padding**: 24px on tablet, 16px on mobile, 40px on desktop
- **Card Columns**: 3 columns on desktop, 2 on tablet, 1 on mobile (gap: 16px)
- **Section Patterns**: Hero section with centered content, grid of cards below, footer full-width

### Whitespace Philosophy
- Generous whitespace around primary CTAs to establish hierarchy and reduce cognitive load
- Asymmetric padding favors left/right (horizontal) over top/bottom (vertical) in containers
- Negative space is treated as a design element; empty space conveys premium positioning
- Cards maintain consistent internal breathing room (36px–48px padding) to avoid cramping

### Border Radius Scale
- **4px**: Reserved for small interactive elements (compact icons, toggles)
- **8px**: Subtle rounding for secondary buttons, small inputs
- **12px**: Default rounding for buttons, form fields, small cards, navigation items
- **20px**: Medium cards and modular containers
- **24px**: Large primary cards, elevated components
- **50%**: Circular elements (avatars, icon buttons, rounded full-width buttons)

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow | Buttons, subtle backgrounds |
| Raised (sm) | `rgba(247, 201, 72, 0.08) 0px 0px 60px 0px, rgba(0, 0, 0, 0.5) 0px 20px 60px 0px` | Primary cards, floating containers |
| Elevated (md) | `rgba(247, 201, 72, 0.15) 0px 0px 30px 0px, rgba(247, 201, 72, 0.04) 0px 0px 30px 0px inset` | Accent cards with golden borders, highlighted sections |
| Hover (lg) | `rgba(255, 77, 109, 0.35) 0px 0px 30px 0px` | Warning buttons, interactive hover states, modal overlays |

**Shadow Philosophy**: The design employs dual-layer shadows—an outer glow cast by golden yellow (`#F7C948`) establishing the cyberpunk aesthetic, paired with a black shadow for traditional depth. Inset shadows on accent cards create a recessed, premium feel. Shadows are warm and colorful rather than purely neutral, reinforcing the neon arcade theme. Elevated components use the golden glow to draw focus, while interactive elements (buttons, warnings) employ magenta shadows for urgency and energy.

## 7. Do's and Don'ts

### Do
- Use dark backgrounds (`#1A1A2E`, `#0A0A12`) as the default for all surfaces to maintain the dark-mode aesthetic
- Pair Golden Yellow (`#F7C948`) with dark backgrounds for maximum contrast and warning emphasis
- Leverage Space Mono font for all body and UI text to maintain the technical, gaming personality
- Apply consistent `12px` border radius to all interactive elements (buttons, inputs, small cards)
- Use generous padding (40px–48px) inside primary cards to establish premium spacing and reduce density
- Include golden yellow glow shadows on elevated components to reinforce the neon arcade theme
- Place high-contrast text (`#E8E8F0` on `#1A1A2E`) for accessibility and readability
- Test all interactive states (hover, active, focus) with the golden yellow accent
- Maintain asymmetric padding (more horizontal than vertical) for a modern, balanced look
- Use Bungee or Bungee Shade font exclusively for headings and display text

### Don't
- Avoid light backgrounds or removing the dark color scheme; it breaks the core aesthetic
- Don't use colors outside the defined palette; stick to the 12 specified hex values
- Never apply shadows without the golden yellow glow component; neutral-only shadows feel flat and generic
- Avoid light text on light backgrounds; always ensure WCAG AA contrast ratios
- Don't mix font families within a single text block; use Bungee for display, Space Mono for body
- Never set border radius below `8px` or above `50%` unless justified by component type
- Avoid overusing the Magenta accent (`#FF4D6D`); reserve it for high-priority status and warnings
- Don't add padding below `4px` or above `60px` without clear hierarchy justification
- Avoid excessive shadows on small components; reserve dramatic shadows for elevated cards and modals
- Never remove borders from buttons and cards; the `2px solid` border is a core design language trait

## 8. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Key Changes |
|------------|-------|-------------|
| Mobile | 320px–599px | Single column layout, full-width cards, 16px padding, small buttons (`12px` font), collapsed navigation |
| Tablet | 600px–1023px | 2-column card grids, 24px padding, standard buttons, drawer or horizontal navigation |
| Desktop | 1024px+ | 3-column card grids, 40px padding, full horizontal navigation, max-content-width `1200px` |
| Large Desktop | 1440px+ | Expanded whitespace, up to 4-column grids in specific contexts, enhanced shadow depth |

### Touch Targets
- **Minimum Touch Target**: 44px × 44px for all interactive elements (buttons, form inputs, navigation links)
- **Recommended Touch Spacing**: 16px minimum gap between adjacent touch targets to prevent mis-taps
- **Padding Inside Touch Target**: At least 12px of internal padding to prevent accidental presses of content inside buttons
- **Icon Buttons**: 44px × 44px with centered icon (24px–28px icon size)
- **Text Buttons**: Height `53px` on mobile (primary); `40px` for secondary buttons

### Collapsing Strategy
- **Hero Section**: Reduce padding from `60px` to `24px` on mobile; stack text vertically
- **Card Grids**: 3 columns → 2 columns (tablet) → 1 column (mobile)
- **Navigation**: Horizontal menu → hamburger icon + drawer on mobile (drawer width: 80% max, 280px max-width)
- **Form Fields**: Full width on mobile with stacked labels above inputs; side-by-side on desktop with `12px` gap
- **Typography**: Reduce display sizes by 30–40% on mobile (e.g., h1: 30.8px → 22px)
- **Padding**: Scale down from `40px–48px` to `24px–32px` on tablet, `16px–20px` on mobile
- **Margin**: Reduce section margins from `60px` to `32px` on tablet, `24px` on mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary CTA**: White (`#FFFFFF`)
- **Primary Container**: Navy Surface (`#1A1A2E`)
- **Primary Text**: Light Neutral (`#E8E8F0`)
- **Accent / Warning**: Golden Yellow (`#F7C948`)
- **Secondary Accent**: Magenta (`#FF4D6D`)
- **Tertiary Accent**: Cyan (`#00F5D4`)
- **Secondary Background**: Deep Navy (`#0A0A12`)
- **Border Color**: Card Border (`#2E2E55`)
- **Secondary Button**: Muted Purple (`#6C6C9A`)
- **Heading Text**: Light Neutral (`#E8E8F0`)
- **Body Text**: Light Neutral (`#E8E8F0`)
- **Placeholder Text**: Muted Purple (`#6C6C9A`)

### Iteration Guide

1. **Always start with `#1A1A2E` as the base background** for cards, containers, and most surfaces; use `#0A0A12` only for page-level backgrounds or the darkest depths.

2. **Apply the full shadow stack** `rgba(247, 201, 72, 0.08) 0px 0px 60px 0px, rgba(0, 0, 0, 0.5) 0px 20px 60px 0px` to all elevated primary cards; this is non-negotiable for the neon arcade aesthetic.

3. **Use Space Mono font at 11.9px for body text** with 19.04px line height; never deviate for readability and technical personality consistency.

4. **Apply `12px` border radius as the default** for all buttons, inputs, and small/medium cards unless the component is explicitly circular (`50%`) or a large container (`20px–24px`).

5. **Reserve Golden Yellow (`#F7C948`) exclusively for warnings, alerts, and special CTAs**; use it in borders, text, and shadows to draw maximum attention and convey urgency.

6. **Maintain minimum 44px × 44px touch targets** for all interactive elements and ensure 16px spacing between adjacent targets to meet mobile accessibility standards.

7. **Use Bungee (not Bungee Shade) for all heading hierarchy** (h2, h3, h4); reserve Bungee Shade only for the largest display text (h1 / hero) to avoid visual chaos.

8. **Padding inside containers follows the hierarchy**: 48px for primary cards, 36px for accent cards, 12px–16px for inputs and small components, and scale down on mobile (24px, 20px, 12px respectively).

9. **Invert button logic: primary buttons are white on dark, secondary are dark on transparent**; always pair white buttons with the `2px solid #DDDDDD` border for visual definition.

10. **Test all focus states with `2px solid #F7C948` border and `0 0 20px rgba(247, 201, 72, 0.2)` shadow** to ensure keyboard navigation is visible and complies with WCAG accessibility standards.
