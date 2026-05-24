// frontend/src/components/WorkerHistory.jsx
import { useEffect, useState } from 'react';
import { apiFetch, getWorkerSession } from '../lib/auth';

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  edited:   'bg-blue-100 text-blue-800',
  flagged:  'bg-red-100 text-red-800',
};

const ACTION_BADGE = {
  IN: 'bg-teal-500', OUT: 'bg-green-500', HOURS: 'bg-blue-500', OFF: 'bg-orange-500',
};

export default function WorkerHistory({ open, onClose }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    const session = getWorkerSession();
    if (!session) return;
    setItems(null); setErr(null);
    apiFetch(`/api/time-cards?workerId=${encodeURIComponent(session.id)}&limit=5`, { token: session.token })
      .then(setItems).catch(e => setErr(e.message));
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Recent submissions</h2>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        {!items && !err && <p>Loading…</p>}
        {err && <p className="text-red-600">{err}</p>}
        {items && items.length === 0 && <p className="text-gray-500">No submissions yet.</p>}
        {items?.map((tc) => (
          <div key={tc.id} className="border rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-white text-xs font-bold px-2 py-0.5 rounded ${ACTION_BADGE[tc.action_type]}`}>{tc.action_type}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[tc.status]}`}>{tc.status}</span>
              <span className="text-xs text-gray-500 ml-auto">{new Date(tc.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm">
              <strong>{tc.date}</strong>
              {tc.hours != null && <> · {tc.hours}h</>}
              {tc.worksites?.name && <> · {tc.worksites.name}</>}
            </p>
            {tc.audio_url && (
              <audio controls src={tc.audio_url} className="w-full mt-2" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
