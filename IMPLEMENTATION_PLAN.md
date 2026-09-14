# Implementation Plan — Stress Management App

Stack: **FastAPI (Python) + React (TypeScript) + PostgreSQL**
Hosting (prototype, $0 cost): **Supabase** (Postgres + Auth, free tier) + **Render** (FastAPI, free web service) + **Vercel** (React frontend, free tier)
AI: **Hybrid** — a deterministic keyword/rule classifier as the always-on, zero-cost, zero-latency first line of crisis detection, plus **NVIDIA NIM** (free tier, `build.nvidia.com`, OpenAI-compatible endpoint, e.g. a Llama or Nemotron model) for conversational check-ins, trigger-taxonomy probing, and as a second-pass crisis classifier
Sequencing: **All 3 phases planned now, built MVP-first** — Phase 1 must ship and be validated before Phase 2 UI is exposed to users, but the data model and architecture below are designed so Phase 2/3 don't require rewrites.

> **Prototype cost/limits note**: this stack is chosen to be genuinely $0 for a prototype. Know the ceilings before you demo on them: Supabase free tier pauses inactive projects after a period of no traffic; Render's free web service spins down after ~15 min idle (first request after that will be slow — mention this if demoing live); NVIDIA NIM's free tier is rate-limited to roughly 40 requests/minute per model with no published SLA and no guaranteed uptime. None of these are production-grade — that's fine for a prototype, but don't let the crisis pathway's *first* line of defense depend on any of them (see §0.4).

This document is the single source of truth Antigravity agents should work from. Every feature below has: what it is, the data it touches, the API surface, and a "done" definition. Nothing here should be interpreted as "figure it out" — if something is genuinely open, it's marked `OPEN DECISION`.

---

## 0. Cross-Cutting Architecture (build this first, in Phase 1)

### 0.1 Repo structure
```
/backend
  /app
    /api          # FastAPI routers, one file per domain (checkins, triggers, relief, crisis, consent, export)
    /models        # SQLAlchemy models
    /schemas       # Pydantic schemas
    /services      # business logic (stress_index.py, crisis_detector.py, recommender.py)
    /ai            # nim_client.py (NVIDIA NIM, OpenAI-compatible), prompts/
    /core          # config, security, db session
    main.py
  /alembic         # migrations
  /tests
/frontend
  /src
    /pages
    /components
    /api           # typed API client
    /state
  /public
/infra
  cloudrun.yaml
  cloudsql-setup.md
  terraform/ (optional, OPEN DECISION whether IaC is in scope for MVP)
DESIGN.md            # exported from Stitch, lives at project root (see STITCH_DESIGN_BRIEF.md)
README.md
IMPLEMENTATION_PLAN.md
SOP_ANTIGRAVITY.md
```

### 0.2 Core data model (Phase 1 tables; Phase 2/3 tables added later without touching these)
- `users` — id, email, auth_provider_id, created_at, locale, consent_version_accepted, data_retention_pref
- `baseline_profile` — user_id, answers_json (5–6 onboarding questions), created_at
- `checkins` — id, user_id, type (morning/evening/manual), mood_score (1–10), free_text, created_at
- `stress_index_daily` — user_id, date, score, computed_from (jsonb of contributing checkins)
- `relief_sessions` — id, user_id, checkin_id (nullable), technique (enum: square_breathing, grounding_54321, micro_meditation), started_at, completed_at, self_reported_relief (1–5)
- `crisis_events` — id, user_id, triggered_by (checkin_id/free_text), detector_version, resources_shown_json, timestamp — **append-only, no update/delete endpoint, no soft-delete tied to gamification**
- `consent_log` — id, user_id, consent_type, version, granted_at, revoked_at (nullable) — append-only audit trail, never overwritten
- `data_export_requests` / `data_deletion_requests` — id, user_id, status, requested_at, completed_at

### 0.3 Security & privacy (non-negotiable per roadmap, build in Phase 1)
- All PII and free-text conversational fields encrypted at rest. Supabase Postgres ships with the `pgcrypto` extension available — use it for column-level encryption on `checkins.free_text` and `baseline_profile.answers_json` specifically. (If you later move off Supabase to a managed cloud DB with native encryption-at-rest/CMEK, `pgcrypto` on the sensitive columns is still worth keeping as defense-in-depth.)
- TLS everywhere (default on Render and Vercel).
- No third-party analytics SDK gets conversational or biometric data. If analytics is added later, it's event-only (e.g. "checkin_completed") with no free text.
- `data_export_requests` and `data_deletion_requests` must be real, working endpoints in Phase 1, not stubs — this is explicitly called out as non-negotiable in the roadmap.

### 0.4 Crisis pathway (build once in Phase 1, then freeze)
This is the single most safety-critical component. Design it as an isolated module:

