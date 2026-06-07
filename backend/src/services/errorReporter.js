// backend/src/services/errorReporter.js
//
// Provider-agnostic error reporting. When no DSN is configured it is a complete
// no-op, so local dev and the offline test suite never reach the network. When a
// DSN is set, a scrubbed payload is POSTed to it (works with any Sentry-style
// HTTP ingest / webhook; swap in a vendor SDK here later without touching callers).
//
// PII is never sent: audio, transcription text, PINs, passwords, and tokens are
// stripped before the payload leaves this module.

const SENSITIVE_KEYS = new Set([
  'audio', 'audioUrl', 'audio_url', 'transcription', 'extractedData', 'extracted_data',
  'pin', 'password', 'newSecret', 'currentSecret', 'password_hash', 'token', 'authorization',
]);

let _dsn = process.env.SENTRY_DSN || process.env.ERROR_DSN || null;
let _transport = defaultTransport;

async function defaultTransport(payload) {
  // Fire-and-forget; never let reporting throw into the app.
  try {
    await fetch(_dsn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch { /* swallow */ }
}

// Recursively drop sensitive keys from a context object.
export function scrub(value, seen = new Set()) {
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => scrub(v, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k)) { out[k] = '[redacted]'; continue; }
    out[k] = scrub(v, seen);
  }
  return out;
}

export function isEnabled() { return !!_dsn; }

// Test/seam hook: override the DSN and/or transport.
export function configure({ dsn, transport } = {}) {
  if (dsn !== undefined) _dsn = dsn;
  if (transport !== undefined) _transport = transport;
}

export function captureError(error, context = {}) {
  if (!_dsn) return false;
  const payload = {
    message: error?.message || String(error),
    name: error?.name,
    stack: error?.stack,
    context: scrub(context),
    timestamp: new Date().toISOString(),
  };
  try { _transport(payload); } catch { /* never throw from reporting */ }
  return true;
}

// Catch crashes that escape Express. Skipped under test to avoid leaking listeners
// across the many server.js imports in the suite.
export function installProcessHandlers() {
  if (process.env.NODE_ENV === 'test') return;
  process.on('unhandledRejection', (reason) => {
    captureError(reason instanceof Error ? reason : new Error(String(reason)), { kind: 'unhandledRejection' });
  });
  process.on('uncaughtException', (err) => {
    captureError(err, { kind: 'uncaughtException' });
  });
}
