import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, refreshSession } from '../services/api';
import { emitWithAck, openSocket } from '../services/socket';
import type { ChatMessage, Meeting, PartialCaption, PresenceEntry, Segment, TranslationEvent, WireSegment } from '../types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'denied';

const toSegment = (w: WireSegment): Segment => ({
  id: w.id, seq: w.seq, segmentId: w.segmentId, speaker: w.speaker, text: w.text, sourceLanguage: w.sourceLanguage,
  detectedLanguage: w.detectedLanguage, selectedLanguage: w.selectedLanguage, provider: w.provider, occurredAt: w.occurredAt,
  translations: w.translation ? { [w.translation.targetLanguage]: { status: 'translated', text: w.translation.text, provider: w.translation.provider } } : {}
});

/**
 * Owns the Socket.IO connection of the live meeting room:
 *  - joins only after the server verified membership, re-joins automatically after reconnects
 *  - keeps segments ordered by `seq`, de-duplicated by id, with per-language translations
 *  - catches up on missed segments through REST (afterSeq) after every (re)connect
 */
export function useMeetingSession(meetingId: string | undefined, active: boolean, initialCaptionLanguage: string) {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [partials, setPartials] = useState<Record<string, PartialCaption>>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [captionLanguage, setCaptionLanguageState] = useState(initialCaptionLanguage);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const langRef = useRef(initialCaptionLanguage);
  const initialLang = useRef(initialCaptionLanguage);
  initialLang.current = initialCaptionLanguage;
  const lastSeq = useRef(0);
  const pending = useRef(new Map<string, Record<string, Segment['translations'][string]>>()); // translations that arrived before their segment

  const upsert = useCallback((incoming: Segment[]) => {
    setSegments(prev => {
      const byId = new Map(prev.map(s => [s.id, s]));
      for (const s of incoming) {
        const early = pending.current.get(s.id);
        if (early) { s.translations = { ...early, ...s.translations }; pending.current.delete(s.id); }
        const old = byId.get(s.id);
        byId.set(s.id, old ? { ...old, ...s, translations: { ...old.translations, ...s.translations } } : s);
        lastSeq.current = Math.max(lastSeq.current, s.seq);
      }
      return [...byId.values()].sort((a, b) => a.seq - b.seq);
    });
    // a final segment replaces the live partial of the same utterance
    setPartials(prev => {
      const next = { ...prev };
      for (const s of incoming) if (next[s.speaker.id]?.segmentId === s.segmentId) delete next[s.speaker.id];
      return next;
    });
  }, []);

  const applyTranslation = useCallback((e: TranslationEvent) => {
    const value = { status: e.status, text: e.text, provider: e.provider, message: e.message, code: e.code } as Segment['translations'][string];
    setSegments(prev => {
      if (!prev.some(s => s.id === e.segmentId)) {
        pending.current.set(e.segmentId, { ...(pending.current.get(e.segmentId) || {}), [e.language]: value });
        return prev;
      }
      return prev.map(s => (s.id === e.segmentId ? { ...s, translations: { ...s.translations, [e.language]: value } } : s));
    });
  }, []);

  /** Load every segment we have not seen yet (initial history for late joiners AND gap-fill after reconnects). */
  const catchUp = useCallback(async () => {
    if (!meetingId) return;
    for (let guard = 0; guard < 50; guard++) {
      const r = await api<{ transcripts: WireSegment[] }>(`/meetings/${encodeURIComponent(meetingId)}/transcripts?afterSeq=${lastSeq.current}&limit=200&lang=${langRef.current}`);
      if (!r.transcripts.length) break;
      upsert(r.transcripts.map(toSegment));
      if (r.transcripts.length < 200) break;
    }
  }, [meetingId, upsert]);

  useEffect(() => {
    if (!meetingId || !active) return;
    let disposed = false;
    langRef.current = initialLang.current; setCaptionLanguageState(initialLang.current); // language chosen in the lobby
    setConnection('connecting'); setError('');
    const socket = openSocket();
    socketRef.current = socket;

    const join = async () => {
      const res = await emitWithAck<{ meeting: Meeting; presence: PresenceEntry[] }>(socket, 'meeting:join', { meetingId, captionLanguage: langRef.current });
      if (disposed) return;
      if (!res.ok) {
        if (res.code === 'MEETING_ENDED') setEnded(true);
        setError(res.error || 'Could not join the live room.'); setConnection('denied'); return;
      }
      setMeeting(res.meeting); setPresence(res.presence); setConnection('connected'); setError('');
      catchUp().catch(() => setError('Could not load earlier captions. They will appear once you reconnect.'));
    };

    socket.on('connect', () => { void join(); });
    socket.on('disconnect', reason => {
      if (disposed) return;
      setConnection('reconnecting');
      if (reason === 'io server disconnect') { void refreshSession().then(() => socket.connect()); } // token expired server-side: refresh, then reconnect
    });
    socket.on('connect_error', err => {
      if (disposed) return;
      setConnection('reconnecting');
      if (/TOKEN_EXPIRED|UNAUTHENTICATED/.test(err.message)) void refreshSession().then(s => { if (s && !disposed) socket.connect(); });
    });
    socket.on('auth:expired', () => { void refreshSession().then(() => { if (!disposed) socket.connect(); }); });

    socket.on('caption:final', (w: WireSegment) => upsert([toSegment(w)]));
    socket.on('caption:translation', (e: TranslationEvent) => applyTranslation(e));
    socket.on('caption:partial', (p: PartialCaption & { at?: number }) => setPartials(prev => {
      const cur = prev[p.speaker.id];
      if (cur && cur.at > (p.at || 0)) return prev; // stale update
      return { ...prev, [p.speaker.id]: { segmentId: p.segmentId, speaker: p.speaker, text: p.text, sourceLanguage: p.sourceLanguage, at: p.at || Date.now() } };
    }));
    socket.on('presence:update', (e: { presence: PresenceEntry[] }) => setPresence(e.presence));
    socket.on('chat:message', (m: ChatMessage) => setChat(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m].slice(-200))));
    socket.on('meeting:ended', () => setEnded(true));
    socket.on('participant:joined', () => { api<{ meeting: Meeting }>(`/meetings/${encodeURIComponent(meetingId)}`).then(r => setMeeting(r.meeting)).catch(() => {}); });

    // partials that never get finalised (speaker stopped mid-word) disappear after a few seconds
    const sweep = setInterval(() => setPartials(prev => {
      const now = Date.now(); const keep = Object.entries(prev).filter(([, p]) => now - p.at < 6000);
      return keep.length === Object.keys(prev).length ? prev : Object.fromEntries(keep);
    }), 2000);

    return () => {
      disposed = true; clearInterval(sweep);
      socket.emit('meeting:leave', {}); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null;
    };
  }, [meetingId, active, catchUp, upsert, applyTranslation]);

  const setCaptionLanguage = useCallback(async (language: string) => {
    langRef.current = language; setCaptionLanguageState(language);
    const socket = socketRef.current;
    if (socket?.connected) await emitWithAck(socket, 'caption:setLanguage', { language });
    // Fetch stored translations for the history in the new language; translate the most recent gaps on demand.
    if (!meetingId) return;
    try {
      const r = await api<{ transcripts: WireSegment[] }>(`/meetings/${encodeURIComponent(meetingId)}/transcripts?limit=200&lang=${language}&page=1`);
      upsert(r.transcripts.map(toSegment));
    } catch { /* history is best effort */ }
  }, [meetingId, upsert]);

  const retryTranslation = useCallback(async (segment: Segment, language: string) => {
    if (!meetingId) return;
    setSegments(prev => prev.map(s => (s.id === segment.id ? { ...s, translations: { ...s.translations, [language]: { status: 'pending' } } } : s)));
    try {
      const r = await api<{ status: string; translation?: { text: string; provider: string } }>(`/meetings/${encodeURIComponent(meetingId)}/translations`, { method: 'POST', body: JSON.stringify({ transcriptId: segment.id, targetLanguage: language }) });
      applyTranslation({ meetingId, segmentId: segment.id, seq: segment.seq, language, status: r.status === 'same_language' ? 'same_language' : 'translated', text: r.translation?.text, provider: r.translation?.provider });
    } catch (err) {
      applyTranslation({ meetingId, segmentId: segment.id, seq: segment.seq, language, status: 'failed', message: err instanceof Error ? err.message : 'Translation failed.' });
    }
  }, [meetingId, applyTranslation]);

  const sendPartial = useCallback((segmentId: string, text: string, sourceLanguage: string) => {
    socketRef.current?.connected && socketRef.current.emit('transcript:partial', { segmentId, text: text.slice(0, 1000), sourceLanguage });
  }, []);
  const updatePresence = useCallback((patch: { micOn?: boolean; handRaised?: boolean; speaking?: boolean }) => {
    socketRef.current?.connected && socketRef.current.emit('presence:update', patch);
  }, []);
  const sendChat = useCallback(async (text: string) => {
    const s = socketRef.current;
    if (!s?.connected) return { ok: false, error: 'Not connected.' };
    return emitWithAck(s, 'chat:send', { text });
  }, []);

  return { connection, meeting, presence, segments, partials, chat, captionLanguage, ended, error, setCaptionLanguage, retryTranslation, sendPartial, updatePresence, sendChat };
}
