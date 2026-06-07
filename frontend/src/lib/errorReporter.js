// frontend/src/lib/errorReporter.js
//
// Browser-side counterpart to the backend reporter. No-op unless VITE_SENTRY_DSN
// is set, so dev and tests stay offline. PII (PINs, passwords, tokens, transcription,
// audio) is stripped before anything is sent.

const SENSITIVE_KEYS = new Set([
  'audio', 'audioUrl', 'audio_url', 'transcription', 'extractedData', 'extracted_data',
  'pin', 'password', 'newSecret', 'currentSecret', 'password_hash', 'token', 'authorization',
]);

let _dsn = (import.meta.env && import.meta.env.VITE_SENTRY_DSN) || null;
let _transport = defaultTransport;

function defaultTransport(payload) {
  try {
    fetch(_dsn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
  } catch { /* swallow */ }
}

export function scrub(value, seen = new Set()) {
  if (value == null || typeof value !== 'object') return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => scrub(v, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[redacted]' : scrub(v, seen);
  }
  return out;
}

export function isEnabled() { return !!_dsn; }
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

// Global handlers for errors that escape React (async, event handlers, etc.).
export function installWindowHandlers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => captureError(e.error || new Error(e.message), { kind: 'window.onerror' }));
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    captureError(reason, { kind: 'unhandledrejection' });
  });
}
