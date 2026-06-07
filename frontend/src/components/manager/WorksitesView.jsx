// frontend/src/components/manager/WorksitesView.jsx
// Manager worksite management: list (active + archived), add/edit, archive/unarchive.
// Sites are archived (not deleted) so historical time-card links stay intact.
import { useEffect, useState } from 'react';
import { apiFetch, getManagerSession } from '../../lib/auth';

export default function WorksitesView() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // null | {} (new) | {id,…} (edit)
  const [err, setErr] = useState(null);
  const session = getManagerSession();

  const load = () => apiFetch('/api/manager/worksites', { token: session.token }).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault(); setErr(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (editing.id) {
        await apiFetch(`/api/manager/worksites/${editing.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify(body) });
      } else {
        await apiFetch('/api/manager/worksites', { method: 'POST', token: session.token, body: JSON.stringify(body) });
      }
      setEditing(null); load();
    } catch (e2) { setErr(e2.message || 'Save failed.'); }
  };

  const setStatus = async (w, status) => {
    if (status === 'archived' && !window.confirm(`Archive ${w.name}? It will stop appearing in pickers but past time cards keep it.`)) return;
    setErr(null);
    try { await apiFetch(`/api/manager/worksites/${w.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify({ status }) }); load(); }
    catch (e2) { setErr(e2.message || 'Update failed.'); }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">Worksites</h2>
        <button onClick={() => { setErr(null); setEditing({}); }} className="ml-auto bg-blue-600 text-white px-3 py-1 rounded">Add worksite</button>
      </div>
      {err && <p className="text-red-600 mb-3">{err}</p>}

      <table className="w-full bg-white shadow rounded">
        <thead><tr className="text-left bg-gray-100"><th className="p-2">Name</th><th className="p-2">Address</th><th className="p-2">Client</th><th className="p-2">Status</th><th /></tr></thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id} className={`border-t ${w.status === 'archived' ? 'text-gray-400 italic' : ''}`}>
              <td className="p-2">{w.name}</td>
              <td className="p-2">{w.address || '—'}</td>
              <td className="p-2">{w.client || '—'}</td>
              <td className="p-2">{w.status}</td>
              <td className="p-2 whitespace-nowrap">
                <button onClick={() => { setErr(null); setEditing(w); }} className="text-blue-600 underline mr-3">Edit</button>
                {w.status === 'archived'
                  ? <button onClick={() => setStatus(w, 'active')} className="text-green-700 underline">Unarchive</button>
                  : <button onClick={() => setStatus(w, 'archived')} className="text-red-600 underline">Archive</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-white rounded p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{editing.id ? 'Edit worksite' : 'Add worksite'}</h3>
            <label className="block text-sm">Name<input name="name" defaultValue={editing.name || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>
            <label className="block text-sm">Address<input name="address" defaultValue={editing.address || ''} className="w-full border rounded px-2 py-1 mb-2" /></label>
            <label className="block text-sm">Client<input name="client" defaultValue={editing.client || ''} className="w-full border rounded px-2 py-1 mb-3" /></label>
            {editing.id && (
              <label className="block text-sm">Status
                <select name="status" defaultValue={editing.status || 'active'} className="w-full border rounded px-2 py-1 mb-3">
                  <option value="active">Active</option><option value="archived">Archived</option>
                </select>
              </label>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
