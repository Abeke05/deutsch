/**
 * Simple in-memory + sessionStorage cache for pronunciation audio URLs.
 * Avoids regenerating TTS for the same German word across the session.
 */

const memCache = new Map<string, string>();
const STORAGE_KEY = 'de_pronunciation_cache_v1';

function loadStorage(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveStorage(data: Record<string, string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

// Pre-hydrate mem cache from sessionStorage on module load
const initial = loadStorage();
for (const [k, v] of Object.entries(initial)) {
  memCache.set(k, v);
}

function makeKey(text: string): string {
  return text.trim().toLowerCase();
}

export function getPronunciation(text: string): string | undefined {
  return memCache.get(makeKey(text));
}

export function setPronunciation(text: string, url: string) {
  const key = makeKey(text);
  memCache.set(key, url);
  const data = loadStorage();
  data[key] = url;
  saveStorage(data);
}