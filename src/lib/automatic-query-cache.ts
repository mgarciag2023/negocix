export const AUTOMATIC_QUERY_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

interface CacheEntry<T> { updatedAt: number; data: T }
const pending = new Map<string, Promise<unknown>>();

export async function cachedAutomaticQuery<T>(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  owner: string,
  dataset: string,
  fetcher: () => Promise<T>,
  manual = false,
  now = () => Date.now(),
): Promise<CacheEntry<T>> {
  const key = `negocix:auto-query:v1:${owner}:${dataset}`;
  if (!manual) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        const age = now() - entry.updatedAt;
        if (Number.isFinite(entry.updatedAt) && age >= 0 && age < AUTOMATIC_QUERY_INTERVAL_MS && 'data' in entry) return entry;
      }
    } catch { /* Unavailable/corrupt storage must not break the dashboard. */ }
    const existing = pending.get(key);
    if (existing) return existing as Promise<CacheEntry<T>>;
  }
  const request = (async () => {
    const data = await fetcher();
    const entry = { updatedAt: now(), data };
    try { storage.setItem(key, JSON.stringify(entry)); } catch { /* Storage may be full. */ }
    return entry;
  })();
  pending.set(key, request);
  try { return await request; }
  finally { if (pending.get(key) === request) pending.delete(key); }
}