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

### 1.1 Post-launch refinement: check-in depth (decided after reviewing real check-in data)
Real usage showed the original single-screen check-in (slider + one emotional tag) didn't capture enough nuance, but a full Q&A-style questionnaire on every check-in would work against the "15 seconds" retention-friendly design principle above. Resolution — two changes, not a redesign:

- **(A) Sequenced steps, not more fields**: present the existing fields (mood scale → contributing-category chips → optional free text) as a short step-by-step flow, similar to the onboarding pattern, rather than one dense screen. This is a presentation change — no new required input — but reads as a guided check-in rather than a form.
- **(B) Time-of-day adaptive depth**: morning check-ins stay minimal (mood + tags only — true 15-second loop, protects the fast start-of-day habit). Evening check-ins default to one additional reflective prompt (e.g. "What's one thing that stayed with you today?"), based on observed usage showing people naturally write more in the evening.
- **Trigger-category chips are added directly to the check-in screen** (the same 7 pinned categories from §2.0: work, financial, relationship, health, sleep, social_loneliness, identity), as quick one-tap selections. This does double duty: it reads as more of a guided Q&A, and it feeds the trigger classifier a `user_corrected`-quality signal directly, instead of relying only on inference from free text.
- **Deliberately deferred**: an engagement-adaptive check-in that grows in depth per-user based on their history (tying into the Phase 2 personalization engine) is a good idea but needs real usage data to target correctly — revisit in Phase 2/3, not now.
- **Known bug to fix in the same pass**: duplicate check-in rows have been observed (identical text/timestamp submitted twice) — likely a double-submit on the frontend or a missing idempotency check on `POST /checkins`. Fix this before or alongside the redesign, since duplicates will double-count in the stress-index trend and the trigger-recurrence counter.

---

## Phase 2 — Depth: Move from Symptom to Cause

### 2.0 NLP & memory architecture for Phase 2 (read before building anything below)
Phase 2 has four distinct NLP jobs — they intentionally don't all use the same approach, to avoid burning through NVIDIA NIM's free-tier rate limit (~40 req/min, no SLA) on work that doesn't need a full LLM call.

| Job | Approach | Why |
|---|---|---|
| Trigger taxonomy classification | **Local embedding model** (`sentence-transformers/all-MiniLM-L6-v2`, CPU, no API call) comparing check-in text against a small few-shot example set per category via cosine similarity. Fall back to a NIM call only when similarity confidence is below a threshold. | Runs on ~every check-in — must be free, instant, and not rate-limited. User corrections get appended to the few-shot example set, which improves accuracy over time with no retraining step. |
| Deeper CBT-style probing question (on 3+ recurrence) | **Retrieval-grounded** NIM call: retrieve the user's 2–3 most similar past check-ins via pgvector cosine search, include their actual phrasing as context, then generate a single reflective question — never advice, never a diagnosis. | Low frequency (fires only on recurrence), generation task genuinely needs an LLM, and grounding it in the user's real words (not just a category label) makes the question feel responsive rather than generic. |
| Actionable vs. adaptive branch | **Not inferred by NLP at all** — ask the user directly ("is this something you can act on, or ongoing?"). | More accurate than inference, and reinforces the "why am I seeing this" transparency requirement. |
| Weekly summary / pattern insight | Pattern itself is computed as **plain statistics** (day-of-week correlation, sleep-precedes-spike correlation) from `stress_index_daily` + `trigger_tags` in a scheduled job. One NIM call per user per week turns the computed fact into a plain-language sentence — never real-time, always cached. Retrieval isn't needed here since the stats already are the relevant memory. | Keeps the one genuinely "insight-sounding" feature cheap and infrequent. |

> **Pinned category set — do not rename, substitute, or drop any of these.** The trigger taxonomy is exactly these 7 categories, matching the original roadmap word-for-word: `work`, `financial`, `relationship`, `health`, `sleep`, `social_loneliness`, `identity`. All code (few-shot examples, enum values, migration columns, dashboard labels, life-stage pre-surfacing logic) must use this exact set. This is called out explicitly because an earlier implementation pass silently drifted to a different 7-category set (renaming several and dropping `social_loneliness` in favor of an `academic_pressure` category that only fits one of the four life-stage branches) — that drift broke downstream consistency across the root-cause dashboard, weekly summaries, and life-stage onboarding, all of which key off this exact list. If a future task seems to call for a different or expanded category, that's a decision to flag and confirm, not to make silently.

**"Why am I seeing this" explanations are never model-generated.** Every recommendation payload includes a templated reason string sourced directly from the rule or data point that produced it (e.g. "you rated square breathing 4/5 the last 3 times"). This guarantees the explanation can never be a hallucination.

#### Memory: lightweight, per-user RAG (not a general document-corpus RAG)
- No separate vector database — use the **`pgvector` extension on the existing Supabase Postgres** (free, no new service).
- Add a `checkins.embedding` column (`vector` type). Compute it once per check-in using the same local embedding model already used for trigger classification — one embedding call serves both jobs, no duplicate work.
- Retrieval is a plain SQL cosine-similarity query scoped to `WHERE user_id = :user_id` — retrieval never crosses users, by construction, not just by policy.
- Retrieved text is only ever used in-memory to build a NIM prompt; it is never logged and never sent anywhere except the NIM API call itself.
- Because the embedding is just another column keyed to `checkin_id`, it is deleted automatically by the existing `data_deletion_requests` flow (§0.3) — no new deletion logic needed.
- Privacy note: `checkins.free_text` is `pgcrypto`-encrypted at rest, but its embedding is derived before encryption and stored queryable. Embeddings aren't trivially reversible to the original text, but this isn't zero information leakage — acceptable for a prototype; revisit (e.g. encrypt embeddings too, accepting slower retrieval) before any real user data is at stake.

**Guardrail carried over from the crisis pathway**: the embedding classifier must have a working, local fallback path if NIM is unreachable — trigger tagging should never fail or block a check-in just because the NIM free tier is rate-limited at that moment. Only the recurrence-probe and weekly-summary jobs are allowed to simply skip/retry-later if NIM is unavailable, since neither is time-critical.

**Goal:** explain *why*, not just soothe symptoms.
**Success signal to exit phase:** users engage with root-cause insights (not just relief exercises) and week-over-week retention improves.

| Feature | API | Data touched | Done when |
|---|---|---|---|
| Trigger taxonomy (7 categories: `work`, `financial`, `relationship`, `health`, `sleep`, `social_loneliness`, `identity` — pinned, see §2.0) | `POST /triggers`, `GET /triggers` | new `trigger_tags` table (checkin_id, category, confidence, source: 'embedding'\|'nim'\|'user_corrected'); `checkins.embedding` (pgvector, shared with RAG retrieval — see §2.0) | Every check-in with free text gets tagged via the local embedding classifier (§2.0), falling back to NIM only on low confidence; user can correct tags |
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