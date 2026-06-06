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

`server.js` → `routes/*` → `services/*` → `db/supabase.js`. Routes are thin; all business logic lives in `services/`. The three route groups:

- `routes/timeCards.js` mounted at `/api` — the worker-facing voice pipeline.
- `routes/auth.js` at `/api/auth` — `worker/login` (phone + PIN), `manager/login` (username + password).
- `routes/manager.js` at `/api/manager` — gated by `requireAuth(['manager','admin'])`; approve/edit/flag time cards, manage workers.

### The two-step voice submission (important, non-obvious)

`POST /api/time-cards/voice` does **not** save. It transcribes, extracts, validates (rejects `confidence: 'low'` or missing hours for HOURS/OFF), auto-fills IN/OUT timestamps when reporting *today*, uploads audio best-effort, and returns `{ transcription, extractedData, processedData }` for the worker to review. The frontend then calls `POST /api/time-cards` with the reviewed `processedData` to actually persist. Keep this review-before-save split intact when modifying the flow.

### Data model

A single `workers` table holds both workers and managers/admins, distinguished by `role` (`worker`/`manager`/`admin`). Workers authenticate with a bcrypt-hashed `pin`; managers with a `password_hash`. Plus `worksites` and `time_cards` (status workflow: `pending` → `approved`/`edited`/`flagged`, with original transcription + `extracted_data` preserved as an audit trail). Schema lives in `backend/src/db/migrations/`.

### Auth

JWT bearer tokens issued by `services/authService.js`, verified in `middleware/requireAuth.js` (`requireAuth([roles])`). Login routes run a constant-time bcrypt compare against a dummy hash on the not-found branch to prevent username/phone enumeration via timing — preserve that pattern when touching auth. `getTimeCards` always applies a bounded `limit` (DoS guard).

### Frontend (`frontend/src/`)

Hash-based routing (`lib/router.js`, `useHashRoute`) — no router library. `App.jsx` dispatches: `#/manager*` → `ManagerApp`; everything else → worker flow (login gate → `WorkerUI`). Sessions (JWT + user info) are stored in `localStorage` via `lib/auth.js`; all API calls go through `apiFetch` there, which injects the bearer token and reads `VITE_API_URL` (defaults to `http://localhost:3001`).

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
