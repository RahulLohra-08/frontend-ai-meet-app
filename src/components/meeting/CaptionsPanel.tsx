import { useEffect, useMemo, useRef } from 'react';
import type { Language, Segment } from '../../types';
import type { SpeechEngine, CaptureStatus } from '../../hooks/useSpeechCapture';
import { langLabel } from '../../utils/format';
import { groupBySpeaker, speakerColor } from '../../utils/speakers';
import TranslationLine from './TranslationLine';

interface Props {
  segments: Segment[]; languages: Language[]; selfId: string;
  captionLanguage: string; onCaptionLanguage: (code: string) => void;
  onRetry: (segment: Segment, language: string) => void;
  engine: SpeechEngine; onEngine: (e: SpeechEngine) => void; serverAvailable: boolean;
  captureStatus: CaptureStatus; unsent: number; sttNote?: string;
}

const STATUS_TEXT: Record<CaptureStatus, string> = { idle: 'Mic off', listening: 'Listening', processing: 'Transcribing…', reconnecting: 'Reconnecting…', offline: 'Offline', error: 'Speech error' };

/** Caption history grouped by speaker (stable colours), with original and translation shown separately. */
export default function CaptionsPanel({ segments, languages, selfId, captionLanguage, onCaptionLanguage, onRetry, engine, onEngine, serverAvailable, captureStatus, unsent, sttNote }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [segments.length]);
  const groups = useMemo(() => groupBySpeaker(segments), [segments]);
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 space-y-3">
        <label className="panel-field">Show captions in
          <select value={captionLanguage} onChange={e => onCaptionLanguage(e.target.value)}>
            {languages.map(l => <option key={l.code} value={l.code}>{l.name} ({l.native})</option>)}
          </select>
        </label>
        <div className="engine-toggle" role="group" aria-label="Speech engine">
          <button className={engine === 'browser' ? 'on' : ''} onClick={() => onEngine('browser')}>Browser</button>
          <button className={engine === 'server' ? 'on' : ''} onClick={() => onEngine('server')} disabled={!serverAvailable} title={serverAvailable ? '' : 'No STT_API_KEY configured on the server'}>Server</button>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className={`capture-pill capture-${captureStatus}`}>{STATUS_TEXT[captureStatus]}</span>
          {unsent > 0 && <span className="text-yellow-300">{unsent} waiting to send</span>}
        </div>
        {sttNote && <p className="text-xs text-gray-400">{sttNote}</p>}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {segments.length === 0 && <p className="text-sm text-gray-400">No speech yet. Unmute and speak: captions appear here and are saved to the meeting transcript.</p>}
        {groups.map((g, gi) => {
          const color = speakerColor(g.speaker.id);
          return (
            <section key={`${g.speaker.id}-${g.items[0].id}-${gi}`} className="speaker-group" style={{ borderLeftColor: color.fg }}>
              <header className="speaker-group-head">
                <span className="speaker-chip" style={{ color: color.fg, background: color.bg }}>{g.speaker.name}{g.speaker.id === selfId && ' (you)'}</span>
                <time className="text-[10px] text-gray-500">{time(g.items[0].occurredAt)}</time>
              </header>
              {g.items.map(s => {
                const same = s.sourceLanguage === captionLanguage;
                return (
                  <article key={s.id} className="speaker-line">
                    <p className="text-sm text-gray-200"><span className="caption-lang">{langLabel(s.sourceLanguage, languages)} · original</span>{s.text}<span className="seq-time">#{s.seq} · {time(s.occurredAt)}</span></p>
                    {!same && <TranslationLine compact translation={s.translations[captionLanguage]} label={langLabel(captionLanguage, languages)} onRetry={() => onRetry(s, captionLanguage)} />}
                  </article>
                );
              })}
            </section>
          );
        })}
        <div ref={end} />
      </div>
    </div>
  );
}
