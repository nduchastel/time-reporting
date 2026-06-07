// src/App.jsx
import { useHashRoute } from './lib/router';
import { getWorkerSession, setWorkerSession } from './lib/auth';
import WorkerUI from './components/WorkerUI';
import WorkerLogin from './components/WorkerLogin';
import ChangeCredential from './components/ChangeCredential';
import ManagerApp from './components/manager/ManagerApp';
import AdminApp from './components/admin/AdminApp';

export default function App() {
  const { path } = useHashRoute();

  if (path.startsWith('/admin')) return <AdminApp />;
  if (path.startsWith('/manager')) return <ManagerApp />;

  // Worker route
  const session = getWorkerSession();
  if (!session?.token) {
    return <WorkerLogin onLoggedIn={() => window.location.reload()} />;
  }
  // Forced first-login PIN change blocks the app until cleared.
  if (session.must_change_credential) {
    return (
      <ChangeCredential
        kind="pin" token={session.token} forced
        onSuccess={() => { setWorkerSession({ ...session, must_change_credential: false }); window.location.reload(); }}
      />
    );
  }
  return <WorkerUI />;
}
