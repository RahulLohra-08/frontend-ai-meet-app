import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Capabilities, Language } from '../types';

let languagesCache: Language[] | null = null;
export function useLanguages(): Language[] {
  const [languages, setLanguages] = useState<Language[]>(languagesCache || []);
  useEffect(() => {
    if (languagesCache) return;
    api<{ languages: Language[] }>('/languages').then(r => { languagesCache = r.languages; setLanguages(r.languages); }).catch(() => { /* UI shows an empty list + the API error elsewhere */ });
  }, []);
  return languages;
}

export function useCapabilities(): Capabilities | null {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => { api<Capabilities>('/capabilities').then(setCaps).catch(() => setCaps(null)); }, []);
  return caps;
}
