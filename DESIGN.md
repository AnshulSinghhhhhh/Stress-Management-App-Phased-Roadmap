---
name: Serene Mindful Living
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf1'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fa'
  on-surface: '#111c2c'
  on-surface-variant: '#424843'
  inverse-surface: '#263142'
  inverse-on-surface: '#ebf1ff'
  outline: '#737973'
  outline-variant: '#c2c8c1'
  surface-tint: '#4b6453'
  primary: '#435c4b'
  on-primary: '#ffffff'
  primary-container: '#5b7563'
  on-primary-container: '#ddfbe4'
  inverse-primary: '#b1cdb8'
  secondary: '#506356'
  on-secondary: '#ffffff'
  secondary-container: '#d3e8d7'
  on-secondary-container: '#56695c'
  tertiary: '#495a4f'
  on-tertiary: '#ffffff'
  tertiary-container: '#617367'
  on-tertiary-container: '#e4f8e9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cdead4'
  primary-fixed-dim: '#b1cdb8'
  on-primary-fixed: '#072013'
  on-primary-fixed-variant: '#334c3c'
  secondary-fixed: '#d3e8d7'
  secondary-fixed-dim: '#b7cbbc'
  on-secondary-fixed: '#0e1f15'
  on-secondary-fixed-variant: '#394b3f'
  tertiary-fixed: '#d4e7d9'
  tertiary-fixed-dim: '#b8cbbd'
  on-tertiary-fixed: '#0e1f16'
  on-tertiary-fixed-variant: '#394b40'
  background: '#f9f9ff'
  on-background: '#111c2c'
  surface-variant: '#d8e3fa'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.5rem
    fontWeight: '500'
    lineHeight: 3rem
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '500'
    lineHeight: 2.5rem
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '500'
    lineHeight: 2.5rem
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.625rem
    fontWeight: '500'
    lineHeight: 2.125rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '500'
    lineHeight: 1.75rem
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.875rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.65rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.45rem
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '500'
    lineHeight: 1.375rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.015em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
  space-xl: 3.5rem
---

## Brand & Style

This design system embodies mindful tranquility, grounding rituals, and emotional spaciousness. Designed for intentional daily check-ins, reflection, and quiet awareness, it deliberately avoids the urgency, sensory overload, and compulsive mechanics common to contemporary digital products.

The interface functions as a digital sanctuary:
- **Atmosphere:** Minimalist and low-stimulation, utilizing expansive negative space, low visual friction, and organic softness.
- **Emotional Intent:** Non-judgmental, restorative, unhurried, and quiet. There are no punitive counters, hyper-stimulating badges, or competitive streak trackers.
- **Tactility:** Gentle, organic surfaces that feel like matte ceramic, linen paper, and smoothed river stone. Depth is soft and unassertive, favoring ambient diffusion over dramatic separation.

## Colors

The color palette establishes a quiet, nature-inspired visual rhythm anchored in soft sage and tranquil stone tones. 

- **Primary Canvas & Surfaces:** The base canvas uses `#F9FAF8` (warm off-white), establishing an eye-resting foundation without the harshness of pure `#FFFFFF`. Elevated surfaces utilize pure white `#FFFFFF` or pale mist `#F2F5F3` to create quiet layering.
- **Primary Tone (`#5B7563`):** A muted, deep sage green used for focal actions, selected states, and moments of calm completion. Tonal resting containers utilize `#E8EFE9`.
- **Secondary & Tertiary Accents (`#788B7D`, `#8FA295`):** Subdued moss and willow greens used for supporting progress steps, subtle indicators, and gentle graphic elements.
- **Borders & Dividers:** Outlines use `#DCE3DD` (muted stone), providing low-contrast definition that frames content without visual noise.
- **Typography & Text:** Primary body and headline text is set in `#24332C` (deep serene slate), providing legibility and softness. Supporting text, labels, and timestamps use `#46554E` and `#687770`.
- **Feedback & States:** Destructive or warning prompts avoid bright alerting reds; they use a grounded warm cedar/terracotta tone (`#A36B5E`) with calm contextual phrasing. Success states reuse the primary sage hue.

> ⚠️ **Project-specific override, read before implementing**: the `error` / `on-error-container` tokens in the front-matter above (`#ba1a1a`, `#93000a`) are Stitch's default Material error tokens and are a bright alert red — this contradicts the brand description immediately below, which specifies terracotta (`#A36B5E`) for all destructive/warning states. **The terracotta description wins.** The `error` token should be remapped to `#A36B5E` project-wide, and the crisis-resources screen specifically must never use the raw `error`/`on-error-container` tokens — see `STITCH_DESIGN_BRIEF.md`'s crisis-screen guidance (no red/alarm styling).

## Typography

Typography prioritizes quiet readability and warm humanism.

- **Display & Headings:** Set in **Plus Jakarta Sans** with medium (`500`) weights. High weights (bold/black) are intentionally avoided to remove visual shouting and aggression. Modest line heights and tight negative tracking provide an editorial feel.
- **Body & Controls:** Set in **Inter** with regular (`400`) and medium (`500`) weights. Generous line heights (`1.65` to `1.875`) promote relaxed pacing and cognitive ease during longer reflection periods.
- **Hierarchy:** Visual separation between elements relies primarily on size, scale, and subtle tonal shifts rather than heavy typographic weight changes.

