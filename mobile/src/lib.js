import { useEffect, useState } from 'react';
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import { hasField, doctorReadMode, isProviderRole } from './config/modules';

export const colName = (m) => m.source || m.key;
export const can = (m, role, ch) => (m.access?.[role] || '').includes(ch);

// Mirrors the generated Firestore rules so list queries are always permitted.
export function buildConstraints(m, role, uid) {
  const c = [];
  if (m.where) c.push(where(...m.where));
  if (m.source === 'users' && isProviderRole(role) && m.where?.[2] === 'patient') c.push(where('primaryProviderId', '==', uid));
  if (!m.source && role === 'patient' && hasField(m, 'patientId')) c.push(where('patientId', '==', uid));
  if (!m.source && isProviderRole(role) && doctorReadMode(m) === 'own') c.push(where('doctorId', '==', uid));
  return c;
}

export function fmt(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().toLocaleDateString();
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return v === undefined || v === null ? '' : String(v);
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

export const visibleFields = (fields, role) =>
  fields.filter((f) => (!f.roles || f.roles.includes(role)) && !(f.selfFor === role || (f.selfFor === 'doctor' && isProviderRole(role))) && !f.selfRole);

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
        if (alive) setLists((p) => ({ ...p, [r]: s.docs.map((d) => ({ id: d.id, name: d.data().name || d.data().email })) }));
      } catch { /* not permitted */ }
    });
    return () => { alive = false; };
  }, [key]);
  return lists;
}

export async function loadRows(m, role, uid, max = 300) {
  try {
    const s = await getDocs(query(collection(db, colName(m)), ...buildConstraints(m, role, uid), limit(max)));
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

export async function fetchClinic() {
  try { const s = await getDocs(query(collection(db, 'settings'), limit(1))); return s.docs[0]?.data() || {}; } catch { return {}; }
}
