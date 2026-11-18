import type { SegmentTranslation } from '../../types';
import { speakerColor } from '../../utils/speakers';
import TranslationLine from './TranslationLine';

interface CaptionProps {
  speaker: { id: string; name: string };
  isSelf: boolean;
  original: string;
  originalLanguage: string;      // e.g. "Hindi"
  targetLanguage: string;        // e.g. "English"
  isFinal: boolean;
  translation?: SegmentTranslation;
  sameLanguage: boolean;         // original already is the caption language
  onRetry?: () => void;
}

/** Overlay with the current caption. Speaker name/colour is stable; original and translation are labelled and separate. */
export default function LiveCaptions({ speaker, isSelf, original, originalLanguage, targetLanguage, isFinal, translation, sameLanguage, onRetry }: CaptionProps) {
  if (!original) return null;
  const color = speakerColor(speaker.id);
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-3xl px-3 sm:px-4 z-40 pointer-events-none" aria-live="polite">
      <div className="live-caption pointer-events-auto" style={{ borderLeftColor: color.fg }}>
        <div className="live-caption-head">
          <span className="speaker-chip" style={{ color: color.fg, background: color.bg }}>{speaker.name}{isSelf && ' (you)'}</span>
          <span className={`caption-badge ${isFinal ? 'caption-badge-final' : 'caption-badge-partial'}`}>{isFinal ? 'Final' : 'Listening…'}</span>
        </div>
        <div className="caption-line caption-original"><span className="caption-lang">{originalLanguage}</span>{original}</div>
        {isFinal && !sameLanguage && <TranslationLine translation={translation} label={targetLanguage} onRetry={onRetry} />}
        {!isFinal && <div className="caption-line caption-note">Partial text — the translation appears once the sentence is complete.</div>}
      </div>
    </div>
  );
}
