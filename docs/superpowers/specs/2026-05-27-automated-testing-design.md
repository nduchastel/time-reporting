# Automated Testing — Design

**Date:** 2026-05-27
**Status:** Draft, awaiting review
**Author:** Claude (with Nicolas)

---

## 1. Goals & non-goals

### Goal

Get the project into a state where any code change can be validated by running automated tests, before real-phone testing happens. Tests must run offline, with no external service calls, fast enough to run before every commit (<30 s for unit/integration; <2 min for the full suite including Playwright).

### In scope

1. **Backend gap audit + fills** — read every existing test, identify missing cases, add ~15–20 new tests across auth, time cards, manager, and service-layer files.
2. **Frontend test expansion** — cover untested components (manager workers/reports, record button, review screen) and harden the existing thin tests with edge/error cases. Goes from 8 → ~30 tests.
3. **API smoke E2E** — one HTTP-only test driving the live Express app through a complete worker → manager journey, using fake Supabase + fake OpenAI.
4. **Playwright golden-path E2E** — two scenarios (worker submits, manager approves) running against locally-booted backend (test mode) + frontend. Headless Chromium, single browser, no retries.
5. **`npm run test:all`** — minimal root `package.json` with scripts to run all suites in one command.
6. **`docs/testing.md`** — short page covering what each suite covers, how to run, how to debug, how to add fixtures.

### Out of scope (deliberately)

- Real OpenAI calls (always-mock decision).
- Real Postgres or Docker (in-memory fake decision).
- GitHub Actions / CI workflow (local-only decision; can revisit later).
- Real phone testing (manual, scheduled separately).
- Any new product features.

---

## 2. Architecture — the shared fakes

Two fakes are the foundation. Every test layer above them depends on them being correct, so they get built first and reviewed before anything else lands on top.

### 2.1 Location & ownership

```
backend/tests/
  fakes/
    fakeSupabase.js      # in-memory drop-in for src/db/supabase.js
    fakeOpenAI.js        # in-memory drop-in for the openai package
  fixtures/
    openai-responses.js  # canned transcription + extraction by scenario
    audio/               # small audio buffers used by tests (a few KB each)
```

Backend integration tests `import` the Express app directly + use `vi.mock` to inject the fakes (same pattern as today). The smoke E2E and Playwright suites boot the *real* Express app with fakes substituted at startup via test-mode env flag.

### 2.2 `fakeSupabase.js`

Drop-in replacement for the `supabase` and `supabaseAdmin` clients exported from `backend/src/db/supabase.js`. Backed by plain JS Maps:

```js
state = {
  workers: Map<id, worker>,
  time_cards: Map<id, timecard>,
  storage: Map<`${bucket}/${path}`, Buffer>,
}
```

**Implements only the query-builder shape the codebase actually uses.** Before writing the fake, I'll grep the backend for every chain pattern (`from().select().eq()…`, `from().insert().select().single()`, etc.) and enumerate them. The fake throws a clear `not implemented: from(<table>).<method>` error for anything outside that enumerated set, so unknown calls fail loudly instead of silently passing.

**Methods (initial enumeration — finalized during implementation):**
- `from(table).select(cols).eq(col, val).order(col, opts).limit(n).single() | .maybeSingle()`
- `from(table).insert(row).select().single()`
- `from(table).update(patch).eq(col, val).select().single()`
- `from(table).delete().eq(col, val)`
- `storage.from(bucket).upload(path, buffer)` → `{ data: { path }, error: null }`
- `storage.from(bucket).createSignedUrl(path, ttl)` → `{ data: { signedUrl: 'http://test/<bucket>/<path>?ttl=<n>' }, error: null }`

**Test helpers exposed alongside:**
- `fakeSupabase.reset()` — wipes all Maps
- `fakeSupabase.seed({ workers, timeCards })` — inserts pre-built rows
- `fakeSupabase.snapshot()` — returns a JSON snapshot of state for assertions

