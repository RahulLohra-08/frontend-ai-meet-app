import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, ArrowUpRight, AudioLines, Check, CheckCircle2, CheckSquare, CircleHelp, Clock3, Download, FileText, ListChecks, Pencil, Plus, RefreshCw, Sparkles, StopCircle, Target, Trash2, Users } from 'lucide-react';
import { api } from '../services/api';
import { useLanguages } from '../hooks/useMeta';
import { langLabel } from '../utils/format';
import { groupBySpeaker, speakerColor } from '../utils/speakers';
import type { ActionItem, Meeting, Priority, Summary, TaskStatus, WireSegment } from '../types';

const SOURCE_LABEL = { ai_suggested: 'AI suggested', user_confirmed: 'Confirmed', manual: 'Added by you' } as const;
const STATUS_LABEL: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

export default function MeetingSummary() {
  const navigate = useNavigate(); const { id = '' } = useParams(); const languages = useLanguages();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [segments, setSegments] = useState<WireSegment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<ActionItem[]>([]);
  const [lang, setLang] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const enc = encodeURIComponent(id);

  const loadTranscripts = useCallback(async (language: string) => {
    const all: WireSegment[] = [];
    for (let page = 1; page <= 100; page++) {
      const r = await api<{ transcripts: WireSegment[] }>(`/meetings/${enc}/transcripts?page=${page}&limit=100${language ? `&lang=${language}` : ''}`);
      all.push(...r.transcripts); if (r.transcripts.length < 100) break;
    }
    return all;
  }, [enc]);

  const loadAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const m = await api<{ meeting: Meeting }>(`/meetings/${enc}`);
      setMeeting(m.meeting);
      const language = lang || m.meeting.targetLanguage;
      setLang(language);
      const [t, s, a] = await Promise.all([loadTranscripts(language), api<{ summary: Summary | null }>(`/meetings/${enc}/summary`), api<{ actionItems: ActionItem[] }>(`/meetings/${enc}/action-items`)]);
      setSegments(t); setSummary(s.summary); setItems(a.actionItems);
    } catch (e) { setError(e instanceof Error ? e.message : 'Meeting details could not be loaded.'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc, loadTranscripts]);
  useEffect(() => { void loadAll(); }, [loadAll]);

  // Switching the language only reloads the transcript (translations are stored per language).
  const changeLang = async (code: string) => { setLang(code); try { setSegments(await loadTranscripts(code)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load translations.'); } };

  // While the server is writing the notes, poll until it finishes (also refreshes the suggested tasks).
  useEffect(() => {
    if (summary?.status !== 'processing') return;
    const t = setInterval(async () => {
      try {
        const s = await api<{ summary: Summary | null }>(`/meetings/${enc}/summary`);
        setSummary(s.summary);
        if (s.summary?.status !== 'processing') setItems((await api<{ actionItems: ActionItem[] }>(`/meetings/${enc}/action-items`)).actionItems);
      } catch { /* keep polling */ }
    }, 2500);
    return () => clearInterval(t);
  }, [summary?.status, enc]);

  const generate = async () => {
    if (busy) return; setBusy(true); setError('');
    try { const r = await api<{ summary: Summary }>(`/meetings/${enc}/summarize`, { method: 'POST', body: JSON.stringify({}) }); setSummary(r.summary); }
    catch (e) { setError(e instanceof Error ? e.message : 'AI notes generation failed.'); } finally { setBusy(false); }
  };
  const endMeeting = async () => {
    if (!window.confirm('End this meeting for everyone?')) return;
    setBusy(true);
    try { const r = await api<{ meeting: Meeting }>(`/meetings/${enc}/end`, { method: 'POST' }); setMeeting(r.meeting); setTimeout(() => void loadAll(), 800); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not end the meeting.'); } finally { setBusy(false); }
  };

  // ---------- action items ----------
  const patchItem = async (task: ActionItem, body: Record<string, unknown>) => {
    try { const r = await api<{ actionItem: ActionItem }>(`/action-items/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) }); setItems(cur => cur.map(i => (i.id === task.id ? r.actionItem : i))); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Task update failed.'); return false; }
  };
  const removeItem = async (task: ActionItem) => {
    if (!window.confirm('Delete this action item?')) return;
    try { await api(`/action-items/${task.id}`, { method: 'DELETE' }); setItems(cur => cur.filter(i => i.id !== task.id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Task could not be deleted.'); }
  };
  const addItem = async (body: Record<string, unknown>) => {
    try { const r = await api<{ actionItem: ActionItem }>(`/meetings/${enc}/action-items`, { method: 'POST', body: JSON.stringify(body) }); setItems(cur => [r.actionItem, ...cur]); setAdding(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Task could not be created.'); }
  };
  const jumpTo = (seq: number) => { const el = transcriptRef.current?.querySelector(`[data-seq="${seq}"]`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const exportTranscript = () => {
    const lines = segments.map(t => `[${new Date(t.occurredAt).toLocaleString()}] ${t.speaker.name} (${langLabel(t.sourceLanguage, languages)}):\nOriginal: ${t.text}\n${t.translation ? `Translation (${langLabel(t.translation.targetLanguage, languages)}): ${t.translation.text}\n` : ''}`);
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `${meeting?.code || id}_transcript.txt`; a.click(); URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => items.filter(i => filter === 'all' || (filter === 'done' ? i.status === 'done' : i.status !== 'done')), [items, filter]);
  const doneCount = items.filter(a => a.status === 'done').length;
  // Notes from an earlier successful run stay visible even if a later regeneration failed.
  const hasContent = Boolean(summary?.content && (summary.content.executiveSummary || summary.content.overview || summary.content.keyPoints?.length));
  const notes = hasContent && summary?.status !== 'processing' ? summary?.content : undefined;
  const failHelp: Record<string, string> = {
    QUOTA_EXCEEDED: 'The AI provider account has no credit. Add billing/credit, then press Try again.',
    RATE_LIMITED: 'The provider is rate limiting. Wait a minute and press Try again; set LLM_MAX_RPM lower or add a fallback provider if this repeats.',
    NOT_CONFIGURED: 'No valid AI key is configured on the server (Settings → Test providers).',
    NO_TRANSCRIPT: 'Nothing was transcribed in this meeting.'
  };
  const transcriptGroups = groupBySpeaker(segments);
  const isHost = Boolean(meeting?.isHost); const ended = meeting?.status === 'completed';
  const processing = summary?.status === 'processing';

  return <div className="summary-shell"><header className="summary-topbar"><button onClick={() => navigate('/dashboard')} className="summary-back"><ArrowLeft size={17} /> Workspace</button><div className="summary-brand"><span className="brand-mark"><Sparkles size={17} /></span> Meeting recap</div><button onClick={exportTranscript} disabled={!segments.length} className="button button-secondary button-small"><Download size={15} /> Export transcript</button></header>
    <main className="summary-main">
      <motion.div className="summary-heading" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div><div className="eyebrow">YOUR MEETING RECAP</div><h1>{meeting?.title || <>Good conversations<br /><em>deserve clear takeaways.</em></>}</h1>
          <p className="summary-meeting-id"><span className="summary-id-icon"><FileText size={16} /></span> Code <strong>{meeting?.code || id}</strong><span>·</span> {segments.length} transcript segment{segments.length === 1 ? '' : 's'}<span>·</span> {meeting?.status || '…'}</p></div>
        {isHost && !ended && <button onClick={() => void endMeeting()} disabled={busy} className="button button-secondary summary-generate"><StopCircle size={17} /> End meeting for all</button>}
        {isHost && ended && <button onClick={() => void generate()} disabled={busy || processing || !segments.length} className="button button-primary summary-generate"><Sparkles size={17} />{processing ? 'Creating your notes…' : notes || summary?.status === 'failed' ? 'Regenerate AI notes' : 'Generate AI notes'} <ArrowUpRight size={15} /></button>}
      </motion.div>
      {error && <div className="summary-error" role="alert">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {loading ? <div className="summary-loading"><RefreshCw size={18} className="spin-icon" /> Loading meeting data…</div> : <>
        <div className="summary-metrics"><div><span className="metric-icon"><FileText size={17} /></span><span><small>Transcript segments</small><strong>{segments.length}</strong></span></div><div><span className="metric-icon metric-icon-mint"><ListChecks size={17} /></span><span><small>Action items</small><strong>{items.length}</strong></span></div><div><span className="metric-icon metric-icon-peach"><CheckSquare size={17} /></span><span><small>Tasks completed</small><strong>{doneCount}<small className="metric-of"> / {items.length}</small></strong></span></div></div>
        <div className="summary-layout"><div className="summary-primary-column">
          <motion.section className="summary-card ai-summary-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }}>
            <div className="summary-card-heading"><span className="summary-section-icon summary-section-purple"><Sparkles size={18} /></span><div><h2>AI meeting notes</h2><p>Generated only from the saved transcript</p></div>{notes && <span className="ai-generated-tag">AI generated{summary?.provider === 'dev-mock' ? ' · DEV MOCK' : ''}</span>}</div>
            {processing && <div className="notes-empty"><span className="notes-empty-icon"><RefreshCw size={22} className="spin-icon" /></span><h3>Writing your notes…</h3><p>This usually takes under a minute. You can leave this page; the notes will be saved.</p></div>}
            {summary?.status === 'failed' && <div className={hasContent ? 'notes-failed-banner' : 'notes-empty'}><span className="notes-empty-icon notes-empty-bad"><AlertTriangle size={22} /></span><h3>{hasContent ? 'Regeneration failed — showing the previous notes' : 'Notes could not be generated'}</h3><p>{summary.error || 'The AI provider returned an error.'}</p>{summary.errorCode && failHelp[summary.errorCode] && <p className="fail-help">{failHelp[summary.errorCode]}</p>}{summary.provider && <small>Provider: {summary.provider}{summary.model ? ` · ${summary.model}` : ''} · {summary.attempts ?? 0} attempt(s){summary.retryable === false ? ' · retrying will not help until the cause is fixed' : ''}</small>}{isHost && ended && <button onClick={() => void generate()} disabled={busy} className="button button-primary"><RefreshCw size={15} /> Try again</button>}</div>}
            {!summary && <div className="notes-empty"><span className="notes-empty-icon"><Sparkles size={22} /></span><h3>Your takeaways will appear here</h3><p>{!ended ? 'Notes are created after the host ends the meeting.' : isHost ? 'Generate notes from the saved transcript to see key points, decisions and next steps.' : 'The host has not generated notes yet.'}</p>{isHost && ended && <button onClick={() => void generate()} disabled={busy || !segments.length} className="button button-primary"><Sparkles size={15} />Generate AI notes</button>}{!segments.length && <small>There are no saved transcript segments yet.</small>}</div>}
            {notes && <div className="ai-notes-content">
              {(notes.executiveSummary || notes.overview) && <div className="executive-summary"><span className="content-kicker">{notes.overview && notes.executiveSummary ? 'OVERVIEW' : 'AT A GLANCE'}</span>{notes.overview && <p>{notes.overview}</p>}{notes.executiveSummary && <><span className="content-kicker" style={{ display: 'block', marginTop: 14 }}>EXECUTIVE SUMMARY</span><p>{notes.executiveSummary}</p></>}</div>}
              <NotesList icon={<Target size={15} />} title="Discussion topics" chips={notes.discussionTopics} />
              <NotesList icon={<CheckCircle2 size={15} />} title="Key points" items={notes.keyPoints} check />
              <NotesList icon={<CheckSquare size={15} />} title="Decisions made" items={notes.decisions} check empty="No explicit decisions were recorded." />
              <NotesList icon={<CircleHelp size={15} />} title="Open questions" items={notes.unresolvedQuestions} />
              <NotesList icon={<ArrowUpRight size={15} />} title="Suggested next steps" items={notes.nextSteps} />
            </div>}
          </motion.section>
          <motion.section className="summary-card transcript-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
            <div className="summary-card-heading"><span className="summary-section-icon summary-section-blue"><AudioLines size={18} /></span><div><h2>Transcript</h2><p>Original text with stored translations</p></div>
              <select className="mini-select" value={lang} onChange={e => void changeLang(e.target.value)} aria-label="Translation language">{languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></div>
            {segments.length ? <div className="transcript-list" ref={transcriptRef}>{transcriptGroups.map((g, gi) => { const color = speakerColor(g.speaker.id); return <section className="speaker-block" key={`${g.speaker.id}-${gi}`} style={{ borderLeftColor: color.fg }}><header><span className="speaker-chip speaker-chip-light" style={{ color: color.fg, background: color.bg }}>{g.speaker.name}</span><span className="speaker-time"><Clock3 size={12} />{new Date(g.items[0].occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></header>{g.items.map(t => <article className="transcript-entry" key={t.id} data-seq={t.seq}><div className="transcript-entry-body"><p><span className="lang-tag">{langLabel(t.sourceLanguage, languages)} · original</span>{t.text}<small className="seq-chip">#{t.seq} · {new Date(t.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small></p>{t.translation ? <div className="translated-line"><span>{langLabel(t.translation.targetLanguage, languages).toUpperCase()} TRANSLATION</span>{t.translation.text}</div> : t.sourceLanguage !== lang && <div className="translated-line translated-missing">No {langLabel(lang, languages)} translation stored for this segment.</div>}</div></article>)}</section>; })}</div> : <div className="inline-empty">No transcript has been saved for this meeting yet.</div>}
          </motion.section>
        </div>
        <aside className="summary-aside"><section className="summary-card action-card"><div className="summary-card-heading"><span className="summary-section-icon summary-section-mint"><ListChecks size={18} /></span><div><h2>Action items</h2><p>Track the follow-through</p></div><button className="icon-button" onClick={() => setAdding(a => !a)} aria-label="Add action item"><Plus size={17} /></button></div>
          {adding && <TaskForm meeting={meeting} onSubmit={addItem} onCancel={() => setAdding(false)} />}
          {items.length > 0 && <><div className="task-progress"><div className="task-progress-label"><span>Progress</span><strong>{doneCount} of {items.length}</strong></div><div className="task-progress-track"><span style={{ width: `${items.length ? doneCount / items.length * 100 : 0}%` }} /></div></div>
            <div className="task-filters">{(['all', 'open', 'done'] as const).map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div></>}
          {visible.length ? <ul className="action-list">{visible.map(task => <li key={task.id} className={task.status === 'done' ? 'task-done' : ''}>
            <button className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`} onClick={() => void patchItem(task, { status: task.status === 'done' ? 'todo' : 'done' })} aria-label={task.status === 'done' ? 'Mark task incomplete' : 'Mark task complete'}>{task.status === 'done' && <Check size={13} />}</button>
            <div className="task-copy">{editing === task.id ? <TaskForm meeting={meeting} task={task} onSubmit={async b => { if (await patchItem(task, b)) setEditing(null); }} onCancel={() => setEditing(null)} /> : <>
              <p>{task.description}</p>
              <div className="task-meta"><span className={`source-tag source-${task.source}`}>{SOURCE_LABEL[task.source]}</span><span className={`priority-tag priority-${task.priority}`}>{task.priority}</span><span>{STATUS_LABEL[task.status]}</span>
                {task.assignedTo ? <span>→ {task.assignedTo.name}</span> : task.assigneeHint ? <span title="Name heard in the meeting; not matched to a participant">→ {task.assigneeHint}?</span> : <span>Unassigned</span>}
                {task.dueDate ? <span>Due {new Date(task.dueDate).toLocaleDateString()}</span> : <span>No due date</span>}
                {task.transcriptSeqs.map(n => <button key={n} className="seq-chip seq-link" onClick={() => jumpTo(n)} title="Jump to transcript">#{n}</button>)}</div>
              <div className="task-actions">{task.source === 'ai_suggested' && <button onClick={() => void patchItem(task, { status: task.status })}><Check size={12} /> Confirm</button>}<button onClick={() => setEditing(task.id)}><Pencil size={12} /> Edit</button><button onClick={() => void removeItem(task)}><Trash2 size={12} /> Delete</button></div></>}
            </div></li>)}</ul> : !adding && <div className="action-empty"><ListChecks size={23} /><p>{items.length ? 'No tasks match this filter.' : 'No action items yet. Add one, or generate AI notes to get suggestions.'}</p></div>}
          <div className="review-note"><Sparkles size={14} /><p>AI suggestions are not commitments until someone confirms or edits them. Owners and dates are only filled in when they were stated in the meeting.</p></div></section>
          <section className="summary-card meeting-details-card"><div className="summary-card-heading"><span className="summary-section-icon summary-section-sand"><Users size={17} /></span><div><h2>Meeting details</h2><p>Saved conversation record</p></div></div>
            <div className="detail-row"><span>Languages</span><strong>{langLabel(meeting?.sourceLanguage, languages)} → {langLabel(meeting?.targetLanguage, languages)}</strong></div>
            <div className="detail-row"><span>Participants</span><strong>{meeting?.participants.map(p => p.name).join(', ')}</strong></div>
            <div className="detail-row"><span>AI notes</span><strong className={notes ? 'detail-ready' : ''}>{summary ? (summary.status === 'completed' ? 'Available' : summary.status) : 'Not generated'}</strong></div></section>
        </aside></div></>}
    </main></div>;
}

function NotesList({ icon, title, items, chips, check, empty }: { icon: React.ReactNode; title: string; items?: string[]; chips?: string[]; check?: boolean; empty?: string }) {
  const list = chips || items || [];
  if (!list.length) return empty ? <div className="notes-block"><h3>{icon} {title}</h3><p className="notes-none">{empty}</p></div> : null;
  return <div className="notes-block"><h3>{icon} {title}</h3>{chips ? <div className="topic-chips">{list.map((x, i) => <span key={i}>{x}</span>)}</div> : <ul className="notes-list">{list.map((x, i) => <li key={i}>{check ? <span className="list-check"><Check size={12} /></span> : <span className="list-bullet" />}{x}</li>)}</ul>}</div>;
}

function TaskForm({ meeting, task, onSubmit, onCancel }: { meeting: Meeting | null; task?: ActionItem; onSubmit: (body: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignedTo?.id || '');
  const [due, setDue] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '');
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo');
  const [saving, setSaving] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (saving || !description.trim()) return; setSaving(true);
    const body: Record<string, unknown> = { description: description.trim(), assignedTo: assignee || null, dueDate: due ? new Date(`${due}T00:00:00.000Z`).toISOString() : null, priority };
    if (task) body.status = status;
    await onSubmit(body); setSaving(false);
  };
  return <form className="task-form" onSubmit={e => void submit(e)}>
    <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} required rows={2} placeholder="What needs to happen?" aria-label="Task description" />
    <div className="task-form-grid">
      <select value={assignee} onChange={e => setAssignee(e.target.value)} aria-label="Assignee"><option value="">Unassigned</option>{meeting?.participants.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}</select>
      <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="Due date" />
      <select value={priority} onChange={e => setPriority(e.target.value as Priority)} aria-label="Priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      {task && <select value={status} onChange={e => setStatus(e.target.value as TaskStatus)} aria-label="Status"><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select>}
    </div>
    <div className="task-form-actions"><button type="button" className="button button-secondary button-small" onClick={onCancel}>Cancel</button><button className="button button-primary button-small" disabled={saving}>{saving ? 'Saving…' : task ? 'Save' : 'Add task'}</button></div>
  </form>;
}
