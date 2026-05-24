// src/App.jsx
import { useHashRoute } from './lib/router';
import { getWorkerSession } from './lib/auth';
import WorkerUI from './components/WorkerUI';
import WorkerLogin from './components/WorkerLogin';
import ManagerApp from './components/manager/ManagerApp';

export default function App() {
  const { path } = useHashRoute();

  if (path.startsWith('/manager')) {
    return <ManagerApp />;
  }
  // Worker route
  const session = getWorkerSession();
  if (!session?.token) {
    return <WorkerLogin onLoggedIn={() => window.location.reload()} />;
  }
  return <WorkerUI />;
}
