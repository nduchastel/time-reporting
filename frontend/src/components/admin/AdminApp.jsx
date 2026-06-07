// frontend/src/components/admin/AdminApp.jsx
// Admin portal, reachable at #/admin. Admins log in through the SAME manager login
// (username + password) — there is no separate admin login. The JWT's role gates this:
// non-admins are denied. A forced first-login password change blocks the portal until done.
import { useState } from 'react';
import { useHashRoute } from '../../lib/router';
import { getManagerSession, clearManagerSession, setManagerSession } from '../../lib/auth';
import ManagerLogin from '../manager/ManagerLogin';
import ChangeCredential from '../ChangeCredential';
import UsersView from './UsersView';

export default function AdminApp() {
  const { navigate } = useHashRoute();
  const [changing, setChanging] = useState(false);
  const session = getManagerSession();

  if (!session?.token) return <ManagerLogin onLoggedIn={() => window.location.reload()} />;

  if (session.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-lg font-semibold">You don’t have access to the admin portal.</p>
        <button onClick={() => navigate('/manager')} className="text-blue-600 underline">Go to the manager dashboard</button>
      </div>
    );
  }

  if (session.must_change_credential) {
    return (
      <ChangeCredential
        kind="password" token={session.token} forced
        onSuccess={() => { setManagerSession({ ...session, must_change_credential: false }); window.location.reload(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-3 flex items-center gap-4">
        <strong>Admin</strong>
        <nav className="flex gap-3 ml-2">
          <button onClick={() => navigate('/admin')} className="px-2 py-1 rounded bg-blue-100 font-semibold">Users</button>
          <button onClick={() => navigate('/manager')} className="px-2 py-1 rounded">Manager view</button>
        </nav>
        <span className="ml-auto text-sm text-gray-600">{session.name}</span>
        <button onClick={() => setChanging(true)} className="text-sm text-blue-600 underline">Change password</button>
        <button onClick={() => { clearManagerSession(); window.location.reload(); }} className="text-sm text-red-600 underline">Sign out</button>
      </header>
      <UsersView />
      {changing && (
        <ChangeCredential kind="password" token={session.token} onCancel={() => setChanging(false)} onSuccess={() => setChanging(false)} />
      )}
    </div>
  );
}