Constraints (basic — Postgres-level constraints not modeled):
- `workers.username` and `workers.phone` enforced as unique
- `workers.id` and `time_cards.id` auto-generated UUIDs
- Timestamp fields auto-set on insert/update
- No FK enforcement, no RLS — those are explicitly out of scope (real-Postgres territory)

### 2.3 `fakeOpenAI.js`

Mocks the `openai` package's two methods the codebase uses:
- `audio.transcriptions.create({ file, model, ... })` → `{ text: '...' }`
- `chat.completions.create({ messages, ... })` → `{ choices: [{ message: { content: '<json string>' } }] }`

**Two response modes:**

1. **Fixture mode (default for unit/integration tests).** Hashes the audio buffer with SHA-256, looks up the hash in `fixtures/openai-responses.js`. Returns the canned `{ transcription, extraction }`. Unknown audio throws `unknown audio fixture: <hash>`.

2. **Scripted mode (for smoke E2E + Playwright).** Test calls `fakeOpenAI.next({ transcription, extraction })` to queue the next response. Calls consume the queue FIFO. Empty queue throws.

Helpers: `fakeOpenAI.reset()`, `fakeOpenAI.next(response)`.

Failure simulation: `fakeOpenAI.failNext({ kind: 'transcription' | 'extraction', error })` queues a thrown error for the next call, used to test 502 handling.

### 2.4 Test-mode backend boot

Add `TEST_MODE=1` env flag to `backend/src/server.js`. When set:
- Substitutes `fakeSupabase` for the `supabase` / `supabaseAdmin` exports.
- Substitutes `fakeOpenAI` for the `openai` client.
- Mounts test-only endpoints under `/__test__/`:
  - `POST /__test__/reset` → resets both fakes
  - `POST /__test__/seed` → body is `{ workers, timeCards }`, seeds Supabase
  - `POST /__test__/openai-next` → body is `{ transcription, extraction }`, queues next OpenAI response
- A boot-time guard refuses to mount `/__test__/*` if `NODE_ENV === 'production'`, even if `TEST_MODE=1` is set. Belt and suspenders.

A small integration test verifies the test-mode endpoints 404 when `TEST_MODE` is not set.

---

## 3. Test inventory

### 3.1 Backend gap fills (`backend/tests/`)

The list below is my best estimate before doing the audit; the exact set is finalized after reading existing tests + the routes/services they cover. Cap is ~25 new tests; if the audit suggests more, we pause and reprioritize.

**Auth (`integration/auth.test.js`):**
- 401 on missing / expired / malformed JWT
- 403 when worker token hits manager-only endpoints
- Wrong PIN doesn't leak via timing (verify existing coverage; harden if needed)
- Login attempts: rate-limit / lockout if implemented; if not, note as gap

**Time cards (`integration/timeCards.test.js`):**
- Voice upload: missing file, oversized file (over Multer limit), non-audio MIME type, corrupt audio buffer
- Voice upload: OpenAI transcription error → 502 with safe message (no leak of internals)
- Voice upload: extraction returns invalid JSON → graceful fallback path
- GET `/api/time-cards`: limit param clamping (existing TODO in the code), worker A can't list worker B's cards
- Status transitions: pending → approved/edited/flagged; can't go backwards (e.g., approved → pending)

**Manager (`integration/manager.test.js`):**
- Workers CRUD: PATCH cannot escalate role to manager (regression test for `83621aa`)
- POST worker: PIN length validation, language enum validation, duplicate phone rejected
- DELETE worker: cascade behavior on their time_cards (verify or document)
- Reports: empty state (no entries in range), date range filtering, CSV format correctness (headers, escaping commas/quotes/newlines in worksite names)

**Services (`unit/`):**
- `extractionService`: malformed GPT response, missing fields, confidence value clamping
- `storageService`: upload failure, signed URL TTL, path sanitization (extend existing)
- `authService`: token expiry, wrong secret, bcrypt round-trip happy path

**Estimate:** 15–20 new tests.

### 3.2 Frontend (`frontend/src/test/`)

**New files:**

