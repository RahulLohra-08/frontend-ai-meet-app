import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../services/api';
import { newSegmentId } from '../utils/format';

export type SpeechEngine = 'browser' | 'server';
export type CaptureStatus = 'idle' | 'listening' | 'processing' | 'reconnecting' | 'offline' | 'error';
export interface Fatal { code: 'browser_speech_unreachable' | 'permission_denied' | 'language_unsupported' | 'stt_not_configured' | 'unsupported'; message: string }

interface Options {
  meetingId: string | undefined;
  enabled: boolean;               // in the room, mic on, connected
  engine: SpeechEngine;
  language: string;               // ISO code of the spoken language, or 'auto' (server engine only)
  speechTag: string;              // BCP-47 tag for the browser engine, e.g. hi-IN
  stream: MediaStream | null;     // microphone stream (server engine)
  onPartial: (segmentId: string, text: string, language: string) => void;
}

interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; onstart: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type SpeechCtor = new () => SpeechRecognitionLike;
const speechCtor = (): SpeechCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};
export const browserEngineSupported = () => typeof window !== 'undefined' && Boolean(speechCtor());
export const serverEngineSupported = () => typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined';
const isBraveBrowser = async () => Boolean(await (navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave?.isBrave?.().catch(() => false));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Exponential backoff with full jitter: random in [100, min(cap, base * 2^attempt)]. */
const backoff = (attempt: number, base = 1000, cap = 15000) => Math.max(100, Math.floor(Math.random() * Math.min(cap, base * 2 ** attempt)));
const transient = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === 429 || e.status >= 500) && !['STT_NOT_CONFIGURED', 'NOT_CONFIGURED', 'QUOTA_EXCEEDED'].includes(e.code);

/** Retry transient failures with the SAME segment id: the server is idempotent, so retries can never create duplicates. */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (!transient(e)) throw e; await sleep(backoff(i, 700, 8000)); }
  }
  throw last;
}

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m));

// Only ONE recognizer may exist per page. A second instance (React StrictMode, fast engine/language switches,
// rejoin) would hear the same speech and create duplicate captions, so the previous one is always aborted first.
let activeRecognizer: SpeechRecognitionLike | null = null;
function killRecognizer(rec: SpeechRecognitionLike | null) {
  if (!rec) return;
  rec.onresult = null; rec.onerror = null; rec.onend = null; rec.onstart = null;   // abort() must not deliver late results
  try { rec.abort(); } catch { /* already stopped */ }
  if (activeRecognizer === rec) activeRecognizer = null;
}

