// frontend/src/components/WorkerLogin.jsx
import { useState } from 'react';
import { apiFetch, setWorkerSession } from '../lib/auth';

export default function WorkerLogin({ onLoggedIn }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const data = await apiFetch('/api/auth/worker/login', {
        method: 'POST',
        body: JSON.stringify({ phone, pin }),
      });
      setWorkerSession({ token: data.token, ...data.worker });
      onLoggedIn?.(data);
    } catch (e) {
      setErr(e.code === 'INVALID_CREDENTIALS' ? 'Wrong phone or PIN.' : 'Login failed.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-white shadow-lg rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">Sign in</h1>
        <label htmlFor="worker-login-phone" className="block text-sm font-medium mb-1">Phone</label>
        <input
          id="worker-login-phone"
          type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          required placeholder="+1-555-0100"
          className="w-full border rounded px-3 py-2 mb-4"
        />
        <label htmlFor="worker-login-pin" className="block text-sm font-medium mb-1">PIN</label>
        <input
          id="worker-login-pin"
          type="password" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={6}
          value={pin} onChange={(e) => setPin(e.target.value)} required
          className="w-full border rounded px-3 py-2 mb-4"
        />
        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
        <button disabled={busy} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
