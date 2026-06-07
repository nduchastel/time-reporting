// frontend/src/components/ChangeCredential.jsx
// Shared secret-change form. Serves two cases:
//   - forced=true  → full-screen gate shown on first login (must_change_credential).
//   - forced=false → cancellable modal for self-service "change my PIN/password".
// kind decides PIN (worker) vs password (manager/admin).
import { useState } from 'react';
import { apiFetch } from '../lib/auth';

export default function ChangeCredential({ kind = 'pin', token, forced = false, onSuccess, onCancel }) {
  const isPin = kind === 'pin';
  const label = isPin ? 'PIN' : 'password';
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const validNew = (v) => (isPin ? /^\d{4,6}$/.test(v) : v.length >= 8);
  const fieldProps = isPin
    ? { type: 'password', inputMode: 'numeric', pattern: '[0-9]*', minLength: 4, maxLength: 6 }
    : { type: 'password', minLength: 8 };

  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    if (!validNew(next)) { setErr(isPin ? 'PIN must be 4–6 digits.' : 'Password must be at least 8 characters.'); return; }
    if (next !== confirm) { setErr(`The two ${label}s don’t match.`); return; }
    setBusy(true);
    try {
      await apiFetch('/api/auth/change-credential', {
        method: 'POST', token,
        body: JSON.stringify({ currentSecret: current, newSecret: next }),
      });
      onSuccess?.();
    } catch (e2) {
      setErr(e2.code === 'INVALID_CREDENTIALS' ? `Current ${label} is incorrect.` : (e2.message || 'Could not change credential.'));
    } finally { setBusy(false); }
  };

  const wrapperClass = forced
    ? 'min-h-screen bg-gray-50 flex items-center justify-center p-6'
    : 'fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6';

  return (
    <div className={wrapperClass} onClick={forced ? undefined : onCancel}>
      <form onSubmit={submit} className="bg-white shadow rounded-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-xl font-bold mb-1 text-center">Change your {label}</h1>
        {forced && <p className="text-sm text-gray-600 mb-4 text-center">For your security, replace your temporary {label} before continuing.</p>}
        <label className="block text-sm mb-1" htmlFor="cc-current">Current {label}</label>
        <input id="cc-current" {...fieldProps} value={current} onChange={(e) => setCurrent(e.target.value)} required className="w-full border rounded px-3 py-2 mb-3" />
        <label className="block text-sm mb-1" htmlFor="cc-new">New {label}</label>
        <input id="cc-new" {...fieldProps} value={next} onChange={(e) => setNext(e.target.value)} required className="w-full border rounded px-3 py-2 mb-3" />
        <label className="block text-sm mb-1" htmlFor="cc-confirm">Confirm new {label}</label>
        <input id="cc-confirm" {...fieldProps} value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full border rounded px-3 py-2 mb-3" />
        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
        <div className="flex gap-2">
          {!forced && <button type="button" onClick={onCancel} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>}
          <button disabled={busy} type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-semibold disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
