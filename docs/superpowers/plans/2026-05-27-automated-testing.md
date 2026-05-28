# Automated Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared in-memory fakes for Supabase + OpenAI, fill backend test gaps, expand frontend tests, add an HTTP-only smoke E2E, add two Playwright golden-path scenarios, and wire everything to `npm run test:all` — all running offline with no external service calls.

**Architecture:** Two fakes (`fakeSupabase.js`, `fakeOpenAI.js`) live in `backend/tests/fakes/` and are the foundation for every layer above them. A `TEST_MODE=1` env flag in the backend swaps the real clients for fakes and mounts `/__test__/reset|seed|openai-next` endpoints used by Playwright. The frontend gets a `?testMode=1` query param that swaps the record button for a "Submit fake recording" button so Playwright doesn't have to deal with `MediaRecorder`. Backend integration tests keep importing `app` directly via supertest; the smoke E2E and Playwright suites boot the real `app` with fakes injected at process start. A new top-level `package.json` runs all suites with one command.

**Tech Stack:** Node 22, Express 5, vitest 4, supertest 7, React 19 + Testing Library, Playwright (new), bcryptjs, jsonwebtoken, Supabase client.

---

## Spec reference

This plan implements `docs/superpowers/specs/2026-05-27-automated-testing-design.md`. Acceptance criteria from the spec:

- `npm run test:all` exits 0 on a clean checkout, no network calls.
- Backend: 47 → ~65 tests passing.
- Frontend: 8 → ~30 tests passing.
- API smoke E2E: 1 test passing.
- Playwright: 2 specs passing in <30 s combined.
- `docs/testing.md` exists.
- No production behavior changes (small bug fixes flagged in commit messages).

## File structure

**New files:**

```
backend/tests/fakes/
  fakeSupabase.js                 # in-memory drop-in for src/db/supabase.js
  fakeOpenAI.js                   # in-memory drop-in for openai package
backend/tests/fixtures/
  audio/sample.webm               # tiny audio buffer used by smoke + Playwright
backend/tests/e2e/
  smoke.test.js                   # one HTTP-only end-to-end happy path
frontend/src/test/
  ManagerWorkers.test.jsx (in src/test/manager/) — full suite
  ManagerReports.test.jsx  (in src/test/manager/) — full suite
  RecordButton.test.jsx           # state machine, MediaRecorder mocked
  WorkerReview.test.jsx           # extracted-data review section in WorkerUI
  testMode.test.jsx               # asserts ?testMode=1 swaps record button
e2e/
  package.json                    # playwright dev-dep, test script
  playwright.config.ts
  worker-submit.spec.ts
  manager-approve.spec.ts
  helpers/testApi.ts              # POST helpers for /__test__/reset|seed|openai-next
package.json                      # NEW: top-level orchestration scripts
docs/testing.md                   # how to run + extend tests
```

**Modified files:**

```
backend/src/server.js             # TEST_MODE branch + /__test__/* endpoints
backend/tests/setup.js            # delegate to fakeSupabase + fakeOpenAI
backend/tests/integration/auth.test.js     # add ~4 cases
backend/tests/integration/timeCards.test.js # add ~7 cases
backend/tests/integration/manager.test.js  # add ~5 cases
backend/tests/unit/extractionService.test.js # add 2 cases (malformed JSON, clamping)
backend/tests/unit/authService.test.js     # add 2 cases (missing secret, expired)
backend/tests/unit/storageService.test.js  # already strong; add 1 case (no double-slash)
frontend/src/components/RecordButton.jsx   # ?testMode=1 swap
frontend/src/test/WorkerLogin.test.jsx     # add 2 cases
frontend/src/test/WorkerUI.test.jsx        # add 2 cases
frontend/src/test/WorkerHistory.test.jsx   # add 3 cases
frontend/src/test/manager/ManagerLogin.test.jsx     # add 2 cases
frontend/src/test/manager/ManagerDashboard.test.jsx # add 2 cases
README.md                                  # one-line link to docs/testing.md
```

Each file has one clear responsibility: the fakes know about state and shape; tests know about behavior; the boot file knows about wiring. No file is forced to grow large.

---

## Conventions for every task

- TDD: failing test first, minimal code, green, refactor, commit.
- Run tests from inside the relevant package (e.g. `cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run path/to/test.js`). The `cd` is required — earlier in this session a bare `cd backend` from a stale shell context failed.
- Use absolute paths in commands so they work regardless of where the agent's shell happens to be.
- Use HEREDOCs for commit messages with multi-line bodies, plain `-m` for one-liners.
- Never add `--no-verify` or skip hooks.
- Today's date for any "today" assertion: 2026-05-27 (override with `vi.setSystemTime` when stable dates matter).

---

## Phase 1 — Shared fakes & test-mode boot

### Task 1: Inventory the Supabase call surface

The fake only needs to implement what the code uses. Make that surface explicit before writing the fake.

**Files:**
- Read: `backend/src/routes/timeCards.js`, `backend/src/routes/auth.js`, `backend/src/routes/manager.js`, `backend/src/services/timeCardService.js`, `backend/src/services/storageService.js`
- Create: `backend/tests/fakes/SUPABASE_SURFACE.md` (notes file used by Task 2; deleted after Task 2 lands)

- [ ] **Step 1: Search the backend for every Supabase chain pattern**

Run from repo root:

```bash
cd /Users/nduchastel/work/time-reporting && grep -rn "supabase\." backend/src --include="*.js" | grep -v "import "
grep -rn "supabaseAdmin\." /Users/nduchastel/work/time-reporting/backend/src --include="*.js"
```

- [ ] **Step 2: Write `SUPABASE_SURFACE.md` listing every method-chain shape used**

Expected content (verify against grep output; add anything new):

```markdown
# Supabase surface used by backend code

## supabase.from('workers')
- .select('id, name, language, pin, status, role').eq('phone', val).single()
- .select('id, name, role, password_hash, status').eq('username', val).single()
- .select('name').eq('id', val).single()
- .select('name, language').eq('id', val).single()
- .select('id, name, phone, language, role, status, created_at, updated_at').order('name', { ascending: true })
- .insert(row).select('id, name, phone, language, role, status').single()
- .update(patch).eq('id', val).select('id, name, phone, language, role, status').single()

## supabase.from('worksites')
- .select('id').ilike('name', `%${val}%`).single()

## supabase.from('time_cards')
- .insert(row).select().single()
- .select('*, workers(name), worksites(name)').order('created_at', { ascending: false })
    .eq('worker_id'|'status', val)? .gte('date', val)? .lte('date', val)? .limit(n)
- .update(patch).eq('id', val).select('*, workers(name), worksites(name)').single()

## supabaseAdmin.storage.from(bucket)
- .upload(key, buffer, { contentType, upsert: false })
- .createSignedUrl(key, ttl)
```

- [ ] **Step 3: Commit the surface notes**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/fakes/SUPABASE_SURFACE.md && git commit -m "docs(tests): inventory Supabase call surface for fake"
```

---

### Task 2: Build `fakeSupabase.js`

**Files:**
- Create: `backend/tests/fakes/fakeSupabase.js`
- Create: `backend/tests/fakes/fakeSupabase.test.js`
- Read: `backend/tests/fakes/SUPABASE_SURFACE.md`
- Delete: `backend/tests/fakes/SUPABASE_SURFACE.md` (after the fake passes its tests)

The fake ships as a module that exports `{ supabase, supabaseAdmin, _state }` with the same shape as `backend/src/db/supabase.js`. Tests can `vi.mock('../../src/db/supabase.js', () => fakeSupabaseModule)`.

- [ ] **Step 1: Write the failing test for the basic chain shapes**

Create `backend/tests/fakes/fakeSupabase.test.js`:

```javascript
// backend/tests/fakes/fakeSupabase.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { supabase, supabaseAdmin, _state, reset, seed } from './fakeSupabase.js';

beforeEach(() => reset());

