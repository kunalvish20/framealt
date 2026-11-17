/** Bounded, memory-only presentation cache. Never an authorization source. */
export function createCache({ max = 100, ttl = 30_000, now = Date.now } = {}) {
  const entries = new Map();
  function peek(key) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= now()) { entries.delete(key); return undefined; }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }
  function load(key, loader) {
    const existing = peek(key);
    if (existing !== undefined) return existing;
    const promise = Promise.resolve().then(loader);
    const entry = { value: promise, expires: now() + ttl };
    entries.set(key, entry);
    while (entries.size > max) entries.delete(entries.keys().next().value);
    // Do not repopulate an entry removed at an auth boundary or by eviction.
    promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });
    return promise;
  }
  return { peek, load, delete: key => entries.delete(key), clear: () => entries.clear() };
}
export const presentationCache = createCache({ max: 50, ttl: 30_000 });
export const thumbnailCache = createCache({ max: 200, ttl: 5 * 60_000 });
export function clearClientCaches() { presentationCache.clear(); thumbnailCache.clear(); }
