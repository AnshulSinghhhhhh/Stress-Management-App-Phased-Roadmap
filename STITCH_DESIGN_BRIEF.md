# Stitch Design Brief

Paste these prompts into Stitch (stitch.withgoogle.com) directly, or tell Antigravity "use the Stitch MCP server to design X using this brief." Review every screen inside Stitch before exporting — it hands you a look, not a spec.

## Style direction (apply to every screen)
Calm, low-stimulation, high-contrast-on-request. This is a mental-health tool used by people who may already be dysregulated — the UI should never feel urgent, gamified, or cluttered, *except* the crisis-resources screen, which should feel exceptionally clear and calm, not alarming (no red/siren styling — red reads as danger and can spike anxiety; use a steady, muted color and generous whitespace instead).
- Typography: one clean sans-serif, generous line height, minimum 16px body text.
- Color: muted, low-saturation palette; avoid bright red/orange as primary accent (reserve high-contrast accents only for primary CTAs).
- Motion: minimal, slow easing — never fast or bouncy animations (can be genuinely distressing for anxious users).
- Accessibility: WCAG AA contrast minimum on every screen; every screen must work with voice, text, and tap input per the roadmap's accessibility requirement.

## Core v2.1 Screens

1. **Mindful Dashboard** — "Design a serene mindful living dashboard with a calm sage/stone palette (#5B7563). Prominent Calibrated Stress Indicator card displaying daily stress index (0-100), statistical confidence level (High / Moderate / Calibrating with progress toward 3 distinct days), and recent contributing factors. Exactly ONE primary '+ Add Check-In' button. Today's check-in timeline showing multiple timestamped diurnal entries. Interactive 7-day and 30-day stress trend chart with distinct-day minimum-N gating indicators. Quick-relief card and gentle recommendations. Low stimulation, no streaks or gamification."
2. **Single Check-In Flow** — "Design a serene check-in modal or drawer with a single entry point. Automatically displays time-of-day label (e.g. 'Evening Reflection', 'Morning Pause') derived from clock without any user selection menu. Step 1: Smooth 1-10 emotional resonance slider with calm verbal anchors (Grounded to Highly Activated). Step 2: 7 locked trigger category chips (Work & Career, Finances & Money, Relationships & Family, Health & Body, Sleep & Rest, Social & Loneliness, Identity & Purpose) and emotional tag pills. Step 3 (evening only): Gentle reflective text/voice prompt. Clear submission lock and soft-branch pacing guidance ('You checked in 20m ago; would you prefer a grounding reset?')."
3. **Trends & Longitudinal History** — "Design a longitudinal stress trends screen. Features minimum-N gating banner ('Calibrating baseline: 2 of 3 distinct days logged; variance-calibrated score unlocks at 3 days'). 7-day, 14-day, and 30-day calm trend lines with moving average and baseline reference band. Factor attribution breakdown ranking top triggers (work, sleep, relationships) with recency weighting. Export data shortcut."
4. **Settings & Consent Audit Trail** — "Design a privacy-first settings screen. Granular consent controls (telemetry, AI processing, crisis notification consent) with status dates. Prominent immutable consent audit log table showing timestamp, action type, and legal version. Clear, secure 'Export my data' (JSON/CSV) and 'Delete my account and records' actions with reassuring confirmations."
5. **Relief Library** — "Design a library of 3 relief techniques (square breathing, 5-4-3-2-1 grounding, guided micro-meditation) as simple cards leading into a guided full-screen session with a timer and calm visual pacing element (e.g. breathing circle)."
6. **Crisis Resources Screen** — "Design a calm, clear, non-alarming full-screen resource display showing 2–3 helpline options with large tap-to-call buttons and one supportive sentence of copy — must never feel gated or hard to find, and must not use red/alarm styling."

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
