// frontend/src/components/manager/ManagerDashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { apiFetch, getManagerSession } from '../../lib/auth';
import TimeCardCard from './TimeCardCard';
import EditTimeCardModal from './EditTimeCardModal';

const POLL_MS = 30_000;

export default function ManagerDashboard() {
  const [cards, setCards] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editing, setEditing] = useState(null);
  const session = getManagerSession();

  const load = useCallback(async () => {
    const data = await apiFetch(`/api/manager/time-cards?status=${statusFilter}&limit=50`, { token: session.token });
    setCards(data);
  }, [statusFilter, session.token]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const approve = async (c) => { await apiFetch(`/api/manager/time-cards/${c.id}/approve`, { method: 'POST', token: session.token }); load(); };
  const flag    = async (c) => { await apiFetch(`/api/manager/time-cards/${c.id}/flag`,    { method: 'POST', token: session.token }); load(); };
  const saveEdit = async (fields) => {
    await apiFetch(`/api/manager/time-cards/${editing.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify(fields) });
    setEditing(null); load();
  };

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
      {cards.length === 0 && <p className="text-gray-500">Nothing to show.</p>}
      <div className="space-y-3">
        {cards.map((c) => (
          <TimeCardCard key={c.id} card={c} onApprove={approve} onFlag={flag} onEdit={setEditing} />
        ))}
      </div>
      {editing && <EditTimeCardModal card={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </div>
  );
}
