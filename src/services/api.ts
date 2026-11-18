import type { AppUser, Meeting as MeetingType } from '../types';

// Central API client. The backend URL comes from ONE env variable (VITE_API_URL).
export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:4000/api').replace(/\/+$/, '');
export type Meeting = MeetingType;
export type { AppUser };

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// The short-lived access token lives only in memory; the long-lived refresh token is an httpOnly cookie.
let accessToken: string | null = null;
const sessionLostListeners = new Set<() => void>();
export const getAccessToken = () => accessToken;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const onSessionLost = (fn: () => void) => { sessionLostListeners.add(fn); return () => { sessionLostListeners.delete(fn); }; };

export interface Session { user: AppUser; accessToken: string }
let refreshing: Promise<Session | null> | null = null;

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<Session | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!res.ok) { accessToken = null; return null; }
        const session = (await res.json()) as Session;
        accessToken = session.accessToken;
        return session;
      } catch { return null; }
      finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}

async function send(path: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  try {
    return await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_URL}. Check that the backend is running and VITE_API_URL is correct.`, 0, 'NETWORK');
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await send(path, options);
  // Expired access token: refresh once, then replay the request.
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) response = await send(path, options);
    else { sessionLostListeners.forEach(fn => fn()); }
  }
  const raw = response.status === 204 ? '' : await response.text();
  let payload: Record<string, unknown> = {};
  if (raw) { try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { payload = { error: raw.slice(0, 200) }; } }
  if (!response.ok) {
    throw new ApiError(typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`, response.status, typeof payload.code === 'string' ? payload.code : 'ERROR');
  }
  return payload as T;
}

export const jsonBody = (data: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(data) });
