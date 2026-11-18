import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, MessageSquare, Globe, Users, Captions, PhoneOff, Hand, Maximize, Minimize, Copy, Check, StopCircle, AlertTriangle, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useMedia } from '../hooks/useMedia';
import { useTimer } from '../hooks/useTimer';
import { useLanguages, useCapabilities } from '../hooks/useMeta';
import { useMeetingSession, type ConnectionState } from '../hooks/useMeetingSession';
import { useSpeechCapture, browserEngineSupported, type SpeechEngine } from '../hooks/useSpeechCapture';
import { langLabel, initials } from '../utils/format';
import type { Meeting } from '../types';
import VideoComponent from '../components/meeting/VideoComponent';
import CaptionsPanel from '../components/meeting/CaptionsPanel';
import ChatPanel from '../components/meeting/ChatPanel';
import ParticipantsPanel from '../components/meeting/ParticipantsPanel';
import LiveCaptions from '../components/meeting/LiveCaptions';

const CONNECTION_LABEL: Record<ConnectionState, { text: string; cls: string }> = {
  connecting: { text: 'Connecting…', cls: 'text-yellow-300' },
  connected: { text: 'Live connection', cls: 'text-emerald-400' },
  reconnecting: { text: 'Reconnecting…', cls: 'text-yellow-300' },
  disconnected: { text: 'Disconnected', cls: 'text-red-400' },
  denied: { text: 'Not connected', cls: 'text-red-400' }
};

