import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, type Session, setAccessToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguages } from '../../hooks/useMeta';
import type { AppUser } from '../../types';

/** Profile (name, default caption language) and password change; both call real endpoints. */
export default function ProfileSettings() {
  const { user, setUser, logout } = useAuth();
  const languages = useLanguages();
  const [name, setName] = useState(user?.name || '');
  const [lang, setLang] = useState(user?.preferredLanguage || 'en');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [current, setCurrent] = useState(''); const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault(); if (savingProfile) return; setSavingProfile(true); setProfileMsg(null);
    try {
      const r = await api<{ user: AppUser }>('/auth/me', { method: 'PATCH', body: JSON.stringify({ name, preferredLanguage: lang }) });
      setUser(r.user); setProfileMsg({ ok: true, text: 'Profile saved.' });
    } catch (err) { setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save profile.' }); }
    finally { setSavingProfile(false); }
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault(); if (savingPw) return; setSavingPw(true); setPwMsg(null);
    try {
      const s = await api<Session>('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      setAccessToken(s.accessToken); setCurrent(''); setNext(''); setPwMsg({ ok: true, text: 'Password changed. Other devices were signed out.' });
    } catch (err) { setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change password.' }); }
    finally { setSavingPw(false); }
  };
  const signOutEverywhere = async () => {
    if (!window.confirm('Sign out on every device?')) return;
    try { await api('/auth/logout-all', { method: 'POST' }); } catch { /* fall through to local logout */ }
    await logout();
  };

  return (
    <div className="settings-forms">
      <form className="settings-card" onSubmit={saveProfile}>
        <h3>Profile</h3>
        <label>Name<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={100} required /></label>
        <label>Email<input value={user?.email || ''} disabled /></label>
        <label>Default caption language
          <select value={lang} onChange={e => setLang(e.target.value)}>{languages.map(l => <option key={l.code} value={l.code}>{l.name} ({l.native})</option>)}</select>
        </label>
        {profileMsg && <p role={profileMsg.ok ? 'status' : 'alert'} className={profileMsg.ok ? 'form-ok' : 'form-bad'}>{profileMsg.text}</p>}
        <button className="button button-primary button-small" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
      </form>
      <form className="settings-card" onSubmit={changePassword}>
        <h3>Change password</h3>
        <label>Current password<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></label>
        <label>New password (min. 8 characters)<input type="password" autoComplete="new-password" minLength={8} value={next} onChange={e => setNext(e.target.value)} required /></label>
        {pwMsg && <p role={pwMsg.ok ? 'status' : 'alert'} className={pwMsg.ok ? 'form-ok' : 'form-bad'}>{pwMsg.text}</p>}
        <div className="settings-actions">
          <button className="button button-primary button-small" disabled={savingPw}>{savingPw ? 'Updating…' : 'Update password'}</button>
          <button type="button" className="button button-secondary button-small" onClick={() => void signOutEverywhere()}>Sign out everywhere</button>
        </div>
      </form>
    </div>
  );
}
