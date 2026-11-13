import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { chartModules } from '../config/modules';
import { can, cellValue, colName, fmt, logAudit } from '../lib/data';

// Full-body view of one patient: every health record any provider has written for them (clinical, nutrition, yoga, naturopathy, documents).
// Admin sees every patient. A doctor sees patients assigned to them (Users & Roles -> primary provider); Firestore rules enforce this.
export default function PatientChart() {
  const { pid } = useParams();
  const nav = useNavigate();
  const { profile, role, user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mods = useMemo(() => chartModules().filter((m) => can(m, role, 'r')), [role]);

  useEffect(() => {
    const f = [where('role', '==', 'patient')];
    if (role !== 'admin') f.push(where('primaryProviderId', '==', user.uid));
    getDocs(query(collection(db, 'users'), ...f)).then((s) => setPatients(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')))).catch((e) => setErr(e.message));
  }, [role, user.uid]);

  useEffect(() => {
    setData({}); setPatient(null); setErr('');
    if (!pid) return;
    setBusy(true);
    getDoc(doc(db, 'users', pid)).then((s) => setPatient(s.exists() ? { id: s.id, ...s.data() } : null)).catch((e) => setErr(e.message));
    Promise.all(mods.map(async (m) => {
      try {
        const s = await getDocs(query(collection(db, colName(m)), where('patientId', '==', pid), limit(200)));
        return [m.key, s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))];
      } catch { return [m.key, null]; }
    })).then((r) => { setData(Object.fromEntries(r)); setBusy(false); logAudit(profile, 'view patient chart', 'users', pid); });
  }, [pid, mods]);

  if (!pid) return (
    <>
      <div className="page-head"><h2>Patient Chart</h2></div>
      {err && <div className="alert">{err}</div>}
      <div className="card table-wrap"><table><thead><tr><th>Patient</th><th>Phone</th><th>Email</th><th /></tr></thead><tbody>
        {patients.map((p) => <tr key={p.id} className="clickable" onClick={() => nav(`/chart/${p.id}`)}><td>{p.name || p.email}</td><td>{p.phone}</td><td>{p.email}</td><td className="row-actions"><button className="link">Open chart</button></td></tr>)}
        {!patients.length && <tr><td colSpan={4} className="empty">{role === 'admin' ? 'No patients yet.' : 'No patients are assigned to you. An admin can assign them in Users & Roles.'}</td></tr>}
      </tbody></table></div>
    </>
  );

  const groups = [...new Set(mods.map((m) => m.group))];
  return (
    <>
      <div className="page-head">
        <h2>{patient?.name || 'Patient'} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>· full chart</span></h2>
        <div className="actions"><button className="btn ghost" onClick={() => nav('/chart')}>All patients</button><button className="btn ghost" onClick={() => window.print()}>Print</button></div>
      </div>
      {err && <div className="alert">{err}</div>}
      {patient && <div className="card"><dl className="detail">
        {[['Phone', patient.phone], ['Email', patient.email], ['Date of birth', patient.dob], ['Gender', patient.gender], ['Blood group', patient.bloodGroup], ['Known allergies', patient.knownAllergies], ['Emergency contact', [patient.emergencyContactName, patient.emergencyContactPhone].filter(Boolean).join(' · ')], ['Address', patient.address]]
          .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl></div>}
      {busy && <div className="skeleton" />}
      {groups.map((g) => {
        const withRows = mods.filter((m) => m.group === g && data[m.key]?.length);
        if (!withRows.length) return null;
        return <div key={g}><h3 style={{ margin: '20px 0 10px' }}>{g}</h3>{withRows.map((m) => {
          const cols = m.columns.map((c) => m.fields.find((f) => f.name === c)).filter((f) => f && f.name !== 'patientId');
          const files = m.fields.filter((f) => f.type === 'file');
          return (
            <div className="card chart-sec table-wrap" key={m.key}>
              <h3 style={{ padding: '14px 16px 0' }}>{m.label}<span className="muted" style={{ fontWeight: 400 }}>{data[m.key].length} record{data[m.key].length > 1 ? 's' : ''}</span></h3>
              <table><thead><tr>{cols.map((c) => <th key={c.name}>{c.label}</th>)}{files.map((f) => <th key={f.name}>{f.label}</th>)}<th>Date</th></tr></thead><tbody>
                {data[m.key].map((r) => <tr key={r.id}>
                  {cols.map((c) => <td key={c.name} style={{ whiteSpace: 'normal' }}>{cellValue(m, r, c.name)}</td>)}
                  {files.map((f) => <td key={f.name}>{r[f.name]?.dataUrl ? <a className="link" href={r[f.name].dataUrl} download={r[f.name].name} target="_blank" rel="noreferrer">Open</a> : ''}</td>)}
                  <td>{fmt(r.createdAt)}</td></tr>)}
              </tbody></table>
            </div>
          );
        })}</div>;
      })}
      {!busy && patient && !mods.some((m) => data[m.key]?.length) && <div className="card empty">No records yet for this patient.</div>}
    </>
  );
}
