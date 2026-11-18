// Shared shapes. They mirror the backend contract documented in docs/ARCHITECTURE.md.
export type Role = 'user' | 'admin';
export interface AppUser { id: string; name: string; email: string; role: Role; preferredLanguage: string }
export interface Language { code: string; name: string; native: string; speech: string }

export interface MeetingParticipant { userId: string; name: string; role: 'host' | 'participant'; joinedAt?: string; leftAt?: string | null; captionLanguage: string }
export interface Meeting {
  _id: string; id: string; code: string; title: string; description?: string;
  status: 'scheduled' | 'live' | 'completed';
  sourceLanguage: string; targetLanguage: string;
  requireInvite?: boolean; isHost: boolean; lastSeq: number;
  participants: MeetingParticipant[];
  host: { id: string; name: string };
  startedAt?: string; endedAt?: string; createdAt: string; updatedAt: string;
}

export type TranslationStatus = 'pending' | 'retrying' | 'translated' | 'same_language' | 'failed';
export interface SegmentTranslation { status: TranslationStatus; text?: string; provider?: string; message?: string; code?: string; retryable?: boolean; retryInMs?: number }
export interface Segment {
  id: string; seq: number; segmentId: string;
  speaker: { id: string; name: string; known?: boolean };
  text: string; sourceLanguage: string; detectedLanguage: string | null; selectedLanguage?: string;
  provider: string; occurredAt: string;
  /** keyed by target language code */
  translations: Record<string, SegmentTranslation>;
}
/** Segment as delivered by REST / socket (translation is a single optional object). */
export interface WireSegment extends Omit<Segment, 'translations'> {
  translation?: { text: string; targetLanguage: string; provider: string } | null;
}
export interface PartialCaption { segmentId: string; speaker: { id: string; name: string }; text: string; sourceLanguage: string; at: number }
export interface TranslationEvent { meetingId: string; segmentId: string; seq: number; language: string; status: 'translated' | 'same_language' | 'failed' | 'retrying'; text?: string; provider?: string; code?: string; message?: string; retryable?: boolean; retryInMs?: number }

export interface PresenceEntry { userId: string; name: string; online: boolean; micOn: boolean; handRaised: boolean; speaking: boolean; captionLanguage: string }
export interface ChatMessage { id: string; from: { id: string; name: string }; text: string; at: number }

export interface SummaryContent {
  overview?: string; executiveSummary?: string; discussionTopics?: string[]; keyPoints?: string[];
  decisions?: string[]; unresolvedQuestions?: string[]; nextSteps?: string[];
}
export interface Summary { status: 'processing' | 'completed' | 'failed'; content?: SummaryContent; error?: string; errorCode?: string; retryable?: boolean; attempts?: number; provider?: string; model?: string; completedAt?: string }

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export interface ActionItem {
  id: string; meetingId: string; description: string;
  assignedTo: { id: string; name: string } | null; assigneeHint?: string;
  dueDate: string | null; priority: Priority; status: TaskStatus;
  source: 'ai_suggested' | 'user_confirmed' | 'manual'; transcriptSeqs: number[];
}
export interface Capabilities {
  speechToText: { provider: string; configured: boolean };
  translation: { provider: string; configured: boolean; devMock: boolean };
  notes: { provider: string; configured: boolean; model?: string };
  devMockProviders: boolean;
}
