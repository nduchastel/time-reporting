# Testing

The repo has four layers of automated tests, all running offline with no real OpenAI or Supabase calls.

## Run everything

```bash
npm run test:all
```

Runs backend, frontend, and Playwright suites in sequence. ~3 minutes on a clean checkout.

## Per-layer commands

| Layer | Command | What it covers |
|---|---|---|
| Backend unit | `npm --prefix backend test -- --run tests/unit` | Service-layer logic (auth, extraction, storage, time card service) |
| Backend integration | `npm --prefix backend test -- --run tests/integration` | Express routes via supertest with `fakeSupabase` + `fakeOpenAI` |
| Backend smoke E2E | `npm --prefix backend test -- --run tests/e2e` | One narrative test: worker submits → manager approves → reports |
| Frontend | `npm --prefix frontend test -- --run` | React components via Testing Library + jsdom |
| Playwright E2E | `npm --prefix e2e test` | Two browser scenarios: worker submit, manager approve |

## How the fakes work

`backend/tests/fakes/fakeSupabase.js` is an in-memory replacement for the Supabase client. It backs four tables (`workers`, `worksites`, `time_cards`, `storage`) with plain JS arrays + a Map. It implements only the chain shapes the production code uses; calling an unimplemented method throws `not implemented: ...` to fail loudly instead of silently passing. Helpers: `reset()`, `seed({...})`, `snapshot()`.

`backend/tests/fakes/fakeOpenAI.js` is a class with the shape of the `openai` package's default export. Two modes:
- **Fixture mode**: hash an audio buffer with `registerFixture(buf, { transcription, extraction })`. Subsequent `audio.transcriptions.create({ file: buf })` returns the canned response.
- **Scripted mode**: `next({ transcription, extraction })` queues the next response. `failNext({ kind, error })` queues an error.

The global `tests/setup.js` wires both fakes via `vi.mock` and pre-registers all transcription fixtures from `tests/fixtures/transcriptions.js`.

## Test mode (smoke + Playwright)

When `TEST_MODE=1` is set in the backend environment **and** `NODE_ENV !== 'production'`, the server:
- Substitutes the fakes for the real Supabase + OpenAI clients.
- Mounts test-only endpoints under `/__test__/`:
  - `POST /__test__/reset` — clears both fakes
  - `POST /__test__/seed` — body `{ workers, worksites, time_cards }`, seeds Supabase
  - `POST /__test__/openai-next` — body `{ transcription, extraction }`, queues OpenAI response

These endpoints **do not bypass auth** for any production route — they're separate URLs that only exist in test mode. They 404 when `TEST_MODE` isn't set or when `NODE_ENV=production`. There's a unit test (`tests/integration/testMode.test.js`) that verifies this.

The frontend has a parallel `?testMode=1` URL flag: when present, the worker UI renders a "Submit fake recording" button instead of the microphone-driven record button. It uploads a 4-byte audio fixture; `fakeOpenAI` is queued separately to drive the response. **The `?testMode=1` flag does not bypass auth or any other security control** — it only swaps a UI element.

## Adding tests

### A new backend route test

```javascript
import { reset, seed } from '../fakes/fakeSupabase.js';
import { next as nextOpenAI } from '../fakes/fakeOpenAI.js';

beforeEach(() => { reset(); seed({ workers: [{ id: 'w1', ... }] }); });
```

Then drive the route via supertest like the existing tests in `tests/integration/`.

### A new frontend test

Use `@testing-library/react` and mock `window.fetch` with `vi.spyOn(window, 'fetch')`. Set up `localStorage` for an authenticated session before render. See `frontend/src/test/manager/ManagerDashboard.test.jsx` for an example.

### A new Playwright scenario

Add a `*.spec.ts` file in `e2e/`. Use the helpers in `helpers/testApi.ts` to reset and seed in `test.beforeEach`. Use `page.goto('/?testMode=1...')` for worker scenarios and `page.goto('/#/manager')` for manager scenarios.

### A new audio fixture (rare)

Hash a small audio buffer and register it via `registerFixture` in a test setup, OR use scripted mode (`nextOpenAI({...})`) which doesn't care about the audio bytes.

## Debugging

- Vitest UI: `npm --prefix frontend test:ui`
- Playwright trace viewer: `npx playwright show-trace e2e/test-results/.../trace.zip`
- Single Playwright spec: `cd e2e && npx playwright test worker-submit --debug`
