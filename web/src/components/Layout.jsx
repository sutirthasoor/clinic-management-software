import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import { menuFor } from '../config/modules';
import { navIcon } from '../lib/icons';
import Toaster from './Toaster';
import { toast } from '../lib/data';

const IDLE_MS = 15 * 60 * 1000; // auto sign-out after 15 minutes of inactivity (PHI protection)
const ROLE_LABEL = { admin: 'Administrator', doctor: 'Doctor', nutritionist: 'Nutritionist', yogaTeacher: 'Yoga teacher', naturopath: 'Naturopath', patient: 'Patient' };
const SB_MODES = [['expanded', 'Expanded'], ['icons', 'Collapsed'], ['hover', 'Expand on hover']];
const THEMES = [['light', 'Light', 'solar:sun-linear'], ['dark', 'Dark', 'solar:moon-linear'], ['system', 'System', 'solar:monitor-linear']];

function applyTheme(t) {
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', t);
}

export default function Layout() {
  const { profile, user, role, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(localStorage.getItem('sbMode') || 'expanded');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [closed, setClosed] = useState({});
  const [pop, setPop] = useState(false);
  const [dd, setDd] = useState(''); // '' | 'theme' | 'me'
  const [cmd, setCmd] = useState(false);
  const [q, setQ] = useState('');
  const timer = useRef();
  const groups = menuFor(role);
  const canChart = role === 'admin' || role === 'doctor';

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { localStorage.setItem('sbMode', mode); }, [mode]);
  useEffect(() => { setOpen(false); setDd(''); }, [loc.pathname]);

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

  useEffect(() => {
    const k = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v); setQ(''); } if (e.key === 'Escape') { setCmd(false); setDd(''); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);

  const items = useMemo(() => [
    { label: 'Dashboard', to: '/', icon: navIcon('dashboard') },
    ...(canChart ? [{ label: 'Patient Chart', to: '/chart', icon: navIcon('chart') }] : []),
    ...groups.flatMap(([g, list]) => list.map((m) => ({ label: m.label, group: g, to: m.custom ? `/${m.key}` : `/m/${m.key}`, icon: navIcon(m.key) }))),
  ], [role]);
  const hits = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const initials = (profile?.name || 'U').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const curTheme = THEMES.find((t) => t[0] === theme) || THEMES[0];
  const link = (i, sub) => <NavLink key={i.to} to={i.to} end={i.to === '/'} className={sub ? 'sub' : ''} title={i.label}><Icon icon={i.icon} className="ox-ico" /><span className="txt">{i.label}</span></NavLink>;

  return (
    <div className="shell" data-sb={mode}>
      {open && <div className="ox-scrim ox-mobile-only" onClick={() => setOpen(false)} />}
      <aside className={`ox-sidebar ${open ? 'open' : ''}`}>
        <div className="ox-brand">
          <img src="/logo-s-white.svg" alt="" />
          <div className="txt"><p>ClinicCare</p><small>Care management</small></div>
          <button className="ox-icon-btn ox-mobile-only" style={{ marginLeft: 'auto', color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close menu"><Icon icon="solar:close-circle-linear" /></button>
        </div>
        <nav className="ox-nav">
          <div>{link({ label: 'Dashboard', to: '/', icon: navIcon('dashboard') })}{canChart && link({ label: 'Patient Chart', to: '/chart', icon: navIcon('chart') })}</div>
          {groups.map(([g, list]) => (
            <div key={g}>
              <button className={`ox-grouphead ${closed[g] ? 'closed' : ''}`} onClick={() => setClosed({ ...closed, [g]: !closed[g] })}>
                <span className="lbl txt">{g}</span><Icon icon="solar:alt-arrow-down-linear" className="chev txt" />
              </button>
              {(!closed[g] || mode !== 'expanded') && list.map((m) => link({ label: m.label, to: m.custom ? `/${m.key}` : `/m/${m.key}`, icon: navIcon(m.key) }, mode === 'expanded'))}
            </div>
          ))}
        </nav>
        <div className="ox-sb-foot" style={{ display: undefined }}>
          <button className="ox-sb-btn ox-desktop" onClick={() => setPop(!pop)} aria-label="Sidebar control"><Icon icon="solar:sidebar-minimalistic-linear" style={{ fontSize: 16 }} /></button>
          {pop && <div className="ox-pop"><h6>Sidebar control</h6>{SB_MODES.map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setPop(false); }}><i />{l}</button>)}</div>}
        </div>
      </aside>

      <div className="ox-main">
        <header className="ox-top">
          <button className="ox-icon-btn ox-mobile-only" onClick={() => setOpen(true)} aria-label="Menu"><Icon icon="solar:hamburger-menu-linear" /></button>
          <button className="ox-search" onClick={() => { setCmd(true); setQ(''); }} aria-label="Search">
            <Icon icon="solar:magnifer-linear" style={{ fontSize: 16 }} /><span>Search…</span><kbd className="ox-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <div className="ox-spacer" />
          <div className="ox-dd">
            <button className="ox-chip" onClick={() => setDd(dd === 'theme' ? '' : 'theme')}><Icon icon={curTheme[2]} style={{ fontSize: 14 }} /><span className="txt">{curTheme[1]}</span><Icon icon="solar:alt-arrow-down-linear" style={{ fontSize: 12 }} /></button>
            {dd === 'theme' && <div className="ox-menu">{THEMES.map(([k, l, ic]) => <button key={k} onClick={() => { setTheme(k); setDd(''); }}><Icon icon={ic} className="ox-ico" />{l}</button>)}</div>}
          </div>
          <button className="ox-icon-btn" aria-label="Notifications" onClick={() => nav(role === 'patient' ? '/m/announcements' : '/m/messages')}><Icon icon="solar:bell-linear" /></button>
          <div className="ox-dd">
            <button className="ox-me" onClick={() => setDd(dd === 'me' ? '' : 'me')}>
              <span className="avatar">{initials}</span>
              <div><strong>{profile?.name}</strong><small>{ROLE_LABEL[role] || role}</small></div>
              <Icon icon="solar:alt-arrow-down-linear" style={{ fontSize: 13, color: 'var(--text-muted)' }} />
            </button>
            {dd === 'me' && <div className="ox-menu" style={{ minWidth: 200 }}>
              <div className="head"><p>{profile?.name}</p><p>{user?.email}</p></div>
              <button onClick={() => nav('/profile')}><Icon icon="solar:user-linear" className="ox-ico" />My profile</button>
              <button onClick={logout}><Icon icon="solar:logout-2-linear" className="ox-ico" />Sign out</button>
            </div>}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {cmd && (
        <div className="ox-cmd-bg" onClick={() => setCmd(false)}>
          <div className="ox-cmd" onClick={(e) => e.stopPropagation()}>
            <input autoFocus placeholder="Jump to a page…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) { nav(hits[0].to); setCmd(false); } }} />
            <ul>{hits.map((h) => <li key={h.to} onClick={() => { nav(h.to); setCmd(false); }}><Icon icon={h.icon} className="ox-ico" /><span style={{ flex: 1 }}>{h.label}</span><small className="muted">{h.group}</small></li>)}{!hits.length && <li className="muted">No matches</li>}</ul>
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}
