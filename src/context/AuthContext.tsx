import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionLost, refreshSession, setAccessToken, type Session } from '../services/api';
import type { AppUser } from '../types';

type Status = 'loading' | 'authenticated' | 'anonymous';
interface AuthValue {
  status: Status; user: AppUser | null;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AppUser) => void;
}
const AuthContext = createContext<AuthValue | null>(null);

let bootstrap: Promise<Session | null> | null = null; // survives React StrictMode's double effect

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let alive = true;
    bootstrap ||= refreshSession();
    bootstrap.then(s => {
      if (!alive) return;
      if (s) { setUser(s.user); setStatus('authenticated'); } else setStatus('anonymous');
    });
    const off = onSessionLost(() => { setUser(null); setStatus('anonymous'); });
    return () => { alive = false; off(); };
  }, []);

  const apply = (s: Session) => { setAccessToken(s.accessToken); setUser(s.user); setStatus('authenticated'); bootstrap = Promise.resolve(s); };
  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    apply(await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) }));
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    apply(await api<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, remember: true }) }));
  }, []);
  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* cookie is cleared server-side best effort */ }
    setAccessToken(null); setUser(null); setStatus('anonymous'); bootstrap = Promise.resolve(null);
  }, []);

  const value = useMemo(() => ({ status, user, login, register, logout, setUser }), [status, user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
