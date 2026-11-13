import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { menuFor } from '../config/modules';
import Toaster from './Toaster';
import { toast } from '../lib/data';

const IDLE_MS = 15 * 60 * 1000; // auto sign-out after 15 minutes of inactivity (PHI protection)
const navIcon = (key) => ({ appointments:'▦', patients:'♙', doctors:'✚', analytics:'▥', timeline:'◷', users:'⚿', queue:'☷', consultations:'▤', prescriptions:'✚', labOrders:'⌕', labResults:'⌁', documents:'▱', messages:'✉', schedules:'▦', followUps:'↻', vitals:'♡', invoices:'▤', payments:'＄', nutritionAssessments:'◉', nutritionPlans:'▤', mealLogs:'◷', yogaPrograms:'⌘', yogaSessions:'◷', practiceLogs:'☼', naturopathyAssessments:'◉', naturopathyPlans:'♧', therapySessions:'◷' }[key] || '◦');

export default function Layout() {
  const { profile, role, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const timer = useRef();
  const groups = menuFor(role);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => setOpen(false), [loc.pathname]);

  useEffect(() => {
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { toast('Signed out due to inactivity', 'bad'); logout(); }, IDLE_MS);
    };
    const evs = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { evs.forEach((e) => window.removeEventListener(e, reset)); clearTimeout(timer.current); };
  }, []);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark">✚</span><span className="brand-copy"><strong>ClinicCare</strong><small>Care management</small></span></div>
        <nav>
          <NavLink to="/" end><span className="nav-icon">⌂</span>Dashboard</NavLink>
          {groups.map(([g, list]) => (
            <div key={g}>
              <div className="group">{g}</div>
              {list.map((m) => <NavLink key={m.key} to={m.custom ? `/${m.key}` : `/m/${m.key}`}><span className="nav-icon">{navIcon(m.key)}</span>{m.label}</NavLink>)}
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="btn ghost menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <div className="global-search"><span>⌕</span><input placeholder="Search patients, appointments…" aria-label="Search" /></div>
          <div className="actions">
            <button className="btn ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <button className="icon-btn" aria-label="Notifications">🔔</button>
            <button className="who" onClick={() => nav('/profile')}>
              <span className="avatar">{(profile?.name || 'U').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
              <span className="who-copy"><strong>{profile?.name}</strong><small>{role === 'yogaTeacher' ? 'Yoga teacher' : role}</small></span>
              <span className="chevron">⌄</span>
            </button>
            <button className="btn ghost signout" onClick={logout}>Sign out</button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      <Toaster />
    </div>
  );
}
