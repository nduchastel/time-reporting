// frontend/src/components/admin/UsersView.jsx
// Admin user management: list all users, create/edit (incl. role change + enable/disable),
// reset a user's credential to a new temporary one, and delete (with guards server-side).
import { useEffect, useState } from 'react';
import { apiFetch, getManagerSession } from '../../lib/auth';

const ROLES = ['worker', 'manager', 'admin'];

export default function UsersView() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);   // null | {} (new) | {id,...} (edit)
  const [formRole, setFormRole] = useState('worker');
  const [resetting, setResetting] = useState(null); // user being credential-reset
  const [handoff, setHandoff] = useState(null);     // {name, label, secret} shown once
  const [err, setErr] = useState(null);
  const session = getManagerSession();

  const load = () => apiFetch('/api/admin/users', { token: session.token }).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setErr(null); setFormRole('worker'); setEditing({}); };
  const openEdit = (u) => { setErr(null); setFormRole(u.role); setEditing(u); };

  const save = async (e) => {
    e.preventDefault(); setErr(null);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (editing.id) {
        const body = { name: f.name, role: f.role, status: f.status };
        if (f.phone) body.phone = f.phone;
        if (f.username) body.username = f.username;
        await apiFetch(`/api/admin/users/${editing.id}`, { method: 'PATCH', token: session.token, body: JSON.stringify(body) });
      } else {
        const body = { role: f.role, name: f.name };
        if (f.role === 'worker') { body.phone = f.phone; body.pin = f.pin; }
        else { body.username = f.username; body.password = f.password; }
        await apiFetch('/api/admin/users', { method: 'POST', token: session.token, body: JSON.stringify(body) });
        setHandoff({ name: f.name, label: f.role === 'worker' ? 'PIN' : 'password', secret: f.role === 'worker' ? f.pin : f.password });
      }
      setEditing(null); load();
    } catch (e2) { setErr(e2.message || 'Save failed.'); }
  };

  const doReset = async (e) => {
    e.preventDefault(); setErr(null);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const body = resetting.role === 'worker' ? { pin: f.secret } : { password: f.secret };
      await apiFetch(`/api/admin/users/${resetting.id}/reset-credential`, { method: 'POST', token: session.token, body: JSON.stringify(body) });
      setHandoff({ name: resetting.name, label: resetting.role === 'worker' ? 'PIN' : 'password', secret: f.secret });
      setResetting(null); load();
    } catch (e2) { setErr(e2.message || 'Reset failed.'); }
  };

  const doDelete = async (u) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    setErr(null);
    try { await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE', token: session.token }); load(); }
    catch (e2) { setErr(e2.message || 'Delete failed.'); }
  };

  const isWorkerForm = formRole === 'worker';

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center mb-4">
        <h2 className="text-xl font-bold">Users</h2>
        <button onClick={openNew} className="ml-auto bg-blue-600 text-white px-3 py-1 rounded">Add user</button>
      </div>
      {err && <p className="text-red-600 mb-3">{err}</p>}

      <table className="w-full bg-white shadow rounded">
        <thead><tr className="text-left bg-gray-100"><th className="p-2">Name</th><th className="p-2">Login</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2">First login</th><th /></tr></thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.name}</td>
              <td className="p-2">{u.username || u.phone || '—'}</td>
              <td className="p-2">{u.role}</td>
              <td className="p-2">{u.status}</td>
              <td className="p-2">{u.must_change_credential ? 'pending' : '✓'}</td>
              <td className="p-2 whitespace-nowrap">
                <button onClick={() => openEdit(u)} className="text-blue-600 underline mr-3">Edit</button>
                <button onClick={() => { setErr(null); setResetting(u); }} className="text-blue-600 underline mr-3">Reset</button>
                <button onClick={() => doDelete(u)} className="text-red-600 underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Create / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setEditing(null)}>
          <form onSubmit={save} className="bg-white rounded p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{editing.id ? 'Edit user' : 'Add user'}</h3>
            <label className="block text-sm">Role
              <select name="role" aria-label="Role" value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full border rounded px-2 py-1 mb-2">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="block text-sm">Name<input name="name" defaultValue={editing.name || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>

            {isWorkerForm ? (
              <>
                <label className="block text-sm">Phone<input name="phone" defaultValue={editing.phone || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>
                {!editing.id && (
                  <label className="block text-sm">Temporary PIN (4–6 digits)
                    <input name="pin" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={6} required className="w-full border rounded px-2 py-1 mb-2" />
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm">Username<input name="username" defaultValue={editing.username || ''} required className="w-full border rounded px-2 py-1 mb-2" /></label>
                {!editing.id && (
                  <label className="block text-sm">Temporary password (min 8 chars)
                    <input name="password" type="password" minLength={8} required className="w-full border rounded px-2 py-1 mb-2" />
                  </label>
                )}
              </>
            )}

            {editing.id && (
              <label className="block text-sm">Status
                <select name="status" defaultValue={editing.status || 'active'} className="w-full border rounded px-2 py-1 mb-3">
                  <option value="active">Active</option><option value="disabled">Disabled</option>
                </select>
              </label>
            )}
            {!editing.id && <p className="text-xs text-gray-500 mb-3">The user must change this temporary {isWorkerForm ? 'PIN' : 'password'} on first login.</p>}
            {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Reset-credential modal */}
      {resetting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setResetting(null)}>
          <form onSubmit={doReset} className="bg-white rounded p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Reset {resetting.role === 'worker' ? 'PIN' : 'password'} — {resetting.name}</h3>
            <label className="block text-sm">New temporary {resetting.role === 'worker' ? 'PIN (4–6 digits)' : 'password (min 8 chars)'}
              <input
                name="secret"
                {...(resetting.role === 'worker'
                  ? { inputMode: 'numeric', pattern: '[0-9]*', minLength: 4, maxLength: 6 }
                  : { type: 'password', minLength: 8 })}
                required className="w-full border rounded px-2 py-1 mb-3"
              />
            </label>
            <p className="text-xs text-gray-500 mb-3">The user will be forced to change this on next login.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetting(null)} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>
              <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-semibold">Reset</button>
            </div>
          </form>
        </div>
      )}

      {/* One-time temporary-credential hand-off */}
      {handoff && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setHandoff(null)}>
          <div className="bg-white rounded p-5 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Hand this to {handoff.name}</h3>
            <p className="text-sm text-gray-600 mb-3">Temporary {handoff.label} (shown once — they’ll change it on first login):</p>
            <p className="text-2xl font-mono font-bold mb-4">{handoff.secret}</p>
            <button onClick={() => setHandoff(null)} className="w-full bg-blue-600 text-white py-2 rounded font-semibold">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
