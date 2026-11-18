import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface Props { messages: ChatMessage[]; selfId: string; connected: boolean; onSend: (text: string) => Promise<{ ok: boolean; error?: string }> }

/** Live chat over Socket.IO. Messages are ephemeral (not stored) and only reach people in this meeting. */
export default function ChatPanel({ messages, selfId, connected, onSend }: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const submit = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setError('');
    const r = await onSend(text);
    setSending(false);
    if (r.ok) setInput(''); else setError(r.error || 'Message not sent.');
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && <p className="text-sm text-gray-400">No messages yet. Chat is shared live with people in this meeting and is not saved.</p>}
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.from.id === selfId ? 'items-end' : 'items-start'}`}>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-gray-300">{m.from.id === selfId ? 'You' : m.from.name}</span>
              <span className="text-[10px] text-gray-500">{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm break-words ${m.from.id === selfId ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm'}`}>{m.text}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="p-3 border-t border-white/10">
        {error && <p role="alert" className="text-xs text-red-300 mb-2">{error}</p>}
        <div className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2 border border-white/10">
          <input type="text" maxLength={500} disabled={!connected} placeholder={connected ? 'Send a message…' : 'Reconnecting…'}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-500" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && void submit()} aria-label="Chat message" />
          <button onClick={() => void submit()} disabled={!input.trim() || sending || !connected} aria-label="Send message"
            className={`transition-colors ${input.trim() ? 'text-primary-500 hover:text-primary-400' : 'text-gray-600'}`}><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
}
