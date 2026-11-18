import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

// Single Socket.IO origin from env (no /api suffix).
export const SOCKET_URL = ((import.meta.env.VITE_SOCKET_URL as string | undefined) || 'http://localhost:4000').replace(/\/+$/, '');

/** `auth` is a function so every (re)connection uses the CURRENT access token, even after a refresh. */
export function openSocket(): Socket {
  return io(SOCKET_URL, {
    auth: cb => cb({ token: getAccessToken() }),
    reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 6000
  });
}

export function emitWithAck<T = Record<string, unknown>>(socket: Socket, event: string, payload?: unknown): Promise<{ ok: boolean; code?: string; error?: string } & T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'TIMEOUT', error: 'The server did not answer in time.' } as unknown as { ok: boolean } & T), 8000);
    socket.emit(event, payload, (res: { ok: boolean } & T) => { clearTimeout(timer); resolve(res); });
  });
}
