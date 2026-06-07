// frontend/src/lib/auth.js
const WORKER_KEY  = 'time-reporting.worker';
const MANAGER_KEY = 'time-reporting.manager';

export function getWorkerSession()  { try { return JSON.parse(localStorage.getItem(WORKER_KEY)  || 'null'); } catch { return null; } }
export function getManagerSession() { try { return JSON.parse(localStorage.getItem(MANAGER_KEY) || 'null'); } catch { return null; } }

export function setWorkerSession(s)  { localStorage.setItem(WORKER_KEY,  JSON.stringify(s)); }
export function setManagerSession(s) { localStorage.setItem(MANAGER_KEY, JSON.stringify(s)); }
export function clearWorkerSession()  { localStorage.removeItem(WORKER_KEY); }
export function clearManagerSession() { localStorage.removeItem(MANAGER_KEY); }

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function apiFetch(path, { token, ...init } = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const r = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = new Error(body.message || `HTTP ${r.status}`);
    err.status = r.status; err.code = body.error;
    // Re-auth UX: an authenticated request rejected for a *token* reason means the
    // session expired or was revoked — clear it and bounce to login. We scope this
    // to token errors so a wrong-password/PIN check (INVALID_CREDENTIALS, e.g. the
    // "current secret" on the change screen) does NOT log the user out.
    if (r.status === 401 && token && (body.error === 'INVALID_TOKEN' || body.error === 'UNAUTHORIZED')) {
      clearWorkerSession();
      clearManagerSession();
      if (typeof window !== 'undefined' && window.location) {
        try { window.location.reload(); } catch { /* jsdom / non-browser: ignore */ }
      }
    }
    throw err;
  }
  if (r.status === 204) return null;
  return r.json().catch(() => null);
}
