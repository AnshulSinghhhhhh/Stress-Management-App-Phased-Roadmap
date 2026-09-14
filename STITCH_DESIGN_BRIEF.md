# Stitch Design Brief

Paste these prompts into Stitch (stitch.withgoogle.com) directly, or tell Antigravity "use the Stitch MCP server to design X using this brief." Review every screen inside Stitch before exporting — it hands you a look, not a spec.

## Style direction (apply to every screen)
Calm, low-stimulation, high-contrast-on-request. This is a mental-health tool used by people who may already be dysregulated — the UI should never feel urgent, gamified, or cluttered, *except* the crisis-resources screen, which should feel exceptionally clear and calm, not alarming (no red/siren styling — red reads as danger and can spike anxiety; use a steady, muted color and generous whitespace instead).
- Typography: one clean sans-serif, generous line height, minimum 16px body text.
- Color: muted, low-saturation palette; avoid bright red/orange as primary accent (reserve high-contrast accents only for primary CTAs).
- Motion: minimal, slow easing — never fast or bouncy animations (can be genuinely distressing for anxious users).
- Accessibility: WCAG AA contrast minimum on every screen; every screen must work with voice, text, and tap input per the roadmap's accessibility requirement.

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
