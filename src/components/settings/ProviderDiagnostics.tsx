import { useState } from 'react';
import { api } from '../../services/api';

interface Check { verdict?: string; advice?: string; httpStatus?: number; providerMessage?: string; rateLimitHeaders?: Record<string, string> }
interface Llm extends Check { role?: string; provider?: string; model?: string; keyCheck?: Check; chatCheck?: Check }
interface Report { llm: Llm[]; speechToText: (Check & { provider?: string; model?: string; note?: string }) | null; translation: (Check & { provider?: string }) | null }

const tone = (v?: string) => (v === 'ok' ? 'diag-ok' : v === 'not_configured' || v === 'see llm' ? 'diag-neutral' : 'diag-bad');

/** Sends one tiny live request per provider and shows what the provider REALLY answered (invalid key, no credit, rate limit...). */
export default function ProviderDiagnostics() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async () => {
    if (busy) return; setBusy(true); setError('');
    try { setReport(await api<Report>('/diagnostics/providers', { method: 'POST' })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Check failed.'); } finally { setBusy(false); }
  };
  return (
    <div className="settings-card diag-card">
      <h3>Provider check</h3>
      <p className="small-note">Sends one tiny request to each configured provider and shows the provider's own answer. Costs a fraction of a cent.</p>
      <button className="button button-primary button-small" onClick={() => void run()} disabled={busy}>{busy ? 'Checking…' : 'Test providers'}</button>
      {error && <p role="alert" className="form-bad">{error}</p>}
      {report && (
        <ul className="diag-list">
          {report.llm.map((l, i) => (
            <li key={i} className={tone(l.chatCheck?.verdict || l.verdict)}>
              <strong>AI notes & translation{l.role ? ` (${l.role})` : ''}: {l.provider || 'not configured'} {l.model ? `· ${l.model}` : ''}</strong>
              <span>Key: {l.keyCheck?.verdict || l.verdict} {l.keyCheck?.httpStatus ? `(HTTP ${l.keyCheck.httpStatus})` : ''}</span>
              <span>Test request: {l.chatCheck?.verdict || '—'} {l.chatCheck?.httpStatus ? `(HTTP ${l.chatCheck.httpStatus})` : ''}</span>
              {l.chatCheck?.providerMessage && <span>Provider said: {l.chatCheck.providerMessage}</span>}
              {l.chatCheck?.rateLimitHeaders && Object.keys(l.chatCheck.rateLimitHeaders).length > 0 && <span>Limits: {Object.entries(l.chatCheck.rateLimitHeaders).map(([k, v]) => `${k.replace('x-ratelimit-', '')}=${v}`).join(', ')}</span>}
              <em>{l.chatCheck?.advice || l.advice}</em>
            </li>
          ))}
          {report.speechToText && <li className={tone(report.speechToText.verdict)}><strong>Server speech-to-text: {report.speechToText.provider || 'not configured'} {report.speechToText.model ? `· ${report.speechToText.model}` : ''}</strong><span>{report.speechToText.verdict}</span><em>{report.speechToText.advice}</em>{report.speechToText.note && <span>{report.speechToText.note}</span>}</li>}
          {report.translation && <li className={tone(report.translation.verdict)}><strong>Translation: {report.translation.provider}</strong><span>{report.translation.verdict}</span>{report.translation.advice && <em>{report.translation.advice}</em>}</li>}
        </ul>
      )}
    </div>
  );
}
