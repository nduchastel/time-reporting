// frontend/src/components/manager/ManagerLogin.jsx
import { useState } from 'react';
import { apiFetch, setManagerSession } from '../../lib/auth';

export default function ManagerLogin({ onLoggedIn }) {
  const [u, setU] = useState(''); const [p, setP] = useState('');
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const data = await apiFetch('/api/auth/manager/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
      setManagerSession({ token: data.token, ...data.user });
      onLoggedIn?.(data);
    } catch (e) { setErr(e.code === 'INVALID_CREDENTIALS' ? 'Wrong username or password.' : 'Login failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-white shadow rounded-lg p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-4 text-center">Manager Sign In</h1>
        <label htmlFor="manager-login-username" className="block text-sm mb-1">Username</label>
        <input id="manager-login-username" value={u} onChange={(e)=>setU(e.target.value)} required className="w-full border rounded px-3 py-2 mb-3" />
        <label htmlFor="manager-login-password" className="block text-sm mb-1">Password</label>
        <input id="manager-login-password" type="password" value={p} onChange={(e)=>setP(e.target.value)} required className="w-full border rounded px-3 py-2 mb-3" />
        {err && <p className="text-red-600 text-sm mb-3">{err}</p>}
        <button disabled={busy} type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