```
/app/services/crisis_detector.py
```
- **Detection**: two layers, deliberately not dependent on any external paid or rate-limited service for the critical path.
  1. Deterministic keyword/phrase matcher (maintained as a reviewed, versioned list — not auto-generated by an LLM) against every `checkins.free_text` and manual "I'm stressed right now" trigger payload. This runs locally, in-process, with no network call — it cannot be rate-limited or go down.
  2. NVIDIA NIM–based classifier (e.g. a Llama/Nemotron instruction model, called via the OpenAI-compatible NIM endpoint) as a second pass for phrasing the keyword list misses, with a conservative threshold (prefer false positives over false negatives). **This layer is advisory/supplementary only** — if the NIM call times out, errors, or hits the free-tier rate limit, the app must fail safe by relying on layer 1 and never blocking the response waiting for it.
- **Response**: if either layer fires, the API returns crisis resources **immediately, synchronously, in the same response** — never queued, never behind a loading state that depends on the AI call finishing. Keyword layer must return in under 50ms so the user is never blocked waiting on the LLM.
- **Resources for India (verify before production launch — helpline numbers do change)**:
  - **Tele MANAS** — 14416 or 1-800-891-4416 (Govt of India, 24/7, multilingual)
  - **KIRAN Mental Health Helpline** — 1800-599-0019 (Govt of India, 24/7, 13 languages; now integrated with Tele MANAS)
  - Local emergency number: 112
- **Guardrails**:
  - No gamification logic (streaks, scores, badges) may read from or write to `crisis_events`.
  - `crisis_events` has no delete endpoint and no admin UI action that removes a record — deletion only happens via the same `data_deletion_requests` flow as everything else, and only after export.
  - This module ships in Phase 1 and its detection logic should not be modified in Phase 2/3 without a dedicated safety review — flag this explicitly in the SOP.

### 0.5 Accessibility (build in from Phase 1, per roadmap requirement)
- Input modes: voice (Web Speech API for browser-side speech-to-text — free, no server round-trip needed), text, tap — all three must work for check-ins from day one.
- Semantic HTML, ARIA labels, keyboard navigation, color-contrast AA minimum on every screen (this is also enforced by the Stitch design brief).

---

## Phase 1 — MVP: Prove the Core Loop

**Goal:** validate people check in consistently and find in-the-moment relief useful.
**Success signal to exit phase:** users return across multiple days and engage ≥1 relief exercise/week.

| Feature | API | Data touched | Done when |
|---|---|---|---|
| Profile setup + baseline (5–6 Qs) | `POST /baseline`, `GET /baseline` | `baseline_profile` | New user completes onboarding once; answers stored encrypted; can't be re-triggered accidentally |
| Daily check-in (AM/PM) | `POST /checkins`, `GET /checkins?range=` | `checkins`, `stress_index_daily` | Two daily check-in slots enforced client-side (not hard-blocked server-side — users can check in more than twice), stress index recalculated on each new check-in |
| No-wearable default / optional wearable | `POST /integrations/wearable/connect` (Fitbit/Apple Health/Google Fit OAuth) | new `wearable_connections` table | App fully functional with zero wearable connected; wearable data (HR) stored only if user opts in |
| Manual "I'm stressed right now" trigger | `POST /checkins` with `type=manual` | `checkins` | Runs through crisis detector synchronously before returning relief suggestions |
| Relief library (3 techniques) | `GET /relief/techniques`, `POST /relief/sessions`, `PATCH /relief/sessions/{id}` | `relief_sessions` | Each technique has a guided timer/script; completion + self-rating recorded |
| Stress index logging + trend line | `GET /stress-index?range=` | `stress_index_daily` | Simple line chart, last 7/30 days |
| Crisis pathway | `POST /crisis/check` (internal, called by checkin/manual endpoints) | `crisis_events` | See §0.4 — never gated behind login friction, never delayed |
| Data export/delete | `POST /data/export`, `POST /data/delete` | `data_export_requests`, `data_deletion_requests` | Export produces a downloadable JSON of all user data within 24h (async job); delete is irreversible and confirmed via double opt-in |

**Phase 1 exit criteria (must all be true before Phase 2 features are exposed):** all rows above are live in production, crisis pathway has been manually reviewed by a second person (not the implementing agent), and data export/delete work end-to-end.

---

## Phase 2 — Depth: Move from Symptom to Cause

**Goal:** explain *why*, not just soothe symptoms.
**Success signal to exit phase:** users engage with root-cause insights (not just relief exercises) and week-over-week retention improves.

