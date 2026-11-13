import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const { login, register, reset } = useAuth();
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      if (mode === 'login') await login(f.email, f.password);
      else if (mode === 'register') await register(f);
      else { await reset(f.email); setMsg('Password reset email sent.'); }
    } catch (err) { setMsg((err.message || 'Could not complete request.').replace('Firebase: ', '')); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <img className="auth-backdrop" src="/steel-bg.png" alt="" aria-hidden="true" />
      <div className="auth-overlay" />
      <section className="auth-frame">
        <div className="auth-brand-panel">
          <svg className="auth-grid" aria-hidden="true">
            <defs><pattern id="clinicGrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#clinicGrid)" />
          </svg>
          <div className="auth-brand-spacer" />
          <div className="auth-promise">
            <div className="auth-symbol" aria-hidden="true">✚</div>
            <h1>Better care,<br />connected.</h1>
            <p>Support every patient journey with thoughtful care, clear records, and coordinated wellness sessions.</p>
          </div>
          <p className="auth-copyright">© {new Date().getFullYear()} ClinicCare</p>
        </div>

        <div className="auth-form-panel">
          <div className="auth-brand-lockup">
            <span className="auth-logo-mark" aria-hidden="true">✚</span>
            <div><strong>ClinicCare</strong><small>Care management</small></div>
          </div>
          <div className="auth-form-body">
            <div className="auth-heading">
              <h2>{mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create patient account' : 'Reset password'}</h2>
              <p>{mode === 'login' ? 'Enter your credentials to continue.' : mode === 'register' ? 'Create an account to manage your care.' : 'We’ll email you a link to reset your password.'}</p>
            </div>

            <form onSubmit={submit} className="auth-form" noValidate>
              {mode === 'register' && <div className="auth-field"><label htmlFor="auth-name">Full name</label><div className="auth-input-wrap"><span className="auth-input-icon">♙</span><input id="auth-name" autoComplete="name" required value={f.name} onChange={set('name')} placeholder="Your name" /></div></div>}
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <div className="auth-input-wrap"><span className="auth-input-icon">✉</span><input id="auth-email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} placeholder="you@example.com" /></div>
              </div>
              {mode === 'register' && <div className="auth-field"><label htmlFor="auth-phone">Phone number</label><div className="auth-input-wrap"><span className="auth-input-icon">⌕</span><input id="auth-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="Include country code" /></div></div>}
              {mode !== 'reset' && <div className="auth-field">
                <div className="auth-label-row"><label htmlFor="auth-password">Password</label>{mode === 'login' && <button type="button" className="auth-text-button" onClick={() => { setMode('reset'); setMsg(''); }}>Forgot password?</button>}</div>
                <div className="auth-input-wrap"><span className="auth-input-icon">▣</span><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={f.password} onChange={set('password')} placeholder="••••••••" /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? '◉' : '◎'}</button></div>
              </div>}

              {msg && <div className={`auth-message ${msg.includes('sent') ? 'success' : 'error'}`} role="alert">{msg}</div>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy && <span className="auth-spinner" aria-hidden="true" />}
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in  →' : mode === 'register' ? 'Create account  →' : 'Send reset link  →'}
              </button>
            </form>

            <div className="auth-footer-links">
              {mode === 'login' ? <button type="button" className="auth-text-button" onClick={() => { setMode('register'); setMsg(''); }}>New patient? Create an account</button> : <button type="button" className="auth-text-button" onClick={() => { setMode('login'); setMsg(''); }}>← Back to sign in</button>}
            </div>
            <p className="auth-staff-note">Practitioner and administrator accounts are set up by your clinic.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
