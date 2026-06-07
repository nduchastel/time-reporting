# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A voice-based time-tracking app for construction workers. Workers speak a time entry into a mobile PWA; the backend transcribes it (Whisper), extracts structured fields (GPT-4o-mini), and stores it for manager review/approval. See `README.md` for the product overview and `docs/` for phase-by-phase decision records.

## Repository layout

Three independently-installed npm packages (no workspaces — `npm install` separately in each):

- `backend/` — Node 22 + Express 5 REST API. **ESM** (`"type": "module"`), Vitest tests.
- `frontend/` — React 19 + Vite 8 + Tailwind 4 PWA. Vitest + Testing Library.
- `e2e/` — Playwright browser tests (TypeScript).

The root `package.json` only orchestrates test commands across the three.

## Commands

```bash
# Install (run in each package)
cd backend && npm install
cd frontend && npm install
cd e2e && npm install && npx playwright install

# Run dev servers
npm --prefix backend run dev      # Express on :3001 (node --watch)
npm --prefix frontend run dev     # Vite on :5173

# Tests — all layers
npm run test:all                  # backend + frontend + playwright, in sequence

# Tests — per layer / single file
npm --prefix backend test -- --run                         # all backend
npm --prefix backend test -- --run tests/unit              # unit only
npm --prefix backend test -- --run tests/integration/auth.test.js  # single file
npm --prefix frontend test -- --run                        # all frontend
npm --prefix frontend test -- --run src/test/WorkerUI.test.jsx     # single file
cd e2e && npx playwright test worker-submit                # single playwright spec

npm --prefix frontend run lint    # ESLint (frontend only; backend has no linter)
```

Full testing reference: `docs/testing.md`.

## Architecture

### Backend request flow (`backend/src/`)

`server.js` → `routes/*` → `services/*` → `db/supabase.js`. Routes are thin; all business logic lives in `services/`. The route groups:

- `routes/timeCards.js` mounted at `/api` — the worker-facing voice pipeline. `GET /api/time-cards` is auth'd: workers see only their own cards (token `sub` overrides any `workerId`); managers/admins query any.
- `routes/auth.js` at `/api/auth` — `worker/login` (phone + PIN), `manager/login` (username + password, also used by admins), `change-credential` (authenticated PIN/password change). Login endpoints are rate-limited.
- `routes/manager.js` at `/api/manager` — gated by `requireAuth(['manager','admin'])`; approve/edit/flag time cards, manage workers (incl. `visible_panels`), and worksite CRUD (`/worksites`, archive-not-delete).
- `routes/admin.js` at `/api/admin` — gated by `requireAuth(['admin'])`; full user management (`/users`: create any role with a temp secret, edit/role-change/enable-disable, reset-credential, delete with can't-delete-self / can't-delete-last-admin guards).

### The two-step voice submission (important, non-obvious)

`POST /api/time-cards/voice` does **not** save. It transcribes, extracts, validates (rejects `confidence: 'low'` or missing hours for HOURS/OFF), auto-fills IN/OUT timestamps when reporting *today*, uploads audio best-effort, and returns `{ transcription, extractedData, processedData }` for the worker to review. The frontend then calls `POST /api/time-cards` with the reviewed `processedData` to actually persist. Keep this review-before-save split intact when modifying the flow.

### Data model

