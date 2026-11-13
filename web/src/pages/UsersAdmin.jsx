import { useEffect, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { logAudit } from '../lib/data';
import { PROVIDER_ROLES, ROLES } from '../config/modules';

// A second Firebase app instance lets the admin create accounts without being signed out of their own session.
const secondaryAuth = () => getAuth(getApps().find((a) => a.name === 'secondary') || initializeApp(firebaseConfig, 'secondary'));

export default function UsersAdmin() {
  const { profile, role } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
  if (role !== 'admin') return <p>Admins only.</p>;

  const create = async () => {
    setBusy(true); setMsg('');
    try {
      const sa = secondaryAuth();
      const cred = await createUserWithEmailAndPassword(sa, form.email, form.password);
      await signOut(sa);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, name: form.name, email: form.email, phone: form.phone || '', role: form.role,
        specialization: form.specialization || '', active: true, createdAt: serverTimestamp(),
      });
      logAudit(profile, 'create-user', 'users', cred.user.uid);
      setForm(null);
    } catch (e) { setMsg(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  };

  const patch = async (u, data) => { await updateDoc(doc(db, 'users', u.id), data); logAudit(profile, 'update-user', 'users', u.id); };
  const shown = users.filter((u) => filter === 'all' || u.role === filter).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div>
      <div className="page-head">
        <h2>Users &amp; Roles</h2>
        <div className="actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {['all', ...ROLES].map((r) => <option key={r}>{r}</option>)}
          </select>
          <button className="btn" onClick={() => setForm({ role: 'doctor' })}>+ New user</button>
        </div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assigned provider</th><th>Active</th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === profile.id} onChange={(e) => patch(u, { role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r === 'yogaTeacher' ? 'Yoga teacher' : r[0].toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </td>
                <td>{u.role === 'patient' ? <select value={u.primaryProviderId || ''} onChange={(e) => patch(u, { primaryProviderId: e.target.value })}>
                  <option value="">Unassigned</option>{users.filter((p) => PROVIDER_ROLES.includes(p.role) && p.active !== false).map((p) => <option value={p.id} key={p.id}>{p.name} · {p.role}</option>)}
                </select> : <span className="muted">—</span>}</td>
                <td><input type="checkbox" checked={u.active !== false} disabled={u.id === profile.id} onChange={(e) => patch(u, { active: e.target.checked })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-bg" onClick={() => !busy && setForm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New user</h3>
            {msg && <div className="alert">{msg}</div>}
            <div className="form-grid">
              {[['name', 'Full name'], ['email', 'Email'], ['password', 'Temporary password'], ['phone', 'Phone']].map(([k, l]) => (
                <div className="field" key={k}><label>{l}</label>
                  <input type={k === 'password' ? 'password' : 'text'} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
              ))}
              <div className="field"><label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r === 'yogaTeacher' ? 'Yoga teacher' : r[0].toUpperCase() + r.slice(1)}</option>)}
                </select></div>
              {PROVIDER_ROLES.includes(form.role) && <div className="field"><label>Specialization / practice area</label>
                <input value={form.specialization || ''} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>}
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
              <button className="btn" onClick={create} disabled={busy || !form.name || !form.email || (form.password || '').length < 6}>{busy ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
