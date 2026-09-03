/**
 * Vercel KV (Upstash Redis) implementation of Store.
 *
 * If the Vercel KV Marketplace integration only provisions UPSTASH_REDIS_REST_*
 * vars rather than KV_REST_API_*, either alias them in the Vercel dashboard or
 * swap this file for the @upstash/redis client — the Store interface is the seam.
 */

import { kv } from '@vercel/kv';
import type { Store } from '@/lib/store';

export const kvStore: Store = {
  async get<T>(key: string): Promise<T | null> {
    return (await kv.get<T>(key)) ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await kv.set(key, value);
  },
  async keys(prefix: string): Promise<string[]> {
    const out: string[] = [];
    let cursor = 0;
    do {
      const [next, batch] = await kv.scan(cursor, {
        match: `${prefix}*`,
        count: 200,
      });
      out.push(...batch);
      cursor = Number(next);
    } while (cursor !== 0);
    return out;
  },
};