A single `workers` table holds both workers and managers/admins, distinguished by `role` (`worker`/`manager`/`admin`). Workers authenticate with a bcrypt-hashed `pin`; managers with a `password_hash`. Phase 4 added `must_change_credential` (forced first-login secret change) and `visible_panels` (per-worker action panels). Plus `worksites` (with a `status` of `active`/`archived` — archive, don't delete) and `time_cards` (status workflow: `pending` → `approved`/`edited`/`flagged`, with original transcription + `extracted_data` preserved as an audit trail). Schema lives in `backend/src/db/migrations/` (001–004).

### Auth

JWT bearer tokens issued by `services/authService.js` (role-based TTL: worker 7d, manager/admin 24h), verified in `middleware/requireAuth.js` (`requireAuth([roles])`). Login routes run a constant-time bcrypt compare against a dummy hash on the not-found branch to prevent username/phone enumeration via timing — preserve that pattern when touching auth. Login endpoints are per-IP rate-limited (`middleware/rateLimit.js`, skipped under `TEST_MODE`). CORS is locked to `ALLOWED_ORIGINS`. `getTimeCards` always applies a bounded `limit` (DoS guard).

**Credential lifecycle:** a creator sets a *temporary* secret (`must_change_credential=true`); the user is forced to change it on first login via `POST /api/auth/change-credential`; users can self-change anytime; managers reset worker PINs, admins reset manager/admin passwords. The first admin is bootstrapped with `backend/src/db/create-admin.js`. RLS is defense-in-depth (the backend uses the service-role key, which bypasses RLS). Full model: `docs/security.md`.

### Frontend (`frontend/src/`)

Hash-based routing (`lib/router.js`, `useHashRoute`) — no router library. `App.jsx` dispatches: `#/admin*` → `AdminApp` (gated `role==='admin'`); `#/manager*` → `ManagerApp`; everything else → worker flow (login gate → `WorkerUI`). A `must_change_credential` session flag funnels any role to a forced `ChangeCredential` screen first. Sessions (JWT + user info) are stored in `localStorage` via `lib/auth.js`; all API calls go through `apiFetch` there, which injects the bearer token, reads `VITE_API_URL` (defaults to `http://localhost:3001`), and auto-logs-out on a token-error 401. `main.jsx` wraps the app in an `ErrorBoundary` and mounts the PWA `InstallPrompt`; error reporting (`lib/errorReporter.js`) and the backend reporter (`services/errorReporter.js`) are no-ops unless a DSN is set.

## Test infrastructure (TEST_MODE and fakes)

All tests run **fully offline** — no real OpenAI or Supabase calls.

- `backend/tests/fakes/fakeSupabase.js` and `fakeOpenAI.js` are in-memory replacements. They implement only the chain shapes production uses and **throw `not implemented:` loudly** on anything else — if you add a new Supabase query shape, you must extend the fake.
- Unit/integration tests wire the fakes via `vi.mock` in `tests/setup.js`.
- **TEST_MODE=1** (with `NODE_ENV !== 'production'`) makes the *real server process* swap in the fakes and mount `/__test__/{reset,seed,openai-next}` endpoints. This is how the Playwright + backend smoke E2E drive state. These endpoints 404 in production and **do not bypass auth** on any real route.
- Frontend `?testMode=1` URL flag swaps the mic record button for a "submit fake recording" button. It also **does not bypass auth** — UI swap only.

When adding a backend route, extend the relevant fake if it uses a new query shape, and add an integration test under `tests/integration/` following the `reset()` + `seed()` pattern.

## Conventions

- Backend is ESM with top-level `await` (used for conditional fake imports) — keep imports static-analyzable where the fake-swap pattern is in play.
- **No `package-lock.json` is committed** (intentional — each deploy platform regenerates its own to avoid npm proxy conflicts). Don't commit lockfiles.
- Deploys are automatic on push to `main`: frontend → Vercel, backend → Railway, Supabase provisioned manually.

## Documentation maintenance

Every doc is one of two kinds. Know which before you edit, and never mix the two behaviors.

**🟢 Living docs — keep current as features ship; NO changelog.** They must always describe the *present* state, so a changelog would just be noise. When you change behavior, edit the body in place.
- `README.md`, this `CLAUDE.md`
- `docs/deployment-plan.md`, `docs/quick-start-guide.md`, `docs/validation-and-startup.md`
- `docs/database-schema.md`, `docs/testing.md`, `docs/security.md`
- `docs/development/*` (local-setup, development-modes, README)
- `backend/src/db/README.md`, `frontend/README.md`
- Future **user guides** (worker install iOS/Android, manager setup — Phase 4 #24–26)

**📜 Historical docs — frozen once their phase ships; record status in a CHANGELOG at the end.** Don't rewrite the body to match new reality; append a dated changelog entry instead. These are point-in-time design/decision records.
- `Design/2026-05-23-construction-time-tracking-design.md`
- `docs/phase1-decisions.md`, `docs/phase2-decisions.md`, `docs/phase2-implementation-plan.md`, `docs/phase2-complete-handoff.md`, `docs/phase3-plan.md`, `docs/implementation-plan.md`
- `docs/superpowers/plans/*`, `docs/superpowers/specs/*`
- Phase plans (`docs/phase4-plan.md`, `docs/pre-beta-ship-plan.md`, `docs/phase5-backlog.md`): while the phase is **in progress** you may update its Status / Progress-Tracking section; once the phase **ships**, freeze the body and append a Changelog (exactly how phases 1–3 were closed out).

**Snapshots / logs** (`DEPLOYMENT-READY.md`, `deployment-log.md`) are frozen point-in-time records — leave them as-is; no changelog, no rewrite.

**Rules:**
- Changelog entries are dated and appended at the very end: `### YYYY-MM-DD — short summary`.
- A new historical doc is born with a Status line at the top; a new living doc never gets a changelog.
- When you ship new functionality (Phase 4, 5, 6, …): **(a)** refresh the affected 🟢 living docs so they don't go stale, and **(b)** append a Changelog entry to the relevant 📜 phase/design doc — do **not** rewrite a past phase's body.

**Per-phase ship checklist — refresh these living docs when a phase lands:** `README.md` roadmap · `docs/deployment-plan.md` · `docs/quick-start-guide.md` · `docs/validation-and-startup.md` · `docs/database-schema.md` · `docs/testing.md` · user guides · this `CLAUDE.md`.
