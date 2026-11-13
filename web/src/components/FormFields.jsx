import { useState } from 'react';
import { optionsFor, isProviderRole } from '../config/modules';

// Renders the visible fields of a module for the current role. Hidden: selfFor fields and fields restricted via `roles`.
export const visibleFields = (fields, role) =>
  fields.filter((f) => (!f.roles || f.roles.includes(role)) && !(f.selfFor === role || (f.selfFor === 'doctor' && isProviderRole(role))) && !f.selfRole);

export default function FormFields({ fields, values, onChange, role, lists, original }) {
  const [uploading, setUploading] = useState('');

  const upload = async (f, file) => {
    if (!file) return;
    setUploading(f.name);
    try {
      // Firestore limits each document to 1 MiB. Keep the raw file small enough that
      // its base64 data URL plus the record metadata stays below that hard limit.
      if (file.size > 650 * 1024) return alert('Files stored in Firestore must be 650 KB or smaller.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read this file.'));
        reader.readAsDataURL(file);
      });
      onChange(f.name, { dataUrl, name: file.name, type: file.type, size: file.size });
    } catch (e) { alert(`Upload failed: ${e.message}`); }
    setUploading('');
  };

  return visibleFields(fields, role).map((f) => {
    const v = values[f.name] ?? '';
    const label = <label>{f.label}{f.required && <span className="req"> *</span>}</label>;
    let input;
    if (f.type === 'textarea') input = <textarea rows={3} value={v} onChange={(e) => onChange(f.name, e.target.value)} />;
    else if (f.type === 'select') {
      const opts = optionsFor(f, role, original);
      input = (
        <select value={v} onChange={(e) => onChange(f.name, e.target.value)}>
          <option value="">Select...</option>
          {opts.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    } else if (f.type === 'user') {
      input = (
        <select value={v} onChange={(e) => onChange(f.name, e.target.value)}>
          <option value="">Select {f.userRole}...</option>
          {(lists[f.userRole] || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      );
    } else if (f.type === 'checkbox') {
      input = <input type="checkbox" checked={!!values[f.name]} onChange={(e) => onChange(f.name, e.target.checked)} />;
    } else if (f.type === 'file') {
      input = (
        <div>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => upload(f, e.target.files[0])} />
          {uploading === f.name && <small> Uploading...</small>}
          {v?.dataUrl && <div><a href={v.dataUrl} download={v.name || 'document'} target="_blank" rel="noreferrer">View {v.name || 'uploaded file'}</a></div>}
        </div>
      );
    } else {
      const t = { number: 'number', date: 'date', time: 'time', datetime: 'datetime-local' }[f.type] || 'text';
      input = <input type={t} value={v} step={f.type === 'number' ? 'any' : undefined} onChange={(e) => onChange(f.name, e.target.value)} />;
    }
    return <div className="field" key={f.name}>{label}{input}</div>;
  });
}
