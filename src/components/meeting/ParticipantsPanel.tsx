import { useState } from 'react';
import { Mic, MicOff, Hand, Copy, Check } from 'lucide-react';
import type { Meeting, PresenceEntry } from '../../types';
import { initials } from '../../utils/format';

export default function ParticipantsPanel({ meeting, presence, selfId }: { meeting: Meeting | null; presence: PresenceEntry[]; selfId: string }) {
  const [copied, setCopied] = useState(false);
  if (!meeting) return <div className="p-4 text-sm text-gray-400">Loading participants…</div>;
  const online = new Map(presence.map(p => [p.userId, p]));
  const link = `${window.location.origin}/meeting/${meeting.code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt('Copy this link', link); } };
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/10 space-y-2">
        <div className="text-xs text-gray-400">Meeting code <strong className="font-mono text-white tracking-wider">{meeting.code}</strong></div>
        <button onClick={copy} className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
          {copied ? <><Check size={14} /> Link copied</> : <><Copy size={14} /> Copy invite link</>}
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {meeting.participants.map(p => {
          const pr = online.get(p.userId); const isOnline = Boolean(pr);
          return (
            <li key={p.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full bg-primary-900 text-primary-300 flex items-center justify-center font-bold text-xs">
                  {initials(p.name)}
                  <span className={`presence-dot ${isOnline ? 'presence-on' : 'presence-off'}`} title={isOnline ? 'In the room' : 'Not connected'} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{p.name}{p.userId === selfId && ' (You)'}</div>
                  <div className="text-[10px] text-gray-500">{p.role === 'host' ? 'Host' : 'Participant'} · {isOnline ? 'online' : 'offline'} · captions {p.captionLanguage.toUpperCase()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                {pr?.handRaised && <Hand size={14} className="text-yellow-400" />}
                {pr?.micOn ? <Mic size={14} className="text-green-400" /> : <MicOff size={14} className="text-gray-500" />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