export default function MeetingRoom() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const languages = useLanguages();
  const caps = useCapabilities();

  const [preview, setPreview] = useState<Meeting | null>(null);
  const [inLobby, setInLobby] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<Meeting | null>(null);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'participants' | 'captions' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  // Lobby choices
  const [speakLanguage, setSpeakLanguage] = useState('');
  const [captionLang, setCaptionLang] = useState('');
  const [engine, setEngine] = useState<SpeechEngine>('browser');
  const containerRef = useRef<HTMLDivElement>(null);

  const media = useMedia();
  const { stream, micEnabled, camEnabled, error: mediaError, requestPermissions, toggleMic, toggleCam, stopAllMedia } = media;
  const { formattedTime, start: startTimer, stop: stopTimer } = useTimer();

  // Ask for the microphone when the lobby opens.
  useEffect(() => { if (inLobby) void requestPermissions(); }, [inLobby, requestPermissions]);

  // Preview the meeting (only possible for members; a first-time joiner simply sees the code).
  useEffect(() => {
    api<{ meeting: Meeting }>(`/meetings/${encodeURIComponent(id)}`).then(r => setPreview(r.meeting)).catch(() => setPreview(null));
  }, [id]);

  // Sensible defaults once we know the meeting / languages.
  useEffect(() => {
    if (!languages.length) return;
    setSpeakLanguage(cur => cur || (preview && preview.sourceLanguage !== 'auto' ? preview.sourceLanguage : user?.preferredLanguage || 'en'));
    setCaptionLang(cur => cur || preview?.targetLanguage || user?.preferredLanguage || 'en');
  }, [languages.length, preview, user?.preferredLanguage]);
  useEffect(() => { if (engine === 'browser' && speakLanguage === 'auto') setSpeakLanguage(user?.preferredLanguage || 'en'); }, [engine, speakLanguage, user?.preferredLanguage]);

  const session = useMeetingSession(id, !inLobby, captionLang || 'en');
  const meeting = session.meeting || joined || preview;
  const isHost = Boolean(meeting?.isHost);
  const speechTag = languages.find(l => l.code === speakLanguage)?.speech || 'en-US';

  const capture = useSpeechCapture({
    meetingId: id, enabled: !inLobby && micEnabled && session.connection === 'connected', engine,
    language: speakLanguage || 'en', speechTag, stream, onPartial: session.sendPartial
  });

  // Tell the room about mic / hand state.
  const { updatePresence } = session;
  useEffect(() => { if (!inLobby && session.connection === 'connected') updatePresence({ micOn: micEnabled, handRaised }); }, [inLobby, session.connection, micEnabled, handRaised, updatePresence]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Host ended the meeting for everyone.
  useEffect(() => {
    if (!session.ended || inLobby) return;
    stopTimer(); stopAllMedia();
    navigate(`/meeting/${id}/summary`, { replace: true });
  }, [session.ended, inLobby, id, navigate, stopTimer, stopAllMedia]);

  const handleJoin = async () => {
    setMeetingError(''); setJoining(true);
    try {
      const r = await api<{ meeting: Meeting }>(`/meetings/${encodeURIComponent(id)}/join`, { method: 'POST', body: JSON.stringify({ captionLanguage: captionLang || 'en' }) });
      setJoined(r.meeting); setInLobby(false); startTimer();
    } catch (err) { setMeetingError(err instanceof Error ? err.message : 'Could not join this meeting.'); }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    stopTimer(); stopAllMedia();
    try { await api(`/meetings/${encodeURIComponent(id)}/leave`, { method: 'POST' }); } catch { /* leaving is best effort */ }
    navigate(isHost ? `/meeting/${id}/summary` : '/dashboard');
  };
  const handleEnd = async () => {
    if (!window.confirm('End this meeting for everyone? AI notes will be generated from the saved transcript.')) return;
    try {
      await api(`/meetings/${encodeURIComponent(id)}/end`, { method: 'POST' });
      stopTimer(); stopAllMedia(); navigate(`/meeting/${id}/summary`);
    } catch (err) { setMeetingError(err instanceof Error ? err.message : 'Could not end the meeting.'); }
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {}); else void document.exitFullscreen();
  };
  const copyCode = async () => {
    if (!meeting) return;
    try { await navigator.clipboard.writeText(meeting.code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500); } catch { window.prompt('Meeting code', meeting.code); }
  };

  // ----- Which caption does the overlay show? Newest live partial, otherwise the latest final segment. -----
  const selfId = user?.id || '';
  const { segments, partials } = session;
  const livePartial = useMemo(() => {
    const list = Object.values(partials).map(p => ({ ...p }));
    if (capture.interim) list.push({ segmentId: capture.interim.segmentId, speaker: { id: selfId, name: user?.name || 'Unknown speaker' }, text: capture.interim.text, sourceLanguage: speakLanguage, at: Number.MAX_SAFE_INTEGER });
    return list.sort((a, b) => b.at - a.at)[0];
  }, [partials, capture.interim, selfId, speakLanguage, user?.name]);
  const lastFinal = segments[segments.length - 1];
  const captionLanguageName = langLabel(session.captionLanguage, languages);
  const translationState = useMemo(() => {
    const relevant = segments.slice(-12).filter(sg => sg.sourceLanguage !== session.captionLanguage);
    if (!relevant.length) return null;
    const states = relevant.map(sg => sg.translations[session.captionLanguage]?.status ?? 'pending');
    if (states.some(x => x === 'retrying')) return { text: 'Translation delayed', cls: 'capture-reconnecting' };
    if (states.some(x => x === 'pending')) return { text: 'Translating…', cls: 'capture-processing' };
    if (states[states.length - 1] === 'failed') return { text: 'Translation unavailable', cls: 'capture-error' };
    return { text: 'Translation OK', cls: 'capture-listening' };
  }, [segments, session.captionLanguage]);
  const sttNote = engine === 'server' && caps && !caps.speechToText.configured ? 'The server has no speech-to-text key configured, so this engine cannot work yet.' : undefined;

  // ======================= LOBBY =======================
  if (inLobby) {
    const serverOk = Boolean(caps?.speechToText.configured);
    return (
      <div className="meeting-room-shell min-h-screen bg-[#09090b] text-white flex flex-col font-sans">
        <header className="h-20 flex items-center px-8 border-b border-white/10">
          <img src="/logo.png" alt="Lingua Meet" className="h-16 w-16 rounded-full object-contain bg-white p-2 shadow-md" />
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-4">
              <div className="aspect-video bg-gray-900 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl flex items-center justify-center">
                {camEnabled && stream ? (
                  <VideoComponent stream={stream} className="w-full h-full object-cover transform -scale-x-100" muted />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center text-4xl font-bold text-white shadow-xl mb-4">{initials(user?.name || '')}</div>
                    <div className="text-2xl text-white font-medium">{user?.name}</div>
                  </div>
                )}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10">
                  <button onClick={toggleMic} aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}>{micEnabled ? <Mic size={20} /> : <MicOff size={20} />}</button>
                  <button onClick={toggleCam} aria-label={camEnabled ? 'Turn camera off' : 'Turn camera on'} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}>{camEnabled ? <Video size={20} /> : <VideoOff size={20} />}</button>
                </div>
              </div>
              {mediaError && (
                <div role="alert" className="text-sm text-yellow-200 flex items-center justify-between gap-3">
                  <span>{mediaError}</span><button onClick={() => void requestPermissions()} className="underline shrink-0">Try again</button>
                </div>
              )}
              <p className="text-xs text-gray-400">Your camera is a local preview only: this app shares captions, transcripts and chat, not live video to other participants.</p>
            </div>

            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <h1 className="text-4xl font-bold mb-2">Ready to join?</h1>
              <p className="text-gray-400 text-lg mb-6">{preview ? preview.title : 'Meeting'} · <span className="font-mono text-white">{id}</span></p>
              {meetingError && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{meetingError}</p>}

              <div className="space-y-4 w-full max-w-sm text-left">
                <label className="panel-field">I will speak
                  <select value={speakLanguage} onChange={e => setSpeakLanguage(e.target.value)}>
                    {engine === 'server' && <option value="auto">Auto-detect language</option>}
                    {languages.map(l => <option key={l.code} value={l.code}>{l.name} ({l.native})</option>)}
                  </select>
                </label>
                <label className="panel-field">Show my captions in
                  <select value={captionLang} onChange={e => setCaptionLang(e.target.value)}>
                    {languages.map(l => <option key={l.code} value={l.code}>{l.name} ({l.native})</option>)}
                  </select>
                </label>
                <fieldset className="panel-field">
                  <legend>Speech engine</legend>
                  <label className="engine-option"><input type="radio" name="engine" checked={engine === 'browser'} onChange={() => setEngine('browser')} disabled={!browserEngineSupported()} />
                    <span><strong>Browser (live)</strong><small>{browserEngineSupported() ? 'Free, shows words while you speak. Works best in Chrome / Edge.' : 'Not supported by this browser.'}</small></span></label>
                  <label className="engine-option"><input type="radio" name="engine" checked={engine === 'server'} onChange={() => setEngine('server')} disabled={!serverOk} />
                    <span><strong>Server (Whisper-style)</strong><small>{serverOk ? 'Auto language detection; text appears after each pause.' : 'Unavailable: no STT_API_KEY configured on the server.'}</small></span></label>
                </fieldset>
                <button onClick={() => void handleJoin()} disabled={joining || !speakLanguage || !captionLang} className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-lg transition-colors shadow-lg shadow-primary-600/30 disabled:opacity-60">{joining ? 'Joining…' : 'Join now'}</button>
                <Link to="/dashboard" className="w-full py-3 flex items-center justify-center rounded-xl font-medium text-gray-300 hover:bg-white/5 transition-colors">Go back</Link>
              </div>

              <div className="mt-6 p-4 bg-primary-900/20 border border-primary-500/20 rounded-xl flex items-start gap-3 w-full max-w-sm">
                <Globe className="text-primary-500 shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <div className="font-bold text-primary-400 mb-1">Translation status</div>
                  <div className="text-gray-400">{caps ? (caps.translation.configured ? `Live translation via ${caps.translation.provider}${caps.translation.devMock ? ' (DEV MOCK: tiny demo phrasebook only)' : ''}.` : 'No translation provider is configured on the server: you will see original captions only.') : 'Checking server…'}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ======================= LIVE ROOM =======================
  const conn = CONNECTION_LABEL[session.connection];
  const presenceById = new Map(session.presence.map(p => [p.userId, p]));
  const people = meeting?.participants?.length ? meeting.participants : [{ userId: selfId, name: user?.name || 'You', role: 'participant' as const, captionLanguage: captionLang }];
  const panelBtn = (p: 'chat' | 'participants' | 'captions') => `w-12 h-12 rounded-full flex items-center justify-center transition-all ${activePanel === p ? 'bg-primary-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`;

  return (
    <div ref={containerRef} className="meeting-room-shell h-screen w-full bg-[#09090b] text-white flex flex-col overflow-hidden font-sans">
      <header className="h-16 flex items-center justify-between px-4 bg-black/40 border-b border-white/10 z-10 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.png" alt="Lingua Meet" className="h-12 w-12 rounded-full object-contain bg-white p-1.5 shadow-md shrink-0" />
          <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />
          <div className="text-sm font-medium truncate">{meeting?.title || 'Meeting'}</div>
          <button onClick={copyCode} title="Copy meeting code" className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono flex items-center gap-1 shrink-0">{meeting?.code}{codeCopied ? <Check size={12} /> : <Copy size={12} />}</button>
          <div className="bg-white/10 px-2 py-0.5 rounded text-xs font-mono shrink-0">{formattedTime}</div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className={`capture-pill capture-${micEnabled ? capture.status : 'idle'}`} title="Speech recognition status">{!micEnabled ? 'Mic off' : capture.status === 'listening' ? '● Transcribing' : capture.status === 'processing' ? 'Processing audio…' : capture.status === 'reconnecting' ? 'Speech reconnecting…' : capture.status === 'offline' ? 'Offline' : capture.status === 'error' ? 'Speech error' : 'Starting…'}</span>
          {translationState && <span className={`capture-pill ${translationState.cls} hidden sm:inline-flex`} title="Translation status">{translationState.text}</span>}
          <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" className="text-gray-400 hover:text-white transition p-2 rounded-full hover:bg-white/10">{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          <div className={`flex items-center gap-2 text-sm font-medium ${conn.cls}`} role="status"><div className="w-2 h-2 rounded-full bg-current" />{conn.text}</div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto relative">
          {capture.fatal && (
            <div role="alert" className="room-banner room-banner-fatal">
              <AlertTriangle size={16} /><span>{capture.fatal.message}</span>
              <span className="room-banner-actions">
                {capture.fatal.code === 'browser_speech_unreachable' && engine === 'browser' && caps?.speechToText.configured && <button onClick={() => { setEngine('server'); capture.retry(); }}>Switch to server engine</button>}
                <button onClick={capture.retry}>Retry</button>
              </span>
            </div>
          )}
          {[meetingError, session.error, capture.error, session.connection === 'reconnecting' ? 'Connection lost. Reconnecting… captions you missed will be restored.' : ''].filter(Boolean).map((msg, i) => (
            <div key={i} role="alert" className="room-banner"><AlertTriangle size={16} /><span>{msg}</span>
              {msg === capture.error && <button onClick={capture.clearError} aria-label="Dismiss"><X size={14} /></button>}
              {msg === meetingError && <button onClick={() => setMeetingError('')} aria-label="Dismiss"><X size={14} /></button>}
            </div>
          ))}
          <div className="grid gap-4 w-full grid-cols-2 lg:grid-cols-3 flex-1 auto-rows-fr">
            {people.map(p => {
              const isSelf = p.userId === selfId; const pr = presenceById.get(p.userId);
              return (
                <div key={p.userId} className={`relative rounded-2xl overflow-hidden bg-gray-900 shadow-xl border-2 min-h-[160px] ${isSelf ? 'border-primary-500 glow' : 'border-transparent'}`}>
                  {isSelf && camEnabled && stream ? (
                    <VideoComponent stream={stream} className="w-full h-full object-cover transform -scale-x-100" muted />
                  ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center bg-gray-800 bg-gradient-to-br from-gray-800 to-gray-900 ${!isSelf && !pr ? 'opacity-50' : ''}`}>
                      <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-3">{initials(p.name)}</div>
                      <div className="text-lg text-white font-medium">{p.name}</div>
                      {!isSelf && !pr && <div className="text-xs text-gray-400 mt-1">Not connected</div>}
                    </div>
                  )}
                  {(isSelf ? handRaised : pr?.handRaised) && <div className="absolute top-4 right-4 bg-yellow-500 text-black p-2 rounded-full shadow-lg animate-bounce"><Hand size={20} /></div>}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                    {(isSelf ? micEnabled : pr?.micOn) ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-red-400" />}
                    {p.name}{isSelf && ' (You)'}{p.role === 'host' && ' · Host'}
                  </div>
                </div>
              );
            })}
          </div>

          {captionsOn && (livePartial ? (
            <LiveCaptions speaker={livePartial.speaker} isSelf={livePartial.speaker.id === selfId} original={livePartial.text} originalLanguage={langLabel(livePartial.sourceLanguage, languages)} targetLanguage={captionLanguageName} isFinal={false} sameLanguage={false} />
          ) : lastFinal && (
            <LiveCaptions speaker={lastFinal.speaker} isSelf={lastFinal.speaker.id === selfId} original={lastFinal.text} originalLanguage={langLabel(lastFinal.sourceLanguage, languages)} targetLanguage={captionLanguageName}
              isFinal sameLanguage={lastFinal.sourceLanguage === session.captionLanguage} translation={lastFinal.translations[session.captionLanguage]}
              onRetry={() => void session.retryTranslation(lastFinal, session.captionLanguage)} />
          ))}
        </div>

        {activePanel && (
          <aside className="room-panel border-l border-white/10 bg-[#09090b]/95 backdrop-blur-xl flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 font-medium text-lg">
              {activePanel === 'chat' && 'In-meeting messages'}{activePanel === 'participants' && 'People'}{activePanel === 'captions' && 'Captions & transcript'}
              <button onClick={() => setActivePanel(null)} aria-label="Close panel" className="text-gray-400 hover:text-white"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activePanel === 'chat' && <ChatPanel messages={session.chat} selfId={selfId} connected={session.connection === 'connected'} onSend={session.sendChat} />}
              {activePanel === 'participants' && <ParticipantsPanel meeting={meeting} presence={session.presence} selfId={selfId} />}
              {activePanel === 'captions' && <CaptionsPanel segments={segments} languages={languages} selfId={selfId} captionLanguage={session.captionLanguage} onCaptionLanguage={c => void session.setCaptionLanguage(c)} onRetry={(s, l) => void session.retryTranslation(s, l)} engine={engine} onEngine={setEngine} serverAvailable={Boolean(caps?.speechToText.configured)} captureStatus={capture.status} unsent={capture.unsent} sttNote={sttNote} />}
            </div>
          </aside>
        )}
      </div>

      <footer className="h-20 bg-black/60 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-3 px-6 z-30 flex-wrap">
        <button onClick={toggleMic} title={micEnabled ? 'Mute' : 'Unmute'} aria-label={micEnabled ? 'Mute' : 'Unmute'} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${micEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}>{micEnabled ? <Mic size={20} /> : <MicOff size={20} />}</button>
        <button onClick={toggleCam} title={camEnabled ? 'Stop video' : 'Start video'} aria-label={camEnabled ? 'Stop video' : 'Start video'} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'}`}>{camEnabled ? <Video size={20} /> : <VideoOff size={20} />}</button>
        <div className="w-px h-8 bg-white/20 mx-2" />
        <button onClick={() => setHandRaised(h => !h)} title={handRaised ? 'Lower hand' : 'Raise hand'} aria-label="Raise hand" className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${handRaised ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-white/10 hover:bg-white/20'}`}><Hand size={20} /></button>
        <button onClick={() => setActivePanel(p => (p === 'chat' ? null : 'chat'))} title="Chat" aria-label="Chat" className={panelBtn('chat')}><MessageSquare size={20} /></button>
        <button onClick={() => setActivePanel(p => (p === 'participants' ? null : 'participants'))} title="Participants" aria-label="Participants" className={panelBtn('participants')}><Users size={20} /></button>
        <button onClick={() => setActivePanel(p => (p === 'captions' ? null : 'captions'))} title="Captions, transcript and language" aria-label="Captions panel" className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg border ${activePanel === 'captions' ? 'bg-accent-600 border-accent-500 text-white' : 'bg-white/5 border-accent-500/30 text-accent-400 hover:bg-accent-600/20'}`}><Globe size={24} /></button>
        <button onClick={() => setCaptionsOn(c => !c)} title={captionsOn ? 'Hide live captions' : 'Show live captions'} aria-label="Toggle live captions" aria-pressed={captionsOn} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${captionsOn ? 'bg-primary-600/20 text-primary-400 border border-primary-500/50' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}><Captions size={20} /></button>
        <div className="w-px h-8 bg-white/20 mx-2" />
        {isHost && <button onClick={() => void handleEnd()} className="h-10 px-5 rounded-full flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-red-500/40 text-red-300 font-medium"><StopCircle size={18} />End for all</button>}
        <button onClick={() => void handleLeave()} className="h-10 px-6 rounded-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 transition-all font-medium shadow-lg shadow-red-600/20"><PhoneOff size={18} />Leave</button>
      </footer>
    </div>
  );
}
