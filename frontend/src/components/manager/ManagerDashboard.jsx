// frontend/src/components/manager/ManagerDashboard.jsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiFetch, getManagerSession, clearManagerSession } from '../../lib/auth';
import TimeCardCard from './TimeCardCard';
import EditTimeCardModal from './EditTimeCardModal';

const POLL_MS = 30_000;

export default function ManagerDashboard() {
  const [cards, setCards] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const session = getManagerSession();
  // Monotonic request id — older inflight responses are ignored when a newer one is dispatched.
  const requestIdRef = useRef(0);

  // 401 → wipe session and bounce to login.
  const handleAuthError = (e) => {
    if (e?.status === 401) {
      clearManagerSession();
      window.location.reload();
      return true;
    }
    return false;
  };

  const load = useCallback(async () => {
    if (!session?.token) return;
    const reqId = ++requestIdRef.current;
    try {
      const data = await apiFetch(`/api/manager/time-cards?status=${statusFilter}&limit=50`, { token: session.token });
      // Drop response if a newer request has been dispatched (filter changed, or post-mutation reload).
      if (reqId !== requestIdRef.current) return;
      setCards(data);
      setError(null);
    } catch (e) {
      if (handleAuthError(e)) return;
      if (reqId === requestIdRef.current) setError(e.message || 'Failed to load time cards');
    }
  }, [statusFilter, session?.token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const mutate = async (fn) => {
    try { await fn(); load(); }
    catch (e) {
      if (handleAuthError(e)) return;
      setError(e.message || 'Action failed');
    }
  };

  const approve  = (c) => mutate(() => apiFetch(`/api/manager/time-cards/${c.id}/approve`, { method: 'POST', token: session.token }));
  const flag     = (c) => mutate(() => apiFetch(`/api/manager/time-cards/${c.id}/flag`,    { method: 'POST', token: session.token }));
  const saveEdit = (fields) => mutate(async () => {
    await apiFetch(`/api/manager/time-cards/${editing.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify(fields) });
    setEditing(null);
  });

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center mb-4 gap-2">
        <h2 className="text-xl font-bold">Time Cards</h2>
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 ml-auto">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="edited">Edited</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>
      {error && <p role="alert" className="mb-3 p-2 bg-red-50 text-red-700 text-sm rounded">{error}</p>}
      {cards.length === 0 && !error && <p className="text-gray-500">Nothing to show.</p>}
      <div className="space-y-3">
        {cards.map((c) => (
          <TimeCardCard key={c.id} card={c} onApprove={approve} onFlag={flag} onEdit={setEditing} />
        ))}
      </div>
      {editing && <EditTimeCardModal card={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}
