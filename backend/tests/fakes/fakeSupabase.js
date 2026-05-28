// backend/tests/fakes/fakeSupabase.js
//
// In-memory drop-in for the `supabase` and `supabaseAdmin` clients exported
// from `backend/src/db/supabase.js`. Implements ONLY the chain shapes the
// production code uses (see `SUPABASE_SURFACE.md` for the audit). Anything
// outside that surface throws `not implemented: ...` to fail loudly.
//
// Helpers `reset()`, `seed({...})`, `snapshot()` are exposed for tests.

import { randomUUID } from 'node:crypto';

const PGRST116 = { code: 'PGRST116', message: 'No rows returned' };

let state = freshState();

function freshState() {
  return {
    workers: [],
    worksites: [],
    time_cards: [],
    storage: new Map(), // key = `${bucket}/${path}` → Buffer
  };
}

export function reset() {
  state = freshState();
}

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
  // strip embeds and trailing whitespace; project explicit columns
  const cols = fields.split(',').map((c) => c.trim().split('(')[0].trim()).filter(Boolean);
  const out = {};
  for (const c of cols) if (c in row) out[c] = row[c];
  return out;
}

function compareForOrder(col, ascending) {
  return (a, b) => {
    const av = a[col]; const bv = b[col];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av > bv ? 1 : -1) * (ascending ? 1 : -1);
  };
}

function tableQuery(table) {
  if (!(table in state) || table === 'storage') {
    throw new Error(`not implemented: from(${table})`);
  }
  let _select = '*';
  const _filters = [];   // [{op, col, val}]
  let _order = null;     // {col, ascending}
  let _limit = null;

  function rowsForTable() {
    return state[table];
  }

  function applyAndProject() {
    let out = rowsForTable();
    for (const f of _filters) {
      if (f.op === 'eq')   out = out.filter((r) => r[f.col] === f.val);
      else if (f.op === 'gte') out = out.filter((r) => r[f.col] >= f.val);
      else if (f.op === 'lte') out = out.filter((r) => r[f.col] <= f.val);
      else if (f.op === 'ilike') {
        const pat = String(f.val).replace(/%/g, '').toLowerCase();
        out = out.filter((r) => String(r[f.col] ?? '').toLowerCase().includes(pat));
      } else throw new Error(`not implemented: filter ${f.op}`);
    }
    if (_order) out = [...out].sort(compareForOrder(_order.col, _order.ascending));
    if (_limit != null) out = out.slice(0, _limit);
    return out.map((r) => projectRow(r, _select));
  }

  const chain = {
    select(fields = '*') { _select = fields; return chainProxy; },
    eq(col, val)         { _filters.push({ op: 'eq', col, val }); return chainProxy; },
    gte(col, val)        { _filters.push({ op: 'gte', col, val }); return chainProxy; },
    lte(col, val)        { _filters.push({ op: 'lte', col, val }); return chainProxy; },
    ilike(col, val)      { _filters.push({ op: 'ilike', col, val }); return chainProxy; },
    order(col, opts = {}){ _order = { col, ascending: opts.ascending !== false }; return chainProxy; },
    limit(n)             { _limit = n; return chainProxy; },
    async single() {
      const arr = applyAndProject();
      if (arr.length === 0) return { data: null, error: { ...PGRST116 } };
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
          const dup = (UNIQUE_FIELDS[table] || []).find((f) =>
            f in row && row[f] != null && state[table].some((existing) => existing[f] === row[f]));
          if (dup) return { data: null, error: { code: '23505', message: `duplicate ${dup}` } };
          const id = row.id || randomUUID();
          const created = { id, created_at: nowIso(), updated_at: nowIso(), ...row };
          state[table].push(created);
          return { data: projectRow(created, _select), error: null };
        },
        // allow `await insert(row)` without .select().single() — uncommon but safe
        then(resolve, reject) {
          return this.single().then(resolve, reject);
        },
      };
      return insertChain;
    },
    update(patch) {
      const updateChain = {
        eq(col, val) { _filters.push({ op: 'eq', col, val }); return updateChain; },
        select(fields = '*') { _select = fields; return updateChain; },
        async single() {
          const arr = state[table].filter((r) =>
            _filters.every((f) => f.op === 'eq' && r[f.col] === f.val)
          );
          if (arr.length === 0) return { data: null, error: { ...PGRST116 } };
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
        then(resolve) {
          const before = state[table].length;
          state[table] = state[table].filter((r) =>
            !_filters.every((f) => f.op === 'eq' && r[f.col] === f.val)
          );
          return Promise.resolve({ data: null, error: null, count: before - state[table].length }).then(resolve);
        },
      };
      return deleteChain;
    },
  };

  // Proxy: anything not in `chain` throws clearly. Special-case `then` so the
  // chain itself is thenable when awaited without .single() / .maybeSingle().
  const chainProxy = new Proxy(chain, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'then') {
        return (resolve, reject) =>
          Promise.resolve({ data: applyAndProject(), error: null }).then(resolve, reject);
      }
      // symbols (Symbol.asyncIterator, etc) — return undefined silently
      if (typeof p === 'symbol') return undefined;
      throw new Error(`not implemented: from(${table}).${String(p)}`);
    },
  });

  return chainProxy;
}

const storageApi = {
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
};

export const supabase = {
  from(table) { return tableQuery(table); },
};

export const supabaseAdmin = {
  from(table) { return tableQuery(table); },
  storage: storageApi,
};

// Live view of internal state (use sparingly — prefer reset/seed/snapshot helpers).
export const _state = new Proxy({}, {
  get(_t, p) { return state[p]; },
  ownKeys() { return Object.keys(state); },
  getOwnPropertyDescriptor(_t, p) {
    return { enumerable: true, configurable: true, value: state[p] };
  },
});
