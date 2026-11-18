import { RefreshCw } from 'lucide-react';
import type { SegmentTranslation } from '../../types';

interface Props { translation?: SegmentTranslation; label: string; onRetry?: () => void; compact?: boolean }

const HELP: Record<string, string> = {
  QUOTA_EXCEEDED: 'The AI provider has no credit left. Add billing, then press Retry.',
  NOT_CONFIGURED: 'Translation is not configured on the server.',
  UNSUPPORTED_LANGUAGE: 'This language pair is not supported by the translation provider.'
};

/** One translated line with an explicit state: translating, retrying, failed (with reason) or done. Never blocks the original text. */
export default function TranslationLine({ translation: tr, label, onRetry, compact }: Props) {
  const retryButton = onRetry && <button onClick={onRetry} className="caption-retry"><RefreshCw size={11} /> Retry</button>;
  return (
    <div className={`tr-line ${compact ? 'tr-compact' : ''}`}>
      <span className="caption-lang">{label} translation</span>
      {tr?.status === 'translated' && <span className="tr-text">{tr.text}</span>}
      {(!tr || tr.status === 'pending') && <em className="tr-state">Translating…</em>}
      {tr?.status === 'retrying' && <em className="tr-state tr-warn">Provider is busy — retrying automatically{tr.retryInMs ? ` in ~${Math.max(1, Math.round(tr.retryInMs / 1000))}s` : ''}…</em>}
      {tr?.status === 'failed' && (
        <em className="tr-state tr-bad">
          Translation unavailable. {HELP[tr.code || ''] || tr.message || ''} {retryButton}
        </em>
      )}
    </div>
  );
}
