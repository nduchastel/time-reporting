// frontend/src/components/manager/WorkersView.jsx
import { useEffect, useState } from 'react';
import { apiFetch, getManagerSession } from '../../lib/auth';

export default function WorkersView() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id,…} = edit
  const session = getManagerSession();

  const load = () => apiFetch('/api/manager/workers', { token: session.token }).then(setList);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    if (editing.id) {
      await apiFetch(`/api/manager/workers/${editing.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify(body) });
    } else {
      await apiFetch(`/api/manager/workers`, { method: 'POST', token: session.token, body: JSON.stringify(body) });
    }
    setEditing(null); load();
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">Workers</h2>
        <button onClick={() => setEditing({})} className="ml-auto bg-blue-600 text-white px-3 py-1 rounded">Add worker</button>
      </div>
      <table className="w-full bg-white shadow rounded">
        <thead><tr className="text-left bg-gray-100"><th className="p-2">Name</th><th className="p-2">Phone</th><th className="p-2">Lang</th><th className="p-2">Role</th><th className="p-2">Status</th><th /></tr></thead>
        <tbody>
          {list.map((w) => (
            <tr key={w.id} className="border-t">
              <td className="p-2">{w.name}</td><td className="p-2">{w.phone}</td><td className="p-2">{w.language}</td>
              <td className="p-2">{w.role}</td><td className="p-2">{w.status}</td>
              <td className="p-2"><button onClick={() => setEditing(w)} className="text-blue-600 underline">Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-white rounded p-5 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{editing.id ? 'Edit worker' : 'Add worker'}</h3>
            <label className="block text-sm">Name<input name="name" defaultValue={editing.name || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>
            <label className="block text-sm">Phone<input name="phone" defaultValue={editing.phone || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>
            <label className="block text-sm">Language
              <select name="language" defaultValue={editing.language || 'en'} className="w-full border rounded px-2 py-1 mb-2">
                <option value="en">English</option><option value="fr">Français</option><option value="es">Español</option>
              </select>
            </label>
            <label className="block text-sm">PIN (4–6 digits, leave blank to keep existing)
              <input name="pin" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={6} className="w-full border rounded px-2 py-1 mb-2" />
            </label>
            {editing.id && (
              <label className="block text-sm">Status
                <select name="status" defaultValue={editing.status || 'active'} className="w-full border rounded px-2 py-1 mb-3">
                  <option value="active">Active</option><option value="disabled">Disabled</option>
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