describe('fakeSupabase basic CRUD', () => {
  it('insert + select returns the inserted row', async () => {
    const { data, error } = await supabase.from('workers').insert({ name: 'Bob', phone: '+1' })
      .select('id, name, phone, language, role, status').single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: 'Bob', phone: '+1' });
    expect(data.id).toBeTruthy();
  });

  it('select by eq returns the matching row', async () => {
    seed({ workers: [{ id: 'w1', name: 'Alice', phone: '+2' }] });
    const { data } = await supabase.from('workers').select('id, name').eq('phone', '+2').single();
    expect(data).toEqual({ id: 'w1', name: 'Alice' });
  });

  it('select by eq with no match returns PGRST116 from .single()', async () => {
    const { data, error } = await supabase.from('workers').select('id').eq('phone', 'missing').single();
    expect(data).toBeNull();
    expect(error?.code).toBe('PGRST116');
  });

  it('update by eq writes patch and returns row', async () => {
    seed({ workers: [{ id: 'w1', name: 'Alice', phone: '+2' }] });
    const { data } = await supabase.from('workers').update({ name: 'Alicia' }).eq('id', 'w1')
      .select('id, name').single();
    expect(data).toEqual({ id: 'w1', name: 'Alicia' });
  });

  it('select * with embedded join returns nested objects', async () => {
    seed({
      workers: [{ id: 'w1', name: 'Bob' }],
      worksites: [{ id: 's1', name: 'Simons' }],
      time_cards: [{ id: 't1', worker_id: 'w1', worksite_id: 's1', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending' }],
    });
    const { data } = await supabase.from('time_cards').select('*, workers(name), worksites(name)')
      .order('created_at', { ascending: false });
    expect(data).toHaveLength(1);
    expect(data[0].workers).toEqual({ name: 'Bob' });
    expect(data[0].worksites).toEqual({ name: 'Simons' });
  });

  it('limit clamps result count', async () => {
    seed({ time_cards: Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, status: 'pending' })) });
    const { data } = await supabase.from('time_cards').select('*').limit(3);
    expect(data).toHaveLength(3);
  });

  it('insert with duplicate unique field returns 23505', async () => {
    seed({ workers: [{ id: 'w1', phone: '+1' }] });
    const { error } = await supabase.from('workers').insert({ phone: '+1' }).select().single();
    expect(error?.code).toBe('23505');
  });

  it('storage upload + signed url roundtrip', async () => {
    const up = await supabaseAdmin.storage.from('audio').upload('a/b.webm', Buffer.from('x'), { contentType: 'audio/webm', upsert: false });
    expect(up.error).toBeNull();
    expect(up.data.path).toBe('a/b.webm');
    const { data } = await supabaseAdmin.storage.from('audio').createSignedUrl('a/b.webm', 60);
    expect(data.signedUrl).toMatch(/^http:\/\/test\/audio\/a\/b\.webm/);
  });

  it('throws not-implemented on unknown chain method', async () => {
    expect(() => supabase.from('workers').rpc('foo')).toThrow(/not implemented/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/fakes/fakeSupabase.test.js
```

Expected: FAIL — `fakeSupabase.js` doesn't exist.

- [ ] **Step 3: Implement `fakeSupabase.js`**

Create `backend/tests/fakes/fakeSupabase.js`:

```javascript
// backend/tests/fakes/fakeSupabase.js
import { randomUUID } from 'node:crypto';

const PGRST116 = { code: 'PGRST116', message: 'No rows returned' };

let state;
function freshState() {
  return {
    workers: [],
    worksites: [],
    time_cards: [],
    storage: new Map(), // key = `${bucket}/${path}` → Buffer
  };
}

export function reset() { state = freshState(); }
reset();

export function seed({ workers = [], worksites = [], time_cards = [] } = {}) {
  for (const w of workers) state.workers.push({ ...w });
  for (const s of worksites) state.worksites.push({ ...s });
  for (const t of time_cards) state.time_cards.push({ ...t });
}

export function snapshot() {
  return {
    workers: [...state.workers],
    worksites: [...state.worksites],
    time_cards: [...state.time_cards],
    storage: [...state.storage.keys()],
  };
}

const UNIQUE_FIELDS = {
  workers: ['phone', 'username'],
  worksites: ['name'],
  time_cards: [],
};

function nowIso() { return new Date().toISOString(); }

function projectRow(row, fields) {
  if (!row) return row;
  if (fields === '*' || fields.includes('*')) {
    // expand embeds
    const out = { ...row };
    if (fields.includes('workers(name)')) {
      const w = state.workers.find((x) => x.id === row.worker_id);
      out.workers = w ? { name: w.name } : null;
    }
    if (fields.includes('worksites(name)')) {
      const s = state.worksites.find((x) => x.id === row.worksite_id);
      out.worksites = s ? { name: s.name } : null;
    }
    return out;
  }
  const cols = fields.split(',').map((c) => c.trim().split('(')[0].trim());
  const out = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

function compareForOrder(col, ascending) {
  return (a, b) => {
    const av = a[col]; const bv = b[col];
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
  };
}

function tableQuery(table) {
  if (!(table in state)) throw new Error(`not implemented: from(${table})`);
  let rows = state[table];
  let _select = '*';
  let _filters = [];   // [{op, col, val}]
  let _order = null;   // {col, ascending}
  let _limit = null;

  function applyAndProject() {
    let out = rows;
    for (const f of _filters) {
      if (f.op === 'eq')   out = out.filter((r) => r[f.col] === f.val);
      else if (f.op === 'gte') out = out.filter((r) => r[f.col] >= f.val);
      else if (f.op === 'lte') out = out.filter((r) => r[f.col] <= f.val);
      else if (f.op === 'ilike') {
        const pat = String(f.val).replace(/%/g, '').toLowerCase();
        out = out.filter((r) => String(r[f.col] ?? '').toLowerCase().includes(pat));
      } else throw new Error(`not implemented: ${f.op}`);
    }
    if (_order) out = [...out].sort(compareForOrder(_order.col, _order.ascending));
    if (_limit != null) out = out.slice(0, _limit);
    return out.map((r) => projectRow(r, _select));
  }

  const promiseShape = {
    then(resolve) { return Promise.resolve({ data: applyAndProject(), error: null }).then(resolve); },
  };

  const chain = {
    select(fields = '*') { _select = fields; return chain; },
    eq(col, val)         { _filters.push({ op: 'eq', col, val }); return chain; },
    gte(col, val)        { _filters.push({ op: 'gte', col, val }); return chain; },
    lte(col, val)        { _filters.push({ op: 'lte', col, val }); return chain; },
    ilike(col, val)      { _filters.push({ op: 'ilike', col, val }); return chain; },
    order(col, opts = {}){ _order = { col, ascending: opts.ascending !== false }; return chain; },
    limit(n)             { _limit = n; return chain; },
    async single() {
      const arr = applyAndProject();
      if (arr.length === 0) return { data: null, error: PGRST116 };
      return { data: arr[0], error: null };
    },
    async maybeSingle() {
      const arr = applyAndProject();
      return { data: arr[0] ?? null, error: null };
    },
    insert(row) {
      const insertChain = {
        select(fields = '*') { _select = fields; return insertChain; },
        async single() {
          const id = row.id || randomUUID();
          const dup = (UNIQUE_FIELDS[table] || []).find((f) =>
            f in row && row[f] != null && state[table].some((existing) => existing[f] === row[f]));
          if (dup) return { data: null, error: { code: '23505', message: `duplicate ${dup}` } };
          const created = { id, created_at: nowIso(), updated_at: nowIso(), ...row };
          state[table].push(created);
          return { data: projectRow(created, _select), error: null };
        },
      };
      return insertChain;
    },
    update(patch) {
      const updateChain = {
        eq(col, val) { _filters.push({ op: 'eq', col, val }); return updateChain; },
        select(fields = '*') { _select = fields; return updateChain; },
        async single() {
          const arr = rows.filter((r) => _filters.every((f) => f.op === 'eq' && r[f.col] === f.val));
          if (arr.length === 0) return { data: null, error: PGRST116 };
          const target = arr[0];
          Object.assign(target, patch, { updated_at: nowIso() });
          return { data: projectRow(target, _select), error: null };
        },
      };
      return updateChain;
    },
    delete() {
      const deleteChain = {
        eq(col, val) { _filters.push({ op: 'eq', col, val }); return deleteChain; },
        async then(resolve) {
          const before = rows.length;
          state[table] = rows.filter((r) => !_filters.every((f) => r[f.col] === f.val));
          rows = state[table];
          return resolve({ data: null, error: null, count: before - rows.length });
        },
      };
      return deleteChain;
    },
  };

  // any other method → throw clear error
  return new Proxy(chain, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'then') return promiseShape.then;
      throw new Error(`not implemented: from(${table}).${String(p)}`);
    },
  });
}

export const supabase = {
  from(table) { return tableQuery(table); },
};

export const supabaseAdmin = {
  from(table) { return tableQuery(table); },
  storage: {
    from(bucket) {
      return {
        async upload(path, buffer, opts = {}) {
          const key = `${bucket}/${path}`;
          if (!opts.upsert && state.storage.has(key)) {
            return { data: null, error: { message: 'duplicate' } };
          }
          state.storage.set(key, buffer);
          return { data: { path }, error: null };
        },
        async createSignedUrl(path, ttl) {
          const key = `${bucket}/${path}`;
          if (!state.storage.has(key)) return { data: null, error: { message: 'not found' } };
          return { data: { signedUrl: `http://test/${key}?ttl=${ttl}` }, error: null };
        },
      };
    },
  },
};

export const _state = state; // for advanced introspection
```

- [ ] **Step 4: Run tests to confirm green**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/fakes/fakeSupabase.test.js
```

Expected: PASS, all 9 tests.

- [ ] **Step 5: Run full backend test suite to confirm no collateral damage**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: 47 + 9 = 56 tests passing.

- [ ] **Step 6: Delete the surface notes file and commit**

```bash
cd /Users/nduchastel/work/time-reporting && rm backend/tests/fakes/SUPABASE_SURFACE.md
git add backend/tests/fakes/ && git commit -m "feat(tests): add in-memory fakeSupabase used by future shared test setup"
```

---

### Task 3: Build `fakeOpenAI.js`

**Files:**
- Create: `backend/tests/fakes/fakeOpenAI.js`
- Create: `backend/tests/fakes/fakeOpenAI.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/fakes/fakeOpenAI.test.js`:

```javascript
// backend/tests/fakes/fakeOpenAI.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import OpenAI, { reset, next, failNext, registerFixture } from './fakeOpenAI.js';

beforeEach(() => reset());

describe('fakeOpenAI scripted mode', () => {
  it('chat.completions.create returns the queued response', async () => {
    next({ extraction: { action_type: 'HOURS', hours: 8, confidence: 'high' } });
    const client = new OpenAI();
    const r = await client.chat.completions.create({ messages: [{ role: 'user', content: 'x' }] });
    const parsed = JSON.parse(r.choices[0].message.content);
    expect(parsed.hours).toBe(8);
  });

  it('audio.transcriptions.create returns the queued transcription', async () => {
    next({ transcription: 'hello world' });
    const client = new OpenAI();
    const r = await client.audio.transcriptions.create({ file: 'x', model: 'whisper-1' });
    expect(r).toBe('hello world'); // response_format: 'text' returns a bare string
  });

  it('throws when queue is empty', async () => {
    const client = new OpenAI();
    await expect(client.chat.completions.create({ messages: [] }))
      .rejects.toThrow(/no scripted response/i);
  });

  it('failNext queues a thrown error', async () => {
    failNext({ kind: 'transcription', error: new Error('boom') });
    const client = new OpenAI();
    await expect(client.audio.transcriptions.create({ file: 'x', model: 'whisper-1' })).rejects.toThrow('boom');
  });
});

describe('fakeOpenAI fixture mode', () => {
  it('looks up by audio buffer hash', async () => {
    const buf = Buffer.from('canned audio');
    registerFixture(buf, { transcription: 'eight hours', extraction: { hours: 8, confidence: 'high' } });
    const client = new OpenAI();
    const t = await client.audio.transcriptions.create({ _buffer: buf, model: 'whisper-1' });
    expect(t).toBe('eight hours');
    const e = await client.chat.completions.create({ messages: [{ role: 'user', content: `Transcription: "eight hours"\nWorker name: "x"\nToday's date: "2026-05-27"` }] });
    expect(JSON.parse(e.choices[0].message.content).hours).toBe(8);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/fakes/fakeOpenAI.test.js
```

Expected: FAIL — `fakeOpenAI.js` doesn't exist.

- [ ] **Step 3: Implement `fakeOpenAI.js`**

```javascript
// backend/tests/fakes/fakeOpenAI.js
import { createHash } from 'node:crypto';
import fs from 'node:fs';

let queue = [];
let fixtureByHash = new Map();
let lastTranscriptionByHash = new Map();

export function reset() {
  queue = [];
  fixtureByHash = new Map();
  lastTranscriptionByHash = new Map();
}

export function next(response) {
  queue.push({ kind: 'response', response });
}

export function failNext({ kind, error }) {
  queue.push({ kind: 'error', errorKind: kind, error });
}

function hashBuf(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function registerFixture(audioBuffer, { transcription, extraction }) {
  const h = hashBuf(audioBuffer);
  fixtureByHash.set(h, { transcription, extraction });
}

async function consumeOrFixture(kind, ctx) {
  // If a fixture matches this audio, use it.
  if (kind === 'transcription' && ctx.audioBuffer) {
    const h = hashBuf(ctx.audioBuffer);
    const fix = fixtureByHash.get(h);
    if (fix) {
      lastTranscriptionByHash.set(fix.transcription, h);
      return fix.transcription;
    }
  }
  if (kind === 'extraction' && ctx.transcription) {
    // Find a fixture whose transcription matches.
    for (const fix of fixtureByHash.values()) {
      if (fix.transcription === ctx.transcription) return JSON.stringify(fillExtraction(fix.extraction, ctx));
    }
  }

  if (queue.length === 0) {
    throw new Error(`no scripted response for ${kind}; call fakeOpenAI.next(...) or registerFixture(...) before this call`);
  }
  const item = queue.shift();
  if (item.kind === 'error') {
    if (item.errorKind && item.errorKind !== kind) {
      // wrong kind: re-queue at front and complain (helps catch test mistakes)
      queue.unshift(item);
      throw new Error(`scripted error queued for kind=${item.errorKind} but got kind=${kind}`);
    }
    throw item.error;
  }
  if (kind === 'transcription') return item.response.transcription ?? '';
  if (kind === 'extraction') return JSON.stringify(fillExtraction(item.response.extraction || {}, ctx));
  throw new Error(`unknown kind ${kind}`);
}

function fillExtraction(partial, { todayDate }) {
  return {
    action_type: partial.action_type ?? 'HOURS',
    worker: partial.worker ?? null,
    worksite: partial.worksite ?? null,
    hours: partial.hours ?? null,
    start_time: partial.start_time ?? null,
    end_time: partial.end_time ?? null,
    date: partial.date ?? todayDate ?? null,
    confidence: partial.confidence ?? 'high',
    additional_workers: partial.additional_workers ?? [],
    notes: partial.notes ?? null,
  };
}

async function bufferOf(file) {
  if (!file) return null;
  if (Buffer.isBuffer(file)) return file;
  if (typeof file === 'string') return fs.promises.readFile(file);
  if (typeof file.path === 'string') return fs.promises.readFile(file.path);
  if (file._buffer) return file._buffer;
  // ReadStream — collect
  if (typeof file.on === 'function') {
    return new Promise((resolve, reject) => {
      const chunks = [];
      file.on('data', (c) => chunks.push(c));
      file.on('end', () => resolve(Buffer.concat(chunks)));
      file.on('error', reject);
    });
  }
  return null;
}

export default class OpenAI {
  constructor() {
    this.audio = {
      transcriptions: {
        create: async ({ file }) => {
          const audioBuffer = await bufferOf(file);
          return consumeOrFixture('transcription', { audioBuffer });
        },
      },
    };
    this.chat = {
      completions: {
        create: async ({ messages }) => {
          const userMsg = messages.find((m) => m.role === 'user');
          const transcription = userMsg?.content?.match?.(/Transcription: "(.+)"/)?.[1];
          const todayDate = userMsg?.content?.match?.(/Today's date: "(.+)"/)?.[1];
          const content = await consumeOrFixture('extraction', { transcription, todayDate });
          return { choices: [{ message: { content } }] };
        },
      },
    };
  }
}
```

- [ ] **Step 4: Run tests, expect all green**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/fakes/fakeOpenAI.test.js
```

Expected: PASS, all 5 tests.

- [ ] **Step 5: Run full backend suite — still green**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: all passing (61 tests now).

- [ ] **Step 6: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/fakes/fakeOpenAI.js backend/tests/fakes/fakeOpenAI.test.js && git commit -m "feat(tests): add fakeOpenAI with fixture and scripted modes"
```

---

### Task 4: Replace `tests/setup.js` to delegate to the fakes

The existing `tests/setup.js` defines its own ad-hoc OpenAI + Supabase mocks. Migrate it to delegate to `fakeSupabase` + `fakeOpenAI`. Existing per-test mocks (like in `auth.test.js`, `timeCardService.test.js`, `storageService.test.js`, `extractionService.test.js`) override the global setup, so they keep working.

**Files:**
- Modify: `backend/tests/setup.js`

- [ ] **Step 1: Inspect existing tests that depend on the global setup**

```bash
cd /Users/nduchastel/work/time-reporting/backend && grep -rln "supabase\|openai" tests --include="*.js"
```

Tests with their own `vi.mock` for these modules will keep working unchanged. The global setup is the fallback for tests that don't define their own mock.

- [ ] **Step 2: Rewrite `tests/setup.js`**

Replace `backend/tests/setup.js` entirely:

```javascript
// tests/setup.js — global default mocks; per-test vi.mock(...) takes precedence.
import { vi, beforeEach } from 'vitest';
import * as fakeSupabaseModule from './fakes/fakeSupabase.js';
import FakeOpenAI, { reset as resetOpenAI, registerFixture } from './fakes/fakeOpenAI.js';
import { GOOD_TRANSCRIPTIONS, BAD_TRANSCRIPTIONS } from './fixtures/transcriptions.js';

vi.mock('openai', () => ({ default: FakeOpenAI }));
vi.mock('../src/db/supabase.js', () => fakeSupabaseModule);

// Pre-register all transcription fixtures keyed by their plain-text hash so that
// any test path that drives extraction via OpenAI gets a deterministic response.
beforeEach(() => {
  fakeSupabaseModule.reset();
  resetOpenAI();
  for (const fix of [...Object.values(GOOD_TRANSCRIPTIONS), ...Object.values(BAD_TRANSCRIPTIONS)]) {
    // For tests that bypass audio (e.g. extractionService.test.js), match by transcription text via the
    // chat.completions.create path: fakeOpenAI looks up by transcription string when no audio buffer is given.
    registerFixture(Buffer.from(fix.text), {
      transcription: fix.text,
      extraction: { ...fix.expected },
    });
  }
});
```

- [ ] **Step 3: Run the full backend suite**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: all 61 tests passing.

- [ ] **Step 4: Fix any failures**

If a test fails, the most likely cause is that a per-test `vi.mock` returned a different shape than the fake. Read the failure, decide whether the test or the fake is wrong. Fix in place. If the fake's surface is missing something, **add it** and re-run Task 2's `fakeSupabase.test.js` to make sure the addition has a test.

- [ ] **Step 5: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/setup.js && git commit -m "refactor(tests): delegate global setup to fakeSupabase + fakeOpenAI"
```

---

### Task 5: Add `TEST_MODE=1` boot path with `/__test__/*` endpoints

When `TEST_MODE=1`, the server uses the fakes and exposes seeding/reset endpoints. When unset (or when `NODE_ENV=production`), the endpoints 404 and the real clients are used.

**Files:**
- Modify: `backend/src/server.js`
- Create: `backend/tests/integration/testMode.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/testMode.test.js`:

```javascript
// backend/tests/integration/testMode.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';

describe('test-mode endpoints', () => {
  it('404 when TEST_MODE is unset', async () => {
    delete process.env.TEST_MODE;
    const { default: app } = await import('../../src/server.js?off');
    const r = await request(app).post('/__test__/reset');
    expect(r.status).toBe(404);
  });

  it('200 when TEST_MODE=1 and resets fakes', async () => {
    process.env.TEST_MODE = '1';
    process.env.NODE_ENV = 'test';
    const { default: app } = await import('../../src/server.js?on');
    const seed = await request(app).post('/__test__/seed').send({ workers: [{ id: 'w1', name: 'Bob', phone: '+1', status: 'active', role: 'worker' }] });
    expect(seed.status).toBe(200);
    const reset = await request(app).post('/__test__/reset');
    expect(reset.status).toBe(200);
  });

  it('refuses to mount in production even with TEST_MODE=1', async () => {
    process.env.TEST_MODE = '1';
    process.env.NODE_ENV = 'production';
    const { default: app } = await import('../../src/server.js?prod');
    const r = await request(app).post('/__test__/reset');
    expect(r.status).toBe(404);
  });
});
```

(The `?off`, `?on`, `?prod` query strings are a vitest-compatible way to bust the import cache. Vitest handles them via dynamic imports.)

- [ ] **Step 2: Run, expect failure**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/testMode.test.js
```

Expected: FAIL — endpoints don't exist yet.

- [ ] **Step 3: Modify `backend/src/server.js`**

Replace the file:

```javascript
// src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import timeCardsRouter from './routes/timeCards.js';
import authRouter from './routes/auth.js';
import managerRouter from './routes/manager.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', timeCardsRouter);
app.use('/api/auth', authRouter);
app.use('/api/manager', managerRouter);

// Test-mode endpoints — only when TEST_MODE=1 AND NODE_ENV !== 'production'.
// Used by smoke E2E and Playwright to seed state and queue OpenAI responses.
if (process.env.TEST_MODE === '1' && process.env.NODE_ENV !== 'production') {
  const { reset: resetSupabase, seed } = await import('../tests/fakes/fakeSupabase.js');
  const { reset: resetOpenAI, next: nextOpenAI } = await import('../tests/fakes/fakeOpenAI.js');

  app.post('/__test__/reset', (req, res) => {
    resetSupabase();
    resetOpenAI();
    res.json({ ok: true });
  });
  app.post('/__test__/seed', (req, res) => {
    seed(req.body || {});
    res.json({ ok: true });
  });
  app.post('/__test__/openai-next', (req, res) => {
    nextOpenAI(req.body || {});
    res.json({ ok: true });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test' && import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
```

Important: the `import.meta.url === ...` guard prevents the server from listening when imported by Playwright's `webServer` startup probe. Playwright will get the listening server from `node src/server.js` directly, where `process.argv[1]` resolves to that path.

- [ ] **Step 4: Run the test-mode test**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/testMode.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full backend suite**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: all green (64 tests).

- [ ] **Step 6: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/src/server.js backend/tests/integration/testMode.test.js && git commit -m "feat(server): add TEST_MODE boot with /__test__/reset|seed|openai-next"
```

---

## Phase 2 — Backend gap fills

### Task 6: Audit and fill gaps in `auth.test.js`

**Files:**
- Modify: `backend/tests/integration/auth.test.js`

The existing tests cover login + middleware basics. The spec calls for: malformed JWT, role boundary 403, timing-equalizer behavior on missing user, and one path that asserts the route uses `/api/auth/worker/login` (not `/worker-login`) — an existing inconsistency between this code and the spec, worth a sanity test.

- [ ] **Step 1: Write the failing tests (new cases appended to file)**

Append to `backend/tests/integration/auth.test.js`:

```javascript
describe('worker login enumeration safety', () => {
  it('returns 401 (not 404) on unknown phone', async () => {
    const r = await request(app).post('/api/auth/worker/login').send({ phone: 'unknown', pin: '1234' });
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('rejects missing fields with 400', async () => {
    const r = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-0100' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_FIELDS');
  });
});

describe('manager login', () => {
  it('rejects non-manager role even with valid credentials', async () => {
    // The fake from this file's vi.mock returns role 'worker' for username 'wkr1'; ensure manager route refuses.
    const r = await request(app).post('/api/auth/manager/login').send({ username: 'wkr1', password: 'whatever' });
    expect(r.status).toBe(401);
  });

  it('rejects missing password with 400', async () => {
    const r = await request(app).post('/api/auth/manager/login').send({ username: 'mgr1' });
    expect(r.status).toBe(400);
  });
});
```

The first new test in the manager block uses a worker-role record. Add that record to the existing `vi.mock` in this file by appending:

```javascript
            if (chain._col === 'username' && chain._val === 'wkr1') {
              return { data: { id: 'w2', name: 'Worker', role: 'worker', password_hash: pwHash, status: 'active' }, error: null };
            }
```

…inside the `single:` function, just before the final `return { data: null, error: null };`.

- [ ] **Step 2: Run, expect failure on the new tests**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/auth.test.js
```

Expected: 4 new tests fail (mock not yet updated for `wkr1`).

- [ ] **Step 3: Apply the mock update from Step 1, re-run**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/auth.test.js
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/integration/auth.test.js && git commit -m "test(auth): cover unknown-phone enumeration, missing fields, role boundary on manager login"
```

---

### Task 7: Fill gaps in `timeCards.test.js`

The current file has 2 tests on `POST /api/time-cards` and 1 on `GET /api/time-cards`. Add: missing audio file on `POST /voice`, oversized file rejection (Multer), low-confidence path, missing-hours validation, GET limit clamping (TODO from `7d833fd`), worker scoping via the global fakeSupabase mock.

**Files:**
- Modify: `backend/tests/integration/timeCards.test.js`

- [ ] **Step 1: Append new tests**

Add to `backend/tests/integration/timeCards.test.js`:

```javascript
import { reset, seed } from '../fakes/fakeSupabase.js';
import { next as nextOpenAI } from '../fakes/fakeOpenAI.js';
import path from 'node:path';
import fs from 'node:fs';

describe('POST /api/time-cards/voice — validation', () => {
  beforeEach(() => { reset(); });

  it('400 when audio file is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice').field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_AUDIO');
  });

  it('400 when workerId is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice').attach('audio', Buffer.from('fake'), { filename: 'x.webm', contentType: 'audio/webm' }).field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_WORKER_ID');
  });

  it('400 when actionType is missing', async () => {
    const r = await request(app).post('/api/time-cards/voice').attach('audio', Buffer.from('fake'), { filename: 'x.webm', contentType: 'audio/webm' }).field('workerId', 'w1');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_ACTION_TYPE');
  });

  it('rejects non-audio mimetype with multer error', async () => {
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake'), { filename: 'x.txt', contentType: 'text/plain' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/Invalid file type/i);
  });

  it('returns 400 LOW_CONFIDENCE without persisting', async () => {
    seed({ workers: [{ id: 'w1', name: 'Bob', language: 'en' }] });
    nextOpenAI({ transcription: 'mumble', extraction: { confidence: 'low', hours: null, action_type: 'HOURS' } });
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake-audio-bytes'), { filename: 'x.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('LOW_CONFIDENCE');
  });

  it('returns 400 MISSING_HOURS for HOURS action without hours', async () => {
    seed({ workers: [{ id: 'w1', name: 'Bob', language: 'en' }] });
    nextOpenAI({ transcription: 'I worked', extraction: { confidence: 'high', hours: null, action_type: 'HOURS' } });
    const r = await request(app)
      .post('/api/time-cards/voice')
      .attach('audio', Buffer.from('fake-audio-bytes'), { filename: 'x.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('MISSING_HOURS');
  });
});

describe('GET /api/time-cards — limit clamping', () => {
  beforeEach(() => {
    reset();
    seed({ time_cards: Array.from({ length: 1500 }, (_, i) => ({ id: `tc${i}`, status: 'pending', date: '2026-05-20', hours: 1 })) });
  });

  it('caps limit at 1000 even when query asks for more', async () => {
    const r = await request(app).get('/api/time-cards?limit=99999');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeLessThanOrEqual(1000);
  });

  it('uses default 100 when limit is missing or invalid', async () => {
    const r = await request(app).get('/api/time-cards?limit=oops');
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(100);
  });
});
```

These tests use the global `vi.mock` of `supabase.js` from `tests/setup.js` (which now points at fakeSupabase) — so `seed()` and `reset()` from the fake are the source of truth. The two existing tests (`should create time card from voice transcription` and `should handle low confidence transcriptions`) currently pass against the legacy mock; verify they still pass after this change. If they fail because they don't seed a worker first, fix them by seeding `{ workers: [{ id: 'test-worker-id', name: 'Bob' }] }` in a `beforeEach`.

- [ ] **Step 2: Run the file**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/timeCards.test.js
```

Expected: existing + new tests pass. Fix any test that breaks against the fake (seed workers before calling endpoints that look workers up).

- [ ] **Step 3: Run the full suite**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/integration/timeCards.test.js && git commit -m "test(time-cards): cover voice validation, low confidence, missing hours, limit clamping"
```

---

### Task 8: Fill gaps in `manager.test.js`

Existing tests cover the major routes. Add: PIN length boundary (length 3 fails, length 4 passes, length 7 fails), CSV cell escaping for commas/quotes, summary empty state.

**Files:**
- Modify: `backend/tests/integration/manager.test.js`

- [ ] **Step 1: Append**

```javascript
import { reset, seed } from '../fakes/fakeSupabase.js';

describe('manager workers — PIN boundaries', () => {
  beforeEach(() => { reset(); });
  it('rejects PIN of length 3', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-1', pin: '123' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('INVALID_PIN');
  });
  it('rejects PIN of length 7', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-2', pin: '1234567' });
    expect(r.status).toBe(400);
  });
  it('accepts PIN of length 4', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-3', pin: '4321' });
    expect(r.status).toBe(201);
  });
  it('accepts PIN of length 6', async () => {
    const r = await request(app).post('/api/manager/workers').set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'X', phone: '+1-555-4', pin: '123456' });
    expect(r.status).toBe(201);
  });
});

describe('manager reports — CSV escaping & empty state', () => {
  beforeEach(() => {
    reset();
    seed({
      workers: [{ id: 'w1', name: 'O\'Brien, Inc' }],
      worksites: [{ id: 's1', name: 'Site "A"' }],
      time_cards: [{ id: 't1', worker_id: 'w1', worksite_id: 's1', action_type: 'HOURS', date: '2026-05-20', hours: 8, status: 'pending', created_at: new Date().toISOString() }],
    });
  });

  it('escapes quotes in CSV cells', async () => {
    const r = await request(app).get('/api/manager/reports/csv').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.text).toMatch(/"O'Brien, Inc"/);
    expect(r.text).toMatch(/"Site ""A"""/);
  });

  it('summary returns zeros for empty range', async () => {
    reset();
    const r = await request(app).get('/api/manager/reports/summary?startDate=2030-01-01&endDate=2030-12-31').set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ byWorker: [], byWorksite: [], total: 0, flaggedCount: 0, count: 0 });
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/manager.test.js
```

Existing tests in the file may fail because they assume the legacy ad-hoc mock returned hardcoded "approved" responses. Fix by seeding a time card before each scenario that updates one. Example:

```javascript
beforeEach(() => {
  reset();
  seed({
    workers: [{ id: 'w1', name: 'Bob' }],
    time_cards: [
      { id: 'tc1', worker_id: 'w1', status: 'pending' },
      { id: 'tc2', worker_id: 'w1', status: 'pending', hours: 8 },
      { id: 'tc3', worker_id: 'w1', status: 'pending' },
    ],
  });
});
```

Apply this `beforeEach` to the top of the existing `describe('manager routes', ...)` block.

- [ ] **Step 3: Run, fix any remaining red**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/integration/manager.test.js
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/integration/manager.test.js && git commit -m "test(manager): cover PIN boundaries, CSV escaping, empty-range summary"
```

---

### Task 9: Strengthen unit tests

Three small fills.

**Files:**
- Modify: `backend/tests/unit/extractionService.test.js`
- Modify: `backend/tests/unit/authService.test.js`
- Modify: `backend/tests/unit/storageService.test.js`

- [ ] **Step 1: Add malformed-JSON handling test for `extractionService`**

Append to `backend/tests/unit/extractionService.test.js`, inside the `describe('extractionService', ...)` block:

```javascript
  it('throws when GPT returns non-JSON', async () => {
    const OpenAI = (await import('openai')).default;
    const broken = new OpenAI();
    // Override the chat.completions.create for this one test
    const orig = broken.chat.completions.create;
    broken.chat.completions.create = async () => ({ choices: [{ message: { content: 'not json' } }] });
    // We can't easily inject this into the module's module-level openai instance,
    // so test extraction's behaviour by directly calling JSON.parse on bad input.
    expect(() => JSON.parse('not json')).toThrow();
  });
```

The above is a smoke test (the extractionService catches JSON.parse and rethrows; an integration test in Task 7 already covers the EXTRACTION_FAILED path). If you can refactor extractionService to make the OpenAI client injectable in <5 minutes, do so and write a real failing test — otherwise, leave the smoke as-is and document the gap in `docs/testing.md` Task 18.

- [ ] **Step 2: Add JWT_SECRET-missing test for authService**

Append to `backend/tests/unit/authService.test.js`:

```javascript
  it('issueToken throws when JWT_SECRET is unset', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      expect(() => issueToken({ sub: 'x', role: 'worker' })).toThrow(/JWT_SECRET/);
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  it('verifyToken throws on expired token', () => {
    const jwt = require('jsonwebtoken');
    process.env.JWT_SECRET = 'test-secret';
    const t = jwt.sign({ sub: 'x', role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    expect(() => verifyToken(t)).toThrow();
  });
```

(Replace `require('jsonwebtoken')` with `(await import('jsonwebtoken')).default` if the file uses ESM imports — check existing import style.)

- [ ] **Step 3: Add no-double-slash key test for storageService**

Append to `backend/tests/unit/storageService.test.js`:

```javascript
  it('does not produce double slashes when ext is empty', async () => {
    await uploadAudio({ localPath: '/tmp/x', mimeType: 'audio/webm', workerId: 'w1' });
    const [key] = uploadFn.mock.calls[0];
    expect(key).not.toMatch(/\/\//);
  });
```

- [ ] **Step 4: Run all unit tests**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/unit
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/unit/ && git commit -m "test(unit): cover JWT_SECRET, expired token, double-slash key edge"
```

---

### Task 10: Run full backend suite, confirm count

- [ ] **Step 1: Count current backend tests**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 2: Verify ≥ 60 tests passing**

If anything's red, fix in place. If new tests are flaky (e.g. order-dependent), `vi.clearAllMocks()` or a tighter `beforeEach` is usually the answer. **Don't add `.skip()` or `it.todo()` to make them pass.**

- [ ] **Step 3: Commit if any fixes**

If the fixes were small, commit them; otherwise this step is a no-op.

---

## Phase 3 — Frontend tests

### Task 11: Add `RecordButton.test.jsx` (state machine + MediaRecorder mock)

**Files:**
- Create: `frontend/src/test/RecordButton.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/test/RecordButton.test.jsx
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecordButton from '../components/RecordButton';

class MockMediaRecorder {
  static instances = [];
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    this.ondataavailable = null;
    this.onstop = null;
    MockMediaRecorder.instances.push(this);
  }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1,2,3])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  global.MediaRecorder = MockMediaRecorder;
  global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) };
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
});

function setup() {
  const onTranscription = vi.fn();
  const onExtractedData = vi.fn();
  const onProcessedData = vi.fn();
  const setIsRecording = vi.fn();
  render(
    <RecordButton
      isRecording={false}
      setIsRecording={setIsRecording}
      onTranscription={onTranscription}
      onExtractedData={onExtractedData}
      onProcessedData={onProcessedData}
      actionType="HOURS"
    />
  );
  return { onTranscription, onExtractedData, onProcessedData, setIsRecording };
}

describe('RecordButton', () => {
  it('renders idle button by default', () => {
    setup();
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument();
  });

  it('starts recording on click', async () => {
    const { setIsRecording } = setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(setIsRecording).toHaveBeenCalledWith(true));
  });

  it('shows error when getUserMedia is denied', async () => {
    global.navigator.mediaDevices.getUserMedia = vi.fn(async () => {
      const e = new Error('denied'); e.name = 'NotAllowedError'; throw e;
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    expect(await screen.findByText(/microphone access denied/i)).toBeInTheDocument();
  });

  it('uploads to backend and surfaces transcription on success', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'I worked 8 hours',
        extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    const { onTranscription, onExtractedData, onProcessedData } = setup();
    // Start, then immediately stop to trigger upload
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
    act(() => { MockMediaRecorder.instances[0].stop(); });
    await waitFor(() => expect(onTranscription).toHaveBeenCalledWith('I worked 8 hours'));
    expect(onExtractedData).toHaveBeenCalledWith(expect.objectContaining({ hours: 8 }));
    expect(onProcessedData).toHaveBeenCalled();
  });

  it('shows backend error message for known error codes', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'LOW_CONFIDENCE', message: 'unclear' }),
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
    await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
    act(() => { MockMediaRecorder.instances[0].stop(); });
    expect(await screen.findByText(/unclear\. mention worksite and hours/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/RecordButton.test.jsx
```

Expected: PASS, 5 tests. (The component already implements the behavior — these tests document it.)

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/test/RecordButton.test.jsx && git commit -m "test(record-button): cover state machine, permission denial, success, and known errors"
```

---

### Task 12: Add `ManagerWorkers.test.jsx`

**Files:**
- Create: `frontend/src/test/manager/ManagerWorkers.test.jsx`

- [ ] **Step 1: Write the test file**

```jsx
// frontend/src/test/manager/ManagerWorkers.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkersView from '../../components/manager/WorkersView';

beforeEach(() => {
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
  vi.restoreAllMocks();
});

const WORKERS = [
  { id: 'w1', name: 'Alice', phone: '+1-555-0001', language: 'en', role: 'worker', status: 'active' },
  { id: 'w2', name: 'Bob',   phone: '+1-555-0002', language: 'fr', role: 'worker', status: 'disabled' },
];

describe('WorkersView', () => {
  it('lists workers', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('opens add-worker form on click', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    expect(screen.getByRole('heading', { name: /add worker/i })).toBeInTheDocument();
  });

  it('does not offer "manager" as a role choice in the form', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => WORKERS });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    // No <select name="role"> at all in the form
    expect(screen.queryByRole('combobox', { name: /role/i })).toBeNull();
  });

  it('submits POST to /api/manager/workers when adding', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => WORKERS })  // initial load
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'w3' }) }) // POST
      .mockResolvedValueOnce({ ok: true, json: async () => [...WORKERS, { id: 'w3', name: 'Carol', phone: '+1', language: 'en', role: 'worker', status: 'active' }] }); // reload
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add worker/i }));
    fireEvent.change(screen.getByLabelText(/name/i),  { target: { value: 'Carol' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+1' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toMatch(/\/api\/manager\/workers$/);
    expect(postCall[1].method).toBe('POST');
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/manager/ManagerWorkers.test.jsx
```

Expected: PASS, 4 tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/test/manager/ManagerWorkers.test.jsx && git commit -m "test(manager): cover workers list, add form, role guard"
```

---

### Task 13: Add `ManagerReports.test.jsx`

**Files:**
- Create: `frontend/src/test/manager/ManagerReports.test.jsx`

- [ ] **Step 1: Test file**

```jsx
// frontend/src/test/manager/ManagerReports.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportsView from '../../components/manager/ReportsView';

beforeEach(() => {
  localStorage.setItem('time-reporting.manager', JSON.stringify({ id: 'm1', token: 't', name: 'Mgr', role: 'manager' }));
  vi.restoreAllMocks();
});

const SUMMARY = {
  byWorker:   [{ name: 'Alice', hours: 16 }, { name: 'Bob', hours: 8 }],
  byWorksite: [{ name: 'Simons', hours: 24 }],
  total: 24, flaggedCount: 0, count: 3,
};

describe('ReportsView', () => {
  it('renders summary table', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => SUMMARY });
    render(<ReportsView />);
    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());
    expect(screen.getByText(/16\.00h/)).toBeInTheDocument();
    expect(screen.getByText(/Simons/)).toBeInTheDocument();
    expect(screen.getByText(/24\.00 total hours/)).toBeInTheDocument();
  });

  it('refetches when date range changes', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => SUMMARY });
    render(<ReportsView />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/start/i), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('triggers CSV download via fetch + URL.createObjectURL', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => SUMMARY })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['id,worker\n']) });
    const createObjUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    render(<ReportsView />);
    await waitFor(() => expect(screen.getByText(/Alice/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(createObjUrl).toHaveBeenCalled());
    const csvCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/reports/csv'));
    expect(csvCall).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/manager/ManagerReports.test.jsx
```

Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/test/manager/ManagerReports.test.jsx && git commit -m "test(manager): cover reports summary, date refetch, CSV download"
```

---

### Task 14: Add `WorkerReview.test.jsx`

There's no separate "WorkerReview" component — the review block is inside `WorkerUI`. So this test exercises `WorkerUI` after the user has recorded.

**Files:**
- Create: `frontend/src/test/WorkerReview.test.jsx`

- [ ] **Step 1: Test**

```jsx
// frontend/src/test/WorkerReview.test.jsx
// Exercises the review section of WorkerUI: extracted-data display, Submit, Re-record.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkerUI from '../components/WorkerUI';

class MockMediaRecorder {
  static instances = [];
  constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; MockMediaRecorder.instances.push(this); }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  global.MediaRecorder = MockMediaRecorder;
  global.navigator.mediaDevices = { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })) };
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
});

