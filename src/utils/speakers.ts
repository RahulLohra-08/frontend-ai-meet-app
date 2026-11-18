// Stable, subtle colour per speaker: derived from the authenticated user id, so it never changes between segments,
// reconnects or page reloads, and is identical for every participant.
const PALETTE = [
  { fg: '#6fb7a3', bg: 'rgba(111,183,163,0.14)' }, { fg: '#e0b27a', bg: 'rgba(224,178,122,0.14)' },
  { fg: '#9aa7e0', bg: 'rgba(154,167,224,0.14)' }, { fg: '#d99aaa', bg: 'rgba(217,154,170,0.14)' },
  { fg: '#b3a3d9', bg: 'rgba(179,163,217,0.14)' }, { fg: '#8fc0d6', bg: 'rgba(143,192,214,0.14)' },
  { fg: '#c4c27a', bg: 'rgba(196,194,122,0.14)' }, { fg: '#d6a58f', bg: 'rgba(214,165,143,0.14)' }
];
export function speakerColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Group consecutive items of the same speaker (a new group starts when the speaker changes). */
export function groupBySpeaker<T extends { speaker: { id: string; name: string } }>(items: T[]): { speaker: T['speaker']; items: T[] }[] {
  const groups: { speaker: T['speaker']; items: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.speaker.id === item.speaker.id) last.items.push(item);
    else groups.push({ speaker: item.speaker, items: [item] });
  }
  return groups;
}
