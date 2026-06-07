// frontend/src/components/manager/ManagerApp.jsx
import { useState } from 'react';
import { useHashRoute } from '../../lib/router';
import { getManagerSession, clearManagerSession, setManagerSession } from '../../lib/auth';
import ManagerLogin from './ManagerLogin';
import ManagerDashboard from './ManagerDashboard';
import WorkersView from './WorkersView';
import WorksitesView from './WorksitesView';
import ReportsView from './ReportsView';
import ChangeCredential from '../ChangeCredential';

const NAV = [
  { path: '/manager',           label: 'Review',    Comp: ManagerDashboard },
  { path: '/manager/workers',   label: 'Workers',   Comp: WorkersView },
  { path: '/manager/worksites', label: 'Worksites', Comp: WorksitesView },
  { path: '/manager/reports',   label: 'Reports',   Comp: ReportsView },
];

export default function ManagerApp() {
  const { path, navigate } = useHashRoute();
  const [changing, setChanging] = useState(false);
  const session = getManagerSession();
  if (!session?.token) return <ManagerLogin onLoggedIn={() => window.location.reload()} />;

  // Forced first-login password change blocks the dashboard until cleared.
  if (session.must_change_credential) {
    return (
      <ChangeCredential
        kind="password" token={session.token} forced
        onSuccess={() => { setManagerSession({ ...session, must_change_credential: false }); window.location.reload(); }}
      />
    );
  }

  const View = (NAV.find((n) => n.path === path) || NAV[0]).Comp;
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-3 flex items-center gap-4">
        <strong>Manager</strong>
        <nav className="flex gap-3 ml-2">
          {NAV.map((n) => (
            <button key={n.path} onClick={() => navigate(n.path)} className={`px-2 py-1 rounded ${path === n.path ? 'bg-blue-100 font-semibold' : ''}`}>
              {n.label}
            </button>
          ))}
          {session.role === 'admin' && (
            <button onClick={() => navigate('/admin')} className="px-2 py-1 rounded text-purple-700">Admin</button>
          )}
        </nav>
        <span className="ml-auto text-sm text-gray-600">{session.name}</span>
        <button onClick={() => setChanging(true)} className="text-sm text-blue-600 underline">Change password</button>
        <button onClick={() => { clearManagerSession(); window.location.reload(); }} className="text-sm text-red-600 underline">Sign out</button>
      </header>
      <View />
      {changing && (
        <ChangeCredential kind="password" token={session.token} onCancel={() => setChanging(false)} onSuccess={() => setChanging(false)} />
      )}
    </div>
  );
}
