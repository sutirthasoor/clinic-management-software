import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ALERT_SOURCES, MODULES, computeAlerts, countBy, daysFromNow, isProviderRole, money, revenueByMonth, statusTone, todayStr } from '../config/modules';
import { cellValue, loadRows, logAudit, toast } from '../lib/data';
import { BarChart, HBars } from '../components/Charts';

const NEXT = { Requested: 'Confirmed', Confirmed: 'Checked-in', 'Checked-in': 'In consultation', 'In consultation': 'Completed' };
const M = (k) => MODULES.find((x) => x.key === k);
const KEYS = {
  admin: ['appointments', 'patients', 'payments', 'invoices', ...ALERT_SOURCES],
  doctor: ['appointments', 'queue', 'followUps', 'labResults', 'patients'],
  nutritionist: ['appointments', 'patients', 'nutritionAssessments', 'nutritionPlans', 'mealLogs'],
  yogaTeacher: ['appointments', 'patients', 'yogaPrograms', 'yogaSessions', 'practiceLogs'],
  naturopath: ['appointments', 'patients', 'naturopathyAssessments', 'naturopathyPlans', 'therapySessions'],
  patient: ['appointments', 'invoices', 'medReminders', 'followUps', 'immunizations', 'prescriptions'],
};

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const [d, setD] = useState(null);

  const load = async () => {
  const keys = KEYS[role] || [];
    const res = await Promise.all(keys.map((k) => loadRows(M(k), role, user.uid)));
    setD(Object.fromEntries(keys.map((k, i) => [k, res[i]])));
  };
  useEffect(() => { setD(null); load(); }, [role]);

  if (!d) return <div><h2>Welcome, {profile?.name}</h2><div className="stats">{[1, 2, 3, 4].map((i) => <div key={i} className="stat"><div className="skeleton" /></div>)}</div></div>;

  const today = todayStr();
  const appts = d.appointments || [];
  const active = appts.filter((a) => !['Cancelled', 'Completed', 'No-show'].includes(a.status));
  const upcoming = active.filter((a) => a.date >= today).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const todays = appts.filter((a) => a.date === today).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const month = today.slice(0, 7);
  const due = (d.invoices || []).filter((i) => ['Unpaid', 'Partial'].includes(i.status));
  const stat = (num, lbl, to) => <Link to={to} className="stat" key={lbl}><div className="num">{num}</div><div className="lbl">{lbl}</div></Link>;

  const advance = async (a) => {
    try {
      await updateDoc(doc(db, 'appointments', a.id), { status: NEXT[a.status], updatedAt: serverTimestamp(), updatedBy: user.uid });
      logAudit(profile, 'update', 'appointments', a.id); toast(`Marked ${NEXT[a.status]}`); load();
    } catch (e) { toast(e.message, 'bad'); }
  };

  const apptTable = (list, who, withAction) => list.length ? (
    <table>
      <thead><tr><th>Date</th><th>Time</th><th>{who === 'doctorId' ? 'Doctor' : 'Patient'}</th><th>Status</th>{withAction && <th />}</tr></thead>
      <tbody>
        {list.slice(0, 8).map((a) => (
          <tr key={a.id}>
            <td>{a.date}</td><td>{a.time}</td><td>{cellValue(M('appointments'), a, who)}</td>
            <td><span className={`pill ${statusTone(a.status)}`}>{a.status}</span></td>
            {withAction && <td className="row-actions">{NEXT[a.status] && <button className="link" onClick={() => advance(a)}>Mark {NEXT[a.status]}</button>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  ) : <p className="empty">Nothing scheduled.</p>;

  return (
    <div>
      <h2>Welcome, {profile?.name}</h2>

      {role === 'admin' && (() => {
        const alerts = computeAlerts(d);
        const rev = revenueByMonth(d.payments || []);
        return (
          <>
            <div className="stats">
              {stat(todays.length, "Today's appointments", '/m/appointments')}
              {stat(d.patients.length, 'Patients', '/m/patients')}
              {stat(money(rev[rev.length - 1].value), `Collected ${month}`, '/m/payments')}
              {stat(money(due.reduce((s, i) => s + (Number(i.total) || 0), 0)), `Unpaid invoices (${due.length})`, '/m/invoices')}
            </div>
            <div className="grid2">
              <div className="card"><h3>Revenue (6 months)</h3><BarChart data={rev} fmt={money} /></div>
              <div className="card"><h3>Appointments by status</h3><HBars data={countBy(appts, 'status')} /></div>
            </div>
            <div className="grid2">
              <div className="card"><h3>Alerts</h3>
                {alerts.length ? alerts.map((a) => <Link key={a.text} to={`/m/${a.link}`} className={`alert-row ${a.tone}`}>{a.text}</Link>) : <p className="empty">All clear.</p>}
              </div>
              <div className="card"><h3>Upcoming appointments</h3>{apptTable(upcoming, 'patientId')}</div>
            </div>
          </>
        );
      })()}

      {role === 'doctor' && (
        <>
          <div className="stats">
            {stat(todays.length, "Today's appointments", '/m/appointments')}
            {stat((d.queue || []).filter((q) => ['Waiting', 'Called'].includes(q.status)).length, 'Waiting in queue', '/m/queue')}
            {stat((d.followUps || []).filter((f) => f.status === 'Pending' && f.dueDate <= today).length, 'Follow-ups due', '/m/followUps')}
            {stat((d.labResults || []).filter((l) => ['Abnormal', 'Critical'].includes(l.flag)).length, 'Abnormal lab results', '/m/labResults')}
          </div>
          <div className="card"><h3>Today's schedule</h3>{apptTable(todays, 'patientId', true)}</div>
          <div className="card"><h3>Upcoming</h3>{apptTable(upcoming.filter((a) => a.date > today), 'patientId')}</div>
        </>
      )}

      {isProviderRole(role) && role !== 'doctor' && (() => {
        const configs = {
          nutritionist: {
            title: 'Nutrition sessions',
            stats: [stat(todays.length, "Today's sessions", '/m/appointments'), stat((d.nutritionPlans || []).filter((p) => p.status === 'Active').length, 'Active nutrition plans', '/m/nutritionPlans'), stat((d.nutritionAssessments || []).length, 'Client assessments', '/m/nutritionAssessments'), stat((d.mealLogs || []).length, 'Meal & hydration logs', '/m/mealLogs')],
            modules: [['nutritionAssessments', 'Nutrition assessments'], ['nutritionPlans', 'Nutrition plans'], ['mealLogs', 'Meal & hydration logs']],
          },
          yogaTeacher: {
            title: 'Yoga sessions',
            stats: [stat(todays.length, "Today's sessions", '/m/appointments'), stat((d.yogaPrograms || []).filter((p) => p.status === 'Active').length, 'Active yoga programs', '/m/yogaPrograms'), stat((d.yogaSessions || []).length, 'Session notes', '/m/yogaSessions'), stat((d.practiceLogs || []).length, 'Home practice logs', '/m/practiceLogs')],
            modules: [['yogaPrograms', 'Yoga programs'], ['yogaSessions', 'Session notes'], ['practiceLogs', 'Home practice logs']],
          },
          naturopath: {
            title: 'Naturopathy sessions',
            stats: [stat(todays.length, "Today's sessions", '/m/appointments'), stat((d.naturopathyPlans || []).filter((p) => p.status === 'Active').length, 'Active wellness plans', '/m/naturopathyPlans'), stat((d.naturopathyAssessments || []).length, 'Wellness assessments', '/m/naturopathyAssessments'), stat((d.therapySessions || []).length, 'Therapy session notes', '/m/therapySessions')],
            modules: [['naturopathyAssessments', 'Wellness assessments'], ['naturopathyPlans', 'Natural wellness plans'], ['therapySessions', 'Therapy session notes']],
          },
        }[role];
        return configs && <>
          <div className="stats">{configs.stats}</div>
          <div className="grid2">
            <div className="card"><h3>{configs.title}</h3>{apptTable(upcoming, 'patientId')}</div>
            <div className="card"><h3>Specialty workspace</h3>{configs.modules.map(([key, label]) => <Link key={key} to={`/m/${key}`} className="alert-row info">{label}<span className="workspace-count">{(d[key] || []).length}</span></Link>)}</div>
          </div>
        </>;
      })()}

      {role === 'patient' && (() => {
        const next = upcoming[0];
        const soon = [...(d.immunizations || []).filter((v) => v.nextDue).map((v) => ({ t: `Vaccine: ${v.vaccine}`, date: v.nextDue })),
          ...(d.followUps || []).filter((f) => f.status === 'Pending').map((f) => ({ t: `Follow-up: ${f.reason || 'visit'}`, date: f.dueDate }))]
          .filter((x) => x.date && daysFromNow(x.date) >= -7).sort((a, b) => a.date.localeCompare(b.date));
        return (
          <>
            <div className="stats">
              {stat(next ? `${next.date}` : '-', 'Next appointment', '/m/appointments')}
              {stat(money(due.reduce((s, i) => s + (Number(i.total) || 0), 0)), 'Amount due', '/m/invoices')}
              {stat((d.medReminders || []).filter((r) => r.active).length, 'Active medicine reminders', '/m/medReminders')}
              {stat((d.prescriptions || []).length, 'Prescriptions', '/m/prescriptions')}
            </div>
            <div className="grid2">
              <div className="card"><h3>Upcoming appointments</h3>{apptTable(upcoming, 'doctorId')}</div>
              <div className="card"><h3>Coming up</h3>
                {soon.length ? soon.slice(0, 6).map((x) => <div key={x.t + x.date} className="alert-row info">{x.t} — {x.date}</div>) : <p className="empty">Nothing due.</p>}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
