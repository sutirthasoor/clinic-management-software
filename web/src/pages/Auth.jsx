import { useState } from 'react';
import { Icon } from '@iconify/react';
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

  const title = mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create patient account' : 'Reset password';
  const sub = mode === 'login' ? 'Enter your credentials to continue.' : mode === 'register' ? 'Create an account to manage your care.' : 'We’ll email you a link to reset your password.';
  const Field = ({ id, label, icon, right, children }) => (
    <div className="ox-f"><div className="row"><label htmlFor={id}>{label}</label>{right}</div><div className="ox-in"><Icon icon={icon} className="ox-ico" />{children}</div></div>
  );
  return (
    <div className="ox-auth">
      <img src="/steel-bg.png" alt="" aria-hidden="true" />
      <div className="ox-auth-card">
        <div className="ox-auth-panel">
          <svg aria-hidden="true"><defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="var(--auth-panel-fg)" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          <div />
          <div><h1>Better care,<br />connected.</h1><p>Appointments, records, nutrition, yoga and naturopathy care - all in one place.</p></div>
          <p className="copy">© {new Date().getFullYear()} ClinicCare</p>
        </div>
        <div className="ox-auth-form">
          <div className="ox-auth-lock"><img src="/logo-s-black.svg" alt="" /><div><p>ClinicCare</p><small>Care management</small></div></div>
          <div className="ox-auth-body"><div>
            <h2>{title}</h2><p className="sub">{sub}</p>
            <form onSubmit={submit} noValidate>
              {mode === 'register' && <Field id="auth-name" label="Full name" icon="solar:user-linear"><input id="auth-name" autoComplete="name" required value={f.name} onChange={set('name')} placeholder="Your name" /></Field>}
              <Field id="auth-email" label="Email address" icon="solar:letter-linear"><input id="auth-email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} placeholder="you@example.com" /></Field>
              {mode === 'register' && <Field id="auth-phone" label="WhatsApp number" icon="solar:phone-linear"><input id="auth-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="Include country code" /></Field>}
              {mode !== 'reset' && <Field id="auth-password" label="Password" icon="solar:lock-password-linear" right={mode === 'login' && <button type="button" className="ox-link" onClick={() => { setMode('reset'); setMsg(''); }}>Forgot password?</button>}>
                <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required value={f.password} onChange={set('password')} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}><Icon icon={showPassword ? 'solar:eye-closed-linear' : 'solar:eye-linear'} /></button>
              </Field>}
              {msg && <div className={`ox-msg ${msg.includes('sent') ? 'ok' : ''}`} role="alert"><Icon icon={msg.includes('sent') ? 'solar:check-circle-linear' : 'solar:shield-warning-bold'} />{msg}</div>}
              <button className="ox-cta" type="submit" disabled={busy}>{busy && <Icon icon="solar:refresh-bold" className="spin" />}{busy ? 'Please wait…' : mode === 'login' ? 'Sign in →' : mode === 'register' ? 'Create account →' : 'Send reset link →'}</button>
            </form>
            <div className="ox-auth-foot">
              {mode === 'login' ? <button type="button" className="ox-link" onClick={() => { setMode('register'); setMsg(''); }}>New patient? Create an account</button> : <button type="button" className="ox-link" onClick={() => { setMode('login'); setMsg(''); }}>← Back to sign in</button>}
              <small>Practitioner and administrator accounts are set up by your clinic.</small>
            </div>
          </div></div>
        </div>
      </div>
    </div>
  );
}