export function useSpeechCapture({ meetingId, enabled, engine, language, speechTag, stream, onPartial }: Options) {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [error, setError] = useState('');
  const [fatal, setFatal] = useState<Fatal | null>(null);
  const [interim, setInterim] = useState<{ segmentId: string; text: string } | null>(null);
  const [unsent, setUnsent] = useState(0);
  const [nonce, setNonce] = useState(0);                      // bump to restart after a fatal error
  const partialRef = useRef(onPartial);
  useEffect(() => { partialRef.current = onPartial; }, [onPartial]);
  const clearError = useCallback(() => setError(''), []);
  const retry = useCallback(() => { setFatal(null); setError(''); setNonce(n => n + 1); }, []);

  // Segments that could not be delivered (network down) wait here and are re-sent with the same ids: nothing is lost.
  const unsentFinals = useRef<{ id: string; text: string; at: string; language: string }[]>([]);
  const unsentAudio = useRef<{ id: string; blob: Blob; language: string }[]>([]);
  const flushing = useRef(false);

  const sendFinal = useCallback(async (item: { id: string; text: string; at: string; language: string }) => {
    if (!meetingId) return;
    await api(`/meetings/${encodeURIComponent(meetingId)}/transcripts`, { method: 'POST', body: JSON.stringify({ text: item.text, sourceLanguage: item.language, clientSegmentId: item.id, occurredAt: item.at }) });
  }, [meetingId]);
  const sendAudio = useCallback(async (item: { id: string; blob: Blob; language: string }) => {
    if (!meetingId) return;
    await api(`/meetings/${encodeURIComponent(meetingId)}/audio`, { method: 'POST', body: item.blob, headers: { 'Content-Type': item.blob.type || 'audio/webm', 'X-Segment-Id': item.id, 'X-Source-Language': item.language } });
  }, [meetingId]);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      while (unsentFinals.current.length) { await sendFinal(unsentFinals.current[0]); unsentFinals.current.shift(); setUnsent(unsentFinals.current.length + unsentAudio.current.length); }
      while (unsentAudio.current.length) { await sendAudio(unsentAudio.current[0]); unsentAudio.current.shift(); setUnsent(unsentFinals.current.length + unsentAudio.current.length); }
    } catch { /* still offline / server down: keep the rest for the next attempt */ }
    finally { flushing.current = false; }
  }, [sendFinal, sendAudio]);
  useEffect(() => {
    const t = setInterval(() => { if (unsentFinals.current.length || unsentAudio.current.length) void flush(); }, 8000);
    window.addEventListener('online', flush);
    return () => { clearInterval(t); window.removeEventListener('online', flush); };
  }, [flush]);

  const deliverFinal = useCallback(async (item: { id: string; text: string; at: string; language: string }) => {
    try { await withRetry(() => sendFinal(item)); }
    catch (e) {
      if (transient(e)) { unsentFinals.current.push(item); setUnsent(unsentFinals.current.length + unsentAudio.current.length); setError('Connection problem: captions are saved on this device and will be sent when the connection returns.'); }
      else setError(e instanceof Error ? `A caption could not be saved: ${e.message}` : 'A caption could not be saved.');
    }
  }, [sendFinal]);

  // ---------------- Browser engine ----------------
  useEffect(() => {
    if (!enabled || engine !== 'browser' || !meetingId) return;
    const Ctor = speechCtor();
    if (!Ctor) { setFatal({ code: 'unsupported', message: 'This browser has no speech recognition. Use Chrome or Edge, or switch to the server engine.' }); setStatus('error'); return; }

    let stopped = false; let rec: SpeechRecognitionLike | null = null; let timer: ReturnType<typeof setTimeout> | null = null;
    let segmentId = newSegmentId(); let lastSent = 0; let netFails = 0; let brave = false;
    void isBraveBrowser().then(b => { brave = b; });

    const schedule = (ms: number) => { if (timer) clearTimeout(timer); timer = setTimeout(start, ms); };   // exactly one pending restart
    function start() {
      timer = null;
      if (stopped) return;
      if (!navigator.onLine) { setStatus('offline'); return; }       // resumes from the 'online' event
      killRecognizer(activeRecognizer);                              // never two recognizers at once
      rec = new Ctor!(); activeRecognizer = rec;
      rec.lang = speechTag; rec.continuous = true; rec.interimResults = true;
      rec.onstart = () => { setStatus('listening'); };
      rec.onresult = ev => {
        netFails = 0; setError('');                                  // audio is flowing: the connection works
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i]; const text = (r[0]?.transcript || '').trim();
          if (!text) continue;
          if (r.isFinal) { const id = segmentId; segmentId = newSegmentId(); setInterim(null); void deliverFinal({ id, text, at: new Date().toISOString(), language }); }
          else { setInterim({ segmentId, text }); if (Date.now() - lastSent > 250) { lastSent = Date.now(); partialRef.current(segmentId, text, language); } }
        }
      };
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopped = true; setFatal({ code: 'permission_denied', message: 'Microphone or speech-recognition permission was denied. Allow it in the browser address bar, then retry.' }); setStatus('error'); return; }
        if (e.error === 'language-not-supported') { stopped = true; setFatal({ code: 'language_unsupported', message: `The browser cannot recognise this language (${speechTag}). Pick another language or use the server engine.` }); setStatus('error'); return; }
        if (e.error === 'network') {
          // "network" = the browser could not reach ITS speech service (Google). Not our server, not our API key.
          netFails++;
          if (netFails >= 3) {
            stopped = true; killRecognizer(rec);
            setFatal({ code: 'browser_speech_unreachable', message: brave
              ? "Brave blocks the speech service this engine depends on. Switch to the server engine, or open the meeting in Chrome or Edge."
              : "The browser's speech service could not be reached (offline, VPN/firewall, or the browser does not provide one). Switch to the server engine, or try Chrome or Edge." });
            setStatus('error'); return;
          }
          setStatus('reconnecting'); setError(`Speech service not reachable (attempt ${netFails}/3). Retrying…`);
          schedule(backoff(netFails));                              // exponential backoff + jitter, never a tight loop
          return;
        }
        setError(`Speech recognition problem: ${e.error}`);
      };
      // The browser ends recognition after silences: restart quietly (this is normal, not a failure).
      rec.onend = () => { if (!stopped && !timer) schedule(300); };
      try { rec.start(); } catch { schedule(500); }
    }

    const onOffline = () => { setStatus('offline'); killRecognizer(rec); if (timer) { clearTimeout(timer); timer = null; } };
    const onOnline = () => { if (!stopped) { setError(''); netFails = 0; schedule(300); } };
    window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline);
    start();
    return () => {
      stopped = true; if (timer) clearTimeout(timer);
      window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline);
      killRecognizer(rec); setInterim(null); setStatus('idle');
    };
  }, [enabled, engine, meetingId, language, speechTag, nonce, deliverFinal]);

  // ---------------- Server engine: MediaRecorder -> short self-contained files -> POST /audio ----------------
  useEffect(() => {
    if (!enabled || engine !== 'server' || !meetingId) return;
    if (!stream || stream.getAudioTracks().length === 0) { setFatal({ code: 'permission_denied', message: 'No microphone stream is available.' }); setStatus('error'); return; }
    if (!serverEngineSupported()) { setFatal({ code: 'unsupported', message: 'This browser cannot record audio (MediaRecorder missing).' }); setStatus('error'); return; }
    const mimeType = pickMime();
    const audioStream = new MediaStream(stream.getAudioTracks());
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx(); const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
    ctx.createMediaStreamSource(audioStream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);

    let stopped = false; let recorder: MediaRecorder | null = null; let startedAt = 0; let voiced = 0; let silentMs = 0; let inflight = 0; let fatalHit = false;
    const refresh = () => setStatus(fatalHit ? 'error' : !navigator.onLine ? 'offline' : inflight > 0 ? 'processing' : 'listening');

    const upload = async (blob: Blob) => {
      const item = { id: newSegmentId(), blob, language };
      inflight++; refresh();
      try { await withRetry(() => sendAudio(item), 3); setError(''); }
      catch (e) {
        if (transient(e)) {
          if (unsentAudio.current.length < 8) { unsentAudio.current.push(item); setUnsent(unsentFinals.current.length + unsentAudio.current.length); }
          setError('Connection problem: audio is kept on this device and will be transcribed when the connection returns.');
        } else if (e instanceof ApiError && (e.code === 'STT_NOT_CONFIGURED' || e.code === 'NOT_CONFIGURED' || e.code === 'QUOTA_EXCEEDED')) {
          fatalHit = true; stopped = true;
          setFatal({ code: 'stt_not_configured', message: e.code === 'QUOTA_EXCEEDED' ? `The speech provider has no remaining credit. ${e.message}` : e.message });
        } else setError(e instanceof Error ? e.message : 'Audio could not be transcribed.');
      } finally { inflight--; refresh(); }
    };

    const begin = () => {
      if (stopped) return;
      const chunks: Blob[] = []; voiced = 0; silentMs = 0; startedAt = Date.now();
      recorder = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      const mine = recorder;
      mine.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      mine.onstop = () => {
        const blob = new Blob(chunks, { type: mine.mimeType || mimeType || 'audio/webm' });
        if (voiced >= 4 && blob.size > 1500) void upload(blob);          // skip silence: saves cost, avoids hallucinated text
        if (!stopped) begin();
      };
      mine.start();
    };
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      if (Math.sqrt(sum / buf.length) > 0.02) { voiced++; silentMs = 0; } else silentMs += 100;
      const elapsed = Date.now() - startedAt;
      if (recorder && recorder.state === 'recording' && ((elapsed >= 2500 && silentMs >= 800) || elapsed >= 10000 || (voiced === 0 && elapsed >= 8000))) recorder.stop();
    }, 100);
    const onNet = () => { refresh(); if (navigator.onLine) void flush(); };
    window.addEventListener('online', onNet); window.addEventListener('offline', onNet);
    void ctx.resume(); begin(); setStatus('listening'); setError('');
    return () => {
      stopped = true; clearInterval(timer);
      window.removeEventListener('online', onNet); window.removeEventListener('offline', onNet);
      if (recorder && recorder.state === 'recording') recorder.stop();
      void ctx.close(); setStatus('idle');
    };
  }, [enabled, engine, meetingId, language, stream, nonce, sendAudio, flush]);

  return { status, error, fatal, interim, unsent, clearError, retry };
}