| File | Coverage |
|---|---|
| `manager/ManagerWorkers.test.jsx` | List renders, add worker (form validation, PIN length), edit, delete; can't pick "manager" role in form |
| `manager/ManagerReports.test.jsx` | Summary table renders, date filter applies, CSV download triggers (mock `URL.createObjectURL` + click) |
| `RecordButton.test.jsx` | State machine: idle → recording → stopped → uploading → success/error; cancel mid-recording; MediaRecorder mocked |
| `WorkerReview.test.jsx` | Extracted data renders, edit-then-submit, confidence display, low-confidence warning |

**Harden existing files (one happy path + multiple edge/error cases each):**

| File | New cases |
|---|---|
| `WorkerLogin.test.jsx` | Wrong PIN, network error, 401, success → redirect |
| `WorkerUI.test.jsx` | Logged-out state, history toggle, error toast on API failure |
| `WorkerHistory.test.jsx` | Empty state, loading, 5-entry cap, status badges per status |
| `manager/ManagerLogin.test.jsx` | Wrong creds, 401, success → redirect |
| `manager/ManagerDashboard.test.jsx` | Empty queue, approve / edit / flag actions, stale-response guard (regression for `dbfa3fa`) |

**Estimate:** 4 new files + ~15 new test cases in existing files. Total frontend tests goes from 8 → ~30.

### 3.3 API smoke E2E (`backend/tests/e2e/smoke.test.js`)

One file, one narrative-style test. Drives the live Express app via supertest with fakes injected. Steps:

1. Reset fakes; seed one manager (username `mgr`, password `test-pw`) and one worker (`worker-1`, PIN `1234`).
2. `POST /api/auth/worker-login` with `{ workerId: 'worker-1', pin: '1234' }` → token.
3. Queue OpenAI: transcription `"I worked 8 hours at Simons today"`, extraction `{ hours: 8, worksite: "Simons", date: <today> }`.
4. `POST /api/time-cards/voice` with audio buffer + worker token → 201, response body has the extracted data.
5. `POST /api/auth/manager-login` with `{ username: 'mgr', password: 'test-pw' }` → manager token.
6. `GET /api/manager/time-cards?status=pending` → contains the new entry.
7. `PATCH /api/manager/time-cards/{id}` with `{ status: 'approved' }` → 200.
8. `GET /api/manager/reports?from=...&to=...` → summary includes 8 hours for `worker-1`.
9. `GET /api/manager/reports.csv` → CSV body contains the entry.

Pass criteria: every step returns the expected status + shape. If this passes, the wire-level happy path works end-to-end with no UI.

### 3.4 Playwright (`e2e/`)

New top-level `e2e/` directory with its own `package.json` (Playwright as a dev dependency), `playwright.config.ts`, and two specs.

**Config:**
- Single browser: Chromium, headless.
- Retries: 0 locally.
- `webServer`: starts backend in `TEST_MODE=1` on port 3001, starts frontend `vite preview` on port 5173. Waits for both to be ready.
- Base URL: `http://localhost:5173`.

**`worker-submit.spec.ts`:**
1. `beforeEach`: `POST /__test__/reset`, then `POST /__test__/seed` with one worker.
2. Navigate to `http://localhost:5173/?testMode=1#/worker`.
3. Enter PIN, login.
4. Queue OpenAI response via `POST /__test__/openai-next`.
5. Click "Submit fake recording" button (the test-mode swap for the real record button).
6. Review screen shows extracted hours/worksite.
7. Click submit → success toast appears.
8. Open history modal → entry visible with "pending" status.

**`manager-approve.spec.ts`:**
1. `beforeEach`: reset, seed manager + one pending time card.
2. Navigate to `http://localhost:5173/#/manager`.
3. Enter username/password, login.
4. Pending entry visible in dashboard.
5. Click approve → entry disappears from pending list.
6. Switch to reports → entry shows in summary with `approved` status.

### 3.5 Frontend `?testMode=1` query param

