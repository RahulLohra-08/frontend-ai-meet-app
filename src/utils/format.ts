export const initials = (name: string) => (name || '?').split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase();
export const newSegmentId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
export const langLabel = (code: string | null | undefined, langs: { code: string; name: string }[]) => (code && langs.find(l => l.code === code)?.name) || (code ? code.toUpperCase() : 'Auto');
