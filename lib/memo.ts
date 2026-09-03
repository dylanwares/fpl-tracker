/**
 * Tiny in-process TTL memo. Next's data cache refuses payloads over 2MB, and
 * `/bootstrap-static/` is ~2.3MB, so without this every route would re-fetch it
 * from FPL. A warm serverless instance keeps the parsed copy for the TTL;
 * request-level `cache()` handles dedupe within a single render.
 */
const entries = new Map<string, { value: unknown; expires: number }>();

export function ttlMemo<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>,
): Promise<T> {
  const hit = entries.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) {
    return Promise.resolve(hit.value as T);
  }
  const p = produce().then((value) => {
    entries.set(key, { value, expires: now + ttlSeconds * 1000 });
    return value;
  });
  return p;
}
