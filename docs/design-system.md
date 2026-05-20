# Second Opinion Doctor - Design System & Component Library

## Visual Principles

1. **Trust first**: clear hierarchy, high legibility, calm visual rhythm.
2. **Healthcare warmth**: soft blue/green gradients, low-noise surfaces.
3. **Enterprise precision**: dashboard-grade data components and spacing scale.
4. **Mobile-native ergonomics**: thumb zones, bottom actions, high contrast controls.

---

## Color Tokens

### Light Mode

- `bg.default`: `#F5FBFF`
- `bg.surface`: `#FFFFFF`
- `text.primary`: `#102A43`
- `text.secondary`: `#4F6B85`
- `brand.primary`: `#0F7FE9`
- `brand.secondary`: `#17A38D`
- `state.success`: `#17A38D`
- `state.warning`: `#D39D23`
- `state.error`: `#DC4D67`

### Dark Mode

- `bg.default`: `#071320`
- `bg.surface`: `#0D2237`
- `text.primary`: `#E7F3FF`
- `text.secondary`: `#99B5D0`
- `brand.primary`: `#58B6FF`
- `brand.secondary`: `#45D1B7`

---

## Typography

- **Primary font**: Inter (fallback: SF Pro Display / Segoe UI).
- **Hero title**: 32/40, -2% tracking.
- **Section title**: 22/30, semibold.
- **Body**: 15/24 regular.
- **Label**: 12/16 medium, uppercase for metadata tags.

---

## Spacing & Radius

- Spacing scale: `4, 8, 12, 16, 24, 32`.
- Card radius: `18`.
- Input/button radius: `12`.
- Pill/chips radius: `999`.
- Shadow: `0 20 40 rgba(15,42,67,0.12)` light / stronger in dark mode.

---

## Component Library (Implemented in `src/components/ui.tsx`)

- `AppButton` (primary, secondary, ghost, danger)
- `Card` (title, subtitle, actions)
- `MetricCard` (KPI + delta)
- `Chip` (success/warning/error/info/neutral states)
- `SectionTitle` (headline block)
- `BarChart` (lightweight analytics visualization)
- `EmptyState` (illustrative empty/assistant states)

Domain patterns in `src/App.tsx`:

- Authentication panel with social + OTP options
- Upload dropzone for mixed medical file types
- Chat bubbles and secure messaging timeline
- Video consultation tiles
- Bottom navigation + floating action button for mobile
- Doctor triage queue and admin controls cards

---

## Accessibility Standards

- Color contrast targets AA minimum.
- Minimum touch target 44x44.
- Keyboard-focus visible for all interactive controls.
- Semantic heading and list hierarchy.
- User preference support for dark mode.

---

## Motion & Micro-interactions

- Screen transition: `slideUp 280ms ease`.
- Button hover elevation: translateY(-1px).
- AI assistant empty state pulse indicator.
- Sticky mobile bottom nav with blurred backdrop for depth.

---

## App Store Ready UX Checklist

- Splash + onboarding + auth continuity.
- Clear privacy/security positioning in first-run experience.
- Complete patient flow from upload -> consult -> payment -> follow-up.
- Doctor trust signals (verification, outcomes, language).
- Admin governance and analytics storytelling.
- Multi-language and translation controls surfaced in settings.