## Layout & Spacing

The layout philosophy emphasizes generous breathing space, unhurried negative space, and centered, distraction-free reading lanes.

- **Grid Structure:** Content is organized using a focused 12-column fluid grid on desktop (max container width: `960px` for structured dashboards; `680px` for mindful reflection flows). On tablet devices, an 8-column layout applies with `1.5rem` gutters. On mobile, a 4-column layout is used with `1rem` gutters and `1.25rem` outer canvas padding.
- **Vertical Rhythm:** Sections and entry prompts are spaced widely using `space-lg` and `space-xl` to prevent claustrophobia or rushed interaction.
- **Density Policy:** High-density tables, multi-column side-by-side forms, and compact list stacks are strictly avoided. Elements must have space to exist independently.

## Elevation & Depth

Visual hierarchy is communicated via organic tonal tiers, subtle surface fills, and diffused, low-opacity shadows. 

- **Tonal Layers:** The base viewport begins at `#F9FAF8`. Interactive resting cards use `#FFFFFF` or `#F4F6F4`. Inset or grouped sub-elements rest on `#E8EFE9` with minimal elevation change.
- **Shadow Quality:** Shadows are quiet, diffused, and tinted with the deep slate tone rather than raw black:
  - *Resting Card Elevation:* `0px 4px 20px -4px rgba(36, 51, 44, 0.04), 0px 1px 3px 0px rgba(36, 51, 44, 0.02)`
  - *Hover / Gentle Lift:* `0px 8px 28px -6px rgba(36, 51, 44, 0.06), 0px 2px 6px 0px rgba(36, 51, 44, 0.03)`
  - *Floating Modal / Tray:* `0px 16px 40px -8px rgba(36, 51, 44, 0.08), 0px 4px 12px 0px rgba(36, 51, 44, 0.02)`
- **Border Integration:** All elevated surfaces carry a 1px border of `#DCE3DD` to maintain physical definition against off-white backgrounds without starkness.

## Shapes

The design system uses a pill-shaped and generously rounded structural language, reflecting organic, water-softened river stones.

- **Containers & Cards:** Primary cards, ambient containers, and reflection modals use wide curvatures (`rounded-2xl` at `1.5rem` to `rounded-3xl` at `2rem`), softening screen edges and promoting an inviting feel.
- **Interactive Controls:** Action buttons, chips, tags, and progress pills use fully continuous pill radius values (`9999px`).
- **Inner Inputs:** Input fields and interactive selector tiles use `1rem` to `1.25rem` radii to nest smoothly within outer parent containers.

## Components

### Buttons
- **Primary Action:** Full pill shape, `#5B7563` background, `#FFFFFF` text, padded with `0.875rem` vertical by `1.75rem` horizontal. On hover, subtly deepens to `#4F6756` with smooth 200ms ease transitions.
- **Secondary Action:** Full pill shape, `#E8EFE9` background with `#24332C` text and no harsh border. On hover, transitions to `#DCE5DE`.
- **Tertiary / Ghost Action:** Full pill shape, transparent background, `#46554E` text, gently transitioning to a faint wash of `#F2F5F3` on hover.

### Chips & Mood Selectors
- Pill-shaped tags used for emotion check-ins, tags, and reflection prompts.
- **Default:** `#FFFFFF` fill, 1px `#DCE3DD` border, `#46554E` text.
- **Selected:** `#E8EFE9` fill, 1px `#5B7563` border, `#24332C` text with a subtle dot indicator.

### Input Fields & Text Areas
- Enclosed in `rounded-2xl` containers with `#FFFFFF` background and a 1px `#DCE3DD` perimeter.
- Focus state softens border color to `#5B7563` with a diffused `0 0 0 3px rgba(91, 117, 99, 0.15)` ring. No sharp neon outlines.
- Placeholder text is set in `#687770`, conversational and calm (e.g., "Take your time to write...").

### Cards & Reflection Containers
- Formed with `rounded-3xl` corners, solid `#FFFFFF` or pale mist `#F7F9F8` fill, 1px `#DCE3DD` border, and diffused ambient resting shadows.
- Inner content retains generous internal padding (`space-lg` / `2rem`).

### Mindful Sliders & Scales
- Replaces rigid radio buttons with fluid, tactile step tracks.
- Unfilled track: `#E8EFE9` (height `8px`, rounded pill). Filled segment: `#788B7D`.
- Thumb: `#FFFFFF` circle (`24px`), 2px `#5B7563` ring, soft drop shadow.

### Checkboxes & Radios
- Soft circular and `0.5rem` rounded geometries.
- Unchecked: `#FFFFFF` background, 1.5px `#DCE3DD` border.
- Checked: `#5B7563` fill with a smooth, warm white checkmark or inner dot. No abrupt transitions.

