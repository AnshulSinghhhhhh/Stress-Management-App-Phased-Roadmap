# SOP: Building This App in Google Antigravity (with Stitch via MCP)

Audience: whoever is driving Antigravity day-to-day. Read `IMPLEMENTATION_PLAN.md` first — this SOP is about *how* to execute it inside Antigravity, not what to build.

---

## 1. One-time environment setup

1. Install Google Antigravity and open a fresh project folder for this repo.
2. Copy these four files into the project root: `README.md`, `IMPLEMENTATION_PLAN.md`, `SOP_ANTIGRAVITY.md`, `STITCH_DESIGN_BRIEF.md`. Antigravity agents read root-level markdown as persistent context, so keeping these at the root (not buried in `/docs`) matters.
3. Set project-level agent security settings (Antigravity supports per-project isolated agent settings) — for this project, keep agent file-system and shell permissions scoped to the repo folder only; do not grant broad system access given the health-data sensitivity.

## 2. Connect the Stitch MCP server

1. In Antigravity, open the Agent panel → three-dot menu → **MCP Servers** → **Manage MCP Servers**.
2. Search for "Stitch" and install the Stitch MCP server.
3. Get a Stitch API key: go to `stitch.withgoogle.com` → profile picture (top right) → **Stitch Settings** → create an API key.
4. Paste the API key into the Stitch MCP server's configuration field in Antigravity.
5. Verify the connection: in the Agent chat, type `List my Stitch projects.` — if it returns your project (or an empty list without an error), the bridge is live.

## 3. Connect any other useful MCP servers (optional but recommended)
- **GitHub MCP** — for PR/issue tracking against the phases in `IMPLEMENTATION_PLAN.md`.
- **Supabase MCP** (Supabase publishes an official MCP server) — lets agents query the real schema and even run migrations directly, instead of guessing field names, once the Postgres schema in §0.2 of the plan exists.

## 3a. Set up NVIDIA NIM (free AI provider)
1. Create an account at `build.nvidia.com` (no credit card required) and generate an API key from **Settings → API Keys** — it will start with `nvapi-`.
2. Store it as an environment variable, `NVIDIA_API_KEY`, never committed to the repo.
3. The endpoint is OpenAI-compatible (`https://integrate.api.nvidia.com/v1`), so `/app/ai/nim_client.py` can use the standard OpenAI Python SDK pointed at that base URL — tell the backend agent this explicitly so it doesn't reach for the Gemini SDK.
4. Pick one instruction-tuned model from the catalog (e.g. a Llama or Nemotron chat model) for conversational check-ins/trigger probing, and be aware of the free tier's ~40 requests/minute limit — the backend should handle 429s gracefully (retry with backoff, and for the crisis-classifier second pass specifically, fail open to the keyword layer rather than erroring the request).

## 4. The design-first workflow (do this before writing backend code)

1. Open `STITCH_DESIGN_BRIEF.md` — it has one prompt per screen, grouped by phase.
2. In Antigravity's agent chat, for each Phase 1 screen, prompt something like:
   > "Use the Stitch MCP server to design [screen name] using the brief in STITCH_DESIGN_BRIEF.md."
3. Once Stitch generates a screen, review it *in Stitch itself* (stitch.withgoogle.com) before pulling it in — Stitch gives you a look, not a spec, so don't accept a screen you wouldn't sign off on visually.
4. Export the approved screens as `DESIGN.md` (Stitch's design-token/DESIGN.md export) into the project root. This file becomes the single design-context file every future agent reads, so re-export it whenever the design changes rather than letting `DESIGN.md` and the live Stitch project drift apart.
5. Ask Antigravity to implement: "Read DESIGN.md and implement the [screen name] React component using our stack (FastAPI + React + Postgres, per IMPLEMENTATION_PLAN.md)." Antigravity pulls real HTML/CSS from Stitch via MCP — it does not need to guess colors or spacing from a screenshot.

## 5. Multi-agent task dispatch pattern (Manager View)

For each phase, dispatch agents along these lines rather than one agent doing everything serially:

- **Agent A — Backend**: implements the FastAPI routes/models/services for the phase's feature table in `IMPLEMENTATION_PLAN.md`, writes pytest coverage.
- **Agent B — Frontend**: implements React components/pages from the corresponding `DESIGN.md` section, wires to the typed API client.
- **Agent C — QA/Browser subagent**: after A and B report done, uses Antigravity's browser subagent to click through the actual running app and "vibe-check" it against the Stitch design and against the "Done when" column in `IMPLEMENTATION_PLAN.md`.

Prompt pattern for kicking off a phase:
> "Read IMPLEMENTATION_PLAN.md, Phase 1 section. Dispatch three agents: backend implementing the feature table, frontend implementing from DESIGN.md, and a QA agent that browser-tests each feature against its 'Done when' criterion once both are complete."

## 6. Guardrails — read before every crisis-pathway-adjacent task

- **Never let an agent regenerate or "clean up" `crisis_detector.py`, the keyword list it loads, or the `crisis_events` table/migrations as a side effect of an unrelated task.** If a task's diff touches these files and that wasn't the explicit ask, stop and review manually before accepting.
- Any change to the crisis pathway, consent flows, or data export/delete endpoints requires a human read of the diff before merge — do not auto-merge agent output for these files even if tests pass.
- Do not let gamification/scoring features (streaks, badges, weekly summaries) be built with a foreign key or join into `crisis_events`. If an agent's implementation does this, reject it.
- Keep helpline numbers in one config file (`crisis_resources.py` or similar), not hardcoded in multiple places, and re-verify them against official sources before each production deploy — they do change.

## 7. Definition of done per phase

A phase is "done" only when:
1. Every row in that phase's feature table (in `IMPLEMENTATION_PLAN.md`) has a merged PR and passing tests.
2. The QA agent's browser walkthrough confirms each "Done when" criterion.
3. For Phase 1 specifically: a human (not an agent) has reviewed the crisis pathway and the data export/delete flow end-to-end.
4. The phase's stated success signal is actually being tracked in production analytics — don't start the next phase's build on a calendar date, start it when the previous phase's success signal shows up in real usage data (per the roadmap's guiding principle).

## 8. Known limitations to plan around
- Antigravity builds and tests locally; it does not deploy. You still need a separate step (`git push` → Render auto-deploy for the backend, Vercel auto-deploy for the frontend) for actual deployment — treat this as its own task, not something to assume an agent will "just handle."
- Render's free web service spins down after ~15 minutes idle — the first request after a period of inactivity will be slow (10–30s cold start). If demoing live, hit the health-check endpoint a minute beforehand to warm it up.
- NVIDIA NIM's free tier has no published SLA and a per-minute rate limit — don't build any critical-path logic (especially the crisis pathway's primary detection) that assumes it's always available or fast.
- The Stitch MCP server is still evolving — some UI patterns may not translate perfectly; budget manual agent-guided touch-ups for complex interactions (e.g. the guided-breathing timer animation) rather than expecting one-shot fidelity.
