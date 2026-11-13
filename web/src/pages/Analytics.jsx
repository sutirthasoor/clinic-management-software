import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MODULES, countBy, money, revenueByMonth } from '../config/modules';
import { loadRows } from '../lib/data';
import { BarChart, HBars } from '../components/Charts';

const M = (k) => MODULES.find((x) => x.key === k);

export default function Analytics() {
  const { user, role } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => {
    const keys = ['appointments', 'payments', 'invoices', 'feedback', 'labOrders'];
    Promise.all(keys.map((k) => loadRows(M(k), role, user.uid, 1000))).then((r) => setD(Object.fromEntries(keys.map((k, i) => [k, r[i]]))));
  }, []);
  if (!d) return <p>Loading analytics...</p>;

  const a = d.appointments;
  const done = a.filter((x) => x.status === 'Completed').length;
  const noShow = a.filter((x) => x.status === 'No-show').length;
  const closed = done + noShow + a.filter((x) => x.status === 'Cancelled').length;
  const byDoc = countBy(a.filter((x) => x.status === 'Completed').map((x) => ({ n: x.doctorIdName || x.doctorId })), 'n');
  const ratings = d.feedback.map((f) => Number(f.rating)).filter(Boolean);
  const billed = d.invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const collected = d.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const modes = d.payments.reduce((o, p) => { const k = p.mode || 'Other'; o[k] = (o[k] || 0) + (Number(p.amount) || 0); return o; }, {});

  return (
    <div>
      <h2>Analytics</h2>
      <div className="stats">
        <div className="stat"><div className="num">{a.length}</div><div className="lbl">Appointments</div></div>
        <div className="stat"><div className="num">{closed ? Math.round((noShow / closed) * 100) : 0}%</div><div className="lbl">No-show rate</div></div>
        <div className="stat"><div className="num">{billed ? Math.round((collected / billed) * 100) : 0}%</div><div className="lbl">Collection rate</div></div>
        <div className="stat"><div className="num">{ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : '-'}</div><div className="lbl">Avg patient rating</div></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Revenue, last 12 months</h3><BarChart data={revenueByMonth(d.payments, 12)} fmt={money} /></div>
        <div className="card"><h3>Collections by payment mode</h3><HBars data={Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, Math.round(v)]))} /></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Completed visits by doctor</h3><HBars data={byDoc} /></div>
        <div className="card"><h3>Appointments by type</h3><HBars data={countBy(a, 'type')} /></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Invoices by status</h3><HBars data={countBy(d.invoices, 'status')} /></div>
        <div className="card"><h3>Lab orders by priority</h3><HBars data={countBy(d.labOrders, 'priority')} /></div>
      </div>
      <p className="muted">Based on up to 1,000 most recent records per collection. For long-range reporting, schedule a BigQuery export (see README).</p>
    </div>
  );
}
