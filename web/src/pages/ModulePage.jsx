import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MODULES, PRINTABLE, applyComputed, isProviderRole, printableHtml, statusFieldOf, statusTone, validateValues } from '../config/modules';
import { buildConstraints, can, cellValue, colName, fetchClinic, fmt, logAudit, openPrint, toCsv, toast, useUserLists } from '../lib/data';
import FormFields, { visibleFields } from '../components/FormFields';

const PAGE = 25;

export default function ModulePage() {
  const { key } = useParams();
  const { user, profile, role } = useAuth();
  const baseModule = MODULES.find((x) => x.key === key);
  const m = baseModule ? { ...baseModule, label: baseModule.roleLabels?.[role] || baseModule.label } : null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState({ name: '', dir: 1 });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null); // { id?, values, original? }
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lists = useUserLists(m?.fields || [], role, user.uid);
  const sf = m && statusFieldOf(m);

  useEffect(() => {
    setRows([]); setError(''); setEditing(null); setViewing(null); setSearch(''); setFilter(''); setSort({ name: '', dir: 1 }); setPage(0); setLoading(true);
    if (!m || !can(m, role, 'r')) return;
    const q = query(collection(db, colName(m)), ...buildConstraints(m, role, user.uid), limit(500));
    return onSnapshot(q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setRows(data); setLoading(false);
      },
      (e) => { setError(e.message); setLoading(false); });
  }, [key, role]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let r = rows;
    if (filter && sf) r = r.filter((x) => x[sf.name] === filter);
    if (s) r = r.filter((x) => JSON.stringify(x).toLowerCase().includes(s));
    if (sort.name && m) {
      const f = m.fields.find((x) => x.name === sort.name);
      r = [...r].sort((a, b) => {
        const A = f?.type === 'number' ? Number(a[sort.name]) || 0 : String(cellValue(m, a, sort.name)).toLowerCase();
        const B = f?.type === 'number' ? Number(b[sort.name]) || 0 : String(cellValue(m, b, sort.name)).toLowerCase();
        return (A > B ? 1 : A < B ? -1 : 0) * sort.dir;
      });
    }
    return r;
  }, [rows, search, filter, sort, key]);

  useEffect(() => setPage(0), [search, filter, sort]);

  if (!m || !can(m, role, 'r')) return <p>You do not have access to this module.</p>;

  const canCreate = can(m, role, 'c') && !m.source;
  const ownRow = (r) => !m.fields.some((f) => f.name === 'doctorId') || !isProviderRole(role) || r.doctorId === user.uid;
  const canEdit = (r) => can(m, role, 'u') && ownRow(r);
  const canDelete = (r) => can(m, role, 'd') && ownRow(r);
  const printable = PRINTABLE.includes(m.key);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const view = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const openNew = () => {
    const values = {};
    m.fields.forEach((f) => { if (f.default !== undefined) values[f.name] = f.default; });
    setEditing({ values });
  };

  const save = async () => {
    const v = applyComputed(m, editing.values);
    const problem = validateValues(m, role, v);
    if (problem) return setError(problem);
    setError(''); setSaving(true);
    const payload = {};
    for (const f of visibleFields(m.fields, role)) {
      let val = v[f.name];
      if (f.type === 'number' && val !== '' && val != null) val = Number(val);
      if (f.type === 'checkbox') val = !!val;
      payload[f.name] = val ?? '';
      if (f.type === 'user') payload[`${f.name}Name`] = (lists[f.userRole] || []).find((u) => u.id === val)?.name || '';
    }
    m.fields.forEach((f) => {
      if (f.selfFor === role || (f.selfFor === 'doctor' && isProviderRole(role))) { payload[f.name] = user.uid; payload[`${f.name}Name`] = profile.name || ''; }
      else if (f.selfRole) payload[f.name] = role;
      else if (!editing.id && f.roles && !f.roles.includes(role) && f.default !== undefined) payload[f.name] = f.default;
    });
    try {
      if (editing.id) {
        await updateDoc(doc(db, colName(m), editing.id), { ...payload, updatedAt: serverTimestamp(), updatedBy: user.uid });
        logAudit(profile, 'update', colName(m), editing.id);
      } else {
        const r = await addDoc(collection(db, colName(m)), { ...payload, createdBy: user.uid, createdAt: serverTimestamp() });
        logAudit(profile, 'create', colName(m), r.id);
      }
      setEditing(null); toast('Saved');
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const remove = async (r) => {
    if (!confirm('Delete this record permanently? This action is audit-logged.')) return;
    try { await deleteDoc(doc(db, colName(m), r.id)); logAudit(profile, 'delete', colName(m), r.id); setViewing(null); toast('Deleted'); }
    catch (e) { toast(e.message, 'bad'); }
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(m, filtered)], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${m.key}.csv`; a.click(); URL.revokeObjectURL(url);
    logAudit(profile, 'export', colName(m), `${filtered.length} rows`);
  };

  const printRow = async (r) => { openPrint(printableHtml(m, r, await fetchClinic())); logAudit(profile, 'print', colName(m), r.id); };
  const cols = m.columns.map((c) => m.fields.find((f) => f.name === c)).filter(Boolean);
  const sortBy = (name) => setSort((p) => ({ name, dir: p.name === name ? -p.dir : 1 }));
  const cell = (r, c) => {
    const v = cellValue(m, r, c.name);
    return c.type === 'select' && STATUS(c) ? <span className={`pill ${statusTone(v)}`}>{String(v)}</span> : String(v);
  };
  const STATUS = (c) => c === sf || ['status', 'priority', 'flag', 'severity', 'urgency'].includes(c.name);

  return (
    <div>
      <div className="page-head">
        <h2>{m.label} <small className="muted">({filtered.length})</small></h2>
        <div className="actions">
          <input className="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {role !== 'patient' && <button className="btn ghost" onClick={exportCsv} disabled={!filtered.length}>Export CSV</button>}
          {canCreate && <button className="btn" onClick={openNew}>+ New</button>}
        </div>
      </div>
      {sf && (
        <div className="chips">
          {['', ...sf.options].map((o) => <button key={o || 'all'} className={`chip ${filter === o ? 'on' : ''}`} onClick={() => setFilter(o)}>{o || 'All'}</button>)}
        </div>
      )}
      {error && !editing && <div className="alert">{error}</div>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => <th key={c.name} className="sortable" onClick={() => sortBy(c.name)}>{c.label}{sort.name === c.name ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>)}
              <th>Created</th><th />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <tr key={i}><td colSpan={cols.length + 2}><div className="skeleton" /></td></tr>)}
            {!loading && view.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => setViewing(r)}>
                {cols.map((c) => <td key={c.name}>{cell(r, c)}</td>)}
                <td>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : ''}</td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  {printable && <button className="link" onClick={() => printRow(r)}>Print</button>}
                  {m.key === 'patients' && r.phone && <a className="link" href={`https://wa.me/${String(r.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${r.name || 'there'}, this is your clinic.`)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {m.key === 'patients' && r.email && <a className="link" href={`mailto:${r.email}?subject=${encodeURIComponent('Message from your clinic')}`}>Email</a>}
                  {canEdit(r) && <button className="link" onClick={() => setEditing({ id: r.id, values: { ...r }, original: r })}>Edit</button>}
                  {canDelete(r) && <button className="link danger" onClick={() => remove(r)}>Delete</button>}
                </td>
              </tr>
            ))}
            {!loading && !filtered.length && <tr><td colSpan={cols.length + 2} className="empty">No records found.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {viewing && (
        <div className="modal-bg" onClick={() => setViewing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{m.label}</h3>
            <dl className="detail">
              {m.fields.filter((f) => !f.selfRole && viewing[f.name] !== undefined && viewing[f.name] !== '').map((f) => (
                <div key={f.name}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.type === 'file' ? (viewing[f.name]?.dataUrl ? <a href={viewing[f.name].dataUrl} download={viewing[f.name].name || 'document'} target="_blank" rel="noreferrer">Open {viewing[f.name].name || 'file'}</a> : 'No file attached')
                      : STATUS(f) && f.type === 'select' ? <span className={`pill ${statusTone(viewing[f.name])}`}>{viewing[f.name]}</span>
                        : <span style={{ whiteSpace: 'pre-wrap' }}>{f.type === 'user' ? cellValue(m, viewing, f.name) : String(fmt(viewing[f.name]))}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="modal-actions">
              {printable && <button className="btn ghost" onClick={() => printRow(viewing)}>Print / PDF</button>}
              {canEdit(viewing) && <button className="btn ghost" onClick={() => { setEditing({ id: viewing.id, values: { ...viewing }, original: viewing }); setViewing(null); }}>Edit</button>}
              <button className="btn" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-bg" onClick={() => !saving && setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit' : 'New'} {m.label}</h3>
            {error && <div className="alert">{error}</div>}
            <div className="form-grid">
              <FormFields fields={m.fields} role={role} lists={lists} values={editing.values} original={editing.original}
                onChange={(n, val) => setEditing((p) => ({ ...p, values: applyComputed(m, { ...p.values, [n]: val }) }))} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
