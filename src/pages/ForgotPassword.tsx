import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import { api } from '../services/api';

/** Two modes in one page: request a reset link, or (with ?token=) choose a new password. */
export default function ForgotPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [devLink, setDevLink] = useState('');

  const request = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const r = await api<{ message: string; devResetLink?: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage(r.message); if (r.devResetLink) setDevLink(r.devResetLink);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send the reset link.'); } finally { setBusy(false); }
  };
  const reset = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setError('');
    if (password !== confirm) { setError('Your passwords do not match.'); return; }
    setBusy(true);
    try { const r = await api<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) }); setMessage(r.message); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reset the password.'); } finally { setBusy(false); }
  };

  return (
    <div className="auth-shell" style={{ gridTemplateColumns: '1fr' }}>
      <main className="auth-form-side">
        <div className="auth-form-card">
          <Link to="/" className="brand" style={{ marginBottom: 28 }}><span className="brand-mark"><Globe2 size={20} /></span><span>lingua<span className="brand-accent">meet</span></span></Link>
          <h2>{token ? 'Choose a new password' : 'Reset your password'}</h2>
          <p className="auth-form-description">{token ? 'Use at least 8 characters.' : 'Enter your account e-mail and we will create a reset link.'}</p>
          {error && <div role="alert" className="auth-error">{error}</div>}
          {message && <div role="status" className="auth-success">{message}</div>}
          {devLink && <p className="small-note">Development mode — no mail server is connected. Use this link: <a href={devLink}>{devLink}</a></p>}
          {!message && (token ? (
            <form onSubmit={reset} className="auth-form">
              <label>New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
              <label>Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
              <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'} <ArrowRight size={16} /></button>
            </form>
          ) : (
            <form onSubmit={request} className="auth-form">
              <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></label>
              <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'} <ArrowRight size={16} /></button>
            </form>
          ))}
          <p className="auth-switch auth-switch-single"><Link to="/login">Back to sign in</Link></p>
        </div>
      </main>
    </div>
  );
}
