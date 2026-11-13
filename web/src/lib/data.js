import { useEffect, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { hasField, doctorReadMode, isProviderRole } from '../config/modules';

export const colName = (m) => m.source || m.key;
export const can = (m, role, ch) => (m.access?.[role] || '').includes(ch);

// Query constraints that mirror the generated security rules (so list queries are always allowed).
export function buildConstraints(m, role, uid) {
  const c = [];
  if (m.where) c.push(where(...m.where));
  if (m.source === 'users' && isProviderRole(role) && m.where?.[2] === 'patient') c.push(where('primaryProviderId', '==', uid));
  if (!m.source && role === 'patient' && hasField(m, 'patientId')) c.push(where('patientId', '==', uid));
  if (!m.source && isProviderRole(role) && doctorReadMode(m) === 'own') c.push(where('doctorId', '==', uid));
  return c;
}

export function fmt(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().toLocaleString();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return v ?? '';
}

export const cellValue = (m, row, name) => {
  const f = m.fields.find((x) => x.name === name);
  if (f?.type === 'user') return row[`${name}Name`] || row[name] || '';
  return fmt(row[name]);
};

export function logAudit(profile, action, collectionName, docId) {
  addDoc(collection(db, 'auditLogs'), {
    uid: profile.id, userName: profile.name || '', role: profile.role, action, collection: collectionName, docId,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

// Loads the user lists needed to render "user" select fields (e.g. all doctors, all patients).
export function useUserLists(fields, role, uid) {
  const needed = [...new Set(
    fields.filter((f) => f.type === 'user' && f.selfFor !== role && (!f.roles || f.roles.includes(role))).map((f) => f.userRole),
  )];
  const key = needed.join(',');
  const [lists, setLists] = useState({});
  useEffect(() => {
    let alive = true;
    needed.forEach(async (r) => {
      try {
        const providerRoles = ['doctor', 'nutritionist', 'yogaTeacher', 'naturopath'];
        const clauses = [where('role', r === 'doctor' ? 'in' : '==', r === 'doctor' ? providerRoles : r)];
        if (isProviderRole(role) && r === 'patient') clauses.push(where('primaryProviderId', '==', uid));
        const s = await getDocs(query(collection(db, 'users'), ...clauses));
        if (alive) setLists((p) => ({ ...p, [r]: s.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().email, role: d.data().role })) }));
      } catch { /* not permitted for this role */ }
    });
    return () => { alive = false; };
  }, [key]);
  return lists;
}

export function toCsv(m, rows) {
  const cols = m.columns.map((c) => m.fields.find((f) => f.name === c)).filter(Boolean);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => esc(c.label)).join(',')];
  rows.forEach((r) => lines.push(cols.map((c) => esc(cellValue(m, r, c.name))).join(',')));
  return lines.join('\n');
}

// ---- enterprise additions
import { getDocs as _getDocs, limit as _limit, query as _query, collection as _collection } from 'firebase/firestore';

export function toast(msg, type = 'ok') { window.dispatchEvent(new CustomEvent('toast', { detail: { msg, type } })); }

export async function loadRows(m, role, uid, max = 500) {
  try {
    const s = await _getDocs(_query(_collection(db, colName(m)), ...buildConstraints(m, role, uid), _limit(max)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function fetchClinic() {
  try { const s = await _getDocs(_query(_collection(db, 'settings'), _limit(1))); return s.docs[0]?.data() || {}; } catch { return {}; }
}

export function openPrint(html) {
  const w = window.open('', '_blank');
  if (!w) return toast('Allow pop-ups to print documents', 'bad');
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