Tiny frontend change: when `URLSearchParams.get('testMode') === '1'`, the worker UI swaps the record button for a "Submit fake recording" button that sends a fixed audio fixture (a small WAV in the frontend's public assets) via the same `POST /api/time-cards/voice` path. No other code path changes — review screen, submission, history all behave identically.

A comment in the source flags it as test-only. `docs/testing.md` documents that the flag exists and that it does not bypass auth or any other security control.

### 3.6 `npm run test:all` + docs

**Root `package.json` (new file):**

```json
{
  "name": "time-reporting",
  "private": true,
  "scripts": {
    "test:backend": "npm --prefix backend test -- --run",
    "test:frontend": "npm --prefix frontend test -- --run",
    "test:e2e": "npm --prefix e2e test",
    "test:all": "npm run test:backend && npm run test:frontend && npm run test:e2e"
  }
}
```

No dependencies at the root; this is just an orchestration shim. Does not introduce npm workspaces.

**`docs/testing.md`** covers:
- What each suite covers (1-paragraph summary per layer).
- How to run: `npm run test:all`, plus per-suite commands.
- How to debug a failing test (vitest UI, Playwright trace viewer).
- How to add a new OpenAI fixture (hash an audio file, add canned response).
- How to add a new Playwright scenario (template + reset/seed pattern).
- Test-mode endpoints: what they are, why they exist, why they're safe.

---

## 4. Build sequence

Each step ends with all suites green and a commit. If a step uncovers a real app bug, fix small ones inline; for non-trivial bugs, add a `.skip`-marked failing test with a TODO and call it out separately — keep "test additions" disjoint from "feature work."

1. **Fakes + test-mode boot.** `fakeSupabase`, `fakeOpenAI`, `TEST_MODE=1` flag, `/__test__/*` endpoints. Tested by replacing the existing per-test `vi.mock` calls in one integration file with the new shared fake; suite stays green.
2. **Backend audit + gap fills.** Read every existing backend test + the route/service it covers, list missing cases, add them. Cap at ~25 new tests; pause and reprioritize if more.
3. **Frontend tests.** New files first (cover the gaps), then harden existing files. Goes from 8 → ~30.
4. **API smoke E2E.** Single file, single test, walks the full journey via supertest.
5. **Frontend `?testMode=1`.** Query-param check + "Submit fake recording" button swap. Add a new unit test that verifies the swap happens with the flag and doesn't happen without it.
6. **Playwright.** Config, two specs, debug until they pass twice in a row with no flakes. If flaky, fix the test, do not add retries.
7. **`npm run test:all` + `docs/testing.md`.** Pure plumbing once the suites work.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Fake Supabase behavior diverges from real Supabase (chain ordering, error shapes, `single()` vs `maybeSingle()`) | Read every call site first; only implement enumerated methods; throw clear "not implemented" for anything else |
| Test-mode endpoints leak into prod | `TEST_MODE=1` env flag required; refuses to mount when `NODE_ENV === 'production'`; integration test verifies they 404 in normal boot |
| Playwright flaky on first runs | Single Chromium, no parallelism, retries=0. If flaky, fix the test, don't paper over with retries |
| Frontend `?testMode=1` accidentally usable in prod | Flag swaps record button only; no security-sensitive code path. Documented in `docs/testing.md` and a comment in source. (Optional follow-up: gate the flag on a build-time env if it ever feels risky) |
| Backend audit reveals more gaps than estimated | Hard cap at ~25 new tests; if the audit suggests more, we pause and reprioritize. Don't let it drift into a refactor |
| Adding tests reveals real bugs in app code | Fix small ones inline; for non-trivial bugs, add `.skip`-marked failing test + TODO + separate task. Keep test/feature work disjoint |

---

## 6. Acceptance criteria

- `npm run test:all` runs all suites and exits 0 on a clean checkout, with no network calls and no environment variables required beyond what tests set internally.
- Backend total: 47 → ~65 tests, all passing.
- Frontend total: 8 → ~30 tests, all passing.
- API smoke E2E: 1 test, passing.
- Playwright: 2 specs, passing, both running in <30 s combined.
- `docs/testing.md` exists and a fresh reader can run the suites and add a new test from it alone.
- No production code path changes behavior. Optional small bug fixes flagged in commit messages.
