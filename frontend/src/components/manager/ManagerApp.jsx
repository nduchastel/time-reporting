// frontend/src/components/manager/ManagerApp.jsx
import { useHashRoute } from '../../lib/router';
import { getManagerSession, clearManagerSession } from '../../lib/auth';
import ManagerLogin from './ManagerLogin';
import ManagerDashboard from './ManagerDashboard';
// Lazily added in Tasks 8/9; keep imports null-safe for now:
import WorkersView from './WorkersView';
import ReportsView from './ReportsView';

const NAV = [
  { path: '/manager',          label: 'Review',  Comp: ManagerDashboard },
  { path: '/manager/workers',  label: 'Workers', Comp: WorkersView },
  { path: '/manager/reports',  label: 'Reports', Comp: ReportsView },
];

export default function ManagerApp() {
  const { path, navigate } = useHashRoute();
  const session = getManagerSession();
  if (!session?.token) return <ManagerLogin onLoggedIn={() => window.location.reload()} />;

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
        </nav>
        <span className="ml-auto text-sm text-gray-600">{session.name}</span>
        <button onClick={() => { clearManagerSession(); window.location.reload(); }} className="text-sm text-red-600 underline">Sign out</button>
      </header>
      <View />
    </div>
  );
}