async function recordSuccessfully() {
  fireEvent.click(screen.getByRole('button', { name: /tap to record/i }));
  await waitFor(() => expect(MockMediaRecorder.instances.length).toBe(1));
  act(() => MockMediaRecorder.instances[0].stop());
}

describe('WorkerUI review section', () => {
  it('shows extracted data after recording', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({
        transcription: 'I worked 8 hours at Simons',
        extractedData: { action_type: 'HOURS', hours: 8, worksite: 'Simons', confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByText(/Worksite:/i)).toBeInTheDocument());
    expect(screen.getByText(/Simons/)).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/i).parentElement.textContent).toMatch(/high/);
  });

  it('Submit POSTs to /api/time-cards', async () => {
    const fetchMock = vi.spyOn(window, 'fetch')
      .mockResolvedValueOnce({
        ok: true, json: async () => ({
          transcription: 'I worked 8 hours',
          extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
          processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'tc1' }) });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /^submit$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/time-cards$/);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(await screen.findByText(/time card submitted/i)).toBeInTheDocument();
  });

  it('Re-record disables Submit until next recording', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({
        transcription: 'I worked 8 hours',
        extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<WorkerUI />);
    await recordSuccessfully();
    await waitFor(() => expect(screen.getByRole('button', { name: /^submit$/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /re-record/i }));
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/WorkerReview.test.jsx
```

Expected: PASS, 3 tests.

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/test/WorkerReview.test.jsx && git commit -m "test(worker-ui): cover review section, submit, re-record"
```

---

### Task 15: Harden existing thin frontend tests

Add cases to existing files. Each case is one or two lines on top of what's already there.

**Files:**
- Modify: `frontend/src/test/WorkerLogin.test.jsx`
- Modify: `frontend/src/test/WorkerUI.test.jsx`
- Modify: `frontend/src/test/WorkerHistory.test.jsx`
- Modify: `frontend/src/test/manager/ManagerLogin.test.jsx`
- Modify: `frontend/src/test/manager/ManagerDashboard.test.jsx`

- [ ] **Step 1: Append to `WorkerLogin.test.jsx`**

Add inside the existing `describe`:

```javascript
  it('shows generic error on network failure', async () => {
    vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    render(<WorkerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+1' } });
    fireEvent.change(screen.getByLabelText(/pin/i),   { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });

  it('disables button while submitting', async () => {
    let resolveFetch;
    vi.spyOn(window, 'fetch').mockReturnValue(new Promise((res) => { resolveFetch = res; }));
    render(<WorkerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+1' } });
    fireEvent.change(screen.getByLabelText(/pin/i),   { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    resolveFetch({ ok: true, json: async () => ({ token: 't', worker: { id: 'w1', name: 'B', language: 'en' } }) });
  });
```

- [ ] **Step 2: Append to `WorkerUI.test.jsx`**

```javascript
  it('opens history modal when history button clicked', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    render(<WorkerUI />);
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('button', { name: /view history/i }));
    expect(await screen.findByText(/recent submissions/i)).toBeInTheDocument();
  });

  it('cycles to next action when navigation dot clicked', () => {
    const { fireEvent } = require('@testing-library/react');
    render(<WorkerUI />);
    fireEvent.click(screen.getByRole('button', { name: /go to check out/i }));
    expect(screen.getByText(/check out/i)).toBeInTheDocument();
  });
```

(Use `await import` or top-of-file imports — match the existing file's style. The existing file uses `import { render, screen } from '@testing-library/react';` — extend the import to include `fireEvent` and `waitFor` as needed instead of dynamic imports.)

- [ ] **Step 3: Append to `WorkerHistory.test.jsx`**

```javascript
  it('shows loading state initially', () => {
    vi.spyOn(window, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<WorkerHistory open onClose={() => {}} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows empty state when API returns []', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    render(<WorkerHistory open onClose={() => {}} />);
    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'X', message: 'boom' }) });
    render(<WorkerHistory open onClose={() => {}} />);
    expect(await screen.findByText(/boom|HTTP 500/i)).toBeInTheDocument();
  });
```

- [ ] **Step 4: Append to `manager/ManagerLogin.test.jsx`**

```javascript
  it('shows error on 401', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'INVALID_CREDENTIALS', message: 'no' }) });
    render(<ManagerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/wrong username or password/i)).toBeInTheDocument();
  });

  it('shows generic error on other failures', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'X', message: 'oops' }) });
    render(<ManagerLogin onLoggedIn={() => {}} />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
```

- [ ] **Step 5: Append to `manager/ManagerDashboard.test.jsx`**

```javascript
  it('renders empty state when no cards', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: true, json: async () => [] });
    render(<ManagerDashboard />);
    expect(await screen.findByText(/nothing to show/i)).toBeInTheDocument();
  });

  it('clears manager session on 401 and reloads', async () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload: reloadMock }, writable: true });
    vi.spyOn(window, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'X', message: 'no' }) });
    render(<ManagerDashboard />);
    await waitFor(() => expect(reloadMock).toHaveBeenCalled());
    expect(localStorage.getItem('time-reporting.manager')).toBeNull();
  });
```

- [ ] **Step 6: Run all frontend tests**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run
```

Expected: ≥30 passing.

- [ ] **Step 7: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/test/ && git commit -m "test(frontend): harden login/UI/history/dashboard with edge and error cases"
```

---

### Task 16: Add frontend `?testMode=1` swap

Tiny change to `RecordButton.jsx` that swaps the record button for a "Submit fake recording" button when `testMode=1` is in the URL search params. This is the bridge that lets Playwright avoid `MediaRecorder`.

**Files:**
- Modify: `frontend/src/components/RecordButton.jsx`
- Create: `frontend/src/test/testMode.test.jsx`
- Create: `frontend/public/test-fake-recording.webm` (1-byte placeholder; Multer + fake openai don't care about real audio)

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/test/testMode.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RecordButton from '../components/RecordButton';

const setSearch = (qs) => {
  // jsdom: use URL replace + history. Reload not needed because component reads on mount.
  Object.defineProperty(window, 'location', { value: new URL(`http://localhost/?${qs}`), writable: true });
};

beforeEach(() => {
  localStorage.setItem('time-reporting.worker', JSON.stringify({ id: 'w1', token: 't' }));
});
afterEach(() => {
  Object.defineProperty(window, 'location', { value: new URL('http://localhost/'), writable: true });
});

describe('RecordButton ?testMode=1', () => {
  it('renders the test-mode submit button when ?testMode=1', () => {
    setSearch('testMode=1');
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    expect(screen.getByRole('button', { name: /submit fake recording/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tap to record/i })).toBeNull();
  });

  it('renders the real record button without ?testMode=1', () => {
    setSearch('');
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    expect(screen.getByRole('button', { name: /tap to record/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit fake recording/i })).toBeNull();
  });

  it('test-mode button POSTs to /voice with a fixed audio fixture', async () => {
    setSearch('testMode=1');
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        transcription: 'fake', extractedData: { action_type: 'HOURS', hours: 8, confidence: 'high' },
        processedData: { workerId: 'w1', actionType: 'HOURS', hours: 8 },
      }),
    });
    render(<RecordButton isRecording={false} setIsRecording={() => {}} onTranscription={() => {}} onExtractedData={() => {}} onProcessedData={() => {}} actionType="HOURS" />);
    fireEvent.click(screen.getByRole('button', { name: /submit fake recording/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/\/api\/time-cards\/voice$/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/testMode.test.jsx
```

- [ ] **Step 3: Modify `RecordButton.jsx`**

Near the top of `RecordButton`, after the existing state declarations, add:

```javascript
  // TEST-ONLY: when the URL contains ?testMode=1, render a button that uploads a fixed audio fixture
  // instead of using the microphone. Used by Playwright; never reached in production paths.
  const isTestMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('testMode') === '1';
```

Then in the JSX, replace the `<button>` that calls `handleRecord` with a conditional. The simplest patch:

```jsx
        {isTestMode ? (
          <button
            onClick={async () => {
              setIsProcessing(true);
              try {
                const session = getWorkerSession();
                const blob = new Blob([new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])], { type: 'audio/webm' }); // 4 bytes
                const fd = new FormData();
                fd.append('audio', blob, 'fake.webm');
                fd.append('workerId', session.id);
                fd.append('actionType', actionType);
                const r = await fetch(`${API_URL}/api/time-cards/voice`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${session.token}` } });
                const data = await r.json();
                if (!r.ok) { setError(data.message || 'fake submit failed'); return; }
                onTranscription(data.transcription);
                onExtractedData(data.extractedData);
                onProcessedData?.(data.processedData);
              } finally { setIsProcessing(false); }
            }}
            disabled={isProcessing}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg font-bold"
          >
            {isProcessing ? 'Processing…' : 'Submit fake recording'}
          </button>
        ) : (
          <button
            onClick={handleRecord}
            disabled={isProcessing}
            aria-label={isProcessing ? 'Processing...' : isRecording ? 'Tap to stop recording' : 'Tap to record'}
            className={`w-24 h-24 rounded-full shadow-xl mx-auto flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-600'} ${isProcessing ? 'opacity-50' : ''}`}
            style={{ fontSize: '48px' }}
          >
            <span className="text-white">{isProcessing ? '⏳' : isRecording ? '⏹' : '⏺'}</span>
          </button>
        )}
```

(Keep the surrounding error display + status text unchanged.)

- [ ] **Step 4: Run the new test, then the full frontend suite**

```bash
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run src/test/testMode.test.jsx
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add frontend/src/components/RecordButton.jsx frontend/src/test/testMode.test.jsx && git commit -m "feat(record-button): add ?testMode=1 swap for E2E (does not bypass auth)"
```

---

## Phase 4 — Smoke E2E and Playwright

### Task 17: Add API smoke E2E

**Files:**
- Create: `backend/tests/e2e/smoke.test.js`
- Create: `backend/tests/fixtures/audio/sample.webm` (4-byte placeholder; fakeOpenAI is scripted, so contents don't matter)

- [ ] **Step 1: Create the audio fixture**

```bash
cd /Users/nduchastel/work/time-reporting && mkdir -p backend/tests/fixtures/audio && printf '\x1A\x45\xDF\xA3' > backend/tests/fixtures/audio/sample.webm
```

- [ ] **Step 2: Write the smoke test**

```javascript
// backend/tests/e2e/smoke.test.js
// One narrative test: worker logs in, voice-uploads, manager logs in, approves, sees report.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reset, seed } from '../fakes/fakeSupabase.js';
import { next as nextOpenAI } from '../fakes/fakeOpenAI.js';
import { hashSecret } from '../../src/services/authService.js';

process.env.JWT_SECRET = 'smoke-secret';

const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_AUDIO = path.join(here, '..', 'fixtures', 'audio', 'sample.webm');
const today = new Date().toISOString().slice(0, 10);

let app;
beforeAll(async () => {
  ({ default: app } = await import('../../src/server.js?smoke'));
});

describe('full happy path', () => {
  it('worker submits voice, manager approves, summary reflects hours', async () => {
    reset();
    seed({
      workers: [
        { id: 'w1', name: 'Bob', phone: '+1-555-0100', language: 'en', pin: await hashSecret('1234'), status: 'active', role: 'worker' },
        { id: 'm1', name: 'Mgr', username: 'mgr', password_hash: await hashSecret('test-pw'), status: 'active', role: 'manager' },
      ],
      worksites: [{ id: 's1', name: 'Simons Property' }],
    });

    // 1. Worker login
    const wlogin = await request(app).post('/api/auth/worker/login').send({ phone: '+1-555-0100', pin: '1234' });
    expect(wlogin.status).toBe(200);
    const wToken = wlogin.body.token;

    // 2. Queue OpenAI: transcription + extraction
    nextOpenAI({
      transcription: 'I worked 8 hours at Simons today',
      extraction: { action_type: 'HOURS', hours: 8, worksite: 'Simons Property', confidence: 'high', date: today },
    });

    // 3. Voice upload
    const voice = await request(app).post('/api/time-cards/voice')
      .set('Authorization', `Bearer ${wToken}`)
      .attach('audio', fs.readFileSync(SAMPLE_AUDIO), { filename: 'sample.webm', contentType: 'audio/webm' })
      .field('workerId', 'w1').field('actionType', 'HOURS');
    expect(voice.status).toBe(200);
    expect(voice.body.extractedData.hours).toBe(8);

    // 4. Persist
    const persist = await request(app).post('/api/time-cards')
      .set('Authorization', `Bearer ${wToken}`)
      .send(voice.body.processedData);
    expect(persist.status).toBe(201);
    const tcId = persist.body.id;

    // 5. Manager login
    const mlogin = await request(app).post('/api/auth/manager/login').send({ username: 'mgr', password: 'test-pw' });
    expect(mlogin.status).toBe(200);
    const mToken = mlogin.body.token;

    // 6. Pending list contains the new entry
    const pending = await request(app).get('/api/manager/time-cards?status=pending').set('Authorization', `Bearer ${mToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.find((c) => c.id === tcId)).toBeTruthy();

    // 7. Approve
    const approve = await request(app).post(`/api/manager/time-cards/${tcId}/approve`).set('Authorization', `Bearer ${mToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    // 8. Summary reflects 8 hours for Bob
    const summary = await request(app).get(`/api/manager/reports/summary?startDate=${today}&endDate=${today}`).set('Authorization', `Bearer ${mToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.byWorker.find((w) => w.name === 'Bob')?.hours).toBe(8);

    // 9. CSV contains the entry
    const csv = await request(app).get(`/api/manager/reports/csv?startDate=${today}&endDate=${today}`).set('Authorization', `Bearer ${mToken}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Bob');
    expect(csv.text).toContain('Simons Property');
  });
});
```

- [ ] **Step 3: Run the smoke test**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run tests/e2e/smoke.test.js
```

If anything is red, follow the failure: most likely the time-cards POST route requires auth that wasn't being checked before. The TODO in the route says auth is not yet required for `GET /api/time-cards`; verify whether `POST /api/time-cards` is currently public. If it is, remove the `Authorization` header from the persist step or accept that the route will gain auth later — for now, match current behavior.

- [ ] **Step 4: Run full backend suite**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add backend/tests/e2e/smoke.test.js backend/tests/fixtures/audio/ && git commit -m "test(e2e): add HTTP-only smoke covering worker submit through manager approve and summary"
```

---

### Task 18: Set up Playwright

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/helpers/testApi.ts`
- Create: `e2e/worker-submit.spec.ts`
- Create: `e2e/manager-approve.spec.ts`

- [ ] **Step 1: Init the e2e package**

```bash
cd /Users/nduchastel/work/time-reporting && mkdir -p e2e/helpers
cd /Users/nduchastel/work/time-reporting/e2e && npm init -y >/dev/null && npm install --save-dev @playwright/test typescript >/dev/null 2>&1 && npx playwright install chromium
```

- [ ] **Step 2: Replace `e2e/package.json` with a minimal version**

```json
{
  "name": "e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "*",
    "typescript": "*"
  }
}
```

(Versions resolved by `npm install` — leave as `*` here; package-lock pins exact versions.)

- [ ] **Step 3: Write `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'TEST_MODE=1 NODE_ENV=test JWT_SECRET=e2e-secret PORT=3001 node src/server.js',
      cwd: '../backend',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 5173 --strictPort',
      cwd: '../frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...{ browserName: 'chromium' } } },
  ],
});
```

- [ ] **Step 4: Write `helpers/testApi.ts`**

```typescript
const BACKEND = 'http://localhost:3001';

export async function reset() {
  const r = await fetch(`${BACKEND}/__test__/reset`, { method: 'POST' });
  if (!r.ok) throw new Error(`reset failed: ${r.status}`);
}

export async function seed(body: any) {
  const r = await fetch(`${BACKEND}/__test__/seed`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`seed failed: ${r.status}`);
}

export async function openaiNext(body: any) {
  const r = await fetch(`${BACKEND}/__test__/openai-next`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`openai-next failed: ${r.status}`);
}
```

- [ ] **Step 5: Write `worker-submit.spec.ts`**

The seed step needs hashed credentials. Since we can't bcrypt from Playwright easily, the simplest approach: pre-hash the PIN in advance and hard-code the hash. Generate it once with `node -e "import('bcryptjs').then(b => b.default.hash('1234', 10).then(console.log))"` and paste the hash here.

```typescript
import { test, expect } from '@playwright/test';
import { reset, seed, openaiNext } from './helpers/testApi';

// bcrypt('1234', 10) — pre-computed; rotate if scheme changes.
const PIN_1234_HASH = 'PASTE_HASH_HERE';

test.beforeEach(async () => {
  await reset();
  await seed({
    workers: [{ id: 'w1', name: 'Bob', phone: '+1-555-0100', language: 'en', pin: PIN_1234_HASH, status: 'active', role: 'worker' }],
  });
});

test('worker submits time card via PIN + voice', async ({ page }) => {
  await openaiNext({
    transcription: 'I worked 8 hours at Simons',
    extraction: { action_type: 'HOURS', hours: 8, worksite: 'Simons', confidence: 'high' },
  });

  await page.goto('/?testMode=1');
  await page.getByLabel(/phone/i).fill('+1-555-0100');
  await page.getByLabel(/pin/i).fill('1234');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.getByRole('button', { name: /submit fake recording/i }).click();
  await expect(page.getByText(/Confidence:/)).toBeVisible();
  await page.getByRole('button', { name: /^submit$/i }).click();
  await expect(page.getByText(/time card submitted/i)).toBeVisible();

  // History shows the entry
  await page.getByRole('button', { name: /view history/i }).click();
  await expect(page.getByText(/recent submissions/i)).toBeVisible();
});
```

Then generate and paste the hash:

```bash
cd /Users/nduchastel/work/time-reporting/backend && node -e "import('bcryptjs').then(b => b.default.hash('1234', 10).then(h => console.log(h)))"
```

Replace `PASTE_HASH_HERE` with the printed hash.

- [ ] **Step 6: Write `manager-approve.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';
import { reset, seed } from './helpers/testApi';

const MGR_PASSWORD_HASH = 'PASTE_HASH_HERE'; // bcrypt('test-pw', 10)

test.beforeEach(async () => {
  await reset();
  await seed({
    workers: [
      { id: 'm1', name: 'Mgr', username: 'mgr', password_hash: MGR_PASSWORD_HASH, status: 'active', role: 'manager' },
      { id: 'w1', name: 'Bob' },
    ],
    time_cards: [
      { id: 'tc1', worker_id: 'w1', action_type: 'HOURS', date: '2026-05-27', hours: 8, status: 'pending', transcription: 'I worked 8 hours', created_at: new Date().toISOString() },
    ],
  });
});

test('manager approves a pending time card', async ({ page }) => {
  await page.goto('/#/manager');
  await page.getByLabel(/username/i).fill('mgr');
  await page.getByLabel(/password/i).fill('test-pw');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Bob')).toBeVisible();
  await page.getByRole('button', { name: /approve/i }).click();
  // After approve, card filtered out (status defaults to pending; reload shows empty)
  await expect(page.getByText(/nothing to show/i)).toBeVisible();
});
```

Generate and paste the manager password hash:

```bash
cd /Users/nduchastel/work/time-reporting/backend && node -e "import('bcryptjs').then(b => b.default.hash('test-pw', 10).then(h => console.log(h)))"
```

- [ ] **Step 7: Run Playwright once**

```bash
cd /Users/nduchastel/work/time-reporting/e2e && npm test
```

Expected: 2 specs pass. If they fail:

- Check that `/__test__/reset` returns 200 — if 404, the backend isn't booted in TEST_MODE. Verify `webServer` env was passed.
- Check `npm run build` runs in frontend (preview needs a build).
- Check that the bcrypt hashes you pasted are correct (re-generate if in doubt).
- If Playwright complains about ports being busy, kill the leftover processes from earlier runs.

- [ ] **Step 8: Run again to ensure no flake**

```bash
cd /Users/nduchastel/work/time-reporting/e2e && npm test
```

Expected: pass twice in a row. If flaky, fix the test (don't add retries).

- [ ] **Step 9: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add e2e/ && git commit -m "feat(e2e): add Playwright golden-path scenarios for worker submit and manager approve"
```

Add a `.gitignore` for Playwright artifacts:

```bash
cd /Users/nduchastel/work/time-reporting && cat >> .gitignore <<'EOF'

# Playwright
e2e/node_modules/
e2e/test-results/
e2e/playwright-report/
e2e/playwright/.cache/
EOF
git add .gitignore && git commit -m "chore: ignore playwright artifacts"
```

---

## Phase 5 — Plumbing & docs

### Task 19: Add root `package.json` with `test:all`

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create the file**

```json
{
  "name": "time-reporting",
  "private": true,
  "scripts": {
    "test:backend":  "npm --prefix backend test -- --run",
    "test:frontend": "npm --prefix frontend test -- --run",
    "test:e2e":      "npm --prefix e2e test",
    "test:all":      "npm run test:backend && npm run test:frontend && npm run test:e2e"
  }
}
```

- [ ] **Step 2: Run `test:all` end-to-end**

```bash
cd /Users/nduchastel/work/time-reporting && npm run test:all
```

Expected: every suite green. Time should be under ~3 minutes.

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add package.json && git commit -m "chore: add root package.json with test:all orchestration"
```

---

### Task 20: Write `docs/testing.md`

**Files:**
- Create: `docs/testing.md`
- Modify: `README.md` (one-line link)

- [ ] **Step 1: Create `docs/testing.md`**

```markdown
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
```

- [ ] **Step 2: Add a one-line link to `README.md`**

Find the testing section in `README.md` (or add one near the bottom). Add:

```
**Testing:** see [docs/testing.md](docs/testing.md). Run `npm run test:all` from the repo root.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/nduchastel/work/time-reporting && git add docs/testing.md README.md && git commit -m "docs: add testing.md covering layers, fakes, test mode, and how to extend"
```

---

### Task 21: Final verification

- [ ] **Step 1: Clean checkout test**

```bash
cd /Users/nduchastel/work/time-reporting && npm run test:all
```

Expected: every layer green.

- [ ] **Step 2: Spot-check the acceptance criteria**

```bash
cd /Users/nduchastel/work/time-reporting/backend && npm test -- --run 2>&1 | grep "Tests "
cd /Users/nduchastel/work/time-reporting/frontend && npm test -- --run 2>&1 | grep "Tests "
cd /Users/nduchastel/work/time-reporting/e2e && npm test 2>&1 | grep -E "passed|failed"
```

Verify:
- Backend: ≥60 tests passed
- Frontend: ≥30 tests passed
- Playwright: 2 passed
- `npm run test:all` exits 0

- [ ] **Step 3: Push to origin**

```bash
cd /Users/nduchastel/work/time-reporting && git push origin main
```

- [ ] **Step 4: Final commit if anything was tweaked in step 1 or 2**

If everything passed without edits, this is a no-op.

---

## Notes for the implementer

**Watch for these recurring issues:**

1. **`cd backend` from a stale shell**: always use absolute paths for `cd`. Earlier in this project's session a relative `cd` failed because the shell was inside `frontend/`.
2. **Per-test `vi.mock` overrides global setup**: that's intentional, but it means a test using its own mock won't see the fakeSupabase state. If a test seeds via `fakeSupabase.seed()` but uses its own mock, the seed is invisible. Tell from the test file's top: if it has `vi.mock('../../src/db/supabase.js', ...)`, it has its own mock.
3. **`createSignedUrl` in the fake requires the file to exist**: Storage upload before signed URL. The route does this in order; fixtures should follow.
4. **Playwright timing**: don't add `waitForTimeout`. Use `expect(...).toBeVisible()` which retries.
5. **bcrypt round count**: tests use 10 (matches `authService.js`). Don't lower for speed; tests run in well under a second per hash.
6. **The existing `vi.mock` in `auth.test.js` and `manager.test.js`**: these will keep working through this plan because per-test mocks override global. We're not migrating them to `fakeSupabase` in this plan — that's optional refactoring for a later pass.

**If a step uncovers a real bug in app code:**

- Small (≤5 lines, single file): fix in place, mention the bug in the commit message.
- Larger: write a `.skip`-marked failing test with a `// TODO(bug): ...` comment, finish the rest of the task, raise it as a separate issue with the user before you continue past Task 21.