| Feature | API | Data touched | Done when |
|---|---|---|---|
| Trigger taxonomy (7 categories) | `POST /triggers`, `GET /triggers` | new `trigger_tags` table (checkin_id, category, confidence) | Every check-in with free text gets tagged via a NIM model call, user can correct tags |
| Deeper probing after 3+ recurrences | conversation flow in `POST /checkins` response | `trigger_tags` aggregated | When a category recurs ≥3x in a rolling 14-day window, next check-in includes 1–2 CBT-style follow-up questions |
| Root-cause dashboard (separate from mood) | `GET /dashboard/causes` | `trigger_tags` | Ranked list by frequency × intensity, distinct screen from stress-index trend |
| Actionable vs. adaptive branch | classification field on `trigger_tags` | `trigger_tags.branch` (enum) | User is asked once per recurring trigger whether it's "something I can act on" vs "ongoing" — informs which content Phase 2/3 surfaces |
| Personalization engine | `GET /relief/recommended` | `relief_sessions` history + wearable HR if connected | Recommends the technique with the best historical self-rating (and HR delta if available) for *this* user, not a global default |
| Weekly summaries + pattern insights | `GET /insights/weekly` (generated async, cached) | all Phase 1+2 tables | "Mondays are harder," "poor sleep precedes spikes" — generated via a scheduled job, not real-time LLM call per view |
| Life-stage onboarding branches | extends `baseline_profile` | `baseline_profile.life_stage` | Student / new parent / caregiver / general adult — changes which trigger categories are pre-surfaced |
| "Why am I seeing this" explanations | metadata on every recommendation payload | n/a (derived, not stored) | Every suggestion includes a 1-line reason string sourced from the actual rule/data that produced it — no fabricated explanations |

---

## Phase 3 — Long-Term Value: Skill-Building & Support Network

**Goal:** become a months-long habit, not a one-off tool.
**Success signal:** N/A (this is the terminal phase in the current roadmap) — track sustained monthly active use and skill-course completion.

| Feature | API | Data touched | Done when |
|---|---|---|---|
| Progressive skill courses | `GET /courses`, `POST /courses/{id}/progress` | new `courses`, `course_progress` | Unlocked by top-trigger category from Phase 2 data; CBT basics, boundary-setting, financial-stress literacy as first 3 courses |
| Quarterly values/goals check-in | `POST /checkins/quarterly` | new `values_checkins` | Surfaces misalignment vs. logged stress patterns |
| Micro-habit nudges | `POST /nudges/ack` | new `nudges` table | Tied to root cause (sleep wind-down, movement, hydration) — opt-in, not default-on notifications |
| Calendar integration | OAuth + `GET /calendar/correlate` | new `calendar_events` (metadata only, not full event content unless needed) | Correlates spikes with meetings/deadlines/exams |
| Support circle (consent-based) | `POST /support-circle/invite`, `POST /support-circle/notify` | new `support_circle` table | Explicit per-notification consent, not blanket sharing; trusted contact never sees raw check-in text, only opt-in summary alerts |
| Co-regulation exercises | extends `relief_sessions` | `relief_sessions.mode = 'shared'` | Two-user session linking via support_circle |
| Human support tier | `GET /support/therapists` (directory or referral partner integration) | new `referral_requests` | `OPEN DECISION`: build own directory vs. partner API (e.g. a telehealth provider) — recommend partner integration for MVP of this phase to avoid clinical-liability scope creep |
| Environmental correlation | scheduled job pulling weather/AQI API | joins into `stress_index_daily` | Correlation surfaced only as "may be related," never presented as causal |
| Accessibility expansion | i18n framework, ND-friendly exercise variants, reduced-notification mode | frontend + `users.preferences` | Multilingual (start with English + Hindi given India focus), reduced-motion and reduced-notification toggles |

---

## Non-functional requirements (all phases)
- **Testing**: pytest for backend (unit + API integration tests per router), Playwright or Cypress for frontend E2E, with the crisis pathway having dedicated test cases that must pass before any deploy.
- **CI/CD**: GitHub Actions → build/test → deploy to Render (staging) → manual promote to prod.
- **Observability**: structured logs, no free-text conversational content in logs (log check-in IDs, not content).
- **Data retention**: configurable per-user; default retention policy `OPEN DECISION` — recommend 24 months with clear disclosure, shorter available on request.

## Suggested milestone timeline (adjust to actual team size — not specified)
1. Weeks 1–3: architecture, auth, data model, crisis pathway (§0), CI/CD skeleton
2. Weeks 4–7: Phase 1 features end-to-end, Stitch-designed UI implemented
3. Weeks 8–9: Phase 1 hardening, crisis pathway safety review, soft launch
4. Weeks 10+: begin Phase 2 only after Phase 1 success signal is observed in real usage data — do not build Phase 2 on a fixed calendar date, build it on the data-driven trigger the roadmap specifies