### Breathing / Pacing Indicator
- A specialized circular component with continuous, slow rhythmic scale transformations (`4s` expand, `4s` contract) in `#E8EFE9` with an inner `#788B7D` core to pace user interactions during check-ins.

# Stitch Design Brief

Paste these prompts into Stitch (stitch.withgoogle.com) directly, or tell Antigravity "use the Stitch MCP server to design X using this brief." Review every screen inside Stitch before exporting — it hands you a look, not a spec.

## Style direction (apply to every screen)
Calm, low-stimulation, high-contrast-on-request. This is a mental-health tool used by people who may already be dysregulated — the UI should never feel urgent, gamified, or cluttered, *except* the crisis-resources screen, which should feel exceptionally clear and calm, not alarming (no red/siren styling — red reads as danger and can spike anxiety; use a steady, muted color and generous whitespace instead).
- Typography: one clean sans-serif, generous line height, minimum 16px body text.
- Color: muted, low-saturation palette; avoid bright red/orange as primary accent (reserve high-contrast accents only for primary CTAs).
- Motion: minimal, slow easing — never fast or bouncy animations (can be genuinely distressing for anxious users).
- Accessibility: WCAG AA contrast minimum on every screen; every screen must work with voice, text, and tap input per the roadmap's accessibility requirement.

> **Known issue in the current `DESIGN.md` export**: Stitch's default Material `error`/`on-error-container` tokens (`#ba1a1a`/`#93000a`) are a bright alert red, which contradicts this brief's no-red-alarm guidance and the design system's own stated terracotta warning color (`#A36B5E`). Remap `error` → `#A36B5E` project-wide and never let the crisis screen use the raw `error` token. If you re-export `DESIGN.md` from Stitch later, re-check this — Stitch's default error tokens don't automatically follow custom brand color choices.

## Phase 1 screens

1. **Onboarding / baseline conversation** — "Design a warm, low-pressure onboarding flow for a stress-management app that asks 5–6 baseline questions one at a time, conversational tone, progress indicator, skip-friendly, calm muted color palette."
2. **Daily check-in (morning/evening)** — "Design a daily check-in screen with a 1–10 mood slider or scale, an optional free-text/voice note field, and a clear submit action. Should feel like it takes 15 seconds, not a form."
3. **Manual 'I'm stressed right now' trigger** — "Design a single, always-reachable button/screen for immediate stress support — big touch target, no friction, no login walls, leads straight into the relief library."
4. **Relief library** — "Design a library of 3 relief techniques (square breathing, 5-4-3-2-1 grounding, guided micro-meditation) as simple cards leading into a guided full-screen session with a timer and calm visual pacing element (e.g. breathing circle)."
5. **Stress index / trend dashboard** — "Design a simple dashboard showing a daily stress score and a 7/30-day trend line — minimal, no gamified badges or streak pressure."
6. **Crisis resources screen** — "Design a calm, clear, non-alarming full-screen resource display showing 2–3 helpline options with large tap-to-call buttons and one supportive sentence of copy — must never feel gated or hard to find, and must not use red/alarm styling."
7. **Data export/delete settings screen** — "Design a plain, trustworthy settings screen with clearly separated 'Export my data' and 'Delete my data' actions, each with a confirmation step."

## Phase 2 screens

8. **Trigger taxonomy tagging** — "Design a lightweight way for a user to confirm or correct an AI-suggested stress-trigger category (work, financial, relationship, health, sleep, social, identity) after a check-in — single tap to confirm, easy to edit."
9. **Root-cause dashboard** — "Design a dashboard ranking stress triggers by frequency and intensity over time, visually distinct from the mood/stress-index dashboard (different layout, not just a recolor)."
10. **Weekly summary / insights** — "Design a weekly summary card style layout showing 1–2 plain-language pattern insights (e.g. 'Mondays are harder'), with a 'why am I seeing this' expandable explanation."
11. **Life-stage onboarding branch** — "Design a single-choice screen letting a user select their life stage (student / new parent / caregiver / general adult) during onboarding, with the same calm visual language."

## Phase 3 screens

12. **Skill course screen** — "Design a progressive course/lesson screen (CBT basics style) with a simple progress tracker, non-gamified, one lesson at a time."
13. **Support circle setup** — "Design a consent-first flow for inviting a trusted contact, showing exactly what they will and won't see, with per-notification toggle."
14. **Quarterly values check-in** — "Design a reflective, low-frequency check-in screen distinct in tone from the daily check-in — slower pacing, more spacious layout."

## Export & MCP workflow (recap)

1. In Antigravity: Agent panel → ⋮ → **MCP Servers** → install **Stitch**.
2. In Stitch: profile icon → **Stitch Settings** → create an API key → paste into the Stitch MCP config in Antigravity.
3. Verify: ask the agent "List my Stitch projects."
4. Design each screen above in Stitch (directly or via "use Stitch MCP to design...").
5. Export approved screens to `DESIGN.md` at the project root — this is the persistent design-context file every Antigravity agent should read before implementing frontend code (see `SOP_ANTIGRAVITY.md` §4).
6. Re-export `DESIGN.md` any time a design changes in Stitch — it's a snapshot, not a live link.