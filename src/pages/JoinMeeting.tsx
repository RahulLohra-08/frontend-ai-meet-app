import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Video, ArrowRight } from 'lucide-react';

/** Accepts a bare 8-character code or a pasted meeting link and opens the lobby (login is enforced by the route guard). */
export function extractMeetingCode(input: string): string | null {
  const last = input.trim().split(/[/?#]/).filter(Boolean).filter(p => p.toLowerCase() !== 'summary').pop() || '';
  const code = last.toUpperCase();
  return /^[A-F0-9]{8}$/.test(code) || /^[A-F0-9]{24}$/.test(code) ? code : null;
}

export default function JoinMeeting() {
  const navigate = useNavigate();
  const [code, setCode] = useState(''); const [error, setError] = useState('');
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = extractMeetingCode(code);
    if (!parsed) { setError('Enter the 8-character meeting code (for example 3F9A1C7B) or paste the meeting link.'); return; }
    navigate(`/meeting/${parsed}`);
  };
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <nav className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 relative z-10 w-fit"><img src="/logo.png" alt="Lingua Meet" className="h-20 w-20 rounded-full object-contain bg-white p-2 shadow-md" /></Link>
          <Link to="/dashboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Dashboard</Link>
        </div>
      </nav>
      <main className="flex-1 flex items-center justify-center p-8 bg-[#020617] relative overflow-hidden">
        <div className="w-full max-w-md relative z-10">
          <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary-500/10 mx-auto"><Video size={32} className="text-primary-500" /></div>
          <h1 className="text-3xl font-bold mb-2 text-white text-center">Join a meeting</h1>
          <p className="text-gray-400 mb-8 text-center">Enter your meeting code or paste the invite link.</p>
          <form onSubmit={handleJoin} className="space-y-6">
            <input type="text" required value={code} onChange={e => { setCode(e.target.value); setError(''); }} aria-label="Meeting code or link"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-center text-xl font-medium tracking-wider text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder-gray-600" placeholder="3F9A1C7B" />
            {error && <p role="alert" className="text-sm text-red-400 text-center">{error}</p>}
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-500 text-white rounded-xl px-4 py-4 font-bold transition-colors shadow-lg shadow-primary-600/20 flex justify-center items-center gap-2">Continue <ArrowRight size={18} /></button>
          </form>
          <div className="mt-8 text-center text-sm text-gray-500">Need an account? <Link to="/signup" className="text-primary-400 hover:text-primary-300 font-medium">Sign up for free</Link></div>
        </div>
      </main>
    </div>
  );
}
