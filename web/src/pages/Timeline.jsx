import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { TIMELINE, buildTimeline } from '../config/modules';
import { logAudit } from '../lib/data';

export default function Timeline() {
  const { profile, role, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [pid, setPid] = useState('');
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const filters = [where('role', '==', 'patient')];
    if (role !== 'admin') filters.push(where('primaryProviderId', '==', user.uid));
    getDocs(query(collection(db, 'users'), ...filters))
      .then((s) => setPatients(s.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().email })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {});
  }, [role, user.uid]);

  useEffect(() => {
    if (!pid) return setEvents([]);
    setBusy(true);
    Promise.all(TIMELINE.map(async ([k]) => {
      try {
        const filters = [where('patientId', '==', pid)];
        if (role !== 'admin') filters.push(where('doctorId', '==', user.uid));
        const s = await getDocs(query(collection(db, k), ...filters)); return [k, s.docs.map((d) => ({ id: d.id, ...d.data() }))];
      }
      catch { return [k, []]; }
    })).then((r) => { setEvents(buildTimeline(Object.fromEntries(r))); setBusy(false); logAudit(profile, 'view-timeline', 'users', pid); });
  }, [pid, role, user.uid]);

  const types = [...new Set(events.map((e) => e.type))];
  const shown = events.filter((e) => !filter || e.type === filter);

  return (
    <div>
      <div className="page-head">
        <h2>Patient Timeline</h2>
        <div className="actions">
          <select value={pid} onChange={(e) => setPid(e.target.value)} style={{ minWidth: 240 }}>
            <option value="">Select patient...</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!!events.length && <button className="btn ghost" onClick={() => window.print()}>Print</button>}
        </div>
      </div>
      {!!types.length && <div className="chips">{['', ...types].map((t) => <button key={t || 'all'} className={`chip ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>{t || 'All'}</button>)}</div>}
      <div className="card">
        {busy && <p className="empty">Loading history...</p>}
        {!busy && pid && !shown.length && <p className="empty">No clinical history recorded.</p>}
        {!pid && <p className="empty">Choose a patient to see their full clinical history in one place.</p>}
        <ul className="tl">
          {shown.map((e) => (
            <li key={e.id}>
              <span className="tl-date">{e.when ? new Date(e.when).toLocaleDateString() : '-'}</span>
              <span className="pill info">{e.type}</span> {e.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
