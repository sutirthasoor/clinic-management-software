import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { isProviderRole, PROFILE_FIELDS } from '../config/modules';
import FormFields from '../components/FormFields';

export default function Profile() {
  const { profile, role, user } = useAuth();
  const fields = [...PROFILE_FIELDS.common, ...(PROFILE_FIELDS[role] || (isProviderRole(role) ? PROFILE_FIELDS.doctor : []))];
  const [values, setValues] = useState({ ...profile });
  const [msg, setMsg] = useState('');

  const save = async () => {
    const payload = {};
    fields.forEach((f) => { let v = values[f.name]; if (f.type === 'number' && v !== '' && v != null) v = Number(v); payload[f.name] = v ?? ''; });
    try { await updateDoc(doc(db, 'users', user.uid), { ...payload, updatedAt: serverTimestamp() }); setMsg('Profile saved.'); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      <h2>My Profile</h2>
      <div className="card">
        <p className="muted">{profile.email} · <span className={`badge ${role}`}>{role}</span></p>
        <div className="form-grid">
          <FormFields fields={fields} role={role} lists={{}} values={values} onChange={(n, v) => setValues((p) => ({ ...p, [n]: v }))} />
        </div>
        {msg && <div className="alert">{msg}</div>}
        <button className="btn" onClick={save}>Save profile</button>
      </div>
    </div>
  );
}
